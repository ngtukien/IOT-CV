/**
 * Trang DỮ LIỆU BAY — biểu đồ thời gian thực của mọi trường telemetry + bảng số
 * sống + xuất CSV.
 *
 * Nguồn: `store/history.ts` — gói trình duyệt nhận trực tiếp, cộng lịch sử
 * backend nạp sẵn lúc mở trang (`GET /api/telemetry/history`), tối đa 15 phút.
 * Mỗi biểu đồ MỘT trục, tối đa hai chuỗi cùng đơn vị (luật dataviz).
 */
import { Download, Pause, Play, Table2, Trash2 } from "lucide-react";
import { useState } from "react";

import { IconTelemetry } from "@/components/icons";
import { PageHeader } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { TimeChart } from "@/components/telemetry/TimeChart";
import type { ChartSeries } from "@/components/telemetry/TimeChart";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { downloadText, toCsv } from "@/lib/csv";
import { NO_VALUE } from "@/lib/format";
import type { Telemetry } from "@/lib/protocol";
import { telemetryHistory, useHistoryTick } from "@/store/history";
import { useTelemetryStore } from "@/store/telemetry";

interface ChartDef {
  title: string;
  hint: string;
  unit: string;
  series: ChartSeries[];
  range?: [number, number];
  digits?: number;
}

const CHARTS: ChartDef[] = [
  { title: "Độ cao", hint: "So với điểm cất cánh", unit: "m", series: [{ label: "Độ cao", pick: (d) => d.relative_alt, slot: 1 }] },
  {
    title: "Tốc độ",
    hint: "Mặt đất và tốc độ leo — cùng đơn vị m/s",
    unit: "m/s",
    digits: 2,
    series: [
      { label: "Mặt đất", pick: (d) => d.ground_speed, slot: 1 },
      { label: "Leo (+) / hạ (−)", pick: (d) => d.climb_rate, slot: 2 },
    ],
  },
  {
    title: "Tư thế",
    hint: "Nghiêng (roll) và chúc/ngóc (pitch)",
    unit: "°",
    series: [
      { label: "Roll", pick: (d) => d.roll, slot: 1 },
      { label: "Pitch", pick: (d) => d.pitch, slot: 2 },
    ],
  },
  { title: "Hướng mũi", hint: "0° = Bắc, theo chiều kim đồng hồ", unit: "°", digits: 0, range: [0, 360], series: [{ label: "Hướng", pick: (d) => d.heading, slot: 1 }] },
  { title: "Điện áp pin", hint: "Pin 4S: đầy ~16.8 V", unit: "V", digits: 2, series: [{ label: "Điện áp", pick: (d) => d.battery_voltage, slot: 1 }] },
  { title: "Dòng pin", hint: "Trống khi mạch đo dòng không báo", unit: "A", series: [{ label: "Dòng", pick: (d) => d.battery_current, slot: 1 }] },
  { title: "Pin còn lại", hint: "Phần trăm FC ước lượng", unit: "%", digits: 0, range: [0, 100], series: [{ label: "Còn lại", pick: (d) => d.battery_remaining, slot: 1 }] },
  { title: "GPS", hint: "Số vệ tinh nhìn thấy", unit: "vệ tinh", digits: 0, series: [{ label: "Vệ tinh", pick: (d) => d.satellites, slot: 1 }] },
  { title: "Tuổi link", hint: "Bao lâu chưa nghe drone — trên 1000 ms là đáng lo", unit: "ms", digits: 0, series: [{ label: "Tuổi link", pick: (d) => d.link_age_ms, slot: 1 }] },
  { title: "Khoảng cách vật cản", hint: "TFmini Plus, hướng mũi", unit: "m", series: [{ label: "Khoảng cách", pick: (d) => d.obstacle_distance, slot: 1 }] },
];

