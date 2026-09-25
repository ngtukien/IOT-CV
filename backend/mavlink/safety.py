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

    # -- dấu vết của dead-man (Phase 06, việc 6.4.5) -------------------------
    # CHỈ thêm trường; không hàm cũ nào đổi hành vi, 9 test của Phase 05 phải
    # tiếp tục xanh nguyên vẹn.
    #
    # `deadman_tripped` DÍNH cho tới khi operator chủ động bật lại WEB CONTROL
    # (`clear_deadman()`). Cố ý: nó là cái gật đầu "tôi đã thấy có một lần mất
    # lái". Tự tắt khi có velocity kế tiếp thì banner chớp một cái rồi biến,
    # và sự cố coi như chưa từng xảy ra — trái tinh thần SAFETY.md mục 4.
    deadman_tripped: bool = False
    last_zero_velocity_reason: str | None = None

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

    def clear_deadman(self) -> None:
        """Operator xác nhận đã thấy lần mất lái trước. Xem `deadman_tripped`."""
        self.deadman_tripped = False
        self.last_zero_velocity_reason = None

    def note_zero_velocity(self, reason: str) -> None:
        """Ghi lại rằng backend vừa phải tự gửi velocity 0, và vì sao."""
        self.deadman_tripped = True
        self.last_zero_velocity_reason = reason

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

    def clamp_yaw_rate(self, value: float) -> float:
        """Giới hạn tốc độ xoay theo MAX_YAW_RATE, ĐỘ/GIÂY.

        Tách khỏi `clamp_velocity` vì khác đơn vị: kẹp deg/s bằng ngưỡng m/s
        là bóp yaw xuống 1 độ/giây mà không có gì báo.
        """
        limit = config.MAX_YAW_RATE
        return max(-limit, min(limit, value))

    def as_dict(self) -> dict:
        return {
            "web_control_enabled": self.web_control_enabled,
            "current_mode": self.current_mode,
            "rc_available": self.rc_available,
            "manual_command_timeout_ms": config.MANUAL_COMMAND_TIMEOUT_MS,
            "max_velocity": config.MAX_VELOCITY,
            "max_yaw_rate": config.MAX_YAW_RATE,
            "deadman_tripped": self.deadman_tripped,
            "last_zero_velocity_reason": self.last_zero_velocity_reason,
        }


# ===========================================================================
# Phase 07 §7.7 — MÁY TRẠNG THÁI AN TOÀN
#
# Mọi phản ứng của backend, gom một chỗ. Cột "KHÔNG LÀM" quan trọng ngang cột
# "LÀM": nó là phần dễ bị vi phạm nhất bởi một lập trình viên có thiện chí.
#
# Mỗi dòng: SỰ KIỆN -> backend LÀM / KHÔNG LÀM (ở đâu).
#
# - Mất link MAVLink -> connected=False, thu quyền web, zero `link_lost` vào
#   deadman.jsonl, event `link.lost` mức error / KHÔNG gửi RTL/LAND/đổi mode
#   (telemetry.py + ws.py `_reconcile_control_ownership`).
# - WebSocket đóng -> zero NGAY, thu quyền, event warn / KHÔNG đổi mode, disarm
#   (ws.py `disconnect`).
# - Dead-man hết hạn -> zero, deadman_tripped, event warn / KHÔNG thu hồi quyền
#   (deadman.py).
# - RC gạt khỏi GUIDED -> thu quyền tức thì, event / KHÔNG ép quay lại GUIDED
#   (`on_mode_change` + ws.py).
# - EKF hỏng / gps_fix < 3 -> từ chối arm, takeoff, mission.upload; event warn /
#   KHÔNG disarm, đổi mode, sửa param (`flight_readiness_problem` + SafetyMonitor).
# - Pin < BATTERY_WARN_PCT -> event warn / KHÔNG tự RTL (SafetyMonitor).
# - Operator tắt WEB CONTROL -> zero `operator_disabled` / KHÔNG đổi mode (ws.py).
# - Mất camera -> camera.available=false, event warn / KHÔNG đụng telemetry,
#   control (SafetyMonitor + ws.py).
#
# VÌ SAO BACKEND KHÔNG BAO GIỜ TỰ ĐỔI FLIGHT MODE — năm lý do, bản đầy đủ ở
# docs/so-tay/07-backend-mission-proximity-safety.md:
#   1. Failsafe của ArduPilot chạy TRÊN FC, sống khi Wi-Fi/laptop/backend chết.
#      Failsafe ở backend chỉ bảo vệ được đúng lúc ít nguy hiểm nhất.
#   2. Hai tác nhân tự quyết sinh tranh chấp (backend RTL, phi công LOITER né cây).
#   3. Rớt Wi-Fi 2.4 GHz vặt là chuyện thường — tự RTL mỗi lần rớt gói là tự tạo
#      tai nạn từ một sự cố vô hại.
#   4. Zero-velocity KHÔNG phải đổi mode: nó là RÚT lại lệnh của chính backend.
#      RTL là can thiệp THÊM.
#   5. RC là dây cứu sinh (SAFETY.md mục 4). Backend tự đổi mode làm nó yếu đi.
# ===========================================================================

