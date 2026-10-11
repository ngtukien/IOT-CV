/**
 * Thời gian bay của chuyến đang diễn ra (giây), tính từ lúc trang thấy ARMED.
 * `null` khi không bay. Render lại mỗi giây CHỈ khi đang bay.
 */
import { useEffect, useState } from "react";

import { useSessionStore } from "@/store/session";

export function useFlightTime(): { seconds: number | null; seenMidFlight: boolean } {
  const armedAt = useSessionStore((s) => s.armedAt);
  const mid = useSessionStore((s) => s.armedSeenMidFlight);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (armedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [armedAt]);
  return { seconds: armedAt === null ? null : Math.max(0, (now - armedAt) / 1000), seenMidFlight: mid };
}
