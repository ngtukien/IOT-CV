"""Đọc và chuẩn hoá telemetry — GIAI ĐOẠN 6, mở rộng ở Phase 05.

Frontend KHÔNG BAO GIỜ đọc MAVLink trực tiếp. Luồng bắt buộc:

    Flight Controller -> MAVLink -> Python backend -> Normalized JSON -> Frontend

Chia làm ba phần theo mức độ "bẩn":

- `update_state()`  — HÀM THUẦN, không I/O, không side-effect. Test không cần SITL.
- `build_telemetry()` — thuần, dựng bản gửi đi và tính các giá trị DẪN XUẤT.
- `TelemetryReader` — phần có I/O: thread nền, vòng nối lại, phát sự kiện.

Hình dạng dữ liệu KHÔNG định nghĩa ở đây — nó thuộc `backend/schemas.py`
(hợp đồng WebSocket là nguồn sự thật duy nhất).
"""

from __future__ import annotations

import logging
import math
import threading
import time

from backend import config
from backend.events import BUS
from backend.mavlink import proximity
from backend.mavlink.connection import MSG_ID_HOME_POSITION, MavlinkConnection
from backend.schemas import EventPayload, Telemetry, TelemetryState

log = logging.getLogger(__name__)

# `TelemetryState` ở lại trong namespace này để code và test có sẵn không phải
# đổi import. Định nghĩa thật nằm ở schemas.py cùng chỗ với hợp đồng.
__all__ = [
    "COPTER_MODES",
    "MODE_IDS",
    "EKF_ATTITUDE",
    "EKF_CONST_POS_MODE",
    "EKF_POS_HORIZ_ABS",
    "EKF_VELOCITY_HORIZ",
    "TelemetryReader",
    "TelemetryState",
    "build_telemetry",
    "is_link_alive",
    "mode_name",
    "statustext_event",
    "update_state",
]

# Gói của Mission Protocol mà thread đọc chuyển thẳng cho `MissionManager`
# (Phase 07). Khai ở đây — nơi định tuyến — chứ không ở mission.py: mission.py
# import control.py, control.py import file này, nên chiều ngược lại là vòng.
MISSION_MESSAGE_TYPES = (
    "MISSION_REQUEST",
    "MISSION_REQUEST_INT",
    "MISSION_ACK",
    "MISSION_COUNT",
    "MISSION_ITEM_INT",
)

# Bit MAV_MODE_FLAG_SAFETY_ARMED trong HEARTBEAT.base_mode
_ARMED_FLAG = 0b1000_0000

# HEARTBEAT.type = MAV_TYPE_GCS (6): một trạm mặt đất, KHÔNG phải máy bay.
# Xem khối ĐÃ ĐO trong `update_state`.
_MAV_TYPE_GCS = 6

# custom_mode -> tên mode của ArduCopter.
COPTER_MODES: dict[int, str] = {
    0: "STABILIZE",
    1: "ACRO",
    2: "ALT_HOLD",
    3: "AUTO",
    4: "GUIDED",
    5: "LOITER",
    6: "RTL",
    7: "CIRCLE",
    9: "LAND",
    11: "DRIFT",
    13: "SPORT",
    14: "FLIP",
    15: "AUTOTUNE",
    16: "POSHOLD",
    17: "BRAKE",
    18: "THROW",
    19: "AVOID_ADSB",
    20: "GUIDED_NOGPS",
    21: "SMART_RTL",
    22: "FLOWHOLD",
    23: "FOLLOW",
    24: "ZIGZAG",
    25: "SYSTEMID",
    26: "AUTOROTATE",
    27: "AUTO_RTL",
}

# Bảng ĐẢO: tên mode -> custom_mode. Dựng từ COPTER_MODES chứ không gõ tay lần
# hai — hai bảng tay sẽ lệch nhau đúng vào hôm ai đó thêm một mode.
MODE_IDS: dict[str, int] = {name: value for value, name in COPTER_MODES.items()}

# STATUSTEXT.severity theo thang syslog: 0 emergency .. 7 debug.
_SEVERITY_ERROR_MAX = 3
_SEVERITY_WARN = 4

