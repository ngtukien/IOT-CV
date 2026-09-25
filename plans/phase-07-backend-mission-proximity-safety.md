# Phase 07: Backend — mission, proximity, safety state machine, REST

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 06 (control + dead-man), Phase 04 (rangefinder ảo + AVOID đã chạy trên SITL) | ~14 giờ | Không |

## Mục tiêu

Hoàn thiện backend: nạp mission waypoint xuống flight controller và chạy AUTO; đọc khoảng cách vật cản và suy ra trạng thái AVOID; gom toàn bộ phản ứng an toàn vào **một** bảng trạng thái có lý do rõ ràng; phơi các endpoint REST cho web; và khoá chất lượng bằng coverage ≥ 80% cho nhóm safety + mission.

Xong phase này, backend đã **đủ tính năng** — Phase 08–10 chỉ còn dựng giao diện lên trên nó. Đây cũng là phase tạo **nguồn video giả** để Phase 10 dựng panel video mà chưa cần camera thật (camera thật ở Phase 17, bộ nhận diện thật ở `plans/ai/`).

## Đầu vào cần có

**Phải đọc trước:**

- `SAFETY.md` mục 1, 3, 4, 8, 9 — đặc biệt mục 8: *"Geofence phần mềm ở website chỉ là lớp phụ; ArduPilot geofence mới là lớp authoritative"*.
- `plans/phase-05-backend-mavlink-telemetry.md` mục **"Hợp đồng WebSocket"** — SSOT. Phase 07 hiện thực `cmd.mission.upload` và các trường proximity đã khai báo sẵn ở đó.
- `plans/phase-06-backend-dieu-khien-deadman.md` **§6.6** — danh sách hàm cấm (canonical; Phase 07 chỉ quét lại, không chép lại).
- `plans/reports/260921-research-web-gcs-stack.md` §1.2 — mission protocol `MISSION_COUNT → MISSION_REQUEST_INT → MISSION_ITEM_INT → MISSION_ACK`, item phải đến **đúng thứ tự**, sai thứ tự bị drop.
- `params/obstacle-avoidance-tfminiplus-serial3.param` — lấy ngưỡng thật: `AVOID_MARGIN=2`, `AVOID_DIST_MAX=5`, `RNGFND1_MAX=6`, `AVOID_ENABLE=3`, `OA_TYPE=0`.
- `plans/phase-04-param-va-tranh-vat-can-ao.md` — rangefinder ảo đã bật trên SITL ở đó; Phase 07 chỉ **tiêu thụ** dữ liệu, không thiết lập lại.

### Hiện trạng code (prior art)

Phạm vi đã tìm: `backend/mavlink/mission.py`, `backend/vision/*.py`, `backend/app.py`, `backend/tests/*.py`.

| File | Đang có gì | Phase 07 làm gì |
|---|---|---|
| `backend/mavlink/mission.py` (131 dòng) | `validate_mission()` **đã chạy** với **6 luật** (không có waypoint · alt thấp hơn `MIN_ALT` · alt vượt `MAX_ALT` · xa home quá `MAX_DISTANCE_HOME` · toạ độ invalid gồm cả `(0,0)` và NaN/Inf · quá `MAX_WAYPOINTS`); `haversine_m()` đã chạy; `Waypoint` là `@dataclass(frozen=True)` với `seq/lat/lon/alt`; `MissionManager.upload/download/clear/start` **đều `NotImplementedError`** (nhưng `upload` đã gọi `validate_mission` và `raise ValueError` trước khi tới chỗ chưa làm — giữ nguyên thứ tự đó) | Thêm 2 luật, implement 4 method (7.1–7.5) |
| `backend/tests/test_mission_validation.py` (71 dòng) | 6 test đang xanh cho 6 luật trên, dùng `HOME = (10.762622, 106.660172)` và helper `_wp()` | Giữ nguyên; thêm test cho 2 luật mới |
| `backend/vision/stream.py` (29 dòng) | `CameraStream.frames()` là `NotImplementedError`; docstring ghi "bắt đầu 640x480" (báo cáo §4.1 khuyên **320×240** vì 44 fps thay vì 14 fps) | **Điền thân**: parser MJPEG thủ công giữ khung mới nhất + endpoint proxy fan-out, không phụ thuộc nguồn cụ thể (7.8.2) |
| `backend/vision/detector.py`, `events.py` | `NotImplementedError` cả hai | **KHÔNG SỬA** — chủ sở hữu chốt ở phase khác, ngoài phạm vi phase-07 |
| `backend/api.py` (tạo ở Phase 05) | Có `/api/health`, `/api/status` | Thêm 4 endpoint (7.8) |
| `backend/mavlink/safety.py` | Sau Phase 06 có thêm `deadman_tripped`, `last_zero_velocity_reason` | Thêm phản ứng cho link lost / EKF (7.7) |

> Không có file proximity nào tồn tại: `grep -ril "DISTANCE_SENSOR\|OBSTACLE_DISTANCE" backend/` → **0 kết quả** trên toàn `backend/`. Đây là phần duy nhất thật sự mới.

## File và thư mục sở hữu

**Sửa:**

- `backend/mavlink/mission.py`
- `backend/mavlink/telemetry.py` (nối proximity vào `update_state`)
- `backend/mavlink/safety.py` (thêm phản ứng, không đổi hàm cũ)
- `backend/vision/stream.py` (điền thân: parser MJPEG thủ công giữ khung mới nhất + endpoint proxy fan-out, xem 7.8.2)
- `backend/api.py`
- `backend/ws.py` (handler `cmd.mission.upload`)
- `backend/config.py`, `.env.example`
- `backend/tests/test_mission_validation.py` (chỉ **thêm** test)
- `pyproject.toml` (thêm `pytest-cov` vào nhóm `dev`)

**Tạo mới:**

- `backend/mavlink/proximity.py`
- `backend/vision/fake_stream.py` (nguồn MJPEG giả lặp video + box giả, xem 7.8.3)
- `backend/vision/assets/sample-clip.mp4` (video mẫu ngắn cho `fake_stream.py`)
- `backend/tests/test_mission_upload.py`
- `backend/tests/test_proximity.py`
- `backend/tests/test_safety_state_machine.py`
- `backend/tests/test_mjpeg_parser.py`
- `docs/hop-dong-mjpeg.md` (hợp đồng header MJPEG — SSOT, xem 7.8.4)
- `plans/samples/mission-4wp.json`
- `docs/so-tay/07-backend-mission-proximity-safety.md`

**Không đụng:** `frontend/**` · `backend/mavlink/control.py` · `backend/mavlink/deadman.py` · `backend/vision/detector.py` · `backend/vision/events.py` (chủ sở hữu hai file này chốt ở phase khác, ngoài phạm vi phase-07).

