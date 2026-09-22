# Sổ tay 06 — Backend điều khiển và DEAD-MAN

Phase này cho backend quyền **ra lệnh** cho máy bay. Nó cũng là phase nguy hiểm
nhất của dự án, nên nửa sau của sổ tay toàn là về việc làm sao để drone **dừng**.

Đọc `SAFETY.md` mục 1, 4, 5 trước. Ở đây giải thích *vì sao*, `SAFETY.md` nói
*luật*.

---

## 1. Hệ toạ độ NED — Z hướng XUỐNG

MAVLink dùng hệ **NED**: **N**orth, **E**ast, **D**own.

```text
                    X (+)  = TRƯỚC (mũi máy bay)
                      ↑
                      │
                      │
        Y (−) ←───────┼───────→ Y (+)  = PHẢI
                      │
                      │
                      ↓
                  X (−) = LÙI

              Z (+) = XUỐNG ĐẤT   ← chỗ này sai là chết
              Z (−) = LÊN TRỜI
```

Chữ D cuối cùng là **Down**. Trục Z dương chỉ **xuống đất**, không phải lên
trời. Đây là chỗ sai nhiều nhất với người mới, vì mọi thứ khác trong đời —
đồ thị toán, Unity, biểu đồ độ cao — đều cho Z dương hướng lên.

Hậu quả của việc đảo dấu: bấm nút "LÊN" thì drone **chúi xuống đất**. Ở độ cao
2 mét thì đó là một cú rơi.

Trong `backend/mavlink/control.py`:

```python
KEY_VELOCITY_MAP = {
    "r": (0.0, 0.0, -0.5),   # r = LÊN   -> vz ÂM
    "f": (0.0, 0.0,  0.5),   # f = XUỐNG -> vz DƯƠNG
}
```

Bảng này **đã đúng**. Có một test (`test_vz_duong_la_xuong`) canh nó, chính là
để ngăn người sau "sửa cho hợp lý".

---

## 2. `BODY_OFFSET_NED` khác `LOCAL_NED` — theo mũi hay theo hướng Bắc

Cùng là NED, nhưng gốc toạ độ khác nhau:

| Frame | Số | X dương là hướng nào |
|---|---|---|
| `MAV_FRAME_LOCAL_NED` | 1 | Hướng **Bắc địa lý** |
| `MAV_FRAME_BODY_OFFSET_NED` | 9 | Hướng **mũi máy bay** |

Dự án dùng **9**. Vì sao: người lái nhìn màn hình và bấm W với ý "đi tới". Nếu
dùng frame 1, drone đang quay mặt về hướng Nam mà bấm W thì nó bay **về phía
sau lưng** của chính nó — đúng về mặt toán học, hoàn toàn sai về cảm giác lái.

Bài nghiệm thu §6.8 bài 2 đòi nhìn thấy drone dịch **theo hướng mũi** trên bản
đồ, chính là để bắt lỗi nhầm frame này. Số 9 nằm trong gói đã gửi và có test
khẳng định — không chỉ nằm trong comment.

---

## 3. `type_mask` là gì

Gói `SET_POSITION_TARGET_LOCAL_NED` có **rất nhiều ô**: vị trí (x, y, z), vận
tốc (vx, vy, vz), gia tốc (afx, afy, afz), góc yaw, tốc độ yaw. Ta chỉ muốn
dùng ba ô vận tốc, nhưng vẫn phải gửi cả gói.

`type_mask` là một dãy bit nói với flight controller: **"chỉ nghe những ô này,
bỏ qua các ô còn lại."**

```text
type_mask = 0b0000110111000111 = 0x0DC7 = 3527

bit = 1  ->  BỎ QUA ô đó
bit = 0  ->  DÙNG ô đó

                bỏ qua x,y,z ─┐   ┌─ dùng vx,vy,vz
                              ↓   ↓
        0b 0000 1101 1100 0111
             ↑  ↑↑
             │  │└─ bỏ qua yaw
             │  └── dùng yaw_rate
             └───── bit thừa, luôn 0
```

Sai **một** bit là drone hiểu sang "bay tới toạ độ (0, 0, 0) của hệ body" —
tức là lao về một điểm không ai lường trước. Vì thế test `#1` khẳng định
`type_mask == 0x0DC7` **trên gói đã gửi ra dây**, không phải chỉ đọc comment.

---

## 4. Vì sao phải gửi velocity LẶP LẠI

