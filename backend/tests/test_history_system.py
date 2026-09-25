"""Web GCS v2 — ba bổ sung chỉ-đọc của backend:

- `TelemetryHistory` (vòng đệm) + `GET /api/telemetry/history`
- `GET /api/system`
- trả `index.html` cho đường dẫn TRANG của web (`/mission`, `/3d`…), nhưng
  KHÔNG cho `/api/...` hay file asset thiếu.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend import config
from backend.app import HUB, app, is_client_route
from backend.history import TelemetryHistory
from backend.schemas import SystemPayload, Telemetry, TelemetryHistoryPayload

client = TestClient(app)
_DIST = config.PROJECT_ROOT / "frontend" / "dist"


def _t(alt: float, connected: bool = True) -> Telemetry:
    return Telemetry(connected=connected, relative_alt=alt, mode="GUIDED")


# -- vòng đệm ---------------------------------------------------------------------


def test_chi_ghi_khi_link_song():
    h = TelemetryHistory(seconds=10, hz=1)
    assert h.record(_t(1.0), ts=100.0) is True
    assert h.record(_t(2.0, connected=False), ts=101.0) is False
    assert [s.data.relative_alt for s in h.samples(now=101.0)] == [1.0]


def test_day_thi_bo_mau_cu_nhat():
    h = TelemetryHistory(seconds=3, hz=1)  # sức chứa 3
    for i in range(5):
        h.record(_t(float(i)), ts=100.0 + i)
    assert h.capacity == 3
    assert [s.data.relative_alt for s in h.samples(now=104.0)] == [2.0, 3.0, 4.0]


def test_loc_theo_so_giay_gan_nhat():
    h = TelemetryHistory(seconds=100, hz=1)
    for i in range(10):
        h.record(_t(float(i)), ts=1000.0 + i)
    got = h.samples(seconds=3.5, now=1009.0)
    assert [s.ts for s in got] == [1006.0, 1007.0, 1008.0, 1009.0]


def test_lay_thua_giu_mau_moi_nhat_va_khong_vuot_tran():
    h = TelemetryHistory(seconds=1000, hz=1)
    for i in range(101):
        h.record(_t(float(i)), ts=float(i))
    got = h.samples(max_points=10, now=100.0)
    assert len(got) <= 10
    assert got[-1].data.relative_alt == 100.0
    # cũ trước mới sau
    assert [s.ts for s in got] == sorted(s.ts for s in got)


# -- REST ------------------------------------------------------------------------


@pytest.fixture
def seeded_history():
    HUB.history.clear()
    import time

    now = time.time()
    for i in range(20):
        HUB.history.record(_t(float(i)), ts=now - 20 + i)
    yield
    HUB.history.clear()


def test_api_history_dung_hop_dong(seeded_history):
    res = client.get("/api/telemetry/history", params={"seconds": 60, "max_points": 10})
    assert res.status_code == 200
    body = TelemetryHistoryPayload.model_validate(res.json())
    assert 0 < len(body.samples) <= 10
    assert body.samples[-1].data.relative_alt == 19.0
    assert body.hz == config.TELEMETRY_HZ


def test_api_history_tu_choi_tham_so_sai():
    assert client.get("/api/telemetry/history", params={"seconds": 0}).status_code == 422
    assert client.get("/api/telemetry/history", params={"max_points": 1}).status_code == 422


def test_api_system_dung_hop_dong():
    res = client.get("/api/system")
    assert res.status_code == 200
    body = SystemPayload.model_validate(res.json())
    assert body.link_alive is False  # test không mở MAVLink
    assert body.uptime_s >= 0
    assert body.endpoint == config.MAVLINK_ENDPOINT
    assert body.ws_clients == 0


# -- đường dẫn trang của web -----------------------------------------------------


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("mission", True),
        ("3d", True),
        ("logs/", True),
        ("", True),
        ("api/khong-co", False),
        ("api", False),
        ("ws", False),
        ("assets/index-abc.js", False),
        ("favicon.svg", False),
    ],
)
def test_phan_loai_duong_dan_trang(path, expected):
    assert is_client_route(path) is expected


@pytest.mark.skipif(not _DIST.is_dir(), reason="chua chay pnpm build")
def test_trang_con_tra_index_html():
    res = client.get("/mission")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert '<div id="root">' in res.text


@pytest.mark.skipif(not _DIST.is_dir(), reason="chua chay pnpm build")
def test_api_sai_route_van_la_404_that():
    res = client.get("/api/khong-co-route-nay")
    assert res.status_code == 404
    assert "text/html" not in res.headers.get("content-type", "")


@pytest.mark.skipif(not _DIST.is_dir(), reason="chua chay pnpm build")
def test_asset_thieu_van_la_404():
    assert client.get("/assets/khong-ton-tai-123.js").status_code == 404
