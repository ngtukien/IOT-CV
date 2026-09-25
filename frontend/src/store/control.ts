/**
 * Lát cắt ĐIỀU KHIỂN (plan Phase 10 §10.1, §10.3.4). Tách khỏi `telemetry.ts`:
 * store kia chỉ chứa thứ backend ĐẨY xuống; store này chứa thứ tab này ĐÃ GỬI
 * LÊN và đang chờ trả lời.
 *
 * Luật số một, lặp lại ở mọi nút: **giao diện không tự đổi trạng thái trước khi
 * backend xác nhận.** Bấm mà nút đổi màu ngay, rồi backend từ chối, là một lời
 * nói dối về quyền điều khiển máy bay. Nên:
 *
 *  - mode đang chạy lấy từ `telemetry.mode`, armed từ `telemetry.armed`;
 *  - WEB CONTROL bật hay tắt lấy từ `status.safety.web_control_enabled`;
 *  - store này chỉ giữ "đang chờ" (`pending`) để nút hiện vòng xoay.
 *
 * `claimed` — CHÍNH TAB NÀY đang giữ quyền lái — là chỗ duy nhất phải nhớ cục
 * bộ: `status` chỉ nói có ai đó giữ (`web_control_owner` là id socket phía
 * backend, tab không biết id của chính mình). Đặt `true` khi `ack done` cho lệnh
 * bật của CHÍNH tab này về; tắt khi `status` báo quyền lái đã tắt, hoặc khi mất
 * socket (backend thu quyền ngay lúc socket đóng — `ws.py` `disconnect`).
 */
import { create } from "zustand";

import type { ManualSnapshot } from "@/lib/manualControl";
import type { AckPayload, ErrorPayload, UplinkType } from "@/lib/protocol";

/** Quá chừng này không có `ack done` → toast vàng "FC chưa xác nhận" (§10.3.4). */
export const ACK_DONE_WARN_MS = 5000;

export interface PendingCommand {
  command: UplinkType;
  /** Nhãn cho toast và nút, ví dụ "ARM", "Mode GUIDED". */
  label: string;
  /** Để nút biết lệnh chờ là của nó: "GUIDED", "arm", "takeoff"… */
  target: string;
  stage: "sent" | "accepted";
  sentAt: number;
  /** Đã hiện cảnh báo "FC chưa xác nhận" chưa — chỉ hiện một lần. */
  warned: boolean;
}

/**
 * Một dòng trong LỊCH SỬ LỆNH của tab này (trang Nhật ký): thời điểm gửi, lúc
 * backend nhận (`accepted`), lúc FC xác nhận (`done`) hoặc lỗi. Độ trễ đọc ra
 * từ ba mốc đó — không lưu sẵn.
 */
export interface CommandRecord {
  ref: string;
  command: UplinkType;
  label: string;
  sentAt: number;
  acceptedAt: number | null;
  doneAt: number | null;
  error: { code: string; message: string } | null;
}

/** Giữ chừng này dòng lịch sử lệnh, mới nhất ở đầu. */
export const COMMAND_HISTORY_MAX = 100;

export type Resolution =
  | { kind: "done"; pending: PendingCommand; ack: AckPayload }
  | { kind: "error"; pending: PendingCommand; error: ErrorPayload };

interface ControlStore {
  claimed: boolean;
  pending: Record<string, PendingCommand>;
  manual: ManualSnapshot;
  history: CommandRecord[];

  track(ref: string, cmd: Omit<PendingCommand, "stage" | "sentAt" | "warned">, now?: number): void;
  /** `null` khi `ref` không phải lệnh của store này (ví dụ ack của nạp mission). */
  onAck(ack: AckPayload): Resolution | null;
  onError(err: ErrorPayload): Resolution | null;
  /** Lệnh chờ quá `ACK_DONE_WARN_MS` mà chưa cảnh báo; đánh dấu đã cảnh báo. */
  takeOverdue(now?: number): PendingCommand[];
  /** Gọi mỗi khi có `status`: quyền lái tắt ở backend → tab này cũng hết giữ. */
  syncWebControl(enabled: boolean | undefined): void;
  onSocketLost(): void;
  setManual(snap: ManualSnapshot): void;
}

function patchHistory(history: CommandRecord[], ref: string, patch: Partial<CommandRecord>): CommandRecord[] {
  return history.map((h) => (h.ref === ref ? { ...h, ...patch } : h));
}

export const EMPTY_MANUAL: ManualSnapshot = { held: [], sent: null, gamepadActive: false };

export const useControlStore = create<ControlStore>((set, get) => ({
  claimed: false,
  pending: {},
  manual: EMPTY_MANUAL,
  history: [],

  track: (ref, cmd, now = Date.now()) =>
    set((s) => ({
      pending: { ...s.pending, [ref]: { ...cmd, stage: "sent", sentAt: now, warned: false } },
      history: [
        { ref, command: cmd.command, label: cmd.label, sentAt: now, acceptedAt: null, doneAt: null, error: null },
        ...s.history,
      ].slice(0, COMMAND_HISTORY_MAX),
    })),

  onAck: (ack) => {
    const ref = ack.ref ?? "";
    const pending = get().pending[ref];
    if (!pending) return null;
    if (ack.status === "accepted") {
      set((s) => ({
        pending: { ...s.pending, [ref]: { ...pending, stage: "accepted" } },
        history: patchHistory(s.history, ref, { acceptedAt: Date.now() }),
      }));
      return null;
    }
    const { [ref]: _done, ...rest } = get().pending;
    const patch: Partial<ControlStore> = { pending: rest, history: patchHistory(get().history, ref, { doneAt: Date.now() }) };
    if (pending.command === "cmd.web_control_enable") patch.claimed = pending.target === "enable";
    set(patch);
    return { kind: "done", pending, ack };
  },

  onError: (error) => {
    const ref = error.ref ?? "";
    const pending = get().pending[ref];
    if (!pending) return null;
    const { [ref]: _failed, ...rest } = get().pending;
    set({
      pending: rest,
      history: patchHistory(get().history, ref, { error: { code: error.code, message: error.message } }),
    });
    return { kind: "error", pending, error };
  },

  takeOverdue: (now = Date.now()) => {
    const overdue = Object.entries(get().pending).filter(([, p]) => !p.warned && now - p.sentAt >= ACK_DONE_WARN_MS);
    if (overdue.length === 0) return [];
    set((s) => {
      const pending = { ...s.pending };
      for (const [ref, p] of overdue) pending[ref] = { ...p, warned: true };
      return { pending };
    });
    return overdue.map(([, p]) => p);
  },

  syncWebControl: (enabled) => {
    if (enabled !== true && get().claimed) set({ claimed: false });
  },

  onSocketLost: () => set({ claimed: false, pending: {}, manual: EMPTY_MANUAL }),
  setManual: (manual) => set({ manual }),
}));
