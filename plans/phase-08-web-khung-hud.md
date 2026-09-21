# Phase 08: Web — khung ứng dụng, WebSocket client, HUD telemetry

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 05 (**Hợp đồng WebSocket** đã commit), Phase 01 (Vite scaffold + pnpm) | ~12 giờ | Không |

## Mục tiêu

Dựng bộ khung của website GCS: cấu trúc thư mục React, một store zustand nhận telemetry, một client WebSocket **tự nối lại** có nhịp tim, và một lớp `protocol.ts` **sinh từ hợp đồng Phase 05** thay vì gõ tay. Trên nền đó dựng ba thành phần hiển thị đầu tiên: **HUD telemetry**, **thanh kết nối**, **nhật ký sự kiện**.

Xong phase này: mở `http://127.0.0.1:8000` thấy số liệu của drone ảo chạy thật, rút SITL ra thì thanh kết nối đỏ, cắm lại thì tự xanh — và toàn bộ được `pnpm build` ra file tĩnh cho FastAPI phục vụ.

Phase này **chưa** có bản đồ (Phase 09), **chưa** có điều khiển (Phase 10). Chỉ nhìn, chưa chạm.

## Đầu vào cần có

**Phải đọc trước:**

- `plans/phase-05-backend-mavlink-telemetry.md` mục **"Hợp đồng WebSocket"** — **SSOT**. Đây là đầu vào quan trọng nhất của phase này.
- `backend/ws-contract.schema.json` — bản JSON Schema Phase 05 xuất ra; dùng để sinh type.
- `plans/reports/260921-research-web-gcs-stack.md` §2.1 (vì sao Vite chứ không Next.js), §2.3 (vì sao WebSocket chứ không SSE), §2.4 (zustand cho push, TanStack Query chỉ cho REST — và nếu chỉ có 3–4 endpoint REST thì `fetch` trần là đủ, **đừng thêm dependency cho có**), §2.5 (bảng phiên bản).
- `SAFETY.md` mục 1 — web chỉ gửi lệnh mức cao; điều này định hình cả cách đặt tên component.

**Phải có sẵn:** backend Phase 05 chạy được (telemetry chảy qua `/ws`), `pnpm`, Node LTS.

### Hiện trạng code (prior art)

Phạm vi đã tìm: `frontend/**`, `backend/app.py`, `plans/_phase-index.md`.

**Trước Phase 01**, `frontend/` là 550 LOC vanilla JS + Leaflet qua CDN: `app.js` (27 dòng, điểm khởi động ghép module), `telemetry.js` (44 dòng, WebSocket + reconnect 1000 ms), `map.js` (55 dòng), `mission.js` (62 dòng), `control.js` (18 dòng, chỉ in "chưa bật"), `ui.js` (55 dòng, cập nhật DOM + event log giới hạn 50 dòng), `video.js` (11 dòng, chỉ in "CAMERA OFFLINE"), `index.html` (98 dòng), `styles.css` (180 dòng).

**Phase 01 đã thay toàn bộ bằng Vite + React + TS** (`plans/_phase-index.md` hàng 01). Vì vậy Phase 08 xây trên scaffold, **không** port từng file.

> **Bước kiểm tra bắt buộc trước khi bắt đầu** (*chưa xác minh* rằng Phase 01 đã dọn sạch):
>
> ```powershell
> Test-Path frontend/package.json ; Test-Path frontend/src/main.tsx ; Get-ChildItem frontend/*.js
> ```
>
> Đúng thì: `package.json` có, `src/main.tsx` có, **không** còn `frontend/*.js` ở thư mục gốc. Nếu vẫn còn file vanilla → Phase 01 chưa xong, quay lại làm nốt chứ **không** vừa chạy hai bản song song.

**Bốn quyết định trong bản vanilla đáng mang sang React** (chúng là kinh nghiệm đã trả giá, không phải code):

1. `telemetry.js`: *"Frontend KHÔNG đọc MAVLink trực tiếp — chỉ nhận JSON đã chuẩn hoá"* → giữ nguyên làm luật kiến trúc.
2. `map.js`: *"KHÔNG tạo marker mới mỗi lần telemetry về — chỉ setLatLng marker cũ"* → Phase 09 dùng.
3. `mission.js`: *"Click bản đồ chỉ tạo draft trong browser. KHÔNG gửi từng điểm xuống UAV"* → Phase 09 dùng.
4. `ui.js`: event log giới hạn 50 dòng → Phase 08 dùng (8.7).

## File và thư mục sở hữu

