# Phase 24: IoT — vòng QoS thích ứng, ma trận hỏng hóc, báo cáo và demo

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 22 (tránh vật cản thật + tuning xong), Phase 23 (MQTT + pipeline sự kiện) | ~44 giờ | Có (drone bay được, camera ESP32-CAM, thước dây / máy đo khoảng cách, bãi bay dài ≥ 100 m, pin dự phòng) |

## Mục tiêu

Đây là **phase cuối của luồng chính**. Ba việc lớn, theo thứ tự:

1. **Đóng vòng QoS** — backend đo chất lượng đường truyền rồi tự ra lệnh cho camera đổi `jpeg_quality`, và ghi lại giá trị đó cho **từng khung ảnh**. Đây là đóng góp chính của môn IoT (`docs/bao-cao-tong-quan-du-an.md` §7.2) và cũng là thứ nối hai môn học bằng một biến duy nhất.
2. **Chứng minh hệ thống hỏng an toàn** — năm kịch bản hỏng hóc được thử nghiệm có quy trình, có tiêu chí pass, có bằng chứng log. Bench trước, bay sau.
3. **Kết thúc dự án** — đóng băng mã nguồn ở tag `v1.0`, viết báo cáo môn IoT, dựng kịch bản demo 10 phút có phương án dự phòng, cập nhật tài liệu, chốt định nghĩa "đã hoàn thành", lưu trữ plan và viết bài học rút ra.

Phạm vi **không** bao gồm báo cáo môn Xử lý ảnh — việc đó thuộc `plans/ai/ai-phase-04-bao-cao-xla.md`. Hai báo cáo dùng chung số liệu nhưng tách file, tách người viết, tách lịch.

## Đầu vào cần có

**Phải đọc trước:**

- `plans/_phase-index.md` — bảng đánh số phase (SSOT). Phase này là 24, phase cuối luồng chính.
- `plans/phase-23-iot-mqtt-su-kien-dashboard.md` — bảng topic, hợp đồng payload, `mqtt_probe.py`. Phase này dùng lại toàn bộ, **không định nghĩa lại**.
- `docs/bao-cao-tong-quan-du-an.md` **§7.2** (vòng QoS thích ứng — sơ đồ và lập luận), **§7.4** (bảng 7 thí nghiệm đo đạc của môn IoT), **§7.5** (ma trận thử nghiệm hỏng hóc 7 kịch bản), **§11** (tiêu chí hoàn thành).
- `plans/reports/260921-research-ai-vision-pipeline.md` **§4.4** — `jpeg_quality` dải 0–63 **SỐ NHỎ = ẢNH ĐẸP**; các bậc cấp phát bộ đệm; yêu cầu bắt buộc ghi metadata từng khung. **§4.2** — ba con số cần đính chính trong tài liệu tổng quan.
- `plans/reports/260921-research-esp32-bridge-camera.md` **§4** — tầm xa 2.4 GHz (50–200 m công bố, **chưa xác minh thực địa**), hành vi khi mất link, bảng `FS_GCS_ENABLE`, cảnh báo "video đứt trước telemetry".
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` §6, §7 — bảng rủi ro chính và tiêu chí thành công.
- README cũ (`README.md`, GIAI ĐOẠN 84 và 91) — ma trận 20 bài test và kịch bản "dự án đã hoàn thành", dùng làm **tài liệu tham khảo** để viết lại, không chép nguyên.
- `SAFETY.md` — luật `NO PROPELLERS` áp cho mọi bài bench.

**Phải có sẵn:**

- Phase 23 đã pass toàn bộ cổng: 4 topic chạy, sự kiện có snapshot + toạ độ, panel IoT hoạt động.
- Phase 22 đã pass: AVOID hoạt động với vật cản giả, harmonic notch đã chỉnh, `params/06-*.param` ổn định.
- Geofence đã cấu hình và kiểm chứng ở **Phase 19** (`FENCE_ENABLE`, `FENCE_TYPE`, `FENCE_ALT_MAX`, `FENCE_RADIUS`, `FENCE_ACTION`). Phase này **chỉ đọc lại để xác nhận**, không cấu hình lại.
- Firmware camera (Phase 12) có endpoint đổi `jpeg_quality` lúc chạy. **Đọc `firmware/camera/` để biết dạng endpoint thật** trước khi viết code (xem 24.1 bước 3).
- Bãi bay đủ dài để đứng cách drone 80 m an toàn, có đường ngắm thẳng.
- Luồng AI đã có `ml/results/` với các bảng kết quả — cần cho mục 24.7 và 24.11; nếu chưa xong, phần IoT vẫn viết được độc lập.

## File và thư mục sở hữu

Phase này **chỉ được** tạo/sửa các đường dẫn sau:

```text
backend/iot/__init__.py                    MỚI
backend/iot/link_metrics.py                MỚI — fps, bytes/s, loss, rssi
backend/iot/qos_controller.py              MỚI — vòng điều khiển jpeg_quality
backend/iot/frame_log.py                   MỚI — ghi frames.jsonl từng khung
backend/tests/test_qos_controller.py       MỚI
backend/tests/test_link_metrics.py         MỚI
.env.example                               (CHỈ thêm khối QOS mới)

scripts/iot_experiment.py                  MỚI — chạy bài đo throughput/latency/loss
scripts/make_session_dir.ps1               MỚI — tạo thư mục log đúng quy ước

