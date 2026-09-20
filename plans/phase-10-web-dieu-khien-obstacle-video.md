# Phase 10: Web — điều khiển tay, panel vật cản, video + overlay, E2E dead-man

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 09 (bắc cầu 06, 07) | ~14 giờ | Không |

## Mục tiêu

Hoàn thiện website GCS: lái drone bằng **WASD** (và tay cầm game nếu có), nút đổi mode / arm / takeoff **có hộp xác nhận**, panel **vật cản** hiển thị đúng sự thật về khả năng tránh, panel **video** với khung nhận diện vẽ chồng lên, và bộ test **Playwright E2E** chứng minh dead-man hoạt động từ đầu tới cuối.

Xong phase này: **bay trọn một chuyến SITL hoàn toàn từ trình duyệt** — cất cánh, lái tay, chạy mission, hạ cánh — và có bằng chứng tự động rằng đóng tab giữa lúc đang giữ phím W thì drone dừng.

Đây là phase cuối của luồng phần mềm trên PC. Sau nó là phần cứng (Phase 11–19) và bay thật (Phase 20–22).

## Đầu vào cần có

**Phải đọc trước:**

- `SAFETY.md` **mục 5** (ba test dead-man) và **mục 4** (RC luôn có quyền cao nhất, operator phải chủ động bật WEB CONTROL).
- `plans/phase-05-backend-mavlink-telemetry.md` mục **"Hợp đồng WebSocket"** — SSOT. Phase 10 dùng `cmd.velocity`, `cmd.mode`, `cmd.arm`, `cmd.takeoff`, `cmd.hold/rtl/land`, `cmd.web_control_enable`, `detection`, và các trường `obstacle_*` / `avoid_state`.
- `plans/phase-06-backend-dieu-khien-deadman.md` **§6.4** — ba lớp dead-man và bảo đảm thật là **≤ 350 ms**, không phải 300 ms; **§6.4.4** định dạng `logs/deadman.jsonl` (hợp đồng với test E2E ở đây).
- `plans/phase-07-backend-mission-proximity-safety.md` **§7.6.4** — vì sao `avoid_state` không bao giờ `ACTIVE` ở AUTO/GUIDED; **§7.8.2** nguồn MJPEG giả.
- `plans/reports/260921-research-web-gcs-stack.md` §4.3 — vì sao box đi qua WebSocket + canvas overlay thay vì backend vẽ rồi mã hoá lại (tách FPS video khỏi FPS suy luận).

**Phải chạy được:** backend Phase 07 đầy đủ, web Phase 09, SITL.

### Hiện trạng code (prior art)

| Thứ | Hiện trạng sau Phase 09 | Phase 10 làm gì |
|---|---|---|
| `frontend/src/lib/ws.ts` | Có `send(type, data)` tự bọc phong bì + sinh `id`; nối lại + nhịp tim | **Dùng lại**, không sửa |
| `frontend/src/lib/protocol.ts` | Sinh từ hợp đồng; đã có `CmdVelocity`, `DetectionPayload`, `AVOID_STATE_LABEL` | **Dùng lại**, không thêm type |
| `frontend/src/store/telemetry.ts` | Có `telemetry`, `status`, `events`, `detection` (đã khai từ Phase 08 nhưng chưa ai đọc) | Thêm lát cắt điều khiển (10.1.2) |
| `frontend/src/app/App.tsx` | Còn 3 placeholder: `ModePanel`, `ObstaclePanel`, `VideoPanel` | Thay nội dung, **không** sắp xếp lại |
| `frontend/src/components/ConnectionBar.tsx` | Phase 08 đã có badge `WEB CONTROL: OFF` (chỉ hiển thị) | Làm cho bấm được (10.1.4) |
| `backend/mavlink/deadman.py` | Phase 06: ghi `logs/deadman.jsonl` mỗi lần gửi zero | E2E đọc file này, **không sửa backend** |
| `backend/vision/fake_stream.py` | Phase 07: MJPEG 320×240 @10 fps + `detection` mỗi 300 ms bám hình chữ nhật | Nguồn cho panel video |
| `frontend/control.js` (bản vanilla, **đã bị Phase 01 thay**) | 18 dòng, chỉ in `"Control chưa bật"`, nhưng comment ghi đúng 3 điều kiện mở khoá và luật *"keydown gửi lệnh LIÊN TỤC (không phải một lần), keyup gửi velocity = 0"* | Mang **luật** sang React (10.1.3), không port code |
| `frontend/video.js` (bản vanilla, **đã bị thay**) | 11 dòng, chỉ in `"CAMERA OFFLINE"`; comment ghi *"camera mất KHÔNG được ảnh hưởng telemetry hay control"* | Mang **luật** sang (10.5.4) |

> Không có Playwright trong repo: `Get-ChildItem -Recurse -Filter "playwright.config.*"` → **0 kết quả** (phạm vi: toàn repo). Phần E2E là mới hoàn toàn.

## File và thư mục sở hữu

Chỉ trong `frontend/`. **Không đụng `backend/`** — kể cả khi E2E cần thêm dữ liệu, ghi vào "Việc trả về backend".

**Tạo mới:**

