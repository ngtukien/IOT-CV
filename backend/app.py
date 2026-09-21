"""Web GCS backend — lắp ráp, không logic.

Từ Phase 05 file này chỉ làm bốn việc: tạo app, gắn router REST, gắn WebSocket,
và chạy/dọn các task nền. Logic nằm ở `api.py`, `ws.py`, `mavlink/`.

Chạy được ngay mà KHÔNG cần SITL: chưa có link MAVLink thì `/api/status` trả
`connected: false` chứ không crash, đúng nguyên tắc "mất một subsystem không
được kéo cả hệ thống chết".

    uvicorn backend.app:app --reload

Endpoint:
    GET  /api/health   - backend còn sống
    GET  /api/status   - telemetry đã chuẩn hoá + giới hạn an toàn (chẩn đoán)
    WS   /ws           - hai chiều, theo Hợp đồng WebSocket (backend/schemas.py)
    /                  - frontend tĩnh đã build (frontend/dist)
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles

from backend import __version__, config
from backend.api import build_router
from backend.mavlink.safety import SafetyState
from backend.mavlink.telemetry import TelemetryReader, TelemetryState
from backend.ws import WebSocketHub, websocket_endpoint

log = logging.getLogger(__name__)

# State dùng chung cho cả HTTP và WebSocket.
STATE = TelemetryState()
SAFETY = SafetyState()
READER = TelemetryReader(state=STATE)
HUB = WebSocketHub(state=STATE, safety=SAFETY)


def _autostart_enabled() -> bool:
    """Đặt TELEMETRY_AUTOSTART=0 để không tự mở MAVLink (hữu ích khi test)."""
    return os.environ.get("TELEMETRY_AUTOSTART", "1") not in ("0", "false", "False")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    HUB.start_background()
    if _autostart_enabled():
        READER.start()
    try:
        yield
    finally:
        READER.stop()
        await HUB.stop_background()


app = FastAPI(title="UAV Web GCS", version=__version__, lifespan=lifespan)
app.include_router(build_router(STATE, SAFETY))


@app.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket_endpoint(HUB, websocket)


# Mount cuối cùng để không che các route /api và /ws ở trên. Đừng đảo thứ tự.
_FRONTEND_DIR = config.PROJECT_ROOT / "frontend" / "dist"
if _FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
