/**
 * Header hai tầng, dính trên cùng MỌI trang — thay cho thanh bên trái để trả
 * toàn bộ chiều ngang màn hình cho nội dung (bản đồ, 3D, biểu đồ).
 *
 *   Tầng 1 (48 px): logo · tab các trang · phím tắt · thông báo · theme · giờ
 *   Tầng 2 (36 px): chuỗi kết nối · mode · ARMED · pin · GPS · giờ bay · WEB CONTROL
 *
 * Tầng 2 là dải trạng thái sống còn: đi trang nào cũng thấy drone đang ra sao.
 *
 * Tab là của ROUTER phía trình duyệt: đổi trang KHÔNG tải lại trang, nên
 * WebSocket (và quyền lái đang giữ) sống qua mọi lần chuyển trang.
 *
 * Màn hẹp: tab chỉ còn icon (tab đang mở vẫn giữ chữ), hai tầng cuộn ngang.
 */
import { Bell, Keyboard, Moon, Sun, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

import { PAGES } from "@/app/routes";
import { Clock, ConnectionChain, WebControlBadge } from "@/components/ConnectionBar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useResolvedTheme } from "@/hooks/useApplySettings";
import { useFlightTime } from "@/hooks/useFlightTime";
import { useUnread } from "@/hooks/useUnread";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { useUiStore } from "@/store/ui";

import { BrandMark } from "./BrandMark";
import { ArmedChip, BatteryChip, GpsChip, ModeChip } from "./VehicleChips";

function NavTabs() {
  return (
    <nav aria-label="Các trang" className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
      {PAGES.map((page) => {
        const Icon = page.icon;
        return (
          <Tooltip key={page.path}>
            <TooltipTrigger asChild>
              <NavLink
                to={page.path}
                end={page.path === "/"}
                data-testid={page.testId}
                className={({ isActive }) =>
                  cn(
                    "group relative flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("size-[17px] shrink-0", isActive && "text-hud-cyan")} />
                    <span className={cn(isActive ? "inline" : "hidden 2xl:inline")}>{page.label}</span>
                    {page.path === "/logs" ? <UnreadDot /> : null}
                    {/* Vạch sáng dưới tab đang mở, dính vào mép dưới của tầng 1. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-2 -bottom-[7px] h-[2px] rounded-full bg-hud-cyan transition-opacity",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </>
                )}
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64">
              <p className="font-semibold">
                {page.label} <span className="ml-1 font-mono font-normal opacity-60">Alt+{page.hotkey}</span>
              </p>
              <p className="opacity-80">{page.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function UnreadDot() {
  const { count, hasError } = useUnread();
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "grid h-4 min-w-4 place-items-center rounded-[5px] px-1 font-mono text-[10px] leading-none font-bold text-background",
        hasError ? "bg-hud-red" : "bg-hud-amber",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ToolButton({ label, onClick, children, testId }: { label: string; onClick(): void; children: ReactNode; testId?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          data-testid={testId}
          className="relative grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function Tools() {
  const setNotifications = useUiStore((s) => s.setNotifications);
  const setShortcuts = useUiStore((s) => s.setShortcuts);
  const setSetting = useSettings((s) => s.set);
  const theme = useResolvedTheme();
  const { count, hasError } = useUnread();

  return (
    <div className="flex shrink-0 items-center gap-1">
      <ToolButton label="Phím tắt (?)" onClick={() => setShortcuts(true)} testId="open-shortcuts">
        <Keyboard className="size-4" />
      </ToolButton>
      <ToolButton label={count > 0 ? `${count} cảnh báo chưa xem` : "Thông báo"} onClick={() => setNotifications(true)} testId="open-notifications">
        <Bell className="size-4" />
        {count > 0 ? (
          <span className={cn("absolute top-1 right-1 size-2 rounded-full ring-2 ring-background", hasError ? "bg-hud-red" : "bg-hud-amber")} />
        ) : null}
      </ToolButton>
      <ToolButton
        label={theme === "night" ? "Chuyển sang theme Ngày (đọc ngoài nắng)" : "Chuyển sang theme Đêm"}
        onClick={() => setSetting("theme", theme === "night" ? "day" : "night")}
        testId="toggle-theme"
      >
        {theme === "night" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </ToolButton>
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
      <span className="hidden sm:inline">
        <Clock />
      </span>
    </div>
  );
}

function FlightTimeChip() {
  const { seconds, seenMidFlight } = useFlightTime();
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11.5px] font-semibold whitespace-nowrap",
        seconds === null ? "border-border text-muted-foreground" : "border-hud-cyan/35 bg-hud-cyan/8 text-hud-cyan",
      )}
      title={
        seconds === null
          ? "Thời gian bay — bắt đầu đếm khi drone ARMED"
          : seenMidFlight
            ? "Thời gian bay tính từ lúc trang này thấy ARMED (trang mở giữa chuyến bay)"
            : "Thời gian bay từ lúc ARMED"
      }
      data-testid="chip-flight-time"
    >
      <Timer className="size-3.5" aria-hidden />
      {formatDuration(seconds)}
      {seconds !== null && seenMidFlight ? "+" : ""}
    </span>
  );
}

export function AppHeader() {
  return (
    <header className="glass-fixed border-x-0 border-t-0">
      <div className="mx-auto flex h-12 max-w-[2400px] items-center gap-3 px-3 sm:px-4">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="IOT-CV — về trang Bay">
          <BrandMark className="size-8" />
          <span className="hidden leading-none md:block">
            <span className="block font-display text-[15px] font-semibold tracking-[0.08em]">IOT-CV</span>
            <span className="block text-[10.5px] text-muted-foreground">Trạm mặt đất</span>
          </span>
        </NavLink>
        <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
        <NavTabs />
        <div className="ml-auto" />
        <Tools />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex h-11 max-w-[2400px] items-center gap-3 overflow-x-auto px-3 [scrollbar-width:none] sm:px-4">
          <ConnectionChain />
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
          <div className="flex shrink-0 items-center gap-1.5">
            <ModeChip />
            <ArmedChip />
            <BatteryChip />
            <GpsChip />
            <FlightTimeChip />
          </div>
          <div className="ml-auto shrink-0">
            <WebControlBadge />
          </div>
        </div>
      </div>
    </header>
  );
}
