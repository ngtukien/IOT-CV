"""Test validate mission (GIAI ĐOẠN 14) — backend phải reject mission sai."""

import math

from backend.mavlink.mission import Waypoint, haversine_m, validate_mission

HOME = (10.762622, 106.660172)


def _wp(seq: int, alt: float = 5.0, offset_deg: float = 0.0) -> Waypoint:
    return Waypoint(seq=seq, lat=HOME[0] + offset_deg, lon=HOME[1], alt=alt)


def test_mission_hop_le():
    assert validate_mission([_wp(1), _wp(2, offset_deg=0.0002)], HOME) == []


def test_reject_mission_rong():
    errors = validate_mission([], HOME)
    assert len(errors) == 1
    assert "không có waypoint" in errors[0]


def test_reject_altitude_qua_thap():
    errors = validate_mission([_wp(1, alt=0.5)], HOME)
    assert any("thấp hơn giới hạn" in e for e in errors)


def test_reject_altitude_vuot_gioi_han():
    errors = validate_mission([_wp(1, alt=50.0)], HOME)
    assert any("vượt giới hạn" in e for e in errors)


def test_reject_waypoint_qua_xa_home():
    # ~0.01 độ vĩ độ xấp xỉ 1.1 km, vượt MAX_DISTANCE_HOME = 50 m.
    errors = validate_mission([_wp(1, offset_deg=0.01)], HOME)
    assert any("cách home" in e for e in errors)


def test_reject_toa_do_invalid():
    bad = [
        Waypoint(seq=1, lat=95.0, lon=106.0, alt=5.0),
        Waypoint(seq=2, lat=10.0, lon=200.0, alt=5.0),
        Waypoint(seq=3, lat=float("nan"), lon=106.0, alt=5.0),
        Waypoint(seq=4, lat=0.0, lon=0.0, alt=5.0),
    ]
    errors = validate_mission(bad, HOME)
    assert len(errors) == 4
    assert all("không hợp lệ" in e for e in errors)


def test_reject_qua_nhieu_waypoint():
    waypoints = [_wp(i) for i in range(1, 13)]
    errors = validate_mission(waypoints, HOME)
    assert any("vượt giới hạn 10" in e for e in errors)


def test_gioi_han_co_the_override():
    # Cho phép nới giới hạn qua tham số, ví dụ khi test ở sân rộng hơn.
    assert validate_mission([_wp(1, alt=25.0)], HOME, max_alt=30.0) == []


def test_khong_co_home_thi_bo_qua_kiem_tra_khoang_cach():
    assert validate_mission([_wp(1, offset_deg=0.5)], home=None) == []


def test_haversine_hop_ly():
    # 0.001 độ vĩ độ xấp xỉ 111 m.
    distance = haversine_m(HOME[0], HOME[1], HOME[0] + 0.001, HOME[1])
    assert math.isclose(distance, 111.0, rel_tol=0.02)
    assert haversine_m(HOME[0], HOME[1], HOME[0], HOME[1]) == 0.0


# ---------------------------------------------------------------------------
# Phase 07 §7.1 — chỉ THÊM test; không một dòng nào của các test trên bị sửa.
#
# Plan viết "thêm 2 luật vào validate_mission, trường `command` có mặc định nên
# test cũ không phải sửa". Chạy thật thì SAI: bốn test trên khẳng định `== []`
# hoặc `len(errors) == 4` với mission CHỈ có NAV_WAYPOINT, nên nhét luật
# "item đầu phải là TAKEOFF" vào validate_mission là làm chúng đỏ. Hai luật cấu
# trúc vì thế nằm ở `validate_mission_structure`, đường upload chạy cả hai
# (`validate_for_upload`).
# ---------------------------------------------------------------------------
from backend.mavlink.mission import validate_for_upload, validate_mission_structure  # noqa: E402


def _chuyen_bay(*giua: Waypoint, cuoi: int = 20) -> list[Waypoint]:
    return [
        Waypoint(seq=1, lat=HOME[0], lon=HOME[1], alt=5.0, command=22),
        *giua,
        Waypoint(seq=99, lat=0.0, lon=0.0, alt=0.0, command=cuoi),
    ]


