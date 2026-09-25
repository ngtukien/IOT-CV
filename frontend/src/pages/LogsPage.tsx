/**
 * Trang NHẬT KÝ — mọi sự kiện (backend + web) và lịch sử lệnh của tab này.
 *
 * Sự kiện: tối đa 200 dòng (khớp vòng đệm EventBus của backend), lọc theo mức,
 * nguồn, từ khoá; bấm một dòng để xem `code` và `detail` — hai thứ dành cho
 * người sửa lỗi nên không chiếm chỗ trong bảng.
 *
 * Lịch sử lệnh: từng lệnh bay tab này đã gửi, với hai mốc đo được — backend
 * nhận (`ack accepted`) và FC xác nhận (`ack done`) — hoặc lỗi. Độ trễ lớn bất
 * thường là dấu hiệu link yếu, không phải lỗi giao diện.
 */
import { Download, Info, OctagonX, Search, TerminalSquare, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { IconLog } from "@/components/icons";
import { EmptyState, PageHeader, Tag } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadText, toCsv } from "@/lib/csv";
import { formatClock } from "@/lib/format";
import { EVENT_LEVELS, ERROR_CODE_LABEL } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useControlStore } from "@/store/control";
import type { CommandRecord } from "@/store/control";
import { useTelemetryStore } from "@/store/telemetry";
import type { LogEntry } from "@/store/telemetry";
import { useUiStore } from "@/store/ui";

type Level = LogEntry["level"];

const LEVEL: Record<Level, { icon: typeof Info; cls: string; label: string }> = {
  info: { icon: Info, cls: "text-hud-cyan", label: "Thông tin" },
  warn: { icon: TriangleAlert, cls: "text-hud-amber", label: "Cảnh báo" },
  error: { icon: OctagonX, cls: "text-hud-red", label: "Lỗi" },
};

function EventDetail({ e }: { e: LogEntry }) {
  return (
    <div className="well space-y-2 p-3 text-[12.5px]">
      <p className="font-medium">{e.message}</p>
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11.5px]">
        <dt className="text-muted-foreground">thời điểm</dt>
        <dd>{new Date(e.ts * 1000).toLocaleString("vi-VN")}</dd>
        <dt className="text-muted-foreground">mức</dt>
        <dd>{e.level}</dd>
        <dt className="text-muted-foreground">nguồn</dt>
        <dd>{e.source}</dd>
        <dt className="text-muted-foreground">code</dt>
        <dd className="break-all">{e.code}</dd>
      </dl>
      {e.detail ? (
        <pre className="max-h-64 overflow-auto rounded-md bg-foreground/5 p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify(e.detail, null, 2)}</pre>
      ) : (
        <p className="text-xs text-muted-foreground">Không có `detail`.</p>
      )}
    </div>
  );
}

