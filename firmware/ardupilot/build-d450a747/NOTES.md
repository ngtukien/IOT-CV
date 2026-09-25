# Bản custom build d450a747

| | |
|---|---|
| Giải nén | 21/09/2026 (Phase 01) · đối chiếu lại 25/09/2026 (Phase 11) |
| Nguồn | `copter-speedybeef4v5-d450a747.tar.gz` ở gốc repo (có sẵn từ đầu, bị `.gitignore`) |
| Board | `speedybeef4v5` (SpeedyBee F405 V5) |
| Phiên bản | ArduCopter **4.7.1 stable**, git `dbe792162d06cab66c3475fd5556bf7a120f119e` |
| Dùng cho | Phase 14 — nạp DFU lần đầu bằng `arducopter_with_bl.hex` |

## Bảy file trong thư mục

| File | Cỡ (byte) | Commit? | Dùng để |
|---|---:|---|---|
| `arducopter_with_bl.hex` | 2.224.308 | không | **Lần nạp DFU đầu tiên** (Phase 14): ghi cả bootloader lẫn firmware |
| `arducopter.apj` | 700.098 | không | Các lần update **sau này** qua Mission Planner (đã có bootloader) |
| `arducopter.bin` | 759.604 | không | Ảnh firmware thô, không cần dùng trực tiếp |
| `arducopter` | 1.408.704 | không | File ELF có ký hiệu gỡ lỗi, không nạp |
| `build.log` | 116.210 | **có** | Bằng chứng feature đã bật + kết quả biên dịch |
| `extra_hwdef.dat` | 28.872 | **có** | Các cờ `define` thật sự được biên dịch vào firmware |
| `custombuild.yaml` | 1.131 | **có** | Danh sách feature server đã dùng để build |

Cả bốn file nhị phân đều bị `.gitignore` chặn (`git check-ignore -v` xác nhận từng file).

> Plan Phase 11 ghi `.hex` "khoảng 2,4–2,5 MB". Số thật là **2.224.308 byte (≈ 2,1 MiB)**.
> Con số trong plan là cỡ của file `.tar.gz` (2.633.518 byte), không phải của `.hex`.

## Sáu feature bật thêm so với bản stock — ĐÃ KIỂM CHỨNG

Danh sách "bật thêm so với stock" lấy từ phần chú thích đầu file
`firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml`. Cột "build.log" là
số dòng trong mục `Selected Features:`; cột "extra_hwdef.dat" là dòng `define` được biên dịch.

| | Feature | build.log | extra_hwdef.dat | Ý nghĩa |
|---|---|---|---|---|
| [x] | `AC_AVOID_ALTHOLD` | dòng 24 | `AP_AVOIDANCE_ALTHOLD_ENABLED 1` | Tránh vật cản theo góc nghiêng khi bay AltHold → có param `AVOID_ANG_MAX` |
| [x] | `AC_OAPATHPLANNER` | dòng 11 | `AP_OAPATHPLANNER_ENABLED 1` | Path planner tránh vật cản khi bay AUTO/GUIDED (nhóm `OA_*`) |
| [x] | `CRASHCATCHER` | dòng 51 | `AP_CRASHDUMP_ENABLED 1` | Lưu dump khi firmware crash |
| [x] | `EKF3_WINDEST` | dòng 20 | `EK3_FEATURE_DRAG_FUSION 1` | Ước lượng gió cho EKF3 |
| [x] | `PROXIMITY` | dòng 56 | `HAL_PROXIMITY_ENABLED 1` | Hệ thống proximity (nhóm param `PRX1_*`) |
| [x] | `PROXIMITY_RANGEFINDER` | dòng 43 | `AP_PROXIMITY_RANGEFINDER_ENABLED 1` | Dùng rangefinder làm cảm biến proximity (`PRX1_TYPE 4`) |

Tên feature → tên cờ tra trong `Tools/scripts/build_options.py` của mã nguồn ArduPilot
cùng commit `dbe79216` (bản clone SITL trong WSL, Phase 02).

Hai feature nền của tránh vật cản, không nằm trong sáu cái trên vì bản stock đã có:
`RFND_BENEWAKE_TFMINIPLUS` (dòng 12, `AP_RANGEFINDER_BENEWAKE_TFMINIPLUS_ENABLED 1`) và
`RANGEFINDER` (`AP_RANGEFINDER_ENABLED 1`).

**Đừng hoảng khi thấy `Removing HAL_PROXIMITY_ENABLED` trong `build.log`.** Đó là bước
`undef` cờ mặc định để `define` lại theo lựa chọn. Giá trị cuối cùng nằm trong
`extra_hwdef.dat` (dòng `define ... 1` ở trên), không phải trong dòng "Removing".

### Đối chiếu hai file yaml — cùng 54 feature

`custombuild.yaml` trong thư mục này và `firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml`
có **cùng 54 feature, cùng thứ tự**. Nguồn chuẩn duy nhất là file trong `custombuild/`.

⚠️ Lệnh so sánh trong plan (`-match '^\s+- '`) **không bắt được dòng nào** của file trong
thư mục build, vì server viết `- AC_AVOID` sát lề trái, còn file trong repo thụt 2 dấu cách.
`Compare-Object` khi đó in ra 54 dòng "khác" dù hai danh sách giống hệt. Dùng lệnh này:

```powershell
$a = (Get-Content .\firmware\ardupilot\build-d450a747\custombuild.yaml) -match '^\s*- ' | ForEach-Object { $_.Trim() }
$b = (Get-Content .\firmware\ardupilot\custombuild\speedybeef4v5-copter471-tfminiplus.yaml) -match '^\s*- ' | ForEach-Object { $_.Trim() }
Compare-Object $a $b    # không in gì = giống hệt
```

