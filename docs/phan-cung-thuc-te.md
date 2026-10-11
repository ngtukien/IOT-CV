# Phần cứng thực tế — nguồn sự thật

Cập nhật **12/10/2026**, người dùng xác nhận trực tiếp. Chỗ nào trong plan, sổ tay, code hay báo
cáo khác với file này thì **file này đúng**. Các báo cáo nghiên cứu ngày 21/09/2026 trong
`plans/reports/` được giữ nguyên như bản ghi lịch sử — đọc chúng để hiểu lý do, đừng lấy chúng làm
danh sách linh kiện.

## Bảng linh kiện

| Vai trò | Món thật | Trạng thái | Điều phải nhớ |
|---|---|---|---|
| Bo bay + ESC | Stack **SpeedyBee F405 V5 OX32 55A**, bản **"Model Aircraft"** (FC F405 V5 + ESC 4in1 OX32 55A) | Đã có; đã soi ảnh với tài liệu chính hãng | ArduPilot board `speedybeef4v5`, nạp DFU không cần kích hoạt app; `FRAME_TYPE 12`; hệ số dòng 370,4 A/V. Chi tiết ở mục dưới |
| Cảm biến tránh vật cản | **Benewake TFmini Plus** | Đã có | `SERIAL3` = pad T3/R3; **chỉ cấp 5 V** |
| Cầu MAVLink qua Wi-Fi | **ESP32 DevKit có chip USB-UART CP2102** (ESP32-D0WD-V3, flash 4 MB) | Đã nạp DroneBridge v2.4.1 ngày 12/10/2026 | Lên COM4 trên máy dự án. STA vào hotspot laptop: ESP32 `192.168.137.9`, laptop `192.168.137.1`, UDP 14550. UART TX = GPIO17, RX = GPIO16, 115200, nối `SERIAL2` (pad T2/R2) của FC. Xem `firmware/dronebridge/README.md` |
| Camera trên drone | **ESP32-S3 N16R8** (16 MB flash, 8 MB PSRAM octal) + module **OV3660** (3 MP) | Đã có; **chưa xác minh tên bo và bảng chân** | Thay hẳn ESP32-CAM / XIAO ESP32S3 Sense trong tài liệu cũ. Chi tiết ở mục dưới |
| USB-TTL | Mạch chuyển **USB to TTL UART CP2102** | Đã mua | Đọc TFmini Plus trên máy tính trước khi cắm vào bo bay (Phase 12.7 / 17). Không còn cần để nạp camera — ESP32-S3 có cổng USB |
| Nguồn cho ESP32 + camera | **UBEC 5V 3A** | Đã mua | Lấy thẳng từ pin; **không** ăn 5 V của stack |
| Khung | S500 | Như tài liệu, người dùng xác nhận không đổi | |
| Motor + cánh | T-Motor Air Gear 450 II (motor AIR2216II, cánh T1045 tự siết) | Như tài liệu | 2 motor ren phải + 2 ren trái, xem Phase 18.3 |
| GPS + la bàn | Holybro M10 (la bàn IST8310) | Như tài liệu | |
| RC | FlySky FS-i6X + receiver iA6B (iBUS) | Như tài liệu | |
| Pin | Ovonic 4S 5300 mAh | Như tài liệu | |
| Sạc | SkyRC iMAX B6AC V2 | Như tài liệu | |

## Đã bỏ — đừng làm theo tài liệu cũ

- **ESP32-CAM (AI-Thinker, OV2640)** và **XIAO ESP32S3 Sense**: không mua. Mọi chỉ dẫn "nối IO0
  xuống GND để nạp", hàn lại điện trở 0 Ω để dùng anten u.FL, mua anten ngoài, env PlatformIO
  `esp32cam` / `xiao_esp32s3` đều **không còn áp dụng**.
- Kính FPV, VTX, OSD, DJI Air Unit: đã bỏ từ 21/09/2026 (`firmware/ardupilot/custombuild/*.yaml`).

## Stack SpeedyBee F405 V5 "Model Aircraft" — những điều đã kiểm

Nguồn: ảnh thật `picture/FC-speedybee-f405-v5/` (8 ảnh HEIC) và 41 ảnh chính hãng
`assignment/_build/img/official/speedybee/`; trang thông số SpeedyBee; hwdef `speedybeef4v5` của
ArduPilot 4.7.1; cấu hình Betaflight `SPEEDYBEEF405V5`.

- Phiếu trong hộp ghi "New products require activation before use" — chỉ dành cho **app SpeedyBee**
  qua Bluetooth. Nạp ArduPilot qua DFU ghi đè toàn bộ Betaflight nên **không cần kích hoạt**.
- Xuất xưởng chạy Betaflight 4.5.2, target `SPEEDYBEEF405V5`. Bootloader/banner ArduPilot hiện tên
  bo là `speedybeef4v5` (viết thường).
