# Review nhất quán bộ kế hoạch `plans/` — 21/09/2026

**Phạm vi audit (chỉ đọc, không sửa file nào):**
`plans/_phase-index.md`, `plans/_phase-template.md`, `plans/README.md`,
`plans/phase-00..24-*.md` (25 file), `plans/ai/ai-phase-01..04-*.md` (4 file).
**Bỏ qua:** `plans/PROGRESS.md` (đang được viết lại song song), `plans/QUYET-DINH-CHUA-CHOT.md` (không nằm trong danh sách audit).
**Đối chiếu với:** `plans/reports/260921-brainstorm-thiet-ke-tong-the.md`, và mã nguồn hiện có
(`backend/`, `frontend/`, `ml/`, `esp32/`, `params/`, `scripts/`, `Makefile`, `.gitignore`, `.env.example`).
`docker-compose.yml`, `firmware/`, `deploy/`, `docker/` **chưa tồn tại** trong repo tại thời điểm audit.

Tổng: **41 phát hiện** — 13 cao, 18 trung bình, 10 thấp.

---

## 1. Tuân thủ template

### 1.1 Tám mục bắt buộc

**Không phát hiện lỗi.** Đã quét 29 file (25 luồng chính + 4 luồng AI), bỏ qua heading nằm trong
code fence. Cả 29 file đều có **đúng một lần** mỗi mục: `Mục tiêu`, `Đầu vào cần có`,
`File và thư mục sở hữu`, `Việc theo thứ tự`, `Cổng pass`, `Rủi ro`, `Timeline`, `Ghi chú cho sổ tay`.

Có 5 mục **thêm** ngoài template (không vi phạm, nhưng template không mô tả):

| File:dòng | Mục thêm | Mức | Đề xuất |
|---|---|---|---|
| `plans/phase-05-backend-mavlink-telemetry.md:399` | `## Hợp đồng WebSocket` | thấp | Giữ — đây là SSOT; bổ sung một dòng vào `_phase-template.md` cho phép "mục SSOT phụ trợ đặt sau Việc theo thứ tự" |
| `plans/phase-08-web-khung-hud.md:423`, `phase-09:328`, `phase-10:385` | `## Việc trả về backend` | thấp | Giữ — hợp lý; ghi vào `_phase-template.md` như mục tuỳ chọn cho phase frontend |
| `plans/ai/ai-phase-01-chuan-bi.md:36` | `## Hiện trạng từng file (luật prior-art)` | thấp | Giữ — rất giá trị; nên chuẩn hoá thành mục tuỳ chọn trong template |

### 1.2 Bảng header — cột "Phụ thuộc" lệch `_phase-index.md`

| File:dòng | Index nói | File nói | Mức | Đề xuất sửa |
|---|---|---|---|---|
| `plans/phase-07-backend-mission-proximity-safety.md:5` | `06` | `Phase 06, Phase 04` | trung bình | Thêm `04` vào hàng 07 của `_phase-index.md` (phụ thuộc Phase 04 là thật — cần rangefinder ảo) |
| `plans/phase-08-web-khung-hud.md:5` | `05` | `Phase 05, Phase 01` | trung bình | Thêm `01` vào hàng 08 của index |
| `plans/phase-10-web-dieu-khien-obstacle-video.md:5` | `09` | `Phase 09, Phase 06, Phase 07` | thấp | 06/07 là phụ thuộc bắc cầu qua 09; hoặc ghi rõ `09 (bắc cầu 06, 07)` ở header cho khớp index |

23/26 hàng còn lại khớp chính xác (kể cả `17 = 16 + 10 + 12`, `24 = 22, 23`, `ai-03 = 21 + ai-02`).

### 1.3 Bảng header — cột "Ước lượng" lệch hàng `Tổng` trong Timeline

Mọi file **đều có** hàng `Tổng` trong Timeline (29/29). Nhưng 11 file có header ≠ Timeline:

| File | Header | Timeline `Tổng` | Mức |
|---|---|---|---|
| `phase-11-firmware-ardupilot-param.md:5` / `:533` | ~4 giờ | **4,5** | thấp |
| `phase-12-firmware-esp32-camera.md:5` / `:564` | ~6 giờ | **6,5** | thấp |
| `phase-13-chuan-bi-lap-rap.md:5` / `:462` | ~5 giờ | **5,3** | thấp |
| `phase-15-ban-rc-gps-compass.md:5` / `:478` | ~4 giờ | **4,2** | thấp |
| `phase-16-ban-nguon-motor-esc.md:5` / `:530` | ~4,5 giờ | **5,0** | thấp |
| `phase-17-ban-esp32-tfmini-camera.md:5` / `:548` | ~6,5 giờ | **6,8** | thấp |
| `phase-18-lap-rap-khung.md:5` / `:540` | ~14 giờ | **~16,0** | trung bình |
| `phase-19-hieu-chinh-tren-khung-failsafe.md:5` / `:742` | ~12 giờ | **~13,0** | trung bình |
| `phase-20-bay-rc-co-ban.md:5` / `:517` | ~14 giờ | **~14,5** | thấp |
| `phase-21-bay-tu-dong-va-web.md:5` / `:509` | ~16 giờ | **~18,0** | trung bình |
| `phase-22-tranh-vat-can-that-va-tuning.md:5` / `:521` | ~18 giờ | **~18,5** | thấp |

**Đề xuất:** đặt hàng `Tổng` của Timeline làm SSOT, sửa header bằng đúng con số đó (một dòng/file).

---

## 2. Tham chiếu chéo

### 2.1 Số hiệu phase và tên file

**Không phát hiện lỗi.** Đã quét toàn bộ `plans/*.md` + `plans/ai/*.md`:

- Mọi chuỗi `Phase NN` / `phase-NN` đều nằm trong dải `00..24` — **không có số ngoài dải**.
- Mọi tham chiếu dạng `phase-NN-<slug>.md` / `ai-phase-0N-<slug>.md` đều **trỏ tới file tồn tại** (0 tham chiếu hỏng).
- Mọi chuỗi `Phase N` một chữ số đều có tiền tố `AI ` (`AI Phase 1..4`) — **không còn sót đánh số cũ**. Đã kiểm bằng `grep -E '[Pp]hase [0-9]([^0-9]|$)' | grep -vi 'AI Phase'` → 0 kết quả.
- `AI Phase 1..4` và `ai-phase-01..04` đều hợp lệ.

### 2.2 Đánh số cũ theo ngữ nghĩa

**Không phát hiện.** Đã lọc mọi dòng chứa `Phase 04..10` kèm từ khoá của khối cũ
(`lắp ráp`, `hàn`, `MQTT`, `IoT`, `mosquitto`, `phần cứng`, `YOLO`, `dataset`, `huấn luyện`, `motor`, `ESC`, `pin`, `LiPo`, `bay`)
→ 24 dòng, tất cả **đúng ngữ nghĩa mới** (ví dụ `phase-02:9` "Phase 05–10" = backend + web; `phase-23:65` "Phase 05–07" = backend MAVLink).
Không còn chỗ nào mô tả phần cứng là Phase 4/5/6, IoT là Phase 7/8/9/10, hay AI là Phase 4/5.

### 2.3 `plans/README.md` — bảng giờ sai lệch nghiêm trọng so với các file phase

| Hạng mục | README nói | Tổng thật từ hàng `Tổng` của từng file | Mức |
|---|---|---|---|
| Luồng chính (`plans/README.md:105`) | **~164 giờ** | **~281 giờ** (+71%) | **cao** |
| Luồng AI (`plans/README.md:116`) | **~60 giờ** | **~160 giờ người** (+167%) | **cao** |

Lệch từng phase lớn nhất (README `:62`–`:104` và `:111`–`:114`):