---

## Việc theo thứ tự

### 7.1 Bổ sung luật validate

`validate_mission()` đã có 6 luật. Thêm **2 luật** nữa — vẫn là hàm thuần, vẫn test được không cần drone:

| # | Luật mới | Vì sao |
|---|---|---|
| 7 | **Item đầu phải là `NAV_TAKEOFF` (16→22)** | Copter **không** tự cất cánh trong AUTO. Thiếu takeoff thì mission "chạy" mà máy bay nằm im — người mới chắc chắn tưởng code hỏng |
| 8 | **Item cuối phải là `NAV_RETURN_TO_LAUNCH` (20) hoặc `NAV_LAND` (21)** | Mission kết thúc giữa trời thì Copter treo tại waypoint cuối cho tới khi hết pin |

Để làm được, `Waypoint` cần thêm trường `command: int = 16` (`MAV_CMD_NAV_WAYPOINT`). Đặt **giá trị mặc định** để 6 test hiện có trong `test_mission_validation.py` **không phải sửa một dòng nào** — đó là kiểm chứng rằng bạn mở rộng chứ không phá.

> **Đính chính sau khi làm (25/09/2026).** Giá trị mặc định KHÔNG đủ: bốn test cũ khẳng định `== []` hoặc `len(errors) == 4` với mission **chỉ có** NAV_WAYPOINT, nên nhét luật 7/8 vào `validate_mission` là làm chúng đỏ. Hai luật cấu trúc nằm ở `validate_mission_structure()`; đường upload chạy cả hai qua `validate_for_upload()`. Test cũ giữ nguyên từng dòng.
>
> Hợp đồng WebSocket cũng phải đổi: `MissionWaypoint` của Phase 05 chỉ có `seq/lat/lon/alt`, nên luật 7/8 không có gì để kiểm. Đã thêm `command` (mặc định 16, danh sách trắng 16/20/21/22) theo đúng thứ tự plan Phase 05 → `schemas.py` → `ws-contract.schema.json`.

Backend **không** tự chèn takeoff/RTL còn thiếu. Nó trả `validation_failed` và để người sửa (hợp đồng Phase 05 ghi rõ). Lý do: tự chèn nghĩa là tự quyết độ cao cất cánh và tự quyết máy bay sẽ về đâu — hai quyết định thuộc về người, không thuộc về phần mềm.

**Geofence phần mềm chỉ là lớp phụ.** `MAX_DISTANCE_HOME` và `MAX_ALT` ở đây bắt lỗi *gõ nhầm*, chúng **không** thay thế `FENCE_*` trên FC (`SAFETY.md` mục 8). Ghi câu này vào docstring của `validate_mission` để phase sau khỏi hiểu nhầm.

---

### 7.2 Dựng danh sách mission item

ArduPilot coi item `seq = 0` là **HOME**. Quy ước triển khai:

| seq | Nội dung | `frame` |
|---|---|---|
| 0 | Bản sao HOME (`NAV_WAYPOINT`, toạ độ home, alt 0) — FC ghi đè, nhưng phải có mặt để các seq sau khớp | `MAV_FRAME_GLOBAL (0)` |
| 1 | `NAV_TAKEOFF`, `param7 = alt` | `MAV_FRAME_GLOBAL_RELATIVE_ALT_INT (6)` |
| 2..n-1 | `NAV_WAYPOINT` của người dùng | `6` |
| n | `NAV_RETURN_TO_LAUNCH` hoặc `NAV_LAND` | `6` |

`lat`/`lon` trong `MISSION_ITEM_INT` là **số nguyên nhân 1e7**; `alt` là **float mét**. Dùng `frame = 6` nghĩa là alt tính **so với home** — khớp với `relative_alt` mà HUD đang hiển thị. Dùng nhầm `frame = 0` (AMSL) là lý do số một khiến Mission Planner hiện độ cao gấp nhiều lần mong đợi.

> **Đã xác minh 25/09/2026** (ArduCopter 4.7.1 SITL + Mission Planner 1.3.83 Read WPs): gửi ô home ở seq 0 là ĐÚNG — MP đọc ra đúng TAKEOFF + 4 WAYPOINT + RTL, không lệch dòng. Ảnh: `docs/so-tay/anh/07-mp-read-wps.png`.
>
> *(ghi chú gốc)* chi tiết "có phải gửi item seq 0 hay không" khác nhau giữa các bản ArduPilot và giữa các GCS.
> **Cách kiểm chứng (bắt buộc làm ở 7.5, không để cuối phase):** upload 4 waypoint từ backend → Mission Planner → Flight Plan → **Read WPs**. Đúng 4 điểm đúng vị trí = quy ước trên đúng. Lệch **một dòng** = bỏ item seq 0 và gửi `MISSION_COUNT = n`. Đây là lý do dùng Mission Planner làm **oracle độc lập** thay vì tin lời backend tự nói về mình.

---

### 7.3 State machine upload

```text
GCS -> MISSION_COUNT(count, MAV_MISSION_TYPE_MISSION=0)
FC  -> MISSION_REQUEST_INT(seq=i)      (bản cũ có thể gửi MISSION_REQUEST — phải nhận CẢ HAI)
GCS -> MISSION_ITEM_INT(seq=i, ...)
...lặp...
FC  -> MISSION_ACK(type=MAV_MISSION_ACCEPTED=0)
```

Yêu cầu hiện thực, từng điểm một:

1. **Trả lời theo `seq` mà FC hỏi**, tuyệt đối không theo bộ đếm của mình. FC có quyền hỏi lại một seq đã gửi (gói rớt); đáp bằng bộ đếm riêng sẽ lệch **toàn bộ** mission từ điểm đó trở đi. Đây là lỗi kinh điển.
2. **Timeout 2 s** mỗi lần chờ `MISSION_REQUEST_INT`, thử lại tối đa **3 lần** (gửi lại `MISSION_COUNT`), rồi `error` code `timeout`.
3. `MISSION_ACK` khác `0` → dịch mã sang tiếng Việt rồi trả `command_denied`:

   | Mã | Tên | Nghĩa dễ hiểu |
   |---|---|---|
   | 1 | `MAV_MISSION_ERROR` | FC từ chối, không nói rõ lý do |
   | 2 | `UNSUPPORTED_FRAME` | Sai `frame` (xem 7.2) |
   | 3 | `UNSUPPORTED` | Lệnh này Copter không hỗ trợ |
   | 4 | `NO_SPACE` | Vượt số waypoint FC chứa được |
   | 5 | `INVALID` | Tham số item sai |
   | 10 | `INVALID_SEQUENCE` | Gửi sai thứ tự — xem điểm 1 |
   | 13 | `OPERATION_CANCELLED` | Bị GCS khác cắt ngang |

