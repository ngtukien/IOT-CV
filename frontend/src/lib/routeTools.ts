/**
 * Công cụ lộ trình — THUẦN (không React, không socket), để test được.
 *
 *  - `routeStats`   : chặng, tổng quãng đường, xa home nhất, ước lượng thời gian
 *  - `routeProfile` : hồ sơ độ cao theo quãng đường (cho biểu đồ)
 *  - mẫu tự sinh    : vòng quanh điểm, quét lưới (lawnmower), đa giác, đi–về
 *  - `.waypoints`   : xuất / nhập định dạng "QGC WPL 110" mà Mission Planner đọc
 *
 * Mẫu tự sinh CHỈ sinh bản nháp. Chúng không biết giới hạn an toàn — luật
 * `missionRules.ts` (soi gương backend) báo lỗi nếu mẫu vượt `max_distance_home`
 * hay `max_waypoints`, KHÔNG cắt bớt im lặng. Người soạn thấy lỗi rồi tự chỉnh.
 */
import { EARTH_RADIUS_M, haversineM } from "./geo";
import type { LatLon } from "./geo";
import { MAV_CMD } from "./missionRules";
import type { MissionWaypoint } from "./protocol";

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Dời một toạ độ `north`/`east` mét (mặt phẳng tiếp tuyến — sai số không đáng kể dưới vài km). */
export function offsetLatLon(lat: number, lon: number, north: number, east: number): { lat: number; lon: number } {
  const dLat = north / EARTH_RADIUS_M;
  const dLon = east / (EARTH_RADIUS_M * Math.cos(toRad(lat)));
  return { lat: lat + toDeg(dLat), lon: lon + toDeg(dLon) };
}

/** Phương vị từ a tới b, độ, 0 = Bắc, theo chiều kim đồng hồ. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat));
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Thống kê
// ---------------------------------------------------------------------------

export interface RouteLeg {
  from: string;
  to: string;
  distance: number;
  bearing: number;
  /** Đổi độ cao trên chặng, m (dương = leo). */
  climb: number;
}

export interface RouteStats {
  legs: RouteLeg[];
  totalDistance: number;
  maxDistanceFromHome: number | null;
  maxAlt: number | null;
  waypointCount: number;
}

/** Điểm bay thật của mission, theo thứ tự bay: home(cất cánh) → WP… → (home nếu RTL). */
export interface RoutePoint {
  label: string;
  lat: number;
  lon: number;
  alt: number;
}

export function flightPoints(items: readonly MissionWaypoint[], home: LatLon | null): RoutePoint[] {
  const pts: RoutePoint[] = [];
  for (const it of items) {
    const cmd = it.command ?? MAV_CMD.NAV_WAYPOINT;
    if (cmd === MAV_CMD.NAV_TAKEOFF) {
      if (home) pts.push({ label: "Cất cánh", lat: home[0], lon: home[1], alt: it.alt });
    } else if (cmd === MAV_CMD.NAV_WAYPOINT) {
      pts.push({ label: `WP${it.seq}`, lat: it.lat, lon: it.lon, alt: it.alt });
    } else if (cmd === MAV_CMD.NAV_RETURN_TO_LAUNCH) {
      // RTL: bay về home ở độ cao hiện tại rồi hạ — vẽ chặng về, hạ xuống 0.
      const last = pts.at(-1);
      if (home && last) pts.push({ label: "Về nhà", lat: home[0], lon: home[1], alt: last.alt }, { label: "Hạ cánh", lat: home[0], lon: home[1], alt: 0 });
    } else if (cmd === MAV_CMD.NAV_LAND) {
      const last = pts.at(-1);
      if (last) pts.push({ label: "Hạ cánh", lat: last.lat, lon: last.lon, alt: 0 });
    }
  }
  if (home && pts.length > 0 && pts[0].label === "Cất cánh") pts.unshift({ label: "Mặt đất", lat: home[0], lon: home[1], alt: 0 });
  return pts;
}

