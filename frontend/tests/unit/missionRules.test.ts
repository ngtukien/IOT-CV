/**
 * Soi gương `backend/tests/test_mission_validation.py` — CÙNG bộ dữ liệu, CÙNG
 * số lỗi kỳ vọng. Mỗi `it` ở đây ghi tên test Python tương ứng.
 *
 * Chống trôi (plan Phase 09 §9.5.2):
 *  - ngưỡng không gõ lại: đọc thẳng giá trị mặc định trong `backend/config.py`
 *    (chính giá trị test Python dựa vào) rồi truyền vào như `status.limits`;
 *  - mã lệnh MAVLink đối chiếu với `MISSION_*` trong `backend/schemas.py`.
 * Backend đổi luật hoặc đổi số → test này đỏ, không phải chờ ra sân mới biết.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { haversineM } from "../../src/lib/geo";
import type { LatLon } from "../../src/lib/geo";
import {
  MAV_CMD,
  MISSION_COMMANDS,
  uploadBlockers,
  validateForUpload,
  validateMission,
  validateMissionStructure,
} from "../../src/lib/missionRules";
import type { RuleLimits } from "../../src/lib/missionRules";
import type { MissionWaypoint } from "../../src/lib/protocol";

const BACKEND = path.resolve(import.meta.dirname, "../../../backend");

function backendDefault(name: string): number {
  const src = readFileSync(path.join(BACKEND, "config.py"), "utf8");
  const m = new RegExp(`^${name} = _env_(?:float|int)\\("${name}", ([0-9.]+)\\)`, "m").exec(src);
  if (!m) throw new Error(`Không tìm thấy giá trị mặc định của ${name} trong backend/config.py`);
  return Number(m[1]);
}

const LIMITS: RuleLimits = {
  min_alt: backendDefault("MIN_ALT"),
  max_alt: backendDefault("MAX_ALT"),
  max_distance_home: backendDefault("MAX_DISTANCE_HOME"),
  max_waypoints: backendDefault("MAX_WAYPOINTS"),
};

const HOME: LatLon = [10.762622, 106.660172];

function wp(seq: number, alt = 5.0, offsetDeg = 0.0, command?: number): MissionWaypoint {
  return { seq, lat: HOME[0] + offsetDeg, lon: HOME[1], alt, ...(command === undefined ? {} : { command }) };
}

function W(seq: number, lat: number, lon: number, alt: number, command?: number): MissionWaypoint {
  return { seq, lat, lon, alt, ...(command === undefined ? {} : { command }) };
}

const msgs = (issues: { message: string }[]) => issues.map((i) => i.message);

describe("ngưỡng lấy từ backend, không gõ cứng", () => {
  it("đọc được đủ 4 giá trị mặc định của backend/config.py", () => {
    // Các test bên dưới (vd 'vượt giới hạn 10', alt 10.01) viết theo những số này.
    expect(LIMITS).toEqual({ min_alt: 2, max_alt: 10, max_distance_home: 50, max_waypoints: 10 });
  });

  it("mã lệnh trùng MISSION_* của backend/schemas.py", () => {
    const src = readFileSync(path.join(BACKEND, "schemas.py"), "utf8");
    const read = (n: string) => Number(new RegExp(`^MISSION_CMD_${n} = (\\d+)`, "m").exec(src)?.[1]);
    expect(MAV_CMD.NAV_WAYPOINT).toBe(read("WAYPOINT"));
    expect(MAV_CMD.NAV_RETURN_TO_LAUNCH).toBe(read("RTL"));
    expect(MAV_CMD.NAV_LAND).toBe(read("LAND"));
    expect(MAV_CMD.NAV_TAKEOFF).toBe(read("TAKEOFF"));
    const whitelist = /^MISSION_COMMANDS = \(([^)]*)\)/m.exec(src)?.[1].split(",").map((s) => s.trim()).filter(Boolean);
    expect(whitelist).toHaveLength(MISSION_COMMANDS.length);
  });

  it("đổi limits truyền vào là đổi kết quả (không có hằng số ẩn)", () => {
    expect(validateMission([wp(1, 25)], HOME, LIMITS)).not.toEqual([]);
    expect(validateMission([wp(1, 25)], HOME, { ...LIMITS, max_alt: 30 })).toEqual([]);
    expect(validateMission([wp(1, 5, 0.001)], HOME, LIMITS)).not.toEqual([]); // ~111 m
    expect(validateMission([wp(1, 5, 0.001)], HOME, { ...LIMITS, max_distance_home: 200 })).toEqual([]);
  });
});

describe("validateMission — cùng bộ dữ liệu với test_mission_validation.py", () => {
  it("test_mission_hop_le", () => {
    expect(validateMission([wp(1), wp(2, 5, 0.0002)], HOME, LIMITS)).toEqual([]);
  });

  it("test_reject_mission_rong", () => {
    const errors = msgs(validateMission([], HOME, LIMITS));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("chưa có điểm nào");
  });

  it("test_reject_altitude_qua_thap", () => {
    expect(msgs(validateMission([wp(1, 0.5)], HOME, LIMITS)).some((e) => e.includes("thấp hơn giới hạn"))).toBe(true);
  });

  it("test_reject_altitude_vuot_gioi_han", () => {
    expect(msgs(validateMission([wp(1, 50)], HOME, LIMITS)).some((e) => e.includes("vượt giới hạn"))).toBe(true);
  });

  it("test_reject_waypoint_qua_xa_home", () => {
    expect(msgs(validateMission([wp(1, 5, 0.01)], HOME, LIMITS)).some((e) => e.includes("cách home"))).toBe(true);
  });

  it("test_reject_toa_do_invalid", () => {
    const bad = [W(1, 95, 106, 5), W(2, 10, 200, 5), W(3, Number.NaN, 106, 5), W(4, 0, 0, 5)];
    const errors = validateMission(bad, HOME, LIMITS);
    expect(errors).toHaveLength(4);
    expect(errors.every((e) => e.message.includes("không hợp lệ"))).toBe(true);
    expect(errors.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
  });

  it("test_reject_qua_nhieu_waypoint", () => {
    const waypoints = Array.from({ length: 12 }, (_, i) => wp(i + 1));
    const errors = validateMission(waypoints, HOME, LIMITS);
    expect(errors.some((e) => e.message.includes("vượt giới hạn 10") && e.seq === null)).toBe(true);
  });

  it("test_gioi_han_co_the_override", () => {
    expect(validateMission([wp(1, 25)], HOME, { ...LIMITS, max_alt: 30 })).toEqual([]);
  });

  it("test_khong_co_home_thi_bo_qua_kiem_tra_khoang_cach", () => {
    expect(validateMission([wp(1, 5, 0.5)], null, LIMITS)).toEqual([]);
  });

  it("test_alt_dung_bang_tran_duoc_phep_vuot_mot_chut_bi_chan", () => {
    expect(validateMission([wp(1, 10)], HOME, LIMITS)).toEqual([]);
    expect(msgs(validateMission([wp(1, 10.01)], HOME, LIMITS)).some((e) => e.includes("vượt giới hạn"))).toBe(true);
  });

  it("test_alt_dung_bang_san_duoc_phep", () => {
    expect(validateMission([wp(1, 2)], HOME, LIMITS)).toEqual([]);
    expect(msgs(validateMission([wp(1, 1.99)], HOME, LIMITS)).some((e) => e.includes("thấp hơn"))).toBe(true);
  });

  it("alt NaN (ô trống) bị chặn như backend (`math.isnan(alt) or alt < min`)", () => {
    const errors = validateMission([wp(1, Number.NaN)], HOME, LIMITS);
    expect(errors).toHaveLength(1);
    expect(errors[0].seq).toBe(1);
  });
});

describe("luật Phase 07 — lệnh, cấu trúc, RTL/LAND/TAKEOFF", () => {
  const chuyenBay = (giua: MissionWaypoint[], cuoi: number = MAV_CMD.NAV_RETURN_TO_LAUNCH) => [
    W(1, HOME[0], HOME[1], 5, MAV_CMD.NAV_TAKEOFF),
    ...giua,
    W(99, 0, 0, 0, cuoi),
  ];

  it("test_luat_7_item_dau_phai_la_takeoff", () => {
    const errors = validateMissionStructure([wp(1), wp(2), W(3, 0, 0, 0, MAV_CMD.NAV_RETURN_TO_LAUNCH)]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("CẤT CÁNH");
  });

  it("test_luat_8_item_cuoi_phai_la_rtl_hoac_land", () => {
    const errors = validateMissionStructure([W(1, HOME[0], HOME[1], 5, MAV_CMD.NAV_TAKEOFF), wp(2)]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("VỀ NHÀ");
  });

  it("test_chuyen_bay_day_du_qua_ca_hai_nhom_luat", () => {
    expect(validateForUpload(chuyenBay([wp(2), wp(3, 5, 0.0002)]), HOME, LIMITS)).toEqual([]);
    expect(validateForUpload(chuyenBay([wp(2)], MAV_CMD.NAV_LAND), HOME, LIMITS)).toEqual([]);
  });

  it("test_rtl_va_land_tai_cho_khong_bi_kiem_toa_do_va_alt", () => {
    expect(validateMission(chuyenBay([wp(2)]), HOME, LIMITS)).toEqual([]);
    expect(validateMission(chuyenBay([wp(2)], MAV_CMD.NAV_LAND), HOME, LIMITS)).toEqual([]);
  });

  it("test_land_co_toa_do_thi_van_bi_kiem_khoang_cach", () => {
    const landXa = W(5, HOME[0] + 0.01, HOME[1], 0, MAV_CMD.NAV_LAND);
    expect(msgs(validateMission([landXa], HOME, LIMITS)).some((e) => e.includes("cách home"))).toBe(true);
  });

  it("test_takeoff_van_bi_kiem_alt", () => {
    const errors = msgs(validateMission([W(1, HOME[0], HOME[1], 50, MAV_CMD.NAV_TAKEOFF)], HOME, LIMITS));
    expect(errors.some((e) => e.includes("vượt giới hạn"))).toBe(true);
  });

  it("test_lenh_ngoai_danh_sach_trang_bi_chan", () => {
    for (const lenh of [183, 209, 400]) {
      const errors = validateMission([W(1, HOME[0], HOME[1], 5, lenh)], HOME, LIMITS);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("không được phép");
    }
  });

  it("test_command_mac_dinh_la_nav_waypoint (thiếu command = 16)", () => {
    // Không có command thì coi là NAV_WAYPOINT: toạ độ (1,1) cách HOME rất xa → lỗi khoảng cách.
    expect(msgs(validateMission([W(1, 1, 1, 5)], HOME, LIMITS)).some((e) => e.includes("cách home"))).toBe(true);
  });

  it("test_land_gan_0_duoi_nua_don_vi_1e7_la_ha_tai_cho", () => {
    expect(validateMission([W(5, 3e-8, -3e-8, 0, MAV_CMD.NAV_LAND)], HOME, LIMITS)).toEqual([]);
    expect(validateMission([W(6, 2e-7, 0, 0, MAV_CMD.NAV_LAND)], HOME, LIMITS)).not.toEqual([]);
  });

  it("số lỗi của validateForUpload = từng điểm + cấu trúc (không báo trùng khi rỗng)", () => {
    expect(validateForUpload([], HOME, LIMITS)).toHaveLength(1);
    // thiếu takeoff + thiếu RTL + alt 50 → 3 lỗi
    expect(validateForUpload([wp(1, 50), wp(2)], HOME, LIMITS)).toHaveLength(3);
  });

  it("thông báo khoảng cách làm tròn như backend (`:.0f`)", () => {
    const d = haversineM(HOME[0], HOME[1], HOME[0] + 0.01, HOME[1]);
    const [issue] = validateMission([wp(3, 5, 0.01)], HOME, LIMITS);
    expect(issue.message).toBe(`WP3: cách home ${d.toFixed(0)} m, vượt giới hạn 50 m`);
  });
});

describe("uploadBlockers — soi gương precheck_mission", () => {
  const ok = { socketOpen: true, limitsKnown: true, fcConnected: true, gpsFixType: 3, ekfOk: true, home: HOME };

  it("sẵn sàng thì không có lý do nào", () => {
    expect(uploadBlockers(ok)).toEqual([]);
  });

  it("mỗi điều kiện thiếu cho đúng một lý do", () => {
    expect(uploadBlockers({ ...ok, socketOpen: false })).toHaveLength(1);
    expect(uploadBlockers({ ...ok, fcConnected: false })).toHaveLength(1);
    expect(uploadBlockers({ ...ok, gpsFixType: 2 })).toEqual(["GPS chưa có 3D fix"]);
    expect(uploadBlockers({ ...ok, gpsFixType: null })).toEqual(["GPS chưa có 3D fix"]);
    expect(uploadBlockers({ ...ok, home: null })).toHaveLength(1);
  });

  it("EKF chưa biết (null) KHÔNG chặn — chỉ chặn khi FC nói hỏng, như backend", () => {
    expect(uploadBlockers({ ...ok, ekfOk: null })).toEqual([]);
    expect(uploadBlockers({ ...ok, ekfOk: false })).toEqual(["EKF chưa khoẻ"]);
  });
});
