// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useManualControl } from "../../src/hooks/useManualControl";
import { SEND_INTERVAL_MS, ZERO_TICKS_AFTER_RELEASE, createManualController } from "../../src/lib/manualControl";
import type { CmdVelocity, LimitsPayload, StatusPayload, Telemetry } from "../../src/lib/protocol";
import { setActiveSocket } from "../../src/lib/uplink";
import type { GcsSocket } from "../../src/lib/ws";
import { useControlStore } from "../../src/store/control";
import { useTelemetryStore } from "../../src/store/telemetry";

type Sent = Required<CmdVelocity>;

function makeController(enabled = true) {
  const sent: Sent[] = [];
  let tickFn: (() => void) | null = null;
  const state = { enabled };
  const ctl = createManualController({
    send: (v) => {
      sent.push(v);
      return true;
    },
    isEnabled: () => state.enabled,
    getMaxVelocity: () => 1,
    setInterval: (fn, ms) => {
      expect(ms).toBe(SEND_INTERVAL_MS);
      tickFn = fn;
      return 1;
    },
    clearInterval: () => {
      tickFn = null;
    },
  });
  ctl.start();
  const tick = (n = 1) => {
    for (let i = 0; i < n; i += 1) tickFn?.();
  };
  return { ctl, sent, tick, state };
}

const isZero = (v: Sent) => v.vx === 0 && v.vy === 0 && v.vz === 0 && v.yaw_rate === 0;

describe("bộ điều khiển tay — tách trạng thái phím khỏi việc gửi", () => {
  it("keydown KHÔNG gửi gì, chỉ đổi tập phím", () => {
    const { ctl, sent } = makeController();
    expect(ctl.keyDown("KeyW")).toBe(true);
    expect(ctl.keyDown("KeyW")).toBe(true); // hệ điều hành tự lặp keydown
    expect(sent).toEqual([]);
    expect(ctl.snapshot().held).toEqual(["KeyW"]);
  });

  it("chỉ setInterval gửi, nhịp 10 Hz (100 ms, ≥ 5 Hz)", () => {
    expect(SEND_INTERVAL_MS).toBe(100);
    expect(1000 / SEND_INTERVAL_MS).toBeGreaterThanOrEqual(5);
    const { ctl, sent, tick } = makeController();
    ctl.keyDown("KeyW");
    tick(10);
    expect(sent).toHaveLength(10);
    expect(sent.every((v) => v.vx === 1)).toBe(true);
  });

  it("thả phím: gửi zero đúng 3 nhịp rồi im (dead-man backend lo phần còn lại)", () => {
    const { ctl, sent, tick } = makeController();
    ctl.keyDown("KeyW");
    tick();
    ctl.keyUp("KeyW");
    tick(10);
    expect(sent).toHaveLength(1 + ZERO_TICKS_AFTER_RELEASE);
    expect(sent.slice(1).every(isZero)).toBe(true);
    expect(ctl.snapshot().sent).toBeNull();
  });

  it("blur (Alt-Tab) xoá tập phím VÀ gửi zero ngay, không chờ nhịp", () => {
    const { ctl, sent, tick } = makeController();
    ctl.keyDown("KeyW");
    ctl.keyDown("KeyD");
    tick();
    ctl.releaseAll();
    expect(ctl.snapshot().held).toEqual([]);
    expect(sent).toHaveLength(2);
    expect(isZero(sent[1])).toBe(true);
    tick(5);
    expect(sent.slice(1).every(isZero)).toBe(true);
  });

  it("Space gửi zero ngay và quên mọi phím đang giữ", () => {
    const { ctl, sent, tick } = makeController();
    ctl.keyDown("KeyW");
    tick();
    expect(ctl.keyDown("Space")).toBe(true);
    expect(sent).toHaveLength(2);
    expect(isZero(sent[1])).toBe(true);
    expect(ctl.snapshot().held).toEqual([]);
  });

  it("chưa được lái: không bắt phím (để mũi tên/Space cuộn trang), không gửi gì", () => {
    const { ctl, sent, tick } = makeController(false);
    expect(ctl.keyDown("KeyW")).toBe(false);
    expect(ctl.keyDown("Space")).toBe(false);
    tick(5);
    expect(sent).toEqual([]);
  });

  it("mất quyền lái giữa chừng: ngừng gửi và QUÊN phím — bật lại không lao đi theo phím cũ", () => {
    const { ctl, sent, tick, state } = makeController();
    ctl.keyDown("KeyW");
    tick();
    state.enabled = false;
    tick();
    expect(sent).toHaveLength(1);
    state.enabled = true;
    tick(3);
    expect(sent).toHaveLength(1);
    expect(ctl.snapshot().held).toEqual([]);
  });

  it("bàn phím ưu tiên hơn tay cầm", () => {
    const { ctl, sent, tick } = makeController();
    ctl.setGamepad({ vx: 0, vy: 1, vz: 0, yaw: 0 });
    tick();
    expect(sent[0].vy).toBe(1);
    ctl.keyDown("KeyW");
    tick();
    expect(sent[1]).toEqual({ vx: 1, vy: 0, vz: 0, yaw_rate: 0 });
  });
});

