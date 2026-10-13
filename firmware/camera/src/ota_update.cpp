// Nap firmware camera qua Wi-Fi (plans/phase-12 §12.9).
//
//   POST /update   body = nguyen file firmware.bin (application/octet-stream)
//     X-OTA-Token: OTA_TOKEN trong include/secrets.h -> sai/thieu: 401
//     X-OTA-MD5  : md5 32 ky tu hex cua firmware.bin -> thieu/sai dang: 400; khong khop: 422
//
// Ghi vao khe OTA con lai (app0 <-> app1). Da bat dau ghi thi du thanh cong hay hong deu khoi dong
// lai: thanh cong -> otadata tro sang khe moi, chay ban moi; hong -> otadata khong doi, chay lai ban
// cu (camera da bi tat de ghi flash, khoi dong lai la cach dua no ve trang thai sach).
// Script phia laptop: scripts/esp32/ota_camera.py.
#include "ota_update.h"

#include <Arduino.h>
#include <Update.h>
#include <atomic>
#include <cctype>
#include <cstring>
#include "esp_ota_ops.h"
#include "http_json.h"
#include "secrets.h"

static const size_t OTA_CHUNK_BYTES = 4096;
static const uint32_t OTA_REBOOT_DELAY_MS = 500;  // de cau tra loi HTTP kip di het truoc khi reset
static const int OTA_RECV_TIMEOUT_RETRIES = 5;    // moi lan cho bang recv_wait_timeout cua may chu
static const size_t MD5_HEX_LEN = 32;
static const size_t SHA_PREFIX_BYTES = 8;         // 8 byte dau = 16 ky tu hex

static OtaBeforeFlashFn beforeFlashFn = nullptr;
static std::atomic<bool> busy{false};
static std::atomic<uint32_t> rebootAtMs{0};  // 0 = khong hen khoi dong lai
static char firmwareSha[SHA_PREFIX_BYTES * 2 + 1];
static uint8_t chunk[OTA_CHUNK_BYTES];  // tinh: khong dat 4 KB len stack cua task may chu HTTP

void otaInit(OtaBeforeFlashFn beforeFlash) {
  beforeFlashFn = beforeFlash;
  // SHA-256 cua file ELF, esptool ghi vao anh firmware luc build; laptop doc cung gia tri nay tu
  // firmware.bin de chung minh chip dang chay dung ban vua nap.
  const esp_app_desc_t *desc = esp_ota_get_app_description();
  for (size_t i = 0; i < SHA_PREFIX_BYTES; i++) {
    snprintf(&firmwareSha[i * 2], 3, "%02x", desc->app_elf_sha256[i]);
  }
}

const char *otaFirmwareSha() { return firmwareSha; }

const char *otaRunningPartition() {
  const esp_partition_t *p = esp_ota_get_running_partition();
  return p ? p->label : "unknown";
}

bool otaInProgress() { return busy.load(); }

static void scheduleReboot() {
  uint32_t at = millis() + OTA_REBOOT_DELAY_MS;
  rebootAtMs = at ? at : 1;
}

void otaLoop() {
  uint32_t at = rebootAtMs.load();
  if (at != 0 && (int32_t)(millis() - at) >= 0) {
    Serial.println("OTA khoi dong lai");
    Serial.flush();
    ESP.restart();
  }
}

static bool readHeader(httpd_req_t *req, const char *name, char *out, size_t outSize) {
  size_t len = httpd_req_get_hdr_value_len(req, name);
  if (len == 0 || len >= outSize) return false;
  return httpd_req_get_hdr_value_str(req, name, out, outSize) == ESP_OK;
}

// So het chieu dai, khong dung som o ky tu sai dau tien.
static bool tokenMatches(const char *given) {
  size_t n = strlen(OTA_TOKEN);
  if (strlen(given) != n) return false;
  unsigned char diff = 0;
  for (size_t i = 0; i < n; i++) diff |= (unsigned char)(given[i] ^ OTA_TOKEN[i]);
  return diff == 0;
}

static bool isMd5Hex(const char *s) {
  if (strlen(s) != MD5_HEX_LEN) return false;
  for (size_t i = 0; i < MD5_HEX_LEN; i++) {
    if (!isxdigit((unsigned char)s[i])) return false;
  }
  return true;
}

// Hong SAU khi camera da tat va da bat dau ghi: huy, tra loi, roi khoi dong lai ve ban cu.
static esp_err_t failAfterStart(httpd_req_t *req, const char *status, const char *reason) {
  Update.abort();
  Serial.printf("OTA FAIL %s\n", reason);
  char body[128];
  snprintf(body, sizeof body, "{\"error\":\"%s\"}", reason);
  scheduleReboot();
  return sendJson(req, status, body);
}

esp_err_t otaUpdateHandler(httpd_req_t *req) {
  char token[80];
  char md5[40];
  if (!readHeader(req, "X-OTA-Token", token, sizeof token) || !tokenMatches(token)) {
    return sendJson(req, "401 Unauthorized", "{\"error\":\"sai hoac thieu X-OTA-Token\"}");
  }
  if (!readHeader(req, "X-OTA-MD5", md5, sizeof md5) || !isMd5Hex(md5)) {
    return sendJson(req, "400 Bad Request", "{\"error\":\"X-OTA-MD5 phai la 32 ky tu hex\"}");
  }
  size_t total = req->content_len;
  if (total == 0) return sendJson(req, "400 Bad Request", "{\"error\":\"body rong\"}");
  bool idle = false;
  if (!busy.compare_exchange_strong(idle, true)) {
    return sendJson(req, "409 Conflict", "{\"error\":\"dang nap ban khac\"}");
  }
  if (!Update.begin(total)) {  // chua dung gi: camera van chay, khong can khoi dong lai
    busy = false;
    char body[96];
    snprintf(body, sizeof body, "{\"error\":\"%s\"}", Update.errorString());
    return sendJson(req, "413 Payload Too Large", body);
  }
  Update.setMD5(md5);
  Serial.printf("OTA bat dau bytes=%u\n", (unsigned)total);
  if (beforeFlashFn) beforeFlashFn();

  size_t remaining = total;
  int timeouts = 0;
  while (remaining > 0) {
    size_t want = remaining < OTA_CHUNK_BYTES ? remaining : OTA_CHUNK_BYTES;
    int got = httpd_req_recv(req, (char *)chunk, want);
    if (got == HTTPD_SOCK_ERR_TIMEOUT && ++timeouts <= OTA_RECV_TIMEOUT_RETRIES) continue;
    if (got <= 0) return failAfterStart(req, "400 Bad Request", "nhan thieu du lieu");
    timeouts = 0;
    if (Update.write(chunk, (size_t)got) != (size_t)got) {
      return failAfterStart(req, "500 Internal Server Error", Update.errorString());
    }
    remaining -= (size_t)got;
  }
  if (!Update.end()) return failAfterStart(req, "422 Unprocessable Entity", Update.errorString());

  Serial.printf("OTA OK %u byte -> khoi dong lai vao ban moi\n", (unsigned)total);
  scheduleReboot();
  char body[64];
  snprintf(body, sizeof body, "{\"ok\":true,\"bytes\":%u}", (unsigned)total);
  return sendJson(req, "200 OK", body);
}
