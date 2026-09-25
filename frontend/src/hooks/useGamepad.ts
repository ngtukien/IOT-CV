/**
 * Tay cầm game qua Gamepad API của trình duyệt (plan Phase 10 §10.2) — TUỲ CHỌN,
 * không thêm thư viện.
 *
 * - Trình duyệt chỉ "thấy" tay cầm sau khi cắm vào VÀ bấm một nút bất kỳ. Đó là
 *   quy định bảo mật (chống dò thiết bị), không phải lỗi.
 * - Đọc trục trong `requestAnimationFrame`, nhưng KHÔNG gửi gì ở đây: trục chỉ
 *   được đưa vào bộ điều khiển tay, và vẫn là CÙNG MỘT `setInterval` 10 Hz gửi
 *   lệnh. Hai vòng gửi song song là hai người giành một vô-lăng.
 * - Vùng chết 0.15 áp ở `axesFromGamepad` — cần analog rẻ luôn trôi quanh 0.
 * - Vòng rAF chỉ chạy khi có tay cầm; rút ra thì dừng và báo `null`.
 */
import { useEffect, useRef } from "react";

import type { Axes } from "@/lib/velocityMapping";
import { axesFromGamepad } from "@/lib/velocityMapping";

function firstPad(): Gamepad | null {
  const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}

export function useGamepad(onAxes: (axes: Required<Axes> | null) => void): void {
  const callback = useRef(onAxes);
  useEffect(() => {
    callback.current = onAxes;
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    let frame = 0;

    const loop = () => {
      const pad = firstPad();
      if (!pad) {
        frame = 0;
        callback.current(null);
        return;
      }
      callback.current(axesFromGamepad(pad.axes));
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (frame === 0) frame = requestAnimationFrame(loop);
    };
    const onDisconnected = () => {
      if (!firstPad()) callback.current(null);
    };

    window.addEventListener("gamepadconnected", start);
    window.addEventListener("gamepaddisconnected", onDisconnected);
    if (firstPad()) start();

    return () => {
      window.removeEventListener("gamepadconnected", start);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
      cancelAnimationFrame(frame);
      callback.current(null);
    };
  }, []);
}
