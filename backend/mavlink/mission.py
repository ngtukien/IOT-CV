"""Mission waypoint: validate (GIAI ĐOẠN 14) và upload/readback/start (Phase 07).

`validate_mission()` và `validate_mission_structure()` là logic thuần, test được
không cần drone — và phải chạy TRƯỚC mọi lần upload. Backend không bao giờ đẩy
mission chưa validate xuống flight controller.

Mission protocol là một cuộc HỎI ĐÁP, không phải một lần đẩy:

    GCS -> MISSION_COUNT(n)
    FC  -> MISSION_REQUEST_INT seq=i        (bản cũ: MISSION_REQUEST — nhận CẢ HAI)
    GCS -> MISSION_ITEM_INT seq=i           (trả lời theo seq FC HỎI, không theo
    ...                                      bộ đếm của mình — FC có quyền hỏi lại)
    FC  -> MISSION_ACK

Mission mới chỉ được thay mission cũ sau khi FC ACK. Và chỉ mission đã ĐỌC LẠI
được từ FC mới được gọi là `readback` — UI không bao giờ vẽ "mission tôi NGHĨ là
mình đã gửi".

╔══════════════════════════════════════════════════════════════════════════╗
║  Chỉ MỘT thread được đọc socket MAVLink — thread telemetry. File này KHÔNG ║
║  gọi `recv_match`. Thread telemetry chuyển các gói MISSION_* vào           ║
║  `MissionManager.on_message()`; hàm upload/download chờ trên hàng đợi đó.  ║
║  Mọi lệnh GHI đi qua `MavlinkConnection.send` (khối LUẬT ở connection.py). ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
import math
import queue
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from backend import config
from backend.mavlink.control import MAV_RESULT_ACCEPTED, MAV_RESULT_NAMES, ControlError
from backend.mavlink.telemetry import MISSION_MESSAGE_TYPES
from backend.schemas import (
    MISSION_CMD_LAND,
    MISSION_CMD_RTL,
    MISSION_CMD_TAKEOFF,
    MISSION_CMD_WAYPOINT,
    MISSION_COMMANDS,
)

log = logging.getLogger(__name__)

EARTH_RADIUS_M = 6_371_000.0

# Hằng số MAVLink — khai tay (như control.py) để test chạy không cần pymavlink.
MAV_MISSION_TYPE_MISSION = 0
MAV_FRAME_GLOBAL = 0
# Độ cao SO VỚI HOME, lat/lon nguyên nhân 1e7. Dùng nhầm GLOBAL (0) = AMSL là
# lý do số một khiến Mission Planner hiện độ cao gấp nhiều lần mong đợi.
MAV_FRAME_GLOBAL_RELATIVE_ALT_INT = 6
MAV_MISSION_ACCEPTED = 0
MAV_CMD_MISSION_START = 300

# MAV_MISSION_RESULT -> (tên, nghĩa dễ hiểu). Phase 07 §7.3 điểm 3.
MISSION_ACK_NAMES: dict[int, tuple[str, str]] = {
    1: ("MAV_MISSION_ERROR", "FC từ chối, không nói rõ lý do"),
    2: ("MAV_MISSION_UNSUPPORTED_FRAME", "sai `frame` của item"),
    3: ("MAV_MISSION_UNSUPPORTED", "lệnh này Copter không hỗ trợ"),
    4: ("MAV_MISSION_NO_SPACE", "vượt số waypoint FC chứa được"),
    5: ("MAV_MISSION_INVALID", "tham số item sai"),
    10: ("MAV_MISSION_INVALID_SEQUENCE", "gửi sai thứ tự — phải trả lời theo seq FC hỏi"),
    13: ("MAV_MISSION_OPERATION_CANCELLED", "bị một GCS khác cắt ngang"),
}

_COMMAND_NAMES = {
    MISSION_CMD_WAYPOINT: "NAV_WAYPOINT",
    MISSION_CMD_RTL: "NAV_RETURN_TO_LAUNCH",
    MISSION_CMD_LAND: "NAV_LAND",
    MISSION_CMD_TAKEOFF: "NAV_TAKEOFF",
}

# Lệnh KHÔNG mang toạ độ. Copter bỏ qua lat/lon/alt của chúng, và khi đọc lại
# FC còn trả `frame` khác cái ta gửi (đo 22/09/2026 ở Phase 03: gửi frame 3,
# đọc lại frame 0) — nên readback không so toạ độ/frame của chúng.
_LENH_KHONG_TOA_DO = frozenset({MISSION_CMD_RTL})
# TAKEOFF: Copter cất cánh TẠI CHỖ, lat/lon bị bỏ qua; chỉ alt có nghĩa.
_LENH_CHI_ALT = frozenset({MISSION_CMD_TAKEOFF})


@dataclass(frozen=True)
class Waypoint:
    """Một item của người dùng. `command` mặc định NAV_WAYPOINT (16)."""

    seq: int
    lat: float
    lon: float
    alt: float
    command: int = MISSION_CMD_WAYPOINT


@dataclass(frozen=True)
class MissionItem:
    """Một item ĐÚNG như nằm trên dây (MISSION_ITEM_INT), đã đánh số lại."""

    seq: int
    command: int
    frame: int
    x: int  # lat * 1e7
    y: int  # lon * 1e7
    z: float  # alt, mét
    param1: float = 0.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Khoảng cách mặt đất giữa hai toạ độ, mét."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _is_valid_coordinate(lat: float, lon: float) -> bool:
    if any(math.isnan(v) or math.isinf(v) for v in (lat, lon)):
        return False
    if not -90.0 <= lat <= 90.0 or not -180.0 <= lon <= 180.0:
        return False
    # (0, 0) gần như luôn là lỗi dữ liệu chứ không phải waypoint thật.
    return not (lat == 0.0 and lon == 0.0)


def validate_mission(
    waypoints: list[Waypoint],
    home: tuple[float, float] | None = None,
    *,
    max_alt: float | None = None,
    min_alt: float | None = None,
    max_distance_home: float | None = None,
    max_waypoints: int | None = None,
) -> list[str]:
    """Kiểm từng item. Trả về danh sách lỗi; rỗng nghĩa là từng item đều sạch.

    Sáu luật reject của GIAI ĐOẠN 14: 0 waypoint, altitude quá thấp, altitude
    vượt giới hạn demo, waypoint quá xa home, toạ độ invalid, quá số waypoint
    cho phép. Phase 07 thêm: `command` phải nằm trong danh sách trắng, và lệnh
    không mang toạ độ (RTL; lat/lon của TAKEOFF, LAND tại chỗ) không bị kiểm
    toạ độ/độ cao vô nghĩa.

    Luật CẤU TRÚC (item đầu TAKEOFF, item cuối RTL/LAND) nằm riêng ở
    `validate_mission_structure()`: hàm này kiểm TỪNG ĐIỂM, hàm kia kiểm cả
    CHUYẾN BAY. Đường upload chạy cả hai — xem `validate_for_upload()`.

    ⚠️ Geofence PHẦN MỀM chỉ là lớp phụ. `MAX_DISTANCE_HOME` và `MAX_ALT` ở đây
    bắt lỗi GÕ NHẦM; chúng KHÔNG thay thế `FENCE_*` trên flight controller —
    lớp authoritative (SAFETY.md mục 8, Phase 19). Backend chết thì geofence
    này chết theo; geofence của FC thì không.
    """
    limit_max_alt = config.MAX_ALT if max_alt is None else max_alt
    limit_min_alt = config.MIN_ALT if min_alt is None else min_alt
    limit_distance = config.MAX_DISTANCE_HOME if max_distance_home is None else max_distance_home
    limit_count = config.MAX_WAYPOINTS if max_waypoints is None else max_waypoints

    errors: list[str] = []

    if not waypoints:
        errors.append("Mission không có waypoint nào")
        return errors

    if len(waypoints) > limit_count:
        errors.append(f"Mission có {len(waypoints)} waypoint, vượt giới hạn {limit_count}")

    for wp in waypoints:
        if wp.command not in MISSION_COMMANDS:
            errors.append(
                f"WP{wp.seq}: lệnh {wp.command} không được phép — chỉ nhận "
                + ", ".join(f"{c} {_COMMAND_NAMES[c]}" for c in MISSION_COMMANDS)
            )
            continue
        if wp.command in _LENH_KHONG_TOA_DO:
            continue

        # LAND với (0, 0) = hạ cánh tại chỗ, quy ước của MAVLink. TAKEOFF thì
        # Copter luôn cất cánh tại chỗ. Hai trường hợp đó không kiểm toạ độ.
        tai_cho = wp.command == MISSION_CMD_LAND and wp.lat == 0.0 and wp.lon == 0.0
        kiem_toa_do = wp.command not in _LENH_CHI_ALT and not tai_cho
        if kiem_toa_do and not _is_valid_coordinate(wp.lat, wp.lon):
            errors.append(f"WP{wp.seq}: toạ độ không hợp lệ ({wp.lat}, {wp.lon})")
            continue

        # Độ cao của LAND là mặt đất — không có trần/sàn nào áp vào được.
        if wp.command != MISSION_CMD_LAND:
            if math.isnan(wp.alt) or wp.alt < limit_min_alt:
                errors.append(
                    f"WP{wp.seq}: altitude {wp.alt} m thấp hơn giới hạn {limit_min_alt} m"
                )
            elif wp.alt > limit_max_alt:
                errors.append(f"WP{wp.seq}: altitude {wp.alt} m vượt giới hạn {limit_max_alt} m")

        if home is not None and kiem_toa_do:
            distance = haversine_m(home[0], home[1], wp.lat, wp.lon)
            if distance > limit_distance:
                errors.append(
                    f"WP{wp.seq}: cách home {distance:.0f} m, vượt giới hạn {limit_distance:.0f} m"
                )

    return errors


def validate_mission_structure(waypoints: list[Waypoint]) -> list[str]:
    """Hai luật của Phase 07 §7.1, về HÌNH DẠNG cả chuyến bay.

    7. Item đầu phải là NAV_TAKEOFF — Copter KHÔNG tự cất cánh trong AUTO.
       Thiếu takeoff thì mission "chạy" mà máy bay nằm im, và người mới chắc
       chắn tưởng code hỏng.
    8. Item cuối phải là RTL hoặc LAND — mission kết thúc giữa trời thì Copter
       treo ở waypoint cuối tới khi hết pin.

    Backend KHÔNG tự chèn cái còn thiếu: chèn takeoff là tự quyết độ cao cất
    cánh, chèn RTL là tự quyết máy bay về đâu. Hai quyết định đó của người.
    """
    if not waypoints:
        return []  # "rỗng" đã do validate_mission báo; không báo trùng.
    errors: list[str] = []
    if waypoints[0].command != MISSION_CMD_TAKEOFF:
        errors.append(
            f"Item đầu tiên (WP{waypoints[0].seq}) phải là NAV_TAKEOFF ({MISSION_CMD_TAKEOFF}) — "
            "Copter không tự cất cánh trong AUTO. Thêm một item takeoff ở đầu mission."
        )
    if waypoints[-1].command not in (MISSION_CMD_RTL, MISSION_CMD_LAND):
        errors.append(
            f"Item cuối (WP{waypoints[-1].seq}) phải là NAV_RETURN_TO_LAUNCH ({MISSION_CMD_RTL}) "
            f"hoặc NAV_LAND ({MISSION_CMD_LAND}) — không thì drone treo ở điểm cuối tới hết pin."
        )
    return errors


def validate_for_upload(
    waypoints: list[Waypoint], home: tuple[float, float] | None = None
) -> list[str]:
    """Mọi luật mà đường upload phải qua: từng điểm + cấu trúc."""
    return validate_mission(waypoints, home) + validate_mission_structure(waypoints)


def build_mission_items(waypoints: list[Waypoint], home: tuple[float, float]) -> list[MissionItem]:
    """Dựng danh sách item ĐÚNG như gửi xuống dây (Phase 07 §7.2).

    seq 0 là ô HOME: ArduPilot ghi đè nó, nhưng nó PHẢI có mặt, nếu không item
    của người dùng lệch đi một dòng — item takeoff bị nuốt vào ô home. Quy ước
    này đã kiểm chứng ở Phase 03 (`scripts/sitl/run_mission_auto.py` + Mission
    Planner) và kiểm lại ở Phase 07 §7.5.

    Item của người dùng thứ i thành seq i+1, theo THỨ TỰ MẢNG — `seq` người
    dùng gõ chỉ dùng để thông báo lỗi.
    """
    items = [
        MissionItem(
            seq=0,
            command=MISSION_CMD_WAYPOINT,
            frame=MAV_FRAME_GLOBAL,
            x=round(home[0] * 1e7),
            y=round(home[1] * 1e7),
            z=0.0,
        )
    ]
    for i, wp in enumerate(waypoints, start=1):
        if wp.command in _LENH_KHONG_TOA_DO:
            x = y = 0
        else:
            x, y = round(wp.lat * 1e7), round(wp.lon * 1e7)
        items.append(
            MissionItem(
                seq=i,
                command=wp.command,
                frame=MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                x=x,
                y=y,
                z=0.0 if wp.command in (MISSION_CMD_RTL, MISSION_CMD_LAND) else float(wp.alt),
            )
        )
    return items


def compare_readback(sent: list[MissionItem], got: list[MissionItem]) -> list[str]:
    """So mission đọc lại với mission vừa gửi. Trả danh sách chỗ lệch.

    Ô home (seq 0) không so — FC ghi đè nó bằng home thật. Toạ độ lệch tối đa
    1 đơn vị 1e-7 độ (sai số làm tròn), alt lệch tối đa
    `MISSION_READBACK_ALT_TOL_M`, `command` phải trùng tuyệt đối.
    """
    lech: list[str] = []
    if len(got) != len(sent):
        lech.append(f"FC giữ {len(got)} item, đã gửi {len(sent)}")
        return lech
    tol_alt = config.MISSION_READBACK_ALT_TOL_M
    for s, g in zip(sent[1:], got[1:], strict=True):
        if s.command != g.command:
            lech.append(f"item {s.seq}: command {g.command} != {s.command}")
            continue
        if s.command in _LENH_KHONG_TOA_DO:
            continue
        if s.command not in _LENH_CHI_ALT and (abs(s.x - g.x) > 1 or abs(s.y - g.y) > 1):
            lech.append(f"item {s.seq}: toạ độ ({g.x}, {g.y}) != ({s.x}, {s.y})")
        if abs(s.z - g.z) > tol_alt:
            lech.append(f"item {s.seq}: alt {g.z:.2f} != {s.z:.2f}")
    return lech


def ack_message(result: int) -> str:
    """Dịch MAV_MISSION_RESULT ra câu tiếng Việt."""
    ten, nghia = MISSION_ACK_NAMES.get(result, (f"MAV_MISSION_RESULT={result}", "không rõ"))
    return f"Flight controller từ chối mission: {ten} — {nghia}"


@dataclass
class UploadResult:
    count: int
    readback_ok: bool
    mismatches: list[str] = field(default_factory=list)


ProgressFn = Callable[[int, int], None]


class MissionManager:
    """Upload / download / clear / start mission qua Mission Protocol.

    Hàm upload/download CHẶN (chờ FC tới vài giây) — gọi qua `asyncio.to_thread`
    từ event loop, như mọi lệnh chậm của control.py.
    """

    def __init__(self, connection=None, state=None, control=None) -> None:
        self.connection = connection
        self.state = state
        self.control = control
        self.current: list[Waypoint] = []
        self.source: str = "none"  # none | readback | local — xem MissionStatus
        self.uploaded_at: float | None = None
        self.progress: tuple[int, int] = (0, 0)

        # Phiên độc quyền (§7.3 điểm 6): hai phiên upload chồng nhau làm FC
        # nhận item của CẢ HAI mission. Khoá không-chờ: lệnh thứ hai bị từ chối
        # ngay chứ không xếp hàng.
        self._busy = threading.Lock()
        # Hàng đợi chỉ mở khi đang có phiên; ngoài phiên thì gói MISSION_* bị
        # bỏ — nếu không, gói lẻ (ví dụ Mission Planner đang đọc mission) nằm
        # chờ sẵn và phiên sau đọc nhầm nó.
        self._inbox: queue.Queue | None = None

    # -- phía thread telemetry ------------------------------------------------
    message_types = MISSION_MESSAGE_TYPES

    def on_message(self, msg) -> None:
        """Thread telemetry gọi hàm này cho MỌI gói trong `MISSION_MESSAGE_TYPES`
        (định nghĩa ở telemetry.py).

        Bỏ gói gửi cho GCS KHÁC: Mission Planner nối cùng lúc cũng trao đổi
        MISSION_* với FC, và gói của nó có `target_system` là của nó.
        """
        inbox = self._inbox
        if inbox is None:
            return
        target = getattr(msg, "target_system", None)
        if target not in (None, 0, config.MAVLINK_SOURCE_SYSTEM):
            return
        mission_type = getattr(msg, "mission_type", MAV_MISSION_TYPE_MISSION)
        if mission_type != MAV_MISSION_TYPE_MISSION:
            return
        try:
            inbox.put_nowait(msg)
        except queue.Full:
            log.warning("Hàng đợi mission đầy — bỏ %s", msg.get_type())

    # -- tiện ích --------------------------------------------------------------
    def _require_link(self) -> None:
        if self.connection is None or not self.connection.connected:
            raise ControlError("not_connected", "Chưa có link MAVLink tới flight controller")

    def _send(self, fn_name: str, *args) -> None:
        master = self.connection.master
        self.connection.send(getattr(master.mav, fn_name), *args)

    def _target(self) -> tuple[int, int]:
        return self.connection.target_system, self.connection.target_component

    def _wait(self, types: tuple[str, ...], timeout: float, pred=None):
        """Chờ gói đầu tiên có loại trong `types` (và thoả `pred`). None nếu hết giờ."""
        inbox = self._inbox
        han = time.monotonic() + timeout
        while inbox is not None:
            con_lai = han - time.monotonic()
            if con_lai <= 0:
                return None
            try:
                msg = inbox.get(timeout=con_lai)
            except queue.Empty:
                return None
            if msg.get_type() in types and (pred is None or pred(msg)):
                return msg
        return None

    def _open_session(self) -> None:
        self._inbox = queue.Queue(maxsize=256)

    def _close_session(self) -> None:
        self._inbox = None

    def _send_item(self, item: MissionItem) -> None:
        ts, tc = self._target()
        self._send(
            "mission_item_int_send",
            ts,
            tc,
            item.seq,
            item.frame,
            item.command,
            0,  # current — upload luôn 0; FC tự chọn item bắt đầu
            1,  # autocontinue
            item.param1,
            0.0,
            0.0,
            0.0,
            item.x,
            item.y,
            item.z,
            MAV_MISSION_TYPE_MISSION,
        )

    # -- upload ----------------------------------------------------------------
    def upload(
        self,
        waypoints: list[Waypoint],
        home: tuple[float, float] | None = None,
        *,
        progress: ProgressFn | None = None,
    ) -> UploadResult:
        """Validate -> upload -> readback. Ném `ValueError` khi mission sai
        (TRƯỚC khi có bất kỳ gói nào được gửi), `ControlError` khi FC từ chối,
        hết giờ, hoặc đọc lại không khớp.
        """
        errors = validate_for_upload(waypoints, home)
        if errors:
            raise ValueError("; ".join(errors))
        if home is None:
            raise ValueError("Chưa biết toạ độ HOME từ flight controller — chờ GPS fix rồi thử lại")

        if not self._busy.acquire(blocking=False):
            raise ControlError(
                "command_denied",
                "Đang có một phiên upload mission khác — chờ nó xong rồi gửi lại",
            )
        try:
            self._require_link()
            items = build_mission_items(waypoints, home)
            self._open_session()
            try:
                self._upload_items(items, progress)
                # Từ đây FC ĐÃ giữ mission mới — backend phải phản ánh điều đó
                # ngay cả khi bước đọc lại hỏng: `current` = mới, `source` =
                # local (chưa xác nhận) cho tới khi readback khớp.
                self.current = list(waypoints)
                self.uploaded_at = time.time()
                self.source = "local"
                got = self._download_items()
            finally:
                self._close_session()

            lech = compare_readback(items, got)
            if lech:
                raise ControlError(
                    "command_denied",
                    "FC đã nhận mission nhưng đọc lại KHÔNG khớp cái vừa gửi — không được bay "
                    "mission này. Đối chiếu bằng Mission Planner (Read WPs).",
                    {"mismatches": lech[:10]},
                )
            self.source = "readback"
            return UploadResult(count=len(waypoints), readback_ok=True)
        finally:
            self._busy.release()

    def _upload_items(self, items: list[MissionItem], progress: ProgressFn | None) -> None:
        total = len(items)
        ts, tc = self._target()
        timeout = config.MISSION_ITEM_TIMEOUT_S
        for lan in range(1, max(1, config.MISSION_RETRIES) + 1):
            self._send("mission_count_send", ts, tc, total, MAV_MISSION_TYPE_MISSION)
            da_gui: set[int] = set()
            self.progress = (0, total)
            while True:
                msg = self._wait(("MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK"), timeout)
                if msg is None:
                    log.warning(
                        "Upload mission: FC im lặng %.1fs (lần %d/%d), gửi lại MISSION_COUNT",
                        timeout,
                        lan,
                        config.MISSION_RETRIES,
                    )
                    break
                if msg.get_type() == "MISSION_ACK":
                    result = int(getattr(msg, "type", -1))
                    if result != MAV_MISSION_ACCEPTED:
                        ten = MISSION_ACK_NAMES.get(result, (str(result), ""))[0]
                        raise ControlError(
                            "command_denied", ack_message(result), {"result": result, "name": ten}
                        )
                    if len(da_gui) < total:
                        raise ControlError(
                            "command_denied",
                            f"FC báo nhận xong khi mới gửi {len(da_gui)}/{total} item",
                            {"sent": len(da_gui), "total": total},
                        )
                    return
                # Trả lời ĐÚNG seq FC hỏi — kể cả khi seq đó đã gửi rồi (gói
                # rơi, FC hỏi lại). Trả theo bộ đếm riêng là lệch toàn bộ mission
                # từ điểm đó trở đi (§7.3 điểm 1).
                seq = int(msg.seq)
                if not 0 <= seq < total:
                    raise ControlError(
                        "command_denied",
                        f"FC hỏi item seq={seq} nằm ngoài mission {total} item",
                        {"seq": seq, "total": total},
                    )
                self._send_item(items[seq])
                da_gui.add(seq)
                self.progress = (len(da_gui), total)
                if progress is not None:
                    progress(len(da_gui), total)
        raise ControlError(
            "timeout",
            f"FC không trả lời upload mission sau {config.MISSION_RETRIES} lần thử "
            f"({timeout:g}s mỗi lần). Kiểm target_system/component và link.",
            {"retries": config.MISSION_RETRIES},
        )

    # -- download --------------------------------------------------------------
    def download(self) -> list[MissionItem]:
        """Đọc mission từ FC (chính là bước readback, dùng lẻ được)."""
        if not self._busy.acquire(blocking=False):
            raise ControlError("command_denied", "Đang có một phiên mission khác")
        try:
            self._require_link()
            self._open_session()
            try:
                return self._download_items()
            finally:
                self._close_session()
        finally:
            self._busy.release()

    def _download_items(self) -> list[MissionItem]:
        ts, tc = self._target()
        timeout = config.MISSION_ITEM_TIMEOUT_S
        retries = max(1, config.MISSION_RETRIES)

        count_msg = None
        for _ in range(retries):
            self._send("mission_request_list_send", ts, tc, MAV_MISSION_TYPE_MISSION)
            count_msg = self._wait(("MISSION_COUNT",), timeout)
            if count_msg is not None:
                break
        if count_msg is None:
            raise ControlError("timeout", "Đọc lại mission: FC không trả MISSION_COUNT")

        items: list[MissionItem] = []
        for seq in range(int(count_msg.count)):
            msg = None
            for _ in range(retries):
                self._send("mission_request_int_send", ts, tc, seq, MAV_MISSION_TYPE_MISSION)
                msg = self._wait(
                    ("MISSION_ITEM_INT",), timeout, pred=lambda m, s=seq: int(m.seq) == s
                )
                if msg is not None:
                    break
            if msg is None:
                raise ControlError("timeout", f"Đọc lại mission: hết giờ ở item seq={seq}")
            items.append(
                MissionItem(
                    seq=int(msg.seq),
                    command=int(msg.command),
                    frame=int(msg.frame),
                    x=int(msg.x),
                    y=int(msg.y),
                    z=float(msg.z),
                    param1=float(getattr(msg, "param1", 0.0)),
                )
            )
        # Báo FC là đã đọc xong, nếu không nó giữ phiên và gửi lại item cuối.
        self._send("mission_ack_send", ts, tc, MAV_MISSION_ACCEPTED, MAV_MISSION_TYPE_MISSION)
        return items

    # -- clear -----------------------------------------------------------------
    def clear(self) -> None:
        """Xoá mission trên FC. Chỉ đổi trạng thái backend sau khi FC ACK."""
        if not self._busy.acquire(blocking=False):
            raise ControlError("command_denied", "Đang có một phiên mission khác")
        try:
            self._require_link()
            ts, tc = self._target()
            self._open_session()
            try:
                self._send("mission_clear_all_send", ts, tc, MAV_MISSION_TYPE_MISSION)
                ack = self._wait(("MISSION_ACK",), config.MISSION_ITEM_TIMEOUT_S)
            finally:
                self._close_session()
            if ack is None:
                raise ControlError("timeout", "FC không xác nhận xoá mission")
            result = int(getattr(ack, "type", -1))
            if result != MAV_MISSION_ACCEPTED:
                raise ControlError("command_denied", ack_message(result), {"result": result})
            self.current = []
            self.source = "none"
            self.uploaded_at = None
        finally:
            self._busy.release()

    # -- start -----------------------------------------------------------------
    def start(self, timeout: float | None = None) -> None:
        """Chạy mission: kiểm điều kiện -> AUTO -> MAV_CMD_MISSION_START (§7.5).

        KHÔNG tự arm. Arm là quyết định của người — chưa armed thì báo lỗi.
        """
        if self.source != "readback" or not self.current:
            raise ControlError(
                "validation_failed",
                "Chưa có mission đã đọc lại được từ FC — upload (và readback khớp) trước",
                {"source": self.source},
            )
        if self.state is not None and not getattr(self.state, "armed", False):
            raise ControlError(
                "validation_failed",
                "Chưa armed. Backend không tự arm — arm là quyết định của người điều khiển",
                {"armed": False},
            )
        if self.control is None:
            raise ControlError("internal", "MissionManager chưa được nối với FlightControl")
        self._require_link()
        self.control.set_mode("AUTO", timeout=timeout)

        han = config.COMMAND_ACK_TIMEOUT_S if timeout is None else timeout
        waiter = self.connection.expect_ack(MAV_CMD_MISSION_START)
        try:
            ts, tc = self._target()
            self._send("command_long_send", ts, tc, MAV_CMD_MISSION_START, 0, 0, 0, 0, 0, 0, 0, 0)
            result = self._cho_ack(waiter, time.monotonic() + han)
        finally:
            self.connection.stop_expecting(MAV_CMD_MISSION_START, waiter)
        if result is None:
            raise ControlError("timeout", f"FC không trả lời MISSION_START trong {han:.0f}s")
        if result != MAV_RESULT_ACCEPTED:
            ten = MAV_RESULT_NAMES.get(result, str(result))
            raise ControlError(
                "command_denied",
                f"FC từ chối MISSION_START: {ten}. Đang ở AUTO nhưng mission chưa chạy — "
                "kiểm STATUSTEXT (thường là đang nằm dưới đất, xem sổ tay Phase 07).",
                {"result": result, "result_name": ten},
            )

    @staticmethod
    def _cho_ack(waiter: queue.Queue, han_chot: float) -> int | None:
        while True:
            con_lai = han_chot - time.monotonic()
            if con_lai <= 0:
                return None
            try:
                msg = waiter.get(timeout=con_lai)
            except queue.Empty:
                return None
            result = int(getattr(msg, "result", -1))
            if result == 5:  # IN_PROGRESS — chờ ack cuối
                continue
            return result
