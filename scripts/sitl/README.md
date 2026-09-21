# Tự động hoá SITL (`scripts/sitl/`)

Bộ script bay drone ảo bằng MAVLink thật, thay cho việc gõ tay hàng chục lệnh
trong MAVProxy. Sinh ra cho Phase 03 (học ArduPilot), nhưng `harness.py` là nền
mà Phase 06 và 07 sẽ dùng lại để kiểm điều khiển và mission ở backend.

Tất cả là máy bay **ẢO**. Không có motor thật nào quay — xem [`SAFETY.md`](../../SAFETY.md).

## Chạy thế nào

**Trong WSL**, bằng python của venv (chỉ nó mới có `pymavlink`):

```bash
cd /mnt/d/Coding/IOT-CV
~/venv-ardupilot/bin/python3 scripts/sitl/run_mode_chain.py
```

| Script | Trả lời câu hỏi gì | Việc trong plan |
|---|---|---|
| `run_mode_chain.py` | Cả 7 mode có đổi được và có tác dụng thật không? | 03.3 |
| `run_rtl_alt.py` | `RTL_ALT_M` 15 m khác 50 m ở chỗ nào, tính bằng mét? | 03.5 |
| `run_mission_auto.py` | Mission 5 waypoint nạp xuống có đúng và chạy được ở AUTO không? | 03.4 |
| `run_mission_low_alt.py` | FC có chặn waypoint thấp 3 m không, hay backend phải tự chặn? | Phase 07 |
| `run_log_dump.py` | Rút độ cao + các lần đổi mode từ `.BIN` ra CSV | 03.6 |

Mỗi script in một khối `## KET QUA` dạng bảng và kết bằng `KET QUA: PASS` /
`KET QUA: FAIL`, **mã thoát khác 0 khi hỏng** — cắm được vào CI.

## Hai luật vận hành

**Chạy lần lượt, không song song.** Mỗi script tự mở một phiên SITL riêng
(`--use-dir` riêng dưới `~/.cache/iot-cv-sitl/<tên>`) rồi tự tắt.
`refuse_if_conflict()` **từ chối chạy** nếu phát hiện SITL nào đang sống, để
không giẫm lên phiên bạn đang mở tay bằng Mission Planner. Đó là tính năng,
không phải phiền toái.

**Binary phải build sẵn.** Harness chạy `sim_vehicle.py --no-rebuild`. Lý do
không chỉ là tốc độ: build từ đây **hỏng** trên máy này vì `sim_vehicle.py` chạy
bằng python venv nhưng gọi waf qua shebang `#!/usr/bin/env python3`, rơi về
python hệ thống nơi không có `empy`. Nó còn chạy `configure` trước khi build
hỏng, tức là một lần chạy thử cũng đủ động vào cấu hình build đang tốt. Thiếu
binary thì `_check_binaries()` in ra đúng lệnh build (bằng python venv).

## `harness.py` — dùng gì từ nó

```python
with SitlInstance(harness.run_dir("ten-runner"), speedup=5) as sitl:
    sitl.wait_ready()             # BẮT BUỘC trước mọi mode cần vị trí
    sitl.set_mode("GUIDED")
    sitl.arm()
    sitl.takeoff(20.0)
```

`wait_ready()` · `set_mode()` · `arm()` · `takeoff()` · `wait_altitude()` ·
`wait_disarmed()` · `get_position()` → dict · `get_mode_name()` · `set_param()` ·
`start_auto_mission()` · `square_via_rc()`, cộng `run_dir()` / `upload_mission()` /
`download_mission()` / `print_ket_qua()` / `find_latest_bin()` ở mức module.

## Năm cái bẫy đã sập thật (22/09/2026)

Ghi ở đây để người sau không mất lại chừng ấy thời gian. Cả năm đều **im lặng**:
làm sai thì hỏng, mà thông báo lỗi không chỉ vào nguyên nhân.

