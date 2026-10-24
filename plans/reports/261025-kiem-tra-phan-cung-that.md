# Kiểm tra phần cứng thật sau lắp ráp, 25/10/2026

> Phiên kiểm do Claude chạy, người dùng làm phần tay (cắm pin, giữ BOOT, bấm tay phát, bấm Motor
> Test). Không cánh trong toàn bộ phiên. Mọi thay đổi tham số, ESC, tay phát đều được người dùng
> duyệt trước. Số liệu lấy từ log dataflash, MAVLink qua USB và qua Wi-Fi, không ước lượng.

## 1. Tóm tắt

| Mức | Việc |
|---|---|
| 🔴 Đã sửa | **RC failsafe chưa cài trên tay phát**: tắt FS-i6X thì receiver giữ giá trị cuối, FC không biết mất sóng. Đã cài và thử thật: tắt tay phát → CH3 = 911 µs → FC báo `Radio Failsafe` trong < 0,5 s; bật lại → `Radio Failsafe Cleared`. |
| 🔴 Đang xử lý | **Bay bằng pin 6S** trong khi motor AIR2216II KV920 định mức 4S, và ngưỡng failsafe pin trên FC vẫn đặt cho 4S. Nguyên nhân người dùng chuyển 6S là ESC M1 khựng khi khởi động trên 4S. Đã tìm ra gốc là cài đặt ESC OX32, đã đổi (mục 4). Chưa thử có cánh trên 4S. |
| 🔴 Đã sửa | **Web GCS không thấy drone thật qua Wi-Fi**: backend chốt nhầm sysid 0 vì cổng 14550 nhận heartbeat của GCS và của DroneBridge trước heartbeat của FC, rồi lọc bỏ mọi gói của FC. Đã sửa và thử khi rút USB (mục 5). |
| 🟠 Chưa sửa | **TFmini Plus sai cấu hình**: chỉ gửi 1 khung/giây, đơn vị mm → ArduPilot báo `Rangefinder 1: No Data`. Dây đúng, nguồn đúng. Cần chỉnh lại cảm biến (mục 6). |
| 🟠 Chưa sửa | **Wi-Fi mất 19–32% gói** theo từng đợt (mục 5), đủ làm dead-man 300 ms của chế độ lái từ web tự dừng drone. |
| 🟢 Đã sửa | **Độ cao lấy theo GPS** (`EK3_SRC1_POSZ = 3`): log có GPS dao động 1–27 m trong khi baro chỉ 0–7,5 m. Đây là đồ thị "fluctuated" người dùng thấy. Đã về baro (`= 1`, người dùng duyệt; đọc lại sau reboot = 1). |
| 🟡 Chưa sửa | Radio chưa hiệu chỉnh (RC1–8 vẫn 1100/1900 mặc định); la bàn đọc mạnh hơn mô hình WMM 11% và tăng theo dòng điện → nên hiệu chỉnh lại ngoài trời + compassmot. |
| 🟢 Đạt | FC, IMU, baro, GPS M10, la bàn IST8310, receiver iBUS 14 kênh, 4 ESC + telemetry, cầu Wi-Fi ESP32 hai chiều, camera ESP32-S3, Mission Planner qua UDP 14550. |

Không tìm thấy lỗi đấu dây nào. Hai chỗ trông giống lỗi dây nhưng không phải:
- GPS, la bàn, receiver, TFmini **không có điện khi chỉ cắm USB** vì lấy 5 V từ BEC chạy bằng pin.
- La bàn chỉ được dò lúc FC khởi động, nên cắm USB trước rồi mới cắm pin thì phải khởi động lại FC.

## 2. Kết quả từng phần

