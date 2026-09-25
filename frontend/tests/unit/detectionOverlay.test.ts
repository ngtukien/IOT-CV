import { describe, expect, it } from "vitest";

import { BOX_EXPIRE_MS, BOX_STALE_MS, boxFreshness, drawDetection, scaleBox } from "../../src/lib/detection";
import type { DetectionPayload } from "../../src/lib/protocol";

const DETECTION: DetectionPayload = {
  frame_id: 7,
  frame_ts: 1234.5,
  width: 320,
  height: 240,
  boxes: [{ x1: 10, y1: 20, x2: 110, y2: 70, confidence: 0.9, label: "fake" }],
};

/** Canvas 2D giả: ghi lại mọi strokeRect để kiểm toạ độ đã vẽ. */
function fakeCtx() {
  const rects: number[][] = [];
  const ctx = {
    clearRect: () => {},
    strokeRect: (...a: number[]) => rects.push(a),
    fillRect: () => {},
    fillText: () => {},
    measureText: () => ({ width: 40 }),
    globalAlpha: 1,
    lineWidth: 1,
    font: "",
    strokeStyle: "",
    fillStyle: "",
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

describe("quy đổi toạ độ box → canvas", () => {
  it("canvas 640×480, khung gốc 320×240 → hệ số 2.0", () => {
    expect(scaleBox(DETECTION.boxes![0], { width: 640, height: 480 }, DETECTION)).toEqual({ x: 20, y: 40, w: 200, h: 100 });
  });

  it("hệ số lấy từ message, không gõ cứng cỡ khung: khung 640×480 trên canvas 640×480 là 1.0", () => {
    const vga = { ...DETECTION, width: 640, height: 480 };
    expect(scaleBox(vga.boxes![0], { width: 640, height: 480 }, vga)).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });

  it("hai trục độc lập (canvas bị co không đều)", () => {
    expect(scaleBox({ x1: 0, y1: 0, x2: 320, y2: 240 }, { width: 160, height: 480 }, DETECTION)).toEqual({ x: 0, y: 0, w: 160, h: 480 });
  });

  it("drawDetection vẽ đúng toạ độ đã quy đổi", () => {
    const { ctx, rects } = fakeCtx();
    expect(drawDetection(ctx, { width: 640, height: 480 }, DETECTION, "fresh")).toBe(1);
    expect(rects).toEqual([[20, 40, 200, 100]]);
  });
});

describe("box cũ", () => {
  it("≤ 1 s tươi, > 1 s mờ, > 3 s bỏ", () => {
    expect(boxFreshness(1000, 1000 + BOX_STALE_MS)).toBe("fresh");
    expect(boxFreshness(1000, 1001 + BOX_STALE_MS)).toBe("stale");
    expect(boxFreshness(1000, 1001 + BOX_EXPIRE_MS)).toBe("expired");
    expect(boxFreshness(null, 5)).toBe("expired");
  });

  it("box cũ > 3 s không được vẽ", () => {
    const { ctx, rects } = fakeCtx();
    expect(drawDetection(ctx, { width: 640, height: 480 }, DETECTION, boxFreshness(0, 3500))).toBe(0);
    expect(rects).toEqual([]);
  });

  it("box cũ > 1 s vẫn vẽ nhưng mờ", () => {
    const { ctx, rects } = fakeCtx();
    let alphaAtStroke = -1;
    ctx.strokeRect = () => {
      alphaAtStroke = ctx.globalAlpha;
      rects.push([]);
    };
    drawDetection(ctx, { width: 640, height: 480 }, DETECTION, "stale");
    expect(alphaAtStroke).toBeLessThan(1);
  });
});

describe("dữ liệu biên không làm sập overlay", () => {
  it("boxes: [] và boxes vắng mặt không ném lỗi", () => {
    const { ctx } = fakeCtx();
    expect(drawDetection(ctx, { width: 640, height: 480 }, { ...DETECTION, boxes: [] }, "fresh")).toBe(0);
    const { boxes: _omit, ...noBoxes } = DETECTION;
    expect(drawDetection(ctx, { width: 640, height: 480 }, noBoxes, "fresh")).toBe(0);
    expect(drawDetection(ctx, { width: 640, height: 480 }, null, "fresh")).toBe(0);
  });

  it("khung cỡ 0 không chia cho 0", () => {
    const { ctx, rects } = fakeCtx();
    expect(drawDetection(ctx, { width: 640, height: 480 }, { ...DETECTION, width: 0 }, "fresh")).toBe(0);
    expect(rects).toEqual([]);
  });
});
