"""Test lệnh điều khiển mức cao — Phase 06, việc 6.5 và 6.6.

Chạy hoàn toàn với `FakeMAVLink`: không cần SITL, không cần drone, không cần
mạng. Mọi phép chờ ack đều được `tu_dong_ack` trả lời ngay nên không bài nào
phụ thuộc đồng hồ thật.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from backend import config
from backend.mavlink.control import (
    KEY_VELOCITY_MAP,
    MAV_CMD_COMPONENT_ARM_DISARM,
    MAV_CMD_DO_SET_MODE,
    MAV_CMD_NAV_TAKEOFF,
    VELOCITY_TYPE_MASK,
    ControlError,
)
from backend.tests.fakes import stack_gia, tu_dong_ack

CONTROL_PY = Path(__file__).parents[1] / "mavlink" / "control.py"


def _lenh_da_gui(fake) -> list[int]:
    """Danh sách command_id của mọi COMMAND_LONG đã gửi."""
    return [p["args"][2] for ten, p in fake.sent if ten == "command_long_send"]


# ---------------------------------------------------------------------------
# 5 bài hành vi
# ---------------------------------------------------------------------------
def test_mode_ngoai_whitelist_bi_tu_choi():
    """ACRO cần phi công thật cầm RC — web không được xin.

    Hai lớp canh, và chúng trả hai MÃ LỖI KHÁC NHAU, cố ý:

    - tầng hợp đồng (`CmdMode.mode` là `Literal[WEB_MODE_WHITELIST]`) chặn ở
      cửa WebSocket và trả `bad_payload` kèm danh sách mode hợp lệ;
    - tầng này chặn lời gọi đến từ bất kỳ đâu khác và trả `command_denied`.

    Plan §6.5 bản đầu chỉ ghi `command_denied` cho cả hai; đã sửa lại plan cho
    khớp thực tế thay vì nới hợp đồng — giữ `Literal` để Phase 08 sinh thẳng
    enum TypeScript, dropdown không đẻ ra được mode sai.
    """
    conn, fake, _state, _safety, control = stack_gia()
    tu_dong_ack(conn, fake)

    with pytest.raises(ControlError) as loi:
        control.set_mode("ACRO")

    assert loi.value.code == "command_denied"
    assert "ACRO" in loi.value.message
    # Và KHÔNG có gói nào bay ra dây.
    assert _lenh_da_gui(fake) == []


def test_takeoff_khi_chua_armed_bi_tu_choi():
    conn, fake, state, _safety, control = stack_gia(armed=False)
    tu_dong_ack(conn, fake)
    assert state.mode == "GUIDED"

    with pytest.raises(ControlError) as loi:
        control.takeoff(5.0)

    assert loi.value.code == "validation_failed"
    assert "armed" in loi.value.message.lower()
    assert MAV_CMD_NAV_TAKEOFF not in _lenh_da_gui(fake)


def test_takeoff_vuot_max_alt_bi_tu_choi_khong_im_lang_kep():
    """Vượt trần thì BÁO LỖI, không kẹp xuống MAX_ALT rồi bay.

    Đây là nửa còn lại của quy tắc kẹp: velocity kẹp im lặng (người giữ phím
    không có kỳ vọng con số), altitude thì phải báo (người gõ "50" thì có).
    """
    conn, fake, _state, _safety, control = stack_gia()
    tu_dong_ack(conn, fake)
    assert config.MAX_ALT < 50.0

    with pytest.raises(ControlError) as loi:
        control.takeoff(50.0)

    assert loi.value.code == "validation_failed"
    # Cổng pass §6: KHÔNG có lệnh 22 nào được gửi.
    assert MAV_CMD_NAV_TAKEOFF not in _lenh_da_gui(fake)


def test_takeoff_hop_le_gui_lenh_22_voi_param7_la_do_cao():
    conn, fake, _state, _safety, control = stack_gia()
    tu_dong_ack(conn, fake)

    control.takeoff(5.0)

    goi = fake.last("command_long_send")
    args = goi["args"]
    assert args[2] == MAV_CMD_NAV_TAKEOFF
    # args = (sys, comp, cmd, confirmation, p1..p7) -> param7 ở chỉ số 10.
    assert args[10] == pytest.approx(5.0)


def test_vz_duong_la_xuong():
    """NED: Z dương hướng XUỐNG. Bấm 'lên' mà drone chúi là do đảo dấu ở đây.

    `KEY_VELOCITY_MAP` hiện có đã đúng — đừng "sửa cho hợp lý".
    """
    assert KEY_VELOCITY_MAP["r"][2] < 0, "r = lên  -> vz phải ÂM"
    assert KEY_VELOCITY_MAP["f"][2] > 0, "f = xuống -> vz phải DƯƠNG"
    assert KEY_VELOCITY_MAP["w"][0] > 0, "w = tiến  -> vx phải DƯƠNG"
    assert KEY_VELOCITY_MAP["d"][1] > 0, "d = phải  -> vy phải DƯƠNG"


# ---------------------------------------------------------------------------
# Hình dạng gói velocity — khẳng định trên GÓI ĐÃ GỬI, không phải trong comment
# ---------------------------------------------------------------------------
def test_velocity_dung_frame_va_type_mask():
    conn, fake, _state, _safety, control = stack_gia()

    control.send_velocity_body(1.0, 0.0, 0.0)

    goi = fake.last("set_position_target_local_ned_send")
    assert goi is not None, "chua gui goi velocity nao"
    assert goi["vx"] == pytest.approx(1.0)
    assert goi["coordinate_frame"] == 9, "phai la MAV_FRAME_BODY_OFFSET_NED"
    assert goi["type_mask"] == VELOCITY_TYPE_MASK == 0x0DC7 == 3527


def test_velocity_yaw_rate_doi_do_sang_radian():
    """Vào là ĐỘ/giây (cho người đọc), ra dây là RAD/giây (MAVLink đòi)."""
    import math

    conn, fake, _state, _safety, control = stack_gia()

    control.send_velocity_body(0.0, 0.0, 0.0, yaw_rate=45.0)

    goi = fake.last("set_position_target_local_ned_send")
    assert goi["yaw_rate"] == pytest.approx(math.radians(45.0))


# ---------------------------------------------------------------------------
# arm / mode
# ---------------------------------------------------------------------------
def test_arm_khi_chua_co_3d_fix_bi_tu_choi():
    """Không tắt pre-arm check để 'cho nó arm được' (SAFETY.md mục 3)."""
    conn, fake, _state, _safety, control = stack_gia(gps_fix_type=1)
    tu_dong_ack(conn, fake)

    with pytest.raises(ControlError) as loi:
        control.arm()

    assert loi.value.code == "validation_failed"
    assert "3D fix" in loi.value.message
    assert MAV_CMD_COMPONENT_ARM_DISARM not in _lenh_da_gui(fake)


def test_arm_gui_param1_bang_1_va_moi_param_khac_bang_0():
    """Canh trực tiếp cái nguy hiểm: param2 phải là 0, không bao giờ 21196."""
    conn, fake, _state, _safety, control = stack_gia()
    tu_dong_ack(conn, fake)

    control.arm()

    args = fake.last("command_long_send")["args"]
    assert args[2] == MAV_CMD_COMPONENT_ARM_DISARM
    assert args[4] == pytest.approx(1.0), "param1 = 1 la arm"
    assert list(args[5:]) == [0.0] * 6, "moi param con lai PHAI bang 0 (khong force)"


def test_fc_tu_choi_thi_bao_command_denied_chu_khong_im_lang():
    conn, fake, _state, _safety, control = stack_gia()
    tu_dong_ack(conn, fake, result=2)  # MAV_RESULT_DENIED

    with pytest.raises(ControlError) as loi:
        control.arm()

    assert loi.value.code == "command_denied"
    assert "DENIED" in loi.value.message


def test_arm_cho_telemetry_bao_armed_chu_khong_chi_ack():
    """Hồi quy của một lỗi bắt được trên SITL THẬT ngày 2026-09-22.

    `COMMAND_ACK` về trong vài mili-giây; cờ `armed` nằm ở HEARTBEAT và chỉ về
    1 Hz. Bản đầu trả `ack done` ngay sau ack, nên chuỗi arm -> takeoff qua
    WebSocket hỏng: takeoff đọc `state.armed` vẫn False và báo "Chua armed".

    Bài này CHẠY ĐƯỢC mà không có SITL vì nó dựng lại đúng độ trễ đó bằng một
    thread lật cờ muộn. Trước khi có nó, mọi test của `arm` đều dùng state đã
    `armed=True` sẵn nên không bài nào chạm tới đường chờ này.
    """
    import threading
    import time

    conn, fake, state, _safety, control = stack_gia(armed=False)
    tu_dong_ack(conn, fake)

    def _heartbeat_ve_muon():
        time.sleep(0.25)
        state.armed = True

    threading.Thread(target=_heartbeat_ve_muon, daemon=True).start()
    moc = time.monotonic()
    control.arm(timeout=3.0)

    assert time.monotonic() - moc >= 0.2, (
        "arm() tra ve TRUOC khi telemetry xac nhan — `ack done` dang noi doi"
    )
    assert state.armed is True


def test_arm_bao_timeout_khi_telemetry_khong_bao_gio_xac_nhan():
    """FC ack nhưng drone không bao giờ armed -> `timeout`, không im lặng xong."""
    conn, fake, _state, _safety, control = stack_gia(armed=False)
    tu_dong_ack(conn, fake)

    with pytest.raises(ControlError) as loi:
        control.arm(timeout=0.2)

    assert loi.value.code == "timeout"
    assert "telemetry" in loi.value.message.lower()


def test_ack_khong_ve_thi_bao_timeout():
    """Không có ai trả ack -> `timeout`, không treo vĩnh viễn ở 'accepted'."""
    conn, fake, _state, _safety, control = stack_gia()
    # KHÔNG gắn tu_dong_ack: mô phỏng ack rơi mất trên đường về.

    with pytest.raises(ControlError) as loi:
        control.arm(timeout=0.05)

    assert loi.value.code == "timeout"


def test_set_mode_xong_khi_heartbeat_bao_mode_moi():
    """Đường xác nhận thứ hai: ack rơi nhưng HEARTBEAT đã báo mode đổi."""
    conn, fake, state, _safety, control = stack_gia(mode="LOITER")
    # Không ack. Nhưng state.mode đã là GUIDED ngay từ đầu vòng chờ.
    state.mode = "GUIDED"

    control.set_mode("GUIDED", timeout=0.05)  # không được ném

    # Vẫn phải THỰC SỰ gửi lệnh, chứ không phải thấy mode khớp rồi bỏ qua.
    assert MAV_CMD_DO_SET_MODE in _lenh_da_gui(fake)


def test_land_rtl_loiter_la_doi_mode_chu_khong_phai_mission_item():
    """MAV_CMD_NAV_LAND / NAV_RETURN_TO_LAUNCH là *mission item*, ý nghĩa khác."""
    conn, fake, state, _safety, control = stack_gia()
    tu_dong_ack(conn, fake)

    control.rtl()

    da_gui = _lenh_da_gui(fake)
    assert da_gui == [MAV_CMD_DO_SET_MODE]
    assert 20 not in da_gui, "20 = MAV_CMD_NAV_RETURN_TO_LAUNCH, khong duoc dung"
    assert 21 not in da_gui, "21 = MAV_CMD_NAV_LAND, khong duoc dung"


# ---------------------------------------------------------------------------
# 6.6 — test canh gác hàm cấm
# ---------------------------------------------------------------------------
# Danh sách canonical ở `plans/phase-06-backend-dieu-khien-deadman.md` §6.6.
TEN_BI_CAM = (
    "send_motor_pwm",
    "set_motor_output",
    "rc_channels_override_send",
    "manual_control_send",
    "set_actuator_control_target_send",
    "actuator_control_target_send",
    "set_attitude_target_send",
)
# MAV_CMD bị cấm gửi từ đường web.
LENH_BI_CAM = {
    183: "MAV_CMD_DO_SET_SERVO",
    209: "MAV_CMD_DO_MOTOR_TEST",
    246: "MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN",
}
# param2 của COMPONENT_ARM_DISARM: force disarm, tắt động cơ GIỮA KHÔNG TRUNG.
FORCE_DISARM_MAGIC = 21196


def _ten_va_so_trong(duong_dan: Path) -> tuple[set[str], set[float]]:
    """Mọi định danh và mọi hằng số của một file, đọc bằng AST.

    Dùng AST chứ không so khớp văn bản, vì file `control.py` cố ý VIẾT RA tên
    các hàm bị cấm trong docstring để người sau biết vì sao chúng bị cấm. So
    khớp văn bản thì bài test tự đỏ vì chính tài liệu của mình — và cách chữa
    hiển nhiên (xoá tài liệu đi) là đúng thứ ta không muốn ai làm.

    AST bỏ qua comment và không coi nội dung chuỗi là định danh, nên nó phân
    biệt được "nhắc tên" với "GỌI thật".
    """
    cay = ast.parse(duong_dan.read_text(encoding="utf-8"))
    ten: set[str] = set()
    so: set[float] = set()
    for nut in ast.walk(cay):
        if isinstance(nut, ast.Name):
            ten.add(nut.id)
        elif isinstance(nut, ast.Attribute):
            ten.add(nut.attr)
        elif isinstance(nut, ast.FunctionDef | ast.AsyncFunctionDef):
            ten.add(nut.name)
        elif isinstance(nut, ast.keyword) and nut.arg:
            ten.add(nut.arg)
        elif (
            isinstance(nut, ast.Constant)
            and isinstance(nut.value, int | float)
            and not isinstance(nut.value, bool)  # True/False là int trong Python
        ):
            so.add(float(nut.value))
    return ten, so


def test_khong_co_ham_dieu_khien_muc_thap():
    """SAFETY.md mục 1: backend KHÔNG điều khiển motor / ESC / cần RC."""
    ten, so = _ten_va_so_trong(CONTROL_PY)

    vi_pham = sorted(ten & set(TEN_BI_CAM))
    assert vi_pham == [], f"control.py GOI ham bi cam: {vi_pham}"

    assert FORCE_DISARM_MAGIC not in so, (
        "control.py co hang so 21196 = force disarm, tat dong co giua khong trung"
    )

    lenh_cam_co_mat = sorted(ma for ma in LENH_BI_CAM if float(ma) in so)
    assert lenh_cam_co_mat == [], "control.py co MAV_CMD bi cam: " + ", ".join(
        f"{ma} ({LENH_BI_CAM[ma]})" for ma in lenh_cam_co_mat
    )


def test_moi_loi_goi_mavlink_deu_qua_connection_send():
    """Cổng pass: `grep -rn "\\.mav\\." control.py` — không ai gọi thẳng.

    Hai thread cùng ghi một socket UDP làm byte của hai gói đan vào nhau; FC
    bỏ gói TRONG IM LẶNG. Không exception, không log. Khoá nằm trong
    `MavlinkConnection.send`, nên mọi `*_send` phải là THAM SỐ của nó, không
    bao giờ là lời gọi độc lập.
    """
    cay = ast.parse(CONTROL_PY.read_text(encoding="utf-8"))
    vi_pham: list[str] = []
    for nut in ast.walk(cay):
        if not isinstance(nut, ast.Call):
            continue
        ham = nut.func
        if isinstance(ham, ast.Attribute) and ham.attr.endswith("_send"):
            vi_pham.append(f"dong {nut.lineno}: goi thang .{ham.attr}()")
    assert vi_pham == [], "\n".join(vi_pham)
