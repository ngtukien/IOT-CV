/**
 * Playwright E2E — plan Phase 10 §10.6.
 *
 * Các test ở đây cần HỆ THỐNG THẬT: SITL + backend + bản build (`pnpm build`,
 * FastAPI phục vụ `dist/` ở cổng 8000). Không giả lập gì.
 *
 * KHÔNG dùng `webServer` tự khởi động: SITL nằm trong WSL, không quản lý được từ
 * đây. Người chạy tự bật SITL + backend trước; mỗi spec kiểm tiền đề ở
 * `beforeAll` và `test.skip` KÈM LÝ DO khi thiếu, thay vì đỏ một cách khó hiểu.
 *
 * Không chạy trên CI (§10.6.7): đây là test CHẠY TAY BẮT BUỘC trước mỗi buổi bay
 * thật — xem `docs/so-tay/10-web-dieu-khien-obstacle-video.md`.
 */
import { defineConfig, devices } from "@playwright/test";

/** Đổi được khi backend chạy cổng khác: `GCS_BASE_URL=http://127.0.0.1:8001`. */
const BASE_URL = process.env.GCS_BASE_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  // Một drone ảo, một người lái: các spec không được chạy song song.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    viewport: { width: 1600, height: 1000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } } }],
});
