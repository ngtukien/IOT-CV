# firmware/camera

Firmware camera của drone: bo **ESP32-S3 N16R8 + module OV3660** (`docs/phan-cung-thuc-te.md`),
phát luồng MJPEG qua Wi-Fi cho backend. Project PlatformIO, một `env`: `esp32s3_n16r8`.
Plan: `plans/phase-12-firmware-esp32-camera.md` §12.3–12.5.

## Nó làm gì

Chạy ở chế độ **STA**: nối vào Mobile Hotspot của laptop, không tự phát Wi-Fi. Hai máy chủ HTTP:

| Đường dẫn | Cổng | Việc | Trả về |
|---|---|---|---|
| `GET /stream` | `STREAM_PORT` (81) | luồng MJPEG liên tục, đúng [`docs/hop-dong-mjpeg.md`](../../docs/hop-dong-mjpeg.md) | `multipart/x-mixed-replace; boundary=frame`; `503` nếu camera hỏng |
| `GET /set?quality=N` | `HTTP_PORT` (80) | đổi `jpeg_quality` lúc đang chạy, N trong **0..63** | `200 {"quality":N}`; `400` nếu N thiếu, không phải số nguyên, hoặc ngoài khoảng |
| `GET /status` | `HTTP_PORT` (80) | trạng thái | JSON `quality`, `framesize`, `rssi`, `uptime_ms`, `frames_sent`, `camera`, `sensor_pid`, `stream_clients`, `stream_port`, `free_psram` |

Địa chỉ: `http://iotcv-camera.mshome.net:81/stream` — hotspot Windows phân giải tên này, khỏi cần
biết IP DHCP (13/10/2026 là `192.168.137.102`).

**Vì sao `/stream` ở cổng riêng:** máy chủ HTTP của ESP-IDF xử lý **một** yêu cầu một lúc. `/stream`
không bao giờ kết thúc, nên nếu chung cổng với `/set` thì `/set` treo suốt lúc đang phát — mà đổi
chất lượng giữa luồng chính là việc Phase 24 cần. Cách này giống ví dụ `CameraWebServer` gốc.

**`X-Jpeg-Quality` là giá trị thật của khung.** Sau `/set`, hàng đợi khung còn vài khung nén bằng
chất lượng cũ; firmware bỏ 4 khung chuyển tiếp rồi mới gắn nhãn mới (`X-Frame-Id` vẫn tăng, nên bên
đọc thấy khoảng nhảy). Đã chứng minh bằng phép đo cỡ khung, xem mục Kiểm.

Chỉ một client `/stream` một lúc — backend đứng giữa làm cầu phân phối cho nhiều trình duyệt.

## Nạp — một lệnh

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\nap_camera.ps1
```

Script làm hết: sinh `include/secrets.h` từ Mobile Hotspot (`scripts\esp32\camera-secrets.ps1`), tìm
cổng `USB-UART` của bo (chip CH343P, VID `1A86` PID `55D3` — không bao giờ nạp nhầm sang ESP32
DroneBridge hay FC đang cắm cùng lúc), build + nạp, reset bo, đọc log tới khi bo báo IP.
`-NoUpload` chỉ build (không cần bo).

### Làm tay từng bước

```text
1. Cam cap USB-C co day du lieu vao cong ghi "USB-UART" o MAT DUOI bo (khong phai "USB-OTG")
2. Get-CimInstance Win32_PnPEntity | Where-Object Name -match 'COM\d' | Format-Table Name, DeviceID
      -> dong "USB-Enhanced-SERIAL CH343 (COMx)". Win32_SerialPort KHONG liet ke cong nay.
3. Tao include\secrets.h: chay scripts\esp32\camera-secrets.ps1
   (hoac Copy-Item include\secrets.example.h include\secrets.h roi dien SSID + mat khau)
4. pio run -e esp32s3_n16r8 -t upload --upload-port COMx
5. pio device monitor -p COMx -b 115200   -> phai thay "camera init OK pid=0x3660" va "WIFI connected ip=..."
   (hoac: py -3.13 scripts\esp32\esp32_log.py COMx --reset --until "URL stream=")
