/** Sửa bản nháp mission ở trang Nhiệm vụ: kéo, chèn, đảo, hoàn tác / làm lại. */
import { beforeEach, describe, expect, it } from "vitest";

import { MAV_CMD } from "../../src/lib/missionRules";
import { UNDO_LIMIT, useMissionStore } from "../../src/store/mission";

const initial = useMissionStore.getState();
const s = () => useMissionStore.getState();
const lats = () => s().waypoints.map((w) => w.lat);

beforeEach(() => useMissionStore.setState(initial, true));

describe("sửa bản nháp", () => {
  it("chèn vào giữa giữ nguyên id các điểm khác", () => {
    s().addWaypoint(1, 1, 5);
    s().addWaypoint(3, 3, 5);
    const ids = s().waypoints.map((w) => w.id);
    s().insertAt(1, 2, 2, 5);
    expect(lats()).toEqual([1, 2, 3]);
    expect([s().waypoints[0].id, s().waypoints[2].id]).toEqual(ids);
  });

  it("kéo điểm (moveTo) chỉ đổi toạ độ, giữ độ cao", () => {
    s().addWaypoint(1, 1, 7);
    const id = s().waypoints[0].id;
    s().moveTo(id, 9, 8);
    expect(s().waypoints[0]).toMatchObject({ id, lat: 9, lon: 8, alt: 7 });
  });

  it("đảo chiều, đặt độ cao hàng loạt", () => {
    s().addWaypoints([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, { lat: 3, lon: 3 }], 5);
    s().reverse();
    expect(lats()).toEqual([3, 2, 1]);
    s().setAllAlt(8);
    expect(s().waypoints.every((w) => w.alt === 8)).toBe(true);
  });

  it("nạp bản nháp đầy đủ (từ thư viện / file)", () => {
    s().loadDraft({ takeoffAlt: 6, finalCommand: MAV_CMD.NAV_LAND, waypoints: [{ lat: 4, lon: 4, alt: 4 }] });
    expect(s().takeoffAlt).toBe(6);
    expect(s().finalCommand).toBe(MAV_CMD.NAV_LAND);
    expect(lats()).toEqual([4]);
  });
});

describe("hoàn tác / làm lại", () => {
  it("mỗi thay đổi một bước; làm lại trả đúng trạng thái; sửa mới xoá nhánh làm lại", () => {
    s().addWaypoint(1, 1, 5);
    s().addWaypoint(2, 2, 5);
    s().undo();
    expect(lats()).toEqual([1]);
    s().redo();
    expect(lats()).toEqual([1, 2]);
    s().undo();
    s().addWaypoint(9, 9, 5);
    expect(s().future).toHaveLength(0);
    expect(lats()).toEqual([1, 9]);
  });

  it("thay đổi không làm gì (đảo 1 điểm, xoá bản nháp rỗng) không tạo bước hoàn tác", () => {
    s().clear();
    s().addWaypoint(1, 1, 5);
    const steps = s().past.length;
    s().reverse();
    s().setFinalCommand(s().finalCommand);
    expect(s().past.length).toBe(steps);
  });

  it("hoàn tác được cả độ cao cất cánh và lệnh cuối", () => {
    s().setTakeoffAlt(8);
    s().setFinalCommand(MAV_CMD.NAV_LAND);
    s().undo();
    s().undo();
    expect(s().takeoffAlt).toBe(initial.takeoffAlt);
    expect(s().finalCommand).toBe(MAV_CMD.NAV_RETURN_TO_LAUNCH);
  });

  it(`giữ tối đa ${UNDO_LIMIT} bước`, () => {
    for (let i = 0; i < UNDO_LIMIT + 10; i += 1) s().addWaypoint(i, i, 5);
    expect(s().past.length).toBe(UNDO_LIMIT);
  });

  it("undo khi không còn gì: không đổi gì", () => {
    const before = s();
    s().undo();
    expect(s()).toBe(before);
  });
});
