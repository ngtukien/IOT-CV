/**
 * Hàm thuần của lớp bản đồ — tách khỏi file component để Vite fast refresh
 * chạy đúng (file component chỉ nên export component).
 */
import type { LatLngTuple } from "leaflet";

import { toLatLon } from "@/lib/geo";
import { MAV_CMD } from "@/lib/missionRules";
import type { MissionWaypoint } from "@/lib/protocol";

/** Toạ độ vẽ được: hợp lệ và không phải (0, 0) — (0, 0) là "không mang toạ độ". */
export function drawablePoint(lat: number, lon: number): LatLngTuple | null {
  const p = toLatLon(lat, lon);
  return p && !(p[0] === 0 && p[1] === 0) ? [p[0], p[1]] : null;
}

/**
 * Đường bay dự kiến: cất cánh tại chỗ → các waypoint → (RTL) về chỗ cất cánh.
 * LAND tại (0, 0) = hạ ngay tại điểm cuối, nên không thêm đoạn nào.
 */
export function missionPath(items: readonly MissionWaypoint[]): LatLngTuple[] {
  const path: LatLngTuple[] = [];
  let start: LatLngTuple | null = null;
  for (const it of items) {
    const p = drawablePoint(it.lat, it.lon);
    switch (it.command ?? MAV_CMD.NAV_WAYPOINT) {
      case MAV_CMD.NAV_TAKEOFF:
        if (p) {
          start = p;
          path.push(p);
        }
        break;
      case MAV_CMD.NAV_RETURN_TO_LAUNCH:
        if (start) path.push(start);
        break;
      default:
        if (p) path.push(p);
    }
  }
  return path;
}

/** Nhãn bắt buộc của vòng giới hạn (SAFETY.md mục 8) — hai dòng. */
export function geofenceLabel(maxDistanceM: number): [string, string] {
  return [
    `Giới hạn phần mềm ${maxDistanceM.toFixed(0)} m — đây chỉ là lớp phụ.`,
    "Geofence thật nằm trên flight controller (FENCE_*, cấu hình ở Phase 19).",
  ];
}
