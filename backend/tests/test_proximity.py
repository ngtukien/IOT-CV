"""Test proximity + `avoid_state` — Phase 07 §7.6, §7.10.1.

Hình dạng gói lấy theo số ĐO THẬT trên SITL (khối ĐÃ ĐO ở proximity.py):
DISTANCE_SENSOR id=10 orientation=0 min=10 cm max=600 cm; bit sức khoẻ là
PROXIMITY 0x4000000, không phải LASER_POSITION 0x100.
"""

from __future__ import annotations

import pytest

from backend.mavlink import proximity
from backend.mavlink.telemetry import build_telemetry, update_state
from backend.schemas import TelemetryState
from backend.tests.fakes import FakeMessage

PRX = proximity.SENSOR_PROXIMITY


def _ds(cm: int, orientation: int = 0) -> FakeMessage:
    return FakeMessage(
        "DISTANCE_SENSOR",
        current_distance=cm,
        min_distance=10,
        max_distance=600,
        orientation=orientation,
        id=10,
    )


def _sys(present: int, enabled: int, health: int) -> FakeMessage:
    return FakeMessage(
        "SYS_STATUS",
        onboard_control_sensors_present=present,
        onboard_control_sensors_enabled=enabled,
        onboard_control_sensors_health=health,
        voltage_battery=12600,
    )


# -- §7.6.1 DISTANCE_SENSOR ------------------------------------------------
def test_cm_doi_sang_met():
    assert proximity.distance_sensor_m(_ds(245)) == pytest.approx(2.45)


@pytest.mark.parametrize("cm", [600, 700, 10, 5, 0])
def test_ngoai_min_max_la_none_khong_phai_so(cm):
    # Nhầm chỗ này thì UI hiện "0.0 m" khi thật ra đang mù.
    assert proximity.distance_sensor_m(_ds(cm)) is None


def test_dau_tren_tam_la_trong_trai_dau_duoi_la_mu():
    assert proximity.distance_sensor_is_clear(_ds(600)) is True
    assert proximity.distance_sensor_is_clear(_ds(10)) is False
    assert proximity.distance_sensor_is_clear(_ds(300)) is False


# -- §7.6.2 OBSTACLE_DISTANCE ------------------------------------------------
def _od(distances, increment=5, offset=0.0) -> FakeMessage:
    return FakeMessage(
        "OBSTACLE_DISTANCE",
        distances=distances,
        increment=increment,
        increment_f=0.0,
        angle_offset=offset,
        min_distance=10,
        max_distance=1200,
    )


def test_65535_la_khong_co_du_lieu():
    assert proximity.aggregate_obstacle_sectors(_od([65535] * 72)) == [None] * 8


def test_gop_72_cung_xuong_8_lay_min():
    d = [65535] * 72
    d[0] = 300  # 0° -> cung 0 (mũi)
    d[1] = 250  # 5° -> vẫn cung 0
    d[18] = 400  # 90° -> cung 2 (phải)
    d[70] = 120  # 350° -> cung 0 (quấn vòng), nhỏ nhất -> thắng
    d[36] = 5  # dưới min_distance -> bỏ
    sectors = proximity.aggregate_obstacle_sectors(_od(d))
    assert len(sectors) == 8
    assert sectors[0] == pytest.approx(1.2)
    assert sectors[2] == pytest.approx(4.0)
    assert sectors[4] is None


def test_goc_lech_duoc_tinh():
    d = [65535] * 72
    d[0] = 300
    sectors = proximity.aggregate_obstacle_sectors(_od(d, offset=90.0))
    assert sectors[2] == pytest.approx(3.0)
    assert sectors[0] is None


# -- sức khoẻ -----------------------------------------------------------------
def test_suc_khoe_lay_tu_bit_proximity():
    """Đo SITL: LASER_POSITION không có mặt, PROXIMITY có mặt + khoẻ."""
    assert proximity.rangefinder_healthy_from_sys_status(_sys(PRX, PRX, PRX)) is True
    assert proximity.rangefinder_healthy_from_sys_status(_sys(PRX, PRX, 0)) is False


def test_khong_bit_nao_co_mat_thi_khong_khoe():
    assert proximity.rangefinder_healthy_from_sys_status(_sys(0, 0, 0xFFFFFFFF)) is False


def test_co_ca_hai_bit_thi_ca_hai_phai_khoe():
    both = PRX | proximity.SENSOR_LASER_POSITION
    assert proximity.rangefinder_healthy_from_sys_status(_sys(both, both, PRX)) is False


# -- §7.6.4 avoid_state: đủ 4 nhánh ---------------------------------------------
@pytest.mark.parametrize(
    ("d", "mode", "ky_vong"),
    [
        (5.5, "LOITER", "OFF"),
        (3.0, "LOITER", "NEAR"),
        (5.0, "LOITER", "NEAR"),  # biên: d <= AVOID_DIST_MAX -> NEAR
        (2.0, "LOITER", "ACTIVE"),  # biên: d <= AVOID_MARGIN -> ACTIVE
        (1.0, "ALT_HOLD", "ACTIVE"),
        (1.0, "POSHOLD", "ACTIVE"),
    ],
)
def test_avoid_state_theo_nguong(d, mode, ky_vong):
    assert proximity.avoid_state(d, mode, healthy=True, age_s=0.1) == ky_vong


