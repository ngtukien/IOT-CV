// Firmware camera IOT-CV: bo ESP32-S3 N16R8 + OV3660, phat MJPEG cho backend (plans/phase-12 §12.4).
//
//   GET http://<ip>:STREAM_PORT/stream      luong MJPEG, dung hop dong docs/hop-dong-mjpeg.md
//   GET http://<ip>:HTTP_PORT/set?quality=N doi jpeg_quality luc dang chay (N trong 0..63)
//   GET http://<ip>:HTTP_PORT/status        JSON trang thai
//   POST http://<ip>:HTTP_PORT/update       nap firmware qua Wi-Fi (ota_update.cpp, plan §12.9)
//
// Chay o che do STA: noi vao Mobile Hotspot cua laptop, khong tu phat Wi-Fi. Camera hong thi
// /status van tra loi (camera:"FAIL") de backend biet - camera chet khong duoc keo gi theo
// (SAFETY.md muc 9). Moi so tinh chinh nam trong include/secrets.h.
#include <Arduino.h>
#include <WiFi.h>
#include <atomic>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "lwip/sockets.h"
#include "secrets.h"
#include "camera_pins.h"
#include "http_json.h"
#include "ota_update.h"

static const int JPEG_QUALITY_MIN = 0;
static const int JPEG_QUALITY_MAX = 63;
static const int FB_COUNT = 2;
// Sau khi doi jpeg_quality, hang doi CAMERA_GRAB_LATEST con FB_COUNT khung nen bang chat luong
// cu, cong mot khung dang chup do dang. Bo chung di de X-Jpeg-Quality luon la gia tri THAT cua
// khung (diem bat buoc so 3 cua plan). So nay da kiem bang scripts/esp32/camera_check.py.
static const int QUALITY_SETTLE_FRAMES = FB_COUNT + 2;
// 10 MHz, KHONG phai 20 MHz nhu CameraWebServer goc: tren bo nay XCLK 20 MHz lam nhieu Wi-Fi.
// Do 13/10/2026 (gui 512 KB tu RAM trong, khong dung camera): tat camera 285 KB/s; XCLK 20 MHz
// 58-67 KB/s; 16 MHz 71-87 KB/s; 10 MHz 293-297 KB/s. Luong VGA: 20 MHz ~3 fps, 10 MHz ~8,5 fps.
// Doi CAMERA_GRAB_WHEN_EMPTY o 20 MHz khong do duoc gi (18-63 KB/s) -> loi o XCLK, khong o PSRAM.
static const uint32_t XCLK_FREQ_HZ = 10000000;
static const int GRAB_FAIL_LIMIT = 10;           // lien tiep khong lay duoc khung -> dong luong
static const uint32_t SLOW_FRAME_LOG_MS = 1000;  // vong lay+gui mot khung lau hon -> in ra Serial
static const char *STREAM_CONTENT_TYPE = "multipart/x-mixed-replace; boundary=frame";
// Doi luong /stream dung truoc khi tat camera de nap OTA. Lon hon send_wait_timeout (5 s) cua may
// chu HTTP: mot lan gui dang ket se het han va vong phat thoat ra.
static const uint32_t OTA_STREAM_STOP_WAIT_MS = 6000;
static const size_t HTTPD_STACK_BYTES = 8192;  // OTA ghi flash ngay trong task may chu

static esp_err_t camErr = ESP_FAIL;
static uint16_t sensorPid = 0;
static SemaphoreHandle_t stateLock;
static int activeQuality = JPEG_QUALITY_DEFAULT;  // chat luong cua khung ke tiep duoc gui
static int settleLeft = 0;
static uint32_t nextFrameId = 0;                   // dem moi khung lay tu cam bien, ke ca khung bo
// Tang o task may chu /stream, doc o task /status va loop() -> std::atomic, khong phai volatile
// (volatile khong lam phep ++ thanh nguyen tu, va ++ tren volatile da bi C++20 bo).
static std::atomic<uint32_t> framesSent{0};
static std::atomic<int> streamClients{0};

struct FramesizeName {
  framesize_t size;
  const char *name;
};
static const FramesizeName FRAMESIZE_NAMES[] = {
    {FRAMESIZE_QQVGA, "QQVGA"}, {FRAMESIZE_QVGA, "QVGA"}, {FRAMESIZE_CIF, "CIF"},
    {FRAMESIZE_HVGA, "HVGA"},   {FRAMESIZE_VGA, "VGA"},   {FRAMESIZE_SVGA, "SVGA"},
    {FRAMESIZE_XGA, "XGA"},     {FRAMESIZE_HD, "HD"},     {FRAMESIZE_SXGA, "SXGA"},
    {FRAMESIZE_UXGA, "UXGA"},   {FRAMESIZE_FHD, "FHD"},   {FRAMESIZE_QXGA, "QXGA"},
};

