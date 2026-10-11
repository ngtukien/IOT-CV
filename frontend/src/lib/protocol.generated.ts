// TỰ SINH — ĐỪNG SỬA TAY. Nguồn: backend/ws-contract.schema.json
// Sinh lại: pnpm gen:protocol (trong frontend/).
// Thiếu gì thì sửa hợp đồng Phase 05 trước, rồi backend/schemas.py, rồi sinh lại
// file này — trong cùng một commit.
/* eslint-disable */

/**
 * `accepted` = backend nhận và thấy hợp lệ. `done` = FC đã xác nhận.
 *
 * Lệnh chậm (mode, arm, takeoff, mission) gửi CẢ HAI. Lệnh nhanh chỉ `done`.
 * `cmd.velocity` KHÔNG sinh ack — nó chạy 5-20 Hz, ack sẽ làm ngập socket.
 */
export interface AckPayload {
  ref?: string | null;
  command: string;
  status: "accepted" | "done";
  detail?: {
    [k: string]: unknown;
  } | null;
}
export interface CameraStatus {
  available?: boolean;
  url?: string;
  fake?: boolean;
}
/**
 * `false` = disarm. CẤM mọi tham số force — xem SAFETY.md mục 1.
 */
export interface CmdArm {
  arm: boolean;
}
/**
 * Backend KHÔNG tự chèn takeoff/RTL còn thiếu — báo `validation_failed`
 * để người sửa (Phase 07).
 */
export interface CmdMissionUpload {
  waypoints: MissionWaypoint[];
  auto_start?: boolean;
}
/**
 * `command` thêm ở Phase 07, mặc định NAV_WAYPOINT để client Phase 05
 * (chưa biết trường này) vẫn gửi được. Lệnh ngoài `MISSION_COMMANDS` thì
 * `validate_mission` từ chối, không phải pydantic — để lỗi về đúng mã
 * `validation_failed` kèm số thứ tự item, thay vì `bad_payload` chung chung.
 */
export interface MissionWaypoint {
  seq: number;
  lat: number;
  lon: number;
  alt: number;
  command?: number;
}
export interface CmdMode {
  mode: "GUIDED" | "LOITER" | "ALT_HOLD" | "POSHOLD" | "BRAKE" | "RTL" | "LAND" | "AUTO" | "STABILIZE";
}
export interface CmdPing {}
/**
 * Dùng chung cho `cmd.hold`, `cmd.rtl`, `cmd.land` — không có tham số.
 */
export interface CmdSimple {}
/**
 * Phải nằm trong [MIN_ALT, MAX_ALT]. Vượt thì trả error, KHÔNG im lặng kẹp
 * — kiểm ở Phase 06, nơi có config trong tay.
 */
export interface CmdTakeoff {
  altitude: number;
}
/**
 * m/s, body frame. `vz` DƯƠNG = XUỐNG (quy ước NED, đừng đảo).
 */
export interface CmdVelocity {
  vx?: number;
  vy?: number;
  vz?: number;
  yaw_rate?: number;
}
export interface CmdWebControlEnable {
  enabled: boolean;
}
/**
 * `GET /api/config` — UI đọc ngưỡng từ đây, không hardcode.
 */
export interface ConfigPayload {
  limits: LimitsPayload;
  endpoint: string;
  telemetry_hz: number;
  versions: VersionsPayload;
}
/**
 * Mọi ngưỡng UI cần. Phase 08/09/10 KHÔNG được hardcode số nào.
 */
export interface LimitsPayload {
  max_alt: number;
  min_alt: number;
  max_distance_home: number;
  max_waypoints: number;
  max_velocity: number;
  manual_command_timeout_ms: number;
  deadman_tick_ms: number;
  avoid_margin_m: number;
  avoid_dist_max_m: number;
  rangefinder_max_m: number;
  proximity_stale_s: number;
}
export interface VersionsPayload {
  backend: string;
  contract: number;
}
/**
 * Toạ độ là PIXEL trong hệ của khung gốc (width×height) — không phải tỉ lệ
 * 0-1, không phải pixel màn hình. Frontend tự quy đổi.
 */
export interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  label: string;
}
export interface DetectionPayload {
  frame_id: number;
  frame_ts: number;
  width: number;
  height: number;
  boxes?: DetectionBox[];
}
/**
 * Lớp bọc chung cho MỌI message, cả hai chiều.
 *
 * `data` để kiểu dict chứ không phải union phân biệt theo `type`. Cố ý:
 * union sẽ gộp "type không tồn tại" và "data sai kiểu" thành cùng một lỗi
 * validation, trong khi hợp đồng đòi hai mã lỗi KHÁC nhau (`unknown_type` vs
 * `bad_payload`). Nên việc kiểm `data` được tách thành bước hai, tra bảng
 * `UPLINK_MODELS` — xem `backend/ws.py`.
 */
export interface Envelope {
  v: number;
  type: string;
  ts?: number | null;
  id?: string | null;
  data?: {
    [k: string]: unknown;
  };
}
export interface ErrorPayload {
  ref?: string | null;
  command?: string | null;
  code: string;
  message: string;
  detail?: {
    [k: string]: unknown;
  } | null;
}
/**
 * `code` là khoá máy đọc (UI lọc và tô màu theo nó).
 * `message` là tiếng Việt cho người đọc.
 */
export interface EventPayload {
  level?: "info" | "warn" | "error";
  source?: "mavlink" | "safety" | "mission" | "vision" | "backend";
  code: string;
  message: string;
  detail?: {
    [k: string]: unknown;
  } | null;
  ts?: number | null;
}
/**
 * `GET /api/events` — lịch sử từ EventBus, cũ trước mới sau.
 */
export interface EventsPayload {
  events: EventPayload[];
}
/**
 * `GET /api/mission`. `waypoints` chỉ đáng tin khi `source == "readback"`.
 */
export interface MissionPayload {
  source: "none" | "readback" | "local";
  count: number;
  uploaded_at?: number | null;
  waypoints?: MissionWaypoint[];
}
export interface MissionStatus {
  count?: number;
  uploaded_at?: number | null;
  source?: "none" | "readback" | "local";
}
/**
 * `POST /api/mission`. `code` là mã lỗi hợp đồng khi `ok` là false.
 */
export interface MissionUploadResult {
  ok: boolean;
  errors?: string[];
  count?: number;
  readback_ok?: boolean;
  code?: string | null;
}
export interface PongPayload {
  server_ts: number;
}
/**
 * Trạng thái quyền lái. Dựng từ `SafetyState` + chủ sở hữu do hub giữ.
 *
 * `SafetyState` (backend/mavlink/safety.py) không biết socket nào đang giữ
 * quyền — đó là việc của `WebSocketHub`. Hai trường `deadman_tripped` và
 * `last_zero_velocity_reason` là chỗ trống Phase 06 sẽ điền.
 */
export interface SafetyStatus {
  web_control_enabled?: boolean;
  web_control_owner?: string | null;
  current_mode?: string;
  rc_available?: boolean;
  deadman_tripped?: boolean;
  last_zero_velocity_reason?: string | null;
}
/**
 * `status.data` — gửi 1 lần lúc mở socket, và mỗi lần có gì đổi.
 */
export interface StatusPayload {
  backend_version: string;
  endpoint: string;
  connected: boolean;
  safety: SafetyStatus;
  limits: LimitsPayload;
  mission?: MissionStatus;
  camera?: CameraStatus;
}
/**
 * `GET /api/system` — thông tin vận hành cho trang Hệ thống của web.
 *
 * Chỉ ĐỌC. Không có ngưỡng an toàn nào ở đây (ngưỡng ở `limits`).
 */
export interface SystemPayload {
  backend_version: string;
  contract_version: number;
  python: string;
  platform: string;
  pid: number;
  started_at: number;
  uptime_s: number;
  endpoint: string;
  telemetry_hz: number;
  ws_clients: number;
  link_alive: boolean;
  vision_enabled: boolean;
  camera_fake: boolean;
  camera_source: string;
  history_samples: number;
  history_capacity_s: number;
  events_buffered: number;
}
/**
 * Bản GỬI ĐI — `telemetry.data` trong hợp đồng.
 */
