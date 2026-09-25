/**
 * Dải đỏ khi web đang giữ quyền lái (plan Phase 10 §10.1.5). Cố định trên cùng,
 * KHÔNG có nút đóng.
 *
 * Đây không phải trang trí. Người vận hành phải luôn biết website đang có thể
 * làm máy bay di chuyển, và phải luôn nhớ đường thoát: thả phím, Space, hoặc
 * gạt mode trên tay điều khiển RC.
 *
 * Hiện theo `status` của backend, không theo biến cục bộ — kể cả khi tab KHÁC
 * đang giữ quyền: drone vẫn đang có thể bị lái từ web, chỉ là không phải từ đây.
 */
import { TriangleAlert } from "lucide-react";

import { useControlStore } from "@/store/control";
import { useTelemetryStore } from "@/store/telemetry";

export function SafetyBanner() {
  const enabled = useTelemetryStore((s) => s.status?.safety.web_control_enabled === true);
  const mine = useControlStore((s) => s.claimed);
  if (!enabled) return null;

  return (
    <div
      role="alert"
      data-testid="safety-banner"
      className="flex items-center justify-center gap-3 bg-hud-red/90 px-4 py-1.5 text-center text-slate-950 shadow-[0_6px_24px_-8px] shadow-hud-red"
    >
      <TriangleAlert className="size-5 shrink-0" aria-hidden />
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-wide">
          WEB ĐANG GIỮ QUYỀN LÁI{mine ? "" : " (ở một tab khác)"} · Giữ phím để bay · Thả phím hoặc Space để dừng
        </p>
        <p className="text-xs font-medium">RC luôn có quyền cao hơn — gạt mode trên tay điều khiển là web mất quyền ngay</p>
      </div>
    </div>
  );
}
