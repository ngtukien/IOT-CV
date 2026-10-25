# Hiệu chỉnh, bay thử trong nhà và chốt tay cầm, chiều–tối 25/10/2026

> Tiếp nối `plans/reports/261025-kiem-tra-phan-cung-that.md` (buổi sáng). Claude đọc/ghi FC qua USB
> bằng `scripts/fc/`, người dùng làm phần tay: cắm pin, bấm tay phát, hiệu chỉnh trong Mission
> Planner, bay. Mọi thay đổi tham số đều được người dùng chọn trước. Số liệu lấy từ MAVLink và log
> dataflash, không ước lượng, trừ chỗ ghi rõ "ước lượng".

## 1. Tóm tắt

| Mức | Việc |
|---|---|
| 🟢 Đã sửa | **FC không arm được sau lần khôi phục Betaflight → ArduPilot**: `3D Accel calibration needed` và `Compass not calibrated`. Gốc: `khoi-phuc-20261025.param` không có `INS_ACC_ID` / `COMPASS_DEV_ID`, nên mã thiết bị lưu trong FC là 0 ≠ mã thật. Người dùng hiệu chỉnh lại accel 6 mặt + Calibrate Level + la bàn trong Mission Planner → PreArm sạch. |
| 🟢 Đạt | **Bay thử trong nhà bằng pin 4S**: 2 lần rời đất (~24 s và ~33 s), cao 10–50 cm, Stabilize. Pin 4S dư lực: nhấc lên ở ~41% cần ga, lệnh motor ~50–55%. |
| 🟢 Đã cải thiện | **M1 khởi động hụt** (tiếng "khậc"): tăng `MOT_SPIN_ARM` 0,10 → 0,13 giảm số lần hụt từ 13/32 xuống 2/28; M1 hết hụt. Thử 0,15 không tốt hơn → giữ 0,13, đã ghi vào `01-base.param`. |
| 🟢 Đã chốt | **Bản đồ tay cầm** theo Phase 15.4, trừ SwB giữ ARM/DISARM (người dùng quen tay); Auto chuyển sang núm VrB (CH9). |
| 🟠 Tạm thời | TFmini/PRX và fence **tắt**, failsafe mất sóng / pin yếu đổi sang **Land** cho bài bay trong nhà. Phải trả lại trước khi bay ngoài trời (mục 8). |
| 🟡 Còn mở | La bàn mới hiệu chỉnh **trong nhà**; radio chưa hiệu chỉnh; TFmini chưa sửa; dòng điện chưa hiệu chỉnh theo mAh sạc lại. |

## 2. Tham số FC đã đổi

Bản chụp toàn bộ tham số trước **mỗi** lần đổi: `D:\IOT_Tools\downloads\speedybee-f405v5\snapshot-20261025-truoc-*.param`.
Mọi giá trị dưới đây đã đọc lại sau khi FC khởi động lại (`nap_param.py` PASS).

