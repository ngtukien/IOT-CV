# Phần cứng thực tế — nguồn sự thật

Cập nhật **25/10/2026** sau khi lắp ráp và kiểm bằng máy (`plans/reports/261025-kiem-tra-phan-cung-that.md`),
rồi hiệu chỉnh + bay thử trong nhà + chốt tay cầm (`plans/reports/261025-hieu-chinh-bay-trong-nha.md`);
danh sách linh kiện do người dùng xác nhận trực tiếp ngày 12/10/2026. Chỗ nào trong plan, sổ tay, code hay báo
cáo khác với file này thì **file này đúng**. Các báo cáo nghiên cứu ngày 21/09/2026 trong
`plans/reports/` được giữ nguyên như bản ghi lịch sử — đọc chúng để hiểu lý do, đừng lấy chúng làm
danh sách linh kiện.

## Bảng linh kiện

| Vai trò | Món thật | Trạng thái | Điều phải nhớ |
|---|---|---|---|
| Bo bay + ESC | Stack **SpeedyBee F405 V5 OX32 55A**, bản **"Model Aircraft"** (FC F405 V5 + ESC 4in1 OX32 55A) | Đã có; **FC đã chạy ArduPilot từ 13/10/2026** (bản `d450a747` + `01-base.param`, lên COM6 trên máy dự án); đã lắp lên khung, người dùng bay thử 24/10/2026 | ArduPilot board `speedybeef4v5`, nạp DFU không cần kích hoạt app; `FRAME_TYPE 12` (trên bo đang là `FRAME_TYPE 1` + `SERVO1..4_FUNCTION 36/33/34/35`, cùng thứ tự motor); hệ số dòng 370,4 A/V. **Cài đặt ESC đã đổi 25/10/2026** (`firmware/esc-ox32/`). `MOT_SPIN_ARM 0,13` (25/10/2026, giảm khởi động hụt ở M1). Accel + Level hiệu chỉnh lại 25/10/2026. Chi tiết ở mục dưới |
| Cảm biến tránh vật cản | **Benewake TFmini Plus** | Đã hàn lên FC: xanh → R3, đỏ/đen → 5V/G cụm LED1, **dây trắng chưa hàn**. 25/10/2026: cảm biến **sai cấu hình** (1 khung/giây, đơn vị mm), ArduPilot báo `Rangefinder 1: No Data`. Tối 25/10/2026 **tạm tắt trên FC** (`RNGFND1_TYPE 0`, `PRX1_TYPE 0`, kèm `FENCE_ENABLE 0`) để arm được; bật lại `20 / 4 / 1` sau khi sửa | `SERIAL3` = pad T3/R3; **chỉ cấp 5 V**. Hàn dây trắng vào T3 thì cấu hình lại được qua FC (hướng dẫn lắp ráp bước E7) |
| Cầu MAVLink qua Wi-Fi | **ESP32 DevKit có chip USB-UART CP2102** (ESP32-D0WD-V3, flash 4 MB) | Đã nạp DroneBridge v2.4.1 ngày 12/10/2026 | Lên COM4 trên máy dự án. STA vào hotspot laptop `IOTCV-HOTSPOT` (13/10/2026): ESP32 tên `DroneBridgeESP32.mshome.net` (IP DHCP, đổi mỗi lần hotspot khởi động lại), laptop `192.168.137.1`, UDP 14550. UART TX = GPIO17, RX = GPIO16, 115200, nối `SERIAL2` (pad T2/R2) của FC. Xem `firmware/dronebridge/README.md`. 25/10/2026 trên drone: web GCS nhận đủ telemetry qua Wi-Fi khi đã rút USB, nhưng mất 19–32% gói theo từng đợt |
| Camera trên drone | **ESP32-S3 N16R8** (16 MB flash, 8 MB PSRAM octal) + module **OV3660** (3 MP) | Đã có; **kiểm trên bo 13/10/2026**: OV3660 ra ảnh, bảng chân `ESP32S3_EYE` đúng, PSRAM 8 MB chạy | Thay hẳn ESP32-CAM / XIAO ESP32S3 Sense trong tài liệu cũ. Cổng `USB-UART` (CH343P) lên COM7. Có tem bảo hành "không được xé". Chi tiết ở mục dưới |
| USB-TTL | Mạch chuyển **USB to TTL UART CP2102** | Đã mua | Đọc TFmini Plus trên máy tính trước khi cắm vào bo bay (Phase 12.7 / 17). Không còn cần để nạp camera — ESP32-S3 có cổng USB |
| Nguồn cho ESP32 + camera | **UBEC 5V 3A** | Đã mua | Lấy thẳng từ pin; **không** ăn 5 V của stack |
| Khung | S500 | Như tài liệu, người dùng xác nhận không đổi | |
| Motor + cánh | T-Motor Air Gear 450 II (motor AIR2216II, cánh T1045 tự siết) | Như tài liệu | 2 motor ren phải + 2 ren trái, xem Phase 18.3 |
| GPS + la bàn | Holybro M10 (la bàn IST8310) | Đã lắp; log 24/10/2026: 9–15 vệ tinh, HDOP 0,8–1,7 | **Chỉ có điện khi cắm pin.** La bàn chỉ được dò lúc FC khởi động: cắm USB trước rồi mới cắm pin thì phải khởi động lại FC (`COMPASS_DEV_ID` 658945 khi khởi động có pin, 0 khi chỉ USB). **Rút pin khi USB còn cắm** thì la bàn mất điện rồi có lại mà không được khởi tạo lại (đọc ~96 mG, PreArm `Check mag field`) và FC chốt failsafe pin → khởi động lại FC khi đang cắm pin. Hiệu chỉnh lại **trong nhà** 25/10/2026 (offset 20,4 / 31,3 / 59,7) → vẫn phải hiệu chỉnh ngoài trời + compassmot |
| RC | FlySky FS-i6X + receiver iA6B (iBUS) | Đã bind, FC đọc 14 kênh iBUS | Failsafe kênh 3 trên tay phát đã cài 25/10/2026: −118% ≈ 911 µs, thấp hơn `FS_THR_VALUE` 975. Quy trình ở Phase 15 §15.5. Radio chưa hiệu chỉnh (`RC1..8` vẫn 1100/1900). Tay phát: **chỉ SwC có 3 nấc**, SwA/SwB/SwD 2 nấc, 2 núm VrA/VrB. **Bản đồ (25/10/2026):** CH5 SwC chế độ (Stabilize/AltHold/Loiter), CH6 SwD RTL, CH7 SwA WEB CONTROL ENABLE, **CH8 SwB ARM/DISARM** (xuống = ARM; người dùng chọn, lệch plan), **CH9 núm VrB Auto**, CH10 None — Phase 15 §15.4 |
| Pin | Ovonic 4S 5300 mAh | Như tài liệu | Người dùng còn **pin 6S** và đã bay bằng nó 24/10/2026. Motor định mức 4S; ngưỡng pin trên FC (`BATT_LOW_VOLT 14.0`, `BATT_CRT_VOLT 13.2`) là của 4S nên failsafe pin vô tác dụng với 6S. **25/10/2026 người dùng chốt bay 4S.** Bay thử trong nhà: nhấc ở ~50–55% lệnh motor, 11–12 A, sụt ~0,3 V — dư lực |
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
  nạp (Phase 14.5b). **Đã kiểm 13/10/2026:** baro khoẻ, `press_abs` 1012,6 hPa. Hướng gyro cũng đúng
  dấu (`docs/so-tay/14-hang-ve-nap-firmware.md`).
