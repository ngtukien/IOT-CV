/**
 * Bản đồ sống — dùng ở trang Bay (`mode="flight"`) và trang Nhiệm vụ (`mode="plan"`).
 * Component này LẤP ĐẦY khung cha; trang tự bọc nó trong panel.
 *
 * Tâm bản đồ (plan Phase 09 §9.1.3): căn giữa MỘT LẦN, khi lần đầu có toạ độ
 * (home → vị trí hiện tại → TP.HCM cho trang khỏi trống). Sau đó người dùng kéo
 * bản đồ đi đâu là quyền của họ. "Theo dõi drone" bật việc bám theo, mặc định TẮT.
 *
 * `plan`: bấm bản đồ thêm điểm vào BẢN NHÁP, vẽ lộ trình bằng terra-draw, kéo
 * marker để dời điểm, bấm "+" giữa chặng để chèn. Không gì được gửi xuống drone
 * cho tới khi người dùng bấm NẠP MISSION.
 * `flight`: bấm bản đồ KHÔNG làm gì — lúc đang bay, một cú bấm nhầm không được
 * đổi bản nháp.
 *
 * Bấm-để-thêm và vẽ lộ trình loại trừ nhau: lúc đang vẽ, bấm-để-thêm TẮT —
 * không thì mỗi cú bấm đặt đỉnh cũng sinh thêm một waypoint thừa.
 */
import L from "leaflet";
import { Crosshair, Eraser, Expand, Home, Layers, LocateFixed, Minus, Plus, Route, Shrink, Spline } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { toast } from "sonner";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHome, useMissionDraft } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";
import { FALLBACK_CENTER, pickMapCenter } from "@/lib/geo";
import { MAP_BASES, mapBase } from "@/lib/mapLayers";
import type { MapBaseId } from "@/lib/mapLayers";
import { cn } from "@/lib/utils";
import { effectiveDefaultAlt, useMissionStore } from "@/store/mission";
import { useSettings } from "@/store/settings";
import { useTelemetryStore } from "@/store/telemetry";

import { DroneMarker } from "./DroneMarker";
import { GeofenceCircle } from "./GeofenceCircle";
import { HomeMarker } from "./HomeMarker";
import { MissionLayer } from "./MissionLayer";
import { geofenceLabel } from "./paths";
import { TrailLayer } from "./TrailLayer";

import "./map.css";

/** terra-draw (~250 KB) chỉ cần khi VẼ lộ trình — nạp lúc bấm nút vẽ, không bắt trang Bay chờ nó. */
const RouteDrawControl = lazy(() => import("./RouteDrawControl").then((m) => ({ default: m.RouteDrawControl })));

const INITIAL_ZOOM = 17;
const MAX_ZOOM = 21;

/** Căn giữa một lần + bám theo drone khi bật. Không vẽ gì. */
function ViewController({ follow }: { follow: boolean }) {
  const map = useMap();
  const centered = useRef(false);
  const homeLat = useTelemetryStore((s) => s.telemetry?.home_lat ?? null);
  const homeLon = useTelemetryStore((s) => s.telemetry?.home_lon ?? null);
  const lat = useTelemetryStore((s) => s.telemetry?.lat ?? null);
  const lon = useTelemetryStore((s) => s.telemetry?.lon ?? null);

  useEffect(() => {
    if (centered.current) return;
    const c = pickMapCenter({ home_lat: homeLat, home_lon: homeLon, lat, lon });
    if (!c) return;
    map.setView([c[0], c[1]], map.getZoom(), { animate: false });
    centered.current = true;
  }, [map, homeLat, homeLon, lat, lon]);

  useEffect(() => {
    if (follow && lat !== null && lon !== null) map.panTo([lat, lon], { animate: false });
  }, [map, follow, lat, lon]);

  return null;
}

/** Bấm bản đồ → thêm một điểm vào bản nháp, độ cao = độ cao mặc định (kẹp theo giới hạn). */
function ClickToAdd({ enabled }: { enabled: boolean }) {
  const limits = useLimits();
  useMapEvents({
    click(e) {
      if (!enabled) return;
      const { addWaypoint, defaultAlt } = useMissionStore.getState();
      addWaypoint(e.latlng.lat, e.latlng.lng, effectiveDefaultAlt(defaultAlt, limits));
    },
  });
  return null;
}

/** Thước tỉ lệ (mét) góc trái dưới. */
function ScaleBar() {
  const map = useMap();
  useEffect(() => {
    const ctl = L.control.scale({ imperial: false, position: "bottomleft", maxWidth: 140 });
    ctl.addTo(map);
    return () => {
      ctl.remove();
    };
  }, [map]);
  return null;
}

