/**
 * Bộ icon HORIZON — icon riêng cho khái niệm của drone, vẽ tay trên lưới 24×24,
 * nét 1.75, đầu nét tròn: cùng "giọng" với lucide nên đặt cạnh nhau không lệch.
 *
 * Dùng lucide cho khái niệm chung (cài đặt, tìm kiếm, thùng rác…); dùng bộ này
 * cho thứ lucide không có hoặc vẽ sai nghĩa (drone bốn cánh nhìn từ trên, cất
 * cánh thẳng đứng, RTL, rào ảo, tia TFmini, bản sao số 3D…).
 */
import type { ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function Base({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Quadcopter khung X nhìn từ trên — biểu tượng chính của hệ thống. */
export function IconQuad(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M9.5 9.5 6.2 6.2M14.5 9.5l3.3-3.3M9.5 14.5l-3.3 3.3M14.5 14.5l3.3 3.3" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.2" />
      <circle cx="5" cy="5" r="2.6" />
      <circle cx="19" cy="5" r="2.6" />
      <circle cx="5" cy="19" r="2.6" />
      <circle cx="19" cy="19" r="2.6" />
    </Base>
  );
}

/** Cánh quạt hai lá. */
export function IconPropeller(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M13.4 11.2c2.4-1.6 5.4-2.2 7.6-1.2-.6 2.3-3.4 3.2-6.2 3M10.6 12.8c-2.4 1.6-5.4 2.2-7.6 1.2.6-2.3 3.4-3.2 6.2-3" />
    </Base>
  );
}

/** Cất cánh thẳng đứng (không phải máy bay cánh cố định như lucide). */
export function IconTakeoff(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3v8M8.5 6.5 12 3l3.5 3.5" />
      <path d="M5 15h14M7 15v-1.5M17 15v-1.5" />
      <path d="M3 20h18" strokeDasharray="2 2.5" />
    </Base>
  );
}

/** Hạ cánh thẳng đứng. */
export function IconLand(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3v8M8.5 7.5 12 11l3.5-3.5" />
      <path d="M5 15h14M7 15v-1.5M17 15v-1.5" />
      <path d="M3 20h18" />
    </Base>
  );
}

/** RTL — quay về điểm cất cánh. */
export function IconReturnHome(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 12.5 12 6l8 6.5" />
      <path d="M6.5 11v8h11v-8" />
      <path d="M10 19v-3.5h4V19" />
      <path d="M19.5 3.5a5 5 0 0 0-7-.8" strokeDasharray="1.5 2" />
    </Base>
  );
}

/** Đứng yên (HOLD / LOITER): drone giữa bốn mũi tên chụm vào. */
export function IconHold(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="9" y="9" width="6" height="6" rx="1.4" />
      <path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5" />
      <path d="m10.5 4.5 1.5 1.5 1.5-1.5M10.5 19.5l1.5-1.5 1.5 1.5M4.5 10.5 6 12l-1.5 1.5M19.5 10.5 18 12l1.5 1.5" />
    </Base>
  );
}

/** Waypoint — ghim hình thoi có cột. */
export function IconWaypoint(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 2.8 16.5 8 12 13.2 7.5 8Z" />
      <path d="M12 13.2V20" />
      <ellipse cx="12" cy="20.2" rx="4.5" ry="1.3" />
    </Base>
  );
}

/** Lộ trình mission: ba điểm nối nét đứt. */
export function IconRoute(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="5" cy="18" r="2" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="19" cy="15" r="2" />
      <path d="m6.2 16.3 4.6-7.6M13.6 8.4l4.2 5" strokeDasharray="2 2" />
    </Base>
  );
}

/** Rào ảo: vòng nét đứt quanh drone. */
export function IconGeofence(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" strokeDasharray="2.4 2.2" />
      <path d="M10.3 10.3 8.4 8.4M13.7 10.3l1.9-1.9M10.3 13.7l-1.9 1.9M13.7 13.7l1.9 1.9" />
      <rect x="10.3" y="10.3" width="3.4" height="3.4" rx=".8" />
    </Base>
  );
}

