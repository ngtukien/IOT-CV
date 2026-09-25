/**
 * Giới hạn an toàn, đọc từ `status.limits` của backend.
 *
 * Backend là nguồn sự thật: đổi `.env` của backend là UI đổi theo, không phải
 * sửa hai chỗ. Frontend KHÔNG được gõ lại số nào trong đây (max_alt,
 * max_velocity, avoid_margin_m…). `null` = chưa nhận `status` — UI phải hiện
 * "chưa biết", không được tự điền một con số mặc định.
 */
import type { LimitsPayload } from "@/lib/protocol";
import { useTelemetryStore } from "@/store/telemetry";

export function useLimits(): LimitsPayload | null {
  return useTelemetryStore((s) => s.status?.limits ?? null);
}
