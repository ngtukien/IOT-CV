# Sổ tay 10-web-dieu-khien-obstacle-video

Trang này ghi lại Phase 10, phase cuối của luồng phần mềm trên PC: website lái được
drone bằng **bàn phím** (và tay cầm game nếu có), có nút đổi mode / ARM / cất cánh
**kèm hộp xác nhận đặt đúng chỗ**, có panel **vật cản** nói thật về khả năng tránh,
panel **video** với khung nhận diện vẽ chồng lên, và bộ test **Playwright** chứng
minh dead-man chạy từ trình duyệt tới FC. Mọi số đo là số thật trên SITL ArduCopter
ngày 25/09/2026; lệnh chạy lại nằm ở cuối trang.

## 1. Vì sao không gửi lệnh trong `keydown`

Giữ một phím, hệ điều hành tự bắn `keydown` lặp lại. Nghe như đúng thứ cần cho
"giữ W là bay", nhưng nhịp đó là của **cài đặt bàn phím từng máy**: thường chờ
khoảng 500 ms rồi mới lặp ~30 lần/giây.

```text
bấm W   ─┬─────────── 500 ms im lặng ──────────┬─┬─┬─┬─┬─ (lặp ~30 Hz)
backend  │   hết hạn 300 ms → DEAD-MAN phanh!  │ lại đi
```

500 ms im lặng dài hơn hạn dead-man 300 ms của backend, nên drone sẽ giật khựng một
cái mỗi lần bấm phím. Cách làm đúng là **tách hai việc**:

- bàn phím chỉ đổi **trạng thái**: tập các phím đang giữ;
- **một** `setInterval` 100 ms (10 Hz) là nơi duy nhất gửi `cmd.velocity`.

Thả hết phím thì gửi thêm 3 gói vận tốc 0 (chống rớt gói) rồi im; dead-man của
backend lo phần còn lại. Code: `frontend/src/lib/manualControl.ts`. Test
`manualControl.test.ts` khẳng định `keydown` **không** gửi gì.

Phím được đọc theo **vị trí vật lý** (`KeyboardEvent.code`, ví dụ `KeyW`), không
theo chữ sinh ra (`key`). Với bộ gõ tiếng Việt kiểu Telex, phím W sinh ra chữ `ư`;
đọc theo `key` thì bật Unikey lên là mất phím tiến.

## 2. Bẫy Alt-Tab

Đây là một trong những lỗi nguy hiểm nhất của giao diện lái bằng bàn phím:

```text
giữ W ── drone tiến ── Alt-Tab sang Zalo ── thả W (trên cửa sổ Zalo)
                                            │
                          trình duyệt KHÔNG BAO GIỜ nhận keyup
                          → nó tưởng W vẫn đang giữ → drone bay tiếp
```

Sự kiện `keyup` chỉ tới cửa sổ đang có tiêu điểm. Nên trang bắt thêm `window.blur`
(cửa sổ mất tiêu điểm) và `document.visibilitychange` (tab bị ẩn): quên hết phím
đang giữ và gửi vận tốc 0 **ngay**, không chờ nhịp kế. Dead-man của backend vẫn là
lớp chắn cuối, nhưng không nên để nó phải làm việc này.

Đo trên SITL: giữ W tới 1 m/s, một cửa sổ khác giành tiêu điểm → drone dưới 0,2 m/s
sau **1,06 s** (thời gian phanh của chính máy bay).

Một điều học được khi tự động hoá bài này: **Playwright giả lập tiêu điểm**, trang
nào cũng tưởng mình đang được focus, nên cửa sổ khác giành focus mà trang không nhận
`blur`. Lần chạy đầu đỏ đúng chỗ đó. Phải tắt giả lập qua CDP
(`Emulation.setFocusEmulationEnabled`) và chạy `--headed` thì `blur` mới là sự kiện
thật do hệ điều hành bắn.

## 3. Ba lớp dead-man, nhìn từ phía web