| # | README | File | Lệch |
|---|---|---|---|
| 24 | 10 | 44 | **+34** |
| 23 | 8 | 25 | +17 |
| 22 | 6 | 18,5 | +12,5 |
| 21 | 6 | 18 | +12 |
| 19 | 5 | 13 | +8 |
| 20 | 6 | 14,5 | +8,5 |
| 18 | 8 | 16 | +8 |
| ai-03 | 10 | ~52 | **+42** |
| ai-02 | 24 | 44 | +20 |
| ai-01 | 12 | 36 | +24 |
| ai-04 | 14 | ~28 | +14 |
| 17 | 8 | 6,8 | −1,2 |

**Đề xuất:** viết lại cột "Giờ" của cả hai bảng trong `plans/README.md` bằng đúng hàng `Tổng` của từng file, rồi tính lại hai dòng tổng; hoặc bỏ hẳn cột "Giờ" khỏi README và trỏ về `_phase-index.md`/file phase (tránh SSOT thứ ba).

### 2.4 `plans/README.md:54` — phạm vi `NO PROPELLERS` ghi thiếu

README: *"luật `NO PROPELLERS` … áp dụng cho toàn bộ Phase 14–17"*.
Thực tế `phase-18` (lắp khung) và `phase-19:15` (*"Từ 19.1 đến 19.12 là NO PROPELLERS tuyệt đối. Cánh chỉ được gắn ở 19.13"*) cũng nằm trong phạm vi.
**Mức: trung bình.** **Đề xuất:** sửa thành "Phase 14 đến hết 19.12; cánh chỉ gắn ở 19.13".

### 2.5 `plans/README.md:54` mâu thuẫn `phase-13` header

README: *"Phase 00–13 không cần một linh kiện nào"*. `phase-13-chuan-bi-lap-rap.md:5` ghi
*"Không (trừ 13.6 tập hàn: cần mỏ hàn + dây thừa)"*.
**Mức: thấp.** **Đề xuất:** thêm "(trừ 13.6 tập hàn)" vào câu trong README.

---

## 3. Xung đột sở hữu file

Bảng dưới gom mọi đường dẫn xuất hiện ở mục **"File và thư mục sở hữu"** của cả 29 file và bị **≥ 2 phase** khai.

### 3.1 Xung đột nghiêm trọng (cao)

| Đường dẫn | Phase khai | Vấn đề | Nên thuộc về | Đã ghi sequencing? |
|---|---|---|---|---|
| `requirements.txt`, `requirements-dev.txt`, `requirements-ml.txt` | `phase-01:48` + `:290` **XOÁ** · `phase-05:61` sửa · `phase-07:50` sửa · `ai-phase-01:98` sửa | `phase-01` chạy `Remove-Item requirements.txt, requirements-dev.txt, requirements-ml.txt` và dồn hết vào `pyproject.toml`. Ba phase phụ thuộc phase-01 lại khai **sửa file đã bị xoá** | `phase-01` (xoá) — mọi phase sau chỉ sửa `pyproject.toml` | **Không** |
| Chiến lược môi trường ML | `phase-01:264-279` (`[project.optional-dependencies] ml` + `uv sync --extra ml`) vs `ai-phase-01:135,152-165` (`uv venv --python 3.12 ml\.venv` + `uv pip install -r requirements-ml.txt`) | Hai chiến lược **loại trừ nhau**; `ai-phase-01:135` còn đóng dấu *"Quyết định (chốt tại đây, không mở lại)"* cho chiến lược mà `phase-01` đã xoá cơ sở | Chốt một: hoặc `ml/.venv` riêng (thì `phase-01` **giữ** `requirements-ml.txt` và bỏ extra `ml` khỏi pyproject), hoặc `uv sync --extra ml` (thì `ai-phase-01` A1.1 phải viết lại) | **Không** |
| `backend/vision/events.py` | `ai-phase-01:108` "điền thân `should_emit`" · `phase-23:47` "hiện thực `EventThrottle.should_emit`" | Hai phase khai **cùng một hàm**. `ai-phase-01:121` còn tự tuyên bố sở hữu và xếp `phase-23` vào cột "chỉ được dùng" | **`ai-phase-01`** (nó sở hữu cả `stream.py`/`detector.py` cùng cụm) — `phase-23` chuyển sang "chỉ dùng" | **Mâu thuẫn**: ai-01 nói mình sở hữu, phase-23 nói mình hiện thực |
| `backend/vision/stream.py`, `backend/vision/detector.py` | `ai-phase-01:106-107` sở hữu · `phase-23:65` ghi *"(Phase 17 sở hữu)"* · `phase-17:43` tự tuyên bố *"Không sửa mã backend hay frontend"* | Quy kết sở hữu **sai ở phase-23**: Phase 17 không hề sở hữu mã backend | **`ai-phase-01`** | Không — phase-23 quy kết nhầm |
| `deploy/mosquitto.conf` vs `docker/mosquitto/mosquitto.conf` | `phase-01:32,417,439` tạo `deploy/mosquitto.conf` và mount `./deploy/mosquitto.conf` · `phase-23:40,75,105` tạo `docker/mosquitto/mosquitto.conf` và mount `./docker/mosquitto/mosquitto.conf` | Hai **đường dẫn khác nhau** cho cùng một file; `phase-23` sửa `docker-compose.yml` trỏ sang chỗ mới và bỏ lại file của `phase-01` mồ côi | Chọn **một** đường dẫn (đề xuất `deploy/mosquitto.conf` vì `phase-01` tạo trước); `phase-23` chỉ điền nội dung thật vào file đó | Không — `phase-23:30` chỉ nói "phase-01 đã có khung service", không nhắc đường dẫn lệch |
| `firmware/ardupilot/params/04-*.param` | `phase-11:212` (trong README quy ước) ghi `04-first-flight.param … Phase 20` · `phase-19:41` tạo `04-pre-first-flight.param` · `phase-20:51` ghi *"Không đụng … param `00`–`04`"* | Tên file lệch **và** phase tạo lệch: README của phase-11 nói Phase 20 tạo, thực tế Phase 19 tạo và Phase 20 cấm đụng | Tên: **`04-pre-first-flight.param`** (theo index/phase-19); người tạo: **Phase 19** | `phase-19:52` có ghi chú, nhưng uỷ thác việc sửa cho **Phase 24 — mà Phase 24 không sở hữu file đó** (xem 3.2) |
| `frontend/src/app/App.tsx`, `frontend/src/components/MapView/MapView.tsx`, `backend/app.py` | `phase-23` **cần sửa** (23.7 gắn `DetectionMarkers` vào bản đồ, 23.8 gắn `IotPanel` vào layout, `:489` cần mount tĩnh `logs/**/snapshots/` trong backend) nhưng **không có trong danh sách sở hữu** `phase-23:39-63` | `phase-23` không thể hoàn thành mà không đụng file ngoài danh sách — vi phạm luật của chính nó | Thêm 3 đường dẫn này vào ownership của `phase-23` kèm phạm vi hẹp ("chỉ thêm 1 route tĩnh", "chỉ thêm 1 layer/1 panel") | **Không** |

### 3.2 Uỷ thác mồ côi — phase nhận uỷ thác không sở hữu file (cao/trung bình)

| Đường dẫn | Ai uỷ thác | Ai được uỷ thác | Vấn đề | Mức | Đề xuất |
|---|---|---|---|---|---|
| `.gitignore` | `phase-20:53` *"Nếu `.gitignore` chưa loại `logs/`… để Phase 24 xử lý"* | Phase 24 | `phase-24:43-67` **không liệt kê `.gitignore`** | trung bình | Thêm `.gitignore` (chỉ khối `logs/`) vào ownership của `phase-24` |
| `params/README.md` / `firmware/ardupilot/params/README.md` | `phase-19:52` *"Việc thống nhất lại `params/README.md` để Phase 24 chốt"* | Phase 24 | `phase-24` **không liệt kê** file này (`phase-11` sở hữu) | **cao** | Hoặc sửa ngay ở `phase-11` (đổi `04-first-flight` → `04-pre-first-flight`), hoặc thêm file vào ownership của `phase-24` |
| `backend/vision/stream.py`, `detector.py` | `phase-23:65` *"nếu cần đổi, ghi thành yêu cầu và xử lý ở Phase 24"* | Phase 24 | `phase-24:69` lại ghi *"Không đụng `backend/vision/*` (Phase 23 sở hữu)"* — **vòng tròn uỷ thác** | trung bình | Bỏ mệnh đề uỷ thác ở `phase-23:65`; ghi rõ chủ sở hữu thật là `ai-phase-01` |

