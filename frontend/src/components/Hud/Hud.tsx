/**
 * HUD telemetry — hiển thị ĐÚNG những trường hợp đồng đã có, không bịa thêm.
 *
 * Trên: màn hình bay chính (PFD) — chân trời, băng tốc độ/độ cao/hướng mũi.
 * Dưới: các ô số (GPS, pin, tốc độ leo, tuổi link, EKF).
 *
 * Mỗi ô là một component con tự subscribe đúng lát cắt của nó
 * (`useTelemetryStore(s => s.telemetry?.relative_alt)`). Telemetry về 8 Hz; ô
 * nào số không đổi thì không render lại.
 *
 * Ba luật hiển thị (dùng lại ở Phase 09, 10):
 *  1. `null` hiện `—`, không bao giờ `0`.
 *  2. Có số thì có đơn vị.
 *  3. Mỗi ô có tooltip giải thích cho người mới.
 */
import type { CSSProperties, ReactNode } from "react";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  BatteryMedium,
  Compass,
  Gauge,
  Mountain,
  Plane,
  Satellite,
  ShieldCheck,
  TrendingUpDown,
} from "lucide-react";

import { Panel } from "@/components/Panel";
import { useLimits } from "@/hooks/useLimits";
import {
  DISPLAY_THRESHOLDS,
  NO_VALUE,
  batteryTone,
  climbTone,
  formatHeading,
  formatNumber,
  formatSigned,
  hasValue,
  linkAgeTone,
  modeTone,
} from "@/lib/format";
import type { Tone } from "@/lib/format";
import { GPS_FIX_3D, GPS_FIX_LABEL } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

import { PrimaryFlightDisplay } from "./PrimaryFlightDisplay";
import { StatBlock } from "./StatBlock";

const TONE_PILL: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/5 text-muted-foreground",
  ok: "border-hud-green/40 bg-hud-green/15 text-hud-green",
  warn: "border-hud-amber/40 bg-hud-amber/15 text-hud-amber",
  danger: "border-hud-red/50 bg-hud-red/20 text-hud-red",
};

/**
 * Số vệ tinh ứng với từng vạch sóng — chỉ để vẽ, không phải điều kiện bay
 * (điều kiện bay là `gps_fix_type`, do FC quyết).
 */
const SAT_BARS = [4, 6, 8, 10, 12];

function Pill({ tone, children, title }: { tone: Tone; children: ReactNode; title: string }) {
  return (
    <span
      title={title}
      className={cn("rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider", TONE_PILL[tone])}
    >
      {children}
    </span>
  );
}

function ModeArmed() {
  const mode = useTelemetryStore((s) => s.telemetry?.mode);
  const armed = useTelemetryStore((s) => s.telemetry?.armed);
  const known = mode !== undefined;
  return (
    <>
      <Pill tone={modeTone(mode)} title="Chế độ bay hiện tại">
        {known ? mode : NO_VALUE}
      </Pill>
      {/* Đỏ là "đang nguy hiểm — motor có thể quay", không phải "lỗi". */}
      <Pill
        tone={known ? (armed ? "danger" : "neutral") : "neutral"}
        title={armed ? "Motor đã được phép quay — đang nguy hiểm" : "Motor bị khoá"}
      >
        {known ? (armed ? "ARMED" : "DISARMED") : NO_VALUE}
      </Pill>
    </>
  );
}

function AltitudeCell() {
  const alt = useTelemetryStore((s) => s.telemetry?.relative_alt);
  const limits = useLimits();
  return (
    <StatBlock
      label="Độ cao"
      icon={Mountain}
      hint="Độ cao SO VỚI ĐIỂM CẤT CÁNH (home), không phải so với mực nước biển. Giới hạn do backend đặt."
      value={formatNumber(alt, 1, "m")}
      sub={`so với điểm cất cánh · giới hạn ${limits ? formatNumber(limits.max_alt, 0, "m") : NO_VALUE}`}
    />
  );
}

function SpeedCell() {
  const speed = useTelemetryStore((s) => s.telemetry?.ground_speed);
  return <StatBlock label="Tốc độ" icon={Gauge} hint="Tốc độ so với mặt đất, theo GPS." value={formatNumber(speed, 2, "m/s")} />;
}

function HeadingCell() {
  const heading = useTelemetryStore((s) => s.telemetry?.heading);
  return (
    <StatBlock
      label="Hướng mũi"
      icon={Compass}
      hint="Mũi drone đang chỉ về đâu, tính bằng độ theo chiều kim đồng hồ: 0° là Bắc, 90° là Đông."
      value={formatHeading(heading)}
    />
  );
}

