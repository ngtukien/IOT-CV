/**
 * Các "băng thước" của PFD, kiểu màn hình bay trên máy bay thật: thước chạy
 * qua một ô số cố định ở giữa. Mắt đọc XU HƯỚNG (thước đang trôi lên hay
 * xuống) nhanh hơn đọc con số nhảy.
 *
 *  - `VerticalTape`  — tốc độ (trái) và độ cao (phải)
 *  - `HeadingTape`   — hướng mũi (dưới)
 *  - `VerticalSpeed` — tốc độ leo (cột mảnh cạnh băng độ cao)
 *
 * Vạch được tính lại mỗi lần render quanh giá trị hiện tại (8 Hz, vài chục
 * phần tử — rẻ). Chưa có số đo thì thước đứng yên, mờ, ô số hiện `—`.
 */
import { NO_VALUE, formatNumber, hasValue } from "@/lib/format";

import type { Box } from "./AttitudeIndicator";
import { usePfdIds, useTestId } from "./pfdContext";

type Maybe = number | null | undefined;

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(from / step) * step; v <= to + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

interface VerticalTapeProps {
  box: Box;
  value: Maybe;
  /** Đơn vị SVG cho mỗi đơn vị đo. */
  scale: number;
  minorEvery: number;
  labelEvery: number;
  side: "left" | "right";
  label: string;
  unit: string;
  digits: number;
  /** Không vẽ vạch dưới số này (tốc độ mặt đất không âm). */
  min?: number;
  /** Vạch giới hạn (vd `max_alt` từ backend). Phía trên nó tô sọc vàng. */
  limit?: Maybe;
  title: string;
  testId: string;
}

export function VerticalTape({
  box,
  value,
  scale,
  minorEvery,
  labelEvery,
  side,
  label,
  unit,
  digits,
  min,
  limit,
  title,
  testId,
}: VerticalTapeProps) {
  const known = hasValue(value);
  const center = known ? value : 0;
  const cy = box.y + box.h / 2;
  const half = box.h / 2 / scale;
  const yOf = (v: number) => cy - (v - center) * scale;
  const tickX = side === "left" ? box.x + box.w : box.x;
  const dir = side === "left" ? -1 : 1;
  const { prefix } = usePfdIds();
  const clipId = `${prefix}-tape-clip-${testId}`;
  const text = formatNumber(value, digits, "");
  const tid = useTestId(testId);

  return (
    <g data-testid={tid} data-value={text}>
      <title>{title}</title>
      <defs>
        <clipPath id={clipId}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" />
        </clipPath>
      </defs>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" fill="#0b1220" fillOpacity="0.85" stroke="white" strokeOpacity="0.1" />
      <g clipPath={`url(#${clipId})`} opacity={known ? 1 : 0.35}>
        {hasValue(limit) && limit < center + half ? (
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={Math.max(0, yOf(limit) - box.y)}
            fill={`url(#${prefix}-limit)`}
            data-testid={tid ? `${tid}-limit` : undefined}
          />
        ) : null}
        {range(Math.max(center - half, min ?? -Infinity), center + half, minorEvery).map((v) => {
          const y = yOf(v);
          const isLabel = Math.abs(v / labelEvery - Math.round(v / labelEvery)) < 1e-6;
          return (
            <g key={v}>
              <line x1={tickX} x2={tickX + dir * (isLabel ? 10 : 5)} y1={y} y2={y} stroke="white" strokeOpacity="0.7" />
              {isLabel ? (
                <text
                  x={tickX + dir * 14}
                  y={y + 3.5}
                  textAnchor={side === "left" ? "end" : "start"}
                  className="fill-white/80 text-[10px]"
                >
                  {Number(v.toFixed(3))}
                </text>
              ) : null}
            </g>
          );
        })}
        {hasValue(limit) ? (
          <line x1={box.x} x2={box.x + box.w} y1={yOf(limit)} y2={yOf(limit)} className="stroke-hud-amber" strokeWidth="1.5" />
        ) : null}
      </g>

      {/* Ô số cố định ở giữa, có mũi chỉ vào chân trời. */}
      <path
        d={
          side === "left"
            ? `M ${box.x + 2} ${cy - 12} h ${box.w - 6} l 8 12 l -8 12 h ${-(box.w - 6)} z`
            : `M ${box.x + box.w - 2} ${cy - 12} h ${-(box.w - 6)} l -8 12 l 8 12 h ${box.w - 6} z`
        }
        fill="#020617"
        className="stroke-hud-cyan"
        strokeWidth="1.2"
      />
      <text
        x={side === "left" ? box.x + box.w - 6 : box.x + 8}
        y={cy + 5}
        textAnchor={side === "left" ? "end" : "start"}
        className={known ? "fill-hud-cyan text-[14px] font-semibold" : "fill-zinc-400 text-[14px]"}
      >
        {text}
      </text>

      <text x={box.x + box.w / 2} y={box.y - 6} textAnchor="middle" className="fill-muted-foreground text-[9px] tracking-widest">
        {label} · {unit}
      </text>
    </g>
  );
}

