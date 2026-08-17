"""State an toàn cho quyền điều khiển từ web — GIAI ĐOẠN 11.

Hai nguyên tắc:

1. **Dead-man**: browser phải gửi lệnh liên tục. Backend có timeout ĐỘC LẬP; quá
   `MANUAL_COMMAND_TIMEOUT_MS` mà không có lệnh mới thì tự gửi velocity = 0,
   không phụ thuộc việc frontend có kịp gửi lệnh dừng hay không.
2. **Web không tự giành quyền**: operator phải chủ động bật `web_control_enabled`,
   và RC luôn có quyền cao hơn — pilot gạt sang mode khác GUIDED thì web mất
   quyền ngay (GIAI ĐOẠN 65).

Toàn bộ module là logic thuần để test được không cần drone.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from backend import config

# Web chỉ được lái trong GUIDED. Mọi mode khác là của pilot.
WEB_CONTROLLABLE_MODES = frozenset({"GUIDED"})


@dataclass
class SafetyState:
    """Trạng thái quyền điều khiển và dead-man timer."""

    last_manual_command_time: float | None = None
    web_control_enabled: bool = False
    current_mode: str = "UNKNOWN"
    rc_available: bool = True

    # -- dead-man ----------------------------------------------------------
    def note_manual_command(self, now: float | None = None) -> None:
        """Ghi nhận vừa nhận được một lệnh manual từ browser."""
        self.last_manual_command_time = time.monotonic() if now is None else now

    def should_send_zero_velocity(
        self, now: float | None = None, timeout_ms: int | None = None
    ) -> bool:
        """True khi backend phải tự gửi velocity = 0.

        Xảy ra khi web đang có quyền lái nhưng lệnh manual đã cũ hơn timeout
        (browser treo, mất mạng, hoặc người dùng đóng tab).
        """
        if not self.web_control_enabled:
            return False
        if self.last_manual_command_time is None:
            return True
        limit = config.MANUAL_COMMAND_TIMEOUT_MS if timeout_ms is None else timeout_ms
        timestamp = time.monotonic() if now is None else now
        return (timestamp - self.last_manual_command_time) * 1000.0 >= limit

    # -- quyền điều khiển ---------------------------------------------------
    def enable_web_control(self) -> None:
        self.web_control_enabled = True

    def disable_web_control(self) -> None:
        """Thu hồi quyền của web và xoá dead-man timer."""
        self.web_control_enabled = False
        self.last_manual_command_time = None

    def on_mode_change(self, mode: str) -> None:
        """Pilot đổi mode: nếu ra khỏi GUIDED thì web mất quyền ngay lập tức."""
        self.current_mode = mode
        if mode not in WEB_CONTROLLABLE_MODES:
            self.disable_web_control()

    def on_web_disconnected(self) -> None:
        """WebSocket đóng (GIAI ĐOẠN 11): coi như mất manual control."""
        self.disable_web_control()

    def may_accept_web_command(self) -> tuple[bool, str]:
        """Có được nhận lệnh velocity từ web hay không, kèm lý do nếu không."""
        if not self.web_control_enabled:
            return False, "web control chưa được operator bật"
        if self.current_mode not in WEB_CONTROLLABLE_MODES:
            return False, f"mode hiện tại là {self.current_mode}, không phải GUIDED"
        return True, ""

    def clamp_velocity(self, value: float) -> float:
        """Giới hạn velocity theo MAX_VELOCITY (GIAI ĐOẠN 64: bắt đầu rất chậm)."""
        limit = config.MAX_VELOCITY
        return max(-limit, min(limit, value))

    def as_dict(self) -> dict:
        return {
            "web_control_enabled": self.web_control_enabled,
            "current_mode": self.current_mode,
            "rc_available": self.rc_available,
            "manual_command_timeout_ms": config.MANUAL_COMMAND_TIMEOUT_MS,
            "max_velocity": config.MAX_VELOCITY,
        }
