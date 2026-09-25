/**
 * Logic THUẦN của web GCS v2: toạ độ 3D, ô bản đồ, vòng đệm, lịch sử telemetry,
 * kiểm tra sẵn sàng bay, cảnh báo âm thanh, CSV.
 */
import { afterEach, describe, expect, it } from "vitest";

import { diffAnnouncements } from "../../src/lib/announcer";
import type { AnnounceState } from "../../src/lib/announcer";
import { toCsv } from "../../src/lib/csv";
import { attitudeToEuler, fromScene, toScene } from "../../src/lib/enu";
import { formatDistance, formatDuration } from "../../src/lib/format";
import { haversineM } from "../../src/lib/geo";
import { mapBase, MAP_BASES, tileUrl } from "../../src/lib/mapLayers";
import { evaluatePreflight, preflightVerdict } from "../../src/lib/preflight";
import type { StatusPayload, Telemetry } from "../../src/lib/protocol";
import { RingBuffer } from "../../src/lib/ringBuffer";
import { lonLatToTile, tileSizeMeters, tileToLonLat, tilesAround } from "../../src/lib/tiles";
import { telemetryHistory } from "../../src/store/history";

const O = { lat: 10.762622, lon: 106.660172 };

describe("ENU cho khung 3D", () => {
  it("bắc là −Z, đông là +X, độ cao là +Y; đi rồi về ra đúng chỗ cũ", () => {
    const north = toScene(O, O.lat + 0.0001, O.lon, 7);
    expect(north[2]).toBeLessThan(0);
    expect(north[0]).toBeCloseTo(0, 6);
    expect(north[1]).toBe(7);
    expect(-north[2]).toBeCloseTo(haversineM(O.lat, O.lon, O.lat + 0.0001, O.lon), 2);
    const east = toScene(O, O.lat, O.lon + 0.0001);
    expect(east[0]).toBeGreaterThan(0);
    const back = fromScene(O, east[0], east[2]);
    expect(back.lat).toBeCloseTo(O.lat, 9);
    expect(back.lon).toBeCloseTo(O.lon + 0.0001, 9);
  });

  it("tư thế → Euler: yaw theo chiều kim đồng hồ đổi dấu, roll phải đổi dấu, pitch giữ dấu", () => {
    const [x, y, z] = attitudeToEuler(10, 5, 90);
    expect(x).toBeCloseTo((5 * Math.PI) / 180);
    expect(y).toBeCloseTo((-90 * Math.PI) / 180);
    expect(z).toBeCloseTo((-10 * Math.PI) / 180);
  });
});

describe("ô bản đồ", () => {
  it("toạ độ → ô → góc ô: góc tây-bắc nằm ở tây-bắc điểm gốc", () => {
    const t = lonLatToTile(O.lat, O.lon, 18);
    const nw = tileToLonLat(Math.floor(t.x), Math.floor(t.y), 18);
    expect(nw.lat).toBeGreaterThanOrEqual(O.lat);
    expect(nw.lon).toBeLessThanOrEqual(O.lon);
  });

  it("lưới (2r+1)² ô và cỡ ô ở z18 ≈ 150 m tại TP.HCM", () => {
    expect(tilesAround(O.lat, O.lon, 18, 2)).toHaveLength(25);
    expect(tileSizeMeters(O.lat, 18)).toBeGreaterThan(140);
    expect(tileSizeMeters(O.lat, 18)).toBeLessThan(160);
  });

  it("URL ô: thay đủ {s}{z}{x}{y}{r}, không còn dấu ngoặc nào", () => {
    for (const b of MAP_BASES) expect(tileUrl(b.base, 18, 10, 20)).not.toMatch(/[{}]/);
    expect(tileUrl(mapBase("satellite").base, 18, 10, 20)).toContain("/tile/18/20/10");
    expect(mapBase("khong-co").id).toBe(MAP_BASES[0].id);
  });
});

describe("RingBuffer", () => {
  it("đầy thì ghi đè cũ nhất, thứ tự cũ → mới", () => {
    const r = new RingBuffer<number>(3);
    for (const n of [1, 2, 3, 4, 5]) r.push(n);
    expect(r.toArray()).toEqual([3, 4, 5]);
    expect(r.last()).toBe(5);
    expect(r.at(0)).toBe(3);
    expect(r.at(3)).toBeUndefined();
  });

  it("sức chứa không hợp lệ: ném lỗi", () => {
    expect(() => new RingBuffer(0)).toThrow();
  });
});

