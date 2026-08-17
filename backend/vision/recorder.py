"""Lưu snapshot và log detection — GIAI ĐOẠN 74, 87.

Mỗi flight có một thư mục riêng:

    logs/flight_<YYYYmmdd_HHMM>/
        flight.bin  telemetry.csv  detections.csv  events.json
        video/  snapshots/  notes.md

TODO: implement ghi snapshot JPEG kèm bounding box và append dòng vào
detections.csv với timestamp, confidence, uav_lat, uav_lon, uav_alt.
"""

from __future__ import annotations

from pathlib import Path

from backend.config import PROJECT_ROOT

LOG_ROOT = PROJECT_ROOT / "logs"


def flight_dir(name: str) -> Path:
    """Đường dẫn thư mục log của một flight (chưa tạo trên disk)."""
    return LOG_ROOT / name


class DetectionRecorder:
    def __init__(self, flight_name: str) -> None:
        self.dir = flight_dir(flight_name)

    def save_snapshot(self, frame, detections) -> Path:
        raise NotImplementedError("GIAI ĐOẠN 74: chưa implement save_snapshot")

    def append_csv(self, row: dict) -> None:
        raise NotImplementedError("GIAI ĐOẠN 74: chưa implement append_csv")
