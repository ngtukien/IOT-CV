/**
 * Trang KHÔNG GIAN 3D — bản sao số của drone, toàn khung.
 *
 * Lớp phủ:
 *   trái trên  : màn hình bay thu nhỏ (bản PHỤ — không gắn testid của E2E)
 *   phải trên  : bảng điều khiển — góc máy, giờ trong ngày, lớp, chất lượng
 *   phải dưới  : bản đồ nhỏ (Leaflet) để định hướng
 *   dưới giữa  : dải số chính (độ cao, tốc độ, pin, khoảng cách vật cản)
 *
 * Phím 1–5 đổi góc máy (không trùng phím lái W A S D R F Q E / mũi tên / Space).
 */
import { Camera, Clapperboard, Eye, Layers3, Mountain, Orbit, Plane, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { PrimaryFlightDisplay } from "@/components/Hud/PrimaryFlightDisplay";
import { MapView } from "@/components/MapView/MapView";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { TwinScene } from "@/components/twin/TwinScene";
import type { CameraMode, TimeOfDay } from "@/components/twin/TwinScene";
import { formatNumber } from "@/lib/format";
import { AVOID_STATE_LABEL } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import type { TwinGround, TwinQuality } from "@/store/settings";
import { useTelemetryStore } from "@/store/telemetry";

const CAMERAS: { value: CameraMode; label: string; icon: typeof Camera; hint: string }[] = [
  { value: "chase", label: "Bám đuôi", icon: Plane, hint: "Sau lưng drone, quay theo hướng mũi" },
  { value: "orbit", label: "Tự do", icon: Orbit, hint: "Kéo chuột để xoay, cuộn để phóng — tâm bám theo drone" },
  { value: "top", label: "Từ trên", icon: Eye, hint: "Nhìn thẳng xuống, bắc ở trên như bản đồ" },
  { value: "fpv", label: "FPV", icon: Camera, hint: "Từ camera ESP32 trên mũi (nghiêng xuống 15°)" },
  { value: "cinematic", label: "Điện ảnh", icon: Clapperboard, hint: "Máy quay tự bay vòng, có xoá phông" },
];

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Camera; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="eyebrow flex items-center gap-1.5 text-[10px]">
        <Icon className="size-3.5" /> {title}
      </p>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[12.5px]">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function StatStrip() {
  const alt = useTelemetryStore((s) => s.telemetry?.relative_alt);
  const speed = useTelemetryStore((s) => s.telemetry?.ground_speed);
  const battery = useTelemetryStore((s) => s.telemetry?.battery_remaining);
  const obstacle = useTelemetryStore((s) => s.telemetry?.obstacle_distance);
  const avoid = useTelemetryStore((s) => s.telemetry?.avoid_state);
  const cells: [string, string][] = [
    ["Độ cao", formatNumber(alt, 1, "m")],
    ["Tốc độ", formatNumber(speed, 1, "m/s")],
    ["Pin", formatNumber(battery, 0, "%")],
    ["Vật cản", `${formatNumber(obstacle, 1, "m")} · ${avoid ? AVOID_STATE_LABEL[avoid] : "—"}`],
  ];
  return (
    <div className="glass-fixed pointer-events-auto flex divide-x divide-border rounded-2xl">
      {cells.map(([k, v]) => (
        <div key={k} className="px-4 py-2 text-center">
          <p className="eyebrow text-[9.5px]">{k}</p>
          <p className="num text-[15px] font-semibold">{v}</p>
        </div>
      ))}
    </div>
  );
}