Chỉ được tạo/sửa trong `frontend/`. **Không đụng `backend/`** (Phase 05–07 sở hữu) — nếu thấy backend thiếu gì thì ghi vào mục "Việc trả về backend" ở cuối file, không tự sửa.

**Tạo mới:**

```text
frontend/
├─ src/
│  ├─ app/
│  │  ├─ App.tsx                    khung layout, lưới panel
│  │  └─ layout.css                 (nếu cần ngoài Tailwind)
│  ├─ components/
│  │  ├─ Hud/Hud.tsx                HUD telemetry (8.5)
│  │  ├─ Hud/AttitudeIndicator.tsx  chân trời giả
│  │  ├─ Hud/StatBlock.tsx          ô số dùng lại
│  │  ├─ ConnectionBar.tsx          thanh kết nối (8.6)
│  │  ├─ EventLog.tsx               nhật ký sự kiện (8.7)
│  │  └─ ui/                        component shadcn (CLI tự sinh)
│  ├─ hooks/
│  │  ├─ useWebSocket.ts            vòng đời socket, gắn vào store
│  │  └─ useLimits.ts               đọc limits từ status (không hardcode)
│  ├─ store/
│  │  └─ telemetry.ts               zustand (8.2)
│  ├─ lib/
│  │  ├─ protocol.ts                type + zod, SINH TỪ hợp đồng Phase 05 (8.4)
│  │  ├─ ws.ts                      client WS: reconnect + heartbeat (8.3)
│  │  ├─ format.ts                  định dạng số/đơn vị dùng chung
│  │  └─ api.ts                     fetch REST (/api/config, /api/events)
│  ├─ main.tsx
│  └─ index.css
├─ tests/unit/                      Vitest (8.9)
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
└─ components.json                  cấu hình shadcn
```

**Sửa:** `frontend/vite.config.ts`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/index.css` (đều do Phase 01 sinh ra).

**Tạo thêm:** `docs/so-tay/08-web-khung-hud.md`.

---

## Việc theo thứ tự

### 8.1 Cấu trúc dự án và phụ thuộc

**8.1.1 — cài phụ thuộc.** Phiên bản lấy từ `plans/reports/260921-research-web-gcs-stack.md` §2.5 (verify từ registry npm ngày 21/09/2026).

```powershell
cd frontend
pnpm add react@19.3.0 react-dom@19.3.0 zustand@5.0.15 zod@4.6.5
pnpm add -D typescript@5.103.1 vite@8.3.0 tailwindcss@4.3.3 @tailwindcss/vite
pnpm add -D vitest @vitest/ui jsdom @testing-library/react
```

| Gói | Bản chốt | Vì sao |
|---|---|---|
| `react` / `react-dom` | 19.3.0 | §2.5 |
| `vite` | 8.3.0 | §2.5 — **§"Hạn chế" điểm 2 của báo cáo nói bản này nhảy bậc bất thường**; chạy `pnpm view vite version` lúc cài để chốt lại |
| `typescript` | 5.103.1 | §2.5 — cùng cảnh báo như trên |
| `tailwindcss` | 4.3.3 | v4 dùng plugin Vite, **không** còn `tailwind.config.js` kiểu v3 |
| `zustand` | 5.0.15 | Đúng công cụ cho dữ liệu **đẩy** 8 Hz |
| `zod` | 4.6.5 | Kiểm tra message WS lúc chạy (8.4) |
| `@tanstack/react-query` | 5.103.1 | **Chưa cài ở Phase 08.** Báo cáo §2.4: chỉ dùng cho REST, mà hiện chỉ có 3–4 endpoint → `fetch` trần đủ. Cài khi thật sự cần cache |
| `vitest`, `jsdom`, `@testing-library/react` | *chưa xác minh* | Báo cáo §2.5 không liệt kê. Chốt bằng `pnpm view vitest version` lúc cài, rồi ghim vào `package.json` |

**8.1.2 — shadcn/ui.**

```powershell
pnpm dlx shadcn@4.21.0 init
pnpm dlx shadcn@4.21.0 add button card badge separator scroll-area tooltip table sonner
```

| Component | Dùng ở đâu |
|---|---|
| `card` | Khung mỗi panel |
| `badge` | Trạng thái mode / armed / GPS fix |
| `button` | Nút chung (Phase 10 dùng nhiều) |
| `separator`, `scroll-area` | Nhật ký sự kiện |
| `tooltip` | Giải thích từng ô HUD cho người mới |
| `table` | Bảng sự kiện |
| `sonner` | Toast — shadcn đã chuyển từ `toast` sang `sonner` (*chưa xác minh* với CLI 4.21.0; chạy `pnpm dlx shadcn@latest add` không tham số để xem danh sách thật) |

Phase 09 thêm: `slider`, `input`, `label`. Phase 10 thêm: `dialog`, `alert-dialog`, `switch`, `progress`, `tabs`.

**8.1.3 — bố cục màn hình.** Một trang duy nhất, lưới CSS, **không có router** (GCS không có trang thứ hai; thêm router là thêm khái niệm không dùng tới):

```text
┌──────────────────────────────────────────────┐
│ ConnectionBar  (luôn trên cùng, cao ~40px)   │
├───────────────┬──────────────────────────────┤
│  Hud          │  MapView        (Phase 09)   │
│  (~320px)     │                              │
│               ├──────────────────────────────┤
│  ModePanel    │  MissionEditor  (Phase 09)   │
│  (Phase 10)   │                              │
├───────────────┼──────────────────────────────┤
│ ObstaclePanel │  VideoPanel     (Phase 10)   │
│  (Phase 10)   │                              │
├───────────────┴──────────────────────────────┤
│ EventLog                    (cao ~160px)     │
└──────────────────────────────────────────────┘
```

Ở Phase 08, các ô của Phase 09/10 là placeholder ghi rõ `"Bản đồ — Phase 09"`. Viết sẵn khung là để Phase 09/10 chỉ việc thay nội dung, không phải sắp xếp lại bố cục.

- Kết quả mong đợi: `pnpm dev` mở trang thấy khung xám có tên từng panel.
- Nếu lỗi: *Tailwind v4 không ăn class* — v4 **không** dùng `tailwind.config.js`; phải thêm `@tailwindcss/vite` vào `plugins` của `vite.config.ts` và `@import "tailwindcss";` ở đầu `index.css`. Làm theo hướng dẫn v3 là lỗi phổ biến nhất.

---

### 8.2 Store telemetry (zustand)

`frontend/src/store/telemetry.ts`. Một store duy nhất cho mọi dữ liệu đẩy từ backend.

```ts
interface TelemetryStore {
  telemetry: Telemetry | null;      // message 'telemetry', 8 Hz
  status: StatusPayload | null;     // message 'status', theo sự kiện
  events: EventPayload[];           // vòng đệm 200, mới nhất ở đầu
  detection: DetectionPayload | null;  // Phase 10 dùng
  connection: 'connecting' | 'open' | 'closed' | 'error';
  lastMessageAt: number | null;     // Date.now() của message cuối

