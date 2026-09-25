/**
 * Bài khói (plan Phase 10 §10.6.6): tải trang, có telemetry, HUD có số, bản đồ
 * hiện, không lỗi console. Bắt hỏng hóc thô trước khi chạy bài dead-man dài.
 *
 * Cần backend (và SITL để có telemetry) — tạm chạy tay, chưa lên CI (§10.6.7).
 */
import { expect, test } from "@playwright/test";

import { openGcs, readTape, skipUnlessConnected } from "./fixtures/gcs";

test.describe("GCS tải được và sống @requires-sitl", () => {
  test.beforeAll(async () => {
    await skipUnlessConnected((condition, reason) => test.skip(condition, reason));
  });

  test("trang lên, telemetry chạy, các panel Phase 10 có mặt, không lỗi console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      // "Failed to load resource" không ghi URL trong chữ — ghép URL vào để lọc được.
      if (m.type() === "error") errors.push(`${m.text()} @ ${m.location().url}`);
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await openGcs(page);
    expect(await readTape(page, "pfd-alt")).not.toBeNull();
    await expect(page.getByTestId("link-backend-drone")).toHaveAttribute("data-light", "ok");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await expect(page.getByTestId("mode-panel")).toBeVisible();
    await expect(page.getByTestId("manual-control")).toBeVisible();
    await expect(page.getByTestId("obstacle-panel")).toBeVisible();
    await expect(page.getByTestId("video-panel")).toBeVisible();
    // Web không tự giành quyền lái khi mở trang (SAFETY.md mục 4).
    await expect(page.getByTestId("web-control-switch")).toHaveAttribute("data-on", "false");
    await expect(page.getByTestId("safety-banner")).toHaveCount(0);

    // Cho trang chạy một nhịp để lỗi muộn (WebSocket, video) kịp hiện.
    await page.waitForTimeout(2000);
    // Lỗi tải ảnh bản đồ nền khi máy không có mạng không phải lỗi của GCS.
    const real = errors.filter((e) => !/tile|openstreetmap|arcgis|ERR_INTERNET_DISCONNECTED/i.test(e));
    expect(real, real.join("\n")).toEqual([]);
  });
});
