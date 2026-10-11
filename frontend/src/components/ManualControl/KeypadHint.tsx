/**
 * Sơ đồ phím cho người mới (plan Phase 10 §10.1.6). Phím đang giữ tô sáng —
 * nhìn là biết trình duyệt đang tin mình giữ phím nào. Sau một lần Alt-Tab, nếu
 * ô `W` vẫn sáng thì đó chính là lỗi §10.1.3 hiện hình.
 */
import { KEY_LABEL } from "@/lib/velocityMapping";
import { cn } from "@/lib/utils";

interface KeyCapProps {
  code: string;
  hint: string;
  held: ReadonlySet<string>;
  wide?: boolean;
}

function KeyCap({ code, hint, held, wide }: KeyCapProps) {
  const on = held.has(code);
  return (
    <div
      data-testid={`key-${code}`}
      data-held={on}
      title={hint}
      className={cn(
        "flex h-10 flex-col items-center justify-center rounded-md border text-center transition-colors",
        wide ? "w-20" : "w-10",
        on
          ? "border-hud-amber/70 bg-hud-amber/20 text-hud-amber shadow-[0_0_14px_-4px] shadow-hud-amber"
          : "border-border bg-foreground/4 text-foreground/80 shadow-[inset_0_-2px_0] shadow-foreground/10",
      )}
    >
      <span className="font-mono text-sm leading-none font-semibold">{KEY_LABEL[code]}</span>
      <span className="mt-0.5 text-[9px] leading-none text-muted-foreground">{hint}</span>
    </div>
  );
}

export function KeypadHint({ held }: { held: readonly string[] }) {
  const set = new Set(held);
  return (
    <div className="flex flex-wrap items-end gap-4" aria-label="Sơ đồ phím lái tay">
      <div className="grid grid-cols-3 gap-1">
        <KeyCap code="KeyQ" hint="xoay trái" held={set} />
        <KeyCap code="KeyW" hint="tiến" held={set} />
        <KeyCap code="KeyE" hint="xoay phải" held={set} />
        <KeyCap code="KeyA" hint="trái" held={set} />
        <KeyCap code="KeyS" hint="lùi" held={set} />
        <KeyCap code="KeyD" hint="phải" held={set} />
      </div>
      <div className="grid grid-cols-1 gap-1">
        <KeyCap code="KeyR" hint="lên" held={set} />
        <KeyCap code="KeyF" hint="xuống" held={set} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <span />
        <KeyCap code="ArrowUp" hint="tiến" held={set} />
        <span />
        <KeyCap code="ArrowLeft" hint="trái" held={set} />
        <KeyCap code="ArrowDown" hint="lùi" held={set} />
        <KeyCap code="ArrowRight" hint="phải" held={set} />
      </div>
      <KeyCap code="Space" hint="DỪNG NGAY" held={set} wide />
    </div>
  );
}
