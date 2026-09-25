/**
 * Store duy nhất cho mọi dữ liệu ĐẨY từ backend (WebSocket).
 *
 * Bốn luật (plan Phase 08 §8.2):
 *  1. Component subscribe theo LÁT CẮT: `useTelemetryStore(s => s.telemetry?.relative_alt)`,
 *     không `const { telemetry } = useTelemetryStore()`. Ở 8 Hz, lấy cả store
 *     làm MỌI component render lại 8 lần/giây.
 *  2. Không lưu giá trị dẫn xuất. `link_age_ms` backend đã tính; khoảng cách
 *     về home thì component tính lúc hiển thị.
 *  3. `events` giới hạn 200, mới nhất ở đầu — khớp vòng đệm EventBus của backend.
 *  4. Không có ngưỡng nào ở đây. Giới hạn đọc từ `status.limits` (`useLimits`).
 */
import { create } from "zustand";

import type { DetectionPayload, EventPayload, StatusPayload, Telemetry } from "@/lib/protocol";

export const EVENTS_MAX = 200;

export type ConnectionState = "connecting" | "open" | "closed" | "error";

/**
 * Một dòng nhật ký. Ngoài sự kiện của backend (`event` trong hợp đồng), web tự
 * ghi sự kiện của chính nó — mất/nối lại socket, message hỏng. Những dòng đó
 * mang `source: "web"`, một giá trị KHÔNG có trong hợp đồng và không bao giờ
 * được gửi lên server.
 */
export interface LogEntry {
  key: string;
  level: NonNullable<EventPayload["level"]>;
  source: NonNullable<EventPayload["source"]> | "web";
  code: string;
  message: string;
  detail: Record<string, unknown> | null;
  /** Thời điểm sự kiện XẢY RA (giây). Với event backend là `data.ts`, không phải `ts` phong bì. */
  ts: number;
}

interface TelemetryStore {
  telemetry: Telemetry | null;
  status: StatusPayload | null;
  events: LogEntry[];
  detection: DetectionPayload | null;
  connection: ConnectionState;
  /** Khi nào thử nối lại (ms, `Date.now()`), `null` khi không chờ. Để hiện đếm ngược. */
  nextRetryAt: number | null;
  lastMessageAt: number | null;

  applyTelemetry(t: Telemetry): void;
  applyStatus(s: StatusPayload): void;
  /** Trả `true` nếu là dòng mới (chưa có) — để quyết có bật toast không. */
  pushEvent(e: LogEntry): boolean;
  applyDetection(d: DetectionPayload): void;
  setConnection(c: ConnectionState, nextRetryAt?: number | null): void;
  markMessage(at: number): void;
}

/**
 * Cùng một sự kiện có thể tới nhiều lần: backend phát lại 50 sự kiện gần nhất
 * cho MỖI socket mới mở (kể cả lúc nối lại), và lúc mở trang web còn lấy thêm
 * lịch sử qua `GET /api/events`. Khoá theo nội dung để không nhân đôi dòng.
 */
export function eventKey(e: Pick<LogEntry, "ts" | "source" | "code" | "message">): string {
  return `${e.ts}|${e.source}|${e.code}|${e.message}`;
}

export function fromServerEvent(e: EventPayload, fallbackTs: number): LogEntry {
  const entry = {
    level: e.level ?? "info",
    source: e.source ?? "backend",
    code: e.code,
    message: e.message,
    detail: e.detail ?? null,
    ts: e.ts ?? fallbackTs,
  };
  return { ...entry, key: eventKey(entry) };
}

export function webEvent(level: LogEntry["level"], code: string, message: string, detail: Record<string, unknown> | null = null): LogEntry {
  const entry = { level, source: "web" as const, code, message, detail, ts: Date.now() / 1000 };
  return { ...entry, key: eventKey(entry) };
}

export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  telemetry: null,
  status: null,
  events: [],
  detection: null,
  connection: "connecting",
  nextRetryAt: null,
  lastMessageAt: null,

  applyTelemetry: (telemetry) => set({ telemetry }),
  applyStatus: (status) => set({ status }),
  applyDetection: (detection) => set({ detection }),
  markMessage: (lastMessageAt) => set({ lastMessageAt }),
  setConnection: (connection, nextRetryAt = null) =>
    set(
      connection === "open" || connection === "connecting"
        ? { connection, nextRetryAt }
        : // Mất socket thì số trên HUD không còn là số SỐNG nữa. Xoá để HUD hiện
          // `—` ("không biết"), thay vì đứng im ở số cũ trông như drone đang
          // treo yên một chỗ. `status` giữ lại: endpoint/phiên bản vẫn đúng.
          { connection, nextRetryAt, telemetry: null, detection: null },
    ),

  pushEvent: (entry) => {
    const { events } = get();
    if (events.some((e) => e.key === entry.key)) return false;
    // Sắp theo thời điểm xảy ra, mới nhất ở đầu: lịch sử REST có thể tới SAU
    // sự kiện trực tiếp, nên không được chỉ chèn lên đầu.
    const next = [entry, ...events].sort((a, b) => b.ts - a.ts).slice(0, EVENTS_MAX);
    set({ events: next });
    return next.includes(entry);
  },
}));
