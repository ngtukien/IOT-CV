"""Lệnh điều khiển mức cao — Phase 06.

Ranh giới trách nhiệm (đọc SAFETY.md trước khi sửa file này):

- Ở đây CHỈ có lệnh mức cao: set_mode, arm, disarm, takeoff, land, rtl, loiter,
  send_velocity_body.
- **KHÔNG có `send_motor_pwm()` và không được thêm.** Web không bao giờ điều khiển
  motor trực tiếp; flight controller giữ toàn quyền ổn định máy bay. Danh sách
  đầy đủ những gì bị cấm nằm ở `plans/phase-06-backend-dieu-khien-deadman.md`
  §6.6, và có test canh gác đọc chính file này (`test_control.py`).
- Manual control dùng SET_POSITION_TARGET_LOCAL_NED với frame
  MAV_FRAME_BODY_OFFSET_NED (X+ = trước, Y+ = phải, Z+ = XUỐNG), không dùng
  RC_OVERRIDE ở Version 1.
- Velocity command phải được gửi LẶP LẠI: Copter dừng movement command sau
  khoảng 3 giây nếu không nhận thêm lệnh. Vòng lặp đó là `deadman.py`.

Mọi lỗi đều ném `ControlError` mang sẵn MÃ LỖI của hợp đồng WebSocket, không
có hàm nào trả về None-nghĩa-là-hỏng. `backend/ws.py` chỉ việc dịch thẳng
`err.code` / `err.message` ra frame `error`.

╔══════════════════════════════════════════════════════════════════════════╗
║  MỌI lời gọi `*_send()` PHẢI đi qua `MavlinkConnection.send(...)`.        ║
║  Xem khối LUẬT ở đầu `connection.py`. Cổng pass kiểm bằng:               ║
║      grep -rn "\\.mav\\." backend/mavlink/control.py                       ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
import math
import queue
import time

from backend import config
from backend.mavlink.connection import MavlinkConnection
from backend.mavlink.telemetry import MODE_IDS
from backend.schemas import WEB_MODE_WHITELIST

log = logging.getLogger(__name__)

# MAV_CMD / hằng số MAVLink — đặt tên thay vì rải số trần, và khai ở đây thay
# vì import `pymavlink` để module này test được trên máy không có pymavlink
# (cùng quy ước với `connection.py`). Đã đối chiếu với
# `pymavlink.dialects.v20.ardupilotmega` ngày 2026-09-22.
MAV_CMD_NAV_TAKEOFF = 22
MAV_CMD_DO_SET_MODE = 176
MAV_CMD_COMPONENT_ARM_DISARM = 400
MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1
MAV_RESULT_ACCEPTED = 0
MAV_FRAME_BODY_OFFSET_NED = 9

# Tên MAV_RESULT để thông báo lỗi nói được FC từ chối KIỂU gì, thay vì "result=2".
MAV_RESULT_NAMES: dict[int, str] = {
    0: "ACCEPTED",
    1: "TEMPORARILY_REJECTED",
    2: "DENIED",
    3: "UNSUPPORTED",
    4: "FAILED",
    5: "IN_PROGRESS",
    6: "CANCELLED",
}

# type_mask cho SET_POSITION_TARGET_LOCAL_NED: BỎ QUA position và acceleration,
# CHỈ nghe velocity + yaw_rate. 0b0000110111000111 = 0x0DC7 = 3527.
#
# Sai MỘT bit ở đây là drone hiểu thành "bay tới toạ độ (0,0,0) của hệ body",
# tức là lao đi theo cách không đoán trước được. Test #1 khẳng định đúng con số
# này trên gói đã gửi, không phải chỉ trong comment.
VELOCITY_TYPE_MASK = 0b0000110111000111

# Mode web được phép xin. NHẬP từ hợp đồng WebSocket chứ không gõ lại: hai bản
# danh sách sẽ lệch nhau đúng vào hôm ai đó thêm một mode.
#
# ACRO / FLIP / AUTOTUNE / SPORT / THROW cố ý KHÔNG có mặt — những mode đó cần
# phi công thật cầm RC.
WEB_ALLOWED_MODES = frozenset(WEB_MODE_WHITELIST)

# Mapping WASD -> velocity body frame.
# Z âm là LÊN vì trong NED, Z dương hướng xuống. ĐỪNG "sửa cho hợp lý".
KEY_VELOCITY_MAP: dict[str, tuple[float, float, float]] = {
    "w": (1.0, 0.0, 0.0),
    "s": (-1.0, 0.0, 0.0),
    "d": (0.0, 1.0, 0.0),
    "a": (0.0, -1.0, 0.0),
    "r": (0.0, 0.0, -0.5),
    "f": (0.0, 0.0, 0.5),
}


class ControlError(Exception):
    """Lệnh bị từ chối hoặc thất bại, kèm MÃ LỖI của hợp đồng WebSocket.

    `code` phải là một phần tử của `backend.schemas.ERROR_CODES`. Mang mã theo
    exception thay vì để `ws.py` đoán lại từ chuỗi thông báo — đoán từ chuỗi là
    cách chắc chắn để một hôm nào đó sửa chính tả xong thì mã lỗi đổi theo.
    """

    def __init__(self, code: str, message: str, detail: dict | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail or {}


class FlightControl:
    """Bọc các lệnh MAVLink mức cao.

    Cần `state` (bản telemetry đang được thread đọc cập nhật) để kiểm điều kiện
    TẠI BACKEND trước khi gửi: arm khi chưa có 3D fix, takeoff khi chưa armed,
    takeoff vượt trần. Không có `state` thì các phép kiểm đó bị bỏ qua — chỉ
    dùng cho test đơn vị của riêng lớp gửi gói.
    """

    def __init__(self, connection: MavlinkConnection, state=None) -> None:
        self.connection = connection
        self.state = state

    # -- tiện ích nội bộ ----------------------------------------------------
    def _require_link(self) -> None:
        if not self.connection.connected:
            raise ControlError(
                "not_connected",
                "Chua co link MAVLink toi flight controller",
            )

    def _send_command_long(self, command_id: int, *params: float) -> None:
        """Gửi COMMAND_LONG với 7 param (thiếu thì bù 0)."""
        so = list(params) + [0.0] * (7 - len(params))
        master = self.connection.master
        self.connection.send(
            master.mav.command_long_send,
            self.connection.target_system,
            self.connection.target_component,
            command_id,
            0,  # confirmation
            *so,
        )

    def _cho_ack(self, command_id: int, waiter: queue.Queue, han_chot: float) -> int | None:
        """Chờ COMMAND_ACK tới hạn. Trả `result`, hoặc None khi hết giờ.

        Bỏ qua `IN_PROGRESS` (5): ArduPilot dùng nó cho lệnh chạy lâu và sẽ gửi
        thêm ack cuối cùng. Coi nó là kết quả thì takeoff luôn "xong" tức khắc.
        """
        while True:
            con_lai = han_chot - time.monotonic()
            if con_lai <= 0:
                return None
            try:
                msg = waiter.get(timeout=con_lai)
            except queue.Empty:
                return None
            result = int(getattr(msg, "result", -1))
            if result == 5:  # MAV_RESULT_IN_PROGRESS
                log.info("Lệnh %s đang chạy (IN_PROGRESS), chờ tiếp", command_id)
                continue
            return result

    def _gui_va_cho_ack(
        self,
        command_id: int,
        *params: float,
        ten_lenh: str,
        timeout: float | None = None,
    ) -> None:
        """Gửi một COMMAND_LONG rồi chờ FC xác nhận. Ném `ControlError` nếu hỏng.

        Đăng ký hàng đợi TRƯỚC KHI GỬI — xem `MavlinkConnection.expect_ack`.
        """
        han = config.COMMAND_ACK_TIMEOUT_S if timeout is None else timeout
        waiter = self.connection.expect_ack(command_id)
        try:
            self._send_command_long(command_id, *params)
            result = self._cho_ack(command_id, waiter, time.monotonic() + han)
        finally:
            self.connection.stop_expecting(command_id, waiter)

        if result is None:
            raise ControlError(
                "timeout",
                f"Flight controller khong tra loi lenh {ten_lenh} trong {han:.0f}s",
                {"command": command_id},
            )
        if result != MAV_RESULT_ACCEPTED:
            ten_ket_qua = MAV_RESULT_NAMES.get(result, str(result))
            raise ControlError(
                "command_denied",
                f"Flight controller tu choi lenh {ten_lenh}: {ten_ket_qua}",
                {"command": command_id, "result": result, "result_name": ten_ket_qua},
            )

    # -- mode ---------------------------------------------------------------
    def set_mode(self, mode: str, timeout: float | None = None) -> None:
        """Đổi flight mode. Chỉ nhận mode trong `WEB_ALLOWED_MODES`.

        KHÔNG dùng `mavutil.mavfile.set_mode()`: với một tên mode lạ, hàm đó
        `print("Unknown mode")` rồi **return im lặng** — đúng loại silent
        fallback mà `rules/development-principles.md` cấm. Ta tự gửi
        MAV_CMD_DO_SET_MODE, cùng một hình dạng với mọi lệnh khác trong file.

        Coi là xong khi FC trả `COMMAND_ACK` accepted HOẶC khi HEARTBEAT báo
        `custom_mode` đã sang giá trị mong muốn. Chờ HEARTBEAT là lớp thứ hai
        có thật: ArduPilot đôi khi đổi mode rồi mới ack, và trên link nhiễu thì
        gói ack là gói rơi.
        """
        self._require_link()
        if mode not in WEB_ALLOWED_MODES:
            raise ControlError(
                "command_denied",
                f"Mode '{mode}' khong nam trong danh sach web duoc phep xin",
                {"allowed": sorted(WEB_ALLOWED_MODES)},
            )
        mode_id = MODE_IDS.get(mode)
        if mode_id is None:
            # Whitelist và COPTER_MODES lệch nhau — đây là bug của ta, không
            # phải lỗi người dùng. Nói thẳng ra thay vì gửi một mode_id rác.
            raise ControlError(
                "internal",
                f"Mode '{mode}' co trong whitelist nhung khong co trong COPTER_MODES",
            )

        han = config.COMMAND_ACK_TIMEOUT_S if timeout is None else timeout
        han_chot = time.monotonic() + han
        waiter = self.connection.expect_ack(MAV_CMD_DO_SET_MODE)
        try:
            self._send_command_long(
                MAV_CMD_DO_SET_MODE,
                float(MAV_MODE_FLAG_CUSTOM_MODE_ENABLED),
                float(mode_id),
            )
            while True:
                if self.state is not None and getattr(self.state, "mode", None) == mode:
                    return
                con_lai = han_chot - time.monotonic()
                if con_lai <= 0:
                    break
                try:
                    # Chờ ngắn rồi ngó lại HEARTBEAT: hai đường xác nhận chạy
                    # song song, đường nào về trước cũng được.
                    msg = waiter.get(timeout=min(0.1, con_lai))
                except queue.Empty:
                    continue
                result = int(getattr(msg, "result", -1))
                if result == 5:  # IN_PROGRESS
                    continue
                if result == MAV_RESULT_ACCEPTED:
                    return
                ten = MAV_RESULT_NAMES.get(result, str(result))
                raise ControlError(
                    "command_denied",
                    f"Flight controller tu choi doi sang mode {mode}: {ten}",
                    {"mode": mode, "result": result, "result_name": ten},
                )
        finally:
            self.connection.stop_expecting(MAV_CMD_DO_SET_MODE, waiter)

        raise ControlError(
            "timeout",
            f"Doi mode sang {mode} khong duoc xac nhan trong {han:.0f}s",
            {"mode": mode},
        )

    # -- arm / disarm -------------------------------------------------------
    def _kiem_tra_truoc_arm(self) -> None:
        """Ba phép kiểm TẠI BACKEND. Không phải để thay pre-arm của FC — FC vẫn
        kiểm đầy đủ — mà để người dùng nhận một câu tiếng Việt nói rõ phải làm
        gì, thay vì một STATUSTEXT tiếng Anh trôi qua trong bảng log.

        Tuyệt đối KHÔNG tự sửa param hay tắt pre-arm check để "cho nó arm được"
        (SAFETY.md mục 3).
        """
        if self.state is None:
            return
        fix = getattr(self.state, "gps_fix_type", None)
        if fix is None or fix < 3:
            raise ControlError(
                "validation_failed",
                f"GPS chua co 3D fix (fix_type={fix}). Cho them roi thu lai.",
                {"gps_fix_type": fix},
            )
        # `ekf_ok is None` = CHƯA BIẾT (chưa nhận EKF_STATUS_REPORT nào), không
        # phải "không ổn" — chặn arm vì chưa biết là chặn nhầm. Chỉ chặn khi FC
        # đã nói thẳng là False.
        if getattr(self.state, "ekf_ok", None) is False:
            raise ControlError(
                "validation_failed",
                "EKF chua san sang (ekf_ok=False). Cho EKF hoi tu roi thu lai.",
                {"ekf_ok": False},
            )

    def arm(self, timeout: float | None = None) -> None:
        """MAV_CMD_COMPONENT_ARM_DISARM param1=1.

        CẤM TUYỆT ĐỐI `param2 = 21196` (force). Đó là "tắt động cơ bất chấp mọi
        kiểm tra, kể cả khi đang bay". Mọi param ngoài param1 đều bằng 0, và có
        test canh gác quét chính file này.
        """
        self._require_link()
        self._kiem_tra_truoc_arm()
        self._gui_va_cho_ack(
            MAV_CMD_COMPONENT_ARM_DISARM, 1.0, ten_lenh="arm", timeout=timeout
        )

    def disarm(self, timeout: float | None = None) -> None:
        """MAV_CMD_COMPONENT_ARM_DISARM param1=0. Xem cảnh báo force ở `arm`."""
        self._require_link()
        self._gui_va_cho_ack(
            MAV_CMD_COMPONENT_ARM_DISARM, 0.0, ten_lenh="disarm", timeout=timeout
        )

    # -- takeoff ------------------------------------------------------------
    def takeoff(self, altitude: float, timeout: float | None = None) -> None:
        """MAV_CMD_NAV_TAKEOFF. Thứ tự bắt buộc: GUIDED -> arm -> takeoff.

        Độ cao ngoài [MIN_ALT, MAX_ALT] thì BÁO LỖI, **không im lặng kẹp**.
        Người gõ "20" mà máy bay lên 10 m là một bất ngờ nguy hiểm. Khác hẳn
        `clamp_velocity`: người giữ phím W không có kỳ vọng con số nào, nên kẹp
        im lặng ở đó là đúng. Nguyên tắc: chỉ được im lặng khi người dùng KHÔNG
        có kỳ vọng cụ thể về con số.
        """
        self._require_link()

        if self.state is not None:
            mode = getattr(self.state, "mode", "UNKNOWN")
            if mode != "GUIDED":
                raise ControlError(
                    "wrong_mode",
                    f"Dang o mode {mode}. Thu tu dung: GUIDED -> arm -> takeoff",
                    {"mode": mode},
                )
            if not getattr(self.state, "armed", False):
                raise ControlError(
                    "validation_failed",
                    "Chua armed. Thu tu dung: GUIDED -> arm -> takeoff",
                    {"armed": False},
                )

        if not (config.MIN_ALT <= altitude <= config.MAX_ALT):
            raise ControlError(
                "validation_failed",
                f"Do cao {altitude:g} m nam ngoai khoang cho phep "
                f"[{config.MIN_ALT:g}, {config.MAX_ALT:g}] m",
                {"altitude": altitude, "min_alt": config.MIN_ALT, "max_alt": config.MAX_ALT},
            )

        self._gui_va_cho_ack(
            MAV_CMD_NAV_TAKEOFF,
            0.0,  # param1 pitch
            0.0,
            0.0,
            0.0,  # param4 yaw
            0.0,  # param5 lat
            0.0,  # param6 lon
            float(altitude),  # param7 alt
            ten_lenh=f"takeoff {altitude:g}m",
            timeout=timeout,
        )

    # -- ba lệnh đổi mode ---------------------------------------------------
    #
    # Cố ý KHÔNG dùng MAV_CMD_NAV_LAND / MAV_CMD_NAV_RETURN_TO_LAUNCH: hai lệnh
    # đó là *mission item*, ý nghĩa khác hẳn. Hạ cánh "ngay bây giờ" trong
    # ArduCopter là đổi mode.
    def land(self, timeout: float | None = None) -> None:
        self.set_mode("LAND", timeout=timeout)

    def rtl(self, timeout: float | None = None) -> None:
        self.set_mode("RTL", timeout=timeout)

    def loiter(self, timeout: float | None = None) -> None:
        """HOLD của giao diện = LOITER của ArduCopter."""
        self.set_mode("LOITER", timeout=timeout)

    # -- velocity -----------------------------------------------------------
    def send_velocity_body(
        self, vx: float, vy: float, vz: float, yaw_rate: float = 0.0
    ) -> None:
        """Gửi velocity trong MAV_FRAME_BODY_OFFSET_NED. KHÔNG chờ ack.

        Ba chỗ dễ sai, ghi lại để khỏi quên:

        1. **`vz` dương là ĐI XUỐNG** — hệ NED (North-East-**Down**). Muốn lên
           thì `vz` âm. `KEY_VELOCITY_MAP` ở trên đã đúng.
        2. **`type_mask = 0x0DC7`** = "bỏ qua vị trí và gia tốc, chỉ nghe
           velocity + yaw_rate". Sai một bit là drone bay tới toạ độ (0,0,0)
           của hệ body.
        3. **frame 9 = BODY_OFFSET_NED** là *theo hướng mũi máy bay*. Dùng
           LOCAL_NED (1) thì nhấn W thành "bay về hướng Bắc" — sai hoàn toàn
           cảm giác điều khiển.

        Gọi bằng KEYWORD hết, không truyền vị trí: để test khẳng định theo TÊN
        trường (`vx`, `type_mask`, `coordinate_frame`) chứ không theo chỉ số
        trong một tuple 16 phần tử.
        """
        master = self.connection.master
        if master is None:
            raise ControlError(
                "not_connected", "Chua co link MAVLink — khong gui duoc velocity"
            )
        self.connection.send(
            master.mav.set_position_target_local_ned_send,
            time_boot_ms=0,  # 0 = FC tự gán
            target_system=self.connection.target_system,
            target_component=self.connection.target_component,
            coordinate_frame=MAV_FRAME_BODY_OFFSET_NED,
            type_mask=VELOCITY_TYPE_MASK,
            x=0.0,
            y=0.0,
            z=0.0,  # bị mask bỏ qua
            vx=float(vx),  # m/s, + = TRƯỚC
            vy=float(vy),  # m/s, + = PHẢI
            vz=float(vz),  # m/s, + = XUỐNG
            afx=0.0,
            afy=0.0,
            afz=0.0,  # bị mask bỏ qua
            yaw=0.0,  # bị mask bỏ qua
            yaw_rate=math.radians(yaw_rate),  # vào là độ/s, ra dây là rad/s
        )
