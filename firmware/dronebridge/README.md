# firmware/dronebridge

Cầu nối không dây giữa flight controller (SpeedyBee F405 V5) và máy tính mặt đất. Nạp và cấu
hình ở **Phase 12** (`plans/phase-12-firmware-esp32-camera.md`); đấu dây lên `SERIAL2` của FC ở
**Phase 17** (`plans/phase-17-ban-esp32-tfmini-camera.md`).

## Vì sao không tự viết cầu MAVLink

```text
CAU MAVLINK  ->  DUNG DroneBridge for ESP32 (firmware co san)
   Ly do: ArduPilot ghi vao tai lieu chinh thuc; co web-flasher chay thang trong
   Chrome/Edge (khong can cai gi); co web UI cau hinh; co them che do ESP-NOW
   tam 1km ma sketch tu viet khong bao gio co.
   Tu viet phai tu lam: reconnect, buffer, non-blocking, dang ky endpoint UDP,
   OTA, web config. Nguoi moi sa lay o tang truyen tai thay vi tang ung dung.

CAMERA  ->  PHAI TU VIET (firmware/camera/)
   Khong co firmware camera dong goi san nao phu hop.
```

Đừng tự viết lại "cho chủ động". Phương án hai ở mục (e) chỉ mở khi DroneBridge thật sự bế tắc.

## Board và trạng thái hiện tại

ESP32 DevKit 30 chân: ESP32-D0WD-V3 rev 3.1, flash 4 MB, USB-UART CP2102 (driver CP210x Universal
v11.6.0), lên **COM4** trên máy dự án. Đang chạy **DroneBridge v2.4.1 (stable)**, nạp ngày
12/10/2026; firmware gốc trước khi xoá đã sao lưu ngoài repo (4 MB, đọc ở 115200 baud).

13/10/2026: ở chế độ STA, nối `IOTCV-HOTSPOT` (Mobile Hotspot 2,4 GHz của laptop), tên
`DroneBridgeESP32.mshome.net` (IP do DHCP cấp, đổi mỗi lần hotspot khởi động lại). Đẩy HEARTBEAT và RADIO_STATUS (sys 1, comp 68,
1 Hz) về `192.168.137.1:14550`. Gói của FC chỉ có khi đã đấu dây ở Phase 17. Web UI:
`http://DroneBridgeESP32.mshome.net/`.

## (a) Nạp firmware

File nhị phân lưu ngay trong repo (thư mục `bin/` đã `.gitignore`), không phụ thuộc trang tải còn
sống:

```powershell
gh release download v2.4.1 -R DroneBridge/ESP32 -D firmware\dronebridge\bin
Expand-Archive firmware\dronebridge\bin\DroneBridge_ESP32_v2_4_1_stable.zip firmware\dronebridge\bin\v2.4.1
# Release la MOT file zip chua thu muc cho tung chip. Dung thu muc "esp32\" (KHONG lay
# esp32s2/s3/c3/c6). Thu muc esp32\ co 4 file: bootloader.bin, partition-table.bin, db_esp32.bin, www.bin.
```

Kiểm 12/10/2026: dự án vẫn được bảo trì (v2.3.0 ngày 20/08, v2.4.0 ngày 26/08, v2.4.1 ngày
12/09/2026).

**Cách dễ nhất — web flasher**, không cần cài gì:

```text
1. Mo Chrome hoac Edge   (Firefox ESR 140 KHONG chay duoc; Firefox desktop >= 151 thi duoc)
2. Vao  https://drone-bridge.com/flasher/
3. Cam ESP32 DevKit qua USB  (phai cai driver CP210x truoc - muc (d))
4. Chon firmware "vehicle/air"  ->  Connect  ->  chon COM port  ->  Install
```

**Cách đã dùng thật — `esptool`** (12/10/2026, board CP2102 ở COM4):

```powershell
esptool -p COM4 -b 115200 flash-id
# Sao luu flash goc truoc khi xoa (4 MB, ~6 phut o 115200):
esptool -p COM4 -b 115200 read-flash 0 ALL D:\IOT_Tools\downloads\esp32-backup\esp32-<mac>-<ngay>.bin
esptool --chip esp32 -p COM4 -b 115200 erase-flash
cd firmware\dronebridge\bin\v2.4.1\DroneBridge_ESP32_v2_4_1_stable\esp32
esptool --chip esp32 -p COM4 -b 115200 --before default-reset --after hard-reset write-flash `
  --flash-mode dio --flash-size 2MB --flash-freq 40m `
  0x1000 bootloader.bin 0x8000 partition-table.bin 0x10000 db_esp32.bin 0x190000 www.bin
```

- **Chỉ dùng 115200 baud.** 921600 báo `No more data to read from the serial port`, 460800 báo
  `Read more than expected`. Ghi 4 file mất ~1,5 phút.
