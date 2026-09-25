/**
 * Trang HỆ THỐNG — kiến trúc, trạng thái backend, giới hạn an toàn đang áp dụng.
 *
 * Số liệu backend lấy qua `GET /api/system` (hỏi lại mỗi 5 s, chỉ khi trang mở).
 * Giới hạn đọc từ `status.limits` — CHÍNH bộ số backend dùng để chặn lệnh; trang
 * này chỉ hiện, không sửa được (đổi = sửa `.env` của backend rồi khởi động lại).
 */
import { Gauge, Network, ServerCog, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { KeyValue, KeyValueList, PageHeader, Tag } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { fetchSystem } from "@/lib/api";
import { NO_VALUE, formatClock, formatDuration } from "@/lib/format";
import type { LimitsPayload, SystemPayload } from "@/lib/protocol";
import { DOWNLINK_TYPES } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session";
import { useTelemetryStore } from "@/store/telemetry";

const SYSTEM_POLL_MS = 5000;

function useSystem(): { data: SystemPayload | null; error: string | null } {
  const [data, setData] = useState<SystemPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const load = () =>
      fetchSystem({ signal: abort.signal })
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e: Error) => !abort.signal.aborted && setError(e.message));
    void load();
    const timer = setInterval(load, SYSTEM_POLL_MS);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, []);
  return { data, error };
}

type Link = "ok" | "down" | "unknown" | "planned";

const LINK_CLS: Record<Link, string> = {
  ok: "stroke-hud-green",
  down: "stroke-hud-red",
  unknown: "stroke-muted-foreground/50",
  planned: "stroke-muted-foreground/35",
};

/** Sơ đồ kiến trúc: đường nối xanh chạy = sống, đỏ = mất, xám đứt = chưa biết / chưa làm. */
function Architecture() {
  const socket = useTelemetryStore((s) => s.connection === "open");
  const mav = useTelemetryStore((s) => s.telemetry?.connected);
  const cam = useTelemetryStore((s) => s.status?.camera?.available);
  const ws: Link = socket ? "ok" : "down";
  const fc: Link = !socket ? "unknown" : mav ? "ok" : "down";
  const camera: Link = !socket ? "unknown" : cam ? "ok" : "down";

  const box = (x: number, y: number, title: string, sub: string, dim = false) => (
    <g opacity={dim ? 0.55 : 1}>
      <rect x={x} y={y} width="170" height="64" rx="14" className="fill-foreground/[0.04] stroke-border" strokeDasharray={dim ? "4 4" : undefined} />
      <text x={x + 16} y={y + 28} className="fill-foreground font-display text-[15px] font-semibold">{title}</text>
      <text x={x + 16} y={y + 47} className="fill-muted-foreground text-[11px]">{sub}</text>
    </g>
  );
  const line = (d: string, s: Link, label: string, lx: number, ly: number) => (
    <g>
      <path d={d} fill="none" strokeWidth="2.5" className={cn(LINK_CLS[s], s === "ok" && "link-flow")} strokeDasharray={s === "ok" ? "8 8" : s === "down" ? "3 6" : "2 6"} strokeLinecap="round" />
      <text x={lx} y={ly} textAnchor="middle" className="fill-muted-foreground font-mono text-[10.5px]">{label}</text>
    </g>
  );

  return (
    <svg viewBox="0 0 820 300" className="w-full" role="img" aria-label="Kiến trúc hệ thống và trạng thái từng kết nối">
      {line("M190 72 H300", ws, "WebSocket /ws", 245, 60)}
      {line("M470 72 H580", fc, "MAVLink", 525, 60)}
      {line("M385 104 V180", camera, "MJPEG", 420, 150)}
      {line("M470 212 H580", "planned", "MQTT · Phase 23", 525, 200)}
      {box(20, 40, "Trình duyệt", "Web GCS v2 · React 19")}
      {box(300, 40, "Backend", "FastAPI · pymavlink")}
      {box(580, 40, "Flight controller", "ArduCopter 4.7 · SITL/thật")}
      {box(300, 180, "Camera", "ESP32-CAM / nguồn giả")}
      {box(580, 180, "Broker IoT", "mosquitto — chưa làm", true)}
      <text x="20" y="285" className="fill-muted-foreground text-[11px]">
        Xanh chạy = đang sống · đỏ đứt = mất · xám = chưa biết hoặc chưa triển khai
      </text>
    </svg>
  );
}

