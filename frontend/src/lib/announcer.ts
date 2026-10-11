/**
 * Cảnh báo bằng ÂM THANH — người vận hành đang nhìn drone ngoài trời, không nhìn
 * màn hình. Hai lớp, bật/tắt riêng trong Cài đặt:
 *
 *   - tiếng bíp (WebAudio, không cần file âm thanh): kiểu bíp theo mức độ;
 *   - giọng đọc (SpeechSynthesis của trình duyệt): ưu tiên giọng tiếng Việt nếu
 *     máy có, không có thì dùng giọng mặc định — vẫn hơn im lặng.
 *
 * `diffAnnouncements` là hàm THUẦN: so hai trạng thái, trả danh sách điều cần
 * báo. Mọi quyết định "báo gì" nằm ở đây để test được không cần loa.
 *
 * Trình duyệt chặn âm thanh cho tới khi trang nhận một cú bấm của người dùng —
 * `unlockAudio()` gắn vào cú bấm đầu tiên.
 */
import { DISPLAY_THRESHOLDS } from "./format";

export type AnnounceLevel = "info" | "caution" | "warning";

export interface Announcement {
  level: AnnounceLevel;
  /** Câu đọc to — ngắn, tiếng Việt, không viết tắt khó đọc. */
  text: string;
  key: string;
}

export interface AnnounceState {
  socketOpen: boolean;
  linkAlive: boolean | null;
  mode: string | null;
  armed: boolean | null;
  battery: number | null;
  avoid: string | null;
  webControl: boolean | null;
}

const MODE_SPOKEN: Record<string, string> = {
  GUIDED: "Guided",
  LOITER: "Loiter",
  ALT_HOLD: "Alt hold",
  POSHOLD: "Pos hold",
  BRAKE: "Phanh",
  RTL: "Về nhà",
  LAND: "Hạ cánh",
  AUTO: "Tự động",
  STABILIZE: "Stabilize",
};

/**
 * Điều cần báo khi đi từ `prev` sang `next`. `prev === null` (lần đầu) thì không
 * báo gì — mở trang không phải là một sự kiện.
 */
export function diffAnnouncements(prev: AnnounceState | null, next: AnnounceState): Announcement[] {
  if (!prev) return [];
  const out: Announcement[] = [];

  if (prev.socketOpen && !next.socketOpen) out.push({ level: "warning", text: "Mất kết nối backend", key: "ws-lost" });
  if (!prev.socketOpen && next.socketOpen) out.push({ level: "info", text: "Đã nối lại backend", key: "ws-back" });

  if (next.socketOpen) {
    if (prev.linkAlive === true && next.linkAlive === false)
      out.push({ level: "warning", text: "Mất liên lạc với drone", key: "link-lost" });
    if (prev.linkAlive === false && next.linkAlive === true)
      out.push({ level: "info", text: "Đã liên lạc lại với drone", key: "link-back" });
  }

  if (prev.armed === false && next.armed === true) out.push({ level: "caution", text: "Đã arm. Motor có thể quay", key: "armed" });
  if (prev.armed === true && next.armed === false) out.push({ level: "info", text: "Đã disarm", key: "disarmed" });

  if (next.mode && prev.mode && next.mode !== prev.mode) {
    out.push({ level: "info", text: `Chế độ ${MODE_SPOKEN[next.mode] ?? next.mode}`, key: `mode-${next.mode}` });
  }

  const low = DISPLAY_THRESHOLDS.batteryLowPercent;
  if (prev.battery !== null && next.battery !== null && prev.battery >= low && next.battery < low) {
    out.push({ level: "warning", text: `Pin yếu, còn ${Math.round(next.battery)} phần trăm`, key: "battery-low" });
  }

  if (prev.avoid !== "ACTIVE" && next.avoid === "ACTIVE")
    out.push({ level: "warning", text: "Đang phanh trước vật cản", key: "avoid-active" });

  if (prev.webControl !== true && next.webControl === true)
    out.push({ level: "caution", text: "Web đang giữ quyền lái", key: "web-on" });
  if (prev.webControl === true && next.webControl === false)
    out.push({ level: "info", text: "Web đã trả quyền lái", key: "web-off" });

  return out;
}

// ---------------------------------------------------------------------------
// Phát âm thanh
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  ctx ??= new window.AudioContext();
  return ctx;
}

/** Gọi trong một cú bấm của người dùng: trình duyệt mới cho phát âm thanh. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === "suspended") void c.resume();
}

/** Mẫu bíp: [tần số Hz, thời lượng s, nghỉ sau s]. */
const PATTERN: Record<AnnounceLevel, [number, number, number][]> = {
  info: [[880, 0.09, 0]],
  caution: [
    [660, 0.12, 0.08],
    [660, 0.12, 0],
  ],
  warning: [
    [990, 0.12, 0.06],
    [990, 0.12, 0.06],
    [990, 0.18, 0],
  ],
};

export function beep(level: AnnounceLevel, volume: number): void {
  const c = audio();
  if (!c || c.state !== "running" || volume <= 0) return;
  let t = c.currentTime + 0.01;
  for (const [freq, dur, gap] of PATTERN[level]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = level === "warning" ? "square" : "sine";
    osc.frequency.value = freq;
    // Bao hình mềm để không có tiếng "tách" ở đầu/cuối.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18 * volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur + gap;
  }
}

function vietnameseVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith("vi")) ?? null;
}

export function speak(text: string, volume: number): void {
  if (typeof speechSynthesis === "undefined" || volume <= 0) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = vietnameseVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = "vi-VN";
  }
  u.volume = Math.min(1, volume);
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

export function hasVietnameseVoice(): boolean {
  return vietnameseVoice() !== null;
}