static const char *framesizeName(framesize_t size) {
  for (const FramesizeName &f : FRAMESIZE_NAMES) {
    if (f.size == size) return f.name;
  }
  return "UNKNOWN";
}

static const char *currentFramesizeName() {
  sensor_t *s = esp_camera_sensor_get();
  return s ? framesizeName(s->status.framesize) : "UNKNOWN";
}

static esp_err_t initCamera() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM;  c.pin_d1 = Y3_GPIO_NUM;  c.pin_d2 = Y4_GPIO_NUM;  c.pin_d3 = Y5_GPIO_NUM;
  c.pin_d4 = Y6_GPIO_NUM;  c.pin_d5 = Y7_GPIO_NUM;  c.pin_d6 = Y8_GPIO_NUM;  c.pin_d7 = Y9_GPIO_NUM;
  c.pin_xclk = XCLK_GPIO_NUM;  c.pin_pclk = PCLK_GPIO_NUM;
  c.pin_vsync = VSYNC_GPIO_NUM;  c.pin_href = HREF_GPIO_NUM;
  c.pin_sccb_sda = SIOD_GPIO_NUM;  c.pin_sccb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn = PWDN_GPIO_NUM;  c.pin_reset = RESET_GPIO_NUM;
  c.xclk_freq_hz = XCLK_FREQ_HZ;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = FRAME_SIZE_DEFAULT;
  c.jpeg_quality = JPEG_QUALITY_DEFAULT;
  c.fb_count = FB_COUNT;
  c.fb_location = CAMERA_FB_IN_PSRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;  // luon gui khung moi nhat, khong xep hang khung cu

  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) return err;
  sensor_t *s = esp_camera_sensor_get();
  sensorPid = s->id.PID;
  if (sensorPid == OV3660_PID) {  // chep tu CameraWebServer.ino goc
    s->set_vflip(s, 1);           // anh mac dinh bi lat doc
    s->set_brightness(s, 1);      // tang sang mot nac
    s->set_saturation(s, -2);     // giam do gat mau
  }
  return ESP_OK;
}

// Lay mot khung kem nhan chat luong va so thu tu. Khung chup truoc khi chat luong moi co hieu
// luc thi bo (so thu tu van tang, nen ben doc thay khoang nhay = khung bi bo).
static camera_fb_t *grabLabeledFrame(int *quality, uint32_t *frameId) {
  for (;;) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) return nullptr;
    xSemaphoreTake(stateLock, portMAX_DELAY);
    *frameId = nextFrameId++;
    bool settling = settleLeft > 0;
    if (settling) settleLeft--;
    *quality = activeQuality;
    xSemaphoreGive(stateLock);
    if (!settling) return fb;
    esp_camera_fb_return(fb);
  }
}

static esp_err_t streamHandler(httpd_req_t *req) {
  if (camErr != ESP_OK || otaInProgress()) {
    return sendJson(req, "503 Service Unavailable", "{\"error\":\"camera khong san sang\"}");
  }
  httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  // Tat Nagle: duoi cung cua moi khung la mot goi nho, khong de no nam cho ACK (Windows tri hoan
  // ACK toi ~200 ms). Do 13/10/2026: rieng viec nay KHONG nang duoc fps - gioi han khi do la
  // nhieu XCLK (xem XCLK_FREQ_HZ). Giu lai vi vo hai.
  int fd = httpd_req_to_sockfd(req);
  int noDelay = 1;
  setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &noDelay, sizeof noDelay);
  streamClients++;
  Serial.println("STREAM client connected");
  char head[256];
  bool firstPart = true;
  int failures = 0;
  esp_err_t res = ESP_OK;
  while (res == ESP_OK && !otaInProgress()) {  // OTA bat dau -> nha camera cho viec ghi flash
    int quality = 0;
    uint32_t frameId = 0;
    uint32_t t0 = millis();
    camera_fb_t *fb = grabLabeledFrame(&quality, &frameId);
    uint32_t grabMs = millis() - t0;
    if (!fb) {
      Serial.printf("FRAME grab FAIL lan %d\n", failures + 1);
      if (++failures >= GRAB_FAIL_LIMIT) break;
      continue;
    }
    failures = 0;
    uint32_t tsMs = (uint32_t)(fb->timestamp.tv_sec * 1000ULL + fb->timestamp.tv_usec / 1000);
    // Thu tu header dung docs/hop-dong-mjpeg.md §2. "\r\n" sau than JPEG cua khung TRUOC duoc gui
    // o dau header khung nay (byte tren day y het) - bot mot lan gui nho moi khung.
    int n = snprintf(head, sizeof head,
                     "%s--frame\r\nContent-Type: image/jpeg\r\nX-Frame-Id: %u\r\nX-Timestamp-Ms: %u\r\n"
                     "X-Jpeg-Quality: %d\r\nX-Framesize: %s\r\nContent-Length: %u\r\n\r\n",
                     firstPart ? "" : "\r\n", (unsigned)frameId, (unsigned)tsMs, quality,
                     currentFramesizeName(), (unsigned)fb->len);
    firstPart = false;
    res = httpd_resp_send_chunk(req, head, n);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    if (res == ESP_OK) framesSent++;
    uint32_t loopMs = millis() - t0;
    if (loopMs >= SLOW_FRAME_LOG_MS) {  // phan biet "camera ket" (grab) voi "mang ket" (send)
      Serial.printf("STREAM slow frame id=%u grab_ms=%u send_ms=%u res=0x%x\n", (unsigned)frameId,
                    (unsigned)grabMs, (unsigned)(loopMs - grabMs), (unsigned)res);
    }
  }
  streamClients--;
  Serial.printf("STREAM client disconnected res=0x%x frames_sent=%u\n", (unsigned)res, (unsigned)framesSent.load());
  return res == ESP_OK ? ESP_FAIL : res;  // dong ket noi; luong MJPEG khong co ket thuc "dep"
}

