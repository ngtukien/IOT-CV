// Điểm khởi động của web GCS. Ghép các module lại, không chứa logic nghiệp vụ.
import { connectTelemetry } from "./telemetry.js";
import { initMap, updateUav } from "./map.js";
import { renderTelemetry, logEvent } from "./ui.js";
import { initMissionDraft } from "./mission.js";
import { initControl } from "./control.js";
import { initVideo } from "./video.js";

const map = initMap();
initMissionDraft(map);
initControl();
initVideo();

connectTelemetry({
  onUpdate(state) {
    renderTelemetry(state);
    if (state.connected && state.lat !== null && state.lon !== null) {
      updateUav(state.lat, state.lon, state.heading);
    }
  },
  onOpen() {
    logEvent("WebSocket telemetry đã kết nối");
  },
  onClose() {
    logEvent("WebSocket telemetry mất kết nối — đang thử lại");
  },
});
