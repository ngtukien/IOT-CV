# Phase 09: Web — bản đồ và trình soạn mission

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| xong 25/09/2026 | Phase 08 (khung web, store, `protocol.ts`, ws client), Phase 07 (mission upload + readback ở backend) | ~12 giờ | Không |

## Mục tiêu

Cho website một **bản đồ sống**: drone hiện lên đúng vị trí, mũi xoay theo hướng bay, có vệt đường đã đi, có điểm home và vòng tròn geofence. Trên cùng bản đồ đó, dựng **trình soạn mission**: bấm để thêm waypoint, sửa độ cao, đổi thứ tự, kiểm tra tại chỗ theo đúng giới hạn của backend, nạp xuống flight controller và **hiển thị lại mission mà FC đọc ngược lên** — chứ không phải bản nháp trong trình duyệt.

Xong phase này: soạn một mission 4 điểm trên web, bấm nạp, và Mission Planner mở ra thấy đúng mission đó.

## Đầu vào cần có

**Phải đọc trước:**

- `plans/phase-05-backend-mavlink-telemetry.md` mục **"Hợp đồng WebSocket"** — SSOT. Phase 09 dùng `cmd.mission.upload`, `event` `mission.progress`, `status.mission`, và các trường `home_lat/home_lon/lat/lon/heading` của `telemetry`. **Không thêm `type` mới.**
- `plans/phase-07-backend-mission-proximity-safety.md` §7.1 (8 luật validate), §7.4 (vì sao chỉ hiển thị mission đã readback), §7.2 (thứ tự item: takeoff đầu, RTL/LAND cuối).
- `plans/reports/260921-research-web-gcs-stack.md` §2.2 — vì sao Leaflet chứ không MapLibre, và vì sao `terra-draw` triệt tiêu lợi thế vẽ waypoint của MapLibre.
- `SAFETY.md` mục 8 — **geofence trên website chỉ là lớp phụ; ArduPilot geofence mới là lớp authoritative**. Câu này quyết định cách đặt nhãn cho vòng tròn geofence.

**Phải chạy được:** backend Phase 07 (mission upload hoạt động trên SITL), web Phase 08 (`pnpm dev` có telemetry).

### Hiện trạng code (prior art)

Phạm vi đã tìm: `frontend/**` (sau Phase 01 + 08), `backend/mavlink/mission.py`, `frontend/map.js` + `frontend/mission.js` (bản vanilla đã bị Phase 01 thay).

| Thứ | Hiện trạng | Phase 09 làm gì |
|---|---|---|
| `frontend/src/lib/protocol.ts` | Phase 08 đã sinh từ hợp đồng, có `CmdMissionUpload`, `EventPayload`, `StatusPayload.mission` | **Dùng lại**, không thêm type |
| `frontend/src/store/telemetry.ts` | Phase 08 đã có `telemetry`, `status`, `events` | Thêm lát cắt `missionDraft` (9.4) |
| `frontend/src/lib/ws.ts` | Phase 08 đã có `send(type, data)` tự bọc phong bì + sinh `id` | **Dùng lại** |
| `frontend/src/app/App.tsx` | Phase 08 đã chừa sẵn hai ô placeholder `"Bản đồ — Phase 09"` và `"Mission — Phase 09"` | Thay nội dung, **không** sắp xếp lại bố cục |
| `backend/mavlink/mission.py` | Phase 07: `validate_mission()` có **8 luật**, `MissionManager.upload/download` chạy được, readback so khớp | Frontend soi gương đúng 8 luật này (9.5) |
| `frontend/map.js` (bản vanilla, 55 dòng, **đã bị thay**) | Từng có ghi chú quan trọng: *"KHÔNG tạo marker mới mỗi lần telemetry về — chỉ setLatLng marker cũ"*; tâm mặc định `[10.762622, 106.660172]`, zoom 17, tile OpenStreetMap | Mang **bài học** sang React (9.2), không port code |
| `frontend/mission.js` (bản vanilla, 62 dòng, **đã bị thay**) | Từng có ghi chú: *"Click bản đồ chỉ tạo draft trong browser. KHÔNG gửi từng điểm xuống UAV — người dùng phải bấm UPLOAD MISSION"*; `DEFAULT_WAYPOINT_ALT = 5` | Mang **nguyên tắc** sang React (9.4) |

