# P2 — GCS Lead: SITL + Backend + Web điều khiển

> Đọc trước: [SAFETY.md](../../SAFETY.md) mục 1, 4, 5; [README.md](../../README.md) GĐ 3–15, 57–62, 74, 77–82, 89.
> Kế hoạch chung: [team-plan.md](../team-plan.md)

**Câu bạn phải trả lời được bất cứ lúc nào:**
*"Lệnh từ web tới được flight controller nguyên vẹn, dừng đúng lúc, và người vận hành có thấy được điều đó trên màn hình không?"*

---

## Bạn sở hữu

| Nhóm | Chi tiết |
|---|---|
| **ArduPilot SITL** | Cài, chạy, `scripts/run_sitl.sh` (phối hợp P1), `docs/dev-env.md` |
| **Backend MAVLink** | `backend/mavlink/` — connection, telemetry, control, mission, safety |
| **FastAPI server** | `backend/app.py`, `backend/config.py`, REST + WebSocket API |
| **ESP32 MAVLink bridge** | `esp32/mavlink_bridge/` — firmware UART↔UDP |
| **Web có gửi lệnh** | `frontend/control.js`, `frontend/mission.js`, các nút mode/hold/rtl/land |
| **Tests** | `backend/tests/` |
| **Hạ tầng dự án** | `.github/`, `Makefile`, `requirements*.txt`, `docs/architecture.md` |
| **Vai Checker** | Trong 4 buổi lắp phần cứng trọng điểm: cầm multimeter + đọc checklist to lên |

**Bạn KHÔNG sở hữu:** ArduPilot trên FC thật (P1), web hiển thị thuần túy `ui.js/map.js/video.js` (P3), firmware ESP32-CAM và MQTT (P3), model YOLO (P4).

---

## Vai Checker trong buổi lắp phần cứng

Chỉ 4 buổi cần có mặt đầy đủ (nguồn/FC, calibration, gắn cánh, wiring bridge).

**Việc của P2 trong mỗi buổi:**
```text
1. In checklist trước buổi (lấy từ docs/wiring.md)
2. Đọc từng bước TO lên cho P1 nghe
3. Sau khi P1 đấu dây: đo continuity bằng multimeter
4. Xác nhận to: "BAT+ ↔ GND: không short — OK cắm pin"
5. Không được cắm pin trước khi đọc hết checklist
```

> Bước này quan trọng hơn tất cả code bạn viết — drone cháy ESC vì đấu ngược nguồn, không phải vì bug Python.

---

## Lịch tuần theo tuần

### Phase 0 — Tuần 1: Hợp đồng interface & mock mode

**Mục tiêu:** Cả nhóm có thể làm việc song song mà không chờ nhau.

| Việc | File | Output |
|---|---|---|
| Chạy SITL (theo hướng dẫn P1) | — | CỔNG PASS 3A |
| Viết `docs/architecture.md` | `docs/architecture.md` | 5 hợp đồng interface (xem team-plan.md mục 3) |
| Bật mock mode | `backend/app.py` | `TELEMETRY_AUTOSTART=0` → `/api/status` trả `"mock": true` |
| Chốt requirements | `requirements.txt`, `requirements-dev.txt` | pip install được, CI xanh |
| Viết `docs/dev-env.md` (phần Python) | `docs/dev-env.md` | clone + `make dev` là chạy được |

**5 hợp đồng trong `docs/architecture.md` phải có:**
1. Telemetry JSON schema (field names đóng băng)
2. Danh sách endpoint REST + WebSocket
3. Detection event schema (P4 publish, P3 consume)
4. MQTT topic list (P4 chốt)
5. Camera stream URL format (P4 chốt)

> **Cổng G0:** `docs/architecture.md` đã merge, cả nhóm approve.

---

### Phase 1 — Tuần 2–3: Control API (SITL)

**Mục tiêu:** Backend kết nối SITL, đọc telemetry thật, gửi được lệnh cơ bản.

#### Tuần 2 — Kết nối & telemetry

| Việc | File | CỔNG PASS |
|---|---|---|
| `MavlinkConnection.connect()` | `backend/mavlink/connection.py` | **5A**: Heartbeat nhận được, System ID != null |
| `TelemetryReader` — đọc 6 message type | `backend/mavlink/telemetry.py` | **6A**: Python console in mode/lat/lon/alt/heading thay đổi khi drone ảo di chuyển |
| `GET /api/status`, `WS /ws/telemetry` (~8 Hz) | `backend/app.py` | — |