```text
frontend/
├─ src/
│  ├─ components/
│  │  ├─ ManualControl/
│  │  │  ├─ ManualControl.tsx      bật/tắt, hiện phím đang giữ, thanh tốc độ
│  │  │  ├─ SafetyBanner.tsx       dải cảnh báo khi web đang giữ quyền
│  │  │  └─ KeypadHint.tsx         sơ đồ phím cho người mới
│  │  ├─ ModePanel.tsx             nút mode + arm + takeoff (có xác nhận)
│  │  ├─ ObstaclePanel.tsx         thanh khoảng cách + trạng thái AVOID
│  │  └─ VideoPanel/
│  │     ├─ VideoPanel.tsx         <img> MJPEG
│  │     └─ DetectionOverlay.tsx   <canvas> vẽ box
│  ├─ hooks/
│  │  ├─ useManualControl.ts       vòng gửi ≥5 Hz, tập phím đang giữ
│  │  └─ useGamepad.ts             Gamepad API (tuỳ chọn)
│  └─ store/
│     └─ control.ts                zustand: trạng thái điều khiển
├─ tests/
│  ├─ unit/                        Vitest (10.8)
│  └─ e2e/
│     ├─ deadman.spec.ts           TEST QUAN TRỌNG NHẤT (10.7)
│     ├─ smoke.spec.ts             tải trang, telemetry chạy
│     └─ fixtures/readDeadmanLog.ts
└─ playwright.config.ts
```

**Sửa:** `frontend/src/app/App.tsx`, `frontend/src/components/ConnectionBar.tsx`, `frontend/package.json`.

**Tạo thêm:** `docs/so-tay/10-web-dieu-khien-obstacle-video.md`.

---

## Việc theo thứ tự

### 10.1 Điều khiển tay bằng bàn phím

**10.1.1 — bảng phím.** Giữ đúng ánh xạ của `backend/mavlink/control.py` (`KEY_VELOCITY_MAP`, đã có sẵn từ trước), vì hai bên dùng chung quy ước NED:

| Phím | vx | vy | vz | Nghĩa |
|---|---|---|---|---|
| `W` / `↑` | +1 | 0 | 0 | Tiến (theo **mũi máy bay**) |
| `S` / `↓` | −1 | 0 | 0 | Lùi |
| `D` / `→` | 0 | +1 | 0 | Sang phải |
| `A` / `←` | 0 | −1 | 0 | Sang trái |
| `R` | 0 | 0 | **−0.5** | **Lên** (vz âm là lên — hệ NED) |
| `F` | 0 | 0 | **+0.5** | **Xuống** |
| `Q` / `E` | — | — | — | `yaw_rate` ∓30 °/s |
| `Space` | 0 | 0 | 0 | **Dừng ngay** (gửi zero tức thì) |

Giá trị trên là **hệ số**, nhân với `status.limits.max_velocity` (mặc định 1.0 m/s). Backend kẹp lại lần nữa (Phase 06 §6.2) — hai lớp, không lớp nào thừa.

Giữ nhiều phím thì **cộng** các vector rồi chuẩn hoá sao cho không vượt `max_velocity` (giữ `W`+`D` không được nhanh hơn giữ `W` một mình, √2 lần nhanh hơn là một bất ngờ khó chịu).

**10.1.2 — vòng gửi ≥ 5 Hz (`useManualControl.ts`).**

> Luật mang từ `control.js` cũ: *"keydown gửi lệnh LIÊN TỤC (không phải một lần), keyup gửi velocity = 0."*

Cách làm **đúng**:

```ts
const held = useRef<Set<string>>(new Set());

// keydown/keyup CHỈ cập nhật tập phím — không gửi gì
onKeyDown: (e) => { if (MAPPED.has(e.key)) { e.preventDefault(); held.current.add(e.key); } }
onKeyUp:   (e) => { held.current.delete(e.key); }

// MỘT setInterval 10 Hz là nơi duy nhất gửi lệnh
setInterval(() => {
  if (!enabled) return;
  const v = vectorFrom(held.current);            // rỗng -> (0,0,0)
  socket.send('cmd.velocity', v);
}, 100);
```

Ba điều dễ sai:

1. **Đừng gửi trong `keydown`.** Hệ điều hành tự lặp `keydown` khi giữ phím, nhưng nhịp đó phụ thuộc cài đặt bàn phím của từng máy (thường trễ 500 ms rồi 30 Hz). Nhịp không đều và có khoảng chết 500 ms đầu — đúng khoảng mà dead-man 300 ms sẽ kích hoạt, làm drone giật khục một cái mỗi lần bấm phím. Tách hẳn: bàn phím chỉ đổi *trạng thái*, `setInterval` chỉ *gửi*.
2. **`e.preventDefault()`** cho phím mũi tên và `Space`, nếu không trang sẽ cuộn.
3. **Gửi cả khi tập phím rỗng** trong vài chu kỳ sau khi thả: gửi zero 3 lần rồi mới ngưng (chống rớt gói). Ngưng hẳn thì dead-man của backend lo nốt.

**10.1.3 — mất tiêu điểm cửa sổ.** Bắt `window.blur` và `document.visibilitychange` → xoá tập phím + gửi zero ngay. Alt-Tab sang cửa sổ khác thì **sự kiện `keyup` không bao giờ tới** — không xử lý thì trình duyệt tưởng bạn vẫn đang giữ W, và drone cứ thế bay. Đây là một trong những lỗi nguy hiểm nhất của loại giao diện này.

