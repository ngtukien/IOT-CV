/**
 * Luật bật/tắt WEB CONTROL (plan Phase 10 §10.1.4). Dùng chung cho công tắc ở
 * panel Lái tay và badge ở `ConnectionBar` — một luật, hai chỗ bấm.
 *
 * Trạng thái hiển thị là `status.safety.web_control_enabled` của backend VÀ tab
 * này là người đã bật. Bấm xong KHÔNG đổi ngay: chờ `ack done` + `status` mới.
 */
import { MSG_OTHER_TAB, sendCommand } from "@/hooks/controlUplink";
import { useControlStore } from "@/store/control";
import { useTelemetryStore } from "@/store/telemetry";

/** Lý do công tắc đang khoá, hoặc `null` khi bấm được. Thứ tự = thứ tự cần sửa. */
function useEnableBlocker(): string | null {
  const socketOpen = useTelemetryStore((s) => s.connection === "open");
  const connected = useTelemetryStore((s) => s.telemetry?.connected === true);
  const mode = useTelemetryStore((s) => s.telemetry?.mode);
  const enabled = useTelemetryStore((s) => s.status?.safety.web_control_enabled === true);
  const mine = useControlStore((s) => s.claimed);
  if (!socketOpen) return "Chưa nối được backend";
  if (!connected) return "Backend chưa liên lạc được với drone";
  if (enabled && !mine) return MSG_OTHER_TAB;
  if (mode !== "GUIDED") return "Cần đổi sang GUIDED trước";
  return null;
}

export interface WebControlToggle {
  /** Backend xác nhận đang bật VÀ chính tab này là người bật. */
  on: boolean;
  /** Đang chờ backend trả lời lệnh bật/tắt. */
  pending: boolean;
  disabled: boolean;
  /** Vì sao chưa bật được; `null` khi bật được. */
  blocker: string | null;
  toggle(next: boolean): void;
}

export function useWebControlToggle(): WebControlToggle {
  const enabled = useTelemetryStore((s) => s.status?.safety.web_control_enabled === true);
  const mine = useControlStore((s) => s.claimed);
  const pending = useControlStore((s) => Object.values(s.pending).some((p) => p.command === "cmd.web_control_enable"));
  const blocker = useEnableBlocker();
  const on = enabled && mine;
  return {
    on,
    pending,
    blocker,
    disabled: pending || (!on && blocker !== null),
    toggle: (next) => {
      sendCommand(
        "cmd.web_control_enable",
        { enabled: next },
        next ? { label: "Bật WEB CONTROL", target: "enable" } : { label: "Tắt WEB CONTROL", target: "disable" },
      );
    },
  };
}

