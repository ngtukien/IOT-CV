/** Điểm home (chỗ cất cánh, ArduPilot `HOME_POSITION`). Chưa có thì không vẽ. */
import { Marker, Tooltip } from "react-leaflet";

import { useHome } from "@/hooks/useMissionDraft";

import { HOME_ICON } from "./icons";

export function HomeMarker() {
  const home = useHome();
  if (!home) return null;
  return (
    <Marker position={[home[0], home[1]]} icon={HOME_ICON} keyboard={false} zIndexOffset={500}>
      <Tooltip className="map-tooltip" direction="top" offset={[0, -10]}>
        Điểm home — nơi drone cất cánh và nơi RTL quay về
      </Tooltip>
    </Marker>
  );
}