4. **Mission cũ chỉ bị thay sau khi nhận ACK thành công.** Trước đó `MissionManager.current` không đổi. Upload hỏng giữa chừng không được để lại trạng thái nửa vời trong backend.
5. Suốt phiên upload, phát `event` `mission.progress` với `detail = {"sent": i, "total": n}` — Phase 09 vẽ thanh tiến độ từ đó.
6. Phiên upload phải **độc quyền**: đang upload mà có lệnh upload thứ hai → `error` `command_denied`. Hai phiên chồng nhau làm FC nhận item của cả hai mission.

---

### 7.4 Đọc lại (readback) — và vì sao bắt buộc

Sau ACK, tự động chạy `download()`:

```text
GCS -> MISSION_REQUEST_LIST
FC  -> MISSION_COUNT(n)
GCS -> MISSION_REQUEST_INT(i)   -> FC -> MISSION_ITEM_INT(i)     (lặp)
GCS -> MISSION_ACK
```

So khớp với những gì vừa gửi: toạ độ lệch ≤ `1e-7` độ, alt lệch ≤ 0.1 m, `command` phải trùng. Lệch → `event` mức `error` + `status.mission.source` giữ nguyên `"local"`.

**Chỉ mission đã đọc-lại-được mới lên UI** (`mission.source = "readback"`). UI **không bao giờ** hiển thị "mission tôi *nghĩ* là mình đã gửi". Nguyên tắc chung: khi có thể hỏi lại nguồn sự thật, đừng hiển thị bản sao trong bộ nhớ mình.

---

### 7.5 Chạy AUTO + đối chiếu Mission Planner

Điều kiện đủ, kiểm theo thứ tự: đã upload + readback khớp → `armed == True` → `set_mode("AUTO")` → gửi `MAV_CMD_MISSION_START` (id 300). Chưa armed thì `error` `validation_failed` — **không** tự arm (arm là quyết định của người).

- Lệnh chạy:

  ```powershell
  uv run pytest backend/tests/test_mission_upload.py -v
  uv run python scripts/ws_probe.py --send-mission plans/samples/mission-4wp.json
  ```

- Kết quả mong đợi: pytest xanh; `ws_probe` in
  `ack {"command":"cmd.mission.upload","status":"done","detail":{"count":6,"readback_ok":true}}`.
  **Rồi mở Mission Planner → Flight Plan → Read WPs**: thấy đúng takeoff + 4 waypoint + RTL, đúng toạ độ, đúng độ cao.
- Nếu lỗi:
  - *FC không gửi `MISSION_REQUEST_INT` nào* — gần như luôn do sai `target_system`/`target_component` trong `MISSION_COUNT`: phải là của **FC** (1/1), không phải của backend (254/190).
  - *`MAV_MISSION_INVALID_SEQUENCE`* — đang gửi theo bộ đếm riêng thay vì theo seq FC hỏi (7.3 điểm 1).
  - *Mission Planner hiện lệch một dòng* — đúng điều đã cảnh báo ở 7.2. Bỏ item seq 0.
  - *Alt trong MP gấp nhiều lần mong đợi* — nhầm `frame`, đang dùng `0` (AMSL) thay vì `6` (so với home).
  - *Upload xong nhưng AUTO không chạy* — chưa armed, hoặc mission thiếu `NAV_TAKEOFF` (luật 7 ở 7.1 sinh ra chính để chặn việc này).

---

### 7.6 Proximity / rangefinder và trạng thái AVOID

Tạo `backend/mavlink/proximity.py`. SITL chưa có TFmini thật — Phase 04 đã bật rangefinder ảo, Phase 07 chỉ **đọc**.

**7.6.1 — `DISTANCE_SENSOR` (id 132).**
Trường dùng: `current_distance` (**cm** → chia 100 ra mét), `min_distance`, `max_distance` (cm), `orientation` (`MAV_SENSOR_ROTATION`, `0` = nhìn thẳng trước), `id`.
Chỉ lấy cảm biến `orientation == 0` cho `obstacle_distance`.
Giá trị `>= max_distance` hoặc `<= min_distance` nghĩa là **không đọc được**, **không phải** "rất xa / rất gần" → trả `None`. Nhầm chỗ này làm UI hiện "0.0 m" khi thật ra là mù — nguy hiểm hơn hiện "không biết".

**7.6.2 — `OBSTACLE_DISTANCE` (id 330).**
Mảng `distances[72]`, đơn vị **cm**, giá trị `65535` (`UINT16_MAX`) = cung đó không có dữ liệu. `increment` là độ mỗi cung, `angle_offset` là lệch so với mũi.
Gộp 72 cung xuống **8 cung 45°** cho UI: lấy `min` mỗi nhóm, bỏ qua giá trị vô hiệu; nhóm toàn vô hiệu → `None`. Kết quả là `obstacle_sectors[8]`, index 0 = mũi, tăng theo chiều kim đồng hồ.

> Với phần cứng thật, ta chỉ có **một** tia TFmini Plus nhìn thẳng trước (góc 3.6°), nên **71/72 cung luôn trống**. `obstacle_sectors` gần như chỉ có index 0 có số. Đó là sự thật của hệ thống, UI phải thể hiện đúng chứ không vẽ vòng tròn đầy đủ gây hiểu lầm (Phase 10 §10.4).

**7.6.3 — `STATUSTEXT` (id 253).**
Đã đẩy thành `event` từ Phase 05. Ở đây thêm khớp regex để nhận ra avoidance.

> **Đã đo 25/09/2026** (`scripts/sitl/run_proximity_probe.py`): **0 dòng** STATUSTEXT suốt chặng LOITER bị AVOID phanh lẫn chặng GUIDED — AC_Avoid phanh im lặng. Bảng regex để rỗng là đáp án đúng, không phải tạm thời. Cùng lần đo: SITL phát `DISTANCE_SENSOR` từ **một** nguồn (id 10, orientation 0, min 10 cm, max 600 cm), **không** có `OBSTACLE_DISTANCE`; bit sức khoẻ có mặt là `PROXIMITY` (0x4000000), còn `LASER_POSITION` (0x100) **không có mặt** — lấy sức khoẻ từ bit "rangefinder" hiển nhiên thì `avoid_state` luôn UNKNOWN.
>
> *(ghi chú gốc)* chuỗi STATUSTEXT chính xác mà ArduCopter 4.7.1 phát khi AVOID kích hoạt.
> **Cách kiểm chứng ở 7.6.5:** cho SITL bay Loiter vào vật cản ảo, ghi **toàn bộ** STATUSTEXT vào `logs/statustext-sitl.txt`, rồi điền bảng regex trong `proximity.py`.
> Cho tới khi có dữ liệu thật: **để bảng regex rỗng** và chỉ dùng cách suy ở 7.6.4. Không đoán chuỗi.