**10.1.4 — nút WEB CONTROL.** Công tắc trong `ManualControl.tsx` và badge trong `ConnectionBar` (Phase 08 đã đặt chỗ).

- Bật → gửi `cmd.web_control_enable {enabled: true}`.
- **Chỉ bật được khi** `telemetry.mode === "GUIDED"` và `connected === true`; nếu không thì công tắc xám kèm lý do: *"Cần đổi sang GUIDED trước"*.
- Backend là nguồn sự thật: trạng thái hiển thị lấy từ `status.safety.web_control_enabled`, **không** từ biến cục bộ. Bấm rồi chờ `ack` + `status` mới đổi màu — bấm mà giao diện đổi ngay còn backend từ chối là một lời nói dối về quyền điều khiển.
- Bị từ chối (`command_denied` vì tab khác đang giữ) → toast đỏ *"Một tab khác đang giữ quyền lái"*.
- Phi công gạt mode khác GUIDED → backend tự thu quyền (Phase 06 §6.3) → `status` đổi → công tắc tự tắt. Không cần frontend làm gì, và **không được** cố giành lại.

**10.1.5 — `SafetyBanner`.** Khi `web_control_enabled === true`, hiện dải đỏ **cố định trên cùng**, không đóng được:

```text
⚠ WEB ĐANG GIỮ QUYỀN LÁI · Giữ phím để bay · Thả phím hoặc Space để dừng
RC luôn có quyền cao hơn — gạt mode trên tay điều khiển là web mất quyền ngay
```

Đây không phải trang trí. Người vận hành phải luôn biết website đang có thể làm máy bay di chuyển, và phải luôn nhớ đường thoát.

**10.1.6 — hiển thị phản hồi.** Hiện tập phím đang giữ (tô sáng trên `KeypadHint`), vector velocity đang gửi (`vx/vy/vz` kèm đơn vị), và `ground_speed` thật từ telemetry ngay cạnh. Hai số này lệch nhau là thông tin chẩn đoán quý: xin 1.0 mà thực tế 0.0 nghĩa là chưa cất cánh, hoặc đang bị AVOID phanh, hoặc lệnh không tới nơi.

---

### 10.2 Tay cầm game (tuỳ chọn)

`useGamepad.ts` dùng Gamepad API sẵn có của trình duyệt — không thêm thư viện.

- Cần cắm tay cầm rồi **bấm một nút** thì trình duyệt mới thấy (quy định bảo mật, không phải lỗi).
- Đọc trong `requestAnimationFrame`, nhưng vẫn gửi qua **cùng** `setInterval` 10 Hz của 10.1.2 — không mở vòng gửi thứ hai.
- Ánh xạ: trục trái → `vx`/`vy`, trục phải dọc → `vz`, trục phải ngang → `yaw_rate`.
- **Vùng chết 0.15** bắt buộc: cần analog rẻ luôn trôi quanh 0, không có vùng chết thì drone bò đi khi không ai đụng vào.
- Ưu tiên: đang có phím bàn phím giữ thì bỏ qua tay cầm (tránh hai nguồn đánh nhau).

**Đây là phần có thể cắt.** Nếu thiếu giờ, bỏ 10.2 — mọi cổng pass vẫn đạt được bằng bàn phím. Ghi vào `plans/PROGRESS.md` là đã cắt có chủ ý, không phải quên.

---

### 10.3 Panel mode / arm / takeoff

`ModePanel.tsx`. Đây là những lệnh làm máy bay thay đổi hành vi — mỗi nút cần một lớp ma sát tương xứng với hậu quả.

**10.3.1 — nút mode.** `GUIDED`, `LOITER`, `ALT_HOLD`, `POSHOLD`, `BRAKE`, `AUTO`, `RTL`, `LAND`, `STABILIZE` — đúng whitelist của backend (Phase 06 §6.1.1). Mode hiện tại tô sáng. `AUTO` bị khoá khi `status.mission.source !== "readback"`, tooltip: *"Chưa có mission nào trên máy bay"*.

**10.3.2 — mức xác nhận.** Không phải lệnh nào cũng cần hỏi; hỏi tất cả thì người dùng học cách bấm OK mà không đọc.

| Lệnh | Mức | Vì sao |
|---|---|---|
| Đổi mode sang LOITER / ALT_HOLD / POSHOLD / BRAKE | Bấm là chạy | Đều là mode "giữ nguyên chỗ", an toàn hơn trạng thái hiện tại |
| `GUIDED` | Bấm là chạy | Chỉ mở đường cho lệnh web; chưa làm gì cả |
| **ARM** | `AlertDialog` — gõ chữ `ARM` để xác nhận | Motor bắt đầu quay. Với drone thật, đây là lúc có thể bị thương |
| **TAKEOFF** | `AlertDialog` hiện độ cao + nhắc *"máy bay sẽ rời mặt đất"* | |
| **AUTO** (bắt đầu mission) | `AlertDialog` hiện số waypoint + độ cao lớn nhất | Máy bay tự đi một quãng đường |
| **RTL / LAND** | Bấm là chạy | Đây là nút **thoát hiểm**. Bắt xác nhận lúc hoảng là phản tác dụng |
| **DISARM** | `AlertDialog` cảnh báo đỏ *"nếu đang bay, máy bay sẽ RƠI"* | |

