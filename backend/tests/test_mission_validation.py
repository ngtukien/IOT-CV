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
