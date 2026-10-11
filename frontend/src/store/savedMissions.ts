/**
 * Thư viện lộ trình đã lưu — trong `localStorage` của máy này.
 *
 * Lưu BẢN NHÁP (toạ độ, độ cao, lệnh cuối), không lưu gì về việc đã nạp: một
 * lộ trình lưu hôm qua chưa từng nằm trên FC hôm nay. Nạp lại = đưa vào bản
 * nháp, rồi vẫn phải qua kiểm tra và NẠP MISSION như mọi bản nháp khác.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { FinalCommand } from "./mission";

export interface SavedMission {
  id: string;
  name: string;
  savedAt: number;
  takeoffAlt: number;
  finalCommand: FinalCommand;
  waypoints: { lat: number; lon: number; alt: number }[];
}

interface SavedMissionsStore {
  items: SavedMission[];
  save(m: Omit<SavedMission, "id" | "savedAt">): SavedMission;
  remove(id: string): void;
  rename(id: string, name: string): void;
}

export const SAVED_MISSIONS_MAX = 40;

export const useSavedMissions = create<SavedMissionsStore>()(
  persist(
    (set) => ({
      items: [],
      save: (m) => {
        const item: SavedMission = { ...m, id: crypto.randomUUID(), savedAt: Date.now() };
        set((s) => ({ items: [item, ...s.items].slice(0, SAVED_MISSIONS_MAX) }));
        return item;
      },
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      rename: (id, name) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, name } : i)) })),
    }),
    { name: "iot-cv.missions.v1", storage: createJSONStorage(() => localStorage) },
  ),
);
