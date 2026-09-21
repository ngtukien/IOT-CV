# P3 — Embedded & IoT Lead · Hands trong buổi lắp

> Đọc trước: [SAFETY.md](../../SAFETY.md) mục 1, 4; [README.md](../../README.md) GĐ 19–20, 56–57, 69–70, 76–77, 86.
> Kế hoạch chung: [team-plan.md](../team-plan.md)

**Câu bạn phải trả lời được bất cứ lúc nào:**
*"ESP32 bridge có đang chuyển MAVLink không bị mất byte không, và camera có đang stream ổn định không?"*

---

## Bạn sở hữu

| Nhóm | Chi tiết |
|---|---|
| **ESP32 MAVLink bridge** | `esp32/mavlink_bridge/` — UART↔UDP, firmware, test bench |
| **ESP32-CAM firmware** | `esp32/camera/` — MJPEG stream, Wi-Fi, JPEG quality |
| **MQTT** | `backend/mqtt/publisher.py` — broker Mosquitto, 5 topic |
| **Web hiển thị** | `frontend/ui.js`, `frontend/map.js`, `frontend/video.js`, `frontend/styles.css` |
| **Dashboard cuối** | Layout GĐ 77, detection panel, event log, MQTT subscriber |
| **Vai Hands** | Trong 4 buổi lắp trọng điểm: hàn, đấu dây, tay thứ hai cho P1 |
| **GCS Operator** | Ngồi laptop trong buổi bay, bấm web, đọc số liệu to lên |

**Bạn KHÔNG sở hữu:** backend MAVLink/control (P2), model YOLO/dataset (P4), calibration/params ArduPilot (P1).

---

## Vai Hands trong buổi lắp phần cứng

4 buổi trọng điểm cần có mặt đầy đủ:

| Buổi | P3 làm |
|---|---|
| Buổi 1: Nguồn + frame | Hàn XT60, hàn ESC vào PDB, giữ frame khi siết ốc |
| Buổi 2: Flash FC | Giữ board khi P1 cắm USB, phụ tra cứu pinout |
| Buổi 3: Gắn cánh | Lắp prop đúng CW/CCW theo hướng dẫn P1 |
| Buổi 4: Wiring bridge | Đấu UART ESP32 bridge, giữ dây khi P1 cố định |

**Nguyên tắc khi hàn:**
```text
Không hàn khi LiPo cắm vào bất kỳ thứ gì trong mạch.
Không để dây thừa tiếp xúc nhau.
Sau mỗi mối hàn: kiểm tra nguội hẳn trước khi để xuống.
```

---

## Vai GCS Operator trong buổi bay

```text
Ngồi laptop, KHÔNG cầm RC.
Đọc to: "Mode: GUIDED", "Altitude: 4.2m", "Battery: 72%"
Không tự bật Web Control khi P1 (PIC) chưa hô "Web Control ON"
Khi P1 hô "abort" → tay rời bàn phím ngay
```

---

## Lịch tuần theo tuần

### Phase 0 — Tuần 1: Setup & khung web

**Mục tiêu:** Có skeleton web chạy được với mock data, SITL chạy được trên máy.

| Việc | File | Output |
|---|---|---|
| Cài SITL (theo hướng dẫn P1) | — | CỔNG PASS 3A |
| Cài Mosquitto MQTT broker | — | `mosquitto -v` chạy được |
| Dựng khung HTML/CSS/JS | `frontend/index.html`, `frontend/styles.css` | Layout theo GĐ 77 |
| Skeleton `ui.js` | `frontend/ui.js` | Hiện mock telemetry JSON lên UI |
| Review `docs/architecture.md` của P2 | — | Xác nhận field names đúng với UI |
| Chuẩn bị file MJPEG mẫu | `frontend/` | Để P3 dựng video panel mà không cần camera thật |

**Layout khung phải có ngay từ tuần 1:**
```text
┌─────────────────────────────────────────────────────┐
│ Header: mode, armed, battery, GPS count             │
├──────────────────────┬──────────────────────────────┤
│ Camera panel         │ Map panel (Leaflet)          │
├──────────────────────┴──────────────────────────────┤
│ WASD joystick visual + mode buttons                 │
├─────────────────────────────────────────────────────┤
│ Event log                                           │
└─────────────────────────────────────────────────────┘
```

