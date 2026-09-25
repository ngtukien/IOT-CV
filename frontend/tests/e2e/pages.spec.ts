/**
 * Web GCS v2 — đi qua MỌI trang bằng tab trên header (router phía trình duyệt):
 * trang nào cũng lên, không lỗi JavaScript, và WebSocket KHÔNG bị mở lại khi đổi
 * trang (đổi trang mà mở socket mới là mất quyền lái giữa chừng).
 *
 * Cần backend chạy (SITL tuỳ chọn — trang vẫn phải lên khi chưa có drone).
 */
import { expect, test } from "@playwright/test";

import { BASE_URL } from "./fixtures/gcs";

const TABS = [
  ["nav-mission", "mission-panel"],
  ["nav-3d", "twin-page"],
  ["nav-vision", "video-panel"],
  ["nav-overview", "overview-hero"],
  ["nav-telemetry", "logs-events", /* không có ở trang này */ ""],
  ["nav-logs", "logs-events"],
  ["nav-preflight", "preflight-auto"],
  ["nav-system", "system-limits"],
  ["nav-settings", ""],
  ["nav-flight", "mode-panel"],
] as const;

test.describe("mọi trang của web GCS v2", () => {
  test.beforeAll(async () => {
    try {
      await fetch(`${BASE_URL}/api/health`);
    } catch (err) {
      test.skip(true, `Không gọi được ${BASE_URL} (${(err as Error).message}) — bật backend trước`);
    }
  });

  test("đi qua 10 tab: không lỗi trang, chỉ MỘT WebSocket suốt phiên", async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let sockets = 0;
    page.on("websocket", (ws) => {
      if (ws.url().endsWith("/ws")) sockets += 1;
    });

    await page.goto("/");
    await expect(page.getByTestId("mode-panel")).toBeVisible();

    for (const [tab, marker] of TABS) {
      await page.getByTestId(tab).click();
      if (marker && tab !== "nav-telemetry") await expect(page.getByTestId(marker).first()).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(tab === "nav-3d" ? 2500 : 600);
    }

    expect(errors, errors.join("\n")).toEqual([]);
    expect(sockets, "đổi trang không được mở WebSocket mới").toBe(1);
  });

  test("F5 ở trang con: backend trả đúng trang (không 404)", async ({ page }) => {
    const res = await page.goto("/mission");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("mission-panel")).toBeVisible();
  });
});