ArduPilot **cố ý huỷ** lệnh movement sau khoảng 3 giây nếu không nhận lệnh mới.

Đây là **tính năng an toàn của flight controller**, không phải bug: nếu GCS
chết giữa lúc ra lệnh "bay tới trước 1 m/s", drone không được phép bay mãi.

Nên hệ thống có hai lớp gửi độc lập:

```text
trình duyệt  ──5-20 Hz──>  backend  ──20 Hz──>  flight controller
                              ↑
                     vòng dead-man gửi lại
                     lệnh gần nhất mỗi nhịp
```

Frontend chết thì vòng dead-man của backend vẫn giữ lệnh sống (tối đa 300 ms,
xem mục 5). Backend chết thì ArduPilot tự dừng sau ~3 giây.

---

## 5. Dead-man switch là gì — và ba lớp của dự án

Trên đầu máy xe lửa có một cần gạt người lái phải giữ liên tục. **Buông tay là
tàu tự phanh.** Lý do: nếu người lái ngất, không ai còn điều khiển đoàn tàu.

Ở đây "buông tay" là trình duyệt ngừng gửi lệnh, "phanh" là velocity (0, 0, 0).

Ba lớp, độc lập nhau, nhanh dần từ dưới lên:

| Chuyện gì xảy ra | Ai xử lý | Bao lâu |
|---|---|---|
| Đóng tab / rút mạng — **socket đóng** | `hub.disconnect()` gọi thẳng `deadman.trip()` | **< 1 ms** (đo thật) |
| Trình duyệt treo, socket vẫn mở | Hết hạn 300 ms → nhịp dead-man kế tiếp | **≤ 350 ms** |
| Cả backend chết | ArduPilot tự huỷ lệnh | ~3 giây |

Ba lớp này không thay thế nhau. Lớp trên nhanh hơn nhưng cần socket báo đóng;
lớp dưới chậm hơn nhưng không cần gì cả.

---

## 6. Vì sao 350 ms chứ không phải 300 ms

`SAFETY.md` nói "timeout độc lập (~300 ms)". Con số đó là ngưỡng **HẾT HẠN**,
không phải ngưỡng **GIAO HÀNG**.

```text
t = 0 ms     lệnh cuối cùng từ trình duyệt
t = 300 ms   lệnh được coi là CŨ  (MANUAL_COMMAND_TIMEOUT_MS)
             nhưng vòng dead-man chỉ quét mỗi 50 ms,
             nên nó có thể vừa quét xong ở t = 299 ms
t = 350 ms   nhịp quét kế tiếp -> PHÁT HIỆN -> gửi zero
```

Bảo đảm thật của hệ thống là `MANUAL_COMMAND_TIMEOUT_MS + DEADMAN_TICK_MS` =
**350 ms**.

Nói "300 ms" khi thực tế là 350 ms là một kiểu **overclaim** — nói quá khả năng
của hệ thống. Ở một dự án có cánh quạt quay, con số thật quan trọng hơn con số
đẹp. Muốn xuống 350 → 250 ms thì giảm `DEADMAN_TICK_MS`, đừng đổi câu chữ.

---

## 7. Vì sao vòng dead-man phải ở thread riêng

Backend chạy trên **asyncio event loop** — một luồng duy nhất luân phiên phục vụ
nhiều việc: gửi telemetry, nhận lệnh, đẩy sự kiện.

Ví von: event loop là **một người trực tổng đài**. Anh ta xoay vòng rất nhanh
giữa nhiều cuộc gọi nên ai cũng tưởng có nhiều người. Nhưng nếu **một** cuộc gọi
nào đó giữ máy im lặng 2 giây — ai đó gọi nhầm một hàm chặn, ghi một file chậm,
hoặc (Phase 19) chạy một vòng suy luận ảnh — thì **mọi** cuộc gọi khác đứng chờ.

Đặt vòng dead-man vào đó nghĩa là: đúng lúc backend bận nhất, cơ chế an toàn
ngừng chạy. Đó là kịch bản xấu nhất có thể tưởng tượng.

Nên `DeadmanLoop` chạy trong `threading.Thread` riêng, hệ điều hành tự chia thời
gian cho nó, không phụ thuộc vào event loop có rảnh hay không.

**Có một test canh đúng điều này** (`test_event_loop_bi_chen_van_gui_zero`): nó
chẹn event loop 0,6 giây rồi đòi vòng dead-man vẫn phải phanh đúng hạn. Chuyển
vòng lặp vào asyncio là test đó đỏ.