| Phần | Kết quả | Bằng chứng |
|---|---|---|
| FC SpeedyBee F405 V5 | Đạt | Banner `ArduCopter V4.7.1 (dbe79216)`, `speedybeef4v5`; gyro/accel/baro khoẻ; tải CPU 27–46%, 0 vòng lặp trễ |
| Baro | Đạt | 1007 hPa, khoẻ suốt các log |
| GPS Holybro M10 | Đạt | Nhận `u-blox SPG 5.10` ở 230400; log 24/10: 9–15 vệ tinh, HDOP 0,8–1,7, HAcc 0,8–2,7 m |
| La bàn IST8310 | Đạt, cần hiệu chỉnh lại | Khoẻ; \|B\| 486–568 mG so với WMM 456 mG; từ khuynh 25° so với 31°; log 1980: \|B\| tăng 450 → 514 mG khi dòng 0 → 12 A |
| Receiver iA6B (iBUS) | Đạt | 14 kênh, CH1–4 đủ 1000–2000; đẩy cần pitch lên → CH2 = 2000, `RC2_REVERSED = 1` đúng chiều |
| RC failsafe | **Đạt sau khi cài** | Xem mục 1 |
| ESC OX32 + 4 motor | Đạt khi không cánh | Motor Test 10% trên 4S: cả 4 motor bắt vòng quay 0,25–0,26 s, 1.703–1.757 vòng/phút, 0 sụt |
| Đo áp pin | Đạt | FC 16,70 V khi cắm 4S đầy (4,18 V/cell); telemetry ESC báo 1,6 (đơn vị 0,1 V của OX32) |
| ESP32 DroneBridge | Đạt | FC → ESP32 → Wi-Fi: HEARTBEAT; Wi-Fi → ESP32 → FC: lệnh `REQUEST_DATA_STREAM`, `REQUEST_MESSAGE` được FC thực hiện và trả lời |
| Camera ESP32-S3 | Đạt | `camera_check.py --frames 150` PASS: 150/150 khung sạch, VGA 6,8 fps, đổi quality giữa luồng đúng nhãn |
| Mission Planner | Đạt | Nối `UDP14550-1-QUADROTOR` qua Wi-Fi (lúc đó USB còn cắm) |
| Web GCS qua Wi-Fi | **Đạt sau khi sửa backend** | Rút USB: 160/160 mẫu telemetry, trễ 39–165 ms; nghiêng tay thì roll −49,6° → +46,6° đúng chiều; pin 16,36 V |
| TFmini Plus | **Sai cấu hình** | Byte thô từ RX3: `59 59 F6 09 …` checksum đúng, 1 khung/giây, khoảng cách 2550 |
| Bộ nhớ log | Đã sửa | `LOG_DISARMED = 1` làm đầy 16 MB, FC tự xoá log cũ; đã đặt 0 và xoá chip |

## 3. Log lịch sử bay

Bộ nhớ dataflash đầy nên chỉ còn 2 log; trong lúc kiểm, FC tự xoá thêm một log 7,8 MB để ghi log
phiên trên bàn. Log còn lại và log người dùng dán:

| Log | Thời điểm (giờ VN) | Pin | Chế độ | Ghi chú |
|---|---|---|---|---|
| `logs/fc-dataflash-20261025/001-*.bin` | 24/10 18:24 | 6S, 23,3–24,1 V | Stabilize | Treo 82 s, cao ≤ 2,8 m, rung 3–4 m/s², 0 clip |
| `1980-01-12 18-07-38.bin` (gốc repo) | 24/10 18:07 | 6S, 23,5–24,3 V | Loiter | Treo 155 s, cao ≤ 7,5 m (baro), GPS báo 1–27 m |

Tổng thời gian bay của FC từ khi nạp ArduPilot: 336 s (`STAT_FLTTIME`), 13 lần cất cánh.

## 4. Vụ pin 4S và motor M1

**Triệu chứng:** pin 4S → motor sau-phải (ESC M1) kêu "khậc khậc" khoảng 10 s rồi mới quay.

