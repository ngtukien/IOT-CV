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
 * thứ họ vừa gõ. Lớp "đã nạp" chỉ có khi `readback` khác `null`, và
 * `useMissionReadback` chỉ đặt nó khi `source === "readback"`.
 */
import { Marker, Pane, Polyline, Tooltip } from "react-leaflet";

import { useMissionDraft } from "@/hooks/useMissionDraft";
import { MAV_CMD } from "@/lib/missionRules";
import type { MissionWaypoint } from "@/lib/protocol";
import { useMissionStore } from "@/store/mission";

import { waypointIcon } from "./icons";
import { drawablePoint, missionPath } from "./paths";

/**
 * Pane riêng cho đường nháp, nằm TRÊN overlayPane (400) nơi có đường "đã nạp".
 * Không có nó thì thứ tự vẽ phụ thuộc lúc gắn: đường nháp gắn trước, đường đã
 * nạp gắn sau khi nạp xong → nét xanh 5 px đè kín nét nháp ở mọi đoạn trùng.
 * Đã gặp thật trên SITL 25/09/2026. Dưới markerPane (600) để marker vẫn nổi.
 */
const DRAFT_PANE = "mission-draft";
const DRAFT_PANE_Z = 450;

function WaypointMarkers({
  items,
  kind,
  badSeqs,
}: {
  items: readonly MissionWaypoint[];
  kind: "draft" | "readback";
  badSeqs?: ReadonlySet<number>;
}) {
  return items
    .filter((it) => (it.command ?? MAV_CMD.NAV_WAYPOINT) === MAV_CMD.NAV_WAYPOINT)
    .map((it) => {
      const p = drawablePoint(it.lat, it.lon);
      if (!p) return null;
      return (
        <Marker
          // Khoá theo seq + kiểu là đủ: lớp này không có ô nhập nào để giữ trạng thái.
          key={`${kind}-${it.seq}`}
          position={p}
          icon={waypointIcon(String(it.seq), kind, badSeqs?.has(it.seq))}
          keyboard={false}
          zIndexOffset={kind === "readback" ? 200 : 300}
        >
          <Tooltip className="map-tooltip" direction="top" offset={[0, -10]}>
            {kind === "draft" ? "Bản nháp" : "Đã nạp (FC đọc lại)"} · WP{it.seq} · {Number(it.alt.toFixed(1))} m
          </Tooltip>
        </Marker>
      );
    });
}

export function MissionLayer() {
  const { items, badSeqs } = useMissionDraft();
  const readback = useMissionStore((s) => s.readback);
  const hasDraftWaypoints = items.some((it) => it.command === MAV_CMD.NAV_WAYPOINT);

  return (
    <>
      {readback ? (
        <>
          <Polyline
            positions={missionPath(readback.waypoints)}
            pathOptions={{ className: "map-mission-readback", weight: 5, interactive: false }}
          />
          <WaypointMarkers items={readback.waypoints} kind="readback" />
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
          <WaypointMarkers items={items} kind="draft" badSeqs={badSeqs} />
        </>
      ) : null}
    </>
  );
}
