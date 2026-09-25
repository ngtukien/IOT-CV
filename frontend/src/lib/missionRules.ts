/**
 * Kiểm tra mission TẠI CHỖ — bản soi gương của backend.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Kiểm ở web KHÔNG thay thế kiểm ở backend. Hai bên chạy song song và     ║
 * ║  phục vụ hai mục đích khác nhau:                                         ║
 * ║   - web: phản hồi TỨC THÌ trong lúc gõ, khoá nút NẠP kèm lý do;          ║
 * ║   - backend: CỔNG CHẶN THẬT. Một script, một tab khác, một kẻ nghịch     ║
 * ║     ngợm đều gửi thẳng được vào WebSocket mà không qua trang này.        ║
 * ║  Đừng bao giờ bỏ bớt kiểm tra ở backend "cho đỡ trùng".                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Soi gương ĐÚNG hành vi (không chỉ tên luật) của `validate_mission()` +
 * `validate_mission_structure()` trong `backend/mavlink/mission.py`:
 *  - lệnh ngoài danh sách trắng bị chặn, và không kiểm gì thêm ở item đó;
 *  - RTL không mang toạ độ → không kiểm toạ độ, độ cao, khoảng cách;
 *  - TAKEOFF cất cánh tại chỗ → chỉ kiểm độ cao;
 *  - LAND ở (0, 0) trên dây = hạ tại chỗ; độ cao của LAND không bị kiểm.
 *
 * Chống trôi (plan Phase 09 §9.5.2): ngưỡng LUÔN lấy từ `status.limits` truyền
 * vào, không có hằng số ngưỡng nào ở đây. `tests/unit/missionRules.test.ts`
 * chạy đúng bộ dữ liệu của `backend/tests/test_mission_validation.py` và kỳ
 * vọng cùng số lỗi. Backend thêm luật mới → phải thêm vào đây, không thì test
 * đỏ ở phase đó.
 */
import type { LimitsPayload, MissionWaypoint } from "./protocol";
import { GPS_FIX_3D } from "./protocol";
import { haversineM } from "./geo";
import type { LatLon } from "./geo";

// MAV_CMD của mission item mà web được gửi. Giá trị cố định của chuẩn MAVLink,
// cùng danh sách trắng với `MISSION_COMMANDS` trong `backend/schemas.py` —
// `missionRules.test.ts` đọc thẳng file đó để bắt trôi.
export const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_RETURN_TO_LAUNCH: 20,
  NAV_LAND: 21,
  NAV_TAKEOFF: 22,
} as const;

export const MISSION_COMMANDS: readonly number[] = Object.values(MAV_CMD);

export type RuleLimits = Pick<LimitsPayload, "min_alt" | "max_alt" | "max_distance_home" | "max_waypoints">;

/** Một lỗi. `seq` = số thứ tự item bị lỗi (để tô đỏ đúng dòng), `null` = lỗi của cả mission. */
export interface MissionIssue {
  seq: number | null;
  message: string;
}

const COMMAND_LABEL: Record<number, string> = {
  [MAV_CMD.NAV_WAYPOINT]: "WAYPOINT",
  [MAV_CMD.NAV_RETURN_TO_LAUNCH]: "VỀ NHÀ (RTL)",
  [MAV_CMD.NAV_LAND]: "HẠ CÁNH",
  [MAV_CMD.NAV_TAKEOFF]: "CẤT CÁNH",
};

/** `12.5`, `10`, `0.5` — số gọn, không đuôi `.00`. */
function num(v: number): string {
  return String(Number(v.toFixed(2)));
}

function isValidCoordinate(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  // (0, 0) gần như luôn là lỗi dữ liệu chứ không phải waypoint thật.
  return !(lat === 0 && lon === 0);
}

/**
 * (lat, lon) có thành (0, 0) trên dây không. MISSION_ITEM_INT chở toạ độ dạng
 * số nguyên nhân 1e7, nên dưới nửa đơn vị 1e-7 độ là ra 0 — giống
 * `_ra_day_la_0` của backend.
 */
function isZeroOnWire(lat: number, lon: number): boolean {
  const half = 0.5e-7;
  return Math.abs(lat) < half && Math.abs(lon) < half;
}