# Backoff khi nối lại: 1 -> 2 -> 4 -> 8 -> 10 (trần) giây.
_BACKOFF_START_S = 1.0
_BACKOFF_MAX_S = 10.0

# Cờ trong EKF_STATUS_REPORT.flags (EKF_STATUS_FLAGS của MAVLink).
EKF_ATTITUDE = 1
EKF_VELOCITY_HORIZ = 2
EKF_POS_HORIZ_ABS = 16
EKF_CONST_POS_MODE = 128


def _ekf_ok_tu_flags(flags: int) -> bool:
    """EKF có đủ tin cậy để bay dẫn đường hay không.

    ┌─ ĐÃ ĐO, KHÔNG ĐOÁN (Phase 05, việc 5.2.5) ────────────────────────────┐
    │ Plan gợi ý suy `ekf_ok` từ bit AHRS trong                             │
    │ `SYS_STATUS.onboard_control_sensors_health`. Đo A/B trên SITL         │
    │ (ArduCopter 4.7-dev, 2026-09-22) cho thấy gợi ý đó SAI:               │
    │                                                                        │
    │   GPS tắt  (EKF hỏng): health = 0x4771FC2F                            │
    │   GPS bật  (EKF khoẻ): health = 0x5771FC2F                            │
    │   XOR                 = 0x10000000  -> PREARM_CHECK, KHÔNG phải AHRS  │
    │                                                                        │
    │ Bit AHRS `0x20000000` thậm chí không có trong `..._present`. Cứ theo   │
    │ plan mà làm thì `ekf_ok` sẽ LUÔN False — đúng kiểu "chặn arm nhầm" mà │
    │ plan lo. Còn PREARM_CHECK thì rộng hơn EKF, đặt tên `ekf_ok` cho nó    │
    │ là nói dối người đọc.                                                  │
    │                                                                        │
    │ Nguồn ĐÚNG là EKF_STATUS_REPORT (id 193). Đo cùng lúc, lặp lại được:  │
    │   khoẻ  flags=0x033F  ATTITUDE VEL_H VEL_V POS_H_REL POS_H_ABS ...    │
    │   hỏng  flags=0x00A7  ATTITUDE VEL_H VEL_V POS_V_ABS CONST_POS_MODE   │
    │   bật lại -> 0x033F (về đúng trạng thái cũ)                           │
    │                                                                        │
    │ CONST_POS_MODE = EKF đã bỏ cuộc và ghim vị trí cố định. Nó bật thì     │
    │ mọi thứ dựa vào vị trí đều không đáng tin, nên phải xét riêng.         │
    └────────────────────────────────────────────────────────────────────────┘
    """
    can = EKF_ATTITUDE | EKF_VELOCITY_HORIZ | EKF_POS_HORIZ_ABS
    return (flags & can) == can and not (flags & EKF_CONST_POS_MODE)


def mode_name(custom_mode: int) -> str:
    """Đổi custom_mode của Copter thành tên người đọc được."""
    return COPTER_MODES.get(custom_mode, f"MODE_{custom_mode}")