---

### Phase 1 — Tuần 2–3: Web monitor + bản đồ Leaflet

**Mục tiêu:** Web hiện UAV bay trong SITL trên bản đồ, số liệu thật.

#### Telemetry panel (GĐ 7)

```javascript
// frontend/ui.js
const ws = new WebSocket('ws://localhost:8000/ws/telemetry');
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    document.getElementById('mode').textContent = data.mode;
    document.getElementById('alt').textContent = data.relative_alt.toFixed(1) + ' m';
    document.getElementById('bat').textContent = data.battery_voltage.toFixed(1) + ' V';
    document.getElementById('gps').textContent = data.satellites + ' sats';
    // ...
};
```

**Không** tự tạo WebSocket tới MAVLink. Chỉ đọc từ `/ws/telemetry` của P2.

#### Leaflet map (GĐ 8)

```javascript
// frontend/map.js
const map = L.map('map').setView([10.77, 106.69], 18);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const uavMarker = L.marker([0, 0], {
    icon: uavIcon  // icon mũi tên quay theo heading
}).addTo(map);

// Cập nhật marker — KHÔNG tạo marker mới mỗi lần
function updateUAV(lat, lon, heading) {
    uavMarker.setLatLng([lat, lon]);
    uavMarker.setRotationAngle(heading);
}
```

> **Cổng G1:** SITL takeoff → altitude tăng trên web; marker chạy theo đúng UAV.

---

### Phase 2 — Tuần 4–5: ESP32-CAM trên bàn

**Mục tiêu:** Camera stream về laptop ổn định, test detect ở 4–6m.

#### ESP32-CAM firmware (GĐ 19)

```cpp
// esp32/camera/main.cpp
// Bắt đầu với JPEG 640x480, không 1600x1200
camera_config_t config;
config.frame_size = FRAMESIZE_VGA;   // 640x480
config.jpeg_quality = 12;            // 0=best, 63=worst
config.fb_count = 2;
```

Expose endpoint:
```text
http://<ESP32-CAM-IP>/stream   → MJPEG stream
http://<ESP32-CAM-IP>/capture  → single JPEG
```

#### Test khoảng cách trên bàn

```text
Đặt ESP32-CAM cố định trên tripod ngoài trời sáng.
Người đứng: 2m → 4m → 6m → 8m.
Ghi lại: khoảng cách | confidence YOLO | detected/missed
→ Nếu 4–6m recall < 0.3: báo ngay, không chờ drone lắp xong.
```

> **Cổng G2 (camera):** Người ở 4–6m ngoài sáng vẫn detect được (thảo luận với P4).

#### MQTT (GĐ 76)

```python
# backend/mqtt/publisher.py
import paho.mqtt.client as mqtt

TOPICS = {
    "telemetry":  "uav/telemetry",
    "status":     "uav/status",
    "mission":    "uav/mission",
    "detection":  "uav/detection/person",
    "link":       "uav/link",
}

def publish_detection(client, event: dict):
    client.publish(TOPICS["detection"], json.dumps(event))
```

**Dashboard subscribe MQTT:**
```javascript
// frontend/ui.js
const mqttClient = mqtt.connect('ws://localhost:9001');
mqttClient.subscribe('uav/detection/person');
mqttClient.on('message', (topic, message) => {
    addEventToLog(JSON.parse(message));
});
```

---

### Phase 3 — Tuần 6–7: Mission UI

**Mục tiêu:** Click bản đồ → tạo waypoints → upload (P2 lo backend).

```javascript
// frontend/mission.js
const waypoints = [];

map.on('click', (e) => {
    const wp = { seq: waypoints.length + 1, lat: e.latlng.lat, lon: e.latlng.lng, alt: 5 };
    waypoints.push(wp);
    addWaypointMarker(wp);
});

async function uploadMission() {
    // 1. Validate trước
    const validation = await fetch('/api/mission/validate', {
        method: 'POST', body: JSON.stringify(waypoints)
    }).then(r => r.json());

    if (validation.errors.length > 0) {
        showErrors(validation.errors);
        return;
    }

    // 2. Upload
    await fetch('/api/mission/upload', {
        method: 'POST', body: JSON.stringify(waypoints)
    });
}
```

