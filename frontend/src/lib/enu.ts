/**
 * Toạ độ cục bộ cho khung 3D: ĐÔNG–BẮC–LÊN (ENU) tính bằng mét quanh một gốc
 * (điểm home). Quy về trục của three.js (Y hướng lên, tay phải):
 *
 *   x = đông        y = lên        z = −bắc   (nên "bắc" là −Z của three.js)
 *
 * Phép chiếu phẳng tiếp tuyến: sai số dưới 1 cm trong bán kính vài trăm mét —
 * thừa cho sân bay 50 m của dự án. Cùng bán kính Trái Đất với backend.
 */
import { EARTH_RADIUS_M } from "./geo";

const toRad = (d: number) => (d * Math.PI) / 180;

export interface Origin {
  lat: number;
  lon: number;
}

/** (lat, lon, độ cao so với home) → [x, y, z] của three.js, mét. */
export function toScene(origin: Origin, lat: number, lon: number, alt = 0): [number, number, number] {
  const north = toRad(lat - origin.lat) * EARTH_RADIUS_M;
  const east = toRad(lon - origin.lon) * EARTH_RADIUS_M * Math.cos(toRad(origin.lat));
  return [east, alt, -north];
}

/** Ngược lại: [x, z] của three.js → (lat, lon). */
export function fromScene(origin: Origin, x: number, z: number): { lat: number; lon: number } {
  const north = -z;
  const lat = origin.lat + (north / EARTH_RADIUS_M) * (180 / Math.PI);
  const lon = origin.lon + (x / (EARTH_RADIUS_M * Math.cos(toRad(origin.lat)))) * (180 / Math.PI);
  return { lat, lon };
}

/**
 * Tư thế drone → góc Euler của three.js, thứ tự "YXZ" (yaw, rồi pitch, rồi roll —
 * đúng chuỗi quay nội tại của máy bay). Model dựng với mũi hướng −Z.
 *
 *  - heading/yaw 0° = Bắc, tăng theo chiều kim đồng hồ nhìn từ trên → quay
 *    quanh +Y là NGƯỢC chiều kim đồng hồ, nên đổi dấu;
 *  - pitch dương = ngóc mũi lên → quay +X nâng −Z lên: giữ dấu;
 *  - roll dương = nghiêng phải (cánh phải xuống) → quay +Z nâng +X lên: đổi dấu.
 */
export function attitudeToEuler(rollDeg: number, pitchDeg: number, yawDeg: number): [number, number, number] {
  return [toRad(pitchDeg), -toRad(yawDeg), -toRad(rollDeg)];
}
