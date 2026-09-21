# Research: Web GCS stack cho UAV IoT-CV

**Ngày:** 21/09/2026 · **Phạm vi:** chọn stack cho website GCS (telemetry + map/mission + manual control + video YOLO + MQTT)

**Bối cảnh repo:** `backend/` (FastAPI + pymavlink, 824 LOC, telemetry đã chạy, `control.py`/`mission.py` còn stub `NotImplementedError`), `frontend/` (550 LOC vanilla JS + Leaflet CDN), license **MIT**.

---

## TL;DR — 5 quyết định

| # | Câu hỏi | Chọn (hạng 1) | Hạng 2 |
|---|---|---|---|
| 1 | Lớp truy cập MAVLink | **pymavlink** (giữ nguyên) | pymavlink + `mavlink-router`/`mavp2p` để multiplex |
| 2 | Frontend | **Vite + React 19 + TS + Tailwind v4 + shadcn/ui** | Giữ vanilla JS |
| 2b | Map | **Leaflet + react-leaflet** | MapLibre GL + PMTiles (khi cần offline) |
| 2c | Realtime | **WebSocket** (bắt buộc, xem §2.3) | — (SSE không đủ) |
| 4 | Video + overlay | **Backend proxy MJPEG (fan-out, không re-encode) + box qua WS + canvas overlay** | MediaMTX → WebRTC |
| 5 | Layout | Giữ monorepo hiện tại, thêm `frontend/` Vite + `docker-compose.yml` | — |

> **Hai đính chính với đề bài:**
>
> 1. **Next.js hiện là 16.3.5, không phải 15.** Next 15 đã là major cũ.
> 2. **Gói PyPI `mavsdk` đang đổi tên.** 3.17.4 là bản cuối dưới tên `mavsdk`; wrapper gRPC chuyển sang `mavsdk-grpc`, còn tên `mavsdk` được tái sử dụng cho một binding native API khác. Đây là rủi ro churn nghiêm trọng, xem §1.

---

## 1. Lớp truy cập MAVLink

### 1.1 Bảng so sánh (số liệu verify 21/09/2026)

