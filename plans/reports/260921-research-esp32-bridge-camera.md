# Research Report: ESP32 MAVLink bridge + ESP32-CAM cho drone ArduPilot

**Ngày:** 2026-09-21 · **Dự án:** IOT-CV (SpeedyBee F405 V5, ArduPilot Copter 4.7.1, Windows 11, người mới)

## Summary

**Đừng viết bridge MAVLink của riêng mình.** DroneBridge for ESP32 đã được ArduPilot ghi vào tài liệu chính thức, có web-flasher chạy thẳng trong Chrome/Edge (không cần cài gì), có web UI cấu hình, và có thêm chế độ ESP-NOW tầm 1km mà một sketch tự viết không bao giờ có. Hai file `esp32/mavlink_bridge/mavlink_bridge.ino` (39 dòng) và `esp32/camera/camera.ino` (29 dòng) trong repo hiện mới chỉ là stub TODO — chi phí bỏ đi bằng 0.

Camera thì ngược lại: **không có firmware "chuẩn" nào thay thế được**, nhưng phần cứng nên cân nhắc đổi. ESP32-CAM AI-Thinker chỉ đạt ~14–20 fps ở VGA, lại là board hay brownout nhất họ ESP32. Board ESP32-S3 (XIAO ESP32S3 Sense / Freenove S3 CAM) có USB-C, 8MB PSRAM, 2 nhân 240MHz — giải quyết cùng lúc fps, nguồn và nạp code.

Hai kết luận độc lập nhau: nhận DroneBridge ngay mà vẫn giữ ESP32-CAM đã mua được.

---

## 1. DroneBridge for ESP32 vs tự viết sketch

| Option | Pros | Cons | Adoption Risk |
|---|---|---|---|
| **DroneBridge for ESP32** v2.4.1 | ArduPilot document chính thức; web-flasher trong browser; web UI cấu hình baud/pin/mode; WiFi AP/STA + AP-LR + ESP-NOW (AES-256); UDP 14550 + TCP 5760; hỗ trợ ESP32/S2/S3/C3/C6 | Release stable mới nhất 12/09/2024 (~1 năm không cập nhật); known issue: bật MAVLink parsing mất ~0.5 packet/giây; nâng cấp từ v1.5 phải erase flash trước | **Thấp** |
| **Tự viết sketch** (hiện trạng repo) | Toàn quyền kiểm soát; học được nhiều | Phải tự làm reconnect, buffer, non-blocking, UDP endpoint registration, OTA, web config; phải cài toolchain trước; người mới dễ sa lầy ở tầng transport thay vì tầng ứng dụng | **Cao** |
| **MavESP8266** (ESP8266) | ArduPilot cũng document | Phần cứng đời cũ, không ESP-NOW; SSID `ArduPilot`/`ardupilot`, IP 192.168.4.1, `SERIAL1_BAUD`=921600 | TB (không phù hợp — đang có ESP32) |
| **ExpressLRS + TX Backpack** | RC + MAVLink chung một sóng; backpack phát WiFi UDP 14550 cho GCS | **Không phải WiFi bridge** — cần cả module TX lẫn RX; ELRS >= v3.5.0 + backpack >= v1.5.0; băng thông rất hẹp (2.4GHz F1000: ~2375 B/s downlink, ~1190 B/s uplink) → không đủ cho video | Cao |
| **mLRS** | Full-duplex MAVLink + 16 kênh RC; có module ESP32/ESP8266 làm cầu WiFi tới GCS | Nền tảng chính là STM32, tài liệu ghi rõ ESP "not ideal for mLRS"; là hệ RC hoàn chỉnh | Cao |

> ExpressLRS và mLRS **không cùng hạng mục** với DroneBridge — chúng thay cả bộ RC link, không thay một cầu Wi-Fi. Đưa vào bảng để loại trừ.

### Recommendation

1. **DroneBridge for ESP32** (hạng 1) — thay thế hoàn toàn `mavlink_bridge.ino`, và cho phép bỏ qua Mục 2 nếu chỉ cần telemetry.
2. **Tự viết sketch** (hạng 2) — chỉ khi DroneBridge không chạy trên board đang có, hoặc cần logic web UI không hỗ trợ.