@pytest.mark.parametrize("mode", ["GUIDED", "AUTO", "RTL", "LAND", "STABILIZE"])
def test_active_khong_bao_gio_xuat_hien_ngoai_loiter_althold_poshold(mode):
    """OA_TYPE=0: ở các mode này FC KHÔNG tránh vật cản. Tối đa là NEAR."""
    assert proximity.avoid_state(0.5, mode, healthy=True, age_s=0.1) == "NEAR"


def test_khoe_ma_im_lang_la_off_khong_phai_unknown():
    """Đo SITL: FC chỉ gửi DISTANCE_SENSOR khi có vật trong tầm. Im lặng + khoẻ
    = "không có gì", không phải "mù"."""
    assert proximity.avoid_state(None, "LOITER", healthy=True, age_s=2.5) == "OFF"
    assert proximity.avoid_state(None, "LOITER", healthy=True, age_s=None) == "OFF"


def test_im_lang_ma_khong_khoe_la_unknown():
    assert proximity.avoid_state(None, "LOITER", healthy=False, age_s=None) == "UNKNOWN"
    assert proximity.avoid_state(None, "LOITER", healthy=False, age_s=5.0) == "UNKNOWN"


def test_cam_bien_khong_khoe_la_unknown():
    assert proximity.avoid_state(3.0, "LOITER", healthy=False, age_s=0.1) == "UNKNOWN"


def test_ngoai_tam_tren_la_off_ngoai_tam_duoi_la_unknown():
    assert proximity.avoid_state(None, "LOITER", healthy=True, age_s=0.1, clear=True) == "OFF"
    assert proximity.avoid_state(None, "LOITER", healthy=True, age_s=0.1) == "UNKNOWN"


# -- nối vào telemetry ----------------------------------------------------------
def _state(mode: str = "LOITER") -> TelemetryState:
    """Link SỐNG (connected + gói cuối lúc 100.0) và proximity khoẻ."""
    st = TelemetryState(mode=mode, connected=True)
    update_state(st, _sys(PRX, PRX, PRX), now=100.0)
    return st


def test_telemetry_tu_distance_sensor_ra_avoid_state():
    st = _state()
    update_state(st, _ds(150), now=100.0)

    t = build_telemetry(st, now=100.2)
    assert t.obstacle_distance == pytest.approx(1.5)
    assert t.obstacle_sectors[0] == pytest.approx(1.5)
    assert t.rangefinder_healthy is True
    assert t.avoid_state == "ACTIVE"


def test_telemetry_active_tu_tat_o_guided():
    st = _state(mode="GUIDED")
    update_state(st, _ds(150), now=100.0)
    assert build_telemetry(st, now=100.2).avoid_state == "NEAR"


def test_telemetry_so_cu_bi_che_thanh_null():
    """Số cũ KHÔNG được hiện như số mới — con số 1.5 m đứng im là nói dối."""
    st = _state()
    update_state(st, _ds(150), now=100.0)

    # 2,5 s: quá PROXIMITY_STALE_S (2 s) nhưng link vẫn sống (LINK_TIMEOUT_S 3 s).
    t = build_telemetry(st, now=102.5)
    assert t.obstacle_distance is None
    assert t.obstacle_sectors == [None] * 8
    assert t.avoid_state == "OFF"  # khoẻ + im lặng: vật đã ra khỏi tầm


def test_telemetry_cam_bien_hong_la_unknown_du_so_con_moi():
    st = _state()
    update_state(st, _ds(150), now=100.0)
    update_state(st, _sys(PRX, PRX, 0), now=100.1)  # FC báo proximity hỏng
    t = build_telemetry(st, now=100.2)
    assert t.avoid_state == "UNKNOWN"


def test_telemetry_mu_khong_hien_0_met():
    st = _state()
    update_state(st, _ds(5), now=100.0)
    t = build_telemetry(st, now=100.1)
    assert t.obstacle_distance is None
    assert t.avoid_state == "UNKNOWN"


def test_telemetry_trong_trai_la_off():
    st = _state()
    update_state(st, _ds(600), now=100.0)
    t = build_telemetry(st, now=100.1)
    assert t.obstacle_distance is None
    assert t.avoid_state == "OFF"


def test_distance_sensor_huong_khac_chi_vao_cung():
    st = _state()
    update_state(st, _ds(200, orientation=2), now=100.0)
    assert st.obstacle_distance is None
    assert st.obstacle_sectors[2] == pytest.approx(2.0)


def test_truong_noi_bo_khong_len_day():
    st = _state()
    update_state(st, _ds(150), now=100.0)
    du_lieu = build_telemetry(st, now=100.1).model_dump()
    assert "proximity_updated" not in du_lieu
    assert "proximity_clear" not in du_lieu


def test_bang_regex_statustext_de_rong():
    """§7.6.3: đo SITL không thấy chuỗi nào -> không đoán."""
    assert proximity.AVOID_STATUSTEXT_PATTERNS == ()
    assert proximity.is_avoid_statustext("Avoid: stopping") is False


def test_mat_link_thi_avoid_state_la_unknown():
    """SITL 25/09/2026: 63 mẫu connected=false mà avoid_state=OFF — sai."""
    from backend import config

    st = _state()
    update_state(st, _ds(600), now=100.0)
    assert build_telemetry(st, now=100.1).avoid_state == "OFF"
    t = build_telemetry(st, now=100.0 + config.LINK_TIMEOUT_S + 1)
    assert t.connected is False
    assert t.avoid_state == "UNKNOWN"
