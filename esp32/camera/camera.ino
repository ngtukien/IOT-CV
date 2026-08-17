/*
 * ESP32-CAM streamer — GIAI ĐOẠN 19, 66, 69, 70.
 *
 * Version 1 bắt đầu ở JPEG 640x480 (VGA), KHÔNG bắt đầu ở 1600x1200 livestream:
 * OV2640 độ phân giải cao tốn RAM/băng thông và thường cần PSRAM.
 *
 * Yêu cầu:
 * - Cấp nguồn từ UBEC 5V RIÊNG, không dùng chung rail với FC. Camera kéo dòng
 *   mạnh khi truyền và có thể gây reset/nhiễu (đây là lý do có UBEC riêng).
 * - Không đưa YOLO lên ESP32 (Version 1). ESP32 chỉ gửi ảnh.
 * - Camera chết KHÔNG được ảnh hưởng tới bay (SAFETY.md mục 9).
 *
 * TODO GIAI ĐOẠN 19:
 * - [ ] Cấu hình camera FRAMESIZE_VGA, PIXFORMAT_JPEG, quality vừa phải.
 * - [ ] HTTP server: /capture (1 ảnh) và /stream (MJPEG).
 * - [ ] In IP ra Serial để laptop biết địa chỉ.
 * - [ ] Đo FPS và latency thực tế, ghi vào docs/test-log.md.
 */

// #include "esp_camera.h"
// #include <WiFi.h>

void setup() {
  // TODO: camera_config_t + esp_camera_init + WiFi + HTTP server
}

void loop() {
  // TODO: phục vụ HTTP request
}