function ClimbCell() {
  const climb = useTelemetryStore((s) => s.telemetry?.climb_rate);
  const tone = climbTone(climb);
  const Arrow = tone === "ok" ? ArrowUp : tone === "danger" ? ArrowDown : null;
  return (
    <StatBlock
      label="Tốc độ leo"
      icon={TrendingUpDown}
      hint="Dương (xanh) là đang lên, âm (đỏ) là đang xuống."
      value={formatSigned(climb, 1, "m/s")}
      tone={tone}
      aside={Arrow ? <Arrow className="size-3.5" aria-hidden /> : null}
    />
  );
}

function SignalBars({ sats, tone }: { sats: number | null | undefined; tone: Tone }) {
  const color = tone === "ok" ? "bg-hud-green" : tone === "warn" ? "bg-hud-amber" : "bg-muted-foreground";
  return (
    <span className="flex h-3 items-end gap-0.5" aria-hidden>
      {SAT_BARS.map((min, i) => (
        <span
          key={min}
          className={cn("w-1 rounded-sm", hasValue(sats) && sats >= min ? color : "bg-white/10")}
          style={{ height: `${(i + 1) * 20}%` }}
        />
      ))}
    </span>
  );
}

function GpsCell() {
  const fix = useTelemetryStore((s) => s.telemetry?.gps_fix_type);
  const sats = useTelemetryStore((s) => s.telemetry?.satellites);
  const fixText = hasValue(fix) ? (GPS_FIX_LABEL[fix as keyof typeof GPS_FIX_LABEL] ?? `fix ${fix}`) : NO_VALUE;
  const satText = hasValue(sats) ? `${sats} vệ tinh` : NO_VALUE;
  const tone: Tone = !hasValue(fix) ? "neutral" : fix < GPS_FIX_3D ? "warn" : "ok";
  return (
    <StatBlock
      label="GPS"
      icon={Satellite}
      hint="Chất lượng định vị. Cần 3D trở lên mới bay tự động được; dưới 3D thì ô chuyển vàng."
      value={fixText}
      sub={satText}
      tone={tone}
      aside={<SignalBars sats={sats} tone={tone} />}
    />
  );
}

function BatteryCell() {
  const voltage = useTelemetryStore((s) => s.telemetry?.battery_voltage);
  const current = useTelemetryStore((s) => s.telemetry?.battery_current);
  const remaining = useTelemetryStore((s) => s.telemetry?.battery_remaining);
  return (
    <StatBlock
      label="Pin"
      icon={BatteryMedium}
      hint="Phần trăm còn lại · điện áp · dòng đang kéo. Dưới 25% thì ô chuyển đỏ. Dòng hiện — khi mạch đo dòng không báo."
      value={formatNumber(remaining, 0, "%")}
      tone={batteryTone(remaining)}
      meter={hasValue(remaining) ? remaining / 100 : null}
      sub={`${formatNumber(voltage, 1, "V")} · ${formatNumber(current, 1, "A")}`}
    />
  );
}

function LinkAgeCell() {
  const age = useTelemetryStore((s) => s.telemetry?.link_age_ms);
  return (
    <StatBlock
      label="Tuổi link"
      icon={Activity}
      hint="Bao lâu rồi backend chưa nghe drone nói gì. Trên 1 giây là vàng, trên 3 giây là đỏ."
      value={formatNumber(age, 0, "ms")}
      tone={linkAgeTone(age)}
      meter={hasValue(age) ? age / DISPLAY_THRESHOLDS.linkAgeDangerMs : null}
    />
  );
}

function EkfCell() {
  const ekf = useTelemetryStore((s) => s.telemetry?.ekf_ok);
  const value = ekf === true ? "OK" : ekf === false ? "LỖI" : NO_VALUE;
  const tone: Tone = ekf === true ? "ok" : ekf === false ? "danger" : "neutral";
  return (
    <StatBlock
      label="EKF"
      icon={ShieldCheck}
      hint="Bộ lọc ước lượng vị trí của flight controller. — nghĩa là CHƯA BIẾT, không phải OK."
      value={value}
      tone={tone}
    />
  );
}

export function Hud({ style }: { style?: CSSProperties }) {
  return (
    <Panel title="Màn hình bay" icon={Plane} actions={<ModeArmed />} style={style}>
      <div className="flex flex-wrap gap-3 p-3">
        <div className="min-w-[380px] flex-[1.5_1_420px] self-start rounded-lg border border-border bg-black/30 p-2">
          <PrimaryFlightDisplay />
        </div>
        <div className="grid min-w-[300px] flex-[1_1_300px] grid-cols-2 content-start gap-2">
          <div className="col-span-2">
            <AltitudeCell />
          </div>
          <SpeedCell />
          <HeadingCell />
          <ClimbCell />
          <GpsCell />
          <BatteryCell />
          <LinkAgeCell />
          <div className="col-span-2">
            <EkfCell />
          </div>
        </div>
      </div>
    </Panel>
  );
}