  applyTelemetry(t: Telemetry): void;
  applyStatus(s: StatusPayload): void;
  pushEvent(e: EventPayload): void;
  applyDetection(d: DetectionPayload): void;
  setConnection(c: ConnectionState): void;
}
```

Bốn luật, mỗi luật có lý do cụ thể:

1. **Component subscribe theo lát cắt, không lấy cả store.**
   `const alt = useTelemetryStore(s => s.telemetry?.relative_alt)` chứ **không** `const { telemetry } = useTelemetryStore()`. Ở 8 Hz, lấy cả store làm **mọi** component render lại 8 lần/giây kể cả khi dữ liệu của nó không đổi. Đây là lỗi hiệu năng số một khi dùng zustand với dữ liệu đẩy.
2. **Không sinh giá trị dẫn xuất trong store.** `link_age_ms` đã do backend tính (hợp đồng Phase 05); đừng tính lại. `distanceToHome` thì tính ở component lúc hiển thị, không lưu.
3. **`events` giới hạn 200** — mang từ bản vanilla (`ui.js` giới hạn 50; nâng lên 200 cho khớp vòng đệm `EventBus` của backend).
4. **Không hardcode ngưỡng nào.** Mọi giới hạn (`max_alt`, `max_velocity`, `avoid_margin_m`…) đọc từ `status.limits` qua hook `useLimits()`. Backend là nguồn sự thật; số trong UI chỉ là bản hiển thị.

---

### 8.3 Client WebSocket: nối lại + nhịp tim

`frontend/src/lib/ws.ts`. Đây là thứ **duy nhất** trong frontend được mở socket.

**8.3.1 — API.**

```ts
export interface GcsSocket {
  send<T extends ClientMessageType>(type: T, data: ClientPayload<T>): string;  // trả về id
  close(): void;
}
export function createGcsSocket(opts: {
  url: string;
  onMessage(msg: ServerEnvelope): void;
  onState(state: ConnectionState): void;
}): GcsSocket;
```

`send()` tự bọc phong bì (`v: 1`, `type`, `ts`, `id`, `data`) và tự tăng bộ đếm `c-1`, `c-2`… — đúng hợp đồng Phase 05. Component **không bao giờ** tự dựng JSON thô.

**8.3.2 — nối lại có backoff.** Bản vanilla dùng `RECONNECT_DELAY_MS = 1000` cố định. Nâng lên backoff luỹ thừa có nhiễu ngẫu nhiên: `1s → 2s → 4s → 8s`, trần **10 s**, cộng ngẫu nhiên 0–500 ms. Nhiễu để nếu sau này mở nhiều tab thì chúng không cùng đập vào backend một lúc.
Nối lại thành công → đặt lại backoff về 1 s và phát `event` nội bộ `"Đã nối lại"` vào EventLog.

**8.3.3 — nhịp tim.** Cứ **2 s** gửi `ping`; nếu **5 s** không nhận message nào (kể cả `telemetry` lẫn `pong`) thì coi socket là chết, `close()` và cho vòng nối lại chạy.
Cần cả hai vì một socket TCP có thể "mở" trên giấy tờ nhưng không có gì đi qua (Wi-Fi rớt, máy ngủ dậy). `readyState === OPEN` **không** chứng minh đường dây còn sống.

**8.3.4 — `StrictMode` mount hai lần.** React 19 ở chế độ dev gọi `useEffect` **hai lần** để bắt lỗi dọn dẹp. Viết ngây thơ là có **hai** WebSocket, và tab của bạn tự giành quyền lái với chính nó (Phase 10 sẽ đau đầu vì quy tắc một-người-lái).

Xử lý: tạo socket ở **module scope singleton** hoặc dùng `useRef` + cleanup đúng chuẩn:

```ts
useEffect(() => {
  const sock = createGcsSocket({...});
  return () => sock.close();     // BẮT BUỘC
}, []);
```

Kiểm chứng: mở DevTools → Network → WS, phải thấy **đúng một** kết nối. Đây là bài kiểm tra ở cổng pass, không phải gợi ý.

**8.3.5 — bỏ qua type lạ trong im lặng.** Hợp đồng Phase 05 quy định chiều xuống phải tương thích tiến: gặp `type` chưa biết thì **bỏ qua**, không ném lỗi, không đỏ màn hình. Nhờ vậy backend thêm message mới (ví dụ `detection` ở Phase 07) mà frontend cũ vẫn chạy.

---

### 8.4 `protocol.ts` — sinh từ hợp đồng, không gõ tay

> **Luật cứng:** `frontend/src/lib/protocol.ts` là **bản dịch** của mục "Hợp đồng WebSocket" trong `plans/phase-05-backend-mavlink-telemetry.md`. Phase 08/09/10 **không được** thêm `type` mới, thêm trường, hay đổi đơn vị ở đây. Thiếu gì → sửa hợp đồng Phase 05 trước, rồi `backend/schemas.py`, rồi file này, **trong cùng một commit**.

**8.4.1 — sinh type từ JSON Schema.**

```powershell
cd frontend
pnpm add -D json-schema-to-typescript
pnpm exec json2ts ../backend/ws-contract.schema.json -o src/lib/protocol.generated.ts
```

Thêm script vào `package.json`: `"gen:protocol": "json2ts ../backend/ws-contract.schema.json -o src/lib/protocol.generated.ts"`.
Đầu file sinh ra phải có dòng `// TỰ SINH — ĐỪNG SỬA TAY. Nguồn: backend/ws-contract.schema.json`.

