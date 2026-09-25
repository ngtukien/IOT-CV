/**
 * Hợp đồng WebSocket phía web — BẢN DỊCH, không phải bản gốc.
 *
 * LUẬT CỨNG: bản gốc là mục "Hợp đồng WebSocket" trong
 * `plans/phase-05-backend-mavlink-telemetry.md`. Phase 08/09/10 KHÔNG được thêm
 * `type`, thêm trường, hay đổi đơn vị ở đây. Thiếu gì → sửa hợp đồng Phase 05
 * trước, rồi `backend/schemas.py`, rồi `pnpm gen:protocol`, trong CÙNG một commit.
 *
 * Hai lớp, cả hai lấy từ cùng một file `backend/ws-contract.schema.json`:
 *   - Type TypeScript — `protocol.generated.ts`, sinh bằng máy. Biến mất khi
 *     biên dịch nên không bảo vệ gì trước dữ liệu hỏng từ mạng.
 *   - Kiểm tra lúc chạy — zod dựng THẲNG từ JSON Schema (`z.fromJSONSchema`).
 *     Không có bản zod gõ tay nào để trôi khỏi hợp đồng.
 */
import { z } from "zod";

import contract from "../../../backend/ws-contract.schema.json";
import type { CmdMode, DownlinkPayloads, DownlinkType, ErrorCode, EventPayload } from "./protocol.generated";
import { CONTRACT_VERSION, DOWNLINK_TYPES } from "./protocol.generated";

export * from "./protocol.generated";

// ---------------------------------------------------------------------------
// Phong bì chiều XUỐNG
// ---------------------------------------------------------------------------

/**
 * Chiều xuống chặt hơn `Envelope` chung của schema: server LUÔN gửi `ts` và
 * `data`, và `v` phải đúng phiên bản ta hiểu. Lệch → coi là message hỏng.
 */
export const EnvelopeSchema = z.object({
  v: z.literal(CONTRACT_VERSION),
  type: z.string(),
  ts: z.number(),
  id: z.string().nullish(),
  data: z.record(z.string(), z.unknown()),
});

export type ServerEnvelope = {
  [T in DownlinkType]: { v: 1; type: T; ts: number; id?: string | null; data: DownlinkPayloads[T] };
}[DownlinkType];

export type ServerMessage<T extends DownlinkType> = Extract<ServerEnvelope, { type: T }>;

/**
 * Kết quả phân tích một frame. Tách ba trường hợp vì hợp đồng đòi xử lý khác nhau:
 *  - `message`: hợp lệ, dùng được.
 *  - `ignored`: phong bì đúng nhưng `type` chưa biết — bỏ qua TRONG IM LẶNG
 *    (tương thích tiến: backend mới thêm type thì web cũ vẫn chạy).
 *  - `invalid`: hỏng — không làm sập giao diện, nhưng phải báo lên nhật ký.
 */
export type ParseResult =
  | { kind: "message"; message: ServerEnvelope }
  | { kind: "ignored"; type: string }
  | { kind: "invalid"; reason: string };

function defValidator(ref: string): z.ZodType {
  return z.fromJSONSchema({ $schema: contract.$schema, $defs: contract.$defs, $ref: ref } as never);
}

const DOWNLINK_VALIDATORS = Object.fromEntries(
  Object.entries(contract.downlink).map(([type, def]) => [type, defValidator(def.$ref)]),
) as Record<DownlinkType, z.ZodType>;

const KNOWN_DOWNLINK = new Set<string>(DOWNLINK_TYPES);

function shortIssue(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "không rõ";
  const where = first.path.length ? first.path.join(".") : "(gốc)";
  return `${where}: ${first.message}`;
}

export function parseServerMessage(raw: unknown): ParseResult {
  if (typeof raw !== "string") return { kind: "invalid", reason: "frame không phải văn bản" };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: "invalid", reason: "không phải JSON" };
  }

  const envelope = EnvelopeSchema.safeParse(json);
  if (!envelope.success) return { kind: "invalid", reason: `phong bì sai — ${shortIssue(envelope.error)}` };

  const { type } = envelope.data;
  if (!KNOWN_DOWNLINK.has(type)) return { kind: "ignored", type };

  const data = DOWNLINK_VALIDATORS[type as DownlinkType].safeParse(envelope.data.data);
  if (!data.success) return { kind: "invalid", reason: `${type}.${shortIssue(data.error)}` };

  return { kind: "message", message: { ...envelope.data, data: data.data } as ServerEnvelope };
}

const refValidators = new Map<string, z.ZodType>();

/** Validator cho một model bất kỳ trong `$defs` — dùng cho REST (`api.ts`). Dựng một lần rồi nhớ. */
export function validatorForRef(ref: string): z.ZodType {
  let validator = refValidators.get(ref);
  if (!validator) {
    validator = defValidator(ref);
    refValidators.set(ref, validator);
  }
  return validator;
}

export const REST_REFS = contract.rest;

// ---------------------------------------------------------------------------
// Bảng tra hiển thị — dùng chung cho Phase 08/09/10
// ---------------------------------------------------------------------------

/** `gps_fix_type` theo hợp đồng: 0 no-gps · 1 no-fix · 2 2D · 3 3D · 4 DGPS · 5 RTK-float · 6 RTK-fixed. */
export const GPS_FIX_LABEL = {
  0: "Không GPS",
  1: "Chưa fix",
  2: "2D",
  3: "3D",
  4: "DGPS",
  5: "RTK float",
  6: "RTK fixed",
} as const;

/** Fix đủ tốt để bay dựa vào GPS: từ 3D trở lên. */
export const GPS_FIX_3D = 3;

/** Chữ hiển thị cho `avoid_state` — plan Phase 10 §10.4.2. Backend tính trạng thái, web chỉ đọc. */
export const AVOID_STATE_LABEL = {
  OFF: "Trống",
  NEAR: "Gần vật cản",
  ACTIVE: "FC đang tránh",
  UNKNOWN: "Không đọc được",
} as const;

/**
 * Mode web được phép xin, đúng thứ tự của whitelist backend (Phase 06 §6.1.1).
 * Đọc THẲNG từ hợp đồng — không gõ lại danh sách: hai bản sẽ lệch nhau đúng vào
 * hôm ai đó thêm một mode.
 */
export const WEB_MODES = contract.$defs.CmdMode.properties.mode.enum as readonly CmdMode["mode"][];

export const ERROR_CODE_LABEL: Record<ErrorCode, string> = {
  unknown_type: "Loại message không có trong hợp đồng",
  unsupported_version: "Sai phiên bản hợp đồng",
  bad_payload: "Dữ liệu gửi lên sai dạng",
  not_implemented: "Chức năng chưa làm ở phase này",
  not_connected: "Chưa có liên lạc với drone",
  web_control_disabled: "Chưa bật WEB CONTROL",
  wrong_mode: "Mode hiện tại không cho phép lệnh này",
  command_denied: "Lệnh bị từ chối",
  validation_failed: "Không qua kiểm tra an toàn",
  rate_limited: "Gửi quá nhanh",
  timeout: "Drone không trả lời kịp",
  internal: "Lỗi backend",
};

export const EVENT_LEVELS = ["info", "warn", "error"] as const satisfies readonly EventPayload["level"][];
