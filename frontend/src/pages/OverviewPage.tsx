/**
 * Trang TỔNG QUAN — toàn cảnh một màn hình, cho lúc chuẩn bị, lúc trình bày, và
 * lúc cần biết nhanh "hệ thống có ổn không".
 *
 *   ┌── drone 3D sống (bệ xoay) + số chính ──┐┌── sẵn sàng bay ──┐
 *   ├── sức khoẻ từng khối (lưới bất đối xứng) ┤├── bản đồ nhỏ ────┤
 *   └── sự kiện gần đây ──────┴── phiên làm việc & chuyến bay ─────┘
 */
import { ArrowUpRight, History, Radio } from "lucide-react";
import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { IconPreflight, IconQuad, IconSystem } from "@/components/icons";
import { KeyValue, KeyValueList, PageHeader, StatusDot } from "@/components/kit";
import { MapView } from "@/components/MapView/MapView";
import { Panel } from "@/components/Panel";
import { CheckRows, VerdictBanner } from "@/components/preflight/Checks";
import { useFlightTime } from "@/hooks/useFlightTime";
import { useHome } from "@/hooks/useMissionDraft";
import { usePreflight } from "@/hooks/usePreflight";
import { NO_VALUE, formatClock, formatDistance, formatDuration, formatNumber } from "@/lib/format";
import { haversineM } from "@/lib/geo";
import { AVOID_STATE_LABEL } from "@/lib/protocol";
import type { Tone } from "@/lib/tone";
import { TONE_TEXT } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session";
import { useTelemetryStore } from "@/store/telemetry";

const DroneShowcase = lazy(() => import("@/components/twin/DroneShowcase").then((m) => ({ default: m.DroneShowcase })));

function BigNumber({ label, value, unit, tone = "neutral" }: { label: string; value: string; unit?: string; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-[10px]">{label}</p>
      <p className={cn("num truncate text-[1.9rem] leading-tight font-semibold", tone === "neutral" ? "text-foreground" : TONE_TEXT[tone])}>
        {value}
        {unit && value !== NO_VALUE ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </p>
    </div>
  );
}

function Hero() {
  const t = useTelemetryStore((s) => s.telemetry);
  const home = useHome();
  const { seconds } = useFlightTime();
  const dist = home && t?.lat != null && t.lon != null ? haversineM(home[0], home[1], t.lat, t.lon) : null;
  // Cùng luật với HUD: chưa có số → "—", và không bao giờ in "-0.0" (SITL nằm đất báo −0.02 m).
  const n = (v: number | null | undefined, d: number) => formatNumber(v, d, "");

  return (
    <section className="panel panel-instrument relative min-h-[420px] overflow-hidden lg:col-span-2" data-testid="overview-hero">
      <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_62%_55%,color-mix(in_oklch,var(--hud-cyan)_16%,transparent),transparent_70%)]" />
      <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Đang dựng model 3D…</div>}>
        <DroneShowcase className="absolute inset-y-0 right-0 left-[36%]" />
      </Suspense>
      <div className="pointer-events-none relative flex h-full min-h-[420px] flex-col justify-between p-5">
        <div>
          <p className="eyebrow">Phương tiện</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-[0.02em]">S500 · ArduCopter 4.7</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            SpeedyBee F405 V5 · GPS M10 · TFmini Plus · ESP32-CAM. Model 3D nghiêng theo tư thế thật, cánh quay khi ARMED.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
            <span className="rounded-md border border-border bg-foreground/5 px-2 py-1">{t?.mode ?? NO_VALUE}</span>
            <span className={cn("rounded-md border px-2 py-1", t?.armed ? "border-hud-red/50 bg-hud-red/12 text-hud-red" : "border-border bg-foreground/5")}>
              {t ? (t.armed ? "ARMED" : "DISARMED") : NO_VALUE}
            </span>
            <span className="rounded-md border border-border bg-foreground/5 px-2 py-1">bay {formatDuration(seconds)}</span>
          </div>
        </div>
        <div className="grid max-w-md grid-cols-2 gap-x-8 gap-y-4">
          <BigNumber label="Độ cao" value={n(t?.relative_alt, 1)} unit="m" />
          <BigNumber label="Tốc độ" value={n(t?.ground_speed, 1)} unit="m/s" />
          <BigNumber label="Pin" value={n(t?.battery_remaining, 0)} unit="%" tone={t?.battery_remaining != null && t.battery_remaining < 25 ? "danger" : "neutral"} />
          <BigNumber label="Cách home" value={dist === null ? NO_VALUE : formatDistance(dist).replace(/ (m|km)$/, "")} unit={dist !== null && dist >= 1000 ? "km" : "m"} />
        </div>
      </div>
    </section>
  );
}

