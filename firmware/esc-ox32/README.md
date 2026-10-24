# Cài đặt ESC OX32 của stack SpeedyBee F405 V5

ESC 4in1 OX32 55A, firmware **1.13** (trình cấu hình gọi là "Speedybee 55A 4in1 ESC"). Hai file
xuất bằng nút Export của trình cấu hình `ox32.oxbot.com`:

| File | Là gì |
|---|---|
| `ox32-esc-goc-20261025.json` | Cài đặt xuất xưởng, trước khi sửa |
| `ox32-esc-moi-20261025.json` | **Đang chạy trên ESC** từ 25/10/2026 |

## Đã đổi gì, vì sao

| Mục | Gốc | Mới |
|---|---|---|
| `MOTOR_TIMING` | 15 | 20 |
| `DRIVER_DEMAG_COMPENSATION` | 1 (Low) | 2 (High) |
| `DRIVER_RAMP_POWER` | 50 | 80 |
| `PROTECTION_LOW_SPEED_POWER` | 1 (ON) | 2 (On Adaptive) |

Trên pin 4S có cánh 10", motor M1 khựng khoảng 10 giây rồi mới quay. Cài đặt gốc dành cho motor
đua: `Low RPM Power Protection = ON` cắt công suất ở vòng quay thấp, còn `Rampup Power` chỉ 50%.
Motor KV thấp với cánh lớn cần `On Adaptive` và ramp cao hơn. OX32 chỉ có 4 mức demag (OFF, Low,
High, Very High), không có Medium. Số đo và lý do: `plans/reports/261025-kiem-tra-phan-cung-that.md`
mục 4. **Chưa thử có cánh trên 4S sau khi đổi.**

## Đổi cài đặt ESC lần sau

Trình cấu hình **không vào được ESC qua passthrough của ArduPilot**: bật `SERVO_BLH_AUTO = 1` rồi
nối trang thì báo `4-way communication protocol error`, kể cả sau khi khởi động lại FC và ESC. Cách
đã làm được ngày 25/10/2026 là tạm nạp lại Betaflight:

1. Lưu toàn bộ tham số ArduPilot ra file (bản chụp).
2. **Giữ BOOT khi cắm USB.** Bản ArduPilot `speedybeef4v5` không bật `ENABLE_DFU_BOOT`, nên không
   vào DFU bằng lệnh được. Nạp Betaflight gốc đã sao lưu 13/10/2026:
   `STM32_Programmer_CLI -c port=USB1 -w D:\IOT_Tools\downloads\speedybee-f405v5\factory-betaflight-4.5.2.bin 0x08000000 -v`,
   rồi `-s 0x08000000` để chạy.
3. Cắm pin, mở `ox32.oxbot.com` bằng Chrome (WebSerial), chỉnh, bấm **Save** ở góc dưới, Export ra
   file để đối chiếu. Rút pin, **đóng trang** (trang giữ cổng COM).
4. `uv run --with pyserial python scripts/fc/nap_dfu.py`: từ Betaflight script vào DFU bằng lệnh
   MSP, không cần BOOT, rồi nạp lại ArduPilot.
5. `uv run --with pyserial python scripts/fc/nap_param.py COM6 <file khôi phục>`. File khôi phục là
   bản chụp ở bước 1, bỏ các tham số FC tự sinh lúc khởi động: `*_DEVID`, `COMPASS_DEV_ID*`,
   `INS_ACC_ID`, `INS_GYR_ID`, `INS_GYROFFS_*`, `BARO*_GND_PRESS`, `COMPASS_EXTERN*`,
   `FORMAT_VERSION`, `STAT_RESET`. Khởi động lại rồi so lại với bản chụp.

Mạng chặn thì thêm `--offline` sau `uv run`. Không làm bước nào có motor quay; ARM và Motor Test do
người vận hành tự bấm (`SAFETY.md`).
