import { describe, expect, it } from "vitest";

import {
  NO_VALUE,
  batteryTone,
  climbTone,
  formatClock,
  formatDegrees,
  formatHeading,
  formatNumber,
  formatSigned,
  linkAgeTone,
} from "../../src/lib/format";

describe("null hiện —, không bao giờ 0", () => {
  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])("formatNumber(%s)", (v) => {
    expect(formatNumber(v, 1, "m")).toBe(NO_VALUE);
    expect(formatSigned(v, 1, "m/s")).toBe(NO_VALUE);
    expect(formatHeading(v)).toBe(NO_VALUE);
    expect(formatClock(v)).toBe(NO_VALUE);
    expect(formatDegrees(v)).toBe(NO_VALUE);
  });

  it("số 0 thật thì vẫn hiện 0 kèm đơn vị, và không bao giờ -0.0", () => {
    expect(formatNumber(0, 1, "m")).toBe("0.0 m");
    // SITL nằm đất báo relative_alt = -0.02 — đã thấy "-0.0" trên PFD ở nghiệm thu.
    expect(formatNumber(-0.02, 1, "m")).toBe("0.0 m");
    expect(formatNumber(-0.02, 1, "")).toBe("0.0");
    expect(formatNumber(-0.26, 1, "m")).toBe("-0.3 m");
  });

  it("thiếu số đo thì ô màu là neutral, không phải ok", () => {
    expect(batteryTone(null)).toBe("neutral");
    expect(linkAgeTone(undefined)).toBe("neutral");
    expect(climbTone(null)).toBe("neutral");
  });
});

describe("làm tròn và đơn vị", () => {
  it("1 chữ số thập phân, luôn kèm đơn vị", () => {
    expect(formatNumber(4.94, 1, "m")).toBe("4.9 m");
    expect(formatNumber(1.0234, 2, "m/s")).toBe("1.02 m/s");
    expect(formatNumber(78, 0, "%")).toBe("78 %");
  });

  it("climb_rate có dấu: dương +, âm -, 0 không dấu", () => {
    expect(formatSigned(0.43, 1, "m/s")).toBe("+0.4 m/s");
    expect(formatSigned(-1.25, 1, "m/s")).toMatch(/^-1\.[23] m\/s$/);
    expect(formatSigned(0, 1, "m/s")).toBe("0.0 m/s");
    // -0.01 làm tròn về 0 — không được in "-0.0".
    expect(formatSigned(-0.01, 1, "m/s")).toBe("0.0 m/s");
  });

  it("hướng mũi chuẩn hoá 0–359", () => {
    expect(formatHeading(123.4)).toBe("123°");
    expect(formatHeading(-10)).toBe("350°");
    expect(formatHeading(360)).toBe("0°");
  });

  it("góc roll/pitch có dấu, không có -0", () => {
    expect(formatDegrees(-3.4)).toBe("-3°");
    expect(formatDegrees(-0.2)).toBe("0°");
    expect(formatDegrees(12.6)).toBe("13°");
  });

  it("giờ HH:mm:ss từ epoch GIÂY", () => {
    const d = new Date(2026, 8, 25, 7, 5, 9);
    expect(formatClock(d.getTime() / 1000)).toBe("07:05:09");
  });
});

describe("ngưỡng tô màu", () => {
  it("tuổi link: >1000 vàng, >3000 đỏ", () => {
    expect(linkAgeTone(120)).toBe("ok");
    expect(linkAgeTone(1500)).toBe("warn");
    expect(linkAgeTone(3500)).toBe("danger");
  });

  it("pin dưới 25% đỏ", () => {
    expect(batteryTone(24)).toBe("danger");
    expect(batteryTone(25)).toBe("ok");
  });
});