> Không có component bản đồ nào trong `frontend/src/` sau Phase 08 — đây là phần mới hoàn toàn của `frontend/`. Nhưng **nguyên tắc** thì không mới: hai ghi chú trong bản vanilla ở trên là kinh nghiệm đã có, phải giữ.

## File và thư mục sở hữu

Chỉ trong `frontend/`. **Không đụng `backend/`** — thiếu gì ghi vào mục "Việc trả về backend".

**Tạo mới:**

```text
frontend/src/
├─ components/
│  ├─ MapView/
│  │  ├─ MapView.tsx            khung bản đồ + các lớp
│  │  ├─ DroneMarker.tsx        marker xoay theo heading
│  │  ├─ TrailLayer.tsx         vệt đường đã bay
│  │  ├─ HomeMarker.tsx         điểm home
│  │  ├─ GeofenceCircle.tsx     vòng tròn MAX_DISTANCE_HOME
│  │  └─ MissionLayer.tsx       vẽ mission (draft + readback)
│  └─ MissionEditor/
│     ├─ MissionEditor.tsx      bảng waypoint + nút nạp
│     ├─ WaypointRow.tsx        một dòng: seq, toạ độ, alt, nút
│     └─ MissionValidation.tsx  hiện lỗi kiểm tra tại chỗ
├─ store/
│  └─ mission.ts                zustand: draft + trạng thái nạp
└─ lib/
   ├─ geo.ts                    haversine, tâm bản đồ, ràng buộc toạ độ
   └─ missionRules.ts           8 luật kiểm tra (soi gương backend)
frontend/tests/unit/
├─ missionRules.test.ts
└─ geo.test.ts
```

**Sửa:** `frontend/src/app/App.tsx` (thay 2 placeholder), `frontend/src/store/telemetry.ts` (thêm vệt đường), `frontend/package.json`.

**Tạo thêm:** `docs/so-tay/09-web-ban-do-mission.md`.

---

## Việc theo thứ tự

### 9.1 Dựng bản đồ Leaflet

**9.1.1 — cài.** Phiên bản theo báo cáo §2.5:

```powershell
cd frontend
pnpm add leaflet@1.9.4 react-leaflet@5.0.0
pnpm add -D @types/leaflet
pnpm add terra-draw terra-draw-leaflet-adapter
pnpm dlx shadcn@4.21.0 add input label slider
```

> *chưa xác minh:* báo cáo §2.5 **không** ghi số phiên bản cho `terra-draw` (chỉ ghi commit mới nhất 20/09/2026), và tên gói adapter cho Leaflet cũng chưa kiểm. Chạy `pnpm view terra-draw version` và `pnpm view terra-draw-leaflet-adapter version` lúc cài, ghim bản thật vào `package.json`, ghi lại vào sổ tay.

**9.1.2 — `MapView.tsx`.**

```tsx
<MapContainer center={mapCenter} zoom={17} className="h-full w-full">
  <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
             attribution="© OpenStreetMap" />
  <HomeMarker />
  <GeofenceCircle />
  <TrailLayer />
  <MissionLayer />
  <DroneMarker />     {/* vẽ sau cùng để nằm trên */}
</MapContainer>
```

**9.1.3 — tâm bản đồ.** Thứ tự ưu tiên, dừng ở cái đầu tiên có giá trị:

1. `telemetry.home_lat/home_lon` (chuẩn nhất — chỗ drone cất cánh)
2. `telemetry.lat/lon` (vị trí hiện tại)
3. `[10.762622, 106.660172]` — mang từ `map.js` cũ, TP.HCM, chỉ để trang không trống

**Chỉ tự căn giữa MỘT LẦN**, khi lần đầu có toạ độ. Sau đó người dùng kéo bản đồ đi đâu là quyền của họ. Tự kéo về giữa mỗi 8 Hz là không thể dùng được — người dùng không bao giờ phóng to xem được chỗ nào. Thêm nút "Theo dõi drone" để bật/tắt việc bám theo, mặc định **tắt** sau lần căn đầu.

