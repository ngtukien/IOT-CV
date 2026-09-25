/** Kết quả kiểm tra tự động, tính lại khi telemetry/status đổi. */
import { useMemo } from "react";

import { evaluatePreflight, preflightVerdict } from "@/lib/preflight";
import type { AutoCheck, Verdict } from "@/lib/preflight";
import { useTelemetryStore } from "@/store/telemetry";

export function usePreflight(): { checks: AutoCheck[]; verdict: Verdict } {
  const socketOpen = useTelemetryStore((s) => s.connection === "open");
  const telemetry = useTelemetryStore((s) => s.telemetry);
  const status = useTelemetryStore((s) => s.status);
  return useMemo(() => {
    const checks = evaluatePreflight({ socketOpen, telemetry, status });
    return { checks, verdict: preflightVerdict(checks) };
  }, [socketOpen, telemetry, status]);
}
