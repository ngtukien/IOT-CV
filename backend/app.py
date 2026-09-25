"""Web GCS backend — lắp ráp, không logic.

Từ Phase 05 file này chỉ làm bốn việc: tạo app, gắn router REST, gắn WebSocket,
và chạy/dọn các task nền. Logic nằm ở `api.py`, `ws.py`, `mavlink/`.

Chạy được ngay mà KHÔNG cần SITL: chưa có link MAVLink thì `/api/status` trả
`connected: false` chứ không crash, đúng nguyên tắc "mất một subsystem không
được kéo cả hệ thống chết".

    uvicorn backend.app:app --reload

Endpoint:
    GET  /api/health              - backend còn sống
    GET  /api/status              - y hệt `status.data` của WebSocket
    GET  /api/config              - ngưỡng an toàn, endpoint, phiên bản
    GET  /api/mission             - mission hiện tại (+ nguồn: readback/local/none)
    POST /api/mission             - nạp mission (chung đường với cmd.mission.upload)
    GET  /api/events?limit=100    - lịch sử sự kiện
    GET  /api/video/stream        - MJPEG, fan-out từ MỘT kết nối tới nguồn
    GET  /api/video/fake-source   - nguồn MJPEG giả (CAMERA_FAKE=1)
    WS   /ws                      - hai chiều, theo Hợp đồng WebSocket (schemas.py)
    /                             - frontend tĩnh đã build (frontend/dist)
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles

from backend import __version__, config
from backend.api import build_router
from backend.mavlink.control import FlightControl
from backend.mavlink.deadman import DeadmanLoop
from backend.mavlink.mission import MissionManager
from backend.mavlink.safety import SafetyState
from backend.mavlink.telemetry import TelemetryReader, TelemetryState
from backend.ws import WebSocketHub, websocket_endpoint

log = logging.getLogger(__name__)

# State dùng chung cho cả HTTP và WebSocket.
STATE = TelemetryState()
SAFETY = SafetyState()
READER = TelemetryReader(state=STATE)
# Dùng CHUNG một `MavlinkConnection` với reader: đó là cửa ghi duy nhất, và
# cái khoá trong nó là thứ giữ cho thread telemetry và vòng dead-man không
# ghi đan byte vào nhau (xem khối LUẬT ở đầu connection.py).
CONTROL = FlightControl(READER.connection, state=STATE)
DEADMAN = DeadmanLoop(CONTROL, SAFETY)
MISSION = MissionManager(READER.connection, state=STATE, control=CONTROL)
# Thread đọc là người DUY NHẤT đọc socket; nó chuyển gói MISSION_* sang đây.
READER.mission_sink = MISSION.on_message


def _make_camera():
    """Reader MJPEG dùng chung cho mọi tab, hoặc None khi tắt vision. Import tại
    chỗ để khối bay không phụ thuộc khối vision."""
    if not config.VISION_ENABLED:
        return None
    from backend.vision.stream import MjpegLatestFrameReader

    return MjpegLatestFrameReader()


CAMERA = _make_camera()
HUB = WebSocketHub(
    state=STATE,
    safety=SAFETY,
    control=CONTROL,
    deadman=DEADMAN,
    mission=MISSION,
    camera=CAMERA,
)


def _autostart_enabled() -> bool:
    """Đặt TELEMETRY_AUTOSTART=0 để không tự mở MAVLink (hữu ích khi test)."""
    return os.environ.get("TELEMETRY_AUTOSTART", "1") not in ("0", "false", "False")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    HUB.start_background()
    if _autostart_enabled():
        READER.start()
        # Sau READER.start(): vòng dead-man gửi qua cùng một connection, bật
        # trước thì nó chỉ ném ConnectionError vào log cho tới khi link lên.
        #
        # TELEMETRY_AUTOSTART=0 phải tắt LUÔN vòng dead-man. Bật nó khi không
        # có link nghĩa là mỗi bộ test để lại một thread lang thang ghi cảnh
        # báo — và `conftest.py` đặt biến đó chính là để chuyện này không xảy ra.
        DEADMAN.start()
        # Camera cùng cờ: test không được tự mở kết nối HTTP nào.
        if CAMERA is not None:
            CAMERA.start()
    try:
        yield
    finally:
        # Ngược thứ tự lúc bật: dừng người GHI trước, người ĐỌC sau.
        if CAMERA is not None:
            CAMERA.stop()
        DEADMAN.stop()
        READER.stop()
        await HUB.stop_background()


app = FastAPI(title="UAV Web GCS", version=__version__, lifespan=lifespan)
app.include_router(build_router(HUB))


@app.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket_endpoint(HUB, websocket)


# Mount cuối cùng để không che các route /api và /ws ở trên. Đừng đảo thứ tự.
_FRONTEND_DIR = config.PROJECT_ROOT / "frontend" / "dist"
if _FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
