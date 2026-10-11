/**
 * Logo IOT-CV: quadcopter khung X nhìn từ trên, bốn cánh quạt quay khi drone
 * ARMED — logo cũng là một đèn trạng thái. Đứng yên khi DISARMED hoặc khi người
 * dùng tắt chuyển động.
 */
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

const ROTORS: [number, number][] = [
  [9, 9],
  [31, 9],
  [9, 31],
  [31, 31],
];

export function BrandMark({ className }: { className?: string }) {
  const armed = useTelemetryStore((s) => s.telemetry?.armed === true);
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id="brand-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--hud-cyan)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--hud-cyan) 55%, var(--hud-green))" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="10" fill="color-mix(in oklch, var(--hud-cyan) 12%, transparent)" stroke="color-mix(in oklch, var(--hud-cyan) 35%, transparent)" />
      <path d="M13 13 27 27M27 13 13 27" stroke="url(#brand-body)" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="16.5" y="16.5" width="7" height="7" rx="1.8" fill="url(#brand-body)" />
      <circle cx="20" cy="18.6" r="0.9" fill="var(--background)" />
      {ROTORS.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="5.2" fill="none" stroke="color-mix(in oklch, var(--hud-cyan) 40%, transparent)" strokeWidth="1" />
          <path
            d={`M${cx - 4.4} ${cy} L${cx + 4.4} ${cy}`}
            stroke="var(--hud-cyan)"
            strokeWidth="1.6"
            strokeLinecap="round"
            className={cn(armed && "rotor-spin")}
            style={armed ? { animationDirection: i === 1 || i === 2 ? "reverse" : "normal", animationDuration: "0.35s" } : undefined}
          />
        </g>
      ))}
    </svg>
  );
}
