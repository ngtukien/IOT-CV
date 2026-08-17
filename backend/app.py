"""Web GCS backend — GIAI ĐOẠN 7.

Chạy được ngay mà KHÔNG cần SITL: nếu chưa có link MAVLink thì `/api/status` trả
`connected: false` chứ không crash, đúng nguyên tắc "mất một subsystem không được
kéo cả hệ thống chết".

    uvicorn backend.app:app --reload

Endpoint:
    GET  /api/health      - backend còn sống
    GET  /api/status      - telemetry đã chuẩn hoá + giới hạn an toàn
    WS   /ws/telemetry    - push telemetry ~TELEMETRY_HZ lần/giây
    /                     - frontend tĩnh (frontend/index.html)
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from backend import __version__, config
from backend.mavlink.safety import SafetyState
from backend.mavlink.telemetry import TelemetryReader, TelemetryState, is_link_alive

log = logging.getLogger(__name__)

# State dùng chung cho cả HTTP và WebSocket.
STATE = TelemetryState()
SAFETY = SafetyState()
READER = TelemetryReader(state=STATE)


def _autostart_enabled() -> bool:
    """Đặt TELEMETRY_AUTOSTART=0 để không tự mở MAVLink (hữu ích khi test)."""
    return os.environ.get("TELEMETRY_AUTOSTART", "1") not in ("0", "false", "False")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    if _autostart_enabled():
        READER.start()
    try:
        yield
    finally:
        READER.stop()


app = FastAPI(title="UAV Web GCS", version=__version__, lifespan=lifespan)


def status_payload() -> dict:
    """Payload chuẩn hoá gửi cho frontend. Frontend không đọc MAVLink trực tiếp."""
    payload = STATE.as_dict()
    # `connected` phải phản ánh link còn sống, không phải "đã từng kết nối".
    payload["connected"] = STATE.connected and is_link_alive(STATE)
    payload["endpoint"] = config.MAVLINK_ENDPOINT
    payload["safety"] = SAFETY.as_dict()
    payload["limits"] = config.safety_limits()
    return payload


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/api/status")
async def status() -> dict:
    return status_payload()


@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket) -> None:
    await websocket.accept()
    interval = 1.0 / max(config.TELEMETRY_HZ, 1.0)
    try:
        while True:
            await websocket.send_json(status_payload())
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        # GIAI ĐOẠN 11: browser đóng -> web mất quyền manual control ngay.
        SAFETY.on_web_disconnected()
        log.info("WebSocket telemetry đóng — thu hồi quyền manual control của web")


# Mount cuối cùng để không che các route /api và /ws ở trên.
_FRONTEND_DIR = config.PROJECT_ROOT / "frontend"
if _FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
