"""Test dead-man safety và quyền điều khiển của web (GIAI ĐOẠN 11, 65)."""

from backend.mavlink.safety import SafetyState


def test_web_khong_tu_gianh_quyen():
    safety = SafetyState(current_mode="GUIDED")
    allowed, reason = safety.may_accept_web_command()

    assert allowed is False
    assert "chưa được operator bật" in reason


def test_chi_lai_duoc_trong_guided():
    safety = SafetyState(current_mode="LOITER")
    safety.enable_web_control()

    allowed, reason = safety.may_accept_web_command()
    assert allowed is False
    assert "GUIDED" in reason


def test_duoc_phep_khi_da_bat_va_dang_guided():
    safety = SafetyState(current_mode="GUIDED")
    safety.enable_web_control()

    assert safety.may_accept_web_command() == (True, "")


def test_dead_man_timeout_gui_velocity_zero():
    safety = SafetyState(current_mode="GUIDED")
    safety.enable_web_control()
    safety.note_manual_command(now=100.0)

    # Trong timeout 300 ms: chưa cần gửi zero.
    assert safety.should_send_zero_velocity(now=100.2) is False
    # Quá timeout: phải gửi zero, không phụ thuộc frontend.
    assert safety.should_send_zero_velocity(now=100.4) is True


def test_khong_bat_web_control_thi_khong_gui_gi():
    safety = SafetyState(current_mode="GUIDED")
    assert safety.should_send_zero_velocity(now=100.0) is False


def test_bat_web_control_nhung_chua_co_lenh_nao():
    safety = SafetyState(current_mode="GUIDED")
    safety.enable_web_control()
    assert safety.should_send_zero_velocity(now=100.0) is True


def test_rc_doi_mode_thi_web_mat_quyen():
    safety = SafetyState(current_mode="GUIDED")
    safety.enable_web_control()
    safety.note_manual_command(now=100.0)

    # Pilot gạt switch sang LOITER (GIAI ĐOẠN 65).
    safety.on_mode_change("LOITER")

    assert safety.web_control_enabled is False
    assert safety.last_manual_command_time is None
    assert safety.may_accept_web_command()[0] is False


def test_dong_browser_thi_mat_quyen():
    safety = SafetyState(current_mode="GUIDED")
    safety.enable_web_control()
    safety.note_manual_command(now=100.0)

    safety.on_web_disconnected()

    assert safety.web_control_enabled is False


def test_clamp_velocity_theo_max_velocity():
    safety = SafetyState()
    # MAX_VELOCITY mặc định 1.0 m/s.
    assert safety.clamp_velocity(5.0) == 1.0
    assert safety.clamp_velocity(-5.0) == -1.0
    assert safety.clamp_velocity(0.5) == 0.5