**7.6.4 — `avoid_state`.** Bốn giá trị, ngưỡng lấy từ file param thật (không hardcode trong code — đọc từ `config.py`):

| Giá trị | Điều kiện | Ý nghĩa cho UI |
|---|---|---|
| `OFF` | Có số đo và d > `AVOID_DIST_MAX_M` (5 m) | Trống trải |
| `NEAR` | `AVOID_MARGIN_M` (2 m) < d ≤ `AVOID_DIST_MAX_M` (5 m) | Sắp tới vùng FC bắt đầu can thiệp |
| `ACTIVE` | d ≤ `AVOID_MARGIN_M` (2 m) **và** mode ∈ {`LOITER`, `ALT_HOLD`, `POSHOLD`} | FC đang phanh/lùi |
| `UNKNOWN` | Số đo cũ hơn `PROXIMITY_STALE_S` (2 s), hoặc `rangefinder_healthy == False` | Đang mù — **khác** với "không có vật cản" |

> **Đính chính sau nghiệm thu SITL (25/09/2026).** FC chỉ gửi `DISTANCE_SENSOR` khi có vật **trong tầm**: cách cột 23 m, bit PROXIMITY khoẻ suốt mà không có số đo nào. Theo bảng trên, trời trống sẽ luôn báo `UNKNOWN`, trái với chính ý của cột "Ý nghĩa". Đã sửa: **khoẻ mà im lặng → `OFF`**; `UNKNOWN` chỉ khi bit sức khoẻ tắt, hoặc số đo mới nhất là số rác ở đầu dưới tầm. Số đo cũ hơn 2 s vẫn bị che thành `null` (không hiện con số đứng im). Chi tiết: `backend/mavlink/proximity.py` khối ĐÃ ĐO, sổ tay 07 mục 7.

> **Vì sao `ACTIVE` đòi thêm điều kiện mode:** `AVOID_ENABLE=3` (AC_Avoid) **chỉ chạy** ở Loiter / AltHold / PosHold. Ở `AUTO` / `GUIDED` / `RTL`, việc tránh thuộc về Object Avoidance Path Planner — mà `OA_TYPE=0` (đang **tắt**, có chủ ý: một tia 3.6° nhìn thẳng sẽ khiến BendyRuler lách sang hướng nó chưa có dữ liệu).
> Nghĩa là **ở AUTO và GUIDED, hệ thống KHÔNG tránh vật cản.** `avoid_state` tối đa là `NEAR`, và UI **phải nói rõ điều này** (Phase 10 §10.4) chứ không để người dùng tưởng mình được bảo vệ. Một panel im lặng ở đây là một lời nói dối về an toàn.

**7.6.5 — thêm vào `config.py`** và đưa cả 4 vào `safety_limits()` để `status.limits` gửi xuống UI:

```python
AVOID_MARGIN_M     = _env_float("AVOID_MARGIN_M", 2.0)   # = AVOID_MARGIN trong param
AVOID_DIST_MAX_M   = _env_float("AVOID_DIST_MAX_M", 5.0) # = AVOID_DIST_MAX
RANGEFINDER_MAX_M  = _env_float("RANGEFINDER_MAX_M", 6.0)# = RNGFND1_MAX
PROXIMITY_STALE_S  = _env_float("PROXIMITY_STALE_S", 2.0)
```

- Cấu hình SITL rangefinder/proximity **đã xong ở `plans/phase-04-param-va-tranh-vat-can-ao.md` §04.5**, snapshot lưu tại `firmware/ardupilot/params/sitl/02-sitl-avoid.param`. Phase 07 chỉ **đọc** dữ liệu do cấu hình đó sinh ra — không đặt lại tham số ở đây. Nếu SITL của bạn chưa có proximity, quay lại Phase 04 nạp đúng snapshot đó thay vì gõ tay giá trị khác.

  ```powershell
  uv run python scripts/ws_probe.py --filter telemetry --field obstacle_distance,avoid_state,rangefinder_healthy --count 60
  ```

- Kết quả mong đợi: `obstacle_distance` hiện số mét thay đổi khi bay lại gần vật cản ảo; `avoid_state` chuyển `OFF → NEAR → ACTIVE` khi vào trong 2 m **ở Loiter**.
- Nếu lỗi:
  - *`obstacle_distance` luôn `null`* — chưa `SET_MESSAGE_INTERVAL` cho message 132/330 (Phase 05 §5.1.4), hoặc `PRX1_TYPE` chưa đặt. Kiểm nhanh trong MAVProxy: `status DISTANCE_SENSOR`.
  - *Có số nhưng `avoid_state` không lên `ACTIVE` ở GUIDED* — **đúng như thiết kế** (7.6.4), không phải bug.
  - *`obstacle_distance` = 0.0 thay vì `null` khi mù* — đang bỏ qua ngưỡng `min/max_distance` (7.6.1).

---

### 7.7 Máy trạng thái an toàn

Gom toàn bộ phản ứng của backend vào **một** bảng. Hiện thực trong `safety.py`; logic cũ giữ nguyên, chỉ thêm.

| Sự kiện | Backend **LÀM** | Backend **KHÔNG LÀM** |
|---|---|---|
| Mất link MAVLink (> `LINK_TIMEOUT_S` không heartbeat) | `connected=False`; `disable_web_control()`; ghi `deadman.jsonl` reason `link_lost`; `event` mức `error`; reconnect backoff | Không gửi RTL/LAND — **gửi vào đâu?** Link đã mất |
| WebSocket đóng | Gửi zero-velocity **ngay** (Phase 06 §6.4.3); `disable_web_control()`; `event` mức `warn` | Không đổi mode, không disarm |
| Dead-man hết hạn (trình duyệt treo) | Gửi zero-velocity; `deadman_tripped=True`; `event` mức `warn` | **Không** thu hồi quyền — operator gõ tiếp là lái lại được ngay |
| Phi công gạt RC ra khỏi GUIDED | `on_mode_change()` → `disable_web_control()` tức thì; `event` mức `info` | **Không** ép quay lại GUIDED. RC có quyền cao nhất (`SAFETY.md` mục 4) |
| EKF/AHRS không khoẻ, hoặc `gps_fix_type < 3` | Từ chối `cmd.arm`, `cmd.takeoff`, `cmd.mission.upload` với `validation_failed`; `event` mức `warn`; UI hiện cảnh báo | Không disarm, không đổi mode, **không** sửa param để "cho nó qua" |
| `battery_remaining < 25%` | `event` mức `warn` | Không tự RTL |
| Operator tắt WEB CONTROL | Gửi zero-velocity, reason `operator_disabled` | Không đổi mode |
| Mất camera / bộ nhận diện crash | `camera.available=false` trong `status`; `event` mức `warn` | **Không ảnh hưởng gì tới telemetry và control** (`SAFETY.md` mục 9) |

