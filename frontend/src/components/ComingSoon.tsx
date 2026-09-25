/**
 * Ô giữ chỗ cho phần của Phase 09/10. Viết sẵn vị trí để phase sau chỉ thay
 * NỘI DUNG, không phải sắp lại bố cục — và nói rõ ô này sẽ chứa gì, để người
 * xem demo không tưởng giao diện bị hỏng.
 */
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { Panel } from "./Panel";

interface ComingSoonProps {
  title: string;
  icon: LucideIcon;
  phase: string;
  description: string;
  style?: CSSProperties;
}

export function ComingSoon({ title, icon: Icon, phase, description, style }: ComingSoonProps) {
  return (
    <Panel
      title={title}
      icon={Icon}
      style={style}
      actions={
        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          Phase {phase}
        </span>
      }
      bodyClassName="hatch grid place-items-center p-4"
    >
      <div className="flex max-w-xs flex-col items-center gap-2 text-center">
        <span className="grid size-11 place-items-center rounded-full border border-dashed border-hud-cyan/35 text-hud-cyan/70">
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground/80">
          {title} — Phase {phase}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </Panel>
  );
}
