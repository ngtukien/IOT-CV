/**
 * Một dòng của bảng mission. Ba loại dòng dùng chung khung này:
 *  - CẤT CÁNH (đầu) và VỀ NHÀ/HẠ CÁNH (cuối): cố định, không xoá, không đổi chỗ;
 *  - WAYPOINT: đổi thứ tự bằng ▲▼, xoá bằng ✕.
 *
 * `seq` do bảng truyền vào, tính từ vị trí — không lưu, nên không bao giờ nhảy cóc.
 */
import { ArrowDown, ArrowUp, Lock, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RowShellProps {
  seq: number;
  title: ReactNode;
  detail?: ReactNode;
  alt?: ReactNode;
  actions?: ReactNode;
  invalid?: boolean;
  fixed?: boolean;
  testId?: string;
}

export function RowShell({ seq, title, detail, alt, actions, invalid, fixed, testId }: RowShellProps) {
  return (
    <li
      data-testid={testId}
      data-seq={seq}
      data-invalid={invalid || undefined}
      className={cn(
        "grid grid-cols-[2.25rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border px-2 py-1.5",
        fixed ? "border-border bg-foreground/3" : "border-border/60",
        invalid && "border-hud-red/60 bg-hud-red/[0.07]",
      )}
    >
      <span className="font-mono text-xs text-muted-foreground tabular-nums">#{seq}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-xs font-semibold tracking-wide">
          {fixed ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Cố định" /> : null}
          {title}
        </p>
        {detail ? <p className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">{detail}</p> : null}
      </div>
      <div>{alt}</div>
      <div className="flex items-center gap-0.5">{actions}</div>
    </li>
  );
}

interface WaypointActionsProps {
  isFirst: boolean;
  isLast: boolean;
  onMove(dir: "up" | "down"): void;
  onRemove(): void;
  seq: number;
}

export function WaypointActions({ isFirst, isLast, onMove, onRemove, seq }: WaypointActionsProps) {
  return (
    <>
      <Button size="icon-xs" variant="ghost" disabled={isFirst} aria-label={`Đưa WP${seq} lên`} onClick={() => onMove("up")}>
        <ArrowUp />
      </Button>
      <Button size="icon-xs" variant="ghost" disabled={isLast} aria-label={`Đưa WP${seq} xuống`} onClick={() => onMove("down")}>
        <ArrowDown />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        className="text-hud-red hover:text-hud-red"
        aria-label={`Xoá WP${seq}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </>
  );
}
