/**
 * Số cảnh báo/lỗi CHƯA XEM — cho chuông ở thanh trên và badge Nhật ký. Chỉ đếm
 * `warn` và `error`: một chấm đỏ cho mỗi dòng `info` là dạy người dùng phớt lờ nó.
 */
import { useMemo } from "react";

import { useTelemetryStore } from "@/store/telemetry";
import { useUiStore } from "@/store/ui";

export function useUnread(): { count: number; hasError: boolean } {
  const events = useTelemetryStore((s) => s.events);
  const seenUntil = useUiStore((s) => s.seenUntil);
  return useMemo(() => {
    let count = 0;
    let hasError = false;
    for (const e of events) {
      if (e.ts <= seenUntil) break; // events mới nhất ở đầu
      if (e.level === "info") continue;
      count += 1;
      if (e.level === "error") hasError = true;
    }
    return { count, hasError };
  }, [events, seenUntil]);
}
