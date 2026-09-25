/**
 * Nghiệm thu Phase 10 §10.8 — bay trọn chuyến SITL từ trình duyệt.
 *
 * Tự động hoá các bài làm được trên phiên SITL thường:
 *   #1 cất cánh từ web · #2 W → tiến theo mũi · #3 thả → dừng · #5 mất tiêu điểm
 *   → dừng · #7 HOLD · #6 mission AUTO (có xác nhận) + dòng "KHÔNG tự tránh" ·
 *   box nhận diện trùng khung ở 2 cỡ cửa sổ.
 * Bài #4 là `deadman.spec.ts`. Bài #8 (mất camera) và #9 (vật cản) cần cấu hình
 * backend/SITL khác — quy trình ở `docs/so-tay/10-web-dieu-khien-obstacle-video.md`.
 *
 * Chạy CÓ CỬA SỔ (`--headed`): bài #5 cần hệ điều hành thật sự chuyển tiêu điểm
 * sang cửa sổ khác. Không chạy trên CI (cần SITL).
 *
 *   pnpm exec playwright test tests/e2e/acceptance.spec.ts --headed
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { enableWebControl, ensureAirborne, ensureArmed, ensureGuided, openGcs, readTape, skipUnlessConnected } from "./fixtures/gcs";
import { angleDiff, bearingDeg, distanceM, openObserver } from "./fixtures/observer";
import type { Observer } from "./fixtures/observer";

test.describe.configure({ mode: "serial" });

let page: Page;
let obs: Observer;

function position() {
  const t = obs.telemetry();
  if (t?.lat == null || t.lon == null) throw new Error("observer chưa có vị trí");
  return { lat: t.lat, lon: t.lon, heading: t.heading ?? null };
}

/** Thời gian (ms) tới khi tốc độ < `below` m/s — đo bằng observer, 10 Hz. */
async function msUntilSlow(below = 0.2, timeoutMs = 3000): Promise<number | null> {
  const t0 = Date.now();
  while (Date.now() - t0 <= timeoutMs) {
    if ((obs.telemetry()?.ground_speed ?? Infinity) < below) return Date.now() - t0;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

function note(name: string, value: string) {
  console.log(`  [${name}] ${value}`);
  test.info().annotations.push({ type: name, description: value });
}

test.describe("nghiệm thu Phase 10 — bay trọn chuyến từ web @requires-sitl", () => {
  test.beforeAll(async ({ browser }) => {
    await skipUnlessConnected((condition, reason) => test.skip(condition, reason));
    obs = await openObserver();
    page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
    await openGcs(page);
  });

  test.afterAll(async () => {
    obs?.close();
    await page?.context().close();
  });

  test("#1 cất cánh từ web: GUIDED → ARM (gõ ARM) → TAKEOFF 5 m", async () => {
    test.setTimeout(120_000);
    // Đang bay sẵn từ lần chạy trước → hạ cánh trước, để bài này là cất cánh thật.
    if (obs.telemetry()?.armed) {
      await page.getByTestId("cmd-land").click();
      await expect.poll(() => obs.telemetry()?.armed, { timeout: 60_000 }).toBe(false);
    }
    await ensureGuided(page);
    await ensureArmed(page);
    await ensureAirborne(page, 4.5);
    await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
    note("bai1_alt_m", String(await readTape(page, "pfd-alt")));
  });

  test("#2 giữ W: ~1 m/s, dịch theo hướng mũi", async () => {
    await enableWebControl(page);
    const p0 = position();
    await page.keyboard.down("w");
    await expect(page.getByTestId("key-KeyW")).toHaveAttribute("data-held", "true");
    await page.waitForTimeout(3000);
    const speed = obs.telemetry()?.ground_speed ?? 0;
    const p1 = position();
    const moved = distanceM(p0, p1);
    const bearing = bearingDeg(p0, p1);
    note("bai2_speed_mps", speed.toFixed(2));
    note("bai2_bearing_vs_heading", `dịch ${moved.toFixed(1)} m hướng ${bearing.toFixed(0)}°, mũi ${p0.heading}°`);
    expect(speed).toBeGreaterThan(0.7);
    expect(speed).toBeLessThan(1.3);
    expect(moved).toBeGreaterThan(1);
    expect(angleDiff(bearing, p0.heading ?? 0)).toBeLessThan(25);
  });

  test("#3 thả W: dừng (< 0.2 m/s) trong 3 s", async () => {
    await page.keyboard.up("w");
    const ms = await msUntilSlow(0.2, 3000);
    note("bai3_stop_ms", String(ms));
    expect(ms, "thả W mà 3 s sau drone vẫn chưa dừng").not.toBeNull();
    await expect(page.getByTestId("web-control-switch")).toHaveAttribute("data-on", "true");
  });

  test("#5 mất tiêu điểm (cửa sổ khác giành focus) giữa lúc giữ W: dừng", async ({ browser }) => {
    await page.keyboard.down("w");
    await page.waitForTimeout(2000);
    expect(obs.telemetry()?.ground_speed ?? 0).toBeGreaterThan(0.5);

    // Playwright mặc định GIẢ LẬP focus: trang nào cũng tưởng mình đang được
    // focus, nên cửa sổ khác giành focus mà trang không nhận `blur`. Tắt giả lập
    // (CDP) để `blur` là sự kiện THẬT do hệ điều hành bắn — chỉ có tác dụng khi
    // chạy `--headed`.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await page.bringToFront();

    // Hệ điều hành chuyển tiêu điểm sang cửa sổ khác — keyup của W sẽ không bao giờ tới trang.
    const other = await (await browser.newContext()).newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    const ms = await msUntilSlow(0.2, 3000);
    note("bai5_stop_ms", String(ms));
    await expect(page.getByTestId("key-KeyW")).toHaveAttribute("data-held", "false");
    expect(ms, "mất tiêu điểm mà drone không dừng — bẫy blur §10.1.3").not.toBeNull();

    await other.context().close();
    await page.bringToFront();
    await page.keyboard.up("w");
  });

  test("#7 đang bay bấm HOLD → LOITER, đứng yên", async () => {
    await page.keyboard.down("w");
    await page.waitForTimeout(1500);
    expect(obs.telemetry()?.ground_speed ?? 0).toBeGreaterThan(0.5);
    await page.getByTestId("cmd-hold").click();
    await expect(page.getByTestId("mode-LOITER")).toHaveAttribute("data-active", "true", { timeout: 5000 });
    const ms = await msUntilSlow(0.2, 5000);
    note("bai7_stop_ms", String(ms));
    expect(ms).not.toBeNull();
    // Rời GUIDED → backend tự thu quyền lái, công tắc tự tắt.
    await expect(page.getByTestId("web-control-switch")).toHaveAttribute("data-on", "false");
    await page.keyboard.up("w");
  });

  test("box nhận diện trùng khung ở 2 cỡ cửa sổ (không gõ cứng cỡ khung)", async () => {
    const results: string[] = [];
    for (const vp of [
      { width: 1600, height: 1000 },
      { width: 1100, height: 900 },
    ]) {
      await page.setViewportSize(vp);
      await page.getByTestId("video-panel").scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      const det = obs.detection();
      expect(det, "backend không gửi detection — nguồn video giả có đang chạy?").not.toBeNull();
      const m = await page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>("[data-testid=detection-overlay]");
        const img = document.querySelector<HTMLImageElement>("[data-testid=video-img]");
        if (!c || !img) return null;
        const ctx = c.getContext("2d")!;
        const { width: w, height: h } = c;
        const px = ctx.getImageData(0, 0, w, h).data;
        const green = (x: number, y: number) => {
          const i = (y * w + x) * 4;
          return px[i + 1] > 170 && px[i] < 130 && px[i + 3] > 200;
        };
        // Cạnh box là đường liền dài; chữ nhãn thì thưa. Lấy hàng/cột có nhiều điểm xanh.
        const rows: number[] = [];
        for (let y = 0; y < h; y += 1) {
          let n = 0;
          for (let x = 0; x < w; x += 1) if (green(x, y)) n += 1;
          if (n > w * 0.1) rows.push(y);
        }
        const cols: number[] = [];
        for (let x = 0; x < w; x += 1) {
          let n = 0;
          for (let y = 0; y < h; y += 1) if (green(x, y)) n += 1;
          if (n > h * 0.12) cols.push(x);
        }
        const r = img.getBoundingClientRect();
        const cr = c.getBoundingClientRect();
        return {
          w, h,
          top: Math.min(...rows), bottom: Math.max(...rows), left: Math.min(...cols), right: Math.max(...cols),
          offset: [cr.left - r.left, cr.top - r.top, cr.width - r.width, cr.height - r.height],
        };
      });
      expect(m, "không thấy canvas/ảnh video").not.toBeNull();
      const { w, h, top, bottom, left, right, offset } = m!;
      // Canvas nằm ĐÚNG lên ảnh (lệch ≤ 1 px mỗi phía).
      for (const o of offset) expect(Math.abs(o)).toBeLessThanOrEqual(1);
      // Box giả: vuông cạnh 0.19 × rộng khung, chạy trong lề 1/16 khung (fake_stream.py).
      const relW = (right - left) / w;
      const relH = (bottom - top) / h;
      const expectH = (0.19 * det!.width) / det!.height;
      results.push(`${vp.width}×${vp.height}: canvas ${w}×${h}, box ${(relW * 100).toFixed(1)}% × ${(relH * 100).toFixed(1)}%`);
      expect(relW).toBeGreaterThan(0.17);
      expect(relW).toBeLessThan(0.21);
      expect(relH).toBeGreaterThan(expectH - 0.03);
      expect(relH).toBeLessThan(expectH + 0.03);
      expect(left / w).toBeGreaterThan(0.0625 - 0.02);
      expect(right / w).toBeLessThan(1 - 0.0625 + 0.02);
      expect(top / h).toBeGreaterThan(0.0625 - 0.02);
      expect(bottom / h).toBeLessThan(1 - 0.0625 + 0.02);
    }
    note("overlay", results.join(" | "));
    await page.setViewportSize({ width: 1600, height: 1000 });
  });

  test("#6 mission từ web: soạn → nạp → AUTO (có xác nhận) → RTL; AUTO có dòng 'KHÔNG tự tránh'", async () => {
    test.setTimeout(300_000);
    // Web GCS v2: soạn mission ở trang Nhiệm vụ. Đi bằng TAB (router phía trình
    // duyệt), không `page.goto`: tải lại trang là mở WebSocket mới.
    await page.getByTestId("nav-mission").click();
    await expect(page.getByTestId("mission-panel")).toBeVisible();
    // Soạn: bấm bản đồ quanh drone (zoom 17 ≈ 1 m/px — nằm gọn trong rào 50 m).
    const clear = page.getByRole("button", { name: "Xoá bản nháp" });
    if (await clear.isEnabled()) await clear.click();
    const map = page.locator(".leaflet-container");
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const [dx, dy] of [
      [25, -20],
      [30, 15],
      [-20, 20],
    ]) {
      await page.mouse.click(cx + dx, cy + dy);
    }
    await expect(page.getByTestId("mission-rows").locator("li")).not.toHaveCount(0);
    await page.getByTestId("mission-upload").click();
    await expect(page.getByTestId("mission-upload-status")).toHaveAttribute("data-state", "done", { timeout: 30_000 });

    // Bắt đầu mission là nút ở trang Bay (có hộp xác nhận).
    await page.getByTestId("nav-flight").click();

    // AUTO: bị khoá tới khi backend báo mission đã đọc lại; bấm thì phải hỏi.
    await expect(page.getByTestId("mode-AUTO")).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId("mode-AUTO").click();
    await expect(page.getByTestId("confirm-dialog")).toContainText("item");
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("mode-AUTO")).toHaveAttribute("data-active", "true", { timeout: 10_000 });
    await expect(page.getByTestId("no-avoid-warning")).toContainText("Chế độ này KHÔNG tự tránh vật cản.");

    // Bay đủ waypoint rồi RTL (lệnh cuối của mission) → hạ cánh → disarm.
    const seen = new Set<string>();
    await expect
      .poll(
        () => {
          const t = obs.telemetry();
          if (t?.mode) seen.add(t.mode);
          return t?.armed;
        },
        { timeout: 240_000, intervals: [500] },
      )
      .toBe(false);
    note("bai6_modes", [...seen].join(" → "));
    expect(seen.has("AUTO")).toBe(true);
  });
});
