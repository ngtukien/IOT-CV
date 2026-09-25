import { describe, expect, it } from "vitest";

import {
  GAMEPAD_DEADZONE,
  YAW_RATE_DEG_S,
  applyDeadzone,
  axesFromGamepad,
  isZeroVelocity,
  vectorFromKeys,
} from "../../src/lib/velocityMapping";

const MAX = 1.0;

describe("bảng phím → vận tốc (NED, body frame)", () => {
  it("W / ↑ tiến: vx > 0", () => {
    expect(vectorFromKeys(["KeyW"], MAX)).toEqual({ vx: 1, vy: 0, vz: 0, yaw_rate: 0 });
    expect(vectorFromKeys(["ArrowUp"], MAX).vx).toBe(1);
    expect(vectorFromKeys(["KeyS"], MAX).vx).toBe(-1);
  });

  it("D sang phải vy > 0, A sang trái vy < 0", () => {
    expect(vectorFromKeys(["KeyD"], MAX).vy).toBe(1);
    expect(vectorFromKeys(["KeyA"], MAX).vy).toBe(-1);
  });

  it("R là LÊN nên vz ÂM; F là xuống nên vz dương — đừng đảo", () => {
    expect(vectorFromKeys(["KeyR"], MAX).vz).toBeLessThan(0);
    expect(vectorFromKeys(["KeyR"], MAX).vz).toBe(-0.5);
    expect(vectorFromKeys(["KeyF"], MAX).vz).toBeGreaterThan(0);
  });

  it("Q/E xoay ∓30 °/s", () => {
    expect(vectorFromKeys(["KeyQ"], MAX).yaw_rate).toBe(-YAW_RATE_DEG_S);
    expect(vectorFromKeys(["KeyE"], MAX).yaw_rate).toBe(YAW_RATE_DEG_S);
  });

  it("hệ số nhân với max_velocity của backend", () => {
    expect(vectorFromKeys(["KeyW"], 2.5).vx).toBe(2.5);
    expect(vectorFromKeys(["KeyR"], 2).vz).toBe(-1);
  });

  it("giữ W+D không vượt max_velocity (không nhanh hơn √2 lần)", () => {
    const v = vectorFromKeys(["KeyW", "KeyD"], MAX);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(MAX, 9);
    expect(v.vx).toBeCloseTo(Math.SQRT1_2, 9);
    expect(v.vy).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it("W+↑ cùng hướng vẫn chỉ max_velocity; W+S triệt nhau về 0", () => {
    expect(vectorFromKeys(["KeyW", "ArrowUp"], MAX).vx).toBe(1);
    expect(vectorFromKeys(["KeyW", "KeyS"], MAX).vx).toBe(0);
  });

  it("giữ R không làm chậm đi ngang", () => {
    const v = vectorFromKeys(["KeyW", "KeyR"], MAX);
    expect(v.vx).toBe(1);
    expect(v.vz).toBe(-0.5);
  });

  it("tập phím rỗng → (0,0,0)", () => {
    const v = vectorFromKeys([], MAX);
    expect(v).toEqual({ vx: 0, vy: 0, vz: 0, yaw_rate: 0 });
    expect(isZeroVelocity(v)).toBe(true);
    expect(Object.is(v.vx, -0)).toBe(false);
  });

  it("phím không thuộc bảng bị bỏ qua", () => {
    expect(isZeroVelocity(vectorFromKeys(["KeyZ", "Enter"], MAX))).toBe(true);
  });
});

describe("tay cầm: vùng chết 0.15", () => {
  it("cắt được giá trị 0.1 (cần trôi quanh 0)", () => {
    expect(applyDeadzone(0.1)).toBe(0);
    expect(applyDeadzone(-0.1)).toBe(0);
    expect(applyDeadzone(GAMEPAD_DEADZONE)).toBe(0);
  });

  it("ra khỏi vùng chết bắt đầu từ 0, đẩy hết cỡ là 1", () => {
    expect(applyDeadzone(0.16)).toBeGreaterThan(0);
    expect(applyDeadzone(0.16)).toBeLessThan(0.05);
    expect(applyDeadzone(1)).toBe(1);
    expect(applyDeadzone(-1)).toBe(-1);
  });

  it("cần trái đẩy lên (trục 1 âm) là tiến; cần phải đẩy lên (trục 3 âm) là lên (vz âm)", () => {
    const a = axesFromGamepad([0, -1, 0, -1]);
    expect(a.vx).toBe(1);
    expect(a.vz).toBeLessThan(0);
  });

  it("cần trôi 0.1 mọi trục → không gửi gì", () => {
    expect(axesFromGamepad([0.1, -0.1, 0.08, 0.12])).toEqual({ vx: 0, vy: 0, vz: 0, yaw: 0 });
  });
});