export default function TwinPage() {
  const settings = useSettings();
  const [camera, setCamera] = useState<CameraMode>("chase");
  const [time, setTime] = useState<TimeOfDay>("live");
  const [layers, setLayers] = useState({ mission: true, geofence: true, trail: true, beam: true });
  const [panelOpen, setPanelOpen] = useState(true);
  const hasTelemetry = useTelemetryStore((s) => s.telemetry !== null && s.telemetry.lat != null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const i = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].indexOf(e.code);
      if (i >= 0) setCamera(CAMERAS[i].value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative h-[calc(100dvh-5.75rem)] min-h-[560px] overflow-hidden" data-testid="twin-page">
      <TwinScene
        camera={camera}
        quality={settings.twinQuality}
        ground={settings.twinGround}
        effects={settings.twinEffects}
        timeOfDay={time}
        showMission={layers.mission}
        showGeofence={layers.geofence}
        showTrail={layers.trail}
        showBeam={layers.beam}
        className="absolute inset-0"
      />

      {/* Letterbox cho góc máy điện ảnh */}
      {camera === "cinematic" ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[7%] bg-black/85" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[7%] bg-black/85" />
        </>
      ) : null}

      <div className="pointer-events-none absolute inset-0 p-3">
        {/* HUD thu nhỏ */}
        {camera !== "cinematic" ? (
          <div className="dark pointer-events-auto absolute top-3 left-3 w-[min(340px,40vw)] rounded-2xl border border-white/10 bg-[oklch(0.12_0.02_262/78%)] p-2 text-foreground backdrop-blur-md">
            <PrimaryFlightDisplay instrumented={false} />
          </div>
        ) : null}

        {!hasTelemetry ? (
          <div className="glass-fixed pointer-events-auto absolute top-3 left-1/2 max-w-md -translate-x-1/2 rounded-xl px-4 py-2 text-center text-[12.5px]">
            Chưa có vị trí từ drone — model đứng ở bãi đáp. Bật SITL hoặc nối drone để thấy nó bay theo dữ liệu thật.
          </div>
        ) : null}

        {/* Bảng điều khiển */}
        <div className="pointer-events-auto absolute top-3 right-3 w-72">
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="glass-fixed mb-2 ml-auto flex h-8 items-center gap-2 rounded-lg px-3 text-xs"
            aria-expanded={panelOpen}
          >
            <Layers3 className="size-3.5" /> {panelOpen ? "Ẩn bảng điều khiển" : "Bảng điều khiển 3D"}
          </button>
          {panelOpen ? (
            <div className="glass-fixed max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto rounded-2xl p-3.5" data-testid="twin-controls">
              <Section title="Góc máy (phím 1–5)" icon={Camera}>
                <div className="grid grid-cols-2 gap-1.5">
                  {CAMERAS.map((c, i) => {
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        title={c.hint}
                        onClick={() => setCamera(c.value)}
                        aria-pressed={camera === c.value}
                        data-testid={`cam-${c.value}`}
                        className={cn(
                          "flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] transition-colors",
                          camera === c.value ? "border-hud-cyan/45 bg-hud-cyan/14 text-foreground" : "border-border text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" /> {c.label}
                        <span className="ml-auto font-mono text-[10px] opacity-60">{i + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title="Ánh sáng" icon={Sun}>
                <Segmented<TimeOfDay>
                  label="Giờ trong ngày"
                  value={time}
                  onChange={setTime}
                  size="xs"
                  options={[
                    { value: "live", label: "Giờ thật" },
                    { value: "noon", label: "Trưa" },
                    { value: "golden", label: "Chiều" },
                    { value: "night", label: "Đêm" },
                  ]}
                />
              </Section>
              <Section title="Mặt đất" icon={Mountain}>
                <Segmented<TwinGround>
                  label="Mặt đất"
                  value={settings.twinGround}
                  onChange={(v) => settings.set("twinGround", v)}
                  size="xs"
                  className="flex-wrap"
                  options={[
                    { value: "satellite", label: "Vệ tinh" },
                    { value: "streets", label: "Đường phố" },
                    { value: "topo", label: "Địa hình" },
                    { value: "grid", label: "Offline" },
                  ]}
                />
              </Section>
              <Section title="Lớp hiển thị" icon={Layers3}>
                <div className="space-y-2">
                  <Toggle label="Mission (nháp + đã nạp)" checked={layers.mission} onChange={(v) => setLayers((l) => ({ ...l, mission: v }))} />
                  <Toggle label="Rào phần mềm" checked={layers.geofence} onChange={(v) => setLayers((l) => ({ ...l, geofence: v }))} />
                  <Toggle label="Vệt bay 3D" checked={layers.trail} onChange={(v) => setLayers((l) => ({ ...l, trail: v }))} />
                  <Toggle label="Tia TFmini" checked={layers.beam} onChange={(v) => setLayers((l) => ({ ...l, beam: v }))} />
                </div>
              </Section>
              <Section title="Chất lượng render" icon={Clapperboard}>
                <Segmented<TwinQuality>
                  label="Chất lượng"
                  value={settings.twinQuality}
                  onChange={(v) => settings.set("twinQuality", v)}
                  size="xs"
                  options={[
                    { value: "low", label: "Thấp" },
                    { value: "medium", label: "Vừa" },
                    { value: "high", label: "Cao" },
                    { value: "ultra", label: "Cực cao" },
                  ]}
                />
                <Toggle label="Hậu kỳ (bloom, AO, xoá phông)" checked={settings.twinEffects} onChange={(v) => settings.set("twinEffects", v)} />
              </Section>
            </div>
          ) : null}
        </div>

        {/* Dải số */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <StatStrip />
        </div>

        {/* Bản đồ nhỏ */}
        <div className="pointer-events-auto absolute right-3 bottom-4 hidden h-48 w-64 overflow-hidden rounded-2xl border border-panel-edge shadow-xl lg:block">
          <MapView mode="flight" compact className="relative h-full w-full" />
        </div>
      </div>
    </div>
  );
}