> Bài học phụ, đáng nhớ hơn cả bài chính: **bản đầu của test đó không canh được
> gì cả.** Nó gọi `start()` trước khi mở event loop, nên một bản asyncio đặt ở
> thread riêng vẫn qua. Phải chẹn ĐÚNG cái loop mà bản asyncio sẽ bám vào. Một
> test chưa từng thấy đỏ là một test chưa được chứng minh — hãy phá thử code
> rồi xem test có đỏ không, đừng tin vào màu xanh.

---

## 8. Khi nào im lặng kẹp, khi nào phải báo lỗi

Backend có hai giới hạn an toàn, và chúng xử lý **ngược nhau**. Trông như mâu
thuẫn, nhưng không phải.

| Xin gì | Vượt giới hạn thì | Vì sao |
|---|---|---|
| `cmd.velocity {vx: 5}` với `MAX_VELOCITY=1` | **Im lặng kẹp** xuống 1.0 | Người đang giữ phím W không có con số nào trong đầu. Họ chỉ muốn "đi tới". Kẹp đúng ý họ. |
| `cmd.takeoff {altitude: 50}` với `MAX_ALT=10` | **Báo lỗi**, không cất cánh | Người gõ "50" có kỳ vọng rất cụ thể. Cho drone lên 10 m rồi im lặng là một **bất ngờ nguy hiểm** — họ sẽ đứng chờ nó lên tiếp. |

Nguyên tắc rút ra, dùng được cho mọi chỗ khác:

> **Chỉ được im lặng điều chỉnh khi người dùng KHÔNG có kỳ vọng cụ thể về con
> số đó.** Có kỳ vọng thì phải nói.

Cùng họ với nó là `yaw_rate`: nó có ngưỡng riêng `MAX_YAW_RATE` (độ/giây) chứ
không dùng chung `MAX_VELOCITY` (m/s). Ép một ngưỡng m/s lên một đại lượng
deg/s sẽ kẹp tốc độ xoay xuống 1 độ/giây — xoay nửa vòng mất ba phút — và
**không có gì báo lỗi cả**. Lỗi lẫn đơn vị luôn im lặng như vậy.

---

## 9. Vì sao web không được tự giành quyền lái

`SAFETY.md` mục 4: *"Web không được tự giành quyền: operator phải chủ động bật
`WEB CONTROL ENABLE`."*

Bốn điều kiện cộng dồn trước **mỗi** lệnh velocity:

1. Operator đã chủ động gửi `cmd.web_control_enable {enabled: true}`
2. Mode hiện tại là `GUIDED`
3. Socket gửi lệnh chính là socket đang giữ quyền (một-người-lái)
4. Link MAVLink còn sống

Điều kiện 2 tự bảo trì: `TelemetryReader` thấy `HEARTBEAT` báo mode đổi →
`SafetyState.on_mode_change()` → rời GUIDED là web **mất quyền ngay lập tức**.
Nghĩa là **phi công gạt cần RC sang Loiter là web bị cắt**, không cần ai bấm gì.
Đó là hiện thực trực tiếp của "RC luôn có quyền cao nhất".

`cmd.rtl` / `cmd.land` / `cmd.hold` **không** đòi điều kiện 1 khi chưa ai giữ
quyền. Cố ý: đó là lệnh dừng khẩn, đặt một cái cửa ngay trên đường thoát hiểm
là thiết kế sai.

---

## 10. Danh sách hàm backend TUYỆT ĐỐI KHÔNG ĐƯỢC CÓ

Danh sách canonical ở `plans/phase-06-backend-dieu-khien-deadman.md` §6.6. Ở đây
giải thích ngắn gọn từng dòng — phần rất dễ bị hỏi khi bảo vệ đồ án.

