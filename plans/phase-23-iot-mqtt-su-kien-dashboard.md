# Phase 23: IoT — MQTT, pipeline sự kiện phát hiện, ghim bản đồ, panel dashboard

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 21 (bay tự động + web đã điều khiển được drone thật) | ~25 giờ | Có (drone bay được, camera ESP32-CAM đã stream từ Phase 17, thước dây 30 m, 1–2 người tình nguyện đứng làm mục tiêu — **luôn cách drone ≥ 10 m theo phương ngang, không ai đứng dưới drone**) |

## Mục tiêu

Phase này dựng **xương sống của môn IoT**: một broker MQTT chạy trong Docker, bốn topic có hợp đồng payload rõ ràng, backend phát tin lên đó, và một client kiểm tra độc lập đọc lại được. Trên nền đó, chuỗi phát hiện thô của bộ nhận diện được biến thành **sự kiện có ý nghĩa** — chống spam, có ảnh chụp, có toạ độ GPS, có dấu thời gian — rồi chiếu xuống mặt đất thành một ghim trên bản đồ Web GCS.

Điểm quan trọng về phạm vi: phase này **không phụ thuộc vào luồng AI**. Pipeline sự kiện được thiết kế để chạy với **bất kỳ bộ nhận diện nào** đang được nạp — `yolo11n.pt` tải sẵn từ Ultralytics, một model đã tinh chỉnh từ `plans/ai/`, hoặc một `FakeDetector` sinh khung bao giả để test trên bàn. Chất lượng nhận diện là việc của luồng AI; phase này chỉ lo **đường ống**.

Kết thúc phase: bật drone, bay lên, cho một người đi vào khung hình — dashboard hiện đúng **một** sự kiện kèm ảnh, toạ độ ước lượng và một ghim trên bản đồ; đồng thời `mqtt_probe.py` chạy ở cửa sổ khác cũng nhận được đúng sự kiện ấy.

## Đầu vào cần có

**Phải đọc trước:**

- `plans/_phase-index.md` — bảng đánh số phase (SSOT). Phase này là 23; Phase 24 dùng tiếp mọi thứ dựng ở đây.
- `docs/bao-cao-tong-quan-du-an.md` **§5.6** (phép chiếu toạ độ mục tiêu — công thức 5 bước, bắt buộc), **§7.1** (kiến trúc ba tầng edge/fog/application), **§7.3** (bảng cơ chế IoT, bảng topic dự kiến).
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` §3 — kiến trúc chốt và ba luật cứng an toàn (FC là thứ duy nhất ổn định máy bay; web chỉ gửi lệnh mức cao; **AI chỉ sinh sự kiện**).
- `plans/reports/260921-research-ai-vision-pipeline.md` §4.4 — `jpeg_quality` là biến trung tâm; yêu cầu ghi metadata từng khung (Phase 24 dùng, nhưng schema payload ở đây phải chừa sẵn trường).
- Hợp đồng WebSocket đã chốt ở Phase 05 (`backend/ws-contract.schema.json`) — panel IoT và marker bản đồ đi qua socket này, **không mở socket thứ hai**.
- `SAFETY.md` — luật `NO PROPELLERS` áp cho mọi bước test trên bàn ở phase này.

**Phải có sẵn:**

- Drone đã pass F5–F8 ở Phase 21 (Auto từ Mission Planner, Guided/Auto từ web, web manual, RC override).
- Camera ESP32-CAM stream được lên web (Phase 17), backend đã có parser MJPEG và fan-out.
- `docker-compose.yml` đã có khung service `mosquitto` từ Phase 01 (phase này điền cấu hình thật).
- `.env.example` đã có khối MQTT từ trước (`MQTT_BROKER`, `MQTT_PORT`, `MQTT_CLIENT_ID`) và khối Vision (`DETECTION_CONFIDENCE=0.6`, `DETECTION_MIN_FRAMES=3`, `DETECTION_COOLDOWN_S=4`).
- Ma trận nội tham số **K** và hệ số méo `(k1, k2, p1, p2, k3)` của ESP32-CAM. Nếu luồng AI chưa hiệu chuẩn xong, việc 23.6 có đường đi riêng (xem bước 0 của việc đó) — **không chờ**.
- Một bộ trọng số bất kỳ cho detector: `ml/weights/yolo11n.pt` tải sẵn là đủ.

## File và thư mục sở hữu

Phase này **chỉ được** tạo/sửa các đường dẫn sau:

```text
deploy/mosquitto.conf                    (Phase 01 tạo khung; phase này điền nội dung thật)
docker-compose.yml                       (CHỈ khối service mosquitto + volume)
.env.example                             (CHỈ khối MQTT — thêm biến mới, không sửa khối khác)

backend/mqtt/schema.py                   MỚI — dataclass payload + phiên bản schema
backend/mqtt/publisher.py                (hiện thực thật, thay NotImplementedError)
backend/mqtt/topics.py                   MỚI — hằng số topic, QoS, retained (SSOT)
backend/vision/detector.py               (sở hữu — Phase 23, không phải Phase 17)
backend/vision/events.py                 (sở hữu — hiện thực EventThrottle.should_emit)
backend/vision/recorder.py               (hiện thực save_snapshot + append_csv + append_jsonl)
backend/vision/geo.py                    MỚI — chiếu toạ độ mục tiêu xuống mặt đất
backend/vision/detector_base.py          MỚI — giao diện Detector + FakeDetector
backend/app.py                           (CHỈ mount tĩnh logs/**/snapshots)
backend/tests/test_mqtt_schema.py        MỚI
backend/tests/test_events_throttle.py    MỚI
backend/tests/test_vision_events.py      MỚI
backend/tests/test_geo_projection.py     MỚI
backend/tests/test_recorder.py           MỚI

frontend/src/components/Iot/IotPanel.tsx             MỚI
frontend/src/components/MapView/DetectionMarkers.tsx MỚI
frontend/src/store/iot.ts                            MỚI
frontend/src/pages/OverviewPage.tsx                  (CHỈ gắn IotPanel — web GCS v2: App.tsx chỉ còn router + dịch vụ toàn cục, panel sống trong trang)
frontend/src/components/MapView/MapView.tsx          (CHỈ gắn DetectionMarkers)

