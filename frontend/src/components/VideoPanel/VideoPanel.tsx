/**
 * Panel VIDEO (plan Phase 10 §10.5): `<img>` MJPEG + canvas vẽ box chồng lên.
 *
 * `src` là đường dẫn TƯƠNG ĐỐI (`/api/video/stream`) — proxy của Vite lo lúc
 * dev, FastAPI tự phục vụ ở bản build. KHÔNG gắn `key` hay tham số đổi theo thời
 * gian: đổi là mở lại kết nối MJPEG, mỗi lần mở lại là một khoảng trắng. `src`
 * chỉ đổi SAU MỘT LẦN HỎNG (thử lại mỗi 5 s) hoặc khi camera sống lại.
 *
 * Luật mất camera (SAFETY.md mục 9, comment của `video.js` cũ): *"telemetry vẫn
 * chạy, control vẫn chạy, UAV không đổi mode."* Panel hiện CAMERA OFFLINE và
 * KHÔNG làm gì khác — không toast đỏ, không khoá nút, không đụng vào store kết
 * nối. Mọi trạng thái của camera nằm gọn trong component này.
 *
 * Nguồn hiện tại là MJPEG GIẢ của Phase 07 (video mẫu lặp + box chạy vòng quanh
 * một hình chữ nhật lùi vào 1/16 khung). Camera thật vào ở Phase 17, bộ nhận
 * diện thật ở `plans/ai/`; panel này không phải sửa khi đổi nguồn.
 */
import { Camera, CameraOff, Expand } from "lucide-react";

import { IconVision } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Panel } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

import { DetectionOverlay } from "./DetectionOverlay";

const VIDEO_STREAM_PATH = "/api/video/stream";
/** Hỏng rồi thì chừng này ms sau thử mở lại. */
const CAMERA_RETRY_MS = 5000;

function streamSrc(attempt: number): string {
  return attempt === 0 ? VIDEO_STREAM_PATH : `${VIDEO_STREAM_PATH}?retry=${attempt}`;
}

export function VideoPanel({
  style,
  className,
  bodyClassName,
  title = "Video",
  tools = false,
}: {
  style?: CSSProperties;
  className?: string;
  bodyClassName?: string;
  title?: string;
  /** Hiện nút chụp ảnh + toàn màn hình (trang Camera & AI). */
  tools?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const available = useTelemetryStore((s) => s.status?.camera?.available);
  const fake = useTelemetryStore((s) => s.status?.camera?.fake);
  const frame = useTelemetryStore((s) => (s.detection ? `${s.detection.width}×${s.detection.height}` : null));
  const boxes = useTelemetryStore((s) => s.detection?.boxes?.length ?? null);

  // Hỏng → chờ rồi thử lại. Chỉ component này biết; không báo ra ngoài.
  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setAttempt((a) => a + 1);
    }, CAMERA_RETRY_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  // Camera sống lại (backend báo) → mở lại luồng: luồng cũ có thể đã đứng hình.
  const [wasAvailable, setWasAvailable] = useState(available);
  if (available !== wasAvailable) {
    setWasAvailable(available);
    if (available === true && wasAvailable === false) {
      setAttempt((a) => a + 1);
      setFailed(false);
    }
  }

  const offline = failed || available === false;
  const frameRef = useRef<HTMLDivElement>(null);

  /** Chụp khung đang hiện + lớp box → PNG. Ảnh cùng nguồn gốc nên canvas không bị "nhiễm" CORS. */
  const snapshot = () => {
    const img = imgRef.current;
    if (!img || offline || !img.naturalWidth) return;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const overlay = frameRef.current?.querySelector<HTMLCanvasElement>("[data-testid=detection-overlay]");
    if (overlay && overlay.width > 0) ctx.drawImage(overlay, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iot-cv-camera-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  return (
    <Panel
      title={title}
      subtitle="MJPEG từ camera · khung nhận diện qua WebSocket"
      icon={IconVision}
      variant="instrument"
      style={style}
      className={className}
      testId="video-panel"
      bodyClassName={cn("relative flex items-center justify-center overflow-hidden bg-[oklch(0.1_0.015_262)] p-2", bodyClassName)}
      actions={
        <>
          {fake ? (
            <span className="rounded-md border border-hud-amber/40 bg-hud-amber/10 px-1.5 py-0.5 font-mono text-[10px] text-hud-amber" title="Nguồn MJPEG giả của Phase 07 — box không cần khớp nội dung video">
              NGUỒN GIẢ
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-muted-foreground" data-testid="video-meta">
            {frame ?? "—"} · {boxes ?? "—"} box
          </span>
          {tools ? (
            <>
              <button type="button" onClick={snapshot} disabled={offline} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground disabled:opacity-40" title="Chụp ảnh (kèm khung nhận diện)" data-testid="video-snapshot">
                <Camera className="size-4" />
              </button>
              <button type="button" onClick={() => void frameRef.current?.requestFullscreen?.()} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground" title="Toàn màn hình">
                <Expand className="size-4" />
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div ref={frameRef} className="relative flex h-full w-full items-center justify-center bg-[oklch(0.1_0.015_262)]">
      <img
        ref={imgRef}
        src={streamSrc(attempt)}
        alt="Hình từ camera trên drone"
        data-testid="video-img"
        data-attempt={attempt}
        className={offline ? "invisible block max-h-full max-w-full" : "block max-h-full max-w-full"}
        // KHÔNG dựa vào `onLoad`: với luồng multipart, trình duyệt không hứa
        // bắn `load` cho từng khung. Chỉ `onError` là tín hiệu tin được.
        onError={() => setFailed(true)}
      />
      {offline ? null : <DetectionOverlay imgRef={imgRef} />}
      </div>
      {offline ? (
        <div className="absolute inset-0 grid place-items-center" data-testid="camera-offline">
          <div className="flex flex-col items-center gap-2 text-center">
            <CameraOff className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-mono text-sm font-semibold tracking-widest text-foreground/80">CAMERA OFFLINE</p>
            <p className="text-xs text-muted-foreground">
              Thử lại mỗi {CAMERA_RETRY_MS / 1000} s. Telemetry và điều khiển KHÔNG bị ảnh hưởng.
            </p>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
