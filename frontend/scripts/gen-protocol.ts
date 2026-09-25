/**
 * Sinh `src/lib/protocol.generated.ts` từ `backend/ws-contract.schema.json`.
 *
 *     pnpm gen:protocol
 *
 * Schema đó do backend xuất ra từ `backend/schemas.py`, mà `schemas.py` lại hiện
 * thực mục "Hợp đồng WebSocket" của `plans/phase-05-backend-mavlink-telemetry.md`.
 * Nên chuỗi phụ thuộc là: hợp đồng → schemas.py → JSON Schema → file này sinh ra.
 * Không có bước nào gõ tay.
 *
 * Vì sao không gọi thẳng CLI `json2ts`: hai chỗ CLI làm ra code khó dùng.
 *   1. Pydantic đặt `title` cho TỪNG trường, và json2ts biến mỗi `title` thành
 *      một type riêng — ra `Ref1`, `Code2`, `Detail1`... Bỏ `title` của trường
 *      (giữ `title` của model) thì được `ref: string | null` gọn gàng.
 *   2. Gốc của schema không phải một model mà là bảng tra (`downlink`, `uplink`,
 *      `rest`, `error_codes`...) — json2ts không hiểu, nên phần bảng tra được
 *      sinh riêng ở cuối file.
 *
 * `tests/unit/protocol.test.ts` chạy lại đúng hàm này và so với file đã commit,
 * nên sửa schema mà quên sinh lại thì test đỏ.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";

type Json = Record<string, unknown>;

export interface ContractSchema {
  $schema: string;
  contract_version: number;
  $defs: Record<string, Json>;
  downlink: Record<string, { $ref: string }>;
  uplink: Record<string, { $ref: string }>;
  rest: Record<string, { $ref: string }>;
  uplink_rate_limits: Record<string, number>;
  error_codes: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = resolve(HERE, "../../backend/ws-contract.schema.json");
export const OUTPUT_PATH = resolve(HERE, "../src/lib/protocol.generated.ts");

const BANNER = `// TỰ SINH — ĐỪNG SỬA TAY. Nguồn: backend/ws-contract.schema.json
// Sinh lại: pnpm gen:protocol (trong frontend/).
// Thiếu gì thì sửa hợp đồng Phase 05 trước, rồi backend/schemas.py, rồi sinh lại
// file này — trong cùng một commit.
/* eslint-disable */`;

export function defName(ref: string): string {
  const prefix = "#/$defs/";
  if (!ref.startsWith(prefix)) throw new Error(`$ref lạ trong hợp đồng: ${ref}`);
  return ref.slice(prefix.length);
}

/** Bỏ `title` của từng trường, giữ `title` của model (xem ghi chú đầu file). */
function stripPropertyTitles(defs: Record<string, Json>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [name, def] of Object.entries(defs)) {
    const props = def.properties as Record<string, Json> | undefined;
    if (!props) {
      out[name] = def;
      continue;
    }
    const cleaned: Record<string, Json> = {};
    for (const [key, prop] of Object.entries(props)) {
      const { title: _title, ...rest } = prop;
      cleaned[key] = rest;
    }
    out[name] = { ...def, properties: cleaned };
  }
  return out;
}

function typeMap(name: string, table: Record<string, { $ref: string }>): string {
  const rows = Object.entries(table)
    .map(([key, ref]) => `  ${JSON.stringify(key)}: ${defName(ref.$ref)};`)
    .join("\n");
  return `export interface ${name} {\n${rows}\n}`;
}

function constOf(name: string, value: unknown): string {
  return `export const ${name} = ${JSON.stringify(value, null, 2)} as const;`;
}

export async function generateProtocol(schema: ContractSchema): Promise<string> {
  const models = await compile(
    // Một gốc giả rỗng; mọi model nằm trong $defs và được in ra nhờ
    // `unreachableDefinitions`. Gốc thật (bảng tra) sinh riêng bên dưới.
    { title: "ContractRoot", type: "object", additionalProperties: false, $defs: stripPropertyTitles(schema.$defs) },
    "ContractRoot",
    { bannerComment: "", unreachableDefinitions: true, additionalProperties: false, format: true },
  );

  // Bỏ gốc giả và câu "This interface was referenced by `ContractRoot`..." mà
  // json2ts gắn vào mọi model — nó nói về cái gốc giả, không về hợp đồng.
  const cleanedModels = models
    .replace(/^export interface ContractRoot \{\}\n/m, "")
    .replace(/\n \*\n \* This interface was referenced by[^\n]*\n \* via the `definition` "[^"]+"\./g, "")
    .replace(/\/\*\*\n \* This interface was referenced by[^\n]*\n \* via the `definition` "[^"]+"\.\n \*\/\n/g, "");

  const tables = [
    `export const CONTRACT_VERSION = ${schema.contract_version} as const;`,
    typeMap("DownlinkPayloads", schema.downlink),
    typeMap("UplinkPayloads", schema.uplink),
    typeMap("RestResponses", schema.rest),
    constOf("DOWNLINK_TYPES", Object.keys(schema.downlink)),
    constOf("UPLINK_TYPES", Object.keys(schema.uplink)),
    constOf("UPLINK_RATE_LIMITS", schema.uplink_rate_limits),
    constOf("ERROR_CODES", schema.error_codes),
    "export type DownlinkType = (typeof DOWNLINK_TYPES)[number];",
    "export type UplinkType = (typeof UPLINK_TYPES)[number];",
    "export type ErrorCode = (typeof ERROR_CODES)[number];",
  ];

  return `${BANNER}\n\n${cleanedModels.trim()}\n\n// ---- Bảng tra (gốc của schema) ----\n\n${tables.join("\n\n")}\n`;
}

export function readSchema(): ContractSchema {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as ContractSchema;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(OUTPUT_PATH, await generateProtocol(readSchema()));
  console.log(`Đã sinh ${OUTPUT_PATH}`);
}
