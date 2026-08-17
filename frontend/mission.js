// Mission draft (GIAI ĐOẠN 13).
// Click bản đồ chỉ tạo draft trong browser. KHÔNG gửi từng điểm xuống UAV —
// người dùng phải bấm UPLOAD MISSION, và backend validate trước khi upload
// (GIAI ĐOẠN 14, 15).

import { logEvent } from "./ui.js";

const DEFAULT_WAYPOINT_ALT = 5;

const draft = [];
let markers = [];
let mapRef = null;

function render() {
  const list = document.getElementById("waypoint-list");
  if (list) {
    list.innerHTML = "";
    draft.forEach((wp) => {
      const item = document.createElement("li");
      item.textContent = `WP${wp.seq}: ${wp.lat.toFixed(6)}, ${wp.lon.toFixed(6)} @ ${wp.alt} m`;
      list.append(item);
    });
  }

  const uploadButton = document.getElementById("btn-upload");
  if (uploadButton) {
    // Vẫn disabled tới khi mission upload được implement ở GIAI ĐOẠN 15.
    uploadButton.title = `${draft.length} waypoint draft — upload chưa implement (GIAI ĐOẠN 15)`;
  }
}

function addWaypoint(lat, lon) {
  const waypoint = { seq: draft.length + 1, lat, lon, alt: DEFAULT_WAYPOINT_ALT };
  draft.push(waypoint);
  markers.push(
    L.circleMarker([lat, lon], { radius: 6, color: "#e0a33e" })
      .addTo(mapRef)
      .bindTooltip(`WP${waypoint.seq}`),
  );
  render();
  logEvent(`Thêm WP${waypoint.seq} vào draft`);
}

function clearDraft() {
  draft.length = 0;
  markers.forEach((marker) => marker.remove());
  markers = [];
  render();
  logEvent("Đã xoá mission draft");
}

export function initMissionDraft(map) {
  mapRef = map;
  map.on("click", (event) => addWaypoint(event.latlng.lat, event.latlng.lng));

  document.getElementById("btn-clear-draft")?.addEventListener("click", clearDraft);
  render();
}

export function getDraft() {
  return draft.map((wp) => ({ ...wp }));
}