### Nạp firmware trên Windows (không cần cài gì)

```
1. Mở Chrome hoặc Edge (Firefox desktop >= 151 cũng được, Firefox ESR 140 KHÔNG được)
2. Vào: https://drone-bridge.com/flasher/
3. Cắm ESP32 DevKit qua USB (cài driver CP210x/CH340 trước — Mục 2)
4. Chọn firmware "vehicle/air" -> Connect -> chọn COM port -> Install
```

Sau khi nạp:

```
SSID     : DroneBridge ESP32
Password : dronebridge
Web UI   : http://dronebridge.local  hoặc  http://192.168.2.1
GCS      : UDP 14550  hoặc  TCP 5760
```

Cách khác: tải `.bin` từ https://github.com/DroneBridge/ESP32/releases rồi dùng `esptool` (Mục 2).

### Cấu hình phía ArduPilot (SpeedyBee F405 V5)

Bảng SERIAL của F405 V5 (hwdef README chính thức): SERIAL1 = UART1 (module BT nội bộ, **chưa dùng được**), **SERIAL2 = UART2 (trống — dùng cái này)**, SERIAL3 = DJI-VTX, SERIAL4 = GPS, SERIAL5 = ESC Telemetry, SERIAL6 = RC Input.

```
SERIAL2_PROTOCOL = 2      # MAVLink2
SERIAL2_BAUD     = 115    # 115200
BRD_SER2_RTSCTS  = 0      # tắt flow control
```

Đấu dây: `FC TX2 -> ESP32 RX`, `FC RX2 -> ESP32 TX`, `GND chung`. Cả hai logic 3.3V. **Nguồn 5V cho ESP32 lấy từ UBEC riêng** (đúng như ghi chú sẵn có trong `mavlink_bridge.ino`).

> **Chưa xác minh:** nhiều nguồn khuyên đặt `MAVn_OPTIONS = 2` ("Don't forward mavlink to/from"). Fetch trực tiếp `common-esp32-telemetry.html` và `parameters.html` thì **không thấy** tham số này. Coi là tuỳ chọn, chỉ đụng tới nếu thấy MAVLink lặp gói.

---

## 2. Toolchain trên Windows 11

Kể cả khi dùng DroneBridge cho bridge, **vẫn cần toolchain cho ESP32-CAM** vì không có firmware camera đóng gói sẵn.

| Option | Pros | Cons | Adoption Risk |
|---|---|---|---|
| **Arduino IDE 2.x** | Cài 1 file .exe; chọn board bằng menu (không cần nhớ FQBN); Serial Monitor sẵn; hầu hết tutorial ESP32-CAM viết cho nó | Ít kiểm soát compiler flag; debug yếu; thư viện toàn cục dễ xung đột | **Thấp** |
| **PlatformIO (VS Code)** | `platformio.ini` khai báo board + thư viện theo từng project; debug breakpoint; dễ đưa vào CI | Cần VS Code (~1GB) + extension tự tải toolchain; nhiều thao tác terminal | Thấp–TB |
| **arduino-cli** | Nhẹ, script hoá được, build/flash hàng loạt | Không có editor; người mới thiếu phản hồi trực quan | Trung bình |
| **ESP-IDF** | FreeRTOS đầy đủ, API camera gốc, hiệu năng cao nhất | Dốc nhất; breaking change giữa các version; thừa cho dự án này | **Cao** |

### Recommendation

1. **Arduino IDE 2.x** (hạng 1) — hai sketch trong repo đã là `.ino`, và mọi tài liệu ESP32-CAM đều theo đường này.
2. **PlatformIO** (hạng 2) — chuyển sang khi project có >1 board và cần pin version thư viện.
3. **arduino-cli** — cài kèm để build từ script, không thay thế IDE.
4. **ESP-IDF** — bỏ qua ở giai đoạn này.

### Lệnh cài (winget ID đã verify bằng `winget search` trên chính máy Windows 11 này)

```powershell
winget install ArduinoSA.IDE.stable          # Arduino IDE 2.3.10
winget install Microsoft.VisualStudioCode    # cho PlatformIO
winget install Python.Python.3.12            # cho esptool / platformio (3.14 cũng có)
winget install Git.Git
winget install ArduinoSA.CLI                 # arduino-cli 1.5.1 (tuỳ chọn)
```

