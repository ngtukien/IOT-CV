/**
 * Số liệu của PHIÊN làm việc trên tab này — đo tại trình duyệt, không phải số
 * backend báo: nhịp telemetry thực nhận, số lần nối lại, thời gian bay.
 *
 * Bộ đếm theo từng message chạy trên biến thường (`countFrame`); store chỉ được
 * cập nhật MỘT lần mỗi giây (`publishRates`) — đếm vào React state ở 8 Hz là
 * render thừa cho mọi chỗ đang hiện các con số này.
 *
 * Thời gian bay lấy từ CẠNH của `armed` trong telemetry (false → true: bắt đầu,
 * true → false: kết thúc). Mở trang giữa lúc đang bay thì mốc bắt đầu là lúc
 * trang thấy `armed` lần đầu — ghi rõ điều đó bằng `armedSeenMidFlight`.
 */
import { create } from "zustand";

import type { DownlinkType } from "@/lib/protocol";

export interface FlightRecord {
  startedAt: number;
  endedAt: number;
  /** Độ cao lớn nhất quan sát được trong chuyến, m. */
  maxAlt: number | null;
}

interface SessionStore {
  openedAt: number;
  /** Lần gần nhất socket chuyển sang `open`. */
  connectedSince: number | null;
  reconnects: number;
  /** Gói/giây đo trong giây vừa qua, theo loại message. */
  rates: Partial<Record<DownlinkType, number>>;
  totals: Partial<Record<DownlinkType, number>>;
  bytesPerSecond: number;
  armedAt: number | null;
  armedSeenMidFlight: boolean;
  currentMaxAlt: number | null;
  flights: FlightRecord[];

  onSocketOpen(reconnected: boolean, at?: number): void;
  onSocketClosed(): void;
  publishRates(rates: Partial<Record<DownlinkType, number>>, bytesPerSecond: number): void;
  onArmed(armed: boolean | undefined, alt: number | null | undefined, at?: number): void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  openedAt: Date.now(),
  connectedSince: null,
  reconnects: 0,
  rates: {},
  totals: {},
  bytesPerSecond: 0,
  armedAt: null,
  armedSeenMidFlight: false,
  currentMaxAlt: null,
  flights: [],

  onSocketOpen: (reconnected, at = Date.now()) =>
    set((s) => ({ connectedSince: at, reconnects: s.reconnects + (reconnected ? 1 : 0) })),
  onSocketClosed: () => set({ connectedSince: null, rates: {}, bytesPerSecond: 0 }),

  publishRates: (rates, bytesPerSecond) =>
    set((s) => {
      const totals = { ...s.totals };
      for (const [k, v] of Object.entries(rates) as [DownlinkType, number][]) totals[k] = (totals[k] ?? 0) + v;
      return { rates, totals, bytesPerSecond };
    }),

  onArmed: (armed, alt, at = Date.now()) => {
    const s = get();
    const altNum = typeof alt === "number" && Number.isFinite(alt) ? alt : null;
    if (armed === true) {
      if (s.armedAt === null) {
        // Lần đầu thấy armed: nếu là gói đầu tiên của trang thì chuyến bay đã bắt đầu từ trước.
        set({ armedAt: at, armedSeenMidFlight: s.totals.telemetry === undefined, currentMaxAlt: altNum });
      } else if (altNum !== null && (s.currentMaxAlt === null || altNum > s.currentMaxAlt)) {
        set({ currentMaxAlt: altNum });
      }
      return;
    }
    if (armed === false && s.armedAt !== null) {
      const record: FlightRecord = { startedAt: s.armedAt, endedAt: at, maxAlt: s.currentMaxAlt };
      set({ armedAt: null, armedSeenMidFlight: false, currentMaxAlt: null, flights: [record, ...s.flights].slice(0, 20) });
    }
  },
}));

// ---------------------------------------------------------------------------
// Đếm từng frame — ngoài React.
// ---------------------------------------------------------------------------

const counts: Partial<Record<DownlinkType, number>> = {};
let bytes = 0;

export function countFrame(type: DownlinkType): void {
  counts[type] = (counts[type] ?? 0) + 1;
}

export function countBytes(size: number): void {
  bytes += size;
}

/** Gọi mỗi giây: đẩy số đếm của giây vừa qua vào store rồi đặt lại. */
export function flushFrameCounts(): void {
  const snapshot = { ...counts };
  for (const k of Object.keys(counts) as DownlinkType[]) delete counts[k];
  const b = bytes;
  bytes = 0;
  useSessionStore.getState().publishRates(snapshot, b);
}