### 3.3 Chồng lấn có kiểm soát (đã ghi sequencing — không cần sửa, chỉ đối chiếu)

| Đường dẫn | Phase khai | Đã ghi sequencing |
|---|---|---|
| `Makefile` | `phase-01:46` (toàn bộ trừ `sitl:`) · `phase-02:37` (chỉ `sitl:`) | ✅ `phase-01:52`, `phase-02:46` |
| `scripts/run_sitl.sh` | `phase-02:36` · `phase-04:41` | ✅ `phase-04:41` ("dùng biến `SITL_EXTRA` đã có sẵn từ Phase 02") |
| `firmware/ardupilot/params/01-base.param` | `phase-11:38` tạo · `phase-16:35` sửa 1 dòng `BATT_VOLT_MULT` | ✅ `phase-16:39-41`; `phase-14:35`, `phase-15:43` khai "không sửa" |
| `firmware/ardupilot/params/02-avoid-tfmini.param` | `phase-11:39` tạo · `phase-22:57` cập nhật `AVOID_*`/`OA_*` | ✅ `phase-22:57,63` |
| `backend/app.py` | `phase-01:46` (1 dòng) · `phase-05:54` · `phase-06:48` | ✅ tuần tự 01→05→06 |
| `backend/ws.py`, `backend/config.py` | `phase-05` tạo · `phase-06`, `phase-07` sửa · `ai-phase-01:109` thêm khoá | ✅ `phase-06:61`, `phase-07:62`, `ai-phase-01:124` |
| `.env.example` | `phase-05:60` · `phase-06:49` · `phase-07:48` · `phase-17:38` · `phase-23:42` · `phase-24:50` · `ai-phase-02:57` | ✅ mỗi phase khai rõ "CHỈ khối X" (trừ `phase-17`, xem 4.5) |
| `docs/bao-cao-tong-quan-du-an.md` | `phase-24:62` (4 điểm đính chính) · `phase-18:46` khai không đụng · `ai-phase-04:48` khai không đụng | ✅ và `phase-24:548` có ghi chú phối hợp với `ai-phase-04` |
| `plans/PROGRESS.md` | 24 phase | ✅ mỗi phase khai "chỉ tick dòng của mình" (nhưng đường dẫn lệch — xem 3.4) |

### 3.4 `PROGRESS.md` vs `plans/PROGRESS.md` — đường dẫn không nhất quán

Chỉ `plans/PROGRESS.md` tồn tại thật.

| Viết `plans/PROGRESS.md` (đúng) | Viết `PROGRESS.md` ở gốc (sai) |
|---|---|
| `phase-01:46`, `phase-02:38`, `phase-03:33`, `phase-04:42`, `phase-18:44`, `phase-19:48`, `phase-20:48`, `phase-21:61`, `phase-22:58` | `phase-14:32`, `phase-15:40`, `phase-16:36`, `phase-17:40`, `phase-23:62`, `phase-24:65` |

**Mức: trung bình.** **Đề xuất:** sửa 6 file nhóm phải thành `plans/PROGRESS.md`.

### 3.5 Trùng lặp chức năng — ba nguồn MJPEG/detection giả (vi phạm SSOT)

| File | Phase tạo | Mô tả |
|---|---|---|
| `backend/vision/fake_stream.py` | `phase-07:55` | MJPEG 320×240 @10 fps + `detection` mỗi 300 ms |
| `backend/vision/fake_source.py` | `ai-phase-01:87` | nguồn giả cho parser |
| `scripts/fake_mjpeg_server.py` | `ai-phase-01:90` | server MJPEG giả cho E2E |

**Mức: trung bình.** **Đề xuất:** gộp còn **hai** — `scripts/fake_mjpeg_server.py` (server HTTP, dùng cho E2E của `phase-10` và probe của `ai-phase-01`) và `backend/vision/fake_stream.py` (nguồn in-process của `phase-07`); xoá `fake_source.py` khỏi `ai-phase-01`.

### 3.6 Quy ước thư mục frontend lệch nhau

`phase-08:61-66`, `phase-09:48`, `phase-10:52` dùng `frontend/src/components/**`.
`phase-23:56-57,478,501` tạo `frontend/src/panels/IotPanel.tsx`, `frontend/src/panels/DetectionMarkers.tsx`.
**Mức: trung bình.** **Đề xuất:** đổi `phase-23` sang `frontend/src/components/Iot/IotPanel.tsx` và `frontend/src/components/MapView/DetectionMarkers.tsx` cho khớp cấu trúc Phase 08–10.

---

## 4. Nhất quán hợp đồng dùng chung

### 4.1 (a) Hợp đồng WebSocket

**Định nghĩa đúng một chỗ:** `plans/phase-05-backend-mavlink-telemetry.md:399`. Các phase 06, 07, 08, 09, 10, 21, 23 đều **trích dẫn**, không định nghĩa lại (`phase-05:11`, `phase-06:18`, `phase-07:18`, `phase-08:19,238`, `phase-09:17`, `phase-10:20`, `phase-21:29`, `phase-23:23`). Tốt.

Hai lỗi:

| File:dòng | Vấn đề | Mức | Đề xuất |
|---|---|---|---|
| `plans/phase-23-iot-mqtt-su-kien-dashboard.md:476` | Ghi `` `type: "detection_event"` theo hợp đồng WS của Phase 05`` — nhưng bảng chiều XUỐNG ở `phase-05:434-441` **chỉ có** `telemetry`, `status`, `event`, `detection`, `ack`, `error`, `pong`. **Không có `detection_event`.** `phase-05:402` cấm định nghĩa thêm `type` | **cao** | Hoặc dùng lại `type: "event"` / `type: "detection"` sẵn có, hoặc thêm `detection_event` vào `phase-05:434` + `backend/schemas.py` + `protocol.ts` **trong cùng một commit** như luật của `phase-08:238` |
| `plans/phase-23-iot-mqtt-su-kien-dashboard.md:23` | *"Hợp đồng WebSocket đã chốt ở Phase 05 (`docs/` hoặc `backend/` tuỳ nơi Phase 05 đặt)"* — mơ hồ; `phase-05:69` đã chốt là `backend/ws-contract.schema.json` | thấp | Thay bằng đường dẫn thật `backend/ws-contract.schema.json` |

`obstacle_sectors` — **không phải lỗi**: `phase-05:164` (72 cung thô của MAVLink `OBSTACLE_DISTANCE`), `phase-05:461` + `phase-07:186` (gộp còn 8 cung 45° cho UI), `phase-10:220,222` (7/8 cung gạch chéo). Ba file nói đúng cùng một thứ ở hai mức trừu tượng khác nhau, và `phase-07:188`/`phase-10:222` đã giải thích rõ.

### 4.2 (b) Hợp đồng header MJPEG multipart — **lệch nghiêm trọng**

| Trường | `ai-phase-01:851-858` (§A1.9, tự xưng SSOT) | `phase-12:256-261` (firmware) | `ai-phase-03:131-134` (dùng) |
|---|---|---|---|
| boundary | `--<boundary>` đọc từ `Content-Type` | `boundary=frame` (cố định) | — |
| `Content-Length` | có | có | — |
| frame id | **`X-Frame-Id`** | **KHÔNG CÓ** | `X-Frame-Id` |
| timestamp | **`X-Timestamp-Ms`** | **`X-Timestamp`** | `X-Timestamp-Ms` |
| chất lượng | `X-Jpeg-Quality` | `X-JPEG-Quality` | `X-Jpeg-Quality` |
| framesize | **`X-Framesize`** | **KHÔNG CÓ** | — |

