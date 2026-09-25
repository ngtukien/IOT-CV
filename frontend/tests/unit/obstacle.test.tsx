// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ObstaclePanel } from "../../src/components/ObstaclePanel";
import { AVOID_TONE, sectorTone } from "../../src/lib/obstacle";
import type { LimitsPayload, StatusPayload, Telemetry } from "../../src/lib/protocol";
import { useTelemetryStore } from "../../src/store/telemetry";

const initial = useTelemetryStore.getState();

const LIMITS = {
  avoid_margin_m: 2,
  avoid_dist_max_m: 5,
  rangefinder_max_m: 6,
} as LimitsPayload;

function setState(t: Partial<Telemetry>) {
  useTelemetryStore.setState({
    status: { backend_version: "t", endpoint: "t", connected: true, safety: {}, limits: LIMITS } as StatusPayload,
    telemetry: { connected: true, rangefinder_healthy: true, ...t } as Telemetry,
  });
}

describe("panel vật cản", () => {
  beforeEach(() => useTelemetryStore.setState(initial, true));
  afterEach(cleanup);

  it("bốn màu khớp đúng bốn avoid_state của backend", () => {
    expect(AVOID_TONE).toEqual({ OFF: "ok", NEAR: "warn", ACTIVE: "danger", UNKNOWN: "unknown" });
    const labels = { OFF: "Trống", NEAR: "Gần vật cản", ACTIVE: "FC đang tránh", UNKNOWN: "Không đọc được" } as const;
    for (const state of ["OFF", "NEAR", "ACTIVE", "UNKNOWN"] as const) {
      setState({ mode: "LOITER", avoid_state: state, obstacle_distance: 3 });
      render(<ObstaclePanel />);
      const chip = screen.getByTestId("avoid-state");
      expect(chip.dataset.tone).toBe(AVOID_TONE[state]);
      expect(chip.textContent).toBe(labels[state]);
      cleanup();
    }
  });

  it("frontend KHÔNG tự tính avoid_state: khoảng cách 1 m nhưng backend báo OFF thì hiện OFF", () => {
    setState({ mode: "GUIDED", avoid_state: "OFF", obstacle_distance: 1 });
    render(<ObstaclePanel />);
    expect(screen.getByTestId("avoid-state").dataset.state).toBe("OFF");
  });

  it("cung null vẽ gạch chéo (unknown), không vẽ xanh", () => {
    setState({ mode: "LOITER", avoid_state: "OFF", obstacle_sectors: [8, null, null, null, null, null, null, null] });
    render(<ObstaclePanel />);
    expect(screen.getByTestId("sector-0").dataset.tone).toBe("ok");
    for (let i = 1; i < 8; i += 1) expect(screen.getByTestId(`sector-${i}`).dataset.tone).toBe("unknown");
  });

  it("chưa có telemetry: cả 8 cung gạch chéo", () => {
    render(<ObstaclePanel />);
    for (let i = 0; i < 8; i += 1) expect(screen.getByTestId(`sector-${i}`).dataset.tone).toBe("unknown");
  });

  it("dải màu của cung theo ngưỡng status.limits", () => {
    expect(sectorTone(1.5, LIMITS)).toBe("danger");
    expect(sectorTone(2, LIMITS)).toBe("danger");
    expect(sectorTone(4, LIMITS)).toBe("warn");
    expect(sectorTone(5.5, LIMITS)).toBe("ok");
    expect(sectorTone(null, LIMITS)).toBe("unknown");
    expect(sectorTone(3, null)).toBe("unknown");
  });

  it("dòng 'KHÔNG tự tránh vật cản' xuất hiện đúng ở AUTO / GUIDED / RTL", () => {
    for (const mode of ["AUTO", "GUIDED", "RTL"]) {
      setState({ mode, avoid_state: "OFF" });
      render(<ObstaclePanel />);
      expect(screen.getByTestId("no-avoid-warning").textContent).toContain("Chế độ này KHÔNG tự tránh vật cản.");
      expect(screen.getByTestId("no-avoid-warning").textContent).toContain("OA_TYPE=0");
      cleanup();
    }
    for (const mode of ["LOITER", "ALT_HOLD", "POSHOLD", "LAND"]) {
      setState({ mode, avoid_state: "OFF" });
      render(<ObstaclePanel />);
      expect(screen.queryByTestId("no-avoid-warning")).toBeNull();
      cleanup();
    }
  });

  it("khoảng cách hiện số, và ngoài tầm thì ghi '> max'", () => {
    setState({ mode: "LOITER", avoid_state: "NEAR", obstacle_distance: 2.4 });
    render(<ObstaclePanel />);
    expect(screen.getByTestId("obstacle-distance").textContent).toBe("2.4 m");
    cleanup();
    setState({ mode: "LOITER", avoid_state: "OFF", obstacle_distance: 9 });
    render(<ObstaclePanel />);
    expect(screen.getByTestId("obstacle-distance").textContent).toBe("> 6 m");
  });
});
