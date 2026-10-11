/**
 * Nối `lib/announcer.ts` vào store. Gọi MỘT lần, ở `App`.
 *
 * Không subscribe bằng React (không render gì): đăng ký thẳng vào zustand, so
 * trạng thái rút gọn với lần trước, và chỉ phát khi có thay đổi. Cùng một khoá
 * (`key`) không phát lại trong `REPEAT_GUARD_MS` — mode nhảy qua lại hay link
 * chập chờn không được thành một tràng bíp.
 */
import { useEffect } from "react";

import { beep, diffAnnouncements, speak, unlockAudio } from "@/lib/announcer";
import type { AnnounceState } from "@/lib/announcer";
import { useSettings } from "@/store/settings";
import { useTelemetryStore } from "@/store/telemetry";

export const REPEAT_GUARD_MS = 4000;

function snapshot(): AnnounceState {
  const s = useTelemetryStore.getState();
  const t = s.telemetry;
  return {
    socketOpen: s.connection === "open",
    linkAlive: t ? t.connected === true : null,
    mode: t?.mode ?? null,
    armed: t?.armed ?? null,
    battery: typeof t?.battery_remaining === "number" ? t.battery_remaining : null,
    avoid: t?.avoid_state ?? null,
    webControl: s.status?.safety.web_control_enabled ?? null,
  };
}

export function useAnnouncer(): void {
  useEffect(() => {
    const onFirstInput = () => unlockAudio();
    window.addEventListener("pointerdown", onFirstInput);
    window.addEventListener("keydown", onFirstInput);

    let prev: AnnounceState | null = null;
    const lastAt = new Map<string, number>();

    const unsubscribe = useTelemetryStore.subscribe(() => {
      const next = snapshot();
      const items = diffAnnouncements(prev, next);
      prev = next;
      if (items.length === 0) return;
      const { audioAlerts, voice, volume } = useSettings.getState();
      const now = Date.now();
      for (const a of items) {
        if (now - (lastAt.get(a.key) ?? 0) < REPEAT_GUARD_MS) continue;
        lastAt.set(a.key, now);
        if (audioAlerts) beep(a.level, volume);
        if (voice) speak(a.text, volume);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", onFirstInput);
      window.removeEventListener("keydown", onFirstInput);
    };
  }, []);
}
