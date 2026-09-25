/**
 * Cửa gửi lệnh lên backend cho mọi component.
 *
 * Trang có đúng MỘT socket (`useWebSocket` tạo và đăng ký nó ở đây). Component
 * không bao giờ tự mở socket hay tự dựng JSON: gọi `sendUplink`, `ws.ts` bọc
 * phong bì và sinh `id`.
 */
import type { UplinkPayloads, UplinkType } from "./protocol";
import type { GcsSocket } from "./ws";

let activeSocket: GcsSocket | null = null;

/** Chỉ `useWebSocket` gọi. `null` khi socket bị đóng hẳn (unmount). */
export function setActiveSocket(sock: GcsSocket | null): void {
  activeSocket = sock;
}

/** `id` đã gửi, hoặc `null` khi chưa có socket mở — lệnh KHÔNG đi, người gọi phải báo. */
export function sendUplink<T extends UplinkType>(type: T, data: UplinkPayloads[T]): string | null {
  return activeSocket?.send(type, data) ?? null;
}
