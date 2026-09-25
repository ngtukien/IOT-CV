/**
 * Dải đỏ khi web đang giữ quyền lái (plan Phase 10 §10.1.5). Dính trên cùng MỌI
 * trang (trên cả header), KHÔNG có nút đóng.
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
      className="relative flex items-center justify-center gap-3 overflow-hidden bg-hud-red px-4 py-1.5 text-center text-[oklch(0.16_0.03_25)]"
    >
      {/* Sọc chéo chạy chậm — nhận ra từ khoé mắt mà không cần đọc. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20 [background:repeating-linear-gradient(-45deg,transparent_0_14px,oklch(0.1_0.02_25)_14px_28px)]"
      />
      <TriangleAlert className="relative size-5 shrink-0" aria-hidden />
      <div className="relative leading-tight">
        <p className="font-display text-sm font-semibold tracking-wide">
          WEB ĐANG GIỮ QUYỀN LÁI{mine ? "" : " (ở một tab khác)"} · Giữ phím để bay · Thả phím hoặc Space để dừng
        </p>
        <p className="text-xs font-medium">RC luôn có quyền cao hơn — gạt mode trên tay điều khiển là web mất quyền ngay</p>
      </div>
    </div>
  );
}
