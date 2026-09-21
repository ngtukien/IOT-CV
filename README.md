# UAV IoT + Autonomous Waypoint + Manual Control + AI Person Detection — Implementation Plan

[![ci](https://github.com/ngtukien/IOT-CV/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ngtukien/IOT-CV/actions/workflows/ci.yml)
[![python](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue)](pyproject.toml)
[![lint](https://img.shields.io/badge/lint-ruff-261230)](https://docs.astral.sh/ruff/)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![safety](https://img.shields.io/badge/safety-SAFETY.md-red)](SAFETY.md)

> **Mục tiêu:** xây một quadcopter ngân sách khoảng 5–6 triệu có thể bay thủ công bằng RC, nhận lệnh thủ công từ web, bay tự động theo waypoint, RTL/Hold/Land, truyền telemetry về laptop và dùng camera giá rẻ để phát hiện người bằng YOLO; đồng thời biến hạn chế camera thành nội dung nghiên cứu cho môn Xử lý ảnh.

---

## TRẠNG THÁI DỰ ÁN — cập nhật 20/09/2026

**Đã chi 9.661.000 ₫. Phần cứng bay đã đủ 95%. Phần mềm chưa cài gì. Chưa lắp gì.**

Nếu bạn chỉ đọc một mục trong file này, đọc mục này. Hướng dẫn thao tác từng
bước cho người mới: **[docs/huong-dan-bat-dau-tu-con-so-0.md](docs/huong-dan-bat-dau-tu-con-so-0.md)**.

### Đã mua (không mua lại)

| Món | Cụ thể | Ghi chú quan trọng |
|---|---|---|
| Khung | Holybro **S500** 480mm | KHÔNG phải F450. Đế dưới là bo nguồn có đồng đúc chìm — **cấm khoan**. |
| Bo bay + ESC | **SpeedyBee F405 V5** OX32 55A, bản Deluxe | Stack gộp FC + ESC 4-in-1. Chuẩn lỗ 30,5×30,5. |
| Động cơ | **T-Motor AIR GEAR 450 II** — 4 × AIR2216II KV920 | Kèm cánh T1045. Hiện có **8 cánh** (4 + 4 dự phòng). |
| GPS + la bàn | **Holybro M10 v1**, cáp 10 chân, **đã có cột nâng** | Bo bay KHÔNG có la bàn tích hợp → món này bắt buộc. |
| Điều khiển | **FlySky FS-i6X + iA6B** | Nối bằng **i-BUS** vào chân **R6**. Bo không hỗ trợ PPM. |
| Pin | **Ovonic 4S 5300mAh 110C**, đầu XT60 | **4S**, không phải 3S. Kế hoạch 3S cũ là của khung F450. |
| Sạc | **SkyRC iMAX B6AC V2** | Bản AC, có nguồn tích hợp. |

### Đã có sẵn dụng cụ

`mỏ hàn ≥60W` · `đồng hồ vạn năng` · `bộ lục giác 1.5/2.0/2.5` · `túi chống cháy LiPo`

### CÒN THIẾU — 3 nhóm này chặn toàn bộ khâu lắp ráp

- [ ] **Bát chống rung 30,5×30,5mm** (~50–150k) — khung S500 lỗ chuẩn cũ 45×45, stack chuẩn 30,5. Không có bát này thì hoặc phải khoan khung (làm đứt mạch nguồn) hoặc bắt cứng bo bay vào khung (rung làm hỏng AltHold + Loiter). Không có đường thứ ba.
- [ ] **Dây silicone 16AWG, ~4,5m, 3 màu** (~150k) — dây motor T-Motor chỉ dài 150mm, mỗi cần khung dài ~24cm. Phải nối dài 12 mối. **Không dùng 14AWG** (đó là cỡ dây nguồn pin, quá cứng cho dây motor).
- [ ] **Gen co nhiệt bộ nhiều cỡ + dây rút nhựa 2.5×100mm** (~80k) — bọc 12 mối hàn, cố định dây dọc cần. Hở một mối chạm cần khung là cháy ESC.

Tổng còn thiếu: **khoảng 280.000 ₫**. Đặt ngay hôm nay, hàng về mới lắp được.

### Chưa mua, nhưng CHƯA CẦN (đợt 3 — sau khi drone bay ổn)

`ESP32-CAM + mạch nạp` · `ESP32 DevKit` · `UBEC 5V 3A` — tổng ~380k.

### Bắt đầu từ đâu — hai nhánh chạy song song

```text
NHÁNH PHẦN MỀM  (làm được ngay tối nay, 0 đồng, không rủi ro)
  GIAI ĐOẠN 2 → 3 → 4 → 5 → 15   trên drone ảo SITL
  Không cần chạm vào phần cứng. Sai cũng không cháy gì.

NHÁNH PHẦN CỨNG (chờ 3 nhóm phụ kiện về)
  GIAI ĐOẠN 25 → 32   nạp firmware + test trên bàn, CHƯA lắp cánh
  GIAI ĐOẠN 26 → 49   lắp ráp, hiệu chỉnh
  GIAI ĐOẠN 50        bay thật lần đầu

Hai nhánh gặp nhau ở GIAI ĐOẠN 59 (đổi backend từ drone ảo sang drone thật).
```

**Thứ tự đúng cho hôm nay:** đặt 3 nhóm phụ kiện (15 phút) → cài phần mềm
(2 giờ) → chạy drone ảo. Đừng lắp khung trước khi chạy được drone ảo: bạn sẽ
không biết phần mềm hỏng hay phần cứng hỏng.

## 0. KIẾN TRÚC CUỐI CÙNG PHẢI NHỚ NGAY TỪ ĐẦU

Không xây project theo kiểu:

```text
ESP32
 ↓
điều khiển motor
 ↓
camera
 ↓
AI
 ↓
web
```

Mà luôn giữ kiến trúc:

```text
                         UAV
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
 FLIGHT SYSTEM       VISION SYSTEM      COMMUNICATION
       │                  │                  │
 SpeedyBee F405 V5    ESP32-CAM         ESP32 DevKit
 ArduPilot            OV2640             MAVLink bridge
       │                  │                  │
 GPS M10              Wi-Fi JPEG/MJPEG     Wi-Fi UDP
       │                  │                  │
 Receiver                 │                  │
       │                  └────────┬─────────┘
 FlySky FS-i6X                     │
       │                           ▼
 Motor/ESC                       LAPTOP
                                   │
               ┌───────────────────┼──────────────────┐
               │                   │                  │
               ▼                   ▼                  ▼
          MAVLink backend         YOLO               MQTT
               │                   │                  │
          FastAPI/Python     Person Detection       Events
               │                   │                  │
               └───────────────────┼──────────────────┘
                                   │
                                   ▼
                               WEB GCS
                                   │
                    ┌──────────────┼───────────────┐
                    │              │               │
                  MANUAL         MISSION          MONITOR
                    │              │               │
                   WASD          Map             Video
                 Joystick       Waypoints        Battery
                    │              │              GPS
                    │              │              Detection
                  GUIDED          AUTO
```

Flight controller phải là thành phần duy nhất chịu trách nhiệm ổn định máy bay. Web chỉ gửi lệnh mức cao; YOLO tuyệt đối không trực tiếp điều khiển ESC.

**Bo bay thực tế của dự án: SpeedyBee F405 V5** (đã mua, bản stack OX32 55A Deluxe).
Số liệu dưới đây lấy từ `libraries/AP_HAL_ChibiOS/hwdef/speedybeef4v5/` trong mã nguồn
ArduPilot, không phải từ trang bán hàng:

| Hạng mục | Thực tế trên V5 | Hệ quả với dự án |
|---|---|---|
| Firmware target | `speedybeef4v5`, Copter stable **4.7.1** | Có sẵn bản dựng chính thức, không phải tự biên dịch. |
| IMU / Baro | ICM-42688P / SPA06-003 | Có barometer tích hợp → AltHold chạy được. |
| **La bàn** | **KHÔNG có tích hợp** | Bắt buộc dùng la bàn ngoài trong module GPS. |
| Đầu ra motor | **M1–M4** (+ S5, S6, LED) | 4 đầu cho quad là vừa đủ. Không phải M1–M8. |
| SERIAL4 = UART4 | mặc định **GPS** | Cắm GPS vào T4/R4 là chạy, không cần đổi tham số. |
| SERIAL6 = UART6 | mặc định **RCIN** | Cắm i-BUS của iA6B vào **R6**. |
| SERIAL5 = UART5 | mặc định **ESC Telemetry** | OX32 có telemetry → lấy được RPM cho harmonic notch. |
| Nguồn vào | LiPo **3S–6S** ở BAT/GND | Pin 4S của dự án nằm giữa dải. |
| **PPM** | **KHÔNG hỗ trợ** | Đây là lý do phải dùng i-BUS chứ không phải PPM. |
| SBUS | Có, nhưng phải **hàn nối jumper pad** | Dự án dùng i-BUS nên bỏ qua. |
| ESC | OX32 4-in-1, 55A/kênh, **DShot300/600** | **Không có bước ESC calibration** — xem GIAI ĐOẠN 44. |

---

# GIAI ĐOẠN 1 — KHÓA SPEC TRƯỚC KHI MUA ĐỒ

## Mục tiêu

Không mua nhầm linh kiện và không để scope phình ra.

## Version 1 bắt buộc phải làm được

- [ ] Bay bằng tay điều khiển RC.
- [ ] Stabilize.
- [ ] Altitude Hold.
- [ ] Loiter GPS.
- [ ] RTL.
- [ ] Laptop nhận telemetry.
- [ ] Web hiển thị vị trí UAV trên bản đồ.
- [ ] Web hiển thị altitude, GPS, mode, link.
- [ ] Web có nút `GUIDED/MANUAL`.
- [ ] WASD điều khiển UAV trong Guided.
- [ ] Web cho click waypoint.
- [ ] Upload mission xuống flight controller.
- [ ] Start Auto mission.
- [ ] Hold.
- [ ] RTL.
- [ ] Land.
- [ ] ESP32-CAM gửi hình ảnh về laptop.
- [ ] YOLO phát hiện `person`.
- [ ] Detection xuất hiện trên dashboard.
- [ ] Detection lưu snapshot.
- [ ] Detection lưu vị trí UAV tại thời điểm phát hiện.
- [ ] Có nghiên cứu baseline → fine-tune → augmentation → evaluation.

## Version 1 KHÔNG làm

- [ ] Không tự viết PID.
- [ ] Không viết firmware điều khiển bay.
- [ ] Không SLAM.
- [ ] Không obstacle avoidance.
- [ ] Không tự tránh cây.
- [ ] Không auto-follow người.
- [ ] Không landing bằng AI.
- [ ] Không swarm.
- [ ] Không đưa YOLO lên ESP32.
- [ ] Không định vị chính xác tọa độ người từ bounding box.
- [ ] Không bắt buộc cloud.
- [ ] Không 30 FPS.
- [ ] Không yêu cầu bay xa hàng kilomet.

Một điểm cần ghi rất rõ trong báo cáo:

```text
GPS tại thời điểm phát hiện
=
tọa độ UAV

KHÔNG PHẢI
=
tọa độ chính xác của người.
```

Muốn suy ra tọa độ người sau này cần camera calibration + attitude UAV + độ cao + góc camera + phép chiếu tia xuống mặt đất. Để Version 2.

---

# GIAI ĐOẠN 2 — CHUẨN BỊ WORKSPACE SOFTWARE TRƯỚC KHI CÓ DRONE

Đây là phần nên làm **trước khi mua phần lớn phần cứng**.

## 2.1. Tạo project

Tạo:

```text
uav-ai-iot/
│
├── README.md
│
├── docs/
│   ├── architecture.md
│   ├── wiring.md
│   ├── test-log.md
│   ├── parameters.md
│   └── experiments.md
│
├── backend/
│   ├── app.py
│   ├── config.py
│   │
│   ├── mavlink/
│   │   ├── connection.py
│   │   ├── telemetry.py
│   │   ├── control.py
│   │   ├── mission.py
│   │   └── safety.py
│   │
│   ├── vision/
│   │   ├── stream.py
│   │   ├── detector.py
│   │   ├── events.py
│   │   └── recorder.py
│   │
│   ├── mqtt/
│   │   └── publisher.py
│   │
│   └── tests/
│
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── telemetry.js
│   ├── control.js
│   ├── mission.js
│   ├── map.js
│   └── video.js
│
├── esp32/
│   ├── mavlink_bridge/
│   └── camera/
│
├── ml/
│   ├── datasets/
│   ├── scripts/
│   │   ├── extract_frames.py
│   │   ├── convert_visdrone_person.py
│   │   ├── split_dataset.py
│   │   ├── augment.py
│   │   ├── train.py
│   │   └── evaluate.py
│   ├── configs/
│   ├── weights/
│   └── results/
│
└── logs/
```

Không nhét mọi thứ vào:

```text
main.py
```

2000 dòng.

Tách subsystem ngay từ đầu.

---

# GIAI ĐOẠN 3 — CÀI MÔI TRƯỜNG PHÁT TRIỂN

Máy Windows của bạn chia làm hai môi trường.

```text
WINDOWS
├── Mission Planner
├── VS Code
├── Python project
└── Browser

WSL Ubuntu
└── ArduPilot SITL
```

ArduPilot hiện khuyến nghị người dùng Windows phát triển bằng WSL thay cho Cygwin; SITL có thể chạy trực tiếp trong WSL.

## 3.1. Cài WSL

PowerShell Administrator:

```powershell
wsl --install
```

Restart Windows nếu được yêu cầu.

Mở Ubuntu.

## 3.2. Cài ArduPilot SITL

Trong Ubuntu:

```bash
sudo apt update
sudo apt install git -y
```

Sau đó:

```bash
cd ~
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot.git
cd ardupilot
Tools/environment_install/install-prereqs-ubuntu.sh -y
. ~/.profile
```

Đây là quy trình setup mà ArduPilot hiện tài liệu hóa cho Ubuntu.

## 3.3. Chạy drone ảo

```bash
cd ~/ardupilot/ArduCopter
../Tools/autotest/sim_vehicle.py --map --console
```

ArduPilot hướng dẫn chính command này để chạy Copter SITL trên WSL.

### CỔNG PASS 3A

Không đi tiếp nếu bạn chưa thấy:

```text
MAVProxy Console
+
Map
+
ArduCopter SITL running
```

---

# GIAI ĐOẠN 4 — HỌC ARDUPILOT TRÊN DRONE ẢO

Chưa viết website.

Chưa làm AI.

Trước tiên phải hiểu autopilot.

Trong MAVProxy thử:

```text
mode guided
arm throttle
takeoff 5
```

Quan sát drone lên khoảng 5 m.

Sau đó thử:

```text
mode loiter
```

Sau đó:

```text
mode rtl
```

Bạn cần hiểu 5 trạng thái:

```text
STABILIZE
LOITER
GUIDED
AUTO
RTL
```

### Ý nghĩa

```text
STABILIZE
→ con người lái trực tiếp

LOITER
→ GPS giữ vị trí + altitude

GUIDED
→ software/web ra lệnh

AUTO
→ chạy mission waypoint

RTL
→ quay về home
```

---

# GIAI ĐOẠN 5 — BACKEND KẾT NỐI MAVLINK VỚI DRONE ẢO

Bây giờ mới viết software.

## 5.1. Tạo Python environment

Windows PowerShell:

```powershell
cd uav-ai-iot

python -m venv .venv
```

Activate:

```powershell
.\.venv\Scripts\Activate.ps1
```

Cài:

```powershell
pip install pymavlink fastapi "uvicorn[standard]" websockets paho-mqtt opencv-python ultralytics albumentations numpy pandas matplotlib pytest
```

## 5.2. Viết `connection.py`

Mục tiêu đầu tiên duy nhất:

```text
Python
↓
MAVLink
↓
SITL
↓
HEARTBEAT
```

`backend/mavlink/connection.py` phải làm:

```python
from pymavlink import mavutil

class MavlinkConnection:
    def __init__(self, endpoint):
        self.endpoint = endpoint
        self.master = None

    def connect(self):
        self.master = mavutil.mavlink_connection(self.endpoint)
        self.master.wait_heartbeat(timeout=10)
        return self.master.target_system, self.master.target_component
```

Endpoint simulation nên đặt trong config:

```python
MAVLINK_ENDPOINT = "udp:127.0.0.1:14550"
```

MAVProxy có thể forward MAVLink qua UDP cho một hoặc nhiều GCS/process khác.

### Test

Chạy:

```powershell
python backend/mavlink/connection.py
```

Phải nhận được heartbeat.

### CỔNG PASS 5A

```text
Python connected
System ID != null
Heartbeat received
```

Nếu chưa pass:

**không code web.**

---

# GIAI ĐOẠN 6 — ĐỌC TELEMETRY

Tạo:

```text
backend/mavlink/telemetry.py
```

Backend cần lấy tối thiểu:

```text
HEARTBEAT
GLOBAL_POSITION_INT
GPS_RAW_INT
ATTITUDE
SYS_STATUS
VFR_HUD
```

Chuẩn hóa thành một object:

```json
{
  "connected": true,
  "mode": "GUIDED",
  "armed": false,
  "lat": 10.123456,
  "lon": 106.123456,
  "relative_alt": 5.2,
  "heading": 125,
  "ground_speed": 0.8,
  "satellites": 14,
  "battery_voltage": 11.4
}
```

Không cho frontend đọc MAVLink trực tiếp.

Luồng phải là:

```text
Flight Controller
       ↓
MAVLink
       ↓
Python backend
       ↓
Normalized JSON
       ↓
Frontend
```

### CỔNG PASS 6A

Chạy SITL.

Python console phải in:

```text
mode
lat
lon
alt
heading
```

và giá trị phải thay đổi khi drone ảo di chuyển.

---

# GIAI ĐOẠN 7 — WEB TELEMETRY ĐẦU TIÊN

Chưa thêm control.

Website đầu tiên chỉ là monitor.

```text
┌──────────────────────────────────────┐
│ UAV MONITOR                          │
│                                      │
│ CONNECTED ●                          │
│ Mode: GUIDED                         │
│ Armed: YES                           │
│                                      │
│ Latitude: ...                        │
│ Longitude: ...                       │
│ Altitude: ...                        │
│ Heading: ...                         │
│ GPS: ...                             │
└──────────────────────────────────────┘
```

Backend FastAPI:

```text
GET /api/status
WebSocket /ws/telemetry
```

WebSocket nên push khoảng:

```text
5–10 updates/s
```

Không cần 50 Hz cho giao diện.

### CỔNG PASS 7A

Khi SITL:

```text
takeoff
↓
altitude trên website tăng

move
↓
lat/lon thay đổi
```

Nếu website chỉ hiện data giả, chưa pass.

---

# GIAI ĐOẠN 8 — THÊM BẢN ĐỒ

Frontend dùng Leaflet.

Hiển thị:

```text
● UAV
```

Marker cập nhật bằng lat/lon telemetry.

Arrow/icon quay theo heading.

### Tiêu chí

Không tạo marker mới liên tục.

Chỉ:

```javascript
marker.setLatLng([lat, lon])
```

để cập nhật marker cũ.

### CỔNG PASS 8A

SITL bay → marker chạy theo đúng UAV.

---

# GIAI ĐOẠN 9 — VIẾT CONTROL API NHƯNG CHƯA CHO WEB LÁI

Tạo:

```text
backend/mavlink/control.py
```

Các function nên chia rõ:

```python
set_mode()
arm()
disarm()
takeoff()
land()
rtl()
loiter()
send_velocity_body()
```

Đừng tạo:

```python
send_motor_pwm()
```

Web **không bao giờ điều khiển motor trực tiếp**.

---

# GIAI ĐOẠN 10 — MANUAL CONTROL BẰNG GUIDED

Đây là phần WASD.

Không dùng RC_OVERRIDE ngay Version 1.

Dùng:

```text
SET_POSITION_TARGET_LOCAL_NED
```

với:

```text
MAV_FRAME_BODY_OFFSET_NED
```

Trong frame này:

```text
X+
= phía trước UAV

Y+
= bên phải UAV

Z+
= xuống
```

ArduPilot chính thức hỗ trợ body-relative velocity trong Guided Mode; velocity command phải được gửi lặp lại, và Copter dừng movement command sau khoảng 3 giây nếu không còn nhận lệnh.

## Mapping

```text
W
vx = +1 m/s

S
vx = -1 m/s

D
vy = +1 m/s

A
vy = -1 m/s

R
vz = -0.5 m/s
→ lên

F
vz = +0.5 m/s
→ xuống
```

Nhớ:

```text
NED
Z positive
=
DOWN
```

nên lên là Z âm.

---

# GIAI ĐOẠN 11 — LÀM DEAD-MAN SAFETY CHO WASD

Đây rất quan trọng.

Browser không được gửi:

```text
W pressed
```

một lần rồi để UAV tiếp tục bay.

Thiết kế:

```text
keydown W
↓
frontend gửi command liên tục
↓
backend gửi MAVLink velocity

keyup W
↓
frontend gửi zero velocity
```

Ngoài ra backend phải có timeout riêng.

Ví dụ:

```text
Last browser control > 300 ms
↓
send velocity = 0
```

Nếu WebSocket đóng:

```text
send zero
↓
LOITER
```

Bạn tạo:

```text
backend/mavlink/safety.py
```

State:

```python
last_manual_command_time
web_control_enabled
current_mode
rc_available
```

### CỔNG PASS 11A

Test trên SITL:

```text
nhấn W
→ UAV tiến

thả W
→ UAV dừng

đóng browser khi giữ W
→ UAV phải dừng
```

Không pass ba test này → không bao giờ test web manual trên drone thật.

---

# GIAI ĐOẠN 12 — NÚT HOLD / RTL / LAND

UI:

```text
[ HOLD ]
[ RTL  ]
[ LAND ]
```

`HOLD`:

```text
set LOITER
```

`RTL`:

```text
MAV_CMD_NAV_RETURN_TO_LAUNCH
```

`LAND`:

```text
MAV_CMD_NAV_LAND
```

Guided Mode hỗ trợ các command như Takeoff, Loiter, RTL và Land.

### CỔNG PASS

Trong SITL:

```text
WASD đang bay
↓
HOLD
↓
dừng

RTL
↓
quay home

LAND
↓
hạ và disarm
```

---

# GIAI ĐOẠN 13 — AUTO MISSION

Bây giờ mới làm waypoint.

Frontend:

```text
click map
↓
Waypoint 1

click
↓
Waypoint 2

click
↓
Waypoint 3
```

Mỗi waypoint lưu:

```json
{
  "seq": 1,
  "lat": 10.123,
  "lon": 106.123,
  "alt": 5
}
```

Không gửi ngay từng điểm xuống UAV.

Frontend chỉ tạo:

```text
mission draft
```

Người dùng phải nhấn:

```text
UPLOAD MISSION
```

---

# GIAI ĐOẠN 14 — VALIDATE MISSION TRƯỚC KHI UPLOAD

Backend phải reject mission nếu:

```text
0 waypoint
altitude quá thấp
altitude vượt giới hạn demo
waypoint quá xa home
tọa độ invalid
waypoint nằm ngoài geofence
```

Cho project trường học, bạn có thể tự đặt giới hạn software ban đầu:

```text
MAX_ALT = 10 m
MAX_DISTANCE_HOME = 50 m
MAX_WAYPOINTS = 10
```

Đây là giới hạn project của mình, không phải giới hạn kỹ thuật ArduPilot.

---

# GIAI ĐOẠN 15 — UPLOAD MISSION

MAVLink Mission Protocol không đơn giản là gửi một mảng JSON.

Quy trình chuẩn là:

```text
GCS
↓
MISSION_COUNT

FC
↓
MISSION_REQUEST_INT seq=0

GCS
↓
MISSION_ITEM_INT 0

FC
↓
MISSION_REQUEST_INT seq=1

...

FC
↓
MISSION_ACK
```

MAVLink quy định mission mới chỉ nên thay mission cũ sau khi upload đầy đủ và được chấp nhận.

Backend `mission.py` phải quản lý:

```text
upload
download
clear
start
mission progress
```

### CỔNG PASS

SITL:

```text
click 4 điểm
↓
UPLOAD
↓
Mission Planner cũng nhìn thấy 4 điểm

START
↓
AUTO

Drone:
WP1 → WP2 → WP3 → WP4
```

---

# GIAI ĐOẠN 16 — CHỈ LÚC NÀY MỚI BẮT ĐẦU COMPUTER VISION

Không cần drone thật.

## 16.1 Baseline

Cài Ultralytics rồi thử:

```python
from ultralytics import YOLO

model = YOLO("yolo11n.pt")
model.predict("test.jpg", classes=[0])
```

YOLO11 vẫn được Ultralytics hỗ trợ cho detect, train, validation, prediction và export.

Chỉ giữ:

```text
person
```

---

# GIAI ĐOẠN 17 — VISDRONE

Không train từ zero.

VisDrone detection hiện có:

```text
6471 train
548 val
1610 test-dev
```

và gồm các class aerial như pedestrian, people, bicycle, car, motor...

## Với project này

Chuyển:

```text
pedestrian
+
people
↓
PERSON
```

Bỏ class khác.

Dataset mới:

```text
class 0 = person
```

Tạo:

```text
ml/scripts/convert_visdrone_person.py
```

---

# GIAI ĐOẠN 18 — TRAIN MODEL A/B

Model A:

```text
YOLO pretrained COCO
```

Model B:

```text
YOLO
+
VisDrone Person
```

Giữ cùng:

```text
image size
test set
confidence evaluation
```

để so công bằng.

Lưu:

```text
precision
recall
mAP50
mAP50-95
```

Không được chỉ báo:

```text
accuracy = 95%
```

mà không biết accuracy đó là gì.

---

# GIAI ĐOẠN 19 — MUA ESP32-CAM VÀ TEST TRÊN BÀN

Bây giờ mới cần camera.

ESP32 driver chính thức hỗ trợ OV2640 tới 1600×1200, nhưng Espressif cảnh báo camera dùng nhiều RAM/băng thông; với Wi-Fi, JPEG là lựa chọn phù hợp hơn và độ phân giải cao thường cần PSRAM.

Do đó Version 1 bắt đầu:

```text
JPEG
640 × 480
```

Không bắt đầu:

```text
1600 × 1200 livestream
```

## Test 1

ESP32-CAM để trên bàn.

Laptop nhận:

```text
http://camera-ip/...
```

## Test 2

Đứng cách:

```text
2m
4m
6m
8m
```

chụp ảnh.

## Test 3

Cho YOLO chạy.

Ghi:

```text
distance
confidence
detected/missed
```

### CỔNG PASS

Nếu camera đặt cố định ngoài trời sáng mà 4–6m model vẫn gần như không nhận được người:

**dừng ở đây và xem xét nâng camera.**

Không cần ráp drone rồi mới phát hiện camera không phù hợp.

---

# GIAI ĐOẠN 20 — THU OWN DATASET TRƯỚC KHI DRONE BAY

Dùng ESP32-CAM trên tripod/gậy/selfie stick.

Tạo góc nhìn cao:

```text
2m
3m
4m
```

Quay người:

```text
đứng
đi
ngồi
quay lưng
áo sáng
áo tối
nắng
bóng râm
```

Không lấy 30 frame liên tiếp gần như giống nhau.

Ví dụ:

```text
video
↓
extract 1 frame / 1–2 s
```

Tạo khoảng:

```text
200–400 ảnh đầu tiên
```

---

# GIAI ĐOẠN 21 — CHIA DATASET ĐÚNG

Không random toàn bộ frame cùng video.

Ví dụ:

```text
video_session_01
→ train

video_session_02
→ train

video_session_03
→ validation

video_session_04
→ test
```

Nếu frame thứ 100 vào train nhưng frame 101 gần giống hệt vào test thì metric sẽ bị đẹp giả.

---

# GIAI ĐOẠN 22 — MODEL C

Train:

```text
VisDrone
+
Own ESP32-CAM dataset
```

So:

```text
Model A = COCO
Model B = VisDrone
Model C = VisDrone + Own Camera
```

Test đặc biệt trên:

```text
Own Camera Test Set
```

Đây sẽ là phần rất quan trọng trong môn Xử lý ảnh.

---

# GIAI ĐOẠN 23 — DEGRADATION EXPERIMENT

Chỉ chọn ba vấn đề:

```text
Motion Blur
Brightness
JPEG Compression
```

Không nghiên cứu 15 degradation.

Tạo Model D:

```text
Model C
+
augmentation degradation
```

Chỉ augment:

```text
TRAIN SET
```

Không augment test set thật.

Cuối cùng:

| Model | Normal | Blur | Low light | Compression |
|---|---:|---:|---:|---:|
| A COCO | metric | metric | metric | metric |
| B VisDrone | metric | metric | metric | metric |
| C Own data | metric | metric | metric | metric |
| D Augmented | metric | metric | metric | metric |

Đây chính là phần:

```text
Dataset
↓
Preprocessing
↓
Augmentation
↓
Training
↓
Experiment
↓
Evaluation
↓
Deployment
```

---

# GIAI ĐOẠN 24 — FLIGHT HARDWARE — ĐÃ MUA XONG

Giai đoạn này **đã hoàn thành** (9.661.000 ₫). Giữ lại đây làm bản kê đối chiếu
khi mở thùng hàng.

```text
ĐÃ CÓ
  Holybro S500 480mm                     khung
  SpeedyBee F405 V5 OX32 55A Deluxe      FC + ESC 4-in-1 gộp chung
  T-Motor AIR GEAR 450 II                4 × AIR2216II KV920 + cánh T1045
  8 cánh 1045                            4 dùng + 4 dự phòng
  Holybro M10 v1 (10 chân) + cột nâng    GPS + la bàn IST8310
  FlySky FS-i6X + iA6B                   tay phát + bộ thu i-BUS
  Ovonic 4S 5300mAh 110C XT60            pin
  SkyRC iMAX B6AC V2                     sạc cân bằng

CÒN THIẾU — chặn khâu lắp ráp, ~280k
  bát chống rung 30,5×30,5mm
  dây silicone 16AWG × 4,5m, 3 màu
  gen co nhiệt nhiều cỡ + dây rút 2.5×100

CHƯA CẦN — đợt 3, sau khi bay ổn, ~380k
  ESP32-CAM + mạch nạp
  ESP32 DevKit
  UBEC 5V 3A
```

Bốn thứ trong bản kê cũ **không còn dùng nữa**, đừng mua:

| Bản kê cũ | Vì sao bỏ |
|---|---|
| Khung F450 | Đã đổi sang S500 480mm. |
| 4 × A2212 + 4 × ESC 30A rời | Motor đã là AIR2216II; ESC đã nằm trong stack. |
| Pin 3S | Khung S500 nặng hơn, bắt buộc 4S. |
| Power board (PDB) rời | Stack đã có ESC 4-in-1 kiêm phân phối nguồn. |

Bộ ESC AIR 20A đi kèm gói T-Motor (nếu shop có gửi) thì **cất đi, không lắp** —
OX32 55A trong stack khoẻ hơn hẳn.

---

# GIAI ĐOẠN 25 — KHÔNG LẮP NGAY, TEST TỪNG LINH KIỆN

Làm ngay khi hàng về, **trước khi lắp bất cứ thứ gì**. Phát hiện hàng lỗi lúc này
thì còn đổi trả được; phát hiện sau khi đã hàn thì không.

## Motor — 4 × T-Motor AIR2216II

```text
trục thẳng? xoay tay có mượt, không rít?
bearing có kêu lạo xạo?
3 dây có đứt/tróc?
nam châm có cạ vào stator?
```

**Việc quan trọng nhất ở bước này: đếm chiều ren.** Quad cần đúng **2 ren thuận +
2 ren nghịch**. Vặn thử ốc chóp bằng tay: siết chặt khi xoay **cùng** chiều kim đồng
hồ là ren thuận; siết chặt khi xoay **ngược** chiều kim đồng hồ là ren nghịch. Đừng
tin nhãn hộp. Nếu shop gửi 4 cái cùng loại ren thì phải đổi ngay.

## ESC — OX32 55A trong stack

Không cháy, không phồng tụ, không biến dạng. Kiểm tra sợi cáp 10 chân nối FC↔ESC
có đủ trong hộp Deluxe (hộp có 2 sợi: 25mm và 75mm).

## FC — SpeedyBee F405 V5

Cắm USB vào máy tính. Windows phải kêu "ting" và hiện thiết bị mới. Chưa cần cắm pin.

## GPS — Holybro M10 v1

Không vỡ ăng-ten gốm. Kiểm tra cột nâng có đủ ống + 2 đế + ốc.

## Receiver — iA6B

Bind được với FS-i6X (xem GIAI ĐOẠN 34). Chỉ cần nguồn 5V, chưa cần bo bay.

## LiPo — Ovonic 4S 5300mAh

Đo điện áp **từng cell** bằng chức năng `Battery Meter` của B6AC V2.

```text
Pin mới xuất xưởng ở mức storage: 3,80 – 3,85 V mỗi cell
Tổng 4 cell:                      15,2 – 15,4 V
Lệch giữa cell cao nhất và thấp nhất phải < 0,05 V
```

Không dùng pin:

```text
phồng
rách
dây lỏng
cell lệch bất thường
```

---

# GIAI ĐOẠN 26 — LẮP KHUNG S500

Lắp:

```text
arm 1
arm 2
arm 3
arm 4
+ 2 chân đáp
```

Chưa gắn prop.

Kiểm tra frame:

```text
đặt trên bàn
↓
không cong
↓
4 chân motor cùng mặt phẳng
```

Siết ốc chắc nhưng không ép nhựa biến dạng.

**CẢNH BÁO RIÊNG CỦA S500 — đọc trước khi cầm mũi khoan:**

Đế dưới S500 **không phải tấm nhựa trơn**. Nó là bo phân phối nguồn, có các đường
đồng đúc **chìm bên trong lớp vật liệu**, dẫn dòng từ pin ra 4 điểm hàn ESC.

```text
Khoan trúng đường đồng  →  đứt mạch nguồn, không lên điện, không dò được bằng mắt
Mạt đồng bám thành lỗ   →  chập chờn: lúc đầu vẫn chạy, nóng lên mới chập
                            (và lúc đó drone đang ở trên không)
```

Nhận biết tấm nào cấm khoan: **tấm nào có điểm hàn đồng và ký hiệu cực + − thì
tuyệt đối không khoan.** Tấm trên thường là sợi thuỷ tinh trơn, khoan được — nhưng
với bản dựng này bạn **không cần khoan lỗ nào cả**, xem GIAI ĐOẠN 31.

---

# GIAI ĐOẠN 27 — LẮP MOTOR

Motor:

```text
M1
M2
M3
M4
```

Đánh nhãn bằng băng dính.

Đừng nghĩ:

> “sau nhớ được.”

Bạn sẽ không nhớ.

Dây motor tạm thời chưa cần cắt ngắn.

---

# GIAI ĐOẠN 28 — HỆ THỐNG NGUỒN

**Kiến trúc nguồn của bản dựng này đơn giản hơn bản kê cũ rất nhiều**, vì stack
SpeedyBee đã gộp ESC 4-in-1 và mạch phân phối nguồn vào làm một. **Không dùng power
board rời của khung S500.**

```text
            LiPo 4S 5300mAh
                  │
                XT60
                  │
                  ▼
        ┌─────────────────────┐
        │  ESC OX32 4-in-1    │   ← hàn dây pin vào đây (cặp pad BAT+/BAT−)
        │  (tầng dưới stack)  │   ← hàn tụ 1000uF 35V kèm theo hộp vào cùng pad
        └─────────────────────┘
          │    │    │    │   │
          M1   M2   M3   M4  └── cáp 10 chân ─→ FC (tín hiệu + nguồn + đo dòng)
          │    │    │    │
        Motor Motor Motor Motor
```

Ba điều bắt buộc ở bước này:

```text
1. Hàn TỤ 1000uF 35V vào ngay pad BAT+/BAT− của ESC
   Hộp Deluxe có sẵn 2 tụ. Không lắp tụ → xung điện áp lúc đóng cắt
   có thể giết FC. Chân dài là +, chân ngắn là −, lắp ngược là nổ tụ.

2. FC KHÔNG hàn dây pin riêng
   FC lấy nguồn qua đúng sợi cáp 10 chân từ ESC. Hộp Deluxe có 2 sợi
   (25mm và 75mm) — chọn sợi vừa với khoảng cách giữa 2 tầng.

3. Nguồn 5V của FC chỉ ~2,5A cho toàn bộ ngoại vi
   GPS ăn phần này là đủ. Sang đợt 3, camera ESP32 phải cấp nguồn
   bằng UBEC 5V 3A riêng lấy thẳng từ pin — không ăn ké 5V của FC,
   vì camera kéo sụt áp sẽ làm FC reset giữa lúc bay.
```

Đường nguồn tách riêng ở đợt 3:

```text
LiPo 4S ──┬── ESC OX32 ──→ motor + FC + GPS
          │
          └── UBEC 5V 3A ──→ ESP32-CAM + ESP32 bridge
```

---

# GIAI ĐOẠN 29 — CÁP FC↔ESC (thay cho quy tắc BEC cũ)

Giai đoạn này trong bản kê cũ nói về ESC **rời** có dây BEC 5V. Bản dựng hiện tại
dùng ESC **4-in-1 trong stack**, nên toàn bộ vấn đề đó biến mất: chỉ có **một sợi
cáp 10 chân** giữa hai tầng, cắm là xong, không cắt dây, không đấu song song gì cả.

```text
Sợi cáp 10 chân mang:  4 tín hiệu motor + nguồn cho FC + tín hiệu đo dòng + GND
Cắm một chiều duy nhất — giắc có khớp chống ngược, đừng dùng lực
```

Việc thật sự cần làm ở bước này là **chống ngắn mạch giữa hai tầng**:

```text
□ Bọc vỏ silicone (hộp Deluxe có 10 cái) vào FC và ESC
□ Dùng ốc nylon + đệm silicone của hộp Deluxe để chồng tầng
□ Không để đuôi chân linh kiện tầng dưới chạm mặt đồng tầng trên
□ Sợi cáp 10 chân gập gọn, không để kẹt giữa hai bo khi siết ốc
```

Hai tầng chạm nhau là chập nguồn 4S — cháy cả stack 2 triệu.

---

# GIAI ĐOẠN 30 — DÙNG ĐỒNG HỒ ĐO TRƯỚC KHI CẤP ĐIỆN

Không cắm LiPo ngay sau khi hàn.

Multimeter:

```text
continuity mode
```

Đo:

```text
BAT+
↔
GND
```

Nếu beep như short:

**không cắm pin.**

Kiểm tra từng rail.

Nếu có thể, dùng:

```text
smoke stopper
```

ở lần power-on đầu tiên.

---

# GIAI ĐOẠN 31 — LẮP FLIGHT CONTROLLER

Stack đặt:

```text
gần center of frame, trên tấm trên
```

Mũi tên FC:

```text
hướng về phía trước UAV
```

Nếu buộc phải xoay FC:

```text
phải khai báo AHRS_ORIENTATION
```

Không tự “nhớ offset”.

## Vấn đề riêng của S500 + stack 30,5 — và cách giải đúng

```text
Khung S500   : KHONG co lo 30,5 x 30,5
               (thiet ke thoi bo bay la hop lon kieu Pixhawk)
Stack F405 V5: lo bat chuan 30,5 x 30,5 (thoi bo dua)
                        |
              hai chuan khong khop nhau
```

**Mức độ chắc chắn của khẳng định này** (kiểm chứng 20/09/2026):

| Khẳng định | Bằng chứng |
|---|---|
| Đế dưới S500 là PDB tích hợp | Trang sản phẩm Holybro: *"The bottom plate also has a power distribution board (PDB) build in"*, Cont 60A / Burst 100A. **Đã xác minh.** |
| Khung không có lỗ 30,5×30,5 | Không tài liệu chính hãng nào nêu; tồn tại cả một lớp adapter "S500 → 30,5" trên thị trường. **Đã xác minh gián tiếp.** |
| Không nên bắt cứng bo bay vào khung | Bản dựng tham chiếu của chính Holybro (PX4 build guide cho S500 V2) dùng **băng keo hai mặt** dán Pixhawk lên tấm giữa, rồi mới bắt tấm đó vào khung bằng ốc M2.5×6. **Đã xác minh.** |
| Khung dùng chuẩn lỗ 45×45 | **CHƯA xác minh.** Con số này lấy từ `docs/linh-kien-s500.html`; không tìm được bản vẽ Holybro xác nhận. Không quan trọng với quyết định — điều cần biết là "không phải 30,5". |

Có đúng **một** cách xử lý đúng, và hai cách sai:

| Cách | Kết quả |
|---|---|
| ✅ **Bát chống rung 30,5×30,5** | Mặt trên bắt stack chuẩn 30,5, mặt dưới bắt vào lỗ có sẵn của tấm trên. Vừa nối được hai chuẩn, vừa cách ly rung. |
| ❌ Khoan thêm lỗ trên khung | Đế S500 có đồng đúc chìm — xem GIAI ĐOẠN 26. |
| ❌ Bắt cứng stack vào khung | Truyền thẳng rung 4 motor vào cảm biến gia tốc. |

Vì sao bắt cứng là sai ngay cả khi lỗ có khớp — số liệu từ tài liệu ArduPilot:

```text
rung < 30 m/s²   chấp nhận được
rung > 30 m/s²   bắt đầu có thể gặp sự cố
rung > 60 m/s²   gần như luôn hỏng phần giữ độ cao và giữ vị trí
```

Triệu chứng khi vượt ngưỡng: bật AltHold thì drone **tự trôi lên hoặc tụt xuống**
dù không đụng cần ga; bật Loiter thì trôi ngang. Đúng hai chế độ mà cả đề tài
phụ thuộc vào.

Cố định mặt dưới của bát vào khung, theo thứ tự ưu tiên:

```text
1. Bắt ốc vào lỗ CÓ SẴN trên tấm trên          ← tốt nhất, không khoan gì
2. Bang keo xop hai mat day 1-2mm (3M VHB)     <- ArduPilot khuyen nghi, VA day
                                                  cung la cach bang dung trong
                                                  ban dung tham chieu S500 cua
                                                  Holybro. Dan KIN ca mat,
                                                  khong dan 4 goc.
3. Dây rút qua lỗ có sẵn                        ← siết vừa đủ; siết quá tay
                                                  ép chết cao su là mất tác dụng
```

**Không bắt ốc xuyên qua bát chống rung xuống thẳng khung** — làm vậy là nối cứng
trở lại, 4 quả cao su mất sạch tác dụng.

---

# GIAI ĐOẠN 32 — FLASH ARDUPILOT

Không dùng Betaflight cho project này.

Target:

```text
speedybeef4v5
```

Bản chính thức: Copter stable **4.7.1**, tải tại
`https://firmware.ardupilot.org/Copter/stable/speedybeef4v5/`.

**Lần nạp ĐẦU TIÊN khác mọi lần sau — đây là chỗ người mới hay tắc.**

Bo xuất xưởng chạy Betaflight. Mission Planner **không** nhận được bo đang chạy
Betaflight, nên lần đầu phải nạp qua chế độ DFU của chip:

```text
LẦN ĐẦU  (bo còn firmware Betaflight)
  giữ nút BOOT trên FC → cắm USB → thả nút
  máy hiện thiết bị "STM32 BOOTLOADER" / "DFU in FS Mode"
  nạp file  arducopter_with_bl.hex   bằng công cụ DFU
                    ↓
NHỮNG LẦN SAU  (bo đã có ArduPilot)
  Mission Planner → Setup → Install Firmware
  hoặc nạp file  arducopter.apj
```

Chi tiết từng cú click, kể cả cách cài driver khi Windows không nhận DFU:
[docs/huong-dan-bat-dau-tu-con-so-0.md](docs/huong-dan-bat-dau-tu-con-so-0.md).

Sau flash:

```text
Mission Planner
↓
connect USB
↓
verify ArduCopter
```

Ngay lập tức:

```text
Save parameter backup
```

File:

```text
params/
00-after-flash.param
```

## ArduPilot CÓ SẴN file tham số tinh chỉnh cho đúng khung S500 — dùng, nhưng dùng một phần

ArduPilot xuất bản một trang khung tham chiếu riêng cho Holybro S500
(`ardupilot.org/copter/docs/reference-frames-holybro-s500.html`) kèm file
`Holybro-S500.param`, nạp được thẳng từ Mission Planner: `Config/Tuning` →
`Full Parameter Tree` → chọn `Holybro-S500` ở ô drop-down.

Khung tham chiếu của họ: **S500 V2 + motor 2216-880kv + cánh 1045 + pin 3S/4S
3300–5300mAh**. Gần như trùng khít với bản dựng của bạn — khác mỗi FC và ESC.

**Lấy phần này** (giá trị PID và lọc rung đã tinh chỉnh thật cho đúng khung + motor
+ cánh này; tự dò lại từ đầu tốn hàng chục chuyến bay):

```text
ATC_ACC_P_MAX 700 · ATC_ACC_R_MAX 700 · ATC_ACC_Y_MAX 120
ATC_ANG_PIT_P 11 · ATC_ANG_RLL_P 11 · ATC_ANG_YAW_P 7.2
ATC_RAT_PIT_P/I 0.110 · ATC_RAT_PIT_D 0.003
ATC_RAT_RLL_P/I 0.110 · ATC_RAT_RLL_D 0.003
ATC_RAT_YAW_P 0.31 · ATC_RAT_YAW_I 0.031 · ATC_RAT_YAW_FLTE 1
INS_GYRO_FILTER 40
MOT_SPIN_ARM 0.07 · MOT_SPIN_MIN 0.09 · MOT_THST_HOVER 0.25
MOT_BAT_VOLT_MAX 16.8 · MOT_BAT_VOLT_MIN 13.2      ← đúng cho 4S
EK3_DRAG_BCOEF_X 80 · EK3_DRAG_BCOEF_Y 54 · EK3_DRAG_MCOEF 0.11
```

**TUYỆT ĐỐI KHÔNG lấy phần này** — đây là chân ADC của **Pix32v5**, không phải của
F405 V5. Nạp cả file là bộ đo pin đọc ra số vô nghĩa, và battery failsafe sẽ hoặc
không bao giờ kích hoạt, hoặc kích hoạt liên tục:

```text
                   file Holybro-S500     ĐÚNG cho F405 V5
BATT_VOLT_PIN      0                     11
BATT_CURR_PIN      1                     15
BATT_VOLT_MULT     18.182                11.2
BATT_AMP_PERVLT    39.877                phải tự hiệu chỉnh (GIAI ĐOẠN 48)
```

`FRAME_TYPE,1` trong file cũng vẫn phải kiểm chứng bằng Motor Test như GIAI ĐOẠN 33.
`BATT_LOW_VOLT,14` của họ thì lấy nguyên — GIAI ĐOẠN 48 dùng đúng con số này.

**Cách làm an toàn:** nạp cả file trước, rồi **sửa lại 4 tham số BATT_\* ở trên**,
rồi `Write Params`, rồi lưu thành `params/01-base.param`. Đừng nạp file rồi quên
bước sửa.

---

# GIAI ĐOẠN 33 — FRAME TYPE

Mission Planner → `Setup` → `Mandatory Hardware` → `Frame Type`:

```text
Frame Class → Quad
Frame Type  → X          ← ĐẶT TẠM, phải kiểm chứng ở GIAI ĐOẠN 42/43
```

**Cảnh báo riêng cho stack FPV: đừng tin `X` cho tới khi Motor Test xác nhận.**

ArduPilot có hai kiểu đánh số motor khác nhau cho cùng hình chữ X:

```text
QUAD X  (chuẩn ArduPilot)      QUAD X (BETAFLIGHT)
  motor 1 = trước-PHẢI           motor 1 = sau-PHẢI
  motor 2 = sau-TRÁI             motor 2 = trước-PHẢI
  motor 3 = trước-TRÁI           motor 3 = sau-TRÁI
  motor 4 = sau-PHẢI             motor 4 = trước-TRÁI
```

Pad M1–M4 in trên ESC 4-in-1 là thứ tự của thế giới Betaflight. Nếu thứ tự thực tế
không khớp `Frame Type` đang đặt thì **drone lật úp ngay giây đầu tiên nhấc lên** —
đây là nguyên nhân số một làm gãy cánh ở lần bay đầu, không phải hạ cánh mạnh.

Cách kiểm chứng (không tốn đồng nào, làm ở GIAI ĐOẠN 42):

```text
Mission Planner → Setup → Optional Hardware → Motor Test → 5-10% throttle

Test A phải quay motor TRƯỚC-PHẢI
Test B phải quay motor SAU-PHẢI          ← thứ tự đi THEO CHIỀU KIM ĐỒNG HỒ,
Test C phải quay motor SAU-TRÁI             bắt đầu từ motor đầu tiên bên phải
Test D phải quay motor TRƯỚC-TRÁI           của hướng mũi

Đúng cả 4  → giữ Frame Type = X
Sai thứ tự → đổi Frame Type sang "X (Betaflight)" rồi test lại
```

Không gắn prop. Không đoán. Không bỏ qua bước này.

---

# GIAI ĐOẠN 34 — RECEIVER FLYSKY

Dùng:

```text
FS-i6X
+
iA6B
```

Bắt buộc dùng:

```text
iBUS
```

**Không phải lựa chọn ưu tiên — là lựa chọn duy nhất.** Tài liệu ArduPilot cho board
này ghi nguyên văn: *"PPM is not supported."* Cổng PPM của iA6B cắm vào sẽ không
bao giờ lên. SBUS thì bo có hỗ trợ nhưng phải **hàn nối một jumper pad**, mà iA6B
đã sẵn i-BUS nên không có lý do gì đụng vào.

Đấu dây — dùng sợi cáp receiver SH1.0 4 chân có sẵn trong hộp Deluxe:

```text
iA6B cổng "i-BUS" (KHÔNG phải cổng PPM, KHÔNG phải servo 1..6)
       │
       ├── signal ──→  R6   (chân UART6_RX của FC)
       ├── 5V     ──→  5V
       └── GND    ──→  GND
```

Không nối signal vào T6. Sau khi cắm, đặt tham số:

```text
SERIAL6_PROTOCOL = 23   (RCIN)   ← V5 đã đặt sẵn mặc định, chỉ cần kiểm tra lại
RSSI_TYPE        = 3            (nếu muốn đọc cường độ sóng từ i-BUS)
```

ArduPilot tự dò giao thức RC trên chân này, không phải khai báo "iBUS" ở đâu cả.
Ghi nhớ cho tương lai: nếu sau này đổi sang bộ thu ELRS thì **vẫn cắm đúng chân
R6**, chỉ đổi phần mềm — nhưng phải đổi cả tay phát, vì FS-i6X không ghép được
với bộ thu ELRS (hai chuẩn sóng khác nhau: AFHDS-2A vs ELRS).

---

# GIAI ĐOẠN 35 — RADIO CALIBRATION

Mission Planner:

```text
Radio Calibration
```

Di chuyển:

```text
Throttle
Yaw
Pitch
Roll
Switches
```

Kiểm tra:

```text
stick giữa
≈ center

full left/right
≈ full range
```

ArduPilot yêu cầu radio calibration trước các bước như ESC calibration.

---

# GIAI ĐOẠN 36 — MAP SWITCH RC

Mình đề xuất:

```text
SWC 3-position

1 = Stabilize
2 = Loiter
3 = Auto
```

Một switch khác:

```text
SWD
=
RTL override
```

Một switch nữa sau này có thể dùng:

```text
WEB CONTROL ENABLE
```

Ý tưởng là:

```text
web không được tự nhiên giành quyền
```

mà operator phải chủ động bật quyền web.

---

# GIAI ĐOẠN 37 — GPS + COMPASS

Đây là **món khó đấu nhất của cả bản dựng**, vì hai đầu dùng hai họ giắc khác nhau
và thứ tự chân ngược nhau. Phải cắt và bấm lại dây — không có cách tránh.

## Bên trong module GPS luôn là HAI thiết bị

Đây là gốc rễ của mọi nhầm lẫn về số chân:

| Thiết bị | Nhiệm vụ | Đường truyền | Dây |
|---|---|---|---|
| Chip GPS u-blox M10 | drone đang ở toạ độ nào | UART | TX, RX |
| La bàn IST8310 | mũi drone quay hướng nào | I2C | SDA, SCL |
| Nguồn chung | nuôi cả hai | — | VCC, GND |

Cộng lại đúng **6 dây**. Cáp 10 chân của bản V1 mang đúng 6 tín hiệu đó cộng 4 chân
thừa (safety switch, LED, 3V3, buzzer) — **cắt bỏ 4 chân đó không mất gì**, vì
F405 V5 không có cổng cho chúng.

## Sơ đồ đấu — Holybro M10 v1 (10 chân) → SpeedyBee F405 V5

```text
HOLYBRO M10 v1              SPEEDYBEE F405 V5
đầu JST-GH 1,25mm           cổng GPS JST-SH 1,0mm, 6 chân (mặt trước)
thứ tự: VCC RX TX SCL SDA   thứ tự: GND 4V5 T4 R4 SDA SCL
        ...NC×4... GND

  chân 1  VCC  ───────────────→  4V5
  chân 2  RX   ───────┐
  chân 3  TX   ──┐    └───────→  T4      ← BẮT CHÉO
  chân 4  SCL  ──│──┐  ┌──────→  R4      ← BẮT CHÉO
  chân 5  SDA  ──│──│──│───┐
  chân 6..9 NC ──│──│──│───│───  CẮT BỎ
  chân cuối GND ─│──│──│───│──→  GND
                 └──│──│───│──→  R4  (GPS TX → FC RX)
                    └──│───│──→  SCL
                       └───│──→  (đã nối T4 ở trên)
                           └──→  SDA
```

Viết lại cho gọn, nối **theo TÊN TÍN HIỆU, không theo màu dây**:

```text
GPS VCC  → FC 4V5
GPS GND  → FC GND
GPS TX   → FC R4      ← chéo
GPS RX   → FC T4      ← chéo
GPS SCL  → FC SCL
GPS SDA  → FC SDA
4 chân NC → cắt bỏ
```

Cáp phía FC: dùng sợi **"Dây GPS SH1.0 6pin 120mm + đầu rời"** có sẵn trong hộp
Deluxe. "Đầu rời" chính là vỏ giắc trống để bạn cắm lại thứ tự chân cho khớp.

## Ba lỗi kinh điển ở bước này

```text
1. Nối TX→TX (quên bắt chéo)
   Triệu chứng: GPS vẫn sáng đèn bình thường, Mission Planner báo "No GPS".
   Không hỏng gì, chỉ là không bao giờ lên. Đây là chỗ kiểm tra ĐẦU TIÊN.

2. Không đo điện áp chân nguồn
   Holybro yêu cầu 4,7–5,2V; chân cổng GPS của bo ghi là "4V5". Trên giấy là
   hơi thấp. Cắm pin rồi ĐO chân đó bằng đồng hồ:
       ≥ 4,7V  → dùng bình thường
       < 4,7V  → hàn riêng dây đỏ sang pad 5V, giữ nguyên 5 dây còn lại

3. Đặt GPS thấp và gần dây nguồn
   Dòng 58A của motor sinh từ trường lấn át từ trường Trái Đất → la bàn sai →
   bật Loiter là drone bay vòng tròn mỗi lúc một rộng. Lỗi kinh điển của người mới,
   và nó KHÔNG báo lỗi gì cả.
```

## Vị trí đặt GPS

```text
dùng CỘT NÂNG đã mua (bắt buộc, không bỏ qua)
cao hơn mặt khung ≥ 8–10 cm
xa: dây nguồn pin, ESC, motor
ĐÁNH DẤU mũi tên trên vỏ GPS hướng CÙNG chiều mũi FC
```

Nếu buộc phải xoay module, khai báo `COMPASS_ORIENT`, đừng tự nhớ offset.

## Tham số kiểm tra sau khi cắm

```text
SERIAL4_PROTOCOL = 5     GPS   ← V5 đặt sẵn mặc định
GPS1_TYPE        = 1     AUTO
COMPASS_USE      = 1
```

PASS khi Mission Planner hiện `GPS: 3D Fix`, `HDOP < 1.5`, số vệ tinh ≥ 9, **ngoài
trời, sau 1–2 phút đầu**. Trong nhà không bao giờ có fix — đừng tưởng là hỏng.

---

# GIAI ĐOẠN 38 — ACCELEROMETER CALIBRATION

Mission Planner:

```text
Accelerometer Calibration
```

Làm chính xác các orientation mà Mission Planner yêu cầu.

Không cầm lắc drone khi app đang lấy sample.

---

# GIAI ĐOẠN 39 — COMPASS CALIBRATION

Ra ngoài.

Tránh:

```text
bàn sắt
laptop
loa
nguồn lớn
xe hơi
```

ArduPilot cảnh báo không calibrate compass gần vật kim loại hoặc nguồn từ trường.

Xoay drone đủ hướng.

### PASS

Mission Planner không báo compass calibration error.

---

# GIAI ĐOẠN 40 — ESC SIGNAL

Logical:

```text
FC M1 → ESC motor 1 signal
FC M2 → ESC motor 2 signal
FC M3 → ESC motor 3 signal
FC M4 → ESC motor 4 signal
```

SpeedyBee có M1–M4 output riêng.

---

# GIAI ĐOẠN 41 — TUYỆT ĐỐI THÁO PROP

Từ đây đến khi motor direction hoàn tất:

```text
NO PROPELLERS
```

ArduPilot cũng yêu cầu bỏ prop khi ESC calibration/motor test.

---

# GIAI ĐOẠN 42 — MOTOR TEST

Mission Planner:

```text
Motor Test
```

Test:

```text
Motor A
Motor B
Motor C
Motor D
```

Kiểm tra:

```text
button A
→ đúng motor?

button B
→ đúng motor?
```

Nếu sai:

**sửa wiring/output mapping.**

Không nghĩ:

> “bay thử xem sao.”

---

# GIAI ĐOẠN 43 — MOTOR DIRECTION

Kiểm tra direction.

Nếu motor brushless quay ngược:

```text
đổi bất kỳ 2 trong 3 dây motor
```

ArduPilot cũng hướng dẫn đảo hai trong ba dây ESC–motor để đổi chiều với ESC dạng này.

---

# GIAI ĐOẠN 44 — KHÔNG CALIBRATE ESC. ĐẶT DSHOT.

**Giai đoạn này đã đổi hoàn toàn so với bản kế hoạch cũ.**

Bản cũ viết cho ESC 30A rẻ chạy PWM analog — loại đó phải "dạy" cho ESC biết đâu
là ga thấp nhất và cao nhất, gọi là ESC calibration. ESC **OX32 trong stack là ESC
32-bit chạy DShot**, tín hiệu số. Với DShot:

```text
KHÔNG có dải ga để hiệu chỉnh  → KHÔNG có bước ESC calibration
Làm theo quy trình cũ (kéo ga hết cỡ rồi cắm pin) là VÔ NGHĨA và NGUY HIỂM
```

Thay vào đó, đặt đúng một tham số:

```text
MOT_PWM_TYPE = 6        (DShot600)
```

Rồi reboot bo bay. Kiểm tra bằng Motor Test (chưa lắp cánh): cả 4 motor phải
khởi động **mượt và gần như cùng lúc** ở 5–10%.

## Nếu muốn dùng ESC telemetry (khuyến khích, làm sau)

OX32 có xuất telemetry, và hwdef của V5 đã gán sẵn **SERIAL5 = ESC Telemetry,
19200 baud**. Bật lên thì có RPM thật của từng motor → dùng cho harmonic notch
lọc rung, giúp Loiter mượt hơn nhiều. Để sau khi bay ổn định.

## RỦI RO THẬT PHẢI TEST Ở BƯỚC NÀY — desync

ESC 55A này thiết kế cho drone đua: motor nhỏ, quay rất nhanh. Motor AIR2216II của
bạn to và quay chậm (~7.900 vòng/phút ở ga đầy, so với 25.000+ của drone đua). Cặp
này đôi khi bị **mất đồng bộ (desync)**: motor đang quay thì khựng lại. Trên không,
desync một motor là rơi.

```text
QUY TRÌNH TEST DESYNC — làm trước khi ra ngoài trời

1. Kẹp chặt drone xuống bàn (dây rút / kẹp chữ C). CHƯA LẮP CÁNH.
2. Motor Test, đẩy ga TỪ TỪ: 10% → 20% → 30% → 50%
3. NGHE. Tiếng phải là tiếng rít đều, lên đều theo ga.
4. Nghe thấy "khục", giật, hoặc motor tự dừng rồi chạy lại
   → ĐÂY LÀ DESYNC. Không bay. Xử lý trước:
     - hạ MOT_PWM_TYPE xuống 4 (DShot150) hoặc 5 (DShot300) rồi test lại
     - kiểm tra lại 12 mối hàn dây motor — mối hàn nguội cũng gây triệu chứng này
     - nếu vẫn còn, phải chỉnh timing trong phần mềm cấu hình ESC
5. Thử cả 4 motor riêng, rồi thử tăng ga đột ngột (mô phỏng gượng gió)
```

Nếu một motor start rất muộn hoặc khựng: **không gắn prop.**

---

# GIAI ĐOẠN 45 — PRE-ARM CHECK

Không disable hàng loạt pre-arm check chỉ để:

```text
"cho nó arm được"
```

Sửa nguyên nhân.

ArduPilot có pre-arm check cho:

```text
RC
GPS
Compass
Barometer
Battery
EKF
```

và nhiều subsystem khác.

---

# GIAI ĐOẠN 46 — FAILSAFE RC

Test khi **không có prop**.

```text
FC powered
RC connected
↓
turn transmitter OFF
```

Mission Planner phải nhận ra:

```text
Radio failsafe
```

Copter hỗ trợ radio failsafe riêng khi mất liên lạc transmitter–receiver.

Sau đó bật transmitter lại.

---

# GIAI ĐOẠN 47 — GCS FAILSAFE

Sau này web điều khiển qua MAVLink.

Config để nếu mất GCS:

```text
RTL
```

cho phiên bản demo đầu tiên.

ArduPilot GCS failsafe theo dõi MAVLink heartbeat; timeout mặc định được tài liệu hiện tại ghi là 5 giây và có thể cấu hình RTL/Land/SmartRTL tùy parameter.

Test trên bench trước.

---

# GIAI ĐOẠN 48 — BATTERY FAILSAFE

Battery failsafe chỉ đáng tin khi bo đọc điện áp đúng. Làm theo đúng thứ tự:
**hiệu chỉnh trước, đặt ngưỡng sau.**

## Bước 1 — tham số mặc định của V5 (kiểm tra, đừng đoán)

```text
BATT_MONITOR   = 4       Analog Voltage and Current
BATT_VOLT_PIN  = 11
BATT_CURR_PIN  = 15
BATT_VOLT_MULT = 11.2
BATT_AMP_PERVLT = 1      ← GIÁ TRỊ NÀY GẦN NHƯ CHẮC CHẮN SAI, phải hiệu chỉnh
```

## Bước 2 — hiệu chỉnh điện áp bằng đồng hồ vạn năng

```text
cắm pin → đọc điện áp trên Mission Planner
        → đo điện áp thật ở đầu XT60 bằng đồng hồ
        → lệch > 0,1 V thì sửa:

BATT_VOLT_MULT mới = BATT_VOLT_MULT cũ × (điện áp đo được / điện áp MP hiện)
```

Lặp lại tới khi hai số khớp nhau trong khoảng 0,05 V.

## Bước 3 — ngưỡng cho pin 4S 5300mAh (KHÔNG phải 3S)

Bản kế hoạch cũ ghi `Low ≈ 10.5 V`, đó là ngưỡng cho pin **3S** của khung F450.
Dự án này dùng **4S** — dùng số cũ thì pin cạn kiệt tới mức hỏng mà failsafe
chưa hề kích hoạt.

```text
Số cell:          4
Nghỉ đầy:         16,8 V   (4,20 V/cell)
Nghỉ an toàn hết: 14,8 V   (3,70 V/cell) — điểm nên hạ cánh
Dưới tải:         sụt thêm 0,3–0,6 V so với lúc nghỉ

BATT_LOW_VOLT      = 14.0      (3,50 V/cell dưới tải) → cảnh báo + RTL
BATT_CRT_VOLT      = 13.2      (3,30 V/cell dưới tải) → LAND ngay
BATT_FS_LOW_ACT    = 2         RTL
BATT_FS_CRT_ACT    = 1         LAND
BATT_LOW_TIMER     = 10        giây, tránh báo giả khi tăng ga đột ngột
```

`BATT_LOW_VOLT = 14.0` là đúng con số trong `Holybro-S500.param` chính hãng của
ArduPilot, nên dùng nó thay vì tự nghĩ ra ngưỡng khác. Muốn nương pin hơn nữa thì
nâng lên 14.4 / 13.6 (3,60 / 3,40 V/cell) — đổi lại mỗi chuyến bay ngắn hơn khoảng
một phút. Với giới hạn `MAX_DISTANCE_HOME = 50 m` của dự án thì RTL tốn rất ít năng
lượng, nên 14.0 đã dư biên.

Cộng thêm ngưỡng theo dung lượng sau khi đã hiệu chỉnh xong `BATT_AMP_PERVLT`:

```text
BATT_CAPACITY   = 5300
BATT_FS_LOW_MAH = 1060      (dùng tối đa 80% → chừa 20% cho tuổi thọ pin)
```

**Không copy ngưỡng khi số đọc còn sai.** Sai số đọc + ngưỡng đúng = drone rơi vì
tưởng còn pin, hoặc RTL giữa chừng vì tưởng hết pin.

---

# GIAI ĐOẠN 49 — GẮN PROP

Chỉ làm khi:

```text
✓ motor order
✓ motor direction
✓ radio
✓ GPS
✓ compass
✓ accelerometer
✓ ESC
✓ failsafe
✓ pre-arm
```

đều pass.

Lắp đúng:

```text
CW prop
CCW prop
```

theo motor tương ứng.

---

# GIAI ĐOẠN 50 — FIRST FLIGHT: CHỈ RC

Chưa camera.

Chưa ESP32.

Chưa web.

Sân:

```text
rộng
không người
không xe
không cây gần
```

Test:

```text
STABILIZE
```

Takeoff khoảng:

```text
0.5–1m
```

Hover ngắn.

Land.

Không bay mission ngay.

---

# GIAI ĐOẠN 51 — ĐỌC LOG SAU FIRST HOP

Không chỉ nói:

> “bay được rồi.”

Kiểm tra:

```text
vibration
attitude
GPS
battery
EKF
motor outputs
```

Nếu rung quá lớn:

```text
balance prop
check motor shaft
check frame
check FC mount
```

---

# GIAI ĐOẠN 52 — ALTITUDE HOLD

Sau khi Stabilize ổn:

```text
AltHold
```

Takeoff.

Giữ:

```text
~1–2m
```

Đánh giá:

```text
altitude drift
vertical oscillation
```

---

# GIAI ĐOẠN 53 — LOITER

Ra ngoài GPS tốt.

```text
Loiter
```

Takeoff.

Không động stick.

Quan sát:

```text
UAV giữ vị trí?
drift?
toilet bowl?
```

Nếu Loiter quay vòng:

không đi Auto.

Kiểm tra:

```text
compass
GPS
vibration
orientation
```

---

# GIAI ĐOẠN 54 — RTL

Đặt RTL altitude phù hợp khu vực test.

Bay ra:

```text
10–20 m
```

Gạt RTL.

Drone phải:

```text
return home
↓
land theo config
```

### CỔNG PASS

**Không phát triển Auto Mission thật trước khi RTL đã được test thành công.**

---

# GIAI ĐOẠN 55 — AUTO MISSION BẰNG MISSION PLANNER TRƯỚC

Đừng dùng web của mình ngay.

Mission Planner vốn hỗ trợ tạo waypoint point-and-click và chạy mission.

Mission đầu:

```text
Takeoff 3m
↓
WP1
↓
WP2
↓
RTL
```

Khoảng cách nhỏ.

Sau đó:

```text
square 4 waypoint
```

Nếu Mission Planner mission không ổn:

web chắc chắn không cứu được.

---

# GIAI ĐOẠN 56 — ESP32 MAVLINK BRIDGE

Bây giờ mới thêm connection không dây.

Không dùng ESP32-CAM để kiêm bridge.

Dùng:

```text
ESP32 DevKit riêng
```

Logical:

```text
FC UART TX
→ ESP32 UART RX

FC UART RX
← ESP32 UART TX

GND
↔ GND

UBEC 5V
→ ESP32
```

UART của FC và ESP32 đều logic 3.3V, nhưng vẫn phải kiểm tra board/module cụ thể trước khi đấu.

---

# GIAI ĐOẠN 57 — FIRMWARE ESP32 BRIDGE

Firmware chỉ làm:

```text
UART → UDP
UDP → UART
```

Không parse flight logic.

Flow:

```text
FC MAVLink
↓
UART
↓
ESP32
↓
Wi-Fi
↓
UDP
↓
Laptop
```

và chiều ngược lại.

Chọn UDP port ví dụ:

```text
14550
```

---

# GIAI ĐOẠN 58 — TEST MAVLINK BRIDGE TRÊN BÀN

Props tháo.

Không camera.

Laptop:

```text
Mission Planner
↓
UDP
↓
ESP32
↓
FC
```

Phải thấy:

```text
heartbeat
attitude
GPS
mode
```

Sau đó test:

```text
change mode
```

Không test motor command.

---

# GIAI ĐOẠN 59 — ĐỔI BACKEND TỪ SITL SANG DRONE THẬT

Điểm hay là:

```text
backend code
KHÔNG đổi logic
```

chỉ đổi:

```python
MAVLINK_ENDPOINT
```

từ:

```text
udp SITL
```

sang:

```text
udp ESP32
```

Đây chính là lý do ta làm simulation trước.

---

# GIAI ĐOẠN 60 — WEB TELEMETRY VỚI UAV THẬT

Đặt drone trên bàn.

Props tháo.

Website phải hiện:

```text
real GPS
real heading
real mode
real armed status
real battery
```

Cầm drone xoay bằng tay:

```text
heading trên web
phải đổi
```

Nâng drone:

attitude thay đổi.

---

# GIAI ĐOẠN 61 — WEB COMMAND NHƯNG DRONE VẪN TRÊN BÀN

Test:

```text
[RTL]
```

Mission Planner phải thấy mode RTL.

Test:

```text
[LOITER]
```

mode đổi.

Test:

```text
[GUIDED]
```

mode đổi.

Chưa arm.

---

# GIAI ĐOẠN 62 — WEB MISSION UPLOAD DRONE THẬT

Props tháo.

Web:

```text
WP1
WP2
WP3
```

Upload.

Mission Planner:

```text
Download Mission
```

phải nhận đúng ba waypoint.

Đây là test rất quan trọng:

```text
Web GCS
vs
Mission Planner
```

Mission Planner đóng vai trò **oracle** để kiểm tra software mình.

---

# GIAI ĐOẠN 63 — AUTO WEB FLIGHT ĐẦU TIÊN

Chỉ khi Auto bằng Mission Planner đã chạy ổn.

Web mission:

```text
Takeoff 3m
↓
WP1 cách ~5–10m
↓
WP2
↓
RTL
```

RC luôn cầm trong tay.

Sẵn sàng chuyển:

```text
LOITER
hoặc
RTL
```

---

# GIAI ĐOẠN 64 — WEB MANUAL FLIGHT

Chỉ sau Auto Web pass.

Takeoff bằng RC.

Loiter.

Sau đó:

```text
enable Web Control
↓
GUIDED
```

Test từng lệnh:

```text
W
```

rất ngắn.

Sau đó:

```text
S
A
D
R
F
```

Speed đầu tiên:

```text
~0.5 m/s
```

Không 5m/s.

Khi đã ổn:

```text
1 m/s
```

---

# GIAI ĐOẠN 65 — RC OVERRIDE TEST

Trong lúc web Guided:

```text
nhấn W
```

sau đó dùng RC switch:

```text
LOITER
```

Web command phải mất quyền.

Sau đó:

```text
STABILIZE
```

RC lái bình thường.

Đây là test **bắt buộc**.

---

# GIAI ĐOẠN 66 — CAMERA MOUNT

Bây giờ mới gắn ESP32-CAM lên UAV.

In 3D:

```text
camera holder
+
rubber isolation
```

Camera nên gần centerline UAV.

Không đặt quá xa trước mũi làm lệch CG.

---

# GIAI ĐOẠN 67 — CENTER OF GRAVITY

Gắn:

```text
battery
FC
GPS
ESP32
camera
```

sau đó nâng frame ở tâm.

UAV không nên:

```text
chúi mạnh trước
hoặc
ngửa mạnh sau
```

Dịch battery để balance.

---

# GIAI ĐOẠN 68 — KIỂM TRA PAYLOAD

Cân UAV:

```text
without camera
```

sau đó:

```text
with camera
```

Ghi số liệu.

Test hover.

Nếu hover throttle tăng quá nhiều hoặc motor quá nóng:

```text
giảm payload
```

Không cố bay vì:

> “chỉ thêm mấy chục gram.”

---

# GIAI ĐOẠN 69 — CAMERA ON-BOARD STATIC TEST

Không bay.

Camera trên drone.

Motor off.

Stream:

```text
ESP32-CAM
↓
Laptop
```

YOLO.

Kiểm tra:

```text
FPS
latency
packet drop
image quality
```

---

# GIAI ĐOẠN 70 — MOTOR ON TEST

Props tháo.

Motor spin.

Camera stream vẫn chạy.

Kiểm tra:

```text
ESP32 reset?
Wi-Fi disconnect?
image corrupt?
```

Nếu camera reset khi motor chạy:

nghi nguồn/nhiễu.

Đó chính là lý do có dedicated UBEC.

---

# GIAI ĐOẠN 71 — HOVER CAMERA TEST

Bay bằng RC.

Chỉ hover:

```text
2–3m
```

Không YOLO cũng được ở lần đầu.

Record video/frame.

Land.

Kiểm tra:

```text
motion blur
jello
JPEG artifacts
Wi-Fi
```

---

# GIAI ĐOẠN 72 — DATASET UAV THẬT

Bay có kiểm soát:

```text
3m
5m
7m
```

Người:

```text
đứng
đi bộ
ngồi
```

Quay nhiều session khác nhau.

Đây mới là dataset quan trọng nhất.

---

# GIAI ĐOẠN 73 — FINAL FINE-TUNE

Dataset:

```text
VisDrone
+
ground ESP32 dataset
+
airborne ESP32 dataset
```

Train:

```text
Model E
```

Model này mới là:

```text
FINAL DEPLOYMENT MODEL
```

---

# GIAI ĐOẠN 74 — INTEGRATE YOLO VÀ WEB

Pipeline:

```text
ESP32-CAM
↓
stream.py
↓
detector.py
↓
person
↓
events.py
↓
WebSocket
+
MQTT
↓
dashboard
```

Event:

```json
{
  "event": "person_detected",
  "confidence": 0.87,
  "timestamp": "...",
  "uav_lat": 10.123,
  "uav_lon": 106.123,
  "uav_alt": 5.4,
  "snapshot": "detections/....jpg"
}
```

---

# GIAI ĐOẠN 75 — TRÁNH DETECTION SPAM

YOLO 10 FPS có thể tạo:

```text
100 detection events
```

cho cùng một người.

Không làm vậy.

Logic:

```text
person confidence > 0.6
↓
detected ≥ 3 frames liên tiếp
↓
create event
↓
cooldown 3–5 seconds
```

Dashboard chỉ nhận event meaningful.

---

# GIAI ĐOẠN 76 — MQTT

Tạo local broker Mosquitto.

Topic:

```text
uav/telemetry
uav/status
uav/mission
uav/detection/person
uav/link
```

Ví dụ:

```text
uav/detection/person
```

payload:

```json
{
  "confidence": 0.87,
  "altitude": 5.2,
  "lat": 10.123,
  "lon": 106.123
}
```

Như vậy môn IoT có pipeline rất rõ:

```text
Sensor / UAV
↓
Communication
↓
MQTT
↓
Processing
↓
Dashboard
```

---

# GIAI ĐOẠN 77 — DASHBOARD CUỐI

Layout:

```text
┌────────────────────────────────────────────────────────────┐
│ UAV AI CONTROL CENTER                                      │
│                                                            │
│ ● CONNECTED    MODE: AUTO     BATTERY: 74%     GPS: 15    │
│                                                            │
│ ┌─────────────────────┐   ┌──────────────────────────────┐ │
│ │                     │   │                              │ │
│ │ CAMERA              │   │ MAP                          │ │
│ │                     │   │                              │ │
│ │   ┌──────────┐      │   │ HOME ●                      │ │
│ │   │ PERSON   │      │   │      │                      │ │
│ │   │ 0.87     │      │   │      ①────②                 │ │
│ │   └──────────┘      │   │           │                  │ │
│ │                     │   │           ③                  │ │
│ └─────────────────────┘   └──────────────────────────────┘ │
│                                                            │
│ MANUAL                                                     │
│                 ↑                                          │
│              ←  ●  →                                       │
│                 ↓                                          │
│                                                            │
│ [GUIDED] [AUTO] [HOLD] [RTL] [LAND]                       │
│                                                            │
│ EVENT LOG                                                  │
│ 15:41 Person detected 87%                                  │
└────────────────────────────────────────────────────────────┘
```

---

# GIAI ĐOẠN 78 — TEST FAILURE: MẤT CAMERA

Trong flight simulator trước, rồi ground hardware.

Ngắt ESP32-CAM.

Expected:

```text
camera unavailable
```

Nhưng:

```text
telemetry vẫn chạy
control vẫn chạy
UAV không đổi mode
```

Camera không được liên quan tới flight stability.

---

# GIAI ĐOẠN 79 — TEST FAILURE: YOLO CRASH

Kill Python vision process.

Expected:

```text
AI unavailable
```

Nhưng flight subsystem vẫn hoạt động.

---

# GIAI ĐOẠN 80 — TEST FAILURE: WEB CLOSED

Đang Guided simulation.

Đóng browser.

Expected:

```text
manual command timeout
↓
velocity zero
↓
LOITER
```

---

# GIAI ĐOẠN 81 — TEST FAILURE: MAVLINK/WI-FI LOSS

Drone thật:

**đầu tiên test không prop.**

Ngắt ESP32 telemetry.

Expected:

```text
GCS failsafe
↓
configured action
```

Sau khi bench pass mới thử trong điều kiện bay an toàn.

---

# GIAI ĐOẠN 82 — TEST FAILURE: RC LOSS

Không prop trước.

Tắt FlySky.

Expected:

```text
RC failsafe
```

Sau đó mới test thực tế ở môi trường kiểm soát.

---

# GIAI ĐOẠN 83 — GEOFENCE

Trước demo cuối:

```text
maximum altitude
+
maximum radius
```

Dùng geofence.

Website cũng có software geofence nhưng:

```text
ArduPilot geofence
```

mới là lớp authoritative.

---

# GIAI ĐOẠN 84 — TEST MATRIX CUỐI

Bạn phải chạy đủ:

```text
Test 01: RC Stabilize
Test 02: AltHold
Test 03: Loiter
Test 04: RTL
Test 05: Mission Planner Auto
Test 06: Web telemetry
Test 07: Web waypoint
Test 08: Web Auto
Test 09: Web Guided W
Test 10: Web Guided A/S/D
Test 11: Web altitude R/F
Test 12: Web Hold
Test 13: Web RTL
Test 14: RC takes control from Web
Test 15: Camera stream
Test 16: YOLO person
Test 17: Detection MQTT
Test 18: Detection snapshot
Test 19: Wi-Fi loss
Test 20: RC loss
```

Không demo chức năng nào chưa pass standalone test.

---

# GIAI ĐOẠN 85 — EXPERIMENT MÔN XỬ LÝ ẢNH

Bạn nên có tối thiểu 4 experiment.

## Experiment 1 — Domain

```text
COCO pretrained
vs
VisDrone fine-tuned
```

## Experiment 2 — Own camera

```text
VisDrone
vs
VisDrone + ESP32 data
```

## Experiment 3 — Degradation

```text
without augmentation
vs
degradation augmentation
```

## Experiment 4 — Altitude

Test:

```text
3m
5m
7m
```

Metric:

```text
Precision
Recall
mAP50
Confidence
```

---

# GIAI ĐOẠN 86 — EXPERIMENT MÔN IOT

Có thể đánh giá:

```text
MAVLink latency
Camera latency
MQTT latency
Packet loss
Web command response
GPS update rate
```

Ví dụ đo:

```text
keydown W timestamp
↓
backend receive
↓
MAVLink send
```

Không nhất thiết đo motor response chính xác bằng oscilloscope.

---

# GIAI ĐOẠN 87 — LOG MỌI THỨ

Mỗi flight tạo folder:

```text
logs/
└── flight_2026xxxx_xxxx/
    ├── flight.bin
    ├── telemetry.csv
    ├── detections.csv
    ├── events.json
    ├── video/
    ├── snapshots/
    └── notes.md
```

`notes.md`:

```text
Wind:
Battery:
Payload:
Altitude:
Flight mode:
Problems:
Changes since previous flight:
```

Đây sẽ cứu bạn khi viết báo cáo.

---

# GIAI ĐOẠN 88 — PARAMETER VERSIONING

Sau mỗi mốc:

```text
params/
01-base.param
02-radio.param
03-gps.param
04-first-flight.param
05-loiter-good.param
06-auto-good.param
07-final.param
```

Nếu sau này chỉnh sai PID/parameter:

```text
restore previous working state
```

thay vì nhớ bằng đầu.

---

# GIAI ĐOẠN 89 — GIT VERSIONING SOFTWARE

Commit theo từng milestone.

Ví dụ:

```bash
git commit -m "feat: connect backend to SITL"
git commit -m "feat: stream UAV telemetry to web"
git commit -m "feat: add guided velocity control"
git commit -m "feat: add waypoint mission upload"
git commit -m "feat: integrate person detector"
git commit -m "feat: publish detection events via mqtt"
```

Không làm cả tháng rồi commit:

```text
final project
```

---

# GIAI ĐOẠN 90 — THỨ TỰ MUA LINH KIỆN TỐI ƯU

Nguyên tắc gốc: **chỉ bỏ tiền cho chặng sau khi chặng trước đã chứng minh project
còn khả thi.** Bản kế hoạch gốc chia 4 batch theo nguyên tắc đó.

**Thực tế đã đi khác kế hoạch:** batch C (toàn bộ phần cứng bay) đã mua trước, hết
9.661.000 ₫, trong khi batch A (phần mềm) chưa làm. Không sửa được quá khứ, nên
phần dưới là thứ tự **tính từ hôm nay**.

## Batch 0 — NGAY HÔM NAY, ~280k

```text
bát chống rung 30,5×30,5mm
dây silicone 16AWG × 4,5m (3 màu)
gen co nhiệt nhiều cỡ + dây rút 2.5×100
```

Ba nhóm này chặn **toàn bộ** khâu lắp ráp. Đặt trước, vì hàng cần vài ngày về.

## Batch A — 0 đồng, làm trong lúc chờ hàng

```text
Không mua gì
```

Hoàn thành:

```text
SITL
MAVLink backend
Web telemetry
Web Guided
Waypoint
Auto
```

Đây là phần **đáng làm trước nhất** và cũng là phần bị bỏ qua. Nếu web GCS không
điều khiển nổi drone ảo thì nó cũng sẽ không điều khiển nổi drone thật — chỉ khác
là lúc đó sai lầm có giá 9,6 triệu.

## Batch B — hàng batch 0 về thì lắp

```text
Không mua gì (đã có đủ)
```

Hoàn thành:

```text
lắp khung + motor + stack
nạp firmware speedybeef4v5
hiệu chỉnh, motor test, desync test
RC flight → AltHold → Loiter → RTL
Auto mission bằng Mission Planner
```

## Batch C — camera, ~380k, chỉ mua khi Loiter đã ổn định

```text
ESP32-CAM + mạch nạp
ESP32 DevKit (cầu MAVLink Wi-Fi)
UBEC 5V 3A
```

Hoàn thành:

```text
camera, YOLO, dataset, augmentation
web telemetry với drone thật
integration
```

## Batch D — hao mòn, mua khi cần

```text
cánh 1045 thay thế       (thứ hỏng nhiều nhất)
pin 4S thứ hai           (mua đúng cùng loại Ovonic để 2 viên giống hệt)
1 motor AIR2216II dự phòng (nhớ chọn đúng chiều ren)
```

---

# GIAI ĐOẠN 91 — ĐỊNH NGHĨA “PROJECT ĐÃ HOÀN THÀNH”

Đừng dùng tiêu chí:

```text
code xong
```

Project hoàn thành khi scenario này chạy được:

```text
1. Bật transmitter.
2. Cấp nguồn UAV.
3. UAV GPS lock.
4. Laptop kết nối telemetry.
5. Web hiện UAV trên bản đồ.
6. Camera online.
7. AI online.
8. Pilot arm bằng quy trình an toàn.
9. Takeoff.
10. Chuyển Loiter.
11. Web upload mission.
12. Start Auto.
13. UAV bay WP1 → WP2 → WP3.
14. Camera phát hiện người.
15. YOLO tạo bounding box.
16. Detection event gửi MQTT.
17. Dashboard hiện:
      PERSON DETECTED
      confidence
      UAV GPS
      altitude
      snapshot.
18. Người vận hành nhấn Hold.
19. Dùng WASD điều khiển một đoạn.
20. Chuyển lại RC.
21. Nhấn RTL.
22. UAV quay về và land.
23. Log được lưu.
```

Nếu chạy được scenario trên:

# ĐỒ ÁN ĐÃ THÀNH CÔNG.

---

# GIAI ĐOẠN 92 — SAU KHI VERSION 1 XONG MỚI PHÁT TRIỂN VERSION 2

Thứ tự nâng cấp mình đề xuất:

```text
V1
Person Detection
+
Waypoint
+
Web manual
+
RC
+
IoT
```

↓

```text
V1.1
better camera
```

↓

```text
V1.2
SiK telemetry
```

↓

```text
V1.3
Raspberry Pi / Edge AI
```

↓

```text
V2
AI detection
↓
auto HOLD
```

↓

```text
V2.1
Object tracking
```

↓

```text
V2.2
Target geolocation
```

↓

```text
V3
AI-assisted autonomous search
```

---

# QUY TẮC VÀNG TRONG SUỐT DỰ ÁN

Mỗi chức năng phải đi theo:

```text
SIMULATION
     ↓
BENCH TEST
     ↓
GROUND TEST
     ↓
LOW ALTITUDE FLIGHT
     ↓
FULL DEMO
```

Không bao giờ:

```text
CODE XONG
↓
CHO DRONE BAY THỬ
```

Và mỗi lần thêm một subsystem mới:

```text
camera
ESP32
GPS
web
AI
```

phải xác nhận subsystem cũ **vẫn chạy như trước**.

Đó là cách giữ một project nhiều thành phần như thế này không biến thành một đống lỗi không biết bắt đầu debug từ đâu.