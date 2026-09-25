/**
 * TEST QUAN TRỌNG NHẤT của luồng phần mềm (plan Phase 10 §10.6).
 *
 * Pytest Phase 06 chứng minh LOGIC dead-man đúng; script SITL chứng minh BACKEND
 * đúng; test này chứng minh CẢ CHUỖI trình duyệt → backend → FC: giữ W thì bay,
 * đóng tab giữa lúc đang giữ W (không keyup, không lệnh dừng) thì drone dừng.
 * Đó là test thứ 3 của SAFETY.md mục 5.
 *
 * ── Vì sao ngưỡng ở đây là 300 ms, trong khi Phase 06 ghi 350 ms ─────────────
 * Không mâu thuẫn — đó là HAI ĐƯỜNG khác nhau (Phase 06 §6.4.3):
 *   - Đóng tab → socket đóng → `on_web_disconnected()` gửi zero NGAY (< 50 ms),
 *     KHÔNG chờ hết hạn. Đây là đường test này đo.
 *   - Trình duyệt treo mà socket vẫn mở → hết hạn 300 ms + một nhịp 50 ms
 *     = ≤ 350 ms. Playwright KHÔNG tạo ra được ca này: `page.close()` đóng
 *     socket sạch sẽ.
 *
 * ── Vì sao đo bằng file log, không bằng giao diện ───────────────────────────
 * Sau `page.close()` không còn gì để nhìn. Bằng chứng duy nhất là thứ backend
 * ghi lại: `logs/deadman.jsonl` (hợp đồng Phase 06 §6.4.4, xem fixtures).
 *
 * Chạy: SITL + backend (`uv run uvicorn backend.app:app --port 8000`) +
 * `pnpm build`, rồi `pnpm exec playwright test tests/e2e/deadman.spec.ts`.
 * KHÔNG chạy trên CI (cần SITL) — tag `@requires-sitl`.
 */
import { expect, test } from "@playwright/test";

import { countDeadmanLines, waitForDeadmanLines } from "./fixtures/readDeadmanLog";
import { enableWebControl, ensureAirborne, ensureArmed, ensureGuided, openGcs, readTape, skipUnlessConnected } from "./fixtures/gcs";

/** Yêu cầu của SAFETY.md §5 trên đường đóng-tab. */
const MAX_CLOSE_TO_ZERO_MS = 300;
/** Giữ W bao lâu trước khi khẳng định drone đang đi. */
const HOLD_W_MS = 2000;

test.describe("dead-man qua trình duyệt @requires-sitl", () => {
  test.beforeAll(async () => {
    await skipUnlessConnected((condition, reason) => test.skip(condition, reason));
  });

  test("đóng tab giữa lúc giữ W → backend gửi zero trong < 300 ms, drone dừng", async ({ browser }) => {
    test.setTimeout(240_000); // gồm cả lúc chờ SITL vừa bật có vị trí
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1–4. Mở trang, GUIDED, ARM (gõ "ARM"), TAKEOFF 5 m, chờ > 4 m.
    await openGcs(page);
    await ensureGuided(page);
    await ensureArmed(page);
    await ensureAirborne(page, 4.0);

    // Bật WEB CONTROL: thiếu bước này thì W không làm gì (SAFETY.md mục 4).
    await enableWebControl(page);

    // 5. Mốc sổ kiểm trước khi làm gì.
    const lineCountBefore = countDeadmanLines();

    // 6–7. Giữ W; sau 2 s drone phải đang đi > 0.5 m/s — chứng minh W thật sự làm nó bay.
    await page.keyboard.down("w");
    await page.waitForTimeout(HOLD_W_MS);
    const speedWhileHeld = await readTape(page, "pfd-speed");
    expect(speedWhileHeld, "giữ W 2 s mà drone không đi — xem mục 'Nếu lỗi' ở plan §10.6.7").toBeGreaterThan(0.5);

    // 8–9. Đóng tab. KHÔNG keyup, KHÔNG gửi lệnh dừng.
    const closeTs = Date.now();
    await page.close();

    // 10. Chờ backend ghi dòng mới (poll 20 ms, tối đa 3 s).
    const fresh = await waitForDeadmanLines(lineCountBefore, 3000, 20);
    expect(
      fresh.length,
      "backend KHÔNG ghi dòng dead-man nào sau khi đóng tab — lỗi an toàn nghiêm trọng (Phase 06 §6.4.3), đừng nới ngưỡng test",
    ).toBeGreaterThan(0);

    // 11. Dòng đầu tiên sau lúc đóng phải là web_disconnected, vận tốc 0, và kịp giờ.
    const line = fresh.find((l) => l.reason === "web_disconnected") ?? fresh[0];
    expect(line.reason).toBe("web_disconnected");
    expect([line.vx, line.vy, line.vz]).toEqual([0, 0, 0]);
    expect(line.sent, `backend ghi nhận nhưng KHÔNG gửi được gói zero: ${line.error ?? ""}`).toBe(true);
    const latencyMs = line.ts * 1000 - closeTs;
    console.log(`zero-velocity sau ${latencyMs.toFixed(0)} ms (reason=${line.reason}, repeat=${line.repeat})`);
    test.info().annotations.push({ type: "latency_ms", description: latencyMs.toFixed(1) });
    expect(latencyMs, "on_web_disconnected() đang chờ hết hạn thay vì gửi ngay — lỗi backend").toBeLessThan(MAX_CLOSE_TO_ZERO_MS);

    // 12. Mở trang mới: drone phải đứng lại. Thời gian tính CẢ lúc tải trang
    // và chờ telemetry đầu tiên (~1 s), nên cho 5 s thay vì 3 s của bài
    // nghiệm thu #3 (bài đó đo từ lúc thả phím, trang vẫn mở).
    const check = await context.newPage();
    await openGcs(check);
    await expect.poll(() => readTape(check, "pfd-speed"), { timeout: 5000, message: "drone chưa dừng" }).toBeLessThan(0.2);

    // Dọn: quyền lái đã bị backend thu. Hạ cánh để lần chạy sau bắt đầu sạch.
    await expect(check.getByTestId("web-control-switch")).toHaveAttribute("data-on", "false");
    await check.getByTestId("cmd-land").click();
    await context.close();
  });
});