`SAFETY.md` mục 2 (`NO PROPELLERS`) thuộc về phần cứng, nhưng hộp xác nhận ARM nên nhắc luôn: *"Với drone thật: đã tháo cánh chưa?"* — chuẩn bị sẵn cho Phase 16–17, không phải thêm về sau.

**10.3.3 — nút HOLD lớn.** Một nút **HOLD** to, luôn hiện, không bao giờ bị khoá: gửi `cmd.hold` (chuyển LOITER). Đây là nút "dừng lại để tôi nghĩ" — phải là thứ dễ trúng nhất trên màn hình. Gắn thêm phím tắt `H`.

**10.3.4 — phản hồi lệnh.** Mỗi lệnh có `id`; theo dõi `ack accepted` → `ack done` → đổi trạng thái nút. Quá 5 s không có `done` → toast vàng *"FC chưa xác nhận"*. Nút **không** được tự đổi màu trước khi backend xác nhận (cùng nguyên tắc 10.1.4).

---

### 10.4 Panel vật cản

`ObstaclePanel.tsx`. Nguồn: `telemetry.obstacle_distance`, `obstacle_sectors`, `rangefinder_healthy`, `avoid_state`; ngưỡng từ `status.limits`.

**10.4.1 — thanh khoảng cách.** Thanh ngang từ 0 tới `rangefinder_max_m` (6 m, từ `RNGFND1_MAX`), có vạch tại `avoid_margin_m` (2 m) và `avoid_dist_max_m` (5 m). Con trỏ ở vị trí `obstacle_distance`, số hiện to bên cạnh (`2.4 m`).

**10.4.2 — bảng màu**, đúng bốn trạng thái backend tính (Phase 07 §7.6.4):

| `avoid_state` | Điều kiện (backend đã tính) | Màu | Chữ |
|---|---|---|---|
| `OFF` | d > 5 m | Xanh lá | `Trống` |
| `NEAR` | 2 m < d ≤ 5 m | Vàng | `Gần vật cản` |
| `ACTIVE` | d ≤ 2 m **và** mode ∈ Loiter/AltHold/PosHold | Đỏ, có nhấp nháy nhẹ | `FC đang tránh` |
| `UNKNOWN` | Số đo cũ > 2 s hoặc cảm biến không khoẻ | Xám gạch chéo | `Không đọc được` |

**Frontend không tự tính lại `avoid_state`.** Backend là nguồn sự thật; tính lại ở đây là tạo ra khả năng hai bên nói khác nhau về một chuyện sống còn.

**10.4.3 — nói thật về khả năng tránh.** Khi `telemetry.mode` ∈ {`AUTO`, `GUIDED`, `RTL`}, panel **bắt buộc** hiện dòng chữ cố định:

```text
Chế độ này KHÔNG tự tránh vật cản.
Việc tránh trong AUTO/GUIDED thuộc về Object Avoidance path planner,
hiện đang tắt (OA_TYPE=0) vì chỉ có một tia đo nhìn thẳng trước.
```

Đây là **cổng pass**, không phải gợi ý. Một panel vật cản màu xanh hiển thị trong AUTO mà không kèm câu này là một lời nói dối về an toàn — người dùng sẽ tưởng mình được bảo vệ ở đúng chế độ mà họ không được bảo vệ.

**10.4.4 — sơ đồ cung.** Vẽ `obstacle_sectors[8]` thành 8 hình quạt quanh biểu tượng drone. Cung `null` vẽ **gạch chéo xám** (= không có dữ liệu), **không** vẽ màu xanh.

> Với phần cứng thật chỉ có **một** tia TFmini nhìn thẳng trước 3.6°, nên **7 trong 8 cung luôn gạch chéo**. Đó là sự thật, và hình vẽ phải nói đúng sự thật đó. Vẽ vòng tròn xanh đầy đủ là gợi ý rằng drone nhìn được 360° — nó không nhìn được.

---

### 10.5 Panel video và khung nhận diện

Kiến trúc theo báo cáo §4.3 phương án (b): **backend fan-out MJPEG nguyên bản + box đi qua WebSocket + canvas vẽ chồng**. Lợi ích chính không phải tiết kiệm CPU mà là **tách FPS video khỏi FPS suy luận** — video chạy 10–44 fps trong khi nhận diện chỉ 3–5 fps.

Ở Phase 10, nguồn là MJPEG **giả** của Phase 07 §7.8.2 (320×240 @10 fps, một hình chữ nhật di chuyển, kèm `detection` bám theo nó mỗi 300 ms). Camera thật vào ở Phase 17; bộ nhận diện thật ở `plans/ai/`. Panel **không phải sửa** khi đổi nguồn — đó là mục đích của việc làm nguồn giả.

**10.5.1 — `<img>` MJPEG.**

```tsx
<img src="/api/video/stream" className="block w-full" ref={imgRef} />
```

Dùng đường dẫn **tương đối** (proxy của Phase 08 §8.8.1 lo phần còn lại). Không gắn `key` đổi theo thời gian — đổi `key` là mở lại kết nối MJPEG, và mỗi lần mở lại là một khoảng trắng trên màn hình.

