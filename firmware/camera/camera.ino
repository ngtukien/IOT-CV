/*
 * Camera streamer — GIAI ĐOẠN 19, 66, 69, 70.
 *
 * Phần cứng: bo ESP32-S3 N16R8 + module OV3660 (chốt 12/10/2026,
 * docs/phan-cung-thuc-te.md). File khung này viết từ thời ESP32-CAM/OV2640;
 * Phase 12 thay bằng project PlatformIO trong firmware/camera/ (plans/phase-12 §12.3–12.5).
 *
 * Version 1 bắt đầu ở JPEG 640x480 (VGA), KHÔNG bắt đầu ở độ phân giải cao
 * (OV3660 tới 2048x1536): tốn RAM/băng thông; bo N16R8 có 8 MB PSRAM octal.
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
