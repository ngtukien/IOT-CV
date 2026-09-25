/**
 * Toạ độ trên mặt đất: khoảng cách, tâm bản đồ, vệt đường đã bay.
 *
 * `haversineM` là bản soi gương của `haversine_m()` trong
 * `backend/mavlink/mission.py`: cùng bán kính Trái Đất, cùng công thức. Luật
 * "cách home" (missionRules.ts) phải cho ra cùng con số với backend, nếu không
 * web cho nạp thứ backend sẽ từ chối, hoặc khoá oan thứ backend cho qua.
 */

/** Cùng hằng số với `EARTH_RADIUS_M` của backend. */
export const EARTH_RADIUS_M = 6_371_000;

export type LatLon = readonly [lat: number, lon: number];

/**
 * Tâm bản đồ khi chưa có toạ độ nào (TP.HCM, mang từ `frontend/map.js` bản
 * vanilla). Chỉ để trang không trống — đây KHÔNG phải vị trí drone.
 */
export const FALLBACK_CENTER: LatLon = [10.762622, 106.660172];

/**
 * Vệt đường chỉ thêm điểm khi drone đã dịch hơn chừng này mét so với điểm cuối.
 * GPS đứng yên vẫn nhảy lung tung vài chục cm; ở 8 Hz mà ghi mọi điểm thì được
 * 480 điểm mỗi phút, phần lớn là nhiễu. Đây là ngưỡng HIỂN THỊ, không phải giới
 * hạn an toàn — nên nằm ở đây chứ không ở `status.limits`.
 */
export const TRAIL_MIN_STEP_M = 2;

/** Vệt dài nhất bao nhiêu điểm; quá thì cắt từ đầu (điểm cũ nhất). */
export const TRAIL_MAX_POINTS = 2000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Khoảng cách mặt đất giữa hai toạ độ, mét. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = phi2 - phi1;
  const dLambda = toRad(lon2 - lon1);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function isCoord(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon);
}

/** Cặp toạ độ dùng được, hoặc `null`. Chấp nhận `null`/`undefined` từ telemetry. */
export function toLatLon(lat: number | null | undefined, lon: number | null | undefined): LatLon | null {
  return isCoord(lat, lon) ? [lat as number, lon as number] : null;
}

/**
 * Tâm bản đồ lần căn đầu tiên — dừng ở cái đầu tiên có giá trị:
 * home (chỗ cất cánh) → vị trí hiện tại → `null` (chưa có gì, dùng FALLBACK_CENTER).
 */
export function pickMapCenter(
  t: { home_lat?: number | null; home_lon?: number | null; lat?: number | null; lon?: number | null } | null,
): LatLon | null {
  if (!t) return null;
  return toLatLon(t.home_lat, t.home_lon) ?? toLatLon(t.lat, t.lon);
}

/**
 * Vệt đường sau khi nhận một gói telemetry. Trả về CHÍNH mảng cũ (cùng tham
 * chiếu) khi không có gì đổi — để store không đẩy lượt render thừa ở 8 Hz.
 *
 * Chỉ ghi khi `armed`: đường đi lúc nằm trên bàn không có nghĩa gì.
 */
export function nextTrail(
  trail: readonly LatLon[],
  t: { armed?: boolean; lat?: number | null; lon?: number | null },
): readonly LatLon[] {
  if (!t.armed) return trail;
  const here = toLatLon(t.lat, t.lon);
  if (!here) return trail;
  const last = trail.at(-1);
  if (last && haversineM(last[0], last[1], here[0], here[1]) <= TRAIL_MIN_STEP_M) return trail;
  const next = [...trail, here];
  return next.length > TRAIL_MAX_POINTS ? next.slice(next.length - TRAIL_MAX_POINTS) : next;
}
