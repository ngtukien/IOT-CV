#pragma once
// Tra mot cau JSON kem ma trang thai HTTP. Dung chung cho moi handler (main.cpp, ota_update.cpp).
#include "esp_http_server.h"

inline esp_err_t sendJson(httpd_req_t *req, const char *status, const char *body) {
  httpd_resp_set_status(req, status);
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_sendstr(req, body);
}
