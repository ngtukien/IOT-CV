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


def _env_bool(key: str, default: bool) -> bool:
    """Đọc cờ bật/tắt. Không phân biệt hoa thường; giá trị lạ thì lấy mặc định.

    Cố ý KHÔNG coi mọi chuỗi khác rỗng là True: `VISION_ENABLED=off` phải tắt
    được vision, chứ không phải bật nó lên vì chuỗi "off" khác rỗng.
    """
    raw = os.environ.get(key)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in ("1", "true", "yes", "on"):
        return True
    if value in ("0", "false", "no", "off"):
        return False
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

# "Số nhà" của backend trên mạng MAVLink (Phase 05, việc 5.1.1).
# Mặc định của pymavlink là 255 — đúng quy ước GCS, nhưng Mission Planner CŨNG
# dùng 255. Chạy song song hai GCS mà trùng số thì COMMAND_ACK của flight
# controller không phân biệt được ai hỏi. Nhường 255 cho Mission Planner.
MAVLINK_SOURCE_SYSTEM = _env_int("MAVLINK_SOURCE_SYSTEM", 254)
MAVLINK_SOURCE_COMPONENT = _env_int("MAVLINK_SOURCE_COMPONENT", 190)  # MISSIONPLANNER

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
# Tốc độ xoay tối đa, ĐỘ/GIÂY. Có khoá riêng vì `MAX_VELOCITY` tính bằng m/s —
# dùng chung một hằng số cho hai đơn vị là kẹp yaw xuống 1 độ/giây, tức là
# xoay nửa vòng mất ba phút. Lỗi lẫn đơn vị kiểu này không báo gì cả.
MAX_YAW_RATE = _env_float("MAX_YAW_RATE", 45.0)
MANUAL_COMMAND_TIMEOUT_MS = _env_int("MANUAL_COMMAND_TIMEOUT_MS", 300)
# Vòng dead-man của Phase 06 quét mỗi chừng này ms. Phải NHỎ HƠN HẲN
# MANUAL_COMMAND_TIMEOUT_MS, nếu không timeout 300 ms sẽ thành 300+tick ms.
DEADMAN_TICK_MS = _env_int("DEADMAN_TICK_MS", 50)
# Một lần dead-man nổ thì gửi (0,0,0) bao nhiêu nhịp liên tiếp. MAVLink chạy
# trên UDP: một gói rơi là lệnh dừng biến mất không dấu vết. Lặp 5 nhịp ở 20 Hz
# = 250 ms, rẻ hơn nhiều so với cái giá của việc drone không dừng.
ZERO_VELOCITY_REPEAT = _env_int("ZERO_VELOCITY_REPEAT", 5)
# Chờ COMMAND_ACK của flight controller tối đa bao lâu (mode / arm / takeoff).
COMMAND_ACK_TIMEOUT_S = _env_float("COMMAND_ACK_TIMEOUT_S", 3.0)
# Sổ kiểm cho mọi lần gửi zero-velocity. Đây là HỢP ĐỒNG với Phase 10 §10.7:
# test Playwright đọc chính file này để đo độ trễ dead-man.
#
# Đường dẫn TƯƠNG ĐỐI được neo vào gốc repo, không vào CWD. Neo vào CWD thì
# chạy backend từ thư mục khác là bằng chứng an toàn rơi sang chỗ khác — im
# lặng, và chỉ phát hiện ra khi cần dựng lại một sự việc.
DEADMAN_LOG_PATH = str(
    (PROJECT_ROOT / _env_str("DEADMAN_LOG_PATH", "logs/deadman.jsonl")).resolve()
)

# Tránh vật cản (Phase 07). Khai báo ngay từ Phase 05 vì hợp đồng WebSocket
# nói UI đọc MỌI ngưỡng từ `limits` — Phase 08 dựng UI trước khi Phase 07 xong.
AVOID_MARGIN_M = _env_float("AVOID_MARGIN_M", 2.0)
AVOID_DIST_MAX_M = _env_float("AVOID_DIST_MAX_M", 5.0)
RANGEFINDER_MAX_M = _env_float("RANGEFINDER_MAX_M", 6.0)
# Số đo khoảng cách cũ hơn chừng này thì `avoid_state` = UNKNOWN (đang mù),
# KHÁC với OFF (trống trải). Không có khoá tương ứng trong param của FC.
PROXIMITY_STALE_S = _env_float("PROXIMITY_STALE_S", 2.0)