- Board có mạch auto-reset: **không cần bấm BOOT**. Chỉ khi báo `Wrong boot mode` mới giữ BOOT,
  nhấn-thả EN, rồi thả BOOT.
- `esptool` v5 đổi cú pháp: `esptool` (không còn `esptool.py`), subcommand gạch nối
  (`flash-id`, `write-flash`). Tutorial viết `esptool.py write_flash` là cú pháp v4.

Nạp xong, chưa cấu hình gì, board tự phát Wi-Fi `DroneBridge for ESP32` / mật khẩu `dronebridge`,
web UI `http://192.168.2.1`, kênh 6, GCS ở UDP 14550 hoặc TCP 5760.

## (b) Bảng cấu hình

Không điền tay vào web UI: cấu hình được ghi thẳng vào phân vùng NVS qua cáp USB (mục dưới bảng),
nên laptop không phải rời mạng có internet. Giá trị đang chạy, đọc lại được trong log boot:

| Ô trong web UI | Giá trị | Vì sao |
|---|---|---|
| UART TX pin | **GPIO17** (in "TX2" trên bo) → nối **R2** của FC | đã chốt 12/10/2026 |
| UART RX pin | **GPIO16** (in "RX2" trên bo) → nối **T2** của FC | đã chốt 12/10/2026 |
| Baud | `115200` | khớp `SERIAL2_BAUD,115` trong `01-base.param`; phiên FC xác nhận SERIAL2 = USART2 (pad T2/R2), MAVLink2, 115200 trên build d450a747 |
| Telemetry protocol | MAVLink (`proto 4`) | |
| Wi-Fi mode | **WiFi Client (STA)** (`esp32_mode 2`) | mặc định là AP; laptop không nối được 2 AP cùng lúc |
| SSID / Password | của Mobile Hotspot laptop (`IOTCV-HOTSPOT`) | script tự đọc từ Windows, không vào git |
| UDP target IP (`udp_client_ip`) | `192.168.137.1` | IP laptop trên hotspot; đặt sẵn thì ESP32 **tự đẩy** gói, GCS không phải gửi trước |
| UDP target port | `14550` | cổng MAVLink tiêu chuẩn |

Mẫu đầy đủ 26 khoá (tên và kiểu khớp `main/db_parameters.c` của v2.4.1):
[`db_params.iotcv.csv`](db_params.iotcv.csv).

### Cấu hình qua cáp USB (không cần vào Wi-Fi của board)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\dronebridge-nvs.ps1            # -Port COM4 mac dinh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\dronebridge-nvs.ps1 -NoFlash   # chi tao nvs.bin
```

Script làm bốn việc:
1. Kiểm cổng COM đúng là chip CP210x. FC hay bo camera cắm cùng lúc ở cổng khác, không ghi nhầm.
2. Đọc SSID và mật khẩu Mobile Hotspot của Windows (qua `scripts/esp32/hotspot.ps1`). Dừng nếu băng
   tần không phải 2,4 GHz.
3. Điền vào mẫu CSV, tạo `bin/config/nvs.bin`, rồi xoá file CSV tạm chứa mật khẩu.
4. Ghi `nvs.bin` vào `0x9000` (dài `0x6000`) ở 115200 baud. Firmware DroneBridge không bị đụng tới.

**Đổi SSID hay mật khẩu hotspot thì phải chạy lại script này** — NVS đang giữ giá trị cũ, board sẽ
không vào được mạng mà cũng không có màn hình báo lỗi. 13/10/2026 đã chạy lại sau khi đổi SSID sang
`IOTCV-HOTSPOT`: 15 s sau khi ghi, board đã ở mạng mới và đẩy gói về laptop.

**Cứu khi cấu hình sai** (ở chế độ STA, firmware thử kết nối lại mãi, không tự lùi về AP):
- Sửa mẫu rồi chạy lại script. Cách này luôn được vì đi qua USB.
- Hoặc nhấn nút BOOT (GPIO0) **đúng một lần**: firmware đưa SSID và mật khẩu về mặc định, chuyển
  sang AP `DroneBridge for ESP32` / `dronebridge`, rồi khởi động lại. Giữ lâu thì xoá toàn bộ cấu
  hình. Nhấn 2 đến 4 lần là các lệnh ghép cặp ESP-NOW, không phải để cứu.

Đọc log boot (tự reset chip, tự che mật khẩu):

```powershell
py -3.13 scripts\esp32\esp32_log.py COM4 --reset --seconds 15
```

## (c) Đấu dây sang bo bay

Bảng này được chép lại vào `docs/so-tay/13-dau-day.md` ở Phase 13.

```text
FC  T2  (UART2 TX)  ->  ESP32 GPIO16 (RX2)
FC  R2  (UART2 RX)  ->  ESP32 GPIO17 (TX2)     <-- BAT CHEO. Day la cho hay nham nhat.
FC  GND             ->  ESP32 GND              <-- BAT BUOC. Khong GND chung = khong bao gio chay.
ESP32 5V (VIN)      <-  UBEC 5V 3A rieng       <-- KHONG lay tu pad 5V cua stack
```

**AN TOÀN:** ESP32 bật Wi-Fi tạo xung dòng đột ngột. Cấp nguồn từ pad 5V của stack có thể kéo sụt
áp cả đường 5V và **reset bo bay giữa lúc đang bay**. Luôn dùng UBEC riêng lấy thẳng từ pin. Hai
phía đều logic 3,3 V nên không cần mạch chuyển mức — nhưng vẫn đo lại bằng đồng hồ trước khi cắm,
đừng tin sơ đồ trên mạng.

## (d) Driver USB-serial

| Chip | Board | Tải ở |
|---|---|---|
| CP210x (Silicon Labs) | ESP32 DevKit DroneBridge này (COM4), mạch USB-TTL CP2102 | `https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers` (trang chặn kiểm tự động — 403 ngày 13/10/2026; bản cài đã lưu ở `D:\IOT_Tools\downloads\drivers\cp210x\`) |
| CH343P (WCH) | cổng `USB-UART` của bo camera ESP32-S3 (COM7) | Windows 11 tự nhận bằng `usbser.sys`, không cài gì. Driver riêng của hãng nếu cần: `https://www.wch-ic.com/downloads/CH343SER_EXE.html` |
| CH340/CH341 (WCH) | DevKit giá rẻ khác | `https://www.wch.cn/downloads/CH341SER_EXE.html` |
| USB gốc của chip | cổng `USB-OTG` của bo camera | không cần driver; dự án không dùng cổng này |