**9.1.4 — lỗi icon mặc định của Leaflet.** Leaflet tìm ảnh marker theo đường dẫn tương đối; với bundler thì đường dẫn đó sai và marker biến mất **không báo lỗi gì**. Đây là lỗi kinh điển. Xử lý bằng cách tự cung cấp icon (dự án này dùng icon SVG riêng cho drone/home/waypoint nên phần lớn né được), và `import "leaflet/dist/leaflet.css"` trong `main.tsx` — thiếu dòng CSS này thì bản đồ hiện ô xám lệch lạc.

- Kết quả mong đợi: bản đồ hiện, kéo/phóng được, có chữ ghi nguồn OpenStreetMap.
- Nếu lỗi: *bản đồ xám, các ô lệch chồng nhau* — thiếu `leaflet/dist/leaflet.css`. *Container cao 0px* — Leaflet cần chiều cao tường minh; `h-full` chỉ ăn khi cha cũng có chiều cao xác định.

---

### 9.2 Marker drone xoay theo hướng + vệt đường

**9.2.1 — marker xoay.** Leaflet không xoay marker sẵn; báo cáo §2.2 nêu plugin `Leaflet.RotatedMarker` (dùng CSS transform). Với React, cách gọn hơn là `L.divIcon` chứa SVG và tự xoay bằng CSS:

```tsx
const icon = L.divIcon({
  className: 'drone-marker',
  html: `<svg style="transform: rotate(${heading}deg)" ...>...</svg>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});
```

Không cần thêm plugin. `heading` từ telemetry, đơn vị độ, 0 = Bắc, tăng theo chiều kim đồng hồ — trùng đúng quy ước của CSS `rotate`, nên không phải đổi dấu.
`heading == null` → vẽ hình tròn không có mũi, **không** vẽ mũi chỉ lên Bắc. Mũi chỉ sai hướng tệ hơn là không có mũi.

**9.2.2 — luật vàng: đừng tạo marker mới.**

> Mang nguyên từ `frontend/map.js` cũ: *"KHÔNG tạo marker mới mỗi lần telemetry về — chỉ setLatLng marker cũ."*

Trong React, điều này nghĩa là: `<Marker>` là **một** phần tử, chỉ đổi prop `position` và `icon`. Đừng đặt `key={Date.now()}` hay `key={lat+lon}` — mỗi khoá mới làm React tháo marker cũ và gắn marker mới, 8 lần mỗi giây, và bản đồ sẽ giật rồi rò bộ nhớ. Ghi luật này thành comment ngay trên `DroneMarker.tsx`.

**9.2.3 — vệt đường (`TrailLayer`).** Một `<Polyline>` với mảng toạ độ trong store.

- Thêm điểm mới **chỉ khi** đã dịch hơn **2 m** so với điểm cuối (tính bằng `haversine_m` trong `geo.ts`). Ở 8 Hz mà thêm mọi điểm thì được 480 điểm mỗi phút, phần lớn là nhiễu GPS đứng yên.
- Giới hạn **2000 điểm**, cắt bỏ từ đầu.
- Có nút "Xoá vệt".
- Chỉ ghi vệt khi `armed == true` — đường đi lúc nằm trên bàn không có ý nghĩa gì.

**9.2.4 — `HomeMarker`.** Icon khác (nhà / chữ H), từ `home_lat/home_lon`. `null` → không vẽ, và hiện một dòng nhắc trong panel mission: *"Chưa có điểm home — arm drone hoặc chờ GPS fix"*. Không có home thì không kiểm được luật khoảng cách (9.5), nên người dùng cần biết vì sao nút nạp bị khoá.

**9.2.5 — `GeofenceCircle`.** `<Circle>` tâm home, bán kính `status.limits.max_distance_home` (mặc định 50 m), viền đứt, không tô đặc.

Nhãn **bắt buộc**, đúng nguyên văn tinh thần `SAFETY.md` mục 8:

```text
Giới hạn phần mềm 50 m — đây chỉ là lớp phụ.
Geofence thật nằm trên flight controller (FENCE_*, cấu hình ở Phase 19).
```

Nếu vẽ vòng tròn mà không ghi câu này, người dùng sẽ tưởng website ngăn được drone bay ra ngoài. Nó không ngăn được; nó chỉ ngăn bạn **nạp** một mission ra ngoài.

---

### 9.3 Vẽ mission lên bản đồ

`MissionLayer.tsx` vẽ **hai** lớp phân biệt rõ bằng màu và kiểu nét:

| Lớp | Nguồn | Kiểu vẽ | Ý nghĩa |
|---|---|---|---|
| **Bản nháp** | `missionDraft` trong store (chỉ trong trình duyệt) | Nét đứt, mờ, marker rỗng có số | *"Tôi đang soạn"* |
| **Đã nạp** | `status.mission` khi `source === "readback"` | Nét liền, đậm, marker đặc có số | *"Đây là thứ máy bay thật sự đang giữ"* |

> Hai lớp này **không bao giờ** được vẽ giống nhau. Phase 07 §7.4 đã làm rất nhiều việc để bảo đảm chỉ mission đọc-ngược-lên mới được coi là thật; nếu UI vẽ bản nháp và bản thật bằng cùng một màu thì toàn bộ công sức đó mất sạch — người dùng sẽ tin vào thứ họ vừa gõ.

Khi `status.mission.source === "local"` (đã gửi nhưng chưa readback xong), hiện badge vàng `"Chưa xác nhận"` cạnh panel mission.

---

### 9.4 Trình soạn mission

**9.4.1 — store `mission.ts`:**

```ts
interface MissionStore {
  draft: DraftWaypoint[];          // { id, lat, lon, alt, command }
  defaultAlt: number;              // khởi đầu 5 (từ mission.js cũ), kẹp trong [min_alt, max_alt]
  uploadState: 'idle' | 'validating' | 'uploading' | 'reading-back' | 'done' | 'error';
  uploadProgress: { sent: number; total: number } | null;
  lastErrors: string[];

