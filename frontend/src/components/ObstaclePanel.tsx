/**
 * Panel VẬT CẢN (plan Phase 10 §10.4). Nguồn: `telemetry.obstacle_distance`,
 * `obstacle_sectors`, `rangefinder_healthy`, `avoid_state`; ngưỡng từ
 * `status.limits` — không số nào gõ cứng ở đây.
 *
 * Việc quan trọng nhất của panel này là NÓI THẬT về giới hạn của mình:
 *  - ở AUTO/GUIDED/RTL, hiện dòng "Chế độ này KHÔNG tự tránh vật cản" (cổng
 *    pass, không phải gợi ý). Một panel xanh trong AUTO mà im lặng về điều đó
 *    làm người dùng tưởng mình được bảo vệ đúng ở chỗ họ không được bảo vệ;
 *  - cung không có dữ liệu vẽ GẠCH CHÉO, không vẽ xanh (xem `lib/obstacle.ts`).
 */
import { Radar, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";

import { Panel } from "@/components/Panel";
import { useLimits } from "@/hooks/useLimits";
import { formatNumber } from "@/lib/format";
import { AVOID_TONE, NO_AVOID_WARNING, barFraction, sectorPath, sectorTone, showsNoAvoidWarning } from "@/lib/obstacle";
import type { ObstacleTone } from "@/lib/obstacle";
import { AVOID_STATE_LABEL } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

const TONE_TEXT: Record<ObstacleTone, string> = {
  ok: "text-hud-green",
  warn: "text-hud-amber",
  danger: "text-hud-red",
  unknown: "text-muted-foreground",
};

const TONE_CHIP: Record<ObstacleTone, string> = {
  ok: "border-hud-green/50 bg-hud-green/12 text-hud-green",
  warn: "border-hud-amber/50 bg-hud-amber/12 text-hud-amber",
  danger: "border-hud-red/60 bg-hud-red/18 text-hud-red motion-safe:animate-pulse",
  unknown: "border-white/15 bg-white/5 text-muted-foreground hatch",
};

const TONE_FILL: Record<ObstacleTone, string> = {
  ok: "fill-hud-green/55",
  warn: "fill-hud-amber/60",
  danger: "fill-hud-red/70",
  unknown: "fill-[url(#sector-hatch)]",
};

function DistanceBar() {
  const limits = useLimits();
  const distance = useTelemetryStore((s) => s.telemetry?.obstacle_distance);
  const max = limits?.rangefinder_max_m;
  if (!limits || !max) {
    return <p className="text-xs text-muted-foreground">Chưa nhận giới hạn từ backend — chưa vẽ được thanh.</p>;
  }
  const pct = (v: number) => `${barFraction(v, max) * 100}%`;
  const hasDistance = distance != null && Number.isFinite(distance);

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-14 flex-1" data-testid="obstacle-bar">
        {/* Ba dải: đỏ (≤ margin), vàng (≤ dist_max), xanh (xa hơn) */}
        <div className="absolute inset-x-0 top-3 flex h-3 overflow-hidden rounded-full ring-1 ring-white/10">
          <div className="bg-hud-red/45" style={{ width: pct(limits.avoid_margin_m) }} />
          <div className="bg-hud-amber/40" style={{ width: pct(limits.avoid_dist_max_m - limits.avoid_margin_m) }} />
          <div className="flex-1 bg-hud-green/30" />
        </div>
        {[limits.avoid_margin_m, limits.avoid_dist_max_m].map((mark) => (
          <div key={mark} className="absolute top-1 h-7 w-px bg-white/60" style={{ left: pct(mark) }}>
            <span className="absolute top-7 -translate-x-1/2 font-mono text-[10px] text-muted-foreground">{mark} m</span>
          </div>
        ))}
        <span className="absolute top-7 left-0 font-mono text-[10px] text-muted-foreground">0</span>
        <span className="absolute top-7 right-0 font-mono text-[10px] text-muted-foreground">{max} m</span>
        {hasDistance ? (
          <div
            className="absolute top-0 size-0 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent border-t-foreground drop-shadow"
            style={{ left: pct(distance) }}
            data-testid="obstacle-cursor"
            aria-hidden
          />
        ) : null}
      </div>
      <p className="w-24 text-right font-mono text-3xl font-semibold tabular-nums" data-testid="obstacle-distance">
        {hasDistance && distance > max ? `> ${max} m` : formatNumber(distance, 1, "m")}
      </p>
    </div>
  );
}