#### Vì sao backend KHÔNG BAO GIỜ tự đổi flight mode

Đây là quyết định kiến trúc, không phải sự lười. Năm lý do, viết nguyên văn vào sổ tay:

1. **ArduPilot đã có failsafe, và nó nằm đúng chỗ.** `FS_GCS_ENABLE`, `FS_EKF_ACTION`, battery failsafe chạy **trên FC** — nơi vẫn hoạt động khi Wi-Fi chết, laptop sập, backend crash. Failsafe đặt ở backend chỉ bảo vệ được đúng những tình huống mà backend còn sống, tức là những tình huống **ít nguy hiểm nhất**. Đặt lớp bảo vệ ở nơi nó hỏng cùng lúc với thứ nó bảo vệ là vô nghĩa.
2. **Hai tác nhân tự quyết sinh tranh chấp.** Backend gửi `RTL` trong khi phi công vừa gạt sang `LOITER` để né cái cây → máy bay làm theo lệnh đến sau, mà không ai đoán được lệnh nào đến sau.
3. **Rớt Wi-Fi 2.4 GHz vặt vãnh là chuyện bình thường.** Báo cáo tổng thể §6 đã ghi, và các chuyến bay đầu đặt `FS_GCS_ENABLE=0` chính vì vậy. Một backend tự kích RTL mỗi lần rớt gói sẽ **tự tạo ra tai nạn từ một sự cố vô hại**.
4. **Zero-velocity KHÔNG phải là đổi mode.** Nó là việc backend *rút lại lệnh do chính nó phát ra*. Rút xong, GUIDED tự giữ vị trí bằng vòng điều khiển của FC. Đây chính là lý do zero-velocity được phép mà RTL thì không: một bên là **ngừng can thiệp**, bên kia là **can thiệp thêm**.
5. **RC là dây cứu sinh** (`SAFETY.md` mục 4). Mọi thiết kế phải giữ được: khi mọi thứ hỏng, người cầm RC vẫn giành lại được máy bay. Backend tự đổi mode làm giả định đó yếu đi.

Viết test cho bảng trên trong `test_safety_state_machine.py` — mỗi dòng một test, **đặc biệt là cột "KHÔNG LÀM"**: khẳng định `FakeMAVLink.sent` **không** chứa lệnh đổi mode sau khi bơm sự kiện mất link / pin thấp / EKF hỏng. Cột "không làm" chính là phần dễ bị vi phạm nhất bởi một lập trình viên có thiện chí.

---

### 7.8 REST endpoints

REST dùng cho **request/response** (mở trang, đọc cấu hình). Telemetry và lệnh lái đi bằng WebSocket. Mọi endpoint trả JSON theo model pydantic trong `schemas.py` — không tự dựng `dict` rời rạc.

| Method | Đường dẫn | Trả về | Ghi chú |
|---|---|---|---|
| GET | `/api/health` | `{status, version}` | Giữ nguyên, có test |
| GET | `/api/status` | **Y hệt** `data` của message `status` trong hợp đồng | Một schema, hai đường vận chuyển. Lệch nhau là bug |
| GET | `/api/config` | `{limits, endpoint, telemetry_hz, versions}` | UI đọc ngưỡng từ đây, **không hardcode** |
| GET | `/api/mission` | `{source, count, waypoints[]}` | `source` ∈ `none` / `readback` / `local` |
| POST | `/api/mission` | `{ok, errors[], count}` | Body giống `cmd.mission.upload`. **Dùng chung** `MissionManager.upload()` với đường WS — không viết lại logic |
| GET | `/api/events?limit=100` | `{events: [...]}` | Lịch sử từ `EventBus` (Phase 05 §5.2.4) để tab mới mở không thấy log trống |
| GET | `/api/video/stream` | `multipart/x-mixed-replace` | MJPEG giả (7.8.2) |

**7.8.1 — giữ tương thích.** `test_app.py` đang khẳng định `connected is False`, `mode == "UNKNOWN"`, `limits["max_alt"] == 10.0`, `limits["manual_command_timeout_ms"] == 300`. Cấu trúc mới **phải giữ** cả bốn.

**7.8.2 — `backend/vision/stream.py`: parser MJPEG thủ công + proxy fan-out (không phụ thuộc nguồn cụ thể).**

`stream.py` không tự sinh video. Nó chỉ **đọc** một luồng `multipart/x-mixed-replace` từ một URL nguồn (`config.CAMERA_STREAM_URL`) — nguồn có thể là `fake_stream.py` (7.8.3, dùng ở phase này) hoặc ESP32-CAM thật (Phase 17), miễn nguồn tuân đúng hợp đồng header ở 7.8.4. `stream.py` **không được** import hay biết gì về `fake_stream.py` — đó là nghĩa của "không phụ thuộc nguồn cụ thể". Giữ nguyên tên lớp `CameraStream` và thuộc tính `available` đã có sẵn trong file — chỉ điền thân, không đổi tên.

Hai phần:

1. **`MjpegLatestFrameReader`** — chạy một task nền, mở kết nối HTTP tới `CAMERA_STREAM_URL`, tự tách boundary bằng tay (đọc byte tới `\r\n\r\n` lấy header của phần, đọc đủ `Content-Length` byte tiếp theo lấy JPEG) — cố tình không dùng thư viện parser multipart có sẵn, vì mục tiêu môn học là hiểu đúng định dạng. Mỗi khung mới **ghi đè** khung cũ trong một biến duy nhất (không xếp hàng đợi): nếu nguồn nhanh hơn tốc độ trình duyệt vẽ, cần khung **mới nhất**, không cần một hàng đợi ngày càng trễ.
2. **`GET /api/video/stream`** (bảng REST ở đầu 7.8) — mỗi trình duyệt mở một kết nối riêng, nhưng cả N kết nối đó đọc chung khung mới nhất từ `MjpegLatestFrameReader` (một instance dùng chung) — chỉ **một** kết nối thật tới nguồn dù có bao nhiêu tab trình duyệt đang mở. Đó là nghĩa của "proxy fan-out".

**7.8.3 — `backend/vision/fake_stream.py`: nguồn MJPEG giả (lặp video) + box giả.**

Phase 10 cần một nguồn video để dựng panel video + canvas overlay, nhưng camera thật chỉ có ở Phase 17 và bộ nhận diện thật ở `plans/ai/`. `fake_stream.py` lấp đúng khoảng đó — nó là **một nguồn** hợp lệ cho `stream.py` đọc, không phải một đường phục vụ video khác chạy song song.

