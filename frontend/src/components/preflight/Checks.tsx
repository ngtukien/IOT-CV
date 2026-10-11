/**
 * Hiển thị kết quả kiểm tra sẵn sàng bay: dải kết luận + danh sách ô kiểm.
 * Dùng ở trang Tổng quan (gọn) và trang Kiểm tra trước bay (đủ).
 */
import { CircleCheck, CircleDashed, CircleX, TriangleAlert } from "lucide-react";

import type { AutoCheck, CheckState, Verdict } from "@/lib/preflight";
import { cn } from "@/lib/utils";

export const VERDICT_TEXT: Record<Verdict, { title: string; detail: string; cls: string }> = {
  go: { title: "SẴN SÀNG", detail: "Mọi ô tự động đều đạt. Vẫn phải tự xác nhận danh sách thủ công.", cls: "border-hud-green/45 bg-hud-green/10 text-hud-green" },
  caution: { title: "SẴN SÀNG · CÓ LƯU Ý", detail: "Các ô bắt buộc đạt, còn vài lưu ý màu vàng.", cls: "border-hud-amber/50 bg-hud-amber/10 text-hud-amber" },
  nogo: { title: "CHƯA ĐƯỢC BAY", detail: "Có ô bắt buộc chưa đạt — sửa nguyên nhân trước.", cls: "border-hud-red/55 bg-hud-red/12 text-hud-red" },
  unknown: { title: "CHƯA ĐỦ DỮ LIỆU", detail: "Chưa có telemetry để kết luận. Chưa biết ≠ ổn.", cls: "border-border bg-foreground/5 text-muted-foreground" },
};

const STATE_ICON: Record<CheckState, { icon: typeof CircleCheck; cls: string; label: string }> = {
  pass: { icon: CircleCheck, cls: "text-hud-green", label: "đạt" },
  fail: { icon: CircleX, cls: "text-hud-red", label: "không đạt" },
  warn: { icon: TriangleAlert, cls: "text-hud-amber", label: "lưu ý" },
  unknown: { icon: CircleDashed, cls: "text-muted-foreground", label: "chưa biết" },
};

export function VerdictBanner({ verdict, compact }: { verdict: Verdict; compact?: boolean }) {
  const v = VERDICT_TEXT[verdict];
  return (
    <div className={cn("rounded-xl border px-4", compact ? "py-2.5" : "py-3.5", v.cls)} data-testid="preflight-verdict" data-verdict={verdict}>
      <p className={cn("font-display font-semibold tracking-[0.08em]", compact ? "text-base" : "text-xl")}>{v.title}</p>
      <p className="text-xs opacity-85">{v.detail}</p>
    </div>
  );
}

export function CheckRows({ checks, compact }: { checks: readonly AutoCheck[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {checks.map((c) => {
        const s = STATE_ICON[c.state];
        const Icon = s.icon;
        return (
          <li key={c.id} className={cn("flex items-start gap-3", compact ? "py-1.5" : "py-2.5")} data-testid={`check-${c.id}`} data-state={c.state}>
            <Icon className={cn("mt-0.5 size-4 shrink-0", s.cls)} aria-label={s.label} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug">
                {c.label}
                {c.blocking ? null : <span className="ml-1.5 text-[10.5px] text-muted-foreground">(lưu ý)</span>}
              </p>
              {compact ? null : <p className="text-xs text-muted-foreground">{c.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
