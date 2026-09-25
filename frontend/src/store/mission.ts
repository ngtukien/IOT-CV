/**
 * Store của trình soạn mission: bản nháp + trạng thái nạp + mission đã đọc lại.
 *
 * Ba nguyên tắc (plan Phase 09 §9.4):
 *  1. Bấm bản đồ chỉ tạo BẢN NHÁP trong trình duyệt. Không gửi từng điểm xuống
 *     UAV — người dùng phải bấm NẠP MISSION, và backend kiểm lại toàn bộ.
 *     (Mang nguyên từ `frontend/mission.js` bản vanilla.)
 *  2. CẤT CÁNH và VỀ NHÀ/HẠ CÁNH là hai trường riêng, không nằm trong mảng
 *     `waypoints`: không xoá được, không đổi chỗ được. Người dùng KHÔNG THỂ soạn
 *     ra mission vi phạm luật 7–8, thay vì soạn xong rồi bị từ chối.
 *  3. `seq` không lưu. Nó được đánh lại từ vị trí mỗi lần dựng payload
 *     (`toMissionWaypoints`), nên luôn liên tục 1..n — seq nhảy cóc là nguồn
 *     của `MAV_MISSION_INVALID_SEQUENCE`. Khoá React là `id` ổn định, không phải
 *     chỉ số mảng: dùng chỉ số thì đổi thứ tự xong ô nhập độ cao nhảy giá trị.
 *
 * `readback` là mission backend ĐÃ ĐỌC NGƯỢC từ FC (`GET /api/mission` khi
 * `status.mission.source === "readback"`). Nó là thứ duy nhất được vẽ nét liền.
 */
import { create } from "zustand";

import type { LatLon } from "@/lib/geo";
import { MAV_CMD } from "@/lib/missionRules";
import type { RuleLimits } from "@/lib/missionRules";
import type { AckPayload, ErrorPayload, MissionWaypoint } from "@/lib/protocol";

/**
 * Độ cao gợi ý cho điểm mới — mang từ `DEFAULT_WAYPOINT_ALT = 5` của
 * `mission.js` cũ. Đây là GỢI Ý khởi đầu, không phải giới hạn: lúc dùng nó
 * được kẹp vào [min_alt, max_alt] của backend (`effectiveDefaultAlt`).
 */
export const DEFAULT_WAYPOINT_ALT_M = 5;

export type FinalCommand = typeof MAV_CMD.NAV_RETURN_TO_LAUNCH | typeof MAV_CMD.NAV_LAND;

export interface DraftWaypoint {
  /** Khoá ổn định (`crypto.randomUUID()`), không đổi khi đổi thứ tự. */
  id: string;
  lat: number;
  lon: number;
  /** `NaN` = ô nhập đang trống. Luật kiểm tra sẽ báo; không tự điền số. */
  alt: number;
}

export type UploadState = "idle" | "validating" | "uploading" | "reading-back" | "done" | "error";

/** Ảnh chụp phần SOẠN của bản nháp — đơn vị của hoàn tác / làm lại. */
export interface DraftSnapshot {
  takeoffAlt: number;
  waypoints: DraftWaypoint[];
  finalCommand: FinalCommand;
}

/** Giữ tối đa chừng này bước hoàn tác. */
export const UNDO_LIMIT = 50;

export interface ReadbackMission {
  waypoints: MissionWaypoint[];
  uploadedAt: number | null;
}

interface MissionStore {
  takeoffAlt: number;
  waypoints: DraftWaypoint[];
  finalCommand: FinalCommand;
  defaultAlt: number;

  uploadState: UploadState;
  uploadProgress: { sent: number; total: number } | null;
  /** `id` của lệnh `cmd.mission.upload` đang chờ trả lời; `ack`/`error` khớp theo `ref`. */
  pendingRef: string | null;
  /** Lỗi của lần nạp gần nhất, NGUYÊN VĂN từ backend. */
  lastErrors: string[];
  lastErrorCode: string | null;

  readback: ReadbackMission | null;

  /** Các bước hoàn tác (cũ → mới) và làm lại. Chỉ ghi thay đổi phần SOẠN. */
  past: DraftSnapshot[];
  future: DraftSnapshot[];

  addWaypoint(lat: number, lon: number, alt: number): void;
  /** Kéo một điểm tới chỗ mới (kéo marker trên bản đồ). */
  moveTo(id: string, lat: number, lon: number): void;
  /** Chèn điểm vào vị trí `index` của mảng waypoint (0 = ngay sau CẤT CÁNH). */
  insertAt(index: number, lat: number, lon: number, alt: number): void;
  /** Đặt cùng một độ cao cho mọi waypoint. */
  setAllAlt(alt: number): void;
  /** Đảo thứ tự các waypoint (bay ngược lộ trình). */
  reverse(): void;
  /** Thay cả lộ trình (mẫu tự sinh, nạp từ file). Hoàn tác được. */
  replaceWaypoints(points: readonly { lat: number; lon: number; alt: number }[]): void;
  /** Nạp nguyên một bản nháp (kể cả độ cao cất cánh, lệnh cuối). */
  loadDraft(draft: { takeoffAlt: number; finalCommand: FinalCommand; waypoints: readonly { lat: number; lon: number; alt: number }[] }): void;
  undo(): void;
  redo(): void;
  /** Nối cả một lộ trình (vẽ bằng terra-draw) vào cuối bản nháp, cùng một độ cao. */
  addWaypoints(points: readonly { lat: number; lon: number }[], alt: number): void;
  updateAlt(id: string, alt: number): void;
  setTakeoffAlt(alt: number): void;
  setFinalCommand(command: FinalCommand): void;
  setDefaultAlt(alt: number): void;
  move(id: string, dir: "up" | "down"): void;
  remove(id: string): void;
  clear(): void;

