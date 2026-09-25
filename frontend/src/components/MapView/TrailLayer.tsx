/**
 * Vệt đường đã bay. Luật lọc (chỉ khi armed, dịch > 2 m, tối đa 2000 điểm) ở
 * `nextTrail` (`lib/geo.ts`), store giữ kết quả; ở đây chỉ vẽ.
 */
import type { LatLngTuple } from "leaflet";
import { useMemo } from "react";
import { Polyline } from "react-leaflet";

import { useTelemetryStore } from "@/store/telemetry";

export function TrailLayer() {
  const trail = useTelemetryStore((s) => s.trail);
  // Store giữ tuple readonly; Leaflet đòi mảng thường. Chép lại chỉ khi vệt đổi
  // (store trả CÙNG tham chiếu khi gói telemetry không thêm điểm nào).
  const positions = useMemo(() => trail.map((p): LatLngTuple => [p[0], p[1]]), [trail]);
  if (positions.length < 2) return null;
  return (
    <Polyline
      positions={positions}
      pathOptions={{ className: "map-trail", weight: 3, interactive: false }}
    />
  );
}
