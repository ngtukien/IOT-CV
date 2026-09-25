// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManualControl } from "../../src/components/ManualControl/ManualControl";
import { SafetyBanner } from "../../src/components/ManualControl/SafetyBanner";
import { ModePanel } from "../../src/components/ModePanel";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { handleControlAck, handleControlError, warnOverdueCommands } from "../../src/hooks/controlUplink";
import { useHoldShortcut } from "../../src/hooks/useHoldShortcut";
import type { LimitsPayload, StatusPayload, Telemetry } from "../../src/lib/protocol";
import { setActiveSocket } from "../../src/lib/uplink";
import type { GcsSocket } from "../../src/lib/ws";
import { ACK_DONE_WARN_MS, useControlStore } from "../../src/store/control";
import { useTelemetryStore } from "../../src/store/telemetry";

// jsdom không có ResizeObserver; thanh trượt Radix (ô độ cao cất cánh) cần nó.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn() }) }));
const { toast } = await import("sonner");

const initialTelemetry = useTelemetryStore.getState();
const initialControl = useControlStore.getState();
const LIMITS = { min_alt: 2, max_alt: 10, max_velocity: 1 } as LimitsPayload;
const sent: { type: string; data: unknown; id: string }[] = [];

function status(webControl: boolean): StatusPayload {
  return {
    backend_version: "t",
    endpoint: "t",
    connected: true,
    safety: { web_control_enabled: webControl },
    limits: LIMITS,
    mission: { source: "none", count: 0 },
  } as StatusPayload;
}

function world(t: Partial<Telemetry>, webControl = false) {
  useTelemetryStore.setState({ connection: "open", telemetry: { connected: true, ...t } as Telemetry, status: status(webControl) });
}

function HoldShortcutHost() {
  useHoldShortcut();
  return null;
}

const renderIt = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);
const types = () => sent.map((s) => s.type);

beforeEach(() => {
  sent.length = 0;
  const sock: GcsSocket = {
    send: (type, data) => {
      const id = `c-${sent.length + 1}`;
      sent.push({ type, data, id });
      return id;
    },
    close: () => {},
  };
  setActiveSocket(sock);
  useTelemetryStore.setState(initialTelemetry, true);
  useControlStore.setState(initialControl, true);
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  setActiveSocket(null);
});