  addWaypoint(lat, lon): void;
  updateAlt(id, alt): void;
  move(id, dir: 'up' | 'down'): void;
  remove(id): void;
  clear(): void;
}
```

`id` là khoá ổn định (`crypto.randomUUID()`), **không** dùng chỉ số mảng. Dùng chỉ số làm `key` của React thì kéo thả đổi thứ tự sẽ khiến React tái dùng nhầm dòng, và ô nhập độ cao nhảy giá trị lung tung.

**9.4.2 — thêm waypoint.** Hai cách:

1. **Bấm bản đồ** — cách chính, đơn giản nhất. `useMapEvents({ click })` → `addWaypoint(lat, lng)` với `alt = defaultAlt`.
2. **`terra-draw`** — vẽ đường gấp khúc rồi đổi thành chuỗi waypoint, cho người muốn phác nhanh một lộ trình.

Làm **cách 1 trước và cho nó chạy trọn vẹn**, rồi mới thêm cách 2. `terra-draw` là phần dễ trượt lịch nhất của phase này (API adapter chưa xác minh); nếu nó khó thì cách 1 vẫn đủ để hoàn thành mọi cổng pass.

> Nguyên tắc mang từ `mission.js` cũ: **bấm bản đồ chỉ tạo bản nháp trong trình duyệt.** Không gửi từng điểm xuống UAV. Người dùng phải bấm **NẠP MISSION**, và backend kiểm tra lại toàn bộ trước khi gửi. Giữ nguyên.

**9.4.3 — bảng waypoint (`WaypointRow`).** Mỗi dòng: `#seq` · toạ độ (6 chữ số thập phân) · ô nhập `alt` · khoảng cách tới home · nút lên/xuống/xoá.

- Sửa độ cao: `<Input type="number">` + `<Slider>` trong khoảng `[min_alt, max_alt]` đọc từ `status.limits`. Gõ ngoài khoảng thì viền đỏ + báo ngay, **không** tự kẹp im lặng (cùng nguyên tắc với Phase 06 §6.1.3: người gõ một con số là người có kỳ vọng cụ thể về con số đó).
- Đổi thứ tự: nút ▲▼. Kéo thả để sau — nó tốn thời gian và không thêm khả năng gì.
- `seq` **tự đánh lại** sau mỗi lần đổi thứ tự / xoá, luôn liên tục từ 1. Seq nhảy cóc là nguyên nhân của `MAV_MISSION_INVALID_SEQUENCE` ở phía backend.