> **Sai lầm cần tránh:** `pip install arduino-cli` **không** phải cách cài chính thức (arduino-cli là binary Go, không phải package Python). Dùng `winget install ArduinoSA.CLI`.
> **Không có** package winget cho **PlatformIO**, **CP210x**, **CH340** — phải cài tay.

PlatformIO: extension trong VS Code (`Extensions` → `PlatformIO IDE`), hoặc CLI:

```powershell
pip install platformio
pio --version
```

### Board ID / FQBN (verify trên docs.platformio.org)

| Board | PlatformIO `board` | arduino-cli FQBN | Tên trong menu Arduino IDE |
|---|---|---|---|
| ESP32 DevKit V1 (WROOM-32) | `esp32doit-devkit-v1` | `esp32:esp32:esp32doit-devkit-v1` (hoặc `esp32:esp32:esp32` = "ESP32 Dev Module") | `DOIT ESP32 DEVKIT V1` |
| AI-Thinker ESP32-CAM | `esp32cam` | `esp32:esp32:esp32cam` | `AI Thinker ESP32-CAM` |

```ini
; platformio.ini
[env:esp32doit-devkit-v1]
platform = espressif32
board = esp32doit-devkit-v1
framework = arduino

[env:esp32cam]
platform = espressif32
board = esp32cam
framework = arduino
```

### Cài core ESP32 cho Arduino

Board Manager URL (dán vào `File > Preferences > Additional boards manager URLs`):

