/**
 * Vòng giới hạn khoảng cách phần mềm: tâm home, bán kính
 * `status.limits.max_distance_home`.
 *
 * ⚠️ SAFETY.md mục 8: đây CHỈ là lớp phụ. Nó ngăn bạn NẠP một mission ra ngoài
 * vòng; nó KHÔNG ngăn máy bay bay ra ngoài. Geofence thật là `FENCE_*` trên
 * flight controller (Phase 19). Vì vậy vòng tròn luôn đi kèm nhãn nói đúng điều
 * đó (`geofenceLabel` trong `paths.ts`, hiện cả ở tooltip lẫn chú giải bản đồ).
 */
import { Circle, Tooltip } from "react-leaflet";

import { useHome } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";

import { geofenceLabel } from "./paths";

export function GeofenceCircle() {
  const home = useHome();
  const limits = useLimits();
  if (!home || !limits) return null;
  const [line1, line2] = geofenceLabel(limits.max_distance_home);
  return (
    <Circle
      center={[home[0], home[1]]}
      radius={limits.max_distance_home}
      pathOptions={{ className: "map-geofence", weight: 2, dashArray: "6 6", fill: false }}
    >
      <Tooltip className="map-tooltip" sticky>
        {line1}
        <br />
        {line2}
      </Tooltip>
    </Circle>
  );
}