function EventsPanel() {
  const events = useTelemetryStore((s) => s.events);
  const [levels, setLevels] = useState<Set<Level>>(() => new Set(EVENT_LEVELS));
  const [source, setSource] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const sources = useMemo(() => ["all", ...new Set(events.map((e) => e.source))], [events]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) => levels.has(e.level) && (source === "all" || e.source === source) && (!q || e.message.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)),
    );
  }, [events, levels, source, query]);
  const counts = useMemo(() => {
    const c: Record<Level, number> = { info: 0, warn: 0, error: 0 };
    for (const e of events) c[e.level] += 1;
    return c;
  }, [events]);
  const selected = shown.find((e) => e.key === open) ?? null;

  const exportAll = (kind: "csv" | "json") => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (kind === "json") downloadText(`iot-cv-events-${stamp}.json`, JSON.stringify(shown, null, 2), "application/json");
    else
      downloadText(
        `iot-cv-events-${stamp}.csv`,
        toCsv(
          ["time", "level", "source", "code", "message", "detail"],
          shown.map((e) => [new Date(e.ts * 1000).toISOString(), e.level, e.source, e.code, e.message, e.detail ? JSON.stringify(e.detail) : ""]),
        ),
        "text/csv",
      );
  };

  return (
    <Panel
      title="Sự kiện"
      subtitle={`${shown.length} / ${events.length} dòng · mới nhất ở trên`}
      icon={IconLog}
      testId="logs-events"
      bodyClassName="flex min-h-0 flex-col gap-3 p-3"
      actions={
        <>
          <Button size="xs" variant="outline" onClick={() => exportAll("csv")} disabled={shown.length === 0}>
            <Download aria-hidden /> CSV
          </Button>
          <Button size="xs" variant="outline" onClick={() => exportAll("json")} disabled={shown.length === 0}>
            <Download aria-hidden /> JSON
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm trong nội dung hoặc code…" className="h-8 pl-8 text-[13px]" aria-label="Tìm sự kiện" />
        </div>
        <div className="flex gap-1">
          {EVENT_LEVELS.map((l) => {
            const on = levels.has(l);
            const Icon = LEVEL[l].icon;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setLevels((prev) => {
                    const next = new Set(prev);
                    if (next.has(l)) next.delete(l);
                    else next.add(l);
                    return next;
                  })
                }
                className={cn("flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-opacity", on ? "border-border bg-foreground/5" : "border-transparent opacity-40")}
              >
                <Icon className={cn("size-3.5", LEVEL[l].cls)} /> {LEVEL[l].label}
                <span className="num text-muted-foreground">{counts[l]}</span>
              </button>
            );
          })}
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
          aria-label="Lọc theo nguồn"
        >
          {sources.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "Mọi nguồn" : s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="max-h-[62dvh] overflow-y-auto rounded-lg border border-border">
          {shown.length === 0 ? (
            <EmptyState icon={IconLog} title={events.length === 0 ? "Chưa có sự kiện nào" : "Không có dòng nào khớp bộ lọc"} />
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-popover text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Giờ</th>
                  <th className="px-2 py-2 font-medium">Mức</th>
                  <th className="px-2 py-2 font-medium">Nguồn</th>
                  <th className="px-3 py-2 font-medium">Nội dung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((e) => {
                  const L = LEVEL[e.level];
                  const Icon = L.icon;
                  return (
                    <tr
                      key={e.key}
                      onClick={() => setOpen(e.key === open ? null : e.key)}
                      className={cn("cursor-pointer align-top transition-colors hover:bg-foreground/4", e.key === open && "bg-hud-cyan/8")}
                      data-code={e.code}
                    >
                      <td className="num px-3 py-1.5 whitespace-nowrap text-muted-foreground">{formatClock(e.ts)}</td>
                      <td className="px-2 py-1.5">
                        <Icon className={cn("size-3.5", L.cls)} aria-label={e.level} />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="rounded bg-foreground/6 px-1.5 py-px font-mono text-[10.5px] text-muted-foreground">{e.source}</span>
                      </td>
                      <td className="px-3 py-1.5 leading-snug">{e.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div>
          {selected ? <EventDetail e={selected} /> : <p className="well p-3 text-xs text-muted-foreground">Bấm một dòng để xem code và chi tiết kỹ thuật.</p>}
        </div>
      </div>
    </Panel>
  );
}

function latency(from: number, to: number | null): string {
  return to === null ? "—" : `${Math.max(0, to - from)} ms`;
}

function CommandRow({ c }: { c: CommandRecord }) {
  const state = c.error ? "error" : c.doneAt ? "done" : c.acceptedAt ? "accepted" : "sent";
  return (
    <tr className="align-top">
      <td className="num px-3 py-1.5 whitespace-nowrap text-muted-foreground">{formatClock(c.sentAt / 1000)}</td>
      <td className="px-3 py-1.5 font-medium">{c.label}</td>
      <td className="num px-3 py-1.5 text-right">{latency(c.sentAt, c.acceptedAt)}</td>
      <td className="num px-3 py-1.5 text-right">{latency(c.sentAt, c.doneAt)}</td>
      <td className="px-3 py-1.5">
        {state === "error" ? (
          <Tag tone="danger" title={c.error?.message}>
            {ERROR_CODE_LABEL[c.error?.code as keyof typeof ERROR_CODE_LABEL] ?? c.error?.code}
          </Tag>
        ) : state === "done" ? (
          <Tag tone="ok">FC xác nhận</Tag>
        ) : state === "accepted" ? (
          <Tag tone="warn">Chờ FC</Tag>
        ) : (
          <Tag>Đã gửi</Tag>
        )}
      </td>
    </tr>
  );
}

function CommandsPanel() {
  const history = useControlStore((s) => s.history);
  return (
    <Panel title="Lịch sử lệnh" subtitle="Lệnh bay gửi từ tab này · độ trễ đo tại trình duyệt" icon={TerminalSquare} testId="logs-commands" bodyClassName="p-0">
      {history.length === 0 ? (
        <EmptyState icon={TerminalSquare} title="Chưa gửi lệnh nào">
          Lệnh mode, ARM, cất cánh, HOLD/RTL/LAND và bật/tắt WEB CONTROL hiện ở đây. Lệnh lái tay (10 lần/giây) không ghi.
        </EmptyState>
      ) : (
        <div className="max-h-[62dvh] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-popover text-left text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Gửi lúc</th>
                <th className="px-3 py-2 font-medium">Lệnh</th>
                <th className="px-3 py-2 text-right font-medium">Backend nhận</th>
                <th className="px-3 py-2 text-right font-medium">FC xác nhận</th>
                <th className="px-3 py-2 font-medium">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((c) => (
                <CommandRow key={c.ref} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function LogsPage() {
  // Mở trang Nhật ký = đã xem mọi cảnh báo tới giờ → chấm trên chuông tắt.
  const newest = useTelemetryStore((s) => s.events[0]?.ts ?? null);
  const markSeen = useUiStore((s) => s.markSeen);
  useEffect(() => {
    if (newest !== null) markSeen(newest);
  }, [newest, markSeen]);

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="Giám sát"
        title="Nhật ký"
        description="Sự kiện của backend (MAVLink, an toàn, mission, thị giác) và của chính trang web (mất/nối lại kết nối, lệnh đã gửi)."
      />
      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <EventsPanel />
        <CommandsPanel />
      </div>
    </div>
  );
}
