/**
 * Lịch sử telemetry trong phiên — nguồn của biểu đồ, sparkline và vệt bay 3D.
 *
 * CỐ Ý không phải store zustand: 8 gói/giây đẩy vào React state là 8 lượt render
 * mỗi giây cho MỌI biểu đồ. Ở đây là một vòng đệm thường; ai cần vẽ thì tự kéo
 * dữ liệu theo nhịp của mình (`useHistoryTick`), 2–4 lần/giây là đủ cho mắt.
 *
 * Mỗi mẫu giữ nguyên gói `Telemetry` đã qua kiểm tra hợp đồng + mốc giờ nhận.
 * Không lưu giá trị dẫn xuất: chuỗi số của biểu đồ được rút ra lúc vẽ.
 *
 * `seed()` nạp lịch sử backend giữ sẵn (`GET /api/telemetry/history`) lúc mở
 * trang — biểu đồ có ngay vài phút trước đó thay vì bắt đầu từ trống.
 */
import { useEffect, useState } from "react";

import { RingBuffer } from "@/lib/ringBuffer";
import type { Telemetry } from "@/lib/protocol";

/** 15 phút ở 8 Hz. Quá thì mẫu cũ nhất bị ghi đè. */
export const HISTORY_CAPACITY = 8 * 60 * 15;

export interface TelemetrySample {
  /** ms, `Date.now()` lúc nhận (hoặc `ts` backend × 1000 với mẫu nạp sẵn). */
  t: number;
  d: Telemetry;
}

const buffer = new RingBuffer<TelemetrySample>(HISTORY_CAPACITY);
let version = 0;

export const telemetryHistory = {
  push(d: Telemetry, t = Date.now()): void {
    buffer.push({ t, d });
    version += 1;
  },
  /**
   * Nạp mẫu cũ hơn mọi mẫu đang có. Mẫu trùng hoặc mới hơn mẫu cũ nhất hiện có
   * bị bỏ — dữ liệu trực tiếp luôn thắng dữ liệu nạp lại.
   */
  seed(samples: readonly TelemetrySample[]): number {
    const oldest = buffer.at(0)?.t ?? Number.POSITIVE_INFINITY;
    const older = samples.filter((s) => s.t < oldest).sort((a, b) => a.t - b.t);
    if (older.length === 0) return 0;
    const live = buffer.toArray();
    buffer.clear();
    for (const s of [...older, ...live].slice(-HISTORY_CAPACITY)) buffer.push(s);
    version += 1;
    return older.length;
  },
  samples(sinceMs = 0): TelemetrySample[] {
    const all = buffer.toArray();
    if (sinceMs <= 0) return all;
    let i = 0;
    while (i < all.length && all[i].t < sinceMs) i += 1;
    return all.slice(i);
  },
  last(): TelemetrySample | undefined {
    return buffer.last();
  },
  get size(): number {
    return buffer.size;
  },
  get version(): number {
    return version;
  },
  clear(): void {
    buffer.clear();
    version += 1;
  },
};

/**
 * Render lại component theo nhịp `intervalMs` NẾU lịch sử có mẫu mới. Trả về
 * `version` hiện tại để dùng làm phụ thuộc của `useMemo`.
 */
export function useHistoryTick(intervalMs = 500): number {
  const [seen, setSeen] = useState(() => telemetryHistory.version);
  useEffect(() => {
    const timer = setInterval(() => {
      const v = telemetryHistory.version;
      setSeen((prev) => (prev === v ? prev : v));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return seen;
}

/** Chuỗi số của một trường trong `sinceMs` gần nhất — cho sparkline. */
export function recentSeries(pick: (d: Telemetry) => number | null | undefined, windowMs: number, now = Date.now()): (number | null)[] {
  return telemetryHistory.samples(now - windowMs).map((s) => {
    const v = pick(s.d);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
}
