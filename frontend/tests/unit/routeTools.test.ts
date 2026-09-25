import { describe, expect, it } from "vitest";

import { haversineM } from "../../src/lib/geo";
import type { LatLon } from "../../src/lib/geo";
import { MAV_CMD } from "../../src/lib/missionRules";
import type { MissionWaypoint } from "../../src/lib/protocol";
import {
  bearingDeg,
  estimateDuration,
  lawnmowerPattern,
  offsetLatLon,
  orbitPattern,
  outAndBackPattern,
  parseWaypointsFile,
  routeProfile,
  routeStats,
  toWaypointsFile,
} from "../../src/lib/routeTools";

const HOME: LatLon = [10.762622, 106.660172];

function mission(points: { north: number; east: number; alt: number }[], final: number = MAV_CMD.NAV_RETURN_TO_LAUNCH): MissionWaypoint[] {
  const items: MissionWaypoint[] = [{ seq: 1, lat: HOME[0], lon: HOME[1], alt: 5, command: MAV_CMD.NAV_TAKEOFF }];
  points.forEach((p, i) => {
    const ll = offsetLatLon(HOME[0], HOME[1], p.north, p.east);
    items.push({ seq: i + 2, lat: ll.lat, lon: ll.lon, alt: p.alt, command: MAV_CMD.NAV_WAYPOINT });
  });
  items.push({ seq: items.length + 1, lat: 0, lon: 0, alt: 0, command: final });
  return items;
}

describe("offsetLatLon / bearingDeg", () => {
  it("dời 30 m về bắc rồi đo lại bằng haversine: sai số dưới 1 cm", () => {
    const p = offsetLatLon(HOME[0], HOME[1], 30, 0);
    expect(haversineM(HOME[0], HOME[1], p.lat, p.lon)).toBeCloseTo(30, 2);
    expect(bearingDeg(HOME[0], HOME[1], p.lat, p.lon)).toBeCloseTo(0, 3);
  });

  it("dời về đông → phương vị 90°", () => {
    const p = offsetLatLon(HOME[0], HOME[1], 0, 20);
    expect(bearingDeg(HOME[0], HOME[1], p.lat, p.lon)).toBeCloseTo(90, 2);
    expect(haversineM(HOME[0], HOME[1], p.lat, p.lon)).toBeCloseTo(20, 2);
  });
});

describe("routeStats", () => {
  it("quãng đường gồm cả lên, các chặng, về home và hạ cánh", () => {
    const items = mission([{ north: 30, east: 0, alt: 5 }]);
    const s = routeStats(items, HOME);
    // lên 5 m · đi 30 m · về 30 m · hạ 5 m
    expect(s.totalDistance).toBeCloseTo(70, 1);
    expect(s.maxDistanceFromHome).toBeCloseTo(30, 1);
    expect(s.waypointCount).toBe(1);
    expect(s.maxAlt).toBe(5);
  });

  it("LAND tại chỗ: không có chặng về home", () => {
    const s = routeStats(mission([{ north: 30, east: 0, alt: 5 }], MAV_CMD.NAV_LAND), HOME);
    expect(s.totalDistance).toBeCloseTo(40, 1);
    expect(s.legs.at(-1)?.to).toBe("Hạ cánh");
  });

  it("không có home: không bịa quãng đường từ (0, 0)", () => {
    const s = routeStats(mission([{ north: 30, east: 0, alt: 5 }]), null);
    expect(s.maxDistanceFromHome).toBeNull();
    expect(s.legs).toHaveLength(0);
  });

  it("thời gian ước lượng tỉ lệ nghịch với tốc độ; tốc độ không hợp lệ → null", () => {
    const s = routeStats(mission([{ north: 40, east: 0, alt: 5 }]), HOME);
    const slow = estimateDuration(s, 2)!;
    const fast = estimateDuration(s, 4)!;
    expect(slow).toBeGreaterThan(fast);
    expect(estimateDuration(s, 0)).toBeNull();
  });
});

