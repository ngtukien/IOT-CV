"""Test API backend chạy được khi chưa có MAVLink (GIAI ĐOẠN 7).

Không dùng `with TestClient(app)` để lifespan không tự mở link MAVLink — test
phải độc lập với SITL.
"""

import pytest
from fastapi.testclient import TestClient

from backend import config
from backend.app import app

_DIST = config.PROJECT_ROOT / "frontend" / "dist"

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
    # Phase 07: /api/status trả y hệt `status.data` của WebSocket (một schema, hai
    # đường vận chuyển), nên mode nằm ở `safety.current_mode`, không ở gốc nữa.
    assert payload["safety"]["current_mode"] == "UNKNOWN"


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


@pytest.mark.skipif(not _DIST.is_dir(), reason="chua chay pnpm build")
def test_frontend_duoc_serve():
    # Chi kiem "co phuc vu duoc file tinh khong". KHONG assert noi dung trang —
    # trang Vite mac dinh chua co chu "UAV". Phase 10 kiem chung that bang
    # Playwright tren trang React da dung xong.
    response = client.get("/")

    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Phase 07 §7.8 — REST
# ---------------------------------------------------------------------------
def test_status_y_het_status_cua_websocket():
    """Một schema, hai đường vận chuyển: lệch nhau là bug."""
    from backend.app import HUB
    from backend.schemas import StatusPayload

    payload = client.get("/api/status").json()
    StatusPayload.model_validate(payload)
    assert set(payload) == set(HUB.build_status().model_dump())
    assert payload["mission"]["source"] == "none"
    assert payload["limits"]["proximity_stale_s"] == 2.0


def test_config_doc_nguong_tu_config():
    payload = client.get("/api/config").json()
    assert payload["limits"] == config.safety_limits()
    assert payload["telemetry_hz"] == config.TELEMETRY_HZ
    assert payload["versions"]["contract"] == 1


def test_mission_rong_khi_chua_upload():
    payload = client.get("/api/mission").json()
    assert payload == {"source": "none", "count": 0, "uploaded_at": None, "waypoints": []}


def test_post_mission_khi_chua_co_link_bi_tu_choi_ro_rang():
    body = {"waypoints": [{"seq": 1, "lat": 10.0, "lon": 106.0, "alt": 5.0, "command": 22}]}
    response = client.post("/api/mission", json=body)
    assert response.status_code == 503
    assert response.json()["ok"] is False
    assert response.json()["code"] == "not_connected"


def test_events_tra_lich_su_theo_limit():
    from backend.events import BUS

    for i in range(5):
        BUS.emit("info", "backend", "test.su_kien", f"su kien {i}")
    events = client.get("/api/events?limit=3").json()["events"]
    assert [e["message"] for e in events] == ["su kien 2", "su kien 3", "su kien 4"]
    assert client.get("/api/events?limit=0").status_code == 422
