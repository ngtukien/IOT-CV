/**
 * Luật hiển thị của panel vật cản (plan Phase 10 §10.4). THUẦN, để test được.
 *
 * Frontend KHÔNG tự tính lại `avoid_state`: backend là nguồn sự thật (Phase 07
 * §7.6.4). Tính lại ở đây là tạo ra khả năng hai bên nói khác nhau về đúng một
 * chuyện sống còn. Thứ duy nhất tính ở đây là màu của từng CUNG trên sơ đồ, theo
 * dải khoảng cách — đó là "gần hay xa", không phải "FC có đang tránh không".
 */
import type { LimitsPayload, Telemetry } from "./protocol";

export type AvoidState = NonNullable<Telemetry["avoid_state"]>;

export type ObstacleTone = "ok" | "warn" | "danger" | "unknown";

/** Bốn trạng thái backend → bốn màu (§10.4.2). */
export const AVOID_TONE: Record<AvoidState, ObstacleTone> = {
  OFF: "ok",
  NEAR: "warn",
  ACTIVE: "danger",
  UNKNOWN: "unknown",
};

/**
 * Mode mà ArduPilot KHÔNG tự tránh vật cản (§10.4.3). AC_Avoid (phanh trước vật
 * cản) chỉ chạy ở Loiter/AltHold/PosHold; tránh trong AUTO/GUIDED/RTL là việc của
 * Object Avoidance path planner, đang tắt (`OA_TYPE=0`) vì chỉ có một tia đo.
 */
export const NO_AVOID_MODES: ReadonlySet<string> = new Set(["AUTO", "GUIDED", "RTL"]);

export const NO_AVOID_WARNING = [
  "Chế độ này KHÔNG tự tránh vật cản.",
  "Việc tránh trong AUTO/GUIDED thuộc về Object Avoidance path planner,",
  "hiện đang tắt (OA_TYPE=0) vì chỉ có một tia đo nhìn thẳng trước.",
] as const;

export function showsNoAvoidWarning(mode: string | null | undefined): boolean {
  return mode != null && NO_AVOID_MODES.has(mode);
}

/**
 * Màu một cung theo khoảng cách. `null` = cung KHÔNG CÓ DỮ LIỆU → `unknown`
 * (vẽ gạch chéo xám), tuyệt đối không phải `ok`: với phần cứng thật chỉ có MỘT
 * tia TFmini nhìn thẳng trước, 7/8 cung luôn trống, và vẽ chúng màu xanh là nói
 * dối rằng drone nhìn được 360°.
 */
export function sectorTone(
  distance: number | null | undefined,
  limits: Pick<LimitsPayload, "avoid_margin_m" | "avoid_dist_max_m"> | null,
): ObstacleTone {
  if (distance == null || !Number.isFinite(distance) || !limits) return "unknown";
  if (distance <= limits.avoid_margin_m) return "danger";
  if (distance <= limits.avoid_dist_max_m) return "warn";
  return "ok";
}

/** Vị trí (0–1) trên thanh 0 → `rangefinder_max_m`. Ngoài tầm thì dính mép. */
export function barFraction(distance: number, maxRange: number): number {
  if (!(maxRange > 0)) return 0;
  return Math.min(1, Math.max(0, distance / maxRange));
}

/** Đường viền SVG của cung thứ `i` (0 = mũi, theo chiều kim đồng hồ), tâm (0,0). */
export function sectorPath(i: number, rInner: number, rOuter: number, count = 8): string {
  const span = 360 / count;
  const toXY = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180; // 0° = lên trên (mũi)
    return [r * Math.cos(rad), r * Math.sin(rad)].map((v) => Number(v.toFixed(3)));
  };
  const a0 = i * span - span / 2 + 1.5;
  const a1 = i * span + span / 2 - 1.5;
  const [x0, y0] = toXY(a0, rOuter);
  const [x1, y1] = toXY(a1, rOuter);
  const [x2, y2] = toXY(a1, rInner);
  const [x3, y3] = toXY(a0, rInner);
  return `M${x0} ${y0} A${rOuter} ${rOuter} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${rInner} ${rInner} 0 0 0 ${x3} ${y3} Z`;
}