describe("routeProfile", () => {
  it("quãng đường cộng dồn không giảm, bắt đầu ở mặt đất", () => {
    const p = routeProfile(mission([{ north: 20, east: 0, alt: 6 }, { north: 20, east: 20, alt: 8 }]), HOME);
    expect(p[0]).toMatchObject({ distance: 0, alt: 0 });
    for (let i = 1; i < p.length; i += 1) expect(p[i].distance).toBeGreaterThanOrEqual(p[i - 1].distance);
    expect(p.at(-1)?.alt).toBe(0);
  });
});

describe("mẫu lộ trình", () => {
  it("vòng tròn: đúng số điểm, mọi điểm cách tâm đúng bán kính", () => {
    const pts = orbitPattern(HOME, 25, 8, 6);
    expect(pts).toHaveLength(8);
    for (const p of pts) {
      expect(haversineM(HOME[0], HOME[1], p.lat, p.lon)).toBeCloseTo(25, 1);
      expect(p.alt).toBe(6);
    }
  });

  it("vòng tròn dưới 3 điểm được nâng lên 3 (không sinh 'vòng' 1 điểm)", () => {
    expect(orbitPattern(HOME, 10, 1, 5)).toHaveLength(3);
  });

  it("quét lưới: hai điểm mỗi làn, nằm trong nửa đường chéo của vùng", () => {
    const pts = lawnmowerPattern(HOME, 40, 40, 10, 5);
    expect(pts).toHaveLength(10); // 5 làn × 2
    const halfDiag = Math.hypot(20, 20);
    for (const p of pts) expect(haversineM(HOME[0], HOME[1], p.lat, p.lon)).toBeLessThanOrEqual(halfDiag + 0.01);
  });

  it("đi–về: điểm xa đúng quãng và hướng", () => {
    const [, far] = outAndBackPattern(HOME, 30, 90, 5);
    expect(haversineM(HOME[0], HOME[1], far.lat, far.lon)).toBeCloseTo(30, 1);
    expect(bearingDeg(HOME[0], HOME[1], far.lat, far.lon)).toBeCloseTo(90, 1);
  });
});

describe("file .waypoints (Mission Planner)", () => {
  it("xuất rồi đọc lại: giữ nguyên toạ độ, độ cao, cất cánh, lệnh cuối", () => {
    const items = mission([{ north: 10, east: 5, alt: 6 }, { north: -8, east: 12, alt: 7.5 }], MAV_CMD.NAV_LAND);
    const text = toWaypointsFile(items, HOME);
    expect(text.split("\n")[0]).toBe("QGC WPL 110");
    const back = parseWaypointsFile(text);
    expect(back.home?.lat).toBeCloseTo(HOME[0], 7);
    expect(back.takeoffAlt).toBe(5);
    expect(back.finalCommand).toBe(MAV_CMD.NAV_LAND);
    expect(back.waypoints).toHaveLength(2);
    expect(back.waypoints[1].lat).toBeCloseTo(items[2].lat, 7);
    expect(back.waypoints[1].alt).toBeCloseTo(7.5, 5);
  });

  it("bỏ qua lệnh web không soạn được và báo lại, không im lặng", () => {
    const text = "QGC WPL 110\n0\t1\t0\t16\t0\t0\t0\t0\t10.7\t106.6\t0\t1\n1\t0\t3\t183\t0\t0\t0\t0\t0\t0\t0\t1\n2\t0\t3\t16\t0\t0\t0\t0\t10.71\t106.61\t5\t1\n";
    const back = parseWaypointsFile(text);
    expect(back.skipped).toEqual([183]);
    expect(back.waypoints).toHaveLength(1);
  });

  it("file sai định dạng: ném lỗi nói rõ dòng", () => {
    expect(() => parseWaypointsFile("hello")).toThrow(/QGC WPL/);
    expect(() => parseWaypointsFile("QGC WPL 110\n0 1 0 16")).toThrow(/Dòng 2/);
  });
});