describe("lịch sử telemetry", () => {
  afterEach(() => telemetryHistory.clear());
  const t = (alt: number) => ({ relative_alt: alt, connected: true }) as Telemetry;

  it("seed chỉ nạp mẫu CŨ HƠN dữ liệu trực tiếp; trực tiếp luôn thắng", () => {
    telemetryHistory.push(t(10), 1000);
    telemetryHistory.push(t(11), 2000);
    const added = telemetryHistory.seed([
      { t: 500, d: t(1) },
      { t: 900, d: t(2) },
      { t: 1500, d: t(99) }, // trùng khoảng trực tiếp → bỏ
    ]);
    expect(added).toBe(2);
    expect(telemetryHistory.samples().map((s) => s.d.relative_alt)).toEqual([1, 2, 10, 11]);
  });

  it("samples(since) lọc theo mốc thời gian", () => {
    telemetryHistory.push(t(1), 100);
    telemetryHistory.push(t(2), 200);
    telemetryHistory.push(t(3), 300);
    expect(telemetryHistory.samples(200).map((s) => s.d.relative_alt)).toEqual([2, 3]);
  });
});

describe("sẵn sàng bay (tự động)", () => {
  const status = { safety: { web_control_enabled: false }, camera: { available: true, fake: true } } as StatusPayload;
  const good = {
    connected: true,
    link_age_ms: 90,
    gps_fix_type: 3,
    satellites: 12,
    ekf_ok: true,
    battery_remaining: 80,
    battery_voltage: 16.1,
    home_lat: 1,
    home_lon: 2,
    rangefinder_healthy: true,
    obstacle_distance: 5,
  } as Telemetry;

  it("mọi thứ tốt → GO", () => {
    expect(preflightVerdict(evaluatePreflight({ socketOpen: true, telemetry: good, status }))).toBe("go");
  });

  it("EKF chưa biết (null) KHÔNG được tính là đạt → chưa kết luận", () => {
    const checks = evaluatePreflight({ socketOpen: true, telemetry: { ...good, ekf_ok: null }, status });
    expect(checks.find((c) => c.id === "ekf")?.state).toBe("unknown");
    expect(preflightVerdict(checks)).toBe("unknown");
  });

  it("GPS dưới 3D hoặc pin yếu → NO-GO", () => {
    expect(preflightVerdict(evaluatePreflight({ socketOpen: true, telemetry: { ...good, gps_fix_type: 2 }, status }))).toBe("nogo");
    expect(preflightVerdict(evaluatePreflight({ socketOpen: true, telemetry: { ...good, battery_remaining: 12 }, status }))).toBe("nogo");
  });

  it("WEB CONTROL đang bật chỉ là lưu ý (vàng), không chặn", () => {
    const s2 = { ...status, safety: { web_control_enabled: true } } as StatusPayload;
    expect(preflightVerdict(evaluatePreflight({ socketOpen: true, telemetry: good, status: s2 }))).toBe("caution");
  });

  it("mất backend → NO-GO", () => {
    expect(preflightVerdict(evaluatePreflight({ socketOpen: false, telemetry: null, status: null }))).toBe("nogo");
  });
});

describe("cảnh báo âm thanh — báo gì", () => {
  const base: AnnounceState = { socketOpen: true, linkAlive: true, mode: "GUIDED", armed: false, battery: 80, avoid: "OFF", webControl: false };

  it("mở trang không phải là sự kiện: lần đầu không báo gì", () => {
    expect(diffAnnouncements(null, base)).toEqual([]);
  });

  it("ARM, đổi mode, mất link, pin xuống dưới ngưỡng, AVOID ACTIVE đều được báo", () => {
    const keys = (next: Partial<AnnounceState>) => diffAnnouncements(base, { ...base, ...next }).map((a) => a.key);
    expect(keys({ armed: true })).toEqual(["armed"]);
    expect(keys({ mode: "RTL" })).toEqual(["mode-RTL"]);
    expect(keys({ linkAlive: false })).toEqual(["link-lost"]);
    expect(keys({ battery: 20 })).toEqual(["battery-low"]);
    expect(keys({ avoid: "ACTIVE" })).toEqual(["avoid-active"]);
    expect(keys({ webControl: true })).toEqual(["web-on"]);
  });

  it("mất backend thì chỉ báo mất backend — không báo 'mất drone' khi chính ta mù", () => {
    const out = diffAnnouncements(base, { ...base, socketOpen: false, linkAlive: false });
    expect(out.map((a) => a.key)).toEqual(["ws-lost"]);
  });

  it("pin đã yếu sẵn thì không báo lại mỗi gói", () => {
    expect(diffAnnouncements({ ...base, battery: 20 }, { ...base, battery: 19 })).toEqual([]);
  });
});

describe("CSV và định dạng", () => {
  it("bọc nháy ô có dấu phẩy/nháy/xuống dòng, có BOM cho Excel", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'nói "chào"'], [1.5, null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"x,y","nói ""chào"""');
    expect(csv).toContain("1.5,\r\n");
  });

  it("formatDuration / formatDistance", () => {
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("—");
    expect(formatDistance(420.4)).toBe("420 m");
    expect(formatDistance(1530)).toBe("1.5 km");
  });
});
