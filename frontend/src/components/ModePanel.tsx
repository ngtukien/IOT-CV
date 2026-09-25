/**
 * Panel CHẾ ĐỘ BAY (plan Phase 10 §10.3): mode, ARM/DISARM, TAKEOFF, RTL, LAND
 * và nút HOLD lớn.
 *
 * Ma sát đặt tương xứng với hậu quả (§10.3.2). Hỏi xác nhận mọi lệnh thì người
 * dùng học cách bấm OK mà không đọc, nên:
 *
 *   hỏi khi hậu quả là BẮT ĐẦU một điều gì đó  → ARM, TAKEOFF, AUTO
 *   hỏi khi hậu quả có thể là MẤT máy bay       → DISARM, STABILIZE
 *   KHÔNG hỏi khi hậu quả là DỪNG điều gì đó    → HOLD, RTL, LAND, các mode "đứng yên"
 *
 * HOLD / RTL / LAND là nút thoát hiểm. Bắt xác nhận lúc đang hoảng là phản tác dụng.
 *
 * STABILIZE không có trong bảng §10.3.2. Nó được xếp vào nhóm hỏi: đó là mode
 * tay, ga lấy thẳng từ cần ga RC — gạt sang STABILIZE khi đang bay mà cần ga RC
 * đang ở thấp (hoặc SITL không có RC) là máy bay rơi.
 *
 * Nút KHÔNG tự đổi màu khi bấm (§10.3.4): mode sáng theo `telemetry.mode`, ARM
 * theo `telemetry.armed`. Trong lúc chờ FC xác nhận, nút chỉ hiện vòng xoay.
 */
import { Loader2, OctagonPause, PlaneLanding, PlaneTakeoff, Power, ShieldAlert, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AltField } from "@/components/MissionEditor/AltField";
import { Panel } from "@/components/Panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { sendCommand } from "@/hooks/controlUplink";
import { useLimits } from "@/hooks/useLimits";
import { formatNumber } from "@/lib/format";
import { WEB_MODES } from "@/lib/protocol";
import type { CmdMode } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useControlStore } from "@/store/control";
import { useMissionStore } from "@/store/mission";
import { useTelemetryStore } from "@/store/telemetry";

type WebMode = CmdMode["mode"];

/** Chữ bắt người dùng GÕ trong hộp ARM — gõ thì phải đọc, bấm OK thì không. */
export const ARM_CONFIRM_WORD = "ARM";

/** Độ cao cất cánh gợi ý — cùng mốc 5 m của mission (Phase 09). Kẹp vào [min_alt, max_alt]. */
export const DEFAULT_TAKEOFF_ALT_M = 5;

/** Phím tắt của HOLD (§10.3.3). */
export const HOLD_KEY = "KeyH";

const MODE_LABEL: Record<WebMode, string> = {
  GUIDED: "GUIDED",
  LOITER: "LOITER",
  ALT_HOLD: "ALT HOLD",
  POSHOLD: "POSHOLD",
  BRAKE: "BRAKE",
  RTL: "RTL",
  LAND: "LAND",
  AUTO: "AUTO",
  STABILIZE: "STABILIZE",
};

const MODE_HINT: Record<WebMode, string> = {
  GUIDED: "Mở đường cho lệnh từ web (lái tay, cất cánh). Bản thân nó chưa làm gì.",
  LOITER: "Giữ nguyên vị trí và độ cao bằng GPS. FC tự phanh trước vật cản ở mode này.",
  ALT_HOLD: "Giữ độ cao, KHÔNG giữ vị trí — gió sẽ đẩy trôi.",
  POSHOLD: "Giữ vị trí như LOITER, cảm giác lái kiểu khác.",
  BRAKE: "Phanh gấp và đứng yên.",
  RTL: "Bay về điểm cất cánh rồi hạ cánh. Nút thoát hiểm — không hỏi.",
  LAND: "Hạ cánh thẳng xuống tại chỗ. Nút thoát hiểm — không hỏi.",
  AUTO: "Bay mission đã nạp trên máy bay.",
  STABILIZE: "Mode tay: ga lấy từ RC. Có hỏi xác nhận.",
};

/**
 * Đích của các lệnh đang chờ FC xác nhận ("GUIDED", "arm", "takeoff"…).
 * Chọn `pending` (object ổn định) rồi mới dựng Set — selector trả Set mới mỗi
 * lần sẽ làm zustand render lại vô hạn.
 */
