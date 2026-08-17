"""Lệnh điều khiển mức cao — GIAI ĐOẠN 9, 10, 12.

Ranh giới trách nhiệm (đọc SAFETY.md trước khi sửa file này):

- Ở đây CHỈ có lệnh mức cao: set_mode, arm, disarm, takeoff, land, rtl, loiter,
  send_velocity_body.
- **KHÔNG có `send_motor_pwm()` và không được thêm.** Web không bao giờ điều khiển
  motor trực tiếp; flight controller giữ toàn quyền ổn định máy bay.
- Manual control dùng SET_POSITION_TARGET_LOCAL_NED với frame
  MAV_FRAME_BODY_OFFSET_NED (X+ = trước, Y+ = phải, Z+ = XUỐNG), không dùng
  RC_OVERRIDE ở Version 1.
- Velocity command phải được gửi LẶP LẠI: Copter dừng movement command sau
  khoảng 3 giây nếu không nhận thêm lệnh.
"""

from __future__ import annotations

import logging

from backend.mavlink.connection import MavlinkConnection

log = logging.getLogger(__name__)

# Mapping WASD -> velocity body frame (GIAI ĐOẠN 10).
# Z âm là LÊN vì trong NED, Z dương hướng xuống.
KEY_VELOCITY_MAP: dict[str, tuple[float, float, float]] = {
    "w": (1.0, 0.0, 0.0),
    "s": (-1.0, 0.0, 0.0),
    "d": (0.0, 1.0, 0.0),
    "a": (0.0, -1.0, 0.0),
    "r": (0.0, 0.0, -0.5),
    "f": (0.0, 0.0, 0.5),
}


class FlightControl:
    """Bọc các lệnh MAVLink mức cao.

    TODO GIAI ĐOẠN 9-12: implement từng method, test trên SITL trước khi dùng
    với drone thật.
    """

    def __init__(self, connection: MavlinkConnection) -> None:
        self.connection = connection

    def set_mode(self, mode: str) -> None:
        raise NotImplementedError("GIAI ĐOẠN 9: chưa implement set_mode")

    def arm(self) -> None:
        raise NotImplementedError("GIAI ĐOẠN 9: chưa implement arm")

    def disarm(self) -> None:
        raise NotImplementedError("GIAI ĐOẠN 9: chưa implement disarm")

    def takeoff(self, altitude: float) -> None:
        raise NotImplementedError("GIAI ĐOẠN 9: chưa implement takeoff")

    def land(self) -> None:
        """MAV_CMD_NAV_LAND (GIAI ĐOẠN 12)."""
        raise NotImplementedError("GIAI ĐOẠN 12: chưa implement land")

    def rtl(self) -> None:
        """MAV_CMD_NAV_RETURN_TO_LAUNCH (GIAI ĐOẠN 12)."""
        raise NotImplementedError("GIAI ĐOẠN 12: chưa implement rtl")

    def loiter(self) -> None:
        """HOLD = chuyển sang LOITER (GIAI ĐOẠN 12)."""
        raise NotImplementedError("GIAI ĐOẠN 12: chưa implement loiter")

    def send_velocity_body(self, vx: float, vy: float, vz: float) -> None:
        """Gửi velocity trong MAV_FRAME_BODY_OFFSET_NED (GIAI ĐOẠN 10).

        Phải được gọi lặp lại trong khi người dùng còn giữ phím; gửi (0, 0, 0)
        khi nhả phím hoặc khi dead-man timeout (GIAI ĐOẠN 11).
        """
        raise NotImplementedError("GIAI ĐOẠN 10: chưa implement send_velocity_body")