export interface Telemetry {
  mode?: string;
  armed?: boolean;
  lat?: number | null;
  lon?: number | null;
  relative_alt?: number | null;
  absolute_alt?: number | null;
  heading?: number | null;
  ground_speed?: number | null;
  climb_rate?: number | null;
  roll?: number | null;
  pitch?: number | null;
  yaw?: number | null;
  gps_fix_type?: number | null;
  satellites?: number | null;
  battery_voltage?: number | null;
  battery_current?: number | null;
  battery_remaining?: number | null;
  home_lat?: number | null;
  home_lon?: number | null;
  obstacle_distance?: number | null;
  /**
   * 8 cung 45°, index 0 = mũi, theo chiều kim đồng hồ
   */
  obstacle_sectors?: (number | null)[];
  rangefinder_healthy?: boolean;
  avoid_state?: "OFF" | "NEAR" | "ACTIVE" | "UNKNOWN";
  ekf_ok?: boolean | null;
  connected?: boolean;
  link_age_ms?: number | null;
}
/**
 * `GET /api/telemetry/history` — vòng đệm của backend (`backend/history.py`).
 *
 * Chỉ có mẫu lúc link CÒN SỐNG; khoảng mất link là khoảng trống, không phải
 * chuỗi `None`. `hz` là nhịp ghi danh nghĩa, `capacity_s` là độ dài vòng đệm.
 */
export interface TelemetryHistoryPayload {
  samples: TelemetrySample[];
  hz: number;
  capacity_s: number;
}
/**
 * Một gói telemetry đã gửi, kèm thời điểm gửi (Unix epoch GIÂY).
 */
export interface TelemetrySample {
  ts: number;
  data: Telemetry;
}

// ---- Bảng tra (gốc của schema) ----

export const CONTRACT_VERSION = 1 as const;

export interface DownlinkPayloads {
  "telemetry": Telemetry;
  "status": StatusPayload;
  "event": EventPayload;
  "detection": DetectionPayload;
  "ack": AckPayload;
  "error": ErrorPayload;
  "pong": PongPayload;
}

export interface UplinkPayloads {
  "ping": CmdPing;
  "cmd.web_control_enable": CmdWebControlEnable;
  "cmd.mode": CmdMode;
  "cmd.arm": CmdArm;
  "cmd.takeoff": CmdTakeoff;
  "cmd.velocity": CmdVelocity;
  "cmd.hold": CmdSimple;
  "cmd.rtl": CmdSimple;
  "cmd.land": CmdSimple;
  "cmd.mission.upload": CmdMissionUpload;
}

export interface RestResponses {
  "GET /api/status": StatusPayload;
  "GET /api/config": ConfigPayload;
  "GET /api/mission": MissionPayload;
  "POST /api/mission": MissionUploadResult;
  "GET /api/events": EventsPayload;
  "GET /api/telemetry/history": TelemetryHistoryPayload;
  "GET /api/system": SystemPayload;
}

export const DOWNLINK_TYPES = [
  "telemetry",
  "status",
  "event",
  "detection",
  "ack",
  "error",
  "pong"
] as const;

export const UPLINK_TYPES = [
  "ping",
  "cmd.web_control_enable",
  "cmd.mode",
  "cmd.arm",
  "cmd.takeoff",
  "cmd.velocity",
  "cmd.hold",
  "cmd.rtl",
  "cmd.land",
  "cmd.mission.upload"
] as const;

export const UPLINK_RATE_LIMITS = {
  "ping": 2,
  "cmd.web_control_enable": 5,
  "cmd.mode": 5,
  "cmd.arm": 2,
  "cmd.takeoff": 2,
  "cmd.velocity": 30,
  "cmd.hold": 5,
  "cmd.rtl": 5,
  "cmd.land": 5,
  "cmd.mission.upload": 1
} as const;

export const ERROR_CODES = [
  "unknown_type",
  "unsupported_version",
  "bad_payload",
  "not_implemented",
  "not_connected",
  "web_control_disabled",
  "wrong_mode",
  "command_denied",
  "validation_failed",
  "rate_limited",
  "timeout",
  "internal"
] as const;

export type DownlinkType = (typeof DOWNLINK_TYPES)[number];

export type UplinkType = (typeof UPLINK_TYPES)[number];

export type ErrorCode = (typeof ERROR_CODES)[number];
