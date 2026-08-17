// Bản đồ Leaflet (GIAI ĐOẠN 8).
// Quy tắc: KHÔNG tạo marker mới mỗi lần telemetry về — chỉ setLatLng marker cũ.

const DEFAULT_CENTER = [10.762622, 106.660172];
const DEFAULT_ZOOM = 17;

let map = null;
let uavMarker = null;
let trackLine = null;

export function initMap() {
  map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  trackLine = L.polyline([], { color: "#35c26b", weight: 2 }).addTo(map);

  return map;
}

export function updateUav(lat, lon, heading) {
  if (!map) {
    return;
  }

  if (uavMarker === null) {
    // Marker được tạo đúng MỘT lần.
    uavMarker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: "uav-icon",
        html: '<div style="font-size:20px;line-height:20px">➤</div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(map);
    map.setView([lat, lon], DEFAULT_ZOOM);
  } else {
    uavMarker.setLatLng([lat, lon]);
  }

  // Quay icon theo heading.
  const element = uavMarker.getElement()?.firstElementChild;
  if (element && heading !== null && heading !== undefined) {
    element.style.transform = `rotate(${heading - 90}deg)`;
  }

  trackLine.addLatLng([lat, lon]);
}

export function clearTrack() {
  trackLine?.setLatLngs([]);
}
