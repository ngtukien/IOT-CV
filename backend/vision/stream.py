"""Nhận stream JPEG/MJPEG từ ESP32-CAM — GIAI ĐOẠN 19, 69.

Version 1 bắt đầu ở JPEG 640x480, KHÔNG bắt đầu ở 1600x1200 livestream: OV2640
ở độ phân giải cao tốn RAM/băng thông và thường cần PSRAM.

TODO: đọc MJPEG từ `config.CAMERA_STREAM_URL`, trả về frame (numpy array) qua
generator, và không được raise ra ngoài khi camera mất — chỉ báo unavailable.
"""

from __future__ import annotations

from collections.abc import Iterator

from backend import config


class CameraStream:
    """Nguồn frame từ ESP32-CAM."""

    def __init__(self, url: str | None = None) -> None:
        self.url = url or config.CAMERA_STREAM_URL
        self.available = False

    def frames(self) -> Iterator:
        """Yield frame liên tục; tự đánh dấu `available=False` khi mất camera."""
        raise NotImplementedError("GIAI ĐOẠN 19: chưa implement camera stream")

    def close(self) -> None:
        self.available = False