| Lựa chọn | Bản mới nhất | License | Trạng thái | ArduPilot Copter 4.7 | Rủi ro áp dụng |
|---|---|---|---|---|---|
| **pymavlink** | **2.4.49** | LGPL-3.0 | Active, repo chính chủ ArduPilot | **Chuẩn tham chiếu** — MAVProxy/autotest của ArduPilot dùng chính nó | **Thấp**. Đã nằm trong repo. |
| MAVSDK-Python | **3.17.4** (PyPI) / 3.17.2 (tag GH) | BSD-3 | Active nhưng **đang đổi tên gói** | **Partial, PX4-first.** Issue upstream (#229, #728, #1568, #2652) xác nhận không phải plugin nào cũng hỗ trợ ArduPilot; ví dụ `mission.py` vẫn fail với ArduPilot SITL (#819, 02/2026) | **Cao.** Cần binary `mavsdk_server` chạy kèm + churn tên gói + hỗ trợ ArduPilot không chắc |
| mavlink2rest | 1.0.2 (29/03/2026) | **MIT** | Active | Cầu REST/WS trung lập | Trung bình — thêm 1 service Rust |
| mavlink-router | tag `v4` (release thưa; thực tế dùng `main`) | Apache-2.0 | Commit active, release chậm | Router thuần, không hiểu nội dung | Thấp (là công cụ, không phải thư viện) |
| mavp2p | v1.3.3 (21/05/2026) | MIT | Active | Router thuần, 1 binary Go | Thấp |
| DroneKit-Python | **v2.9.1 — 21/04/2017** | Apache-2.0 | **Chết.** README treo banner "MAINTAINERS NEEDED" | Không import được trên Python hiện đại | **Loại** |

### 1.2 Khuyến nghị: giữ **pymavlink**

Lý do, theo thứ tự trọng số:

1. **Ba tính năng bạn cần đều là protocol thô, pymavlink làm trực tiếp:**
   - **GUIDED velocity:** `SET_POSITION_TARGET_LOCAL_NED`, `type_mask = 0b0000110111000111 = 0x0DC7 = 3527`, frame `MAV_FRAME_BODY_OFFSET_NED (9)`. **ArduPilot dừng máy bay sau 3 giây** nếu không nhận lệnh mới → phải gửi lại **ít nhất mỗi 1 giây**. (Docstring `backend/mavlink/control.py` hiện tại đã ghi đúng điều này.)
   - **Mission upload:** `MISSION_COUNT` → `MISSION_REQUEST_INT(seq)` → `MISSION_ITEM_INT` → `MISSION_ACK`. Item phải đến **đúng thứ tự**; sai thứ tự bị drop.
   - **Stream rate:** `MAV_CMD_SET_MESSAGE_INTERVAL` (id **511**), tham số `message_id` + `interval_us`, `-1` = tắt, `0` = mặc định. Hỗ trợ từ **ArduPilot 4.0+**.
2. **MAVSDK bị loại vì 3 lý do cộng dồn**, không phải một: (a) cần `mavsdk_server` binary riêng — thêm một process phải quản lý; (b) ArduPilot support là partial và có bug mission thực tế; (c) gói đang đổi tên giữa chừng. Với một người làm một mình có deadline, đây là ba nguồn rủi ro không cần thiết để đổi lấy một API `async` đẹp hơn.
3. **Chi phí chuyển đổi = âm.** `connection.py` + `telemetry.py` đã chạy. Chuyển sang MAVSDK là vứt bỏ phần đang hoạt động để lấy về một lớp trừu tượng che mất chính các thứ bạn cần kiểm soát (type_mask, frame, seq).

**Cảnh báo license:** pymavlink là **LGPL-3.0**, repo bạn là **MIT**. Với Python, import runtime được coi là dynamic linking nên MIT của bạn vẫn giữ được; nhưng **nếu sau này đóng gói PyInstaller thành một file thực thi** thì phải bảo toàn khả năng thay thế thư viện (LGPL §4). Ghi chú vào README là đủ ở giai đoạn này.

### 1.3 Hạng 2 — khi nào cần thêm router

Ở **GIAI ĐOẠN 62**, kế hoạch dùng Mission Planner làm oracle để đối chiếu mission upload. Một endpoint MAVLink (UDP 14550) **không phục vụ hai client cùng lúc** một cách tin cậy. Khi đó thêm router:

```bash
mavp2p udps:0.0.0.0:14550 udpc:127.0.0.1:14551 udpc:127.0.0.1:14552
```

Backend nối `14551`, Mission Planner nối `14552`. Đây là **công cụ vận hành**, không phải dependency của code — không ảnh hưởng kiến trúc.

### 1.4 mavlink2rest: mượn schema, đừng mượn service

mavlink2rest (MIT) đã giải đúng bài toán "MAVLink → JSON cho web". **Đừng cài nó** (thêm 1 service Rust vào stack). Nhưng **hãy đọc schema REST/WS của nó** (`/v1/mavlink/*`, `/v1/ws/mavlink?filter=<regex>`) làm tham chiếu khi thiết kế API của bạn. MIT nên copy trực tiếp cũng hợp lệ.

---

## 2. Frontend stack

### 2.1 Next.js 16 vs Vite+React vs vanilla — khuyến nghị **Vite + React**

| Tiêu chí | Next.js 16.3.5 | **Vite 8 + React 19** | Vanilla JS (hiện tại) |
|---|---|---|---|
| Có cần SSR/SEO không? | Có nhưng **vô dụng ở đây** — GCS chạy LAN, 1 người dùng, không index Google | Không cần, đúng nhu cầu | Không cần |
| Deploy chung với FastAPI | **Khó** — cần process Node thứ 2, hoặc `output: 'export'` (mất đúng phần giá trị của Next) | **Dễ** — `vite build` ra file tĩnh, `app.mount("/", StaticFiles(...))` **đã có sẵn trong `app.py`** | Đã chạy |
| Chi phí khái niệm cho người mới | Cao: Server/Client Components, `"use client"`, nhiều tầng caching | Thấp: chỉ React thuần | Thấp nhất |
| Quản lý state UI phức tạp (mission editor, joystick, event log, video overlay) | Tốt | **Tốt** | **Đuối** — 550 LOC hiện tại còn ổn, thêm 4 panel nữa sẽ rối |
| Điểm "đồ án môn học" | Ấn tượng nhưng khó bảo vệ | Đủ hiện đại, dễ giải thích | Dễ bị chê thiếu kỹ thuật |

**Kết luận:** Next.js giải bài toán bạn không có (SSR, routing đa trang, SEO) và tính phí bằng độ phức tạp cộng một process Node thứ hai. Vite cho bạn React/TS/Tailwind/shadcn đầy đủ, build ra file tĩnh mà backend FastAPI **đã biết cách phục vụ**. Giữ vanilla JS là hạng 2 hợp lý nếu deadline rất gấp, nhưng mission editor + manual control + canvas overlay đúng là loại state mà React trả lại vốn.

**Chi phí port thực tế:** 550 LOC vanilla → khoảng 5 component React. Đây là 1–2 ngày, không phải 1 tuần.

### 2.2 Map: Leaflet (hạng 1) vs MapLibre (hạng 2)

| Tiêu chí | **Leaflet 1.9.4** | MapLibre GL 6.10.0 |
|---|---|---|
| License | BSD-2 | BSD-3 |
| Wrapper React | react-leaflet **5.0.0** | react-map-gl **8.1.3** |
| Xoay marker theo heading | Plugin `Leaflet.RotatedMarker` (CSS transform) | `icon-rotate` trong style spec, GPU, mượt hơn |
| Tile offline | Raster cache (plugin `leaflet.offline`) | **PMTiles** — 1 file duy nhất, không cần tile server |
| Vẽ/sửa waypoint | **terra-draw** hỗ trợ cả hai → không phải yếu tố phân biệt | terra-draw |
| Độ dốc học | Thấp — API mệnh lệnh `L.marker().setLatLng()` | Cao hơn — style-spec JSON, sources/layers/paint |
| Bundle | Nhỏ | Lớn (WebGL) |

**Chọn Leaflet** vì: đã dùng trong `frontend/map.js`, API khớp với mức kinh nghiệm hiện tại, và `terra-draw` (commit mới nhất 20/09/2026) triệt tiêu lợi thế vẽ waypoint của MapLibre. Chuyển sang MapLibre **chỉ khi** phát sinh yêu cầu bản đồ offline ngoài thực địa — lúc đó PMTiles là lý do chính đáng duy nhất.

### 2.3 Realtime: **WebSocket**, SSE không đủ

Đây **không** phải lựa chọn dựa trên băng thông (8 Hz thì cả hai đều thừa sức). Lý do là **an toàn**:

- Manual control cần **kênh lên** (WASD → velocity). SSE chỉ một chiều server→client.
- Dead-man timeout dựa trên việc **socket đóng = mất quyền điều khiển ngay lập tức**. `backend/app.py` đã cài đúng: `except WebSocketDisconnect: SAFETY.on_web_disconnected()`. Nếu tách lệnh sang REST POST riêng, "browser chết" không còn là một sự kiện quan sát được tức thì → **mất tính chất dead-man**.

Giữ **một** WebSocket cho cả telemetry xuống, lệnh lên, và box YOLO (§4). Docs: <https://fastapi.tiangolo.com/advanced/websockets/>

### 2.4 State: zustand có, TanStack Query dùng hạn chế

- **zustand 5.0.15** — đúng công cụ cho telemetry đẩy qua WS (một store, cập nhật 8 Hz, component subscribe theo slice).
- **TanStack Query 5.103.1** — thiết kế cho **request/response caching**, không cho server-push. Đẩy telemetry qua nó là dùng sai công cụ. **Chỉ dùng cho REST**: mission CRUD, `/api/status` lúc khởi động, config, danh sách event log. Nếu cuối cùng chỉ có 3–4 endpoint REST thì **bỏ luôn cũng được** — `fetch` trần là đủ. Đừng thêm dependency để cho có.

### 2.5 Phiên bản chốt (verify trực tiếp từ registry, 21/09/2026)

| npm | Bản | npm | Bản |
|---|---|---|---|
| react / react-dom | 19.3.0 | leaflet | 1.9.4 |
| vite | 8.3.0 | react-leaflet | 5.0.0 |
| typescript | 5.103.1 | maplibre-gl | 6.10.0 |
| tailwindcss | 4.3.3 | react-map-gl | 8.1.3 |
| zustand | 5.0.15 | @turf/turf | 7.4.0 |
| @tanstack/react-query | 5.103.1 | zod | 4.6.5 |
| shadcn (CLI) | 4.21.0 | next *(không dùng)* | 16.3.5 |

| PyPI | Bản | PyPI | Bản |
|---|---|---|---|
| fastapi | 0.141.1 | pymavlink | 2.4.49 |
| uvicorn | 0.53.0 | paho-mqtt | 2.1.0 (đã verify lại — gói này thật sự chậm nhịp, không phải lỗi cache) |
| pydantic | 2.13.5 | **opencv-python** | **5.0.0.93** — major bump 4.x → 5.x, đọc changelog |
| ruff | 0.16.8 | ultralytics | 8.4.157 |
| **pytest** | **9.1.1** — major 8 → 9 | uv | 0.12.17 |

> `requirements.txt` hiện ghi `opencv-python>=4.10` — với `>=`, pip sẽ kéo **5.0.0.93**. Nên pin `opencv-python>=4.10,<5` cho tới khi kiểm tra API.

---

## 3. Dự án web GCS mã nguồn mở đáng tham khảo

**Repo của bạn là MIT** → cột License quyết định "đọc được" hay "copy được".

| Dự án | URL (đã verify) | Sao | License | Stack | Mượn gì |
|---|---|---|---|---|---|
| **mavlink2rest** | <https://github.com/mavlink/mavlink2rest> | ~132 | **MIT — copy được** | Rust/Actix | **Schema JSON telemetry + filter regex trên WS.** Thứ đáng mượn nhất trong bảng. |
| **mavlink-server** | <https://github.com/bluerobotics/mavlink-server> | ~58 | **MIT — copy được** | Rust | Kế thừa mavlink2rest; mô hình routing + REST/WS |
| **Mavelous** | <https://github.com/wiseman/mavelous> | ~179 | **MIT — copy được** | Flask + JS thuần | Cũ nhưng dễ đọc: pattern "double-tap bản đồ → GUIDED goto", UI arm/disarm/đổi mode |
| **PX4 flight_review** | <https://github.com/PX4/flight_review> | ~276 | **BSD-3 — copy được** | Python/Bokeh | Vẽ đồ thị log sau chuyến bay |
| **Cockpit** (Blue Robotics) | <https://github.com/bluerobotics/cockpit> | ~198 | **AGPL-3.0 — CHỈ ĐỌC** | Vue 3 + TS + Vuetify | Kiến trúc widget dashboard, mapping joystick, "data-lake" MAVLink→biến UI. **Phải tự viết lại.** |
| **BlueOS** | <https://github.com/bluerobotics/BlueOS> | ~458 | **AGPL-3.0 — CHỈ ĐỌC** | Docker microservices | Cách nó dùng mavlink2rest onboard |
| **ArduPilot WebTools** | <https://github.com/ArduPilot/WebTools> | ~62 | **GPL-3.0 — CHỈ ĐỌC** | Python + JS | Ý tưởng TelemetryDashboard |
| **AetherGCS** | <https://github.com/AnuragGupta181/AetherGCS> | 0 | **KHÔNG CÓ LICENSE — CẤM COPY** | React 19 + Tailwind + Leaflet + Zustand / FastAPI + pymavlink + YOLO11 | **Kiến trúc trùng gần hệt đề bài của bạn** → dùng để đối chiếu phạm vi tính năng. Không license = mặc định giữ toàn bộ bản quyền. |

**Kết quả âm (đã tìm, không có):**

- **QGroundControl không có bản web/WASM.** Chỉ native Qt/QML desktop + mobile.
- **Mission Planner không có thành phần web.** C#/WinForms, Windows-only.
- Tìm "mavlink web gcs" / "webgcs" chủ yếu ra repo sinh viên 0–11 sao (`kiorpesc/WebGCS`, `gaelbillon/Nodejs-Websockets-GCS`), giá trị thấp.

**Ưu tiên đọc:** `Mavelous` trước (đơn giản, MIT, đúng pattern bạn cần) → `mavlink2rest` (schema) → `Cockpit` (kiến trúc, chỉ nhìn).

---

## 4. Video ESP32-CAM + overlay YOLO

### 4.1 Số liệu ESP32-CAM (OV2640)

| Độ phân giải | FPS | Ghi chú |
|---|---|---|
| 96×96 / 128×128 | 50+ | |
| **320×240 (QVGA)** | **44** | **Khuyến nghị cho Version 1** |
| 640×480 (VGA) | **14** | Băng thông ~500 KB/s–1 MB/s |
| 1600×1200 | 1.3 | Không dùng cho livestream |

Độ trễ khoảng 100 ms ở 10 FPS; 20–50 ms ở cấu hình ≤400×296 đã tối ưu.

> `backend/vision/stream.py` đang ghi "bắt đầu ở JPEG 640x480". Dựa trên số liệu trên, **320×240 là điểm khởi đầu đúng hơn** (44 FPS so với 14 FPS). Để dành 640×480 cho ảnh chụp tĩnh khi có detection.

### 4.2 Direct `<img>` vs backend proxy — chọn **proxy**, nhưng vì lý do khác với thường nghĩ

Webserver Arduino mặc định của ESP32-CAM (`multipart/x-mixed-replace`) **chỉ phục vụ được 1 client**; client thứ hai làm treo client thứ nhất. (Fork `arkhipenko/esp32-cam-mjpeg-multiclient` nâng lên ~10 client.)

Điểm mấu chốt: **backend của bạn BẮT BUỘC phải là một client** để chạy YOLO. Vậy "1 client duy nhất" đã bị backend chiếm. Trình duyệt trỏ `<img>` thẳng vào ESP32 sẽ là client thứ hai → hỏng cả hai.

Do đó **backend phải proxy**. Nhưng proxy **không có nghĩa là decode/re-encode**:

```text
ESP32-CAM ──MJPEG──► FastAPI
                       ├─► fan-out MJPEG NGUYÊN BẢN cho browser  (chỉ copy byte, ~0 CPU)
                       └─► vòng YOLO riêng, 3–5 fps, decode 1 trên N frame
                              └─► box JSON ──WS──► canvas overlay
```

Lợi ích phụ: proxy cũng gom CORS về một chỗ (webserver tối giản của ESP32 không tự thêm CORS header — phải sửa sketch Arduino thủ công).

### 4.3 Vẽ box: WS + canvas (hạng 1) vs re-encode (hạng 2)

| | (a) Backend vẽ box rồi re-encode MJPEG | **(b) Box qua WS + canvas overlay** |
|---|---|---|
| Độ trễ | Cao hơn (decode + encode mỗi frame) | **Thấp** — luồng video không bị đụng tới |
| CPU backend | Nặng, tỉ lệ với FPS video | **Chỉ chi phí inference** |
| Frontend | `<img>` đơn giản | Cần `<canvas>` phủ lên + đồng bộ frame-id |
| Nhược điểm | **Buộc FPS video = FPS inference** | Box có thể lệch vài chục ms so với frame đang hiển thị |

**Chọn (b).** Lợi ích thật không phải là tiết kiệm CPU, mà là nó **tách FPS video (44) khỏi FPS inference (3–5)**. Với (a), video bị kéo tụt xuống bằng tốc độ YOLO. Ngoài ra box đi chung WebSocket telemetry đã có sẵn, không cần kênh mới.

Gửi kèm `frame_id` + `ts` trong message box để frontend biết box thuộc frame nào.

### 4.4 WebRTC — chưa cần ở Version 1

- **MediaMTX** v1.21.1 (20/09/2026) — nhận MJPEG, phát WebRTC.
- **go2rtc** v1.9.14 (19/01/2026) — tương tự; quảng cáo ~0,5 s nhưng **đó là con số nhà cung cấp**, và issue #1736/#559 báo chất lượng giảm + độ trễ gấp đôi khi nguồn là MJPEG (chứ không phải RTSP/H.264).

Thêm một service để đổi lấy độ trễ chưa chắc tốt hơn → **để sau**, chỉ làm nếu §4.2 thực sự không đủ.

### 4.5 Model YOLO

`ultralytics 8.4.157` ship YOLO11. Trên **laptop CPU không GPU**: **YOLO11n** hoặc **YOLO11s**, export ONNX. `config.YOLO_WEIGHTS` đang trỏ `ml/weights/yolo11n.pt` — **đã đúng**. Model medium/large chỉ dành cho máy có GPU (TensorRT, dưới 15 ms).

---

## 5. Layout monorepo

Cấu trúc hiện tại **đã gần đúng**. Thay đổi cần thiết:

```text
IOT-CV/
├─ backend/                 # giữ nguyên: mavlink/ mqtt/ vision/ tests/
├─ frontend/                # THAY: vanilla JS -> Vite + React + TS
│  ├─ src/{components,hooks,store,lib}/
│  ├─ package.json          # pnpm
│  └─ vite.config.ts        # build.outDir = "dist"; proxy /api + /ws -> :8000
├─ ml/                      # giữ nguyên
├─ esp32/                   # giữ nguyên (camera/, mavlink_bridge/)
├─ docs/  params/  scripts/
├─ pyproject.toml           # THÊM [project] để uv quản lý; giữ [tool.ruff] / [tool.pytest]
├─ docker-compose.yml       # THÊM
└─ Makefile
```

**Đổi `app.py` khi có Vite** — hiện đang mount `frontend/`, phải chuyển sang `frontend/dist/`:

```python
_FRONTEND_DIR = config.PROJECT_ROOT / "frontend" / "dist"
```

**Chuyển sang uv** (giữ `requirements*.txt` cũng được, nhưng uv nhanh hơn nhiều):

```bash
uv sync
uv run uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
uv run ruff check .
uv run pytest
```

**Dựng frontend:**

```bash
cd frontend
pnpm create vite . --template react-ts
pnpm add zustand leaflet react-leaflet
pnpm add -D tailwindcss @tailwindcss/vite typescript
pnpm dlx shadcn@latest init
pnpm build
```

**`docker-compose.yml`** (backend + mosquitto; SITL để riêng vì ArduPilot SITL chạy native trên host dễ hơn):

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports: ["1883:1883"]
    volumes: ["./deploy/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro"]

  backend:
    build: .
    ports: ["8000:8000"]
    environment:
      MAVLINK_ENDPOINT: "udp:0.0.0.0:14550"
      MQTT_BROKER: "mosquitto"
    depends_on: [mosquitto]
    network_mode: host
```

> **Lưu ý quan trọng:** `network_mode: host` **không hoạt động trên Docker Desktop for Windows/macOS**. Trên máy Windows của bạn, chạy backend **native** (`uv run uvicorn ...`) và chỉ container hoá mosquitto. Đây chính là lý do nên để SITL + backend ngoài compose ở giai đoạn dev.

---

## Hạn chế và điểm cần kiểm lại

1. **Chưa benchmark trên phần cứng thật.** Mọi con số MJPEG/latency là từ nguồn thứ ba (benchmark arXiv 2505.24081, forum), chưa đo trên ESP32-CAM + WiFi + laptop cụ thể của bạn.
2. **`typescript 5.103.1` và `vite 8.3.0`** lấy trực tiếp từ registry npm nhưng nhảy bậc bất thường so với nhịp phát hành lịch sử — chạy `pnpm view <pkg> version` lúc cài thật để chốt.
3. **Ngày release `mavlink-router v4`** mâu thuẫn giữa API JSON (2024-02-13) và trang render (2025-02-13). Không ảnh hưởng khuyến nghị (v4 chỉ là công cụ tuỳ chọn).
4. **Copter 4.7.1 (03/09/2026) là bản stable hiện tại** — verify trực tiếp. Ngày phát hành 4.7.0 chỉ có qua search snippet, chưa fetch trực tiếp.
5. **Chưa đánh giá `dronekit2`** (fork một-người-duy-trì của Onikore) ngoài mô tả PyPI của chính nó. Không liên quan vì DroneKit đã bị loại.
6. **Điều gì sẽ làm đổi khuyến nghị:** nếu ArduPilot support của MAVSDK trở thành chính thức upstream **và** việc đổi tên gói ổn định → MAVSDK đáng xem lại cho các dự án *mới*; nhưng với repo này, chi phí chuyển đổi vẫn lớn hơn lợi ích.

## Nguồn (đã verify bằng WebFetch/API, 21/09/2026)

**ArduPilot / MAVLink**

<https://ardupilot.org/dev/docs/copter-commands-in-guided-mode.html> · <https://ardupilot.org/dev/docs/mavlink-requesting-data.html> · <https://mavlink.io/en/services/mission.html> · <https://mavlink.io/en/guide/message_rates.html> · <https://discuss.ardupilot.org/t/copter-4-7-1-released/145385>

**Thư viện MAVLink**

<https://github.com/ArduPilot/pymavlink> · <https://pypi.org/project/pymavlink/> · <https://github.com/mavlink/MAVSDK-Python> · <https://pypi.org/project/mavsdk/> · <https://github.com/mavlink/mavlink2rest> · <https://github.com/bluenviron/mavp2p> · <https://github.com/mavlink-router/mavlink-router> · <https://github.com/dronekit/dronekit-python>

**Web GCS**

<https://github.com/bluerobotics/cockpit> · <https://github.com/bluerobotics/mavlink-server> · <https://github.com/bluerobotics/BlueOS> · <https://github.com/wiseman/mavelous> · <https://github.com/ArduPilot/WebTools> · <https://github.com/PX4/flight_review> · <https://github.com/AnuragGupta181/AetherGCS>

**Frontend / video**

<https://fastapi.tiangolo.com/advanced/websockets/> · <https://github.com/maplibre/maplibre-gl-js> · <https://github.com/Leaflet/Leaflet> · <https://github.com/JamesLMilner/terra-draw> · <https://github.com/protomaps/PMTiles> · <https://github.com/sysid/sse-starlette> · <https://github.com/bluenviron/mediamtx> · <https://github.com/AlexxIT/go2rtc> · <https://github.com/astral-sh/uv> · <https://arxiv.org/html/2505.24081v1>

**URL KHÔNG verify được / chỉ qua search snippet**

- `ardupilot.org/dev/docs/mavlink-mission-command-messages-mission_item.html` — **HTTP 404**, đã thay bằng `mavlink.io/en/services/mission.html`
- `discuss.ardupilot.org/t/copter-4-7-0-released/144650` — chỉ qua search
- `github.com/ArduPilot/ardupilot/blob/master/ArduCopter/ReleaseNotes.txt` — chỉ qua search
- Các blog so sánh map (jawg.io, gispeople.com.au, pkgpulse.com) — chỉ tham khảo, không dùng làm căn cứ
