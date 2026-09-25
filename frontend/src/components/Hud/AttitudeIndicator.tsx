/**
 * Chân trời giả của PFD: trời/đất + thang pitch xoay theo `roll`, dịch theo
 * `pitch`; cung roll và biểu tượng máy bay đứng yên để mắt có mốc so.
 *
 * Vẽ bằng SVG + CSS `transform` (có `transition` cho mượt giữa hai gói
 * ATTITUDE ~10 Hz), không canvas. Là một nhóm `<g>` đặt vào trong SVG của
 * `PrimaryFlightDisplay` — toạ độ tính theo hộp `box` được truyền vào.
 *
 * Chưa có số đo (`null`) thì KHÔNG vẽ chân trời phẳng — phẳng trông như "đang
 * cân bằng", mà thật ra là "không biết". Vẽ nền xám kèm chữ.
 */
import { hasValue } from "@/lib/format";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bao nhiêu đơn vị SVG cho mỗi độ pitch. */
const PX_PER_PITCH_DEG = 3.4;
/** Kẹp pitch hiển thị để mặt đất không trượt hẳn khỏi khung. */
const PITCH_CLAMP_DEG = 40;
const LADDER_DEG = [-40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 35, 40];
/** Thang pitch chỉ vẽ trong vòng này quanh tâm, để không đè lên cung roll. */
const LADDER_RADIUS = 78;
/** Vạch trên cung roll: [góc, dài?]. */
const ROLL_TICKS: [number, boolean][] = [
  [-60, true],
  [-45, false],
  [-30, true],
  [-20, false],
  [-10, false],
  [10, false],
  [20, false],
  [30, true],
  [45, false],
  [60, true],
];

interface AttitudeIndicatorProps {
  roll: number | null | undefined;
  pitch: number | null | undefined;
  box: Box;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

export function AttitudeIndicator({ roll, pitch, box }: AttitudeIndicatorProps) {
  const known = hasValue(roll) && hasValue(pitch);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rollR = box.h / 2 - 16;

  const shownPitch = known ? Math.max(-PITCH_CLAMP_DEG, Math.min(PITCH_CLAMP_DEG, pitch)) : 0;
  // Máy bay nghiêng phải (roll dương) thì chân trời nhìn thấy xoay sang TRÁI.
  // Trong SVG, `px` của CSS = đơn vị viewBox.
  const horizonStyle = known
    ? {
        transform: `rotate(${-roll}deg) translate(0px, ${shownPitch * PX_PER_PITCH_DEG}px)`,
        transformOrigin: `${cx}px ${cy}px`,
        transition: "transform 110ms linear",
      }
    : undefined;
  const pointerStyle = known
    ? { transform: `rotate(${-roll}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 110ms linear" }
    : undefined;

  const arcFrom = polar(cx, cy, rollR, -60);
  const arcTo = polar(cx, cy, rollR, 60);

  return (
    <g
      role="img"
      aria-label={known ? `Nghiêng ${roll.toFixed(0)}°, chúc ngóc ${pitch.toFixed(0)}°` : "Chưa có số đo tư thế"}
    >
      <title>Chân trời giả: phần xanh là trời, phần nâu là đất. Nghiêng (roll) và chúc/ngóc (pitch) của drone.</title>
      <defs>
        <clipPath id="pfd-attitude-clip">
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="14" />
        </clipPath>
        <clipPath id="pfd-ladder-clip">
          <circle cx={cx} cy={cy} r={LADDER_RADIUS} />
        </clipPath>
        <linearGradient id="pfd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b3a7a" />
          <stop offset="100%" stopColor="#2f7fd6" />
        </linearGradient>
        <linearGradient id="pfd-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a4a1c" />
          <stop offset="100%" stopColor="#3b220c" />
        </linearGradient>
      </defs>

      <g clipPath="url(#pfd-attitude-clip)">
        {known ? (
          <>
          <g style={horizonStyle} data-testid="horizon">
            <rect x={cx - 600} y={cy - 900} width="1200" height="900" fill="url(#pfd-sky)" />
            <rect x={cx - 600} y={cy} width="1200" height="900" fill="url(#pfd-ground)" />
            <line x1={cx - 600} y1={cy} x2={cx + 600} y2={cy} stroke="white" strokeWidth="1.5" />
          </g>
          {/* Vùng cắt đứng yên (nhóm ngoài), thang xoay theo chân trời (nhóm trong). */}
          <g clipPath="url(#pfd-ladder-clip)">
          <g style={horizonStyle}>
            {LADDER_DEG.map((deg) => {
              const y = cy - deg * PX_PER_PITCH_DEG;
              const major = deg % 10 === 0;
              const half = major ? 34 : 16;
              return (
                <g key={deg} opacity={0.9}>
                  <line x1={cx - half} x2={cx + half} y1={y} y2={y} stroke="white" strokeWidth={major ? 1.3 : 0.9} />
                  {major ? (
                    <>
                      <text x={cx - half - 5} y={y + 3.5} textAnchor="end" className="fill-white text-[10px]">
                        {Math.abs(deg)}
                      </text>
                      <text x={cx + half + 5} y={y + 3.5} className="fill-white text-[10px]">
                        {Math.abs(deg)}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
          </g>
          </g>
          </>
        ) : (
          <>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#1f2937" />
            <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#pfd-nodata)" />
            <text x={cx} y={cy + 4} textAnchor="middle" className="fill-zinc-300 text-[12px] font-semibold tracking-widest">
              KHÔNG CÓ SỐ ĐO TƯ THẾ
            </text>
          </>
        )}
      </g>

      {/* Cung roll cố định + kim chỉ roll xoay theo chân trời. */}
      <g stroke="white" strokeWidth="1.3" fill="none" opacity={known ? 0.95 : 0.35}>
        <path d={`M ${arcFrom[0]} ${arcFrom[1]} A ${rollR} ${rollR} 0 0 1 ${arcTo[0]} ${arcTo[1]}`} />
        {ROLL_TICKS.map(([deg, long]) => {
          const [x1, y1] = polar(cx, cy, rollR, deg);
          const [x2, y2] = polar(cx, cy, rollR + (long ? 11 : 6), deg);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
        <path d={`M ${cx} ${cy - rollR} l -6 -9 h 12 z`} fill="white" stroke="none" />
      </g>
      {known ? (
        <path
          style={pointerStyle}
          d={`M ${cx} ${cy - rollR + 2} l -7 11 h 14 z`}
          className="fill-hud-amber"
          data-testid="roll-pointer"
        />
      ) : null}

      {/* Biểu tượng máy bay — thứ đứng yên để mắt so với chân trời. */}
      <g opacity={known ? 1 : 0.4}>
        <path
          d={`M ${cx - 78} ${cy} h 46 v 10 M ${cx + 78} ${cy} h -46 v 10`}
          fill="none"
          stroke="black"
          strokeWidth="7"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <path
          d={`M ${cx - 78} ${cy} h 46 v 10 M ${cx + 78} ${cy} h -46 v 10`}
          fill="none"
          className="stroke-hud-amber"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <rect x={cx - 3.5} y={cy - 3.5} width="7" height="7" className="fill-hud-amber" stroke="black" strokeWidth="1" />
      </g>
    </g>
  );
}
