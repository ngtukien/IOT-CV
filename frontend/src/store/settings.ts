/**
 * Cài đặt giao diện của người vận hành — lưu `localStorage`, chỉ trên máy này.
 *
 * KHÔNG có giới hạn an toàn nào ở đây. Giới hạn (max_alt, max_velocity…) do
 * backend quyết và đọc từ `status.limits`; cài đặt chỉ đổi CÁCH HIỂN THỊ. Đổi
 * một dòng ở đây không bao giờ được làm drone bay khác đi.
 *
 * `localStorage` có thể vắng (cửa sổ ẩn danh, bị chặn): khi đó `persist` của
 * zustand chỉ không lưu được, trang vẫn chạy với mặc định.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MapBaseId } from "@/lib/mapLayers";

export type ThemeSetting = "night" | "day" | "system";
export type MotionSetting = "auto" | "off";
export type MapBase = MapBaseId;
export type TwinQuality = "low" | "medium" | "high" | "ultra";
/** Mặt đất 3D: ảnh từ một lớp bản đồ nền, hoặc lưới dựng sẵn (không cần mạng). */
export type TwinGround = "satellite" | "hybrid" | "streets" | "topo" | "grid";
export type CockpitView = "map" | "3d";

export interface SettingsValues {
  theme: ThemeSetting;
  motion: MotionSetting;
  mapBase: MapBase;
  showTrail: boolean;
  showGeofence: boolean;
  cockpitView: CockpitView;
  twinQuality: TwinQuality;
  twinGround: TwinGround;
  twinEffects: boolean;
  /** Tiếng bíp cho sự kiện quan trọng (mất link, lỗi, ARM). */
  audioAlerts: boolean;
  /** Đọc to bằng giọng nói của trình duyệt (tiếng Việt nếu máy có). */
  voice: boolean;
  volume: number;
}

export const DEFAULT_SETTINGS: SettingsValues = {
  theme: "night",
  motion: "auto",
  mapBase: "streets",
  showTrail: true,
  showGeofence: true,
  cockpitView: "map",
  twinQuality: "high",
  twinGround: "satellite",
  twinEffects: true,
  audioAlerts: true,
  voice: false,
  volume: 0.6,
};

interface SettingsStore extends SettingsValues {
  set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]): void;
  reset(): void;
}

export const SETTINGS_STORAGE_KEY = "iot-cv.settings.v1";

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsValues>),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Chỉ lưu giá trị, không lưu hàm; khoá lạ từ bản cũ bị bỏ qua khi gộp.
      partialize: (s) => {
        const out = {} as SettingsValues;
        for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsValues)[]) (out as unknown as Record<string, unknown>)[k] = s[k];
        return out;
      },
    },
  ),
);

/** Theme thật sự áp dụng, sau khi giải "system" theo hệ điều hành. */
export function resolveTheme(theme: ThemeSetting, prefersDark: boolean): "night" | "day" {
  if (theme === "system") return prefersDark ? "night" : "day";
  return theme;
}
