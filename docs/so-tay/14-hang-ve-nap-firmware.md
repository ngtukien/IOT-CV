# Sổ tay 14-hang-ve-nap-firmware

Trang này ghi lại lần nạp ArduPilot đầu tiên lên bo bay thật, ngày **13/10/2026**. Mọi con số
dưới đây là số đo thật, in ra bởi bốn script trong `scripts/fc/`. Cả quá trình không bấm nút
BOOT và không rút cáp lần nào: người vận hành chỉ cắm cáp USB và cầm bo nghiêng khi được nhắc.

Phần **kiểm hàng** (14.1) mới xong ba bo điện tử: FC, ESP32 CP2102 và bo camera ESP32-S3 + OV3660
(mục 8). Motor, chiều ren, pin, phụ kiện là việc tay, còn lại — phiếu điền kết quả ở mục 6.

## 1. Kết quả

| Mục | Kết quả |
|---|---|
| Bo trước khi nạp | Betaflight 4.5.2, đọc qua MSP: target `STM32F405`, bo `SPEEDYBEEF405V5`, hãng `SPBE` |
| Khoá đọc chip | RDP `0xAA` (Level 0, không khoá) |
| Sao lưu firmware gốc | `D:\IOT_Tools\downloads\speedybee-f405v5\factory-betaflight-4.5.2.bin`, đúng 1.048.576 byte, đọc mất 7,2 s |
| File đã nạp | `firmware/ardupilot/build-d450a747/arducopter_with_bl.hex`, 789,8 KB |
| Nạp | xoá sector 0–10, ghi 32,6 s, đọc lại so sánh 5,6 s: `Download verified successfully` |
| Banner | `ArduCopter V4.7.1 (dbe79216)` + `speedybeef4v5 0020001A 34344713 36333338` |
| Tham số bản custom | có đủ `PRX1_TYPE`, `RNGFND1_TYPE`, `AVOID_ENABLE`, `AVOID_ANG_MAX`, `SERVO_BLH_POLES` |
| Cảm biến | gyro, accel, baro đều có và khoẻ (SYS_STATUS) |
| Baro | `press_abs` 1012,6 hPa — driver SPL06 đọc được chip SPA06 của bo |
| Hướng gyro | chúc mũi tên xuống: pitch tới −68°; hạ cạnh phải: roll tới +53° — **đúng dấu** |
| Snapshot sau nạp | `firmware/ardupilot/params/00-after-flash.param`, 850 tham số |
| Nạp `01-base.param` | **34/34 dòng nhận**, đọc lại đúng sau 1 lần reboot; số tham số 850 → 861 |
| Tham số bị từ chối | **không có** (SITL từ chối 2 dòng: `SERVO_BLH_POLES`, `SERVO_BLH_TRATE`) |
| Mission Planner 1.3.83 | CONNECT `COM6` 115200 được, nút đổi thành DISCONNECT, HUD báo `DISARMED` |

**Cổng COM trên máy dự án:** bo chạy Betaflight là **COM5** (USB `0483:5740`); chạy ArduPilot là
**COM6** (USB `1209:5741`). ESP32 DroneBridge là COM4 (USB `10C4`, chip CP2102) — không lẫn được với
bo bay. Số COM có thể đổi khi cắm sang cổng USB khác.

## 2. Đã làm thế nào

```powershell
uv run --with pyserial python scripts/fc/nap_dfu.py
uv run --with pyserial python scripts/fc/kiem_fc.py COM6 --nghieng 60 `
  --luu-param firmware/ardupilot/params/00-after-flash.param
