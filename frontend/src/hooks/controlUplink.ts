/**
 * Gửi lệnh bay và xử lý phần trả lời (plan Phase 10 §10.1.4, §10.3.4). Cùng
 * khuôn với `missionUplink.ts`: component gọi `sendCommand`, `useWebSocket`
 * chuyển `ack` / `error` về đây trước.
 *
 * Mỗi lệnh có `id`; chuỗi trả lời theo dõi được là
 *
 *   gửi → ack accepted (backend nhận, hợp lệ) → ack done (FC xác nhận)
 *
 * hoặc `error` ở bất kỳ bước nào. Nút KHÔNG tự đổi màu trước `done` — màu đến
 * từ telemetry / status do backend đẩy về.
 */
import { toast } from "sonner";

import { ERROR_CODE_LABEL } from "@/lib/protocol";
import type { AckPayload, ErrorPayload, UplinkPayloads, UplinkType } from "@/lib/protocol";
import { sendUplink } from "@/lib/uplink";
import { ACK_DONE_WARN_MS, useControlStore } from "@/store/control";
import { useTelemetryStore, webEvent } from "@/store/telemetry";

/** Thông điệp khi tab khác đang giữ quyền lái (§10.1.4). */
export const MSG_OTHER_TAB = "Một tab khác đang giữ quyền lái";

/**
 * `cmd.velocity` bị từ chối thì backend trả một `error` cho MỖI gói — 10 lần/giây.
 * Chỉ báo một lần trong khoảng này, kẻo nhật ký và toast ngập.
 */
export const VELOCITY_ERROR_QUIET_MS = 3000;

let lastVelocityError: { code: string; at: number } | null = null;

/** `id` đã gửi, hoặc `null` khi chưa có socket — đã báo cho người dùng. */
export function sendCommand<T extends Exclude<UplinkType, "cmd.velocity" | "ping" | "cmd.mission.upload">>(
  type: T,
  data: UplinkPayloads[T],
  meta: { label: string; target: string },
): string | null {
  const id = sendUplink(type, data);
  if (id === null) {
    toast.error("Chưa nối được backend — lệnh chưa được gửi", { description: meta.label });
    return null;
  }
  useControlStore.getState().track(id, { command: type, ...meta });
  useTelemetryStore.getState().pushEvent(webEvent("info", "cmd.sent", `Đã gửi lệnh ${meta.label}`, { ref: id }));
  return id;
}

/** Trả `true` nếu ack này là của một lệnh bay (đã xử lý). */
export function handleControlAck(ack: AckPayload): boolean {
  const res = useControlStore.getState().onAck(ack);
  if (ack.status === "accepted") return useControlStore.getState().pending[ack.ref ?? ""] !== undefined;
  if (res === null) return false;
  useTelemetryStore
    .getState()
    .pushEvent(webEvent("info", "cmd.done", `${res.pending.label}: FC đã xác nhận`, { ref: ack.ref ?? null }));
  return true;
}

function errorLabel(code: string): string {
  return ERROR_CODE_LABEL[code as keyof typeof ERROR_CODE_LABEL] ?? code;
}

/** Trả `true` nếu lỗi này là của một lệnh bay hoặc của `cmd.velocity` (đã xử lý). */
export function handleControlError(err: ErrorPayload, now = Date.now()): boolean {
  const log = useTelemetryStore.getState().pushEvent;

  if (err.command === "cmd.velocity") {
    if (lastVelocityError && lastVelocityError.code === err.code && now - lastVelocityError.at < VELOCITY_ERROR_QUIET_MS) {
      return true;
    }
    lastVelocityError = { code: err.code, at: now };
    log(webEvent("warn", `ws.error.${err.code}`, `Lái tay bị từ chối — ${errorLabel(err.code)}: ${err.message}`));
    toast.error(err.code === "command_denied" ? MSG_OTHER_TAB : `Lái tay bị từ chối: ${errorLabel(err.code)}`, {
      description: err.message,
    });
    return true;
  }

  const res = useControlStore.getState().onError(err);
  if (res === null) return false;
  const label = errorLabel(err.code);
  log(webEvent("warn", `ws.error.${err.code}`, `${res.pending.label} — ${label}: ${err.message}`, { ref: err.ref ?? null }));
  const otherTab = err.code === "command_denied" && (err.detail?.owner ?? null) !== null;
  toast.error(otherTab ? MSG_OTHER_TAB : `${res.pending.label}: ${label}`, { description: err.message });
  return true;
}

/** Gọi định kỳ: lệnh nào quá hạn mà FC chưa xác nhận thì cảnh báo một lần. */
export function warnOverdueCommands(now = Date.now()): void {
  for (const p of useControlStore.getState().takeOverdue(now)) {
    toast.warning("FC chưa xác nhận", { description: `${p.label} — đã chờ hơn ${ACK_DONE_WARN_MS / 1000} s, xem nhật ký` });
    useTelemetryStore
      .getState()
      .pushEvent(webEvent("warn", "cmd.slow", `${p.label}: quá ${ACK_DONE_WARN_MS / 1000} s chưa có xác nhận từ FC`));
  }
}