| Chuyện xảy ra | Ai phanh | Bao lâu |
|---|---|---|
| Thả phím | trang web gửi 0 ở nhịp kế | ≤ 100 ms |
| Mất tiêu điểm (Alt-Tab, tab ẩn) | trang web gửi 0 ngay | tức thì |
| **Đóng tab** / rớt mạng | backend thấy socket đóng, gửi 0 ngay | < 50 ms (đo: **6–7 ms**) |
| Trình duyệt treo, socket vẫn mở | backend hết hạn 300 ms, nhịp kế gửi 0 | ≤ 350 ms |
| Backend chết hẳn | ArduPilot tự huỷ lệnh movement | ~3 s |

Test E2E ghi ngưỡng **300 ms** còn Phase 06 ghi **350 ms**, không mâu thuẫn: đó là
**hai đường khác nhau**. Đóng tab đi đường socket-đóng (gửi ngay); đường hết-hạn
(≤ 350 ms) dành cho trình duyệt treo mà socket vẫn mở, và Playwright không tạo ra
được ca đó vì `page.close()` đóng socket sạch sẽ.

## 4. Vì sao đo bằng file log, không bằng giao diện

Bài dead-man đóng tab giữa lúc giữ W. Sau bước đó **không còn trang nào để nhìn**.
Bằng chứng duy nhất là thứ backend ghi: `logs/deadman.jsonl`, một dòng cho mỗi lần
phanh, `ts` là Unix epoch giây (so được với `Date.now()` của Playwright), ghi đồng
bộ và flush ngay (Phase 06 §6.4.4).

```json
{"ts": 1790332201.66, "reason": "web_disconnected", "vx": 0.0, "vy": 0.0, "vz": 0.0, "repeat": 5, "sent": true}
```

Định dạng này là **hợp đồng hai chiều** giữa `backend/mavlink/deadman.py` và
`frontend/tests/e2e/fixtures/readDeadmanLog.ts`. Đổi một bên mà không sửa bên kia thì
test đỏ vì lý do sai, tệ hơn không có test.

## 5. `vz` âm là LÊN

Hệ NED (Bắc – Đông – Xuống) mà ArduPilot dùng có trục Z **hướng xuống**. Nên phím
`R` (lên) gửi `vz = −0,5 × max_velocity`, phím `F` (xuống) gửi `vz = +0,5 ×`. Trông
ngược, nhưng đảo lại cho "hợp lý" là bấm lên thì máy bay đâm xuống đất. Có test riêng
khẳng định `R → vz < 0` (`velocityMapping.test.ts`).

Giữ W + D cùng lúc thì đi chéo với **cùng** tốc độ như giữ W một mình (vector được
chuẩn hoá), không nhanh hơn √2 lần.

## 6. Vì sao WEB CONTROL phải bật tay

`SAFETY.md` mục 4: web không được tự giành quyền. Mở trang, công tắc luôn OFF. Công
tắc chỉ bật được khi mode là GUIDED và backend đang liên lạc với drone; không đủ điều
kiện thì nó xám kèm lý do ("Cần đổi sang GUIDED trước").

Bấm công tắc, nó **không đổi màu ngay**. Nó chờ backend trả `ack done` rồi gửi
`status` mới. Giao diện đổi màu ngay khi bấm còn backend từ chối (ví dụ vì một tab
khác đang giữ quyền) là **nói dối về quyền điều khiển máy bay**. Cùng nguyên tắc cho
mọi nút mode: nút sáng theo `telemetry.mode` mà FC báo, không theo cú bấm.

Phi công gạt RC sang mode khác GUIDED thì backend tự thu quyền, `status` đổi, công
tắc tự tắt. Web không làm gì, và không được cố giành lại. Suốt thời gian web giữ
quyền, một dải đỏ **không đóng được** nằm trên cùng trang, nhắc cách dừng và nhắc
rằng RC luôn thắng.

## 7. Vì sao nút thoát hiểm không hỏi xác nhận

Hỏi xác nhận mọi lệnh thì người dùng học cách bấm OK mà không đọc. Ma sát đặt theo
hậu quả:

| Lệnh | Hỏi? | Vì sao |
|---|---|---|
| ARM | gõ chữ `ARM` | motor bắt đầu quay; hộp nhắc "đã tháo cánh chưa?" |
| TAKEOFF | có | máy bay rời mặt đất |
| AUTO | có, kèm số item và độ cao lớn nhất | máy bay tự đi một quãng |
| DISARM | có, cảnh báo đỏ | đang bay mà tắt motor là rơi |
| STABILIZE | có, cảnh báo đỏ | mode tay, ga lấy từ RC — SITL không có RC là rơi |
| HOLD, RTL, LAND, LOITER… | **không** | đây là nút DỪNG |