uv run --with pyserial python scripts/fc/nap_param.py COM6 firmware/ardupilot/params/01-base.param
```

`nap_dfu.py` làm 14.3 → 14.4:

1. Hỏi tên bo qua **MSP** (giao thức của Betaflight). Bo trả lời không phải `SPEEDYBEEF405V5` thì
   script từ chối, không động vào.
2. Gửi lệnh `MSP_REBOOT` kiểu "bootloader ROM" — đúng lệnh Betaflight Configurator dùng khi nạp
   firmware. Bo khởi động lại thẳng vào DFU, Windows hiện `STM32  BOOTLOADER`. Đây là thứ thay cho
   việc giữ nút BOOT trong lúc cắm cáp.
3. `STM32_Programmer_CLI -ob displ`: đọc RDP. Khác `0xAA` là chip bị khoá đọc, script dừng.
4. `-u 0x08000000 0x100000`: đọc cả 1 MB flash ra ổ D, một lần duy nhất.
5. `-w arducopter_with_bl.hex -v`: ghi rồi đọc lại so từng byte.
6. `-s 0x08000000`: ra lệnh chạy chương trình — thay cho rút cáp cắm lại.
7. Đợi cổng USB `1209:5741` xuất hiện và đứng yên 8 giây.

`kiem_fc.py` làm 14.5 → 14.6 và `nap_param.py` làm 14.7. Cả hai đọc qua MAVLink, không gửi lệnh ARM
hay lệnh motor nào. `nap_param.py` khởi động lại bo bằng lệnh MAVLink, không cần rút cáp.

## 3. Tham số: mặc định của bo so với `01-base`

So `00-after-flash.param` với bản chụp sau khi nạp `01-base` (bản sau để ở
`D:\IOT_Tools\downloads\speedybee-f405v5\01-base-loaded-20261013.param`):

| Tham số | Mặc định của bo | Sau `01-base` | Ghi chú |
|---|---|---|---|
| `FRAME_CLASS` | 0 | 1 | 0 = chưa chọn khung |
| `FRAME_TYPE` | **12** | 12 | hwdef đặt sẵn 12 — khớp quyết định 12/10/2026 |
| `SERIAL2_PROTOCOL` / `_BAUD` | -1 / 57 | 2 / 115 | ESP32 DroneBridge, MAVLink2 115200 |
| `SERIAL3_PROTOCOL` / `_BAUD` | 42 / 230 | 9 / 115 | 42 = DisplayPort; 9 = rangefinder (TFmini Plus) |
| `SERIAL4_BAUD` | 230400 | 230 | cùng một tốc độ: 230 là cách viết tắt của 230400 |
| `RC_PROTOCOLS` | 1 | 4 | 1 = mọi giao thức; 4 = chỉ iBUS |
| `GPS1_TYPE` | 1 | 2 | 1 = tự dò; 2 = u-blox |
| `MOT_PWM_TYPE` | 0 | 5 | 0 = PWM thường; 5 = DShot300 |
| `BATT_AMP_PERVLT` / `_OFFSET` | 25 / 0 | 370,4 / 0,0071 | hệ số của ESC OX32 |
| `BATT_CAPACITY` | 3300 | 5300 | pin Ovonic 4S 5300 mAh |
| `BATT_LOW_VOLT` / `CRT_VOLT` | 10,5 / 0 | 14 / 13,2 | ngưỡng cho pin 4S |
| `LOG_BITMASK` / `LOG_DISARMED` | 180222 / 0 | 176126 / 1 | |

Firmware **tự đổi** thêm vài tham số khi khởi động lại với `FRAME_CLASS 1` và DShot — không ai nạp
chúng: `SERVO1..4_FUNCTION` 0 → 33, 34, 35, 36 (motor 1–4), `SERVO1..4_MIN/MAX/TRIM` thành
1000/2000/1000, `BRD_SAFETY_MASK` 16383 → 16368. 11 tham số `MAV2_*` (tuỳ chọn và tốc độ luồng của
kênh MAVLink thứ hai, ở đây là SERIAL2) mới xuất hiện vì SERIAL2 vừa được bật MAVLink. `INS_GYROFFS_*`, `BARO1_GND_PRESS` và
`STAT_*` đổi mỗi lần khởi động — đó là hiệu chỉnh gyro, áp suất mặt đất và bộ đếm, không phải lỗi.

## 4. Điều đáng nhớ

- **FC vừa khởi động thì chưa trả lời tải tham số.** Khoảng 1–3 giây đầu, HEARTBEAT báo
  `MAV_STATE_BOOT`, và ArduPilot bỏ im lặng yêu cầu tải bảng tham số. Đo trên SITL ngày 13/10/2026:
  xin bảng ngay sau HEARTBEAT đầu tiên thì nhận 0 tham số trong 90 giây. Script giờ đợi hết BOOT
  rồi mới đọc.
- **Bootloader ArduPilot và firmware dùng chung mã USB `1209:5741`.** Ngay sau khi nạp, cổng COM6 có
  thể hiện ra vài giây (bootloader), biến mất, rồi hiện lại (firmware). Script nối lại trong tối đa
  60 giây.
- **Khi chỉ cắm USB, HUD báo dòng hơn 100 A và điện áp pin vô nghĩa** — ảnh HUD lúc 16:49:
  `Bat1 0.24v 133.7 A 0%`. Đó là số rác, không phải lỗi: FC đang đứng một mình, chân đo dòng và đo
  áp (đi sang ESC qua cáp 8 chân) đang hở. `0%` vì FC cộng dồn dòng ảo đó: chừng 2–3 phút là "tiêu"
  hết 5300 mAh. Bộ đếm về 0 mỗi lần khởi động. Kiểm lại hai con số này ở Phase 16, khi đã nối ESC
  và cắm pin.
- Cảnh báo `PreArm: Battery 1 low voltage failsafe`, "No GPS", "Not Ready to Arm" là bình thường ở
  phase này — chưa nối pin, GPS hay RC.

## 5. Giải thích ngắn

- **DFU** là chế độ nạp nằm sẵn trong ROM của chip STM32, có trước mọi firmware. Lần nạp đầu phải
  qua DFU vì bo chưa có bootloader ArduPilot.
- **`_with_bl.hex` khác `.apj`:** `.hex` ghi cả bootloader lẫn firmware từ địa chỉ `0x08000000`, chỉ
  dùng qua DFU. `.apj` chỉ chứa firmware, nạp qua bootloader ArduPilot đã có trên bo.
- **Mission Planner không nhận bo đang chạy Betaflight**, vì Betaflight nói MSP chứ không nói MAVLink.
- **Snapshot** là ảnh chụp toàn bộ bảng tham số tại một lúc. Lưu `00-after-flash` **trước** khi đổi
  bất cứ thứ gì, để luôn có đường quay về trạng thái gốc.
- **`PRX1_TYPE` có mặt = đúng bản custom build.** Bản ArduPilot stock cho bo F405 (chỉ 1 MB flash)
  không có nhóm proximity; bản `d450a747` bật thêm nó cùng năm tính năng khác
  (`firmware/ardupilot/build-d450a747/NOTES.md`). Thiếu nó thì `02-avoid-tfmini.param` báo
  "parameter not found" và phần tránh vật cản không chạy.
- **"Activation required"** in trên phiếu trong hộp chỉ áp dụng cho app SpeedyBee qua Bluetooth. Nạp
  qua DFU ghi đè Betaflight nên không cần kích hoạt — lần này đúng như vậy.
- **Ba jumper trên bo:** SBUS để hở (đúng cho iBUS), "BARO →" đã nối thiếc từ nhà máy, 9V để hở. Để
  nguyên cả ba. Baro đọc 1012,6 hPa là bằng chứng jumper baro đang đúng.
- **Chiều ren motor.** Cánh T1045 vặn thẳng lên trục ren của motor. Khi motor tăng tốc và khi cánh
  cắt gió, cánh luôn có xu hướng trễ lại so với trục, tức là xoay ngược chiều quay; ren được chọn để
  chính xu hướng đó vặn cánh **chặt** thêm. Quad cần 2 motor quay thuận và 2 quay nghịch (để mô-men
  xoắn triệt tiêu, drone không tự xoay tròn), nên bộ motor phải có 2 ren phải + 2 ren trái. Lắp sai
  thì cánh tự nới dần và văng ra khi đang bay. Ghép ren nào vào vị trí nào: Phase 18.3.
- **Điện áp storage của pin LiPo.** Pin mới xuất xưởng ở mức "storage" 3,80–3,85 V/cell — mức pin
  lão hoá chậm nhất. Sạc đầy là 4,20 V/cell. Để pin đầy nhiều ngày làm pin phồng và mất dung lượng
  nhanh, nên chỉ sạc đầy **ngay trước** buổi bay; không bay thì đưa về storage (chế độ `Storage` của
  B6AC). Các cell lệch nhau là dấu hiệu sớm của một cell yếu.

## 6. Kiểm hàng (14.1) — phiếu điền kết quả

Tờ 1 in sẵn thuộc Phase 13 (`13-checklist-in-ra.md`), phase đó chưa làm; phiếu này thay nó, gom từ
plan 14.1. Kiểm xong món nào thì điền cột "Kết quả" (hoặc đọc kết quả cho Claude ghi). Món lỗi: ghi
lỗi gì và đã báo shop chưa — đây là lúc còn đổi trả được.

| Món | Kiểm gì | Kết quả |
|---|---|---|
| Ảnh hàng | Chụp mọi món, món nào còn hộp thì chụp cả hộp → `logs/kiem-hang/` | Đã có: FC 8 ảnh, ESP32 CP2102 3 ảnh, ESP32-S3 2 ảnh + 5 ảnh shop (`picture/`). Còn các món khác |
| Đủ món | Đối chiếu bảng `docs/phan-cung-thuc-te.md` (danh sách mua `13-mua-sam.md` chưa có) | |
| 4 motor AIR2216II | Trục thẳng, xoay tay êm, bạc đạn không lạo xạo, 3 dây không tróc, nam châm không cạ | |
| Chiều ren motor | **2 ren phải + 2 ren trái.** Vặn tay một cánh T1045 lên trục từng motor như Phase 18.3 bước 1–3 (motor chưa nối gì, không cần điện): vào ngọt ở 2 motor, không vào ở 2 motor kia. Phải dùng lực là sai cặp, dừng. Cả 4 cùng một chiều → đổi hàng ngay | |
| ESC OX32 | Không cháy, không phồng tụ, không biến dạng | |
| Phụ kiện stack | Theo `v5_29.jpg` (Deluxe): 2 cáp 10 chân (25 và 75 mm); **1** tụ 1000 µF 35 V + 2 gen; 5 ốc nylon + 5 đệm + 10 vỏ silicone; 4 ốc M3×30 + dây XT60; dây GPS 6 chân, 6→4 chân, dây receiver 4 chân; smoke stopper, 4 bảng chia nguồn, bảng tập hàn, nối dài USB-C, còi | |
| Bo FC F405 V5 | Không cháy, không phồng tụ; jumper SBUS hở, "BARO →" nối sẵn, tem QR còn | **Đạt** — soi ảnh 12/10, nạp và kiểm đủ 13/10 |
| GPS Holybro M10 | Anten gốm không vỡ; cột nâng đủ ống + 2 đế + ốc | |
| Receiver iA6B | Còn bind plug (jumper nhựa nhỏ) | |
| Pin Ovonic 4S 5300 | `Battery Meter` của B6AC đo **từng cell**: mỗi cell 3,80–3,85 V, tổng 15,2–15,4 V, cao trừ thấp < 0,05 V; không phồng, rách vỏ, dây lỏng | |
| ESP32 CP2102 | Lên cổng COM, nạp được | **Đạt** — nạp DroneBridge 2.4.1 ngày 12/10 |
| ESP32-S3 N16R8 + OV3660 | Chip, flash 16 MB, PSRAM 8 MB, camera ra ảnh | **Đạt** 13/10 — PSRAM 8 MB, flash 16 MB, OV3660 ra ảnh (mục 8) |
| Món còn lại | Khung S500, TFmini Plus, FS-i6X, UBEC 5V 3A, USB-TTL CP2102, sạc B6AC: còn nguyên, không vỡ | |

Đo cell là cắm dây cân bằng của pin vào **sạc**, không phải vào bo — luật "chưa cắm pin vào bo" vẫn
giữ tới Phase 16.

`00-after-flash.param` và các script đã vào `main` qua PR #44.

## 7. Cho lần sau

1. **Không cần DFU nữa.** Bo đã có bootloader ArduPilot. Firmware mới thì nạp file `.apj` (Mission
   Planner → Setup → Install Firmware → Load custom firmware). Bo hỏng nặng thì `nap_dfu.py` vẫn
   dùng được: giữ BOOT khi cắm để vào DFU rồi chạy lại.
2. **Số COM có thể đổi** khi cắm sang cổng USB khác. Không hoảng: script dò lại theo mã USB.
3. **Trước mỗi lần nạp firmware mới, lưu snapshot tham số trước** (`kiem_fc.py COMx --luu-param ...`).
   Nạp firmware có thể xoá hết tham số.
4. **Quay về Betaflight gốc:** nạp `factory-betaflight-4.5.2.bin` qua DFU bằng
   `STM32_Programmer_CLI -c port=USB1 -w <file> 0x08000000 -v`.

## 8. Bo camera ESP32-S3 N16R8 + OV3660 — kiểm 13/10/2026

Cấp điện lần đầu ngày 13/10/2026. Ảnh bo và 5 ảnh của shop (Phúc Minh Tech):
`picture/esp32-s3-n16r8-ov3660/`. Log và khung ảnh thử: `logs/kiem-hang/esp32s3-*` (không lên git —
khung ảnh có mặt người).

| Mục | Kết quả |
|---|---|
| Cổng USB | Hai cổng USB-C, nhãn in ở **mặt dưới**: `USB-UART` (chip CH343P, `1A86:55D3`, Windows tự nhận, lên **COM7**) và `USB-OTG` (USB gốc của chip). Nạp và đọc log qua USB-UART: có mạch tự reset, không bấm BOOT |
| Chip | ESP32-S3 (QFN56) revision v0.2, 2 nhân 240 MHz, MAC `68:ee:8f:4d:06:e4` |
| PSRAM | `esptool` báo Embedded PSRAM 8MB; chạy thật ở chế độ octal: 8.386.279 byte |
| Flash | 16 MB, hãng Boya (`0x68`, mã `0x4018`) — module bên thứ ba ghi "ESP32-S3-N16R8", không phải WROOM-1 của Espressif. Không phải lỗi |
| Firmware gốc | Bản QC của shop (Arduino core 3.3.11): in `PSRAM_STAGE_PASS`, camera chờ lệnh QC nên không tự bật |
| Sao lưu | Cả 16 MB ở `D:\IOT_Tools\downloads\esp32-backup\esp32s3-68ee8f4d06e4-20261013.bin`, SHA-256 `AC744928…D147E5`; `esptool` so MD5 khớp |
| Bảng chân camera | Mặt trên gạch chân (dấu "camera") đúng 14 chân {4–13, 15–18} = bảng `CAMERA_MODEL_ESP32S3_EYE`. Vạch dưới chân 13 không đọc được trên ảnh — khung ảnh thật bù chỗ đó, vì sai PCLK thì không ra khung |
| Camera | `esp_camera_init` OK, **PID `0x3660` (OV3660)**, khung VGA 640×480 JPEG 12.446 byte, đầu/đuôi hợp lệ, ảnh thật (trần nhà, đèn, người) và đúng chiều với `set_vflip(1)` |
| Tem bảo hành | "KHÔNG ĐƯỢC XÉ" dán cạnh nút BOOT — đừng bóc, giữ quyền đổi trả |

Trên bo giờ là đoạn mã dò (`D:\DevCache\tmp\esp32s3-camera-probe\`, ngoài repo), không còn firmware
của shop. Phase 12 nạp firmware camera thật đè lên. Muốn trả nguyên trạng cho shop:
`esptool --port COM7 write-flash 0 <file sao lưu ở trên>`.

Cho Phase 12: bo có cổng USB-UART, nên `Serial` (UART0) hiện thẳng trên cổng đó — **không cần**
`-DARDUINO_USB_CDC_ON_BOOT=1` (cờ đó chỉ cần khi bo chỉ có cổng USB gốc). Theo dấu in trên bo, khe
thẻ microSD dùng chân 38/39/40 (`~`) và PSRAM giữ 35/36/37 (`*`) — đừng gán các chân đó việc khác.

**Bẫy khi tự viết script đọc cổng:** trên Windows, driver `usbser.sys` (CH343P chạy chế độ CDC) chỉ
gửi trạng thái chân RTS xuống chip khi chân DTR cũng được đặt lại. Đổi RTS một mình thì lệnh reset
không tới bo và log rỗng — trông như bo chết. `esptool` có sẵn mẹo này; với pyserial thì sau mỗi lần
đổi `ser.rts` phải gán lại `ser.dtr = ser.dtr`.