| # | Phát hiện | Mức | Đề xuất |
|---|---|---|---|
| 1 | `phase-12:259-260` thiếu hẳn **`X-Frame-Id`** và **`X-Framesize`**. `ai-phase-03:101` nói rõ thiếu header là *"mất một trục thí nghiệm không lấy lại được"*, và `:131` liệt `X-Frame-Id` là nguồn duy nhất để *"phát hiện khung bị mất"* | **cao** | Thêm `X-Frame-Id` và `X-Framesize` vào khối header ở `phase-12:256-261` |
| 2 | `X-Timestamp` (phase-12) ≠ `X-Timestamp-Ms` (ai-01, ai-03). Đây là **khác tên**, không phải khác hoa/thường — parser so khớp case-insensitive của `ai-phase-01:862` **không cứu được** | **cao** | Đổi `phase-12:260` thành `X-Timestamp-Ms` |
| 3 | `X-JPEG-Quality` vs `X-Jpeg-Quality` — chỉ khác hoa/thường, `ai-phase-01:862` đã yêu cầu so khớp không phân biệt hoa thường | thấp | Thống nhất một dạng (đề xuất `X-Jpeg-Quality`) để đọc tài liệu không bị rối |
| 4 | `phase-12` **không hề trích dẫn** `ai-phase-01` §A1.9, dù `ai-phase-01:847,123` tuyên bố mình là SSOT và *"`phase-12` phải cài đặt đúng nguyên văn"*. `phase-12:252` chỉ nói chung chung *"phục vụ QoS ở Phase 24 và luồng AI sau này"* | **cao** | Thêm `plans/ai/ai-phase-01-chuan-bi.md` §A1.9 vào mục "Đầu vào cần có" của `phase-12`, và copy khối header verbatim |
| 5 | Ràng buộc thứ tự ngược: `phase-12` phụ thuộc `phase-11`; `ai-phase-01` phụ thuộc `phase-01`. Không gì buộc SSOT phải tồn tại trước khi `phase-12` viết firmware | trung bình | Chuyển hợp đồng header ra **một file riêng** (ví dụ `docs/hop-dong-mjpeg.md`) do `phase-12` tạo, `ai-phase-01` đọc — hoặc ngược lại, nhưng phải có một file và cả hai cùng trỏ vào |

### 4.3 (c) Đánh số file param `00..07`

| Nguồn | Mốc 04 |
|---|---|
| `params/README.md:14` (hiện có trong repo) | `04-first-flight.param` |
| `plans/phase-11-firmware-ardupilot-param.md:212` (viết `firmware/ardupilot/params/README.md`) | `04-first-flight.param … Phase 20` |
| `plans/phase-19-hieu-chinh-tren-khung-failsafe.md:41` (tạo file thật) | **`04-pre-first-flight.param`** |
| `plans/phase-20-bay-rc-co-ban.md:51` | *"Không đụng … param `00`–`04`"* (tức Phase 20 **không** tạo 04) |

**Mức: cao.** Sai cả **tên file** lẫn **phase tạo**.
**Đề xuất:** sửa `phase-11:212` thành `04-pre-first-flight.param … Phase 19`, và thêm dòng 04 vào ownership của `phase-11` hoặc nêu rõ `phase-19` tạo.

Các mốc còn lại **khớp** giữa `phase-11:209-215` và các phase tạo thật:
`00-after-flash` (Phase 14 — `phase-14:29` ✅), `02-radio`/`03-gps` (Phase 15 — `phase-15:37-38` ✅),
`05-loiter-good` (Phase 20 — `phase-20:44` ✅), `06-auto-good` (Phase 21 — `phase-21:57` ✅),
`07-final` (Phase 24 — `phase-24:55` ✅, và `phase-22:63` khai rõ *"`07-final.param` KHÔNG thuộc phase này"*).

**Vấn đề phụ (thấp):** số `02` bị dùng cho **hai** file khác loại — `02-avoid-tfmini.param` (người viết) và `02-radio.param` (bo xuất ra). `phase-11:201-215` có tách hai nhóm, nhưng khi liệt kê trong các phase khác thì rất dễ nhầm. **Đề xuất:** đổi tiền tố nhóm người-viết thành `base-`/`avoid-` không số, hoặc ghi chú trùng số ngay trong bảng.

**Snapshot SITL** (`phase-04:33-37`): `firmware/ardupilot/params/sitl/00-sitl-default`, `01-sitl-base-loaded`, `02-sitl-avoid` — nằm thư mục riêng, không đụng dãy trên. Đúng.

### 4.4 (d) Bản đồ công tắc RC CH5/CH6/CH7/CH8

**Không phát hiện lỗi.** Nhất quán 100% qua 5 file:

| Kênh | phase-15:169-172 | phase-17:259 | phase-19:200-203 | phase-20:97-102 | phase-21:83-86 | phase-22 |
|---|---|---|---|---|---|---|
| CH5 | SwC 3 vị trí, `FLTMODE_CH,5` | — | Stabilize/AltHold/Loiter | như 19 | như 19 | `:187,206,306` dùng đúng |
| CH6 | SwD, `RC6_OPTION`=RTL | — | RTL | RTL | RTL | — |
| CH7 | SwA, `RC7_OPTION,0`, WEB CONTROL ENABLE | SwA/CH7 phải TẮT | backend đọc thô | phải TẮT | backend đọc thẳng | `:186` TẮT |
| CH8 | SwB, `RC8_OPTION,0` tới Phase 21 | — | để trống | chưa gán | **AUTO, gán ở 21.3** | `:305,319` dùng AUTO |

Quy tắc "CH8 chỉ gán ở Phase 21" được nhắc lại đúng ở `phase-15:172,213,442`, `phase-19:203,212,685`, `phase-20:102,485`, `phase-21:34,86`.

### 4.5 (e) Endpoint MAVLink

| File:dòng | Giá trị | Vấn đề | Mức |
|---|---|---|---|
| `phase-05:179,474,390` | `udpin:127.0.0.1:14551` (SITL; Mission Planner giữ 14550) | SSOT cho SITL | — |
| `phase-17:174,194,227` | `udpin:0.0.0.0:14550` (drone thật) | SSOT cho phần cứng thật | — |
| `phase-21:35,76,467` | `udpin:0.0.0.0:14550` | ✅ khớp phase-17 | — |
| `phase-24` | không nhắc endpoint | ✅ không mâu thuẫn | — |
| **`phase-17:173`** | *"Truoc (drone ao / SITL): `MAVLINK_ENDPOINT=udp:127.0.0.1:14550`"* | **Sai**: `phase-05` đã chốt SITL dùng **`udpin:127.0.0.1:14551`** (14550 dành cho Mission Planner). Ngoài ra `phase-05:196` yêu cầu **luôn ghi `udpin:`**, không dùng `udp:` | **trung bình** |
| **`phase-17:191`** | dòng comment mẫu `# MAVLINK_ENDPOINT=udp:127.0.0.1:14550` | cùng lỗi trên, lọt vào `.env.example` | trung bình |

**Đề xuất:** sửa hai dòng `phase-17:173,191` thành `udpin:127.0.0.1:14551` và thêm ghi chú "14550 là của Mission Planner ở chế độ SITL".

*Ghi chú:* `.env.example:9` và `backend/config.py:59` hiện có giá trị `udp:127.0.0.1:14550` — đó là mã cũ; `phase-05` sở hữu cả hai file và sẽ sửa. Không tính là lỗi kế hoạch.

### 4.6 (f) `SERIAL2_BAUD`

