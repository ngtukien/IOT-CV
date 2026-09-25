/**
 * Bộ điều khiển tay (plan Phase 10 §10.1.2–10.1.3). Không React — hook
 * `useManualControl` chỉ nối nó vào `window` và store.
 *
 * Luật mang từ `frontend/control.js` bản vanilla: *"keydown gửi lệnh LIÊN TỤC
 * (không phải một lần), keyup gửi velocity = 0."* Cách làm đúng luật đó:
 *
 *   bàn phím / tay cầm  → CHỈ đổi TRẠNG THÁI (tập phím đang giữ)
 *   MỘT setInterval 10 Hz → nơi DUY NHẤT gửi `cmd.velocity`
 *
 * Vì sao không gửi trong `keydown`: hệ điều hành tự lặp `keydown` khi giữ phím,
 * nhưng nhịp đó theo cài đặt bàn phím từng máy — thường chờ 500 ms rồi mới lặp
 * ~30 Hz. Khoảng chết 500 ms đầu dài hơn hạn dead-man 300 ms của backend, nên
 * drone sẽ giật khựng một cái mỗi lần bấm phím.
 *
 * Hai ngoại lệ gửi NGAY, không chờ nhịp kế: `Space` (dừng) và mất tiêu điểm
 * (`releaseAll`). Cả hai đều là lệnh DỪNG — dừng thì không bao giờ phải chờ.
 */
import type { CmdVelocity } from "./protocol";
import type { Axes } from "./velocityMapping";
import { KEY_AXES, STOP_KEY, ZERO_VELOCITY, combineAxes, isZeroVelocity, toVelocity, vectorFromKeys } from "./velocityMapping";

/** 10 Hz: gấp đôi yêu cầu ≥ 5 Hz, vẫn dưới trần `cmd.velocity` 30/s của hợp đồng. */
export const SEND_INTERVAL_MS = 100;

/**
 * Sau khi thả hết phím, gửi zero thêm chừng này nhịp rồi mới im (chống rớt gói).
 * Im hẳn thì dead-man của backend lo nốt: lệnh cuối là zero nên nó không coi đó
 * là sự cố (xem `deadman.py`, nhánh "lệnh cuối đã là DỪNG").
 */
export const ZERO_TICKS_AFTER_RELEASE = 3;

export interface ManualSnapshot {
  held: readonly string[];
  /** Lệnh vừa gửi gần nhất; `null` khi đang im (không gửi gì). */
  sent: Required<CmdVelocity> | null;
  gamepadActive: boolean;
}

export interface ManualControllerOptions {
  /** Gửi một lệnh. Trả `false` khi không đi được (socket chưa mở). */
  send(v: Required<CmdVelocity>): boolean;
  /** Web có đang được phép lái không (backend xác nhận VÀ chính tab này giữ quyền). */
  isEnabled(): boolean;
  /** `status.limits.max_velocity`; `null` = chưa biết → không gửi gì ngoài zero. */
  getMaxVelocity(): number | null;
  onChange?(snap: ManualSnapshot): void;
  intervalMs?: number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

export interface ManualController {
  /** Trả `true` nếu phím này thuộc điều khiển tay VÀ đang lái — người gọi `preventDefault`. */
  keyDown(code: string): boolean;
  keyUp(code: string): void;
  /** Mất tiêu điểm / tab ẩn: quên hết phím, gửi zero NGAY. */
  releaseAll(): void;
  /** Trục tay cầm (hệ số, đã qua vùng chết); `null` = không có tay cầm. */
  setGamepad(axes: Required<Axes> | null): void;
  /** Một nhịp gửi. Public để test bơm nhịp. */
  tick(): void;
  start(): void;
  dispose(): void;
  snapshot(): ManualSnapshot;
}

export function createManualController(opts: ManualControllerOptions): ManualController {
  const interval = opts.intervalMs ?? SEND_INTERVAL_MS;
  const setTimer = opts.setInterval ?? ((fn: () => void, ms: number) => globalThis.setInterval(fn, ms));
  const clearTimer = opts.clearInterval ?? ((h: unknown) => globalThis.clearInterval(h as ReturnType<typeof setInterval>));

  const held = new Set<string>();
  let gamepad: Required<Axes> | null = null;
  let zeroLeft = 0;
  let sent: Required<CmdVelocity> | null = null;
  let timer: unknown = null;

  function snapshot(): ManualSnapshot {
    return { held: [...held], sent, gamepadActive: gamepad !== null && held.size === 0 };
  }

  function notify(): void {
    opts.onChange?.(snapshot());
  }

  /**
   * Vector muốn gửi lúc này. Bàn phím ƯU TIÊN: đang có phím giữ thì bỏ qua tay
   * cầm — hai nguồn cộng nhau là hai người cùng cầm một vô-lăng.
   */
  function desired(maxVelocity: number): Required<CmdVelocity> {
    if (held.size > 0) return vectorFromKeys(held, maxVelocity);
    if (gamepad) return toVelocity(combineAxes([gamepad]), maxVelocity);
    return ZERO_VELOCITY;
  }

  function emit(v: Required<CmdVelocity>): void {
    sent = opts.send(v) ? v : null;
  }

  /** Dừng NGAY: một gói zero bây giờ, rồi thêm vài gói ở các nhịp sau. */
  function stopNow(): void {
    zeroLeft = ZERO_TICKS_AFTER_RELEASE;
    if (opts.isEnabled()) emit(ZERO_VELOCITY);
  }

  function tick(): void {
    const before = sent;
    if (!opts.isEnabled()) {
      // Mất quyền lái (backend thu, tab khác giành, mất socket): không gửi gì,
      // và quên phím đang giữ — bật lại quyền lái KHÔNG được làm drone lao đi
      // theo một phím người ta đã quên là mình đang đè.
      held.clear();
      zeroLeft = 0;
      sent = null;
    } else {
      const max = opts.getMaxVelocity();
      const v = max === null ? ZERO_VELOCITY : desired(max);
      if (!isZeroVelocity(v)) {
        emit(v);
        zeroLeft = ZERO_TICKS_AFTER_RELEASE;
      } else if (zeroLeft > 0) {
        emit(ZERO_VELOCITY);
        zeroLeft -= 1;
      } else {
        sent = null;
      }
    }
    if (before !== sent) notify();
  }

  return {
    keyDown(code) {
      if (!opts.isEnabled()) return false;
      if (code === STOP_KEY) {
        held.clear();
        stopNow();
        notify();
        return true;
      }
      if (!(code in KEY_AXES)) return false;
      if (!held.has(code)) {
        held.add(code);
        notify();
      }
      // KHÔNG gửi ở đây — xem khối chú thích đầu file.
      return true;
    },
    keyUp(code) {
      if (held.delete(code)) notify();
    },
    releaseAll() {
      held.clear();
      stopNow();
      notify();
    },
    setGamepad(axes) {
      const active = axes !== null && (axes.vx !== 0 || axes.vy !== 0 || axes.vz !== 0 || axes.yaw !== 0);
      gamepad = active ? axes : null;
    },
    tick,
    start() {
      if (timer === null) timer = setTimer(tick, interval);
    },
    dispose() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      held.clear();
    },
    snapshot,
  };
}