```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

```powershell
arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli board listall | findstr esp32
```

### Driver USB-serial

| Chip | Board thường gặp | Cài từ |
|---|---|---|
| **CP210x** (Silicon Labs) | ESP32 DevKit V1 phổ biến, adapter CP2102 | https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers |
| **CH340/CH341** (WCH) | DevKit giá rẻ, adapter USB-TTL rẻ | https://www.wch.cn/downloads/CH341SER_EXE.html *(chưa xác minh)* |
| **Native USB CDC** | ESP32-S3 / C3 (XIAO, Freenove S3) | Không cần driver |

Biết mình có chip nào: cắm board → `Win + X` → `Device Manager` → `Ports (COM & LPT)`. `Silicon Labs CP210x...` = CP210x; `USB-SERIAL CH340` = CH340; chấm than vàng = chưa có driver.

```powershell
Get-CimInstance Win32_SerialPort | Format-Table Name, Description
```

### ESP32-CAM không có cổng USB

Bắt buộc dùng **USB-TTL/FTDI (logic 3.3V, nguồn 5V)** hoặc shield **ESP32-CAM-MB**.

| ESP32-CAM | USB-TTL |
|---|---|
| `5V` | `VCC (5V)` |
| `GND` | `GND` |
| `U0R` (RX) | `TX` |
| `U0T` (TX) | `RX` |
| `IO0` | `GND` — **chỉ trong lúc nạp** |

Quy trình: nối `IO0 → GND` → bấm `Upload` → khi thấy `Connecting...` bấm `RST` trên ESP32-CAM → nạp xong tháo dây `IO0` → bấm `RST` lần nữa. Thiếu `IO0 → GND` sẽ báo `Failed to connect to ESP32: Timed out waiting for packet header`.

### esptool

```powershell
pip install esptool
esptool version
```

> **esptool v5 đã đổi tên lệnh:** dùng `esptool` (không còn `esptool.py`), subcommand dùng gạch nối (`flash-id`, `write-flash`). Tutorial cũ viết `esptool.py write_flash` là cú pháp v4.

```powershell
esptool -p COM3 flash-id
esptool -p COM3 erase-flash
esptool --chip esp32 -p COM3 -b 460800 write-flash 0x0 firmware.bin
```

---

## 3. Camera: ESP32-CAM vs board ESP32-S3

### MJPEG fps thực tế (AI-Thinker ESP32-CAM + OV2640)

| Độ phân giải | fps | Ghi chú |
|---|---|---|
| QVGA 320×240 | ~44–52 | Mượt |
| **VGA 640×480** | **~14–20** | Ngưỡng dùng được; latency ~50–110ms |
| SVGA 800×600 | ~3–5 | Giật |
| XGA 1024×768 | ~1–3 | Không dùng để xem video |
| UXGA 1600×1200 | ~1.3 | Chỉ chụp ảnh tĩnh |

> **Chưa xác minh:** các con số fps trên đến từ benchmark cộng đồng, **không phải số liệu chính thức của Espressif** — README `esp32-camera` không công bố fps. Coi là chỉ dấu; tự đo và ghi vào `docs/test-log.md` đúng như TODO trong `camera.ino`.

Từ README chính thức `espressif/esp32-camera` (đã verify):
- `jpeg_quality` nhận **0–63**, số nhỏ = chất lượng cao = file to = fps thấp. (Không phải 10–63.)
- **Bắt buộc có PSRAM** cho mọi độ phân giải trên CIF khi dùng JPEG.
- Dùng **2 frame buffer** ở chế độ JPEG cho phép "double the frame rate" so với 1 buffer, đổi lại tốn CPU/RAM.
- Định dạng khác JPEG (RGB/YUV) + WiFi bật = chậm nghiêm trọng vì tốc độ ghi PSRAM.

→ Ghi chú "bắt đầu ở VGA, không bắt đầu ở 1600×1200" đã có sẵn trong `camera.ino` là **đúng**.

### Vấn đề nguồn / phần cứng bắt buộc xử lý

| Vấn đề | Triệu chứng | Cách xử lý |
|---|---|---|
| **Brownout reset** | Reset ngay lúc WiFi bắt đầu phát | Hàn tụ **470–1000µF low-ESR** giữa 5V và GND, càng gần module càng tốt |
| **Nguồn yếu** | Reboot loop, camera init fail | ESP32-CAM kéo **250–500mA** lúc boot. Dùng **UBEC 5V riêng >= 1A**. **Không** cấp nguồn từ chân 3.3V của FTDI |
| **Nhiệt** | Throttle khi stream lâu | Heatsink thụ động + luồng gió |
| **Anten PCB yếu** | Chỉ vài mét trong nhà | Chuyển **điện trở 0-ohm** sang cặp pad u.FL rồi gắn anten ngoài 2.4GHz. Cần hàn SMD; chỉ dùng được một trong hai anten |

### So sánh board

| Board | SoC | PSRAM | USB | Cảm biến | Giá |
|---|---|---|---|---|---|
| ESP32-CAM (AI-Thinker) | ESP32 | 4MB | ❌ cần FTDI | OV2640 2MP | ~$8–12 *(giá chưa xác minh)* |
| **XIAO ESP32S3 Sense** | ESP32-S3, 2 nhân 240MHz | **8MB** (+8MB flash) | ✅ USB-C | **OV3660 2048×1536** (Seeed ghi rõ OV2640 đã ngừng sản xuất); có mic + khe SD; **kèm anten ngoài u.FL** | ~$14–25 *(chưa xác minh)* |
| Freenove ESP32-S3 CAM | ESP32-S3, 2 nhân 240MHz | 8MB (+8MB flash) | USB-OTG (trang bán không ghi rõ USB-C) | Không ghi trên trang bán | **$31.99** (niêm yết chính thức) |
| ESP32-S3-EYE | ESP32-S3 | 8MB | micro-USB | OV2640 | ~$35 *(chưa xác minh)* |

> **Hai sai sót đã sửa từ nghiên cứu sơ bộ:** (a) XIAO ESP32S3 Sense nay dùng **OV3660**, không phải OV2640; (b) Seeed wiki **không công bố khối lượng** — con số "14.7g" lan truyền trên mạng là **chưa xác minh**. Kích thước chính thức: **21 × 17.8mm** (bản Sense kèm expansion board: 21 × 17.8 × 15mm). Mọi con số fps của board S3 cũng **chưa xác minh**.

### Recommendation

1. **XIAO ESP32S3 Sense** (hạng 1) — nhỏ nhất, USB-C (bỏ hẳn FTDI + nghi thức IO0→GND), 8MB PSRAM, **kèm sẵn anten ngoài** nên không phải hàn SMD điện trở 0-ohm, cảm biến OV3660 mới hơn. Rủi ro: connector rất nhỏ, sửa chữa khó.
2. **ESP32-CAM đang có** (hạng 2) — nếu đã mua thì **vẫn dùng được cho Version 1**: VGA @ ~15fps đủ để chứng minh đường truyền, miễn là làm đủ tụ 470µF + UBEC riêng. Chỉ nâng cấp khi fps thành nút thắt thật.
3. **Freenove ESP32-S3 CAM** (hạng 3) — SoC tương đương XIAO nhưng giá niêm yết $31.99 và trang bán thiếu thông số; chỉ chọn nếu cần nhiều chân GPIO breakout.

**Không khuyến nghị** ESP32-S3-EYE (thừa LCD/loa/nút, nặng, đắt) cho mục đích downlink.

---

## 4. Kiến trúc Wi-Fi và GCS failsafe

### AP vs STA

| Phương án | Ưu | Nhược |
|---|---|---|
| **Laptop phát hotspot, 2 ESP32 làm STA** | Một mạng duy nhất; laptop IP cố định; hai thiết bị thấy nhau; dễ thêm thiết bị thứ ba | Phụ thuộc hotspot Windows (hay tự tắt); thêm một hop |
| Mỗi ESP32 làm AP riêng | Latency thấp nhất | Laptop **chỉ nối được 1 AP tại một thời điểm** → không thể vừa xem telemetry vừa xem camera |
| ESP32 bridge làm AP, camera làm STA nối vào | Một mạng, không cần hotspot laptop | ESP32 bridge gánh cả routing lẫn MAVLink |

**Khuyến nghị: laptop phát hotspot, cả hai ESP32 ở chế độ STA.** Lý do quyết định là ràng buộc cứng ở hàng giữa — một card Wi-Fi laptop không nối được hai AP cùng lúc, mà dự án cần đồng thời telemetry và video.

Hệ quả: DroneBridge phải đặt về **WiFi Client Mode** trong web UI (mặc định là AP). Cấu hình lần đầu vẫn phải nối vào AP mặc định `DroneBridge ESP32`.

### Tầm xa 2.4GHz

Tài liệu PX4 (verify được): **~50–200m** cho WiFi thường, **300m–1km+** cho ESP-NOW (tốc độ dữ liệu thấp hơn). DroneBridge tự công bố ~150m WiFi và 1km+ ESP-NOW.

→ Ở **50m bãi trống** telemetry gần như chắc chắn ổn. Ở **100m** là vùng biên: anten PCB + thân drone che chắn + nhiễu 2.4GHz từ chính bộ RC sẽ làm rớt link. **Video MJPEG sẽ đứt trước telemetry** vì cần băng thông cao hơn nhiều. Mọi con số tầm xa là công bố nhà sản xuất trong điều kiện lý tưởng — **chưa xác minh thực địa** trên khung drone có nhiễu ESC.

> ESP-NOW của DroneBridge cần **ESP32 ở cả hai đầu** (một trên drone, một cắm vào laptop).

### Hành vi khi mất link

UDP không có kết nối, nên có hai lớp:

1. **Đăng ký endpoint:** với UDP, **GCS phải gửi ít nhất một gói trước** (ví dụ heartbeat) để ESP32 biết địa chỉ trả lời. Mission Planner / QGroundControl làm tự động. Nếu mở QGC mà không thấy gì, đây là nghi phạm số một.
2. **GCS failsafe ArduPilot** — kích hoạt sau `FS_GCS_TIMEOUT` giây không nhận heartbeat từ GCS (**mặc định 5 giây**).

```
FS_GCS_ENABLE = 0   # Disabled  <-- an toàn nhất khi mới thử nghiệm link Wi-Fi
              = 1   # RTL (Land nếu không có GPS)
              = 3   # SmartRTL -> RTL -> Land
              = 4   # SmartRTL -> Land
              = 5   # Luôn Land
              = 6   # Auto DO_LAND_START hoặc RTL
              = 7   # BRAKE, không được thì LAND
