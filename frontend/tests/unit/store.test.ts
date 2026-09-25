import { beforeEach, describe, expect, it } from "vitest";

import type { StatusPayload, Telemetry } from "../../src/lib/protocol";
import { EVENTS_MAX, eventKey, useTelemetryStore } from "../../src/store/telemetry";
import type { LogEntry } from "../../src/store/telemetry";

const initial = useTelemetryStore.getState();

function entry(ts: number, message = `e${ts}`): LogEntry {
  const e = { level: "info" as const, source: "backend" as const, code: "x", message, detail: null, ts };
  return { ...e, key: eventKey(e) };
}

const status = { backend_version: "0.1.0", endpoint: "tcp:127.0.0.1:5760", connected: true } as StatusPayload;

describe("store telemetry", () => {
  beforeEach(() => useTelemetryStore.setState(initial, true));

  it("applyTelemetry không đụng status", () => {
    useTelemetryStore.getState().applyStatus(status);
    useTelemetryStore.getState().applyTelemetry({ mode: "GUIDED" } as Telemetry);
    expect(useTelemetryStore.getState().status).toBe(status);
    expect(useTelemetryStore.getState().telemetry?.mode).toBe("GUIDED");
  });

  it(`events cắt ở ${EVENTS_MAX}, mới nhất ở đầu`, () => {
    const { pushEvent } = useTelemetryStore.getState();
    for (let i = 1; i <= EVENTS_MAX + 50; i++) pushEvent(entry(i));
    const { events } = useTelemetryStore.getState();
    expect(events).toHaveLength(EVENTS_MAX);
    expect(events[0].ts).toBe(EVENTS_MAX + 50);
    expect(events.at(-1)?.ts).toBe(51);
  });

  it("sự kiện trùng (backend phát lại khi nối lại) không nhân đôi", () => {
    const { pushEvent } = useTelemetryStore.getState();
    expect(pushEvent(entry(5))).toBe(true);
    expect(pushEvent(entry(5))).toBe(false);
    expect(useTelemetryStore.getState().events).toHaveLength(1);
  });

  it("lịch sử cũ tới sau vẫn xếp đúng chỗ theo thời điểm xảy ra", () => {
    const { pushEvent } = useTelemetryStore.getState();
    pushEvent(entry(100));
    pushEvent(entry(50));
    expect(useTelemetryStore.getState().events.map((e) => e.ts)).toEqual([100, 50]);
  });

  it("setConnection đổi đúng trạng thái; mất socket thì xoá số sống, giữ status", () => {
    const s = useTelemetryStore.getState();
    s.applyStatus(status);
    s.applyTelemetry({ mode: "GUIDED" } as Telemetry);
    s.setConnection("open");
    expect(useTelemetryStore.getState().connection).toBe("open");
    expect(useTelemetryStore.getState().telemetry).not.toBeNull();

    s.setConnection("closed", 12345);
    const after = useTelemetryStore.getState();
    expect(after.connection).toBe("closed");
    expect(after.nextRetryAt).toBe(12345);
    expect(after.telemetry).toBeNull();
    expect(after.status).toBe(status);
  });
});
