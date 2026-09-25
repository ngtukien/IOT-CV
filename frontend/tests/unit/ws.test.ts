import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BACKOFF_MAX_MS,
  PING_INTERVAL_MS,
  SILENCE_TIMEOUT_MS,
  backoffDelay,
  createGcsSocket,
  wsUrlFromLocation,
} from "../../src/lib/ws";
import type { GcsSocketOptions, SocketState, WebSocketLike } from "../../src/lib/ws";

class FakeSocket implements WebSocketLike {
  readyState = 0;
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onclose: WebSocketLike["onclose"] = null;
  sent: string[] = [];
  closed = false;

  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  // --- điều khiển từ test ---
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(raw: string) {
    this.onmessage?.({ data: raw });
  }
  serverClose() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

const telemetryFrame = JSON.stringify({ v: 1, type: "telemetry", ts: 1, data: { mode: "GUIDED" } });

function setup(extra: Partial<GcsSocketOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const states: SocketState[] = [];
  const messages: unknown[] = [];
  const notices: string[] = [];
  const reconnects: boolean[] = [];
  const sock = createGcsSocket({
    url: "ws://test/ws",
    random: () => 0, // bỏ nhiễu để kiểm đúng dãy backoff
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    onMessage: (m) => messages.push(m),
    onState: (state, info) => {
      states.push(state);
      if (state === "open") reconnects.push(info.reconnected);
    },
    onNotice: (n) => notices.push(n.code),
    ...extra,
  });
  return { sock, sockets, states, messages, notices, reconnects, last: () => sockets[sockets.length - 1] };
}

describe("backoff", () => {
  it("dãy 1/2/4/8/10/10 s (không nhiễu)", () => {
    expect([0, 1, 2, 3, 4, 5].map((a) => backoffDelay(a, () => 0))).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
  });

  it("nhiễu cộng thêm 0–500 ms, trần vẫn là 10 s + nhiễu", () => {
    expect(backoffDelay(0, () => 0.999)).toBe(1499);
    expect(backoffDelay(10, () => 0.999)).toBe(BACKOFF_MAX_MS + 499);
  });
});

describe("createGcsSocket", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("mở kết nối TRỄ một nhịp — close() ngay sau khi tạo thì không có kết nối nào (bẫy StrictMode)", () => {
    const t = setup();
    t.sock.close();
    vi.advanceTimersByTime(60_000);
    expect(t.sockets).toHaveLength(0);
  });

  it("nối lại theo đúng dãy 1/2/4/8/10 s khi backend không lên", () => {
    const t = setup();
    vi.advanceTimersByTime(0);
    expect(t.sockets).toHaveLength(1);

    const expected = [1000, 2000, 4000, 8000, 10000];
    for (const [i, delay] of expected.entries()) {
      t.last().serverClose(); // kết nối hỏng
      vi.advanceTimersByTime(delay - 1);
      expect(t.sockets).toHaveLength(i + 1);
      vi.advanceTimersByTime(1);
      expect(t.sockets).toHaveLength(i + 2);
    }
  });

  it("nối lại thành công thì đặt lại backoff về 1 s và báo reconnected", () => {
    const t = setup();
    vi.advanceTimersByTime(0);
    t.last().open();
    t.last().serverClose();
    vi.advanceTimersByTime(1000);
    t.last().serverClose();
    vi.advanceTimersByTime(2000);
    t.last().open();
    expect(t.reconnects).toEqual([false, true]);

    t.last().serverClose();
    vi.advanceTimersByTime(1000);
    expect(t.sockets).toHaveLength(4);
  });

  it("nhịp tim: gửi ping mỗi 2 s khi đang mở", () => {
    const t = setup();
    vi.advanceTimersByTime(0);
    const s = t.last();
    s.open();
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(PING_INTERVAL_MS);
      s.receive(telemetryFrame); // giữ đường dây "sống" để không bị đóng vì im lặng
    }
    const pings = s.sent.map((raw) => JSON.parse(raw)).filter((m) => m.type === "ping");
    expect(pings).toHaveLength(4);
  });

  it("5 s không nhận được gì thì đóng socket và nối lại", () => {
    const t = setup();
    vi.advanceTimersByTime(0);
    const s = t.last();
    s.open();
    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - 1);
    expect(s.closed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(s.closed).toBe(true);
    expect(t.notices).toContain("ws.silent");
    vi.advanceTimersByTime(1000);
    expect(t.sockets).toHaveLength(2);
  });

  it("message nào tới cũng làm mới hạn 5 s", () => {
    const t = setup();
    vi.advanceTimersByTime(0);
    const s = t.last();
    s.open();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - 100);
      s.receive(telemetryFrame);
    }
    expect(s.closed).toBe(false);
  });

  it("message hỏng: báo notice, không gọi onMessage, socket vẫn mở", () => {
    const t = setup();
    vi.advanceTimersByTime(0);
    const s = t.last();
    s.open();
    s.receive("}{ rác");
    s.receive(JSON.stringify({ v: 1, type: "future.thing", ts: 1, data: {} }));
    s.receive(telemetryFrame);
    expect(t.notices).toEqual(["ws.bad_message"]);
    expect(t.messages).toHaveLength(1);
    expect(s.closed).toBe(false);
  });

  it("send() bọc phong bì đúng hợp đồng, id tăng dần c-1, c-2", () => {
    const t = setup({ now: () => 1_758_412_345_000 });
    vi.advanceTimersByTime(0);
    expect(t.sock.send("ping", {})).toBeNull(); // chưa mở: không gửi, không giả vờ đã gửi
    t.last().open();
    expect(t.sock.send("cmd.web_control_enable", { enabled: false })).toBe("c-1");
    expect(t.sock.send("ping", {})).toBe("c-2");
    expect(JSON.parse(t.last().sent[0])).toEqual({
      v: 1,
      type: "cmd.web_control_enable",
      ts: 1_758_412_345,
      id: "c-1",
      data: { enabled: false },
    });
  });

  it("close() dừng hẳn: không nối lại, không ping", () => {
    const t = setup();
    vi.advanceTimersByTime(0);
    const s = t.last();
    s.open();
    t.sock.close();
    vi.advanceTimersByTime(60_000);
    expect(t.sockets).toHaveLength(1);
    expect(s.sent).toHaveLength(0);
  });
});

describe("wsUrlFromLocation", () => {
  it("ws:// cho http, wss:// cho https, luôn đường dẫn /ws của cùng host", () => {
    expect(wsUrlFromLocation({ protocol: "http:", host: "127.0.0.1:8000" })).toBe("ws://127.0.0.1:8000/ws");
    expect(wsUrlFromLocation({ protocol: "https:", host: "gcs.local" })).toBe("wss://gcs.local/ws");
  });
});
