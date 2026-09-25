// @vitest-environment jsdom
/**
 * Kiểm ở mức component hai luật của Phase 09 mà mắt người khó thấy:
 *  - luật vàng: telemetry về liên tục thì marker drone được DỜI, không bị tháo
 *    ra gắn lại (plan §9.2.2 — nghiệm thu #2 bản tự động);
 *  - bảng mission luôn có CẤT CÁNH đầu, VỀ NHÀ cuối, seq liên tục, và nút NẠP
 *    bị khoá KÈM lý do khi còn lỗi (nghiệm thu #5, #6).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import L from "leaflet";
import { MapContainer } from "react-leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DroneMarker } from "../../src/components/MapView/DroneMarker";
import { DRONE_ROTOR_ATTR } from "../../src/components/MapView/icons";
import { missionPath } from "../../src/components/MapView/paths";
import { MissionEditor } from "../../src/components/MissionEditor/MissionEditor";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import type { LimitsPayload, StatusPayload, Telemetry } from "../../src/lib/protocol";
import { useMissionStore } from "../../src/store/mission";
import { useTelemetryStore } from "../../src/store/telemetry";

// jsdom không có ResizeObserver; thanh trượt Radix cần nó để đo kích thước.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const initialTelemetry = useTelemetryStore.getState();
const initialMission = useMissionStore.getState();
const HOME = { lat: 10.762622, lon: 106.660172 };

const LIMITS = {
  max_alt: 10,
  min_alt: 2,
  max_distance_home: 50,
  max_waypoints: 10,
} as LimitsPayload;

function telemetry(extra: Partial<Telemetry> = {}): Telemetry {
  return {
    connected: true,
    armed: false,
    lat: HOME.lat,
    lon: HOME.lon,
    heading: 90,
    home_lat: HOME.lat,
    home_lon: HOME.lon,
    gps_fix_type: 3,
    ekf_ok: true,
    ...extra,
  } as Telemetry;
}

beforeEach(() => {
  useTelemetryStore.setState(initialTelemetry, true);
  useMissionStore.setState(initialMission, true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DroneMarker — luật vàng: dời marker, không tạo mới", () => {
  it("40 gói telemetry (5 s ở 8 Hz) → marker gắn vào bản đồ đúng 1 lần, chỉ setLatLng", () => {
    const onAdd = vi.spyOn(L.Marker.prototype, "onAdd");
    const onRemove = vi.spyOn(L.Marker.prototype, "onRemove");
    const setLatLng = vi.spyOn(L.Marker.prototype, "setLatLng");

    useTelemetryStore.getState().applyTelemetry(telemetry());
    const { container } = render(
      <MapContainer center={[HOME.lat, HOME.lon]} zoom={17} style={{ height: 300, width: 300 }}>
        <DroneMarker />
      </MapContainer>,
    );
    expect(onAdd).toHaveBeenCalledTimes(1);

    for (let i = 1; i <= 40; i++) {
      act(() => useTelemetryStore.getState().applyTelemetry(telemetry({ lat: HOME.lat + i * 1e-5, heading: (i * 9) % 360 })));
    }

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
    expect(setLatLng.mock.calls.length).toBeGreaterThanOrEqual(40);

    act(() => useTelemetryStore.getState().applyTelemetry(telemetry({ heading: 123 })));
    const rotor = container.querySelector<HTMLElement>(`[${DRONE_ROTOR_ATTR}]`);
    expect(rotor?.style.transform).toBe("rotate(123deg)");
  });

  it("không có heading thì vẽ chấm tròn không mũi, không vẽ mũi chỉ lên Bắc", () => {
    useTelemetryStore.getState().applyTelemetry(telemetry({ heading: null }));
    const { container } = render(
      <MapContainer center={[HOME.lat, HOME.lon]} zoom={17} style={{ height: 300, width: 300 }}>
        <DroneMarker />
      </MapContainer>,
    );
    expect(container.querySelector(".map-drone")).not.toBeNull();
    expect(container.querySelector(`[${DRONE_ROTOR_ATTR}]`)).toBeNull();
  });
});

function renderEditor() {
  return render(
    <TooltipProvider>
      <MissionEditor />
    </TooltipProvider>,
  );
}

function status(source: "none" | "local" | "readback", count = 0): StatusPayload {
  return { backend_version: "t", endpoint: "t", connected: true, limits: LIMITS, mission: { source, count } } as StatusPayload;
}

function ready() {
  const t = useTelemetryStore.getState();
  t.setConnection("open");
  t.applyStatus(status("none"));
  t.applyTelemetry(telemetry());
}

describe("MissionEditor", () => {
  it("4 điểm → 6 dòng: CẤT CÁNH + 4 WP + VỀ NHÀ, seq 1..6; không xoá được dòng cố định", () => {
    ready();
    for (let i = 1; i <= 4; i++) useMissionStore.getState().addWaypoint(HOME.lat + i * 5e-5, HOME.lon, 5);
    renderEditor();

    const rows = screen.getByTestId("mission-rows").querySelectorAll("li[data-seq]");
    expect([...rows].map((r) => r.getAttribute("data-seq"))).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(screen.getByTestId("mission-row-takeoff").textContent).toContain("CẤT CÁNH");
    expect(screen.getByTestId("mission-row-final").textContent).toContain("VỀ NHÀ");
    expect(screen.getByTestId("mission-row-takeoff").querySelector('[aria-label^="Xoá"]')).toBeNull();
    expect(screen.getByTestId("mission-row-final").querySelector('[aria-label^="Xoá"]')).toBeNull();
    expect((screen.getByTestId("mission-upload") as HTMLButtonElement).disabled).toBe(false);
  });

  it("gõ alt 50 → lỗi hiện ngay, dòng đỏ, nút NẠP bị khoá KÈM lý do; giá trị không bị kẹp im lặng", () => {
    ready();
    useMissionStore.getState().addWaypoint(HOME.lat + 5e-5, HOME.lon, 5);
    renderEditor();

    fireEvent.change(screen.getByTestId("alt-2"), { target: { value: "50" } });

    expect(useMissionStore.getState().waypoints[0].alt).toBe(50);
    expect(screen.getByTestId("mission-validation").textContent).toContain("WP2: độ cao 50 m vượt giới hạn 10 m");
    expect(screen.getAllByTestId("mission-row-wp")[0].getAttribute("data-invalid")).toBe("true");
    expect((screen.getByTestId("mission-upload") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("mission-lock-summary").textContent).toContain("Mission còn 1 lỗi");
  });

  it("chưa có home → nhắc rõ và khoá nút nạp", () => {
    ready();
    useTelemetryStore.getState().applyTelemetry(telemetry({ home_lat: null, home_lon: null }));
    renderEditor();
    expect(screen.getByTestId("mission-no-home")).toBeTruthy();
    expect((screen.getByTestId("mission-upload") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("mission-lock-summary").textContent).toContain("home");
  });

  it("status.mission.source = local → badge 'Chưa xác nhận'", () => {
    ready();
    useTelemetryStore.getState().applyStatus(status("local", 6));
    renderEditor();
    expect(screen.getByTestId("mission-unconfirmed").textContent).toBe("Chưa xác nhận");
  });
});

describe("missionPath — đường bay vẽ trên bản đồ", () => {
  const takeoff = { seq: 1, lat: HOME.lat, lon: HOME.lon, alt: 5, command: 22 };
  const w2 = { seq: 2, lat: HOME.lat + 1e-4, lon: HOME.lon, alt: 5, command: 16 };

  it("RTL vẽ đoạn quay về chỗ cất cánh", () => {
    const path = missionPath([takeoff, w2, { seq: 3, lat: 0, lon: 0, alt: 0, command: 20 }]);
    expect(path).toEqual([[HOME.lat, HOME.lon], [w2.lat, w2.lon], [HOME.lat, HOME.lon]]);
  });

  it("LAND tại (0, 0) = hạ tại điểm cuối, không thêm đoạn nào", () => {
    const path = missionPath([takeoff, w2, { seq: 3, lat: 0, lon: 0, alt: 0, command: 21 }]);
    expect(path).toEqual([[HOME.lat, HOME.lon], [w2.lat, w2.lon]]);
  });
});