FS_GCS_TIMEOUT = 5  # giây
```

`FS_OPTIONS` (bitmask) — bit liên quan GCS failsafe: bit 1 (tiếp tục Auto), bit 3 (tiếp tục nếu đang hạ cánh), bit 4 (tiếp tục ở chế độ do phi công điều khiển), bit 5 (nhả gripper).

> **Cảnh báo cho giai đoạn thử nghiệm:** link Wi-Fi 2.4GHz **sẽ** rớt lặt vặt. Nếu để `FS_GCS_ENABLE = 1`, drone sẽ tự RTL giữa chừng chỉ vì laptop mất gói 5 giây. Các chuyến bay đầu để **`FS_GCS_ENABLE = 0`** và dựa vào RC failsafe (`FS_THR_ENABLE`) — bộ RC mới là đường dây cứu sinh, không phải Wi-Fi. Chỉ bật GCS failsafe khi đã bay BVLOS thật sự dựa vào telemetry.

---

## 5. TFmini Plus với ArduPilot

### Tham số (verify trên ardupilot.org — trang TFmini/TFmini Plus)

```
SERIAL4_PROTOCOL = 9      # Lidar / Rangefinder
SERIAL4_BAUD     = 115    # 115200
RNGFND1_TYPE     = 20     # Benewake-Serial (dùng cho CẢ TFmini và TFmini Plus qua UART)
RNGFND1_MIN      = 0.1    # mét — TFmini Plus (TFmini là 0.3)
RNGFND1_MAX      = 6      # mét — ngoài trời (trong nhà 10)
RNGFND1_GNDCLR   = 0.1    # mét — khoảng cách từ cảm biến xuống đất khi đặt trên sàn
```

Xác nhận đúng như câu hỏi: **`RNGFND1_TYPE = 20`**, **protocol 9**, **baud mặc định 115200**.

Nếu đấu I2C: `RNGFND1_TYPE = 25` và `RNGFND1_ADDR = 16` (0x10 hex). ArduPilot ghi rõ **UART dễ cập nhật firmware cảm biến hơn** → ưu tiên UART.

> **Xung đột cổng cần quyết định:** `SERIAL4` trên SpeedyBee F405 V5 **đang là GPS**. SERIAL2 đã dành cho ESP32 bridge → dự án **thiếu UART trống**. Chọn một: TFmini qua I2C, hoặc hy sinh SERIAL3 (DJI-VTX) / SERIAL5 (ESC telemetry). Thay số `4` ở trên bằng số cổng thực sự dùng.

### Thông số và lắp đặt

- Tầm: **12m trong nhà / 7m ngoài trời**; khối lượng 11g (TFmini Plus), 5g (TFmini).
- Baud mặc định **115200**, tốc độ khung mặc định **100Hz**.
- Lắp hướng thẳng xuống, tránh càng đáp che; tránh bề mặt hấp thụ (nước, kính, vật rất tối) và nắng gắt chiếu thẳng vào ống kính.
- Kiểm tra trong Mission Planner: `Flight Data` → tab `Status` → mục `rangefinder1`.

### Bench-test trên Windows với USB-TTL

Khung 9 byte (little-endian, checksum = 8 bit thấp của tổng 8 byte đầu):

| Byte | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| | `0x59` | `0x59` | Dist_L | Dist_H | Strength_L | Strength_H | Temp_L | Temp_H | Checksum |

Đấu dây: TFmini Plus `5V → 5V`, `GND → GND`, `TX → RX của USB-TTL`, `RX → TX của USB-TTL`.

**(a) Benewake GUI** — phần mềm chính hãng, đồ thị khoảng cách thời gian thực, đổi được baud/frame rate. Tải từ `en.benewake.com`, mục download của TFmini Plus.

**(b) Script Python** — tự chủ hơn, không cần cài phần mềm ngoài:

```powershell
pip install pyserial
```

```python
# tfmini_test.py  -- chay: python tfmini_test.py COM5
import sys, serial

