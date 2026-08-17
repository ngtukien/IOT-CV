// Control từ web (GIAI ĐOẠN 9-12) — CHƯA BẬT.
//
// Thứ tự bắt buộc trước khi mở khoá phần này:
//   1. backend/mavlink/control.py implement xong và test trên SITL.
//   2. Dead-man safety (GIAI ĐOẠN 11) pass đủ 3 test:
//        nhấn W  -> UAV tiến
//        thả W   -> UAV dừng
//        đóng browser khi đang giữ W -> UAV dừng
//   3. Nút HOLD / RTL / LAND hoạt động trên SITL (GIAI ĐOẠN 12).
//
// Khi implement WASD: keydown gửi lệnh LIÊN TỤC (không phải một lần), keyup gửi
// velocity = 0. Backend vẫn có timeout độc lập ~300 ms.

import { logEvent } from "./ui.js";

export function initControl() {
  logEvent("Control chưa bật (GIAI ĐOẠN 9-12)");
}
