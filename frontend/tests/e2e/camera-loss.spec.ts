/**
 * Nghiệm thu Phase 10 §10.8 bài #8 — mất camera KHÔNG ảnh hưởng gì khác
 * (SAFETY.md mục 9: "telemetry vẫn chạy, control vẫn chạy, UAV không đổi mode").
 *
 * Cần người (hoặc script) DỪNG nguồn video giữa lúc test đang chờ, nên chỉ chạy
 * khi đặt `IOT_CV_CAMERA_LOSS=1`. Quy trình đủ (nguồn giả chạy riêng ở 8081):
 *
 *   uv run python -m backend.vision.fake_stream --port 8081
 *   CAMERA_FAKE=0 CAMERA_STREAM_URL=http://127.0.0.1:8081/stream uv run uvicorn backend.app:app --port 8000
 *   IOT_CV_CAMERA_LOSS=1 pnpm exec playwright test tests/e2e/camera-loss.spec.ts
 *   # khi test in "DỪNG NGUỒN VIDEO NGAY", giết tiến trình fake_stream;
 *   # khi nó in "BẬT LẠI NGUỒN VIDEO", chạy lại lệnh fake_stream.
 */
import { expect, test } from "@playwright/test";

import { openGcs, readTape, skipUnlessConnected } from "./fixtures/gcs";

test.describe("mất camera không ảnh hưởng telemetry / điều khiển / bản đồ @requires-sitl", () => {
  test.beforeAll(async () => {
    test.skip(process.env.IOT_CV_CAMERA_LOSS !== "1", "Bài cần dừng nguồn video giữa chừng — đặt IOT_CV_CAMERA_LOSS=1 (xem đầu file)");
    await skipUnlessConnected((condition, reason) => test.skip(condition, reason));
  });

  test("#8 dừng nguồn video: panel CAMERA OFFLINE, mọi thứ khác vẫn chạy, nguồn về thì hình về", async ({ page }) => {
    test.setTimeout(180_000);
    await openGcs(page);
    await expect(page.getByTestId("camera-offline")).toHaveCount(0, { timeout: 15_000 });
    const modeBefore = await page.getByTestId("mode-panel").locator("[data-active=true]").first().getAttribute("data-testid");

    console.log("  >>> DỪNG NGUỒN VIDEO NGAY");
    await expect(page.getByTestId("camera-offline")).toBeVisible({ timeout: 90_000 });
    console.log(`  camera offline lúc ${new Date().toISOString()}`);

    // Telemetry vẫn chảy: link xanh, băng độ cao vẫn có số.
    await expect(page.getByTestId("link-backend-drone")).toHaveAttribute("data-light", "ok");
    expect(await readTape(page, "pfd-alt")).not.toBeNull();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    // UAV không đổi mode vì mất camera.
    const modeAfter = await page.getByTestId("mode-panel").locator("[data-active=true]").first().getAttribute("data-testid");
    expect(modeAfter).toBe(modeBefore);
    // Không toast đỏ, không khoá nút điều khiển.
    await expect(page.locator("[data-sonner-toast][data-type=error]")).toHaveCount(0);
    await expect(page.getByTestId("cmd-hold")).toBeEnabled();
    await expect(page.getByTestId("mode-LOITER")).toBeEnabled();
    // Điều khiển vẫn chạy: một lệnh đổi mode "đứng yên" đi và được FC xác nhận.
    await page.getByTestId("mode-LOITER").click();
    await expect(page.getByTestId("mode-LOITER")).toHaveAttribute("data-active", "true", { timeout: 10_000 });

    console.log("  >>> BẬT LẠI NGUỒN VIDEO");
    await expect(page.getByTestId("camera-offline")).toHaveCount(0, { timeout: 90_000 });
    await expect(page.getByTestId("video-img")).toBeVisible();
  });
});
