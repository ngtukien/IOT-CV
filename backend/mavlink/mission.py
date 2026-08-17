"""Mission waypoint: validate (GIAI ĐOẠN 14) và upload (GIAI ĐOẠN 15).

`validate_mission()` là logic thuần, test được không cần drone — và phải chạy
TRƯỚC mọi lần upload. Backend không bao giờ đẩy mission chưa validate xuống
flight controller.

Phần upload theo MAVLink Mission Protocol:

    GCS -> MISSION_COUNT
    FC  -> MISSION_REQUEST_INT seq=0
    GCS -> MISSION_ITEM_INT 0
    ...
    FC  -> MISSION_ACK

Mission mới chỉ được thay mission cũ sau khi upload đầy đủ và được ACK.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from backend import config

EARTH_RADIUS_M = 6_371_000.0


@dataclass(frozen=True)
class Waypoint:
    seq: int
    lat: float
    lon: float
    alt: float


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Khoảng cách mặt đất giữa hai toạ độ, mét."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _is_valid_coordinate(lat: float, lon: float) -> bool:
    if any(math.isnan(v) or math.isinf(v) for v in (lat, lon)):
        return False
    if not -90.0 <= lat <= 90.0 or not -180.0 <= lon <= 180.0:
        return False
    # (0, 0) gần như luôn là lỗi dữ liệu chứ không phải waypoint thật.
    return not (lat == 0.0 and lon == 0.0)


def validate_mission(
    waypoints: list[Waypoint],
    home: tuple[float, float] | None = None,
    *,
    max_alt: float | None = None,
    min_alt: float | None = None,
    max_distance_home: float | None = None,
    max_waypoints: int | None = None,
) -> list[str]:
    """Trả về danh sách lỗi. List rỗng nghĩa là mission được phép upload.

    Sáu luật reject của GIAI ĐOẠN 14: 0 waypoint, altitude quá thấp, altitude
    vượt giới hạn demo, waypoint quá xa home, toạ độ invalid, quá số waypoint
    cho phép.
    """
    limit_max_alt = config.MAX_ALT if max_alt is None else max_alt
    limit_min_alt = config.MIN_ALT if min_alt is None else min_alt
    limit_distance = config.MAX_DISTANCE_HOME if max_distance_home is None else max_distance_home
    limit_count = config.MAX_WAYPOINTS if max_waypoints is None else max_waypoints

    errors: list[str] = []

    if not waypoints:
        errors.append("Mission không có waypoint nào")
        return errors

    if len(waypoints) > limit_count:
        errors.append(f"Mission có {len(waypoints)} waypoint, vượt giới hạn {limit_count}")

    for wp in waypoints:
        if not _is_valid_coordinate(wp.lat, wp.lon):
            errors.append(f"WP{wp.seq}: toạ độ không hợp lệ ({wp.lat}, {wp.lon})")
            continue

        if math.isnan(wp.alt) or wp.alt < limit_min_alt:
            errors.append(f"WP{wp.seq}: altitude {wp.alt} m thấp hơn giới hạn {limit_min_alt} m")
        elif wp.alt > limit_max_alt:
            errors.append(f"WP{wp.seq}: altitude {wp.alt} m vượt giới hạn {limit_max_alt} m")

        if home is not None:
            distance = haversine_m(home[0], home[1], wp.lat, wp.lon)
            if distance > limit_distance:
                errors.append(
                    f"WP{wp.seq}: cách home {distance:.0f} m, vượt giới hạn {limit_distance:.0f} m"
                )

    return errors


class MissionManager:
    """Upload/download/clear/start mission qua MAVLink Mission Protocol.

    TODO GIAI ĐOẠN 15: implement state machine MISSION_COUNT ->
    MISSION_REQUEST_INT -> MISSION_ITEM_INT -> MISSION_ACK. Nghiệm thu bằng cách
    dùng Mission Planner làm oracle: web upload 4 điểm thì Mission Planner
    download đúng 4 điểm (GIAI ĐOẠN 62).
    """

    def __init__(self, connection=None) -> None:
        self.connection = connection
        self.current: list[Waypoint] = []
        self.progress: tuple[int, int] = (0, 0)

    def upload(self, waypoints: list[Waypoint], home: tuple[float, float] | None = None) -> None:
        errors = validate_mission(waypoints, home)
        if errors:
            raise ValueError("; ".join(errors))
        raise NotImplementedError("GIAI ĐOẠN 15: chưa implement mission upload")

    def download(self) -> list[Waypoint]:
        raise NotImplementedError("GIAI ĐOẠN 15: chưa implement mission download")

    def clear(self) -> None:
        raise NotImplementedError("GIAI ĐOẠN 15: chưa implement mission clear")

    def start(self) -> None:
        """Chuyển sang AUTO để chạy mission đã upload."""
        raise NotImplementedError("GIAI ĐOẠN 15: chưa implement mission start")
