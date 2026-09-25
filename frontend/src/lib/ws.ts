/**
 * Client WebSocket của GCS — thứ DUY NHẤT trong frontend được mở socket.
 *
 * Ba việc ngoài "mở socket":
 *  - Nối lại có backoff luỹ thừa 1 → 2 → 4 → 8 s, trần 10 s, cộng nhiễu 0–500 ms
 *    (nhiều tab mở cùng lúc thì không cùng đập vào backend một lúc).
 *  - Nhịp tim: 2 s gửi `ping` một lần; 5 s không nhận được GÌ (telemetry, pong,
 *    kể cả rác) thì coi socket đã chết. `readyState === OPEN` không chứng minh
 *    đường dây còn sống — Wi-Fi rớt, máy ngủ dậy, socket vẫn "mở" trên giấy tờ.
 *  - Bọc phong bì cho lệnh gửi lên. Component không bao giờ tự dựng JSON thô.
 *
 * Socket được tạo TRỄ một nhịp (`setTimeout 0`), không tạo ngay trong
 * `createGcsSocket`. Lý do: React 19 `StrictMode` ở chế độ dev chạy effect →
 * cleanup → effect liền nhau trong cùng một lượt. Tạo ngay thì lượt đầu đã mở
 * một kết nối thật rồi mới đóng; tạo trễ thì `close()` của lượt đầu huỷ hẹn giờ
 * trước khi có kết nối nào. DevTools → Network → WS chỉ thấy đúng một dòng.
 */
import { CONTRACT_VERSION, parseServerMessage } from "./protocol";
import type { EventPayload, ServerEnvelope, UplinkPayloads, UplinkType } from "./protocol";

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 10_000;
export const BACKOFF_JITTER_MS = 500;
export const PING_INTERVAL_MS = 2000;
export const SILENCE_TIMEOUT_MS = 5000;

const WS_OPEN = 1;

export type SocketState = "connecting" | "open" | "closed" | "error";

export interface StateInfo {
  /** Khi nào thử nối lại (ms). Chỉ có ở `closed`. */
  nextRetryAt: number | null;
  /** `true` khi `open` là lần nối LẠI, không phải lần đầu. */
  reconnected: boolean;
}

/** Sự kiện nội bộ của client (không phải `event` của backend) — để ghi nhật ký. */
export interface SocketNotice {
  level: NonNullable<EventPayload["level"]>;
  code: string;
  message: string;
  detail?: Record<string, unknown>;
}

/** Tối thiểu mà client cần ở `WebSocket` — đủ để test thay bằng bản giả. */
export interface WebSocketLike {
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface GcsSocketOptions {
  url: string;
  onMessage(msg: ServerEnvelope): void;
  onState(state: SocketState, info: StateInfo): void;
  onNotice?(notice: SocketNotice): void;
  /** Mọi frame nhận được, kể cả hỏng — dấu hiệu đường dây còn sống. `size` = số ký tự. */
  onFrame?(at: number, size: number): void;
  createSocket?: (url: string) => WebSocketLike;
  random?: () => number;
  now?: () => number;
}

export interface GcsSocket {
  /** Trả `id` đã gửi (`c-1`, `c-2`…), hoặc `null` nếu socket chưa mở — lệnh KHÔNG đi. */
  send<T extends UplinkType>(type: T, data: UplinkPayloads[T]): string | null;
  close(): void;
}

/** Độ trễ trước lần thử thứ `attempt` (0 = sau lần hỏng đầu tiên). */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
  return base + Math.floor(random() * BACKOFF_JITTER_MS);
}

/** URL `/ws` dựng từ vị trí trang: dev (5173, qua proxy) và bản build (8000) như nhau. */
export function wsUrlFromLocation(loc: Pick<Location, "protocol" | "host">): string {
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/ws`;
}

export function createGcsSocket(opts: GcsSocketOptions): GcsSocket {
  const createSocket = opts.createSocket ?? ((url: string) => new WebSocket(url) as unknown as WebSocketLike);
  const random = opts.random ?? Math.random;
  const now = opts.now ?? Date.now;

  let ws: WebSocketLike | null = null;
  let closedByUser = false;
  let everOpened = false;
  let attempt = 0;
  let seq = 0;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(connect, 0);

  function stopTimers(): void {
    clearInterval(pingTimer);
    clearTimeout(silenceTimer);
    clearTimeout(retryTimer);
    pingTimer = silenceTimer = retryTimer = undefined;
  }

  /** Bỏ socket hiện tại mà KHÔNG chờ nó tự báo `close`: socket chết thật có thể không bao giờ báo. */
  function drop(): void {
    stopTimers();
    const old = ws;
    ws = null;
    if (!old) return;
    old.onopen = old.onmessage = old.onerror = old.onclose = null;
    try {
      old.close();
    } catch {
      // Đóng một socket đang CONNECTING có thể ném ở vài trình duyệt; ta đã
      // tháo hết handler nên nó không còn tác dụng gì nữa.
    }
  }

  function scheduleReconnect(): void {
    if (closedByUser) return;
    const delay = backoffDelay(attempt, random);
    attempt += 1;
    opts.onState("closed", { nextRetryAt: now() + delay, reconnected: false });
    retryTimer = setTimeout(connect, delay);
  }

  function armSilenceWatch(): void {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      opts.onNotice?.({
        level: "warn",
        code: "ws.silent",
        message: `${SILENCE_TIMEOUT_MS / 1000} s không nhận được gì từ backend — coi như đường dây chết, nối lại`,
      });
      drop();
      scheduleReconnect();
    }, SILENCE_TIMEOUT_MS);
  }

  function connect(): void {
    retryTimer = undefined;
    if (closedByUser) return;
    opts.onState("connecting", { nextRetryAt: null, reconnected: false });

    const sock = createSocket(opts.url);
    ws = sock;

    sock.onopen = () => {
      const reconnected = everOpened;
      everOpened = true;
      attempt = 0;
      opts.onState("open", { nextRetryAt: null, reconnected });
      armSilenceWatch();
      pingTimer = setInterval(() => send("ping", {}), PING_INTERVAL_MS);
    };

    sock.onmessage = (ev) => {
      armSilenceWatch();
      opts.onFrame?.(now(), typeof ev.data === "string" ? ev.data.length : 0);
      const result = parseServerMessage(ev.data);
      if (result.kind === "message") {
        opts.onMessage(result.message);
      } else if (result.kind === "invalid") {
        // Một message hỏng không được làm mất cả buổi bay: báo rồi đi tiếp.
        opts.onNotice?.({
          level: "warn",
          code: "ws.bad_message",
          message: `Bỏ qua một message hỏng từ backend (${result.reason})`,
        });
      }
      // `ignored`: type chưa biết — bỏ qua trong im lặng, đúng hợp đồng.
    };

    sock.onerror = () => {
      opts.onState("error", { nextRetryAt: null, reconnected: false });
    };

    sock.onclose = () => {
      drop();
      scheduleReconnect();
    };
  }

  function send<T extends UplinkType>(type: T, data: UplinkPayloads[T]): string | null {
    if (!ws || ws.readyState !== WS_OPEN) return null;
    seq += 1;
    const id = `c-${seq}`;
    ws.send(JSON.stringify({ v: CONTRACT_VERSION, type, ts: now() / 1000, id, data }));
    return id;
  }

  return {
    send,
    close() {
      closedByUser = true;
      drop();
    },
  };
}
