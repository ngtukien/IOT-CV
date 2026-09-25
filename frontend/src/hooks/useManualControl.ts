/**
 * Nối bộ điều khiển tay (`lib/manualControl.ts`) vào trình duyệt. Gọi MỘT lần, ở `App`.
 *
 * Ba nguồn sự kiện, đều chỉ đổi TRẠNG THÁI — chỉ `setInterval` bên trong bộ
 * điều khiển mới gửi `cmd.velocity`:
 *
 *  - `keydown` / `keyup` trên `window`;
 *  - `blur` + `visibilitychange` — BẪY ALT-TAB (§10.1.3): cửa sổ mất tiêu điểm
 *    thì sự kiện `keyup` KHÔNG BAO GIỜ tới. Không bắt hai sự kiện này thì trình
 *    duyệt tưởng bạn vẫn đang giữ W, và drone cứ thế bay;
 *  - tay cầm game qua `useGamepad` (tuỳ chọn, §10.2).
 */
import { useEffect } from "react";

import { useGamepad } from "@/hooks/useGamepad";
import { createManualController } from "@/lib/manualControl";
import type { ManualController } from "@/lib/manualControl";
import { MANUAL_KEYS, STOP_KEY } from "@/lib/velocityMapping";
import { sendUplink } from "@/lib/uplink";
import { useControlStore } from "@/store/control";
import { useTelemetryStore } from "@/store/telemetry";

/** Web có đang được lái từ CHÍNH tab này không — backend xác nhận, không đoán. */
export function selectMayFly(): boolean {
  const t = useTelemetryStore.getState();
  return (
    t.connection === "open" &&
    t.status?.safety.web_control_enabled === true &&
    t.telemetry?.mode === "GUIDED" &&
    useControlStore.getState().claimed
  );
}

/**
 * Phím gõ vào ô nhập (độ cao mission, chữ "ARM" trong hộp xác nhận) không phải
 * lệnh lái. Ctrl/Alt/Meta cũng không: Ctrl+W là đóng tab, Ctrl+R là tải lại.
 *
 * Thanh trượt Radix là `<span role="slider">`, không phải `<input>` — mũi tên
 * trên nó là chỉnh độ cao, không phải bay. Và khi một hộp xác nhận đang mở,
 * người dùng đang đọc hộp đó: phím không được làm máy bay đi (Space vẫn dừng —
 * nó đi đường `STOP_KEY`, không bị chặn ở đây vì dừng thì không bao giờ sai).
 */
const NON_FLIGHT_ROLES = "[role=slider],[role=spinbutton],[role=textbox],[role=combobox],[role=alertdialog]";

function isTypingOrShortcut(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  const el = e.target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return true;
  return e.code !== STOP_KEY && el.closest(NON_FLIGHT_ROLES) !== null;
}

let active: ManualController | null = null;

/** Cho nút DỪNG trên màn hình dùng chung đường với phím Space. */
export function stopManualNow(): void {
  active?.keyDown("Space");
}

export function useManualControl(): void {
  useEffect(() => {
    const ctl = createManualController({
      send: (v) => sendUplink("cmd.velocity", v) !== null,
      isEnabled: selectMayFly,
      getMaxVelocity: () => useTelemetryStore.getState().status?.limits.max_velocity ?? null,
      onChange: (snap) => useControlStore.getState().setManual(snap),
    });
    active = ctl;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!MANUAL_KEYS.has(e.code) || isTypingOrShortcut(e)) return;
      if (ctl.keyDown(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => ctl.keyUp(e.code);
    const onBlur = () => ctl.releaseAll();
    const onVisibility = () => {
      if (document.visibilityState !== "visible") ctl.releaseAll();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    ctl.start();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      ctl.dispose();
      if (active === ctl) active = null;
    };
  }, []);

  useGamepad((axes) => active?.setGamepad(axes));
}