export function routeStats(items: readonly MissionWaypoint[], home: LatLon | null): RouteStats {
  const pts = flightPoints(items, home);
  const legs: RouteLeg[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const horizontal = haversineM(a.lat, a.lon, b.lat, b.lon);
    const d = Math.hypot(horizontal, b.alt - a.alt);
    total += d;
    legs.push({ from: a.label, to: b.label, distance: d, bearing: horizontal > 0.01 ? bearingDeg(a.lat, a.lon, b.lat, b.lon) : 0, climb: b.alt - a.alt });
  }
  const wps = items.filter((it) => (it.command ?? MAV_CMD.NAV_WAYPOINT) === MAV_CMD.NAV_WAYPOINT);
  const far = home && wps.length > 0 ? Math.max(...wps.map((w) => haversineM(home[0], home[1], w.lat, w.lon))) : null;
  const alts = items
    .filter((it) => it.command !== MAV_CMD.NAV_RETURN_TO_LAUNCH && it.command !== MAV_CMD.NAV_LAND)
    .map((it) => it.alt)
    .filter((a) => Number.isFinite(a));
  return {
    legs,
    totalDistance: total,
    maxDistanceFromHome: far,
    maxAlt: alts.length ? Math.max(...alts) : null,
    waypointCount: wps.length,
  };
}

/** Thời gian bay ước lượng (s) ở `speed` m/s, cộng thời gian lên/xuống ở `vSpeed`. Chỉ là ƯỚC LƯỢNG. */
export function estimateDuration(stats: RouteStats, speed: number, vSpeed = 1): number | null {
  if (!(speed > 0) || stats.legs.length === 0) return null;
  let t = 0;
  for (const leg of stats.legs) {
    const horizontal = Math.sqrt(Math.max(0, leg.distance ** 2 - leg.climb ** 2));
    t += Math.max(horizontal / speed, Math.abs(leg.climb) / vSpeed);
  }
  return t;
}

export interface ProfilePoint {
  distance: number;
  alt: number;
  label: string;
}

/** Hồ sơ độ cao: quãng đường NGANG cộng dồn → độ cao, theo thứ tự bay. */
export function routeProfile(items: readonly MissionWaypoint[], home: LatLon | null): ProfilePoint[] {
  const pts = flightPoints(items, home);
  let d = 0;
  return pts.map((p, i) => {
    if (i > 0) d += haversineM(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon);
    return { distance: d, alt: Number.isFinite(p.alt) ? p.alt : 0, label: p.label };
  });
}

// ---------------------------------------------------------------------------
// Mẫu lộ trình tự sinh
// ---------------------------------------------------------------------------

export interface GeneratedPoint {
  lat: number;
  lon: number;
  alt: number;
}

/** `count` điểm cách đều trên vòng tròn bán kính `radius` m quanh `center`, theo chiều kim đồng hồ. */
export function orbitPattern(center: LatLon, radius: number, count: number, alt: number, startBearing = 0): GeneratedPoint[] {
  const n = Math.max(3, Math.round(count));
  return Array.from({ length: n }, (_, i) => {
    const b = toRad(startBearing + (360 / n) * i);
    const p = offsetLatLon(center[0], center[1], radius * Math.cos(b), radius * Math.sin(b));
    return { ...p, alt };
  });
}

/** Đa giác đều `sides` cạnh — hình vuông (4), lục giác (6)… */
export function polygonPattern(center: LatLon, radius: number, sides: number, alt: number, rotation = 45): GeneratedPoint[] {
  return orbitPattern(center, radius, sides, alt, rotation);
}

/**
 * Quét lưới kiểu "máy cắt cỏ" trong hình chữ nhật `width`×`height` m tâm `center`,
 * các đường quét cách nhau `spacing` m, xoay `angle` độ. Dùng để chụp phủ một vùng.
 */
export function lawnmowerPattern(center: LatLon, width: number, height: number, spacing: number, alt: number, angle = 0): GeneratedPoint[] {
  const lanes = Math.max(1, Math.floor(width / Math.max(spacing, 0.5)) + 1);
  const a = toRad(angle);
  const pts: GeneratedPoint[] = [];
  for (let i = 0; i < lanes; i += 1) {
    const x = -width / 2 + (lanes === 1 ? width / 2 : (width * i) / (lanes - 1));
    const ys = i % 2 === 0 ? [-height / 2, height / 2] : [height / 2, -height / 2];
    for (const y of ys) {
      // (x = đông, y = bắc) trong khung của lưới, rồi xoay theo `angle`.
      const east = x * Math.cos(a) + y * Math.sin(a);
      const north = -x * Math.sin(a) + y * Math.cos(a);
      pts.push({ ...offsetLatLon(center[0], center[1], north, east), alt });
    }
  }
  return pts;
}