| Tham số | Trước | Sau | Lâu dài? | Lý do |
|---|---|---|---|---|
| `RNGFND1_TYPE` / `PRX1_TYPE` | 20 / 4 | **0 / 0** | Tạm | TFmini `No Data` chặn arm; giống lúc bay 24/10. Bật lại: 20 / 4 |
| `FENCE_ENABLE` | 1 | **0** | Tạm | Người dùng chọn như 24/10. Bật lại: 1 (giá trị fence của Phase 19 chưa đặt) |
| `FS_THR_ENABLE` | 1 (RTL) | **3 (Land)** | Tạm, trong nhà | RTL leo `RTL_ALT_M` 15 m → đâm trần nếu GPS bắt được fix gần cửa sổ |
| `BATT_FS_LOW_ACT` | 2 (RTL) | **1 (Land)** | Tạm, trong nhà | Như trên. Ra ngoài trời trả về 2 |
| Accel 6 mặt + Calibrate Level | — | `INS_ACCOFFS_*`, `INS_ACCSCAL_*` mới; `AHRS_TRIM_X` 0,0378 → 0,0558 rad, `AHRS_TRIM_Y` −0,0052 → 0,0332 rad | Có | Người dùng làm trong Mission Planner |
| La bàn (Onboard Mag Calibration) | `COMPASS_OFS` 35,6 / 30,3 / 50,6 | 20,4 / 31,3 / 59,7; `COMPASS_DIA` 1,0; `COMPASS_SCALE` 0 | Tạm (làm trong nhà) | Làm lại **ngoài trời** + compassmot |
| `MOT_SPIN_ARM` | 0,10 | **0,13** | Có, đã ghi `01-base.param` | Mục 6 |
| `FLTMODE_CH` | 9 | **5** | Có | Phase 15.4 |
| `FLTMODE4` | 0 (Stabilize) | **2 (AltHold)** | Có | Phase 15.4; `FLTMODE1` 0, `FLTMODE6` 5 giữ nguyên |
| `RC6_OPTION` | 0 | **4 (RTL)** | Có | Phase 15.4 |
| `RC7_OPTION` | 0 | 0 | Có | WEB CONTROL ENABLE, ArduPilot bỏ qua |
| `RC8_OPTION` | 153 | **153 (ArmDisarm)** | Có | Người dùng giữ, lệch Phase 15.4 (mục 7) |
| `RC9_OPTION` | 0 | **16 (Auto)** | Có | Núm VrB, người dùng chọn (mục 7) |

Ngưỡng pin giữ cho 4S (`BATT_LOW_VOLT 14,0`, `BATT_CRT_VOLT 13,2`); người dùng chọn bay 4S.
`ARMING_SKIPCHK` = 0, không pre-arm check nào bị tắt.

## 3. Vì sao FC không arm được sau khôi phục

ArduPilot chỉ tin số hiệu chỉnh khi mã thiết bị lưu trong bộ nhớ (`INS_ACC_ID`, `COMPASS_DEV_ID`)
khớp mã của cảm biến đang thấy. File khôi phục chép từ bảng tham số đọc lúc chỉ cắm USB, không
có hai dòng đó, nên sau lần nạp lại Betaflight → ArduPilot hai mã lưu là 0. Lúc đó FC báo `3D Accel
calibration needed` (thấy ngay khi chỉ cắm USB) và `Compass not calibrated` (chỉ lộ khi cắm pin, vì
la bàn chỉ có điện khi có pin). Hiệu chỉnh lại thì FC tự ghi mã đúng: `COMPASS_DEV_ID` = 658945 =
`COMPASS_PRIO1_ID`. **Lần sau phải khôi phục tham số thì kiểm hai mã này trước khi nghĩ tới hiệu
chỉnh lại.**

## 4. Hai bẫy nguồn điện (đã gặp thật, đã chữa)

1. **Cắm USB trước pin** → FC khởi động khi GPS/la bàn chưa có điện → không thấy la bàn
   (`Compass 1 not healthy`). Chữa: khởi động lại FC khi đã có pin (qua MAVLink được).
2. **Rút pin trong khi USB vẫn cắm** quá 10 s → FC chốt `Battery 1 low voltage failsafe` (cắm pin lại
   vẫn còn), và la bàn mất điện rồi có lại mà không được khởi tạo lại → đọc |B| ≈ 96 mG (FC đòi
   185–875) → `PreArm: Check mag field`. Chữa: khởi động lại FC khi đang cắm pin → |B| 413 mG, PreArm
   sạch, failsafe pin hết (đã kiểm).

Quy ước từ nay: tắt thì rút cả hai; cắm lại thì **cắm pin trước**, USB sau.

## 5. Bay thử trong nhà, pin 4S

Log `logs/fc-dataflash-20261025-bay-trong-nha/005-khong-gio.bin` (8 lần arm, Stabilize):

