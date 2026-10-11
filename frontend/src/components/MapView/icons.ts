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

/**
 * Drone có hướng: quadcopter nhìn từ trên + mũi tên chỉ hướng mũi, vòng sáng
 * nhạt quanh để nổi trên cả ảnh vệ tinh lẫn bản đồ sáng.
 */
const ARROW_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <circle cx="20" cy="20" r="17" fill="oklch(0.84 0.13 205 / 0.18)" stroke="oklch(0.84 0.13 205 / 0.55)" stroke-width="1"/>
  <g stroke="white" stroke-width="2.6" stroke-linecap="round"><path d="M13 13 27 27M27 13 13 27"/></g>
  <g fill="oklch(0.2 0.03 255)" stroke="oklch(0.84 0.13 205)" stroke-width="1.6">
    <circle cx="12" cy="12" r="4.2"/><circle cx="28" cy="12" r="4.2"/><circle cx="12" cy="28" r="4.2"/><circle cx="28" cy="28" r="4.2"/>
  </g>
  <path d="M20 4.5 25 15 H15 Z" fill="oklch(0.84 0.13 205)" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>
  <rect x="16.5" y="16.5" width="7" height="7" rx="1.6" fill="oklch(0.84 0.13 205)" stroke="white" stroke-width="1.4"/>
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
  iconSize: [40, 40],
  iconAnchor: [20, 20],
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
  iconSize: [26, 26],
  iconAnchor: [13, 13],
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

const insertCache = new Map<string, L.DivIcon>();

/** Nút "+" giữa chặng (trang Nhiệm vụ) kèm độ dài chặng. */
export function insertHandleIcon(label: string): L.DivIcon {
  let icon = insertCache.get(label);
  if (!icon) {
    icon = L.divIcon({
      className: "map-icon",
      html: `<div class="map-insert"><span class="map-insert__plus">+</span><span class="map-insert__label">${label}</span></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    insertCache.set(label, icon);
  }
  return icon;
}