> **Đính chính (25/09/2026):** nguồn giả mặc định **VGA 640×480** (`CAMERA_FAKE_FRAMESIZE`), không phải QVGA. Mở luồng thẳng trong trình duyệt trên màn 2560 px, khung 320×240 hiện rất bé và vỡ — chủ dự án thấy và yêu cầu đổi. QVGA vẫn là mốc thiết kế của ESP32, đặt lại bằng một biến. Clip mẫu là vùng **bản đồ vệ tinh** của Mission Planner quay lúc SITL đang bay (không có chữ giao diện), không phải quay cả cửa sổ.

- Phục vụ `multipart/x-mixed-replace` đúng hợp đồng header ở 7.8.4, đọc khung từ một **video mẫu ngắn lặp vô hạn** (OpenCV `cv2.VideoCapture`, một clip vài giây tự quay hoặc quay màn hình, đặt tại `backend/vision/assets/sample-clip.mp4`, khung **320×240** — báo cáo §4.1: ESP32-CAM đạt 44 fps ở QVGA so với 14 fps ở VGA, nên chọn QVGA làm mốc thiết kế ngay từ đầu) thay vì vẽ hình tổng hợp — video thật cho `stream.py` một nguồn gần thực tế hơn để kiểm chứng parser.
- Mỗi khung gắn đủ bốn header ở 7.8.4: `X-Frame-Id` tăng dần từ 0, `X-Timestamp-Ms = int(time.monotonic() * 1000)`, `X-Jpeg-Quality` cố định (`30`), `X-Framesize` cố định (`QVGA`, khớp kích thước video mẫu).
- Song song, mỗi **300 ms** phát một message `detection` (qua `EventBus`, Phase 05 §5.2.4) với **một** box giả di chuyển theo quỹ đạo cố định, `label: "fake"` — box **không cần khớp nội dung video thật**; mục đích chỉ là kiểm chứng canh chỉnh canvas overlay ở Phase 10 (toạ độ vẽ đúng chỗ), không phải kiểm chứng độ chính xác nhận diện.
- Định dạng multipart phải chuẩn, nếu không trình duyệt tải mãi không hiện:

  ```text
  --frame\r\nContent-Type: image/jpeg\r\nX-Frame-Id: <n>\r\nX-Timestamp-Ms: <ms>\r\nX-Jpeg-Quality: 30\r\nX-Framesize: QVGA\r\nContent-Length: <N>\r\n\r\n<bytes>\r\n
  ```

**7.8.4 — Hợp đồng header MJPEG (`docs/hop-dong-mjpeg.md`) — SSOT.**

Viết file `docs/hop-dong-mjpeg.md` ở gốc repo. Đây là **nguồn sự thật duy nhất** của bốn header multipart — `plans/phase-12-firmware-esp32-camera.md` (firmware) và `plans/ai/ai-phase-01-chuan-bi.md` đều chỉ **trích dẫn** file này, không được định nghĩa lại tên header ở nơi khác. Tên header so khớp **không phân biệt hoa/thường**.

| Header | Kiểu | Ý nghĩa |
|---|---|---|
| `X-Frame-Id` | uint32, tăng dần | Số thứ tự khung — phát hiện khung bị rớt |
| `X-Timestamp-Ms` | uint32, mili-giây | Mốc thời gian phía nguồn (đếm từ lúc thiết bị/tiến trình khởi động), **không phải** epoch |
| `X-Jpeg-Quality` | int, 0–63 | Chất lượng nén JPEG lúc chụp |
| `X-Framesize` | string | Tên khung hình kiểu `esp32-camera`, ví dụ `QVGA`, `VGA`, `SVGA` |

Cả `stream.py` (đọc) lẫn `fake_stream.py` (ghi) đều phải khớp đúng bốn trường này — không thêm, không bớt.

- Lệnh chạy:

  ```powershell
  uv run pytest backend/tests/test_mjpeg_parser.py -v
  curl.exe http://127.0.0.1:8000/api/config
  curl.exe http://127.0.0.1:8000/api/mission
  Start-Process "http://127.0.0.1:8000/api/video/stream"
  ```

- Kết quả mong đợi: `test_mjpeg_parser.py` xanh (parser tách đúng header + JPEG bytes trên dữ liệu multipart dựng tay trong test, không cần chạy `fake_stream.py` thật); JSON hợp lệ; trình duyệt hiện video giả lặp lại; `ws_probe --filter detection` in box theo quỹ đạo cố định.
- Nếu lỗi:
  - *Trình duyệt tải mãi không hiện* — thiếu `\r\n\r\n` giữa header và JPEG bytes, hoặc `Content-Length` sai số byte thật.
  - *`stream.py` đọc được khung đầu rồi treo* — `MjpegLatestFrameReader` đang chờ đủ `Content-Length` nhưng đọc socket theo từng dòng thay vì theo byte; phải đọc đúng số byte đã khai.
  - *Nhiều tab trình duyệt làm nguồn chậm hẳn* — đang mở một kết nối `fake_stream.py` **mới** cho mỗi tab thay vì dùng chung `MjpegLatestFrameReader`; kiểm tra `stream.py` có đúng một instance reader toàn cục không.

---

### 7.9 Quét lại danh sách hàm cấm trên toàn backend

Danh sách canonical ở **`plans/phase-06-backend-dieu-khien-deadman.md` §6.6** — không chép lại ở đây (SSOT). Phase 07 mở rộng phạm vi quét từ một file `control.py` ra **toàn bộ** `backend/`, vì đến phase này đã có thêm `mission.py`, `proximity.py`, `api.py`, `stream.py`, `fake_stream.py`.

```powershell
uv run python -c "import re,pathlib;pat=re.compile(r'send_motor_pwm|rc_channels_override|manual_control_send|set_attitude_target|21196|do_motor_test|actuator_control|PREFLIGHT_REBOOT',re.I);[print(p,i+1,l.rstrip()) for p in pathlib.Path('backend').rglob('*.py') for i,l in enumerate(p.read_text(encoding='utf-8').splitlines()) if pat.search(l) and not l.lstrip().startswith('#')]"
```

- Kết quả mong đợi: **không in ra dòng nào**. (Dòng comment ghi chú về điều cấm bị lọc bỏ — nếu không lọc, chính tài liệu của ta sẽ làm gate đỏ.)

