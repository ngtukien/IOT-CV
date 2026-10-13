#pragma once
// Nap firmware camera qua Wi-Fi: POST /update (plans/phase-12 §12.9). Chi tiet: ota_update.cpp.
#include "esp_http_server.h"

// Ham main.cpp cung cap: dung luong /stream va tat camera truoc khi ghi flash.
using OtaBeforeFlashFn = void (*)();

void otaInit(OtaBeforeFlashFn beforeFlash);  // goi mot lan trong setup(), truoc khi mo may chu HTTP
esp_err_t otaUpdateHandler(httpd_req_t *req);
bool otaInProgress();
void otaLoop();                       // goi trong loop(): khoi dong lai khi toi hen
const char *otaFirmwareSha();         // 16 ky tu hex dau cua SHA-256 file ELF dang chay
const char *otaRunningPartition();    // "app0" hoac "app1"
