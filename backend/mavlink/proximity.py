"""Khoảng cách vật cản và trạng thái AVOID — Phase 07 §7.6.

Toàn bộ module là HÀM THUẦN: nhận gói MAVLink / số đo, trả con số. Không I/O,
không thread — test không cần drone.

┌─ ĐÃ ĐO TRÊN SITL, KHÔNG ĐOÁN (25/09/2026, `scripts/sitl/run_proximity_probe.py`) ─┐
│ ArduCopter 4.7.1 + đúng file param dự án (TFmini Plus SERIAL3, PRX1_TYPE 4):     │
│                                                                                  │
│ 1. `DISTANCE_SENSOR` tới từ ĐÚNG MỘT nguồn: id=10, orientation=0,                │
│    min_distance=10 cm, max_distance=600 cm. Không có gói nào cho 7 cung còn lại. │
│ 2. `OBSTACLE_DISTANCE` (330): KHÔNG có gói nào. Nhánh xử lý nó vẫn giữ — đó là   │
│    đường của cảm biến 360° nếu một ngày dự án gắn thêm — nhưng đừng chờ nó.      │
│ 3. `SYS_STATUS`: bit LASER_POSITION (0x100) KHÔNG có trong `..._present`. Bit    │
│    CÓ mặt và khoẻ là PROXIMITY (0x4000000). Lấy sức khoẻ từ bit "rangefinder"    │
│    hiển nhiên thì `rangefinder_healthy` luôn False -> `avoid_state` luôn         │
│    UNKNOWN. Đúng kiểu bẫy `ekf_ok` ở Phase 05.                                   │
│ 4. `STATUSTEXT`: 0 dòng suốt chặng LOITER bị AVOID phanh lẫn chặng GUIDED.       │
│    AC_Avoid phanh IM LẶNG — nên `avoid_state` chỉ suy từ khoảng cách + mode,      │
│    và `AVOID_STATUSTEXT_PATTERNS` để rỗng (§7.6.3: không đoán chuỗi).            │
└──────────────────────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

import re

from backend import config

# MAV_SENSOR_ROTATION: 0 = nhìn thẳng trước, 1..7 = YAW_45..YAW_315 (theo chiều
# kim đồng hồ nhìn từ trên xuống). Tám giá trị đầu khớp đúng tám cung 45° của
# `obstacle_sectors`, index 0 = mũi.
ROTATION_FORWARD = 0
SECTOR_COUNT = 8

# OBSTACLE_DISTANCE: 65535 = cung đó không có dữ liệu.
UINT16_MAX = 65535

# Bit trong SYS_STATUS.onboard_control_sensors_*. Xem khối ĐÃ ĐO ở đầu file.
SENSOR_LASER_POSITION = 0x100
SENSOR_PROXIMITY = 0x4000000
_RANGE_BITS = (SENSOR_LASER_POSITION, SENSOR_PROXIMITY)

# Chỉ ở ba mode này AC_Avoid (AVOID_ENABLE=3) mới chạy. Ở AUTO/GUIDED/RTL, tránh
# vật cản là việc của Object Avoidance Path Planner — mà OA_TYPE=0 (TẮT, có chủ
# ý: một tia 3.6° nhìn thẳng sẽ khiến BendyRuler lách sang hướng chưa có dữ liệu).
AVOID_ACTIVE_MODES = frozenset({"LOITER", "ALT_HOLD", "POSHOLD"})

# Chuỗi STATUSTEXT báo AVOID kích hoạt. RỖNG có chủ ý — đo thật không thấy dòng
# nào (khối ĐÃ ĐO, điểm 4). Chỉ thêm mẫu khi có log thật chứng minh.
AVOID_STATUSTEXT_PATTERNS: tuple[re.Pattern[str], ...] = ()


def distance_sensor_m(msg) -> float | None:
    """`DISTANCE_SENSOR.current_distance` ra mét, hoặc None khi KHÔNG ĐỌC ĐƯỢC.

    Giá trị >= max_distance hoặc <= min_distance nghĩa là cảm biến không đo được
    — KHÔNG phải "rất xa" / "rất gần". Trả 0.0 thay vì None làm UI hiện "0.0 m"
    khi thật ra đang mù, nguy hiểm hơn hiện "không biết".
    """
    cur = getattr(msg, "current_distance", None)
    if cur is None:
        return None
    lo = getattr(msg, "min_distance", 0) or 0
    hi = getattr(msg, "max_distance", 0) or 0
    if cur <= lo or (hi and cur >= hi):
        return None
    return cur / 100.0


def distance_sensor_is_clear(msg) -> bool:
    """True khi số đo nằm ở/đầu TRÊN tầm (>= max_distance): trong tầm đo không
    có gì — đó là "trống trải", một câu trả lời. Còn <= min_distance là quá sát
    hoặc lỗi — không phải câu trả lời. `distance_sensor_m` trả None cho CẢ HAI;
    hàm này tách chúng ra cho `avoid_state`.
    """
    cur = getattr(msg, "current_distance", None)
    hi = getattr(msg, "max_distance", 0) or 0
    return cur is not None and bool(hi) and cur >= hi


def aggregate_obstacle_sectors(msg) -> list[float | None]:
    """Gộp 72 cung của OBSTACLE_DISTANCE xuống 8 cung 45°, lấy MIN mỗi nhóm (m).

    Cung vô hiệu (65535, hoặc ngoài [min, max]) bị bỏ qua; nhóm toàn vô hiệu thì
    None. Index 0 = mũi, tăng theo chiều kim đồng hồ.
    """
    distances = list(getattr(msg, "distances", ()) or ())
    increment = float(getattr(msg, "increment_f", 0.0) or getattr(msg, "increment", 0) or 0)
    if not distances or increment <= 0:
        return [None] * SECTOR_COUNT
    offset = float(getattr(msg, "angle_offset", 0.0) or 0.0)
    lo = getattr(msg, "min_distance", 0) or 0
    hi = getattr(msg, "max_distance", 0) or UINT16_MAX

    sectors: list[float | None] = [None] * SECTOR_COUNT
    for i, d in enumerate(distances):
        if d == UINT16_MAX or d < lo or d > hi:
            continue
        angle = (offset + i * increment) % 360.0
        # Cung 0 phủ [-22.5°, 22.5°): làm tròn về tâm gần nhất.
        idx = int(((angle + 22.5) % 360.0) // 45.0)
        metres = d / 100.0
        cur = sectors[idx]
        sectors[idx] = metres if cur is None else min(cur, metres)
    return sectors


def rangefinder_healthy_from_sys_status(msg) -> bool:
    """Cảm biến khoảng cách khoẻ theo SYS_STATUS.

    Xét mọi bit trong `_RANGE_BITS` mà FC báo là CÓ MẶT và BẬT; tất cả phải khoẻ.
    Không bit nào có mặt thì False — FC không hề khai có cảm biến khoảng cách.
    """
    present = int(getattr(msg, "onboard_control_sensors_present", 0))
    enabled = int(getattr(msg, "onboard_control_sensors_enabled", 0))
    health = int(getattr(msg, "onboard_control_sensors_health", 0))
    relevant = [b for b in _RANGE_BITS if present & b and enabled & b]
    if not relevant:
        return False
    return all(health & b for b in relevant)


def avoid_state(
    distance_m: float | None,
    mode: str,
    *,
    healthy: bool,
    age_s: float | None,
    clear: bool = False,
    margin_m: float | None = None,
    dist_max_m: float | None = None,
    stale_s: float | None = None,
) -> str:
    """Bốn trạng thái của §7.6.4. Ngưỡng đọc từ config (khớp file param của FC).

    - UNKNOWN : cảm biến không khoẻ, chưa từng có số đo, hoặc số đo đã cũ —
                đang MÙ, khác hẳn "không có vật cản".
    - OFF     : có số đo hợp lệ và xa hơn AVOID_DIST_MAX — trống trải; hoặc
                `clear` = số đo ở đầu trên tầm (FC báo "không thấy gì trong 6 m").
    - NEAR    : trong vùng FC bắt đầu để ý, HOẶC đã trong margin nhưng ở mode mà
                AC_Avoid không chạy (AUTO/GUIDED/RTL...).
    - ACTIVE  : trong margin VÀ mode ∈ {LOITER, ALT_HOLD, POSHOLD} — FC đang phanh.

    ACTIVE không bao giờ xuất hiện ở GUIDED/AUTO. Đó là SỰ THẬT của hệ thống
    (OA_TYPE=0), và UI phải nói rõ "chế độ này CHƯA tránh vật cản".
    """
    margin = config.AVOID_MARGIN_M if margin_m is None else margin_m
    dist_max = config.AVOID_DIST_MAX_M if dist_max_m is None else dist_max_m
    stale = config.PROXIMITY_STALE_S if stale_s is None else stale_s

    if not healthy or age_s is None or age_s > stale:
        return "UNKNOWN"
    if distance_m is None:
        # None mà không `clear` = quá sát hoặc số rác: mù, không phải trống.
        return "OFF" if clear else "UNKNOWN"
    if distance_m > dist_max:
        return "OFF"
    if distance_m <= margin and mode in AVOID_ACTIVE_MODES:
        return "ACTIVE"
    return "NEAR"


def is_avoid_statustext(text: str) -> bool:
    """STATUSTEXT này có phải báo AVOID không. Luôn False khi bảng mẫu rỗng."""
    return any(p.search(text) for p in AVOID_STATUSTEXT_PATTERNS)