/** Toạ độ dưới con trỏ — để đọc/ghi lại một điểm chính xác tới 1e-6 độ (~10 cm). */
function CursorReadout() {
  const [pos, setPos] = useState<L.LatLng | null>(null);
  useMapEvents({
    mousemove: (e) => setPos(e.latlng),
    mouseout: () => setPos(null),
  });
  if (!pos) return null;
  return (
    <div className="pointer-events-none absolute right-2 bottom-7 z-[1000] rounded-md bg-[oklch(0.16_0.02_258/80%)] px-2 py-0.5 font-mono text-[10.5px] text-white/90">
      {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
    </div>
  );
}

/** Cầu nối: cho các nút ngoài `MapContainer` gọi được bản đồ. */
function MapRefBridge({ onMap }: { onMap(map: L.Map): void }) {
  const map = useMap();
  useEffect(() => onMap(map), [map, onMap]);
  return null;
}

function ToolButton({
  label,
  active,
  onClick,
  disabled,
  children,
  testId,
}: {
  label: string;
  active?: boolean;
  onClick(): void;
  disabled?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          data-testid={testId}
          className={cn(
            "grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-40",
            active ? "bg-hud-cyan/22 text-hud-cyan" : "text-foreground/85 hover:bg-foreground/8",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function LayerPicker({ value, onChange, onClose }: { value: MapBaseId; onChange(id: MapBaseId): void; onClose(): void }) {
  return (
    <div className="glass-fixed absolute top-2 right-12 z-[1001] w-64 rounded-xl p-1.5 shadow-xl" role="listbox" aria-label="Bản đồ nền">
      <p className="eyebrow px-2 pt-1 pb-1.5 text-[10px]">Bản đồ nền</p>
      {MAP_BASES.map((b) => (
        <button
          key={b.id}
          type="button"
          role="option"
          aria-selected={b.id === value}
          data-testid={`map-base-${b.id}`}
          onClick={() => {
            onChange(b.id);
            onClose();
          }}
          className={cn(
            "flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left transition-colors",
            b.id === value ? "bg-hud-cyan/14 text-foreground" : "hover:bg-foreground/6",
          )}
        >
          <span className="text-[13px] font-medium">{b.label}</span>
          <span className="text-[11px] leading-snug text-muted-foreground">{b.hint}</span>
        </button>
      ))}
    </div>
  );
}

function Legend({ mode, drawing }: { mode: "flight" | "plan"; drawing: boolean }) {
  const home = useHome();
  const limits = useLimits();
  const hasPosition = useTelemetryStore((s) => typeof s.telemetry?.lat === "number" && typeof s.telemetry?.lon === "number");
  const fence = home && limits ? geofenceLabel(limits.max_distance_home) : null;

  return (
    <div
      className="pointer-events-none absolute top-2 left-2 z-[1000] max-w-[min(24rem,calc(100%-4rem))] space-y-1 rounded-xl border border-panel-edge bg-[color-mix(in_oklch,var(--panel-strong)_84%,transparent)] px-2.5 py-2 text-[11px] leading-snug text-foreground/90 backdrop-blur-md"
      data-testid="map-legend"
    >
      <p className="flex items-center gap-2">
        <span className="inline-block h-0 w-6 border-t-2 border-dashed border-hud-amber" aria-hidden />
        Bản nháp — chỉ nằm trong trình duyệt
      </p>
      <p className="flex items-center gap-2">
        <span className="inline-block h-0 w-6 border-t-4 border-hud-green" aria-hidden />
        Đã nạp — FC đọc lại xác nhận
      </p>
      {fence ? (
        <p className="flex items-start gap-2 text-hud-amber" data-testid="geofence-label">
          <span className="mt-1.5 inline-block h-0 w-6 shrink-0 border-t-2 border-dashed border-hud-amber" aria-hidden />
          <span>
            {fence[0]}
            <br />
            {fence[1]}
          </span>
        </p>
      ) : null}
      {!hasPosition ? <p className="text-muted-foreground">Chưa có vị trí GPS của drone.</p> : null}
      {mode === "plan" ? (
        drawing ? (
          <p className="text-hud-amber" data-testid="draw-hint">
            Đang vẽ lộ trình: bấm từng đỉnh · bấm lại đỉnh cuối hoặc Enter để xong · Esc để huỷ nét.
          </p>
        ) : (
          <p className="text-muted-foreground">Bấm bản đồ để thêm điểm · kéo điểm để dời · bấm “+” giữa chặng để chèn.</p>
        )
      ) : null}
    </div>
  );
}

export interface MapViewProps {
  mode: "flight" | "plan";
  /** Lớp định vị + cỡ của khung (mặc định `relative h-full min-h-[320px] w-full`). Truyền vào là THAY, không gộp. */
  className?: string;
  /** Ẩn chú giải (bản đồ nhỏ phủ trong khung khác). */
  compact?: boolean;
  /** Nút phụ thêm vào thanh công cụ (ví dụ nút chuyển sang 3D). */
  extraTools?: ReactNode;
}

export function MapView({ mode, className, compact = false, extraTools }: MapViewProps) {
  const [follow, setFollow] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const trailLength = useTelemetryStore((s) => s.trail.length);
  const baseId = useSettings((s) => s.mapBase);
  const showTrail = useSettings((s) => s.showTrail);
  const showGeofence = useSettings((s) => s.showGeofence);
  const setSetting = useSettings((s) => s.set);
  const home = useHome();
  const { items } = useMissionDraft();
  const base = mapBase(baseId);
  const plan = mode === "plan";

  const onRouteDone = useCallback((added: number) => {
    setDrawing(false);
    if (added > 0) toast.success(`Đã thêm ${added} waypoint từ lộ trình vẽ`, { description: "Vào bản nháp — chưa gửi gì xuống drone." });
  }, []);
  const onMap = useCallback((m: L.Map) => {
    mapRef.current = m;
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  // Đổi cỡ khung (toàn màn hình, đổi bố cục) thì Leaflet phải đo lại, nếu không nửa bản đồ xám.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize({ animate: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitMission = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts = items.filter((it) => it.lat !== 0 || it.lon !== 0).map((it): L.LatLngTuple => [it.lat, it.lon]);
    if (home) pts.push([home[0], home[1]]);
    if (pts.length === 0) return;
    map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 19 });
  };
  const centerHome = () => {
    if (home) mapRef.current?.setView([home[0], home[1]], Math.max(mapRef.current.getZoom(), 17));
  };
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  return (
    <div ref={wrapRef} className={cn("overflow-hidden bg-[var(--canvas-1)]", className ?? "relative h-full min-h-[320px] w-full")} data-testid="map-view" data-mode={mode}>
      <MapContainer
        center={[FALLBACK_CENTER[0], FALLBACK_CENTER[1]]}
        zoom={INITIAL_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomControl={false}
        className="absolute inset-0 z-0"
      >
        <TileLayer
          key={base.id}
          url={base.base.url}
          subdomains={base.base.subdomains ?? "abc"}
          maxNativeZoom={base.base.maxNativeZoom}
          maxZoom={MAX_ZOOM}
          attribution={base.base.attribution}
        />
        {base.overlay ? (
          <TileLayer
            key={`${base.id}-overlay`}
            url={base.overlay.url}
            maxNativeZoom={base.overlay.maxNativeZoom}
            maxZoom={MAX_ZOOM}
            attribution={base.overlay.attribution}
          />
        ) : null}
        <MapRefBridge onMap={onMap} />
        <ViewController follow={follow} />
        {plan ? <ClickToAdd enabled={!drawing} /> : null}
        {plan && drawing ? (
          <Suspense fallback={null}>
            <RouteDrawControl active={drawing} onDone={onRouteDone} />
          </Suspense>
        ) : null}
        <ScaleBar />
        {compact ? null : <CursorReadout />}
        <HomeMarker />
        {showGeofence ? <GeofenceCircle /> : null}
        {showTrail ? <TrailLayer /> : null}
        <MissionLayer editable={plan} />
        {/* Vẽ sau cùng để nằm trên mọi lớp khác. */}
        <DroneMarker />
      </MapContainer>

      {compact ? null : <Legend mode={mode} drawing={drawing} />}

      {compact ? null : (
      <div className="glass-fixed absolute top-2 right-2 z-[1000] flex flex-col gap-0.5 rounded-xl p-1" role="toolbar" aria-label="Công cụ bản đồ">
        <ToolButton label="Bản đồ nền" active={picker} onClick={() => setPicker((p) => !p)} testId="map-layers">
          <Layers className="size-4" />
        </ToolButton>
        <ToolButton label="Phóng to" onClick={() => mapRef.current?.zoomIn()}>
          <Plus className="size-4" />
        </ToolButton>
        <ToolButton label="Thu nhỏ" onClick={() => mapRef.current?.zoomOut()}>
          <Minus className="size-4" />
        </ToolButton>
        <span className="mx-1.5 my-0.5 h-px bg-border" />
        <ToolButton label="Theo dõi drone" active={follow} onClick={() => setFollow((f) => !f)} testId="map-follow">
          <LocateFixed className="size-4" />
        </ToolButton>
        <ToolButton label="Về điểm home" onClick={centerHome} disabled={!home}>
          <Home className="size-4" />
        </ToolButton>
        <ToolButton label="Xem trọn lộ trình" onClick={fitMission} disabled={items.length <= 2 && !home}>
          <Crosshair className="size-4" />
        </ToolButton>
        {plan ? (
          <ToolButton label={drawing ? "Dừng vẽ lộ trình" : "Vẽ lộ trình (nhiều điểm một lần)"} active={drawing} onClick={() => setDrawing((d) => !d)} testId="map-draw">
            <Spline className="size-4" />
          </ToolButton>
        ) : null}
        <ToolButton label="Xoá vệt đường bay" onClick={() => useTelemetryStore.getState().clearTrail()} disabled={trailLength === 0}>
          <Eraser className="size-4" />
        </ToolButton>
        <ToolButton
          label={showTrail ? "Ẩn vệt đường bay" : "Hiện vệt đường bay"}
          active={showTrail}
          onClick={() => setSetting("showTrail", !showTrail)}
        >
          <Route className="size-4" />
        </ToolButton>
        <ToolButton label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"} onClick={toggleFullscreen}>
          {fullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
        </ToolButton>
        {extraTools}
      </div>
      )}

      {picker ? <LayerPicker value={base.id} onChange={(id) => setSetting("mapBase", id)} onClose={() => setPicker(false)} /> : null}
    </div>
  );
}