describe("mức xác nhận (§10.3.2)", () => {
  it("RTL / LAND / HOLD không hỏi: bấm là gửi ngay", () => {
    world({ mode: "GUIDED", armed: true });
    renderIt(<ModePanel />);
    fireEvent.click(screen.getByTestId("cmd-rtl"));
    fireEvent.click(screen.getByTestId("cmd-land"));
    fireEvent.click(screen.getByTestId("cmd-hold"));
    fireEvent.click(screen.getByTestId("mode-LOITER"));
    expect(types()).toEqual(["cmd.rtl", "cmd.land", "cmd.hold", "cmd.mode"]);
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("phím H là HOLD — gắn ở cấp ứng dụng, có hiệu lực ở MỌI trang", () => {
    world({ mode: "GUIDED" });
    // Không render ModePanel: phím H phải chạy cả khi người dùng đang ở trang khác.
    renderIt(<HoldShortcutHost />);
    fireEvent.keyDown(window, { code: "KeyH" });
    expect(types()).toEqual(["cmd.hold"]);
  });

  it("phím H không bắn khi đang gõ vào ô nhập, và không lặp khi giữ phím", () => {
    world({ mode: "GUIDED" });
    renderIt(
      <>
        <HoldShortcutHost />
        <input data-testid="typing" />
      </>,
    );
    fireEvent.keyDown(screen.getByTestId("typing"), { code: "KeyH" });
    fireEvent.keyDown(window, { code: "KeyH", repeat: true });
    expect(types()).toEqual([]);
  });

  it("ARM phải gõ chữ ARM mới bấm được xác nhận, và có nhắc tháo cánh", () => {
    world({ mode: "GUIDED", armed: false });
    renderIt(<ModePanel />);
    fireEvent.click(screen.getByTestId("cmd-arm"));
    expect(types()).toEqual([]);
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("đã tháo cánh chưa");
    const ok = screen.getByTestId("confirm-ok") as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("confirm-word"), { target: { value: "arm" } });
    expect(ok.disabled).toBe(false);
    fireEvent.click(ok);
    expect(sent).toMatchObject([{ type: "cmd.arm", data: { arm: true } }]);
  });

  it("DISARM, TAKEOFF có hộp xác nhận", () => {
    world({ mode: "GUIDED", armed: true, relative_alt: 5 });
    renderIt(<ModePanel />);
    fireEvent.click(screen.getByTestId("cmd-disarm"));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("RƠI");
    expect(types()).toEqual([]);
    fireEvent.click(screen.getByText("Huỷ"));
    fireEvent.click(screen.getByTestId("cmd-takeoff"));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("rời mặt đất");
    fireEvent.click(screen.getByTestId("confirm-ok"));
    expect(sent).toMatchObject([{ type: "cmd.takeoff", data: { altitude: 5 } }]);
  });

  it("AUTO bị khoá khi chưa có mission đọc lại; có mission thì hỏi", () => {
    world({ mode: "GUIDED", armed: true });
    const { unmount } = renderIt(<ModePanel />);
    expect((screen.getByTestId("mode-AUTO") as HTMLButtonElement).disabled).toBe(true);
    unmount();
    useTelemetryStore.setState({ status: { ...status(false), mission: { source: "readback", count: 3 } } });
    renderIt(<ModePanel />);
    fireEvent.click(screen.getByTestId("mode-AUTO"));
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect(types()).toEqual([]);
  });

  it("nút mode KHÔNG sáng khi bấm — chỉ sáng theo telemetry.mode", () => {
    world({ mode: "LOITER" });
    renderIt(<ModePanel />);
    fireEvent.click(screen.getByTestId("mode-GUIDED"));
    expect(screen.getByTestId("mode-GUIDED").dataset.active).toBe("false");
    expect(screen.getByTestId("mode-LOITER").dataset.active).toBe("true");
    act(() => world({ mode: "GUIDED" }));
    expect(screen.getByTestId("mode-GUIDED").dataset.active).toBe("true");
  });
});

describe("WEB CONTROL (§10.1.4)", () => {
  const sw = () => screen.getByTestId("web-control-switch");

  it("không phải GUIDED: công tắc xám kèm lý do", () => {
    world({ mode: "LOITER" });
    renderIt(<ManualControl />);
    expect((sw() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("web-control-reason").textContent).toBe("Cần đổi sang GUIDED trước");
  });

  it("bấm bật: công tắc KHÔNG đổi màu cho tới khi ack done + status từ backend", () => {
    world({ mode: "GUIDED" });
    renderIt(<ManualControl />);
    fireEvent.click(sw());
    expect(sent).toMatchObject([{ type: "cmd.web_control_enable", data: { enabled: true } }]);
    expect(sw().dataset.on).toBe("false");

    act(() => void handleControlAck({ ref: sent[0].id, command: "cmd.web_control_enable", status: "done" }));
    expect(sw().dataset.on).toBe("false"); // status vẫn báo tắt

    act(() => world({ mode: "GUIDED" }, true));
    expect(sw().dataset.on).toBe("true");
  });

  it("backend từ chối vì tab khác giữ quyền → toast đỏ, công tắc vẫn tắt", () => {
    world({ mode: "GUIDED" });
    renderIt(<ManualControl />);
    fireEvent.click(sw());
    act(
      () =>
        void handleControlError({
          ref: sent[0].id,
          command: "cmd.web_control_enable",
          code: "command_denied",
          message: "x",
          detail: { owner: "ws-2" },
        }),
    );
    expect(toast.error).toHaveBeenCalledWith("Một tab khác đang giữ quyền lái", expect.anything());
    expect(sw().dataset.on).toBe("false");
  });

  it("phi công gạt mode khác GUIDED: backend tắt quyền → tab này hết giữ, công tắc tự tắt", () => {
    world({ mode: "GUIDED" }, true);
    useControlStore.setState({ claimed: true });
    renderIt(<ManualControl />);
    expect(sw().dataset.on).toBe("true");
    act(() => {
      world({ mode: "LOITER" }, false);
      useControlStore.getState().syncWebControl(false);
    });
    expect(sw().dataset.on).toBe("false");
    expect(useControlStore.getState().claimed).toBe(false);
  });

  it("tab khác đang giữ: không bật được, lý do rõ ràng", () => {
    world({ mode: "GUIDED" }, true);
    renderIt(<ManualControl />);
    expect((sw() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("web-control-reason").textContent).toBe("Một tab khác đang giữ quyền lái");
  });
});

describe("SafetyBanner (§10.1.5)", () => {
  it("hiện khi web giữ quyền, không có nút đóng; ẩn khi tắt", () => {
    world({ mode: "GUIDED" }, true);
    useControlStore.setState({ claimed: true });
    renderIt(<SafetyBanner />);
    const banner = screen.getByTestId("safety-banner");
    expect(banner.textContent).toContain("WEB ĐANG GIỮ QUYỀN LÁI");
    expect(banner.textContent).toContain("RC luôn có quyền cao hơn");
    expect(banner.querySelector("button")).toBeNull();
    act(() => world({ mode: "GUIDED" }, false));
    expect(screen.queryByTestId("safety-banner")).toBeNull();
  });
});

describe("theo dõi ack (§10.3.4)", () => {
  it("quá 5 s không có done → cảnh báo vàng đúng một lần", () => {
    world({ mode: "GUIDED" });
    renderIt(<ModePanel />);
    fireEvent.click(screen.getByTestId("cmd-rtl"));
    const sentAt = useControlStore.getState().pending[sent[0].id].sentAt;
    warnOverdueCommands(sentAt + ACK_DONE_WARN_MS - 1);
    expect(toast.warning).not.toHaveBeenCalled();
    warnOverdueCommands(sentAt + ACK_DONE_WARN_MS);
    warnOverdueCommands(sentAt + ACK_DONE_WARN_MS + 2000);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("ack accepted giữ trạng thái chờ; done thì xoá; ack lạ để cho mission", () => {
    world({ mode: "GUIDED" });
    renderIt(<ModePanel />);
    fireEvent.click(screen.getByTestId("cmd-land"));
    const ref = sent[0].id;
    expect(handleControlAck({ ref, command: "cmd.land", status: "accepted" })).toBe(true);
    expect(useControlStore.getState().pending[ref].stage).toBe("accepted");
    expect(handleControlAck({ ref, command: "cmd.land", status: "done" })).toBe(true);
    expect(useControlStore.getState().pending[ref]).toBeUndefined();
    expect(handleControlAck({ ref: "c-999", command: "cmd.mission.upload", status: "done" })).toBe(false);
  });

  it("lỗi cmd.velocity lặp 10 lần/giây chỉ báo một lần", () => {
    for (let i = 0; i < 10; i += 1) {
      handleControlError({ command: "cmd.velocity", code: "wrong_mode", message: "x" }, 1000 + i * 100);
    }
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
