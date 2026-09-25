/**
 * Quy đổi box nhận diện sang canvas (plan Phase 10 §10.5.2–10.5.3). THUẦN.
 *
 * Hợp đồng Phase 05: box là PIXEL trong hệ của khung gốc (`width` × `height`
 * của chính message `detection`), còn `<img>` hiển thị ở cỡ khác — co giãn theo
 * bố cục. Hệ số luôn lấy từ message, KHÔNG gõ cứng 320×240 hay 640×480: nguồn
 * giả mặc định là VGA, ESP32-CAM thật là QVGA, và panel không được phải sửa khi
 * đổi nguồn. Quên quy đổi thì box VẪN vẽ ra — chỉ là lệch chỗ, không gì báo lỗi.
 */
import type { DetectionBox, DetectionPayload } from "./protocol";

/** Box cũ hơn chừng này (ms) → vẽ mờ, kèm chữ "box cũ". */
export const BOX_STALE_MS = 1000;
/** Cũ hơn chừng này → xoá hẳn: box đứng im trong khi cảnh đã đổi là tệ hơn không có box. */
export const BOX_EXPIRE_MS = 3000;

export type BoxFreshness = "fresh" | "stale" | "expired";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function scaleBox(
  box: Pick<DetectionBox, "x1" | "y1" | "x2" | "y2">,
  canvas: { width: number; height: number },
  frame: Pick<DetectionPayload, "width" | "height">,
): Rect {
  const sx = canvas.width / frame.width;
  const sy = canvas.height / frame.height;
  return { x: box.x1 * sx, y: box.y1 * sy, w: (box.x2 - box.x1) * sx, h: (box.y2 - box.y1) * sy };
}

/**
 * Độ tươi đo theo lúc TRÌNH DUYỆT NHẬN message, không theo `frame_ts`.
 *
 * `frame_ts` là mốc phía NGUỒN (`X-Timestamp-Ms`, đếm từ lúc thiết bị/tiến trình
 * khởi động — `docs/hop-dong-mjpeg.md` §2), không phải epoch, nên không so được
 * với đồng hồ của trình duyệt. Lúc nhận thì so được, và vẫn bắt đúng hai ca cần
 * bắt: bộ nhận diện chết, và camera mất (backend ngừng gửi `detection`).
 */
export function boxFreshness(receivedAt: number | null, now: number): BoxFreshness {
  if (receivedAt === null) return "expired";
  const age = now - receivedAt;
  if (age > BOX_EXPIRE_MS) return "expired";
  if (age > BOX_STALE_MS) return "stale";
  return "fresh";
}

/** Vẽ toàn bộ box lên canvas. Trả số box đã vẽ. `boxes` thiếu hay rỗng thì không vẽ gì. */
export function drawDetection(
  ctx: CanvasRenderingContext2D,
  canvas: { width: number; height: number },
  detection: DetectionPayload | null,
  freshness: BoxFreshness,
  pixelRatio = 1,
): number {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!detection || freshness === "expired" || !(detection.width > 0) || !(detection.height > 0)) return 0;
  const boxes = detection.boxes ?? [];
  ctx.globalAlpha = freshness === "stale" ? 0.35 : 1;
  ctx.lineWidth = 2 * pixelRatio;
  ctx.font = `${12 * pixelRatio}px ui-monospace, monospace`;
  for (const box of boxes) {
    const r = scaleBox(box, canvas, detection);
    const text = `${box.label} ${(box.confidence * 100).toFixed(0)}%${freshness === "stale" ? " · box cũ" : ""}`;
    const pad = 3 * pixelRatio;
    const tw = ctx.measureText(text).width + pad * 2;
    const th = 16 * pixelRatio;
    const ty = r.y >= th ? r.y - th : r.y;
    ctx.fillStyle = "rgba(10, 20, 30, 0.75)";
    ctx.fillRect(r.x, ty, tw, th);
    ctx.fillStyle = "#3ee6a0";
    ctx.fillText(text, r.x + pad, ty + th - 4 * pixelRatio);
    // Viền vẽ SAU nhãn: ở khung video nhỏ nhãn rộng gần bằng box, nền nhãn từng
    // đè mất cả cạnh trên (bắt được ở E2E "box trùng khung", web GCS v2).
    ctx.strokeStyle = "#3ee6a0";
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  ctx.globalAlpha = 1;
  return boxes.length;
}
