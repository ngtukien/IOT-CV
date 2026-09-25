import { beforeEach, describe, expect, it } from "vitest";

import type { LatLon } from "../../src/lib/geo";
import { MAV_CMD, validateForUpload } from "../../src/lib/missionRules";
import type { AckPayload, ErrorPayload } from "../../src/lib/protocol";
import {
  SOCKET_LOST_MESSAGE,
  effectiveDefaultAlt,
  sameMission,
  toMissionWaypoints,
  useMissionStore,
} from "../../src/store/mission";

const initial = useMissionStore.getState();
const HOME: LatLon = [10.762622, 106.660172];
const LIMITS = { min_alt: 2, max_alt: 10, max_distance_home: 50, max_waypoints: 10 };

const s = () => useMissionStore.getState();
const items = () => toMissionWaypoints(s(), HOME);

function add4() {
  for (let i = 1; i <= 4; i++) s().addWaypoint(HOME[0] + i * 5e-5, HOME[1], 5);
}

describe("bản nháp mission", () => {
  beforeEach(() => useMissionStore.setState(initial, true));

  it("4 điểm bấm trên bản đồ → 6 item: CẤT CÁNH + 4 + VỀ NHÀ, seq 1..6", () => {
    add4();
    const list = items();
    expect(list).toHaveLength(6);
    expect(list.map((w) => w.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(list[0].command).toBe(MAV_CMD.NAV_TAKEOFF);
    expect(list.slice(1, 5).every((w) => w.command === MAV_CMD.NAV_WAYPOINT)).toBe(true);
    expect(list[5].command).toBe(MAV_CMD.NAV_RETURN_TO_LAUNCH);
    // Và mission đó qua được đúng bộ luật của backend.
    expect(validateForUpload(list, HOME, LIMITS)).toEqual([]);
  });

  it("bản nháp rỗng vẫn là mission đúng cấu trúc (cất cánh rồi về) — không thể soạn ra mission vi phạm luật 7–8", () => {
    const list = items();
    expect(list.map((w) => w.command)).toEqual([MAV_CMD.NAV_TAKEOFF, MAV_CMD.NAV_RETURN_TO_LAUNCH]);
    expect(validateForUpload(list, HOME, LIMITS)).toEqual([]);
  });

  it("đổi sang HẠ CÁNH thì item cuối là LAND tại chỗ (0, 0)", () => {
    add4();
    s().setFinalCommand(MAV_CMD.NAV_LAND);
    const last = items().at(-1);
    expect(last).toMatchObject({ command: MAV_CMD.NAV_LAND, lat: 0, lon: 0 });
    expect(validateForUpload(items(), HOME, LIMITS)).toEqual([]);
  });

  it("đổi thứ tự: seq đánh lại liên tục, id giữ nguyên theo điểm", () => {
    add4();
    const ids = s().waypoints.map((w) => w.id);
    s().move(ids[2], "up");
    expect(s().waypoints.map((w) => w.id)).toEqual([ids[0], ids[2], ids[1], ids[3]]);
    expect(items().map((w) => w.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    // Điểm thứ ba cũ giờ là WP3, mang đúng toạ độ của nó.
    expect(items()[2].lat).toBeCloseTo(HOME[0] + 3 * 5e-5, 12);
  });

  it("đổi thứ tự ở biên thì không làm gì", () => {
    add4();
    const before = s().waypoints;
    s().move(before[0].id, "up");
    s().move(before[3].id, "down");
    expect(s().waypoints).toEqual(before);
  });

  it("xoá không làm seq nhảy cóc", () => {
    add4();
    s().remove(s().waypoints[1].id);
    expect(items().map((w) => w.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  it("sửa độ cao chỉ đổi đúng điểm có id đó", () => {
    add4();
    const target = s().waypoints[2];
    s().updateAlt(target.id, 7.5);
    expect(s().waypoints.map((w) => w.alt)).toEqual([5, 5, 7.5, 5]);
  });

  it("độ cao mặc định kẹp vào giới hạn backend; chưa có giới hạn thì giữ nguyên", () => {
    expect(effectiveDefaultAlt(5, LIMITS)).toBe(5);
    expect(effectiveDefaultAlt(5, { min_alt: 8, max_alt: 20 })).toBe(8);
    expect(effectiveDefaultAlt(5, { min_alt: 1, max_alt: 3 })).toBe(3);
    expect(effectiveDefaultAlt(5, null)).toBe(5);
  });
});

describe("sameMission", () => {
  beforeEach(() => useMissionStore.setState(initial, true));

  it("trùng khi y hệt, khác khi sửa độ cao hoặc thêm điểm", () => {
    add4();
    const sent = items();
    expect(sameMission(items(), sent)).toBe(true);
    s().updateAlt(s().waypoints[0].id, 6);
    expect(sameMission(items(), sent)).toBe(false);
  });
});

describe("trạng thái nạp mission", () => {
  beforeEach(() => useMissionStore.setState(initial, true));

  const ack = (status: AckPayload["status"], ref = "c-7", detail: AckPayload["detail"] = null): AckPayload => ({
    ref,
    command: "cmd.mission.upload",
    status,
    detail,
  });
  const err = (code: string, ref = "c-7", detail: ErrorPayload["detail"] = null): ErrorPayload => ({
    ref,
    command: "cmd.mission.upload",
    code,
    message: `lỗi ${code}`,
    detail,
  });

  it("đường vui: kiểm tra → nạp x/y → đọc lại → xong", () => {
    s().beginUpload("c-7");
    expect(s().uploadState).toBe("validating");
    expect(s().onAck(ack("accepted"))).toBe(true);
    expect(s().uploadState).toBe("uploading");
    s().onProgress(3, 7);
    expect(s()).toMatchObject({ uploadState: "uploading", uploadProgress: { sent: 3, total: 7 } });
    s().onProgress(7, 7);
    expect(s().uploadState).toBe("reading-back");
    expect(s().onAck(ack("done", "c-7", { count: 6, readback_ok: true }))).toBe(true);
    expect(s()).toMatchObject({ uploadState: "done", pendingRef: null });
  });

  it("ack/error của lệnh khác (ref khác) không đụng tới mission", () => {
    s().beginUpload("c-7");
    expect(s().onAck(ack("accepted", "c-3"))).toBe(false);
    expect(s().onError(err("timeout", "c-3"))).toBe(false);
    expect(s().uploadState).toBe("validating");
  });

  it("`done` mà không có readback_ok === true thì KHÔNG coi là đã nạp", () => {
    s().beginUpload("c-7");
    s().onAck(ack("done", "c-7", { count: 6 }));
    expect(s().uploadState).toBe("error");
  });

  it("validation_failed: giữ nguyên văn danh sách lỗi của backend", () => {
    s().beginUpload("c-7");
    expect(s().onError(err("validation_failed", "c-7", { errors: ["WP2: a", "WP3: b"] }))).toBe(true);
    expect(s()).toMatchObject({ uploadState: "error", lastErrorCode: "validation_failed", lastErrors: ["WP2: a", "WP3: b"] });
  });

  it("lỗi không có detail.errors thì dùng message", () => {
    s().beginUpload("c-7");
    s().onError(err("timeout"));
    expect(s().lastErrors).toEqual(["lỗi timeout"]);
  });

  it("mission.progress của tab KHÁC (mình không đang nạp) bị bỏ qua", () => {
    s().onProgress(2, 7);
    expect(s()).toMatchObject({ uploadState: "idle", uploadProgress: null });
  });

  it("mất socket giữa lúc nạp → lỗi rõ ràng, không treo ở 'đang nạp' mãi", () => {
    s().beginUpload("c-7");
    s().onAck(ack("accepted"));
    s().onSocketLost();
    expect(s()).toMatchObject({ uploadState: "error", pendingRef: null, lastErrors: [SOCKET_LOST_MESSAGE] });
  });

  it("mất socket khi KHÔNG nạp thì không đổi gì", () => {
    s().onSocketLost();
    expect(s().uploadState).toBe("idle");
  });
});
