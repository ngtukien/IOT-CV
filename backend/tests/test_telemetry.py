"""Test chuẩn hoá telemetry (GIAI ĐOẠN 6) — dùng message giả, không cần SITL."""

from backend.mavlink.telemetry import (
    TelemetryState,
    is_link_alive,
    mode_name,
    update_state,
)


class FakeMessage:
    """Bắt chước message của pymavlink: có get_type() và các attribute."""

    def __init__(self, msg_type: str, **fields) -> None:
        self._type = msg_type
        for key, value in fields.items():
            setattr(self, key, value)

    def get_type(self) -> str:
        return self._type


def test_heartbeat_cap_nhat_mode_va_armed():
    state = TelemetryState()
    # base_mode có bit 0b1000_0000 = đã armed; custom_mode 4 = GUIDED.
    update_state(state, FakeMessage("HEARTBEAT", base_mode=0b1000_0001, custom_mode=4), now=1.0)

    assert state.connected is True
    assert state.mode == "GUIDED"
    assert state.armed is True
    assert state.last_update == 1.0


def test_heartbeat_disarmed():
    state = TelemetryState()
    update_state(state, FakeMessage("HEARTBEAT", base_mode=0b0000_0001, custom_mode=5), now=1.0)

    assert state.mode == "LOITER"
    assert state.armed is False


def test_global_position_int_doi_don_vi():
    state = TelemetryState()
    update_state(
        state,
        FakeMessage(
            "GLOBAL_POSITION_INT",
            lat=101_234_560,
            lon=1_061_234_560,
            relative_alt=5_200,
            hdg=12_500,
        ),
        now=2.0,
    )

    assert state.lat == 10.123456
    assert state.lon == 106.123456
    assert state.relative_alt == 5.2
    assert state.heading == 125


def test_heading_khong_xac_dinh_thi_bo_qua():
    state = TelemetryState()
    update_state(
        state,
        FakeMessage("GLOBAL_POSITION_INT", lat=0, lon=0, relative_alt=0, hdg=65535),
        now=1.0,
    )

    assert state.heading is None


def test_gps_va_battery():
    state = TelemetryState()
    update_state(state, FakeMessage("GPS_RAW_INT", satellites_visible=14, fix_type=3), now=1.0)
    update_state(state, FakeMessage("SYS_STATUS", voltage_battery=11_400), now=1.1)

    assert state.satellites == 14
    assert state.gps_fix_type == 3
    assert state.battery_voltage == 11.4


def test_battery_khong_co_so_do_thi_giu_none():
    state = TelemetryState()
    update_state(state, FakeMessage("SYS_STATUS", voltage_battery=65535), now=1.0)

    assert state.battery_voltage is None


def test_attitude_doi_sang_do():
    state = TelemetryState()
    update_state(state, FakeMessage("ATTITUDE", roll=0.0, pitch=0.0, yaw=0.0), now=1.0)

    assert state.roll == 0.0
    assert state.pitch == 0.0


def test_message_khong_quan_tam_thi_bo_qua():
    state = TelemetryState()
    update_state(state, FakeMessage("RAW_IMU", xacc=1), now=5.0)

    # Không cập nhật gì, kể cả last_update.
    assert state.last_update is None
    assert state.connected is False


def test_schema_json_dung_nhu_giai_doan_6():
    state = TelemetryState()
    payload = state.as_dict()

    for key in (
        "connected",
        "mode",
        "armed",
        "lat",
        "lon",
        "relative_alt",
        "heading",
        "ground_speed",
        "satellites",
        "battery_voltage",
    ):
        assert key in payload


def test_mode_name_khong_biet_thi_khong_crash():
    assert mode_name(4) == "GUIDED"
    assert mode_name(199) == "MODE_199"


def test_link_alive_theo_thoi_gian():
    state = TelemetryState()
    assert is_link_alive(state, now=10.0) is False

    state.last_update = 10.0
    assert is_link_alive(state, now=10.5) is True
    # LINK_TIMEOUT_S mặc định 3s.
    assert is_link_alive(state, now=20.0) is False
