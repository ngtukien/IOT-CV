/**
 * Nhật ký sự kiện: `event` của backend + sự kiện của chính web (mất/nối lại
 * socket, message hỏng). Mới nhất ở trên, tối đa 200 dòng, lọc nhanh theo mức.
 *
 * Giờ lấy theo lúc sự kiện XẢY RA (`data.ts`), không phải lúc gửi — backend
 * phát lại sự kiện cũ cho tab mới mở. `code` chỉ nằm trong tooltip: nó dành
 * cho người sửa lỗi, không cho người dùng.
 */
import { Info, OctagonX, TriangleAlert } from "lucide-react";

import { IconLog } from "@/components/icons";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { Panel } from "@/components/Panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatClock } from "@/lib/format";
import { EVENT_LEVELS } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";
import type { LogEntry } from "@/store/telemetry";

type Level = LogEntry["level"];

const LEVEL_STYLE: Record<Level, { icon: LucideIcon; text: string; bar: string; chip: string; label: string }> = {
  info: { icon: Info, text: "text-hud-cyan", bar: "bg-hud-cyan/60", chip: "border-hud-cyan/35 bg-hud-cyan/10 text-hud-cyan", label: "Thông tin" },
  warn: { icon: TriangleAlert, text: "text-hud-amber", bar: "bg-hud-amber", chip: "border-hud-amber/40 bg-hud-amber/10 text-hud-amber", label: "Cảnh báo" },
  error: { icon: OctagonX, text: "text-hud-red", bar: "bg-hud-red", chip: "border-hud-red/45 bg-hud-red/12 text-hud-red", label: "Lỗi" },
};

function LevelFilter({ active, counts, onToggle }: { active: Set<Level>; counts: Record<Level, number>; onToggle(level: Level): void }) {
  return (
    <div className="flex gap-1">
      {EVENT_LEVELS.map((level) => {
        const { icon: Icon, chip, label } = LEVEL_STYLE[level];
        const on = active.has(level);
        return (
          <button
            key={level}
            type="button"
            onClick={() => onToggle(level)}
            aria-pressed={on}
            title={`${on ? "Ẩn" : "Hiện"} mức "${label}"`}
            className={cn(
              "flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-opacity",
              chip,
              on ? "opacity-100" : "opacity-35 grayscale",
            )}
          >
            <Icon className="size-3" aria-hidden />
            {level}
            <span className="tabular-nums opacity-80">{counts[level]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Row({ e }: { e: LogEntry }) {
  const { icon: Icon, text, bar } = LEVEL_STYLE[e.level];
  return (
    <li className="group relative flex items-start gap-3 rounded-md py-1.5 pr-2 pl-3 hover:bg-foreground/4" data-code={e.code}>
      <span className={cn("absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full", bar)} aria-hidden />
      <span className="w-16 shrink-0 pt-px font-mono text-[11px] text-muted-foreground tabular-nums">{formatClock(e.ts)}</span>
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", text)} aria-label={e.level} />
      <span className="w-16 shrink-0 truncate rounded bg-foreground/5 px-1.5 py-px text-center font-mono text-[10px] text-muted-foreground">
        {e.source}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/90">{e.message}</span>
        </TooltipTrigger>
        <TooltipContent className="font-mono">{e.code}</TooltipContent>
      </Tooltip>
    </li>
  );
}

export function EventLog({ style, className }: { style?: CSSProperties; className?: string }) {
  const events = useTelemetryStore((s) => s.events);
  const [active, setActive] = useState<Set<Level>>(() => new Set(EVENT_LEVELS));

  const shown = useMemo(() => events.filter((e) => active.has(e.level)), [events, active]);
  const counts = useMemo(() => {
    const c: Record<Level, number> = { info: 0, warn: 0, error: 0 };
    for (const e of events) c[e.level] += 1;
    return c;
  }, [events]);

  const toggle = (level: Level) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  return (
    <Panel
      title="Nhật ký sự kiện"
      icon={IconLog}
      style={style}
      className={className}
      testId="event-log"
      actions={
        <>
          <span className="mr-1 font-mono text-[11px] text-muted-foreground tabular-nums">
            {shown.length}/{events.length}
          </span>
          <LevelFilter active={active} counts={counts} onToggle={toggle} />
        </>
      }
    >
      <ScrollArea className="h-full">
        {shown.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {events.length === 0 ? "Chưa có sự kiện nào." : "Không có sự kiện nào ở mức đang chọn."}
          </p>
        ) : (
          <ul className="flex flex-col p-1.5">
            {shown.map((e) => (
              <Row key={e.key} e={e} />
            ))}
          </ul>
        )}
      </ScrollArea>
    </Panel>
  );
}
