/**
 * Vòng đời socket GCS, gắn vào store. Gọi MỘT lần, ở `App`.
 *
 * Effect trả về `sock.close()` — BẮT BUỘC. React 19 `StrictMode` chạy effect hai
 * lần ở dev để bắt đúng lỗi quên dọn dẹp; thiếu cleanup là có hai WebSocket và
 * tab tự giành quyền lái với chính nó (Phase 10). `createGcsSocket` còn mở kết
 * nối trễ một nhịp nên lượt mount đầu không kịp tạo kết nối nào (xem `ws.ts`).
 */
import { useEffect } from "react";
import { toast } from "sonner";

import { fetchEvents } from "@/lib/api";
import { ERROR_CODE_LABEL } from "@/lib/protocol";
import type { ServerEnvelope } from "@/lib/protocol";
import { setActiveSocket } from "@/lib/uplink";
import { createGcsSocket, wsUrlFromLocation } from "@/lib/ws";
import { handleMissionAck, handleMissionError, handleMissionProgress } from "@/hooks/missionUplink";
import { useMissionStore } from "@/store/mission";
import { fromServerEvent, useTelemetryStore, webEvent } from "@/store/telemetry";

/** Lấy bao nhiêu sự kiện cũ lúc mở trang (`GET /api/events?limit=`). */
export const EVENT_HISTORY_LIMIT = 100;

/**
 * Chỉ bật toast cho sự kiện `error` xảy ra trong chừng này giây gần đây. Backend
 * phát lại 50 sự kiện cũ cho mỗi socket mới — không có ngưỡng này thì mỗi lần
 * nối lại, mọi lỗi cũ lại nhảy toast.
 */
export const TOAST_MAX_AGE_S = 10;

function handleMessage(msg: ServerEnvelope): void {
  const store = useTelemetryStore.getState();
  switch (msg.type) {
    case "telemetry":
      store.applyTelemetry(msg.data);
      return;
    case "status":
      store.applyStatus(msg.data);
      return;
    case "detection":
      store.applyDetection(msg.data);
      return;
    case "event": {
      if (msg.data.code === "mission.progress") handleMissionProgress(msg.data.detail);
      const entry = fromServerEvent(msg.data, msg.ts);
      const isNew = store.pushEvent(entry);
      // Toast chỉ cho `error`. Toast cho mọi `info` dạy người dùng phớt lờ
      // toast — đúng lúc cái quan trọng hiện ra thì họ không nhìn nữa.
      if (isNew && entry.level === "error" && Date.now() / 1000 - entry.ts <= TOAST_MAX_AGE_S) {
        toast.error(entry.message, { description: entry.code });
      }
      return;
    }
    case "error": {
      // Lỗi của lần nạp mission: panel mission tự hiện và tự bật toast phù hợp.
      if (handleMissionError(msg.data)) return;
      // Backend từ chối một message của chính tab này.
      const label = ERROR_CODE_LABEL[msg.data.code as keyof typeof ERROR_CODE_LABEL] ?? msg.data.code;
      store.pushEvent(webEvent("warn", `ws.error.${msg.data.code}`, `${label}: ${msg.data.message}`, { ref: msg.data.ref ?? null }));
      toast.error(label, { description: msg.data.message });
      return;
    }
    case "ack":
      // Phase 09 chỉ có một lệnh chậm là nạp mission; các ack khác là của Phase 10.
      handleMissionAck(msg.data);
      return;
    case "pong":
      return;
  }
}

async function loadEventHistory(signal: AbortSignal): Promise<void> {
  try {
    const history = await fetchEvents(EVENT_HISTORY_LIMIT, { signal });
    const now = Date.now() / 1000;
    for (const e of history) useTelemetryStore.getState().pushEvent(fromServerEvent(e, now));
  } catch (err) {
    if (signal.aborted) return;
    // Không có lịch sử thì bảng vẫn chạy với sự kiện trực tiếp — chỉ ghi lại, không chặn.
    useTelemetryStore
      .getState()
      .pushEvent(webEvent("warn", "api.events_failed", `Không lấy được lịch sử sự kiện: ${(err as Error).message}`));
  }
}

export function useWebSocket(): void {
  useEffect(() => {
    const store = useTelemetryStore.getState();
    const history = new AbortController();
    void loadEventHistory(history.signal);

    let wasOpen = false;
    const sock = createGcsSocket({
      url: wsUrlFromLocation(window.location),
      onMessage: handleMessage,
      onFrame: (at) => store.markMessage(at),
      onNotice: (n) => store.pushEvent(webEvent(n.level, n.code, n.message, n.detail ?? null)),
      onState: (state, info) => {
        store.setConnection(state, info.nextRetryAt);
        if (state === "open") {
          wasOpen = true;
          if (info.reconnected) store.pushEvent(webEvent("info", "ws.reconnected", "Đã nối lại với backend"));
        } else if (state === "closed" && wasOpen) {
          wasOpen = false;
          useMissionStore.getState().onSocketLost();
          store.pushEvent(webEvent("warn", "ws.lost", "Mất kết nối với backend — đang thử nối lại"));
        }
      },
    });
    setActiveSocket(sock);

    return () => {
      history.abort();
      setActiveSocket(null);
      sock.close();
    };
  }, []);
}
