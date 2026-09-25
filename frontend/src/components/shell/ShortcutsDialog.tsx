/** Hộp "Phím tắt" (phím ?). Một bảng tra, không có hành động nào. */
import { PAGES } from "@/app/routes";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useUiStore } from "@/store/ui";

const FLIGHT_KEYS: [string, string][] = [
  ["W / ↑", "Tiến theo mũi"],
  ["S / ↓", "Lùi"],
  ["A / ←  ·  D / →", "Sang trái · sang phải"],
  ["R  ·  F", "Lên · xuống"],
  ["Q  ·  E", "Xoay trái · xoay phải"],
  ["Space", "DỪNG NGAY (vận tốc 0)"],
  ["H", "HOLD — đứng yên (mọi trang)"],
];

const APP_KEYS: [string, string][] = [
  ["?", "Mở bảng phím tắt này"],
  ...PAGES.map((p): [string, string] => [`Alt + ${p.hotkey}`, `Trang ${p.label}`]),
];

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
          <dt className="text-muted-foreground">{v}</dt>
          <dd>
            <kbd className="rounded-md border border-border bg-foreground/5 px-2 py-0.5 font-mono text-[11px] whitespace-nowrap">{k}</kbd>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcuts);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl p-6">
        <DialogTitle className="font-display text-lg font-semibold">Phím tắt</DialogTitle>
        <DialogDescription className="mb-4 text-sm text-muted-foreground">
          Phím lái chỉ có tác dụng khi WEB CONTROL đang bật từ chính tab này và drone ở GUIDED.
        </DialogDescription>
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <p className="eyebrow mb-2">Lái tay</p>
            <Rows rows={FLIGHT_KEYS} />
          </section>
          <section>
            <p className="eyebrow mb-2">Ứng dụng</p>
            <Rows rows={APP_KEYS} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
