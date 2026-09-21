"""Router REST — Phase 05, việc 5.3.5.

Tách khỏi `app.py` để file đó chỉ còn việc lắp ráp.

⚠️ `GET /api/status` cố ý GIỮ NGUYÊN hình dạng CŨ (telemetry phẳng + `safety` +
`limits`), KHÔNG dùng `StatusPayload` của hợp đồng WebSocket. Hai thứ này khác
nhau và đó là chủ ý:

- `/api/status` là endpoint chẩn đoán cho `curl` và cho test, có từ GIAI ĐOẠN 7;
  ba khẳng định trong `backend/tests/test_app.py` khoá hình dạng này.
- `status` trên WebSocket là hợp đồng với frontend, hình dạng ở `schemas.py`.

Frontend (Phase 08 trở đi) dùng WebSocket, KHÔNG dùng endpoint này. Nếu sau này
có ai định cho frontend đọc `/api/status` thì hãy đổi nó sang `StatusPayload`
trước — đừng nuôi hai hợp đồng cho cùng một người đọc.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend import __version__, config
from backend.mavlink.safety import SafetyState
from backend.mavlink.telemetry import is_link_alive
from backend.schemas import TelemetryState


def status_payload(state: TelemetryState, safety: SafetyState) -> dict:
    """Payload chẩn đoán. Frontend không đọc MAVLink trực tiếp."""
    payload = state.as_dict()
    # `connected` phải phản ánh link còn sống, không phải "đã từng kết nối".
    payload["connected"] = state.connected and is_link_alive(state)
    payload["endpoint"] = config.MAVLINK_ENDPOINT
    payload["safety"] = safety.as_dict()
    payload["limits"] = config.safety_limits()
    return payload


def build_router(state: TelemetryState, safety: SafetyState) -> APIRouter:
    """Dựng router với state được tiêm vào.

    Tiêm chứ không import biến toàn cục từ `app.py`: nếu import thì
    `app -> api -> app` thành vòng, và test không thay được state giả.
    """
    router = APIRouter(prefix="/api")

    @router.get("/health")
    async def health() -> dict:
        return {"status": "ok", "version": __version__}

    @router.get("/status")
    async def status() -> dict:
        return status_payload(state, safety)

    return router
