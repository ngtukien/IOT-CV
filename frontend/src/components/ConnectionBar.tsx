/**
 * Thanh kết nối — luôn trên cùng. Vẽ HAI kết nối độc lập thành một chuỗi, vì
 * người mới rất hay nhầm chúng:
 *
 *   [Trình duyệt] ──(1)── [Backend] ──(2)── [Drone]
 *
 * (1) là WebSocket (`connection` trong store); (2) là link MAVLink mà backend
 * báo qua `telemetry.connected`. Backend chạy mà SITL tắt → (1) xanh, (2) đỏ.
 * Gộp thành một đèn thì khi mất kết nối không ai biết mất ở đoạn nào.
 */
import { Drone, Lock, LockOpen, Monitor, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NO_VALUE, formatClock, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

type Light = "ok" | "warn" | "danger" | "unknown";

const LIGHT_TEXT: Record<Light, string> = {
  ok: "text-hud-green",
  warn: "text-hud-amber",
  danger: "text-hud-red",
  unknown: "text-muted-foreground",
};

const LIGHT_STROKE: Record<Light, string> = {
  ok: "stroke-hud-green",
  warn: "stroke-hud-amber",
  danger: "stroke-hud-red",
  unknown: "stroke-muted-foreground/50",
};

const LIGHT_RING: Record<Light, string> = {
  ok: "ring-hud-green/50 text-hud-green bg-hud-green/10",
  warn: "ring-hud-amber/50 text-hud-amber bg-hud-amber/10",
  danger: "ring-hud-red/60 text-hud-red bg-hud-red/10",
  unknown: "ring-white/15 text-muted-foreground bg-white/5",
};

function Node({ icon: Icon, label, light }: { icon: LucideIcon; label: string; light: Light }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("grid size-7 place-items-center rounded-lg ring-1 transition-colors", LIGHT_RING[light])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

interface SegmentProps {
  name: string;
  light: Light;
  text: ReactNode;
  hint: string;
  testId: string;
}

/** Đoạn nối giữa hai nút: đường có "dòng chảy" khi sống, nét đứt tĩnh khi chết. */
function Segment({ name, light, text, hint, testId }: SegmentProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="-mt-3.5 flex w-44 flex-col items-center" data-testid={testId} data-light={light}>
          <span className="sr-only">{name}</span>
          <span className={cn("truncate font-mono text-[11px] font-medium", LIGHT_TEXT[light])}>{text}</span>
          <svg viewBox="0 0 160 8" className="h-2 w-full" aria-hidden>
            <line x1="2" y1="4" x2="158" y2="4" className="stroke-white/10" strokeWidth="3" strokeLinecap="round" />
            <line
              x1="2"
              y1="4"
              x2="158"
              y2="4"
              className={cn(LIGHT_STROKE[light], light === "ok" && "link-flow")}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={light === "ok" ? "8 8" : light === "danger" ? "3 6" : "1 5"}
            />
          </svg>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p className="font-semibold">{name}</p>
        <p>{hint}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * "thử lại sau N s", đếm ngược tới `at` (ms).
 *
 * Chỗ dùng gắn `key={at}`: mỗi hẹn giờ mới là một lần mount mới, nên mốc `now`
 * luôn lấy ĐÚNG lúc hẹn bắt đầu. Trước đây một hook dùng chung giữ `now` từ lần
 * render cũ rất lâu, và khung hình đầu hiện "thử lại sau 38 s" (bắt được ở
 * nghiệm thu bài 4).
 */
function RetryCountdown({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return <>Mất · thử lại sau {Math.max(0, Math.ceil((at - now) / 1000))} s</>;
}

function useBrowserBackend(): { light: Light; text: ReactNode } {
  const connection = useTelemetryStore((s) => s.connection);
  const nextRetryAt = useTelemetryStore((s) => s.nextRetryAt);
  if (connection === "open") return { light: "ok", text: "Đã nối" };
  if (connection === "connecting") return { light: "warn", text: "Đang nối…" };
  return {
    light: "danger",
    text: nextRetryAt === null ? "Mất kết nối" : <RetryCountdown key={nextRetryAt} at={nextRetryAt} />,
  };
}

function useBackendDrone(): { light: Light; text: string } {
  const socketOpen = useTelemetryStore((s) => s.connection === "open");
  const connected = useTelemetryStore((s) => s.telemetry?.connected);
  const age = useTelemetryStore((s) => s.telemetry?.link_age_ms);
  if (socketOpen && connected === true) return { light: "ok", text: `Đang liên lạc · ${formatNumber(age, 0, "ms")}` };
  if (socketOpen && connected === false) return { light: "danger", text: "Mất liên lạc" };
  return { light: "unknown", text: NO_VALUE };
}

function Clock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="font-mono text-sm tabular-nums text-foreground/80" title="Giờ trên máy này">
      {formatClock(now / 1000)}
    </span>
  );
}

function Chip({ children, title, className }: { children: ReactNode; title: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn("rounded-md border border-border bg-white/5 px-2 py-1 font-mono text-[11px] text-muted-foreground", className)}
    >
      {children}
    </span>
  );
}

export function ConnectionBar() {
  const endpoint = useTelemetryStore((s) => s.status?.endpoint);
  const version = useTelemetryStore((s) => s.status?.backend_version);
  const webControl = useTelemetryStore((s) => s.status?.safety.web_control_enabled);
  const link1 = useBrowserBackend();
  const link2 = useBackendDrone();
  const LockIcon = webControl ? LockOpen : Lock;

  return (
    <header className="panel sticky top-2 z-20 mx-3 mt-2 flex h-15 shrink-0 items-center gap-6 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-hud-cyan/90 to-sky-600 text-slate-950 shadow-[0_0_24px_-6px] shadow-hud-cyan/60">
          <Drone className="size-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-wide">IOT-CV</p>
          <p className="text-[11px] text-muted-foreground">Trạm điều khiển mặt đất</p>
        </div>
      </div>

      <div className="h-8 w-px bg-border" />

      <div className="flex items-center">
        <Node icon={Monitor} label="Trình duyệt" light="ok" />
        <Segment
          testId="link-browser-backend"
          name="Trình duyệt ↔ Backend"
          light={link1.light}
          text={link1.text}
          hint="Trang web có nói chuyện được với chương trình backend trên máy tính không (WebSocket /ws). Mất thì trang tự thử nối lại, chờ lâu dần tới tối đa 10 giây."
        />
        <Node icon={Server} label="Backend" light={link1.light === "ok" ? "ok" : link1.light === "warn" ? "warn" : "danger"} />
        <Segment
          testId="link-backend-drone"
          name="Backend ↔ Drone"
          light={link2.light}
          text={link2.text}
          hint="Backend có nghe được drone (hoặc SITL) qua MAVLink không. Chỉ biết được khi đoạn bên trái xanh — mất backend thì đoạn này hiện — (không biết), không phải đỏ."
        />
        <Node icon={Drone} label="Drone" light={link2.light} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Chip title="Backend đang nối drone qua đâu">{endpoint ?? NO_VALUE}</Chip>
        <Chip title="Phiên bản backend">v{version ?? NO_VALUE}</Chip>
        <Chip
          title="Web có đang được phép ra lệnh bay không. Phase 10 làm cho nút này bấm được."
          className={cn("flex items-center gap-1.5", webControl && "border-hud-amber/50 bg-hud-amber/10 text-hud-amber")}
        >
          <LockIcon className="size-3" aria-hidden />
          WEB CONTROL: {webControl === undefined ? NO_VALUE : webControl ? "ON" : "OFF"}
        </Chip>
        <div className="mx-1 h-6 w-px bg-border" />
        <Clock />
      </div>
    </header>
  );
}
