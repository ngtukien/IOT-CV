/**
 * Chụp ảnh MỌI trang của web GCS ở cả hai theme — để duyệt giao diện bằng mắt
 * sau mỗi lần sửa lớn, hoặc lấy ảnh cho báo cáo.
 *
 *   pnpm build && (chạy backend ở 8000)
 *   node scripts/screenshots.ts                  # mặc định http://127.0.0.1:8000
 *   GCS_BASE_URL=http://127.0.0.1:5173 node scripts/screenshots.ts
 *
 * Ảnh ra `frontend/screenshots/<theme>-<trang>.png` (thư mục đã gitignore).
 * Chỉ NHÌN: script không bấm nút lệnh nào, không bật WEB CONTROL.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE = process.env.GCS_BASE_URL ?? "http://127.0.0.1:8000";
const OUT = path.resolve(import.meta.dirname, "..", "screenshots");
const WIDTH = Number(process.env.SHOT_WIDTH ?? 1600);
const HEIGHT = Number(process.env.SHOT_HEIGHT ?? 1000);

const PAGES = [
  ["flight", "/"],
  ["mission", "/mission"],
  ["3d", "/3d"],
  ["vision", "/vision"],
  ["overview", "/overview"],
  ["telemetry", "/telemetry"],
  ["logs", "/logs"],
  ["preflight", "/preflight"],
  ["system", "/system"],
  ["settings", "/settings"],
] as const;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=default", "--enable-gpu"] });
try {
  for (const theme of (process.env.SHOT_THEMES ?? "night,day").split(",")) {
    const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    // Theme đặt qua đúng khoá localStorage của trang (store/settings.ts).
    await ctx.addInitScript((t) => {
      localStorage.setItem("iot-cv.settings.v1", JSON.stringify({ state: { theme: t }, version: 0 }));
    }, theme);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [name, url] of PAGES) {
      await page.goto(BASE + url);
      await page.waitForTimeout(name === "3d" || name === "overview" ? 6000 : 2500);
      const file = path.join(OUT, `${theme}-${name}.png`);
      await page.screenshot({ path: file, fullPage: name !== "3d" && name !== "flight" });
      console.log(`đã chụp ${file}`);
    }
    if (errors.length) console.log(`LỖI TRANG (${theme}):\n  ${errors.join("\n  ")}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
