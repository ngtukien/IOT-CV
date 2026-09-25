// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Hud } from "../../src/components/Hud/Hud";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import type { Telemetry } from "../../src/lib/protocol";
import { useTelemetryStore } from "../../src/store/telemetry";

const initial = useTelemetryStore.getState();

function renderHud() {
  return render(
    <TooltipProvider>
      <Hud />
    </TooltipProvider>,
  );
}

const cell = (label: string) => screen.getByTestId(`stat-${label}`).textContent ?? "";
const pfd = (id: string) => screen.getByTestId(id).getAttribute("data-value");

const LABELS = ["Độ cao", "Tốc độ", "Hướng mũi", "GPS", "Tốc độ leo", "Pin", "Tuổi link", "EKF"];

describe("HUD", () => {
  beforeEach(() => useTelemetryStore.setState(initial, true));
  afterEach(cleanup);

  it("chưa có telemetry: mọi ô và mọi băng PFD hiện —, không chỗ nào hiện số 0", () => {
    renderHud();
    for (const label of LABELS) {
      expect(cell(label)).toContain("—");
      expect(cell(label)).not.toMatch(/(^|\D)0(\.0+)? ?(m|m\/s|V|A|%|ms|°)/);
    }
    expect(pfd("pfd-alt")).toBe("—");
    expect(pfd("pfd-speed")).toBe("—");
    expect(pfd("pfd-heading")).toBe("—");
    expect(screen.getByRole("img", { name: "Chưa có số đo tư thế" })).toBeTruthy();
    expect(screen.queryByTestId("horizon")).toBeNull();
  });

  it("có số thì hiện số kèm đơn vị; trường null riêng lẻ vẫn là —", () => {
    useTelemetryStore.getState().applyTelemetry({
      mode: "GUIDED",
      armed: true,
      relative_alt: 4.94,
      heading: 123,
      ground_speed: 1.0234,
      climb_rate: 0.43,
      gps_fix_type: 3,
      satellites: 12,
      battery_voltage: 11.4,
      battery_current: null,
      battery_remaining: 78,
      link_age_ms: 120,
      ekf_ok: null,
      roll: 5,
      pitch: -3,
    } as Telemetry);
    renderHud();
    expect(cell("Độ cao")).toContain("4.9m");
    expect(cell("Hướng mũi")).toContain("123°");
    expect(cell("Tốc độ")).toContain("1.02m/s");
    expect(cell("Tốc độ leo")).toContain("+0.4m/s");
    expect(cell("GPS")).toContain("3D");
    expect(cell("GPS")).toContain("12 vệ tinh");
    expect(cell("Pin")).toContain("78%");
    expect(cell("Pin")).toContain("11.4 V · —");
    expect(cell("EKF")).toContain("—");
    expect(pfd("pfd-alt")).toBe("4.9");
    expect(pfd("pfd-heading")).toBe("123°");
    expect(screen.getByRole("img", { name: "Nghiêng 5°, chúc ngóc -3°" })).toBeTruthy();
    expect(screen.getByText("ARMED")).toBeTruthy();
    expect(screen.getByText("GUIDED")).toBeTruthy();
  });

  it("giới hạn độ cao đọc từ status.limits: chưa có status thì —, có thì vẽ vạch trên băng", () => {
    renderHud();
    expect(cell("Độ cao")).toContain("giới hạn —");
    expect(screen.queryByTestId("pfd-alt-limit")).toBeNull();
    cleanup();

    useTelemetryStore.getState().applyStatus({ limits: { max_alt: 12 } } as never);
    useTelemetryStore.getState().applyTelemetry({ relative_alt: 10 } as Telemetry);
    renderHud();
    expect(cell("Độ cao")).toContain("giới hạn 12 m");
    expect(screen.getByTestId("pfd-alt-limit")).toBeTruthy();
  });
});
