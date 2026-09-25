/**
 * Áp cài đặt giao diện lên `<html>`: lớp `dark` (theme Đêm) và `data-motion`
 * (tắt chuyển động). Theme "system" bám theo hệ điều hành, kể cả khi đổi giữa
 * chừng (máy tự chuyển sáng/tối theo giờ).
 */
import { useEffect, useState } from "react";

import { resolveTheme, useSettings } from "@/store/settings";

function prefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useResolvedTheme(): "night" | "day" {
  const theme = useSettings((s) => s.theme);
  const [systemDark, setSystemDark] = useState(prefersDark);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return resolveTheme(theme, systemDark);
}

export function useApplySettings(): void {
  const resolved = useResolvedTheme();
  const motion = useSettings((s) => s.motion);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "night");
    root.dataset.theme = resolved;
  }, [resolved]);

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);
}

/** Người dùng muốn giảm chuyển động (hệ điều hành) HOẶC đã tắt trong Cài đặt. */
export function useReducedMotion(): boolean {
  const motion = useSettings((s) => s.motion);
  const [osReduced, setOsReduced] = useState(
    () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setOsReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return motion === "off" || osReduced;
}
