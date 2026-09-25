import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OUTPUT_PATH, generateProtocol, readSchema } from "../../scripts/gen-protocol";
import { DOWNLINK_TYPES, ERROR_CODES, ERROR_CODE_LABEL, UPLINK_TYPES, parseServerMessage } from "../../src/lib/protocol";

const frame = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, type: "event", ts: 1758412345.1, data: { code: "link.lost", message: "Mất link", level: "warn" }, ...over });

describe("parseServerMessage", () => {
  it("nhận phong bì hợp lệ", () => {
    const r = parseServerMessage(frame());
    expect(r.kind).toBe("message");
    if (r.kind === "message") {
      expect(r.message.type).toBe("event");
      expect(r.message.data).toMatchObject({ code: "link.lost", level: "warn" });
    }
  });

  it("từ chối v: 2", () => {
    expect(parseServerMessage(frame({ v: 2 })).kind).toBe("invalid");
  });

  it("từ chối phong bì thiếu data", () => {
    const raw = JSON.stringify({ v: 1, type: "telemetry", ts: 1 });
    expect(parseServerMessage(raw).kind).toBe("invalid");
  });

  it("type lạ: bỏ qua trong im lặng, không ném lỗi", () => {
    const run = () => parseServerMessage(frame({ type: "future.thing", data: { x: 1 } }));
    expect(run).not.toThrow();
    expect(run()).toEqual({ kind: "ignored", type: "future.thing" });
  });

  it("rác không phải JSON trả invalid, không ném", () => {
    for (const raw of ["}{ rác", "", "null", "42", "[]"]) {
      expect(() => parseServerMessage(raw)).not.toThrow();
      expect(parseServerMessage(raw).kind).toBe("invalid");
    }
    expect(parseServerMessage(new ArrayBuffer(4)).kind).toBe("invalid");
  });

  it("data sai kiểu theo hợp đồng thì invalid (level ngoài enum)", () => {
    const r = parseServerMessage(frame({ data: { code: "x", message: "y", level: "panic" } }));
    expect(r.kind).toBe("invalid");
  });

  it("trường lạ trong data được bỏ qua (tương thích tiến)", () => {
    const r = parseServerMessage(
      JSON.stringify({ v: 1, type: "telemetry", ts: 1, data: { mode: "GUIDED", armed: false, field_moi_cua_phase_sau: 5 } }),
    );
    expect(r.kind).toBe("message");
  });
});

describe("chống trôi khỏi hợp đồng (backend/ws-contract.schema.json)", () => {
  const schema = readSchema();

  it("protocol.generated.ts đã commit khớp đúng bản sinh lại từ schema", async () => {
    // Đỏ ở đây nghĩa là schema đã đổi mà chưa sinh lại: chạy `pnpm gen:protocol`.
    const committed = readFileSync(OUTPUT_PATH, "utf8");
    expect(await generateProtocol(schema)).toBe(committed);
  });

  it("mọi type chiều xuống và chiều lên có mặt, không thừa không thiếu", () => {
    expect([...DOWNLINK_TYPES].sort()).toEqual(Object.keys(schema.downlink).sort());
    expect([...UPLINK_TYPES].sort()).toEqual(Object.keys(schema.uplink).sort());
  });

  it("mọi mã lỗi của hợp đồng có nhãn tiếng Việt, không nhãn nào thừa", () => {
    expect(Object.keys(ERROR_CODE_LABEL).sort()).toEqual([...ERROR_CODES].sort());
    expect([...ERROR_CODES].sort()).toEqual([...schema.error_codes].sort());
  });
});