port = sys.argv[1] if len(sys.argv) > 1 else "COM5"
ser = serial.Serial(port, 115200, timeout=1)

while True:
    if ser.read(1) != b'\x59':
        continue
    if ser.read(1) != b'\x59':
        continue
    body = ser.read(7)
    if len(body) != 7:
        continue
    dist     = body[0] | (body[1] << 8)
    strength = body[2] | (body[3] << 8)
    temp_raw = body[4] | (body[5] << 8)
    checksum = (0x59 + 0x59 + sum(body[:6])) & 0xFF
    ok = "OK " if checksum == body[6] else "BAD"
    print(f"{ok} dist={dist:5d} cm  strength={strength:6d}  temp={temp_raw/8.0-256:.1f} C")
```

Đọc kết quả: `strength` rất thấp (<100) hoặc bão hoà → `dist` không đáng tin. Đây chính là lý do ArduPilot có `RNGFND1_MIN`/`MAX`.

---

## 6. Những gì CHƯA XÁC MINH

| Mục | Trạng thái |
|---|---|
| `MAVn_OPTIONS = 2` cho ESP32 bridge | **Chưa xác minh** — không thấy trên `common-esp32-telemetry.html` lẫn `parameters.html` khi fetch trực tiếp |
| Mọi con số **fps camera** (ESP32-CAM lẫn S3) | **Chưa xác minh** — benchmark cộng đồng, README `esp32-camera` không công bố fps |
| **Khối lượng** XIAO ESP32S3 Sense ("14.7g") | **Chưa xác minh** — Seeed wiki không công bố khối lượng |
| **Giá** ESP32-CAM / XIAO / S3-EYE | **Chưa xác minh** — chỉ giá Freenove $31.99 là niêm yết chính thức |
| Tầm xa 50–100m thực địa | **Chưa xác minh** — mọi số là công bố nhà sản xuất/PX4 docs điều kiện lý tưởng, chưa test trên khung có nhiễu ESC |
| `https://ardupilot.org/copter/docs/common-speedybeef4v4.html` | **404** — dùng hwdef README trên GitHub thay thế |
| `https://ardupilot.org/copter/docs/common-mavlink-routing-in-ardupilot.html` | **404** |
| SparkFun `TFmini_Plus_A02_Product_Manual_EN.pdf` | URL sống (932KB) nhưng **PDF không parse được**; thông số lấy chéo từ ArduPilot docs + thư viện budryerson |
| `en.benewake.com/uploadfiles/2025/04/20250402144215170.pdf` | URL sống (2.5MB) nhưng **PDF không parse được** |
| `https://www.wch.cn/downloads/CH341SER_EXE.html` | **Chưa xác minh** — trang cần JS |
| Link silabs CP210x driver | Lấy từ báo cáo phụ, **chưa fetch lại trực tiếp** |
| URL benchmark camera (RandomNerdTutorials, DroneBotWorkshop, ResearchGate, espboards.dev, makerguides, esp32-cam-fpv) | Agent phụ báo đã verify, **tôi chưa fetch lại trực tiếp** |
| Bảo trì DroneBridge | Release stable gần nhất **12/09/2024** — cần theo dõi dự án còn sống không |