6 message type cần đọc:
```text
HEARTBEAT → mode, armed
GLOBAL_POSITION_INT → lat, lon, relative_alt, heading
GPS_RAW_INT → satellites_visible
SYS_STATUS → battery_voltage
VFR_HUD → ground_speed
ATTITUDE → (dùng heading từ GLOBAL_POSITION_INT là đủ cho V1)
```

#### Tuần 3 — Control API

| Việc | File | Endpoint |
|---|---|---|
| `set_mode()`, `arm()`, `disarm()` | `backend/mavlink/control.py` | `POST /api/mode`, `/api/arm`, `/api/disarm` |
| `takeoff()`, `land()`, `rtl()`, `loiter()` | `backend/mavlink/control.py` | `POST /api/takeoff`, `/api/land`, `/api/rtl`, `/api/hold` |
| Không viết `send_motor_pwm()` | — | Web không bao giờ điều khiển motor trực tiếp |

> **Cổng G1:** SITL takeoff → altitude trên web tăng; SITL move → lat/lon đổi; marker chạy theo.

---

### Phase 2 — Tuần 4–5: Guided velocity + Dead-man + WASD

**Mục tiêu:** WASD điều khiển drone SITL được, an toàn khi mất kết nối.

#### Guided velocity (GĐ 10)

Dùng `SET_POSITION_TARGET_LOCAL_NED` với `MAV_FRAME_BODY_OFFSET_NED`:

```python
# backend/mavlink/control.py
def send_velocity_body(self, vx, vy, vz):
    """
    vx+ = tiến, vx- = lùi
    vy+ = phải, vy- = trái
    vz+ = xuống (NED!), vz- = lên
    """
    self.master.mav.set_position_target_local_ned_send(
        0,  # time_boot_ms
        self.master.target_system,
        self.master.target_component,
        mavutil.mavlink.MAV_FRAME_BODY_OFFSET_NED,
        0b0000111111000111,  # velocity only
        0, 0, 0,  # pos (ignored)
        vx, vy, vz,  # velocity
        0, 0, 0,  # acc (ignored)
        0, 0  # yaw (ignored)
    )
```

Mapping phím:
```text
W → vx=+1, S → vx=-1
D → vy=+1, A → vy=-1
R → vz=-0.5 (lên), F → vz=+0.5 (xuống)
```

#### Dead-man safety (GĐ 11)

```python
# backend/mavlink/safety.py
class SafetyManager:
    TIMEOUT_MS = 300  # ms không có lệnh → gửi zero velocity

    def on_control_received(self): ...
    def on_ws_closed(self): ...  # gửi zero → LOITER
    def watchdog_loop(self): ...  # chạy background thread
```

**3 test bắt buộc trước khi chạm drone thật:**
```text
✓ nhấn W → SITL tiến
✓ thả W → SITL dừng
✓ đóng browser khi giữ W → SITL phải dừng trong 300ms
```

#### WASD Web (phần P2 viết, không phải P3)

```javascript
// frontend/control.js
document.addEventListener('keydown', e => {
    // gửi lệnh liên tục qua /ws/control
    startSending(e.key);
});
document.addEventListener('keyup', e => {
    // gửi zero velocity
    sendZero();
});
```

> **Cổng G2:** 3 dead-man test trên SITL đều pass. **Không test WASD trên drone thật trước khi G2 pass.**

**Trong Phase 2, P2 còn có vai Checker trong 4 buổi lắp phần cứng.**

---

### Phase 3 — Tuần 6–7: Mission protocol

**Mục tiêu:** Web upload mission → P1 kiểm tra bằng Mission Planner thấy đúng.

#### Validate mission (GĐ 14)

```python
# backend/mavlink/mission.py
def validate(waypoints):
    errors = []
    if len(waypoints) == 0: errors.append("No waypoints")
    for wp in waypoints:
        if wp.alt < 2: errors.append(f"WP{wp.seq}: altitude too low")
        if wp.alt > 10: errors.append(f"WP{wp.seq}: exceeds MAX_ALT=10m")
        if distance(HOME, wp) > 50: errors.append(f"WP{wp.seq}: exceeds MAX_DIST=50m")
    return errors  # [] = OK
```

Giới hạn phần mềm của project:
```python
MAX_ALT = 10    # m
MAX_DIST = 50   # m từ home
MAX_WP = 10
```

#### Upload protocol (GĐ 15)

