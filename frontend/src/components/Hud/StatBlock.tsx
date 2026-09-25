/**
 * Một ô số của HUD: icon + nhãn + giá trị (số to, đơn vị nhỏ) + màu + tooltip,
 * tuỳ chọn thanh đo và dòng phụ. Mọi ô HUD đi qua đây — 11 ô mỗi ô một kiểu là
 * giao diện lộn xộn.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NO_VALUE } from "@/lib/format";
import type { Tone } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  ok: "text-hud-green",
  warn: "text-hud-amber",
  danger: "text-hud-red",
};

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  ok: "bg-hud-green",
  warn: "bg-hud-amber",
  danger: "bg-hud-red",
};

/**
 * "4.9 m" → số to "4.9" + đơn vị nhỏ "m". Chỉ tách khi phần trước là SỐ: chữ
 * như "RTK fixed" giữ nguyên, không coi "fixed" là đơn vị. `—` giữ nguyên.
 */
function ValueText({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ");
  if (text === NO_VALUE || cut < 0 || !/^[+-]?\d/.test(text)) return <>{text}</>;
  return (
    <>
      {text.slice(0, cut)}
      <span className="ml-1 text-[0.65em] font-normal text-muted-foreground">{text.slice(cut + 1)}</span>
    </>
  );
}

interface StatBlockProps {
  label: string;
  icon: LucideIcon;
  /** Chuỗi đã kèm đơn vị ("4.9 m") hoặc node tự dựng. */
  value: ReactNode;
  /** Giải thích cho người mới — hiện khi rê chuột. */
  hint: string;
  tone?: Tone;
  sub?: ReactNode;
  /** 0–1: thanh đo dưới giá trị. `null` = không có số đo, thanh rỗng. */
  meter?: number | null;
  /** Node nhỏ ở góc phải (vd cột sóng GPS). */
  aside?: ReactNode;
  className?: string;
}

export function StatBlock({ label, icon: Icon, value, hint, tone = "neutral", sub, meter, aside, className }: StatBlockProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-black/20 px-3 py-2 transition-colors hover:border-hud-cyan/30",
            className,
          )}
          data-testid={`stat-${label}`}
          data-tone={tone}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{label}</span>
            {aside ? <span className="ml-auto">{aside}</span> : null}
          </div>
          <div className={cn("truncate font-mono text-lg leading-none font-semibold tabular-nums", TONE_TEXT[tone])}>
            {typeof value === "string" ? <ValueText text={value} /> : value}
          </div>
          {meter !== undefined ? (
            <div className="h-1 overflow-hidden rounded-full bg-white/8">
              {meter !== null ? (
                <div
                  className={cn("h-full rounded-full transition-[width] duration-300", TONE_BAR[tone])}
                  style={{ width: `${Math.round(Math.max(0, Math.min(1, meter)) * 100)}%` }}
                />
              ) : null}
            </div>
          ) : null}
          {sub ? <div className="text-[11px] leading-tight text-muted-foreground">{sub}</div> : null}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