- ESC OX32 đánh số motor kiểu Betaflight: **M1 sau-phải, M2 trước-phải, M3 sau-trái, M4
  trước-trái** → `FRAME_TYPE 12`. Mép có 8 pad `V G C T 1 2 3 4` của ESC nằm cùng phía cổng 10 chân
  và cổng GPS của FC = phía **mũi**.
- ESC OX32 chạy firmware **1.13**. Trình cấu hình `ox32.oxbot.com` **chỉ vào được ESC khi FC chạy
  Betaflight**; passthrough của ArduPilot (`SERVO_BLH_AUTO = 1`) báo `4-way communication protocol
  error`. 25/10/2026 đã tạm nạp Betaflight để đổi 4 mục cho motor KV thấp + cánh 10" (gốc lỗi M1
  khựng khi khởi động trên 4S), rồi nạp lại ArduPilot và khôi phục tham số. Cài đặt trước/sau và cách
  làm: `firmware/esc-ox32/README.md`.
- Bản ArduPilot `speedybeef4v5` không bật `ENABLE_DFU_BOOT`: từ ArduPilot muốn vào DFU phải **giữ
  BOOT khi cắm USB**. Từ Betaflight thì `scripts/fc/nap_dfu.py` vào DFU bằng lệnh MSP.
- Chỉ cắm USB thì GPS M10 và la bàn **không lên** (đo thật 25/10/2026); chúng có điện khi cắm pin.
- Cảm biến dòng của ESC: SpeedyBee ghi `Scale=27, Offset=-2644` (đơn vị Betaflight) →
  `BATT_AMP_PERVLT 370.4`, `BATT_AMP_OFFSET 0.0071`. Vẫn phải hiệu chỉnh theo mAh sạc trả.