Quy tắc gọn: hỏi khi hậu quả là **bắt đầu** một điều gì đó, không hỏi khi hậu quả
là **dừng** một điều gì đó. HOLD là nút to nhất màn hình và có phím tắt `H`.

STABILIZE không có trong bảng của plan; nó được xếp vào nhóm hỏi vì lý do ở bảng.

## 8. Vì sao panel vật cản phải nói mình không tránh được ở AUTO

ArduPilot có hai thứ khác nhau mà người mới hay gộp làm một:

- **AC_Avoid** — "phanh trước vật cản". Chạy ở LOITER, ALT_HOLD, POSHOLD: bạn đẩy cần
  tới trước, FC thấy vật cản gần thì tự hãm lại.
- **Object Avoidance path planner** — "đi vòng qua vật cản". Là thứ duy nhất có tác
  dụng trong AUTO / GUIDED / RTL. Dự án đang **tắt** nó (`OA_TYPE=0`), vì phần cứng chỉ
  có một tia TFmini nhìn thẳng trước — không đủ để lập đường vòng.

Nên ở AUTO/GUIDED/RTL, panel luôn hiện dòng *"Chế độ này KHÔNG tự tránh vật cản"*.
Một panel xanh trong AUTO mà im lặng về điều đó làm người dùng tưởng mình được bảo
vệ đúng ở chỗ họ không được bảo vệ. Một giao diện im lặng về giới hạn của mình là
một giao diện nói dối.

Cùng tinh thần: sơ đồ 8 cung quanh drone vẽ cung **không có dữ liệu bằng gạch chéo
xám**, không vẽ xanh. Với phần cứng thật, 7/8 cung luôn gạch chéo. Vẽ vòng tròn xanh
đầy đủ là gợi ý drone nhìn được 360° — nó không nhìn được.

Trạng thái `avoid_state` (Trống / Gần vật cản / FC đang tránh / Không đọc được)
**do backend tính**; web chỉ tô màu. Web tính lại là tạo ra khả năng hai bên nói khác
nhau về đúng chuyện sống còn.

## 9. Vì sao box nhận diện đi riêng khỏi video

Video đi bằng MJPEG (`<img src="/api/video/stream">`), box đi bằng WebSocket, và một
`<canvas>` trong suốt vẽ box chồng lên ảnh. Nếu backend vẽ box vào ảnh rồi nén lại,
video bị kéo tụt xuống bằng tốc độ AI (3–5 khung/giây); tách ra thì video vẫn chạy
10–44 khung/giây. Cái giá: box trễ hơn hình vài chục ms.

Box là **pixel trong khung gốc** (`width × height` ghi trong chính message), còn ảnh
hiển thị ở cỡ khác. Nên phải quy đổi:

```ts
const sx = canvas.width / detection.width;   // KHÔNG gõ cứng 320 hay 640
```

Quên quy đổi thì box vẫn vẽ ra, chỉ là **lệch chỗ, không gì báo lỗi**. Box cũ hơn
1 s vẽ mờ kèm chữ "box cũ", cũ hơn 3 s xoá hẳn. "Cũ" đo theo lúc trình duyệt **nhận**
message: `frame_ts` là đồng hồ của nguồn video (đếm từ lúc thiết bị khởi động), không
phải giờ thật, nên không so được với đồng hồ trình duyệt.

Mất camera thì panel hiện CAMERA OFFLINE, thử lại mỗi 5 s, và **không làm gì khác**:
không toast đỏ, không khoá nút, không đụng trạng thái kết nối (`SAFETY.md` mục 9).

## 10. Vì sao dùng nguồn video giả

Camera thật vào ở Phase 17, bộ nhận diện thật ở `plans/ai/`. Nguồn giả của Phase 07
(một đoạn video mẫu lặp lại, và một box vuông chạy vòng quanh hình chữ nhật lùi vào
1/16 khung) cho dựng và kiểm panel ngay bây giờ. Box giả không khớp nội dung video —
nó chỉ để kiểm **quy đổi toạ độ**: box phải rộng đúng 19% khung và nằm trong lề 1/16,
ở mọi cỡ cửa sổ.