  beginUpload(ref: string): void;
  /** `true` nếu ack này thuộc lần nạp đang chờ (đã xử lý). */
  onAck(ack: AckPayload): boolean;
  /** `true` nếu lỗi này thuộc lần nạp đang chờ (đã xử lý). */
  onError(err: ErrorPayload): boolean;
  onProgress(sent: number, total: number): void;
  onSocketLost(): void;
  setReadback(readback: ReadbackMission | null): void;
}

export const SOCKET_LOST_MESSAGE =
  "Mất kết nối backend giữa lúc nạp — chưa rõ FC đang giữ mission nào. Nối lại rồi xem lớp mission đã nạp.";

function newId(): string {
  return crypto.randomUUID();
}

/** Độ cao gợi ý cho điểm mới, kẹp vào giới hạn backend. Chưa có giới hạn thì giữ nguyên. */
export function effectiveDefaultAlt(defaultAlt: number, limits: Pick<RuleLimits, "min_alt" | "max_alt"> | null): number {
  if (!limits || Number.isNaN(defaultAlt)) return defaultAlt;
  return Math.min(Math.max(defaultAlt, limits.min_alt), limits.max_alt);
}

/**
 * Bản nháp → danh sách item gửi đi (`cmd.mission.upload.waypoints`).
 *
 *   1      CẤT CÁNH    toạ độ home (Copter cất cánh TẠI CHỖ, lat/lon bị bỏ qua)
 *   2..n-1 WAYPOINT
 *   n      RTL / LAND  (0, 0, 0): RTL không mang toạ độ; LAND (0, 0) = hạ tại chỗ
 */
export function toMissionWaypoints(
  draft: Pick<MissionStore, "takeoffAlt" | "waypoints" | "finalCommand">,
  home: LatLon | null,
): MissionWaypoint[] {
  const items: MissionWaypoint[] = [
    { seq: 1, lat: home?.[0] ?? 0, lon: home?.[1] ?? 0, alt: draft.takeoffAlt, command: MAV_CMD.NAV_TAKEOFF },
  ];
  draft.waypoints.forEach((w, i) => {
    items.push({ seq: i + 2, lat: w.lat, lon: w.lon, alt: w.alt, command: MAV_CMD.NAV_WAYPOINT });
  });
  items.push({ seq: items.length + 1, lat: 0, lon: 0, alt: 0, command: draft.finalCommand });
  return items;
}

const COORD_EPS = 1e-7; // một đơn vị trên dây (MISSION_ITEM_INT nhân 1e7)
const ALT_EPS = 0.01;

/** Bản nháp (đã dựng thành item) có trùng mission đã đọc lại không. */
export function sameMission(a: readonly MissionWaypoint[], b: readonly MissionWaypoint[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return (
      (x.command ?? MAV_CMD.NAV_WAYPOINT) === (y.command ?? MAV_CMD.NAV_WAYPOINT) &&
      Math.abs(x.lat - y.lat) <= COORD_EPS &&
      Math.abs(x.lon - y.lon) <= COORD_EPS &&
      Math.abs(x.alt - y.alt) <= ALT_EPS
    );
  });
}

const IN_FLIGHT: readonly UploadState[] = ["validating", "uploading", "reading-back"];

export function isUploading(state: UploadState): boolean {
  return IN_FLIGHT.includes(state);
}

function snap(s: Pick<MissionStore, "takeoffAlt" | "waypoints" | "finalCommand">): DraftSnapshot {
  return { takeoffAlt: s.takeoffAlt, waypoints: s.waypoints, finalCommand: s.finalCommand };
}

/**
 * Bọc một thay đổi của phần SOẠN: đẩy trạng thái cũ vào `past`, xoá `future`.
 * Thay đổi không đổi gì (trả về chính state) thì không ghi bước hoàn tác.
 */
