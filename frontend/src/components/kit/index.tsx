/**
 * Khối dựng nhỏ dùng chung của HORIZON: đầu trang, chấm trạng thái, dòng
 * khoá–giá trị, sparkline, trạng thái trống. Không logic nghiệp vụ nào ở đây.
 */
import type { ComponentType, ReactNode } from "react";
import { useMemo } from "react";

import { NO_VALUE } from "@/lib/format";
import { TONE_DOT, TONE_TEXT } from "@/lib/tone";
import type { Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Đầu trang
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="font-display text-2xl leading-tight font-semibold tracking-[0.01em] sm:text-[1.7rem]">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chấm trạng thái
// ---------------------------------------------------------------------------

export function StatusDot({ tone, pulse, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      {pulse ? <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", TONE_DOT[tone])} /> : null}
      <span className={cn("relative size-2 rounded-full", TONE_DOT[tone])} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Khoá — giá trị
// ---------------------------------------------------------------------------

export function KeyValue({
  label,
  value,
  hint,
  tone,
  mono = true,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  mono?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5" title={hint} data-testid={testId}>
      <dt className="min-w-0 truncate text-[13px] text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right text-[13px]", mono && "num", tone ? TONE_TEXT[tone] : "text-foreground")}>
        {value ?? NO_VALUE}
      </dd>
    </div>
  );
}

export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-border", className)}>{children}</dl>;
}

// ---------------------------------------------------------------------------
// Sparkline — xu hướng ngắn, không trục, không nhãn
// ---------------------------------------------------------------------------

/**
 * Đường xu hướng nhỏ. `null` trong chuỗi = mất số đo → NGẮT nét, không nối
 * thẳng qua (nối qua là vẽ ra số liệu không có thật).
 */
export function Sparkline({
  values,
  className,
  color = "var(--hud-cyan)",
  min,
  max,
  height = 28,
  fill = true,
}: {
  values: readonly (number | null)[];
  className?: string;
  color?: string;
  min?: number;
  max?: number;
  height?: number;
  fill?: boolean;
}) {
  const width = 120;
  const paths = useMemo(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 2) return null;
    const lo = min ?? Math.min(...nums);
    const hi = max ?? Math.max(...nums);
    const span = hi - lo || 1;
    const n = values.length;
    const x = (i: number) => (i / (n - 1)) * width;
    const y = (v: number) => height - 2 - ((v - lo) / span) * (height - 4);
    let line = "";
    let area = "";
    let runStart: number | null = null;
    values.forEach((v, i) => {
      if (v === null) {
        if (runStart !== null) area += `L${x(i - 1)},${height}L${x(runStart)},${height}Z`;
        runStart = null;
        return;
      }
      const cmd = runStart === null ? "M" : "L";
      if (runStart === null) runStart = i;
      line += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      area += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    if (runStart !== null) area += `L${x(n - 1)},${height}L${x(runStart)},${height}Z`;
    return { line, area };
  }, [values, min, max, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("block w-full", className)} style={{ height }} aria-hidden>
      {paths ? (
        <>
          {fill ? <path d={paths.area} fill={color} opacity={0.12} /> : null}
          <path d={paths.line} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </>
      ) : (
        <line x1="0" x2={width} y1={height - 2} y2={height - 2} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Trạng thái trống
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-xl bg-foreground/5 text-muted-foreground ring-1 ring-border ring-inset">
        <Icon className="size-5" />
      </span>
      <p className="font-display text-sm font-semibold">{title}</p>
      {children ? <div className="max-w-sm text-xs text-muted-foreground">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thanh đo ngang
// ---------------------------------------------------------------------------

export function Meter({ value, tone = "neutral", className }: { value: number | null; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-foreground/8", className)}>
      {value !== null ? (
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", TONE_DOT[tone])}
          style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
        />
      ) : null}
    </div>
  );
}

/** Nhãn nhỏ cạnh số: "GIẢ LẬP", "CHƯA XÁC MINH"… — ô vuông, không bo tròn kiểu viên thuốc. */
export function Tag({ tone = "neutral", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-px font-mono text-[10px] font-semibold tracking-wider uppercase",
        tone === "neutral" ? "border-border text-muted-foreground" : null,
        tone === "ok" ? "border-hud-green/45 bg-hud-green/10 text-hud-green" : null,
        tone === "warn" ? "border-hud-amber/50 bg-hud-amber/10 text-hud-amber" : null,
        tone === "danger" ? "border-hud-red/55 bg-hud-red/12 text-hud-red" : null,
        className,
      )}
    >
      {children}
    </span>
  );
}
