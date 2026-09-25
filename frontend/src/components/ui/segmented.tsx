import { cn } from "cn"
import type { ComponentType, ReactNode } from "react"

/**
 * Nút chọn một-trong-nhiều (radiogroup) — dùng cho chọn khung nhìn, lớp bản đồ,
 * cửa sổ thời gian của biểu đồ… Bàn phím: Tab vào nhóm, Space/Enter chọn.
 */
export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ComponentType<{ className?: string }>
  title?: string
  testId?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "sm",
  className,
}: {
  value: T
  onChange(v: T): void
  options: readonly SegmentedOption<T>[]
  label: string
  size?: "xs" | "sm"
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-foreground/4 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
              on ? "bg-hud-cyan/16 text-hud-cyan shadow-[inset_0_0_0_1px] shadow-hud-cyan/30" : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