const LIMIT_ROWS: { key: keyof LimitsPayload; label: string; unit: string; note: string }[] = [
  { key: "max_alt", label: "Trần độ cao", unit: "m", note: "Mission và TAKEOFF vượt bị backend từ chối" },
  { key: "min_alt", label: "Sàn độ cao", unit: "m", note: "Không bay mission thấp hơn" },
  { key: "max_distance_home", label: "Bán kính tối đa quanh home", unit: "m", note: "Rào PHẦN MỀM — rào thật là FENCE_* trên FC" },
  { key: "max_waypoints", label: "Số điểm mission tối đa", unit: "", note: "Tính cả cất cánh và RTL/LAND" },
  { key: "max_velocity", label: "Vận tốc lái tay tối đa", unit: "m/s", note: "Backend kẹp lại lần nữa" },
  { key: "manual_command_timeout_ms", label: "Hạn dead-man", unit: "ms", note: "Quá hạn không có lệnh → gửi vận tốc 0" },
  { key: "deadman_tick_ms", label: "Nhịp quét dead-man", unit: "ms", note: "Nhỏ hơn hẳn hạn dead-man" },
  { key: "avoid_margin_m", label: "Lề tránh vật cản", unit: "m", note: "Dưới mức này FC phanh" },
  { key: "avoid_dist_max_m", label: "Tầm bắt đầu giảm tốc", unit: "m", note: "Vùng vàng của radar" },
  { key: "rangefinder_max_m", label: "Tầm đo TFmini", unit: "m", note: "Xa hơn là 'trống trải'" },
  { key: "proximity_stale_s", label: "Số đo cũ sau", unit: "s", note: "Quá thì AVOID = không đọc được" },
];

export default function SystemPage() {
  const { data, error } = useSystem();
  const limits = useTelemetryStore((s) => s.status?.limits ?? null);
  const session = useSessionStore();

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="Hệ thống"
        title="Hệ thống"
        description="Các khối của hệ thống và kết nối giữa chúng, cấu hình backend, và bộ giới hạn an toàn đang có hiệu lực."
        actions={error ? <Tag tone="danger" title={error}>Không đọc được /api/system</Tag> : data ? <Tag tone="ok">Backend v{data.backend_version}</Tag> : null}
      />
      <Panel title="Kiến trúc" subtitle="Trạng thái sống của từng kết nối" icon={Network} bodyClassName="p-4">
        <Architecture />
      </Panel>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel title="Backend" subtitle={`Hỏi lại mỗi ${SYSTEM_POLL_MS / 1000} s`} icon={ServerCog} bodyClassName="p-3">
          <KeyValueList>
            <KeyValue label="Phiên bản · hợp đồng" value={data ? `${data.backend_version} · v${data.contract_version}` : NO_VALUE} />
            <KeyValue label="Chạy từ" value={data ? `${formatClock(data.started_at)} (${formatDuration(data.uptime_s)})` : NO_VALUE} />
            <KeyValue label="Python · nền tảng" value={data ? `${data.python} · ${data.platform}` : NO_VALUE} />
            <KeyValue label="PID" value={data ? String(data.pid) : NO_VALUE} />
            <KeyValue label="Endpoint MAVLink" value={data?.endpoint ?? NO_VALUE} />
            <KeyValue label="Link MAVLink" value={data ? (data.link_alive ? "sống" : "mất") : NO_VALUE} tone={data ? (data.link_alive ? "ok" : "danger") : undefined} />
            <KeyValue label="Nhịp telemetry" value={data ? `${data.telemetry_hz} Hz` : NO_VALUE} />
            <KeyValue label="Tab đang mở" value={data ? String(data.ws_clients) : NO_VALUE} hint="Số WebSocket backend đang giữ — mỗi tab một socket" />
            <KeyValue label="Vision" value={data ? (data.vision_enabled ? (data.camera_fake ? "bật · nguồn giả" : "bật · camera thật") : "tắt") : NO_VALUE} />
            <KeyValue label="Nguồn camera" value={data?.camera_source ?? NO_VALUE} />
            <KeyValue label="Lịch sử telemetry" value={data ? `${data.history_samples} mẫu / ${data.history_capacity_s / 60} phút` : NO_VALUE} />
            <KeyValue label="Sự kiện đang giữ" value={data ? String(data.events_buffered) : NO_VALUE} />
          </KeyValueList>
        </Panel>
        <Panel title="Giới hạn an toàn" subtitle="Từ status.limits — backend chặn lệnh theo đúng bộ số này" icon={SlidersHorizontal} bodyClassName="p-3" testId="system-limits">
          {limits ? (
            <table className="w-full text-[12.5px]">
              <tbody className="divide-y divide-border">
                {LIMIT_ROWS.map((r) => (
                  <tr key={r.key} title={r.note}>
                    <td className="py-1.5 pr-2">
                      <p>{r.label}</p>
                      <p className="text-[11px] text-muted-foreground">{r.note}</p>
                    </td>
                    <td className="num py-1.5 text-right whitespace-nowrap">
                      {limits[r.key]} {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa nhận status từ backend.</p>
          )}
        </Panel>
        <Panel title="Luồng dữ liệu" subtitle="Gói/giây nhận được, đo tại trình duyệt" icon={Gauge} bodyClassName="p-3">
          <KeyValueList>
            {DOWNLINK_TYPES.map((t) => (
              <KeyValue key={t} label={t} value={`${session.rates[t] ?? 0} /s · tổng ${session.totals[t] ?? 0}`} />
            ))}
            <KeyValue label="Băng thông" value={`${(session.bytesPerSecond / 1024).toFixed(1)} KB/s`} />
            <KeyValue label="Số lần nối lại" value={String(session.reconnects)} tone={session.reconnects > 0 ? "warn" : undefined} />
          </KeyValueList>
        </Panel>
      </div>
    </div>
  );
}
