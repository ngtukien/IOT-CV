// Kết nối WebSocket telemetry của backend (GIAI ĐOẠN 7).
// Frontend KHÔNG đọc MAVLink trực tiếp — chỉ nhận JSON đã chuẩn hoá.

const RECONNECT_DELAY_MS = 1000;

function websocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Khi mở file tĩnh trực tiếp, mặc định về backend chạy ở localhost:8000.
  const host = window.location.host || "127.0.0.1:8000";
  return `${protocol}//${host}/ws/telemetry`;
}

export function connectTelemetry({ onUpdate, onOpen, onClose }) {
  let socket = null;

  const open = () => {
    socket = new WebSocket(websocketUrl());

    socket.addEventListener("open", () => onOpen?.());

    socket.addEventListener("message", (event) => {
      try {
        onUpdate?.(JSON.parse(event.data));
      } catch (error) {
        console.error("Telemetry JSON không hợp lệ", error);
      }
    });

    socket.addEventListener("close", () => {
      onClose?.();
      window.setTimeout(open, RECONNECT_DELAY_MS);
    });

    socket.addEventListener("error", () => socket?.close());
  };

  open();

  return {
    close() {
      socket?.close();
    },
  };
}
