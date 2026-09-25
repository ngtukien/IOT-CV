/**
 * `<canvas>` phủ đúng lên `<img>` video, vẽ box từ `store.detection`
 * (plan Phase 10 §10.5.2). `pointer-events: none`: chuột đi xuyên qua.
 *
 * Box đi qua WebSocket, video đi qua MJPEG — hai luồng riêng (báo cáo stack
 * web §4.3, phương án b): FPS video (10–44) không bị kéo tụt xuống bằng FPS suy
 * luận (3–5). Cái giá đã biết: box luôn trễ hơn hình vài chục ms.
 *
 * Cỡ canvas = cỡ hiển thị của `<img>` × devicePixelRatio; vị trí = vị trí của
 * `<img>` trong khung cha (ảnh được căn giữa, nên có lề). Cả hai cập nhật bằng
 * `ResizeObserver`. Thiếu bước này box vẫn vẽ ra, chỉ là lệch chỗ.
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { boxFreshness, drawDetection } from "@/lib/detection";
import { useTelemetryStore } from "@/store/telemetry";

/** Vẽ lại định kỳ để box tự mờ rồi tự biến mất khi không còn message mới. */
const REDRAW_MS = 250;

export function DetectionOverlay({ imgRef }: { imgRef: RefObject<HTMLImageElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detection = useTelemetryStore((s) => s.detection);
  const receivedAt = useTelemetryStore((s) => s.detectionAt);
  const [size, setSize] = useState({ x: 0, y: 0, w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const measure = () =>
      setSize({ x: img.offsetLeft, y: img.offsetTop, w: img.clientWidth, h: img.clientHeight, dpr: window.devicePixelRatio || 1 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    if (img.parentElement) ro.observe(img.parentElement);
    img.addEventListener("load", measure);
    return () => {
      ro.disconnect();
      img.removeEventListener("load", measure);
    };
  }, [imgRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = Math.round(size.w * size.dpr);
    canvas.height = Math.round(size.h * size.dpr);
    const draw = () => {
      const n = drawDetection(ctx, canvas, detection, boxFreshness(receivedAt, Date.now()), size.dpr);
      canvas.dataset.boxes = String(n);
    };
    draw();
    const timer = setInterval(draw, REDRAW_MS);
    return () => clearInterval(timer);
  }, [detection, receivedAt, size]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="detection-overlay"
      className="pointer-events-none absolute"
      style={{ left: size.x, top: size.y, width: size.w, height: size.h }}
      aria-hidden
    />
  );
}
