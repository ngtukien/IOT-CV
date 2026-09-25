/**
 * Gốc của web GCS v2: nhiều trang, MỘT kết nối.
 *
 * Mọi thứ phải sống qua việc đổi trang đều gắn ở đây, KHÔNG ở trang nào:
 *   - `useWebSocket`       — đúng MỘT socket cho cả ứng dụng (đổi trang không
 *                            mở lại socket, nên không mất quyền lái);
 *   - `useManualControl`   — phím lái + vòng gửi 10 Hz + bẫy mất tiêu điểm;
 *   - `useHoldShortcut`    — phím H = HOLD ở mọi trang;
 *   - `useMissionReadback` — lớp "mission đã nạp" luôn khớp FC;
 *   - `useAnnouncer`       — cảnh báo bằng âm thanh;
 *   - `useApplySettings`   — theme, chuyển động.
 *
 * Router chạy ở trình duyệt; backend trả `index.html` cho mọi đường dẫn trang
 * (`SpaStaticFiles` trong `backend/app.py`), nên F5 ở `/mission` vẫn đúng trang.
 */
import { BrowserRouter, Route, Routes } from "react-router";

import { PAGES } from "@/app/routes";
import { AppShell } from "@/components/shell/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { useApplySettings, useResolvedTheme } from "@/hooks/useApplySettings";
import { useHoldShortcut } from "@/hooks/useHoldShortcut";
import { useManualControl } from "@/hooks/useManualControl";
import { useMissionReadback } from "@/hooks/useMissionReadback";
import { useWebSocket } from "@/hooks/useWebSocket";
import NotFoundPage from "@/pages/NotFoundPage";

function GlobalServices() {
  useWebSocket();
  useMissionReadback();
  useManualControl();
  useHoldShortcut();
  useAnnouncer();
  useApplySettings();
  return null;
}

export default function App() {
  const theme = useResolvedTheme();
  return (
    <TooltipProvider delayDuration={300}>
      <GlobalServices />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            {PAGES.map((p) => {
              const Page = p.component;
              return p.path === "/" ? <Route key={p.path} index element={<Page />} /> : <Route key={p.path} path={p.path} element={<Page />} />;
            })}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme={theme === "night" ? "dark" : "light"} position="bottom-left" richColors />
    </TooltipProvider>
  );
}
