/**
 * Màn hình bay chính (PFD) — bố cục chuẩn của buồng lái:
 *
 *   tốc độ │  chân trời giả  │ độ cao ▌tốc độ leo
 *          │   hướng mũi     │
 *
 * Mỗi phần tử tự subscribe đúng lát cắt của nó trong store (8 Hz).
 * Vạch giới hạn độ cao lấy từ `status.limits.max_alt` — không gõ cứng.
 */
import { useLimits } from "@/hooks/useLimits";
import { useTelemetryStore } from "@/store/telemetry";

import { AttitudeIndicator } from "./AttitudeIndicator";
import type { Box } from "./AttitudeIndicator";
import { HeadingTape, VerticalSpeed, VerticalTape } from "./Tape";

const VIEW_W = 420;
const VIEW_H = 306;
const ATTITUDE: Box = { x: 66, y: 19, w: 270, h: 230 };
const SPEED: Box = { x: 6, y: 34, w: 52, h: 200 };
const ALTITUDE: Box = { x: 344, y: 34, w: 52, h: 200 };
const VSI: Box = { x: 401, y: 34, w: 14, h: 200 };
const HEADING: Box = { x: 66, y: 278, w: 270, h: 24 };
/** Cột tốc độ leo chạm đỉnh ở ±3 m/s — quá mức drone dự án bay thường ngày. */
const VSI_FULL_SCALE_MS = 3;

function Attitude() {
  const roll = useTelemetryStore((s) => s.telemetry?.roll);
  const pitch = useTelemetryStore((s) => s.telemetry?.pitch);
  return <AttitudeIndicator roll={roll} pitch={pitch} box={ATTITUDE} />;
}

function Speed() {
  const speed = useTelemetryStore((s) => s.telemetry?.ground_speed);
  return (
    <VerticalTape
      box={SPEED}
      value={speed}
      scale={18}
      minorEvery={0.5}
      labelEvery={1}
      side="left"
      min={0}
      label="GS"
      unit="m/s"
      digits={1}
      title="Tốc độ so với mặt đất (GPS), m/s."
      testId="pfd-speed"
    />
  );
}

function Altitude() {
  const alt = useTelemetryStore((s) => s.telemetry?.relative_alt);
  const limits = useLimits();
  return (
    <VerticalTape
      box={ALTITUDE}
      value={alt}
      scale={16}
      minorEvery={0.5}
      labelEvery={1}
      side="right"
      label="ALT"
      unit="m"
      digits={1}
      limit={limits?.max_alt}
      title="Độ cao SO VỚI ĐIỂM CẤT CÁNH (không phải so với mực nước biển). Vùng sọc vàng: trên giới hạn độ cao do backend đặt."
      testId="pfd-alt"
    />
  );
}

function Climb() {
  const climb = useTelemetryStore((s) => s.telemetry?.climb_rate);
  return (
    <VerticalSpeed
      box={VSI}
      value={climb}
      fullScale={VSI_FULL_SCALE_MS}
      title="Tốc độ leo: cột xanh đi lên là đang lên, cột vàng đi xuống là đang hạ. Đỉnh cột = ±3 m/s."
    />
  );
}

function Heading() {
  const heading = useTelemetryStore((s) => s.telemetry?.heading);
  return <HeadingTape box={HEADING} value={heading} title="Hướng mũi: 0° là Bắc (N), 90° là Đông (E)." />;
}

export function PrimaryFlightDisplay() {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full font-mono select-none" data-testid="pfd">
      <defs>
        <pattern id="pfd-limit" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#f59e0b" fillOpacity="0.08" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeOpacity="0.45" strokeWidth="3" />
        </pattern>
        <pattern id="pfd-nodata" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="white" strokeOpacity="0.05" strokeWidth="4" />
        </pattern>
      </defs>
      <Attitude />
      <Speed />
      <Altitude />
      <Climb />
      <Heading />
    </svg>
  );
}
