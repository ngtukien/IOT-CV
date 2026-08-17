"""Cấu hình tập trung của backend.

Mọi giá trị đều override được qua biến môi trường hoặc file `.env`
(xem `.env.example`). Không hardcode endpoint hoặc giới hạn an toàn ở nơi khác —
GIAI ĐOẠN 59 đổi từ SITL sang drone thật chỉ bằng cách đổi `MAVLINK_ENDPOINT`.
"""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path | None = None) -> None:
    """Nạp `.env` vào os.environ, không cần thêm dependency.

    Biến môi trường có sẵn trong shell luôn thắng giá trị trong file.
    """
    env_path = path or PROJECT_ROOT / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_dotenv()


def _env_str(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ[key])
    except (KeyError, ValueError):
        return default


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ[key])
    except (KeyError, ValueError):
        return default


# ---------------------------------------------------------------------------
# MAVLink (GIAI ĐOẠN 5)
# ---------------------------------------------------------------------------
# SITL:               udp:127.0.0.1:14550
# ESP32 bridge:       udp:0.0.0.0:14550
# USB trực tiếp:      /dev/ttyACM0
MAVLINK_ENDPOINT = _env_str("MAVLINK_ENDPOINT", "udp:127.0.0.1:14550")
MAVLINK_BAUD = _env_int("MAVLINK_BAUD", 115200)
HEARTBEAT_TIMEOUT_S = _env_float("HEARTBEAT_TIMEOUT_S", 10.0)
# Không nhận heartbeat trong khoảng này thì coi như mất link.
LINK_TIMEOUT_S = _env_float("LINK_TIMEOUT_S", 3.0)

# ---------------------------------------------------------------------------
# Web backend (GIAI ĐOẠN 7)
# ---------------------------------------------------------------------------
BACKEND_HOST = _env_str("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = _env_int("BACKEND_PORT", 8000)
# 5-10 Hz là đủ cho UI. Không cần 50 Hz.
TELEMETRY_HZ = _env_float("TELEMETRY_HZ", 8.0)

# ---------------------------------------------------------------------------
# Giới hạn an toàn PHẦN MỀM (GIAI ĐOẠN 14)
# Đây là giới hạn của project, không phải giới hạn kỹ thuật của ArduPilot.
# Lớp authoritative vẫn là geofence trên flight controller (GIAI ĐOẠN 83).
# ---------------------------------------------------------------------------
MAX_ALT = _env_float("MAX_ALT", 10.0)
MIN_ALT = _env_float("MIN_ALT", 2.0)
MAX_DISTANCE_HOME = _env_float("MAX_DISTANCE_HOME", 50.0)
MAX_WAYPOINTS = _env_int("MAX_WAYPOINTS", 10)

# Manual control qua web (GIAI ĐOẠN 10, 11, 64)
MAX_VELOCITY = _env_float("MAX_VELOCITY", 1.0)
MANUAL_COMMAND_TIMEOUT_MS = _env_int("MANUAL_COMMAND_TIMEOUT_MS", 300)

# ---------------------------------------------------------------------------
# Vision (GIAI ĐOẠN 19, 74, 75)
# ---------------------------------------------------------------------------
CAMERA_STREAM_URL = _env_str("CAMERA_STREAM_URL", "http://192.168.4.1:81/stream")
YOLO_WEIGHTS = _env_str("YOLO_WEIGHTS", "ml/weights/yolo11n.pt")
DETECTION_CONFIDENCE = _env_float("DETECTION_CONFIDENCE", 0.6)
DETECTION_MIN_FRAMES = _env_int("DETECTION_MIN_FRAMES", 3)
DETECTION_COOLDOWN_S = _env_float("DETECTION_COOLDOWN_S", 4.0)

# ---------------------------------------------------------------------------
# MQTT (GIAI ĐOẠN 76)
# ---------------------------------------------------------------------------
MQTT_BROKER = _env_str("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = _env_int("MQTT_PORT", 1883)
MQTT_CLIENT_ID = _env_str("MQTT_CLIENT_ID", "uav-gcs")


def safety_limits() -> dict[str, float | int]:
    """Giới hạn phần mềm, để frontend hiển thị và để mission validation dùng."""
    return {
        "max_alt": MAX_ALT,
        "min_alt": MIN_ALT,
        "max_distance_home": MAX_DISTANCE_HOME,
        "max_waypoints": MAX_WAYPOINTS,
        "max_velocity": MAX_VELOCITY,
        "manual_command_timeout_ms": MANUAL_COMMAND_TIMEOUT_MS,
    }
