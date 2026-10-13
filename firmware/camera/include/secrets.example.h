#pragma once
// Chep file nay thanh include/secrets.h roi dien gia tri that - hoac de script tu lam:
//   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\camera-secrets.ps1
// (doc SSID + mat khau tu Mobile Hotspot cua Windows, khong in mat khau ra man hinh).
// include/secrets.h nam trong .gitignore - KHONG BAO GIO commit mat khau Wi-Fi.

#define WIFI_SSID      "IOTCV-HOTSPOT"
#define WIFI_PASSWORD  "doi-mat-khau-nay"

// 0..63. So NHO = net hon = file to hon = fps THAP hon.
// Nguoc voi truc giac "chat luong 0-100" quen thuoc.
#define JPEG_QUALITY_DEFAULT  12
#define FRAME_SIZE_DEFAULT    FRAMESIZE_VGA   // 640x480 - dung khoi dau o day
#define WIFI_HOSTNAME         "iotcv-camera"  // hotspot Windows: iotcv-camera.mshome.net
#define WIFI_RECONNECT_MS     5000
#define HTTP_PORT             80              // /status va /set
// /stream chay tren may chu HTTP thu hai: may chu HTTP cua ESP-IDF xu ly MOT yeu cau mot luc,
// nen /stream (khong bao gio ket thuc) ma chung cong voi /set thi /set se treo suot luc phat.
#define STREAM_PORT           81
#define STATUS_LOG_MS         5000            // chu ky in dong STATUS ra Serial

// Bi mat cho POST /update (nap firmware qua Wi-Fi). camera-secrets.ps1 sinh 32 ky tu hex ngau nhien
// MOT lan va giu nguyen o cac lan sau; doi token thi ban dang chay tren chip se tu choi ban moi,
// phai nap USB mot lan. Dung de nguyen gia tri mau nay.
#define OTA_TOKEN             "chay-camera-secrets-ps1-de-sinh"
