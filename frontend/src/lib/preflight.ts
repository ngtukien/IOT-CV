/**
 * Kiểm tra SẴN SÀNG BAY — phần tự động, tính từ telemetry + status. THUẦN.
 *
 * Đây là bảng NHÌN cho người vận hành, không phải cổng chặn: cổng thật nằm ở FC
 * (pre-arm check) và ở backend (precheck mission, quyền lái). Một dòng xanh ở
 * đây không bao giờ thay cho pre-arm của ArduPilot (SAFETY.md mục 3).
 *
 * Ba trạng thái: `pass` / `fail` / `unknown`. `unknown` (chưa có số đo) KHÔNG
 * được tính là đạt — đúng luật "chưa biết ≠ ổn" của cả dự án.
 */
import { DISPLAY_THRESHOLDS } from "./format";
import type { StatusPayload, Telemetry } from "./protocol";
import { GPS_FIX_3D, GPS_FIX_LABEL } from "./protocol";

export type CheckState = "pass" | "fail" | "warn" | "unknown";

export interface AutoCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  /** Không đạt thì có được bay không: `true` = chặn (NO-GO). */
  blocking: boolean;
}

export interface PreflightInput {
  socketOpen: boolean;
  telemetry: Telemetry | null;
  status: StatusPayload | null;
}

function fixLabel(fix: number | null | undefined): string {
  if (fix == null) return "—";
  return GPS_FIX_LABEL[fix as keyof typeof GPS_FIX_LABEL] ?? `fix ${fix}`;
}

export function evaluatePreflight({ socketOpen, telemetry: t, status: s }: PreflightInput): AutoCheck[] {
  const checks: AutoCheck[] = [];
  const known = socketOpen && t !== null;

  checks.push({
    id: "backend",
    label: "Trình duyệt ↔ backend",
    state: socketOpen ? "pass" : "fail",
    detail: socketOpen ? "WebSocket đang mở" : "Chưa nối được backend",
    blocking: true,
  });
  checks.push({
    id: "link",
    label: "Backend ↔ drone (MAVLink)",
    state: !known ? "unknown" : t.connected ? "pass" : "fail",
    detail: !known ? "Chưa có telemetry" : t.connected ? `Tuổi link ${t.link_age_ms ?? "—"} ms` : "Mất liên lạc với FC",
    blocking: true,
  });
  const fix = t?.gps_fix_type;
  checks.push({
    id: "gps",
    label: "GPS có 3D fix",
    state: !known || fix == null ? "unknown" : fix >= GPS_FIX_3D ? "pass" : "fail",
    detail: `${fixLabel(fix)} · ${t?.satellites ?? "—"} vệ tinh`,
    blocking: true,
  });
  checks.push({
    id: "ekf",
    label: "EKF khoẻ",
    state: !known || t.ekf_ok == null ? "unknown" : t.ekf_ok ? "pass" : "fail",
    detail: t?.ekf_ok == null ? "Chưa biết — không phải OK" : t.ekf_ok ? "Ước lượng vị trí tin cậy" : "EKF báo lỗi — không bay",
    blocking: true,
  });
  const batt = t?.battery_remaining;
  checks.push({
    id: "battery",
    label: `Pin trên ${DISPLAY_THRESHOLDS.batteryLowPercent}%`,
    state: !known || batt == null ? "unknown" : batt >= DISPLAY_THRESHOLDS.batteryLowPercent ? "pass" : "fail",
    detail: batt == null ? "Chưa có số đo pin" : `${batt}% · ${t?.battery_voltage?.toFixed(1) ?? "—"} V`,
    blocking: true,
  });
  const home = t?.home_lat != null && t?.home_lon != null;
  checks.push({
    id: "home",
    label: "Có điểm home",
    state: !known ? "unknown" : home ? "pass" : "warn",
    detail: home ? "RTL biết đường về" : "Chưa có home — FC đặt khi ARM có GPS fix",
    blocking: false,
  });
  checks.push({
    id: "rangefinder",
    label: "Cảm biến TFmini khoẻ",
    state: !known ? "unknown" : t.rangefinder_healthy ? "pass" : "warn",
    detail: t?.rangefinder_healthy ? `Đo được ${t.obstacle_distance?.toFixed(1) ?? "—"} m` : "Không đọc được — FC sẽ không phanh trước vật cản",
    blocking: false,
  });
  checks.push({
    id: "webcontrol",
    label: "WEB CONTROL đang tắt",
    state: s == null ? "unknown" : s.safety.web_control_enabled ? "warn" : "pass",
    detail: s?.safety.web_control_enabled ? "Web đang giữ quyền lái — chỉ bật khi thật sự cần" : "RC giữ quyền (đúng SAFETY.md mục 4)",
    blocking: false,
  });
  checks.push({
    id: "camera",
    label: "Camera có hình",
    state: s == null ? "unknown" : s.camera?.available ? "pass" : "warn",
    detail: s?.camera?.available ? (s.camera.fake ? "Đang dùng nguồn giả" : "Camera thật") : "Mất camera không ảnh hưởng bay (SAFETY.md mục 9)",
    blocking: false,
  });
  return checks;
}

export type Verdict = "go" | "caution" | "nogo" | "unknown";

/** Kết luận chung: có ô chặn trượt → NO-GO; ô chặn chưa biết → chưa kết luận. */
export function preflightVerdict(checks: readonly AutoCheck[]): Verdict {
  const blocking = checks.filter((c) => c.blocking);
  if (blocking.some((c) => c.state === "fail")) return "nogo";
  if (blocking.some((c) => c.state === "unknown")) return "unknown";
  if (checks.some((c) => c.state === "warn" || c.state === "fail")) return "caution";
  return "go";
}

/** Việc người vận hành TỰ xác nhận — không máy nào kiểm được (SAFETY.md). */
export const MANUAL_CHECKS: readonly { id: string; label: string; detail: string }[] = [
  { id: "props", label: "Cánh quạt đúng chiều, siết chặt — hoặc đã THÁO khi test trên bàn", detail: "SAFETY.md mục 2: NO PROPELLERS khi motor test, calib, test web trên bàn" },
  { id: "cells", label: "Đo điện áp từng cell pin, pin không phồng", detail: "SAFETY.md mục 6 — đối chiếu với số của Mission Planner" },
  { id: "rc", label: "Người vận hành cầm RC, đã thử gạt mode lấy lại quyền", detail: "SAFETY.md mục 4 — RC luôn có quyền cao nhất" },
  { id: "area", label: "Bãi bay trống: không người ngoài, không xe, không cây gần", detail: "SAFETY.md mục 8 — bay thấp trước 0.5–1 m" },
  { id: "fence", label: "Geofence FENCE_* đã bật trên FC", detail: "Rào phần mềm của web chỉ là lớp phụ" },
  { id: "failsafe", label: "Failsafe pin / RC / GCS đã kiểm ở Phase 19", detail: "Không bay nếu chưa test failsafe" },
  { id: "prearm", label: "Mission Planner không còn báo PreArm", detail: "SAFETY.md mục 3: sửa nguyên nhân, không tắt cảnh báo" },
];
