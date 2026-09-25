# Kết quả nạp param của dự án vào SITL

Ngày thử: **25/09/2026** · Bản SITL: **ArduCopter 4.7.1** build từ nguồn (Phase 02)
· Sinh bởi `scripts/sitl/run_param_load.py` (việc 04.1–04.3) và
`scripts/sitl/run_avoid_brake.py` (việc 04.4–04.5), cả hai **PASS** trên SITL thật.

> ⚠️ **Không file nào trong thư mục này được nạp lên board thật.** Snapshot SITL
> có các param `SIM_*` và cổng serial đã đi dây lại cho mô phỏng (xem mục cuối).
> Param của board thật nằm ở `firmware/ardupilot/params/`, do Phase 11 sở hữu.

| File | Là gì |
|---|---|
| `00-sitl-default.param` | Snapshot gốc: SITL với EEPROM trắng (`-w`), **1370** param |
| `01-base-draft.param` | Bản nháp base, chép nguyên văn báo cáo §4.6 — vì `01-base.param` (Phase 11) chưa có |
| `01-sitl-base-loaded.param` | Snapshot sau khi nạp bản nháp base và reboot |
| `02-sitl-avoid.param` | Snapshot của cấu hình **đã thấy AVOID phanh**: nguyên file avoid của dự án + TFmini ảo trên SERIAL3 |

## Bảng 9 dòng — quan sát thật, không chép đoán

"Nhận" nghĩa là: tên có trong bảng param của FC, FC xác nhận đúng giá trị lúc
nạp, **và** đọc lại đúng giá trị đó sau reboot.

| Param | File nguồn | SITL nhận? | Ghi chú |
|---|---|---|---|
| `FRAME_CLASS` | base | nhận | 1 = Quad |
| `SERIAL3_PROTOCOL` | base | nhận | 9 = Rangefinder. ⚠️ Trên SITL cổng này mặc định là **GPS ảo**, xem mục cuối |
| `GPS1_TYPE` | base | nhận | tên cũ `GPS_TYPE`, đổi từ 4.6. Mặc định SITL là 1 (auto), dự án 2 (uBlox) |
| `MOT_PWM_TYPE` | base | nhận | 5 = DShot300 |
| `BATT_VOLT_MULT` | base | nhận | 11.0. ⚠️ Số đọc pin lệch theo hệ số này, xem mục "Pin" |
| `RNGFND1_TYPE` | avoid | nhận | 20 = Benewake TFmini Plus UART |
| `PRX1_TYPE` | avoid | nhận | 4 = lấy rangefinder làm nguồn proximity |
| `AVOID_ENABLE` | avoid | nhận | 3 = fence + proximity |
| `OA_TYPE` | avoid | nhận | 0 = tắt, cố ý |

Toàn bộ **51 dòng** của hai file (34 base + 17 avoid) đã được kiểm từng dòng;
44 dòng "nhận" ngay, 7 dòng còn lại liệt kê ở hai mục dưới.

## Param SITL từ chối

| Param | File | Thông báo (nguyên văn runner) | Ý nghĩa |
|---|---|---|---|
| `SERVO_BLH_POLES` | base | `TỪ CHỐI — không tồn tại` | Nhóm `SERVO_BLH_*` chỉ biên dịch khi `HAL_SUPPORT_RCOUT_SERIAL = 1`. Board ChibiOS (F405) bật (`libraries/AP_HAL/board/chibios.h:113`), SITL tắt (`AP_HAL_Boards.h:270`). **SITL thiếu, không phải dự án ghi sai** |
| `SERVO_BLH_TRATE` | base | `TỪ CHỐI — không tồn tại` | Như trên |
| `AVOID_ANG_MAX` | avoid | `TỪ CHỐI — không tồn tại` | Nằm trong `#if AP_AVOIDANCE_ALTHOLD_ENABLED`, mà cờ này **mặc định 0 cho MỌI bản build** (`AC_Avoidance_config.h:31`). Đây là tránh vật cản ở mode **không GPS (AltHold)**. Rất có thể board thật cũng không có |

ArduPilot **không báo lỗi** khi nhận `PARAM_SET` một tên không tồn tại, nó chỉ
im lặng. Runner phân loại bằng cách tra tên trong bảng `param fetch` đầy đủ.

## Param nhận, nhưng KHÔNG như file ghi

| Param | File | Quan sát | Ý nghĩa |
|---|---|---|---|
| `RNGFND1_ORIENT` · `RNGFND1_MIN` · `RNGFND1_MAX` | avoid | Lần nạp đầu **không tồn tại**; xuất hiện sau khi `RNGFND1_TYPE 20` đã đặt **và** reboot; nạp lần hai thì nhận | Mission Planner sẽ báo "not found" ở lần nạp đầu trên board thật. **Không phải firmware thiếu tính năng.** Nạp → reboot → nạp lại |
| `SERIAL5_BAUD` | base | Nạp 19 → FC xác nhận 19 → **sau reboot đọc lại 115** | `AP_SerialManager.cpp:516` ép cứng 115200 cho mọi cổng ESC telemetry (`SERIALn_PROTOCOL 16`) lúc khởi động. Chú thích "19200 là mặc định board" trong bản nháp là sai; dòng này vô tác dụng **trên cả board thật**. Phase 11 nên bỏ nó |

## Bộ param dự án có cho drone bay không

Nạp đủ base + avoid rồi thử arm trên SITL:

1. **Nguyên bản: không arm được.** `PreArm: RC not found`. RC ảo của SITL đi qua
   giao thức "SITL UDP" (bit 18 của `RC_PROTOCOLS`); base đặt `RC_PROTOCOLS 4`
   (chỉ iBUS) là tắt luôn nó. **Trên board thật `4` là đúng** — receiver iA6B
   nói iBUS.
2. **Bù đúng một bit (`RC_PROTOCOLS = 4 + 2^18 = 262148`): arm và cất cánh 5 m
   được**, log có `RCInput: decoding UDP (Pulses)`, vẫn GUIDED sau 20 s. Tức là
   nguyên nhân đã được chứng minh, không phải đoán.

### Pin

Đặt pin ảo `SIM_BATT_VOLTAGE 16.8` (4S đầy), FC đọc **18,3 V** = 16,8 × 11,0 / 10,1.
SITL xuất điện áp ra chân analog theo hệ số chia của riêng nó (10,1); dự án đặt
`BATT_VOLT_MULT 11.0` nên số đọc lệch đúng theo tỷ lệ đó. Trên board thật cũng
vậy: hệ số sai là số volt sai, và failsafe pin chạy theo số sai. Phải hiệu chỉnh
bằng đồng hồ vạn năng (báo cáo §4.5).

## Tránh vật cản với TFmini Plus ảo — đã thấy phanh

Nạp **nguyên** `obstacle-avoidance-tfminiplus-serial3.param`, gắn TFmini ảo vào
SERIAL3, bay LOITER và giữ `rc 2 1300` về phía một cột ảo suốt 40 s:

| | Đối chứng (`AVOID_ENABLE 0`) | File avoid của dự án |
|---|---|---|
| Vượt qua cột? | **Có**, xuyên qua ở ~4 m/s sau 10,75 s | **Không**, suốt 40 s giữ cần |
| Gần bề mặt cột nhất | −0,82 / −0,83 m (đi vào trong cột) | **1,01–1,12 m** |
| 20 s cuối | — | dao động trong **1,35–3,18 m**, chu kỳ ~4 s |
| TFmini ảo lệch so với khoảng cách tính từ GPS | 1,61–1,64 m (12 mẫu, đang lao 4 m/s) | 0,28–0,36 m (133–934 mẫu) |

Khoảng giá trị qua 4 lần bay ngày 25/09/2026 (đối chứng: 2 lần). Chạy lại: `bash scripts/sitl/run-all.sh --chi run_avoid_brake`.

Đồ thị: `docs/so-tay/anh/04-avoid-phanh.png`. Ảnh chụp Mission Planner lúc drone bị chặn:
`docs/so-tay/anh/04-mp-avoid-phanh.png`. Diễn giải: sổ tay 04, mục 9.

Lưu ý khi nhìn Mission Planner: ô **Sonar Range luôn 0** với TFmini nhìn thẳng trước.
ArduPilot chỉ gửi gói `RANGEFINDER` cho rangefinder nhìn xuống (`GCS_Common.cpp`,
`find_instance(ROTATION_PITCH_270)`). Không phải cảm biến hỏng.

## Kiểm lại ở Phase 14

Sau khi nạp firmware custom lên board thật, mở Full Parameter List và kiểm:

- [ ] `SERVO_BLH_POLES`, `SERVO_BLH_TRATE` — **phải có** (ChibiOS bật BLHeli). Không có → custom build thiếu BLHeli, mất RPM telemetry.
- [ ] `AVOID_ANG_MAX` — nhiều khả năng **không có**. Nếu không có: tránh vật cản ở **AltHold không chạy**, chỉ LOITER/PosHold. Ghi lại, đừng build lại chỉ vì nó.
- [ ] `PRX1_TYPE` — **phải có**. SITL nhận vì SITL bật gần như mọi thứ; board F405 thì chỉ có nếu custom build bật proximity.
- [ ] `RNGFND1_ORIENT/MIN/MAX` — "not found" ở lần nạp đầu là bình thường. Nạp → reboot → nạp lại.
- [ ] `SERIAL5_BAUD` — đọc lại sẽ là 115 dù file ghi 19. Đó là đúng.

Nếu board thật thiếu một feature bắt buộc (`PRX1_TYPE`, `RNGFND1_TYPE 20`) → build lại tại
custom.ardupilot.org bằng `firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml`.

## SITL phải được "đi dây" giống board, nếu không bộ param tự làm hỏng mô phỏng

Đo thật: nạp base rồi reboot mà không làm gì thêm thì SITL **không bao giờ sẵn
sàng**: `GPS fix=0 sats=0`, `EKF3 waiting for GPS config data`,
`PreArm: Battery 1 low voltage failsafe`.

| Thay đổi chỉ cho SITL | Vì sao |
|---|---|
| `-A "--serial3=sim:benewake_tfmini --serial4=GPS1"` | GPS ảo của SITL nằm **cứng** ở SERIAL3 (`libraries/AP_HAL_SITL/SITL_State.h`). Dự án dùng SERIAL3 cho TFmini, SERIAL4 cho GPS. **Một** cờ `-A`: lặp cờ thì cờ sau đè cờ trước |
| `SIM_SONAR_ROT 0` | Rangefinder ảo mặc định nhìn **xuống**; TFmini dự án nhìn **thẳng trước** (`RNGFND1_ORIENT 0`) |
| `SIM_BATT_VOLTAGE 16.8` | Pin ảo mặc định 12,6 V (3S) < `BATT_LOW_VOLT 14.0` của pin 4S |
| `RC_PROTOCOLS 262148` (chỉ khi thử bay) | Xem mục "Bộ param dự án có cho drone bay không" |