**Không phát hiện lỗi.** Giá trị `115` (115200) ở **mọi nơi**: `phase-11:272`, `phase-12:24,125`, `phase-14:300`, `phase-17:121,163`, `phase-19:295`.
`phase-11:360` ghi rõ quyết định `57 → 115` kèm lý do (*"DroneBridge mặc định 115200"*). **Không còn `57` ở bất kỳ đâu.**

### 4.7 (g) Tên topic MQTT

| Nguồn | Danh sách |
|---|---|
| `phase-23:158-161` (**bản chốt**) | `uav/telemetry`, `uav/events/detection`, `uav/health`, `uav/qos` |
| `phase-24:117,172,267-268,524,550,685` | dùng đúng 4 topic trên ✅ |
| `backend/mqtt/publisher.py:20-24` (mã cũ) | `uav/telemetry`, `uav/status`, `uav/mission`, `uav/detection/person`, `uav/link` |
| `docs/bao-cao-tong-quan-du-an.md:689-692` | `uav/telemetry`, `uav/link`, `uav/detection`, `uav/status` |

`phase-23:237` và `phase-24:550` **đều** xử lý việc thay thế đúng cách (xoá hằng cũ, không giữ song song; cập nhật tài liệu ở 24.10). Một lỗi nhỏ:

| File:dòng | Vấn đề | Mức | Đề xuất |
|---|---|---|---|
| `phase-23:237` | Ghi *"Bảng này KHÁC bảng dự kiến ở `docs/bao-cao-tong-quan-du-an.md` §7.3 (`uav/status`, `uav/mission`, `uav/detection/person`, `uav/link`)"* — nhưng đó là danh sách của **`backend/mqtt/publisher.py`**, không phải của tài liệu. Tài liệu (`:689-692`) thực tế ghi `uav/telemetry`, `uav/link`, `uav/detection`, `uav/status` — đúng như `phase-24:550` mô tả | thấp | Sửa `phase-23:237` thành đúng hai danh sách: một của tài liệu §7.3, một của `publisher.py` |

### 4.8 (h) `RNGFND1_TYPE` / `PRX1_TYPE` / `SIM_SONAR_SCALE`

| Ngữ cảnh | `phase-04` | `phase-07` | `phase-11`/`17` |
|---|---|---|---|
| `RNGFND1_TYPE` (SITL) | **`1`** (`:212`), bảng `:218-222` ghi `100` = *"không dùng trong dự án"* | **`100`** (`:221`) | — |
| `SIM_SONAR_SCALE` | **`10`** (`:211`) | **`12.1`** (`:222`) | — |
| `PRX1_TYPE` (SITL) | **`16`** (LD06) + `SERIAL5_PROTOCOL 11` (`:231-236`) | **`4`** (`:223`) | — |
| Board thật | `:142,160-161` `RNGFND1_TYPE,20` + `PRX1_TYPE,4` | — | `phase-11:402,406` và `phase-17:356-357` đều `20` + `4` ✅ |

**Mức: cao.** `phase-07:220` ghi *"(trong MAVProxy của SITL — **Phase 04 đã làm, đây chỉ là nhắc lại**)"* nhưng **cả ba giá trị đều khác** `phase-04`, và một trong số đó (`100`) bị chính `phase-04:220` tuyên bố là không dùng trong dự án.

**Đề xuất:** chọn một cấu hình SITL duy nhất và đặt nó **chỉ ở `phase-04`**; `phase-07:219-225` thay khối lệnh bằng một dòng trỏ về `phase-04` §04.5 + `firmware/ardupilot/params/sitl/02-sitl-avoid.param`. Nếu `phase-07` thật sự cần cấu hình khác (rangefinder một tia thay vì lidar 360° để mô phỏng đúng phần cứng thật), thì phải **nói rõ lý do** và ghi vào `phase-04` như một cấu hình thứ hai có tên.

Phần **board thật** (`20` / `4`) nhất quán tuyệt đối ở `phase-04:142`, `phase-11:402,406,422-423`, `phase-17:356-357`, `phase-18:359`. Không có chỗ nào chép nhầm `1`/`100` sang file board thật — `phase-04:367` còn có hẳn một hàng rủi ro cho đúng lỗi đó.

### 4.9 (i) `FS_GCS_ENABLE=0` cho các chuyến bay đầu

**Không phát hiện lỗi.** Nhất quán và có lý do đầy đủ ở: `phase-11:347` (`01-base.param`), `phase-07:262`, `phase-17:478,514,527,561`, `phase-19:23,401-420,672,692,717`, `phase-21:31,78,127,451,472,486,525`, `phase-24:242,260,270`.

`phase-24:271` (bài F4b) **cố ý** đặt `FS_GCS_ENABLE=1` để chứng minh failsafe hoạt động — nhưng có gác đầy đủ (*"bench không cánh bắt buộc; khi bay chỉ làm nếu bench đã pass VÀ bãi rộng ≥ 100 m VÀ có người quan sát thứ hai"*) và `phase-24:260` bắt buộc **trả lại `0` sau mỗi bài**. Đây là ngoại lệ hợp lệ, không phải mâu thuẫn.

### 4.10 (j) Bảo đảm dead-man 300 ms / 350 ms

**Không phát hiện lỗi.** Sự phân biệt được nêu rõ và **hai phía khớp nhau**:

- `phase-06:215,218` — bảo đảm hệ thống là `MANUAL_COMMAND_TIMEOUT_MS + DEADMAN_TICK_MS = 300 + 50 = **350 ms**`; 300 ms là ngưỡng **hết hạn**, không phải ngưỡng **giao hàng**; gọi việc nói "300 ms" là *overclaim*.
- `phase-10:21,323-324,452` — giải thích tại sao E2E đo **< 300 ms** (đường *đóng socket* đi qua `on_web_disconnected()`, < 50 ms) mà vẫn không mâu thuẫn với 350 ms (đường *hết hạn*). `:324` còn dặn viết lý do vào comment của test.
- `phase-24:269` (F3) đặt tiêu chí `≤ 400 ms` — bao trùm được 350 ms. Hợp lý.

Điểm nhỏ (thấp): `phase-21:111,302,482` và `_phase-index.md:13` / `README.md:67` chỉ ghi "dead-man 300 ms" không kèm phân biệt. **Đề xuất:** thêm "(bảo đảm ≤ 350 ms — xem Phase 06 §6.4)" vào `phase-21:111`.

### 4.11 (k) Giá trị `AVOID_*` / `OA_*`

**Không phát hiện lỗi.** `phase-22:129-137` khớp **từng giá trị** với `params/obstacle-avoidance-tfminiplus-serial3.param:71-78,86`:

| Tham số | File param | phase-22 |
|---|---|---|
| `AVOID_ENABLE` | 3 | 3 ✅ |
| `AVOID_BEHAVE` | 1 | 1 ✅ |
| `AVOID_MARGIN` | 2 | 2 ✅ |
| `AVOID_BACKUP_SPD` | 0.75 | 0,75 ✅ |
| `AVOID_BACKUP_DZ` | 0.10 | 0,10 ✅ |
| `AVOID_ACCEL_MAX` | 3 | 3 ✅ |
| `AVOID_DIST_MAX` | 5 | 5 ✅ |
| `AVOID_ANG_MAX` | 10 | 10 ✅ |
| `OA_TYPE` | 0 | 0 ✅ (bật `1` ở bài F10) |

`phase-22:230` còn kiểm chéo đúng trần cứng `AVOID_DIST_MAX ≤ RNGFND1_MAX = 6` (khớp `params/…param:64`).
Bốn giá trị `OA_*` ở `phase-22:273-279` được gắn nhãn **"chưa xác minh"** kèm hướng dẫn đọc mô tả trong Mission Planner — trung thực, không phải lỗi.

### 4.12 Phát hiện thêm — endpoint điều khiển camera và tên khoá config

