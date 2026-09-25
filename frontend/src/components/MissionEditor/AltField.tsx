/**
 * Ô độ cao: ô gõ số + thanh trượt trong [min_alt, max_alt] của backend.
 *
 * Gõ ngoài khoảng thì viền đỏ và báo lỗi NGAY — không tự kẹp im lặng (cùng
 * nguyên tắc Phase 06 §6.1.3): người gõ một con số là người có kỳ vọng cụ thể
 * về con số đó; lặng lẽ đổi nó là nói dối họ.
 *
 * Ô gõ giữ CHUỖI đang gõ trong state riêng. Ép thẳng về số thì gõ `5.` sẽ bị
 * nuốt dấu chấm, và ô trống sẽ tự thành `0`.
 */
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { RuleLimits } from "@/lib/missionRules";
import { cn } from "@/lib/utils";

const STEP_M = 0.5;

function parseAlt(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

function formatAlt(v: number): string {
  return Number.isNaN(v) ? "" : String(v);
}

function sameAlt(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

interface AltFieldProps {
  value: number;
  onChange(alt: number): void;
  limits: Pick<RuleLimits, "min_alt" | "max_alt"> | null;
  invalid?: boolean;
  label: string;
  testId?: string;
}

export function AltField({ value, onChange, limits, invalid, label, testId }: AltFieldProps) {
  const [text, setText] = useState(() => formatAlt(value));
  const [seenValue, setSeenValue] = useState(value);

  // Giá trị đổi từ NGOÀI (thanh trượt) → cập nhật ô gõ ngay trong lượt render
  // này (mẫu "điều chỉnh state khi prop đổi" của React, không cần effect). Giá
  // trị trùng với thứ đang gõ thì giữ nguyên chuỗi (`5.` vẫn là `5.`).
  if (!sameAlt(seenValue, value)) {
    setSeenValue(value);
    if (!sameAlt(parseAlt(text), value)) setText(formatAlt(value));
  }

  // Thanh trượt luôn được kiểm soát (Radix cảnh báo khi đổi qua lại). Ô gõ đang
  // trống hay ngoài khoảng thì thanh đứng ở mép gần nhất — lỗi đã báo ở ô gõ.
  const sliderMin = limits?.min_alt ?? 0;
  const sliderMax = limits?.max_alt ?? 1;
  const sliderValue = Number.isFinite(value) ? Math.min(Math.max(value, sliderMin), sliderMax) : sliderMin;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step={STEP_M}
          value={text}
          aria-label={label}
          aria-invalid={invalid || undefined}
          data-testid={testId}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parseAlt(e.target.value));
          }}
          className={cn("h-7 w-[4.75rem] pr-6 font-mono tabular-nums", invalid && "border-hud-red text-hud-red")}
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">m</span>
      </div>
      <Slider
        className="w-24"
        min={sliderMin}
        max={sliderMax}
        step={STEP_M}
        disabled={!limits}
        value={[sliderValue]}
        aria-label={`${label} (thanh trượt)`}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