**9.4.4 — takeoff và RTL.** Phase 07 luật 7–8: item đầu phải là `NAV_TAKEOFF`, item cuối phải là `RTL`/`LAND`, và backend **không tự chèn**.

Cách làm trong UI: hiện hai dòng cố định ở đầu và cuối bảng, không xoá được, chỉ sửa được:

```text
[ cố định ] 1. CẤT CÁNH   alt: [5.0] m
            2. WP  10.762630, 106.660180   alt: [5.0] m
            3. WP  ...
[ cố định ] n. VỀ NHÀ (RTL)     ▼ đổi sang HẠ CÁNH (LAND)
```

Như vậy người dùng **không thể** soạn ra mission vi phạm luật 7–8, thay vì soạn xong rồi bị từ chối. Đây là chênh lệch lớn về trải nghiệm cho người mới, và nó không làm yếu đi bất cứ kiểm tra nào ở backend — backend vẫn kiểm đủ.

---

### 9.5 Kiểm tra tại chỗ — soi gương backend

`frontend/src/lib/missionRules.ts` hiện thực **đúng 8 luật** của `validate_mission()` (Phase 07 §7.1), đọc ngưỡng từ `status.limits`:

| # | Luật | Thông báo tiếng Việt |
|---|---|---|
| 1 | Không có waypoint nào | `"Mission chưa có điểm nào"` |
| 2 | `alt < min_alt` | `"WP{n}: độ cao {a} m thấp hơn giới hạn {min} m"` |
| 3 | `alt > max_alt` | `"WP{n}: độ cao {a} m vượt giới hạn {max} m"` |
| 4 | Khoảng cách tới home > `max_distance_home` | `"WP{n}: cách home {d} m, vượt giới hạn {max} m"` |
| 5 | Toạ độ không hợp lệ (ngoài dải, NaN, hoặc `(0,0)`) | `"WP{n}: toạ độ không hợp lệ"` |
| 6 | Số waypoint > `max_waypoints` | `"Mission có {n} điểm, vượt giới hạn {max}"` |
| 7 | Item đầu không phải cất cánh | `"Mission phải bắt đầu bằng CẤT CÁNH"` |
| 8 | Item cuối không phải RTL/LAND | `"Mission phải kết thúc bằng VỀ NHÀ hoặc HẠ CÁNH"` |

**9.5.1 — kiểm ở frontend KHÔNG thay thế kiểm ở backend.** Nó chạy song song và phục vụ mục đích khác: frontend cho phản hồi **tức thì trong lúc gõ**; backend là **cổng chặn thật** (một script, một tab khác, một kẻ nghịch ngợm đều có thể gửi thẳng vào WebSocket). Viết câu này thành comment đầu `missionRules.ts` để không ai nảy ý bỏ bớt kiểm tra ở backend cho đỡ trùng.

**9.5.2 — chống trôi.** Hai bản kiểm tra ở hai ngôn ngữ **sẽ** trôi khỏi nhau theo thời gian. Giảm thiểu bằng:

- Ngưỡng **luôn** đọc từ `status.limits`, không hằng số nào trong `frontend/src`.
- Vitest `missionRules.test.ts` dùng **đúng** bộ dữ liệu của `backend/tests/test_mission_validation.py` (cùng `HOME = (10.762622, 106.660172)`, cùng các ca alt 0.5 / 50 / offset 0.01 độ) và kỳ vọng **cùng** số lỗi. Trôi là test đỏ.
- Khi backend thêm luật 9, cổng pass của phase đó yêu cầu thêm luật 9 vào đây. Ghi vào `docs/so-tay/09-*`.

**9.5.3 — hiện lỗi (`MissionValidation.tsx`).** Danh sách lỗi ngay dưới bảng, cập nhật khi gõ. Dòng waypoint có lỗi thì viền đỏ. Nút **NẠP MISSION** bị khoá khi còn lỗi, và tooltip nói rõ vì sao khoá — nút xám không có lý do là điều gây bực nhất cho người mới.

---

### 9.6 Nạp mission qua WebSocket

**9.6.1 — gửi.**

```ts
const id = socket.send('cmd.mission.upload', {
  waypoints: draft.map((w, i) => ({ seq: i + 1, lat: w.lat, lon: w.lon, alt: w.alt, command: w.command })),
  auto_start: false,
});
```