interface Health {
  name: string;
  tone: Tone;
  value: string;
  note: string;
}

function useHealth(): Health[] {
  const socket = useTelemetryStore((s) => s.connection);
  const t = useTelemetryStore((s) => s.telemetry);
  const status = useTelemetryStore((s) => s.status);
  const open = socket === "open";
  return [
    { name: "Backend", tone: open ? "ok" : "danger", value: open ? "Đã nối" : socket === "connecting" ? "Đang nối" : "Mất", note: status ? `v${status.backend_version}` : "—" },
    { name: "MAVLink", tone: !t ? "neutral" : t.connected ? "ok" : "danger", value: !t ? NO_VALUE : t.connected ? "Sống" : "Mất", note: status?.endpoint ?? "—" },
    { name: "GPS", tone: t?.gps_fix_type == null ? "neutral" : t.gps_fix_type >= 3 ? "ok" : "warn", value: t?.gps_fix_type == null ? NO_VALUE : `fix ${t.gps_fix_type}`, note: `${t?.satellites ?? "—"} vệ tinh` },
    { name: "EKF", tone: t?.ekf_ok == null ? "neutral" : t.ekf_ok ? "ok" : "danger", value: t?.ekf_ok == null ? NO_VALUE : t.ekf_ok ? "OK" : "Lỗi", note: "ước lượng vị trí" },
    { name: "Pin", tone: t?.battery_remaining == null ? "neutral" : t.battery_remaining < 25 ? "danger" : "ok", value: formatNumber(t?.battery_remaining, 0, "%"), note: formatNumber(t?.battery_voltage, 1, "V") },
    { name: "Vật cản", tone: !t?.avoid_state ? "neutral" : t.avoid_state === "OFF" ? "ok" : t.avoid_state === "UNKNOWN" ? "neutral" : t.avoid_state === "NEAR" ? "warn" : "danger", value: t?.avoid_state ? AVOID_STATE_LABEL[t.avoid_state] : NO_VALUE, note: formatNumber(t?.obstacle_distance, 1, "m") },
    { name: "Camera", tone: status?.camera?.available ? "ok" : status ? "warn" : "neutral", value: status?.camera?.available ? "Có hình" : status ? "Không hình" : NO_VALUE, note: status?.camera?.fake ? "nguồn giả" : "ESP32-CAM" },
    { name: "Mission", tone: status?.mission?.source === "readback" ? "ok" : status?.mission?.source === "local" ? "warn" : "neutral", value: status?.mission?.source === "readback" ? `${status.mission.count} item` : status?.mission?.source === "local" ? "Chưa xác nhận" : "Trống", note: "trên FC" },
    { name: "WEB CONTROL", tone: status?.safety.web_control_enabled ? "warn" : status ? "ok" : "neutral", value: status ? (status.safety.web_control_enabled ? "ĐANG BẬT" : "Tắt") : NO_VALUE, note: "quyền lái của web" },
  ];
}

