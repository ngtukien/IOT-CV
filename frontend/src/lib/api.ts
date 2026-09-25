/**
 * REST — hỏi–đáp một lần (lịch sử sự kiện lúc mở trang, cấu hình).
 *
 * `fetch` trần, không TanStack Query: chỉ có vài endpoint và không cần cache
 * (báo cáo stack web §2.4 — đừng thêm dependency cho có). Đường dẫn tương đối,
 * nên dev (proxy của Vite) và bản build (FastAPI phục vụ) giống hệt nhau.
 *
 * Kết quả kiểm bằng CHÍNH model trong hợp đồng (`rest` của JSON Schema), không
 * tin mù phần thân trả về.
 */
import { REST_REFS, validatorForRef } from "./protocol";
import type { RestResponses } from "./protocol";

type GetRoute = Extract<keyof RestResponses, `GET ${string}`>;

export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function restGet<R extends GetRoute>(route: R, query = "", init?: RequestInit): Promise<RestResponses[R]> {
  const path = route.slice("GET ".length) + query;
  const res = await fetch(path, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  if (!res.ok) throw new ApiError(`${route} trả HTTP ${res.status}`, res.status);

  const parsed = validatorForRef(REST_REFS[route].$ref).safeParse(await res.json());
  if (!parsed.success) throw new ApiError(`${route} trả dữ liệu sai hợp đồng: ${parsed.error.issues[0]?.message}`);
  return parsed.data as RestResponses[R];
}

/** Lịch sử sự kiện của backend, cũ trước mới sau (đúng thứ tự `EventBus`). */
export async function fetchEvents(limit: number, init?: RequestInit) {
  const body = await restGet("GET /api/events", `?limit=${limit}`, init);
  return body.events;
}