function usePendingTargets(): ReadonlySet<string> {
  const pending = useControlStore((s) => s.pending);
  return new Set(Object.values(pending).map((p) => p.target));
}

// ---------------------------------------------------------------------------
// Hộp xác nhận dùng chung
// ---------------------------------------------------------------------------

interface ConfirmProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone: "warn" | "danger";
  /** Bắt gõ đúng chữ này mới bấm được xác nhận. */
  requireWord?: string;
  onConfirm(): void;
}

function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, tone, requireWord, onConfirm }: ConfirmProps) {
  const [typed, setTyped] = useState("");
  const ready = !requireWord || typed.trim().toUpperCase() === requireWord;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className={cn(tone === "danger" ? "border-hud-red/60" : "border-hud-amber/50")} data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className={cn("flex items-center gap-2", tone === "danger" ? "text-hud-red" : "text-hud-amber")}>
            <ShieldAlert className="size-5" aria-hidden /> {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireWord ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Gõ <span className="font-mono font-bold text-foreground">{requireWord}</span> để xác nhận
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              data-testid="confirm-word"
              className="font-mono uppercase"
              autoComplete="off"
            />
          </label>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready}
            data-testid="confirm-ok"
            className={cn(tone === "danger" ? "bg-hud-red text-slate-950 hover:bg-hud-red/85" : "bg-hud-amber text-slate-950 hover:bg-hud-amber/85")}
            onClick={() => {
              setTyped("");
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Nút
// ---------------------------------------------------------------------------

interface CmdButtonProps {
  icon?: LucideIcon;
  label: string;
  hint: string;
  active?: boolean;
  pending?: boolean;
  disabled?: boolean;
  tone?: "default" | "warn" | "danger" | "exit";
  onClick(): void;
  testId: string;
  className?: string;
}

const TONE: Record<NonNullable<CmdButtonProps["tone"]>, string> = {
  default: "border-border bg-white/4 hover:bg-white/8",
  warn: "border-hud-amber/40 bg-hud-amber/10 text-hud-amber hover:bg-hud-amber/20",
  danger: "border-hud-red/50 bg-hud-red/12 text-hud-red hover:bg-hud-red/22",
  exit: "border-hud-cyan/40 bg-hud-cyan/10 text-hud-cyan hover:bg-hud-cyan/20",
};

function CmdButton({ icon: Icon, label, hint, active, pending, disabled, tone = "default", onClick, testId, className }: CmdButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span giữ tooltip sống khi nút bị disabled (nút disabled không nhận hover) */}
        <span className={cn("inline-flex", className)}>
          <Button
            variant="outline"
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
            data-active={active ?? false}
            aria-pressed={active}
            className={cn(
              "h-9 w-full font-mono text-xs tracking-wide",
              TONE[tone],
              active && "border-hud-green/70 bg-hud-green/18 text-hud-green shadow-[0_0_16px_-6px] shadow-hud-green",
            )}
          >
            {pending ? <Loader2 className="animate-spin" aria-label="Đang chờ FC" /> : Icon ? <Icon aria-hidden /> : null}
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{hint}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

type Dialog = null | { kind: "arm" } | { kind: "disarm" } | { kind: "takeoff" } | { kind: "auto" } | { kind: "stabilize" };

function sendMode(mode: WebMode): void {
  sendCommand("cmd.mode", { mode }, { label: `Mode ${MODE_LABEL[mode]}`, target: mode });
}

function sendHold(): void {
  sendCommand("cmd.hold", {}, { label: "HOLD (LOITER)", target: "hold" });
}

function ModeGrid({ onAsk }: { onAsk(d: Dialog): void }) {
  const mode = useTelemetryStore((s) => s.telemetry?.mode);
  const ready = useTelemetryStore((s) => s.connection === "open" && s.telemetry?.connected === true);
  const missionSource = useTelemetryStore((s) => s.status?.mission?.source);
  const pendingByMode = usePendingTargets();

  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Chế độ bay">
      {WEB_MODES.map((m) => {
        const autoLocked = m === "AUTO" && missionSource !== "readback";
        const exit = m === "RTL" || m === "LAND";
        return (
          <CmdButton
            key={m}
            label={MODE_LABEL[m]}
            hint={autoLocked ? "Chưa có mission nào trên máy bay — nạp và đọc lại mission trước (panel Mission)" : MODE_HINT[m]}
            active={mode === m}
            pending={pendingByMode.has(m)}
            disabled={!ready || autoLocked}
            tone={exit ? "exit" : m === "STABILIZE" ? "warn" : "default"}
            testId={`mode-${m}`}
            onClick={() => {
              if (m === "AUTO") onAsk({ kind: "auto" });
              else if (m === "STABILIZE") onAsk({ kind: "stabilize" });
              else sendMode(m);
            }}
          />
        );
      })}
    </div>
  );
}

function useHoldShortcut(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== HOLD_KEY || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      sendHold();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function ModePanel({ style }: { style?: CSSProperties }) {
  useHoldShortcut();
  const [dialog, setDialog] = useState<Dialog>(null);
  const limits = useLimits();
  // `null` = người dùng chưa gõ gì → dùng gợi ý 5 m kẹp vào [min_alt, max_alt]
  // của backend. Số người dùng GÕ thì không bao giờ tự kẹp: ngoài khoảng thì
  // AltField báo đỏ và nút bị khoá.
  const [typedAlt, setTypedAlt] = useState<number | null>(null);

  const armed = useTelemetryStore((s) => s.telemetry?.armed);
  const mode = useTelemetryStore((s) => s.telemetry?.mode);
  const alt = useTelemetryStore((s) => s.telemetry?.relative_alt);
  const ready = useTelemetryStore((s) => s.connection === "open" && s.telemetry?.connected === true);
  const readback = useMissionStore((s) => s.readback);
  const pending = usePendingTargets();
  const armPending = pending.has("arm") || pending.has("disarm");

  const takeoffAlt =
    typedAlt ?? (limits ? Math.min(Math.max(DEFAULT_TAKEOFF_ALT_M, limits.min_alt), limits.max_alt) : DEFAULT_TAKEOFF_ALT_M);

  const altInvalid = !Number.isFinite(takeoffAlt) || !limits || takeoffAlt < limits.min_alt || takeoffAlt > limits.max_alt;
  const takeoffBlocker = !ready
    ? "Chưa liên lạc được với drone"
    : armed !== true
      ? "Cần ARM trước"
      : mode !== "GUIDED"
        ? "Cần GUIDED trước"
        : altInvalid
          ? `Độ cao phải trong [${limits?.min_alt ?? "?"}, ${limits?.max_alt ?? "?"}] m`
          : null;

  const missionMaxAlt = readback?.waypoints.reduce((m, w) => Math.max(m, w.alt), 0) ?? null;
  const close = () => setDialog(null);

  return (
    <Panel title="Chế độ bay" icon={Power} style={style} testId="mode-panel" bodyClassName="flex flex-col gap-3 p-3">
      <CmdButton
        icon={OctagonPause}
        label="HOLD — đứng yên (phím H)"
        hint="Chuyển LOITER: dừng lại, giữ nguyên vị trí và độ cao. Luôn bấm được, không hỏi."
        pending={pending.has("hold")}
        tone="exit"
        testId="cmd-hold"
        onClick={sendHold}
        className="[&_button]:h-14 [&_button]:text-base"
      />

      <ModeGrid onAsk={setDialog} />

      <div className="grid grid-cols-2 gap-1.5">
        {armed ? (
          <CmdButton
            icon={Power}
            label="DISARM"
            hint="Tắt motor. Nếu đang bay, máy bay sẽ RƠI. Có hỏi xác nhận."
            pending={armPending}
            disabled={!ready}
            tone="danger"
            testId="cmd-disarm"
            onClick={() => setDialog({ kind: "disarm" })}
          />
        ) : (
          <CmdButton
            icon={Power}
            label="ARM"
            hint="Cho motor quay. Có hỏi xác nhận."
            pending={armPending}
            disabled={!ready}
            tone="warn"
            testId="cmd-arm"
            onClick={() => setDialog({ kind: "arm" })}
          />
        )}
        <CmdButton
          icon={PlaneTakeoff}
          label={`TAKEOFF ${formatNumber(takeoffAlt, 1, "m")}`}
          hint={takeoffBlocker ?? "Cất cánh thẳng đứng tới độ cao đã chọn. Có hỏi xác nhận."}
          pending={pending.has("takeoff")}
          disabled={takeoffBlocker !== null}
          tone="warn"
          testId="cmd-takeoff"
          onClick={() => setDialog({ kind: "takeoff" })}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Độ cao cất cánh</span>
        <AltField value={takeoffAlt} onChange={setTypedAlt} limits={limits} invalid={altInvalid} label="Độ cao cất cánh" testId="takeoff-alt" />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <CmdButton icon={Undo2} label="RTL — về nhà" hint={MODE_HINT.RTL} disabled={!ready} tone="exit" testId="cmd-rtl"
          pending={pending.has("rtl")}
          onClick={() => sendCommand("cmd.rtl", {}, { label: "RTL", target: "rtl" })} />
        <CmdButton icon={PlaneLanding} label="LAND — hạ cánh" hint={MODE_HINT.LAND} disabled={!ready} tone="exit" testId="cmd-land"
          pending={pending.has("land")}
          onClick={() => sendCommand("cmd.land", {}, { label: "LAND", target: "land" })} />
      </div>

      <ConfirmDialog
        open={dialog?.kind === "arm"}
        onOpenChange={(o) => !o && close()}
        title="ARM — motor sẽ bắt đầu quay"
        confirmLabel="ARM"
        tone="warn"
        requireWord={ARM_CONFIRM_WORD}
        onConfirm={() => sendCommand("cmd.arm", { arm: true }, { label: "ARM", target: "arm" })}
      >
        <p>Sau lệnh này cánh quạt quay. Với drone thật, đây là lúc có thể bị thương.</p>
        <p className="font-semibold text-hud-amber">Với drone thật: đã tháo cánh chưa? (SAFETY.md mục 2 — NO PROPELLERS)</p>
        <p>Người vận hành phải đang cầm tay điều khiển RC.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "disarm"}
        onOpenChange={(o) => !o && close()}
        title="DISARM — tắt motor"
        confirmLabel="DISARM"
        tone="danger"
        onConfirm={() => sendCommand("cmd.arm", { arm: false }, { label: "DISARM", target: "disarm" })}
      >
        <p className="font-semibold text-hud-red">Nếu đang bay, máy bay sẽ RƠI.</p>
        <p>
          Độ cao hiện tại: <span className="font-mono">{formatNumber(alt, 1, "m")}</span>. Muốn xuống an toàn thì dùng LAND, không dùng DISARM.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "takeoff"}
        onOpenChange={(o) => !o && close()}
        title={`TAKEOFF — cất cánh lên ${formatNumber(takeoffAlt, 1, "m")}`}
        confirmLabel="Cất cánh"
        tone="warn"
        onConfirm={() => sendCommand("cmd.takeoff", { altitude: takeoffAlt }, { label: `TAKEOFF ${takeoffAlt} m`, target: "takeoff" })}
      >
        <p>Máy bay sẽ rời mặt đất và bay thẳng lên {formatNumber(takeoffAlt, 1, "m")}.</p>
        <p>Kiểm quanh drone không có người, và tay đang cầm RC.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "auto"}
        onOpenChange={(o) => !o && close()}
        title="AUTO — bắt đầu mission"
        confirmLabel="Bắt đầu mission"
        tone="warn"
        onConfirm={() => sendMode("AUTO")}
      >
        <p>
          Máy bay sẽ tự bay mission đang nằm trên FC:{" "}
          <span className="font-mono">{readback ? `${readback.waypoints.length} item` : "—"}</span>, cao nhất{" "}
          <span className="font-mono">{formatNumber(missionMaxAlt, 1, "m")}</span>.
        </p>
        <p className="text-hud-amber">Ở AUTO, FC KHÔNG tự tránh vật cản (xem panel Vật cản).</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "stabilize"}
        onOpenChange={(o) => !o && close()}
        title="STABILIZE — mode lái tay bằng RC"
        confirmLabel="Chuyển STABILIZE"
        tone="danger"
        onConfirm={() => sendMode("STABILIZE")}
      >
        <p className="font-semibold text-hud-red">Ga lấy thẳng từ cần ga RC. Đang bay mà cần ga ở thấp, máy bay sẽ RƠI.</p>
        <p>Chỉ dùng khi người vận hành đang cầm RC và sẵn sàng lái.</p>
      </ConfirmDialog>
    </Panel>
  );
}