| Cấm | Vì sao, một câu |
|---|---|
| `send_motor_pwm()`, `set_motor_output()` | Ra lệnh thẳng cho motor là bỏ qua toàn bộ vòng ổn định của flight controller. Không còn gì giữ drone thăng bằng. |
| `MAV_CMD_DO_SET_SERVO`, `MAV_CMD_DO_MOTOR_TEST` từ web | Cùng lý do. Motor test chỉ làm qua Mission Planner, **có tháo cánh**. |
| `RC_CHANNELS_OVERRIDE` (msg 70) | Giả làm cần điều khiển RC → tranh quyền với phi công thật đang cầm RC. |
| `MANUAL_CONTROL` (msg 69) | Cùng họ với trên. |
| `SET_ATTITUDE_TARGET` với body rate | Đó là vòng điều khiển trong (rate loop) — việc của FC, chu kỳ tính bằng mili-giây, không đi qua Wi-Fi được. |
| `ACTUATOR_CONTROL_TARGET` | Điều khiển cơ cấu chấp hành trực tiếp. |
| PID / bộ lọc bù tự viết | Viết đúng một vòng PID cho UAV là một đề tài riêng. ArduPilot đã có, đã được bay hàng triệu giờ. |
| `param2 = 21196` trong `COMPONENT_ARM_DISARM` | "Force disarm": **tắt động cơ bất chấp mọi kiểm tra, kể cả khi đang bay**. |
| Backend tự đổi mode khi gặp sự cố | FC đã có failsafe. Thêm một tác nhân tự quyết thứ hai thì hai bên đánh nhau đúng lúc đang có sự cố. |
| `PARAM_SET` cho `FS_*`, `AVOID_*`, `FENCE_*` từ web | Đổi cấu hình an toàn phải qua Mission Planner: có người nhìn, có ghi lại. |
| `MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN` từ web | Reboot flight controller khi đang bay. |

Có **hai** test canh danh sách này (`test_control.py`):

- một bài đọc `control.py` bằng **AST** và tìm lời gọi thật;
- một bài đòi mọi `*_send()` phải là **tham số** của `connection.send(...)`.

Bài đầu dùng AST chứ không so khớp văn bản, vì `control.py` **cố ý viết ra tên
các hàm bị cấm** trong docstring để người sau biết vì sao chúng bị cấm. So khớp
văn bản thì test tự đỏ vì chính tài liệu của mình, và cách chữa hiển nhiên — xoá
tài liệu — đúng là thứ ta không muốn ai làm.

---

## 11. Những lỗi hay gặp

**"Chua armed. Thu tu dung: GUIDED -> arm -> takeoff"**
Thứ tự của ArduCopter là bắt buộc: vào GUIDED trước, arm sau, takeoff cuối. Đảo
thứ tự là bị từ chối.

**`cmd.velocity` không làm drone nhúc nhích, không có lỗi nào trả về**
Ba khả năng, kiểm theo thứ tự:

1. Drone **còn trên mặt đất**. ArduCopter ở GUIDED bỏ qua velocity khi chưa bay.
   Đó không phải bug.
2. Takeoff **chưa xong hẳn**. Trong lúc GUIDED takeoff còn chạy, velocity bị bỏ
   qua. Chờ độ cao ổn định (`climb_rate` về ~0) rồi mới lái.
3. Sai `type_mask` hoặc sai `coordinate_frame`.

**`cmd.arm` báo `ack done` nhưng `cmd.takeoff` ngay sau đó nói "Chua armed"**
Đã sửa, nhưng nhớ nguyên nhân: `COMMAND_ACK` về sau vài mili-giây, còn cờ
`armed` nằm trong `HEARTBEAT` và HEARTBEAT chỉ về **1 Hz**. `ack done` bây giờ
chờ telemetry xác nhận trước khi phát. Bài học chung: **"FC đã nhận lệnh" khác
"lệnh đã có hiệu lực"** — với mỗi lệnh, hãy hỏi bằng chứng nào là bằng chứng
thật.

**`PreArm: Need 3D Fix` khi arm trên SITL**
Chờ thêm khoảng 30 giây sau khi SITL khởi động. EKF hội tụ chậm hơn GPS fix —
đo trên máy này: GPS fix sau ~5 s, `ekf_ok` sau ~25 s. **Không** tắt pre-arm
check để đi tiếp (`SAFETY.md` mục 3).

**Lệnh treo mãi ở `ack accepted`, không bao giờ `done`**
Bạn đang chờ `COMMAND_ACK` ở một thread khác thread đang đọc socket. Chỉ **một**
thread được đọc socket MAVLink; hai bên cùng đọc thì mỗi bên nuốt mất message
của bên kia. Thread đọc phải nhét ack vào hàng đợi cho người chờ lấy ra — xem
`MavlinkConnection.expect_ack()`.

**Backend nối SITL rồi mà log đầy `EOF on TCP socket`**
Có **hai** tiến trình backend cùng nối vào SITL. SITL chỉ nhận một client TCP.
Kiểm bằng `Get-NetTCPConnection -LocalPort 8000` rồi giết theo PID — đếm tiến
trình theo tên sẽ nhầm, vì `uv run` đẻ ra mấy lớp bọc.