```

`pio` nằm ở `D:\DevCache\tools\platformio\penv\Scripts\pio.exe`, chưa có trong PATH.

Cổng `USB-UART` có mạch tự reset: **không cần bấm nút**. Nạp báo `Failed to connect to ESP32-S3` thì
đưa chip vào chế độ nạp bằng tay: **giữ nút BOOT, nhấn rồi nhả RST, nhả BOOT**, rồi chạy lại lệnh
upload.

Bo có tem "BẢO HÀNH — KHÔNG ĐƯỢC XÉ" dán cạnh nút BOOT: bấm nút qua tem được, đừng bóc tem.

Trả bo về firmware gốc của shop (bản QC, sao lưu 13/10/2026, 16 MB):

```powershell
esptool --port COM7 write-flash 0 D:\IOT_Tools\downloads\esp32-backup\esp32s3-68ee8f4d06e4-20261013.bin
```

## Nguồn — đọc trước khi lắp lên drone

**AN TOÀN:** cấp nguồn bằng chân **5V** của bo — qua USB khi ngồi bàn, qua **UBEC 5V 3A riêng** khi
lắp lên drone. Không cấp thẳng vào chân 3V3. Camera cộng Wi-Fi tạo xung dòng lúc truyền; nếu bo khởi
động lại khi bật Wi-Fi (log lặp lại dòng `BOOT iotcv-camera`, hoặc `Brownout detector was
triggered`), hàn thêm tụ 470–1000 µF low-ESR sát chân 5V–GND của bo (tụ trong danh sách Phase 13).
**Không bao giờ lấy nguồn camera từ pad 5V của stack bay** — camera chết không được kéo FC theo
(SAFETY.md mục 9).

## Đổi cấu hình

Mọi số tinh chỉnh (chất lượng JPEG, framesize, cổng, tên máy, chu kỳ thử nối lại Wi-Fi) nằm trong
[`include/secrets.example.h`](include/secrets.example.h). Sửa file mẫu đó rồi chạy lại
`nap_camera.ps1` — **đừng sửa tay `include/secrets.h`**: script sinh lại nó mỗi lần và ghi đè.
`include/secrets.h` có mật khẩu Wi-Fi, đã nằm trong `.gitignore` riêng của thư mục này.

Đổi SSID/mật khẩu hotspot thì phải nạp lại camera (và chạy lại `scripts\esp32\dronebridge-nvs.ps1`
cho ESP32 DroneBridge): cả hai không có màn hình để báo lỗi.

## Kiểm

```powershell
uv run python scripts\esp32\camera_check.py [--frames 300] [--save khung.jpg]
```

Script gọi camera bằng tên cố định `iotcv-camera.mshome.net` (đổi tên máy thì sửa hằng `CAMERA_HOST`
trong script); `--save` ghi vào `logs/camera/` (đã `.gitignore` — khung ảnh có thể có mặt người).

Bốn nhóm kiểm, dừng mã 1 ở lỗi đầu tiên: `/status` đủ trường và PID `0x3660`; `/set` từ chối 6
kiểu tham số sai; `/stream` đúng hợp đồng — đọc bằng **chính parser của backend**
(`backend/vision/stream.py`), mọi khung **giải mã sạch** qua libjpeg, id và timestamp tăng dần; đổi
chất lượng giữa luồng cả hai chiều, khung đầu tiên mang nhãn mới phải có cỡ của mức mới.

Số đo 13/10/2026 (VGA, `jpeg_quality` 12, RSSI −25 dBm): **~7,5 fps**, khung
~8,5 KB, 300/300 khung giải mã sạch, khoảng chụp trung vị 144 ms. Chi tiết: `docs/test-log.md` mục
Phase 12.

Log Serial để chẩn đoán (đọc bằng `py -3.13 scripts\esp32\esp32_log.py COM7`, không reset bo):
`STATUS …` mỗi 5 s; `STREAM slow frame id=… grab_ms=… send_ms=…` khi một khung mất quá 1 s —
`grab_ms` lớn là camera kẹt, `send_ms` lớn là mạng kẹt; `FRAME grab FAIL`; `STREAM client
disconnected res=…`. Luồng đứng 3–6 s đúng lúc laptop quét Wi-Fi là do laptop, không phải bo:
chẩn đoán bằng `py -3.13 scripts\esp32\wifi_ping_check.py` (`docs/so-tay/12-hotspot-laptop.md` mục 6).

## Bẫy đã gặp

1. **XCLK 20 MHz làm nhiễu Wi-Fi của chính bo này.** `CameraWebServer` gốc dùng 20 MHz; ở đó luồng
   chỉ ~3 fps và có khung hỏng. Đo bằng 512 KB gửi từ RAM trong (không đụng camera): tắt camera
   285 KB/s; XCLK 20 MHz 58–67 KB/s; 16 MHz 71–87 KB/s; **10 MHz 293–297 KB/s**. Đổi
   `CAMERA_GRAB_WHEN_EMPTY` không đỡ được gì, nên lỗi ở XCLK chứ không ở PSRAM. Firmware dùng
   10 MHz. Thay bo hay đổi module camera thì đo lại.
2. **SOI/EOI đúng chưa có nghĩa là ảnh đúng.** Một khung hỏng vẫn có đủ đầu `FF D8` và đuôi `FF D9`,
   giải mã ra nửa dưới thành sọc tím, libjpeg chỉ báo `Corrupt JPEG data: premature end of data
   segment`. `camera_check.py` giải mã thật từng khung ở tiến trình con để bắt cảnh báo đó.
3. **`WiFi.setHostname()` phải gọi TRƯỚC `WiFi.mode()`** trên core Arduino 2.0.x. Gọi sau thì DHCP gửi
   tên mặc định và `iotcv-camera.mshome.net` không phân giải được.
4. **`Win32_SerialPort` không liệt kê cổng CH343P** của bo — dùng `Win32_PnPEntity`.
5. **Reset bo bằng pyserial trên Windows:** đổi RTS một mình không tới chip (usbser.sys); phải ghi lại
   DTR ngay sau. `scripts/esp32/esp32_log.py` đã làm đúng.
6. **Banner PlatformIO in "DevKitC-1-N8 (No PSRAM)"** — tên bo gốc, bình thường. PSRAM octal có hiệu
   lực nhờ `board_build.arduino.memory_type = qio_opi`; log boot in `psram=8386279`.

## File

| File | |
|---|---|
| `platformio.ini` | env `esp32s3_n16r8`: flash 16 MB QIO, PSRAM 8 MB octal (`qio_opi`), bảng phân vùng 16 MB |
| `src/main.cpp` | camera + Wi-Fi + hai máy chủ HTTP |
| `src/camera_pins.h` | chép **nguyên văn** từ ví dụ `CameraWebServer` của arduino-esp32 v2.0.17; chọn bảng bằng macro `CAMERA_MODEL_ESP32S3_EYE` trong `platformio.ini`, đã kiểm trên bo thật (sổ tay 14 mục 8). Sai bo thì đổi macro, đừng sửa số chân lẻ tẻ |
| `include/secrets.example.h` | mẫu cấu hình; `secrets.h` sinh ra từ đây |

Backend đọc camera qua `CAMERA_STREAM_URL` (`backend/config.py`, mặc định cũ
`http://192.168.4.1:81/stream`). Phase 17 đặt `CAMERA_FAKE=0` và
`CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream`.
