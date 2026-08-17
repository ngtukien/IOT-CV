"""Test API backend chạy được khi chưa có MAVLink (GIAI ĐOẠN 7).

Không dùng `with TestClient(app)` để lifespan không tự mở link MAVLink — test
phải độc lập với SITL.
"""

from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_status_khong_crash_khi_chua_co_mavlink():
    response = client.get("/api/status")

    assert response.status_code == 200
    payload = response.json()
    # Đây là điểm quan trọng: không có SITL thì báo mất kết nối, không phải 500.
    assert payload["connected"] is False
    assert payload["mode"] == "UNKNOWN"


def test_status_tra_ve_gioi_han_an_toan():
    payload = client.get("/api/status").json()

    limits = payload["limits"]
    assert limits["max_alt"] == 10.0
    assert limits["max_distance_home"] == 50.0
    assert limits["max_waypoints"] == 10
    assert limits["manual_command_timeout_ms"] == 300


def test_status_tra_ve_trang_thai_safety():
    payload = client.get("/api/status").json()

    assert payload["safety"]["web_control_enabled"] is False


def test_frontend_duoc_serve():
    response = client.get("/")

    assert response.status_code == 200
    assert "UAV" in response.text