def test_luat_7_item_dau_phai_la_takeoff():
    errors = validate_mission_structure([_wp(1), _wp(2), Waypoint(3, 0, 0, 0, command=20)])
    assert len(errors) == 1
    assert "NAV_TAKEOFF" in errors[0]


def test_luat_8_item_cuoi_phai_la_rtl_hoac_land():
    thieu = [Waypoint(1, HOME[0], HOME[1], 5.0, command=22), _wp(2)]
    errors = validate_mission_structure(thieu)
    assert len(errors) == 1
    assert "NAV_RETURN_TO_LAUNCH" in errors[0]


def test_chuyen_bay_day_du_qua_ca_hai_nhom_luat():
    assert validate_for_upload(_chuyen_bay(_wp(2), _wp(3, offset_deg=0.0002)), HOME) == []
    assert validate_for_upload(_chuyen_bay(_wp(2), cuoi=21), HOME) == []


def test_rtl_va_land_tai_cho_khong_bi_kiem_toa_do_va_alt():
    # RTL/LAND (0, 0, 0) hợp lệ: RTL không mang toạ độ, LAND (0,0) = hạ tại chỗ.
    assert validate_mission(_chuyen_bay(_wp(2)), HOME) == []
    assert validate_mission(_chuyen_bay(_wp(2), cuoi=21), HOME) == []


def test_land_co_toa_do_thi_van_bi_kiem_khoang_cach():
    land_xa = Waypoint(seq=5, lat=HOME[0] + 0.01, lon=HOME[1], alt=0.0, command=21)
    errors = validate_mission([land_xa], HOME)
    assert any("cách home" in e for e in errors)


def test_takeoff_van_bi_kiem_alt():
    errors = validate_mission([Waypoint(1, HOME[0], HOME[1], 50.0, command=22)], HOME)
    assert any("vượt giới hạn" in e for e in errors)


def test_lenh_ngoai_danh_sach_trang_bi_chan():
    # 183 DO_SET_SERVO, 209 DO_MOTOR_TEST: mission item hợp lệ với FC, cấm từ web.
    for lenh in (183, 209, 400):
        errors = validate_mission([Waypoint(1, HOME[0], HOME[1], 5.0, command=lenh)], HOME)
        assert len(errors) == 1
        assert "không được phép" in errors[0]


def test_command_mac_dinh_la_nav_waypoint():
    assert Waypoint(seq=1, lat=1.0, lon=1.0, alt=5.0).command == 16


def test_alt_dung_bang_tran_duoc_phep_vuot_mot_chut_bi_chan():
    """Biên của MAX_ALT. Thiếu bài này thì đổi `>` thành `>=` vẫn xanh hết — phép
    thử phá số 2 ở Phase 07 §7.10.3 đã chứng minh điều đó (25/09/2026)."""
    assert validate_mission([_wp(1, alt=10.0)], HOME) == []
    assert any("vượt giới hạn" in e for e in validate_mission([_wp(1, alt=10.01)], HOME))


def test_alt_dung_bang_san_duoc_phep():
    assert validate_mission([_wp(1, alt=2.0)], HOME) == []
    assert any("thấp hơn" in e for e in validate_mission([_wp(1, alt=1.99)], HOME))


def test_land_gan_0_duoi_nua_don_vi_1e7_la_ha_tai_cho():
    # 3e-8 độ ra dây thành 0 (nhân 1e7 rồi làm tròn) -> FC hiểu là "tại chỗ".
    land = Waypoint(seq=5, lat=3e-8, lon=-3e-8, alt=0.0, command=21)
    assert validate_mission([land], HOME) == []
    # 2e-7 độ thì ra dây là 2 -> toạ độ thật (và xa home) -> phải bị kiểm.
    land_xa = Waypoint(seq=6, lat=2e-7, lon=0.0, alt=0.0, command=21)
    assert validate_mission([land_xa], HOME) != []