**Hiển thị mission progress:**
```javascript
// Khi mode chuyển sang AUTO và nhận WP event
ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.current_wp !== undefined) highlightWaypoint(d.current_wp);
};
```

---

### Phase 4 — Tuần 8–9: Dashboard cuối & đo latency

**Mục tiêu:** Dashboard đủ thông tin, detection event hiện lên.

#### Dashboard detection panel

```text
┌─────────────────────────────┐
│ PERSON DETECTED             │
│ Confidence: 87%             │
│ UAV Alt: 5.4m               │
│ UAV GPS: 10.123, 106.456    │
│ [xem snapshot]              │
└─────────────────────────────┘
```

Hiển thị snapshot:
```javascript
function showDetection(event) {
    document.getElementById('detection-confidence').textContent =
        (event.confidence * 100).toFixed(0) + '%';
    document.getElementById('detection-snapshot').src = event.snapshot;
    document.getElementById('detection-gps').textContent =
        `${event.uav_lat.toFixed(6)}, ${event.uav_lon.toFixed(6)}`;
    // LUÔN có note: "Đây là tọa độ UAV, không phải tọa độ người"
}
```

#### Đo latency (GĐ 86, phụ với P2)

```javascript
// Timestamp khi keydown
const t0 = performance.now();
sendControlMessage({ key: 'W', t: t0 });

// Backend trả lại t_backend, t_mavlink
ws.onmessage = (e) => {
    const { t_backend, t_mavlink } = JSON.parse(e.data);
    console.log('Roundtrip:', performance.now() - t0, 'ms');
    console.log('Backend lag:', t_backend - t0, 'ms');
};
```

---

### Phase 5 — Tuần 10–11: Tích hợp camera trên UAV

| Việc | GĐ | Ghi chú |
|---|---|---|
| Camera mount (phụ P1 về CG) | 66 | Không đặt quá xa mũi làm lệch CG |
| Camera static test trên drone | 69 | FPS, latency, packet drop |
| Motor-on test | 70 | Camera có reset khi motor chạy không? |
| Detection event lên dashboard | 74 | P4 cung cấp event, P3 hiển thị |
| Dataset bay thật (làm "người mẫu") | 72 | Đứng ở các khoảng cách khác nhau |
| Scenario GĐ 91 — chạy toàn bộ | 91 | GCS Operator ngồi laptop suốt |

---

### Phase 6 — Tuần 12: Test matrix & demo

| Việc | Output |
|---|---|
| Chạy scenario 23 bước (GĐ 91) | Video demo |
| Đo latency chính thức (GĐ 86) | Số liệu vào báo cáo IoT |
| Quay video demo | File video cho báo cáo |

---

## Cấu trúc thư mục P3 sở hữu

```text
esp32/
├── mavlink_bridge/
│   ├── main.cpp        ← UART ↔ UDP (firmware)
│   └── platformio.ini
└── camera/
    ├── main.cpp        ← MJPEG stream, Wi-Fi
    └── platformio.ini

backend/
└── mqtt/
    └── publisher.py    ← Mosquitto client, 5 topic

frontend/
├── ui.js               ← telemetry display, header, event log
├── map.js              ← Leaflet, UAV marker, heading rotation
├── video.js            ← MJPEG panel, offline fallback
└── styles.css          ← toàn bộ CSS
```

---

## Lằn ranh với P2 về frontend (chia theo rủi ro)

```text
Code có thể làm UAV chuyển động  → P2 viết, P1 review
Code chỉ hiển thị / đọc dữ liệu → P3 viết, P2 review nếu đổi API
```

| File | Chủ | Lý do |
|---|---|---|
| `control.js` | P2 | keydown/keyup → gửi lệnh → rủi ro safety |
| `mission.js` | P2 | upload waypoint → rủi ro safety |
| `map.js` | P3 | chỉ hiển thị, không gửi lệnh |
| `ui.js` | P3 | chỉ đọc telemetry, không gửi lệnh |
| `video.js` | P3 | chỉ hiển thị stream |
| Các nút mode/hold/rtl | P2 | gửi lệnh → rủi ro safety |