function edit(
  set: (fn: (s: MissionStore) => Partial<MissionStore> | MissionStore) => void,
  change: (s: MissionStore) => Partial<DraftSnapshot> | null,
): void {
  set((s) => {
    const patch = change(s);
    if (!patch) return s;
    return { ...patch, past: [...s.past, snap(s)].slice(-UNDO_LIMIT), future: [] };
  });
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  takeoffAlt: DEFAULT_WAYPOINT_ALT_M,
  waypoints: [],
  finalCommand: MAV_CMD.NAV_RETURN_TO_LAUNCH,
  defaultAlt: DEFAULT_WAYPOINT_ALT_M,

  uploadState: "idle",
  uploadProgress: null,
  pendingRef: null,
  lastErrors: [],
  lastErrorCode: null,

  readback: null,
  past: [],
  future: [],

  addWaypoint: (lat, lon, alt) => edit(set, (s) => ({ waypoints: [...s.waypoints, { id: newId(), lat, lon, alt }] })),
  addWaypoints: (points, alt) =>
    edit(set, (s) =>
      points.length === 0 ? null : { waypoints: [...s.waypoints, ...points.map((p) => ({ id: newId(), lat: p.lat, lon: p.lon, alt }))] },
    ),
  updateAlt: (id, alt) => edit(set, (s) => ({ waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, alt } : w)) })),
  setTakeoffAlt: (takeoffAlt) => edit(set, () => ({ takeoffAlt })),
  setFinalCommand: (finalCommand) => edit(set, (s) => (s.finalCommand === finalCommand ? null : { finalCommand })),
  setDefaultAlt: (defaultAlt) => set({ defaultAlt }),
  move: (id, dir) =>
    edit(set, (s) => {
      const i = s.waypoints.findIndex((w) => w.id === id);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= s.waypoints.length) return null;
      const next = [...s.waypoints];
      [next[i], next[j]] = [next[j], next[i]];
      return { waypoints: next };
    }),
  moveTo: (id, lat, lon) =>
    edit(set, (s) => (s.waypoints.some((w) => w.id === id) ? { waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, lat, lon } : w)) } : null)),
  insertAt: (index, lat, lon, alt) =>
    edit(set, (s) => {
      const i = Math.max(0, Math.min(index, s.waypoints.length));
      return { waypoints: [...s.waypoints.slice(0, i), { id: newId(), lat, lon, alt }, ...s.waypoints.slice(i)] };
    }),
  setAllAlt: (alt) => edit(set, (s) => (s.waypoints.length === 0 ? null : { waypoints: s.waypoints.map((w) => ({ ...w, alt })) })),
  reverse: (): void => edit(set, (s) => (s.waypoints.length < 2 ? null : { waypoints: [...s.waypoints].reverse() })),
  replaceWaypoints: (points) => edit(set, () => ({ waypoints: points.map((p) => ({ id: newId(), lat: p.lat, lon: p.lon, alt: p.alt })) })),
  loadDraft: (draft) =>
    edit(set, () => ({
      takeoffAlt: draft.takeoffAlt,
      finalCommand: draft.finalCommand,
      waypoints: draft.waypoints.map((p) => ({ id: newId(), lat: p.lat, lon: p.lon, alt: p.alt })),
    })),
  remove: (id) => edit(set, (s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) })),
  clear: () => edit(set, (s) => (s.waypoints.length === 0 ? null : { waypoints: [] })),
  undo: () =>
    set((s) => {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { ...prev, past: s.past.slice(0, -1), future: [snap(s), ...s.future].slice(0, UNDO_LIMIT) };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return { ...next, past: [...s.past, snap(s)].slice(-UNDO_LIMIT), future: s.future.slice(1) };
    }),

  beginUpload: (ref) =>
    set({ uploadState: "validating", pendingRef: ref, uploadProgress: null, lastErrors: [], lastErrorCode: null }),

  onAck: (ack) => {
    const { pendingRef } = get();
    if (!pendingRef || ack.ref !== pendingRef) return false;
    if (ack.status === "accepted") {
      set({ uploadState: "uploading" });
      return true;
    }
    if (ack.detail?.readback_ok === true) {
      set({ uploadState: "done", pendingRef: null });
    } else {
      // Backend chỉ gửi `done` khi đọc lại khớp. Nếu có ngày nó gửi khác đi thì
      // đó là thay đổi hợp đồng — không được coi là thành công.
      set({
        uploadState: "error",
        pendingRef: null,
        lastErrorCode: "internal",
        lastErrors: ["Backend báo xong nhưng không xác nhận đã đọc lại khớp — không coi là đã nạp"],
      });
    }
    return true;
  },

  onError: (err) => {
    const { pendingRef } = get();
    if (!pendingRef || err.ref !== pendingRef) return false;
    const detailErrors = err.detail?.errors;
    const errors =
      Array.isArray(detailErrors) && detailErrors.every((e) => typeof e === "string") && detailErrors.length > 0
        ? (detailErrors as string[])
        : [err.message];
    set({ uploadState: "error", pendingRef: null, lastErrors: errors, lastErrorCode: err.code });
    return true;
  },

  onProgress: (sent, total) => {
    // `mission.progress` phát cho MỌI tab; tab không đang nạp thì bỏ qua.
    if (!get().pendingRef) return;
    set({ uploadProgress: { sent, total }, uploadState: sent >= total ? "reading-back" : "uploading" });
  },

  onSocketLost: () => {
    if (!get().pendingRef) return;
    set({ uploadState: "error", pendingRef: null, lastErrorCode: "not_connected", lastErrors: [SOCKET_LOST_MESSAGE] });
  },

  setReadback: (readback) => set({ readback }),
}));