def update_state(state: TelemetryState, msg, now: float | None = None) -> TelemetryState:
    """Cập nhật `state` từ một message MAVLink. Hàm thuần, mutate và trả lại state.

    Message không quan tâm thì bỏ qua, không raise, và KHÔNG chạm `last_update`
    (nếu chạm thì một dòng RAW_IMU sẽ giữ cho link "còn sống" giả tạo).

    STATUSTEXT cố ý KHÔNG vào state: nó là sự kiện, không phải trạng thái.
    Dùng `statustext_event()` để đổi nó thành `EventPayload`.
    """
    msg_type = msg.get_type()
    timestamp = time.monotonic() if now is None else now

    if msg_type == "HEARTBEAT":
        # ┌─ ĐÃ ĐO TRÊN SITL (25/09/2026, nghiệm thu Phase 07) ─────────────┐
        # │ ArduPilot CHUYỂN TIẾP gói giữa các cổng. Mission Planner nối cổng │
        # │ 5762 thì HEARTBEAT của nó (sysid 255, type GCS, custom_mode 0,   │
        # │ base_mode 0) cũng đi ra cổng 5760 của backend. Coi nó là của máy │
        # │ bay thì mode nhảy GUIDED <-> "STABILIZE", armed nhảy True <-> False│
        # │ mỗi giây: MissionManager.start() báo "Chưa armed" khi máy bay     │
        # │ đang bay, và hub tưởng phi công gạt RC nên thu quyền lái vô cớ.   │
        # │ Lớp chặn chính là lọc theo sysid ở TelemetryReader; dòng dưới là  │
        # │ lớp thứ hai cho hàm thuần này.                                    │
        # └───────────────────────────────────────────────────────────────────┘
        if getattr(msg, "type", None) == _MAV_TYPE_GCS:
            return state
        state.connected = True
        state.mode = mode_name(getattr(msg, "custom_mode", 0))
        state.armed = bool(getattr(msg, "base_mode", 0) & _ARMED_FLAG)

    elif msg_type == "GLOBAL_POSITION_INT":
        state.lat = msg.lat / 1e7
        state.lon = msg.lon / 1e7
        state.relative_alt = msg.relative_alt / 1000.0
        state.absolute_alt = getattr(msg, "alt", 0) / 1000.0  # AMSL
        # hdg tính theo centi-degree; 65535 nghĩa là không xác định.
        if getattr(msg, "hdg", 65535) != 65535:
            state.heading = int(msg.hdg / 100)

    elif msg_type == "GPS_RAW_INT":
        state.satellites = msg.satellites_visible
        state.gps_fix_type = msg.fix_type

    elif msg_type == "ATTITUDE":
        state.roll = math.degrees(msg.roll)
        state.pitch = math.degrees(msg.pitch)
        # yaw của MAVLink là -pi..pi; UI muốn la bàn 0..359.
        state.yaw = math.degrees(getattr(msg, "yaw", 0.0)) % 360.0

    elif msg_type == "SYS_STATUS":
        # voltage_battery tính theo mV; 0 và 65535 nghĩa là không có số đo.
        voltage = getattr(msg, "voltage_battery", 65535)
        if voltage not in (0, 65535):
            state.battery_voltage = voltage / 1000.0
        # Bit PROXIMITY, không phải LASER_POSITION — xem khối ĐÃ ĐO ở proximity.py.
        state.rangefinder_healthy = proximity.rangefinder_healthy_from_sys_status(msg)
        # ekf_ok KHÔNG lấy từ đây — xem nhánh EKF_STATUS_REPORT bên dưới và
        # khối chú thích của `_ekf_ok_tu_flags`.

    elif msg_type == "EKF_STATUS_REPORT":
        state.ekf_ok = _ekf_ok_tu_flags(getattr(msg, "flags", 0))

    elif msg_type == "BATTERY_STATUS":
        # current_battery tính theo cA (10 mA); -1 nghĩa là không đo được.
        current = getattr(msg, "current_battery", -1)
        state.battery_current = None if current == -1 else current / 100.0
        remaining = getattr(msg, "battery_remaining", -1)
        state.battery_remaining = None if remaining == -1 else int(remaining)

    elif msg_type == "HOME_POSITION":
        state.home_lat = msg.latitude / 1e7
        state.home_lon = msg.longitude / 1e7

    elif msg_type == "DISTANCE_SENSOR":
        # Phase 07 §7.6.1. orientation 0..7 = tám cung 45°, 0 = mũi.
        orient = int(getattr(msg, "orientation", -1))
        metres = proximity.distance_sensor_m(msg)
        if orient == proximity.ROTATION_FORWARD:
            state.obstacle_distance = metres
            state.proximity_clear = proximity.distance_sensor_is_clear(msg)
            state.proximity_updated = timestamp
        if 0 <= orient < proximity.SECTOR_COUNT:
            sectors = list(state.obstacle_sectors)
            sectors[orient] = metres
            state.obstacle_sectors = sectors

    elif msg_type == "OBSTACLE_DISTANCE":
        # Phase 07 §7.6.2. SITL dự án KHÔNG phát gói này (đo 25/09/2026) — đường
        # của cảm biến 360° nếu sau này gắn thêm.
        state.obstacle_sectors = proximity.aggregate_obstacle_sectors(msg)

    elif msg_type == "VFR_HUD":
        state.ground_speed = msg.groundspeed
        state.climb_rate = getattr(msg, "climb", None)
        if state.heading is None:
            state.heading = int(msg.heading)

    else:
        return state

    state.last_update = timestamp
    return state