// ---------------------------------------------------------------------------
// Nối vào trình duyệt thật (jsdom): chứng minh `blur` được ĐĂNG KÝ, không chỉ
// là hàm `releaseAll` tồn tại.
// ---------------------------------------------------------------------------

describe("useManualControl — nối vào window", () => {
  const initialTelemetry = useTelemetryStore.getState();
  const initialControl = useControlStore.getState();
  const uplinks: { type: string; data: unknown }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    uplinks.length = 0;
    const sock: GcsSocket = {
      send: (type, data) => {
        uplinks.push({ type, data });
        return `c-${uplinks.length}`;
      },
      close: () => {},
    };
    setActiveSocket(sock);
    useTelemetryStore.setState({
      connection: "open",
      telemetry: { mode: "GUIDED", connected: true } as Telemetry,
      status: {
        backend_version: "t",
        endpoint: "t",
        connected: true,
        safety: { web_control_enabled: true },
        limits: { max_velocity: 1 } as LimitsPayload,
      } as StatusPayload,
    });
    useControlStore.setState({ claimed: true });
  });

  afterEach(() => {
    setActiveSocket(null);
    vi.useRealTimers();
    useTelemetryStore.setState(initialTelemetry, true);
    useControlStore.setState(initialControl, true);
  });

  const velocities = () => uplinks.filter((u) => u.type === "cmd.velocity").map((u) => u.data as Sent);
  const key = (type: "keydown" | "keyup", code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));

  it("keydown không gửi; nhịp 100 ms gửi; blur gửi zero ngay", () => {
    const { unmount } = renderHook(() => useManualControl());
    key("keydown", "KeyW");
    expect(velocities()).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(velocities()).toHaveLength(3);
    expect(velocities().every((v) => v.vx === 1)).toBe(true);

    window.dispatchEvent(new Event("blur"));
    const afterBlur = velocities();
    expect(afterBlur).toHaveLength(4);
    expect(isZero(afterBlur[3])).toBe(true);
    expect(useControlStore.getState().manual.held).toEqual([]);
    unmount();
  });

  it("tab ẩn (visibilitychange) cũng dừng", () => {
    const { unmount } = renderHook(() => useManualControl());
    key("keydown", "KeyW");
    vi.advanceTimersByTime(100);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isZero(velocities().at(-1)!)).toBe(true);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    unmount();
  });

  it("mũi tên và Space bị preventDefault khi đang lái (trang không cuộn)", () => {
    const { unmount } = renderHook(() => useManualControl());
    const ev = new KeyboardEvent("keydown", { code: "ArrowDown", bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    unmount();
  });

  it("gõ trong ô nhập, hay Ctrl+W, không phải lệnh lái", () => {
    const { unmount } = renderHook(() => useManualControl());
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", ctrlKey: true }));
    vi.advanceTimersByTime(300);
    expect(velocities()).toEqual([]);
    input.remove();
    unmount();
  });

  it("mũi tên trên thanh trượt (role=slider) là chỉnh số, không phải bay; Space vẫn dừng", () => {
    const { unmount } = renderHook(() => useManualControl());
    const slider = document.createElement("span");
    slider.setAttribute("role", "slider");
    document.body.appendChild(slider);
    slider.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(velocities()).toEqual([]);
    slider.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true }));
    expect(velocities()).toHaveLength(1);
    expect(isZero(velocities()[0])).toBe(true);
    slider.remove();
    unmount();
  });

  it("không phải GUIDED thì không gửi dù phím đang giữ", () => {
    useTelemetryStore.setState({ telemetry: { mode: "LOITER", connected: true } as Telemetry });
    const { unmount } = renderHook(() => useManualControl());
    key("keydown", "KeyW");
    vi.advanceTimersByTime(300);
    expect(velocities()).toEqual([]);
    unmount();
  });
});