`auto_start` mặc định **`false`**. Cho chạy AUTO ngay sau khi nạp là hai quyết định gộp làm một; tách ra thành nút riêng (**BẮT ĐẦU AUTO**, Phase 10 gắn hộp xác nhận vào).

**9.6.2 — theo dõi tiến trình.** Nghe `event` `mission.progress` (`detail = {sent, total}`) → `<Progress>` của shadcn. Chuỗi trạng thái hiện cho người dùng:

```text
Đang kiểm tra… → Đang nạp 3/6 → Đang đọc lại… → Đã nạp xong (6 điểm)
```

Bước **"Đang đọc lại"** phải hiện ra. Nó khiến người dùng thấy rằng hệ thống tự kiểm chứng lại mình, và đó chính là điều đáng khoe khi demo.

**9.6.3 — xử lý `ack` / `error`.** Khớp theo `ref === id` (`ws.ts` của Phase 08 đã sinh `id`):

| Nhận được | UI làm gì |
|---|---|
| `ack status="accepted"` | `uploadState = 'uploading'` |
| `ack status="done"`, `detail.readback_ok === true` | `uploadState = 'done'`, toast xanh, vẽ lớp "đã nạp" |
| `error` `validation_failed` | Hiện danh sách lỗi của backend **cạnh** lỗi của frontend. Lệch nhau → đó là bug chống-trôi (9.5.2), ghi vào EventLog mức `warn` |
| `error` `timeout` | Toast đỏ `"FC không trả lời — thử nạp lại"`, cho phép bấm lại |
| `error` `command_denied` | Hiện nguyên văn message backend (thường là ACK lỗi đã dịch, xem Phase 07 §7.3) |

**9.6.4 — hiển thị mission đã đọc lại.** Khi `status.mission.source === "readback"`, vẽ lớp "đã nạp" và hiện `"Nạp lúc HH:mm:ss · 6 điểm · đã đọc lại từ FC"`.
**Không** tự xoá bản nháp — người dùng có thể muốn sửa rồi nạp lại. Nhưng hiện rõ rằng hai lớp đang trùng nhau hay khác nhau.

---

### 9.7 Unit test (Vitest)

| File | Khẳng định |
|---|---|
| `missionRules.test.ts` | **Cùng bộ dữ liệu với `backend/tests/test_mission_validation.py`** cho **cùng** kết quả (6 ca cũ + 2 luật mới) · ngưỡng lấy từ `limits` truyền vào, không từ hằng số |
| `geo.test.ts` | `haversineM()` khớp `haversine_m()` của backend trong sai số 0.5 m (thử với cặp toạ độ trong test backend) · lọc vệt đường bỏ đúng các điểm dịch < 2 m |
| `missionStore.test.ts` | Đổi thứ tự thì `seq` được đánh lại liên tục · xoá không làm seq nhảy cóc · `id` giữ nguyên khi đổi thứ tự |

```powershell
cd frontend
pnpm vitest run
pnpm tsc --noEmit
pnpm build
```

---

### 9.8 Nghiệm thu

| # | Bài | Đạt khi |
|---|---|---|
| 1 | Drone trên bản đồ | SITL bay → marker dịch chuyển mượt, mũi xoay đúng hướng bay (đối chiếu bản đồ của MAVProxy) |
| 2 | Không tạo marker mới | React DevTools Profiler: `DroneMarker` re-render nhưng **không** unmount/mount lại |
| 3 | Vệt đường | Bay một vòng → có vệt; đứng yên 1 phút → vệt **không** dài thêm (lọc 2 m hoạt động) |
| 4 | Home + geofence | Sau khi arm, có marker home và vòng tròn 50 m kèm **nhãn "chỉ là lớp phụ"** |
| 5 | Soạn mission | Bấm 4 điểm → bảng có 6 dòng (takeoff + 4 + RTL), seq liên tục 1..6 |
| 6 | Kiểm tại chỗ | Gõ alt 50 → lỗi hiện ngay, nút NẠP bị khoá kèm lý do |
| 7 | **Nạp + đọc lại** | Bấm NẠP → thấy đủ chuỗi "kiểm tra → nạp 3/6 → đọc lại → xong"; lớp nét liền xuất hiện |
| 8 | **Oracle độc lập** | Mission Planner → Flight Plan → **Read WPs** hiện **đúng** mission vừa nạp từ web |
| 9 | Phân biệt hai lớp | Sửa bản nháp sau khi nạp → nét đứt và nét liền hiện **khác nhau rõ ràng** |
| 10 | Mission bị từ chối | Gửi mission thiếu takeoff (bằng `ws_probe`, bỏ qua UI) → backend từ chối, UI hiện lỗi, **không** vẽ lớp đã nạp |