**10.5.2 — `<canvas>` phủ lên.** Đặt tuyệt đối đúng chồng lên `<img>`, `pointer-events: none`. Vẽ box từ `store.detection`.

**Quy đổi toạ độ — chỗ sai nhiều nhất.** Hợp đồng Phase 05 quy định box là **pixel trong hệ khung gốc** (`data.width` × `data.height`, tức 320×240), còn `<img>` hiển thị ở kích thước khác (co giãn theo bố cục). Vì vậy:

```ts
const sx = canvas.width  / detection.width;    // KHÔNG dùng 320 gõ cứng
const sy = canvas.height / detection.height;
ctx.strokeRect(box.x1 * sx, box.y1 * sy, (box.x2 - box.x1) * sx, (box.y2 - box.y1) * sy);
```

Đặt `canvas.width/height` bằng `imgRef.current.clientWidth/clientHeight` và cập nhật lại trong `ResizeObserver`. Quên bước này thì box vẫn vẽ ra — chỉ là lệch chỗ, và không có gì báo lỗi. **Nguồn giả tồn tại chính để bắt lỗi này**: box phải trùng khít hình chữ nhật đang chạy. Trùng khít = quy đổi đúng.

**10.5.3 — box cũ.** `detection` đến 3.3 Hz còn video 10 fps, nên box luôn trễ hơn hình vài chục ms. Chấp nhận được (báo cáo §4.3 đã nêu là nhược điểm đã biết của phương án b). Nhưng:

- `frame_ts` cũ hơn **1 s** → làm mờ box và hiện chữ `"box cũ"`.
- Cũ hơn **3 s** → xoá hẳn. Box đứng im trên màn hình trong khi cảnh đã đổi là tệ hơn không có box.

**10.5.4 — mất camera không được ảnh hưởng gì khác.**

> Luật từ `SAFETY.md` mục 9 và comment của `video.js` cũ: *"Khi ESP32-CAM ngắt hoặc process YOLO crash: telemetry vẫn chạy, control vẫn chạy, UAV không đổi mode."*

Trong UI: `<img>` lỗi (`onError`) → panel hiện `"CAMERA OFFLINE"`, thử lại mỗi 5 s, và **không** làm gì khác. Không toast đỏ toàn màn hình, không khoá nút điều khiển, không đổi trạng thái kết nối. Có một bài nghiệm thu riêng cho việc này (bài #8 ở 10.9).

---

### 10.6 Playwright E2E — test dead-man

> **Đây là bằng chứng quan trọng nhất của cả luồng phần mềm.** Pytest ở Phase 06 chứng minh *logic* đúng; script SITL chứng minh *backend* đúng; test này chứng minh **cả chuỗi trình duyệt → backend → FC** đúng.

**10.6.1 — cài.**

```powershell
cd frontend
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

*chưa xác minh:* báo cáo §2.5 không ghi phiên bản Playwright. Chạy `pnpm view @playwright/test version` lúc cài và ghim vào `package.json`.

**10.6.2 — điều kiện chạy.** Test này cần **hệ thống thật**: SITL + backend + bản build. Không giả lập.

```ts
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  use: { baseURL: 'http://127.0.0.1:8000', trace: 'on-first-retry' },
  // KHÔNG dùng webServer tự khởi động: SITL nằm trong WSL, không quản lý được từ đây.
  // Người chạy phải tự bật SITL + backend trước — có kiểm tra tiền đề ở beforeAll.
});
```

`beforeAll` kiểm tra tiền đề và **bỏ qua test có lý do rõ ràng** nếu thiếu, thay vì đỏ một cách khó hiểu:

```ts
const s = await (await fetch('http://127.0.0.1:8000/api/status')).json();
test.skip(!s.connected, 'Cần SITL đang chạy và backend đã nối — xem Phase 02');
```

**10.6.3 — kịch bản `deadman.spec.ts`.**

```text
1. Mở trang, chờ telemetry (ô độ cao khác "—")
2. Bấm mode GUIDED, chờ badge đổi
3. Bấm ARM (gõ "ARM" trong hộp xác nhận), chờ badge ARMED
4. Bấm TAKEOFF 5 m, chờ relative_alt > 4.0   (timeout 30 s)
5. Ghi số dòng hiện có của logs/deadman.jsonl  -> lineCountBefore
6. page.keyboard.down('w')
7. Chờ 2 s, khẳng định ground_speed > 0.5 m/s     <- chứng minh W thật sự làm nó bay
8. Ghi closeTs = Date.now()
9. await page.close()                              <- KHÔNG keyup, KHÔNG gửi lệnh dừng
10. Đợi tới khi logs/deadman.jsonl dài thêm (poll 20 ms, tối đa 3 s)
11. Đọc dòng mới:
       reason === "web_disconnected"
       vx === 0 && vy === 0 && vz === 0
       (ts * 1000 - closeTs) < 300        <- YÊU CẦU CỦA SAFETY.md §5