- Trong hộp: **1** tụ 1000 µF 35 V (không phải 2). **Trên drone thật thợ hàn tụ 1500 µF 35 V** thay
  cho tụ trong hộp (người dùng xác nhận 25/10/2026) — 35 V vẫn dư cho cả 4S lẫn 6S. Bản Deluxe có thêm "Short-Circuit Protection
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

**Đã kiểm trên bo thật ngày 13/10/2026** (`docs/so-tay/14-hang-ve-nap-firmware.md` mục 8):

- Bo của shop Phúc Minh Tech, ảnh ở `picture/esp32-s3-n16r8-ov3660/`. Module ghi "ESP32-S3-N16R8",
  flash hãng Boya — module bên thứ ba, không phải WROOM-1 của Espressif. Chip ESP32-S3 rev v0.2, PSRAM
  8 MB chạy ở chế độ octal, flash 16 MB.
- **Bảng chân `CAMERA_MODEL_ESP32S3_EYE` đúng** (XCLK 15, SIOD 4, SIOC 5, Y2…Y9 = 11, 9, 8, 10, 12, 18,
  17, 16, VSYNC 6, HREF 7, PCLK 13, không có PWDN/RESET): dấu "camera" in trên bo trùng tập chân này;
  `esp_camera_init` OK, đọc ra PID `0x3660`, chụp được khung VGA thật.
- **Hai cổng USB-C**, nhãn in ở mặt dưới: `USB-UART` (chip CH343P, Windows tự nhận, không cần cài
  driver) và `USB-OTG` (USB gốc của chip). Nạp và xem log qua `USB-UART`, nên **không cần**
  `-DARDUINO_USB_CDC_ON_BOOT=1`.
- Dấu in trên bo: `*` = chân 35/36/37 (PSRAM octal), `~` = 38/39/40 (khe thẻ microSD ở mặt dưới). Đừng
  gán các chân đó việc khác.
- Firmware gốc của shop đã sao lưu ra `D:\IOT_Tools\downloads\esp32-backup\`. **13/10/2026 trên bo là
  firmware camera thật** (`firmware/camera/`): tên mạng `iotcv-camera.mshome.net`, `/stream` cổng 81,
  VGA ~7,5 fps.
- **XCLK phải là 10 MHz, không phải 20 MHz như ví dụ gốc:** ở 20 MHz Wi-Fi của chính bo tụt từ ~295
  xuống ~60 KB/s và có khung JPEG hỏng. Số đo ở `docs/test-log.md` mục Phase 12.

**Chưa biết — đo ở Phase 12/17:** số fps thật ở QVGA/VGA. Các con số cũ trong tài liệu (44 fps QVGA,
14 fps VGA, ~1,3 fps ở độ phân giải cao) là của ESP32-CAM/OV2640, **chưa đo** trên bo này.

## Khi phần cứng đổi tiếp

Sửa file này **trước**, ghi ngày, rồi mới sửa plan và code. Bộ nhớ của Claude cho dự án trỏ về
đây.