---

## Việc trả về backend

| Phát hiện | Thuộc phase | Ghi chú |
|---|---|---|
| `mission.progress` không phát hoặc thiếu `sent/total` | 07 §7.3 điểm 5 | Không có nó thì thanh tiến trình đứng im |
| `status.mission.source` không bao giờ thành `readback` | 07 §7.4 | UI sẽ không bao giờ vẽ lớp nét liền |
| Backend thêm luật validate mới | 07 §7.1 | Phải thêm vào `missionRules.ts` + test, nếu không hai bên trôi |
| `home_lat/home_lon` luôn `null` | 05 §5.2.2 (`HOME_POSITION`) | Mất cả geofence lẫn luật khoảng cách |

---

## Cổng pass

- [ ] `pnpm tsc --noEmit`, `pnpm vitest run`, `pnpm build` đều sạch.
- [ ] Marker drone xoay đúng hướng và **không** bị tháo-gắn lại mỗi khung (kiểm bằng Profiler).
- [ ] Vệt đường không dài thêm khi drone đứng yên; xoá được; giới hạn 2000 điểm.
- [ ] Vòng tròn geofence có nhãn ghi rõ **"chỉ là lớp phụ, geofence thật nằm trên FC"**.
- [ ] Bảng mission luôn có dòng CẤT CÁNH đầu và VỀ NHÀ/HẠ CÁNH cuối, không xoá được; `seq` luôn liên tục sau khi đổi thứ tự/xoá.
- [ ] `missionRules.test.ts` dùng **cùng bộ dữ liệu** với `backend/tests/test_mission_validation.py` và cho cùng kết quả.
- [ ] Nạp mission 4 điểm → **Mission Planner Read WPs hiện đúng** (oracle độc lập).
- [ ] Lớp "bản nháp" và lớp "đã nạp" phân biệt được ngay bằng mắt; chỉ vẽ lớp "đã nạp" khi `source === "readback"`.
- [ ] Mission sai bị khoá nút NẠP kèm lý do; mission sai gửi thẳng qua `ws_probe` bị backend từ chối và UI không vẽ nhầm.
- [ ] `grep -rn "50\b\|max_distance\|min_alt\|max_alt" frontend/src` — không có ngưỡng nào gõ cứng, tất cả từ `status.limits`.
- [ ] `docs/so-tay/09-web-ban-do-mission.md` đã viết.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| UI vẽ bản nháp giống hệt mission thật → người dùng tin vào thứ chưa hề nằm trên máy bay | 3 | 5 | **15** | Hai kiểu vẽ khác hẳn nhau (9.3); chỉ vẽ nét liền khi `source === "readback"`; bài nghiệm thu #9 kiểm bằng mắt |
| `missionRules.ts` trôi khỏi `validate_mission()` → UI cho nạp cái backend sẽ từ chối (hoặc ngược lại, khoá oan) | 4 | 3 | 12 | Dùng chung bộ dữ liệu test (9.5.2); ngưỡng đọc từ `limits`; khi backend thêm luật thì cổng pass phase đó yêu cầu cập nhật ở đây |
| Tạo marker mới mỗi khung (8 Hz) → giật, rò bộ nhớ | 4 | 3 | 12 | Luật vàng 9.2.2 viết thành comment trong `DroneMarker.tsx`; kiểm bằng Profiler ở bài #2 |
| Bản đồ tự căn giữa liên tục → không dùng được | 4 | 3 | 12 | Chỉ căn **một lần**; nút "Theo dõi drone" mặc định tắt (9.1.3) |
| `terra-draw` + adapter Leaflet chưa xác minh phiên bản/API → trượt lịch | 3 | 3 | 9 | Làm cách "bấm bản đồ" **trước và trọn vẹn** (9.4.2); `terra-draw` là phần thêm, mọi cổng pass đạt được mà không cần nó |
| Vòng geofence khiến người dùng tưởng web ngăn được drone bay ra ngoài | 3 | 4 | 12 | Nhãn bắt buộc (9.2.5), viết vào cổng pass; giải thích trong sổ tay |
| Dùng chỉ số mảng làm `key` React → đổi thứ tự thì ô nhập nhảy giá trị | 4 | 2 | 8 | `id` ổn định bằng `crypto.randomUUID()` (9.4.1); có test |
| Seq nhảy cóc sau khi xoá → backend trả `INVALID_SEQUENCE` | 3 | 3 | 9 | Đánh lại seq sau mọi thao tác (9.4.3); có test |
| Thiếu `leaflet/dist/leaflet.css` → bản đồ vỡ mà không báo lỗi | 3 | 2 | 6 | Ghi trong 9.1.4 kèm triệu chứng |
| Tự kẹp im lặng độ cao khi người dùng gõ quá giới hạn | 3 | 3 | 9 | Báo lỗi, không kẹp (9.4.3) — cùng nguyên tắc Phase 06 §6.1.3 |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 9.1 Dựng bản đồ + tâm + lỗi CSS/icon | 1.5 | |
| 9.2 Marker xoay + vệt + home + geofence | 2.5 | Luật vàng "đừng tạo marker mới" |
| 9.3 Hai lớp mission trên bản đồ | 1 | Nhỏ nhưng quan trọng về mặt an toàn |
| 9.4 Trình soạn: store, bấm bản đồ, bảng, takeoff/RTL cố định | 3 | `terra-draw` để cuối, cắt được nếu thiếu giờ |
| 9.5 8 luật kiểm tra tại chỗ + hiện lỗi | 1.5 | Soi gương backend |
| 9.6 Nạp qua WS + tiến trình + ack/error + readback | 2 | |
| 9.7 Vitest 3 file | 0.5 | |
| 9.8 Nghiệm thu 10 bài (gồm đối chiếu Mission Planner) | — | Gộp trong các mục trên |
| **Tổng** | **12** | Đường găng: 9.1 → 9.2 → 9.4 → 9.6. Phase 10 bắt đầu được sau 9.1 (chỉ cần bố cục ổn định) |

