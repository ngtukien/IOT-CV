# UAV IoT + Autonomous Waypoint + Manual Control + AI Person Detection — Implementation Plan

[![ci](https://github.com/ngtukien/IOT-CV/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ngtukien/IOT-CV/actions/workflows/ci.yml)
[![python](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue)](pyproject.toml)
[![lint](https://img.shields.io/badge/lint-ruff-261230)](https://docs.astral.sh/ruff/)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![safety](https://img.shields.io/badge/safety-SAFETY.md-red)](SAFETY.md)

> **Mục tiêu:** xây một quadcopter ngân sách khoảng 5–6 triệu có thể bay thủ công bằng RC, nhận lệnh thủ công từ web, bay tự động theo waypoint, RTL/Hold/Land, truyền telemetry về laptop và dùng camera giá rẻ để phát hiện người bằng YOLO; đồng thời biến hạn chế camera thành nội dung nghiên cứu cho môn Xử lý ảnh.

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
 SpeedyBee F405       ESP32-CAM         ESP32 DevKit
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

SpeedyBee F405 V4 có barometer tích hợp, đầu ra motor M1–M8, I2C, nhiều UART và nhận nguồn LiPo 3S–6S; ArduPilot hiện vẫn phát hành firmware Copter stable riêng cho `speedybeef4v4`.

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

# GIAI ĐOẠN 24 — BÂY GIỜ MỚI MUA TOÀN BỘ FLIGHT HARDWARE

Bộ cơ bản:

```text
F450
4 × A2212
4 × 30A ESC
prop 1045
SpeedyBee F405 V4
M10 GPS + Compass
FS-i6X
iA6B
3S LiPo
charger
ESP32 DevKit
ESP32-CAM
5V UBEC
buzzer
dây
XT60
```

Mua thêm:

```text
2–4 cánh dự phòng
```

Đừng mua đúng 4 cánh.

---

# GIAI ĐOẠN 25 — KHÔNG LẮP NGAY, TEST TỪNG LINH KIỆN

## Motor

Từng motor kiểm tra:

```text
shaft thẳng?
bearing kêu?
dây có đứt?
nam châm cạ?
```

## ESC

Không cháy, không biến dạng.

## FC

USB nhận board.

## GPS

Không vỡ antenna ceramic.

## Receiver

Bind được FlySky.

## LiPo

Kiểm tra điện áp từng cell bằng charger/battery checker.

Không dùng pin:

```text
phồng
rách
dây lỏng
cell lệch bất thường
```

---

# GIAI ĐOẠN 26 — LẮP FRAME F450

Lắp:

```text
arm 1
arm 2
arm 3
arm 4
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

F450 PDB:

```text
            LiPo 3S
               │
             XT60
               │
               ▼
          F450 Power Board
        ┌──────┼──────┬──────┐
        ↓      ↓      ↓      ↓
      ESC1   ESC2   ESC3   ESC4
        │      │      │      │
      Motor1 Motor2 Motor3 Motor4
```

Thêm:

```text
F450 PDB
   │
   ├── BAT/GND → SpeedyBee FC
   │
   └── UBEC 5V → ESP32 systems
```

SpeedyBee F405 V4 chính thức nhận LiPo 3S–6S ở BAT/GND và có onboard 5V/9V BEC; tuy nhiên mình vẫn tách camera/ESP32 sang UBEC riêng để giảm khả năng nhiễu/reset từ tải camera.

---

# GIAI ĐOẠN 29 — QUY TẮC ESC CÓ BEC

Nếu ESC của bạn có:

```text
signal
5V red
ground
```

không nối 4 đường 5V BEC song song vào FC nếu nhà sản xuất không cho phép.

Với kiến trúc này:

```text
ESC → FC
chỉ cần:
signal
ground
```

FC đã có nguồn riêng từ LiPo.

Kiểm tra đúng loại ESC thực tế trước khi cắt dây.

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

SpeedyBee đặt:

```text
gần center of frame
```

Mũi tên FC:

```text
hướng về phía trước UAV
```

Nếu buộc phải xoay FC:

```text
phải khai báo board orientation
```

Không tự “nhớ offset”.

FC phải được giảm rung bằng grommet/rubber phù hợp.

Không buộc cứng lên frame bằng kim loại trực tiếp.

---

# GIAI ĐOẠN 32 — FLASH ARDUPILOT

Không dùng Betaflight cho project này.

Target:

```text
speedybeef4v4
```

ArduPilot stable firmware cho board này hiện được phát hành riêng.

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

---

# GIAI ĐOẠN 33 — FRAME TYPE

Mission Planner:

```text
Frame Class
→ Quad

Frame Type
→ X
```

Không gắn prop.

---

# GIAI ĐOẠN 34 — RECEIVER FLYSKY

Dùng:

```text
FS-i6X
+
iA6B
```

Ưu tiên:

```text
iBUS
```

ArduPilot hỗ trợ i-BUS và có thể nhận serial RC từ UART RX; với serial receiver trên UART, port được cấu hình RC input.

Logical wiring:

```text
iA6B
iBUS signal
       ↓
UART RX trên FC

5V
       ↓
5V

GND
       ↓
GND
```

Không nối signal vào TX.

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

Logical wiring:

```text
GPS TX
→ FC RX

GPS RX
→ FC TX

GPS 5V
→ FC 5V/4.5V phù hợp module

GPS GND
→ FC GND
```

Compass:

```text
SDA
→ SDA

SCL
→ SCL
```

SpeedyBee F405 V4 có I2C SDA/SCL riêng và nhiều UART cho GPS/receiver/peripherals.

Đặt GPS:

```text
cao hơn frame
xa:
battery wire
ESC
motor
```

Nếu có thể:

```text
GPS mast in 3D
```

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

# GIAI ĐOẠN 44 — ESC CALIBRATION

Vì bộ ESC 30A rẻ thường sử dụng PWM kiểu truyền thống, nhiều loại cần calibration.

Thứ tự:

```text
Radio calibration
↓
ESC calibration
```

ArduPilot cũng quy định radio calibration phải làm trước ESC calibration.

Sau calibration:

```text
arm
↓
throttle thấp
```

Cả 4 motor phải:

```text
start gần cùng thời điểm
```

Nếu một motor start rất muộn:

không gắn prop.

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

Một lưu ý:

battery failsafe chuẩn của ArduPilot cần battery/power monitor phù hợp.

Nếu phần cứng của bạn đọc voltage chính xác:

có thể bắt đầu tham khảo cho LiPo 3S:

```text
Low ≈ 10.5 V
```

đây cũng là ví dụ mà ArduPilot đưa trong trang battery failsafe.

Nhưng phải kiểm tra:

```text
điện áp Mission Planner
vs
multimeter
```

trước.

Không copy threshold blindly nếu voltage reading sai.

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

Đừng mua toàn bộ ngay ngày đầu.

## Batch A

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

## Batch B

Mua:

```text
ESP32-CAM
```

Hoàn thành:

```text
camera
YOLO
dataset
augmentation
```

## Batch C

Mua:

```text
F450
Motor
ESC
FC
RC
GPS
Battery
Charger
```

Hoàn thành:

```text
RC flight
Loiter
RTL
Auto
```

## Batch D

Mua/thêm:

```text
ESP32 bridge
UBEC
mount
wiring
spare props
```

Hoàn thành integration.

Cách này cực kỳ quan trọng về tài chính:

> Bạn chỉ bỏ tiền cho stage tiếp theo khi stage trước đã chứng minh project vẫn khả thi.

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