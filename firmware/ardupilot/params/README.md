# Parameter ArduPilot — quy ước đánh số

Thư mục này **được commit** (khác với `logs/` và `ml/datasets/`). Đây là lịch sử cấu hình
bo bay, để khi chỉnh sai thì restore được trạng thái đã chạy tốt thay vì nhớ bằng đầu.

## Hai loại file — đừng trộn

**File người viết** (nạp VÀO bo bay) — viết tay ở Phase 11, có chú thích, đọc được bằng mắt thường:

| File | Nội dung |
|---|---|
| `01-base.param` | Cấu hình nền: khung, serial, GPS, pin, failsafe cơ bản |
| `02-avoid-tfmini.param` | Rangefinder + proximity + avoidance (TFmini Plus trên SERIAL3) |

**File bo bay xuất ra** (Save to file — snapshot, **KHÔNG sửa tay**):

| File | Lưu khi nào | Phase |
|---|---|---|
| `00-after-flash.param` | Ngay sau khi nạp DFU, **trước** khi chạm vào tham số nào | 14 |
| `02-radio.param` | Sau radio calibration + map switch | 15 |
| `03-gps.param` | Sau khi GPS có fix + compass được nhận diện | 15 |
| `04-pre-first-flight.param` | Sau hiệu chỉnh trên khung, **trước** chuyến bay đầu tiên | 19 |
| `05-loiter-good.param` | Khi Loiter đã giữ vị trí ổn | 20 |
| `06-auto-good.param` | Khi Auto mission chạy trọn vẹn | 21 |
| `07-final.param` | Cấu hình cuối cùng đem đi demo | 24 |

Số `02` xuất hiện hai lần có chủ ý: `02-avoid-tfmini.param` là file người viết,
`02-radio.param` là snapshot. Nhìn hậu tố để phân biệt, đừng nhìn số.

Thư mục `sitl/` là snapshot của **drone ảo** (Phase 04, Phase 11.7). Không file nào
trong đó được nạp lên board thật — xem `sitl/README.md`.

## Ba luật

1. **KHÔNG BAO GIỜ nạp file snapshot của bản dựng khác vào bo bay của mình.**
   Snapshot chứa số đo hiệu chỉnh riêng của từng con drone (gia tốc kế, la bàn, dải tín
   hiệu RC). Dán số của máy khác lên máy mình = bay lệch, hoặc không bay.

2. **Ba nhóm sau KHÔNG BAO GIỜ nạp bằng file param**, bắt buộc chạy wizard trong Mission Planner:

   | Nhóm | Wizard |
   |---|---|
   | `RC*_MIN` / `RC*_MAX` / `RC*_TRIM` | Radio Calibration |
   | `COMPASS_OFS*` / `COMPASS_DIA*` | Compass Calibration |
   | `INS_ACC*` | Accelerometer Calibration |

3. **Mỗi lần commit file mới, ghi rõ trong commit message đã đổi tham số nào và vì sao.**
   Dùng prefix `param:`.

## Cách lưu

Mission Planner → Config/Tuning → Full Parameter List → nút **Save to file**.

## Cách nạp file người viết

Mission Planner → Config/Tuning → Full Parameter List → **Load from file** → chọn file
→ **Write Params** → reboot bo bay.

Nạp `02-avoid-tfmini.param` lần đầu, Mission Planner báo "not found" cho
`RNGFND1_ORIENT/MIN/MAX`. Đó là bình thường: nhóm này chỉ xuất hiện sau khi
`RNGFND1_TYPE 20` đã được ghi **và** bo bay khởi động lại. Nạp → reboot → nạp lại lần nữa.