```powershell
Get-CimInstance Win32_PnPEntity | Where-Object Name -match 'COM\d' | Format-Table Name, DeviceID
```

(`Win32_SerialPort` **không** liệt kê cổng CH343P — dùng `Win32_PnPEntity` như trên.)

## (e) Rủi ro và phương án hai

| Rủi ro | Xử lý |
|---|---|
| Trang tải / web flasher chết | `.bin` đã lưu trong `bin/` và zip gốc; nạp bằng `esptool` như mục (a) |
| Board hỏng | Mạch USB-TTL CP2102 dự phòng không chạy DroneBridge được — cần một ESP32 khác; nạp lại đúng các lệnh trên |
| DroneBridge không chạy được với FC ở Phase 17 | Kiểm thứ tự: dây bắt chéo, GND chung, `SERIAL2_PROTOCOL 2`, baud 115200, rule tường lửa. Chỉ khi cả 5 đúng mà vẫn câm mới mở phương án hai: tự viết sketch (bản nháp cũ ở `legacy-sketch/`) |

## Bẫy đã gặp

1. **Đừng cho laptop nối vào Wi-Fi không có internet.** Wi-Fi của chính board DroneBridge
   (`DroneBridge for ESP32`) không có internet. Laptop chỉ có một card Wi-Fi, nên nối vào đó là
   mất internet, và phiên Claude Code hay agent khác bị cắt giữa chừng. Muốn cấu hình thì làm qua
   USB bằng `scripts\esp32\dronebridge-nvs.ps1`, như mục (b). Mobile Hotspot để băng 2,4 GHz.
   Laptop vẫn nối mạng 5 GHz cùng lúc được, đã thử trên card RZ616 ngày 12/10/2026.
2. **Log khởi động in mật khẩu Wi-Fi dạng chữ thường.** Dòng `Init of WiFi Client-Mode finished
   (SSID: … PASS: …)` lộ mật khẩu hotspot. `scripts\esp32\esp32_log.py` tự che; đọc bằng công cụ
   khác thì che trước khi in, dán hay lưu log, ví dụ `sed -E 's/(PASS: )[^)]*/\1[redacted]/'`.
   Dòng `DB_PARAM: wifi_pass` thì firmware đã tự che.
3. **Chỉ nạp ở 115200 baud** (mục a).
4. **Bấm BOOT đúng một lần** khi muốn trả board về AP mặc định. Nhấn 2 đến 4 lần là các lệnh ghép
   cặp ESP-NOW.
5. **IP do DHCP cấp, có thể đổi.** Đổi SSID hotspot sang `IOTCV-HOTSPOT` làm IP nhảy từ
   `192.168.137.9` sang `192.168.137.60`. Không cần biết IP của board: board tự đẩy gói về laptop;
   muốn mở web UI thì dùng tên `DroneBridgeESP32.mshome.net`.

## `legacy-sketch/` là gì

`legacy-sketch/mavlink_bridge.ino` là bản nháp 39 dòng từ kế hoạch cũ
(`docs/archive/plan-nhap-92-giai-doan.md`). Nó **không còn được dùng** — giữ lại để đối chiếu ý
định ban đầu và làm điểm xuất phát nếu phải mở phương án hai, không phải để nạp vào board.