**Không phải do 4S thiếu lực.** Số liệu chính hãng T-Motor cho đúng bộ AIR2216II KV920 + T1045 ở
16 V: 1.332 g/motor. Drone ~1,9 kg với pin 4S, tức dư lực ~2,8 lần, treo ở ~50% ga. Thiết bị ngoài
stack (GPS, TFmini, 2 ESP32) tổng < 10 W, trên mạch nguồn riêng.

**Không phải motor hay dây hỏng.** Không cánh, M1 khởi động y hệt 3 motor kia. Log 6S: khi đã quay,
4 motor cùng tỉ lệ vòng quay theo ga (17,7–18,4 vòng/phút mỗi µs). Nhưng lúc arm, M1 luôn khởi động
chậm nhất (mất ~0,9 s trên 6S).

**Gốc:** ESC OX32 (firmware 1.13) để cài đặt cho motor đua: `Low RPM Power Protection = ON` (cắt
công suất ở vòng quay thấp) và `Rampup Power = 50%`. Tài liệu hãng ghi motor KV thấp + cánh lớn phải
chọn `On Adaptive` và tăng Rampup Power. Trên 4S, mô-men khởi động chỉ bằng ~2/3 so với 6S nên
kênh yếu nhất không bắt được nhịp.

**Đã đổi (người dùng duyệt "Mức 2"):**

| Mục | Cũ | Mới |
|---|---|---|
| `MOTOR_TIMING` | 15° | 20° |
| `DRIVER_DEMAG_COMPENSATION` | Low | High |
| `DRIVER_RAMP_POWER` | 50% | 80% |
| `PROTECTION_LOW_SPEED_POWER` | ON | On Adaptive |

Cách đổi: trình cấu hình `ox32.oxbot.com` **không vào được ESC qua passthrough của ArduPilot**
(`4-way communication protocol error`, 2 lần, có khởi động lại FC + ESC). Đã tạm nạp bản Betaflight
4.5.2 gốc (sao lưu 13/10) qua DFU, đổi cài đặt, rồi nạp lại ArduPilot `d450a747` và khôi phục toàn
bộ tham số. File cài đặt ESC trước/sau: `D:\IOT_Tools\downloads\speedybee-f405v5\ox32-esc-*.json`.

Khôi phục tham số: 865 dòng từ `khoi-phuc-20261025.param`, đọc lại sau 2 lần reboot. So với bản chụp
trước Betaflight chỉ lệch `SERVO_BLH_AUTO` (1 → 0, người dùng duyệt) và `MIS_TOTAL` (số mục mission).
Mọi giá trị hiệu chỉnh gia tốc kế, la bàn, trim khớp tuyệt đối.

**Lỗi của `scripts/fc/nap_param.py` (đã sửa):** script báo FAIL 11 dòng là phần tử Y/Z của tham
số vector (`COMPASS_OFS_Y`, `INS_ACCOFFS_Z`, `AHRS_TRIM_Y`…). Ghi phần tử X làm FC báo lại cả X, Y,
Z, nên lệnh ghi Y kế đó vớ phải gói `PARAM_VALUE` cũ còn trong hàng đợi. Bảng tham số đọc sau
reboot thì đúng hết. Đã sửa `kiem_sau_reboot` trong `scripts/sitl/run_param_load.py` (phần lõi
`nap_param.py` dùng): dòng nào lúc ghi bị chấm "khác giá trị" mà đọc lại sau reboot đúng thì chấm
lại là nhận. FC đổi giá trị thật sau reboot vẫn báo lỗi như cũ.

Cài đặt ESC trước/sau và cách đổi lại đã chép vào repo: `firmware/esc-ox32/`.

**Pin 6S:** trong 2 log còn lại, motor chỉ treo nhẹ (≤ 7.500 vòng/phút, ESC ≤ 62 °C, ~70 W/motor
so với 272 W định mức) nên chưa thấy dấu hiệu quá tải. Nhưng ở ga cao, 6S cho motor ~3 lần công suất
định mức và cánh vượt giới hạn 1,2 kg. Ngưỡng `BATT_LOW_VOLT 14,0 / BATT_CRT_VOLT 13,2` là cho 4S nên
failsafe pin vô tác dụng khi bay 6S.