### Dung lượng flash

Cuối `build.log`: `bin/arducopter` dùng **759.588 byte**, còn trống **239.820 byte** (≈ 234 KB)
trong 999.424 byte dành cho firmware. Còn chỗ để bật thêm vài feature nhỏ.

## Kiểm chứng nhanh sau khi nạp (Phase 14.4)

Mission Planner → Full Parameter List → gõ `PRX1_TYPE` vào ô Search.

- **Có** `PRX1_TYPE` → đúng bản custom build.
- **Không có** → đã nạp nhầm bản stock; `02-avoid-tfmini.param` sẽ báo "parameter not found". Nạp lại.

Kiểm thêm trên board thật (SITL **không** trả lời được mấy câu này, xem mục SITL bên dưới):

- `AVOID_ANG_MAX` — **phải có** vì build bật `AP_AVOIDANCE_ALTHOLD_ENABLED 1`. Không có → nạp nhầm bản.
- `SERVO_BLH_POLES`, `SERVO_BLH_TRATE` — phải có (ChibiOS bật BLHeli/DShot telemetry).

## Dựng lại khi cần đổi feature

1. Mở <https://custom.ardupilot.org>.
2. Kéo thả `firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml` vào ô
   "Drag & drop" → server tự tick lại đúng 54 feature.
3. Sửa feature cần đổi, bấm Generate, đợi, tải `tar.gz` về.
4. Giải nén vào `firmware/ardupilot/build-<hash-mới>/`, viết `NOTES.md` mới. Sửa luôn file yaml
   trong `custombuild/` cho khớp — hai nguồn lệch nhau là mầm lỗi.
5. **Giữ lại** thư mục build cũ cho tới khi bản mới đã bay được ít nhất một chuyến.

## Lưu ý về dung lượng flash

F405 chỉ có 1 MB flash. Bật thêm feature có thể làm build **FAIL** hoặc làm firmware không
còn chỗ cho log. Nếu custom.ardupilot.org báo lỗi kích thước: tắt bớt feature khác trước khi
bật cái mới, đừng hy vọng "chắc vẫn vừa".

## Param SITL từ chối (Phase 11.7)

Nạp ngày 25/09/2026 vào SITL ArduCopter 4.7.1 (build từ nguồn, cùng commit `dbe79216`), bằng
`bash scripts/sitl/run-all.sh --chi run_param_load` — runner nạp từng dòng, tra lại tên trong
bảng param đầy đủ của FC, reboot rồi đọc lại. Chặt hơn nạp tay qua Mission Planner, vì
ArduPilot **im lặng** khi nhận một tên param không tồn tại. Kết quả: `KET QUA: PASS`, 65 s.

**50 dòng** (33 của `01-base.param` + 17 của `02-avoid-tfmini.param`): **44 nhận ngay**, 6 dòng dưới đây.
Nguyên văn runner:

```text
base:SERVO_BLH_POLES   [TỪ CHỐI — không tồn tại]
base:SERVO_BLH_TRATE   [TỪ CHỐI — không tồn tại]
avoid:RNGFND1_ORIENT   [nhận, nhưng chỉ sau reboot]
avoid:RNGFND1_MIN      [nhận, nhưng chỉ sau reboot]
avoid:RNGFND1_MAX      [nhận, nhưng chỉ sau reboot]
avoid:AVOID_ANG_MAX    [TỪ CHỐI — không tồn tại]
```

| Dòng | Vì sao SITL từ chối | Trên board thật (bản build này) |
|---|---|---|
| `SERVO_BLH_POLES`, `SERVO_BLH_TRATE` | Nhóm `SERVO_BLH_*` chỉ biên dịch khi `HAL_SUPPORT_RCOUT_SERIAL`; ChibiOS bật, SITL tắt | **Phải có** |
| `RNGFND1_ORIENT/MIN/MAX` | Chỉ xuất hiện sau khi `RNGFND1_TYPE 20` đã ghi **và** reboot | Như SITL: nạp → reboot → nạp lại |
| `AVOID_ANG_MAX` | Nằm trong `#if AP_AVOIDANCE_ALTHOLD_ENABLED`, SITL mặc định 0 | **Phải có** — build này `define AP_AVOIDANCE_ALTHOLD_ENABLED 1` |

**Plan dự đoán sai một chỗ:** plan ghi "kỳ vọng nhóm `PRX1_*` bị từ chối trên SITL". Thực tế SITL
**nhận** `PRX1_TYPE 4` (SITL build gần như mọi feature). Vì thế SITL **không** kiểm được firmware
có proximity hay không — chỉ board thật trả lời được, bằng bước kiểm `PRX1_TYPE` ở trên.
Nếu board thật từ chối `PRX1_TYPE` → đã nạp nhầm bản stock, quay lại mục "Sáu feature" ở trên.

**`firmware/ardupilot/params/sitl/README.md` (Phase 04) từng viết `AVOID_ANG_MAX` "rất có thể
board thật cũng không có".** Sai với bản build này: `extra_hwdef.dat` dòng 460 bật cờ đó. Đã sửa
README ở Phase 11.

Thử bay trên SITL với đúng bộ param này:

- Nguyên bản: `PreArm: RC not found` — đúng dự kiến, `RC_PROTOCOLS 4` tắt RC ảo của SITL.
- Bù bit 18 (`RC_PROTOCOLS 262148`, **chỉ cho SITL**): arm, cất cánh 5 m, vẫn GUIDED sau 20 s.
