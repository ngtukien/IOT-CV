/**
 * Một socket QUAN SÁT tới backend, chạy trong Node (không phải trong trang).
 *
 * Để đo những thứ giao diện không in ra đủ chính xác — toạ độ, hướng mũi — trong
 * khi trình duyệt đang lái. Socket này CHỈ ĐỌC: không bao giờ gửi `cmd.*`, không
 * bao giờ giành quyền lái. Backend coi nó như một tab thứ hai đang xem.
 */
import type { DetectionPayload, Telemetry } from "../../../src/lib/protocol";
import { BASE_URL } from "./gcs";

export interface Observer {
  telemetry(): Telemetry | null;
  detection(): DetectionPayload | null;
  close(): void;
}

export async function openObserver(): Promise<Observer> {
  const url = BASE_URL.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(url);
  let telemetry: Telemetry | null = null;
  let detection: DetectionPayload | null = null;
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data)) as { type: string; data: unknown };
    if (msg.type === "telemetry") telemetry = msg.data as Telemetry;
    else if (msg.type === "detection") detection = msg.data as DetectionPayload;
  };
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error(`không mở được ${url}`));
  });
  return { telemetry: () => telemetry, detection: () => detection, close: () => ws.close() };
}

/** Phương vị (độ, 0 = Bắc, theo chiều kim đồng hồ) từ điểm a tới điểm b. */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  return Math.hypot(dLat, dLon) * 6_371_000;
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