| File:dòng | Vấn đề | Mức | Đề xuất |
|---|---|---|---|
| `phase-24:144` | *"Web server mẫu của `esp32-camera` dùng `GET /control?var=quality&val=<n>`. Firmware Phase 12 có thể phơi ra dạng rút gọn `GET /set?quality=<n>`. **Chưa xác minh dạng nào đã được chọn**"* — nhưng `phase-12:248` **đã chốt** `GET /set?quality=N` (kèm dải 0..63 và mã `400`) | **cao** | Sửa `phase-24:144` thành khẳng định `/set?quality=<n>` theo `phase-12:248`, và `phase-24:141` sửa URL mẫu cho khớp |
| `phase-24:141` | `QOS_CAMERA_CONTROL_URL=http://192.168.137.50/control?var=quality&val={q}` — dùng cú pháp `esp32-camera` gốc, không phải cú pháp firmware của dự án | cao | `…/set?quality={q}` |
| `phase-17:38,432` dùng khoá **`CAMERA_URL`**; `.env.example:36`, `backend/config.py:90`, `ai-phase-01:55`, `ai-phase-03:94` dùng **`CAMERA_STREAM_URL`** | Hai tên khoá cho cùng một giá trị | trung bình | Thống nhất **`CAMERA_STREAM_URL`** (đã có trong mã); sửa `phase-17:38,432` |
| `ai-phase-03:94` | `--url http://192.168.4.1:81/stream` — địa chỉ **AP mode** của ESP32-CAM, cổng 81. Nhưng `phase-12:245`/`phase-17:76` đặt camera ở **STA mode** trên hotspot laptop (`192.168.137.x`), và `phase-12:248` phục vụ `/stream` trên `HTTP_PORT` mặc định, không phải 81 | **cao** | Sửa `ai-phase-03:94` thành `http://<ip-camera-tren-hotspot>/stream` và trỏ về `phase-17` để lấy IP thật; tương tự sửa mặc định `CAMERA_STREAM_URL` ở `ai-phase-01:55` |

---

## 5. Mẫu bị cấm

### 5.1 `TBD` / `TODO` / `???`

**Không phát hiện** trong 29 file phase (đã quét `TBD|TODO|\?\?\?` ngoài code fence).
Một kết quả duy nhất là mô tả, không phải dấu hiệu bỏ ngỏ: `phase-12:56` *"hai mới chỉ là khung TODO"* — nói về hai file sketch cũ đã bị `phase-01` đưa vào `docs/archive/`.

### 5.2 `AskUserQuestion`

**Không phát hiện** — 0 kết quả trên toàn bộ 29 file + `README.md` + `_phase-index.md` + `_phase-template.md`.

### 5.3 Bảng quyết định còn mở

| File:dòng | Nội dung | Mức | Đề xuất |
|---|---|---|---|
| `plans/ai/ai-phase-02-huan-luyen-thi-nghiem.md:78-86` | Bảng 4 nhánh **A / B / C / D** cho đề tài môn XLA, có cột khuyến nghị (*"B+A (khuyến nghị trong file quyết định)"*), và A2.0 **chặn** A2.5/A2.6 cho tới khi người dùng chốt | trung bình | Đây là quyết định của người dùng, không phải của agent — nhưng cần: (1) ghi rõ **giá trị mặc định** sẽ dùng nếu quá hạn (đề xuất `B+A` theo khuyến nghị §3.7 của báo cáo nghiên cứu); (2) tách ước lượng giờ của A2.5/A2.6 theo nhánh, vì hiện header ghi một con số `~44 giờ` cho cả bốn |
| `ai-phase-02:99` | *"Người dùng chưa quyết được: … để trống A2.5"* | thấp | Chấp nhận được nếu (1) ở trên được bổ sung |
| `ai-phase-02:90` | Mẫu `## Đã chốt (ngày YYYY-MM-DD)` | thấp | Placeholder trong template để dán — chấp nhận được |
| `phase-12:17,25`, `phase-13:24,441,446`, `phase-17:526`, `phase-18:392` | Quyết định 1 (mua camera nào) vẫn mở, chặn `phase-13.1` (đặt hàng) | trung bình | `phase-12:17` và `phase-18:392` đã xử lý đúng (hỗ trợ **cả hai nhánh**, bát gắn lỗ khe dùng chung). `phase-13:446` có hàng rủi ro. **Đề xuất:** thêm một dòng "mặc định nếu không chốt trước ngày X" vào `phase-13.1` để đơn hàng không bị treo |

**Không có** cụm "chọn một trong" / "chưa chốt" / "unclear" / "pending" nào khác ở luồng chính.
Các nhãn **"chưa xác minh"** (xuất hiện nhiều ở `phase-12`, `phase-22`, `phase-24`, `ai-phase-02/03`) **không** tính là mẫu bị cấm — đó là ghi nhãn trung thực về số liệu chưa đo, đúng tinh thần `plans/README.md:47`.

### 5.4 Đoạn văn tiếng Anh

**Không phát hiện.** Đã quét mọi dòng ≥ 60 ký tự ngoài code fence, loại bỏ inline-code / URL / đường dẫn / tên file, giữ lại dòng có ≥ 10 từ mà **không** có ký tự có dấu tiếng Việt → **1 kết quả duy nhất**:

| File:dòng | Nội dung | Mức | Đề xuất |
|---|---|---|---|
| `phase-05:454` | `` | `gps_fix_type` | int \| null | — | 0 no-gps · 1 no-fix · 2 2D · 3 3D · 4 DGPS · 5 RTK-float · 6 RTK-fixed | `` | thấp | Đây là bảng liệt kê giá trị enum của MAVLink — giữ nguyên tên gốc là đúng; có thể thêm chú thích tiếng Việt trong ngoặc |

**Quan sát phụ (thấp):** nhiều khối trong code fence viết **tiếng Việt không dấu** (`phase-11:196-232`, `phase-14:233-260`, `phase-15:114,212-239`, `phase-17:76-230,356-437`, `phase-19:295-299,672`, `phase-20:97-102,211-212`, `phase-21:83-122,451`, `phase-22:319-325`). Đó là các checklist/param-file dự định ghi ra đĩa hoặc in giấy — ASCII-safe là hợp lý. Nhưng **không nhất quán**: `phase-19:200-203`, `phase-20:73`, `phase-24:310` lại dùng tiếng Việt có dấu trong khối tương tự.
**Đề xuất:** thêm một dòng vào `_phase-template.md`: *"Khối sẽ được ghi ra file `.param`/`.txt` hoặc in giấy → viết không dấu; khối chỉ để đọc trong Markdown → viết có dấu."*

---

## 6. An toàn

### 6.1 `NO PROPELLERS` ở Phase 14–19

| Phase | Nêu rõ? | Bằng chứng |
|---|---|---|
| 14 | **KHÔNG** | 0 kết quả cho `NO PROP` / `KHÔNG CÓ CÁNH` / `tháo cánh` / `chưa gắn cánh`. Chỉ có `:70,367` nói về **chiều ren** của cánh |
| 15 | ✅ | header `:5` *"**KHÔNG cắm pin trong phase này**"* + 1 lần nhắc |
| 16 | ✅ | 2 lần |
| 17 | ✅ | 2 lần, trong đó `:514` là **cổng pass** |
| 18 | ✅ | 5 lần |
| 19 | ✅ | `:15` *"Từ 19.1 đến 19.12 là **NO PROPELLERS** tuyệt đối… Cánh chỉ được gắn ở 19.13"*, `:21`, `:497` cổng bắt buộc |

| Phát hiện | Mức | Đề xuất |
|---|---|---|
| `phase-14` **không có** câu `NO PROPELLERS` nào, dù `:69,95` có thao tác với motor và pin LiPo | trung bình | Thêm vào ngay sau bảng header của `phase-14`: *"**AN TOÀN:** toàn bộ phase này không lắp cánh lên motor. `SAFETY.md` mục 2."* (khớp cách làm của `phase-15:5` và `phase-19:15`) |

