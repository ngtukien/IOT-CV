# Kế hoạch phân công 4 người — 12 tuần

> Tài liệu này **không thay thế** [README.md](../README.md).
> README trả lời *"làm gì, theo thứ tự nào"* (92 giai đoạn + CỔNG PASS).
> File này trả lời *"ai làm, tuần nào, xong thì chứng minh bằng gì"*.
> Khi hai tài liệu xung đột về **thứ tự kỹ thuật**, README thắng.
> Khi xung đột về **an toàn**, [SAFETY.md](../SAFETY.md) thắng tất cả.

**Giả định đã chốt với nhóm:**

| Thông số | Giá trị |
|---|---|
| Thời gian | 12 tuần (1 học kỳ) |
| Phần cứng hiện có | Chưa mua gì — Batch A theo GĐ 90 |
| Cách chia việc | Chuyên môn hóa theo subsystem |
| Số người | 4 |

---

## Mục lục

1. [Bốn vai trò](#1-bốn-vai-trò)
2. [Ai sở hữu file nào](#2-ai-sở-hữu-file-nào)
3. [Hợp đồng interface — việc quan trọng nhất tuần 1](#3-hợp-đồng-interface--việc-quan-trọng-nhất-tuần-1)
4. [Timeline 7 phase](#4-timeline-7-phase)
5. [Cổng phase — điều kiện đi tiếp](#5-cổng-phase--điều-kiện-đi-tiếp)
6. [Lịch mua phần cứng](#6-lịch-mua-phần-cứng)
7. [Vai trò trong buổi bay](#7-vai-trò-trong-buổi-bay)
8. [Nhịp làm việc và review](#8-nhịp-làm-việc-và-review)
9. [Rủi ro và đường lùi](#9-rủi-ro-và-đường-lùi)
10. [Bảng phân bổ 92 giai đoạn](#10-bảng-phân-bổ-92-giai-đoạn)

---

## 1. Bốn vai trò

```text
                          UAV
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
FLIGHT SYSTEM        VISION SYSTEM         COMMUNICATION
     P1                    P4               P3 (ESP32 bridge)
                                                 │
                                                 ▼
                                              LAPTOP
                                     P2 (backend+web control)
                                     P4 (AI pipeline)
                                                 │
                                                 ▼
                                             WEB GCS
                                        P3 (hiển thị, MQTT)
```

| Mã | Vai trò | Sở hữu | Câu hỏi họ phải trả lời được |
|---|---|---|---|
| **P1** | Flight & Hardware Lead — *Safety Officer* | ArduPilot trên FC thật, calibration, params, failsafe, geofence, buổi bay, SITL hạ tầng | "Máy bay này an toàn để bay chưa, và vì sao tôi biết?" |
| **P2** | GCS Lead | SITL + `backend/mavlink/`, `backend/app.py`, `esp32/mavlink_bridge/`, `control.js`, `mission.js` | "Lệnh từ web tới được flight controller nguyên vẹn, dừng đúng lúc, và người vận hành thấy được điều đó không?" |
| **P3** | Embedded & IoT Lead *(kiêm Hands)* | `esp32/camera/`, `backend/mqtt/`, `frontend/ui.js`, `map.js`, `video.js`, `styles.css` | "ESP32 bridge có đang chuyển MAVLink không bị mất byte không, và camera có đang stream ổn định không?" |
| **P4** | Vision & ML Lead | `ml/`, `backend/vision/`, 5 model, 4 experiment, dataset | "Model này phát hiện được người ở độ cao bay thật, và tôi chứng minh bằng số nào?" |

**Cân bằng khối lượng:** Bộ cũ lệch nặng — P4 gánh vision + ML + IoT + ESP32-CAM, còn P3 chỉ có web.
Bộ mới tách ESP32-CAM và MQTT sang P3 (Embedded), giữ ML/YOLO/dataset/4 experiment cho P4.

**P1 trong 3 tuần đầu:** Không có phần cứng (Batch A chưa mua). Bù lại, P1 dựng SITL cho cả nhóm,
làm oracle bằng Mission Planner (GĐ 55, 62), và lập BOM. Từ tuần 4 P1 là người bận nhất.

---

## 2. Ai sở hữu file nào

Chuyên môn hóa chỉ chạy được nếu **không hai người sửa cùng một file trong cùng một tuần**.
Bảng này là luật chống conflict git.

| Đường dẫn | Chủ sở hữu | Bắt buộc có approve của |
|---|---|---|
| `backend/mavlink/**` | P2 | **P1** (mọi thay đổi liên quan mode/failsafe/velocity) |
| `backend/app.py`, `backend/config.py` | P2 | P3 (vì đổi API là đổi hợp đồng) |
| `backend/tests/**` | P2 | — |
| `backend/vision/**` | P4 | P2 |
| `backend/mqtt/**` | **P3** | P4 (topic schema) |
| `frontend/control.js`, `frontend/mission.js` | **P2** | P1 (safety) |
| `frontend/ui.js`, `frontend/map.js`, `frontend/video.js`, `frontend/styles.css` | **P3** | P2 (khi đổi cách gọi API) |
| `ml/**` | P4 | — |
| `esp32/camera/**` | **P3** | P1 (nguồn, wiring, khối lượng) |
| `esp32/mavlink_bridge/**` | **P2** | P1 (nguồn, wiring, mức logic 3.3 V) |
| `params/**` | **P1** | — (nhưng *phải* commit, theo GĐ 88) |
| `docs/wiring.md`, `docs/parameters.md`, `docs/test-log.md`, `docs/dev-env.md` | P1 | — |
| `docs/architecture.md` | P2 | cả nhóm |
| `docs/experiments.md` | P4 | — |
| `docs/team/**` | mỗi người sửa file của mình | — |
| `.github/**`, `Makefile`, `requirements*.txt` | P2 | — |
| `README.md`, `SAFETY.md` | cả nhóm | **P1** với `SAFETY.md` |

**Vùng nguy hiểm nhất:** `backend/config.py`. Cả 4 người đều muốn thêm biến vào đây.
Luật: ai cần biến mới thì nhắn P2 trong nhóm chat, P2 gom lại và commit một lần mỗi
tuần. Không tự thêm.

---

## 3. Hợp đồng interface — việc quan trọng nhất tuần 1

Nếu bỏ qua phần này thì đến tuần 6 sẽ có 4 nhánh code không ghép được với nhau.

Sản phẩm của tuần 1 là **`docs/architecture.md`**, do P2 viết, cả nhóm review, chứa
đúng 5 hợp đồng dưới đây. Sau khi merge, đổi hợp đồng phải mở PR riêng và thông báo
cho người bị ảnh hưởng.

### 3.1. Telemetry JSON — P2 chốt, P3 tiêu thụ

Đã tồn tại trong [backend/app.py:57](../backend/app.py#L57) (`status_payload()`).
Nhiệm vụ tuần 1 chỉ là **viết nó ra tài liệu và đóng băng tên field**:

```json
{
  "connected": true, "mode": "GUIDED", "armed": false,
  "lat": 10.123456, "lon": 106.123456, "relative_alt": 5.2,
  "heading": 125, "ground_speed": 0.8, "satellites": 14,
  "battery_voltage": 11.4,
  "endpoint": "udp:127.0.0.1:14550",
  "safety": { "...": "..." }, "limits": { "...": "..." }
}
```

### 3.2. Danh sách endpoint — P2 chốt, P3 gọi

| Endpoint | Giai đoạn | Ghi chú |
|---|---|---|
| `GET /api/health`, `GET /api/status` | 7 | đã có |
| `WS /ws/telemetry` | 7 | đã có, ~8 Hz |
| `POST /api/mode` `{mode}` | 9 | |
| `POST /api/arm`, `POST /api/disarm` | 9 | |
| `POST /api/takeoff` `{altitude}` | 9 | |
| `POST /api/hold`, `POST /api/rtl`, `POST /api/land` | 12 | |
| `WS /ws/control` | 10, 11 | frontend gửi liên tục khi giữ phím; im lặng > 300 ms là dead-man |
| `POST /api/mission/validate` | 14 | trả `errors: []` |
| `POST /api/mission/upload`, `POST /api/mission/start`, `POST /api/mission/clear` | 15 | |
| `GET /api/mission` | 15 | download để đối chiếu |
| `WS /ws/events` | 74 | detection event đẩy về dashboard |
| `GET /api/camera/status` | 78 | camera offline không được làm hỏng trang |

### 3.3. Detection event — P4 chốt, P3 tiêu thụ

```json
{
  "event": "person_detected", "confidence": 0.87, "timestamp": "...",
  "uav_lat": 10.123, "uav_lon": 106.123, "uav_alt": 5.4,
  "snapshot": "detections/....jpg"
}
```

Ghi rõ trong báo cáo và trong tooltip trên dashboard: `uav_lat/uav_lon` là **tọa độ
UAV**, không phải tọa độ người (README dòng 126–136).

### 3.4. MQTT topic — P4 chốt

Đã khai báo trong [backend/mqtt/publisher.py](../backend/mqtt/publisher.py):
`uav/telemetry`, `uav/status`, `uav/mission`, `uav/detection/person`, `uav/link`.
Tuần 1 chốt payload từng topic; ai publish topic nào.

### 3.5. Camera stream — P4 chốt

URL, định dạng (MJPEG), độ phân giải khởi điểm 640×480, cách báo "offline".

### Nguyên tắc chống tắc: mock trước, thay sau

P3 không được ngồi chờ P2, P3 cũng không được chờ camera của P4.

- P2 cung cấp **mock mode** ngay tuần 1: đặt `TELEMETRY_AUTOSTART=0` thì `/api/status`
  trả dữ liệu giả có thêm cờ `"mock": true`. Cơ chế này đã có sẵn trong
  [backend/app.py:38](../backend/app.py#L38).
- P4 cung cấp một file MJPEG/video mẫu để P3 dựng panel video.

**Nhưng:** CỔNG PASS 7A của README ghi rõ *"nếu website chỉ hiện data giả, chưa pass"*.
Mock chỉ dùng để phát triển song song. Không có phase nào được nghiệm thu bằng mock.

---

## 4. Timeline 7 phase

```text
Tuần   1    2    3    4    5    6    7    8    9   10   11   12
      ├─P0─┼───P1───┼───P2───┼───P3───┼───P4───┼───P5───┼─P6─┤
Mua        CAM           FLIGHT HW
```

| Phase | Tuần | Tên | Milestone chứng minh được |
|---|---|---|---|
| **P0** | 1 | Khởi động & chốt hợp đồng | SITL chạy trên máy cả 4 người; `docs/architecture.md` merged |
| **P1** | 2–3 | SITL + Monitor (chỉ đọc) | Web hiện UAV bay trong SITL trên bản đồ, số liệu thật |
| **P2** | 4–5 | Điều khiển + camera trên bàn + lắp drone | WASD bay được trong SITL; ESP32-CAM detect người ở 4–6 m; drone đã lắp, chưa gắn cánh |
| **P3** | 6–7 | Mission + chuyến bay RC đầu tiên | Web upload 4 waypoint, SITL bay AUTO; drone thật hover / AltHold / Loiter / RTL |
| **P4** | 8–9 | Drone thật ↔ backend | Đổi `MAVLINK_ENDPOINT` sang ESP32 bridge, web thấy telemetry thật; Auto bằng Mission Planner OK |
| **P5** | 10–11 | Bay bằng web + camera trên UAV + Model E | Web Auto flight, web WASD flight, RC lấy lại quyền; detection event lên dashboard |
| **P6** | 12 | Test matrix + experiment + báo cáo | 20/20 test của GĐ 84; 4 experiment của GĐ 85; demo scenario GĐ 91 |

### Bảng tổng quan — mỗi người mỗi phase

| | **P1** Flight/HW | **P2** GCS Lead | **P3** Embedded & IoT | **P4** Vision & ML |
|---|---|---|---|---|
| **P0** T1 | Dựng SITL, `docs/dev-env.md`, chốt BOM | `docs/architecture.md`, mock mode, CI | Khung HTML/CSS/JS, skeleton `ui.js`, cài Mosquitto | Cài ML stack, chạy YOLO baseline |
| **P1** T2–3 | Học 5 mode, MP oracle, tìm sân | Control API SITL (GĐ 9), `WS /ws/telemetry` | Web monitor + Leaflet map (GĐ 7–8) | Model A (COCO), convert VisDrone, Model B (GĐ 16–18) |
| **P2** T4–5 | Nhận hàng, lắp frame/nguồn/FC, flash (GĐ 24–33) | Guided velocity, dead-man, HOLD/RTL/LAND (GĐ 10–12) | ESP32-CAM firmware, stream, MQTT skeleton (GĐ 19) | Own dataset, split dataset, test khoảng cách (GĐ 20–21) |
| **P3** T6–7 | Calibration → first flight → Loiter → RTL (GĐ 34–54) | Mission protocol (GĐ 13–15) | Mission UI, progress display | Model C, Model D degradation (GĐ 22–23) |
| **P4** T8–9 | Auto MP, wiring bridge, failsafe (GĐ 55–56, 47–48) | Firmware bridge, đổi endpoint, bench test (GĐ 57–62) | Dashboard cuối (GĐ 77), MQTT topics hoàn chỉnh | Camera mount, static test, Model E (GĐ 66, 69–70, 73) |
| **P5** T10–11 | Bay web, CG/payload, geofence (GĐ 63–65, 67–68, 83) | Test failure: camera/YOLO/browser/Wi-Fi/RC (GĐ 78–82) | Detection panel, đo latency (GĐ 74, 86) | Dataset bay thật, chống spam, ghép pipeline (GĐ 71–75) |
| **P6** T12 | Chủ trì test matrix, log/params (GĐ 84, 87–88) | Dọn code, git history, viết phần backend báo cáo | Scenario GĐ 91, quay video demo | 4 experiment, bảng metric 5 model (GĐ 85) |

Chi tiết từng người → 4 file riêng, mỗi người chỉ cần mở file của mình:

- [P1 — Flight & Hardware](team/P1-flight-hardware.md)
- [P2 — GCS Lead: SITL + Backend + Web điều khiển](team/P2-backend-web.md)
- [P3 — Embedded & IoT Lead](team/P3-embedded-iot.md)
- [P4 — Vision & ML Lead](team/P4-vision-ml.md)

---

## 5. Cổng phase — điều kiện đi tiếp

Cuối mỗi phase, cả nhóm họp 60 phút và **demo thật trên máy**, không báo cáo miệng.
Chưa pass thì phase sau bắt đầu với việc trả nợ, không được chồng thêm việc mới.

| Cổng | Điều kiện — phải quan sát được | Không pass thì |
|---|---|---|
| **G0** cuối T1 | SITL hiện MAVProxy Console + Map + ArduCopter running trên máy cả 4 người (CỔNG PASS 3A). `docs/architecture.md` đã merge | Chưa ai được viết feature mới |
| **G1** cuối T3 | SITL takeoff → altitude trên web tăng; SITL move → lat/lon đổi; marker chạy theo (7A, 8A) | Hoãn mua Batch C |
| **G2** cuối T5 | Nhấn W → tiến, thả W → dừng, **đóng browser khi đang giữ W → dừng** (11A). Camera bàn: người ở 4–6 m ngoài sáng vẫn detect được (CỔNG PASS GĐ 19) | Camera fail → kích hoạt đường lùi ở mục 9 |
| **G3** cuối T7 | Web upload 4 điểm, Mission Planner download đúng 4 điểm; SITL bay WP1→WP4. Drone thật: Loiter không toilet-bowl, RTL về home | Loiter lỗi → **không** làm Auto thật (GĐ 53) |
| **G4** cuối T9 | Đổi `MAVLINK_ENDPOINT` sang ESP32, web thấy GPS/heading/mode/battery thật khi xoay drone bằng tay (props tháo). Auto bằng Mission Planner đã chạy ngoài sân | Chưa Auto bằng MP → **không** bay Auto bằng web (GĐ 63) |
| **G5** cuối T11 | Web Auto flight xong; WASD 0.5 m/s xong; RC gạt Loiter cắt được quyền web (GĐ 65); detection event hiện trên dashboard kèm snapshot | Cắt scope theo mục 9, không nén vào tuần 12 |
| **G6** cuối T12 | 20/20 test GĐ 84 pass; scenario 23 bước GĐ 91 chạy liền mạch | — |

---

## 6. Lịch mua phần cứng

README GĐ 90 nói *"chỉ bỏ tiền cho stage tiếp theo khi stage trước đã chứng minh
project khả thi"*. Với 12 tuần, giữ nguyên GĐ 90 nghiêm ngặt sẽ khiến drone chỉ về
đến tuần 8 — không đủ thời gian lắp, calibrate, bay, rồi tích hợp.

**Sai lệch có ý thức so với GĐ 90** (ghi rõ ở đây để không ai tưởng là quên):

| Tuần | Mua | Điều kiện gate thay thế | Người phụ trách |
|---|---|---|---|
| 1 | ESP32-CAM + thẻ nhớ + dây (Batch B) | Không cần gate — rẻ, và P4 cần dữ liệu ngay từ tuần 4 | P4 chọn, P1 chốt đơn |
| 3 | Toàn bộ flight hardware (Batch C) **+ ESP32 DevKit, UBEC, mount, spare props (Batch D)** | Thay điều kiện *"xong camera + YOLO + dataset"* của README bằng: **G1 đã pass** — nghĩa là SITL + backend + web telemetry đã chạy, đủ chứng minh phần mềm khả thi | P1 |
| 5–6 | Vật tư phát sinh: cánh dự phòng, 1 ESC dự phòng, ốc, dây rút, băng xốp | Sau khi lắp xong thấy thiếu gì | P1 |

Gộp Batch C + D một lần để tiết kiệm phí ship và tránh cảnh "lắp xong drone mới phát
hiện thiếu UBEC". Danh sách linh kiện lấy nguyên từ [README GĐ 24](../README.md).
Ngân sách mục tiêu 5–6 triệu; P1 lập BOM có giá thực tế trong tuần 1 và giữ lại
**~10% buffer cho hỏng hóc** — cánh gãy và ESC cháy là chuyện bình thường, không phải
tai nạn bất thường.

Mua đủ **6–8 cánh** thay vì đúng 4.

---

## 7. Vai trò trong buổi bay và buổi lắp

### 7.1. Buổi lắp phần cứng (4 buổi trọng điểm)

Chỉ 4 buổi cần đủ đội: nguồn/FC (GĐ 28–33), calibration (GĐ 38–44), gắn cánh (GĐ 49), wiring bridge (GĐ 56). Còn lại không cần cả 4 người.

| Vai | Người | Việc |
|---|---|---|
| **Chủ trì** | P1 | Quyết định, đo, chịu trách nhiệm cuối |
| **Hands** | P3 | Hàn, đấu dây, tay thứ hai giữ linh kiện |
| **Checker** | P2 | Đọc checklist TO LÊN, cầm multimeter xác nhận trước khi cắm LiPo |
| **Logger** | P4 | Chụp ảnh từng bước, ghi `docs/wiring.md` ngay tại bàn |

> Vai Checker là thứ đáng giá nhất: bước dễ cháy nhất là đấu nguồn, và cách chống là **đọc to + đo lại**, không phải làm cẩn thận hơn.

### 7.2. Buổi bay (từ tuần 6)

Tối thiểu 3 người. Không bay một mình.

| Vai | Người | Việc | Quyền |
|---|---|---|---|
| **PIC** — Pilot in Command | **P1** | Cầm RC từ đầu đến cuối. Arm/disarm. Gạt mode | **Quyền hủy tuyệt đối.** PIC hô "abort" là tất cả dừng, không tranh luận tại sân |
| **GCS Operator** | **P3** | Ngồi laptop, bấm web, đọc số liệu to lên cho PIC | Không được tự ý bật Web Control khi PIC chưa cho phép |
| **Safety Observer** | P2 hoặc P4 | Mắt luôn ở drone, không ở màn hình. Canh người lạ, xe, vật cản. Bấm giờ pin | Được hô "abort" |
| **Logger** | người còn lại | Quay video buổi bay, ghi `notes.md` theo mẫu GĐ 87, lưu `.BIN` + `.tlog` sau mỗi lần bay | — |

Checklist trước mỗi buổi bay: [SAFETY.md](../SAFETY.md) mục 2, 3, 6, 8.
Sau mỗi buổi bay, Logger tạo thư mục `logs/flight_YYYYMMDD_HHMM/` theo cấu trúc GĐ 87
**ngay tại sân**, trước khi về. Log không ghi ngay là log mất.

---

## 8. Nhịp làm việc và review

**Hàng ngày (async, trong nhóm chat), 3 dòng:**

```text
Hôm qua:  GĐ 10 — gửi được velocity, chưa test dead-man
Hôm nay:  viết test dead-man timeout
Đang tắc: cần P3 xác nhận format message của /ws/control
```

**Đầu tuần, 45–60 phút:** đọc lại cổng phase gần nhất, chia lại việc nếu ai đó bị tắc,
xác nhận tuần này có buổi ra sân hay không.

**Cuối phase:** demo thật + điền cổng phase ở mục 5 + cập nhật `docs/test-log.md`.

**Issue và PR:** mỗi giai đoạn README = 1 issue theo mẫu
[phase_task.yml](../.github/ISSUE_TEMPLATE/phase_task.yml), branch `feat/<mô-tả-ngắn>`.

**Ma trận review — ai review ai:**

```text
P2 ⇄ P3   hợp đồng API, mọi thay đổi endpoint
P4 → P2   vision/mqtt ghép vào backend
P1 → mọi PR có nhãn safety
```

PR có ảnh hưởng tới mode, failsafe, dead-man timeout, geofence, pre-arm check, hoặc
motor output **bắt buộc** có approve của P1 cộng thêm một người nữa.

**Definition of Done của một task** — thiếu bất kỳ dòng nào thì chưa xong:

1. `make lint` và `make test` xanh.
2. PR mô tả **CỔNG PASS nào đã chạy thật**, kèm output / ảnh / log — không viết "chạy ổn".
3. Người review theo ma trận trên đã approve.
4. Nếu là giai đoạn có phần cứng: đã ghi vào `docs/test-log.md`.
5. Nếu đổi parameter ArduPilot: đã commit file `params/*.param` tương ứng (GĐ 88).

---

## 9. Rủi ro và đường lùi

| Rủi ro | Dấu hiệu sớm | Đường lùi |
|---|---|---|
| **ESP32-CAM không detect được người ở 4–6 m** (README cảnh báo sẵn ở GĐ 19) | Cuối tuần 5, recall < 0.3 ở 4 m ngoài sáng | Quyết định **trong tuần 5**, không để trễ: (a) hạ độ cao demo xuống 3 m, (b) người mặc áo tương phản với nền, (c) nâng lên camera USB/IMX rẻ và ghi thành mục "hạn chế phần cứng" của báo cáo — đây vốn đã là nội dung nghiên cứu hợp lệ theo mục tiêu ở README dòng 9 |
| **Drone crash, cháy ESC/FC** | — | Cánh dự phòng + 1 ESC dự phòng mua sẵn ở tuần 5. Nếu FC chết: phần bay dừng, các phase còn lại quay về SITL, demo phần bay bằng video đã quay |
| **Loiter bị toilet-bowl** | Tuần 6–7, UAV quay vòng khi Loiter | Không đi Auto (GĐ 53). Debug compass/GPS/vibration. Nếu quá tuần 8 chưa xong: cắt Auto thật, demo Auto trên SITL |
| **GPS lock kém ở khu vực test** | Satellites < 8 khi thử ngoài sân tuần 5 | P1 tìm sân thay thế **từ tuần 2**, không đợi đến lúc bay |
| **Một người bận thi / nghỉ** | — | Chuyên môn hóa dễ tắc ở điểm này. Bắt buộc: mỗi người viết `docs/team/<mã>.md` đủ chi tiết để người khác đọc là tiếp được, và không giữ code trên máy cá nhân quá 2 ngày |
| **Tuần 9 chưa bay được RC ổn định** | G4 không pass | Cắt theo thứ tự này: ① web manual flight thật (GĐ 64–65) → demo trên SITL; ② web Auto flight thật (GĐ 63) → demo bằng Mission Planner + SITL; ③ dataset bay thật (GĐ 72) → dùng dataset gậy/tripod của GĐ 20. **Không cắt** test failsafe và test matrix |
| **Nén tuần 12** | Tuần 11 còn > 3 task hở | Tuần 12 chỉ dành cho test matrix, experiment, báo cáo. Không nhận feature mới sau cuối tuần 11 |

**Thứ tự ưu tiên khi phải chọn** — bám mục tiêu môn học, không bám tính năng:

```text
1. An toàn (failsafe, dead-man, geofence, pre-arm)   ← không bao giờ cắt
2. Scenario GĐ 91 chạy liền mạch                     ← tiêu chí "đồ án thành công"
3. 4 experiment GĐ 85                                ← điểm môn Xử lý ảnh
4. Pipeline MQTT + dashboard GĐ 76, 77               ← điểm môn IoT
5. Mọi thứ còn lại
```

---

## 10. Bảng phân bổ 92 giai đoạn

| Giai đoạn | Nội dung | Chính | Phụ |
|---|---|---|---|
| 1 | Khóa spec | cả nhóm | |
| 2 | Workspace | P2 | *(đã xong)* |
| 3–4 | Môi trường, SITL, học 5 mode | **P1** | cả nhóm cùng chạy được SITL |
| 5–6 | Kết nối MAVLink, telemetry | **P2** | *(đã xong phần lớn)* |
| 7–8 | Web monitor, bản đồ | **P3** | P2 (API) |
| 9 | Control API | **P2** | P1 (review safety) |
| 10–11 | Guided velocity, dead-man | **P2** | P3 (UI gửi lệnh liên tục) |
| 12 | HOLD / RTL / LAND | **P2** | P3 (3 nút) |
| 13–14 | Mission draft, validate | P2 (validate) | **P3** (UI click map) |
| 15 | Mission upload protocol | **P2** | P1 (Mission Planner làm oracle) |
| 16–18 | YOLO baseline, VisDrone, Model A/B | **P4** | |
| 19 | ESP32-CAM trên bàn | **P4** | P1 (nguồn) |
| 20–21 | Own dataset, chia dataset | **P4** | cả nhóm làm "người mẫu" |
| 22–23 | Model C, Model D degradation | **P4** | |
| 24–25 | Mua, test từng linh kiện | **P1** | |
| 26–31 | Lắp frame, motor, nguồn, FC | **P1** | |
| 32–33 | Flash ArduPilot, frame type | **P1** | |
| 34–36 | Receiver, radio cal, map switch | **P1** | |
| 37 | GPS + compass | **P1** | |
| 38–39 | Accel + compass calibration | **P1** | |
| 40–44 | ESC signal, motor test/direction, ESC cal | **P1** | |
| 45 | Pre-arm check | **P1** | |
| 46 | RC failsafe | **P1** | |
| 47 | GCS failsafe | **P1** | P2 (timeout phía backend) |
| 48 | Battery failsafe | **P1** | |
| 49 | Gắn cánh | **P1** | |
| 50–54 | First flight, log, AltHold, Loiter, RTL | **P1** | P2/P4 làm observer + logger |
| 55 | Auto bằng Mission Planner | **P1** | P3 quan sát để so với web |
| 56 | Wiring ESP32 bridge | **P1** | P2 |
| 57 | Firmware bridge UART↔UDP | **P2** | P1 |
| 58 | Test bridge trên bàn | **P2** | P1 |
| 59 | Đổi endpoint SITL → drone thật | **P2** | |
| 60–62 | Web telemetry / command / mission với drone thật | **P2** | **P3** |
| 63 | Auto flight bằng web | **P1** (PIC) | P3 (operator), P2 |
| 64 | Web manual flight | **P1** (PIC) | P3 (operator), P2 |
| 65 | RC lấy lại quyền — **bắt buộc** | **P1** | P2 |
| 66 | Camera mount | **P4** | P1 (CG) |
| 67–68 | CG, payload | **P1** | P4 |
| 69–70 | Camera static test, motor-on test | **P4** | P1 |
| 71 | Hover camera test | **P1** (PIC) | P4 |
| 72 | Dataset bay thật | **P4** | P1 (PIC) |
| 73 | Model E — deployment model | **P4** | |
| 74 | Ghép YOLO vào web | **P4** | **P3** (dashboard) |
| 75 | Chống spam detection | **P4** | |
| 76 | MQTT | **P4** | P3 (dashboard subscribe) |
| 77 | Dashboard cuối | **P3** | |
| 78–79 | Failure: mất camera, YOLO crash | **P2** | P4 |
| 80 | Failure: đóng browser | **P2** | P3 |
| 81–82 | Failure: mất Wi-Fi/MAVLink, mất RC | **P2** | **P1** |
| 83 | Geofence | **P1** | P2 (giới hạn phần mềm) |
| 84 | Test matrix 20 bài | **P1** chủ trì | cả nhóm |
| 85 | 4 experiment Xử lý ảnh | **P4** | |
| 86 | Experiment IoT — latency | **P3** | P2 |
| 87 | Log mọi thứ | **P1** | P4 (detection log) |
| 88 | Parameter versioning | **P1** | |
| 89 | Git versioning | **P2** | cả nhóm |
| 90 | Thứ tự mua | **P1** | xem mục 6 |
| 91 | Định nghĩa hoàn thành | **P3** chạy scenario | cả nhóm |
| 92 | Roadmap V2 | cả nhóm | viết ở chương cuối báo cáo |