/** Bảng mô tả trường — thứ tự và đơn vị theo hợp đồng Phase 05. */
const FIELDS: { key: keyof Telemetry; label: string; unit: string }[] = [
  { key: "mode", label: "Chế độ bay", unit: "" },
  { key: "armed", label: "ARMED", unit: "" },
  { key: "connected", label: "Link còn sống", unit: "" },
  { key: "link_age_ms", label: "Tuổi link", unit: "ms" },
  { key: "lat", label: "Vĩ độ", unit: "°" },
  { key: "lon", label: "Kinh độ", unit: "°" },
  { key: "relative_alt", label: "Độ cao (so với home)", unit: "m" },
  { key: "absolute_alt", label: "Độ cao (so với mực nước biển)", unit: "m" },
  { key: "heading", label: "Hướng mũi", unit: "°" },
  { key: "ground_speed", label: "Tốc độ mặt đất", unit: "m/s" },
  { key: "climb_rate", label: "Tốc độ leo", unit: "m/s" },
  { key: "roll", label: "Roll", unit: "°" },
  { key: "pitch", label: "Pitch", unit: "°" },
  { key: "yaw", label: "Yaw", unit: "°" },
  { key: "gps_fix_type", label: "Loại fix GPS", unit: "" },
  { key: "satellites", label: "Số vệ tinh", unit: "" },
  { key: "battery_voltage", label: "Điện áp pin", unit: "V" },
  { key: "battery_current", label: "Dòng pin", unit: "A" },
  { key: "battery_remaining", label: "Pin còn lại", unit: "%" },
  { key: "home_lat", label: "Home — vĩ độ", unit: "°" },
  { key: "home_lon", label: "Home — kinh độ", unit: "°" },
  { key: "obstacle_distance", label: "Khoảng cách vật cản", unit: "m" },
  { key: "rangefinder_healthy", label: "TFmini khoẻ", unit: "" },
  { key: "avoid_state", label: "Trạng thái AVOID", unit: "" },
  { key: "ekf_ok", label: "EKF khoẻ", unit: "" },
];

function show(v: unknown): string {
  if (v === null || v === undefined) return NO_VALUE;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 1000 ? 3 : 1);
  if (typeof v === "boolean") return v ? "có" : "không";
  if (Array.isArray(v)) return v.map((x) => (x == null ? "—" : Number(x).toFixed(1))).join(" · ");
  return String(v);
}

function LiveTable() {
  const t = useTelemetryStore((s) => s.telemetry);
  return (
    <Panel title="Số sống" subtitle="Mọi trường của gói telemetry mới nhất" icon={Table2} bodyClassName="p-0">
      <div className="max-h-[560px] overflow-y-auto">
        <table className="w-full text-[12.5px]">
          <tbody className="divide-y divide-border">
            {FIELDS.map((f) => (
              <tr key={f.key} className="hover:bg-foreground/3">
                <td className="px-3 py-1.5 text-muted-foreground">
                  {f.label}
                  <span className="ml-1.5 font-mono text-[10px] opacity-60">{f.key}</span>
                </td>
                <td className="num px-3 py-1.5 text-right">
                  {show(t?.[f.key])}
                  {f.unit && t?.[f.key] != null ? <span className="ml-1 text-muted-foreground">{f.unit}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function exportCsv(windowSec: number): void {
  const samples = telemetryHistory.samples(Date.now() - windowSec * 1000);
  const keys = FIELDS.map((f) => f.key);
  const rows = samples.map((s) => [new Date(s.t).toISOString(), ...keys.map((k) => s.d[k] as unknown)]);
  downloadText(`iot-cv-telemetry-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`, toCsv(["time", ...keys], rows), "text/csv");
}

const WINDOWS = [
  { value: "60", label: "1 phút" },
  { value: "300", label: "5 phút" },
  { value: "600", label: "10 phút" },
  { value: "900", label: "15 phút" },
] as const;

export default function TelemetryPage() {
  const [win, setWin] = useState<(typeof WINDOWS)[number]["value"]>("300");
  const [paused, setPaused] = useState(false);
  useHistoryTick(1000); // render lại mỗi giây khi có mẫu mới → số mẫu dưới đây luôn mới
  const count = telemetryHistory.size;
  const windowSec = Number(win);

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="Giám sát · telemetry"
        title="Dữ liệu bay"
        description={`Biểu đồ thời gian thực, rê chuột để đọc từng thời điểm. Đang giữ ${count} mẫu trong trình duyệt (tối đa 15 phút).`}
        actions={
          <>
            <Segmented<(typeof WINDOWS)[number]["value"]> label="Cửa sổ thời gian" value={win} onChange={setWin} options={WINDOWS} />
            <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {paused ? "Chạy tiếp" : "Tạm dừng"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(windowSec)} disabled={count === 0}>
              <Download aria-hidden /> Xuất CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => telemetryHistory.clear()} disabled={count === 0} title="Chỉ xoá trong trình duyệt này">
              <Trash2 aria-hidden /> Xoá
            </Button>
          </>
        }
      />
      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-3 lg:grid-cols-2">
          {CHARTS.map((c) => (
            <Panel key={c.title} title={c.title} subtitle={c.hint} icon={IconTelemetry} bodyClassName="px-2 pt-1 pb-2">
              <TimeChart series={c.series} unit={c.unit} windowSec={windowSec} paused={paused} range={c.range} digits={c.digits} label={`Biểu đồ ${c.title}`} />
            </Panel>
          ))}
        </div>
        <div>
          <LiveTable />
        </div>
      </div>
    </div>
  );
}