## 5. Web GCS với drone thật qua Wi-Fi

**Lỗi backend (đã sửa):** cổng UDP 14550 nhận ba loại heartbeat: GCS (255,0) và chính DroneBridge
(255,68), cả hai `autopilot = INVALID`, rồi mới tới FC (1,1). `connect()` lấy sysid của gói đầu tiên
nên chốt 0, sau đó lọc bỏ mọi gói của FC. SITL không lộ lỗi này vì chỉ có FC phát heartbeat. Đã sửa
`backend/mavlink/connection.py` chỉ nhận heartbeat có `autopilot` hợp lệ, test mới
`backend/tests/test_connection.py`. Thử lại khi đã rút USB: xem dòng "Web GCS qua Wi-Fi" ở mục 2.

**Wi-Fi mất 19–32% gói**, từ hai nguồn: rớt sóng ~3 s mỗi lần laptop quét Wi-Fi, và lỗ nhỏ 5–7 gói
lặp lại đều do một radio của laptop vừa nối mạng vừa phát hotspot. Mức này đủ để dead-man 300 ms
của chế độ lái từ web tự dừng drone. Cách thử: card Wi-Fi USB riêng cho hotspot, hoặc một router
riêng.

## 6. Việc còn lại

| # | Việc | Ai làm | Ghi chú |
|---|---|---|---|
| 1 | Thử 4S **có cánh**, ngoài trời: arm và xem M1 khởi động | Người dùng bấm, Claude đọc log | `LOG_DISARMED = 0` nên log bắt đầu từ lúc arm |
| 2 | Chỉnh TFmini về mặc định (`5A 04 10 6E`, `5A 04 11 6F`) | Người dùng nối dây, Claude gửi lệnh | Dây trắng RX chưa hàn: hàn vào T3 như hướng dẫn E7 mới, hoặc nối tạm vào TXD của mạch USB-TTL |
| 3 | Hiệu chỉnh radio | Người dùng gạt cần, Claude chạy wizard | RC1–8 vẫn mặc định |
| 4 | Hiệu chỉnh la bàn ngoài trời + compassmot | Người dùng xoay drone | Kiểm `COMPASS_ORIENT = 6` theo hướng gắn GPS thật |
| 5 | Quyết định 4S hay 6S lâu dài | Người dùng | 6S thì phải đặt ngưỡng pin 6S và giới hạn `MOT_SPIN_MAX` |
| 6 | Xử lý Wi-Fi mất gói | Người dùng chọn cách | Trước khi lái từ web (Phase 21) |
| 7 | Theo dõi nhiệt ESC M2 | Claude đọc log | Nóng hơn 3 ESC kia 5–8 °C khi chạy không cánh |

Đã xong trong phiên: `EK3_SRC1_POSZ` 3 → 1; hướng dẫn lắp ráp bước E7 đổi sang hàn dây trắng
TFmini vào T3; báo đỏ giả của `nap_param.py`; lỗi chốt sysid của backend.

Tham số lệch tài liệu nhưng tương đương, không cần sửa: `FRAME_TYPE = 1` + `SERVO1..4_FUNCTION =
36/33/34/35` cho cùng thứ tự motor như `FRAME_TYPE = 12` trong `01-base.param`.

## 7. File

- Log: `logs/fc-dataflash-20261025/` (gitignored).
- Bản chụp tham số: `D:\IOT_Tools\downloads\speedybee-f405v5\snapshot-20261025-*.param`; file khôi
  phục: `khoi-phuc-20261025.param`.
- Cài đặt ESC: `firmware/esc-ox32/` (bản gốc cùng nằm ở thư mục ổ D trên).