function SectorRose() {
  const limits = useLimits();
  const sectors = useTelemetryStore((s) => s.telemetry?.obstacle_sectors);
  const list = Array.from({ length: 8 }, (_, i) => sectors?.[i] ?? null);

  return (
    <svg viewBox="-60 -60 120 120" className="size-32 shrink-0" role="img" aria-label="Sơ đồ 8 cung khoảng cách quanh drone" data-testid="sector-rose">
      <defs>
        <pattern id="sector-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="oklch(1 0 0 / 4%)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="oklch(0.7 0.02 256 / 55%)" strokeWidth="1.4" />
        </pattern>
      </defs>
      {list.map((d, i) => {
        const tone = sectorTone(d, limits);
        return (
          <path
            key={i}
            d={sectorPath(i, 20, 56)}
            className={cn(TONE_FILL[tone], "stroke-white/15")}
            strokeWidth="0.6"
            data-testid={`sector-${i}`}
            data-tone={tone}
          >
            <title>{`Cung ${i} (${i * 45}°): ${d == null ? "không có dữ liệu" : `${d.toFixed(1)} m`}`}</title>
          </path>
        );
      })}
      {/* Drone ở tâm, mũi hướng lên */}
      <path d="M0 -12 L8 9 L0 4 L-8 9 Z" className="fill-hud-cyan" />
      <text y="-45" textAnchor="middle" className="fill-foreground/70 text-[8px] font-semibold">MŨI</text>
    </svg>
  );
}

export function ObstaclePanel({ style }: { style?: CSSProperties }) {
  const state = useTelemetryStore((s) => s.telemetry?.avoid_state);
  const healthy = useTelemetryStore((s) => s.telemetry?.rangefinder_healthy);
  const mode = useTelemetryStore((s) => s.telemetry?.mode);
  const tone: ObstacleTone = state ? AVOID_TONE[state] : "unknown";

  return (
    <Panel
      title="Vật cản"
      icon={Radar}
      style={style}
      testId="obstacle-panel"
      bodyClassName="flex flex-col gap-3 p-3"
      actions={
        <span
          className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", TONE_CHIP[tone])}
          data-testid="avoid-state"
          data-state={state ?? "none"}
          data-tone={tone}
        >
          {state ? AVOID_STATE_LABEL[state] : "—"}
        </span>
      }
    >
      <DistanceBar />
      <div className="flex items-center gap-4">
        <SectorRose />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>
            Cảm biến:{" "}
            <span className={cn("font-medium", healthy === true ? "text-hud-green" : healthy === false ? "text-hud-red" : "")}>
              {healthy === true ? "khoẻ" : healthy === false ? "không khoẻ" : "—"}
            </span>
          </p>
          <p>Cung gạch chéo = không có dữ liệu. Phần cứng thật chỉ có MỘT tia đo thẳng trước (3.6°), nên 7/8 cung luôn gạch chéo.</p>
          <p className={TONE_TEXT[tone]}>
            FC chỉ tự phanh trước vật cản ở LOITER / ALT HOLD / POSHOLD.
          </p>
        </div>
      </div>
      {showsNoAvoidWarning(mode) ? (
        <div role="note" data-testid="no-avoid-warning" className="flex gap-2 rounded-lg border border-hud-amber/50 bg-hud-amber/10 p-2.5 text-xs text-hud-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            <span className="font-semibold">{NO_AVOID_WARNING[0]}</span>
            <br />
            {NO_AVOID_WARNING[1]}
            <br />
            {NO_AVOID_WARNING[2]}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
