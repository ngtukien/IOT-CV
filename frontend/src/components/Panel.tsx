/**
 * Vỏ chung của mọi ô trên màn hình GCS: kính mờ, đầu panel có icon + tên +
 * chỗ cho badge bên phải. Phase 09/10 bọc nội dung của mình trong đây để cả
 * màn hình cùng một ngôn ngữ thiết kế.
 */
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  icon: LucideIcon;
  /** Badge / nút nhỏ ở góc phải đầu panel. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  testId?: string;
}

export function Panel({ title, icon: Icon, actions, children, className, bodyClassName, style, testId }: PanelProps) {
  return (
    <section className={cn("panel flex min-h-0 flex-col overflow-hidden", className)} style={style} data-testid={testId}>
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="grid size-6 place-items-center rounded-md bg-hud-cyan/12 text-hud-cyan ring-1 ring-hud-cyan/25">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <h2 className="text-xs font-semibold tracking-[0.12em] text-foreground/85 uppercase">{title}</h2>
        {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
