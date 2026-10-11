/**
 * Trạng thái giao diện tạm thời của khung ứng dụng: trung tâm thông
 * báo, hộp phím tắt, và mốc "đã xem thông báo tới đâu". Không lưu lại khi tải
 * lại trang — đó là trạng thái của một lần nhìn, không phải cài đặt.
 */
import { create } from "zustand";

interface UiStore {
  notificationsOpen: boolean;
  shortcutsOpen: boolean;
  /** `ts` (giây) của sự kiện mới nhất lúc mở trung tâm thông báo lần cuối. */
  seenUntil: number;
  setNotifications(open: boolean): void;
  setShortcuts(open: boolean): void;
  markSeen(ts: number): void;
}

export const useUiStore = create<UiStore>((set) => ({
  notificationsOpen: false,
  shortcutsOpen: false,
  seenUntil: Date.now() / 1000,
  setNotifications: (notificationsOpen) => set({ notificationsOpen }),
  setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  markSeen: (seenUntil) => set((s) => ({ seenUntil: Math.max(s.seenUntil, seenUntil) })),
}));