# Mission protocol (Phase 07 §7.3). Chờ mỗi MISSION_REQUEST tối đa bao lâu, và
# gửi lại MISSION_COUNT bao nhiêu lần trước khi bỏ cuộc.
MISSION_ITEM_TIMEOUT_S = _env_float("MISSION_ITEM_TIMEOUT_S", 2.0)
MISSION_RETRIES = _env_int("MISSION_RETRIES", 3)
# Readback: sai số cho phép khi so mission đọc lại với mission vừa gửi.
MISSION_READBACK_ALT_TOL_M = _env_float("MISSION_READBACK_ALT_TOL_M", 0.1)
# Pin dưới ngưỡng này thì phát cảnh báo (Phase 07 §7.7) — CHỈ cảnh báo, không
# tự RTL. Failsafe pin thật nằm trên FC.
BATTERY_WARN_PCT = _env_int("BATTERY_WARN_PCT", 25)

# ---------------------------------------------------------------------------
# Vision (GIAI ĐOẠN 19, 74, 75)
# ---------------------------------------------------------------------------
CAMERA_STREAM_URL = _env_str("CAMERA_STREAM_URL", "http://192.168.4.1:81/stream")
YOLO_WEIGHTS = _env_str("YOLO_WEIGHTS", "ml/weights/yolo11n.pt")
DETECTION_CONFIDENCE = _env_float("DETECTION_CONFIDENCE", 0.6)
DETECTION_MIN_FRAMES = _env_int("DETECTION_MIN_FRAMES", 3)
DETECTION_COOLDOWN_S = _env_float("DETECTION_COOLDOWN_S", 4.0)
# Ba khoá dưới là "việc trả về" cho AI Phase 1 §A1.9 và Phase 07 §7.6/§7.8.
YOLO_DEVICE = _env_str("YOLO_DEVICE", "0")  # "0" = GPU 0, "cpu" để ép CPU
DETECTION_IMGSZ = _env_int("DETECTION_IMGSZ", 640)
VISION_ENABLED = _env_bool("VISION_ENABLED", True)  # tắt hẳn vision khi test bay

# Nguồn video GIẢ (Phase 07 §7.8.3) — camera thật chỉ có từ Phase 17. Bật thì
# backend tự phục vụ một luồng MJPEG lặp video mẫu ở `/api/video/fake-source`
# và `stream.py` đọc từ ĐÓ, như đọc từ bất kỳ URL nào khác. Tắt (0) thì đọc
# `CAMERA_STREAM_URL` (ESP32-CAM thật).
CAMERA_FAKE = _env_bool("CAMERA_FAKE", True)
CAMERA_FAKE_CLIP = str(
    (PROJECT_ROOT / _env_str("CAMERA_FAKE_CLIP", "backend/vision/assets/sample-clip.mp4")).resolve()
)
CAMERA_FAKE_FPS = _env_float("CAMERA_FAKE_FPS", 15.0)
# Box giả gửi mỗi chừng này ms (§7.8.3: 300 ms).
FAKE_DETECTION_INTERVAL_MS = _env_int("FAKE_DETECTION_INTERVAL_MS", 300)
# Khung mới nhất cũ hơn chừng này thì camera coi như MẤT (`camera.available`).
CAMERA_STALE_S = _env_float("CAMERA_STALE_S", 2.0)


def camera_source_url() -> str:
    """URL mà `stream.py` đọc. `stream.py` không biết nguồn là giả hay thật —
    chỗ DUY NHẤT phân biệt là ở đây."""
    if CAMERA_FAKE:
        return f"http://127.0.0.1:{BACKEND_PORT}/api/video/fake-source"
    return CAMERA_STREAM_URL


# ---------------------------------------------------------------------------
# MQTT (GIAI ĐOẠN 76)
# ---------------------------------------------------------------------------
MQTT_BROKER = _env_str("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = _env_int("MQTT_PORT", 1883)
MQTT_CLIENT_ID = _env_str("MQTT_CLIENT_ID", "uav-gcs")


def safety_limits() -> dict[str, float | int]:
    """Giới hạn phần mềm, để frontend hiển thị và để mission validation dùng.

    Đây là `limits` trong hợp đồng WebSocket. UI đọc MỌI ngưỡng từ đây —
    Phase 08/09/10 không được hardcode con số nào.
    """
    return {
        "max_alt": MAX_ALT,
        "min_alt": MIN_ALT,
        "max_distance_home": MAX_DISTANCE_HOME,
        "max_waypoints": MAX_WAYPOINTS,
        "max_velocity": MAX_VELOCITY,
        "manual_command_timeout_ms": MANUAL_COMMAND_TIMEOUT_MS,
        "deadman_tick_ms": DEADMAN_TICK_MS,
        "avoid_margin_m": AVOID_MARGIN_M,
        "avoid_dist_max_m": AVOID_DIST_MAX_M,
        "rangefinder_max_m": RANGEFINDER_MAX_M,
        "proximity_stale_s": PROXIMITY_STALE_S,
    }