Đo bằng cách đọc điểm ảnh của canvas: cửa sổ 1600×1000 → canvas 430×323, box
19,3% × 25,4%; cửa sổ 1100×900 → canvas 640×480, box 19,2% × 25,6% (kỳ vọng 19% ×
25,3% cho khung 640×480). Hai cỡ canvas khác nhau, cùng một tỉ lệ box: quy đổi đúng.

## 11. Danh sách chạy tay trước mỗi buổi bay thật

Bộ E2E cần SITL nên **không chạy trên CI**. Đây là bước **bắt buộc chạy tay** trước
mỗi buổi bay thật (chép sang checklist Phase 21):

1. `deadman.spec.ts` — đóng tab giữa lúc giữ W, zero-velocity < 300 ms.
2. `acceptance.spec.ts --headed` — cất cánh, W, thả, mất tiêu điểm, HOLD, căn box,
   mission AUTO.
3. `camera-loss.spec.ts` — mất camera không ảnh hưởng gì khác.
4. `avoid.spec.ts` — panel vật cản đúng ở LOITER và GUIDED.

Bài "RC lấy lại quyền từ web" không làm được trên SITL (không có RC thật); đó là F8
của Phase 21.

## Kết quả nghiệm thu (SITL, 25/09/2026)

| # | Bài | Số đo | Đạt |
|---|---|---|---|
| 1 | Cất cánh từ web | GUIDED → ARM (gõ `ARM`) → TAKEOFF; HUD 5,0 m | ✓ |
| 2 | Giữ W → tiến | 1,00 m/s; dịch 2,1 m hướng 352°, mũi 351° | ✓ |
| 3 | Thả W → dừng | < 0,2 m/s sau 1,31 s | ✓ |
| 4 | Đóng tab → dừng | `web_disconnected` sau 6 ms và 7 ms (2 lần), `sent: true` | ✓ |
| 5 | Mất tiêu điểm → dừng | < 0,2 m/s sau 1,06 s; phím W trên sơ đồ tự nhả | ✓ |
| 6 | Mission từ web | 3 điểm bấm bản đồ → nạp + đọc lại → AUTO (có hỏi) → hết mission, disarm | ✓ |
| 7 | HOLD | LOITER, < 0,2 m/s sau 1,30 s; WEB CONTROL tự tắt | ✓ |
| 8 | Mất camera | giết nguồn video: OFFLINE sau 2,3 s; link, HUD, bản đồ vẫn chạy; LOITER vẫn nhận; nguồn về thì hình về | ✓ |
| 9 | Vật cản | LOITER: OFF → NEAR → ACTIVE (FC phanh); GUIDED: không lần nào ACTIVE, dòng "KHÔNG tự tránh" hiện suốt | ✓ |

## Phiên bản đã dùng

| Thành phần | Phiên bản |
|---|---|
| `@playwright/test` | 1.63.0 (ghim, `pnpm view` ngày 25/09/2026) |
| Chromium của Playwright | theo `playwright install chromium` của bản trên |

## Chạy lại

```powershell
cd frontend
pnpm test          # unit (Vitest)
pnpm typecheck
pnpm lint
pnpm build         # backend phục vụ dist/ ở cổng 8000
```

E2E (xem skill `iot-cv-sitl-nghiem-thu`):

```powershell
wsl -d Ubuntu --exec bash -lc 'cd /mnt/d/Coding/IOT-CV && bash scripts/sitl/sitl-headless.sh start'
$env:MAVLINK_ENDPOINT = "tcp:127.0.0.1:5760"; uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000
cd frontend
pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/deadman.spec.ts --reporter=list
pnpm exec playwright test tests/e2e/acceptance.spec.ts --headed --reporter=list
```

Bài 8 và 9 cần cấu hình khác, lệnh đầy đủ ghi ở đầu `camera-loss.spec.ts` và
`avoid.spec.ts`. Thiếu SITL thì mọi spec tự `skip` kèm lý do, không đỏ.
