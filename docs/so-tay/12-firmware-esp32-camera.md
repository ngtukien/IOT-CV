# Sổ tay 12 — Firmware ESP32: cầu telemetry, camera, TFmini, hotspot

Phase 12 làm xong ngày 13/10/2026, cả hai bo đã chạy trên phần cứng thật. Trang này là **chỉ mục**
và **thứ tự làm lại từ đầu**. Giải thích khái niệm ở trang riêng:

| Trang | Nội dung |
|---|---|
| [12-esp32-cho-nguoi-moi.md](12-esp32-cho-nguoi-moi.md) | ESP32 là gì, hai con trong dự án, AP/STA, UDP, MJPEG, `jpeg_quality`, PSRAM, brownout |
| [12-hotspot-laptop.md](12-hotspot-laptop.md) | Mobile Hotspot 2,4 GHz, IP thật, rule tường lửa UDP 14550, ba cái bẫy |
| [`firmware/dronebridge/README.md`](../../firmware/dronebridge/README.md) | ESP32 telemetry (DroneBridge): nạp, bảng cấu hình, đấu dây, driver, phương án hai |
| [`firmware/camera/README.md`](../../firmware/camera/README.md) | bo camera ESP32-S3 + OV3660: endpoint, nạp, nguồn, số đo, bẫy |
| [`docs/test-log.md`](../test-log.md) mục Phase 12 | số đo nghiệm thu |

## Làm lại từ đầu — thứ tự lệnh

Mọi bước là script; chỗ duy nhất cần tay người là bấm "Yes" trên hộp UAC ở bước 2.

```powershell
# 1. Hotspot 2,4 GHz, ten co dinh, khong tu tat
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\hotspot-on.ps1 -Ssid IOTCV-HOTSPOT

# 2. Rule tuong lua UDP 14550 (bam Yes tren hop UAC)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\firewall-mavlink.ps1

# 3. ESP32 telemetry (COM4): ghi cau hinh STA + hotspot vao NVS
#    (lan dau tren bo trang: nap 4 file .bin theo firmware/dronebridge/README.md muc (a) truoc)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\dronebridge-nvs.ps1

# 4. Bo camera (cong USB-UART, CH343P): sinh secrets.h, build, nap, doi bo bao IP
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\nap_camera.ps1

# 5. Nghiem thu camera qua Wi-Fi
uv run python scripts\esp32\camera_check.py --frames 300

# 6. TFmini Plus tren ban (Phase 17, khi da noi USB-TTL)
py -3.13 scripts\bench_tfmini.py COM5
```

Đọc log của bất kỳ bo nào mà không rút cắm cáp (tự reset, tự che mật khẩu):
`py -3.13 scripts\esp32\esp32_log.py COM7 --reset --seconds 15`.

## Script trong `scripts/esp32/`

| Script | Việc |
|---|---|
| `hotspot.ps1` | thư viện dùng chung (dot-source): đọc/đặt/bật Mobile Hotspot qua WinRT. Chỉ chạy trên Windows PowerShell 5.1 |
| `hotspot-on.ps1` | bật hotspot 2,4 GHz, tắt tự-tắt, in IP laptop + thiết bị đang nối |
| `firewall-mavlink.ps1` | tạo/xoá rule UDP 14550, tự xin quyền Administrator, đọc lại rule |
| `dronebridge-nvs.ps1` | cấu hình ESP32 telemetry qua USB (NVS) |
| `camera-secrets.ps1` | sinh `firmware/camera/include/secrets.h` từ hotspot |
| `nap_camera.ps1` | secrets → build → nạp → đọc IP, tự dò cổng CH343P |
| `esp32_log.py` | đọc log Serial, `--reset`, `--until`, che mật khẩu |
| `camera_check.py` | nghiệm thu camera qua Wi-Fi bằng parser MJPEG của backend |
| `wifi_ping_check.py` | ping đồng thời các bo, tìm giây mất gói CHUNG, đánh dấu giây trùng lúc laptop quét Wi-Fi |
| `wifi_scan_watch.ps1` | in thời điểm card Wi-Fi laptop quét xong (`wifi_ping_check.py` tự gọi) |

## Bốn điều phase này dạy (đắt nhất)

1. **XCLK 20 MHz của camera làm nhiễu Wi-Fi của chính bo** — luồng ~3 fps, có khung hỏng. Hạ 10 MHz:
   Wi-Fi về như khi tắt camera, ~7,5 fps. Không tìm ra được nếu không đo tách biến (gửi dữ liệu rỗng
   từ RAM, bỏ camera ra khỏi đường đi).
2. **Ảnh có đủ đầu `FF D8` đuôi `FF D9` vẫn có thể hỏng.** Kiểm ảnh bằng cách giải mã thật.
3. **Laptop quét Wi-Fi là hai bo mất sóng.** Card vừa nối mạng nhà vừa phát hotspot trên một radio;
   mỗi lần quét, cả hai bo mất gói 3–6 s cùng lúc (đã ép quét để chứng minh). Có lúc một chương
   trình bắt quét mỗi ~15,5 s. Rủi ro lớn nhất chuyển sang Phase 17: `12-hotspot-laptop.md` mục 6.
4. **Một phép kiểm chưa từng đỏ thì chưa chứng minh gì.** Bộ phát hiện khung hỏng đầu tiên trả "sạch"
   cả với khung đã biết là hỏng; phép kiểm nhãn chất lượng chỉ được tin sau khi nạp thử một firmware
   cố tình gắn nhãn sai và thấy nó đỏ.
