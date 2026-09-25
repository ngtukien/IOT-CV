/**
 * Thanh lệnh thoát hiểm nổi ở góc phải dưới — có ở MỌI trang trừ trang Bay
 * (trang Bay đã có đủ nút trong panel Chế độ bay; hai bộ nút cùng chỗ là thừa).
 *
 * Người vận hành đang xem biểu đồ hay nhật ký vẫn phải dừng được drone bằng MỘT
 * cú bấm. Chỉ ba lệnh DỪNG: HOLD, RTL, LAND — không hỏi xác nhận.
 * `data-testid` khác trang Bay (`dock-*`) để locator E2E không trùng.
 */
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router";

import { IconHold, IconLand, IconReturnHome } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { sendHold, sendLand, sendRtl } from "@/hooks/flightCommands";
import { cn } from "@/lib/utils";
import { useControlStore } from "@/store/control";
import { useTelemetryStore } from "@/store/telemetry";

const ACTIONS = [
  { key: "hold", label: "HOLD", hint: "Đứng yên tại chỗ (LOITER) · phím H", icon: IconHold, run: sendHold },
  { key: "rtl", label: "RTL", hint: "Bay về điểm cất cánh rồi hạ", icon: IconReturnHome, run: sendRtl },
  { key: "land", label: "LAND", hint: "Hạ cánh thẳng xuống tại chỗ", icon: IconLand, run: sendLand },
] as const;

export function QuickDock() {
  const { pathname } = useLocation();
  const pending = useControlStore((s) => s.pending);
  const armed = useTelemetryStore((s) => s.telemetry?.armed === true);
  if (pathname === "/") return null;
  const waiting = new Set(Object.values(pending).map((p) => p.target));

  return (
    <div
      className={cn(
        "glass-fixed fixed right-4 bottom-4 z-30 flex items-center gap-1 rounded-2xl p-1.5 shadow-[0_18px_40px_-18px] shadow-(color:--shadow-tint)",
        armed && "ring-1 ring-hud-red/40",
      )}
      role="toolbar"
      aria-label="Lệnh thoát hiểm"
      data-testid="quick-dock"
    >
      <span className="eyebrow hidden px-2 text-[9.5px] sm:block">{armed ? "Đang bay" : "Thoát hiểm"}</span>
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Tooltip key={a.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => a.run()}
                data-testid={`dock-${a.key}`}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-hud-cyan/30 bg-hud-cyan/10 px-3 font-mono text-xs font-semibold text-hud-cyan transition-colors hover:bg-hud-cyan/20 active:translate-y-px"
              >
                {waiting.has(a.key) ? <Loader2 className="size-4 animate-spin" aria-label="Đang chờ FC" /> : <Icon className="size-4" />}
                {a.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{a.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