> **Đính chính (25/09/2026): lệnh trên ĐỎ trên code sạch.** Nó chỉ lọc dòng bắt đầu bằng `#`, nên bắt trúng **docstring** của `control.py` ("KHÔNG có `send_motor_pwm()`", "`param2 = 21196`") — chạy thật in 2 dòng. Test trong CI (`test_safety_state_machine.py::test_quet_ham_cam_toan_backend`) quét bằng **AST** như `test_control.py` đã làm: chỉ nhìn tên hàm/thuộc tính/hằng số trong code, bỏ comment lẫn docstring, và thêm cả tên `*_send` truyền dạng chuỗi. Có bài "tự đỏ" (`test_quet_ham_cam_tu_do`) chứng minh cổng đỏ được.
- Đưa phép quét này thành một test trong `test_safety_state_machine.py` để CI chạy tự động, không phụ thuộc việc ai đó nhớ gõ lệnh.

---

### 7.10 Kiểm thử và coverage

**7.10.1 — file test mới:**

| File | Nội dung chính |
|---|---|
| `test_mission_upload.py` | Trả lời đúng seq FC hỏi · FC hỏi lại seq cũ vẫn đúng · nhận cả `MISSION_REQUEST` lẫn `MISSION_REQUEST_INT` · ACK lỗi → ném lỗi có message tiếng Việt · readback lệch → báo lỗi và **không** đổi `current` · 2 luật validate mới · upload thứ hai khi đang upload → `command_denied` |
| `test_proximity.py` | cm→m · `65535` → `None` · giá trị ngoài `min/max` → `None` · gộp 72→8 cung · bảng `avoid_state` đủ 4 nhánh · dữ liệu cũ hơn `PROXIMITY_STALE_S` → `UNKNOWN` · `ACTIVE` **không** xuất hiện ở GUIDED |
| `test_safety_state_machine.py` | Mỗi dòng bảng 7.7 một test, **gồm cả cột "KHÔNG LÀM"** · phép quét hàm cấm 7.9 |

**7.10.2 — coverage ≥ 80%.** Thêm `pytest-cov` vào `pyproject.toml` (nhóm phụ thuộc `dev`), cấu hình `--cov-fail-under` như lệnh dưới.

```powershell
uv run pytest --cov=backend.mavlink.safety --cov=backend.mavlink.mission --cov=backend.mavlink.deadman --cov=backend.mavlink.proximity --cov-report=term-missing --cov-fail-under=80
```

**7.10.3 — thử phá (bắt buộc, đừng bỏ qua).**

> **Coverage 80% có thể là một con số hoàn toàn vô nghĩa.** Một test chỉ *gọi* hàm rồi không khẳng định gì vẫn được tính là "đã phủ". Câu hỏi đúng không phải "đã chạy bao nhiêu dòng" mà là **"nếu thứ này hỏng, có test nào đỏ không?"**

Làm **bốn** phép thử phá, mỗi phép sửa tạm một dòng rồi chạy lại toàn bộ test:

| # | Sửa tạm | Kỳ vọng |
|---|---|---|
| 1 | `should_send_zero_velocity()` → `return False` | ≥ 3 test đỏ (Phase 06) |
| 2 | `validate_mission()` đổi `>` thành `>=` ở kiểm tra `max_alt` | ≥ 1 test đỏ |
| 3 | `type_mask` đổi 1 bit (`0x0DC7` → `0x0DC6`) | ≥ 1 test đỏ |
| 4 | `avoid_state` bỏ điều kiện mode ở nhánh `ACTIVE` | ≥ 1 test đỏ |

Phép nào **vẫn xanh** nghĩa là bộ test đang không chứng minh điều gì ở chỗ đó — viết thêm test trước khi đi tiếp. Ghi kết quả cả 4 phép vào `docs/so-tay/07-backend-mission-proximity-safety.md`, kèm ngày chạy. **Hoàn nguyên mọi sửa tạm** trước khi commit (kiểm bằng `git diff` rỗng trên các file đó).

**7.10.4 — chạy toàn bộ:**

