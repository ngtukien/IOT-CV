"""Sinh detection event, chống spam — GIAI ĐOẠN 74, 75.

YOLO chạy 10 FPS có thể tạo hàng trăm event cho cùng một người. Luật:

    confidence > DETECTION_CONFIDENCE
    -> detected >= DETECTION_MIN_FRAMES frame liên tiếp
    -> tạo event
    -> cooldown DETECTION_COOLDOWN_S giây

Ghi rất rõ trong báo cáo: GPS tại thời điểm phát hiện là TOẠ ĐỘ UAV, KHÔNG PHẢI
toạ độ chính xác của người (cần camera calibration + attitude + độ cao + phép
chiếu tia — để Version 2).
"""

from __future__ import annotations

from dataclasses import dataclass

from backend import config


@dataclass
class DetectionEvent:
    event: str
    confidence: float
    timestamp: str
    uav_lat: float | None
    uav_lon: float | None
    uav_alt: float | None
    snapshot: str | None


class EventThrottle:
    """Đếm frame liên tiếp và giữ cooldown giữa hai event.

    TODO GIAI ĐOẠN 75: implement `should_emit(confidence, now)` — đây là logic
    thuần, nên viết kèm unit test trong backend/tests/.
    """

    def __init__(
        self,
        min_frames: int | None = None,
        cooldown_s: float | None = None,
        confidence_threshold: float | None = None,
    ) -> None:
        self.min_frames = config.DETECTION_MIN_FRAMES if min_frames is None else min_frames
        self.cooldown_s = config.DETECTION_COOLDOWN_S if cooldown_s is None else cooldown_s
        self.confidence_threshold = (
            config.DETECTION_CONFIDENCE if confidence_threshold is None else confidence_threshold
        )
        self.consecutive_frames = 0
        self.last_event_time: float | None = None

    def should_emit(self, confidence: float, now: float) -> bool:
        raise NotImplementedError("GIAI ĐOẠN 75: chưa implement chống spam detection")