Đúng thứ tự MAVLink Mission Protocol:
```text
GCS → MISSION_COUNT
FC  → MISSION_REQUEST_INT seq=0
GCS → MISSION_ITEM_INT 0
...
FC  → MISSION_ACK
```

Không tự chế protocol — dùng `pymavlink` helper.

> **Cổng G3:** Web upload 4 điểm → Mission Planner download thấy đúng 4 điểm → SITL bay WP1→WP4.

---

### Phase 4 — Tuần 8–9: ESP32 bridge & đổi endpoint

**Mục tiêu:** Backend kết nối được drone thật qua Wi-Fi.

#### Firmware bridge (GĐ 57)

```cpp
// esp32/mavlink_bridge/main.cpp
// Chỉ làm: UART ↔ UDP, không parse logic
void loop() {
    if (Serial.available()) {
        size_t len = Serial.readBytes(buf, sizeof(buf));
        udp.writeTo(buf, len, laptop_ip, 14550);
    }
    if (udp.available()) {
        size_t len = udp.read(buf, sizeof(buf));
        Serial.write(buf, len);
    }
}
```

#### Đổi endpoint (GĐ 59)

```python
# backend/config.py
# Chỉ thay đúng dòng này:
MAVLINK_ENDPOINT = "udp:192.168.1.xxx:14550"  # IP của ESP32
# Không đổi bất kỳ dòng nào khác trong backend
```

> **Cổng G4:** Đổi endpoint → web thấy GPS/heading/mode/battery thật khi xoay drone bằng tay (props tháo).

---

### Phase 5 — Tuần 10–11: Test failure scenarios

**Mục tiêu:** Mỗi subsystem có thể chết mà không kéo theo phần còn lại.

| Test | GĐ | Expected |
|---|---|---|
| **Camera chết** | 78 | `camera_available: false`, telemetry vẫn chạy, UAV không đổi mode |
| **YOLO crash** | 79 | `ai_available: false`, flight subsystem vẫn hoạt động |
| **Browser đóng** | 80 | velocity → zero → LOITER trong 300ms |
| **Wi-Fi/MAVLink mất** | 81 | GCS failsafe → RTL (bench test không prop trước) |
| **RC mất** | 82 | RC failsafe (bench test không prop trước) |

Mỗi test phải có output ghi vào `docs/test-log.md`.

---

### Phase 6 — Tuần 12: Dọn code & báo cáo

| Việc | Output |
|---|---|
| Git log sạch theo GĐ 89 | Mỗi giai đoạn = 1 commit có message chuẩn |
| Dọn code — xóa debug print, TODO | PR cuối cùng |
| Viết phần backend trong báo cáo | Mô tả MAVLink flow, dead-man, mission protocol |
| Đo latency (GĐ 86, P3 phụ) | keydown → backend receive → MAVLink send |

---

## Interface với các người khác

### P2 → P3 (P3 tiêu thụ API của P2)

P3 không được tự đổi cách gọi API. Nếu cần field mới:
```text
Nhắn P2 trong nhóm chat → P2 thêm vào architecture.md → merge → P3 dùng
```

### P2 → P1 (P1 review safety)

Mọi thay đổi trong `backend/mavlink/`:
- Phải có approve của P1 trước khi merge
- PR phải ghi rõ CỔNG PASS nào đã chạy

### P4 → P2 (P2 review)

Khi P4 ghép vision/mqtt vào backend:
- P4 mở PR vào `backend/vision/`, `backend/mqtt/`
- P2 review để đảm bảo không ảnh hưởng telemetry/control

---

## Cấu trúc thư mục P2 sở hữu

```text
backend/
├── app.py              ← FastAPI server, WebSocket hub
├── config.py           ← MAVLINK_ENDPOINT, giới hạn phần mềm
├── mavlink/
│   ├── connection.py   ← MavlinkConnection
│   ├── telemetry.py    ← TelemetryReader, normalize JSON
│   ├── control.py      ← set_mode, arm, takeoff, velocity, rtl...
│   ├── mission.py      ← validate, upload, download, clear, start
│   └── safety.py       ← SafetyManager, dead-man watchdog
└── tests/
    ├── test_connection.py
    ├── test_telemetry.py
    ├── test_control.py
    ├── test_mission.py
    └── test_safety.py

esp32/
└── mavlink_bridge/
    └── main.cpp        ← UART ↔ UDP bridge

frontend/
├── control.js          ← keydown/keyup → /ws/control
└── mission.js          ← click map → waypoints → upload

docs/
└── architecture.md     ← 5 hợp đồng interface
```
