import { describe, expect, it } from "vitest";

import {
  FALLBACK_CENTER,
  TRAIL_MAX_POINTS,
  TRAIL_MIN_STEP_M,
  haversineM,
  nextTrail,
  pickMapCenter,
} from "../../src/lib/geo";
import type { LatLon } from "../../src/lib/geo";

const HOME: LatLon = [10.762622, 106.660172];

describe("haversineM khớp haversine_m() của backend", () => {
  // Số tham chiếu chạy thật từ `backend.mavlink.mission.haversine_m` ngày
  // 25/09/2026 (uv run --project backend python -c ...), không tính tay.
  const REFERENCE: [LatLon, number][] = [
    [[10.763622, 106.660172], 111.19492664444572],
    [[10.772622, 106.660172], 1111.949266445518],
    [[10.762822, 106.660172], 22.238985328783045],
    [[10.762622, 106.661172], 109.23892821292877],
    [[10.762922, 106.660572], 54.973530936617266],
  ];

  it.each(REFERENCE)("HOME → %j ≈ %f m (sai số < 0.5 m)", (to, expected) => {
    expect(Math.abs(haversineM(HOME[0], HOME[1], to[0], to[1]) - expected)).toBeLessThan(0.5);
  });

  it("cùng một điểm là 0", () => {
    expect(haversineM(HOME[0], HOME[1], HOME[0], HOME[1])).toBe(0);
  });
});

describe("pickMapCenter — home → vị trí hiện tại → null", () => {
  it("ưu tiên home", () => {
    expect(pickMapCenter({ home_lat: 1, home_lon: 2, lat: 3, lon: 4 })).toEqual([1, 2]);
  });
  it("không có home thì lấy vị trí hiện tại", () => {
    expect(pickMapCenter({ home_lat: null, home_lon: null, lat: 3, lon: 4 })).toEqual([3, 4]);
  });
  it("không có gì thì null (để dùng FALLBACK_CENTER), không phải (0, 0)", () => {
    expect(pickMapCenter({ lat: null, lon: null })).toBeNull();
    expect(pickMapCenter(null)).toBeNull();
    expect(FALLBACK_CENTER).toEqual([10.762622, 106.660172]);
  });
});

describe("nextTrail — lọc vệt đường", () => {
  // 1e-5 độ vĩ ≈ 1.11 m; 3e-5 ≈ 3.34 m.
  const at = (dLat: number) => ({ armed: true, lat: HOME[0] + dLat, lon: HOME[1] });

  it("chưa armed thì không ghi", () => {
    const t = nextTrail([], { armed: false, lat: HOME[0], lon: HOME[1] });
    expect(t).toHaveLength(0);
  });

  it("không có toạ độ thì không ghi", () => {
    expect(nextTrail([], { armed: true, lat: null, lon: null })).toHaveLength(0);
  });

  it(`bỏ điểm dịch ≤ ${TRAIL_MIN_STEP_M} m, giữ điểm dịch xa hơn`, () => {
    let t = nextTrail([], at(0));
    expect(t).toHaveLength(1);
    const before = t;
    t = nextTrail(t, at(1e-5)); // ~1.1 m — nhiễu GPS đứng yên
    expect(t).toBe(before); // CÙNG tham chiếu: store không đẩy lượt render thừa
    t = nextTrail(t, at(3e-5)); // ~3.3 m so với điểm cuối được giữ
    expect(t).toHaveLength(2);
  });

  it("đứng yên 1 phút ở 8 Hz (480 gói nhiễu ±0.5 m) thì vệt không dài thêm", () => {
    let t = nextTrail([], at(0));
    for (let i = 0; i < 480; i++) t = nextTrail(t, at(((i % 9) - 4) * 1e-6));
    expect(t).toHaveLength(1);
  });

  it(`giới hạn ${TRAIL_MAX_POINTS} điểm, cắt từ đầu`, () => {
    let t: readonly LatLon[] = [];
    for (let i = 0; i < TRAIL_MAX_POINTS + 25; i++) t = nextTrail(t, at(i * 1e-4)); // mỗi bước ~11 m
    expect(t).toHaveLength(TRAIL_MAX_POINTS);
    expect(t[0][0]).toBeCloseTo(HOME[0] + 25 * 1e-4, 9);
    expect(t.at(-1)?.[0]).toBeCloseTo(HOME[0] + (TRAIL_MAX_POINTS + 24) * 1e-4, 9);
  });
});
