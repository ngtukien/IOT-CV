/**
 * Bảng phím → vận tốc lái tay (plan Phase 10 §10.1.1). THUẦN: không React, không socket.
 *
 * Giữ đúng quy ước của `backend/mavlink/control.py` (`KEY_VELOCITY_MAP`), vì hai
 * bên cùng nói hệ NED, body frame:
 *
 *   vx +  = tiến theo MŨI máy bay       vy + = sang phải
 *   vz −  = LÊN  (NED: Z dương hướng xuống — đừng "sửa cho hợp lý")
 *
 * Giá trị trong bảng là HỆ SỐ, nhân với `status.limits.max_velocity` của backend.
 * Backend kẹp lại lần nữa (Phase 06 §6.2) — hai lớp, không lớp nào thừa.
 *
 * Khoá theo `KeyboardEvent.code` (vị trí phím vật lý), không theo `key` (ký tự
 * sinh ra). `key` đổi theo Caps Lock, bố cục bàn phím, và bộ gõ tiếng Việt:
 * Unikey/EVKey ở kiểu Telex biến `w` thành `ư`, và phím W không còn là "tiến".
 */
import type { CmdVelocity } from "./protocol";

/** Tốc độ xoay của Q/E, độ/giây. Backend kẹp theo `MAX_YAW_RATE` của nó. */
export const YAW_RATE_DEG_S = 30;

/** Vùng chết của cần analog tay cầm (§10.2): cần rẻ luôn trôi quanh 0. */
export const GAMEPAD_DEADZONE = 0.15;

/** Hệ số lên/xuống — nửa tốc độ ngang, giống `KEY_VELOCITY_MAP` của backend. */
export const VERTICAL_FACTOR = 0.5;

/** Một phím đóng góp gì. `yaw` là hệ số −1..1 của `YAW_RATE_DEG_S`. */
export interface Axes {
  vx?: number;
  vy?: number;
  vz?: number;
  yaw?: number;
}

export const KEY_AXES: Readonly<Record<string, Axes>> = {
  KeyW: { vx: 1 },
  ArrowUp: { vx: 1 },
  KeyS: { vx: -1 },
  ArrowDown: { vx: -1 },
  KeyD: { vy: 1 },
  ArrowRight: { vy: 1 },
  KeyA: { vy: -1 },
  ArrowLeft: { vy: -1 },
  KeyR: { vz: -VERTICAL_FACTOR },
  KeyF: { vz: VERTICAL_FACTOR },
  KeyQ: { yaw: -1 },
  KeyE: { yaw: 1 },
};

/** Phím dừng ngay. Không nằm trong `KEY_AXES`: nó không phải một hướng. */
export const STOP_KEY = "Space";

/** Mọi phím điều khiển tay dùng — để `preventDefault` (mũi tên/Space cuộn trang). */
export const MANUAL_KEYS: ReadonlySet<string> = new Set([...Object.keys(KEY_AXES), STOP_KEY]);

/** Nhãn hiển thị cho `KeypadHint` và dòng "đang giữ". */
export const KEY_LABEL: Readonly<Record<string, string>> = {
  KeyW: "W",
  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  KeyR: "R",
  KeyF: "F",
  KeyQ: "Q",
  KeyE: "E",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
};

export const ZERO_VELOCITY: Required<CmdVelocity> = { vx: 0, vy: 0, vz: 0, yaw_rate: 0 };

function clampUnit(v: number, max = 1): number {
  return Math.max(-max, Math.min(max, v));
}

/**
 * Cộng hệ số các phím đang giữ, rồi chuẩn hoá. Kết quả vẫn là HỆ SỐ.
 *
 * Mặt phẳng ngang chuẩn hoá theo ĐỘ DÀI vector: giữ `W`+`D` phải đi chéo với
 * cùng tốc độ như giữ `W` một mình, không nhanh hơn √2 lần — bất ngờ đó khó
 * chịu, và nó vượt `max_velocity` mà người lái tưởng là trần. Trục đứng và
 * xoay kẹp riêng: giữ `R` không được làm drone đi ngang chậm lại.
 *
 * Hai phím ngược chiều (W+S, R+F) triệt nhau về 0 — không phím nào "thắng".
 */
export function combineAxes(parts: Iterable<Axes>): Required<Axes> {
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let yaw = 0;
  for (const p of parts) {
    vx += p.vx ?? 0;
    vy += p.vy ?? 0;
    vz += p.vz ?? 0;
    yaw += p.yaw ?? 0;
  }
  const horizontal = Math.hypot(vx, vy);
  if (horizontal > 1) {
    vx /= horizontal;
    vy /= horizontal;
  }
  return { vx, vy, vz: clampUnit(vz, VERTICAL_FACTOR), yaw: clampUnit(yaw) };
}

/** Hệ số → lệnh gửi đi (m/s, độ/s). `+ 0` đổi `-0` thành `0` cho dễ đọc log. */
export function toVelocity(axes: Required<Axes>, maxVelocity: number): Required<CmdVelocity> {
  return {
    vx: axes.vx * maxVelocity + 0,
    vy: axes.vy * maxVelocity + 0,
    vz: axes.vz * maxVelocity + 0,
    yaw_rate: axes.yaw * YAW_RATE_DEG_S + 0,
  };
}

/** Tập phím đang giữ (theo `code`) → lệnh vận tốc. Tập rỗng → (0, 0, 0). */
export function vectorFromKeys(held: Iterable<string>, maxVelocity: number): Required<CmdVelocity> {
  const parts: Axes[] = [];
  for (const code of held) {
    const axes = KEY_AXES[code];
    if (axes) parts.push(axes);
  }
  return toVelocity(combineAxes(parts), maxVelocity);
}

export function isZeroVelocity(v: CmdVelocity): boolean {
  return !v.vx && !v.vy && !v.vz && !v.yaw_rate;
}

/**
 * Vùng chết của MỘT trục analog: dưới ngưỡng → 0; trên ngưỡng thì co giãn lại
 * về 0..1, để vừa ra khỏi vùng chết là tốc độ bắt đầu từ 0 chứ không nhảy
 * thẳng lên 15%.
 */
export function applyDeadzone(value: number, deadzone = GAMEPAD_DEADZONE): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - deadzone) / (1 - deadzone));
}

/**
 * Bốn trục của tay cầm chuẩn (`Gamepad.axes`, layout "standard") → hệ số.
 *
 *   axes[0] trái ngang → vy     axes[1] trái dọc → vx (đẩy LÊN là âm → tiến)
 *   axes[2] phải ngang → yaw    axes[3] phải dọc → vz (đẩy LÊN là âm → lên, khớp NED)
 */
export function axesFromGamepad(axes: readonly number[]): Required<Axes> {
  const at = (i: number) => applyDeadzone(axes[i] ?? 0);
  return combineAxes([{ vx: -at(1), vy: at(0), vz: at(3) * VERTICAL_FACTOR, yaw: at(2) }]);
}