/** Luật từng item — soi gương `validate_mission()`. */
export function validateMission(
  waypoints: readonly MissionWaypoint[],
  home: LatLon | null,
  limits: RuleLimits,
): MissionIssue[] {
  const issues: MissionIssue[] = [];

  if (waypoints.length === 0) {
    issues.push({ seq: null, message: "Mission chưa có điểm nào" });
    return issues;
  }

  if (waypoints.length > limits.max_waypoints) {
    issues.push({
      seq: null,
      message: `Mission có ${waypoints.length} điểm, vượt giới hạn ${limits.max_waypoints}`,
    });
  }

  for (const wp of waypoints) {
    const command = wp.command ?? MAV_CMD.NAV_WAYPOINT;
    if (!MISSION_COMMANDS.includes(command)) {
      const allowed = MISSION_COMMANDS.map((c) => `${c} ${COMMAND_LABEL[c]}`).join(", ");
      issues.push({ seq: wp.seq, message: `WP${wp.seq}: lệnh ${command} không được phép — chỉ nhận ${allowed}` });
      continue;
    }
    if (command === MAV_CMD.NAV_RETURN_TO_LAUNCH) continue;

    const landInPlace = command === MAV_CMD.NAV_LAND && isZeroOnWire(wp.lat, wp.lon);
    const checkCoords = command !== MAV_CMD.NAV_TAKEOFF && !landInPlace;
    if (checkCoords && !isValidCoordinate(wp.lat, wp.lon)) {
      issues.push({ seq: wp.seq, message: `WP${wp.seq}: toạ độ không hợp lệ` });
      continue;
    }

    // Độ cao của LAND là mặt đất — không có trần/sàn nào áp vào được.
    if (command !== MAV_CMD.NAV_LAND) {
      if (Number.isNaN(wp.alt)) {
        issues.push({ seq: wp.seq, message: `WP${wp.seq}: chưa nhập độ cao` });
      } else if (wp.alt < limits.min_alt) {
        issues.push({ seq: wp.seq, message: `WP${wp.seq}: độ cao ${num(wp.alt)} m thấp hơn giới hạn ${num(limits.min_alt)} m` });
      } else if (wp.alt > limits.max_alt) {
        issues.push({ seq: wp.seq, message: `WP${wp.seq}: độ cao ${num(wp.alt)} m vượt giới hạn ${num(limits.max_alt)} m` });
      }
    }

    if (home && checkCoords) {
      const distance = haversineM(home[0], home[1], wp.lat, wp.lon);
      if (distance > limits.max_distance_home) {
        issues.push({
          seq: wp.seq,
          message: `WP${wp.seq}: cách home ${distance.toFixed(0)} m, vượt giới hạn ${limits.max_distance_home.toFixed(0)} m`,
        });
      }
    }
  }

  return issues;
}

/** Luật hình dạng cả chuyến bay (luật 7–8) — soi gương `validate_mission_structure()`. */
export function validateMissionStructure(waypoints: readonly MissionWaypoint[]): MissionIssue[] {
  if (waypoints.length === 0) return []; // "rỗng" validateMission đã báo; không báo trùng.
  const issues: MissionIssue[] = [];
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if ((first.command ?? MAV_CMD.NAV_WAYPOINT) !== MAV_CMD.NAV_TAKEOFF) {
    issues.push({ seq: first.seq, message: "Mission phải bắt đầu bằng CẤT CÁNH" });
  }
  const lastCommand = last.command ?? MAV_CMD.NAV_WAYPOINT;
  if (lastCommand !== MAV_CMD.NAV_RETURN_TO_LAUNCH && lastCommand !== MAV_CMD.NAV_LAND) {
    issues.push({ seq: last.seq, message: "Mission phải kết thúc bằng VỀ NHÀ hoặc HẠ CÁNH" });
  }
  return issues;
}

/** Mọi luật đường nạp phải qua — soi gương `validate_for_upload()`. */
export function validateForUpload(
  waypoints: readonly MissionWaypoint[],
  home: LatLon | null,
  limits: RuleLimits,
): MissionIssue[] {
  return [...validateMission(waypoints, home, limits), ...validateMissionStructure(waypoints)];
}

/**
 * Lý do CHƯA nạp được dù mission đúng luật — soi gương các cổng rẻ trong
 * `precheck_mission()` của backend (link, GPS 3D, EKF, home). Trả mảng rỗng
 * khi sẵn sàng.
 *
 * Tách khỏi luật mission vì đây là trạng thái MÁY BAY, không phải lỗi người
 * soạn: sửa bản nháp không làm chúng biến mất.
 */
export function uploadBlockers(input: {
  socketOpen: boolean;
  limitsKnown: boolean;
  fcConnected: boolean;
  gpsFixType: number | null | undefined;
  ekfOk: boolean | null | undefined;
  home: LatLon | null;
}): string[] {
  const reasons: string[] = [];
  if (!input.socketOpen) reasons.push("Chưa nối được backend");
  if (!input.limitsKnown) reasons.push("Chưa nhận giới hạn an toàn từ backend");
  if (!input.fcConnected) reasons.push("Chưa có liên lạc với flight controller");
  if (input.gpsFixType == null || input.gpsFixType < GPS_FIX_3D) reasons.push("GPS chưa có 3D fix");
  if (input.ekfOk === false) reasons.push("EKF chưa khoẻ");
  if (!input.home) reasons.push("Chưa có điểm home — arm drone hoặc chờ GPS fix");
  return reasons;
}
