# Phase 06: Backend — điều khiển và DEAD-MAN

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| ĐÃ XONG (2026-09-22, PR #31) | Phase 05 (hợp đồng WS + khoá ghi MAVLink + `FakeMAVLink`) | ~10 giờ | Không |

## Mục tiêu

Cho backend khả năng **ra lệnh** cho máy bay: đổi mode, arm/disarm, takeoff, HOLD/RTL/LAND, và lái tay bằng velocity trong GUIDED. Kèm theo đó là lớp an toàn bắt buộc: cổng **WEB CONTROL ENABLE**, kẹp **MAX_VELOCITY**, và **dead-man 300 ms** — một vòng lặp độc lập trong backend tự gửi velocity 0 khi trình duyệt im lặng, **không phụ thuộc** vào việc frontend có kịp gửi lệnh dừng hay không.

Đây là phase nguy hiểm nhất của cả dự án. Xong phase này thì bay hết một chuyến SITL bằng script dòng lệnh, và **ba test bắt buộc của `SAFETY.md` §5 đều pass**.

## Đầu vào cần có

**Phải đọc trước — không đọc là không được gõ dòng code nào:**

- `SAFETY.md` **mục 1** (ai được quyền điều khiển), **mục 4** (RC luôn có quyền cao nhất), **mục 5** (ba test dead-man). Đây là ràng buộc cứng.
- `plans/phase-05-backend-mavlink-telemetry.md` mục **"Hợp đồng WebSocket"** — SSOT. Phase 06 **hiện thực** các handler `cmd.*` ở đó, **không** định nghĩa thêm `type` mới.
- `plans/reports/260921-research-web-gcs-stack.md` §1.2 — `SET_POSITION_TARGET_LOCAL_NED`, `type_mask = 0b0000110111000111 = 0x0DC7 = 3527`, frame `MAV_FRAME_BODY_OFFSET_NED (9)`, **ArduPilot dừng máy bay sau ~3 giây nếu không nhận lệnh mới** → phải gửi lại ít nhất mỗi 1 giây.
- `plans/phase-03-hoc-ardupilot-drone-ao.md` — bạn phải đã tự bay được GUIDED bằng Mission Planner trước khi để code làm việc đó.

**Phải chạy được:** SITL (Phase 02), backend telemetry + WS (Phase 05), `scripts/ws_probe.py`.

### Hiện trạng code (prior art)

Phạm vi đã tìm: `backend/mavlink/*.py`, `backend/tests/*.py`, `frontend/control.js`.

| File | Đang có gì | Phase 06 làm gì |
|---|---|---|
| `backend/mavlink/control.py` (76 dòng) | **Toàn bộ 8 method là `NotImplementedError`**: `set_mode`, `arm`, `disarm`, `takeoff`, `land`, `rtl`, `loiter`, `send_velocity_body`. Đã có `KEY_VELOCITY_MAP` (`w/s/a/d/r/f` → tuple vx,vy,vz) **đúng quy ước NED** (`r` = lên = `vz -0.5`). Docstring đã ghi đúng ba luật: chỉ lệnh mức cao, **không có `send_motor_pwm()`**, velocity phải gửi lặp | Implement toàn bộ (6.1–6.4) |
| `backend/mavlink/safety.py` (95 dòng) | **Đã chạy đủ và đã có test**: `note_manual_command(now=)`, `should_send_zero_velocity(now=, timeout_ms=)`, `enable/disable_web_control()`, `on_mode_change()` (rời GUIDED → mất quyền), `on_web_disconnected()`, `may_accept_web_command()` → `(bool, lý do)`, `clamp_velocity()`, `WEB_CONTROLLABLE_MODES = {"GUIDED"}`, `as_dict()` | **Giữ nguyên logic cũ**; chỉ **thêm** 2 trường (6.5.4) |
| `backend/tests/test_safety.py` (80 dòng) | **9 test** đang xanh (plan bản đầu ghi 4 — đếm sai): web không tự giành quyền · chỉ lái được trong GUIDED · được phép khi đã bật + GUIDED · dead-man timeout · chưa bật thì không gửi · bật mà chưa có lệnh · RC đổi mode thì mất quyền · đóng browser thì mất quyền · clamp velocity. Dùng thời gian giả `now=` | Giữ nguyên, không sửa — cả 9 vẫn xanh sau Phase 06 |
| `backend/mavlink/connection.py` | Sau Phase 05 đã có `send(fn, *args)` bọc `threading.Lock` | **Bắt buộc** dùng; cấm gọi thẳng `master.mav.*_send` |
| `backend/tests/fakes.py` | Sau Phase 05 có `FakeMAVLink` ghi lại mọi `*_send()` vào `.sent` và `last(name)` | Nền của mọi test phase này |
| `frontend/control.js` (18 dòng, **đã bị Phase 01 thay bằng Vite**) | Bản vanilla cũ chỉ in `"Control chưa bật"`, nhưng comment của nó ghi lại đúng 3 điều kiện mở khoá và đúng luật "keydown gửi liên tục, keyup gửi 0" | Không đụng. Phase 10 làm phần web |

> Kết luận: `safety.py` là **vốn đang chạy và đã có test** — Phase 06 xây quanh nó, không viết lại. Phần thật sự mới là `control.py` và `deadman.py`.

## File và thư mục sở hữu

**Sửa:**

- `backend/mavlink/control.py`
- `backend/mavlink/safety.py` (chỉ **thêm** trường, không đổi hàm cũ)
- `backend/mavlink/connection.py` (chỉ thêm helper gửi lệnh nếu cần)
- `backend/ws.py` (đăng ký handler `cmd.*`)
- `backend/config.py` — `DEADMAN_TICK_MS` **Phase 05 đã thêm rồi**; phase này thêm `ZERO_VELOCITY_REPEAT`, `COMMAND_ACK_TIMEOUT_S`, `DEADMAN_LOG_PATH`, `MAX_YAW_RATE`
- `backend/app.py` (khởi động/dừng vòng dead-man trong lifespan)
- `.env.example`

**Tạo mới:**

- `backend/mavlink/deadman.py`
- `backend/tests/test_control.py`
- `backend/tests/test_deadman.py`
- `scripts/sitl_deadman_check.py`
- `docs/so-tay/06-backend-dieu-khien-deadman.md`

**Sinh lúc chạy (`.gitignore`):** `logs/deadman.jsonl`.

**Không đụng:** `frontend/**` (Phase 08–10), `mission.py` / `proximity.py` / `api.py` (Phase 07), `backend/vision/**`.

---

## Việc theo thứ tự

### 6.1 `set_mode`, `arm`/`disarm`, `takeoff`

**6.1.1 — `set_mode(mode: str)`.**
Dùng `self.connection.send(master.set_mode, mode_id)` — pymavlink tự chọn biến thể `MAV_CMD_DO_SET_MODE` đúng cho ArduPilot. `mode_id` tra từ bảng đảo của `COPTER_MODES` (đã có trong `telemetry.py`; dựng `MODE_IDS = {v: k for k, v in COPTER_MODES.items()}`, đặt trong `telemetry.py` để khỏi có hai bản).

Whitelist mode cho phép từ web — đúng như hợp đồng Phase 05:

```python
WEB_ALLOWED_MODES = frozenset({
    "GUIDED", "LOITER", "ALT_HOLD", "POSHOLD", "BRAKE",
    "RTL", "LAND", "AUTO", "STABILIZE",
})
```

Mode ngoài danh sách → `error` code `command_denied`. Không có `ACRO`, `FLIP`, `AUTOTUNE`, `SPORT`, `THROW` — những mode đó cần phi công thật cầm RC.

Sau khi gửi, chờ xác nhận tối đa **3 s**: hoặc `COMMAND_ACK` với `result == MAV_RESULT_ACCEPTED (0)`, hoặc `HEARTBEAT.custom_mode` đổi sang giá trị mong muốn. Được thì trả `ack status="done"`; quá hạn thì `error` code `timeout`.

**6.1.2 — `arm()` / `disarm()`.**
`MAV_CMD_COMPONENT_ARM_DISARM` (id 400), `param1 = 1` (arm) hoặc `0` (disarm), **mọi param còn lại = 0**.

> **CẤM TUYỆT ĐỐI `param2 = 21196`.** Đó là "force disarm": bỏ qua mọi kiểm tra và tắt động cơ **kể cả khi đang bay**. Backend không bao giờ gửi giá trị này; có test canh gác ở 6.6.

Trước khi gửi arm, kiểm tra tại backend:

| Điều kiện | Không đạt thì |
|---|---|
| `connected == True` | `error` `not_connected` |
| `gps_fix_type >= 3` | `error` `validation_failed`, message `"GPS chua co 3D fix (fix_type=N). Cho them roi thu lai."` |
| `ekf_ok` không phải `False` | `error` `validation_failed` |

**Không** tự sửa param, **không** tắt pre-arm check để "cho nó arm được" (`SAFETY.md` mục 3). FC từ chối là vì có lý do thật.

**6.1.3 — `takeoff(altitude)`.**
Thứ tự bắt buộc, kiểm tại backend trước khi gửi:

1. `mode == "GUIDED"` → không thì `error` `wrong_mode`, message nêu đúng thứ tự.
2. `armed == True` → không thì `error` `validation_failed`, message `"Chua armed. Thu tu dung: GUIDED -> arm -> takeoff"`.
3. `MIN_ALT <= altitude <= MAX_ALT` → ngoài khoảng thì `error` `validation_failed`, **không im lặng kẹp**. (Im lặng kẹp là "silent fallback" — trái `rules/development-principles.md`. Người dùng gõ 20 m mà máy bay lên 10 m là một bất ngờ nguy hiểm.)

Rồi gửi `MAV_CMD_NAV_TAKEOFF` (id 22) với `param7 = altitude`, các param khác 0.

**6.1.4 — `land()`, `rtl()`, `loiter()`.**
Ba hàm này chỉ là `set_mode("LAND" / "RTL" / "LOITER")` — dùng đổi mode chứ **không** dùng `MAV_CMD_NAV_LAND` / `MAV_CMD_NAV_RETURN_TO_LAUNCH` (hai lệnh đó là *mission item*, ý nghĩa khác). Giữ ba hàm riêng cho dễ đọc, nhưng nội dung là một dòng gọi `set_mode`.

- Lệnh chạy:

  ```powershell
  uv run python scripts/ws_probe.py --url ws://127.0.0.1:8000/ws --script plans/samples/takeoff.jsonl
  ```

  (`takeoff.jsonl` là 4 dòng: `cmd.web_control_enable`, `cmd.mode GUIDED`, `cmd.arm true`, `cmd.takeoff 5`.)

  > Cờ `--script` và thư mục `plans/samples/` **chưa tồn tại khi viết plan** — Phase 06 tạo cả hai. `--script` gửi từng dòng rồi CHỜ `ack done` mới sang dòng sau: bắn dồn thì `arm` tới nơi trước khi FC kịp sang GUIDED và cả chuỗi hỏng mà không nhìn ra vì sao.

- Kết quả mong đợi: mỗi lệnh nhận `ack accepted` rồi `ack done`; console MAVProxy hiện `GUIDED > ARMED`; `relative_alt` trong telemetry bò lên ≈ 5 m trong 15 s.
- Nếu lỗi:
  - *`arm` bị từ chối, STATUSTEXT báo `PreArm: Need 3D Fix`* — SITL chưa có fix. Chờ ~30 s sau khi `sim_vehicle.py` khởi động. **Không** tắt pre-arm check.
  - *`ack accepted` rồi im, không bao giờ `done`* — bạn đang chờ `COMMAND_ACK` trên **thread khác** với thread đang đọc `recv_match`. Chỉ có một thread được đọc socket; thread đọc telemetry phải nhét `COMMAND_ACK` vào một hàng đợi cho hàm chờ lấy ra.
  - *Takeoff không nhúc nhích dù đã armed* — ArduCopter cần **GUIDED** và throttle ở giữa, và trong SITL đôi khi cần `mode GUIDED` trước `arm` chứ không phải sau. Thử đúng thứ tự trong bảng trên.

---

### 6.2 GUIDED velocity — body frame

Đây là lệnh lái tay. Cách gửi:

```python
def send_velocity_body(self, vx: float, vy: float, vz: float, yaw_rate: float = 0.0) -> None:
    m = self.connection.master
    self.connection.send(
        m.mav.set_position_target_local_ned_send,
        0,                                  # time_boot_ms — 0 = FC tự gán
        self.connection.target_system,
        self.connection.target_component,
        9,                                  # MAV_FRAME_BODY_OFFSET_NED
        0b0000110111000111,                 # type_mask 0x0DC7 = 3527: CHỈ dùng vx, vy, vz (+ yaw_rate)
        0.0, 0.0, 0.0,                      # x, y, z    — bị mask bỏ qua
        vx, vy, vz,                         # m/s: vx+ = TRƯỚC, vy+ = PHẢI, vz+ = XUỐNG
        0.0, 0.0, 0.0,                      # ax, ay, az — bị mask bỏ qua
        0.0, math.radians(yaw_rate),        # yaw (bỏ qua), yaw_rate rad/s
    )
```

Ba chỗ dễ sai, ghi lại để khỏi quên:

1. **`vz` dương là ĐI XUỐNG** — hệ NED (North-East-**Down**). Muốn lên thì `vz` **âm**. `KEY_VELOCITY_MAP` sẵn có trong `control.py` đã đúng (`"r": (0.0, 0.0, -0.5)` = lên).
2. **`type_mask = 0x0DC7`** nghĩa là "bỏ qua vị trí và gia tốc, chỉ nghe velocity + yaw_rate". Sai **một** bit là drone bay tới toạ độ `(0,0,0)` của hệ body — tức là lao về chính nó theo cách không đoán được.
3. **`MAV_FRAME_BODY_OFFSET_NED (9)`** là *theo hướng mũi máy bay*, không phải theo hướng Bắc. Nhấn W là "tiến theo mũi", đúng trực giác người lái. Nếu dùng frame `LOCAL_NED (1)` thì W thành "bay về hướng Bắc" — sai hoàn toàn cảm giác điều khiển.

**Kẹp tốc độ:** mọi thành phần đi qua `SAFETY.clamp_velocity()` (đã có sẵn, kẹp theo `MAX_VELOCITY`, mặc định 1.0 m/s; `.env.example` ghi chú Phase 21 bắt đầu ở 0.5 m/s với drone thật). Kẹp ở đây là **im lặng và cố ý** — khác với takeoff: người giữ phím không cần biết mình đang xin 3 m/s, họ chỉ cần máy bay đi chậm. Ghi rõ khác biệt này vào sổ tay để khỏi bị coi là mâu thuẫn với 6.1.3.

**`cmd.velocity` không sinh `ack`** (hợp đồng Phase 05) — nó chạy 5–20 Hz, ack sẽ làm ngập socket. Chỉ khi bị từ chối mới có `error`.

---

### 6.3 Cổng WEB CONTROL ENABLE

Trước khi gửi **bất kỳ** velocity nào, gọi `SAFETY.may_accept_web_command()` (đã có sẵn, trả `(bool, lý do)`). Bốn điều kiện cộng dồn:

| # | Điều kiện | Không đạt → `error` code |
|---|---|---|
| 1 | Operator đã chủ động gửi `cmd.web_control_enable {enabled:true}` | `web_control_disabled` |
| 2 | Mode hiện tại là `GUIDED` | `wrong_mode` |
| 3 | Socket gửi lệnh **chính là** `web_control_owner` (quy tắc một-người-lái, Phase 05 §5.3.3) | `command_denied` |
| 4 | `connected == True` | `not_connected` |

Điều kiện 1 là hiện thực trực tiếp của `SAFETY.md` mục 4: *"Web không được tự giành quyền: operator phải chủ động bật WEB CONTROL ENABLE."*

Điều kiện 2 được bảo trì tự động, và **dây này Phase 05 đã nối rồi** — ở `ws.py::_reconcile_control_ownership`, không phải ở `telemetry.py` như bản đầu của plan viết. Chỗ đặt đó là cố ý: mọi thay đổi của `SafetyState` và `web_control_owner` nằm trên MỘT luồng (event loop) nên không cần khoá và không có race. **Nối thêm một lần nữa trong `telemetry.py` là tự tạo ra hai người ghi** — đừng làm. Kết quả vẫn đúng như mô tả: phi công gạt RC sang Loiter là web mất quyền ngay lập tức.

Khi quyền bị thu hồi vì bất kỳ lý do gì: phát `event` mức `warn` + đẩy `status` mới xuống để UI đổi banner ngay.

---

### 6.4 Vòng DEAD-MAN

Đây là thứ phải đúng tuyệt đối. Đọc kỹ cả mục trước khi code.

**6.4.1 — chạy ở đâu.**
`DeadmanLoop` chạy trong **một `threading.Thread` riêng**, **KHÔNG** trong asyncio event loop.

Lý do: nếu một handler async nào đó chẹn event loop — gọi nhầm hàm blocking, ghi file chậm, sau này là vòng suy luận ảnh — thì vòng dead-man nằm trong event loop sẽ **không chạy đúng lúc cần nó nhất**. Thread riêng miễn nhiễm. Test #5 ở 6.5 tồn tại chính để chứng minh điều này, và nó phải là test **đỏ được** nếu ai đó chuyển vòng lặp vào asyncio.

**6.4.2 — nhịp và hành vi.**

```python
DEADMAN_TICK_MS = 50          # 20 Hz
ZERO_VELOCITY_REPEAT = 5      # gửi (0,0,0) 5 nhịp liên tiếp, chống rớt gói UDP
```

Mỗi nhịp:

```text
1. web_control_enabled == False            -> không làm gì
2. SAFETY.should_send_zero_velocity()      -> gửi (0,0,0)
                                              ghi logs/deadman.jsonl
                                              emit event "deadman.zero_velocity"
                                              deadman_tripped = True
                                              lặp thêm ZERO_VELOCITY_REPEAT-1 nhịp rồi thôi
3. ngược lại                               -> GỬI LẠI velocity gần nhất
```

Bước 3 quan trọng không kém bước 2: ArduPilot **hủy lệnh movement sau ~3 giây** nếu không nhận lệnh mới, nên vòng này vừa là cơ chế an toàn, vừa là cơ chế *giữ cho lệnh còn hiệu lực*. Frontend gửi 5–20 Hz, backend gửi lại 20 Hz — hai lớp độc lập.

**6.4.3 — hai đường dẫn tới velocity 0.** Phân biệt rõ, đây là chỗ hay bị hiểu sai:

| Tình huống | Đường xử lý | Độ trễ tới lệnh zero |
|---|---|---|
| Đóng tab / rút mạng (**socket đóng**) | `on_web_disconnected()` → gửi zero **ngay**, không chờ hết hạn | < 50 ms |
| Trình duyệt treo, socket vẫn mở | Hết hạn `MANUAL_COMMAND_TIMEOUT_MS` → nhịp kế tiếp gửi zero | ≤ 300 + 50 = **350 ms** |
| Cả backend chết | ArduPilot tự dừng | ~3 s (lớp phòng thủ cuối) |

> Nói cho chuẩn: bảo đảm của hệ thống là **≤ `MANUAL_COMMAND_TIMEOUT_MS + DEADMAN_TICK_MS` = 350 ms**, không phải "đúng 300 ms". Con số 300 ms trong `SAFETY.md` là ngưỡng **hết hạn**, không phải ngưỡng **giao hàng**. Test E2E ở Phase 10 đo đường *đóng socket* (nhanh hơn nhiều) nên vẫn dưới 300 ms. Viết đúng sự phân biệt này vào sổ tay — nói "300 ms" mà thực tế 350 ms là một kiểu overclaim.

**6.4.4 — file audit `logs/deadman.jsonl`.** Mỗi lần gửi zero-velocity ghi **đúng một dòng** JSON, ghi **đồng bộ** và `flush()` ngay (bằng chứng an toàn quan trọng hơn vài micro-giây):

```json
{"ts": 1758412345.123, "mono": 91234.5, "reason": "web_disconnected", "vx": 0.0, "vy": 0.0, "vz": 0.0, "socket_id": "s-3"}
```

`reason` ∈ `web_disconnected` · `deadman_timeout` · `mode_changed` · `link_lost` · `operator_disabled`.

> **Một dòng cho MỘT LẦN trip, không phải một dòng cho mỗi gói lặp.** Câu "mỗi
> lần gửi zero-velocity ghi đúng một dòng" ở trên đọc được theo hai nghĩa; chốt
> nghĩa thứ hai. Lý do: `ZERO_VELOCITY_REPEAT` gói là MỘT hành động an toàn,
> chỉ lặp để chống rơi gói UDP — ghi 5 dòng giống nhau cách nhau 50 ms thì
> Phase 10 đọc file để đo độ trễ sẽ phải đoán lấy dòng nào. Số lần lặp nằm ở
> trường `repeat`, và có thêm `sent` (bool) nói gói có ra được dây không.

> **Đây là hợp đồng với Phase 10.** Test Playwright E2E đọc chính file này để đo độ trễ. Đổi định dạng thì phải sửa cả `plans/phase-10-web-dieu-khien-obstacle-video.md` §10.7 trong cùng commit.

**6.4.5 — thêm trường vào `SafetyState`.** Chỉ **thêm**, không đổi hàm cũ (4 test hiện có phải tiếp tục xanh):

```python
deadman_tripped: bool = False
last_zero_velocity_reason: str | None = None
```

Cả hai xuất hiện trong `status.safety` của hợp đồng Phase 05 — Phase 08/10 hiển thị chúng.

**6.4.6 — vòng đời.** `app.py` lifespan: khởi động `DeadmanLoop` sau `READER.start()`, dừng nó trong `finally` trước `READER.stop()`. Biến `TELEMETRY_AUTOSTART=0` (đã có) cũng phải tắt luôn vòng dead-man, nếu không test sẽ có thread lang thang.

---

### 6.5 Ba test bắt buộc + ba test củng cố

Viết trong `backend/tests/test_deadman.py`, chạy với `FakeMAVLink` — **không cần SITL**, và dùng **thời gian giả** (`should_send_zero_velocity(now=...)` đã nhận tham số `now`, tận dụng nó) để test tất định, không chập chờn.

**Ba test bắt buộc của `SAFETY.md` §5:**

| # | Tên | Khẳng định |
|---|---|---|
| 1 | `test_giu_W_thi_gui_velocity_tien` | Sau `cmd.velocity(vx=1)`, `FakeMAVLink.last("set_position_target_local_ned_send")` có `vx≈1.0`, `coordinate_frame==9`, `type_mask==0x0DC7`. **Tên có hậu tố `_send`** — `_FakeMav.__getattr__` ghi lại theo tên đầy đủ, bỏ hậu tố thì `last()` trả `None` và bài test xanh vờ |
| 2 | `test_tha_W_thi_gui_velocity_zero` | Sau `cmd.velocity(vx=0)`, gói cuối có `vx==0.0` |
| 3 | `test_dong_browser_khi_dang_giu_W_thi_dung` | Đang gửi `vx=1`; gọi `on_web_disconnected()`; gói **kế tiếp** là `(0,0,0)` **và** `logs/deadman.jsonl` có dòng `reason="web_disconnected"` |

**Ba test củng cố (không có trong `SAFETY.md` nhưng cần để bảo đảm là thật):**

| # | Tên | Khẳng định |
|---|---|---|
| 4 | `test_timeout_gui_zero_khi_frontend_treo` | Ngừng gọi `note_manual_command()`; bơm thời gian giả tiến 350 ms → có gói `(0,0,0)` |
| 5 | `test_event_loop_bi_chen_van_gui_zero` | Chẹn event loop bằng `time.sleep(2)` trong một task async; vòng dead-man vẫn gửi zero đúng hạn. **Test này đỏ nếu ai đó chuyển vòng lặp vào asyncio** |
| 6 | `test_khong_gui_velocity_khi_chua_bat_web_control` | `web_control_enabled=False` → `FakeMAVLink.sent` không có gói velocity nào |

Thêm vào `test_control.py`:

| Test | Khẳng định |
|---|---|
| `test_mode_ngoai_whitelist_bi_tu_choi` | `FlightControl.set_mode("ACRO")` → `command_denied`. **Qua WebSocket thì là `bad_payload`**, không phải `command_denied`: hợp đồng Phase 05 khai `CmdMode.mode` là `Literal[WEB_MODE_WHITELIST]` nên ACRO rụng ở tầng validate. Giữ nguyên hợp đồng (Phase 08 sinh thẳng enum TypeScript từ đó, dropdown không đẻ ra được mode sai) và sửa plan cho khớp, thay vì nới `Literal` thành `str` — nới thì phải sửa 4 file ở 2 phase, đổi lại chỉ được một chữ mã lỗi |
| `test_takeoff_khi_chua_armed_bi_tu_choi` | → `validation_failed`, message có chữ `"armed"` |
| `test_takeoff_vuot_max_alt_bi_tu_choi_khong_im_lang_kep` | `altitude=50` → `error`, và `FakeMAVLink` **không** nhận lệnh 22 nào |
| `test_velocity_bi_kep_theo_max_velocity` | Xin `vx=5` với `MAX_VELOCITY=1` → gói gửi ra có `vx==1.0` |
| `test_vz_duong_la_xuong` | `KEY_VELOCITY_MAP["r"][2] < 0` (lên) và `["f"][2] > 0` (xuống) |

- Lệnh chạy:

  ```powershell
  uv run pytest backend/tests/test_deadman.py backend/tests/test_control.py -v
  ```

- Kết quả THẬT (2026-09-22): **17 + 17 = 34 PASSED**, gồm đủ 3 test bắt buộc của `SAFETY.md` §5. (Plan bản đầu ghi "6 + 5 = 11" ở đây nhưng "6 + 6" ở cổng pass — hai chỗ đã lệch nhau từ đầu.)
- Nếu lỗi:
  - *Test 5 đỏ* — vòng dead-man đang nằm trong asyncio. Chuyển sang `threading.Thread` (6.4.1). Đây là điều test này sinh ra để bắt.
  - *Test 3 đỏ vì file trống* — đang ghi file qua `asyncio.to_thread`, test đọc trước khi ghi xong. Ghi đồng bộ + `flush()`.
  - *Test chập chờn (lúc xanh lúc đỏ)* — bạn đang dùng `time.sleep` thật. Bơm thời gian giả qua tham số `now=`.

---

### 6.6 Hàm mà backend TUYỆT ĐỐI KHÔNG ĐƯỢC CÓ

> **Đây là danh sách canonical của cả dự án.** Phase 07 §7.9 chạy lại phép quét này trên **toàn** `backend/` và trỏ về mục này; không có bản sao thứ hai. Bổ sung cho `SAFETY.md` mục 1.

| Cấm | Vì sao |
|---|---|
| `send_motor_pwm()`, `set_motor_output()` | Web điều khiển motor trực tiếp = bỏ qua toàn bộ vòng ổn định của FC. Điều cấm gốc trong `SAFETY.md` mục 1 |
| `MAV_CMD_DO_SET_SERVO` / `MAV_CMD_DO_MOTOR_TEST` từ đường web | Cùng lý do. Motor test chỉ làm qua Mission Planner, **có tháo cánh** (`SAFETY.md` mục 2, Phase 16) |
| `RC_CHANNELS_OVERRIDE` (msg 70) | Giả làm cần điều khiển RC → tranh quyền với phi công thật. Version 1 dùng GUIDED, không dùng override |
| `MANUAL_CONTROL` (msg 69) | Cùng họ với trên |
| `SET_ATTITUDE_TARGET` với body rate | Đó là điều khiển vòng trong (rate loop) — việc của FC |
| `ACTUATOR_CONTROL_TARGET` | Điều khiển cơ cấu chấp hành trực tiếp |
| PID / bộ lọc bù / vòng ổn định tự viết | `SAFETY.md`: "Không tự viết PID" |
| `param2 = 21196` trong `COMPONENT_ARM_DISARM` (force disarm) | Tắt động cơ giữa không trung |
| Backend **tự đổi mode** khi gặp sự cố (`auto_rtl_on_link_loss()`, `auto_land_on_low_battery()`) | Xem Phase 07 §7.7 — FC đã có failsafe; thêm tác nhân tự quyết thứ hai sinh tranh chấp |
| `PARAM_SET` cho nhóm `FS_*`, `AVOID_*`, `FENCE_*`, `RNGFND*`, `OA_*` từ web | Đổi cấu hình an toàn phải qua Mission Planner, có người nhìn, có ghi lại |
| `MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN` từ web | Reboot FC khi đang bay |

Test canh gác trong `test_control.py`:

```python
FORBIDDEN = ("send_motor_pwm", "rc_channels_override", "manual_control_send",
             "set_attitude_target", "21196", "do_motor_test", "actuator_control")

def test_khong_co_ham_dieu_khien_muc_thap():
    src = (Path(__file__).parents[1] / "mavlink" / "control.py").read_text(encoding="utf-8")
    body = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
    for cam in FORBIDDEN:
        assert cam.lower() not in body.lower(), f"control.py chua tu cam: {cam}"
```

Chú ý dòng lọc comment: bản thân file có **ghi chú** về các hàm cấm, nên test phải bỏ qua comment, nếu không nó tự đỏ vì chính tài liệu của mình.

---

### 6.7 Script nghiệm thu tay trên SITL

Pytest chứng minh **logic**. `scripts/sitl_deadman_check.py` chứng minh **hệ thống thật** — nó bay một chuyến ngắn rồi cố tình giết socket.

Trình tự script tự chạy: nối WS → `cmd.web_control_enable` → `cmd.mode GUIDED` → `cmd.arm` → `cmd.takeoff 5` → chờ tới 4.5 m → gửi `cmd.velocity vx=1` ở 10 Hz trong 2 s → **đóng socket đột ngột** (`ws.close()` không gửi lệnh dừng) → đọc `logs/deadman.jsonl` tính độ trễ → mở socket mới đọc telemetry khẳng định `ground_speed` về < 0.2 m/s trong 3 s.

```powershell
uv run python scripts/sitl_deadman_check.py --url ws://127.0.0.1:8000/ws
```

- Kết quả mong đợi:

  Kết quả THẬT ngày 2026-09-22 (script có thêm bước `[0/6]` chờ 3D fix + EKF —
  thiếu nó thì script đỏ vì chạy sớm, không phải vì dead-man hỏng, và một cổng
  đỏ sai lý do dạy người đọc bỏ qua màu đỏ):

  ```text
  [0/6] SITL san sang      OK  (3D fix + EKF)
  [1/6] web control ON     OK
  [2/6] mode GUIDED        OK
  [3/6] armed              OK
  [4/6] takeoff 5m         OK  -> alt 5.1 m, on dinh
  [5/6] vx=1.0 trong 4.0s  ground_speed = 0.99 m/s
  [6/6] socket closed      reason=web_disconnected · zero-velocity sau 0.0 ms
                           -> ground_speed 0.19 m/s
  KET QUA: PASS
  ```

- Nếu lỗi:
  - *Bước 5 `ground_speed` = 0* — **đã gặp thật.** Nguyên nhân: script chờ
    `alt >= 0.9 * mục tiêu` rồi gửi velocity ngay, mà ArduCopter **bỏ qua
    velocity trong lúc GUIDED takeoff còn chạy**. Gửi đúng lệnh đó sau khi
    takeoff ổn định cho 0.993 m/s. Điều kiện đúng là tới đủ độ cao **VÀ**
    `climb_rate` đã về ~0. Các khả năng còn lại: drone còn trên mặt đất (GUIDED
    trên mặt đất bỏ qua velocity, không phải bug), `type_mask` sai, hoặc nhịp
    gửi < 1 Hz.
  - *Bước 5 báo "drone không đi" nhưng thật ra backend TỪ CHỐI lệnh* — bản đầu
    của script chỉ gửi rồi đọc `ground_speed`, không hề đọc frame `error`. Một
    lệnh bị từ chối hiện ra y hệt một lệnh bị FC bỏ qua, và script đổ tội cho
    `type_mask`. Script bây giờ vét frame trả về giữa các lần gửi và đỏ ngay
    khi thấy `error`.
  - *Bước 6 độ trễ > 300 ms* — `on_web_disconnected()` chưa gửi zero ngay mà đang chờ hết hạn 300 ms. Sửa theo 6.4.3.
  - *Bước 6 `ground_speed` vẫn > 0.2 sau 3 s* — velocity 0 có gửi nhưng bị rớt gói. Tăng `ZERO_VELOCITY_REPEAT`, và kiểm tra xem hai thread có đang ghi socket không qua `MavlinkConnection.send()` không.

---

### 6.8 Nghiệm thu tay trên SITL

Bốn bài, ghi kết quả vào `docs/test-log.md`:

| # | Bài | Cách làm | Đạt khi |
|---|---|---|---|
| 1 | Takeoff từ web | `ws_probe --script takeoff.jsonl` | ✅ `relative_alt` = **5.00 m**, GUIDED, armed |
| 2 | **W → tiến** | Gửi `cmd.velocity {vx:1}` lặp 10 Hz | ✅ `ground_speed` = **0.993 m/s** (xin 1.0, kẹp `MAX_VELOCITY`) |
| 3 | **Thả → dừng** | Ngừng gửi velocity | ✅ 0.993 → 0.094 → **0.018 m/s** trong ~2 s |
| 4 | **Đóng trình duyệt → dừng** | `sitl_deadman_check.py` | ✅ zero-velocity sau **< 1 ms**; `ground_speed` về 0.19 m/s |

Số đo đầy đủ, môi trường và cấu hình: `docs/test-log.md`.

Bài 2, 3, 4 **chính là** ba test của `SAFETY.md` §5 chạy trên hệ thống thật (pytest ở 6.5 là bản chạy trên logic). Cả hai đều bắt buộc — một cái bắt lỗi suy nghĩ, một cái bắt lỗi lắp ráp.

Bài 5 (RC lấy lại quyền từ web) **không** làm ở đây vì SITL không có RC thật — nó thuộc Phase 21 (F8 RC override).

---

## Cổng pass

Tất cả đã chạy thật ngày 2026-09-22 trên ArduCopter SITL 4.7-dev headless
(`--speedup=1`, vì mấy cổng dưới ĐO THỜI GIAN). Số đo đầy đủ: `docs/test-log.md`.

- [x] `uv run pytest backend/tests/test_deadman.py` → **17 PASSED**, gồm đủ 3 test bắt buộc của `SAFETY.md` §5.
- [x] `uv run pytest backend/tests/test_control.py` → **17 PASSED** (gồm 2 bài canh gác hàm cấm).
- [x] **9** test cũ trong `test_safety.py` vẫn xanh (không được phá vốn đang chạy).
- [x] Chuyển thử `DeadmanLoop` vào asyncio → test #5 **đỏ**. Đã thử thật.
      ⚠️ Lần thử ĐẦU **không** làm nó đỏ, và đó mới là bài học: bản đầu của test gọi
      `deadman.start()` TRƯỚC `asyncio.run(...)`, nên một bản asyncio đặt ở thread riêng
      vẫn qua — test khi đó không canh gì cả. Phải chẹn ĐÚNG cái loop mà bản asyncio sẽ
      bám vào. Cũng đã phá thử hai chỗ khác và cả hai đều đỏ đúng lý do (bảng trong
      `docs/test-log.md`).
- [x] `scripts/sitl_deadman_check.py` in `KET QUA: PASS`, độ trễ zero-velocity **< 1 ms**
      (đường đóng-socket chạy đồng bộ trong event loop; bảo đảm CÔNG BỐ vẫn là 350 ms).
- [x] 4 bài nghiệm thu tay ở 6.8 đều đạt; đã ghi `docs/test-log.md`.
- [x] `grep -rniE "send_motor_pwm|rc_channels_override|21196|do_motor_test|actuator_control|set_attitude_target" backend/` chỉ ra dòng **ghi chú cấm** và danh sách của chính bài test canh gác; không lời gọi thật nào.
- [x] `grep -n "\.mav\." backend/mavlink/control.py` — 2 kết quả, cả hai là **tham số** của `self.connection.send(...)`.
- [x] Xin `takeoff 50` (vượt `MAX_ALT=10`) trên SITL → `validation_failed`, `relative_alt` giữ nguyên **5.02 m**; không lệnh 22 nào được gửi.
- [x] `uv run ruff check .` sạch; `uv run pytest` → **131 passed** (trước phase: 96).
- [x] `docs/so-tay/06-backend-dieu-khien-deadman.md` đã viết (11 mục, gồm NED + `type_mask` + ba lớp dead-man).

### Ba lỗi chỉ lộ ra khi chạy máy thật

Pytest xanh toàn bộ trong khi cả ba đang sống. Đây là lý do §6.7 tồn tại bên
cạnh §6.5 — và là bằng chứng cho câu "một cái xanh không thay được cái kia".

| Lỗi | Triệu chứng | Vì sao pytest mù |
|---|---|---|
| `ack done` của `cmd.arm` nói dối | arm OK rồi takeoff ngay sau báo "Chua armed" | Cờ `armed` ở HEARTBEAT (1 Hz); test đặt thẳng `state.armed=True` |
| Dead-man nổ ngay khi bật WEB CONTROL | Bắn velocity **khi drone còn trên mặt đất** → ArduCopter từ chối `NAV_TAKEOFF` với `MAV_RESULT_FAILED` | Test nào cũng gửi một lệnh velocity trước khi bơm thời gian giả |
| Sự kiện đổ tội sai | `"Mode đổi sang GUIDED — web mất quyền lái"` trong khi GUIDED nằm TRONG whitelist | Không test nào đọc `detail.reason` của sự kiện |

Cả ba đã sửa, đều có test hồi quy chạy được **không cần SITL**, và cả ba test
hồi quy đó đã được chứng minh là đỏ được với code cũ.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Vòng dead-man đặt trong asyncio event loop → bị chẹn đúng lúc cần nhất, velocity 0 không được gửi | 4 | 5 | **20** | **Xử lý trước khi gõ dòng đầu của 6.4**: `threading.Thread` riêng (6.4.1). Test #5 là bằng chứng. Không có test #5 xanh thì **không được sang 6.7** |
| Sai `type_mask` hoặc sai `frame` → drone bay tới toạ độ không lường trước thay vì đi theo velocity | 3 | 5 | **15** | Khẳng định `type_mask==0x0DC7` và `coordinate_frame==9` **trong test #1**, không chỉ trong comment. Nghiệm thu bài 2 phải thấy drone đi **theo hướng mũi**, không phải hướng Bắc |
| Hai thread cùng ghi socket MAVLink (telemetry + dead-man) → gói đan byte | 3 | 4 | 12 | Đã có `MavlinkConnection.send()` với `Lock` từ Phase 05 §5.1.3; cổng pass kiểm bằng `grep` |
| Nhầm dấu `vz` → nhấn "lên" thì drone chúi xuống | 3 | 5 | **15** | `test_vz_duong_la_xuong`; `KEY_VELOCITY_MAP` hiện có đã đúng — **đừng sửa cho "hợp lý"** |
| Chờ `COMMAND_ACK` trên thread khác thread đọc socket → treo vĩnh viễn ở `accepted` | 4 | 3 | 12 | Một thread đọc duy nhất; nó nhét `COMMAND_ACK` vào `queue.Queue` cho hàm chờ lấy |
| Im lặng kẹp altitude thay vì báo lỗi → người dùng tưởng đang lên 20 m | 3 | 4 | 12 | 6.1.3: kẹp velocity thì im lặng (đúng), kẹp altitude thì **phải** báo lỗi. Ghi rõ khác biệt vào sổ tay |
| Test dead-man chập chờn vì dùng `time.sleep` thật | 4 | 2 | 8 | Bơm thời gian giả qua `now=` — `SafetyState` đã hỗ trợ sẵn |
| Người mới thử velocity khi chưa takeoff, tưởng code hỏng | 4 | 2 | 8 | `error` `validation_failed` với message tiếng Việt nêu đúng thứ tự; ghi vào mục "lỗi hay gặp" của sổ tay |
| Test canh gác hàm cấm tự đỏ vì chính comment của mình | 3 | 1 | 3 | Lọc bỏ dòng comment trước khi so khớp (6.6) |

Hai rủi ro **20** và **15** phải được xử lý **trước** khi bắt đầu mục tương ứng, không phải "sửa sau nếu gặp".

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 6.1 `set_mode` / arm / takeoff / land / rtl / loiter | 2.5 | Gồm cả hàng đợi `COMMAND_ACK` |
| 6.2 GUIDED velocity body frame | 1.5 | Ngắn nhưng dễ sai nhất — đọc kỹ 3 chú ý |
| 6.3 Cổng WEB CONTROL ENABLE + nối `on_mode_change` | 1 | Phần lớn là dùng lại `safety.py` |
| 6.4 Vòng dead-man + file audit | 2 | Điều kiện tiên quyết: thread riêng |
| 6.5 11 test (6 dead-man + 5 control) | 2 | |
| 6.6 Danh sách hàm cấm + test canh gác | 0.5 | |
| 6.7 `sitl_deadman_check.py` | 0.5 | |
| 6.8 Nghiệm thu tay 4 bài | — | Gộp trong 6.7 |
| **Tổng** | **10** | Đường găng: 6.1 → 6.2 → 6.4 → 6.5. Phase 07 bắt đầu được ngay sau 6.5 |

## Ghi chú cho sổ tay

Viết vào `docs/so-tay/06-backend-dieu-khien-deadman.md`:

1. **Hệ toạ độ NED** — X trước, Y phải, **Z xuống**. Vẽ hình. Đây là chỗ sai nhiều nhất với người mới, và sai dấu `vz` nghĩa là bấm "lên" thì drone chúi xuống.
2. **`BODY_OFFSET_NED` khác `LOCAL_NED`** — "theo mũi máy bay" so với "theo hướng Bắc". Vì sao W phải là theo mũi.
3. **`type_mask` là gì** — một dãy bit nói "chỉ nghe những ô này, bỏ qua các ô còn lại". Vì sao sai một bit là drone bay đi đâu đó.
4. **Vì sao phải gửi lặp** — ArduPilot cố ý hủy lệnh movement sau ~3 s. Đó là **tính năng an toàn của FC**, không phải bug.
5. **Dead-man switch là gì** — ví dụ cần gạt trên tàu hoả: buông tay là tàu phanh. Ba lớp của dự án: socket đóng (< 50 ms) → hết hạn 300 ms (≤ 350 ms) → ArduPilot tự dừng (~3 s).
6. **Vì sao 350 ms chứ không phải 300 ms** — phân biệt ngưỡng *hết hạn* và ngưỡng *giao hàng*. Nói thật con số là một phần của kỹ thuật.
7. **Vì sao vòng dead-man phải ở thread riêng** — giải thích "chẹn event loop" bằng ví dụ đời thường (một người ôm điện thoại nói chuyện thì không ai gọi vào được).
8. **Khi nào im lặng kẹp, khi nào báo lỗi** — kẹp velocity im lặng (người giữ phím không cần biết), kẹp altitude phải báo (người gõ số cần biết). Nguyên tắc: im lặng chỉ được phép khi người dùng **không có kỳ vọng cụ thể** về con số.
9. **Vì sao web không tự giành quyền** — `SAFETY.md` mục 4, và RC luôn thắng.
10. **Danh sách hàm cấm và vì sao** — 6.6, giải thích ngắn gọn từng dòng. Đây là phần rất dễ được hỏi khi bảo vệ đồ án.
