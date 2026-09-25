/**
 * Thao tác trên trang GCS dùng chung cho các spec E2E. Đọc số từ chính giao diện
 * (băng PFD, nút mode) — test đi đúng đường người dùng đi, không lách qua REST.
 */
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const BASE_URL = process.env.GCS_BASE_URL ?? "http://127.0.0.1:8000";

interface StatusLite {
  connected?: boolean;
  safety?: { web_control_enabled?: boolean };
}

/**
 * Tiền đề: backend chạy và đã nối SITL. Thiếu thì `skip` KÈM LÝ DO (§10.6.2) —
 * đỏ vì SITL chưa bật làm người ta mất niềm tin vào test.
 */
export async function skipUnlessConnected(skip: (condition: boolean, reason: string) => void): Promise<StatusLite> {
  let s: StatusLite = {};
  try {
    s = (await (await fetch(`${BASE_URL}/api/status`)).json()) as StatusLite;
  } catch (err) {
    skip(true, `Không gọi được ${BASE_URL}/api/status (${(err as Error).message}) — bật backend: uv run uvicorn backend.app:app --port 8000`);
  }
  skip(!s.connected, "Cần SITL đang chạy và backend đã nối — xem Phase 02 / skill iot-cv-sitl-nghiem-thu");
  skip(
    s.safety?.web_control_enabled === true,
    "Một tab khác đang giữ WEB CONTROL — đóng tab đó (backend sẽ tự thu quyền) rồi chạy lại",
  );
  return s;
}

/** Số trên băng PFD (`pfd-alt`, `pfd-speed`); `null` khi đang hiện —. */
export async function readTape(page: Page, testId: "pfd-alt" | "pfd-speed"): Promise<number | null> {
  const text = await page.getByTestId(testId).getAttribute("data-value");
  const n = Number(text);
  return text && Number.isFinite(n) ? n : null;
}

export async function openGcs(page: Page): Promise<void> {
  await page.goto("/");
  // Chờ telemetry: ô độ cao hết "—".
  await expect.poll(() => readTape(page, "pfd-alt"), { timeout: 15_000, message: "chưa có telemetry" }).not.toBeNull();
}

export async function currentModeIs(page: Page, mode: string): Promise<boolean> {
  return (await page.getByTestId(`mode-${mode}`).getAttribute("data-active")) === "true";
}

export async function ensureGuided(page: Page): Promise<void> {
  if (await currentModeIs(page, "GUIDED")) return;
  await page.getByTestId("mode-GUIDED").click();
  await expect(page.getByTestId("mode-GUIDED")).toHaveAttribute("data-active", "true", { timeout: 10_000 });
}

export async function isArmed(page: Page): Promise<boolean> {
  return (await page.getByTestId("cmd-disarm").count()) > 0;
}

/**
 * SITL vừa bật cần ~30–60 s để EKF có vị trí; ARM sớm hơn thì FC từ chối
 * (`PreArm: Need Position Estimate`) — môi trường chưa sẵn, không phải lỗi web.
 * Chờ ô GPS và EKF trên HUD xanh, rồi thử ARM tối đa 3 lần.
 */
export async function ensureArmed(page: Page): Promise<void> {
  if (await isArmed(page)) return;
  for (const stat of ["stat-GPS", "stat-EKF"]) {
    await expect(page.getByTestId(stat), `${stat} chưa xanh — SITL chưa sẵn sàng`).toHaveAttribute("data-tone", "ok", {
      timeout: 120_000,
    });
  }
  for (let attempt = 1; ; attempt += 1) {
    await page.getByTestId("cmd-arm").click();
    await page.getByTestId("confirm-word").fill("ARM");
    await page.getByTestId("confirm-ok").click();
    try {
      await expect(page.getByTestId("cmd-disarm")).toBeVisible({ timeout: 15_000 });
      return;
    } catch (err) {
      if (attempt >= 3) throw err;
      await page.waitForTimeout(5000);
    }
  }
}

/** Cất cánh nếu đang dưới `minAlt`; chờ tới khi vượt `minAlt`. */
export async function ensureAirborne(page: Page, minAlt = 4.0): Promise<void> {
  if (((await readTape(page, "pfd-alt")) ?? 0) > minAlt) return;
  await page.getByTestId("cmd-takeoff").click();
  await page.getByTestId("confirm-ok").click();
  await expect.poll(() => readTape(page, "pfd-alt"), { timeout: 30_000, message: "không lên tới độ cao" }).toBeGreaterThan(minAlt);
}

export async function enableWebControl(page: Page): Promise<void> {
  const sw = page.getByTestId("web-control-switch");
  if ((await sw.getAttribute("data-on")) === "true") return;
  await sw.click();
  await expect(sw).toHaveAttribute("data-on", "true", { timeout: 10_000 });
  await expect(page.getByTestId("safety-banner")).toBeVisible();
}
