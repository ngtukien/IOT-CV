/**
 * Trung tâm thông báo: tấm trượt từ phải, liệt kê cảnh báo và lỗi (bỏ `info`).
 * Mở ra = đánh dấu đã xem tới sự kiện mới nhất → chấm trên chuông tắt.
 * Toàn bộ nhật ký (kể cả `info`, lọc, xuất file) ở trang Nhật ký.
 */
import { BellOff, OctagonX, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { EmptyState } from "@/components/kit";
import { DialogDescription, DialogTitle, Dialog, SheetContent } from "@/components/ui/dialog";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";
import { useUiStore } from "@/store/ui";

export function NotificationCenter() {
  const open = useUiStore((s) => s.notificationsOpen);
  const setOpen = useUiStore((s) => s.setNotifications);
  const markSeen = useUiStore((s) => s.markSeen);
  const seenUntil = useUiStore((s) => s.seenUntil);
  const events = useTelemetryStore((s) => s.events);
  const alerts = useMemo(() => events.filter((e) => e.level !== "info").slice(0, 60), [events]);
  // Mốc đã xem TRƯỚC khi mở lần này — để tô dòng mới. Chụp đúng lượt render
  // mở hộp (mẫu "điều chỉnh state khi prop đổi"), trước khi effect đánh dấu đã xem.
  const [opened, setOpened] = useState({ open, seen: seenUntil });
  if (opened.open !== open) setOpened({ open, seen: seenUntil });
  const seenBefore = opened.seen;

  useEffect(() => {
    if (open && events[0]) markSeen(events[0].ts);
  }, [open, events, markSeen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <SheetContent data-testid="notification-center">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-base font-semibold">Thông báo</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Cảnh báo và lỗi gần nhất của backend và web.</DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {alerts.length === 0 ? (
            <EmptyState icon={BellOff} title="Không có cảnh báo nào">
              Mọi sự kiện mức thông tin vẫn nằm trong trang Nhật ký.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-1">
              {alerts.map((e) => {
                const Icon = e.level === "error" ? OctagonX : TriangleAlert;
                const fresh = e.ts > seenBefore;
                return (
                  <li
                    key={e.key}
                    className={cn("flex gap-3 rounded-lg px-3 py-2.5", fresh ? "bg-foreground/5" : "")}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", e.level === "error" ? "text-hud-red" : "text-hud-amber")} aria-label={e.level} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug">{e.message}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                        {formatClock(e.ts)} · {e.source} · {e.code}
                      </p>
                    </div>
                    {fresh ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-hud-cyan" aria-label="mới" /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-3">
          <Link
            to="/logs"
            onClick={() => setOpen(false)}
            className="flex h-9 items-center justify-center rounded-lg bg-foreground/5 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            Mở trang Nhật ký
          </Link>
        </div>
      </SheetContent>
    </Dialog>
  );
}
