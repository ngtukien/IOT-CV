/**
 * Hai lớp mission, vẽ KHÁC HẲN nhau (plan Phase 09 §9.3):
 *
 *   | Lớp     | Nguồn                                  | Kiểu                         |
 *   |---------|----------------------------------------|------------------------------|
 *   | Bản nháp| `useMissionStore` — chỉ trong trình duyệt | vàng, nét đứt, marker rỗng |
 *   | Đã nạp  | `readback` — FC đọc ngược, đã so khớp  | xanh lá, nét liền, marker đặc |
 *
 * Phase 07 §7.4 làm rất nhiều việc để chỉ mission ĐỌC NGƯỢC mới được coi là
 * thật. Vẽ hai lớp cùng một kiểu là vứt hết công sức đó: người dùng sẽ tin vào
 * thứ họ vừa gõ.
 *
 * `editable` (trang Nhiệm vụ): marker nháp KÉO được, và giữa mỗi chặng có một
 * nút "+" (kèm độ dài chặng) để chèn điểm vào đúng chỗ. Mọi sửa đổi chỉ chạm
 * bản nháp — không gì đi xuống drone cho tới khi bấm NẠP MISSION.
 */
import type { LeafletEventHandlerFnMap, Marker as LeafletMarker } from "leaflet";
import { useMemo } from "react";
import { Marker, Pane, Polyline, Tooltip } from "react-leaflet";

import { useHome, useMissionDraft } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";
import { haversineM } from "@/lib/geo";
import { MAV_CMD } from "@/lib/missionRules";
import type { MissionWaypoint } from "@/lib/protocol";
import { effectiveDefaultAlt, useMissionStore } from "@/store/mission";

import { insertHandleIcon, waypointIcon } from "./icons";
import { drawablePoint, missionPath } from "./paths";

/**
 * Pane riêng cho đường nháp, nằm TRÊN overlayPane (400) nơi có đường "đã nạp".
 * Không có nó thì thứ tự vẽ phụ thuộc lúc gắn: đường nháp gắn trước, đường đã
 * nạp gắn sau khi nạp xong → nét xanh 5 px đè kín nét nháp ở mọi đoạn trùng.
 * Đã gặp thật trên SITL 25/09/2026. Dưới markerPane (600) để marker vẫn nổi.
 */
const DRAFT_PANE = "mission-draft";
const DRAFT_PANE_Z = 450;

function ReadbackMarkers({ items }: { items: readonly MissionWaypoint[] }) {
  return items
    .filter((it) => (it.command ?? MAV_CMD.NAV_WAYPOINT) === MAV_CMD.NAV_WAYPOINT)
    .map((it) => {
      const p = drawablePoint(it.lat, it.lon);
      if (!p) return null;
      return (
        <Marker key={`readback-${it.seq}`} position={p} icon={waypointIcon(String(it.seq), "readback")} keyboard={false} zIndexOffset={200}>
          <Tooltip className="map-tooltip" direction="top" offset={[0, -12]}>
            Đã nạp (FC đọc lại) · WP{it.seq} · {Number(it.alt.toFixed(1))} m
          </Tooltip>
        </Marker>
      );
    });
}

function DraftMarkers({ editable }: { editable: boolean }) {
  const { badSeqs } = useMissionDraft();
  const waypoints = useMissionStore((s) => s.waypoints);
  const home = useHome();

  return waypoints.map((w, i) => {
    const seq = i + 2;
    const p = drawablePoint(w.lat, w.lon);
    if (!p) return null;
    const handlers: LeafletEventHandlerFnMap | undefined = editable
      ? {
          dragend: (e) => {
            const ll = (e.target as LeafletMarker).getLatLng();
            useMissionStore.getState().moveTo(w.id, ll.lat, ll.lng);
          },
        }
      : undefined;
    const dist = home ? haversineM(home[0], home[1], w.lat, w.lon) : null;
    return (
      <Marker
        // Khoá theo `id` ổn định: kéo điểm hay đổi thứ tự không tháo/gắn lại marker.
        key={w.id}
        position={p}
        icon={waypointIcon(String(seq), "draft", badSeqs.has(seq))}
        keyboard={false}
        draggable={editable}
        autoPan={editable}
        eventHandlers={handlers}
        zIndexOffset={300}
      >
        <Tooltip className="map-tooltip" direction="top" offset={[0, -12]}>
          Bản nháp · WP{seq} · {Number.isNaN(w.alt) ? "—" : `${Number(w.alt.toFixed(1))} m`}
          {dist === null ? "" : ` · cách home ${dist.toFixed(0)} m`}
          {editable ? <><br />Kéo để dời điểm</> : null}
        </Tooltip>
      </Marker>
    );
  });
}

/** Nút "+" giữa mỗi chặng (home→WP2, WP2→WP3, …) để chèn điểm vào giữa. */
function InsertHandles() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const defaultAlt = useMissionStore((s) => s.defaultAlt);
  const home = useHome();
  const limits = useLimits();

  const handles = useMemo(() => {
    const chain: { lat: number; lon: number }[] = [...(home ? [{ lat: home[0], lon: home[1] }] : []), ...waypoints];
    const out: { index: number; lat: number; lon: number; meters: number }[] = [];
    for (let i = 1; i < chain.length; i += 1) {
      const a = chain[i - 1];
      const b = chain[i];
      out.push({
        // Chèn vào mảng waypoint: chặng thứ i (có home) nằm trước waypoint i-1.
        index: home ? i - 1 : i,
        lat: (a.lat + b.lat) / 2,
        lon: (a.lon + b.lon) / 2,
        meters: haversineM(a.lat, a.lon, b.lat, b.lon),
      });
    }
    return out;
  }, [waypoints, home]);

  return handles.map((h) => (
    <Marker
      key={`ins-${h.index}-${h.lat.toFixed(7)}`}
      position={[h.lat, h.lon]}
      icon={insertHandleIcon(`${Math.round(h.meters)} m`)}
      keyboard={false}
      zIndexOffset={250}
      eventHandlers={{
        click: () => useMissionStore.getState().insertAt(h.index, h.lat, h.lon, effectiveDefaultAlt(defaultAlt, limits)),
      }}
    >
      <Tooltip className="map-tooltip" direction="top" offset={[0, -10]}>
        Chặng dài {h.meters.toFixed(1)} m · bấm để chèn một điểm vào giữa
      </Tooltip>
    </Marker>
  ));
}

export function MissionLayer({ editable = false }: { editable?: boolean }) {
  const { items } = useMissionDraft();
  const readback = useMissionStore((s) => s.readback);
  const hasDraftWaypoints = items.some((it) => it.command === MAV_CMD.NAV_WAYPOINT);

  return (
    <>
      {readback ? (
        <>
          <Polyline positions={missionPath(readback.waypoints)} pathOptions={{ className: "map-mission-readback", weight: 5, interactive: false }} />
          <ReadbackMarkers items={readback.waypoints} />
        </>
      ) : null}
      {hasDraftWaypoints ? (
        <>
          <Pane name={DRAFT_PANE} style={{ zIndex: DRAFT_PANE_Z }}>
            <Polyline
              positions={missionPath(items)}
              pathOptions={{ className: "map-mission-draft", weight: 3, dashArray: "8 6", interactive: false }}
            />
          </Pane>
          <DraftMarkers editable={editable} />
          {editable ? <InsertHandles /> : null}
        </>
      ) : null}
    </>
  );
}