function HealthGrid() {
  const items = useHealth();
  return (
    <Panel title="Sức khoẻ hệ thống" subtitle="Mỗi khối một ô — màu theo quy ước buồng lái" icon={IconSystem} className="lg:col-span-2" bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((h, i) => (
          <div
            key={h.name}
            className={cn("well flex flex-col gap-1 p-3", i === 0 ? "xl:col-span-2" : "")}
            data-testid={`health-${h.name}`}
            data-tone={h.tone}
          >
            <div className="flex items-center gap-2">
              <StatusDot tone={h.tone} pulse={h.tone === "danger"} />
              <span className="eyebrow text-[10px]">{h.name}</span>
            </div>
            <p className={cn("num truncate text-lg font-semibold", h.tone === "neutral" ? "text-foreground" : TONE_TEXT[h.tone])}>{h.value}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{h.note}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Readiness() {
  const { checks, verdict } = usePreflight();
  return (
    <Panel
      title="Sẵn sàng bay?"
      subtitle="Ô tự động — danh sách tự xác nhận ở trang Kiểm tra"
      icon={IconPreflight}
      bodyClassName="flex flex-col gap-3 p-3"
      actions={<LinkChip to="/preflight">Chi tiết</LinkChip>}
    >
      <VerdictBanner verdict={verdict} compact />
      <CheckRows checks={checks} compact />
    </Panel>
  );
}

function LinkChip({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground">
      {children} <ArrowUpRight className="size-3" />
    </Link>
  );
}

function RecentEvents() {
  const events = useTelemetryStore((s) => s.events);
  return (
    <Panel title="Sự kiện gần đây" icon={Radio} actions={<LinkChip to="/logs">Nhật ký</LinkChip>} bodyClassName="p-2">
      {events.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">Chưa có sự kiện nào.</p>
      ) : (
        <ul className="space-y-0.5">
          {events.slice(0, 8).map((e) => (
            <li key={e.key} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-foreground/4">
              <StatusDot tone={e.level === "error" ? "danger" : e.level === "warn" ? "warn" : "neutral"} className="mt-1.5" />
              <span className="num w-16 shrink-0 text-[11px] text-muted-foreground">{formatClock(e.ts)}</span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug">{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SessionCard() {
  const s = useSessionStore();
  return (
    <Panel title="Phiên làm việc" subtitle="Đo tại trình duyệt này" icon={History} bodyClassName="p-3">
      <KeyValueList>
        <KeyValue label="Mở trang lúc" value={formatClock(s.openedAt / 1000)} />
        <KeyValue label="Nối backend từ" value={s.connectedSince ? formatClock(s.connectedSince / 1000) : NO_VALUE} />
        <KeyValue label="Số lần nối lại" value={String(s.reconnects)} tone={s.reconnects > 0 ? "warn" : undefined} />
        <KeyValue label="Telemetry nhận" value={`${s.rates.telemetry ?? 0} gói/s`} />
        <KeyValue label="Băng thông WebSocket" value={`${(s.bytesPerSecond / 1024).toFixed(1)} KB/s`} />
      </KeyValueList>
      <p className="eyebrow mt-4 mb-1.5 text-[10px]">Chuyến bay trong phiên</p>
      {s.flights.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có chuyến nào kết thúc (tính từ lúc ARM tới DISARM).</p>
      ) : (
        <ul className="space-y-1 font-mono text-[11.5px]">
          {s.flights.map((f) => (
            <li key={f.startedAt} className="flex justify-between gap-2">
              <span>{formatClock(f.startedAt / 1000)}</span>
              <span>{formatDuration((f.endedAt - f.startedAt) / 1000)}</span>
              <span className="text-muted-foreground">cao nhất {formatNumber(f.maxAlt, 1, "m")}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function OverviewPage() {
  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="Giám sát"
        title="Tổng quan"
        description="Toàn cảnh drone và hệ thống trên một màn hình. Số liệu sống, cập nhật 8 lần mỗi giây."
        actions={
          <Link to="/" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85">
            <IconQuad className="size-4" /> Vào buồng lái
          </Link>
        }
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <Hero />
        <Readiness />
        <HealthGrid />
        <Panel title="Vị trí" subtitle="Bản đồ nhỏ — mở trang Bay để thao tác" icon={IconQuad} className="min-h-[300px]" bodyClassName="relative min-h-[260px]">
          <MapView mode="flight" compact className="absolute inset-0 min-h-0" />
        </Panel>
        <RecentEvents />
        <div className="lg:col-span-2">
          <SessionCard />
        </div>
      </div>
    </div>
  );
}