firmware/ardupilot/params/07-final.param   MỚI
docs/test-matrix-hong-hoc.md               MỚI — quy trình + kết quả 5 bài test
docs/bao-cao-iot/                          MỚI — toàn bộ báo cáo môn IoT
docs/demo-script.md                        MỚI — kịch bản demo 10 phút + checklist
docs/slides-iot-outline.md                 MỚI — dàn ý slide
docs/lessons-learned.md                    MỚI
docs/so-tay/24-iot-qos-hong-hoc.md         MỚI (khung)
docs/bao-cao-tong-quan-du-an.md            (CHỈ 4 điểm đính chính ở mục 24.10)
README.md                                  (viết lại phần trạng thái + link)
plans/archive/                             MỚI — lưu trữ plan đã xong
plans/PROGRESS.md                                (tick dòng Phase 24 + chốt toàn bộ)
.gitignore                                  (CHỈ khối logs/)
logs/                                      (dữ liệu chuyến bay, đã gitignore)
```

**Không đụng:** `backend/mqtt/*` (Phase 23 sở hữu — nếu cần đổi, ghi thành mục trong `docs/lessons-learned.md`), `backend/mavlink/*`, `firmware/camera/*` (Phase 12 sở hữu), `ml/**` và `plans/ai/**` (luồng AI sở hữu), `plans/phase-00..23-*.md` (chỉ **di chuyển** vào `plans/archive/` ở mục 24.12, không sửa nội dung).

---

## Việc theo thứ tự

### 24.1 Vòng điều khiển QoS thích ứng trên `jpeg_quality`

Ý tưởng như YouTube: mạng yếu thì tự giảm nét để khỏi giật, mạng khoẻ thì tăng nét lại. Ở đây backend đo chất lượng đường truyền rồi ra lệnh cho camera đổi mức nén JPEG.

**Bẫy trực giác phải nhớ suốt phase:** driver `esp32-camera` dùng `jpeg_quality` dải **0–63, SỐ NHỎ = ẢNH ĐẸP**. Tăng số là làm ảnh xấu đi và nhẹ hơn. Viết câu này thành comment ngay đầu `qos_controller.py`.

**Bước 1 — đo bốn đại lượng đầu vào (`backend/iot/link_metrics.py`):**

| Đại lượng | Cách lấy | Trạng thái |
|---|---|---|
| `fps_measured` | nghịch đảo khoảng cách thời gian giữa hai khung MJPEG, trung bình trượt 5 s | đo được chắc chắn |
| `bytes_per_s` | tổng kích thước khung trong cửa sổ 5 s ÷ 5 | đo được chắc chắn |
| `loss_pct` | lỗ hổng trong `seq` của `uav/telemetry`, cửa sổ 60 s | đo được chắc chắn |
| `rssi_dbm` | xem ba đường bên dưới | **chưa xác minh** |

**Ba đường lấy RSSI, thử theo thứ tự:**

1. **Ưu tiên — ESP32-CAM tự báo.** Firmware Phase 12 gọi `WiFi.RSSI()` và trả qua endpoint `/status` dạng JSON. Đây là RSSI ở đúng đầu nối yếu nhất, nên là con số đáng tin nhất. **Chưa xác minh** firmware hiện tại có endpoint này không — đọc `firmware/camera/` trước.
2. **Dự phòng — DroneBridge.** **Chưa xác minh** DroneBridge for ESP32 có phơi RSSI qua HTTP hay qua bản tin MAVLink `RADIO_STATUS` hay không. Kiểm tra bằng cách mở web UI của DroneBridge và bằng `mavproxy` xem có bản tin `RADIO_STATUS` nào tới không.
3. **Dự phòng cuối — phía laptop.** `netsh wlan show interfaces` báo tín hiệu của **kết nối mà laptop đang là client**. Khi laptop là **hotspot**, lệnh này **chưa xác minh** là có liệt kê tín hiệu từng máy trạm hay không. Nếu không, thử `netsh wlan show hostednetwork`.

**Nếu cả ba đường đều không có RSSI:** vòng điều khiển **vẫn chạy bình thường** bằng ba đại lượng còn lại. Chỉ mất một biến trong bảng kết quả. Thay thế bằng **khoảng cách đo bằng thước** làm biến độc lập — vẫn dựng được chuỗi quan hệ "khoảng cách → thông lượng → `q` → chất lượng ảnh". **Ghi rõ trong báo cáo là biến RSSI không quan sát được và lý do**, đừng bịa số.

**Bước 2 — luật điều khiển (`backend/iot/qos_controller.py`):**

```text
mỗi QOS_MIN_INTERVAL_S giây, xét theo thứ tự:

  A. Nếu bytes_per_s > QOS_BYTES_HIGH  HOẶC  fps_measured < QOS_TARGET_FPS * 0.7:
         quality += QOS_STEP        (nén mạnh hơn, ảnh xấu đi, nhẹ hơn)
         lý do = "link_degraded"

  B. Ngược lại, nếu bytes_per_s < QOS_BYTES_LOW
     VÀ fps_measured >= QOS_TARGET_FPS * 0.95
     VÀ confidence trung bình 10 s gần nhất < QOS_CONF_LOW:
         quality -= QOS_STEP        (ảnh đẹp hơn để bộ nhận diện nhìn rõ hơn)
         lý do = "detector_unsure"

  C. Ngược lại: giữ nguyên.

  Luôn clamp vào [QOS_Q_MIN, QOS_Q_MAX].
  Nếu giá trị mới == giá trị cũ thì KHÔNG gửi lệnh (tránh spam camera).
  Mỗi lần đổi: publish uav/qos kèm lý do.
```

Điều kiện `confidence < QOS_CONF_LOW` ở nhánh B là phần đáng nói nhất trong báo cáo: hệ thống tăng chất lượng ảnh **vì bộ nhận diện đang không chắc chắn**, không phải vì băng thông dư. Đó chính là "vòng điều khiển chất lượng ảnh theo phản hồi của tác vụ" — hướng D trong `plans/QUYET-DINH-CHUA-CHOT.md`.

**Trễ (hysteresis) là bắt buộc.** Nếu dùng chung một ngưỡng cho cả tăng và giảm, hệ thống sẽ dao động 8↔40 liên tục. Ví von: điều hoà không bật/tắt ngay tại đúng 25 °C mà chờ lệch 1 độ, nếu không nó kêu tạch tạch suốt. Ở đây `QOS_BYTES_HIGH` và `QOS_BYTES_LOW` phải cách nhau ít nhất 30%.

**Biến môi trường thêm vào `.env.example`:**

```text
# ---------------------------------------------------------------------------
# Vòng QoS thích ứng (Phase 24)
# LƯU Ý: jpeg_quality dải 0-63, SỐ NHỎ = ẢNH ĐẸP (ngược trực giác)
# ---------------------------------------------------------------------------
QOS_ENABLED=true
QOS_Q_MIN=8
QOS_Q_MAX=40
QOS_STEP=4
QOS_MIN_INTERVAL_S=2
QOS_TARGET_FPS=10
QOS_BYTES_HIGH=180000
QOS_BYTES_LOW=90000
QOS_CONF_LOW=0.75
# Đọc firmware/camera/ để biết dạng endpoint thật trước khi đặt giá trị này
QOS_CAMERA_CONTROL_URL=http://192.168.137.50/set?quality={q}
```

**Bước 3 — gửi lệnh đổi chất lượng.** Phase 12 §12.x đã chốt endpoint rút gọn `GET /set?quality=<n>` (dải 0..63, mã lỗi `400`) — dùng đúng dạng đó cho `QOS_CAMERA_CONTROL_URL`. **Không sửa firmware ở phase này** (Phase 12 sở hữu); nếu firmware thiếu endpoint thì ghi thành một mục trong `docs/lessons-learned.md` và tắt `QOS_ENABLED`.

Lệnh HTTP phải có timeout ngắn (≤ 1 s) và **không bao giờ chặn luồng xử lý khung**. Lệnh thất bại thì log warning rồi thôi — camera vẫn stream ở mức cũ, không có gì hỏng.

**Bước 4 — ghi `jpeg_quality` theo từng khung (BẮT BUỘC, không được bỏ).** `backend/iot/frame_log.py` ghi một dòng cho **mỗi khung nhận được** vào `logs/<session>/frames.jsonl`:

```json
{"ts":"2026-11-02T09:14:23.412Z","seq":8412,"jpeg_quality":12,"bytes":21874,"rssi_dbm":-64,"alt_rel":8.2,"fps_inst":13.6}
```

Vì sao bắt buộc: không có trường này thì sau **không phân tầng được kết quả theo `q`**, và **mất hẳn một trục của ma trận thí nghiệm**. Số liệu đó không lấy lại được sau chuyến bay — không có cách nào đoán ngược `q` từ ảnh đã lưu một cách đáng tin.

Ghi bằng append + flush theo lô nhỏ (ví dụ mỗi 20 dòng), **không giữ hết trong RAM** — crash giữa chuyến là mất sạch.

**Bước 5 — test trên bàn, không cần bay.**

```powershell
uv run pytest backend/tests/test_qos_controller.py backend/tests/test_link_metrics.py -v
```

Năm ca bắt buộc cho `qos_controller`:

1. `bytes_per_s` vượt ngưỡng cao → `quality` tăng đúng `QOS_STEP`.
2. Băng thông dư + fps đạt + confidence thấp → `quality` giảm.
3. Băng thông dư + fps đạt + confidence **cao** → **giữ nguyên** (không tăng chất lượng vô ích).
4. Hai lần gọi cách nhau < `QOS_MIN_INTERVAL_S` → lần thứ hai không đổi gì.
5. Đã ở `QOS_Q_MIN` mà vẫn có yêu cầu giảm → giữ nguyên, không gửi lệnh, không tràn xuống dưới 8.

Sau đó chạy thật trên bàn: bật backend + camera, dùng một tiến trình tải mạng (hoặc tạm giảm `QOS_BYTES_HIGH` xuống rất thấp) để ép nhánh A kích hoạt. Quan sát `mqtt_probe.py` thấy tin `uav/qos` với `reason:"link_degraded"` và `frames.jsonl` thấy `jpeg_quality` đổi giá trị.

**Nếu lỗi:**

- `jpeg_quality` dao động liên tục 8↔40 → khoảng cách giữa `QOS_BYTES_HIGH` và `QOS_BYTES_LOW` quá hẹp, hoặc `QOS_MIN_INTERVAL_S` quá nhỏ. Nới khoảng cách ngưỡng trước, giảm `QOS_STEP` xuống 2 sau.
- Đổi `quality` xong mà `bytes_per_s` không đổi → có thể firmware chỉ áp dụng mức nén ở lần cấp phát bộ đệm. Các bậc cấp phát là `0–5` / `6–10` / `11+`, nên đổi **trong cùng một bậc** có thể gần như không tác dụng. Thử nhảy qua bậc (12 → 8, hoặc 12 → 20) rồi đo lại. Nếu vẫn không đổi, ghi nhận là giới hạn của firmware và báo cáo trung thực.
- `bytes_per_s` giảm rõ nhưng ảnh vẫn giật → nút thắt là đường truyền Wi-Fi chứ không phải kích thước khung. Ghi nhận và báo cáo; đừng tiếp tục tăng nén vô ích rồi kết luận sai.
- Backend chậm hẳn khi bật QoS → đang gọi HTTP đồng bộ trong luồng đọc khung. Đẩy sang luồng riêng hoặc `asyncio.create_task`.

---

### 24.2 Ba bài thí nghiệm đo đạc cho môn IoT

Đây là phần số liệu của báo cáo IoT. Mục tiêu: ba bảng có số thật, đo trên chính hệ thống của nhóm, ở bốn khoảng cách **10 / 30 / 50 / 80 m**.

**Chuẩn bị chung:**

- Đo khoảng cách bằng thước dây hoặc máy đo laser, cắm cọc đánh dấu 4 mốc. Không ước lượng bằng mắt.
- Mỗi mốc lặp **3 lần**, mỗi lần **60 giây**. Ba lần lặp để tính độ lệch chuẩn — một phép đo đơn lẻ ở 80 m không nói lên gì.
- Ghi thời tiết và giờ vào `notes.md` (nhiễu 2.4 GHz thay đổi theo giờ và theo số người xung quanh).
- **Lần đo thứ nhất: drone đặt trên giá, KHÔNG CÁNH, không arm.** Lần đo thứ hai: bay treo ở 5 m. So hai lần để thấy ảnh hưởng của nhiễu ESC và thân drone che chắn anten — đây là một kết quả đáng giá mà ít báo cáo có.

**Bảng 1 — thông lượng theo chất lượng ảnh** (QoS **tắt**, đặt `q` thủ công):

| `jpeg_quality` | bytes/khung TB | bytes/s | fps | Ghi chú |
|---|---|---|---|---|
| 8 | | | | ảnh đẹp nhất |
| 12 | | | | |
| 16 | | | | |
| 20 | | | | |
| 30 | | | | |
| 40 | | | | ảnh xấu nhất |

Đo ở khoảng cách cố định 10 m để tách biến. Đây là bảng nền: nó cho biết mỗi nấc `q` đổi được bao nhiêu băng thông, từ đó luật điều khiển ở 24.1 mới có căn cứ.

**Bảng 2 — độ trễ theo khoảng cách** (QoS **bật**):

| Khoảng cách | Độ trễ khung ảnh (ms) | Độ trễ MQTT (ms) | Độ trễ lệnh đầu-cuối (ms) |
|---|---|---|---|
| 10 m | p50 / p95 | p50 / p95 | p50 / p95 |
| 30 m | | | |
| 50 m | | | |
| 80 m | | | |

Ba loại độ trễ, ba cách đo khác nhau — phải nói rõ trong báo cáo:

- **Độ trễ khung ảnh** = lúc backend nhận xong khung − `ts` mà ESP32 đóng vào khung. **Nhiễm độ lệch đồng hồ ESP32 ↔ laptop** (NTP đồng bộ lúc khởi động, nhưng trôi sau đó). **Chưa xác minh** độ trôi sau 20 phút — đo bằng cách so `ts` của ESP32 với đồng hồ laptop ở đầu và cuối phiên, báo cáo cả độ trôi.
- **Độ trễ MQTT** = lúc `mqtt_probe.py` nhận − `ts` trong payload. Cả hai đầu **cùng trên laptop** nên không có vấn đề đồng hồ. Đây là con số sạch nhất.
- **Độ trễ lệnh đầu-cuối** = lúc nhấn phím W trên web − lúc backend gọi `mav.send()`. Đo bằng timestamp ở cả hai đầu trong cùng tiến trình. **Không** đo tới lúc motor phản ứng — không có thiết bị đo và cũng không cần (README cũ, GIAI ĐOẠN 86, nói đúng ở điểm này).

**Bảng 3 — mất gói và tín hiệu theo khoảng cách:**

| Khoảng cách | loss_pct telemetry | Số khung ảnh rơi / phút | RSSI TB (dBm) | Video còn xem được? |
|---|---|---|---|---|
| 10 m | | | | |
| 30 m | | | | |
| 50 m | | | | |
| 80 m | | | | |

**Dự đoán cần kiểm chứng (ghi vào báo cáo trước khi đo, rồi đối chiếu):** video MJPEG sẽ **đứt trước telemetry** vì cần băng thông cao hơn nhiều. Nếu ở 80 m telemetry vẫn chạy mà video đã chết — đó là kết quả **đúng như dự đoán**, không phải lỗi. Tài liệu công bố nói tầm 50–200 m cho Wi-Fi thường, nhưng đó là điều kiện lý tưởng, **chưa xác minh thực địa** trên khung drone có nhiễu ESC.

**Chạy:**

```powershell
uv run python scripts/iot_experiment.py --distance 30 --repeat 3 --duration 60 --qos on --out logs/iot-exp/
uv run python scripts/iot_experiment.py --distance 10 --sweep-quality 8,12,16,20,30,40 --duration 60 --out logs/iot-exp/
```

Script tự ghi CSV theo từng mốc và in bảng tóm tắt khi xong.

**AN TOÀN:** ở mọi bài đo có bay, `FS_GCS_ENABLE=0` và **RC luôn trong tay**. Người cầm thước đứng cách drone ít nhất 10 m theo phương ngang. Không ai đứng dưới drone.

**Nếu lỗi:**

- Ở 50 m video đứt nhưng `iot_experiment.py` treo chờ khung → phải có timeout, coi "không có khung trong 5 s" là `fps = 0` và tiếp tục đo telemetry. Đo được đến đâu ghi đến đó.
- Số liệu ba lần lặp lệch nhau rất xa (ví dụ 5%, 40%, 8%) → có nhiễu ngoại cảnh (người đi qua, Wi-Fi khác bật lên). Ghi vào `notes.md`, đo thêm lần thứ tư, và **báo cáo cả độ phân tán** chứ đừng chỉ lấy trung bình.
- Không đo được ở 80 m vì bãi không đủ dài → ghi rõ "không đo được, giới hạn địa điểm" trong bảng. Đó là hạn chế trung thực, không phải thất bại.

---

### 24.3 Ma trận năm bài test hỏng hóc

Đây là **bằng chứng quan trọng nhất của báo cáo môn IoT**: hệ thống được thiết kế để hỏng an toàn, và điều đó đã được **chứng minh** chứ không phải khẳng định. Một báo cáo nói "hệ thống có failsafe" mà không có bảng này thì chỉ là lời hứa.

**Luật chung, áp cho cả năm bài:**

1. **Bench trước, bay sau.** Mọi bài làm trên bàn **KHÔNG CÁNH** trước. Chỉ những bài đánh dấu ✅ mới lặp lại khi bay, và chỉ sau khi bản bench đã pass.
2. **Ba loại bằng chứng mỗi bài:** dòng log backend (`backend.jsonl`), ảnh chụp màn hình web, và (khi bay) file `.bin` tải từ FC.
3. **Trả lại cấu hình gốc sau mỗi bài** trước khi làm bài tiếp theo — cắm lại camera, bật lại hotspot, đặt lại `FS_GCS_ENABLE=0`. Ghi trạng thái trả lại vào bảng.
4. **RC luôn trong tay ở mọi bài có bay.** Bộ RC là dây cứu sinh, không phải Wi-Fi.

Kết quả ghi vào `docs/test-matrix-hong-hoc.md` — file này là một chương của báo cáo, viết cho người đọc ngoài chứ không phải ghi chú riêng.

| # | Kịch bản | Quy trình thao tác | Hành vi mong đợi | Tiêu chí pass | Bằng chứng | Lặp khi bay? |
|---|---|---|---|---|---|---|
| **F1** | Mất camera | Đang stream, rút cáp nguồn ESP32-CAM | Video dừng; web báo `camera: offline`; **telemetry và control không đổi**; drone giữ nguyên chế độ bay | Không có **bất kỳ** mode change nào trong log FC trong 30 s quanh thời điểm rút; `uav/health` retained chuyển `camera:"offline"` trong ≤ 5 s | `backend.jsonl`, ảnh màn hình panel IoT, output `mqtt_probe.py` | ✅ treo 5 m |
| **F2** | Tiến trình nhận diện sập | Tìm PID của tiến trình vision rồi `Stop-Process -Id <pid> -Force` | Web báo `detector: offline`; **luồng MJPEG vẫn hiển thị** (fan-out không phụ thuộc AI); MAVLink không ảnh hưởng | Telemetry giữ 1 Hz liên tục trước/trong/sau (kiểm bằng `seq` không có lỗ hổng bất thường); video vẫn chạy | `backend.jsonl`, `mqtt_probe.py` cho `uav/telemetry` | ❌ chỉ bench / SITL |
| **F3** | Đóng trình duyệt khi đang giữ W | Vào GUIDED, giữ phím W, đóng tab đột ngột (không nhả phím, không bấm nút dừng) | WebSocket đóng → dead-man 300 ms → vận tốc về 0 → chuyển **LOITER** | Log có `deadman_triggered` trong ≤ 400 ms kể từ lúc socket đóng; log FC ghi mode → LOITER | `backend.jsonl`, `.bin` (dòng mode change) | ✅ treo 5 m, bãi trống |
| **F4a** | Mất Wi-Fi, `FS_GCS_ENABLE=0` | Tắt hotspot Windows (`netsh wlan stop hostednetwork` hoặc tắt trong Settings) | Drone **giữ nguyên chế độ hiện tại**, KHÔNG RTL; web mất kết nối | Không có mode change nào trong `.bin`; RC vẫn điều khiển được bình thường | `.bin`, video quay màn hình | ✅ |
| **F4b** | Mất Wi-Fi, `FS_GCS_ENABLE=1` | Đổi param sang 1, xác nhận đã ghi, rồi tắt hotspot như trên | Sau `FS_GCS_TIMEOUT` (mặc định 5 s) → **RTL** | `.bin` có `EV: GCS FAILSAFE` rồi mode → RTL trong 5–7 s | `.bin` | ⚠️ **bench không cánh bắt buộc**; khi bay chỉ làm nếu bench đã pass VÀ bãi rộng ≥ 100 m VÀ có người quan sát thứ hai |
| **F5** | Mất tín hiệu RC | Tắt tay phát FlySky FS-i6X | RC failsafe kích hoạt theo `FS_THR_ENABLE` → RTL | `.bin` có `EV: RADIO FAILSAFE`; hành động đúng như param đã đặt ở Phase 15/19 | `.bin` | ✅ treo 5 m, sau khi bench pass |

**Mẫu ghi kết quả cho mỗi bài** (dùng trong `docs/test-matrix-hong-hoc.md`):

```markdown
### F3 — Đóng trình duyệt khi đang giữ W

Ngày/giờ:        2026-11-02 09:41
Điều kiện:       bench không cánh (lần 1) / treo 5 m, gió ~2 m/s (lần 2)
Thao tác:        GUIDED, giữ W 3 s, đóng tab bằng Ctrl+W
Quan sát:        vận tốc về 0 sau 0.31 s, mode LOITER sau 0.42 s
Tiêu chí pass:   deadman ≤ 400 ms  →  ĐẠT (310 ms)
Bằng chứng:      logs/20261102-session2/backend.jsonl dòng 4417-4423
                 logs/20261102-session2/flight.bin (MODE tại 09:41:12)
Trả lại gốc:     đã mở lại tab, xác nhận WEB CONTROL ENABLE = off
Kết luận:        PASS
```

**Nếu lỗi:**

- **F3 không chuyển LOITER mà drone trôi tiếp** → đây là lỗi **nghiêm trọng về an toàn**. Hạ cánh ngay, không bay tiếp. Nguyên nhân thường gặp: dead-man phát hiện được nhưng chưa nối tới lệnh đổi mode, hoặc một luồng khác vẫn đang lặp `SET_POSITION_TARGET`. Sửa ở Phase 06 rồi quay lại.
- **F1 làm drone đổi mode** → camera đang dính vào luồng điều khiển ở đâu đó. Vi phạm luật cứng "AI chỉ sinh sự kiện". Tìm và cắt liên kết đó trước khi làm gì khác.
- **F4b kích hoạt sớm hơn 5 s** → `FS_GCS_TIMEOUT` khác mặc định, hoặc heartbeat GCS vốn đã chập chờn từ trước khi tắt hotspot (nghĩa là link vốn đã kém — kiểm tra lại bằng bảng 3 ở việc 24.2).
- **F5 không kích hoạt** → `FS_THR_ENABLE` chưa bật hoặc throttle failsafe chưa hiệu chỉnh ở Phase 15. **Không bay tiếp** cho tới khi bài này pass — đây là failsafe quan trọng nhất.

---

### 24.4 Chuẩn thư mục log cho mỗi phiên

Viết báo cáo mà không có log đầy đủ là viết bằng trí nhớ. Chuẩn này phải áp dụng **từ chuyến bay đầu tiên của phase**, không phải áp dụng hồi tố.

**Cấu trúc bắt buộc:**

```text
logs/YYYYMMDD-sessionN/
├── flight.bin           tải từ FC qua Mission Planner ngay sau khi hạ cánh
├── telemetry.tlog       Mission Planner ghi (nếu có mở song song)
├── backend.jsonl        mọi dòng log backend có cấu trúc
├── frames.jsonl         metadata từng khung: ts, seq, jpeg_quality, bytes, rssi, alt
├── detections.csv       ts, seq, confidence, uav lat/lon/alt, target lat/lon, err_m
├── events.jsonl         nguyên văn payload MQTT đã phát
├── snapshots/           ảnh có khung bao, tên = seq zero-pad 6 chữ số
├── video/raw.mkv        bản ghi luồng MJPEG, KHÔNG re-encode
└── notes.md             điền NGAY TẠI BÃI
```

**Script tạo thư mục** (`scripts/make_session_dir.ps1`) để không ai đặt tên sai:

```powershell
.\scripts\make_session_dir.ps1 -Session 3
# tạo logs/20261102-session3/ với đủ thư mục con và notes.md từ mẫu
```

**Mẫu `notes.md` — điền ngay tại bãi, không để về nhà nhớ lại:**

```markdown
# 20261102-session3
Mục đích phiên:   đo bảng 2 (độ trễ theo khoảng cách), mốc 30 m
Gió:              ~3 m/s, hướng đông nam
Thời tiết/giờ:    nắng nhẹ, 09:30-10:10
Pin:              4S 5200 mAh, khởi hành 16.6 V, hạ cánh 14.9 V
Tải:              camera + mount, không có thiết bị phụ
Độ cao bay:       5 m treo
Chế độ:           Loiter toàn bộ
Param đang dùng:  06-auto-good.param, FS_GCS_ENABLE=0
Sự cố:            khung ảnh rơi thành cụm ở phút 4, nghi Wi-Fi bị máy khác chiếm kênh
Đổi so chuyến trước: bật QOS_ENABLED=true (chuyến trước tắt)
```

**Kiểm tra sau mỗi chuyến — trước khi rời bãi:**

```powershell
Get-ChildItem logs/20261102-session3 -Recurse -File |
  Group-Object { $_.Directory.Name } |
  Select-Object Name, Count, @{n='MB';e={[math]::Round(($_.Group | Measure-Object Length -Sum).Sum/1MB,1)}}
```

**Luật cứng:** thiếu `flight.bin` hoặc `frames.jsonl` thì chuyến bay đó **không tính** — phải bay lại. Phát hiện lúc còn ở bãi thì bay lại mất 10 phút; phát hiện ở nhà thì mất cả buổi.

---

### 24.5 Chốt ảnh tham số cuối: `07-final.param`

Sau khi mọi bài test đã pass và không còn chỉnh tham số nào nữa, lưu một ảnh chụp toàn bộ tham số FC. Đây là **điểm khôi phục**: sau này chỉnh sai PID thì nạp lại file này, thay vì cố nhớ bằng đầu.

**Bước 1 — lưu.** Mission Planner: `CONFIG` → `Full Parameter List` → `Save to file` → lưu thành `firmware/ardupilot/params/07-final.param`.

**Bước 2 — đối chiếu với mốc trước** để biết Phase 23–24 đã đổi những gì:

```powershell
Compare-Object `
  (Get-Content firmware/ardupilot/params/06-auto-good.param) `
  (Get-Content firmware/ardupilot/params/07-final.param) |
  Format-Table -AutoSize
```

**Kết quả mong đợi:** khác biệt rất ít. Nếu có bài F4b thì `FS_GCS_ENABLE` **phải đã được trả về 0** trước khi chốt. Mọi khác biệt khác phải giải thích được bằng một dòng trong `notes.md` của phiên tương ứng; **nếu không giải thích được thì có ai đó đã chỉnh tham số mà không ghi lại** — tìm ra trước khi chốt, đừng chốt một trạng thái không hiểu.

**Bước 3 — ghi chú đi kèm.** Thêm một dòng vào đầu file (ArduPilot bỏ qua dòng bắt đầu bằng `#`):

```text
# 07-final.param — chốt sau Phase 24, ngày 2026-11-05
# Khác 06-auto-good: (liệt kê từng dòng + lý do)
```

---

### 24.6 Đóng băng mã nguồn: tag `v1.0`

Trước khi viết báo cáo, cố định một phiên bản mã nguồn để mọi con số trong báo cáo đều truy ngược được về đúng bản code đã sinh ra nó. Không làm bước này thì ba tuần sau không ai biết bảng kết quả chạy trên bản nào.

**Bước 1 — kiểm tra sạch sẽ trước khi tag:**

```powershell
git status --short
uv run ruff check .
uv run pytest -q
pnpm --dir frontend build
```

Cả bốn phải sạch/xanh. `git status --short` phải rỗng (mọi thứ đã commit, và không có file dữ liệu lớn nào lọt vào — kiểm tra `.gitignore` có `logs/`, `ml/datasets/`, `ml/weights/`).

**Bước 2 — tạo tag có chú thích:**

```powershell
git tag -a v1.0 -m "v1.0 - UAV IoT GCS: bay tu dong, web GCS, MQTT, vong QoS thich ung, ma tran hong hoc"
git push origin v1.0
```

**Bước 3 — ghi số hiệu commit vào báo cáo.** Lấy SHA đầy đủ và đọc lại từ nguồn, đừng chép từ màn hình:

```powershell
git rev-parse v1.0
```

Dán SHA đó vào trang bìa của cả `docs/bao-cao-iot/` và (phối hợp với luồng AI) báo cáo XLA. Mọi bảng số liệu ghi kèm "chạy trên `v1.0` (`<sha>`)".

**Nếu lỗi:**

- `git push origin v1.0` báo `tag already exists` → đã tag trước đó; đừng xoá tag đã đẩy lên. Dùng `v1.0.1` cho bản sửa.
- `pnpm build` hỏng vì lỗi TypeScript ở panel mới → sửa trước khi tag. Tag phải trỏ tới một trạng thái build được, nếu không nó vô dụng.

---

### 24.7 Báo cáo môn IoT

Viết vào `docs/bao-cao-iot/`, chia thành nhiều file theo chương để dễ sửa song song.

**Dàn ý bắt buộc:**

```text
docs/bao-cao-iot/
├── 00-trang-bia.md        tên đề tài, thành viên, môn học, ngày, commit v1.0 <sha>
├── 01-gioi-thieu.md       bài toán, mục tiêu, phạm vi, những gì KHÔNG làm
├── 02-kien-truc.md        ba tầng edge/fog/application (tổng quan §7.1), sơ đồ khối,
│                          luồng dữ liệu, bảng công nghệ đã chọn + lý do
├── 03-giao-thuc.md        MQTT: bảng 4 topic, QoS, retained, LWT, hợp đồng payload,
│                          vì sao chọn từng mức QoS (không chép định nghĩa sách giáo khoa)
├── 04-vong-qos.md         đóng góp chính: sơ đồ vòng kín, luật điều khiển, hysteresis,
│                          bảng 1 (thông lượng theo q), chuỗi RSSI -> q -> artifact -> chất lượng nhận diện
├── 05-do-dac.md           bảng 2 (độ trễ), bảng 3 (mất gói/RSSI), phương pháp đo từng loại
│                          độ trễ, vấn đề đồng hồ ESP32, số lần lặp và độ phân tán
├── 06-hong-hoc.md         ma trận 5 bài test: quy trình, mong đợi, tiêu chí, bằng chứng
├── 07-han-che.md          threats to validity + những gì KHÔNG đo được
├── 08-ket-luan.md         trả lời đúng các câu hỏi đặt ra ở chương 1, không hơn
└── phu-luc/               ảnh màn hình, trích log, bảng param, đường dẫn dữ liệu thô
```

**Ba nguyên tắc viết, kiểm tra trước khi nộp:**

1. **Mọi con số kèm ngữ cảnh.** Không có "độ trễ 50 ms" trần trụi. Phải là "độ trễ MQTT p50 = 50 ms, p95 = 112 ms, đo ở 30 m, 3 lần lặp × 60 s, QoS bật, `v1.0`". Nguyên tắc này lấy từ tổng quan §6.5 và áp cho cả báo cáo IoT.
2. **Phân biệt rõ số đo được và số trích dẫn.** Tầm 50–200 m là **công bố của nhà sản xuất, chưa xác minh**; 14.19 fps là **số đo của người khác**; mọi thứ trong bảng 1/2/3 là **số nhóm tự đo**. Ghi nhãn từng loại, đừng trộn.
3. **Chương 07 (hạn chế) viết thật.** Danh sách tối thiểu phải có: RSSI không lấy được (nếu đúng vậy), đồng hồ ESP32 trôi bao nhiêu (**chưa xác minh** đến khi đo), broker không xác thực (`allow_anonymous`), không có mã hoá TLS, chưa test ở mốc 80 m nếu bãi không đủ dài, chỉ một thiết bị biên nên không đo được tính mở rộng, và đo trong một địa điểm/một dải thời gian nên không khái quát được.

Chương 07 là chương **làm tăng điểm**, không phải làm giảm. Một báo cáo nói rõ giới hạn đáng tin hơn hẳn một báo cáo nghe hoàn hảo.

**Bảng đối chiếu với tổng quan §7.4** — bảy thí nghiệm đã nêu ở tài liệu gốc, ghi rõ cái nào làm được, cái nào không:

| Thí nghiệm (tổng quan §7.4) | Làm ở đâu | Trạng thái |
|---|---|---|
| Độ trễ lệnh đầu-cuối | bảng 2 | |
| Độ trễ luồng ảnh | bảng 2 | |
| Độ trễ MQTT | bảng 2 | |
| Tỉ lệ mất gói telemetry | bảng 3 | |
| RSSI theo khoảng cách | bảng 3 | có thể **không đo được** — xem 24.1 bước 1 |
| fps theo RSSI | bảng 3 | phụ thuộc RSSI |
| Tần suất cập nhật GPS | phụ lục | đếm bản tin trong 60 s, dễ |

Điền cột trạng thái bằng ĐẠT / KHÔNG ĐO ĐƯỢC + lý do. **Không xoá dòng nào** — dòng bị xoá trông như chưa từng định làm.

---

### 24.8 Kịch bản demo 10 phút và checklist

Demo là lúc mọi thứ dễ hỏng nhất: sai thời tiết, Wi-Fi bị chiếm kênh, pin yếu, máy chiếu không nhận. Kịch bản phải có **phương án dự phòng cho từng bước**, chuẩn bị trước chứ không ứng biến tại chỗ.

**Viết vào `docs/demo-script.md`:**

| Phút | Nội dung | Thao tác | Dự phòng |
|---|---|---|---|
| 0:00–1:00 | Giới thiệu bài toán và kiến trúc ba tầng | Một slide sơ đồ khối | — |
| 1:00–2:00 | Khởi động hệ thống | `docker compose up -d mosquitto`, chạy backend, mở web, mở `mqtt_probe.py` ở cửa sổ phụ | Đã chạy sẵn từ trước, chỉ hiện màn hình |
| 2:00–3:00 | Kết nối drone, telemetry lên web | Cấp nguồn, chờ GPS lock, chỉ vào HUD và bản đồ | **Thời tiết xấu / không bay được → chuyển SITL**: `sim_vehicle.py` trong WSL2, mọi thứ còn lại giống hệt |
| 3:00–4:30 | Vẽ và tải lộ trình, cất cánh, chạy Auto | Vẽ 3 waypoint trên web, upload, arm, Auto | SITL như trên |
| 4:30–6:00 | Camera + nhận diện + sự kiện MQTT | Người đi vào khung hình; chỉ vào: khung bao trên video, một ghim trên bản đồ, một dòng trong event log, và **tin tương ứng trong `mqtt_probe.py`** | **Wi-Fi kém / video đứt → phát video đã quay sẵn** ở `docs/bao-cao-iot/phu-luc/demo-fallback.mp4`, nói rõ đây là bản ghi |
| 6:00–7:30 | Vòng QoS thích ứng | Đi xa dần (hoặc bật tải mạng), chỉ vào panel IoT: `jpeg_quality` tự tăng, `bytes_per_s` giảm | Chiếu lại biểu đồ đã ghi từ bảng 1/2/3 |
| 7:30–8:30 | Một bài hỏng hóc trực tiếp: **F3 (đóng trình duyệt)** | Giữ W rồi đóng tab, chỉ vào log `deadman_triggered` và mode → LOITER | Chiếu đoạn video F3 đã quay + trích log |
| 8:30–9:30 | RTL và hạ cánh, log đã lưu | Nhấn RTL, mở thư mục `logs/<session>/` cho xem | SITL |
| 9:30–10:00 | Kết quả chính và hạn chế | Một slide bảng số + một slide hạn chế | — |

**Chọn F3 làm bài demo trực tiếp** vì: không cần bay xa, kết quả nhìn thấy ngay trong 2 giây, và nó thể hiện đúng luật thiết kế quan trọng nhất (web mất quyền thì drone tự về trạng thái an toàn). F4b và F5 **không** demo trực tiếp — rủi ro cao, hiệu quả trình diễn thấp.

**Checklist trước demo (in ra giấy, tick bằng bút):**

```markdown
## T-1 ngày
- [ ] Sạc đầy: 2 pin bay, pin tay phát, laptop, điện thoại
- [ ] Chạy thử toàn bộ kịch bản 1 lần từ đầu đến cuối, bấm giờ
- [ ] Quay sẵn video dự phòng cho bước 4:30-6:00 và 7:30-8:30
- [ ] Kiểm tra SITL chạy được (phương án thời tiết xấu)
- [ ] Xuất báo cáo và slide ra PDF, copy vào USB
- [ ] Kiểm tra param trên FC = 07-final.param, FS_GCS_ENABLE = 0

## T-1 giờ
- [ ] docker compose up -d mosquitto, xác nhận Up
- [ ] Backend chạy, web mở được, mqtt_probe.py chạy ở cửa sổ phụ
- [ ] Hotspot bật, camera stream lên web được
- [ ] Chọn kênh Wi-Fi 1 hoặc 11 (tránh kênh đông)
- [ ] Tạo sẵn logs/<ngày>-demo/ bằng make_session_dir.ps1
- [ ] Kiểm tra gió, xin phép địa điểm, xác định vùng cấm người

## T-5 phút
- [ ] Cánh lắp đúng chiều, siết chặt
- [ ] Pre-arm sạch, GPS >= 12 vệ tinh, HDOP < 1.5
- [ ] Tay phát bật, đúng model, throttle ở dưới cùng
- [ ] Xác nhận ai cầm RC, ai bấm web, ai quay phim
- [ ] Nói trước với người xem: khu vực nào không được đứng
```

---

### 24.9 Dàn ý slide

`docs/slides-iot-outline.md` — dàn ý, không phải file slide. Mỗi mục một slide, mỗi slide **một ý**.

| # | Slide | Nội dung chính |
|---|---|---|
| 1 | Bìa | Tên đề tài, thành viên, môn IoT, ngày |
| 2 | Bài toán | UAV tuần tra phát hiện người; vì sao cần IoT ở đây |
| 3 | Kiến trúc ba tầng | Một sơ đồ: edge (ESP32) → fog (laptop) → application (web + MQTT) |
| 4 | Phần cứng | Ảnh drone thật + bảng linh kiện rút gọn |
| 5 | Giao thức | Bảng 4 topic + QoS + retained, một dòng lý do mỗi mức |
| 6 | Hợp đồng payload | Một ví dụ JSON `uav/events/detection` |
| 7 | **Vòng QoS (đóng góp chính)** | Sơ đồ vòng kín + luật điều khiển |
| 8 | **Kết quả: thông lượng theo `q`** | Bảng 1 dạng biểu đồ cột |
| 9 | **Kết quả: độ trễ theo khoảng cách** | Bảng 2 dạng biểu đồ đường, có thanh sai số |
| 10 | **Kết quả: mất gói theo khoảng cách** | Bảng 3, nhấn điểm "video đứt trước telemetry" |
| 11 | Ma trận hỏng hóc | Bảng 5 dòng, cột kết quả PASS |
| 12 | Demo trực tiếp | Slide trống, chuyển sang màn hình thật |
| 13 | Hạn chế | Liệt kê thật, 5–7 gạch đầu dòng |
| 14 | Kết luận + hướng phát triển | Trả lời câu hỏi ở slide 2 |

**Ba luật trình bày:** slide kết quả phải có **số thật**, không có ảnh chụp bảng mờ; mỗi biểu đồ ghi rõ số lần lặp và điều kiện đo; không có slide nào chỉ toàn chữ quá 6 dòng.

---

### 24.10 Cập nhật tài liệu

Bốn điểm đính chính trong `docs/bao-cao-tong-quan-du-an.md` và một lần viết lại `README.md`.

**Điểm 1 — fps của ESP32-CAM ở VGA.** Dòng ~336 hiện ghi *"ESP32-CAM đạt 15–25 khung/giây ở VGA"*. Số đo thật là **14.19 fps** (nghiên cứu AI §4.2). **Kết luận không đổi** — cần ~2.4 fps để chồng lấn dọc 80% ở 8 m / 3 m/s, nên 14.19 fps vẫn dư biên ~6 lần, và luận điểm "fps không phải nút thắt, chất lượng ảnh mới là" vẫn đúng. Chỉ sửa con số và thêm câu về SVGA (8.25 fps, vẫn dư biên ~3.4 lần).

**Điểm 2 — rủi ro #3 về bản IPEX.** Dòng ~305 và ~830 hiện mô tả sai cơ chế: không có SKU "bản IPEX" riêng. Board AI-Thinker ESP32-CAM tiêu chuẩn **đã có sẵn đế hàn u.FL/IPEX trên mạch** cùng một **điện trở 0 Ω** chọn đường anten; chuyển sang anten ngoài là **thao tác hàn dịch điện trở đó**. Sửa thành: mua board thường (~180.000₫) + anten 2.4 GHz IPEX (~13.000₫) và tự dịch điện trở. Xoá luôn con số giai thoại "32% lên 94% ở 45 m" nếu có — đó **không phải benchmark có đối chứng**.

**Điểm 3 — quy kết đúng số liệu SAHI.** Dòng ~550 ghi SAHI tăng AP **6.8%** / **12.7%** trên VisDrone. Nghiên cứu AI §7 nói rõ: **không có số liệu SAHI + YOLO trên VisDrone được công bố; con số đó là của FCOS.** Sửa thành nêu đúng nguồn: "được báo cáo với FCOS trên VisDrone; **chưa có số liệu công bố cho YOLO**, nhóm phải tự đo."

> Điểm 3 nằm trong §5.5, thuộc phần nội dung Xử lý ảnh mà `plans/ai/ai-phase-04-bao-cao-xla.md` cũng chạm tới. **Phối hợp:** làm mục 24.10 **sau khi** ai-phase-04 hoàn tất, hoặc gộp cả ba đính chính vào một lần sửa duy nhất do một người thực hiện. Hai người sửa cùng file cùng lúc là cách chắc chắn để mất một nửa thay đổi.

**Điểm 4 — bảng topic MQTT.** §7.3 hiện liệt kê `uav/telemetry`, `uav/link`, `uav/detection`, `uav/status`. Bản chốt là bảng ở Phase 23 mục 23.2 (`uav/telemetry`, `uav/events/detection`, `uav/health`, `uav/qos`). Thay bảng cũ bằng bảng mới kèm một dòng ghi chú "đổi ở Phase 23, lý do: gom trạng thái vào một topic retained và tách sự kiện thành nhánh `events/`".

**Viết lại `README.md`** thành bản ngắn (mục tiêu ~120 dòng, thay cho 3808 dòng hiện tại — bản cũ đã chuyển vào `docs/archive/` ở Phase 01):

```markdown
# UAV IoT + Xử lý ảnh — quadcopter tự chế có web GCS và phát hiện người

Trạng thái: v1.0 (ngày), đã bay, đã đo, hai báo cáo đã nộp.

## Làm được gì
(5-7 gạch đầu dòng, mỗi dòng một khả năng đã kiểm chứng)

## Chạy thử trong 5 phút
(lệnh: docker compose up, uv run, pnpm build — đúng thứ tự)

## Cấu trúc repo
(bảng thư mục, mỗi dòng một câu)

## Tài liệu
- Kế hoạch: plans/_phase-index.md (đã xong, lưu trữ ở plans/archive/)
- Sổ tay cho người mới: docs/so-tay/
- Báo cáo IoT: docs/bao-cao-iot/
- Báo cáo Xử lý ảnh: (đường dẫn do luồng AI cung cấp)
- Tổng quan đề tài: docs/bao-cao-tong-quan-du-an.md

## An toàn
Link SAFETY.md + ba luật cứng, in đậm.
```

---

### 24.11 Định nghĩa "dự án đã hoàn thành"

Không dùng tiêu chí "code xong". Dự án hoàn thành khi **một kịch bản duy nhất chạy được từ đầu đến cuối**, và khi hai phần nội dung môn học có đủ sản phẩm. Viết thành checklist trong `plans/PROGRESS.md` và lặp lại ở `docs/bao-cao-iot/08-ket-luan.md`.

**Phần A — kịch bản vận hành đầu-cuối (chạy một lần, có người làm chứng, có quay video):**

```markdown
- [ ]  1. Bật tay phát, cấp nguồn UAV, pre-arm sạch
- [ ]  2. GPS lock >= 12 vệ tinh, HDOP < 1.5
- [ ]  3. Laptop nối telemetry, web hiện UAV đúng vị trí trên bản đồ
- [ ]  4. Camera online, video hiện trên web
- [ ]  5. Bộ nhận diện online (panel IoT báo detector: ok)
- [ ]  6. Arm theo quy trình an toàn, cất cánh, chuyển Loiter
- [ ]  7. Vẽ lộ trình 3 waypoint trên web, kiểm tra hợp lệ, upload
- [ ]  8. Chạy Auto, UAV bay WP1 -> WP2 -> WP3 đúng lộ trình đã vẽ
- [ ]  9. Người đi vào khung hình, hệ thống sinh ĐÚNG MỘT sự kiện
- [ ] 10. Sự kiện có: snapshot, confidence, toạ độ UAV, toạ độ ước lượng của người
- [ ] 11. Sự kiện xuất hiện đồng thời ở: dashboard, event log, và mqtt_probe.py
- [ ] 12. Ghim hiện trên bản đồ kèm vòng tròn sai số
- [ ] 13. Nhấn Hold, UAV dừng tại chỗ
- [ ] 14. Điều khiển WASD từ web một đoạn ngắn
- [ ] 15. Đóng trình duyệt -> dead-man -> Loiter (bài F3 chạy trực tiếp)
- [ ] 16. RC giành lại quyền điều khiển
- [ ] 17. Nhấn RTL, UAV tự quay về và hạ cánh
- [ ] 18. Toàn bộ log được lưu đúng chuẩn logs/YYYYMMDD-sessionN/
```

**Phần B — sản phẩm môn IoT:**

```markdown
- [ ] Bảng 1: thông lượng theo jpeg_quality, 6 mức
- [ ] Bảng 2: độ trễ (3 loại) ở 4 khoảng cách, 3 lần lặp mỗi mốc
- [ ] Bảng 3: mất gói + RSSI ở 4 khoảng cách (hoặc ghi rõ RSSI không đo được + lý do)
- [ ] Vòng QoS chạy được và có bằng chứng tự đổi jpeg_quality trong frames.jsonl
- [ ] Ma trận 5 bài hỏng hóc: đủ 6 dòng (F1, F2, F3, F4a, F4b, F5), mỗi dòng PASS có bằng chứng
- [ ] Bảng đối chiếu 7 thí nghiệm của tổng quan §7.4, cột trạng thái điền đủ
- [ ] Báo cáo docs/bao-cao-iot/ đủ 9 chương, chương 07 (hạn chế) viết thật
- [ ] Slide + demo script + video dự phòng đã sẵn sàng
```

**Phần C — sản phẩm môn Xử lý ảnh:** thuộc `plans/ai/ai-phase-04-bao-cao-xla.md`. Ở đây chỉ để **một ô tick trỏ sang đó**, không liệt kê lại (tránh hai bản sự thật):

```markdown
- [ ] Phần Xử lý ảnh hoàn thành theo checklist của plans/ai/ai-phase-04-bao-cao-xla.md
```

**Luật:** dự án chỉ được tuyên bố hoàn thành khi **cả ba phần** đều tick hết. Không tick hộ, không tick "gần xong".

---

### 24.12 Lưu trữ kế hoạch và viết bài học rút ra

**Bước 1 — lưu trữ plan.** Khi mọi phase đã xong, **di chuyển** (không xoá) các file plan vào `plans/archive/`:

```powershell
New-Item -ItemType Directory -Force plans/archive
Move-Item plans/phase-*.md plans/archive/
Move-Item plans/ai/ai-phase-*.md plans/archive/
```

Giữ nguyên ở `plans/`: `_phase-index.md` (bản đồ, thêm một dòng ghi "đã lưu trữ ngày ..."), `_phase-template.md`, `PROGRESS.md`, `QUYET-DINH-CHUA-CHOT.md` (ghi lại quyết định cuối cùng đã chọn), và `reports/`.

Không sửa nội dung file plan khi di chuyển — chúng là bản ghi lịch sử của việc đã lên kế hoạch thế nào, kể cả những chỗ kế hoạch sai.

**Bước 2 — viết `docs/lessons-learned.md`.** Đây là file có giá trị nhất cho bất kỳ ai làm lại dự án tương tự, và là nguồn tốt cho phần "hướng phát triển" của cả hai báo cáo.

Cấu trúc:

```markdown
# Bài học rút ra

## Những gì kế hoạch nói đúng
(3-5 mục, mỗi mục nói rõ vì sao đúng)

## Những gì kế hoạch nói sai, và thực tế ra sao
(mỗi mục: kế hoạch nói gì -> thực tế thế nào -> lẽ ra nên làm gì)
Ví dụ có thể có: ước lượng thời gian gán nhãn, tầm Wi-Fi thực tế,
số lần phải bay lại vì thiếu log, endpoint firmware không như giả định.

## Những con số phải tự đo (đừng tin tài liệu)
(bảng: đại lượng | tài liệu nói | đo được | chênh)

## Những cái bẫy mất nhiều thời gian nhất
(mỗi mục: triệu chứng -> nguyên nhân thật -> cách phát hiện nhanh)

## Nếu làm lại từ đầu
(thứ tự sẽ làm khác đi, và vì sao)

## Việc còn dang dở
(ghi thật, kèm lý do dừng — không viết "sẽ làm sau")
```

**Bước 3 — chốt `plans/PROGRESS.md`.** Tick hết các dòng Phase 24, tick ba phần A/B/C của mục 24.11, và thêm một dòng cuối:

```markdown
Dự án đóng băng ở v1.0 ngày <ngày>, commit <sha>. Mọi việc phát sinh sau
thời điểm này ghi thành mục mới, không sửa lịch sử các phase đã lưu trữ.
```

---

## Cổng pass

- [ ] `uv run pytest backend/tests/test_qos_controller.py backend/tests/test_link_metrics.py -v` xanh, đủ 5 ca cho controller.
- [ ] Trên bàn: ép băng thông vượt ngưỡng → `mqtt_probe.py` thấy tin `uav/qos` với `reason:"link_degraded"` và `jpeg_quality` tăng đúng `QOS_STEP`.
- [ ] `frames.jsonl` của một phiên bay có **một dòng cho mỗi khung**, mỗi dòng có `jpeg_quality`; số dòng ≈ `fps × thời gian bay` (chênh < 10%).
- [ ] `jpeg_quality` không đổi quá 1 lần / `QOS_MIN_INTERVAL_S` giây (kiểm bằng cách đọc khoảng cách `ts` giữa các lần đổi trong `frames.jsonl`).
- [ ] **Bảng 1** đủ 6 mức `q`, có bytes/khung, bytes/s, fps.
- [ ] **Bảng 2** đủ 4 khoảng cách × 3 loại độ trễ, mỗi ô có p50 và p95, mỗi mốc 3 lần lặp.
- [ ] **Bảng 3** đủ 4 khoảng cách, có loss_pct và số khung rơi (RSSI có thể trống nếu đã ghi rõ lý do không đo được).
- [ ] `docs/test-matrix-hong-hoc.md` có đủ **6 dòng** (F1, F2, F3, F4a, F4b, F5), mỗi dòng ghi PASS + đường dẫn tới cả ba loại bằng chứng + dòng "trả lại gốc".
- [ ] **F3 đã chạy khi bay** (không chỉ bench) và có `.bin` ghi mode → LOITER.
- [ ] Mỗi thư mục `logs/YYYYMMDD-sessionN/` có đủ `flight.bin`, `frames.jsonl`, `events.jsonl`, `detections.csv`, `snapshots/`, `notes.md` đã điền tay.
- [ ] `firmware/ardupilot/params/07-final.param` tồn tại; diff với `06-auto-good.param` giải thích được từng dòng; `FS_GCS_ENABLE = 0`.
- [ ] `git tag -l v1.0` có kết quả; `git status --short` rỗng tại thời điểm tag; `ruff`, `pytest`, `pnpm build` đều xanh ở commit đó.
- [ ] `docs/bao-cao-iot/` có đủ 9 chương; chương 07 liệt kê ≥ 5 hạn chế cụ thể; mọi bảng số ghi kèm điều kiện đo và commit `v1.0`.
- [ ] Bảng đối chiếu 7 thí nghiệm của tổng quan §7.4 điền đủ cột trạng thái, **không xoá dòng nào**.
- [ ] `docs/demo-script.md` có đủ 9 mốc thời gian, mỗi mốc có cột dự phòng; checklist T-1 ngày / T-1 giờ / T-5 phút đã in ra giấy.
- [ ] Video dự phòng đã quay cho hai mốc rủi ro nhất (camera/nhận diện và bài F3).
- [ ] `docs/slides-iot-outline.md` có 14 slide; 4 slide kết quả có số thật.
- [ ] Bốn điểm đính chính ở 24.10 đã sửa xong trong `docs/bao-cao-tong-quan-du-an.md`; `README.md` đã viết lại ngắn.
- [ ] Checklist "dự án đã hoàn thành" (24.11) tick đủ phần A (18 bước) và phần B (8 mục); phần C trỏ sang luồng AI.
- [ ] `plans/archive/` chứa toàn bộ file phase; `plans/_phase-index.md` có dòng ghi ngày lưu trữ; `docs/lessons-learned.md` có đủ 6 mục.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Thời tiết / bãi bay không sẵn làm trượt toàn bộ số liệu đo | 4 | 5 | **20** | Bảng 1 (thông lượng theo `q`) và mọi bài bench F1–F5 làm **không cần bay**, drone đặt trên giá không cánh. Chỉ bảng 2/3 ở các mốc xa và bản "lặp khi bay" của F3/F4a/F5 mới cần bay. Đo bench trước, coi phần bay là bổ sung |
| F3 thất bại khi bay (drone trôi thay vì Loiter) | 2 | 5 | 10 | Bench bắt buộc pass trước; bay ở 5 m, bãi trống, RC trong tay, có người quan sát thứ hai. Thất bại ⇒ hạ cánh ngay, sửa ở Phase 06, không bay tiếp |
| Không lấy được RSSI từ cả ba đường | 3 | 3 | 9 | Vòng QoS chạy bằng 3 đại lượng còn lại; thay RSSI bằng khoảng cách đo bằng thước làm biến độc lập. Ghi rõ "không quan sát được" trong bảng 3 và chương 07, **không bịa số** |
| Firmware camera không có endpoint đổi `quality` lúc chạy | 2 | 5 | 10 | Đọc `firmware/camera/` **trước khi viết code** (24.1 bước 3). Nếu thiếu: tắt `QOS_ENABLED`, vẫn đo được bảng 1 bằng cách nạp lại firmware ở từng mức `q`, và ghi thành một mục trong `lessons-learned.md`. Không tự sửa firmware (Phase 12 sở hữu) |
| Báo cáo viết bằng trí nhớ vì log thiếu | 3 | 5 | **15** | Chuẩn log ở 24.4 áp dụng **từ chuyến bay đầu tiên của phase**; luật "thiếu `flight.bin` hoặc `frames.jsonl` ⇒ chuyến bay không tính"; kiểm tra bằng script ngay tại bãi trước khi ra về |
| Hai người cùng sửa `docs/bao-cao-tong-quan-du-an.md` (24.10 và ai-phase-04) | 3 | 3 | 9 | Ghi rõ ở 24.10: làm sau ai-phase-04, hoặc gộp ba đính chính thành một lần sửa do một người thực hiện |
| Mốc 80 m không đo được vì bãi ngắn | 3 | 2 | 6 | Ghi "không đo được, giới hạn địa điểm" vào bảng 3 và chương 07. Đây là hạn chế trung thực, không phải thất bại. Thử tìm bãi dài hơn trước khi kết luận |
| Đồng hồ ESP32 trôi làm độ trễ khung ảnh sai | 3 | 2 | 6 | Đo độ trôi bằng cách so `ts` ESP32 với đồng hồ laptop ở đầu và cuối phiên; báo cáo cả độ trôi. Độ trễ MQTT (cùng máy) là con số sạch để đối chiếu |
| Demo hỏng tại chỗ (Wi-Fi bị chiếm kênh, thời tiết) | 4 | 3 | 12 | Mỗi mốc trong kịch bản 24.8 có cột dự phòng; SITL thay drone thật; video quay sẵn thay stream trực tiếp; chạy thử trọn vẹn một lần vào T-1 ngày |
| `pnpm build` hoặc `pytest` hỏng ngay lúc định tag `v1.0` | 3 | 2 | 6 | Chạy cả bốn lệnh kiểm tra ở 24.6 bước 1 **trước** khi tag; tag chỉ trỏ tới trạng thái build được |
| Pin không đủ cho nhiều mốc đo trong một buổi | 3 | 3 | 9 | Mỗi mốc 3 lần × 60 s là ~5 phút bay; 4 mốc ≈ 20 phút bay ròng, cần tối thiểu 3 pin. Sạc đủ từ tối hôm trước; gom bài bench vào lúc chờ sạc |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 24.1 Vòng QoS: đo link, luật điều khiển, ghi `frames.jsonl`, test | 5 | Toàn bộ làm trên bàn; gồm 1 h đọc firmware xác định endpoint |
| 24.2 Ba bảng thí nghiệm IoT ở 4 khoảng cách | 6 | 2 h bench (bảng 1) + 4 h ngoài bãi (bảng 2, 3) |
| 24.3 Ma trận 5 bài test hỏng hóc | 7 | 4 h bench không cánh + 3 h lặp lại khi bay |
| 24.4 Chuẩn thư mục log + script tạo session | 2 | Làm **trước** buổi bay đầu tiên của phase, không làm sau |
| 24.5 Chốt `07-final.param` + diff giải thích | 1 | Sau khi mọi bài test xong |
| 24.6 Đóng băng mã nguồn, tag `v1.0` | 2 | Gồm thời gian sửa lỗi lint/build phát sinh |
| 24.7 Báo cáo môn IoT (9 chương) | 8 | Phần dài nhất; viết dần song song với đo, không dồn cuối |
| 24.8 Kịch bản demo + checklist + quay video dự phòng | 3 | Gồm 1 h chạy thử trọn vẹn |
| 24.9 Dàn ý slide | 3 | |
| 24.10 Đính chính tài liệu + viết lại README | 3 | Phối hợp thời điểm với `plans/ai/ai-phase-04` |
| 24.11 Checklist định nghĩa hoàn thành + chạy kịch bản A | 2 | Kịch bản 18 bước chạy một lần, quay video |
| 24.12 Lưu trữ plan + `lessons-learned.md` | 2 | Việc cuối cùng của dự án |
| **Tổng** | **44** | Đường găng: 24.1 → 24.2 → 24.3 → 24.5 → 24.6 → 24.7 → 24.11 |

**Thứ tự khuyến nghị:** làm 24.4 (chuẩn log) **đầu tiên**, trước cả 24.1 — nếu không, những chuyến bay đầu của phase sẽ thiếu log và phải bay lại. Sau đó 24.1 trên bàn, rồi gom **hai buổi ra bãi**: buổi 1 cho bảng 2/3 (24.2) và buổi 2 cho các bài test bay (24.3) + kịch bản 18 bước (24.11). Viết báo cáo (24.7) chạy song song từ sau buổi bay thứ nhất, đừng đợi có đủ số liệu mới bắt đầu viết.

## Ghi chú cho sổ tay

Những khái niệm phase này cần giải thích cho người chưa biết gì (để agent viết `docs/so-tay/24-iot-qos-hong-hoc.md` sau):

- **Vì sao `jpeg_quality` số nhỏ lại là ảnh đẹp** — bẫy trực giác, nhắc lại và in đậm.
- **Vòng điều khiển kín (closed loop) là gì** — ví von điều hoà / YouTube tự giảm nét; vẽ sơ đồ đo → so ngưỡng → tác động → đo lại.
- **Hysteresis (trễ)** — vì sao không dùng chung một ngưỡng cho cả tăng lẫn giảm, và điều gì xảy ra nếu bỏ nó.
- **Vì sao tăng chất lượng ảnh khi bộ nhận diện "không chắc"** — khác biệt giữa điều khiển theo băng thông và điều khiển theo phản hồi của tác vụ.
- **Bậc cấp phát bộ đệm của `esp32-camera`** — vì sao đổi `q` trong cùng một bậc có thể không thấy tác dụng.
- **Ba loại độ trễ khác nhau** — và vì sao không đo được (và không cần đo) độ trễ tới lúc motor phản ứng.
- **Vì sao đồng hồ hai máy lệch nhau làm hỏng phép đo độ trễ** — NTP làm gì, và vì sao vẫn trôi.
- **p50 và p95 là gì, vì sao không dùng trung bình** — một lần trễ 2 giây kéo trung bình lệch hẳn.
- **Vì sao phải lặp 3 lần mỗi phép đo** — một con số đơn lẻ không có độ tin cậy.
- **Failsafe: GCS failsafe vs RC failsafe** — vì sao RC là dây cứu sinh còn Wi-Fi thì không.
- **Vì sao bench không cánh trước, bay sau** — chi phí của một lần sai ở hai trường hợp khác nhau thế nào.
- **Dead-man switch** — ví von cần gạt trên đầu máy xe lửa: buông tay là tàu tự dừng.
- **Vì sao "video đứt trước telemetry" là dự đoán chứ không phải lỗi** — băng thông của hai luồng chênh nhau bao nhiêu lần.
- **Vì sao chương "hạn chế" làm tăng điểm** — phân biệt báo cáo trung thực với báo cáo nghe hoàn hảo.
- **Tag git là gì và vì sao báo cáo phải ghi commit SHA** — số liệu phải truy ngược được về đúng bản code sinh ra nó.
