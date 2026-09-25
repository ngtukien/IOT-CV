/**
 * Nạp mission qua WebSocket và xử lý phần trả lời (plan Phase 09 §9.6).
 *
 * Chuỗi mà người dùng phải NHÌN THẤY, không bước nào được giấu:
 *
 *   Đang kiểm tra… → Đang nạp 3/7 → Đang đọc lại… → Đã nạp xong
 *
 * "Đang đọc lại" là chỗ hệ thống tự kiểm chứng lại chính mình: backend đọc
 * ngược mission từ FC và so với cái vừa gửi. Chỉ khi khớp mới có `ack done`.
 *
 * `total` của `mission.progress` tính cả ô HOME (seq 0) mà backend chèn ở đầu
 * — mission 6 item hiện `x/7`. Ta hiện đúng số backend báo, không tự trừ đi.
 */
import { toast } from "sonner";

import type { LatLon } from "@/lib/geo";
import type { AckPayload, ErrorPayload } from "@/lib/protocol";
import { ERROR_CODE_LABEL } from "@/lib/protocol";
import { sendUplink } from "@/lib/uplink";
import { toMissionWaypoints, useMissionStore } from "@/store/mission";
import { useTelemetryStore, webEvent } from "@/store/telemetry";

const COMMAND = "cmd.mission.upload";

/**
 * Gửi bản nháp hiện tại. `auto_start` LUÔN `false`: nạp và cho bay AUTO là hai
 * quyết định, tách thành hai nút (BẮT ĐẦU AUTO là của Phase 10, có hộp xác nhận).
 * Trả `false` khi socket chưa mở — lệnh không đi.
 */
export function startMissionUpload(home: LatLon | null): boolean {
  const store = useMissionStore.getState();
  const waypoints = toMissionWaypoints(store, home);
  const id = sendUplink(COMMAND, { waypoints, auto_start: false });
  if (id === null) {
    toast.error("Chưa nối được backend — mission chưa được gửi");
    return false;
  }
  store.beginUpload(id);
  useTelemetryStore
    .getState()
    .pushEvent(webEvent("info", "mission.upload_sent", `Đã gửi mission ${waypoints.length} item lên backend để kiểm tra và nạp`));
  return true;
}

export function handleMissionAck(ack: AckPayload): void {
  const store = useMissionStore.getState();
  if (!store.onAck(ack) || ack.status !== "done") return;
  const { uploadState } = useMissionStore.getState();
  if (uploadState === "done") {
    const count = typeof ack.detail?.count === "number" ? ack.detail.count : null;
    toast.success("Đã nạp mission và đọc lại khớp", {
      description: count === null ? undefined : `${count} item — đây là mission FC đang giữ`,
    });
  } else {
    toast.error("Nạp mission chưa được xác nhận", { description: useMissionStore.getState().lastErrors[0] });
  }
}

export function handleMissionProgress(detail: Record<string, unknown> | null | undefined): void {
  const sent = detail?.sent;
  const total = detail?.total;
  if (typeof sent !== "number" || typeof total !== "number") return;
  useMissionStore.getState().onProgress(sent, total);
}

/** Trả `true` nếu lỗi này là của lần nạp đang chờ (đã hiện ở panel mission). */
export function handleMissionError(err: ErrorPayload): boolean {
  if (!useMissionStore.getState().onError(err)) return false;

  const log = useTelemetryStore.getState().pushEvent;
  const label = ERROR_CODE_LABEL[err.code as keyof typeof ERROR_CODE_LABEL] ?? err.code;
  log(webEvent("warn", `ws.error.${err.code}`, `Nạp mission — ${label}: ${err.message}`, { ref: err.ref ?? null }));

  switch (err.code) {
    case "validation_failed":
      // Nút NẠP chỉ bấm được khi kiểm tra tại chỗ KHÔNG thấy lỗi nào. Backend
      // vẫn từ chối nghĩa là hai bản kiểm tra đã trôi khỏi nhau (§9.5.2) —
      // hoặc trạng thái drone vừa đổi giữa lúc bấm (mất GPS fix).
      log(
        webEvent(
          "warn",
          "mission.rules_drift",
          "Backend từ chối mission mà kiểm tra tại chỗ cho qua — luật ở web và backend có thể đã lệch nhau (missionRules.ts), hoặc trạng thái drone vừa đổi",
          { errors: useMissionStore.getState().lastErrors },
        ),
      );
      toast.error("Backend từ chối mission", { description: useMissionStore.getState().lastErrors.join("\n") });
      return true;
    case "timeout":
      toast.error("FC không trả lời — thử nạp lại", { description: err.message });
      return true;
    default:
      toast.error(label, { description: err.message });
      return true;
  }
}