1. **Đổi mode sang GUIDED quá sớm.** Lệnh thành công, heartbeat báo đúng
   `GUIDED`, rồi vài giây sau EKF chưa có lời giải vị trí nên ArduPilot **tự rơi
   về `STABILIZE`**. Hỏng chỉ lộ ra mãi sau, ở `takeoff`, dưới dạng
   `MAV_RESULT_FAILED` trơ trọi. → luôn `wait_ready()` trước.

2. **Item 0 của mission là ô HOME, không phải lệnh.** Đặt `NAV_TAKEOFF` ở index
   0 thì nó bị nuốt vào ô home, và vào AUTO từ dưới đất bị từ chối:
   `Auto: Missing Takeoff Cmd`. Mission "5 waypoint" nạp xuống **6 item**.
   Khó tìm vì lỗi **chỉ xảy ra khi vào AUTO từ dưới đất** — đã ở trên không thì
   ArduPilot bỏ qua kiểm tra này.

3. **`RTL_ALT` không còn tồn tại** trên ArduCopter 4.7. Đã thành `RTL_ALT_M`,
   đơn vị **mét** chứ không phải centimet. Đặt tên cũ thì FC không báo lỗi gì,
   chỉ không bao giờ xác nhận. `run_rtl_alt.py` tự dò cả hai tên.

4. **RTL không chuyển mode sang `LAND`.** Mode **vẫn là `RTL`** suốt lúc hạ.
   Chờ `LAND` là chờ mãi. Muốn thử `LAND` thì gọi riêng.

5. **AUTO từ mặt đất cần `AUTO_OPTIONS = 3`.** `MAV_CMD_MISSION_START` trả
   `MAV_RESULT_DENIED`; arm thẳng trong AUTO trả `MAV_RESULT_FAILED`; và nếu
   cứ để đó thì máy bay tự disarm sau `DISARM_DELAY = 10` s vì nó nằm dưới đất
   với ga bằng 0. Tham số `AUTO_OPTIONS` bit 0 cho phép arm trong AUTO, bit 1
   cho phép cất cánh không cần nâng ga. Trên drone THẬT, bit 1 nghĩa là máy bay
   tự nhấc lên mà không ai chạm cần ga — đọc `SAFETY.md` trước.

Thêm một cái về môi trường, không phải về ArduPilot: SITL khởi động với `-w`
(xoá EEPROM) sẽ **đổ toàn bộ ~1370 tham số** ngay sau khi nối. Vòng chờ
`PARAM_VALUE` nào chỉ lọc theo kiểu message sẽ vớ phải gói đầu tiên trong cơn lũ
đó. Triệu chứng đánh lừa: xin đọc `RTL_ALT` mà nhận về `BARO1_GND_PRESS`.
`set_param()` xử lý bằng cách gửi lại định kỳ và lọc theo đúng tên.

## Log bay

Log `.BIN` nằm dưới `~/.cache/iot-cv-sitl/<tên-runner>/logs/`.

Cố ý **không** để trong `/tmp`: đó là thư mục ai cũng ghi được, nên một đường dẫn
đoán trước được có thể bị người khác trên cùng máy chèn symlink vào. Cũng cố ý
**không** để trong repo: repo nằm trên ổ Windows gắn qua 9p, mà SITL ghi log rất
dày. Đổi chỗ bằng biến `SITL_RUN_DIR` nếu cần. `run_log_dump.py` rút ra CSV vào
`logs/sitl/`. Cả `.BIN` lẫn CSV đều **không commit** — `.gitignore` chặn, chỉ
`.gitkeep` được giữ. Mở `.BIN` bằng [UAV Log Viewer](https://plot.ardupilot.org).

## Liên quan

[`plans/phase-03-hoc-ardupilot-drone-ao.md`](../../plans/phase-03-hoc-ardupilot-drone-ao.md) ·
[`docs/so-tay/03-hoc-ardupilot-drone-ao.md`](../../docs/so-tay/03-hoc-ardupilot-drone-ao.md) mục 10 ·
[`scripts/run_sitl.sh`](../run_sitl.sh) (phiên SITL mở tay, khác với các phiên cách ly ở đây)
