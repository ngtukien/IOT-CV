/**
 * Nghiệm thu Phase 10 §10.8 bài #9 — panel vật cản nói ĐÚNG sự thật.
 *
 *   LOITER bay tới vật cản ảo: chip đổi OFF → NEAR → ACTIVE (FC phanh).
 *   GUIDED: KHÔNG bao giờ ACTIVE (OA_TYPE=0), và luôn có dòng "KHÔNG tự tránh".
 *
 * Cần phiên SITL riêng có TFmini Plus ảo + lưới cột (runner Phase 07), nên chỉ
 * chạy khi đặt `IOT_CV_AVOID=1`:
 *
 *   MAVLINK_ENDPOINT=tcp:127.0.0.1:5763 uv run uvicorn backend.app:app --port 8000
 *   IOT_CV_AVOID=1 pnpm exec playwright test tests/e2e/avoid.spec.ts      # chờ SITL
 *   wsl -d Ubuntu --exec bash -lc 'cd /mnt/d/Coding/IOT-CV && ~/venv-ardupilot/bin/python3 -u scripts/sitl/run_backend_avoid.py'
 *
 * Test chỉ NHÌN giao diện (chip `avoid-state`, dòng cảnh báo) — runner lái.
 */
import { expect, test } from "@playwright/test";

import { BASE_URL } from "./fixtures/gcs";

interface Sample {
  t: number;
  mode: string | null;
  state: string | null;
  warning: boolean;
}

test.describe("panel vật cản trên SITL có TFmini ảo @requires-sitl", () => {
  test.beforeAll(() => {
    test.skip(process.env.IOT_CV_AVOID !== "1", "Cần phiên SITL có TFmini ảo — đặt IOT_CV_AVOID=1 (xem đầu file)");
  });

  test("#9 LOITER: OFF → NEAR → ACTIVE; GUIDED: không ACTIVE, có dòng KHÔNG tự tránh", async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto(BASE_URL);
    const samples: Sample[] = [];
    const t0 = Date.now();
    let sawGuided = false;
    let guidedEndedAt: number | null = null;

    while (Date.now() - t0 < 400_000) {
      const s: Sample = await page.evaluate(() => {
        const active = document.querySelector("[data-testid=mode-panel] [data-active=true]");
        return {
          t: Date.now(),
          mode: active?.getAttribute("data-testid")?.replace("mode-", "") ?? null,
          state: document.querySelector("[data-testid=avoid-state]")?.getAttribute("data-state") ?? null,
          warning: document.querySelector("[data-testid=no-avoid-warning]") !== null,
        };
      });
      samples.push(s);
      if (s.mode === "GUIDED" && samples.some((x) => x.mode === "LOITER")) sawGuided = true;
      if (sawGuided && s.mode !== "GUIDED" && guidedEndedAt === null) guidedEndedAt = s.t;
      if (guidedEndedAt !== null && s.t - guidedEndedAt > 3000) break;
      await page.waitForTimeout(250);
    }

    // Dòng thời gian gọn: chỉ in lúc có gì đổi.
    let prev = "";
    for (const s of samples) {
      const key = `${s.mode} ${s.state} ${s.warning ? "warn" : "-"}`;
      if (key !== prev) console.log(`  +${((s.t - t0) / 1000).toFixed(1)}s ${key}`);
      prev = key;
    }

    const loiter = samples.filter((s) => s.mode === "LOITER").map((s) => s.state);
    const firstIdx = (st: string) => loiter.indexOf(st);
    expect(firstIdx("OFF"), "LOITER chưa từng OFF").toBeGreaterThanOrEqual(0);
    expect(firstIdx("NEAR"), "LOITER chưa từng NEAR").toBeGreaterThan(firstIdx("OFF"));
    expect(firstIdx("ACTIVE"), "LOITER chưa từng ACTIVE — FC không phanh?").toBeGreaterThan(firstIdx("NEAR"));
    expect(samples.filter((s) => s.mode === "LOITER").every((s) => !s.warning), "LOITER không được hiện dòng 'không tự tránh'").toBe(true);

    const guided = samples.filter((s) => s.mode === "GUIDED" && sawGuided);
    expect(guided.length, "chưa quan sát được chặng GUIDED").toBeGreaterThan(0);
    expect(guided.every((s) => s.state !== "ACTIVE"), "GUIDED không được báo ACTIVE (OA_TYPE=0)").toBe(true);
    expect(guided.every((s) => s.warning), "GUIDED phải luôn có dòng 'KHÔNG tự tránh'").toBe(true);
  });
});
