"""Địa chỉ camera ESP32-S3 dùng chung cho các script trong scripts/esp32/ (một chỗ duy nhất).

Đổi tên máy hay cổng thì sửa ở đây, khớp với firmware/camera/include/secrets.example.h.
"""

from __future__ import annotations

CAMERA_HOST = "iotcv-camera.mshome.net"  # WIFI_HOSTNAME của firmware + đuôi mạng hotspot Windows
CONTROL_PORT = 80  # HTTP_PORT: /status, /set, /update


def camera_url(port: int, path: str = "") -> str:
    # HTTP, không HTTPS: firmware ESP32 không có TLS (mã hoá từng khung MJPEG trên chip làm sụp
    # fps), và camera chỉ nằm trong mạng Mobile Hotspot riêng của laptop. Đây là chỗ DUY NHẤT dựng
    # URL camera trong các script.
    return (
        f"http://{CAMERA_HOST}:{port:d}{path}"  # NOSONAR - camera không có TLS, xem chú thích trên
    )
