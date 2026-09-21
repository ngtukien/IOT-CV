# Phase 12: Firmware ESP32 — cầu telemetry, camera, TFmini, hotspot

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 11 | ~6,5 giờ | Không — làm hết trên PC, board chưa về vẫn làm được |

## Mục tiêu

Xong phase này, ba thứ chạy trên ESP32 đã sẵn sàng nằm trên đĩa: firmware cầu telemetry
(DroneBridge — tải về, không tự viết), project camera PlatformIO build được cho **cả hai** loại
board đang cân nhắc mua, và script đọc cảm biến TFmini Plus trên bàn. Cộng thêm hotspot Wi-Fi
của laptop đã cấu hình và mở cổng tường lửa.

Mục đích của phase: ngày board về, bạn chỉ cắm USB và bấm nút — không phải vừa tra tài liệu vừa
cầm mỏ hàn. Người mới hỏng board chủ yếu vì làm hai việc đó cùng lúc.

Quyết định "mua camera nào" (`plans/QUYET-DINH-CHUA-CHOT.md`) vẫn đang mở. Phase này **không
chờ**: viết cho cả hai nhánh.

## Đầu vào cần có

- `plans/reports/260921-research-esp32-bridge-camera.md` — §1 DroneBridge, §2 toolchain + driver, §3 camera + nguồn, §4 Wi-Fi AP/STA + GCS failsafe, §5 TFmini Plus.
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` §3 — bản đồ cổng serial, §6 rủi ro Wi-Fi.
- `docs/hop-dong-mjpeg.md` (Phase 07) — hợp đồng header MJPEG bắt buộc: `X-Frame-Id`, `X-Timestamp-Ms`, `X-Jpeg-Quality`, `X-Framesize`.
- `firmware/ardupilot/params/01-base.param` (Phase 11) — để khớp `SERIAL2_BAUD,115`.
- `plans/QUYET-DINH-CHUA-CHOT.md` — Quyết định 1 (camera).
- Đã cài ở Phase 00: VS Code + PlatformIO, Python 3.13, esptool.
- Kết nối internet để tải firmware DroneBridge và toolchain PlatformIO (lần đầu ~1 GB).

## File và thư mục sở hữu

```text
firmware/dronebridge/README.md
firmware/dronebridge/bin/                      (.bin tải về — đã .gitignore ở Phase 11)
firmware/camera/platformio.ini
firmware/camera/README.md
firmware/camera/src/main.cpp
firmware/camera/src/camera_pins.h
firmware/camera/include/secrets.example.h
firmware/camera/.gitignore                     (loại include/secrets.h và .pio/)
scripts/bench_tfmini.py
docs/so-tay/12-hotspot-laptop.md
docs/so-tay/12-esp32-cho-nguoi-moi.md
```

Không đụng `firmware/ardupilot/**` (Phase 11 sở hữu) và không đụng `backend/**` (Phase 17 sẽ đổi
điểm kết nối).

---

## Việc theo thứ tự

### 12.1 Vì sao không tự viết cầu MAVLink

Trước khi làm, hiểu quyết định đã chốt. Trong repo có sẵn hai file nháp
`esp32/mavlink_bridge/mavlink_bridge.ino` (39 dòng) và `esp32/camera/camera.ino` (29 dòng) — cả
hai mới chỉ là khung TODO. Phase 01 đã chuyển chúng vào `docs/archive/`.

```text
CAU MAVLINK  ->  DUNG DroneBridge for ESP32 (firmware co san)
   Ly do: ArduPilot ghi vao tai lieu chinh thuc; co web-flasher chay thang trong
   Chrome/Edge (khong can cai gi); co web UI cau hinh; co them che do ESP-NOW
   tam 1km ma sketch tu viet khong bao gio co.
   Tu viet phai tu lam: reconnect, buffer, non-blocking, dang ky endpoint UDP,
   OTA, web config. Nguoi moi sa lay o tang truyen tai thay vi tang ung dung.

CAMERA  ->  PHAI TU VIET
   Khong co firmware camera dong goi san nao phu hop. Day la ly do phase nay
   van can PlatformIO.
```

Ghi kết luận này vào đầu `firmware/dronebridge/README.md` — để sáu tháng nữa bạn không tự hỏi
"sao hồi đó không tự viết cho chủ động".

### 12.2 Tải DroneBridge và viết bảng cấu hình sẵn

```powershell
New-Item -ItemType Directory -Force -Path firmware\dronebridge\bin
Start-Process "https://github.com/DroneBridge/ESP32/releases"
# Tai ban release moi nhat cho chip "esp32" (KHONG lay ban s2/s3/c3 tru khi
# board ban mua dung chip do). Luu vao firmware\dronebridge\bin\
```

**AN TOÀN (mức dự án, không phải mức bay):** tải file `.bin` về **lưu trong repo ngay bây giờ**,
đừng phụ thuộc vào trang tải còn sống. Bản release ổn định gần nhất của DroneBridge là
**12/09/2024** — dự án có thể đã ngừng bảo trì. Có file trên đĩa thì dù trang có chết bạn vẫn nạp được.

Viết `firmware/dronebridge/README.md` gồm 5 mục:

**(a) Nạp bằng web flasher** — cách dễ nhất, không cần cài gì:

```text
1. Mo Chrome hoac Edge   (Firefox ESR 140 KHONG chay duoc; Firefox desktop >= 151 thi duoc)
2. Vao  https://drone-bridge.com/flasher/
3. Cam ESP32 DevKit qua USB  (phai cai driver CP210x/CH340 truoc - muc (d))
4. Chon firmware "vehicle/air"  ->  Connect  ->  chon COM port  ->  Install
```

Sau khi nạp, board tự phát Wi-Fi riêng để bạn vào cấu hình lần đầu:

```text
SSID     : DroneBridge ESP32
Password : dronebridge
Web UI   : http://dronebridge.local   hoac   http://192.168.2.1
GCS      : UDP 14550  hoac  TCP 5760
```

Cách thay thế (khi web flasher không chạy): nạp bằng `esptool`.

```powershell
esptool -p COM3 flash-id
esptool -p COM3 erase-flash
esptool --chip esp32 -p COM3 -b 460800 write-flash 0x0 firmware\dronebridge\bin\<ten-file>.bin
```

> `esptool` v5 đã đổi cú pháp: dùng `esptool` (không còn `esptool.py`), subcommand dùng gạch nối
> (`flash-id`, `write-flash`). Tutorial cũ viết `esptool.py write_flash` là cú pháp v4, sẽ báo lỗi.

**(b) Bảng giá trị điền vào web UI** — đây là phần đáng viết trước nhất, vì lúc board về bạn sẽ
ngồi trước một trang web đầy ô trống:

| Ô trong web UI | Điền | Vì sao |
|---|---|---|
| UART TX pin | GPIO nối tới **R2** của FC | *chưa xác minh* số GPIO — phụ thuộc board DevKit cụ thể, đọc lúc cắm (Phase 17) |
| UART RX pin | GPIO nối tới **T2** của FC | như trên |
| Baud | `115200` | khớp `SERIAL2_BAUD,115` trong `01-base.param` |
| Wi-Fi mode | **WiFi Client (STA)** | mặc định là AP; **bắt buộc đổi**, xem 12.6 |
| SSID | SSID hotspot laptop | laptop không nối được 2 AP cùng lúc |
| Password | mật khẩu hotspot | |
| GCS IP / UDP target | **IP của laptop** trên mạng hotspot | *chưa xác minh* tên chính xác của ô này trong UI v2.4.1 — đọc nhãn lúc mở |
| Port | `14550` | cổng MAVLink tiêu chuẩn |

**(c) Đấu dây sang bo bay** (bảng này sẽ được chép lại vào `docs/so-tay/13-dau-day.md` ở Phase 13):

```text
FC  T2  (UART2 TX)  ->  ESP32 RX
FC  R2  (UART2 RX)  ->  ESP32 TX          <-- BAT CHEO. Day la cho hay nham nhat.
FC  GND             ->  ESP32 GND         <-- BAT BUOC. Khong GND chung = khong bao gio chay.
ESP32 5V            <-  UBEC 5V 3A rieng  <-- KHONG lay tu pad 5V cua stack
```

**AN TOÀN:** ESP32 bật Wi-Fi tạo xung dòng đột ngột. Cấp nguồn cho nó từ pad 5V của stack có thể
kéo sụt áp toàn bộ đường 5V và **reset bo bay giữa lúc đang bay**. Luôn dùng UBEC riêng lấy thẳng
từ pin. Cả hai phía đều logic 3,3 V nên không cần mạch chuyển mức — nhưng vẫn phải đo lại bằng
đồng hồ trước khi cắm, đừng tin sơ đồ trên mạng.

**(d) Driver USB-serial:**

| Chip | Board thường gặp | Tải ở |
|---|---|---|
| CP210x (Silicon Labs) | ESP32 DevKit phổ biến, CP2102 | `https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers` |
| CH340/CH341 (WCH) | DevKit giá rẻ, USB-TTL rẻ | `https://www.wch.cn/downloads/CH341SER_EXE.html` *(chưa xác minh — trang cần JS)* |
| USB CDC gốc | ESP32-S3 / C3 (XIAO) | không cần driver |

```powershell
Get-CimInstance Win32_SerialPort | Format-Table Name, Description
```

**(e) Rủi ro và phương án hai:** nếu tới lúc dùng mà DroneBridge không chạy được trên board đang
có, phương án hai là tự viết sketch — nhưng **chỉ khi thật sự bế tắc**, không phải "cho chủ động".

**Kết quả mong đợi:** có file `.bin` trong `firmware/dronebridge/bin/`; README đủ 5 mục; bảng (b)
điền được hết trừ 3 ô đánh dấu *chưa xác minh*.

**Nếu lỗi:**
- Trang release đổi cấu trúc → tải asset có tên chứa `esp32` và **không** có hậu tố `s2/s3/c3`.
- `git status` hiện file `.bin` → dòng `.gitignore` ở Phase 11.1 chưa được thêm.

### 12.3 Project camera PlatformIO — hai cấu hình build

Viết một project duy nhất có **hai `env`**: một cho ESP32-CAM AI-Thinker, một cho XIAO ESP32S3
Sense. Board nào về thì chọn `env` đó, không phải viết lại.

Cài công cụ (một lần, Phase 00 có thể đã làm):

```powershell
winget install Microsoft.VisualStudioCode
# Trong VS Code: Extensions -> go "PlatformIO IDE" -> Install
# Lan dau no tu tai toolchain ~1GB, mat 10-20 phut. De chay nen, dung huy giua chung.
```

`firmware/camera/platformio.ini`:

```ini
[platformio]
default_envs = esp32cam

[env]
framework = arduino
monitor_speed = 115200

[env:esp32cam]
platform = espressif32
board = esp32cam
board_build.partitions = huge_app.csv
build_flags =
    -DCAMERA_MODEL_AI_THINKER
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue

[env:xiao_esp32s3]
platform = espressif32
; board id "seeed_xiao_esp32s3" - CHUA XAC MINH.
; Doi chieu lai bang `pio boards | findstr -i xiao` TRUOC khi mua board.
board = seeed_xiao_esp32s3
build_flags =
    -DCAMERA_MODEL_XIAO_ESP32S3
    -DBOARD_HAS_PSRAM
    -DARDUINO_USB_CDC_ON_BOOT=1
```

`firmware/camera/src/camera_pins.h` — bảng chân của hai board, chọn bằng macro
`CAMERA_MODEL_AI_THINKER` / `CAMERA_MODEL_XIAO_ESP32S3`. **Lấy bảng chân từ file `camera_pins.h`
gốc trong ví dụ `CameraWebServer` của core `espressif/arduino-esp32`**, không tự chế — gán nhầm
một chân là camera không init được và thông báo lỗi không nói cho bạn biết chân nào sai.

`firmware/camera/include/secrets.example.h` — **không hardcode mật khẩu vào mã nguồn**:

```c
#pragma once
// Chep file nay thanh include/secrets.h roi dien gia tri that.
// include/secrets.h nam trong .gitignore - KHONG BAO GIO commit mat khau Wi-Fi.

#define WIFI_SSID      "IOTCV-HOTSPOT"
#define WIFI_PASSWORD  "doi-mat-khau-nay"

// 0..63. So NHO = net hon = file to hon = fps THAP hon.
// Nguoc voi truc giac "chat luong 0-100" quen thuoc.
#define JPEG_QUALITY_DEFAULT  12
#define FRAME_SIZE_DEFAULT    FRAMESIZE_VGA   // 640x480 - dung khoi dau o day
#define WIFI_RECONNECT_MS     5000
#define HTTP_PORT             80
```

`firmware/camera/.gitignore`:

```gitignore
.pio/
include/secrets.h
```

### 12.4 Máy chủ MJPEG: `/stream`, `/set?quality=`, header từng khung

`firmware/camera/src/main.cpp` — ba đường dẫn HTTP, chạy ở chế độ **STA** (nối vào hotspot laptop,
không tự phát Wi-Fi):

| Đường dẫn | Việc | Trả về |
|---|---|---|
| `GET /stream` | luồng MJPEG liên tục | `Content-Type: multipart/x-mixed-replace; boundary=frame` |
| `GET /set?quality=N` | đổi `jpeg_quality` lúc đang chạy, N trong **0..63** | `200` + JSON giá trị mới; `400` nếu N ngoài khoảng |
| `GET /status` | trạng thái | JSON: `quality`, `framesize`, `rssi`, `uptime_ms`, `frames_sent` |

**Header từng khung** — đây là thứ backend cần để gắn nhãn chất lượng cho từng ảnh (phục vụ cơ
chế QoS ở Phase 24 và luồng AI sau này). Cài đặt **đúng nguyên văn** theo hợp đồng
`docs/hop-dong-mjpeg.md` (Phase 07 tạo) — mỗi phần trong luồng multipart phải có đủ bốn header
sau:

```text
--frame
Content-Type: image/jpeg
Content-Length: <so byte>
X-Frame-Id: <so thu tu khung, tang dan tu 0>
X-Timestamp-Ms: <millis() cua ESP32>
X-Jpeg-Quality: <0..63, gia tri dang dung luc chup khung nay>
X-Framesize: <ten framesize dang dung, vi du VGA>

<du lieu JPEG nhi phan>
```

Ba điểm bắt buộc trong mã:

```text
1. MOI so tinh chinh deu la hang so trong secrets.h - khong rai so le trong ham.
   (JPEG_QUALITY_DEFAULT, FRAME_SIZE_DEFAULT, WIFI_RECONNECT_MS, HTTP_PORT)

2. Bat dau o VGA 640x480, KHONG bat dau o 1600x1200.
   O do phan giai cao ESP32-CAM chi dat ~1,3 fps  (chua xac minh - benchmark
   cong dong, README esp32-camera khong cong bo fps).

3. X-Jpeg-Quality phai la gia tri DANG DUNG luc chup khung do, khong phai gia tri
   trong bien cau hinh. Neu /set?quality= doi giua chung ma header van bao so cu,
   toan bo thi nghiem chat luong anh o cac phase sau se sai so lieu.
```

Build thử — **không cần board**:

```powershell
cd firmware\camera
Copy-Item include\secrets.example.h include\secrets.h
pio run -e esp32cam
pio run -e xiao_esp32s3
```

**Kết quả mong đợi:** cả hai lệnh kết thúc bằng `SUCCESS`; `git status` **không** hiện
`include/secrets.h` và **không** hiện thư mục `.pio/`.

**Nếu lỗi:**
- `Unknown board ID 'seeed_xiao_esp32s3'` → đúng như đã cảnh báo. Chạy `pio boards | findstr -i xiao`
  lấy tên thật, sửa `platformio.ini`, và **sửa luôn ghi chú "chưa xác minh" thành đã xác minh**
  kèm ngày. Đừng để ghi chú sai tồn tại.
- `region 'app' overflowed` ở env `esp32cam` → thiếu `board_build.partitions = huge_app.csv`.
- `camera init failed` (chỉ gặp khi có board) → sai bảng chân trong `camera_pins.h`, hoặc thiếu
  `-DBOARD_HAS_PSRAM`.

### 12.5 Nghi thức nạp riêng của ESP32-CAM (nếu chọn nhánh A)

Viết vào `firmware/camera/README.md`. ESP32-CAM AI-Thinker **không có cổng USB** — phải dùng mạch
USB-TTL và mỗi lần nạp phải nối tắt một chân.

```text
ESP32-CAM        USB-TTL (logic 3.3V, cap nguon 5V)
  5V     <-----   VCC (5V)
  GND    <---->   GND
  U0R    <-----   TX
  U0T    ----->   RX
  IO0    <---->   GND      <-- CHI trong luc nap, thao ra sau khi nap xong

Quy trinh:
  1. Noi IO0 -> GND
  2. Bam Upload trong PlatformIO
  3. Khi thay "Connecting..." thi bam nut RST tren ESP32-CAM
  4. Nap xong: THAO day IO0, bam RST lan nua
```

Thiếu bước `IO0 → GND` sẽ báo đúng dòng này:
`Failed to connect to ESP32: Timed out waiting for packet header`.

**AN TOÀN:** không cấp nguồn ESP32-CAM từ chân 3,3 V của mạch USB-TTL. Lúc khởi động nó kéo
**250–500 mA**; chân 3,3 V của USB-TTL không gánh nổi → board reset liên tục và bạn sẽ đi tìm lỗi
trong phần mềm trong khi lỗi nằm ở nguồn. Dùng chân **5 V**. Khi lắp lên drone thì dùng UBEC 5V 3A
riêng, và **hàn tụ 470–1000 µF low-ESR sát chân nguồn** để chống brownout lúc Wi-Fi bật.

Ghi thêm vào README hai điểm về nhánh B (XIAO ESP32S3 Sense): có USB-C nên cắm là nạp, không có
nghi thức `IO0`; đã kèm sẵn anten ngoài nên không phải hàn lại điện trở SMD 0-ohm.

### 12.6 Hotspot Wi-Fi trên laptop và mở cổng tường lửa

Cả ESP32 bridge lẫn camera đều nối **vào laptop**, chứ không tự phát Wi-Fi. Lý do là một ràng
buộc cứng: **một card Wi-Fi laptop chỉ nối được một điểm truy cập tại một thời điểm**, mà dự án
cần đồng thời telemetry và video. Nếu mỗi ESP32 làm AP riêng thì bạn phải chọn một trong hai.

Viết `docs/so-tay/12-hotspot-laptop.md`:

```text
1. Windows 11: Settings -> Network & internet -> Mobile hotspot -> Bat
2. Bam Edit, dat SSID va mat khau CO DINH:
       SSID     IOTCV-HOTSPOT
       Password (8-20 ky tu; chep vao firmware/camera/include/secrets.h)
       Band     2.4 GHz      <-- BAT BUOC. ESP32 KHONG nhin thay mang 5 GHz.
3. Giu SSID + mat khau khong doi MAI MAI. Moi lan doi la phai nap lai firmware
   camera VA cau hinh lai DroneBridge - ca hai deu khong co man hinh de bao loi.
```

Tìm IP của laptop trên mạng hotspot (con số này điền vào ô "GCS IP" của DroneBridge ở Phase 17,
và vào `MAVLINK_ENDPOINT` của backend):

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -like "*Local Area Connection*" -or $_.InterfaceAlias -like "*Wi-Fi*" } |
  Format-Table InterfaceAlias, IPAddress
```

Hotspot Windows thường cấp cho chính laptop địa chỉ dạng `192.168.137.1`. **Ghi con số thật** vào
sổ tay, đừng chép con số ví dụ.

Mở cổng UDP 14550 (PowerShell **Run as Administrator**):

```powershell
New-NetFirewallRule -DisplayName "IOTCV MAVLink UDP 14550" `
  -Direction Inbound -Protocol UDP -LocalPort 14550 -Action Allow -Profile Any
```

**AN TOÀN (mức dữ liệu, không phải mức bay):** quy tắc này mở cổng cho **mọi** profile mạng, kể
cả Public. Ở nhà thì chấp nhận được; ở quán cà phê hay mạng trường thì xoá sau khi dùng:

```powershell
Remove-NetFirewallRule -DisplayName "IOTCV MAVLink UDP 14550"
```

Ba cái bẫy bắt buộc ghi vào sổ tay:

```text
1. Windows TU TAT Mobile hotspot sau vai phut neu khong co thiet bi nao noi vao.
   Bat hotspot TRUOC, cap dien cho drone SAU. Dung lam nguoc.

2. UDP khong co khai niem "ket noi". GCS phai gui goi truoc (heartbeat) thi ESP32
   moi biet dia chi de tra loi. Mission Planner va QGroundControl tu lam viec nay.
   Neu mo GCS ma khong thay gi -> day la nghi pham so MOT.

3. Tuong lua Windows nuot goi UDP IM LANG - khong bao loi gi ca. Ban se ngoi debug
   nham cho hang gio. Kiem tra rule tuong lua TRUOC khi nghi board hong.
```

**Kết quả mong đợi:** hotspot bật được ở băng 2,4 GHz; SSID/mật khẩu đã chép vào
`firmware/camera/include/secrets.h`; `Get-NetIPAddress` trả về một IP dạng `192.168.137.x`;
rule tường lửa hiện trong `Get-NetFirewallRule -DisplayName "IOTCV*"`.

**Nếu lỗi:**
- Mục Mobile hotspot xám không bật được → driver Wi-Fi không hỗ trợ, hoặc card đang ở chế độ tiết
  kiệm điện. Phương án hai: dùng điện thoại phát hotspot 2,4 GHz, cho laptop nối vào — lúc đó IP
  laptop lấy bằng cùng lệnh trên nhưng trên interface Wi-Fi.
- Không thấy mục chọn Band → một số driver chỉ hiện sau khi đã bật hotspot lần đầu.

### 12.7 Script đọc TFmini Plus trên bàn

TFmini Plus là cảm biến đo khoảng cách bằng tia hồng ngoại. Trước khi cắm nó vào bo bay, phải
chứng minh **bản thân cảm biến còn sống và đang nói đúng giao thức**. Bỏ qua bước này mà nó câm
thì bạn có ba nghi phạm cùng lúc — cảm biến, dây, tham số bo bay — mỗi nghi phạm một buổi mò.

Cảm biến gửi liên tục khung 9 byte: `0x59 0x59` mở đầu, 2 byte khoảng cách (cm), 2 byte cường độ
tín hiệu, 2 byte nhiệt độ, 1 byte checksum.

```powershell
py -3.13 -m pip install pyserial
```

`scripts/bench_tfmini.py`:

```python
"""Doc TFmini Plus qua USB-TTL de kiem tra cam bien truoc khi cam vao bo bay.

Chay:  py -3.13 scripts/bench_tfmini.py COM5

Ket qua dung: dong chu chay lien tuc ~100 dong/giay, cot ok tang deu,
cot bad gan nhu dung yen. Che tay truoc ong kinh -> dist tut xuong vai chuc cm.

Neu KHONG ra dong nao:
  Cam bien dang o che do Pixhawk (chuoi ky tu) thay vi Standard 9 byte.
  Gui lenh HEX  5A 05 05 01 65  (ep ve Standard 9 bytes)
  roi           5A 04 11 6F     (LUU cai dat)
  roi cap nguon lai.
Neu bad tang bang ok: sai baud, hoac GND khong chung.
Neu bao could not open port: sai so COM.
  Xem lai bang  Get-CimInstance Win32_SerialPort | Format-Table Name, Description
"""
import sys
import serial

port = sys.argv[1] if len(sys.argv) > 1 else "COM5"
ser = serial.Serial(port, 115200, timeout=1)
ok_count = bad_count = 0

while True:
    if ser.read(1) != b"\x59":
        continue
    if ser.read(1) != b"\x59":
        continue
    body = ser.read(7)
    if len(body) != 7:
        continue
    dist = body[0] | (body[1] << 8)
    strength = body[2] | (body[3] << 8)
    temp_raw = body[4] | (body[5] << 8)
    checksum = (0x59 + 0x59 + sum(body[:6])) & 0xFF
    if checksum == body[6]:
        ok_count += 1
        tag = "OK "
    else:
        bad_count += 1
        tag = "BAD"
    print(f"{tag} dist={dist:5d} cm  strength={strength:6d}  "
          f"temp={temp_raw / 8.0 - 256:.1f} C  ok={ok_count} bad={bad_count}")
```

Sơ đồ đấu sang USB-TTL — màu dây theo datasheet Benewake bảng 5.1:

```text
TFmini Plus                    USB-TTL (3.3V logic, cap nguon 5V)
  Do     PIN-1  +5V    --->     5V
  Trang  PIN-2  RXD    --->     TX     (chi dung khi gui lenh HEX cau hinh)
  Xanh   PIN-3  TXD    --->     RX     <-- day nay mang so lieu ve
  Den    PIN-4  GND    --->     GND
```

**AN TOÀN:** datasheet ghi rõ TFmini Plus **không có mạch bảo vệ quá áp và không có bảo vệ đấu
ngược cực**, chỉ chịu dao động ±0,5 V. Cắm nhầm 5 V vào chân GND là hỏng vĩnh viễn, không có tín
hiệu báo trước. **Đo lại từng dây bằng đồng hồ vạn năng trước khi cấp điện lần đầu — đừng tin màu
dây.**

Ghi thêm vào docstring/README bộ lệnh HEX kiểm tra (checksum đã kiểm chứng, nguồn: SJ-PM-TFmini
Plus A04 Product Manual mục 6.4):

```text
5A 04 01 5F      doc firmware version  -> tra ve 5A 07 01 V1 V2 V3 SU
5A 04 10 6E      khoi phuc cai dat goc (115200 / UART / Standard 9 byte / 100Hz)
5A 04 11 6F      LUU cai dat   <-- BAT BUOC gui sau moi lenh thay doi
5A 05 05 01 65   ep ve Standard 9 bytes (cm)  <-- dinh dang ArduPilot can
5A 05 05 02 66   Pixhawk mode (chuoi ky tu)   <-- ArduPilot >= 3.6.2 KHONG doc duoc
5A 05 0A 00 69   chuyen ve UART      |    5A 05 0A 01 6A   chuyen sang I2C
```

Và cách kiểm tra "còn sống" bằng mắt:

```text
Cap nguon 5V -> nhin THANG vao ong kinh PHAT -> phai thay DEN DO mo.
Khong co den do = cam bien chet, doi tra ngay.
```

**Kết quả mong đợi (bây giờ, chưa có cảm biến):**

```powershell
py -3.13 scripts\bench_tfmini.py COM99
```
→ báo lỗi mở cổng (`could not open port`), **không** báo lỗi cú pháp Python. Tức script chạy được
tới chỗ mở cổng.

Kết quả thật sẽ kiểm ở Phase 17.

### 12.8 Sổ tay ESP32 cho người mới

Viết `docs/so-tay/12-esp32-cho-nguoi-moi.md`:

- **ESP32 là gì** — một con vi điều khiển có sẵn Wi-Fi, giá vài trăm nghìn, chạy chương trình bạn
  nạp vào. Không phải máy tính, không có hệ điều hành theo nghĩa thông thường.
- **Ba vai trò của ESP32 trong dự án này** — một con làm cầu telemetry (chạy DroneBridge, bạn
  không viết mã), một con làm camera (bạn viết mã). Đừng lẫn hai con.
- **AP và STA** — AP là "phát Wi-Fi", STA là "nối vào Wi-Fi của người khác". Dự án này cả hai
  ESP32 đều là STA, laptop là AP.
- **UDP không có kết nối** và hệ quả: GCS phải gửi gói trước.
- **MJPEG là gì** — không phải video nén, chỉ là chuỗi ảnh JPEG nối đuôi nhau. Nên xem được bằng
  trình duyệt và cắt ra từng khung rất dễ; đổi lại tốn băng thông hơn video nén thật.
- **`jpeg_quality` 0..63**: số **nhỏ** = nét hơn = file to hơn = fps thấp hơn. Ngược trực giác.
- **PSRAM là gì** và vì sao bắt buộc có nó cho mọi độ phân giải trên CIF khi dùng JPEG.
- **Vì sao camera chỉ phục vụ được một client** — đó là lý do backend đứng giữa làm cầu phân phối,
  chứ trình duyệt không cắm thẳng vào camera.

---

## Cổng pass

- [ ] `firmware/dronebridge/bin/` có file `.bin`; `git status` **không** liệt kê nó.
- [ ] `firmware/dronebridge/README.md` có đủ 5 mục; bảng cấu hình điền hết trừ 3 ô *chưa xác minh*.
- [ ] `pio run -e esp32cam` → `SUCCESS`.
- [ ] `pio run -e xiao_esp32s3` → `SUCCESS`, **hoặc** board id đã được sửa theo `pio boards` và ghi chú "chưa xác minh" đã được cập nhật kèm ngày.
- [ ] `git status` **không** hiện `firmware/camera/include/secrets.h` và **không** hiện `.pio/`.
- [ ] `firmware/camera/README.md` có nghi thức nạp ESP32-CAM (`IO0 → GND`) và cảnh báo nguồn.
- [ ] `py -3.13 scripts/bench_tfmini.py COM99` báo lỗi **mở cổng**, không phải lỗi cú pháp.
- [ ] Hotspot laptop bật được ở 2,4 GHz; SSID/mật khẩu đã vào `secrets.h`; IP laptop đã ghi vào `docs/so-tay/12-hotspot-laptop.md`.
- [ ] `Get-NetFirewallRule -DisplayName "IOTCV*"` trả về rule UDP 14550.
- [ ] `docs/so-tay/12-esp32-cho-nguoi-moi.md` giải thích đủ 8 khái niệm ở 12.8.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Board id `seeed_xiao_esp32s3` sai → không build được đúng lúc board về | 3 | 3 | 9 | 12.3 build thử **ngay bây giờ**, không chờ board. `pio boards \| findstr -i xiao` cho tên thật. |
| DroneBridge ngừng bảo trì (release cuối 12/09/2024), trang tải chết | 2 | 4 | 8 | 12.2 tải `.bin` về **lưu ngay** trong repo. Phương án hai (tự viết sketch) chỉ mở khi thật sự bế tắc. |
| Commit nhầm mật khẩu Wi-Fi vào git | 2 | 3 | 6 | `secrets.example.h` + `.gitignore` riêng của `firmware/camera/`; kiểm tra ở cổng pass. |
| Tường lửa Windows nuốt gói UDP im lặng → Phase 17 debug nhầm chỗ hàng giờ | 4 | 3 | **12** | 12.6 tạo rule **ngay trong phase này** và ghi 3 cái bẫy vào sổ tay; Phase 17 kiểm tra rule trước khi nghi board. |
| Hotspot Windows tự tắt khi không có thiết bị nối vào | 4 | 2 | 8 | Ghi vào sổ tay: bật hotspot **trước**, cấp điện drone **sau**. |
| ESP32-CAM brownout khi bật Wi-Fi (nếu chọn nhánh A) | 4 | 3 | **12** | Mua sẵn tụ 470–1000 µF (danh sách ở Phase 13); ghi vào README camera là bắt buộc hàn, không phải tuỳ chọn. |
| Chép sai bảng chân `camera_pins.h` → camera không init, thông báo lỗi không chỉ ra chân nào | 3 | 3 | 9 | 12.3 bắt buộc lấy từ file gốc của `espressif/arduino-esp32`, cấm tự chế. |

Không có rủi ro nào ≥ 15. Hai rủi ro điểm 12 đều được xử lý **trong phase này** chứ không để trôi
sang Phase 17.

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 12.1 Ghi lại quyết định không tự viết cầu | 0,2 | |
| 12.2 Tải DroneBridge + bảng cấu hình | 1,3 | |
| 12.3 Project PlatformIO 2 env | 1,5 | Lần đầu PlatformIO tải toolchain rất lâu — chạy nền song song với 12.6/12.7 |
| 12.4 Máy chủ MJPEG + header từng khung | 1,5 | Phần viết mã nhiều nhất của phase |
| 12.5 README nghi thức nạp ESP32-CAM | 0,3 | |
| 12.6 Hotspot + tường lửa | 0,7 | |
| 12.7 Script bench TFmini | 0,5 | |
| 12.8 Sổ tay ESP32 | 0,5 | |
| **Tổng** | **6,5** | Đường găng: 12.3 (tải toolchain). Bắt đầu 12.3 trước rồi làm việc khác trong lúc nó tải. |

## Ghi chú cho sổ tay

Chi tiết ở 12.8. Tóm tắt các khái niệm cần giải thích: ESP32 là gì và ba vai trò của nó trong dự
án · AP vs STA và vì sao laptop phải là bên phát · UDP không có kết nối · MJPEG là chuỗi ảnh JPEG
chứ không phải video nén · `jpeg_quality` 0..63 ngược trực giác · PSRAM và vì sao bắt buộc ·
camera chỉ phục vụ được một client nên backend phải đứng giữa · nghi thức `IO0 → GND` của
ESP32-CAM · brownout là gì và vì sao tụ 470 µF giải quyết được.