const CARDINAL: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };

interface HeadingTapeProps {
  box: Box;
  value: Maybe;
  title: string;
}

/** Băng hướng mũi, 5° một vạch; nhãn mỗi 30°, N/E/S/W ở bốn hướng chính. */
export function HeadingTape({ box, value, title }: HeadingTapeProps) {
  const known = hasValue(value);
  const center = known ? value : 0;
  const scale = 3; // đơn vị SVG / độ
  const cx = box.x + box.w / 2;
  const half = box.w / 2 / scale;
  const text = known ? `${String(Math.round(((value % 360) + 360) % 360)).padStart(3, "0")}°` : NO_VALUE;
  const { prefix } = usePfdIds();
  const tid = useTestId("pfd-heading");

  return (
    <g data-testid={tid} data-value={text}>
      <title>{title}</title>
      <defs>
        <clipPath id={`${prefix}-tape-clip-heading`}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" />
        </clipPath>
      </defs>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" fill="#0b1220" fillOpacity="0.85" stroke="white" strokeOpacity="0.1" />
      <g clipPath={`url(#${prefix}-tape-clip-heading)`} opacity={known ? 1 : 0.35}>
        {range(center - half, center + half, 5).map((v) => {
          const x = cx + (v - center) * scale;
          const deg = ((Math.round(v) % 360) + 360) % 360;
          const major = deg % 10 === 0;
          const label = CARDINAL[deg] ?? (deg % 30 === 0 ? String(deg / 10) : null);
          return (
            <g key={v}>
              <line x1={x} x2={x} y1={box.y} y2={box.y + (major ? 9 : 5)} stroke="white" strokeOpacity="0.7" />
              {label ? (
                <text
                  x={x}
                  y={box.y + 22}
                  textAnchor="middle"
                  className={CARDINAL[deg] ? "fill-hud-amber text-[11px] font-semibold" : "fill-white/80 text-[10px]"}
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
      <path d={`M ${cx} ${box.y + 1} l -6 -8 h 12 z`} className="fill-hud-cyan" />
      <rect x={cx - 26} y={box.y - 26} width="52" height="18" rx="4" fill="#020617" className="stroke-hud-cyan" strokeWidth="1.2" />
      <text x={cx} y={box.y - 13} textAnchor="middle" className={known ? "fill-hud-cyan text-[12px] font-semibold" : "fill-zinc-400 text-[12px]"}>
        {text}
      </text>
    </g>
  );
}

interface VerticalSpeedProps {
  box: Box;
  value: Maybe;
  /** m/s ứng với nửa chiều cao cột. */
  fullScale: number;
  title: string;
}

/** Cột tốc độ leo: vạch giữa là 0, lên là leo (xanh), xuống là hạ (vàng). */
export function VerticalSpeed({ box, value, fullScale, title }: VerticalSpeedProps) {
  const known = hasValue(value);
  const cy = box.y + box.h / 2;
  const half = box.h / 2 - 4;
  const clamped = known ? Math.max(-fullScale, Math.min(fullScale, value)) : 0;
  const barH = (Math.abs(clamped) / fullScale) * half;
  const up = clamped >= 0;
  const tid = useTestId("pfd-vsi");

  return (
    <g data-testid={tid}>
      <title>{title}</title>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4" fill="#0b1220" fillOpacity="0.85" stroke="white" strokeOpacity="0.1" />
      {range(-fullScale, fullScale, 1).map((v) => (
        <line
          key={v}
          x1={box.x}
          x2={box.x + (v === 0 ? box.w : 4)}
          y1={cy - (v / fullScale) * half}
          y2={cy - (v / fullScale) * half}
          stroke="white"
          strokeOpacity={v === 0 ? 0.8 : 0.4}
        />
      ))}
      {known && barH > 0.5 ? (
        <rect
          x={box.x + 5}
          y={up ? cy - barH : cy}
          width={box.w - 8}
          height={barH}
          rx="1.5"
          className={up ? "fill-hud-green" : "fill-hud-amber"}
          style={{ transition: "all 120ms linear" }}
        />
      ) : null}
    </g>
  );
}
