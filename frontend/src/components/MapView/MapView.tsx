/**
 * Bản đồ sống: drone, vệt đường, home, vòng giới hạn, và hai lớp mission.
 *
 * Tâm bản đồ (plan Phase 09 §9.1.3): căn giữa MỘT LẦN, khi lần đầu có toạ độ
 * (home → vị trí hiện tại → TP.HCM cho trang khỏi trống). Sau đó người dùng kéo
 * bản đồ đi đâu là quyền của họ — tự kéo về giữa 8 lần mỗi giây thì không ai
 * phóng to xem được chỗ nào. Nút "Theo dõi drone" bật việc bám theo, mặc định TẮT.
 *
 * Bấm lên bản đồ chỉ thêm điểm vào BẢN NHÁP trong trình duyệt. Không gì được gửi
 * xuống drone cho tới khi người dùng bấm NẠP MISSION.
 *
 * Hai cách thêm điểm, loại trừ nhau: bấm từng điểm (mặc định) hoặc "Vẽ lộ
 * trình" (terra-draw, `RouteDrawControl`). Lúc đang vẽ, bấm-để-thêm TẮT —
 * không thì mỗi cú bấm đặt đỉnh cũng sinh thêm một waypoint thừa.
 */
import { Eraser, LocateFixed, Map as MapIcon, Spline } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { toast } from "sonner";

import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { useHome } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";
import { FALLBACK_CENTER, pickMapCenter } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { effectiveDefaultAlt, useMissionStore } from "@/store/mission";
import { useTelemetryStore } from "@/store/telemetry";

import { DroneMarker } from "./DroneMarker";
import { GeofenceCircle } from "./GeofenceCircle";
import { HomeMarker } from "./HomeMarker";
import { MissionLayer } from "./MissionLayer";
import { geofenceLabel } from "./paths";
import { RouteDrawControl } from "./RouteDrawControl";
import { TrailLayer } from "./TrailLayer";

import "./map.css";

const INITIAL_ZOOM = 17;
const MAX_ZOOM = 19;

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

function Legend({ drawing }: { drawing: boolean }) {
  const home = useHome();
  const limits = useLimits();
  const hasPosition = useTelemetryStore((s) => typeof s.telemetry?.lat === "number" && typeof s.telemetry?.lon === "number");
  const fence = home && limits ? geofenceLabel(limits.max_distance_home) : null;

  return (
    <div
      className="pointer-events-none absolute bottom-2 left-2 z-[1000] max-w-[min(26rem,calc(100%-1rem))] space-y-1 rounded-lg border border-border bg-background/85 px-2.5 py-2 text-[11px] leading-snug text-foreground/85 backdrop-blur"
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
      {drawing ? (
        <p className="text-hud-amber" data-testid="draw-hint">
          Đang vẽ lộ trình: bấm từng đỉnh · bấm lại đỉnh cuối hoặc Enter để xong · Esc để huỷ nét.
        </p>
      ) : (
        <p className="text-muted-foreground">Bấm lên bản đồ để thêm waypoint vào bản nháp.</p>
      )}
    </div>
  );
}

export function MapView({ style }: { style?: CSSProperties }) {
  const [follow, setFollow] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const trailLength = useTelemetryStore((s) => s.trail.length);

  const onRouteDone = useCallback((added: number) => {
    setDrawing(false);
    if (added > 0) toast.success(`Đã thêm ${added} waypoint từ lộ trình vẽ`, { description: "Vào bản nháp — chưa gửi gì xuống drone." });
  }, []);

  return (
    <Panel
      title="Bản đồ"
      icon={MapIcon}
      style={style}
      testId="map-panel"
      bodyClassName="relative min-h-[420px]"
      actions={
        <>
          <Button
            size="xs"
            variant={drawing ? "default" : "outline"}
            aria-pressed={drawing}
            onClick={() => setDrawing((d) => !d)}
          >
            <Spline aria-hidden />
            {drawing ? "Dừng vẽ" : "Vẽ lộ trình"}
          </Button>
          <Button
            size="xs"
            variant={follow ? "default" : "outline"}
            aria-pressed={follow}
            onClick={() => setFollow((f) => !f)}
          >
            <LocateFixed aria-hidden />
            Theo dõi drone
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={trailLength === 0}
            onClick={() => useTelemetryStore.getState().clearTrail()}
          >
            <Eraser aria-hidden />
            Xoá vệt
          </Button>
        </>
      }
    >
      <MapContainer
        center={[FALLBACK_CENTER[0], FALLBACK_CENTER[1]]}
        zoom={INITIAL_ZOOM}
        maxZoom={MAX_ZOOM}
        className={cn("absolute inset-0 z-0")}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={MAX_ZOOM}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ViewController follow={follow} />
        <ClickToAdd enabled={!drawing} />
        <RouteDrawControl active={drawing} onDone={onRouteDone} />
        <HomeMarker />
        <GeofenceCircle />
        <TrailLayer />
        <MissionLayer />
        {/* Vẽ sau cùng để nằm trên mọi lớp khác. */}
        <DroneMarker />
      </MapContainer>
      <Legend drawing={drawing} />
    </Panel>
  );
}
