/**
 * Toán ô ảnh bản đồ (Web Mercator, kiểu "slippy map" z/x/y) — cho mặt đất 3D.
 * Hàm thuần.
 */
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Ô chứa (lat, lon) ở mức zoom `z` (số thực — phần lẻ là vị trí trong ô). */
export function lonLatToTile(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan(toRad(lat))) / Math.PI) / 2) * n;
  return { x, y };
}

/** Góc tây-bắc của ô (x, y) — lat/lon. */
export function tileToLonLat(x: number, y: number, z: number): { lat: number; lon: number } {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const lat = toDeg(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))));
  return { lat, lon };
}

/** Các ô trong lưới `(2r+1)²` quanh ô chứa (lat, lon). */
export function tilesAround(lat: number, lon: number, z: number, r: number): { x: number; y: number; z: number }[] {
  const c = lonLatToTile(lat, lon, z);
  const cx = Math.floor(c.x);
  const cy = Math.floor(c.y);
  const out: { x: number; y: number; z: number }[] = [];
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) out.push({ x: cx + dx, y: cy + dy, z });
  return out;
}

/** Cạnh một ô, mét, ở vĩ độ `lat` và zoom `z`. */
export function tileSizeMeters(lat: number, z: number): number {
  return (40_075_016.686 * Math.cos(toRad(lat))) / 2 ** z;
}