def statustext_event(msg) -> EventPayload:
    """Đổi một STATUSTEXT thành `EventPayload`. Thuần — không tự phát đi."""
    severity = int(getattr(msg, "severity", 6))
    if severity <= _SEVERITY_ERROR_MAX:
        level = "error"
    elif severity == _SEVERITY_WARN:
        level = "warn"
    else:
        level = "info"

    text = getattr(msg, "text", "")
    if isinstance(text, bytes | bytearray):
        text = text.decode("utf-8", errors="replace")
    text = str(text).rstrip("\x00").strip()

    return EventPayload(
        level=level,  # type: ignore[arg-type]
        source="mavlink",
        code="statustext",
        message=text,
        detail={"severity": severity},
        ts=time.time(),
    )


def is_link_alive(state: TelemetryState, now: float | None = None) -> bool:
    """Link còn sống hay không, dựa trên thời điểm nhận message cuối."""
    if state.last_update is None:
        return False
    timestamp = time.monotonic() if now is None else now
    return (timestamp - state.last_update) < config.LINK_TIMEOUT_S


def build_telemetry(state: TelemetryState, now: float | None = None) -> Telemetry:
    """Dựng bản gửi đi từ bản lưu. Thuần.

    Hai giá trị DẪN XUẤT được tính ở đây chứ không lưu trong state (xem
    `rules/code-conventions.md` § No Derived Fields — lưu là chắc chắn sẽ lệch):

    - `link_age_ms` — tuổi của message MAVLink cuối;
    - `connected`   — link CÒN SỐNG, không phải "đã từng nối".
    """
    timestamp = time.monotonic() if now is None else now

    link_age_ms: int | None = None
    if state.last_update is not None:
        link_age_ms = int((timestamp - state.last_update) * 1000)

    fields = state.model_dump(
        exclude={"connected", "last_update", "proximity_updated", "proximity_clear"}
    )

    # Proximity: số đo cũ KHÔNG được hiện như số đo mới. Quá PROXIMITY_STALE_S
    # thì che hết thành null — một con số mét đứng im trên màn hình trong khi
    # cảm biến đã chết là một lời nói dối về khoảng cách.
    age_s = None if state.proximity_updated is None else timestamp - state.proximity_updated
    if age_s is None or age_s > config.PROXIMITY_STALE_S:
        fields["obstacle_distance"] = None
        fields["obstacle_sectors"] = [None] * proximity.SECTOR_COUNT
    # Mất link thì KHÔNG biết gì về vật cản — cờ "khoẻ" cuối cùng đã cũ. Thiếu
    # dòng này, nghiệm thu SITL 25/09/2026 thấy 63 mẫu `connected=false` mà
    # `avoid_state=OFF`: UI nói "trống trải" dựa trên số liệu của một link đã chết.
    link_alive = state.connected and is_link_alive(state, now=timestamp)
    fields["avoid_state"] = proximity.avoid_state(
        fields["obstacle_distance"],
        state.mode,
        healthy=state.rangefinder_healthy and link_alive,
        age_s=age_s,
        clear=state.proximity_clear,
    )
    return Telemetry(
        **fields,
        connected=state.connected and is_link_alive(state, now=timestamp),
        link_age_ms=link_age_ms,
    )