### Đã verify (HTTP 200, đọc được nội dung)

https://github.com/DroneBridge/ESP32 · https://github.com/DroneBridge/ESP32/releases · https://drone-bridge.com/flasher/ · https://dronebridge.github.io/ESP32/ · https://ardupilot.org/copter/docs/common-esp32-telemetry.html · https://ardupilot.org/copter/docs/common-esp8266-telemetry.html · https://ardupilot.org/copter/docs/common-benewake-tfmini-lidar.html · https://ardupilot.org/copter/docs/gcs-failsafe.html · https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_HAL_ChibiOS/hwdef/speedybeef4v5/README.md · https://www.expresslrs.org/software/mavlink/ · https://github.com/olliw42/mLRS · https://docs.px4.io/main/en/telemetry/esp32_wifi_module · https://github.com/espressif/esp32-camera · https://github.com/espressif/esptool · https://docs.espressif.com/projects/esptool/en/latest/esp32/ · https://docs.platformio.org/en/latest/boards/espressif32/esp32cam.html · https://docs.platformio.org/en/latest/boards/espressif32/esp32doit-devkit-v1.html · https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/ · https://store.freenove.com/products/fnk0084 · https://github.com/budryerson/TFMini-Plus

### Verify bằng công cụ khác (không phải web)

`winget search` chạy trên chính máy Windows 11 này xác nhận: `ArduinoSA.IDE.stable` (2.3.10), `ArduinoSA.CLI` (1.5.1), `Microsoft.VisualStudioCode`, `Python.Python.3.12` / `3.14`, `Espressif.eim` / `Espressif.EIM-CLI`. Xác nhận **không có** winget package cho PlatformIO, CP210x, CH340.
