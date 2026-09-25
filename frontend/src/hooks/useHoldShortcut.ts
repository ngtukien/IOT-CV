/**
 * Phím H = HOLD, trên MỌI trang (plan Phase 10 §10.3.3). Gắn một lần ở `App`:
 * người vận hành đang ở trang Nhật ký vẫn phải dừng được drone bằng một phím.
 *
 * Bỏ qua khi đang gõ vào ô nhập, khi giữ Ctrl/Alt/Meta, và khi phím đang lặp
 * (giữ H không được bắn 30 lệnh/giây).
 */
import { useEffect } from "react";

import { sendHold } from "@/hooks/flightCommands";

export const HOLD_KEY = "KeyH";

export function useHoldShortcut(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== HOLD_KEY || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      sendHold();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
