/**
 * Ba lệnh THOÁT HIỂM dùng chung cho panel Chế độ bay, thanh lệnh nhanh (mọi
 * trang) và phím H. Một hàm cho mỗi lệnh — nhãn và `target`
 * (để nút biết lệnh chờ là của nó) không bao giờ lệch giữa các chỗ bấm.
 *
 * Cả ba KHÔNG hỏi xác nhận (plan Phase 10 §10.3.2): hậu quả là DỪNG một điều gì
 * đó, và bắt xác nhận lúc đang hoảng là phản tác dụng.
 */
import { sendCommand } from "@/hooks/controlUplink";

export function sendHold(): string | null {
  return sendCommand("cmd.hold", {}, { label: "HOLD (LOITER)", target: "hold" });
}

export function sendRtl(): string | null {
  return sendCommand("cmd.rtl", {}, { label: "RTL", target: "rtl" });
}

export function sendLand(): string | null {
  return sendCommand("cmd.land", {}, { label: "LAND", target: "land" });
}