/** Đi thẳng `distance` m theo `bearing` rồi quay về: hai điểm. */
export function outAndBackPattern(center: LatLon, distance: number, bearing: number, alt: number): GeneratedPoint[] {
  const b = toRad(bearing);
  const far = offsetLatLon(center[0], center[1], distance * Math.cos(b), distance * Math.sin(b));
  const mid = offsetLatLon(center[0], center[1], (distance / 2) * Math.cos(b), (distance / 2) * Math.sin(b));
  return [
    { ...mid, alt },
    { ...far, alt },
  ];
}

// ---------------------------------------------------------------------------
// File Mission Planner (.waypoints — "QGC WPL 110")
// ---------------------------------------------------------------------------

/** MAV_FRAME_GLOBAL (0) cho home, MAV_FRAME_GLOBAL_RELATIVE_ALT (3) cho item. */
const FRAME_GLOBAL = 0;
const FRAME_RELATIVE = 3;

/**
 * Xuất mission sang văn bản `.waypoints`. Dòng 0 là home (Mission Planner bắt
 * buộc có), độ cao tương đối với home — cùng quy ước với backend.
 */
export function toWaypointsFile(items: readonly MissionWaypoint[], home: LatLon | null): string {
  const f = (v: number, d = 8) => v.toFixed(d);
  const lines = ["QGC WPL 110"];
  lines.push(["0", "1", FRAME_GLOBAL, MAV_CMD.NAV_WAYPOINT, 0, 0, 0, 0, f(home?.[0] ?? 0), f(home?.[1] ?? 0), f(0, 6), 1].join("\t"));
  items.forEach((it, i) => {
    lines.push([i + 1, 0, FRAME_RELATIVE, it.command ?? MAV_CMD.NAV_WAYPOINT, 0, 0, 0, 0, f(it.lat), f(it.lon), f(it.alt, 6), 1].join("\t"));
  });
  return `${lines.join("\n")}\n`;
}

export interface ParsedWaypointsFile {
  home: { lat: number; lon: number } | null;
  takeoffAlt: number | null;
  waypoints: GeneratedPoint[];
  finalCommand: typeof MAV_CMD.NAV_RETURN_TO_LAUNCH | typeof MAV_CMD.NAV_LAND | null;
  /** Lệnh bị bỏ qua vì web không soạn được (DO_*, CONDITION_*…). */
  skipped: number[];
}

/** Đọc `.waypoints`. Ném lỗi có nói rõ dòng nào sai — không đoán. */
export function parseWaypointsFile(text: string): ParsedWaypointsFile {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!rows[0]?.startsWith("QGC WPL")) throw new Error("Không phải file .waypoints (thiếu dòng đầu 'QGC WPL 110')");
  const out: ParsedWaypointsFile = { home: null, takeoffAlt: null, waypoints: [], finalCommand: null, skipped: [] };
  rows.slice(1).forEach((row, i) => {
    const c = row.split(/\s+/);
    if (c.length < 12) throw new Error(`Dòng ${i + 2}: cần 12 cột, có ${c.length}`);
    const cmd = Number(c[3]);
    const lat = Number(c[8]);
    const lon = Number(c[9]);
    const alt = Number(c[10]);
    if (![cmd, lat, lon, alt].every(Number.isFinite)) throw new Error(`Dòng ${i + 2}: có ô không phải số`);
    if (i === 0) {
      out.home = { lat, lon };
      return;
    }
    if (cmd === MAV_CMD.NAV_TAKEOFF) out.takeoffAlt = alt;
    else if (cmd === MAV_CMD.NAV_WAYPOINT) out.waypoints.push({ lat, lon, alt });
    else if (cmd === MAV_CMD.NAV_RETURN_TO_LAUNCH || cmd === MAV_CMD.NAV_LAND) out.finalCommand = cmd;
    else out.skipped.push(cmd);
  });
  return out;
}