*chưa xác minh:* `json-schema-to-typescript` xử lý union phân biệt (`discriminator`) của pydantic v2 tốt tới đâu. **Phương án dự phòng** nếu output khó dùng: gõ tay `protocol.ts` **một lần** từ bảng trong hợp đồng, và thêm một test Vitest (8.9) so danh sách `type` trong file gõ tay với danh sách trong `ws-contract.schema.json` — bản gõ tay vẫn không được phép trôi khỏi hợp đồng.

**8.4.2 — kiểm tra lúc chạy bằng zod.** Type TypeScript biến mất khi biên dịch; nó **không** bảo vệ gì trước một message hỏng đến từ mạng. Viết schema zod cho `Envelope` và cho `data` của từng `type`:

```ts
export const EnvelopeSchema = z.object({
  v: z.literal(1),
  type: z.string(),
  ts: z.number(),
  id: z.string().optional(),
  data: z.record(z.unknown()),
});
export function parseServerMessage(raw: string): ServerEnvelope | null { ... }
```

Parse hỏng → trả `null` + đẩy một `event` mức `warn` vào EventLog, **không** làm sập giao diện. Một message hỏng không được làm mất cả buổi bay.

**8.4.3 — hằng số và bảng tra.** Đặt ở đây, dùng chung cả ba phase web:

```ts
export const GPS_FIX_LABEL = { 0:'Không GPS', 1:'Chưa fix', 2:'2D', 3:'3D', 4:'DGPS', 5:'RTK float', 6:'RTK fixed' } as const;
export const AVOID_STATE_LABEL = { OFF:'Trống', NEAR:'Gần', ACTIVE:'Đang tránh', UNKNOWN:'Không rõ' } as const;
export const ERROR_CODE_LABEL = { ... };   // dịch 12 mã lỗi của hợp đồng sang tiếng Việt
```

---

### 8.5 HUD telemetry

`frontend/src/components/Hud/Hud.tsx`. Hiển thị **đúng** những trường hợp đồng đã có; không bịa thêm.

| Ô | Nguồn | Định dạng | Ghi chú hiển thị |
|---|---|---|---|
| Chân trời giả | `roll`, `pitch` | SVG xoay theo `roll`, dịch theo `pitch` | Dùng CSS `transform`, không dùng canvas — 10 Hz là nhẹ |
| Hướng mũi | `heading` | `123°` + la bàn nhỏ | |
| Độ cao | `relative_alt` | `4.9 m` (1 chữ số thập phân) | Ghi rõ **"so với điểm cất cánh"** — người mới hay tưởng là so mực nước biển |
| Tốc độ | `ground_speed` | `1.02 m/s` | |
| Tốc độ leo | `climb_rate` | `+0.4 m/s` | Có dấu, xanh/đỏ theo chiều |
| GPS | `gps_fix_type`, `satellites` | `3D · 12 vệ tinh` | `< 3` thì badge vàng; `fix_type` dịch qua `GPS_FIX_LABEL` |
| Pin | `battery_voltage`, `battery_current`, `battery_remaining` | `11.4 V · 3.2 A · 78%` | `< 25%` badge đỏ. `null` hiện `—`, **không** hiện `0` |
| Mode | `mode` | Badge chữ to | `GUIDED` xanh, `RTL`/`LAND` vàng, còn lại xám |
| Armed | `armed` | Badge `ARMED` đỏ / `DISARMED` xám | Đỏ là "đang nguy hiểm", không phải "lỗi" |
| Tuổi link | `link_age_ms` | `120 ms` | `> 1000` vàng, `> 3000` đỏ |
| EKF | `ekf_ok` | `OK` / `LỖI` / `—` | `null` → `—` (chưa biết), **không** hiện OK |

Ba luật hiển thị, áp cho cả Phase 09 và 10:

1. **`null` hiện `—`, không bao giờ hiện `0`.** "Chưa có số đo" khác "số đo bằng không". Đây là cùng một nguyên tắc với `avoid_state = UNKNOWN` ở backend (Phase 07 §7.6.4) — hiện `0` khi đang mù là cách gây tai nạn.
2. **Đơn vị luôn hiện cạnh số.** Không có ô nào chỉ có con số trần.
3. **`tooltip` giải thích từng ô** — người dùng của website này là người mới; đây cũng là điểm cộng khi demo.

Tách `StatBlock.tsx` dùng lại cho mọi ô (nhãn + giá trị + đơn vị + badge màu tuỳ chọn) — 11 ô mà mỗi ô một kiểu là con đường chắc chắn tới giao diện lộn xộn.

- Kết quả mong đợi: SITL chạy → mọi ô có số thật; gõ `takeoff 5` trong MAVProxy thì độ cao bò lên và chân trời giả nghiêng theo.
- Nếu lỗi: *HUD giật cục 1 lần/giây thay vì mượt* — `ATTITUDE` đang chạy ở tần số mặc định. Đó là lỗi **backend** (Phase 05 §5.1.4 `SET_MESSAGE_INTERVAL`), không phải lỗi web. Ghi vào "Việc trả về backend".

---

### 8.6 Thanh kết nối (ConnectionBar)

Luôn ở trên cùng. Hiển thị **hai** thứ kết nối khác nhau — người mới rất hay nhầm:

| Chỉ báo | Nguồn | Ý nghĩa |
|---|---|---|
| **Trình duyệt ↔ Backend** | `connection` trong store (trạng thái WebSocket) | Website có nói chuyện được với máy tính không |
| **Backend ↔ Drone** | `telemetry.connected` + `link_age_ms` | Máy tính có nói chuyện được với máy bay không |

Hai cái này **độc lập**: backend chạy ngon mà SITL tắt thì ô một xanh, ô hai đỏ. Nếu gộp thành một đèn thì khi mất kết nối không ai biết mất ở đâu — mất nửa giá trị chẩn đoán.

Thêm: `endpoint` từ `status` (ví dụ `udpin:127.0.0.1:14551`), phiên bản backend, và badge **`WEB CONTROL: OFF`** (từ `status.safety.web_control_enabled`; Phase 10 làm cho nó bấm được).