```powershell
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

---

### 7.11 Nghiệm thu tay trên SITL

| # | Bài | Đạt khi |
|---|---|---|
| 1 | Upload 4 waypoint từ backend | `ack done` với `readback_ok: true` |
| 2 | **Mission Planner đọc lại** (oracle độc lập) | Read WPs hiện đúng takeoff + 4 điểm + RTL, đúng toạ độ, đúng alt |
| 3 | Chạy AUTO | Drone bay qua đủ 4 điểm rồi về RTL; `mission.progress` chạy từ 0 tới n |
| 4 | Mission sai bị chặn | Gửi mission alt 50 m → `validation_failed`, **không** có `MISSION_COUNT` nào được gửi |
| 5 | Vật cản | Bay Loiter tới gần vật cản ảo: `obstacle_distance` hiện số mét, `avoid_state` `OFF→NEAR→ACTIVE`, drone phanh lại |
| 6 | Mất link giữa AUTO | Tắt SITL: `connected=false`, `event` `link.lost`, backend **không** gửi lệnh nào thêm, không crash |
| 7 | Video giả | `/api/video/stream` hiện hình; `ws_probe --filter detection` in box bám hình chữ nhật |

---

## Cổng pass

- [ ] `uv run pytest` xanh toàn bộ; **6 test cũ** trong `test_mission_validation.py` không phải sửa một dòng nào.
- [ ] `uv run pytest --cov=... --cov-fail-under=80` PASS cho `safety` + `mission` + `deadman` + `proximity`.
- [ ] **Bốn phép thử phá** (7.10.3) đều làm ≥1 test đỏ; kết quả + ngày ghi vào sổ tay; `git diff` sạch sau khi hoàn nguyên.
- [ ] **Mission Planner Read WPs** hiện đúng mission do backend upload — oracle độc lập, không phải backend tự khẳng định về mình.
- [ ] Mission sai (alt 50 m) bị chặn **trước khi** gửi `MISSION_COUNT`.
- [ ] `avoid_state` chạy đủ 4 nhánh trên SITL; **không** lên `ACTIVE` ở GUIDED (đúng thiết kế).
- [ ] Bảng máy trạng thái 7.7 có test cho **cả cột "KHÔNG LÀM"**.
- [ ] Phép quét hàm cấm (7.9) trên toàn `backend/` không ra dòng nào, và đã thành test trong CI.
- [ ] `GET /api/status` trả **đúng** hình dạng `status.data` của hợp đồng Phase 05 (so khớp bằng `ws-contract.schema.json`).
- [ ] `/api/video/stream` hiện hình trong trình duyệt; message `detection` bám đúng hình chữ nhật.
- [ ] `backend/vision/detector.py`, `events.py` **không bị sửa** (`git diff --stat` xác nhận); `backend/vision/stream.py` **có** sửa (điền thân parser + proxy).
- [ ] `docs/hop-dong-mjpeg.md` tồn tại, đủ bốn header (`X-Frame-Id`, `X-Timestamp-Ms`, `X-Jpeg-Quality`, `X-Framesize`); `stream.py` và `fake_stream.py` cùng khớp đúng hợp đồng đó.
- [ ] `docs/so-tay/07-backend-mission-proximity-safety.md` đã viết, có đủ 5 lý do "vì sao backend không tự đổi mode".

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Mission upload trả lời theo bộ đếm riêng thay vì theo seq FC hỏi → mission lệch, drone bay sai chỗ | 3 | 5 | **15** | **Xử lý ngay khi viết 7.3**: test `test_fc_hoi_lai_seq_cu` bắt đúng lỗi này; đối chiếu Mission Planner ở lần upload **đầu tiên**, không để cuối phase |
| UI hiển thị mission trong bộ nhớ backend thay vì mission thật trên FC | 3 | 4 | 12 | `mission.source` chỉ là `readback` sau khi so khớp đạt (7.4); UI Phase 09 chỉ vẽ khi `source=="readback"` |
| Người dùng tưởng AUTO/GUIDED có tránh vật cản (thật ra `OA_TYPE=0`) | 4 | 4 | **16** | **Bắt buộc**: `avoid_state` không bao giờ `ACTIVE` ngoài Loiter/AltHold/PosHold, và Phase 10 §10.4 phải hiện chữ "chế độ này CHƯA tránh vật cản". Có test cho nhánh này |
| Coverage 80% đạt bằng test không khẳng định gì | 3 | 4 | 12 | Bốn phép thử phá ở 7.10.3 là cổng pass, không phải gợi ý |
| Quy ước seq 0 / home sai → MP hiện lệch một dòng | 3 | 3 | 9 | 7.2 đã ghi là *chưa xác minh* kèm cách sửa; đối chiếu MP là bài nghiệm thu #2 |
| `obstacle_distance = 0.0` khi cảm biến mù, UI hiểu là "sát vật cản" | 3 | 4 | 12 | 7.6.1: ngoài `min/max` → `None`; `UNKNOWN` khác `OFF`; có test riêng |
| Nhầm `frame` (AMSL vs so-với-home) → alt sai nhiều lần | 3 | 4 | 12 | Cố định `frame=6` cho mọi item bay; kiểm bằng MP ở bài #2 |
| Đoán chuỗi STATUSTEXT của AVOID rồi khớp nhầm | 4 | 2 | 8 | Để bảng regex **rỗng** cho tới khi thu được chuỗi thật (7.6.3); `avoid_state` không phụ thuộc STATUSTEXT |
| Nhầm vai trò `stream.py` (parser + proxy, đọc từ URL bất kỳ) với `fake_stream.py` (một nguồn cụ thể) → code sinh khung giả lẫn vào parser, hoặc parser hardcode theo `fake_stream.py` | 3 | 3 | 9 | `stream.py` không được import gì từ `fake_stream.py`; kiểm bằng `grep -n fake_stream backend/vision/stream.py` phải rỗng |
| Hai phiên upload chồng nhau | 2 | 4 | 8 | Khoá độc quyền (7.3 điểm 6) + test |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 7.1 Hai luật validate mới + trường `command` | 1 | Phải không phá 6 test cũ |
| 7.2 Dựng danh sách item + chọn `frame` | 1 | |
| 7.3 State machine upload | 3 | Phần khó nhất; điểm 1 (seq) là chỗ dễ sai nhất |
| 7.4 Readback + so khớp | 1.5 | |
| 7.5 AUTO + đối chiếu Mission Planner | 1 | Oracle độc lập, làm ngay ở lần upload đầu |
| 7.6 Proximity + `avoid_state` | 2.5 | Gồm thu STATUSTEXT thật vào `logs/` |
| 7.7 Máy trạng thái an toàn + viết 5 lý do | 1.5 | Phần lớn là viết, ít code |
| 7.8 REST + MJPEG giả | 1.5 | MJPEG giả là **đầu vào của Phase 10** |
| 7.9 Quét hàm cấm toàn backend | 0.5 | |
| 7.10 Test + coverage + 4 phép thử phá | 2 | Thử phá chiếm ~1 giờ |
| 7.11 Nghiệm thu 7 bài trên SITL | — | Gộp trong các mục trên |
| **Tổng** | **14** | Đường găng: 7.1 → 7.2 → 7.3 → 7.4 → 7.5. 7.6 và 7.8 làm song song được |

Mốc mở khoá: **7.8 xong** thì Phase 10 có nguồn video giả; **7.4 xong** thì Phase 09 có mission readback để vẽ.

## Ghi chú cho sổ tay

Viết vào `docs/so-tay/07-backend-mission-proximity-safety.md`:

1. **Mission protocol là một cuộc hỏi đáp** — GCS nói "tôi có N điểm", FC hỏi từng điểm **một**, GCS trả lời **theo số FC hỏi**, cuối cùng FC gật đầu. Vẽ sơ đồ mũi tên.
2. **Vì sao phải đọc lại** — nguyên tắc: khi có thể hỏi lại nguồn sự thật, đừng hiển thị bản sao trong bộ nhớ mình.
3. **Vì sao `seq 0` là home** — và vì sao dùng Mission Planner kiểm chứng thay vì tin backend.
4. **`frame` là gì** — độ cao so với mực nước biển hay so với chỗ cất cánh. Một chữ số sai là chênh hàng chục mét.
5. **Rangefinder khác proximity** — một tia đo khoảng cách so với "bản đồ 360° quanh máy bay". Ta chỉ có **một** tia nhìn thẳng trước (3.6°), nên 71/72 cung luôn trống. Vì sao `OA_TYPE=0`.
6. **AVOID chỉ chạy ở Loiter/AltHold/PosHold** — ở AUTO/GUIDED phải là path planner, mà ta đang tắt. **UI phải nói thật điều này.**
7. **"Không biết" khác "không có vật cản"** — vì sao `UNKNOWN` không được hiển thị giống `OFF`. Một cảm biến mù hiện "0.0 m" là cách gây tai nạn.
8. **Vì sao backend không tự đổi mode** — 5 lý do ở 7.7. Câu hỏi bảo vệ rất dễ gặp.
9. **Geofence phần mềm chỉ là lớp phụ** — `SAFETY.md` mục 8; lớp thật nằm trên FC (Phase 19).
10. **Coverage không bằng chất lượng test** — giải thích "thử phá" (mutation testing thủ công) bằng đúng 4 ví dụ ở 7.10.3.
11. **Vì sao có video giả** — tách việc dựng giao diện khỏi việc có camera. Nguyên tắc chung: dựng sẵn cái khuôn để khi hàng thật về chỉ việc cắm vào.
