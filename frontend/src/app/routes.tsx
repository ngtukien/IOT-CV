/**
 * Bảng trang của GCS — NGUỒN DUY NHẤT cho router, tab trên header và bảng phím tắt.
 * Thêm một trang = thêm một dòng ở đây; không chỗ nào khác phải gõ lại đường dẫn.
 *
 * Trang BAY (`/`) nạp ngay (không lazy): đó là trang mở ra khi cần bay, và bài
 * E2E dead-man đi thẳng vào nó. Các trang còn lại nạp khi mở tới — 3D (three.js)
 * nặng cả MB, không có lý do bắt trang bay chờ nó.
 */
import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

import {
  IconLog,
  IconOverview,
  IconPreflight,
  IconQuad,
  IconRoute,
  IconSystem,
  IconTelemetry,
  IconTwin,
  IconVision,
} from "@/components/icons";
import type { IconProps } from "@/components/icons";
import { Settings2 } from "lucide-react";

import FlightPage from "@/pages/FlightPage";

export type NavGroup = "ops" | "monitor" | "system";

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  ops: "Vận hành",
  monitor: "Giám sát",
  system: "An toàn & hệ thống",
};

export interface PageDef {
  path: string;
  /** Tên ngắn trên thanh bên. */
  label: string;
  /** Một câu: trang này để làm gì — hiện ở đầu trang và trong bảng lệnh. */
  description: string;
  group: NavGroup;
  icon: ComponentType<IconProps>;
  /**
   * Phím tắt điều hướng: Alt + phím này. Alt vì phím trần (W A S D R F Q E H,
   * mũi tên, Space) là phím LÁI — phím tắt trang không được trùng phím bay.
   */
  hotkey: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  testId: string;
}

export const PAGES: readonly PageDef[] = [
  {
    path: "/",
    label: "Bay",
    description: "Buồng lái: màn hình bay, bản đồ hoặc 3D, chế độ bay, lái tay, vật cản, video.",
    group: "ops",
    icon: IconQuad,
    hotkey: "1",
    component: FlightPage,
    testId: "nav-flight",
  },
  {
    path: "/mission",
    label: "Nhiệm vụ",
    description: "Soạn lộ trình trên bản đồ, xem hồ sơ độ cao và bản xem trước 3D, nạp xuống FC và đọc lại.",
    group: "ops",
    icon: IconRoute,
    hotkey: "2",
    component: lazy(() => import("@/pages/MissionPage")),
    testId: "nav-mission",
  },
  {
    path: "/3d",
    label: "Không gian 3D",
    description: "Bản sao số của drone trên ảnh vệ tinh: tư thế thật, vệt bay, rào ảo, tia đo vật cản, nhiều góc máy.",
    group: "ops",
    icon: IconTwin,
    hotkey: "3",
    component: lazy(() => import("@/pages/TwinPage")),
    testId: "nav-3d",
  },
  {
    path: "/vision",
    label: "Camera & AI",
    description: "Luồng camera, khung nhận diện, thống kê bộ nhận diện và đường đi của dữ liệu hình ảnh.",
    group: "ops",
    icon: IconVision,
    hotkey: "4",
    component: lazy(() => import("@/pages/VisionPage")),
    testId: "nav-vision",
  },
  {
    path: "/overview",
    label: "Tổng quan",
    description: "Toàn cảnh một màn hình: sức khoẻ từng khối, mức sẵn sàng bay, chuyến bay trong phiên.",
    group: "monitor",
    icon: IconOverview,
    hotkey: "5",
    component: lazy(() => import("@/pages/OverviewPage")),
    testId: "nav-overview",
  },
  {
    path: "/telemetry",
    label: "Dữ liệu bay",
    description: "Biểu đồ thời gian thực của mọi trường telemetry, bảng số sống, xuất CSV.",
    group: "monitor",
    icon: IconTelemetry,
    hotkey: "6",
    component: lazy(() => import("@/pages/TelemetryPage")),
    testId: "nav-telemetry",
  },
  {
    path: "/logs",
    label: "Nhật ký",
    description: "Mọi sự kiện của backend và web, lọc theo mức và nguồn; lịch sử lệnh kèm độ trễ xác nhận.",
    group: "monitor",
    icon: IconLog,
    hotkey: "7",
    component: lazy(() => import("@/pages/LogsPage")),
    testId: "nav-logs",
  },
  {
    path: "/preflight",
    label: "Kiểm tra trước bay",
    description: "Các cổng kiểm tự động từ telemetry cùng danh sách việc người vận hành phải tự xác nhận.",
    group: "system",
    icon: IconPreflight,
    hotkey: "8",
    component: lazy(() => import("@/pages/PreflightPage")),
    testId: "nav-preflight",
  },
  {
    path: "/system",
    label: "Hệ thống",
    description: "Kiến trúc, trạng thái backend, giới hạn an toàn đang áp dụng và thông số kết nối.",
    group: "system",
    icon: IconSystem,
    hotkey: "9",
    component: lazy(() => import("@/pages/SystemPage")),
    testId: "nav-system",
  },
  {
    path: "/settings",
    label: "Cài đặt",
    description: "Giao diện, bản đồ, chất lượng 3D, âm thanh cảnh báo, phím tắt.",
    group: "system",
    icon: Settings2 as unknown as ComponentType<IconProps>,
    hotkey: "0",
    component: lazy(() => import("@/pages/SettingsPage")),
    testId: "nav-settings",
  },
];

export function pageForPath(pathname: string): PageDef | undefined {
  return PAGES.find((p) => p.path === pathname) ?? PAGES.find((p) => p.path !== "/" && pathname.startsWith(p.path));
}