- Kết quả mong đợi: tắt SITL → ô hai đỏ trong ~3 s, ô một vẫn xanh. Tắt backend → ô một đỏ và bắt đầu đếm ngược nối lại.

---

### 8.7 Nhật ký sự kiện và toast

`frontend/src/components/EventLog.tsx`.

- Nguồn: message `event` (hợp đồng Phase 05) + các sự kiện nội bộ của frontend (mất/nối lại socket, message hỏng).
- Cột: giờ (`HH:mm:ss`), `level` (badge màu), `source`, `message`. `code` hiện ở tooltip — nó dành cho người sửa lỗi, không cho người dùng.
- Mới nhất ở trên, cuộn được, giới hạn 200 dòng (mang từ `ui.js` vốn để 50).
- Lọc nhanh theo `level` — khi có sự cố thật, cần lọc ra `error` ngay.
- **Toast (`sonner`) chỉ cho `level === "error"`** và cho `ack`/`error` của lệnh do chính mình gửi. Toast cho mọi `info` là công thức khiến người dùng học cách phớt lờ toast — đúng lúc cái quan trọng hiện ra thì họ không nhìn nữa.
- Lúc mở trang, gọi `GET /api/events?limit=100` (Phase 07) để lấp lịch sử — không để bảng trống làm người dùng tưởng chưa có gì xảy ra.

---

### 8.8 Build và phục vụ từ FastAPI + proxy lúc dev

**8.8.1 — `vite.config.ts`:**

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: true },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws':  { target: 'ws://127.0.0.1:8000',   ws: true },
    },
  },
});
```

Proxy để lúc dev (`pnpm dev` ở cổng 5173) trang vẫn gọi `/api` và `/ws` **đường dẫn tương đối**, y hệt lúc chạy thật. Nhờ vậy **không có chỗ nào trong code phải biết số cổng** — không `if (import.meta.env.DEV)`, không hardcode `localhost:8000`.

URL WebSocket dựng từ vị trí trang, đúng như bản vanilla đã làm:

```ts
const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
export const WS_URL = `${proto}//${location.host}/ws`;
```

**8.8.2 — hai chế độ chạy.**

| Chế độ | Lệnh | Truy cập | Dùng khi |
|---|---|---|---|
| Dev | `pnpm dev` + backend riêng | `http://127.0.0.1:5173` | Đang viết giao diện (hot reload) |
| Thật | `pnpm build` + backend | `http://127.0.0.1:8000` | Nghiệm thu, demo, E2E ở Phase 10 |

```powershell
cd frontend; pnpm build
cd ..; uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

- Kết quả mong đợi: mở `http://127.0.0.1:8000` thấy **đúng** giao diện như ở 5173, telemetry chảy.
- Nếu lỗi:
  - *`http://127.0.0.1:8000` trả 404 hoặc trang trắng* — `app.py` đang mount `frontend/` thay vì `frontend/dist/`. Đây là **việc của backend** (Phase 05 §5.3.6); ghi vào "Việc trả về backend", không tự sửa `app.py`.
  - *`pnpm dev` gọi `/ws` lỗi 404* — thiếu `ws: true` trong cấu hình proxy. Không có nó thì proxy chỉ chuyển HTTP, không nâng cấp lên WebSocket.
  - *Chạy ở 5173 thì được, ở 8000 thì trắng* — đường dẫn asset. Đặt `base: '/'` trong `vite.config.ts`.

---

### 8.9 Unit test (Vitest)

`frontend/tests/unit/`. Phase 08 tập trung vào **phân tích message** — phần dễ sai âm thầm nhất.

| File test | Khẳng định |
|---|---|
| `protocol.test.ts` | Phong bì hợp lệ parse được · `v: 2` bị từ chối · thiếu `data` bị từ chối · `type` lạ trả `null` **mà không ném lỗi** · mọi `type` trong `ws-contract.schema.json` đều có mặt trong `protocol.ts` (chống trôi khỏi hợp đồng) |
| `format.test.ts` | `null` → `—` (không phải `0`) · làm tròn 1 chữ số · luôn kèm đơn vị · `climb_rate` âm hiện dấu `-` |
| `store.test.ts` | `applyTelemetry` không đụng `status` · `events` cắt ở 200 · `setConnection` đổi đúng trạng thái |
| `ws.test.ts` | Backoff đúng dãy 1/2/4/8/10 s (dùng `vi.useFakeTimers`) · nhịp tim gửi `ping` mỗi 2 s · 5 s im lặng thì đóng socket · `send()` sinh `id` tăng dần và bọc phong bì đúng |