class TelemetryReader:
    """Đọc MAVLink trong thread nền, tự nối lại, và cập nhật `TelemetryState`.

    Không làm backend chết khi chưa có SITL: connect thất bại thì phát sự kiện
    `link.connect_failed`, ngủ theo backoff, rồi thử lại — chứ không bỏ cuộc.
    Bản trước đây `return` ngay lần lỗi đầu, nghĩa là backend sống nhưng VĨNH
    VIỄN không có telemetry, và không có gì báo cho người dùng biết.
    """

    def __init__(
        self,
        connection: MavlinkConnection | None = None,
        state: TelemetryState | None = None,
        bus=BUS,
        mission_sink=None,
    ) -> None:
        self.connection = connection or MavlinkConnection()
        self.state = state or TelemetryState()
        self.bus = bus
        # Nơi nhận gói MISSION_* (Phase 07) — thường là `MissionManager.on_message`.
        # Gán sau khi dựng được, vì MissionManager cần chính connection của reader.
        self.mission_sink = mission_sink
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="telemetry", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 15.0) -> None:
        """Dừng thread đọc.

        `timeout` mặc định phải LỚN HƠN `HEARTBEAT_TIMEOUT_S` (10 s): nếu thread
        đang nằm trong `wait_heartbeat()` thì nó không thấy cờ stop cho tới khi
        lần chờ đó hết giờ. Đặt 3 s như bản trước thì `join` LUÔN quá hạn.

        Và chỉ xoá `_thread` khi join THẬT SỰ xong. Xoá bừa thì cái canh trong
        `start()` mất tác dụng, và một `start()` sau đó sẽ đẻ ra thread thứ hai
        cùng ghi vào một `TelemetryState`.
        """
        self._stop.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=timeout)
            if thread.is_alive():
                log.error(
                    "Thread telemetry chưa dừng sau %.0fs — GIỮ nguyên tham chiếu để "
                    "start() không tạo thread thứ hai",
                    timeout,
                )
            else:
                self._thread = None
        self.connection.close()
        self.state.connected = False

    # -- vòng đời link ------------------------------------------------------
    def _run(self) -> None:
        backoff = _BACKOFF_START_S
        that_bai_lien_tiep = 0
        while not self._stop.is_set():
            if not self._try_connect(lan_thu=that_bai_lien_tiep):
                that_bai_lien_tiep += 1
                # `wait` chứ không `sleep`: stop() phải cắt được ngay, không
                # bắt người dùng chờ hết 10 giây backoff khi tắt backend.
                self._stop.wait(backoff)
                backoff = min(backoff * 2, _BACKOFF_MAX_S)
                continue

            backoff = _BACKOFF_START_S
            that_bai_lien_tiep = 0
            self._read_until_link_dies()

            self.state.connected = False
            self.connection.close()
            if not self._stop.is_set():
                # Mức `error` (Phase 07 §7.7): mất link là mất MỌI thứ backend
                # biết về máy bay. Backend KHÔNG gửi RTL/LAND — gửi vào đâu? FC
                # tự lo bằng failsafe của nó (FS_GCS_ENABLE).
                self.bus.emit(
                    "error",
                    "mavlink",
                    "link.lost",
                    f"Mất liên lạc với flight controller ({self.connection.endpoint})",
                )

    def _try_connect(self, lan_thu: int = 0) -> bool:
        try:
            self.connection.connect()
        except Exception as exc:  # pymavlink raise nhiều loại tuỳ endpoint  # noqa: BLE001
            log.warning("Chưa kết nối được MAVLink (%s). Sẽ thử lại.", exc)
            self.state.connected = False
            # Đóng socket đã mở dở: `connect()` gán `self.master` TRƯỚC khi chờ
            # heartbeat, nên ném ở bước chờ là để lại một cổng UDP đã bind, chờ
            # gc dọn hộ.
            self.connection.close()
            # CHỈ phát sự kiện ở lần hỏng ĐẦU. Vòng đệm chỉ có 200 chỗ và tab
            # mới mở được phát lại 50 cái gần nhất; FC tắt một tiếng là ring
            # đầy ắp một dòng "connect_failed" giống hệt nhau, đẩy hết
            # statustext / link.lost / web_control.revoked ra ngoài — đúng thứ
            # vòng đệm sinh ra để giữ.
            if lan_thu == 0:
                self.bus.emit(
                    "warn",
                    "mavlink",
                    "link.connect_failed",
                    f"Chưa kết nối được {self.connection.endpoint}: {exc}. "
                    f"Sẽ tự thử lại, không báo thêm cho tới khi nối được.",
                )
            return False

        # wait_heartbeat() đã thành công nhưng message đó không đi qua
        # update_state(), nên last_update vẫn None. Không đóng dấu ở đây thì
        # is_link_alive() trả False ngay vòng đầu và link "chết" tức khắc.
        self.state.connected = True
        self.state.last_update = time.monotonic()

        self._request_streams()
        self.bus.emit(
            "info",
            "mavlink",
            "link.up",
            f"Đã nối flight controller qua {self.connection.endpoint}",
        )
        return True

    def _request_streams(self) -> None:
        """Xin stream rate + HOME_POSITION. PHẢI chạy sau MỖI lần nối lại."""
        try:
            self.connection.request_streams()
            self.connection.request_message(MSG_ID_HOME_POSITION)
        except Exception as exc:  # noqa: BLE001
            # Không nối lại vì việc này: telemetry chậm vẫn hơn không có.
            log.warning("Xin stream rate thất bại: %s", exc)
            self.bus.emit(
                "warn",
                "mavlink",
                "link.stream_request_failed",
                f"Không xin được stream rate: {exc}",
            )

    def _tu_flight_controller(self, msg) -> bool:
        get_src = getattr(msg, "get_srcSystem", None)
        target = self.connection.target_system
        if get_src is None or target is None:
            return True
        return get_src() == target

    def _read_until_link_dies(self) -> None:
        log.info("Bắt đầu đọc telemetry từ %s", self.connection.endpoint)
        was_armed = self.state.armed

        while not self._stop.is_set():
            try:
                msg = self.connection.recv_match(blocking=True, timeout=1.0)
            except OSError as exc:
                log.warning("Lỗi đọc MAVLink: %s", exc)
                return

            if msg is None:
                # Im lặng quá LINK_TIMEOUT_S -> coi như đứt, ra ngoài nối lại.
                if not is_link_alive(self.state):
                    return
                continue

            # Chỉ nghe CHÍNH flight controller. Gói của GCS khác (Mission
            # Planner) được FC chuyển tiếp sang đây — xem khối ĐÃ ĐO ở nhánh
            # HEARTBEAT của `update_state`. Không có sysid (đồ giả trong test)
            # thì không lọc.
            if not self._tu_flight_controller(msg):
                continue

            if msg.get_type() == "STATUSTEXT":
                event = statustext_event(msg)
                self.bus.emit(event.level, event.source, event.code, event.message, event.detail)
                continue

            # COMMAND_ACK phải đi qua ĐÂY, không phải `state`. Chỉ MỘT thread
            # được đọc socket, nên hàm `FlightControl.*` chờ ack ở thread khác
            # KHÔNG tự gọi `recv_match` được — hai bên đọc cùng socket thì mỗi
            # bên nuốt mất message của bên kia. Thread này nhét ack vào hàng
            # đợi của người đang chờ (Phase 06, việc 6.1.1).
            if msg.get_type() == "COMMAND_ACK":
                self.connection.route_ack(msg)
                continue

            # Cùng lý do với COMMAND_ACK: upload mission chạy ở thread khác và
            # không được tự đọc socket. Nhưng MISSION_COUNT/ITEM không có gì cho
            # `state`, nên không đi tiếp xuống update_state.
            if msg.get_type() in MISSION_MESSAGE_TYPES:
                if self.mission_sink is not None:
                    self.mission_sink(msg)
                continue

            update_state(self.state, msg)

            # HOME_POSITION không có nhịp; FC đặt lại home lúc arm nên phải xin
            # lại đúng lúc đó, nếu không marker home trên bản đồ sẽ là chỗ cũ.
            if self.state.armed and not was_armed:
                try:
                    self.connection.request_message(MSG_ID_HOME_POSITION)
                except Exception as exc:  # noqa: BLE001
                    log.warning("Không xin lại được HOME_POSITION: %s", exc)
            was_armed = self.state.armed
