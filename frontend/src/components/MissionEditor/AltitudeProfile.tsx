/**
 * Hồ sơ độ cao của lộ trình: trục ngang = quãng đường NGANG cộng dồn theo thứ tự
 * bay (m), trục đứng = độ cao so với home (m). Một chuỗi, một trục.
 *
 * Dải [min_alt, max_alt] của backend tô nền để thấy ngay điểm nào ra ngoài —
 * cùng luật với `missionRules.ts`, chỉ là nhìn bằng mắt. Rê chuột: đường dóng +
 * nhãn điểm gần nhất.
 */
import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { useHome, useMissionDraft } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";
import { MAV_CMD } from "@/lib/missionRules";
import { routeProfile } from "@/lib/routeTools";
import type { ProfilePoint } from "@/lib/routeTools";

const W = 640;
const H = 180;
const PAD = { l: 38, r: 12, t: 12, b: 26 };

function niceStep(span: number, target = 5): number {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

export function AltitudeProfile({ className }: { className?: string }) {
  const { items } = useMissionDraft();
  const home = useHome();
  const limits = useLimits();
  const pts = useMemo(() => routeProfile(items, home), [items, home]);
  const [hover, setHover] = useState<ProfilePoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const hasWaypoint = items.some((it) => it.command === MAV_CMD.NAV_WAYPOINT);
  if (!home || !hasWaypoint || pts.length < 2) {
    return (
      <div className={className} data-testid="altitude-profile">
        <p className="grid h-[150px] place-items-center rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
          {home ? "Thêm ít nhất một waypoint để thấy hồ sơ độ cao." : "Chưa có điểm home — chưa dựng được hồ sơ độ cao."}
        </p>
      </div>
    );
  }

  const maxD = Math.max(1, pts.at(-1)!.distance);
  const maxA = Math.max(limits?.max_alt ?? 0, ...pts.map((p) => p.alt), 1) * 1.1;
  const x = (d: number) => PAD.l + (d / maxD) * (W - PAD.l - PAD.r);
  const y = (a: number) => H - PAD.b - (a / maxA) * (H - PAD.t - PAD.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.distance).toFixed(1)},${y(p.alt).toFixed(1)}`).join("");
  const area = `${line}L${x(maxD)},${y(0)}L${x(0)},${y(0)}Z`;
  const yStep = niceStep(maxA, 4);
  const xStep = niceStep(maxD, 6);

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const d = ((px - PAD.l) / (W - PAD.l - PAD.r)) * maxD;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.distance - d) < Math.abs(best.distance - d)) best = p;
    setHover(best);
  };

  return (
    <div className={className} data-testid="altitude-profile">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Hồ sơ độ cao: ${pts.length} điểm, dài ${Math.round(maxD)} m`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Vùng độ cao cho phép — nền, không phải dữ liệu. */}
        {limits ? (
          <rect
            x={PAD.l}
            width={W - PAD.l - PAD.r}
            y={y(limits.max_alt)}
            height={Math.max(0, y(limits.min_alt) - y(limits.max_alt))}
            fill="var(--hud-green)"
            opacity={0.07}
          />
        ) : null}
        {Array.from({ length: Math.floor(maxA / yStep) + 1 }, (_, i) => i * yStep).map((a) => (
          <g key={`y${a}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(a)} y2={y(a)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={PAD.l - 6} y={y(a) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
              {a}
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor(maxD / xStep) + 1 }, (_, i) => i * xStep).map((d) => (
          <text key={`x${d}`} x={x(d)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            {Number(d.toFixed(1))} m
          </text>
        ))}
        {limits
          ? [
              { a: limits.max_alt, t: `trần ${limits.max_alt} m` },
              { a: limits.min_alt, t: `sàn ${limits.min_alt} m` },
            ].map((l) => (
              <g key={l.t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(l.a)} y2={y(l.a)} stroke="var(--hud-amber)" strokeDasharray="4 4" strokeOpacity={0.7} />
                <text x={W - PAD.r - 2} y={y(l.a) - 4} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                  {l.t}
                </text>
              </g>
            ))
          : null}
        <path d={area} fill="var(--series-1)" opacity={0.14} />
        <path d={line} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.distance)} cy={y(p.alt)} r={4} fill="var(--series-1)" stroke="var(--panel-strong)" strokeWidth={2} />
        ))}
        {hover ? (
          <g pointerEvents="none">
            <line x1={x(hover.distance)} x2={x(hover.distance)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.35} />
            <circle cx={x(hover.distance)} cy={y(hover.alt)} r={6} fill="none" stroke="var(--series-1)" strokeWidth={2} />
          </g>
        ) : null}
      </svg>
      <p className="mt-1 h-4 font-mono text-[11px] text-muted-foreground" aria-live="polite">
        {hover ? `${hover.label} · ${hover.distance.toFixed(0)} m từ lúc cất cánh · cao ${hover.alt.toFixed(1)} m` : "Rê chuột lên biểu đồ để đọc từng điểm."}
      </p>
    </div>
  );
}