## Ghi chú cho sổ tay

Viết vào `docs/so-tay/09-web-ban-do-mission.md`:

1. **Kinh độ / vĩ độ và vì sao 7 chữ số thập phân** — MAVLink truyền toạ độ dưới dạng số nguyên nhân 1e7; một đơn vị cuối ≈ 1 cm.
2. **Heading là gì** — 0 = Bắc, tăng theo chiều kim đồng hồ. Vì sao trùng quy ước với CSS `rotate` nên không phải đổi dấu.
3. **Vì sao không tạo marker mới mỗi khung** — giải thích "tháo ra gắn lại" bằng ví dụ đời thường (đập nhà xây lại thay vì dọn đồ).
4. **Bản nháp khác mission thật** — thứ trong trình duyệt so với thứ trong bộ nhớ máy bay. Vì sao phải đọc ngược lên mới tin.
5. **Geofence phần mềm chỉ là lớp phụ** — `SAFETY.md` mục 8. Website ngăn bạn **nạp** mission xấu, nó không ngăn **máy bay** ra khỏi vòng tròn. Lớp thật nằm trên FC (Phase 19).
6. **Vì sao mission phải bắt đầu bằng cất cánh và kết thúc bằng về nhà** — Copter không tự cất cánh trong AUTO; mission cụt làm máy bay treo tới hết pin.
7. **Seq phải liên tục** — vì sao nhảy cóc làm FC từ chối.
8. **Vì sao kiểm hai lần (web và backend)** — một bên cho phản hồi nhanh, một bên là cổng chặn thật. Không bên nào thay được bên kia.
9. **Vệt đường lọc 2 m** — GPS đứng yên vẫn nhảy lung tung; nếu vẽ hết thì được một cục rối.
10. **Phiên bản `terra-draw` đã dùng thật** — ghi lại sau khi cài, vì báo cáo nghiên cứu không có số.