// Doc quality=N tu query. Tra false neu thieu, khong phai so nguyen, hoac ngoai 0..63.
static bool parseQuality(httpd_req_t *req, int *out) {
  char query[64];
  char value[16];
  if (httpd_req_get_url_query_str(req, query, sizeof query) != ESP_OK) return false;
  if (httpd_query_key_value(query, "quality", value, sizeof value) != ESP_OK) return false;
  char *end = nullptr;
  long q = strtol(value, &end, 10);
  if (end == value || *end != '\0') return false;
  if (q < JPEG_QUALITY_MIN || q > JPEG_QUALITY_MAX) return false;
  *out = (int)q;
  return true;
}

static esp_err_t setHandler(httpd_req_t *req) {
  int q = 0;
  if (!parseQuality(req, &q)) {
    return sendJson(req, "400 Bad Request", "{\"error\":\"quality phai la so nguyen trong 0..63\"}");
  }
  if (camErr != ESP_OK || otaInProgress()) {
    return sendJson(req, "503 Service Unavailable", "{\"error\":\"camera khong san sang\"}");
  }
  sensor_t *s = esp_camera_sensor_get();
  xSemaphoreTake(stateLock, portMAX_DELAY);
  bool changed = q != activeQuality;
  if (changed) {
    s->set_quality(s, q);
    activeQuality = q;
    settleLeft = QUALITY_SETTLE_FRAMES;
  }
  xSemaphoreGive(stateLock);
  char body[48];
  snprintf(body, sizeof body, "{\"quality\":%d}", q);
  Serial.printf("SET quality=%d%s\n", q, changed ? "" : " (khong doi)");
  return sendJson(req, "200 OK", body);
}

static const char *cameraState() {
  if (otaInProgress()) return "OTA";
  return camErr == ESP_OK ? "OK" : "FAIL";
}

static esp_err_t statusHandler(httpd_req_t *req) {
  xSemaphoreTake(stateLock, portMAX_DELAY);
  int quality = activeQuality;
  xSemaphoreGive(stateLock);
  bool cameraOk = camErr == ESP_OK && !otaInProgress();
  char body[420];
  snprintf(body, sizeof body,
           "{\"quality\":%d,\"framesize\":\"%s\",\"rssi\":%d,\"uptime_ms\":%lu,\"frames_sent\":%u,"
           "\"camera\":\"%s\",\"sensor_pid\":\"0x%04x\",\"stream_clients\":%d,\"stream_port\":%d,"
           "\"free_psram\":%u,\"firmware_sha\":\"%s\",\"partition\":\"%s\"}",
           quality, cameraOk ? currentFramesizeName() : "UNKNOWN", (int)WiFi.RSSI(),
           (unsigned long)millis(), (unsigned)framesSent.load(), cameraState(), sensorPid,
           streamClients.load(), STREAM_PORT, (unsigned)ESP.getFreePsram(), otaFirmwareSha(),
           otaRunningPartition());
  return sendJson(req, "200 OK", body);
}

