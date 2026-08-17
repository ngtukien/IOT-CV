"""Person detection bằng YOLO — GIAI ĐOẠN 16, 74.

Chỉ giữ class `person` (COCO class 0). Model deployment cuối cùng là Model E
(VisDrone + ground ESP32 dataset + airborne ESP32 dataset, GIAI ĐOẠN 73).

TODO: nạp weights từ `config.YOLO_WEIGHTS`, predict với `classes=[0]`, trả về
list bounding box + confidence. Import ultralytics BÊN TRONG hàm để backend
flight vẫn chạy được khi chưa cài ML stack.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend import config

PERSON_CLASS_ID = 0


@dataclass(frozen=True)
class Detection:
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


class PersonDetector:
    def __init__(self, weights: str | None = None, confidence: float | None = None) -> None:
        self.weights = weights or config.YOLO_WEIGHTS
        self.confidence = config.DETECTION_CONFIDENCE if confidence is None else confidence
        self.model = None

    def load(self) -> None:
        raise NotImplementedError("GIAI ĐOẠN 16: chưa implement load model")

    def detect(self, frame) -> list[Detection]:
        raise NotImplementedError("GIAI ĐOẠN 16: chưa implement detect")
