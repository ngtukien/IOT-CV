/**
 * Công cụ lập lộ trình của trang Nhiệm vụ — ba khối, đều chỉ chạm BẢN NHÁP:
 *
 *  - `RouteStatsCard`  : quãng đường, chặng, xa home nhất, thời gian ước lượng
 *  - `TemplatesCard`   : mẫu lộ trình tự sinh quanh home (vòng, đa giác, quét
 *                        lưới, đi–về) — thay cả bản nháp, hoàn tác được
 *  - `LibraryCard`     : lưu / nạp lộ trình trên máy này; xuất / nhập file
 *                        `.waypoints` của Mission Planner
 *
 * Không khối nào nạp gì xuống FC. Mẫu sinh ra vượt giới hạn thì luật kiểm tra
 * (soi gương backend) báo đỏ ở bảng mission — không có chuyện cắt bớt im lặng.
 */
import { Download, FileUp, FolderOpen, Save, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { IconGeofence, IconRoute, IconWaypoint } from "@/components/icons";
import { KeyValue, KeyValueList } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useHome, useMissionDraft } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";
import { downloadText } from "@/lib/csv";
import { NO_VALUE, formatClock, formatDistance, formatDuration } from "@/lib/format";
import { MAV_CMD } from "@/lib/missionRules";
import {
  estimateDuration,
  lawnmowerPattern,
  orbitPattern,
  outAndBackPattern,
  parseWaypointsFile,
  polygonPattern,
  routeStats,
  toWaypointsFile,
} from "@/lib/routeTools";
import type { GeneratedPoint } from "@/lib/routeTools";
import { cn } from "@/lib/utils";
import { effectiveDefaultAlt, useMissionStore } from "@/store/mission";
import { useSavedMissions } from "@/store/savedMissions";

/**
 * Tốc độ mặc định của ArduCopter 4.7 khi dự án KHÔNG đặt param (đã grep
 * `firmware/ardupilot/params/*.param`: không có WPNAV_SPEED*): WPNAV_SPEED
 * 1000 cm/s, WPNAV_SPEED_DN 150 cm/s. Chỉ dùng cho ƯỚC LƯỢNG thời gian — người
 * dùng sửa được ngay ở ô nhập.
 */
export const ARDUCOPTER_DEFAULT_WPNAV_SPEED_MS = 10;
export const ARDUCOPTER_DEFAULT_WPNAV_SPEED_DN_MS = 1.5;

