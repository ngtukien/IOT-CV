/*
 * ESP32 MAVLink bridge — GIAI ĐOẠN 56, 57.
 *
 * Firmware này CHỈ làm hai việc:
 *
 *     UART -> UDP
 *     UDP  -> UART
 *
 * Không parse flight logic, không quyết định gì về chuyến bay. Mọi thông minh
 * nằm ở ArduPilot (trên FC) và backend (trên laptop).
 *
 * Luồng:
 *     FC MAVLink -> UART -> ESP32 -> Wi-Fi -> UDP 14550 -> Laptop
 *     và chiều ngược lại.
 *
 * Lưu ý phần cứng:
 * - Dùng ESP32 DevKit RIÊNG, không dùng ESP32-CAM kiêm bridge.
 * - UART của FC và ESP32 đều logic 3.3V, nhưng vẫn phải kiểm tra board cụ thể
 *   trước khi đấu dây.
 * - FC TX -> ESP32 RX, FC RX <- ESP32 TX, GND chung, nguồn 5V lấy từ UBEC riêng.
 *
 * TODO GIAI ĐOẠN 57:
 * - [ ] Kết nối Wi-Fi (STA hoặc AP), có reconnect.
 * - [ ] UART2 ở 57600 hoặc 115200 (khớp SERIALx_BAUD trên FC).
 * - [ ] Đọc UART -> gửi UDP tới địa chỉ laptop.
 * - [ ] Nhận UDP -> ghi ra UART.
 * - [ ] Buffer đủ lớn, không blocking; không log ra chính UART đang nói MAVLink.
 */

// #include <WiFi.h>
// #include <WiFiUdp.h>

void setup() {
  // TODO: Serial2.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN); WiFi.begin(...)
}

void loop() {
  // TODO: UART -> UDP, UDP -> UART
}