scripts/mqtt_probe.py                    MỚI — subscriber test client
docs/so-tay/23-iot-mqtt-su-kien.md       MỚI (khung, agent sổ tay viết sau)
plans/PROGRESS.md                        (CHỈ tick các dòng Phase 23)
```

**Không đụng:** `backend/mavlink/*` (Phase 05–07 sở hữu; phase này chỉ **đọc** telemetry qua API đã có), `backend/vision/stream.py` và `backend/vision/fake_stream.py` (Phase 07 sở hữu — phase này chỉ **dùng**, không sửa), `backend/iot/*` (Phase 24 sở hữu), `ml/**` (luồng AI sở hữu), `firmware/**`, `README.md`, `docs/bao-cao-tong-quan-du-an.md` (Phase 24 sở hữu phần cập nhật).

---

## Việc theo thứ tự

### 23.1 Dựng broker mosquitto bằng Docker Compose

MQTT là "bưu điện" của hệ thống: backend bỏ thư vào một hòm có tên (topic), ai quan tâm thì đăng ký nhận. Khác với WebSocket (giống gọi điện trực tiếp giữa hai bên), MQTT cho phép **nhiều bên nhận cùng một tin mà bên gửi không cần biết họ là ai**. Đó chính là thứ làm cho dashboard có thể chết mà drone vẫn bay bình thường.

**Bước 1 — viết nội dung cấu hình.** Phase 01 đã tạo khung `deploy/mosquitto.conf`; phase này điền nội dung thật:

```text
listener 1883 0.0.0.0
allow_anonymous true

persistence true
persistence_location /mosquitto/data/
autosave_interval 30

log_dest stdout
log_type error
log_type warning
log_type notice
log_type information
connection_messages true
```

> `allow_anonymous true` chỉ chấp nhận được vì broker chỉ lắng nghe trên hotspot cục bộ của laptop, không ra Internet. **Phải ghi giới hạn này vào báo cáo IoT** (Phase 24, mục "những gì KHÔNG làm") — nếu không, người chấm sẽ hỏi và câu trả lời "em quên" rất tệ.

**Bước 2 — điền khối service vào `docker-compose.yml`** (Phase 01 đã tạo khung, giờ điền thật):

```yaml
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: uav-mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - ./deploy/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - mosquitto_data:/mosquitto/data
```

và ở cuối file:

```yaml
volumes:
  mosquitto_data:
```

> Dùng **named volume** (`mosquitto_data`), không dùng volume ẩn danh — đây là dữ liệu có trạng thái, và volume ẩn danh trông giống rác khi dọn Docker sau này.

**Bước 3 — chạy và kiểm tra** (PowerShell, ở thư mục gốc repo):

```powershell
docker compose up -d mosquitto
docker compose ps
docker compose logs --tail 30 mosquitto
```

**Kết quả mong đợi:** `docker compose ps` hiện `uav-mosquitto ... Up`. Log có ba dòng then chốt:

```text
mosquitto version 2.0.x starting
Config loaded from /mosquitto/config/mosquitto.conf.
Opening ipv4 listen socket on port 1883.
```

**Bước 4 — kiểm tra cổng mở thật** (đừng tin log, hãy nối thử):

```powershell
Test-NetConnection 127.0.0.1 -Port 1883
```

Mong đợi `TcpTestSucceeded : True`.

**Nếu lỗi:**

- `Error response from daemon: Ports are not available: ... 1883` → có mosquitto khác đang chạy (cài native trên Windows, hoặc một container cũ). `docker ps -a` tìm container cũ, hoặc `Get-NetTCPConnection -LocalPort 1883` tìm tiến trình chiếm cổng.
- Log lặp lại `Config loaded` rồi container restart liên tục → sai cú pháp trong `mosquitto.conf`. Mosquitto 2.x **không chấp nhận** cú pháp của 1.x cho `listener`; giữ đúng dạng `listener <port> <bind-address>` như trên.
- `TcpTestSucceeded : False` dù container chạy → Docker Desktop đang dùng WSL2 backend và chưa forward cổng; khởi động lại Docker Desktop, hoặc kiểm tra Windows Firewall có chặn `com.docker.backend` không.

---

### 23.2 Chốt bảng topic và hợp đồng payload

Đây là **hợp đồng SSOT** của toàn bộ nội dung IoT. Mọi thứ sau (publisher, probe, panel, báo cáo Phase 24) đều đọc từ đây. Viết thành mã trong `backend/mqtt/topics.py` để không có hai bản sự thật.

**Bảng topic (bản chốt):**

| Topic | Tần suất | QoS | Retained | Nội dung |
|---|---|---|---|---|
| `uav/telemetry` | 1 Hz | 0 | Không | lat, lon, alt_rel, mode, armed, battery_pct, sats |
| `uav/events/detection` | theo sự kiện | 1 | Không | sự kiện phát hiện người đã chống spam, kèm toạ độ chiếu và đường dẫn snapshot |
| `uav/health` | 0.2 Hz (5 s/lần) | 1 | **Có** | trạng thái 4 khối `mavlink / camera / detector / mqtt`; cũng là topic của Last Will |
| `uav/qos` | mỗi lần đổi + 0.5 Hz | 1 | **Có** | `jpeg_quality` hiện tại, rssi_dbm, fps_measured, bytes_per_s, loss_pct, lý do đổi |

**Lý do chọn từng mức QoS — phải giải thích được trong báo cáo:**

- `uav/telemetry` **QoS 0, không retained.** Phát 1 Hz; mất một gói không sao vì gói sau tới ngay. Không retained vì một bản telemetry **cũ** được broker giữ lại còn nguy hiểm hơn là không có gì — dashboard sẽ hiện vị trí drone của 10 phút trước như thể là hiện tại.
- `uav/events/detection` **QoS 1, không retained.** Đây là thứ không được mất, nên cần xác nhận (QoS 1 = "gửi tới khi có ACK", có thể trùng lặp — bên nhận khử trùng bằng `seq`). Không retained vì sự kiện là chuyện xảy ra tại một thời điểm, không phải trạng thái.
- `uav/health` và `uav/qos` **QoS 1, retained.** Đây là **trạng thái**, không phải sự kiện. Retained nghĩa là broker dán tờ giấy mới nhất lên bảng tin: dashboard vừa mở lên là thấy ngay tình hình, không phải ngồi chờ chu kỳ phát kế tiếp.

**Last Will and Testament (di chúc).** Publisher đăng ký LWT khi nối: broker giữ sẵn một tin, **tự phát hộ khi thấy backend chết đột ngột** (rút điện, crash, mất mạng). Đăng ký trên `uav/health`, retained, payload:

```json
{"schema_version": 1, "ts": null, "seq": -1,
 "mavlink": "unknown", "camera": "unknown", "detector": "unknown", "mqtt": "offline",
 "reason": "last_will"}
```

Nhờ vậy dashboard **biết ngay** backend đã chết thay vì ngồi đoán tại sao số ngừng nhảy. Đây là chi tiết nhỏ nhưng rất đáng nói trong báo cáo.

**Ba trường bắt buộc trong mọi payload:**

```json
{
  "schema_version": 1,
  "ts": "2026-11-02T09:14:23.412Z",
  "seq": 1841
}
```

- `schema_version` — để sau này đổi schema mà không làm hỏng log cũ.
- `ts` — **luôn UTC ISO-8601 có mili-giây**, sinh tại thời điểm tạo payload. Dùng để đo độ trễ đầu-cuối ở Phase 24.
- `seq` — bộ đếm tăng dần **riêng cho từng topic**, bắt đầu từ 0 mỗi lần backend khởi động. Đây là cách đo **tỉ lệ mất gói mà không cần thiết bị đo nào**: bên nhận thấy `seq` nhảy từ 41 sang 45 tức là mất 3 gói.

**Payload `uav/events/detection` đầy đủ:**

```json
{
  "schema_version": 1,
  "ts": "2026-11-02T09:14:23.412Z",
  "seq": 12,
  "event": "person_detected",
  "confidence": 0.87,
  "n_persons": 1,
  "bbox_px": [412, 233, 41, 78],
  "uav": {
    "lat": 10.762600, "lon": 106.682200, "alt_rel": 8.2,
    "yaw_deg": 137.4, "pitch_deg": -2.1, "roll_deg": 0.8
  },
  "target": {
    "lat": 10.762510, "lon": 106.682430,
    "err_m_est": 3.5,
    "method": "pinhole_flat_ground",
    "valid": true
  },
  "jpeg_quality": 12,
  "detector": "yolo11n.pt",
  "snapshot": "logs/20261102-session3/snapshots/000012.jpg"
}
```

Ghi chú về `detector`: ghi **tên file trọng số đang nạp**, không ghi "YOLO". Khi luồng AI thay model, log cũ vẫn truy được là lúc đó chạy model nào. `jpeg_quality` để sẵn ở đây dù Phase 23 chưa điều khiển nó — Phase 24 điền vào, và log của Phase 23 sẽ ghi giá trị cố định đang đặt trong firmware.

**Payload `uav/health`:**

```json
{
  "schema_version": 1, "ts": "...", "seq": 88,
  "mavlink": "ok", "camera": "ok", "detector": "ok", "mqtt": "ok",
  "mavlink_hz": 1.0, "camera_fps": 13.8, "detector_fps": 4.2,
  "uptime_s": 441, "reason": "periodic"
}
```

Mỗi khối chỉ nhận ba giá trị: `ok` / `degraded` / `offline`. Đừng sáng tạo thêm trạng thái — panel chỉ tô ba màu.

**Bước hiện thực:** `backend/mqtt/topics.py` chứa hằng số topic + QoS + retained dưới dạng một bảng tra; `backend/mqtt/schema.py` chứa dataclass cho từng payload với `to_dict()` và `SCHEMA_VERSION = 1`.

> **Bảng này KHÁC hai nguồn cũ:** khác các hằng số đang nằm sẵn trong `backend/mqtt/publisher.py` (`uav/status`, `uav/mission`, `uav/detection/person`, `uav/link`) **và** khác bảng dự kiến ở `docs/bao-cao-tong-quan-du-an.md` §7.3 (`uav/telemetry`, `uav/link`, `uav/detection`, `uav/status`). Bảng ở đây là **bản chốt**; xoá các hằng số cũ trong `publisher.py` chứ **không giữ song song hai bộ**. Việc cập nhật tài liệu tổng quan thuộc Phase 24 mục 24.10.

**Test:**

```powershell
uv run pytest backend/tests/test_mqtt_schema.py -v
```

Ba ca tối thiểu: (1) mọi payload serialize ra JSON hợp lệ có đủ 3 trường bắt buộc; (2) `ts` đúng định dạng ISO-8601 UTC có mili-giây và kết thúc bằng `Z`; (3) bảng topic có đủ 4 mục, và mỗi mục có QoS ∈ {0,1} + `retained` là bool.

**Nếu lỗi:**

- `TypeError: Object of type datetime is not JSON serializable` → format `ts` thành chuỗi ngay trong `to_dict()`, đừng để `json.dumps` tự xử lý.
- Tiếng Việt trong payload bị biến thành `ạ...` → `json.dumps(..., ensure_ascii=False)` (hàm `encode()` sẵn có trong `publisher.py` đã đúng, giữ nguyên).

---

### 23.3 Hiện thực publisher trong backend

`backend/mqtt/publisher.py` hiện đang là khung với `NotImplementedError`. Việc này biến nó thành code chạy thật bằng `paho-mqtt`.

**Luật cứng, phải viết thành comment ngay đầu file:**

> **MQTT hỏng KHÔNG được làm ảnh hưởng telemetry hay control.** Mọi lời gọi `publish()` bọc trong `try/except Exception` và chỉ `log.warning`. Không bao giờ để lỗi MQTT thoát ra luồng chính.

Đây là **ngoại lệ có chủ đích** với nguyên tắc "Errors Over Silent Fallbacks": nó không im lặng — có log, có `mqtt: degraded` trên `uav/health`, có đèn đỏ trên panel IoT. Người dùng vẫn biết. Ghi rõ lý lẽ này trong comment để người đọc code sau không tưởng là ẩu.

**Ba điểm hiện thực cụ thể:**

1. **Chạy nền, không chặn.** Dùng `client.loop_start()` (luồng riêng của paho), không dùng `loop_forever()`. Backend là FastAPI async — chặn luồng chính là chết cả hệ thống.
2. **Reconnect tự động.** `client.reconnect_delay_set(min_delay=1, max_delay=30)`. Wi-Fi hotspot sẽ rớt; publisher phải tự nối lại mà không cần khởi động lại backend.
3. **LWT đăng ký TRƯỚC khi connect.** `client.will_set(TOPIC_HEALTH, payload, qos=1, retain=True)` phải gọi trước `client.connect()`, nếu không broker không biết di chúc.

**Kiểm tra bằng tay (bench, không cần drone):**

```powershell
# cửa sổ 1 — chạy backend với nguồn telemetry SITL hoặc drone thật
uv run python -m backend.app

# cửa sổ 2 — xem tin bay ra
docker compose exec mosquitto mosquitto_sub -h 127.0.0.1 -t "uav/#" -v
```

**Kết quả mong đợi:** một dòng `uav/telemetry {...}` mỗi giây và một dòng `uav/health {...}` mỗi 5 giây.

**Kiểm tra LWT (bài test quan trọng nhất của việc này):** trong khi `mosquitto_sub` đang chạy, **kill backend bằng Ctrl+C rồi thử lại bằng cách kill cứng**:

```powershell
Stop-Process -Id <pid-backend> -Force
```

**Kết quả mong đợi:** trong vòng vài giây, `mosquitto_sub` in ra một dòng `uav/health {... "mqtt":"offline", "reason":"last_will"}`. Nếu không thấy — LWT chưa đăng ký đúng, hoặc backend đóng kết nối "lịch sự" nên broker coi là chia tay bình thường (đó là lý do phải test bằng kill cứng, không phải Ctrl+C).

**Nếu lỗi:**

- `TypeError: on_connect() takes 4 positional arguments but 5 were given` → `paho-mqtt` 2.x đổi chữ ký callback so với 1.x. Hoặc ghim `paho-mqtt>=2,<3` và viết theo API v2 (`CallbackAPIVersion.VERSION2`), hoặc ghim `<2`. **Ghim phiên bản trong `pyproject.toml`**, đừng để trôi.
- Publisher nối được nhưng `mosquitto_sub` không thấy gì → sai tên topic (kiểm tra `topics.py`), hoặc publish trước khi `on_connect` chạy xong. Đặt cờ `self.connected` trong `on_connect` và bỏ qua publish khi chưa nối (khung code sẵn có đã làm đúng việc này).
- Backend chậm hẳn đi sau khi bật MQTT → đang gọi `publish()` đồng bộ trong vòng lặp telemetry với QoS 1 và chờ ACK. Chuyển `uav/telemetry` về QoS 0 như bảng đã chốt.

---

### 23.4 Client kiểm tra độc lập `scripts/mqtt_probe.py`

Không được chỉ kiểm tra MQTT bằng chính dashboard của mình — nếu cả hai cùng sai thì sẽ không phát hiện ra. Cần một công cụ **độc lập, đơn giản, đọc được bằng mắt**, và nó cũng chính là thứ dùng để quay video bằng chứng cho báo cáo.

**Đặc tả:**

```text
Cách chạy:
  uv run python scripts/mqtt_probe.py --broker 127.0.0.1 --topic "uav/#"
  uv run python scripts/mqtt_probe.py --topic "uav/events/detection" --save logs/probe.jsonl

Việc nó làm:
  - đăng ký topic (mặc định uav/#), QoS 1
  - mỗi tin in MỘT dòng gọn: thời gian nhận, topic, seq, độ trễ, vài trường đáng chú ý
  - độ trễ = thời gian nhận (đồng hồ laptop) - ts trong payload
  - phát hiện lỗ hổng seq và in cảnh báo: "! mat 3 goi tren uav/telemetry (41 -> 45)"
  - khi thoát (Ctrl+C) in bảng tổng kết: số tin mỗi topic, tỉ lệ mất gói, độ trễ trung vị và p95
  - --save ghi nguyên văn payload ra jsonl để phân tích sau
```

**Kết quả mong đợi khi chạy:**

```text
09:14:23.470  uav/telemetry          seq=1841  lag= 12ms  mode=LOITER alt=8.2 bat=74%
09:14:23.512  uav/events/detection   seq=12    lag= 58ms  conf=0.87 target=10.76251,106.68243
09:14:25.003  uav/health             seq=88    lag=  9ms  mavlink=ok camera=ok detector=ok
! mat 3 goi tren uav/telemetry (1841 -> 1845)
^C
--- tong ket 120 s ---
uav/telemetry          118 tin   mat 2.5%   lag p50=13ms p95=41ms
uav/events/detection     4 tin   mat 0.0%   lag p50=55ms p95=88ms
uav/health              24 tin   mat 0.0%   lag p50=10ms p95=22ms
```

**Cảnh báo về độ trễ:** con số `lag` chỉ đúng khi đồng hồ bên gửi và bên nhận cùng một máy (laptop). Khi payload có `ts` do ESP32 sinh ra (Phase 24), `lag` sẽ nhiễm độ lệch đồng hồ ESP32 — **chưa xác minh** độ lệch này là bao nhiêu sau 20 phút chạy. Ghi chú điều đó ngay trong phần help của script để người dùng sau không đọc nhầm số.

**Nếu lỗi:**

- `lag` âm → đồng hồ lệch, hoặc `ts` sinh sau khi publish. Sinh `ts` ngay khi tạo payload, không sinh trong hàm publish.
- Mất gói báo 100% ngay từ đầu → backend khởi động lại làm `seq` về 0 mà probe coi là tụt lùi. Xử lý: `seq` mới nhỏ hơn `seq` cũ thì coi là restart, reset bộ đếm chứ đừng báo mất gói.

---

### 23.5 Pipeline sự kiện phát hiện — chống spam, snapshot, GPS, dấu thời gian

Bộ nhận diện chạy 3–5 khung/giây sẽ sinh **hàng trăm "phát hiện" cho cùng một người đứng yên**. Không xử lý thì 5 phút bay ra 1.500 dòng log vô nghĩa và dashboard không đọc được. Việc này biến chuỗi phát hiện thô thành sự kiện có ý nghĩa.

**Bước 0 — tách khỏi luồng AI bằng một giao diện.** Tạo `backend/vision/detector_base.py`:

```text
class Detection:      bbox_px (x, y, w, h), confidence, class_name
class Detector:       detect(frame) -> list[Detection]      # giao diện
class FakeDetector:   sinh khung bao theo kịch bản định trước, KHÔNG cần GPU,
                      dùng để test pipeline trên bàn và trong CI
```

Nhờ `FakeDetector`, toàn bộ pipeline sự kiện **test được mà không cần camera, không cần GPU, không cần luồng AI xong**. Đây là điểm quan trọng nhất của việc này: Phase 23 không bị chặn bởi `plans/ai/`.

Trọng số thật mặc định lấy từ `.env` (`YOLO_WEIGHTS=ml/weights/yolo11n.pt`). Với `yolo11n.pt` gốc (huấn luyện COCO), lớp `person` là **class index 0** — lọc đúng lớp đó và bỏ mọi lớp khác.

**Bước 1 — hiện thực chống spam.** Trong `backend/vision/events.py`, `EventThrottle.should_emit(confidence, now)` theo đúng luật đã ghi sẵn trong docstring của file:

```text
confidence > DETECTION_CONFIDENCE (0.6)
  -> tăng bộ đếm frame liên tiếp
  -> đủ DETECTION_MIN_FRAMES (3) frame liên tiếp thì phát sự kiện
  -> sau khi phát, im lặng DETECTION_COOLDOWN_S (4 giây)
  -> một frame dưới ngưỡng làm bộ đếm liên tiếp về 0
```

Đây là **logic thuần, không cần camera** — viết unit test trước, truyền thời gian vào làm tham số (`now`) thay vì gọi `time.time()` bên trong, để test chạy tức thì không cần `sleep`.

```powershell
uv run pytest backend/tests/test_events_throttle.py -v
```

Bắt buộc đủ 6 ca:

1. Đủ 3 frame liên tiếp trên ngưỡng → phát.
2. 2 frame rồi một frame dưới ngưỡng → **không** phát, bộ đếm về 0.
3. Đang trong cooldown, dù đủ frame → không phát.
4. Hết cooldown + đủ frame trở lại → phát lần hai.
5. Confidence đúng bằng ngưỡng (0.6) → **không** tính (dùng `>` chứ không `>=`; ghi rõ quy ước này).
6. Chuỗi rất dài trên ngưỡng (100 frame) → chỉ phát đúng số lần bằng `floor(thời gian / cooldown)`, không phát 100 lần.

**Bước 2 — hiện thực recorder.** `backend/vision/recorder.py` ghi ba thứ cho mỗi sự kiện:

- `snapshots/<seq:06d>.jpg` — ảnh **có vẽ khung bao và nhãn confidence**, dùng `cv2.rectangle` + `cv2.putText`. Zero-pad 6 chữ số để sắp xếp đúng thứ tự khi xem bằng file explorer.
- `detections.csv` — một dòng mỗi sự kiện, header: `ts,seq,confidence,uav_lat,uav_lon,uav_alt,target_lat,target_lon,err_m,jpeg_quality,snapshot`.
- `events.jsonl` — **nguyên văn payload MQTT đã phát**. Không ghi một phiên bản khác: log và tin đã gửi phải giống hệt nhau, nếu không thì khi phân tích sau sẽ không biết tin nào là thật.

Ghi CSV bằng chế độ append có flush, **không giữ trong RAM rồi ghi lúc kết thúc** — nếu backend crash giữa chuyến bay thì mất sạch.

```powershell
uv run pytest backend/tests/test_recorder.py -v
```

Ba ca: (1) ghi 3 sự kiện thì CSV có 4 dòng (kể cả header), (2) snapshot tồn tại và đọc lại được bằng `cv2.imread`, (3) `events.jsonl` parse được từng dòng thành JSON.

**Bước 3 — gắn GPS và dấu thời gian đúng khung.** Cái bẫy lớn nhất ở đây: telemetry đến 1 Hz còn khung ảnh đến ~14 Hz. Lấy "telemetry mới nhất" gán cho khung ảnh có thể lệch tới 1 giây — ở tốc độ 3 m/s là **3 mét sai lệch**. Cách làm đúng:

- Mỗi khung ảnh mang `ts` riêng (từ metadata ESP32 nếu có, nếu không thì lấy lúc backend nhận xong khung).
- Giữ một bộ đệm vòng ~5 giây telemetry gần nhất.
- Khi sinh sự kiện, **nội suy tuyến tính** vị trí và tư thế UAV theo `ts` của khung ảnh, không lấy bản mới nhất.
- Nếu không tìm được hai mẫu telemetry kẹp quanh `ts` (mất telemetry), đặt `target.valid = false` và vẫn phát sự kiện — **mất toạ độ không phải lý do để nuốt sự kiện**.

**Bước 4 — test đầu-cuối trên bàn, KHÔNG CÁNH.** Chạy backend với `FakeDetector` theo kịch bản "không có người 5 s → có người confidence 0.8 trong 10 s → không có người 5 s", telemetry lấy từ SITL.

**Kết quả mong đợi:** đúng **2 hoặc 3** sự kiện (10 s có người ÷ cooldown 4 s), không phải 40. `mqtt_probe.py` hiện đủ số sự kiện đó, mỗi sự kiện có snapshot đọc được.

**Nếu lỗi:**

- Ra hàng chục sự kiện → cooldown không được áp dụng, hoặc mỗi khung tạo một `EventThrottle` mới. Throttle phải là **một instance sống suốt phiên**.
- Không ra sự kiện nào dù có người → ngưỡng 0.6 quá cao cho `yolo11n.pt` gốc trên ảnh ESP32 xấu. **Đừng hạ ngưỡng để "cho nó chạy"** — đó là nguỵ tạo kết quả. Ghi nhận hiện tượng (nó chính là bằng chứng cho khoảng cách miền mà luồng AI nghiên cứu), và test pipeline bằng `FakeDetector`.
- Snapshot đen thui → đang ghi khung sau khi đã convert màu hai lần (BGR↔RGB). Ghi thẳng khung BGR mà OpenCV trả về.

---

### 23.6 Chiếu toạ độ mục tiêu xuống bản đồ

Câu hỏi: biết một người ở vị trí nào **trên ảnh**, biết drone cao bao nhiêu và đang nghiêng thế nào — suy ra người đó ở vị trí nào **trên mặt đất**? Đây là nội dung xử lý ảnh hình học thuần tuý, và là thứ biến "có một người trong khung hình" thành "có một người ở toạ độ này".

Làm theo đúng 5 bước ở `docs/bao-cao-tong-quan-du-an.md` §5.6.

**Bước 0 — nguồn ma trận K.** Lý tưởng là K từ hiệu chuẩn bàn cờ của luồng AI. Nếu chưa có, **không chờ**: dùng K xấp xỉ từ thông số ống kính OV2640 (tiêu cự ~2.8 mm, kích thước điểm ảnh ~2.2 µm ở VGA ⇒ `fx ≈ fy ≈ 1273 px`, `cx = 320`, `cy = 240`), đặt hệ số méo về 0, và **đánh dấu rõ trong log và báo cáo là `K_source: "approx_datasheet"`**. Khi có K hiệu chuẩn thật thì đổi sang `K_source: "calibrated"` và chạy lại phân tích sai số. Con số tiêu cự này là **chưa xác minh** — suy ra từ datasheet, không phải đo.

**Bước 1–5 (nội dung `backend/vision/geo.py`):**

1. Lấy **điểm giữa cạnh dưới** của khung bao — ước lượng điểm chân người chạm đất. (Không lấy tâm khung bao: tâm nằm lơ lửng giữa thân người, chiếu xuống sẽ ra xa hơn thực tế.)
2. Khử méo điểm đó (`cv2.undistortPoints`), chuyển sang toạ độ chuẩn hoá bằng **K⁻¹**.
3. Xoay tia theo ma trận tư thế UAV (roll, pitch, yaw từ telemetry đã nội suy ở việc 23.5) **cộng với góc nghiêng cố định của giá gắn camera** (đo bằng thước đo góc khi lắp, ghi vào `.env`).
4. Chiếu tia xuống mặt phẳng `z = 0` với giả thiết **mặt đất phẳng**, dùng độ cao tương đối `alt_rel`.
5. Đổi dịch chuyển tương đối (bắc, đông) sang kinh/vĩ độ quanh vị trí UAV.

**Bước 6 — test bằng số liệu tổng hợp TRƯỚC khi ra bãi.** Đây là loại code rất dễ sai dấu và sai đơn vị, và sai thì ra kết quả trông hợp lý nhưng cách xa hàng trăm mét.

```powershell
uv run pytest backend/tests/test_geo_projection.py -v
```

Bốn ca bắt buộc:

1. **Nhìn thẳng xuống, điểm ở tâm ảnh** (`pitch=-90°, roll=0, yaw=0`, điểm `(320,240)`) → toạ độ mục tiêu trùng vị trí UAV, sai số < 0.1 m.
2. **Nhìn thẳng xuống, điểm lệch tâm 100 px** ở độ cao 8 m → dịch chuyển đúng bằng `h · tan(atan(100/fx))` ≈ 0.63 m. Kiểm tra cả **hướng** (điểm lệch xuống dưới ảnh ⇒ mục tiêu ở xa hơn theo hướng camera nhìn).
3. **Xoay yaw 90°** với cùng điểm ảnh → dịch chuyển xoay đúng 90° trên mặt đất (bắc thành đông).
4. **Tia chiếu lên trời** (pitch dương, điểm ở nửa trên ảnh, không cắt mặt đất) → trả về `valid=false`, **không** trả một toạ độ bịa.

**Bước 7 — đo sai số thật ngoài bãi (bắt buộc cho báo cáo).**

Chuẩn bị: thước dây 30 m, 5 cọc đánh dấu ở 0, 5, 10, 15, 20 m tính từ điểm cất cánh theo hướng bắc (dùng la bàn điện thoại). Một người đứng lần lượt tại từng cọc.

> **AN TOÀN:** **không cắm cọc ở 0 m** và **không ai đứng dưới drone** — drone luôn hover cách người tình nguyện **≥ 10 m theo phương ngang** (dời điểm hover ra xa nếu cọc gần nhất là 0 m). RC luôn trong tay người lái. Bắt buộc có người quan sát thứ hai. Người tình nguyện đeo kính bảo hộ và đã được phổ biến trước hướng thoát nếu có sự cố. **ABORT** ngay nếu gió giật hoặc GPS xuống cấp (HDOP tăng / mất vệ tinh).

Quy trình: bay treo ở **5 m**, cho người đứng lần lượt ở 5 cọc, mỗi cọc ghi 5 sự kiện. Lặp ở **8 m** và **12 m**. Tổng 3 × 5 × 5 = 75 sự kiện.

Xử lý: với mỗi sự kiện tính khoảng cách giữa toạ độ chiếu và toạ độ thật của cọc (toạ độ thật = vị trí Home + độ dời đã đo bằng thước). Lập bảng:

| Độ cao | 0 m | 5 m | 10 m | 15 m | 20 m |
|---|---|---|---|---|---|
| 5 m | tb ± sd | | | | |
| 8 m | | | | | |
| 12 m | | | | | |

Báo cáo **sai số trung bình và độ lệch chuẩn** cho từng ô, cộng một đoạn phân tích nguồn sai số chủ đạo: sai số tư thế (roll/pitch từ EKF), sai số độ cao khí áp kế, giả thiết mặt đất phẳng, và độ trễ giữa khung ảnh với telemetry.

> **Ghi rõ trong báo cáo:** hệ thống **ước lượng** vị trí kèm sai số công bố, **không** tuyên bố đo chính xác. Sai số kỳ vọng vài mét — **chưa xác minh**, phải đo. Một báo cáo trung thực với sai số 4 m giá trị hơn nhiều một báo cáo khẳng định 0.5 m mà không ai kiểm chứng được.

**Nếu lỗi:**

- Toạ độ ra giữa biển hoặc cách hàng km → nhầm độ/radian, hoặc nhầm thứ tự `(lat, lon)`. Ca test số 1 ở bước 6 bắt được lỗi này ngay — đừng ra bãi trước khi nó xanh.
- Sai số lớn và **lệch đều một hướng** → góc nghiêng cố định của giá camera chưa đưa vào, hoặc lệch yaw do compass chưa hiệu chuẩn tốt. Kiểm tra compass trước (Phase 19).
- Sai số nhảy loạn khi drone nghiêng → telemetry và khung ảnh lệch thời gian. Quay lại việc 23.5 bước 3 (nội suy), đừng cố bù bằng hệ số.
- Sai số tăng vọt ở độ cao 12 m → hợp lý và **đáng báo cáo**: cùng một sai số góc, chiếu xuống từ cao hơn thì sai số mặt đất lớn hơn tỉ lệ thuận với độ cao.

---

### 23.7 Ghim mục tiêu lên bản đồ Web GCS

Bản đồ Leaflet + mission editor đã có từ Phase 09. Việc này chỉ thêm một lớp marker cho sự kiện phát hiện.

**Đường đi dữ liệu:** sự kiện → backend → **WebSocket sẵn có** (dùng đúng type sẵn có `type: "event"` với `data.kind = "detection"` theo hợp đồng WS của Phase 05 — **không** thêm `type` mới, `phase-05:402` cấm việc đó) → store zustand → component marker. **Không** cho frontend nối thẳng vào MQTT: sẽ phải bật listener WebSocket 9001 trên mosquitto, thêm một đường mạng nữa phải giải thích khi demo, trong khi backend vốn đã có mọi dữ liệu này.

**`frontend/src/components/MapView/DetectionMarkers.tsx` phải có:**

- Marker Leaflet tại `target.lat/lon`, biểu tượng khác hẳn marker drone và marker waypoint (dùng màu cam + biểu tượng người).
- **Vòng tròn bán kính `err_m_est`** quanh marker — đây là cách trung thực để thể hiện "đây là ước lượng, không phải điểm chính xác". Rất đáng nói khi demo.
- Popup khi bấm: ảnh snapshot (thẻ `<img>` trỏ tới endpoint tĩnh của backend), confidence, thời gian, độ cao UAV lúc phát hiện, `jpeg_quality`.
- Marker cũ hơn 10 phút giảm độ đục còn 40% để phân biệt cũ/mới.
- Sự kiện có `target.valid == false` → **không ghim lên bản đồ**, nhưng **vẫn hiện trong event log** với ghi chú "không xác định được toạ độ". Không được im lặng bỏ qua.
- Nút "xoá hết ghim" cho lần demo tiếp theo.

**Kiểm tra:** chạy backend với `FakeDetector` + SITL, mở web. Mong đợi: mỗi sự kiện sinh đúng một ghim, bấm vào thấy ảnh, vòng tròn sai số hiển thị đúng kích thước theo tỉ lệ bản đồ (zoom vào/ra thì vòng tròn co giãn theo mét, không theo pixel — dùng `L.circle` chứ không `L.circleMarker`).

**Nếu lỗi:**

- Vòng tròn không đổi kích thước khi zoom → dùng nhầm `L.circleMarker` (bán kính tính bằng pixel) thay vì `L.circle` (bán kính tính bằng mét).
- Ảnh popup 404 → backend chưa phục vụ thư mục `logs/` qua đường tĩnh. Thêm mount tĩnh chỉ-đọc, **chỉ cho `logs/**/snapshots/`**, không mở cả thư mục `logs/` (trong đó có file param và note riêng tư).
- Marker chồng chất khi bay lâu → giới hạn 200 marker gần nhất, loại dần marker cũ nhất.

---

### 23.8 Panel IoT trong Web GCS

**Quyết định kiến trúc: mở rộng Web GCS bằng một panel, KHÔNG dựng Node-RED riêng.** Lý do: Node-RED là thêm một tiến trình, một cổng, một giao diện nữa phải mở và giải thích trong 10 phút demo, trong khi Web GCS đã có WebSocket, layout và hệ màu trạng thái sẵn. Node-RED chỉ nên cân nhắc nếu giảng viên môn IoT yêu cầu cụ thể — khi đó nó là phần mở rộng, không thay thế panel này.

**`frontend/src/components/Iot/IotPanel.tsx` hiển thị:**

| Khối | Nội dung | Nguồn |
|---|---|---|
| Trạng thái broker | `mqtt: ok / degraded / offline` kèm đèn màu | `uav/health` |
| Bộ đếm theo topic | số tin đã phát cho từng topic trong 4 topic | backend đếm |
| Tỉ lệ mất gói | `loss_pct` của `uav/telemetry` tính trên cửa sổ 60 s | lỗ hổng `seq` |
| Độ trễ | trung vị và p95 của độ trễ tin trong 60 s | `ts` vs lúc nhận |
| Chất lượng ảnh | `jpeg_quality` hiện tại (Phase 23 là giá trị cố định; Phase 24 sẽ tự đổi) | `uav/qos` |
| Đường truyền | `fps_measured`, `bytes_per_s`, `rssi_dbm` (nếu có) | `uav/qos` |
| Biểu đồ 60 s | hai đường: `jpeg_quality` và `bytes_per_s` | bộ đệm vòng trong store |

Biểu đồ giữ đơn giản — một `<svg>` polyline tự vẽ, hoặc `recharts` nếu Phase 08 đã đưa vào. **Không thêm thư viện biểu đồ mới chỉ cho panel này.**

Chỗ trống `rssi_dbm` ở Phase 23 là bình thường: chưa có nguồn RSSI nào được xác minh (Phase 24 việc 24.1 xử lý). Hiển thị `—` chứ không hiển thị `0` — số 0 trông như một phép đo thật.

**Kiểm tra:** mở web, tắt broker (`docker compose stop mosquitto`), quan sát panel chuyển `mqtt: offline` trong ≤ 10 s; bật lại, panel tự về `ok` mà **không cần tải lại trang** (chứng minh reconnect hoạt động).

**Nếu lỗi:**

- Panel đứng số sau khi mất rồi có lại mạng → store không xử lý sự kiện reconnect; đặt lại bộ đếm khi thấy `seq` tụt lùi.
- Tỉ lệ mất gói luôn 0% dù rõ ràng mạng kém → đang đếm tin **backend gửi** chứ không phải tin **nhận được qua MQTT**. Phải đo ở phía nhận, nếu không con số này không chứng minh được gì.

---

## Cổng pass

- [ ] `docker compose ps` hiện `uav-mosquitto` ở trạng thái `Up`; `Test-NetConnection 127.0.0.1 -Port 1883` trả `True`.
- [ ] `uv run pytest backend/tests/ -v` xanh toàn bộ, trong đó `test_events_throttle.py` có đủ 6 ca và `test_geo_projection.py` có đủ 4 ca.
- [ ] `mosquitto_sub -t "uav/#" -v` thấy đủ **4 topic** có tin đi qua (`uav/telemetry`, `uav/events/detection`, `uav/health`, `uav/qos`).
- [ ] **Test Last Will:** kill cứng backend → trong ≤ 10 s có tin `uav/health` với `"mqtt":"offline","reason":"last_will"`.
- [ ] `scripts/mqtt_probe.py` chạy 120 s in được bảng tổng kết có số tin, tỉ lệ mất gói, độ trễ p50/p95 cho từng topic.
- [ ] Test `FakeDetector` với kịch bản "10 giây có người": sinh **2–3 sự kiện**, không phải hàng chục.
- [ ] Mỗi sự kiện có đủ ba sản phẩm: dòng trong `detections.csv`, dòng trong `events.jsonl` **khớp nguyên văn** với payload MQTT, và một file snapshot đọc được có vẽ khung bao.
- [ ] Bảng sai số phép chiếu toạ độ có đủ 3 độ cao × 5 khoảng cách (75 sự kiện), báo cáo trung bình ± độ lệch chuẩn, có đoạn phân tích nguồn sai số.
- [ ] Bản đồ Web GCS ghim đúng vị trí mục tiêu kèm vòng tròn sai số bằng mét; bấm vào popup hiện được ảnh snapshot.
- [ ] Sự kiện có `target.valid=false` không ghim lên bản đồ nhưng vẫn xuất hiện trong event log.
- [ ] Panel IoT hiện đủ 7 khối; tắt broker → `mqtt: offline` trong ≤ 10 s; bật lại → tự về `ok` không cần tải lại trang.
- [ ] **Bài kiểm tra tổng:** bay treo 8 m, một người đi vào khung hình → dashboard hiện đúng một ghim + `mqtt_probe.py` ở cửa sổ khác nhận đúng sự kiện đó, hai bên khớp `seq`.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Phép chiếu toạ độ sai dấu/đơn vị, phát hiện muộn ngoài bãi | 4 | 4 | **16** | 4 ca test tổng hợp ở 23.6 bước 6 là **cổng bắt buộc** trước khi ra bãi. Ca số 1 (nhìn thẳng xuống, điểm tâm ảnh) bắt được đa số lỗi loại này trong 1 giây |
| `yolo11n.pt` gốc không nhận ra người trên ảnh ESP32 xấu ⇒ không test được pipeline | 4 | 3 | 12 | `FakeDetector` (23.5 bước 0) làm toàn bộ pipeline test được không cần AI. **Tuyệt đối không hạ ngưỡng confidence để "cho nó chạy"** — đó là nguỵ tạo kết quả; hiện tượng không nhận ra chính là dữ liệu cho luồng AI |
| Lệch thời gian telemetry ↔ khung ảnh làm toạ độ sai vài mét | 4 | 3 | 12 | Nội suy telemetry theo `ts` của khung (23.5 bước 3), không lấy "bản mới nhất". Đưa độ lệch đo được vào phần phân tích sai số |
| MQTT chết kéo theo backend chết / treo | 2 | 5 | 10 | Luật cứng ở 23.3: mọi `publish()` bọc try/except chỉ log; `loop_start()` chạy luồng riêng; test giả lập broker chết mà telemetry vẫn 1 Hz |
| K camera chưa hiệu chuẩn (luồng AI chưa xong) chặn việc 23.6 | 3 | 3 | 9 | Đường đi dự phòng ở 23.6 bước 0: dùng K xấp xỉ từ datasheet, đánh dấu `K_source: "approx_datasheet"`, chạy lại khi có K thật. Không chờ |
| `paho-mqtt` 2.x đổi API callback làm code mẫu trên mạng không chạy | 3 | 2 | 6 | Ghim phiên bản trong `pyproject.toml` ngay từ đầu; đọc lỗi `TypeError: on_connect()` là dấu hiệu nhận biết |
| Panel IoT phình ra thành dashboard thứ hai, trễ tiến độ | 3 | 2 | 6 | Bảng 7 khối ở 23.8 là hợp đồng phạm vi. Không thêm thư viện biểu đồ mới, không thêm Node-RED |
| Ghi CSV trong RAM rồi mất hết khi backend crash giữa chuyến bay | 2 | 4 | 8 | Append + flush từng dòng (23.5 bước 2). Test bằng cách kill cứng backend giữa chừng rồi kiểm tra CSV |
| Bay thu số liệu sai số gặp thời tiết xấu | 3 | 2 | 6 | Việc 23.6 bước 7 là việc **duy nhất** trong phase cần bay; mọi thứ khác làm trên bàn bằng SITL + `FakeDetector`. Bay bù dễ sắp xếp |
| Người đứng làm mục tiêu quá gần / dưới drone | 3 | 5 | **15** | Khối AN TOÀN trước 23.6 bước 7: không cọc 0 m, drone hover cách người ≥ 10 m theo phương ngang, không ai đứng dưới drone, RC luôn trong tay, người quan sát thứ hai, kính bảo hộ, ABORT khi gió/GPS xuống cấp |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 23.1 Dựng broker mosquitto | 1.5 | Trên PC, không cần drone |
| 23.2 Chốt bảng topic + hợp đồng payload + test schema | 2 | Đây là hợp đồng SSOT, làm kỹ ở đây tiết kiệm cho cả Phase 24 |
| 23.3 Hiện thực publisher + LWT + reconnect | 3 | Gồm 0.5 h cho bài test kill cứng |
| 23.4 `mqtt_probe.py` | 1.5 | Công cụ này còn dùng để quay video bằng chứng cho báo cáo |
| 23.5 Pipeline sự kiện: giao diện detector, chống spam, recorder, nội suy telemetry | 5 | 3 h code + test, 2 h chạy đầu-cuối trên bàn |
| 23.6 Chiếu toạ độ: code + 4 test tổng hợp + đo sai số ngoài bãi | 6 | 3 h code/test trên PC, **3 h bay đo 75 sự kiện** |
| 23.7 Marker bản đồ + popup snapshot | 3 | Nối vào bản đồ Leaflet đã có từ Phase 09 |
| 23.8 Panel IoT | 3 | Không thêm thư viện mới |
| **Tổng** | **25** | Đường găng: 23.2 → 23.3 → 23.5 → 23.6. 23.4 làm song song; 23.7 và 23.8 chỉ cần 23.5 xong |

**Thứ tự khuyến nghị:** làm trọn vẹn 23.1 → 23.5 trên bàn với `FakeDetector` + SITL trước, chỉ ra bãi **một lần duy nhất** cho 23.6 bước 7 (đo sai số) và bài kiểm tra tổng ở cổng pass. Gom chung buổi bay đó với bài F9 của Phase 22 nếu lịch cho phép.

## Ghi chú cho sổ tay

Những khái niệm phase này cần giải thích cho người chưa biết gì (để agent viết `docs/so-tay/23-iot-mqtt-su-kien.md` sau):

- **MQTT là gì, khác WebSocket chỗ nào** — ví von bưu điện (bỏ thư vào hòm có tên, ai đăng ký thì nhận) so với gọi điện thoại trực tiếp giữa hai người.
- **Topic, publish, subscribe, broker** — bốn từ vựng cốt lõi, giải thích bằng một hình.
- **QoS 0 / 1 / 2** — "gửi rồi thôi" / "gửi tới khi có xác nhận, có thể trùng" / "đúng một lần, đắt nhất"; vì sao dự án này không dùng QoS 2.
- **Retained** — "dán tờ giấy mới nhất lên bảng tin để ai tới sau cũng đọc được"; và vì sao telemetry **không** nên retained (thông tin cũ nguy hiểm hơn không có thông tin).
- **Last Will and Testament** — "di chúc gửi trước": broker giữ sẵn một tin và tự phát hộ khi thấy bên gửi chết đột ngột.
- **Vì sao đếm `seq` lại đo được mất gói** — không cần máy đo nào, chỉ cần một con số tăng dần.
- **Chống spam bằng debounce + cooldown** — ví von công tắc đèn bị rung: bấm một cái mà đèn nháy 50 lần.
- **Vì sao tách giao diện `Detector`** — để đường ống test được mà không cần AI, và để đổi model sau này không phải sửa pipeline.
- **Phép chiếu tia xuống mặt phẳng** — biết vị trí trên ảnh + độ cao + góc nghiêng thì suy ra vị trí trên mặt đất; vẽ hình tam giác vuông cho dễ hiểu.
- **Ma trận nội tham số K là gì** — camera "phiên dịch" mét ngoài đời thành điểm ảnh như thế nào.
- **Vì sao giả thiết "mặt đất phẳng" khiến kết quả chỉ là ước lượng** — và vì sao vòng tròn sai số trên bản đồ là cách trung thực để trình bày.
- **Vì sao phải nội suy telemetry theo thời gian khung ảnh** — 1 Hz so với 14 Hz, và 1 giây ở 3 m/s là 3 mét.
- **Vì sao không hạ ngưỡng confidence khi model không nhận ra người** — phân biệt giữa "sửa lỗi" và "nguỵ tạo kết quả".