```powershell
cd frontend
pnpm vitest run
pnpm tsc --noEmit
pnpm build
```

- Kết quả mong đợi: test xanh, `tsc` không lỗi, build thành công.
- Nếu lỗi: *`ws.test.ts` treo* — `vi.useFakeTimers()` phải đặt **trước** khi tạo socket, và phải `vi.advanceTimersByTime()` thay vì `await sleep()`.

---

### 8.10 Nghiệm thu

| # | Bài | Đạt khi |
|---|---|---|
| 1 | Telemetry thật | SITL chạy → mọi ô HUD có số thật, cập nhật mượt ~8 Hz |
| 2 | Đúng một socket | DevTools → Network → WS hiện **đúng 1** kết nối (bẫy `StrictMode`, 8.3.4) |
| 3 | Mất drone | Tắt SITL → ô "Backend ↔ Drone" đỏ trong ~3 s; ô "Trình duyệt ↔ Backend" **vẫn xanh**; EventLog có dòng `link.lost` |
| 4 | Mất backend | Tắt backend → ô một đỏ, có đếm ngược nối lại; bật lại → tự nối trong ≤ 10 s, EventLog ghi "Đã nối lại" |
| 5 | Message hỏng | Dùng `ws_probe --send-garbage` → EventLog ghi cảnh báo, giao diện **không sập** |
| 6 | Bản build | `pnpm build` rồi mở `http://127.0.0.1:8000` — giống hệt bản dev |
| 7 | Không hardcode | `grep -rn "max_alt\|max_velocity\|avoid_margin" frontend/src` chỉ thấy đọc từ `status.limits`, **không** có số nào gõ cứng |

---

## Việc trả về backend

Phase 08 **không** sửa `backend/`. Nếu phát hiện thiếu, ghi vào đây và báo cho phase backend tương ứng:

| Phát hiện | Thuộc phase | Cách báo |
|---|---|---|
| `app.py` còn mount `frontend/` thay vì `frontend/dist/` | 05 §5.3.6 | Ghi vào `plans/PROGRESS.md`, sửa ở nhánh của Phase 05 |
| Hợp đồng thiếu trường UI cần | 05 (SSOT) | Sửa hợp đồng **trước**, rồi `schemas.py`, rồi `protocol.ts` — một commit |
| `ATTITUDE` chậm làm HUD giật | 05 §5.1.4 | Kiểm `SET_MESSAGE_INTERVAL` đã gửi lại sau reconnect chưa |
| Không có `GET /api/events` | 07 §7.8 | Tạm thời để EventLog trống lúc mở trang |

---

## Cổng pass