// Goi tu otaUpdateHandler ngay truoc khi ghi flash (luc nay otaInProgress() da la true): doi vong
// /stream thoat ra roi tat camera, de DMA cua camera khong chay song song voi viec ghi flash. Nap
// xong hay hong, bo deu khoi dong lai nen khong can bat camera lai o day.
static void stopCameraForOta() {
  uint32_t t0 = millis();
  while (streamClients.load() > 0 && millis() - t0 < OTA_STREAM_STOP_WAIT_MS) delay(10);
  if (streamClients.load() > 0) {
    Serial.println("OTA: luong /stream chua dung kip, de camera chay tiep trong luc ghi");
    return;
  }
  if (camErr == ESP_OK) {
    camErr = ESP_ERR_INVALID_STATE;
    esp_camera_deinit();
  }
}

static httpd_handle_t startServer(uint16_t port, uint16_t ctrlOffset, const httpd_uri_t *uris, size_t count) {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = port;
  config.ctrl_port += ctrlOffset;  // hai may chu phai khac cong dieu khien noi bo (UDP)
  config.lru_purge_enable = true;
  config.stack_size = HTTPD_STACK_BYTES;
  httpd_handle_t server = nullptr;
  if (httpd_start(&server, &config) != ESP_OK) {
    Serial.printf("HTTP start FAIL port=%u\n", port);
    return nullptr;
  }
  for (size_t i = 0; i < count; i++) httpd_register_uri_handler(server, &uris[i]);
  Serial.printf("HTTP listening port=%u\n", port);
  return server;
}

static void startServers() {
  static const httpd_uri_t controlUris[] = {
      {"/status", HTTP_GET, statusHandler, nullptr},
      {"/set", HTTP_GET, setHandler, nullptr},
      {"/update", HTTP_POST, otaUpdateHandler, nullptr},
  };
  static const httpd_uri_t streamUris[] = {
      {"/stream", HTTP_GET, streamHandler, nullptr},
  };
  startServer(HTTP_PORT, 0, controlUris, 3);
  startServer(STREAM_PORT, 1, streamUris, 1);
}

static void beginWifi() {
  // Core 2.0.x: setHostname PHAI goi truoc WiFi.mode(), goi sau thi DHCP gui ten mac dinh.
  // Dung ten nay, hotspot Windows phan giai duoc iotcv-camera.mshome.net -> khoi phai biet IP.
  WiFi.setHostname(WIFI_HOSTNAME);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // tiet kiem dien lam tre va giat luong video
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("WIFI connecting ssid=%s\n", WIFI_SSID);  // khong bao gio in mat khau
}

// Giu ket noi Wi-Fi: mat thi thu lai moi WIFI_RECONNECT_MS. In IP moi lan noi lai.
static void maintainWifi() {
  static uint32_t lastAttempt = 0;
  static bool wasConnected = false;
  bool connected = WiFi.status() == WL_CONNECTED;
  if (connected && !wasConnected) {
    Serial.printf("WIFI connected ip=%s rssi=%d\n", WiFi.localIP().toString().c_str(), (int)WiFi.RSSI());
    Serial.printf("URL stream=http://%s:%d/stream status=http://%s:%d/status\n",
                  WiFi.localIP().toString().c_str(), STREAM_PORT, WiFi.localIP().toString().c_str(), HTTP_PORT);
  }
  if (!connected && wasConnected) Serial.println("WIFI lost");
  wasConnected = connected;
  if (!connected && millis() - lastAttempt >= WIFI_RECONNECT_MS) {
    lastAttempt = millis();
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("BOOT iotcv-camera chip=%s psram=%u\n", ESP.getChipModel(), (unsigned)ESP.getPsramSize());
  stateLock = xSemaphoreCreateMutex();
  otaInit(stopCameraForOta);
  Serial.printf("FIRMWARE sha=%s partition=%s\n", otaFirmwareSha(), otaRunningPartition());
  camErr = initCamera();
  if (camErr == ESP_OK) {
    Serial.printf("camera init OK pid=0x%04x framesize=%s quality=%d\n", sensorPid, currentFramesizeName(),
                  JPEG_QUALITY_DEFAULT);
  } else {
    Serial.printf("camera init FAIL err=0x%x\n", (unsigned)camErr);
  }
  beginWifi();
  startServers();
}

void loop() {
  static uint32_t lastStatus = 0;
  otaLoop();
  maintainWifi();
  if (millis() - lastStatus >= STATUS_LOG_MS) {
    lastStatus = millis();
    Serial.printf("STATUS ip=%s rssi=%d camera=%s quality=%d frames_sent=%u clients=%d free_psram=%u\n",
                  WiFi.localIP().toString().c_str(), (int)WiFi.RSSI(), camErr == ESP_OK ? "OK" : "FAIL",
                  activeQuality, (unsigned)framesSent.load(), streamClients.load(), (unsigned)ESP.getFreePsram());
  }
  delay(50);
}