# Dưới ngưỡng thì báo; phải hồi lên ngưỡng + chừng này mới báo lại lần sau.
# Không có nó, pin dao động quanh 25% sinh một cảnh báo mỗi nhịp telemetry.
BATTERY_WARN_HYSTERESIS_PCT = 3


def flight_readiness_problem(state) -> tuple[str, dict] | None:
    """Lý do CHƯA được arm / takeoff / upload mission, hoặc None nếu ổn.

    Cùng điều kiện với `FlightControl._kiem_tra_truoc_arm` (control.py): GPS phải
    3D fix; EKF chỉ chặn khi FC đã NÓI là hỏng (`ekf_ok is False`) — `None` là
    chưa biết, chặn vì chưa biết là chặn nhầm. Không bao giờ "sửa param cho qua".
    """
    fix = getattr(state, "gps_fix_type", None)
    if fix is None or fix < 3:
        return (
            f"GPS chưa có 3D fix (fix_type={fix}). Chờ thêm rồi thử lại.",
            {"gps_fix_type": fix},
        )
    if getattr(state, "ekf_ok", None) is False:
        return (
            "EKF chưa khoẻ (ekf_ok=False). Chờ EKF hội tụ rồi thử lại.",
            {"ekf_ok": False},
        )
    return None


@dataclass(frozen=True)
class SafetyEvent:
    """Một sự kiện cần phát. SafetyMonitor chỉ TRẢ VỀ, không tự phát — để test
    đọc được mà không cần EventBus."""

    level: str
    code: str
    message: str
    detail: dict | None = None


class SafetyMonitor:
    """Phát hiện CHUYỂN trạng thái của các dòng mới trong bảng §7.7.

    Chỉ báo lúc CHUYỂN (tốt -> xấu, và hồi lại), không báo mỗi nhịp. Giá trị
    "chưa biết" (None) không sinh sự kiện nào.
    """

    def __init__(self) -> None:
        self._ready: bool | None = None
        self._battery_low = False
        self._camera: bool | None = None

    def observe(
        self,
        state,
        *,
        camera_available: bool | None = None,
        battery_warn_pct: int | None = None,
    ) -> list[SafetyEvent]:
        events: list[SafetyEvent] = []

        # -- EKF / GPS ---------------------------------------------------
        # Chỉ xét khi đã có số liệu: lúc mới nối, gps_fix_type là None và đó
        # không phải "GPS hỏng".
        if getattr(state, "gps_fix_type", None) is not None:
            problem = flight_readiness_problem(state)
            ready = problem is None
            if self._ready is True and not ready:
                message, detail = problem
                events.append(
                    SafetyEvent(
                        "warn",
                        "safety.not_ready",
                        f"{message} Arm/takeoff/upload mission sẽ bị từ chối; backend "
                        "KHÔNG disarm, KHÔNG đổi mode.",
                        detail,
                    )
                )
            elif self._ready is False and ready:
                events.append(
                    SafetyEvent("info", "safety.ready", "GPS 3D fix và EKF đã ổn trở lại")
                )
            self._ready = ready

        # -- pin ---------------------------------------------------------
        nguong = config.BATTERY_WARN_PCT if battery_warn_pct is None else battery_warn_pct
        pin = getattr(state, "battery_remaining", None)
        if pin is not None:
            if not self._battery_low and pin < nguong:
                self._battery_low = True
                events.append(
                    SafetyEvent(
                        "warn",
                        "battery.low",
                        f"Pin còn {pin}% (dưới {nguong}%). Nên hạ cánh. Backend KHÔNG tự "
                        "RTL — failsafe pin nằm trên FC.",
                        {"battery_remaining": pin, "threshold": nguong},
                    )
                )
            elif self._battery_low and pin >= nguong + BATTERY_WARN_HYSTERESIS_PCT:
                self._battery_low = False

        # -- camera --------------------------------------------------------
        if camera_available is not None:
            if self._camera is True and not camera_available:
                events.append(
                    SafetyEvent(
                        "warn",
                        "camera.lost",
                        "Mất hình camera. Telemetry và điều khiển KHÔNG bị ảnh hưởng.",
                    )
                )
            self._camera = camera_available

        return events