### 6.2 Dòng `AN TOÀN:` ở mọi bước motor / nguồn / LiPo / bay (Phase 14–22)

| Phase | Số dòng `AN TOÀN` | Đánh giá |
|---|---|---|
| 14 | 5 | ✅ phủ motor (`:69`), LiPo (`:95`), Zadig (`:170`), rút cáp khi ghi bootloader (`:190`) |
| 15 | 5 | ✅ |
| 16 | 10 | ✅ — phase nguy hiểm nhất trên bàn, phủ dày |
| 17 | 8 | ✅ |
| 18 | 15 | ✅ |
| 19 | 18 | ✅ |
| 20 | 5 | ✅ — thêm khối "3 luật" `:16`, ABORT từng bài (`:281,402`) |
| 21 | 7 | ✅ — thêm `:109` (SAFETY.md mục 4) |
| 22 | 9 | ✅ — `:208,212,416` phủ đúng các bẫy `AVOID` |
| **23** | **0** | ❌ xem dưới |
| 24 | 1 (`:242` `**An toàn:**`) + khối 4 luật `:258-262` + cột điều kiện ✅/⚠️ ở bảng `:269-271` | ✅ đủ nội dung, nhưng khác quy ước chữ hoa |

| # | Phát hiện | Mức | Đề xuất |
|---|---|---|---|
| 1 | **`plans/phase-23-iot-mqtt-su-kien-dashboard.md`: 0 dòng `AN TOÀN:`.** Mục 23.6 bước 7 (`:447-449`) yêu cầu **bay treo ở 5 m / 8 m / 12 m** trong khi **một người tình nguyện đứng lần lượt tại 5 cọc từ 0 m đến 20 m** — cọc 0 m là **ngay điểm cất cánh, ở dưới drone**. 75 lượt. Bảng Rủi ro `:543-554` có 9 hàng nhưng **không hàng nào** nói về an toàn con người | **cao** | Thêm một khối `**AN TOÀN:**` ngay trước 23.6 bước 7: bỏ cọc 0 m hoặc dời drone ra ≥ 10 m theo phương ngang; **không ai đứng dưới drone** (khớp `phase-24:242`); RC luôn trong tay; kính bảo hộ; người quan sát thứ hai; tình nguyện viên được phổ biến điểm thoát. Thêm hàng rủi ro *"Người đứng làm mục tiêu ở quá gần / dưới drone"* (khả năng 3 × ảnh hưởng 5 = 15) |
| 2 | `phase-23:24` có trích `SAFETY.md` luật `NO PROPELLERS` cho test trên bàn, nhưng header `:5` ghi phần cứng *"drone bay được … 1–2 người tình nguyện đứng làm mục tiêu"* mà không có cảnh báo | cao (cùng gốc với #1) | Ghi phạm vi rõ trong header: bước nào trên bàn (không cánh), bước nào bay thật |
| 3 | `phase-24` dùng `**An toàn:**` (thường) thay vì `**AN TOÀN:**` như 9 phase kia | thấp | Thống nhất chữ hoa cho dễ quét |

### 6.3 Không phase nào đề xuất tắt `ARMING_CHECK` / pre-arm check

**Không phát hiện vi phạm.** Ngược lại, có **8 chỗ cấm rõ ràng**:
`phase-03:100,272,297`, `phase-06:98,122`, `phase-16:439-441,496,509`, `phase-19:21,447,455,694`.
`phase-16:496` và `phase-19:694` đưa *"`ARMING_CHECK` không bị đụng tới"* thành **cổng pass**.

Một điểm căng nhẹ (thấp):

| File:dòng | Nội dung | Mức | Đề xuất |
|---|---|---|---|
| `phase-03:107` | *"`param set ARMING_CHECK 1` xong không arm được nữa, không biết sửa → `param set ARMING_CHECK 0` để quay lại"* — đứng ngay sau `:100` *"không bao giờ tắt hết `ARMING_CHECK` cho nhanh"* | thấp | Thêm *"(chỉ trên SITL, trong bài tập này; **không bao giờ** làm thế trên bo thật)"* vào dòng `:107` |

---

## 7. Đúng phạm vi hai luồng

### 7.1 Luồng chính có làm việc huấn luyện YOLO / dataset không?

**Không phát hiện.** Đã quét `yolo|huấn luyện|train\.py|dataset|VisDrone|ultralytics|epoch|gán nhãn` trên `plans/phase-*.md`, loại bỏ dòng trỏ về `plans/ai/`:

- `phase-23:33,215,356` — chỉ **dùng suy luận** với trọng số có sẵn `ml/weights/yolo11n.pt` (COCO gốc, lọc class 0). `phase-23:65` khai rõ *"`ml/**` (luồng AI sở hữu)"*, `:220` dặn ghi tên file trọng số để log cũ vẫn truy được khi luồng AI thay model. Đúng ranh giới.
- `phase-07:291`, `phase-10:230` — nguồn `detection` **giả**, nói rõ *"khi bộ nhận diện thật vào ở `plans/ai/`, chỉ đổi nguồn"*. Đúng.
- `phase-24:546` — đính chính số liệu SAHI trong tài liệu tổng quan; `:548` đã ghi rõ phải phối hợp với `ai-phase-04`. Đúng.

Một điểm ranh giới (thấp):

| File:dòng | Nội dung | Mức | Đề xuất |
|---|---|---|---|
| `phase-01:271-278` | `phase-01` thêm nhóm `[project.optional-dependencies] ml` (`ultralytics`, `opencv-python`, `albumentations==2.0.8`, `pandas`, `matplotlib`) vào `pyproject.toml` | thấp | Chấp nhận được (scaffolding, `phase-01` sở hữu `pyproject.toml`) — **nhưng** phải giải quyết mâu thuẫn chiến lược venv ở mục 3.1 trước, nếu không nhóm `ml` này sẽ vĩnh viễn không ai dùng |

### 7.2 Luồng AI có làm việc của luồng chính không?

**Phát hiện — đây là vi phạm phạm vi rõ nhất của bộ kế hoạch.**

`plans/ai/ai-phase-01-chuan-bi.md:87-90,106-110` khai sở hữu **8 đường dẫn thuộc luồng chính**:

| Đường dẫn | Loại | Xung đột |
|---|---|---|
| `backend/vision/stream.py` | sửa (điền thân) | `phase-23:65` quy cho Phase 17; `phase-17:43` từ chối mọi mã backend |
| `backend/vision/detector.py` | sửa (điền thân) | như trên |
| `backend/vision/events.py` | sửa (`should_emit`) | **`phase-23:47` cũng khai hiện thực hàm này** |
| `backend/vision/fake_source.py` | tạo mới | trùng chức năng `phase-07:55` `fake_stream.py` |
| `backend/tests/test_vision_events.py` | tạo mới | — |
| `backend/tests/test_mjpeg_parser.py` | tạo mới | — |
| `scripts/fake_mjpeg_server.py` | tạo mới | `ai-phase-01:122` nói `phase-10` dùng nó cho Playwright E2E, nhưng `phase-10:70-72` liệt fixture riêng và không nhắc file này |
| `backend/config.py` | sửa (thêm khoá Vision) | ✅ có ghi rõ `phase-05` sở hữu, chỉ thêm khoá (`:124`) |
| `.gitignore` | sửa (`!ml/datasets/*.dvc`) | chồng với `phase-01`, `phase-11:41`, `phase-18:39` |

**Mức: cao.** **Đề xuất — chọn một trong hai:**
**(a)** Công nhận `ai-phase-01` là chủ sở hữu cụm `backend/vision/{stream,detector,events}.py` + `scripts/fake_mjpeg_server.py`, rồi sửa `phase-23:47,65` (bỏ `events.py` khỏi ownership, sửa quy kết Phase 17 → `ai-phase-01`) và `phase-10:70-72` (dùng `scripts/fake_mjpeg_server.py`). Kèm theo: `ai-phase-01` **không còn là luồng phụ không chặn** — `phase-23` sẽ phụ thuộc nó, trái với `plans/README.md:56` (*"luồng chính không chờ nó"*).
**(b)** Chuyển toàn bộ cụm `backend/vision/*` và `scripts/fake_mjpeg_server.py` sang luồng chính (một mục mới trong `phase-17` hoặc `phase-23`), `ai-phase-01` chỉ còn `ml/**` + `ml/.venv` + `requirements-ml`/`pyproject`. Cách này **giữ được** lời hứa "luồng AI không chặn luồng chính" ở `README.md:56` và `_phase-index.md:33`.

`ai-phase-02`, `ai-phase-03`, `ai-phase-04` **không** vi phạm: cả ba khai *"Tuyệt đối không đụng: `backend/mavlink/**`, `frontend/**`, `firmware/**`, mọi `plans/phase-*.md`"* (`ai-02:62`, `ai-03:52`, `ai-04:48`). `ai-phase-03:50` còn liệt `backend/vision/stream.py` vào cột "chỉ dùng, không sửa". Tốt.

### 7.3 Prior-art của `ai-phase-01` đọc trạng thái repo **trước** `phase-01`

`ai-phase-01:36-58` mô tả hiện trạng file theo repo **hôm nay** (`requirements-ml.txt` 7 dòng, `backend/config.py` **dòng 88–94**, `.gitignore` **dòng 36–45**). Nhưng header `:5` khai phụ thuộc `phase-01`, mà `phase-01` **xoá** `requirements-ml.txt`, viết lại `.gitignore`, và `phase-05` viết lại lớn `backend/config.py`.

**Mức: trung bình.** **Đề xuất:** thay mọi tham chiếu **số dòng** bằng tham chiếu **tên khối/tên hằng** (`khối Vision trong backend/config.py`, `khối ml/ trong .gitignore`), và thêm một câu ở đầu bảng: *"Bảng này mô tả trạng thái trước `phase-01`; nếu `phase-01` đã chạy, đọc lại file thật trước khi sửa."*

---

## Tổng hợp mức độ

### Cao (13) — nên sửa trước khi bắt đầu Phase 01

1. `phase-01` xoá `requirements*.txt` nhưng `phase-05:61`, `phase-07:50`, `ai-phase-01:98` vẫn khai sửa chúng (3.1)
2. Hai chiến lược môi trường ML loại trừ nhau: `phase-01:264-279` vs `ai-phase-01:135` (3.1)
3. `backend/vision/events.py` bị `ai-phase-01:108` và `phase-23:47` cùng khai hiện thực (3.1)
4. `phase-23:65` quy sai chủ sở hữu `backend/vision/stream.py`/`detector.py` cho Phase 17 (3.1)
5. `deploy/mosquitto.conf` (`phase-01:32`) vs `docker/mosquitto/mosquitto.conf` (`phase-23:40`) (3.1)
6. `04-first-flight.param` (`phase-11:212`) vs `04-pre-first-flight.param` (`phase-19:41`) (3.1 / 4.3)
7. `phase-23` cần sửa `App.tsx`, `MapView.tsx`, `backend/app.py` nhưng không sở hữu (3.1)
8. Uỷ thác mồ côi `params/README.md` từ `phase-19:52` sang Phase 24 (3.2)
9. `phase-23:476` dùng `type: "detection_event"` không tồn tại trong hợp đồng WS `phase-05:434-441` (4.1)
10. Header MJPEG lệch: thiếu `X-Frame-Id`/`X-Framesize`, `X-Timestamp` vs `X-Timestamp-Ms`, `phase-12` không trích dẫn SSOT (4.2)
11. Cấu hình rangefinder SITL của `phase-07:221-223` mâu thuẫn `phase-04:211-236` dù tự nhận "nhắc lại" (4.8)
12. `phase-24:141,144` dùng endpoint camera sai (`/control?var=quality`) dù `phase-12:248` đã chốt `/set?quality`; `ai-phase-03:94` dùng địa chỉ AP `192.168.4.1:81` sai chế độ mạng (4.12)
13. `phase-23` không có một dòng `AN TOÀN:` nào, trong khi 23.6 bước 7 cho người đứng ở cọc 0 m dưới drone đang treo (6.2)

Cộng thêm hai mục ảnh hưởng lập kế hoạch: **bảng giờ `plans/README.md` sai ~71% (luồng chính) và ~167% (luồng AI)** (2.3), và **`ai-phase-01` chiếm 8 đường dẫn luồng chính, phá vỡ lời hứa "luồng AI không chặn luồng chính"** (7.2).

### Trung bình (18)

Phụ thuộc header lệch index ở `phase-07`, `phase-08` (1.2) · header giờ lệch Timeline ở `phase-18/19/21` (1.3) · `README.md:54` ghi thiếu phạm vi NO PROPELLERS (2.4) · uỷ thác `.gitignore` và vòng tròn uỷ thác `backend/vision/*` (3.2) · `PROGRESS.md` vs `plans/PROGRESS.md` ở 6 file (3.4) · ba nguồn MJPEG giả trùng chức năng (3.5) · `src/panels/` vs `src/components/` (3.6) · thứ tự ràng buộc SSOT hợp đồng MJPEG (4.2 #5) · `phase-17:173,191` endpoint SITL sai (4.5) · `CAMERA_URL` vs `CAMERA_STREAM_URL` (4.12) · bảng 4 nhánh A/B/C/D thiếu giá trị mặc định (5.3) · quyết định camera chặn `phase-13.1` không có hạn chót (5.3) · `phase-14` thiếu câu NO PROPELLERS (6.1) · prior-art `ai-phase-01` đọc trạng thái trước `phase-01` (7.3).

### Thấp (10)

Mục thêm ngoài template (1.1) · 8 file header giờ lệch ≤ 0,5 (1.3) · `phase-10` phụ thuộc bắc cầu (1.2) · `README.md:54` vs `phase-13` header (2.5) · `phase-23:23` đường dẫn hợp đồng mơ hồ (4.1) · `X-JPEG-Quality` hoa/thường (4.2) · trùng số `02` trong dãy param (4.3) · `phase-23:237` quy sai nguồn danh sách topic cũ (4.7) · `phase-21:111` không nhắc 350 ms (4.10) · tiếng Việt có dấu/không dấu trong code fence không nhất quán (5.4) · `phase-03:107` gợi ý `ARMING_CHECK 0` (6.3) · `phase-24` dùng `An toàn:` thường (6.2) · `phase-01:271-278` thêm nhóm `ml` vào pyproject (7.1).

---

## Thứ tự sửa đề xuất

1. **Chốt ranh giới `backend/vision/*`** (mục 7.2) — quyết định này kéo theo các mục 3.1#3, 3.1#4, 3.2#3, 3.5, và cả lời hứa "luồng AI không chặn" trong `README.md`. Sửa trước tiên.
2. **Chốt chiến lược môi trường Python/ML** (3.1#1, #2) — kéo theo `phase-01`, `phase-05`, `phase-07`, `ai-phase-01`.
3. **Chốt hợp đồng header MJPEG** vào một file riêng và trỏ cả `phase-12` lẫn `ai-phase-01` vào đó (4.2).
4. **Sửa tên và chủ sở hữu file param 04** (4.3) + đóng hai uỷ thác mồ côi (3.2).
5. **Bổ sung an toàn cho `phase-23`** (6.2) và câu NO PROPELLERS cho `phase-14` (6.1).
6. **Đồng bộ số liệu**: bảng giờ `README.md` (2.3), header vs Timeline (1.3), cột phụ thuộc vs index (1.2), `PROGRESS.md` (3.4).
7. Các mục thấp gom vào một lượt dọn cuối.