- [ ] `pnpm tsc --noEmit` không lỗi; `pnpm build` thành công; `pnpm vitest run` xanh.
- [ ] Mở `http://127.0.0.1:8000` (bản build) thấy HUD chạy với dữ liệu SITL thật.
- [ ] DevTools → Network → WS: **đúng một** kết nối (không bị `StrictMode` nhân đôi).
- [ ] Tắt SITL → chỉ ô "Backend ↔ Drone" đỏ; tắt backend → chỉ ô "Trình duyệt ↔ Backend" đỏ. Hai ô độc lập.
- [ ] Nối lại tự động trong ≤ 10 s sau khi backend sống lại; EventLog ghi nhận.
- [ ] Gửi message rác → giao diện không sập, có cảnh báo trong EventLog.
- [ ] `protocol.ts` có dòng ghi nguồn sinh, và test chống-trôi so với `ws-contract.schema.json` đang xanh.
- [ ] `grep -rn "127.0.0.1:8000\|localhost:8000" frontend/src` → **không kết quả** (mọi thứ dùng đường dẫn tương đối).
- [ ] Không có ngưỡng an toàn nào hardcode trong `frontend/src` — tất cả đọc từ `status.limits`.
- [ ] `null` hiện `—`, không có ô nào hiện `0` khi chưa có số đo.
- [ ] `docs/so-tay/08-web-khung-hud.md` đã viết.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| `StrictMode` tạo 2 WebSocket → tab tự giành quyền lái với chính nó, Phase 10 gặp `command_denied` khó hiểu | 4 | 4 | **16** | **Xử lý ngay ở 8.3.4**: singleton + cleanup đúng; cổng pass kiểm bằng DevTools; ghi vào sổ tay vì đây là bẫy kinh điển của React |
| `protocol.ts` trôi khỏi hợp đồng Phase 05 → hai bên hiểu khác nhau, chỉ lộ ra lúc chạy thật | 3 | 5 | **15** | Sinh từ JSON Schema (8.4.1); test chống-trôi (8.9); luật "sửa hợp đồng trước" ghi ngay đầu `protocol.ts` |
| Subscribe cả store → render 8 lần/giây toàn bộ giao diện | 4 | 3 | 12 | Luật 1 ở 8.2; kiểm bằng React DevTools Profiler khi HUD xong |
| Phiên bản npm trong báo cáo đã trôi (báo cáo tự cảnh báo về `vite`/`typescript`) | 4 | 2 | 8 | Chạy `pnpm view <pkg> version` lúc cài; ghim bản thật vào `package.json`; ghi bản đã dùng vào sổ tay |
| Tailwind v4 làm theo hướng dẫn v3 → không class nào ăn | 3 | 3 | 9 | 8.1.3 ghi rõ v4 dùng plugin Vite, không dùng `tailwind.config.js` |
| Thiếu `ws: true` trong proxy → dev không nối được WS mà báo lỗi khó hiểu | 3 | 2 | 6 | 8.8.1 ghi sẵn; mục "nếu lỗi" mô tả đúng triệu chứng |
| Hiện `0` thay vì `—` khi chưa có số đo | 3 | 4 | 12 | Luật 1 ở 8.5; có test trong `format.test.ts` |
| Tên component shadcn đổi (`toast` → `sonner`) | 3 | 1 | 3 | Chạy `shadcn add` không tham số xem danh sách thật trước khi thêm |
| Gộp hai loại kết nối thành một đèn → mất khả năng chẩn đoán | 2 | 3 | 6 | 8.6 tách rõ hai ô; cổng pass kiểm cả hai chiều |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 8.1 Cấu trúc + phụ thuộc + shadcn + bố cục | 2 | Gồm cả việc chốt lại phiên bản thật |
| 8.2 Store zustand | 1 | |
| 8.3 Client WS: nối lại + nhịp tim + bẫy StrictMode | 2.5 | Rủi ro cao nhất phase — làm cẩn thận |
| 8.4 `protocol.ts` sinh từ hợp đồng + zod | 2 | Gồm phương án dự phòng nếu json2ts khó dùng |
| 8.5 HUD (11 ô + chân trời giả) | 2.5 | `StatBlock` dùng lại giúp rút ngắn |
| 8.6 ConnectionBar | 0.5 | |
| 8.7 EventLog + toast | 1 | |
| 8.8 Build + proxy + phục vụ từ FastAPI | 0.5 | |
| 8.9 Vitest 4 file | 1 | |
| 8.10 Nghiệm thu 7 bài | — | Gộp trong các mục trên |
| **Tổng** | **12** | Đường găng: 8.1 → 8.3 → 8.4 → 8.5. Phase 09 bắt đầu được sau 8.4 (cần `protocol.ts` + store) |

## Ghi chú cho sổ tay

Viết vào `docs/so-tay/08-web-khung-hud.md`:

1. **Vì sao Vite chứ không Next.js** — báo cáo §2.1: Next giải bài toán ta không có (SSR, SEO, nhiều trang) và tính phí bằng một tiến trình Node thứ hai. Câu hỏi hay gặp khi bảo vệ.
2. **Dữ liệu đẩy khác dữ liệu hỏi-đáp** — vì sao telemetry dùng zustand + WebSocket chứ không dùng TanStack Query; vì sao **chưa** cài TanStack Query.
3. **Bẫy `StrictMode` mount hai lần** — giải thích React 19 cố tình làm vậy để bắt lỗi dọn dẹp, và vì sao nó nguy hiểm riêng với dự án này (quyền lái).
4. **Hai loại "mất kết nối"** — trình duyệt↔backend và backend↔drone. Vẽ ba hộp hai mũi tên.
5. **Vì sao `null` phải hiện `—`** — "không biết" khác "bằng không". Cùng nguyên tắc với `UNKNOWN` ở backend.
6. **Vì sao không hardcode ngưỡng** — một nguồn sự thật; đổi `.env` của backend là UI đổi theo, không phải sửa hai chỗ.
7. **Hợp đồng và bản dịch** — `protocol.ts` là bản dịch, không phải bản gốc. Sửa bản dịch mà không sửa bản gốc là cách chắc chắn để hai bên hiểu khác nhau.
8. **Nhịp tim của WebSocket** — vì sao "socket đang mở" không chứng minh đường dây còn sống.
9. **Proxy lúc dev là gì** — vì sao nhờ nó mà không có chỗ nào trong code phải biết số cổng.
10. **Phiên bản đã dùng thật** — chép bảng `pnpm list --depth 0` vào sổ tay sau khi cài xong, để sau này dựng lại được đúng môi trường.