- UART: 1 = Bluetooth (ArduPilot không dùng), 2 = pad T2/R2 mặt trên, 3 = pad T3/R3 + cổng 6 chân
  "HD Unit Plug", 4 = GPS (pad + cổng 6 chân phía trước), 5 = ESC telemetry, 6 = receiver (pad R6 +
  cổng 4 chân phía sau).
- **Pad 9V nằm ngay cạnh T3/R3** (cụm "9V G T3 R3"), và **chân 1 của cổng "HD Unit Plug" là 9 V**.
  TFmini Plus chỉ chịu 5 V: lấy nguồn ở pad 5V, đừng dùng cáp DJI 6 chân cho TFmini.
- Ba pad "4V5" cấp 4,5 V cả khi chỉ cắm USB, tối đa 1 A chung.
- Jumper SBUS (dưới nút BOOT) đang **hở** — đúng cho iBUS, không hàn nối. Jumper "BARO →" mặt dưới
  **đã nối thiếc sẵn** từ nhà máy (ảnh render để hở) — để nguyên.
- Baro SPA06-003: bản build dự án chỉ có driver SPL06/SPA06 → phải kiểm baro được nhận ngay sau khi
  nạp (Phase 14.5b).
- ESC OX32 đánh số motor kiểu Betaflight: **M1 sau-phải, M2 trước-phải, M3 sau-trái, M4
  trước-trái** → `FRAME_TYPE 12`. Mép có 8 pad `V G C T 1 2 3 4` của ESC nằm cùng phía cổng 10 chân
  và cổng GPS của FC = phía **mũi**.
- Cảm biến dòng của ESC: SpeedyBee ghi `Scale=27, Offset=-2644` (đơn vị Betaflight) →
  `BATT_AMP_PERVLT 370.4`, `BATT_AMP_OFFSET 0.0071`. Vẫn phải hiệu chỉnh theo mAh sạc trả.
- Trong hộp: **1** tụ 1000 µF 35 V (không phải 2). Bản Deluxe có thêm "Short-Circuit Protection
  Tool" — chính là smoke stopper dùng ở lần cắm pin đầu (`SAFETY.md` mục 7).

## Camera ESP32-S3 N16R8 + OV3660 — đã biết và chưa biết

**Đã biết (nguồn: ví dụ `CameraWebServer` của `espressif/arduino-esp32`):**

- Thư viện camera vẫn là `esp32-camera`; OV3660 có `PID 0x3660`, ảnh tối đa 2048×1536.
- Ngay sau `esp_camera_init`, ví dụ gốc chỉnh riêng cho OV3660: `set_vflip(s, 1)`,
  `set_brightness(s, 1)`, `set_saturation(s, -2)` — ảnh ra mặc định bị lật dọc và hơi gắt màu.
- Có PSRAM: `fb_location = CAMERA_FB_IN_PSRAM`, `fb_count = 2`, `grab_mode = CAMERA_GRAB_LATEST`.
- N16R8 = flash 16 MB chế độ QIO + PSRAM 8 MB chế độ **octal (OPI)**. Cấu hình PlatformIO dự kiến
  ở `plans/phase-12-firmware-esp32-camera.md` §12.3 (env `esp32s3_n16r8`). **Đã build thử
  12/10/2026** bằng một project tạm có đoạn mã dò camera: SUCCESS với espressif32 7.1.3 + Arduino
  core 2.0.17, và `firmware.map` dùng đúng bộ SDK `esp32s3/qio_opi`. Mới kiểm trên máy tính, chưa
  chạy trên bo thật.

**Chưa biết — phải xác minh ở Phase 12 trước khi tin:**

- **Tên bo chính xác và bảng chân camera.** Giả định hiện tại là bảng chân `CAMERA_MODEL_ESP32S3_EYE`
  (XCLK 15, SIOD 4, SIOC 5, Y2…Y9 = 11, 9, 8, 10, 12, 18, 17, 16, VSYNC 6, HREF 7, PCLK 13, không có
  PWDN/RESET) — trùng loại bo "ESP32-S3-WROOM N16R8 CAM" phổ biến nhất. Xác minh bằng ảnh bo hoặc
  sơ đồ của shop, rồi bằng log `esp_camera_init` thành công và đọc ra PID `0x3660`.
- Bo có một hay hai cổng USB-C (cổng USB gốc của chip, và/hoặc cổng "COM" qua CH343/CP210x) → quyết
  định có cần driver và có cần `-DARDUINO_USB_CDC_ON_BOOT=1` không.
- Số fps thật ở QVGA/VGA. Các con số cũ trong tài liệu (44 fps QVGA, 14 fps VGA, ~1,3 fps ở độ phân
  giải cao) là của ESP32-CAM/OV2640, **chưa đo** trên bo này.

## Khi phần cứng đổi tiếp

Sửa file này **trước**, ghi ngày, rồi mới sửa plan và code. Bộ nhớ của Claude cho dự án trỏ về
đây.
