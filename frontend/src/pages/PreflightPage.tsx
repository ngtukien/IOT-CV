/**
 * Trang KIỂM TRA TRƯỚC BAY — hai nửa:
 *
 *  - tự động: tính từ telemetry + status (`lib/preflight.ts`), cập nhật liên tục;
 *  - thủ công: việc chỉ NGƯỜI mới kiểm được (cánh quạt, cell pin, RC, bãi bay…),
 *    tick lưu trên máy này và tự hết hạn sau 6 giờ.
 *
 * Trang này là bảng NHÌN, không phải cổng chặn — cổng thật là pre-arm của FC và
 * precheck của backend. Không có nút ARM ở đây: ARM chỉ ở trang Bay, có xác nhận.
 */
import { CircleCheck, Circle, RotateCcw, ShieldCheck } from "lucide-react";

import { IconPreflight } from "@/components/icons";
import { PageHeader } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { CheckRows, VerdictBanner } from "@/components/preflight/Checks";
import { Button } from "@/components/ui/button";
import { usePreflight } from "@/hooks/usePreflight";
import { formatClock } from "@/lib/format";
import { MANUAL_CHECKS } from "@/lib/preflight";
import { cn } from "@/lib/utils";
import { CHECKLIST_TTL_MS, isTicked, useChecklist } from "@/store/checklist";

const SAFETY_RULES: [string, string][] = [
  ["FC là thành phần duy nhất ổn định máy bay", "Web chỉ gửi lệnh mức cao; AI chỉ sinh sự kiện, không bao giờ điều khiển motor."],
  ["RC luôn có quyền cao nhất", "Web không tự giành quyền: người vận hành phải chủ động bật WEB CONTROL."],
  ["Dead-man 300 ms", "Mất trình duyệt hay thả phím thì backend tự gửi vận tốc 0, không chờ web."],
  ["Không tắt pre-arm check", "Pre-arm báo lỗi là có nguyên nhân thật — sửa nguyên nhân."],
  ["Mất camera không đổi hành vi bay", "Telemetry và điều khiển vẫn chạy khi camera hoặc AI hỏng."],
];

export default function PreflightPage() {
  const { checks, verdict } = usePreflight();
  const ticks = useChecklist((s) => s.ticks);
  const toggle = useChecklist((s) => s.toggle);
  const reset = useChecklist((s) => s.reset);
  const done = MANUAL_CHECKS.filter((c) => isTicked(ticks, c.id)).length;

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="An toàn"
        title="Kiểm tra trước bay"
        description="Ô tự động đọc từ drone; danh sách thủ công là việc chỉ người vận hành xác nhận được. Trang này không thay pre-arm check của ArduPilot."
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(300px,380px)]">
        <Panel title="Tự động" subtitle="Cập nhật liên tục từ telemetry" icon={IconPreflight} bodyClassName="flex flex-col gap-3 p-3" testId="preflight-auto">
          <VerdictBanner verdict={verdict} />
          <CheckRows checks={checks} />
        </Panel>

        <Panel
          title="Người vận hành tự xác nhận"
          subtitle={`${done}/${MANUAL_CHECKS.length} · tick tự hết hạn sau ${CHECKLIST_TTL_MS / 3_600_000} giờ`}
          icon={ShieldCheck}
          bodyClassName="p-3"
          testId="preflight-manual"
          actions={
            <Button size="xs" variant="ghost" onClick={reset} disabled={done === 0}>
              <RotateCcw aria-hidden /> Làm lại
            </Button>
          }
        >
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-foreground/8">
            <div className="h-full rounded-full bg-hud-green transition-[width] duration-500" style={{ width: `${(done / MANUAL_CHECKS.length) * 100}%` }} />
          </div>
          <ul className="space-y-1.5">
            {MANUAL_CHECKS.map((c) => {
              const on = isTicked(ticks, c.id);
              const Icon = on ? CircleCheck : Circle;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(c.id)}
                    data-testid={`manual-${c.id}`}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      on ? "border-hud-green/40 bg-hud-green/8" : "border-border hover:bg-foreground/4",
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-4.5 shrink-0", on ? "text-hud-green" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] leading-snug">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.detail}
                        {on ? ` · đã tick lúc ${formatClock(ticks[c.id] / 1000)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Năm luật không thương lượng" subtitle="Tóm tắt SAFETY.md" icon={ShieldCheck} bodyClassName="p-3">
          <ol className="space-y-3">
            {SAFETY_RULES.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="num grid size-6 shrink-0 place-items-center rounded-md bg-hud-red/12 text-[11px] font-semibold text-hud-red">{i + 1}</span>
                <div>
                  <p className="text-[13px] font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
