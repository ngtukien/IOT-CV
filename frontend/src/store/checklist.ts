/**
 * Danh sách việc người vận hành TỰ xác nhận trước bay — lưu `localStorage` kèm
 * mốc giờ tick, và TỰ HẾT HẠN sau `CHECKLIST_TTL_MS`: một dấu tick của buổi bay
 * hôm qua không phải là bằng chứng cho hôm nay.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Tick cũ hơn 6 giờ coi như chưa tick. */
export const CHECKLIST_TTL_MS = 6 * 60 * 60 * 1000;

interface ChecklistStore {
  ticks: Record<string, number>;
  toggle(id: string, at?: number): void;
  reset(): void;
}

export const useChecklist = create<ChecklistStore>()(
  persist(
    (set) => ({
      ticks: {},
      toggle: (id, at = Date.now()) =>
        set((s) => {
          const ticks = { ...s.ticks };
          if (ticks[id] && at - ticks[id] < CHECKLIST_TTL_MS) delete ticks[id];
          else ticks[id] = at;
          return { ticks };
        }),
      reset: () => set({ ticks: {} }),
    }),
    { name: "iot-cv.checklist.v1", storage: createJSONStorage(() => localStorage) },
  ),
);

export function isTicked(ticks: Record<string, number>, id: string, now = Date.now()): boolean {
  const at = ticks[id];
  return at !== undefined && now - at < CHECKLIST_TTL_MS;
}