function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  testId,
}: {
  label: string;
  value: number;
  onChange(v: number): void;
  unit: string;
  step?: number;
  min?: number;
  testId?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
      {label}
      <span className="relative">
        <Input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
          className="h-8 pr-8 font-mono text-[13px] tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px]">{unit}</span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Thống kê
// ---------------------------------------------------------------------------

export function RouteStatsCard({ className }: { className?: string }) {
  const { items } = useMissionDraft();
  const home = useHome();
  const limits = useLimits();
  const [speed, setSpeed] = useState(ARDUCOPTER_DEFAULT_WPNAV_SPEED_MS);
  const stats = useMemo(() => routeStats(items, home), [items, home]);
  const duration = estimateDuration(stats, speed, ARDUCOPTER_DEFAULT_WPNAV_SPEED_DN_MS);
  const far = stats.maxDistanceFromHome;
  const farTone = far !== null && limits && far > limits.max_distance_home ? "danger" : undefined;

  return (
    <Panel title="Thống kê lộ trình" subtitle="Tính từ bản nháp, theo thứ tự bay" icon={IconWaypoint} className={className} testId="route-stats" bodyClassName="p-3">
      <KeyValueList>
        <KeyValue label="Số waypoint" value={`${stats.waypointCount}${limits ? ` / ${limits.max_waypoints} tối đa` : ""}`} />
        <KeyValue label="Tổng quãng đường (cả lên, xuống)" value={home ? formatDistance(stats.totalDistance) : NO_VALUE} />
        <KeyValue label="Xa home nhất" value={formatDistance(far)} tone={farTone} hint="Giới hạn phần mềm đọc từ backend (max_distance_home)" />
        <KeyValue label="Cao nhất" value={stats.maxAlt === null ? NO_VALUE : `${stats.maxAlt.toFixed(1)} m`} />
        <KeyValue label="Thời gian ước lượng" value={formatDuration(duration)} hint="Chỉ là ước lượng: FC tự tăng/giảm tốc ở mỗi điểm." />
      </KeyValueList>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField label="Tốc độ bay ước tính" value={speed} onChange={setSpeed} unit="m/s" step={0.5} min={0.5} />
        <p className="self-end pb-1 text-[11px] leading-snug text-muted-foreground">
          Mặc định = WPNAV_SPEED của ArduCopter (dự án chưa đặt param này).
        </p>
      </div>
      {stats.legs.length > 0 ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Từng chặng ({stats.legs.length})</summary>
          <ol className="mt-2 space-y-1 font-mono text-[11px]">
            {stats.legs.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate text-muted-foreground">
                  {l.from} → {l.to}
                </span>
                <span className="shrink-0">
                  {l.distance.toFixed(1)} m · {Math.round(l.bearing)}° {l.climb !== 0 ? `· ${l.climb > 0 ? "+" : ""}${l.climb.toFixed(1)} m` : ""}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Mẫu lộ trình
// ---------------------------------------------------------------------------

type Template = "orbit" | "polygon" | "lawnmower" | "outback";

function TemplatePreview({ points, home }: { points: GeneratedPoint[]; home: [number, number] }) {
  // Hình thu nhỏ: chiếu phẳng quanh home, co về khung 120×120.
  const k = 111_320;
  const xy = points.map((p) => [(p.lon - home[1]) * k * Math.cos((home[0] * Math.PI) / 180), (p.lat - home[0]) * k] as const);
  const span = Math.max(1, ...xy.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
  const s = 50 / span;
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${(60 + x * s).toFixed(1)},${(60 - y * s).toFixed(1)}`).join("");
  return (
    <svg viewBox="0 0 120 120" className="size-28 shrink-0 rounded-lg bg-foreground/4" aria-hidden>
      <path d={`M60,60${d.replace(/^M/, "L")}`} fill="none" stroke="var(--hud-amber)" strokeWidth={1.5} strokeDasharray="4 3" />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={60 + x * s} cy={60 - y * s} r={2.4} fill="var(--hud-amber)" />
      ))}
      <rect x={56} y={56} width={8} height={8} rx={2} fill="var(--hud-cyan)" />
    </svg>
  );
}

export function TemplatesCard({ className }: { className?: string }) {
  const home = useHome();
  const limits = useLimits();
  const defaultAlt = useMissionStore((s) => s.defaultAlt);
  const alt = effectiveDefaultAlt(defaultAlt, limits);
  const maxR = limits?.max_distance_home ?? 50;
  const [kind, setKind] = useState<Template>("orbit");
  const [radius, setRadius] = useState(() => Math.round(maxR * 0.6));
  const [count, setCount] = useState(6);
  const [width, setWidth] = useState(() => Math.round(maxR * 0.8));
  const [spacing, setSpacing] = useState(10);
  const [angle, setAngle] = useState(0);

  const points = useMemo<GeneratedPoint[]>(() => {
    if (!home || !Number.isFinite(alt)) return [];
    switch (kind) {
      case "orbit":
        return orbitPattern(home, radius, count, alt, angle);
      case "polygon":
        return polygonPattern(home, radius, count, alt, angle);
      case "lawnmower":
        return lawnmowerPattern(home, width, width, spacing, alt, angle);
      case "outback":
        return outAndBackPattern(home, radius, angle, alt);
    }
  }, [home, alt, kind, radius, count, width, spacing, angle]);

  const apply = () => {
    useMissionStore.getState().replaceWaypoints(points);
    toast.success(`Đã thay bản nháp bằng mẫu ${points.length} điểm`, { description: "Ctrl+Z để hoàn tác. Chưa gửi gì xuống drone." });
  };
  const tooMany = limits && points.length > limits.max_waypoints;

  return (
    <Panel title="Mẫu lộ trình" subtitle="Sinh sẵn quanh điểm home — chỉnh tham số rồi áp dụng" icon={IconGeofence} className={className} testId="route-templates" bodyClassName="flex flex-col gap-3 p-3">
      <Segmented<Template>
        label="Kiểu mẫu"
        value={kind}
        onChange={setKind}
        size="xs"
        options={[
          { value: "orbit", label: "Vòng tròn" },
          { value: "polygon", label: "Đa giác" },
          { value: "lawnmower", label: "Quét lưới" },
          { value: "outback", label: "Đi – về" },
        ]}
      />
      {!home ? (
        <p className="text-xs text-hud-amber">Chưa có điểm home — mẫu sinh quanh home nên cần GPS fix trước.</p>
      ) : (
        <div className="flex gap-3">
          <TemplatePreview points={points} home={[home[0], home[1]]} />
          <div className="grid flex-1 grid-cols-2 content-start gap-2">
            {kind === "lawnmower" ? (
              <>
                <NumberField label="Cạnh vùng quét" value={width} onChange={setWidth} unit="m" min={2} />
                <NumberField label="Khoảng cách làn" value={spacing} onChange={setSpacing} unit="m" min={1} />
              </>
            ) : (
              <NumberField label={kind === "outback" ? "Quãng đi" : "Bán kính"} value={radius} onChange={setRadius} unit="m" min={1} />
            )}
            {kind === "orbit" || kind === "polygon" ? (
              <NumberField label={kind === "orbit" ? "Số điểm" : "Số cạnh"} value={count} onChange={setCount} unit="điểm" min={3} />
            ) : null}
            <NumberField label={kind === "outback" ? "Hướng bay" : "Xoay"} value={angle} onChange={setAngle} unit="°" step={15} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[11px]", tooMany ? "text-hud-amber" : "text-muted-foreground")}>
          {points.length} điểm ở {Number.isFinite(alt) ? `${alt} m` : "—"}
          {tooMany ? ` — vượt ${limits.max_waypoints} điểm cho phép, bảng sẽ báo lỗi` : ""}
        </p>
        <Button size="sm" disabled={points.length === 0} onClick={apply} data-testid="apply-template">
          Áp dụng vào bản nháp
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Thư viện + file
// ---------------------------------------------------------------------------

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

export function LibraryCard({ className }: { className?: string }) {
  const { items } = useMissionDraft();
  const home = useHome();
  const waypoints = useMissionStore((s) => s.waypoints);
  const takeoffAlt = useMissionStore((s) => s.takeoffAlt);
  const finalCommand = useMissionStore((s) => s.finalCommand);
  const saved = useSavedMissions((s) => s.items);
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const label = name.trim() || `Lộ trình ${new Date().toLocaleString("vi-VN")}`;
    useSavedMissions.getState().save({
      name: label,
      takeoffAlt,
      finalCommand,
      waypoints: waypoints.map((w) => ({ lat: w.lat, lon: w.lon, alt: w.alt })),
    });
    setName("");
    toast.success(`Đã lưu “${label}” trên máy này`);
  };

  const onImport = async (file: File) => {
    try {
      const parsed = parseWaypointsFile(await file.text());
      useMissionStore.getState().loadDraft({
        takeoffAlt: parsed.takeoffAlt ?? takeoffAlt,
        finalCommand: parsed.finalCommand ?? MAV_CMD.NAV_RETURN_TO_LAUNCH,
        waypoints: parsed.waypoints,
      });
      toast.success(`Đã nạp ${parsed.waypoints.length} waypoint từ ${file.name}`, {
        description: parsed.skipped.length
          ? `Bỏ qua ${parsed.skipped.length} lệnh web không soạn được (MAV_CMD ${[...new Set(parsed.skipped)].join(", ")}).`
          : "Vào bản nháp — chưa gửi gì xuống drone.",
      });
    } catch (err) {
      toast.error("Không đọc được file", { description: (err as Error).message });
    }
  };

  return (
    <Panel title="Thư viện & file" subtitle="Lưu trên máy này · trao đổi với Mission Planner" icon={IconRoute} className={className} testId="route-library" bodyClassName="flex flex-col gap-3 p-3">
      <Row>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên lộ trình (tuỳ chọn)"
          className="h-8 flex-1 text-[13px]"
          aria-label="Tên lộ trình"
        />
        <Button size="sm" disabled={waypoints.length === 0} onClick={save}>
          <Save aria-hidden /> Lưu
        </Button>
      </Row>
      <Row>
        <Button
          size="sm"
          variant="outline"
          disabled={waypoints.length === 0}
          onClick={() => downloadText(`iot-cv-mission-${Date.now()}.waypoints`, toWaypointsFile(items, home))}
          title="File .waypoints mở được bằng Mission Planner (Plan → Load WP File)"
        >
          <Download aria-hidden /> Xuất .waypoints
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <FileUp aria-hidden /> Nhập file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".waypoints,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
      </Row>
      {saved.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa lưu lộ trình nào.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {saved.map((m) => (
            <li key={m.id} className="well flex items-center gap-2 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{m.name}</p>
                <p className="font-mono text-[10.5px] text-muted-foreground">
                  {m.waypoints.length} điểm · {formatClock(m.savedAt / 1000)} {new Date(m.savedAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Nạp ${m.name} vào bản nháp`}
                onClick={() => {
                  useMissionStore.getState().loadDraft(m);
                  toast.success(`Đã nạp “${m.name}” vào bản nháp`, { description: "Ctrl+Z để hoàn tác." });
                }}
              >
                <FolderOpen />
              </Button>
              <Button size="icon-sm" variant="ghost" className="text-hud-red" aria-label={`Xoá ${m.name}`} onClick={() => useSavedMissions.getState().remove(m.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
