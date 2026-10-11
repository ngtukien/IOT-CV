/**
 * Panel LÁI TAY (plan Phase 10 §10.1.4, §10.1.6): công tắc WEB CONTROL, sơ đồ
 * phím, và hai con số đặt cạnh nhau — vận tốc ĐANG XIN và tốc độ THẬT.
 *
 * Công tắc WEB CONTROL:
 *  - Chỉ bật được khi đang GUIDED và backend đang liên lạc với drone. Không đủ
 *    điều kiện thì công tắc xám kèm lý do, không phải bấm rồi mới bị từ chối.
 *  - Trạng thái hiển thị là `status.safety.web_control_enabled` của backend VÀ
 *    tab này là người đã bật. Bấm xong công tắc KHÔNG đổi ngay: chờ `ack done`
 *    + `status` mới. Bấm mà đổi ngay còn backend từ chối là nói dối về quyền lái.
 *  - Phi công gạt mode khác GUIDED → backend tự thu quyền → `status` đổi →
 *    công tắc tự tắt. Frontend không làm gì, và KHÔNG được cố giành lại.
 *
 * Hai con số lệch nhau là thông tin chẩn đoán: xin 1.0 m/s mà thực tế 0.0 nghĩa
 * là chưa cất cánh, đang bị AVOID phanh, hoặc lệnh không tới nơi.
 */
import { Gamepad2, Hand, Loader2 } from "lucide-react";

import { IconStick } from "@/components/icons";
import type { CSSProperties } from "react";

import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { stopManualNow } from "@/hooks/useManualControl";
import { useWebControlToggle } from "@/hooks/useWebControlToggle";
import { formatNumber, formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KEY_LABEL } from "@/lib/velocityMapping";
import { useControlStore } from "@/store/control";
import { useTelemetryStore } from "@/store/telemetry";

import { KeypadHint } from "./KeypadHint";

function WebControlSwitch() {
  const lastZero = useTelemetryStore((s) => s.status?.safety.last_zero_velocity_reason ?? null);
  const tripped = useTelemetryStore((s) => s.status?.safety.deadman_tripped === true);
  const { on, pending, disabled, blocker, toggle } = useWebControlToggle();

  return (
    <div className="flex flex-col gap-1.5 well px-3 py-2">
      <div className="flex items-center gap-3">
        <Switch
          id="web-control"
          data-testid="web-control-switch"
          data-on={on}
          checked={on}
          disabled={disabled}
          onCheckedChange={toggle}
          aria-describedby="web-control-reason"
        />
        <label htmlFor="web-control" className={cn("text-sm font-semibold tracking-wide", on ? "text-hud-amber" : "text-foreground/85")}>
          WEB CONTROL: {on ? "ON" : "OFF"}
        </label>
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Đang chờ backend" /> : null}
      </div>
      <p id="web-control-reason" className="text-xs text-muted-foreground" data-testid="web-control-reason">
        {on
          ? "Web đang giữ quyền lái. Gạt mode trên RC hoặc tắt công tắc để trả quyền."
          : (blocker ?? "Bật để lái bằng bàn phím. Backend sẽ tự thu quyền nếu mode rời GUIDED.")}
      </p>
      {!on && tripped && lastZero ? (
        <p className="text-xs text-hud-amber" data-testid="deadman-last">
          Lần dừng khẩn gần nhất: <span className="font-mono">{lastZero}</span> — bật lại là xác nhận đã thấy.
        </p>
      ) : null}
    </div>
  );
}

const signed = (v: number) => formatSigned(v, 2, "").trim();

function Readout() {
  const sent = useControlStore((s) => s.manual.sent);
  const held = useControlStore((s) => s.manual.held);
  const gamepad = useControlStore((s) => s.manual.gamepadActive);
  const groundSpeed = useTelemetryStore((s) => s.telemetry?.ground_speed);
  const maxVelocity = useTelemetryStore((s) => s.status?.limits.max_velocity);

  return (
    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
      <div className="well px-3 py-2" data-testid="manual-sent" data-sending={sent !== null}>
        <p className="mb-1 font-sans text-[11px] text-muted-foreground">
          Đang xin{gamepad ? " (tay cầm)" : ""} · trần {formatNumber(maxVelocity, 1, "m/s")}
        </p>
        {sent ? (
          <p className="tabular-nums">
            vx {signed(sent.vx)} · vy {signed(sent.vy)} · vz {signed(sent.vz)} m/s
            <br />
            xoay {formatSigned(sent.yaw_rate, 0, "°/s")}
          </p>
        ) : (
          <p className="text-muted-foreground">im — không gửi lệnh</p>
        )}
        <p className="mt-1 text-muted-foreground">giữ: {held.length ? held.map((c) => KEY_LABEL[c] ?? c).join(" + ") : "—"}</p>
      </div>
      <div className="well px-3 py-2" data-testid="manual-actual">
        <p className="mb-1 font-sans text-[11px] text-muted-foreground">Tốc độ thật (telemetry)</p>
        <p className="text-lg tabular-nums">{formatNumber(groundSpeed, 2, "m/s")}</p>
        <p className="mt-1 font-sans text-[11px] leading-snug text-muted-foreground">
          Xin mà không đi: chưa cất cánh, AVOID đang phanh, hoặc lệnh không tới nơi.
        </p>
      </div>
    </div>
  );
}

export function ManualControl({ style, className }: { style?: CSSProperties; className?: string }) {
  const held = useControlStore((s) => s.manual.held);
  const sending = useControlStore((s) => s.manual.sent !== null);

  return (
    <Panel
      title="Lái tay"
      subtitle="Bàn phím / tay cầm · chỉ khi WEB CONTROL bật"
      icon={IconStick}
      style={style}
      className={className}
      testId="manual-control"
      actions={
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Tay cầm: cắm vào rồi bấm một nút bất kỳ">
          <Gamepad2 className="size-3.5" aria-hidden /> tay cầm: tuỳ chọn
        </span>
      }
      bodyClassName="flex flex-col gap-3 p-3"
    >
      <WebControlSwitch />
      <KeypadHint held={held} />
      <Readout />
      <Button
        variant="destructive"
        className="h-10 rounded-lg font-display text-sm font-semibold"
        onClick={stopManualNow}
        disabled={!sending && held.length === 0}
        data-testid="manual-stop"
      >
        <Hand aria-hidden /> DỪNG (Space) — gửi vận tốc 0 ngay
      </Button>
    </Panel>
  );
}
