/**
 * Đọc `logs/deadman.jsonl` — sổ kiểm của vòng dead-man backend.
 *
 * ĐÂY LÀ HỢP ĐỒNG HAI CHIỀU với `backend/mavlink/deadman.py` (Phase 06 §6.4.4):
 * một dòng JSON cho MỖI lần phanh, `ts` là Unix epoch GIÂY (so được với
 * `Date.now() / 1000`), ghi đồng bộ + flush ngay. `reason` nằm trong
 * `ZERO_REASONS` của file đó. Đổi định dạng ở một bên mà không sửa bên kia thì
 * test dead-man hỏng theo kiểu "đỏ vì lý do sai" — tệ hơn là không có test.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface DeadmanLine {
  ts: number;
  mono: number;
  reason: "web_disconnected" | "deadman_timeout" | "mode_changed" | "link_lost" | "operator_disabled";
  vx: number;
  vy: number;
  vz: number;
  socket_id: string | null;
  repeat: number;
  sent: boolean;
  error?: string;
}

/** Cùng mặc định với `backend/config.py` (`DEADMAN_LOG_PATH`, tính từ gốc repo). */
export const DEADMAN_LOG_PATH = path.resolve(
  import.meta.dirname,
  "../../../..",
  process.env.DEADMAN_LOG_PATH ?? "logs/deadman.jsonl",
);

function lines(file = DEADMAN_LOG_PATH): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf-8").split("\n").filter((l) => l.trim() !== "");
}

export function countDeadmanLines(file = DEADMAN_LOG_PATH): number {
  return lines(file).length;
}

/** Các dòng thêm vào SAU mốc `before` (số dòng đã có). */
export function newDeadmanLines(before: number, file = DEADMAN_LOG_PATH): DeadmanLine[] {
  return lines(file)
    .slice(before)
    .map((l) => JSON.parse(l) as DeadmanLine);
}

/**
 * Chờ tới khi có dòng mới (poll mỗi `everyMs`), tối đa `timeoutMs`. Trả các
 * dòng mới, hoặc `[]` khi hết giờ — người gọi tự báo lỗi có nghĩa.
 */
export async function waitForDeadmanLines(before: number, timeoutMs = 3000, everyMs = 20): Promise<DeadmanLine[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const fresh = newDeadmanLines(before);
    if (fresh.length > 0 || Date.now() >= deadline) return fresh;
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
