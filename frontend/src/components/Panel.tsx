/**
 * Vỏ chung của mọi ô trong GCS (hệ HORIZON): kính mờ, đầu panel có icon + tên +
 * dòng phụ, và chỗ cho nút/badge ở góc phải.
 *
 * `variant="instrument"` thêm bốn góc ngoặc kiểu HUD — chỉ dùng cho THIẾT BỊ
 * (màn hình bay, radar, video, 3D), để mắt phân biệt được "đồng hồ đo" với
 * "biểu mẫu". Dùng cho mọi panel thì ngoặc mất nghĩa.
 */
import type { ComponentType, CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PanelIcon = ComponentType<{ className?: string }>;

interface PanelProps {
  title: string;
  icon: PanelIcon;
  /** Dòng nhỏ dưới tên panel — giải thích panel này dùng để làm gì. */
  subtitle?: ReactNode;
  /** Badge / nút nhỏ ở góc phải đầu panel. */
  actions?: ReactNode;
  children: ReactNode;
  variant?: "default" | "instrument";
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  testId?: string;
}

export function Panel({
  title,
  icon: Icon,
  subtitle,
  actions,
  children,
  variant = "default",
  className,
  bodyClassName,
  style,
  testId,
}: PanelProps) {
  return (
    <section
      className={cn("panel flex min-h-0 flex-col overflow-hidden", variant === "instrument" && "panel-instrument", className)}
      style={style}
      data-testid={testId}
    >
      <header className="relative flex min-h-11 shrink-0 items-center gap-2.5 px-3.5 py-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-[0.45rem] bg-hud-cyan/10 text-hud-cyan ring-1 ring-hud-cyan/25 ring-inset">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="truncate font-display text-[0.9rem] font-semibold tracking-[0.02em] text-foreground/95">{title}</h2>
          {subtitle ? <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        {/* Đường kẻ dưới đầu panel: sáng ở trái, mờ dần sang phải. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-linear-to-r from-hud-cyan/35 via-border to-transparent"
        />
      </header>
      <div className={cn("relative min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
