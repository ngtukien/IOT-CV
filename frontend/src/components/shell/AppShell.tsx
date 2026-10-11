/**
 * Khung ứng dụng: nền, dải cảnh báo quyền lái, header, vùng trang, và các lớp
 * phủ dùng chung (thông báo, phím tắt, thanh thoát hiểm).
 *
 * Phím tắt cấp ứng dụng ở đây: ? (phím tắt), Alt+số (đổi trang). Phím LÁI và
 * phím H nằm ở `useManualControl` / `useHoldShortcut` — gắn ở
 * `App`, sống qua mọi trang.
 */
import { Suspense, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import { PAGES } from "@/app/routes";
import { SafetyBanner } from "@/components/ManualControl/SafetyBanner";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";

import { AppHeader } from "./AppHeader";
import { NotificationCenter } from "./NotificationCenter";
import { QuickDock } from "./QuickDock";
import { ShortcutsDialog } from "./ShortcutsDialog";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function useAppHotkeys(): void {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit\d$/.test(e.code)) {
        const page = PAGES.find((p) => p.hotkey === e.code.slice(5));
        if (page) {
          e.preventDefault();
          navigate(page.path);
        }
        return;
      }
      if (e.key === "?" && !isTyping(e.target) && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        ui.setShortcuts(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

/** Khung chờ lúc trang nạp (trang lazy lần đầu mở). */
function PageSkeleton() {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-3" aria-busy="true" aria-label="Đang nạp trang">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="panel h-40 animate-pulse opacity-60" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

export function AppShell() {
  useAppHotkeys();
  const { pathname } = useLocation();
  const page = PAGES.find((p) => p.path === pathname);

  useEffect(() => {
    document.title = page ? `${page.label} · IOT-CV GCS` : "IOT-CV GCS";
  }, [page]);

  return (
    <>
      <div className="app-canvas" aria-hidden />
      <div className="flex min-h-dvh flex-col">
        <div className="sticky top-0 z-40">
          {/* Dải cảnh báo quyền lái dính trên cùng, trên cả header. */}
          <SafetyBanner />
          <AppHeader />
        </div>
        {/* Chừa chỗ dưới cho thanh thoát hiểm nổi (có ở mọi trang trừ trang Bay). */}
        <main className={cn("mx-auto w-full max-w-[2400px] flex-1", pathname !== "/" && "pb-20")}>
          <Suspense fallback={<PageSkeleton />}>
            {/* Chuyển trang: mờ-trượt 8 px bằng CSS (`.rise-in`), tự tắt khi giảm chuyển động. */}
            <div key={pathname} className="rise-in">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <QuickDock />
      <NotificationCenter />
      <ShortcutsDialog />
    </>
  );
}
