/**
 * Chuỗi kết nối + công tắc WEB CONTROL + đồng hồ — nằm trên thanh trên cùng
 * (`shell/Topbar.tsx`) nên có mặt ở MỌI trang.
 *
 * Vẽ HAI kết nối độc lập thành một chuỗi, vì người mới rất hay nhầm chúng:
 *
 *   [Trình duyệt] ──(1)── [Backend] ──(2)── [Drone]
 *
 * (1) là WebSocket (`connection` trong store); (2) là link MAVLink mà backend
 * báo qua `telemetry.connected`. Backend chạy mà SITL tắt → (1) xanh, (2) đỏ.
 * Gộp thành một đèn thì khi mất kết nối không ai biết mất ở đoạn nào.
 */
import { Lock, LockOpen, Monitor, Server } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { IconQuad } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWebControlToggle } from "@/hooks/useWebControlToggle";
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

const LIGHT_NODE: Record<Light, string> = {
  ok: "text-hud-green ring-hud-green/45 bg-hud-green/10",
  warn: "text-hud-amber ring-hud-amber/45 bg-hud-amber/10",
  danger: "text-hud-red ring-hud-red/55 bg-hud-red/10",
  unknown: "text-muted-foreground ring-border bg-foreground/[0.04]",
};

function Node({ icon: Icon, label, light }: { icon: ComponentType<{ className?: string }>; label: string; light: Light }) {
  return (
    <span
      title={label}
      className={cn("grid size-7 shrink-0 place-items-center rounded-lg ring-1 transition-colors ring-inset", LIGHT_NODE[light])}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
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
        <div className="flex w-32 flex-col items-center px-1 xl:w-40" data-testid={testId} data-light={light}>
          <span className="sr-only">{name}</span>
          <span className={cn("max-w-full truncate font-mono text-[10.5px] leading-4 font-medium", LIGHT_TEXT[light])}>{text}</span>
          <svg viewBox="0 0 160 6" className="h-1.5 w-full" preserveAspectRatio="none" aria-hidden>
            <line x1="2" y1="3" x2="158" y2="3" className="stroke-foreground/10" strokeWidth="3" strokeLinecap="round" />
            <line
              x1="2"
              y1="3"
              x2="158"
              y2="3"
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
 * luôn lấy ĐÚNG lúc hẹn bắt đầu (bắt được ở nghiệm thu Phase 08 bài 4: một hook
 * dùng chung giữ `now` cũ và khung hình đầu hiện "thử lại sau 38 s").
 */
function RetryCountdown({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return <>Mất · thử lại {Math.max(0, Math.ceil((at - now) / 1000))} s</>;
}

export function useBrowserBackendLight(): { light: Light; text: ReactNode } {
  const connection = useTelemetryStore((s) => s.connection);
  const nextRetryAt = useTelemetryStore((s) => s.nextRetryAt);
  if (connection === "open") return { light: "ok", text: "Đã nối" };
  if (connection === "connecting") return { light: "warn", text: "Đang nối…" };
  return {
    light: "danger",
    text: nextRetryAt === null ? "Mất kết nối" : <RetryCountdown key={nextRetryAt} at={nextRetryAt} />,
  };
}

export function useBackendDroneLight(): { light: Light; text: string } {
  const socketOpen = useTelemetryStore((s) => s.connection === "open");
  const connected = useTelemetryStore((s) => s.telemetry?.connected);
  const age = useTelemetryStore((s) => s.telemetry?.link_age_ms);
  if (socketOpen && connected === true) return { light: "ok", text: `Liên lạc · ${formatNumber(age, 0, "ms")}` };
  if (socketOpen && connected === false) return { light: "danger", text: "Mất liên lạc" };
  return { light: "unknown", text: NO_VALUE };
}

export function ConnectionChain() {
  const link1 = useBrowserBackendLight();
  const link2 = useBackendDroneLight();
  return (
    <div className="flex items-center" aria-label="Chuỗi kết nối">
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
      <Node icon={IconQuad} label="Drone" light={link2.light} />
    </div>
  );
}

/** Badge WEB CONTROL bấm được. Màu theo `status` của backend, KHÔNG đổi ngay khi bấm. */
export function WebControlBadge() {
  const webControl = useTelemetryStore((s) => s.status?.safety.web_control_enabled);
  const control = useWebControlToggle();
  const LockIcon = webControl ? LockOpen : Lock;
  return (
    <button
      type="button"
      data-testid="web-control-badge"
      disabled={control.disabled}
      onClick={() => control.toggle(!control.on)}
      title={
        control.on
          ? "Web đang giữ quyền lái — bấm để trả quyền (drone dừng ngay)"
          : (control.blocker ?? "Bấm để bật WEB CONTROL: cho phép lái bằng bàn phím")
      }
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border border-border bg-foreground/[0.04] px-2.5 font-mono text-[11px] font-medium text-muted-foreground transition-colors enabled:cursor-pointer enabled:hover:bg-foreground/[0.08] disabled:opacity-70",
        webControl && "border-hud-amber/55 bg-hud-amber/12 text-hud-amber",
      )}
    >
      <LockIcon className="size-3.5" aria-hidden />
      <span className="hidden 2xl:inline">WEB CONTROL:</span>
      <span className="2xl:hidden">WEB</span>
      {webControl === undefined ? NO_VALUE : webControl ? (control.on ? "ON" : "ON · tab khác") : "OFF"}
    </button>
  );
}

export function Clock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="num text-[13px] text-foreground/80" title="Giờ trên máy này">
      {formatClock(now / 1000)}
    </span>
  );
}
