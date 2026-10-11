/**
 * Bảng lớp màu theo NGỮ NGHĨA — dùng chung mọi component mới, để "vàng" ở trang
 * này và "vàng" ở trang kia là một thứ. `neutral` = chưa biết / không có gì để nói.
 */
import type { Tone } from "./format";

export type { Tone };

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-hud-green",
  warn: "text-hud-amber",
  danger: "text-hud-red",
};

export const TONE_CHIP: Record<Tone, string> = {
  neutral: "border-border bg-foreground/[0.04] text-muted-foreground",
  ok: "border-hud-green/40 bg-hud-green/12 text-hud-green",
  warn: "border-hud-amber/45 bg-hud-amber/12 text-hud-amber",
  danger: "border-hud-red/50 bg-hud-red/14 text-hud-red",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  ok: "bg-hud-green",
  warn: "bg-hud-amber",
  danger: "bg-hud-red",
};

export const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  ok: "bg-hud-green",
  warn: "bg-hud-amber",
  danger: "bg-hud-red",
};

/** Màu CSS thật (cho SVG/canvas) — đọc token, nên đổi theo theme. */
export const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--muted-foreground)",
  ok: "var(--hud-green)",
  warn: "var(--hud-amber)",
  danger: "var(--hud-red)",
};