12. Mở trang mới, khẳng định ground_speed < 0.2 m/s trong 3 s
```

**10.6.4 — vì sao đo bằng file log chứ không bằng giao diện.** Sau bước 9, trang đã đóng — **không còn gì để nhìn**. Bằng chứng duy nhất là thứ backend ghi lại. Đây chính là lý do Phase 06 §6.4.4 định nghĩa `logs/deadman.jsonl` với `ts` là Unix epoch giây (so sánh được với `Date.now()`) và ghi **đồng bộ + flush ngay**.

> **Đây là hợp đồng giữa Phase 06 và Phase 10.** Đổi định dạng file ở một bên mà không sửa bên kia thì test này hỏng, và nó sẽ hỏng theo kiểu "đỏ vì lý do sai" — tệ hơn là không có test.

**10.6.5 — vì sao ngưỡng 300 ms là đạt được.** Phase 06 §6.4.3: đóng socket đi theo đường `on_web_disconnected()` → gửi zero **ngay** (< 50 ms), **không** chờ hết hạn 300 ms. Đường hết-hạn (≤ 350 ms) dành cho trường hợp trình duyệt treo mà socket vẫn mở — trường hợp đó Playwright **không** tạo ra được, vì `page.close()` đóng socket sạch sẽ.
Viết đúng lý do này vào comment của test. Ai đó sau này thấy "300 ms" rồi đọc Phase 06 thấy "350 ms" sẽ tưởng có mâu thuẫn — không có mâu thuẫn, đó là hai đường khác nhau.

**10.6.6 — `smoke.spec.ts`.** Bài ngắn chạy nhanh trong CI: tải trang, có telemetry, HUD có số, bản đồ hiện, không có lỗi console. Bắt các hỏng hóc thô trước khi chạy bài dead-man dài.

**10.6.7 — CI.** Bài `deadman.spec.ts` cần SITL nên **không** chạy được trên GitHub Actions ở giai đoạn này. Đánh dấu `@requires-sitl` và loại khỏi CI; `smoke.spec.ts` cũng cần backend nên tạm chạy tay. Ghi rõ vào `docs/so-tay/10-*` rằng đây là test **chạy tay bắt buộc trước mỗi lần bay thật** (Phase 21), không phải test CI.

- Lệnh chạy:

  ```powershell
  # Tab 1 (WSL): SITL   Tab 2: uv run uvicorn backend.app:app --port 8000
  cd frontend; pnpm build
  pnpm exec playwright test tests/e2e/deadman.spec.ts --reporter=list
  ```

- Kết quả mong đợi: `1 passed`, và report in ra độ trễ thực đo (ví dụ `zero-velocity sau 34 ms`).
- Nếu lỗi:
  - *Bước 7 `ground_speed` = 0* — chưa takeoff xong, hoặc chưa bật WEB CONTROL (thiếu bước bấm công tắc), hoặc mode không phải GUIDED.
  - *Bước 10 hết giờ, file không dài thêm* — backend không gửi zero khi socket đóng. Đây là **lỗi backend nghiêm trọng** (Phase 06 §6.4.3), báo ngay, đừng nới ngưỡng test.
  - *Bước 11 độ trễ > 300 ms* — `on_web_disconnected()` đang chờ hết hạn thay vì gửi ngay. Cũng là lỗi backend.
  - *Test đỏ vì `test.skip` không kích hoạt* — `/api/status` trả `connected: false`; bật SITL trước.

---

### 10.7 Unit test (Vitest)

| File | Khẳng định |
|---|---|
| `velocityMapping.test.ts` | `W` → `vx>0` · `R` → **`vz<0`** (lên) · `F` → `vz>0` · giữ `W`+`D` không vượt `max_velocity` · tập phím rỗng → `(0,0,0)` · vùng chết tay cầm cắt được giá trị 0.1 |
| `manualControl.test.ts` | `keydown` **không** gửi gì (chỉ đổi tập phím) · `setInterval` gửi 10 Hz · `blur` xoá tập phím **và** gửi zero · `Space` gửi zero ngay |
| `detectionOverlay.test.ts` | Quy đổi toạ độ đúng khi canvas 640×480 còn khung gốc 320×240 (hệ số 2.0) · box cũ > 3 s bị bỏ · `boxes: []` không ném lỗi |
| `obstacle.test.ts` | Bốn màu khớp bốn `avoid_state` · cung `null` vẽ gạch chéo chứ không xanh · dòng cảnh báo "không tự tránh" xuất hiện đúng ở AUTO/GUIDED/RTL |

```powershell
cd frontend
pnpm vitest run
pnpm tsc --noEmit
pnpm build
```

---

### 10.8 Nghiệm thu — bay trọn chuyến từ web

Chín bài, ghi vào `docs/test-log.md`. **Đây là cổng pass của cả luồng phần mềm trên PC.**

| # | Bài | Đạt khi |
|---|---|---|
| 1 | Cất cánh từ web | GUIDED → ARM (có xác nhận) → TAKEOFF 5 m; HUD hiện 5 m; bản đồ có marker |
| 2 | **W → tiến** | Giữ `W`: `ground_speed` ≈ 1 m/s, marker dịch **theo hướng mũi** |
| 3 | **Thả → dừng** | Thả `W`: `ground_speed` < 0.2 m/s trong 3 s |
| 4 | **Đóng tab → dừng** | `deadman.spec.ts` xanh, độ trễ < 300 ms |
| 5 | Alt-Tab → dừng | Giữ `W` rồi Alt-Tab: drone dừng (bẫy `blur`, 10.1.3) |
| 6 | Mission từ web | Soạn (Phase 09) → nạp → AUTO (có xác nhận) → bay đủ waypoint → RTL |
| 7 | HOLD | Đang bay bấm HOLD → chuyển LOITER, đứng yên |
| 8 | **Mất camera không ảnh hưởng** | Tắt `/api/video/stream` (dừng nguồn giả): panel hiện CAMERA OFFLINE; telemetry, điều khiển, bản đồ **vẫn chạy bình thường** |
| 9 | Vật cản | Loiter bay tới vật cản ảo: thanh đổi màu `OFF→NEAR→ACTIVE`; ở AUTO thì hiện dòng "chế độ này KHÔNG tự tránh" |

Bài **RC lấy lại quyền từ web** không làm ở đây (SITL không có RC thật) — nó là F8 của Phase 21.

---

## Việc trả về backend

| Phát hiện | Thuộc phase | Ghi chú |
|---|---|---|
| `logs/deadman.jsonl` không có hoặc sai định dạng | 06 §6.4.4 | E2E không đo được — **chặn cổng pass** |
| Đóng socket không gửi zero ngay mà chờ hết hạn | 06 §6.4.3 | Lỗi an toàn nghiêm trọng, sửa trước mọi thứ khác |
| `avoid_state` lên `ACTIVE` ở GUIDED | 07 §7.6.4 | Sai thiết kế — panel sẽ nói sai về an toàn |
| `detection` không bám hình chữ nhật của nguồn giả | 07 §7.8.2 | Không kiểm chứng được quy đổi toạ độ overlay |
| `cmd.velocity` trả `rate_limited` ở 10 Hz | 05 hợp đồng (giới hạn 30/s) | Kiểm lại bộ đếm nhịp phía backend |

---

## Cổng pass

- [ ] `pnpm tsc --noEmit`, `pnpm vitest run`, `pnpm build` đều sạch.
- [ ] **`deadman.spec.ts` xanh, độ trễ đo được < 300 ms** — ba test của `SAFETY.md` §5 đã chạy trên cả chuỗi trình duyệt→backend→FC.
- [ ] Alt-Tab giữa lúc giữ `W` → drone dừng (bẫy `blur` có test đơn vị + bài nghiệm thu #5).
- [ ] `keydown` **không** gửi lệnh; chỉ `setInterval` gửi, nhịp 10 Hz (≥ 5 Hz theo yêu cầu).
- [ ] Công tắc WEB CONTROL chỉ đổi màu **sau** khi `status` từ backend đổi, không đổi ngay khi bấm.
- [ ] `SafetyBanner` hiện suốt thời gian web giữ quyền, không đóng được.
- [ ] ARM / TAKEOFF / AUTO / DISARM có hộp xác nhận; **RTL / LAND / HOLD không có** (nút thoát hiểm).
- [ ] Panel vật cản hiện **đúng dòng cảnh báo "chế độ này KHÔNG tự tránh vật cản"** khi ở AUTO/GUIDED/RTL.
- [ ] Cung không có dữ liệu vẽ **gạch chéo**, không vẽ xanh.
- [ ] Box nhận diện **trùng khít** hình chữ nhật của nguồn MJPEG giả ở ít nhất 2 kích thước cửa sổ khác nhau (chứng minh quy đổi toạ độ đúng, không gõ cứng 320×240).
- [ ] Tắt nguồn video → telemetry, điều khiển, bản đồ **không bị ảnh hưởng** (`SAFETY.md` mục 9).
- [ ] Bay trọn chuyến SITL từ web: cất cánh → lái tay → mission AUTO → RTL. 9 bài ở 10.8 đều đạt, ghi `docs/test-log.md`.
- [ ] `grep -rn "320\|240" frontend/src/components/VideoPanel` — không có kích thước nào gõ cứng.
- [ ] `docs/so-tay/10-web-dieu-khien-obstacle-video.md` đã viết.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Alt-Tab / mất tiêu điểm làm `keyup` không bao giờ tới → drone bay tiếp trong khi người dùng tưởng đã thả | 4 | 5 | **20** | **Xử lý ngay khi viết 10.1**: bắt `blur` + `visibilitychange`, xoá tập phím, gửi zero. Có test đơn vị **và** bài nghiệm thu #5. Dead-man backend là lớp chắn cuối, nhưng đừng để nó phải làm việc này |
| Gửi lệnh trong `keydown` → nhịp phụ thuộc cài đặt bàn phím, có khoảng chết 500 ms đầu làm dead-man kích hoạt nhầm | 4 | 4 | **16** | Tách trạng thái khỏi việc gửi (10.1.2); test `manualControl.test.ts` khẳng định `keydown` không gửi gì |
| Quy đổi toạ độ overlay sai → box lệch mà **không có gì báo lỗi** | 4 | 3 | 12 | Nguồn giả có hình chữ nhật để đối chiếu bằng mắt; cổng pass yêu cầu thử ở 2 kích thước cửa sổ; test đơn vị với hệ số 2.0 |
| Panel vật cản khiến người dùng tưởng AUTO có tránh vật cản | 4 | 4 | **16** | Dòng cảnh báo bắt buộc (10.4.3) là **cổng pass**; cung không dữ liệu vẽ gạch chéo; giải thích trong sổ tay |
| `deadman.spec.ts` đỏ vì môi trường (SITL chưa bật) thay vì vì lỗi thật → mất niềm tin vào test | 4 | 3 | 12 | `beforeAll` kiểm tiền đề và `test.skip` **kèm lý do rõ ràng** (10.6.2) |
| Định dạng `logs/deadman.jsonl` đổi ở Phase 06 mà không sửa test | 2 | 5 | 10 | Ghi rõ là **hợp đồng hai chiều** ở cả hai file; nhắc trong "Việc trả về backend" |
| Giao diện đổi màu nút ngay khi bấm dù backend từ chối → nói dối về quyền điều khiển | 3 | 4 | 12 | Trạng thái luôn lấy từ `status` của backend (10.1.4, 10.3.4) |
| Hỏi xác nhận cho mọi lệnh → người dùng bấm OK không đọc | 3 | 3 | 9 | Bảng mức xác nhận ở 10.3.2; nút thoát hiểm **không** hỏi |
| Tay cầm không có vùng chết → drone bò đi khi không ai đụng | 3 | 4 | 12 | Vùng chết 0.15 bắt buộc; nếu thiếu giờ thì **cắt hẳn 10.2** chứ không làm nửa vời |
| Mở vòng gửi thứ hai cho tay cầm → hai nguồn đánh nhau | 3 | 3 | 9 | Một `setInterval` duy nhất (10.2); bàn phím ưu tiên |
| Test E2E không chạy được trên CI → bị quên | 3 | 4 | 12 | Ghi thành **bước bắt buộc chạy tay trước mỗi buổi bay** trong sổ tay và trong checklist Phase 21 |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 10.1 Điều khiển bàn phím + WEB CONTROL + banner | 3 | Rủi ro cao nhất phase (bẫy `blur`, bẫy `keydown`) |
| 10.2 Tay cầm game | 1 | **Cắt được** nếu thiếu giờ |
| 10.3 Panel mode / arm / takeoff + xác nhận | 2 | |
| 10.4 Panel vật cản | 1.5 | Gồm dòng cảnh báo bắt buộc |
| 10.5 Panel video + canvas overlay | 2.5 | Quy đổi toạ độ là phần dễ sai |
| 10.6 Playwright E2E dead-man | 2.5 | Bằng chứng quan trọng nhất |
| 10.7 Vitest 4 file | 1 | |
| 10.8 Nghiệm thu 9 bài — bay trọn chuyến từ web | 0.5 | |
| **Tổng** | **14** | Đường găng: 10.1 → 10.3 → 10.6. 10.4 và 10.5 làm song song được |

Xong Phase 10 là **hết luồng phần mềm trên PC**. Tiếp theo: Phase 11 (firmware ArduPilot + param) — không phụ thuộc gì vào phase này, có thể đã làm song song từ trước.

## Ghi chú cho sổ tay

Viết vào `docs/so-tay/10-web-dieu-khien-obstacle-video.md`:

1. **Vì sao không gửi lệnh trong `keydown`** — hệ điều hành tự lặp phím với nhịp riêng của từng máy, có khoảng chết 500 ms đầu. Tách "trạng thái phím" khỏi "việc gửi".
2. **Bẫy Alt-Tab** — `keyup` không tới khi cửa sổ mất tiêu điểm. Đây là một trong những lỗi nguy hiểm nhất của giao diện điều khiển bằng bàn phím. Vẽ dòng thời gian minh hoạ.
3. **Ba lớp dead-man, nhìn từ phía web** — thả phím (tức thì) → đóng tab (< 50 ms) → hết hạn 300 ms (≤ 350 ms) → ArduPilot tự dừng (~3 s). Vì sao E2E đo được < 300 ms dù Phase 06 ghi 350 ms: **hai đường khác nhau**.
4. **Vì sao đo bằng file log chứ không bằng giao diện** — sau khi đóng tab thì không còn gì để nhìn.
5. **`vz` âm là lên** — nhắc lại hệ NED (đã giải thích ở sổ tay Phase 06), vì đây là chỗ người dùng gặp trực tiếp qua phím `R`/`F`.
6. **Vì sao WEB CONTROL phải bật thủ công** — `SAFETY.md` mục 4; web không tự giành quyền, RC luôn thắng.
7. **Vì sao nút thoát hiểm không hỏi xác nhận** — ma sát đặt đúng chỗ: hỏi khi hậu quả là "bắt đầu điều gì đó", không hỏi khi hậu quả là "dừng điều gì đó".
8. **Vì sao panel vật cản phải nói mình không tránh được ở AUTO** — một giao diện im lặng về giới hạn của mình là một giao diện nói dối. Giải thích AC_Avoid so với OA path planner bằng lời thường.
9. **Vì sao box đi riêng khỏi video** — tách FPS video (10–44) khỏi FPS suy luận (3–5); nếu vẽ box vào ảnh rồi mã hoá lại thì video bị kéo tụt xuống bằng tốc độ AI.
10. **Vì sao dùng nguồn video giả** — để dựng và kiểm chứng giao diện trước khi có camera; box bám hình chữ nhật là cách kiểm tra quy đổi toạ độ mà không cần AI.
11. **Danh sách test phải chạy tay trước mỗi buổi bay** — `deadman.spec.ts` + 9 bài nghiệm thu. Chép danh sách này sang checklist Phase 21.
