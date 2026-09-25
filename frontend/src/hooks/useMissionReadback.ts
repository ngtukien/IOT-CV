/**
 * Giữ lớp "mission đã nạp" khớp với thứ FC thật sự đang giữ. Gọi MỘT lần, ở `App`.
 *
 * `status.mission` chỉ mang `source/count/uploaded_at`, không mang toạ độ.
 * Toạ độ lấy qua `GET /api/mission`, và CHỈ khi `source === "readback"` — lúc
 * đó backend đã đọc ngược mission từ FC và so khớp với cái vừa gửi (Phase 07
 * §7.4). `local` (gửi xong nhưng chưa đọc lại khớp) hay `none` thì xoá lớp đó:
 * UI không bao giờ vẽ "mission tôi NGHĨ là mình đã gửi".
 */
import { useEffect } from "react";

import { fetchMission } from "@/lib/api";
import { useMissionStore } from "@/store/mission";
import { useTelemetryStore, webEvent } from "@/store/telemetry";

export function useMissionReadback(): void {
  const source = useTelemetryStore((s) => s.status?.mission?.source ?? null);
  const uploadedAt = useTelemetryStore((s) => s.status?.mission?.uploaded_at ?? null);
  const count = useTelemetryStore((s) => s.status?.mission?.count ?? null);

  useEffect(() => {
    if (source !== "readback") {
      useMissionStore.getState().setReadback(null);
      return;
    }
    const abort = new AbortController();
    fetchMission({ signal: abort.signal })
      .then((m) => {
        // Giữa lúc hỏi và lúc trả, mission có thể đã bị thay: tin câu trả lời
        // của REST, không tin `status` cũ đã khiến ta hỏi.
        useMissionStore
          .getState()
          .setReadback(m.source === "readback" ? { waypoints: m.waypoints ?? [], uploadedAt: m.uploaded_at ?? null } : null);
      })
      .catch((err: Error) => {
        if (abort.signal.aborted) return;
        useMissionStore.getState().setReadback(null);
        useTelemetryStore
          .getState()
          .pushEvent(webEvent("warn", "api.mission_failed", `Không đọc được mission đã nạp: ${err.message}`));
      });
    return () => abort.abort();
  }, [source, uploadedAt, count]);
}
