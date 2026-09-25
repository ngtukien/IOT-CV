/**
 * Hook dùng chung cho bản đồ và bảng mission.
 *
 * Selector của zustand phải trả giá trị ỔN ĐỊNH: trả một mảng mới mỗi lần
 * (`s => [s.lat, s.lon]`) là React render lại vô hạn. Nên ở đây chọn từng số
 * nguyên thuỷ, rồi mới ghép bằng `useMemo`.
 */
import { useMemo } from "react";

import { useLimits } from "@/hooks/useLimits";
import { toLatLon } from "@/lib/geo";
import type { LatLon } from "@/lib/geo";
import { validateForUpload } from "@/lib/missionRules";
import type { MissionIssue } from "@/lib/missionRules";
import type { MissionWaypoint } from "@/lib/protocol";
import { toMissionWaypoints, useMissionStore } from "@/store/mission";
import { useTelemetryStore } from "@/store/telemetry";

/** Điểm home từ telemetry, hoặc `null` (chưa có GPS fix / chưa nối). */
export function useHome(): LatLon | null {
  const lat = useTelemetryStore((s) => s.telemetry?.home_lat ?? null);
  const lon = useTelemetryStore((s) => s.telemetry?.home_lon ?? null);
  return useMemo(() => toLatLon(lat, lon), [lat, lon]);
}

export interface MissionDraftCheck {
  /** Bản nháp dựng thành item, đúng như sẽ gửi đi. */
  items: MissionWaypoint[];
  /** `null` khi chưa có `status.limits` — chưa kiểm được, KHÔNG phải "không lỗi". */
  issues: MissionIssue[] | null;
  /** seq của các item đang có lỗi — để tô đỏ dòng và marker. */
  badSeqs: ReadonlySet<number>;
}

export function useMissionDraft(): MissionDraftCheck {
  const takeoffAlt = useMissionStore((s) => s.takeoffAlt);
  const waypoints = useMissionStore((s) => s.waypoints);
  const finalCommand = useMissionStore((s) => s.finalCommand);
  const home = useHome();
  const limits = useLimits();

  return useMemo(() => {
    const items = toMissionWaypoints({ takeoffAlt, waypoints, finalCommand }, home);
    const issues = limits ? validateForUpload(items, home, limits) : null;
    const badSeqs = new Set((issues ?? []).flatMap((i) => (i.seq === null ? [] : [i.seq])));
    return { items, issues, badSeqs };
  }, [takeoffAlt, waypoints, finalCommand, home, limits]);
}
