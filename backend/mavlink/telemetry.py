"""Đọc và chuẩn hoá telemetry — GIAI ĐOẠN 6.

Frontend KHÔNG BAO GIỜ đọc MAVLink trực tiếp. Luồng bắt buộc:

    Flight Controller -> MAVLink -> Python backend -> Normalized JSON -> Frontend

`update_state()` là hàm thuần (không I/O) nên test được mà không cần SITL.
`TelemetryReader` là phần có I/O: chạy trong thread nền, đọc message và cập nhật
state.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from dataclasses import asdict, dataclass

from backend import config
from backend.mavlink.connection import MavlinkConnection

log = logging.getLogger(__name__)

# Bit MAV_MODE_FLAG_SAFETY_ARMED trong HEARTBEAT.base_mode
_ARMED_FLAG = 0b1000_0000

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


@dataclass
class TelemetryState:
    """Trạng thái UAV đã chuẩn hoá — đúng schema mà GIAI ĐOẠN 6 yêu cầu."""

    connected: bool = False
    mode: str = "UNKNOWN"
    armed: bool = False
    lat: float | None = None
    lon: float | None = None
    relative_alt: float | None = None
    heading: int | None = None
    ground_speed: float | None = None
    satellites: int | None = None
    battery_voltage: float | None = None
    # Attitude cần cho GIAI ĐOẠN 60 (xoay drone bằng tay, web phải thấy đổi).
    roll: float | None = None
    pitch: float | None = None
    gps_fix_type: int | None = None
    last_update: float | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def mode_name(custom_mode: int) -> str:
    """Đổi custom_mode của Copter thành tên người đọc được."""
    return COPTER_MODES.get(custom_mode, f"MODE_{custom_mode}")


def update_state(state: TelemetryState, msg, now: float | None = None) -> TelemetryState:
    """Cập nhật `state` từ một message MAVLink. Hàm thuần, mutate và trả lại state.

    Chỉ xử lý các message tối thiểu mà GIAI ĐOẠN 6 liệt kê: HEARTBEAT,
    GLOBAL_POSITION_INT, GPS_RAW_INT, ATTITUDE, SYS_STATUS, VFR_HUD.
    Message khác bị bỏ qua (không raise).
    """
    msg_type = msg.get_type()
    timestamp = time.monotonic() if now is None else now

    if msg_type == "HEARTBEAT":
        state.connected = True
        state.mode = mode_name(getattr(msg, "custom_mode", 0))
        state.armed = bool(getattr(msg, "base_mode", 0) & _ARMED_FLAG)

    elif msg_type == "GLOBAL_POSITION_INT":
        state.lat = msg.lat / 1e7
        state.lon = msg.lon / 1e7
        state.relative_alt = msg.relative_alt / 1000.0
        # hdg tính theo centi-degree; 65535 nghĩa là không xác định.
        if getattr(msg, "hdg", 65535) != 65535:
            state.heading = int(msg.hdg / 100)

    elif msg_type == "GPS_RAW_INT":
        state.satellites = msg.satellites_visible
        state.gps_fix_type = msg.fix_type

    elif msg_type == "ATTITUDE":
        state.roll = math.degrees(msg.roll)
        state.pitch = math.degrees(msg.pitch)

    elif msg_type == "SYS_STATUS":
        # voltage_battery tính theo mV; 65535 nghĩa là không có số đo.
        voltage = getattr(msg, "voltage_battery", 65535)
        if voltage not in (0, 65535):
            state.battery_voltage = voltage / 1000.0

    elif msg_type == "VFR_HUD":
        state.ground_speed = msg.groundspeed
        if state.heading is None:
            state.heading = int(msg.heading)

    else:
        return state

    state.last_update = timestamp
    return state


def is_link_alive(state: TelemetryState, now: float | None = None) -> bool:
    """Link còn sống hay không, dựa trên thời điểm nhận message cuối."""
    if state.last_update is None:
        return False
    timestamp = time.monotonic() if now is None else now
    return (timestamp - state.last_update) < config.LINK_TIMEOUT_S


class TelemetryReader:
    """Đọc MAVLink trong thread nền và cập nhật `TelemetryState`.

    Không làm backend chết khi chưa có SITL: nếu connect thất bại thì log warning
    và giữ `state.connected = False`.
    """

    def __init__(
        self,
        connection: MavlinkConnection | None = None,
        state: TelemetryState | None = None,
    ) -> None:
        self.connection = connection or MavlinkConnection()
        self.state = state or TelemetryState()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="telemetry", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 2.0) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
            self._thread = None
        self.connection.close()
        self.state.connected = False

    def _run(self) -> None:
        try:
            self.connection.connect()
        except Exception as exc:  # pymavlink raise nhiều loại tuỳ endpoint
            log.warning("Chưa kết nối được MAVLink (%s). Backend vẫn chạy.", exc)
            self.state.connected = False
            return

        log.info("Bắt đầu đọc telemetry từ %s", self.connection.endpoint)
        while not self._stop.is_set():
            try:
                msg = self.connection.recv_match(blocking=True, timeout=1.0)
            except OSError as exc:
                log.warning("Lỗi đọc MAVLink: %s", exc)
                break
            if msg is None:
                # Không có message trong 1s -> kiểm tra link còn sống không.
                self.state.connected = is_link_alive(self.state)
                continue
            update_state(self.state, msg)