| Mục | Số đo |
|---|---|
| Lần rời đất | Arm 1: 23,6 s; arm 3: 32,9 s (sự kiện `NOT_LANDED` → `LAND_COMPLETE`) |
| Cần ga khi nhấc | ~41% (RCIN C3 1.420–1.431) |
| Lệnh motor khi nhấc | ~50–55% (RCOU 1.500–1.550) |
| Dòng / vòng quay | 11–12 A tổng, 5.600–6.600 vòng/phút |
| `CTUN.ThO` | max 0,20 (thấp hơn `MOT_THST_HOVER` 0,27 FC đang nhớ — học từ trước, sẽ tự học lại ở AltHold/Loiter) |
| Pin | 16,29 V trước bay → thấp nhất 16,01 V ở 11,8 A (sụt ~0,3 V); pin khi đó ~4,07 V/cell, chưa sạc đầy |
| Rung | max X/Y/Z 12,5 / 14,2 / 19,2 m/s², `Clip` 0 |
| Tư thế | bám tốt; một lúc lệch roll 11° ở lần 2 (sát sàn) |
| Nhiệt ESC | ≤ 51 °C |
| Lệnh motor lúc treo | M1 1.368, M2 1.395, M3 1.348, M4 1.327 (TB lần 2) — M1 không phải gánh nặng hơn |
| Tụt vòng giữa chừng | **0 lần** ở cả 4 motor sau 3 s đầu (kể cả lúc bay) |

Telemetry áp/dòng của ESC không dùng được (OX32 báo 1,59 V / 0 A). Ước lượng thời gian treo
ngoài trời với pin 5.300 mAh chừa 20%: **15–20 phút** — chỉ là ước lượng, phải đo.

## 6. M1 khởi động hụt — ba mức `MOT_SPIN_ARM`

Đo từ log ESC (10 mẫu/giây/ESC, sai số ±0,1 s): thời gian từ lúc FC gửi lệnh quay tới khi
RPM ≥ 300, và số lần motor tụt < 300 RPM trong 3 s đầu sau khi đã quay.

| | 0,10 (log 005, 8 lần) | **0,13** (log 006, 7 lần) | 0,15 (log 007, 8 lần) |
|---|---|---|---|
| Tổng lần hụt | 13/32 | **2/28** | 6/32 |
| M1 / M2 / M3 / M4 hụt | 5 / 4 / 2 / 2 | **0** / 1 / 1 / 0 | 0 / 2 / 3 / 1 |
| M1 bắt vòng TB (max) | 0,43 s (0,99) | **0,31 s (0,39)** | 0,40 s (0,69) |
| Vòng quay lúc vừa arm | ~1.600 | ~2.000 | ~2.200–2.300 |

Kết luận: tăng từ 0,10 có tác dụng rõ; 0,15 không cải thiện thêm → giữ **0,13**. Mẫu nhỏ (7–8 lần/mức),
chênh 2/28 với 6/32 có thể một phần là ngẫu nhiên. Số lần hụt ở cả 4 kênh cho thấy cách ESC khởi động
khi kéo cánh 10" còn sát giới hạn; M1 nhạy nhất. Dây pha M1 và M3 dài hơn M2, M4 (người dùng cho biết)
nhưng số liệu không khớp độ dài dây. Lỗi M1 khựng ~10 s của buổi sáng đã hết.

## 7. Tay cầm FS-i6X

Kiểm bằng `scripts/fc/doc_tay_cam.py` (đọc `RC_CHANNELS` + chế độ FC báo lại khi gạt):

| Công tắc | Kênh | Chức năng | Kết quả |
|---|---|---|---|
| SwC (3 nấc) | CH5 | lên = Stabilize, giữa = AltHold, xuống = Loiter | Đúng |
| SwD | CH6 | xuống = RTL | Đúng (FC vào RTL khi đang disarm; khi đã arm mà không có GPS thì FC từ chối) |
| SwA | CH7 | WEB CONTROL ENABLE, FC bỏ qua | Đổi giá trị kênh, đúng |
| SwB | CH8 | **ARM/DISARM**: xuống = ARM, lên = DISARM | Đúng — lệch Phase 15.4 theo quyết định người dùng |
| VrB | CH9 | **Auto**: xoay gần hết phải = Auto, lùi lại = về chế độ của SwC | Đúng |
| VrA | — | không dùng | |
| — | CH10 | None (đứng 1500) | |

