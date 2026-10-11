/**
 * Định dạng số và đơn vị dùng chung cho mọi phase web.
 *
 * Hai luật, áp cho mọi hàm ở đây:
 *  1. `null` / `undefined` / không phải số → `—`, KHÔNG BAO GIỜ `0`.
 *     "Chưa có số đo" khác "số đo bằng không"; hiện `0` khi đang mù là cách gây
 *     tai nạn (cùng nguyên tắc với `avoid_state = UNKNOWN` ở backend).
 *  2. Có số thì luôn kèm đơn vị. Không ô nào chỉ có con số trần.
 */

export const NO_VALUE = "—";

type Maybe = number | null | undefined;

export function hasValue(v: Maybe): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** `toFixed` nhưng không bao giờ ra `-0.0` (SITL nằm đất báo độ cao -0.02 m). */
function toFixedNoNegZero(v: number, digits: number): string {
  const rounded = Number(v.toFixed(digits));
  return (rounded === 0 ? 0 : rounded).toFixed(digits);
}

/** `4.9 m`. `unit` rỗng thì chỉ in số — dùng cho số đếm như `12 vệ tinh`. */
export function formatNumber(v: Maybe, digits: number, unit: string): string {
  if (!hasValue(v)) return NO_VALUE;
  const text = toFixedNoNegZero(v, digits);
  return unit ? `${text} ${unit}` : text;
}

/** Có dấu: `+0.4 m/s`, `-1.2 m/s`. Số 0 in `0.0 m/s`, không dấu. */
export function formatSigned(v: Maybe, digits: number, unit: string): string {
  if (!hasValue(v)) return NO_VALUE;
  const sign = Number(v.toFixed(digits)) > 0 ? "+" : "";
  return `${sign}${toFixedNoNegZero(v, digits)} ${unit}`;
}

/** Hướng mũi 0–359, không lẻ: `123°`. */
export function formatHeading(v: Maybe): string {
  if (!hasValue(v)) return NO_VALUE;
  return `${Math.round(((v % 360) + 360) % 360)}°`;
}

/** Góc có dấu, không lẻ, không cách: `-3°` (roll, pitch). */
export function formatDegrees(v: Maybe): string {
  if (!hasValue(v)) return NO_VALUE;
  const rounded = Math.round(v);
  return `${rounded === 0 ? 0 : rounded}°`;
}

/** Giờ địa phương `HH:mm:ss` từ Unix epoch GIÂY (đúng đơn vị `ts` của hợp đồng). */
export function formatClock(epochSeconds: Maybe): string {
  if (!hasValue(epochSeconds)) return NO_VALUE;
  const d = new Date(epochSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Ngưỡng TÔ MÀU của HUD — chỉ để hiển thị, không phải giới hạn an toàn.
 *
 * Giới hạn an toàn (max_alt, max_velocity, avoid_margin_m…) do backend quyết và
 * đọc từ `status.limits` qua `useLimits()`; không được gõ lại ở đây. Mấy số
 * dưới đây không nằm trong hợp đồng: chúng chỉ quyết một ô chuyển vàng/đỏ khi
 * nào, đổi không làm drone bay khác đi. Nguồn: bảng HUD, plan Phase 08 §8.5.
 */
export const DISPLAY_THRESHOLDS = {
  batteryLowPercent: 25,
  linkAgeWarnMs: 1000,
  linkAgeDangerMs: 3000,
} as const;

export type Tone = "neutral" | "ok" | "warn" | "danger";

export function linkAgeTone(ms: Maybe): Tone {
  if (!hasValue(ms)) return "neutral";
  if (ms > DISPLAY_THRESHOLDS.linkAgeDangerMs) return "danger";
  if (ms > DISPLAY_THRESHOLDS.linkAgeWarnMs) return "warn";
  return "ok";
}

export function batteryTone(percent: Maybe): Tone {
  if (!hasValue(percent)) return "neutral";
  return percent < DISPLAY_THRESHOLDS.batteryLowPercent ? "danger" : "ok";
}

export function climbTone(rate: Maybe): Tone {
  if (!hasValue(rate) || Number(rate.toFixed(1)) === 0) return "neutral";
  return rate > 0 ? "ok" : "danger";
}

/** `GUIDED` xanh, `RTL`/`LAND` vàng, còn lại xám (plan §8.5). */
export function modeTone(mode: string | null | undefined): Tone {
  if (mode === "GUIDED") return "ok";
  if (mode === "RTL" || mode === "LAND") return "warn";
  return "neutral";
}

/** Khoảng thời gian `mm:ss`, hoặc `h:mm:ss` khi quá một giờ. Âm/không phải số → `—`. */
export function formatDuration(seconds: Maybe): string {
  if (!hasValue(seconds) || seconds < 0) return NO_VALUE;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Khoảng cách gọn: dưới 1 km in mét, từ 1 km in km một số lẻ. */
export function formatDistance(meters: Maybe): string {
  if (!hasValue(meters)) return NO_VALUE;
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
