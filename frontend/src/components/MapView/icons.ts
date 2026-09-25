/**
 * Icon SVG riêng cho bản đồ (`L.divIcon`), không dùng icon mặc định của Leaflet.
 *
 * Icon mặc định tìm ảnh PNG theo đường dẫn tương đối; qua bundler đường dẫn đó
 * sai và marker biến mất KHÔNG báo lỗi gì — lỗi kinh điển của Leaflet. Dùng
 * `divIcon` thì không có ảnh nào để tìm.
 */
import L from "leaflet";

/** Phần tử bên trong icon drone được xoay theo heading (xem DroneMarker). */
export const DRONE_ROTOR_ATTR = "data-rotate";

const ARROW_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <path d="M16 2 L27 28 L16 22 L5 28 Z" fill="oklch(0.84 0.13 205)" stroke="white" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

const DOT_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="16" r="9" fill="oklch(0.84 0.13 205)" stroke="white" stroke-width="2"/>
</svg>`;

/**
 * Hai icon, tạo MỘT lần. Có heading: mũi tên, xoay bằng CSS trên phần tử con
 * (không trên phần tử ngoài — Leaflet dùng `transform` của phần tử ngoài để đặt
 * vị trí marker, xoay ở đó là marker nhảy khỏi chỗ). Không có heading: hình tròn
 * không mũi — mũi chỉ sai hướng tệ hơn là không có mũi.
 */
export const DRONE_ICON_ARROW = L.divIcon({
  className: "map-icon",
  html: `<div class="map-drone" ${DRONE_ROTOR_ATTR} style="transform: rotate(0deg)">${ARROW_SVG}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export const DRONE_ICON_DOT = L.divIcon({
  className: "map-icon",
  html: `<div class="map-drone">${DOT_SVG}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export const HOME_ICON = L.divIcon({
  className: "map-icon",
  html: `<div class="map-home" aria-label="Điểm home">H</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const wpIconCache = new Map<string, L.DivIcon>();

/**
 * Marker "đã nạp" TO hơn marker nháp: khi hai điểm trùng chỗ (nạp xong, chưa
 * sửa gì), vòng xanh đặc vẫn lộ ra quanh vòng nháp — nhìn là biết điểm đó đã
 * nằm trên FC. Cùng cỡ thì marker nháp che kín marker đã nạp.
 */
const WP_ICON_PX = { draft: 22, readback: 30 } as const;

/**
 * Marker waypoint có số. Nhớ đệm theo (số, kiểu) để đổi thứ tự không sinh icon
 * mới vô ích — icon trùng tham chiếu thì react-leaflet không gọi `setIcon`.
 */
export function waypointIcon(label: string, kind: "draft" | "readback", hasError = false): L.DivIcon {
  const key = `${kind}|${label}|${hasError ? 1 : 0}`;
  let icon = wpIconCache.get(key);
  if (!icon) {
    const cls = `map-wp map-wp--${kind}${hasError ? " map-wp--error" : ""}`;
    const px = WP_ICON_PX[kind];
    icon = L.divIcon({
      className: "map-icon",
      html: `<div class="${cls}">${label}</div>`,
      iconSize: [px, px],
      iconAnchor: [px / 2, px / 2],
    });
    wpIconCache.set(key, icon);
  }
  return icon;
}
