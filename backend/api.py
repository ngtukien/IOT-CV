"""Router REST — Phase 05 việc 5.3.5, hoàn thiện ở Phase 07 §7.8.

REST dùng cho HỎI–ĐÁP (mở trang, đọc cấu hình, nạp mission). Telemetry và lệnh
lái đi bằng WebSocket. Mọi endpoint trả model pydantic trong `schemas.py` —
không tự dựng dict rời.

`GET /api/status` trả CHÍNH `StatusPayload` của message `status` trên WebSocket,
dựng bằng CÙNG một hàm (`WebSocketHub.build_status`). Một schema, hai đường vận
chuyển — lệch nhau là bug. (Trước Phase 07 endpoint này có hình dạng riêng,
"telemetry phẳng + safety + limits"; Phase 07 bỏ hình dạng đó để khỏi nuôi hai
hợp đồng. Không có frontend hay script nào đọc hình dạng cũ.)
"""

from __future__ import annotations

import asyncio
import os
import platform
import sys
import time

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from backend import __version__, config
from backend.schemas import (
    CONTRACT_VERSION,
    CmdMissionUpload,
    ConfigPayload,
    EventsPayload,
    LimitsPayload,
    MissionPayload,
    MissionUploadResult,
    MissionWaypoint,
    StatusPayload,
    SystemPayload,
    TelemetryHistoryPayload,
    VersionsPayload,
)
from backend.vision.stream import MJPEG_MEDIA_TYPE, mjpeg_multipart

# Mã lỗi hợp đồng -> mã HTTP cho `POST /api/mission`. Thân trả về LUÔN là
# `MissionUploadResult` (có `code`), mã HTTP chỉ để curl/trình duyệt phân loại.
_HTTP_STATUS = {
    "validation_failed": 422,
    "command_denied": 409,
    "not_connected": 503,
    "timeout": 504,
    "internal": 500,
}

_EVENTS_MAX = 200
# Trần số điểm một lần hỏi lịch sử: 2400 gói ≈ 1,5 MB JSON — đủ cho biểu đồ
# 1600 px, không làm trình duyệt đứng khi parse.
_HISTORY_MAX_POINTS = 4000

# Mốc backend khởi động (import module = lúc uvicorn nạp app).
STARTED_AT = time.time()


def build_router(hub) -> APIRouter:
    """Dựng router với hub được tiêm vào (hub giữ state, safety, mission, camera).

    Tiêm chứ không import biến toàn cục từ `app.py`: import thì
    `app -> api -> app` thành vòng, và test không thay được hub giả.
    """
    router = APIRouter(prefix="/api")

    @router.get("/health")
    async def health() -> dict:
        return {"status": "ok", "version": __version__}

    @router.get("/status", response_model=StatusPayload)
    async def status() -> StatusPayload:
        return hub.build_status()

    @router.get("/config", response_model=ConfigPayload)
    async def get_config() -> ConfigPayload:
        return ConfigPayload(
            limits=LimitsPayload(**config.safety_limits()),
            endpoint=config.MAVLINK_ENDPOINT,
            telemetry_hz=config.TELEMETRY_HZ,
            versions=VersionsPayload(backend=__version__, contract=CONTRACT_VERSION),
        )

    @router.get("/mission", response_model=MissionPayload)
    async def get_mission() -> MissionPayload:
        mission = hub.mission
        if mission is None:
            return MissionPayload(source="none", count=0)
        return MissionPayload(
            source=mission.source,  # type: ignore[arg-type]
            count=len(mission.current),
            uploaded_at=mission.uploaded_at,
            waypoints=[
                MissionWaypoint(seq=w.seq, lat=w.lat, lon=w.lon, alt=w.alt, command=w.command)
                for w in mission.current
            ],
        )

    @router.post("/mission", response_model=MissionUploadResult)
    async def post_mission(body: CmdMissionUpload):
        # DÙNG CHUNG đường với `cmd.mission.upload` trên WebSocket — không viết
        # lại logic. Mọi cổng (link, quyền lái, EKF/GPS, validate) ở một chỗ.
        result = await hub.upload_mission(body, socket_id=None)
        if result.ok:
            return result
        return JSONResponse(
            status_code=_HTTP_STATUS.get(result.code or "", 400),
            content=result.model_dump(),
        )

    @router.get("/events", response_model=EventsPayload)
    async def events(limit: int = Query(100, ge=1, le=_EVENTS_MAX)) -> EventsPayload:
        return EventsPayload(events=hub.bus.recent(limit=limit))

    @router.get("/telemetry/history", response_model=TelemetryHistoryPayload)
    async def telemetry_history(
        seconds: float = Query(600.0, gt=0, le=86_400),
        max_points: int = Query(2400, ge=10, le=_HISTORY_MAX_POINTS),
    ) -> TelemetryHistoryPayload:
        history = hub.history
        return TelemetryHistoryPayload(
            samples=history.samples(seconds=seconds, max_points=max_points),
            hz=history.hz,
            capacity_s=history.seconds,
        )

    @router.get("/system", response_model=SystemPayload)
    async def system() -> SystemPayload:
        now = time.time()
        return SystemPayload(
            backend_version=__version__,
            contract_version=CONTRACT_VERSION,
            python=platform.python_version(),
            platform=f"{platform.system()} {platform.release()} ({sys.platform})",
            pid=os.getpid(),
            started_at=STARTED_AT,
            uptime_s=now - STARTED_AT,
            endpoint=config.MAVLINK_ENDPOINT,
            telemetry_hz=config.TELEMETRY_HZ,
            ws_clients=hub.client_count,
            link_alive=hub.build_status().connected,
            vision_enabled=config.VISION_ENABLED,
            camera_fake=config.CAMERA_FAKE,
            camera_source=config.camera_source_url(),
            history_samples=len(hub.history),
            history_capacity_s=hub.history.seconds,
            events_buffered=len(hub.bus.recent(limit=_EVENTS_MAX)),
        )

    @router.get("/video/stream")
    async def video_stream() -> StreamingResponse:
        reader = hub.camera
        if reader is None:
            raise HTTPException(503, "Khối vision đang tắt (VISION_ENABLED=0)")
        reader.start()
        return StreamingResponse(mjpeg_multipart(reader), media_type=MJPEG_MEDIA_TYPE)

    @router.get("/video/fake-source")
    async def video_fake_source() -> StreamingResponse:
        """Nguồn GIẢ (§7.8.3). `stream.py` đọc endpoint này như đọc một ESP32."""
        if not config.CAMERA_FAKE:
            raise HTTPException(404, "Nguồn video giả đang tắt (CAMERA_FAKE=0)")
        # Import tại chỗ: thiếu OpenCV chỉ hỏng ĐÚNG endpoint này, không hỏng
        # cả backend bay (SAFETY.md mục 9).
        from backend.vision.fake_stream import FakeMjpegSource

        source = FakeMjpegSource()
        try:
            # Mở clip TRƯỚC khi trả 200: hỏng thì trả 503 có lời giải thích,
            # thay vì một luồng 200 đứt ngay byte đầu.
            first = await asyncio.to_thread(source.next_part)
        except RuntimeError as exc:
            source.close()
            raise HTTPException(503, str(exc)) from exc

        async def body():
            yield first
            async for part in source.parts():
                yield part

        return StreamingResponse(body(), media_type=MJPEG_MEDIA_TYPE)

    return router