- Người dùng xác nhận trên tay phát: **chỉ SwC có 3 nấc**, SwA/SwB/SwD đều 2 nấc. Dòng "SwB (3 vị
  trí)" trong `plans/phase-15-ban-rc-gps-compass.md` §15.4 là sai (đã sửa).
- Kế hoạch gốc arm/disarm bằng cần và để CH8 cho Auto ở Phase 21. Người dùng giữ SwB là công tắc ARM
  vì đã quen tay. Rủi ro phải nhớ: **gạt SwB lên khi đang bay thì FC disarm ngay, motor tắt, drone
  rơi**. Arm/disarm bằng cần (`ARMING_RUDDER 2`) vẫn dùng được.
- Auto chuyển sang núm VrB (CH9, `RC9_OPTION 16`). FC chỉ đổi chế độ khi núm **qua ngưỡng** ~1.800 µs
  (lên thì vào Auto, xuống dưới là thoát ngay về chế độ của SwC), không theo vị trí lúc khởi động; FC
  không cho arm khi đang ở Auto. Để VrB hết bên trái khi không dùng. Trên FC hiện không có mission
  (`MIS_TOTAL` 0).
- **Đã kiểm trên tay phát thật** (drone disarm suốt bài): VrB hết trái đọc ~1.015; xoay phải, qua
  1.831 → FC báo `AUTO`; xoay về, xuống 1.779 → FC báo `STABILIZE`. Gạt lại SwC, SwD vẫn đúng.

## 8. Việc còn lại

| # | Việc | Ai | Trước khi |
|---|---|---|---|
| 1 | Trả failsafe về RTL: `FS_THR_ENABLE 1`, `BATT_FS_LOW_ACT 2` | Claude ghi | Bay ngoài trời |
| 2 | Hiệu chỉnh la bàn **ngoài trời** + compassmot; kiểm `COMPASS_ORIENT 6` theo hướng gắn GPS | Người dùng xoay, Claude đọc | Loiter (F3) |
| 3 | Hiệu chỉnh radio (RC1–8 vẫn 1100/1900) | Người dùng gạt cần | F2 AltHold (cần ga giữa phải là 1.500 thật) |
| 4 | Sửa TFmini (hàn trắng → T3 hoặc qua USB-TTL), rồi bật lại `RNGFND1_TYPE 20`, `PRX1_TYPE 4` | Người dùng hàn, Claude gửi lệnh | Phase 22 |
| 5 | Đặt fence theo bãi thật (Phase 19.10: `FENCE_TYPE 3`, `FENCE_ALT_MAX 30`, `FENCE_RADIUS 50`), bật lại | Claude ghi, người dùng chọn bãi | Bay ngoài trời |
| 6 | Hiệu chỉnh điện áp bằng đồng hồ vạn năng; bật `BATT_ARM_VOLT` | Người dùng đo | Phase 20 |
| 7 | Hiệu chỉnh dòng theo mAh sạc lại (`BATT_AMP_PERVLT`) | Người dùng sạc, Claude tính | Phase 20 |
| 8 | Sạc đầy pin 4S, đo từng cell | Người dùng | Bay ngoài trời |
| 9 | Theo dõi khởi động hụt + mất đồng bộ giữa không trung qua log mỗi buổi | Claude (`tai_log.py`) | Liên tục |

## 9. File và công cụ

- Log: `logs/fc-dataflash-20261025-bay-trong-nha/` (log 001–005), `logs/fc-dataflash-20261025-spin-arm-013/006`,
  `logs/fc-dataflash-20261025-spin-arm-015/007` (gitignored).
- Script mới: `scripts/fc/doc_tay_cam.py` (đọc bản đồ công tắc), `scripts/fc/tai_log.py` (tải log qua
  MAVLink, `--tat-ca`, `--id`, `--liet-ke`). `scripts/fc/hieu_chinh_accel.py` **lỗi** (điều kiện "nằm
  yên đủ lâu" không bao giờ đạt) — người dùng bảo không dùng; hiệu chỉnh accel làm bằng Mission
  Planner.
- Tham số: `firmware/ardupilot/params/01-base.param` thêm `MOT_SPIN_ARM,0.13` kèm số đo.