/** Tia đo khoảng cách (TFmini): drone bắn tia thẳng tới vật cản. */
export function IconRangefinder(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="2.5" y="9" width="5" height="6" rx="1.2" />
      <path d="M7.5 11 17 9.5M7.5 13 17 14.5" />
      <path d="M19.5 5v14" strokeWidth={2.4} />
    </Base>
  );
}

/** Radar vật cản. */
export function IconRadar(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12 18.4 5.6" />
      <circle cx="16" cy="9" r="1" fill="currentColor" />
    </Base>
  );
}

/** Chân trời nhân tạo (màn hình bay). */
export function IconHorizon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 13.8 20.4 10.2" />
      <path d="M8 12.5h2.4l1.6 1.6 1.6-1.6H16" />
    </Base>
  );
}

/** Bản sao số 3D: khối lập phương có drone. */
export function IconTwin(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7Z" />
      <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
      <path d="M7.4 11.6v2.2M16.6 11.6v2.2" />
    </Base>
  );
}

/** Camera + khung nhận diện AI. */
export function IconVision(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 7.5V5a2 2 0 0 1 2-2h2.5M16.5 3H19a2 2 0 0 1 2 2v2.5M21 16.5V19a2 2 0 0 1-2 2h-2.5M7.5 21H5a2 2 0 0 1-2-2v-2.5" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 8.6V6.8M12 17.2v-1.8" />
    </Base>
  );
}

/** Danh sách kiểm tra trước bay. */
export function IconPreflight(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="4.5" y="3.5" width="15" height="17.5" rx="2" />
      <path d="M9 3.5V2.5h6v1" />
      <path d="m8 9 1.4 1.4L12 7.8M8 15l1.4 1.4L12 13.8M14 9.3h2.5M14 15.3h2.5" />
    </Base>
  );
}

/** Luồng dữ liệu (telemetry): đường tín hiệu. */
export function IconTelemetry(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M2.5 13h3.5l2-6 3.5 12 3-9 1.8 3H21.5" />
    </Base>
  );
}

/** Hệ thống: ba khối nối nhau (trình duyệt – backend – drone). */
export function IconSystem(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="2.5" y="4" width="6" height="5" rx="1.2" />
      <rect x="15.5" y="4" width="6" height="5" rx="1.2" />
      <rect x="9" y="15" width="6" height="5" rx="1.2" />
      <path d="M8.5 6.5h7M5.5 9v3.5a2 2 0 0 0 2 2H9M18.5 9v3.5a2 2 0 0 1-2 2H15" />
    </Base>
  );
}

/** Tổng quan: bảng điều khiển bất đối xứng. */
export function IconOverview(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="3" width="10" height="8" rx="1.6" />
      <rect x="15.5" y="3" width="5.5" height="12" rx="1.6" />
      <rect x="3" y="13.5" width="10" height="7.5" rx="1.6" />
      <path d="M15.5 18.5h5.5" />
    </Base>
  );
}

/** Nhật ký sự kiện. */
export function IconLog(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M8 6h12M8 12h12M8 18h8" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </Base>
  );
}

/** Cần lái / điều khiển tay. */
export function IconStick(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="13" width="18" height="7.5" rx="3" />
      <path d="M12 13V7.5" />
      <circle cx="12" cy="5.5" r="2.5" />
      <path d="M7 16.8h2M8 15.8v2M16 16.8h.01" />
    </Base>
  );
}

/** Vệ tinh GPS. */
export function IconSatellite(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1" transform="rotate(45 12 12)" />
      <path d="m7.8 7.8-3-3M16.2 16.2l3 3M4.2 7.3 7.3 4.2M16.7 19.8l3.1-3.1" />
      <path d="M17.5 3.5a3.5 3.5 0 0 1 3 3" />
    </Base>
  );
}
