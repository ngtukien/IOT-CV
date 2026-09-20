# Phase 21: Bay tự động và bay từ web — F5 Auto, F6 Guided/Auto từ web, F7 web manual, F8 RC override

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 20 | ~18 giờ | Có (drone đã pass Phase 20, ≥ 3 pin 4S, tay FS-i6X, laptop phát hotspot Wi-Fi + Mission Planner + backend + web GCS, ESP32 bridge đã chạy từ Phase 17, kính bảo hộ, kẹp cố định để diễn tập trên bàn, túi chống cháy LiPo) |

## Mục tiêu

Chuyển quyền điều khiển từ tay người sang **phần mềm**, theo bốn bậc, mỗi bậc thêm đúng một thứ mới:

- **F5** — drone bay theo mission do **Mission Planner** (công cụ đã được kiểm chứng) tạo. Thứ mới: chế độ `Auto`.
- **F6** — mission và lệnh `Guided` phát đi từ **web GCS của chính dự án**. Thứ mới: phần mềm tự viết nằm trong đường điều khiển.
- **F7** — điều khiển tay bằng **WASD từ trình duyệt** qua `Guided`. Thứ mới: lệnh vận tốc liên tục + dead-man.
- **F8** — **RC giành lại quyền** khi web đang điều khiển. Thứ mới: chứng minh luật "RC có quyền cao nhất" đúng trên phần cứng thật.

Kết thúc phase: bay tự động và bay từ web đều chạy, `06-auto-good.param` đã lưu, và bài test RC override — bài **bắt buộc** theo `SAFETY.md` mục 4 — đã pass trên drone thật.

> **AN TOÀN — bốn luật của phase này:**
> 1. **RC luôn trong tay người vận hành trong MỌI bài bay có web tham gia** (`SAFETY.md` mục 4). Không có ngoại lệ, kể cả bài F5 vốn không dùng web.
> 2. **Web không tự giành quyền.** `WEB CONTROL ENABLE` là **`CH7` trên tay FS-i6X** và backend đọc thẳng kênh RC đó — người bấm web không tự bật được quyền cho mình. Gạt `CH7` xuống là cắt mọi lệnh từ web ngay lập tức, không cần laptop còn sống.
> 3. **Mỗi bài bay phải được DIỄN TẬP TRÊN BÀN, KHÔNG CÁNH, trước khi bay** (mục 21.2). `SAFETY.md` mục 2 liệt kê rõ: mọi lần test lệnh từ web khi drone còn trên bàn đều là NO PROPELLERS.
> 4. **Không bài nào được bay khi bài trước chưa pass**, và không bài nào được bay khi **diễn tập trên bàn của chính nó** chưa pass.

## Đầu vào cần có

Phải đọc trước:

- `SAFETY.md` — toàn bộ, đặc biệt mục 1 (ai được quyền điều khiển máy bay), 2 (NO PROPELLERS khi test lệnh web trên bàn), 4 (RC quyền cao nhất, `WEB CONTROL ENABLE`, bài RC override là bắt buộc), 5 (dead-man 300 ms và ba bài test), 9 (mất camera/AI không được đổi hành vi bay), 10 (không demo chức năng chưa pass standalone test).
- **HỢP ĐỒNG WS** do Phase 05 định nghĩa — đây là SSOT cho mọi thông điệp giữa backend và web. Phase này **đọc** nó, không sửa.
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` mục 3 — luồng điều khiển: `GUIDED SET_POSITION_TARGET_LOCAL_NED`, `type_mask 0x0DC7`, **lặp ≥ 1 Hz**; dead-man 300 ms; giới hạn an toàn ở backend.
- `plans/reports/260921-research-esp32-bridge-camera.md` mục 4 — tầm Wi-Fi 2,4 GHz (~50–200 m, **chưa xác minh thực địa** trên khung có nhiễu ESC); vì sao `FS_GCS_ENABLE` vẫn để 0; và ghi chú quan trọng: với UDP, **GCS phải gửi gói trước** thì ESP32 mới biết địa chỉ trả lời.
- `docs/checklist-truoc-bay.md` (Phase 19) — đã in.
- `docs/do-dac/20-ket-qua-bay.md` (Phase 20) — 4 bộ số log nền, dùng để so sánh.
- **Ghi chú Phase 15** — bản đồ công tắc: `CH5` = `Stabilize`/`AltHold`/`Loiter`, `CH6` = `RTL`, `CH7` = `WEB CONTROL ENABLE` (backend đọc), `CH8` để dành cho `Auto` và **được gán ở phase này**.
- **Ghi chú Phase 17** — endpoint backend `udpin:0.0.0.0:14550`.

Phải có sẵn và đã pass:

- Phase 20: **F1–F4 đều PASS**, đặc biệt F3 Loiter không toilet bowl và F4 RTL tự về được. `SAFETY.md` mục 10 và nháp cũ GIAI ĐOẠN 54: **không phát triển Auto trước khi RTL pass**.
- Phase 06: **ba bài test dead-man đã pass trên SITL** (`SAFETY.md` mục 5): nhấn `W` → tiến; thả `W` → dừng; **đóng browser khi đang giữ `W` → UAV phải dừng**.
- Phase 07: mission upload/readback/AUTO đã chạy trên SITL; safety state machine có `WEB CONTROL ENABLE`.
- Phase 10: Playwright E2E dead-man pass.
- Phase 17: backend đã đổi từ SITL sang drone thật; web hiện telemetry thật; ESP32 bridge trên SERIAL2 chạy ổn.
- **Ít nhất 3 pin 4S** đã sạc cân bằng — phase này có 4 bài bay cộng diễn tập.
- Người quan sát. Buổi F7 và F8 nên có **ba người**: người lái RC, người bấm web, người quan sát.

## File và thư mục sở hữu

Tạo mới:

- `missions/` — thư mục mới của dự án, chứa file mission xuất từ Mission Planner:
  - `missions/21-f5-3wp.waypoints` — mission 3 waypoint của bài F5.
  - `missions/21-f6-web.waypoints` — mission của bài F6 (xuất lại từ web GCS để đối chiếu).
- `logs/flight_YYYYMMDD_HHMM/` — một thư mục cho mỗi chuyến F5…F8, mỗi thư mục có `flight.bin`, `notes.md`, và thêm `events.json` (log sự kiện của web GCS) so với Phase 20.
- `docs/do-dac/21-ket-qua-bay-web.md` — bảng tổng hợp số liệu 4 bài.
- `docs/so-tay/21-bay-tu-dong-va-web.md` — sổ tay người mới.
- `firmware/ardupilot/params/06-auto-good.param`.

Sửa:

- `plans/PROGRESS.md` — tick checkbox Phase 21.
- `docs/test-log.md` — thêm 4 dòng F5–F8.

**Không đụng:** `backend/`, `frontend/`, `ml/`, `firmware/camera/`, các file param `00`–`05`.

> **Ngoại lệ có điều kiện cho `backend/` và `frontend/`:** nếu một bài bay bị chặn bởi lỗi phần mềm thật (ví dụ dead-man không kích hoạt trên phần cứng thật, hoặc mission readback sai), thì được sửa — nhưng: (a) sửa trong **một commit riêng**, không trộn với commit của phase này; (b) ghi vào `docs/test-log.md` bài nào phát hiện ra lỗi gì; (c) **bắt buộc chạy lại diễn tập trên bàn từ đầu** sau khi sửa, không "sửa xong bay luôn".

## Việc theo thứ tự

### 21.1 Chuẩn bị: hotspot, đăng ký endpoint, và hai công tắc an toàn

**Dựng mạng:**

1. Laptop **phát hotspot Wi-Fi**; hai con ESP32 ở chế độ **STA** nối vào (kiến trúc đã chốt ở `260921-brainstorm-thiet-ke-tong-the.md` mục 2 — một card Wi-Fi laptop **không nối được hai AP cùng lúc**, nên phải như vậy).
2. Kiểm tra ESP32 bridge đã lên: ping được IP của nó.
3. **Endpoint của backend là `udpin:0.0.0.0:14550`** (chốt ở Phase 17). DroneBridge gửi MAVLink về cổng UDP 14550 của laptop; backend lắng nghe ở đó. Nếu đổi cổng thì phải đổi ở cả hai đầu — và nhớ mở cổng trong Windows Firewall (đã làm ở Phase 12).
4. **Đăng ký endpoint UDP:** với UDP, ESP32 **không biết gửi telemetry về đâu cho tới khi GCS gửi gói đầu tiên**. Mission Planner và QGroundControl làm việc này tự động; backend của dự án cũng phải gửi heartbeat. Nếu mở lên mà không thấy telemetry, **đây là nghi phạm số một** — không phải ESP32 hỏng (`260921-research-esp32-bridge-camera.md` mục 4).
5. Xác nhận `FS_GCS_ENABLE` **vẫn = 0**. Wi-Fi 2,4 GHz sẽ rớt lặt vặt; nếu bật, drone sẽ tự RTL giữa chừng chỉ vì laptop mất gói 5 giây.

**Bản đồ công tắc — chốt ở Phase 15, kiểm ở Phase 19 mục 19.5:**

```text
CH5 (3 vị trí)  vị trí 1 = STABILIZE   vị trí 2 = ALTHOLD   vị trí 3 = LOITER
CH6             = RTL
CH7             = WEB CONTROL ENABLE   <- BACKEND ĐỌC THẲNG KÊNH RC NÀY
CH8             = AUTO                 <- GÁN Ở PHASE NÀY (mục 21.3)
```

**Hai công tắc an toàn — cả hai đều nằm trên tay FS-i6X:**

```text
CÔNG TẮC 1 — CH7 = WEB CONTROL ENABLE
  TẮT: backend BỎ QUA mọi lệnh điều khiển từ web. Telemetry vẫn chạy.
  BẬT: backend chấp nhận lệnh mode/arm/takeoff/velocity/mission từ web.
  -> Backend đọc GIÁ TRỊ KÊNH RC, không đọc một nút trên trình duyệt.
     Nghĩa là công tắc cho phép web điều khiển nằm TRONG TAY NGƯỜI LÁI RC.
     Muốn cắt mọi lệnh từ web: gạt CH7 xuống. Không cần laptop, không cần
     Wi-Fi, không cần trình duyệt còn sống.
  -> Giao diện web HIỂN THỊ trạng thái CH7 (để người bấm web biết mình có
     quyền hay không) nhưng KHÔNG đặt được nó.

CÔNG TẮC 2 — CH5 (và CH6)
  Gạt CH5 sang Loiter/Stabilize, hoặc CH6 sang RTL -> ArduPilot đổi mode NGAY.
  Lệnh Guided từ web lập tức vô hiệu, vì Guided không còn là mode hiện tại.
  -> Đây là lớp cuối cùng và là lớp DUY NHẤT không phụ thuộc vào phần mềm
     tự viết, không phụ thuộc Wi-Fi, không phụ thuộc laptop.
```

> **AN TOÀN — hệ quả với `SAFETY.md` mục 4.** Vì cả hai công tắc đều ở trên tay RC, người lái RC là người **duy nhất** trao và thu quyền. Người bấm web **không tự bật được quyền cho mình** — đúng tinh thần "web không được tự giành quyền". Trong mọi bài dưới đây, câu "bật `WEB CONTROL ENABLE`" nghĩa là **người lái RC gạt `CH7` lên sau khi người bấm web xin phép và người lái xác nhận bằng lời**.

**Dead-man 300 ms (bảo đảm thực tế ≤ 350 ms, xem phase-06 §6.4) — nhắc lại cơ chế** (`SAFETY.md` mục 5): backend có timeout **độc lập**; nếu không nhận được lệnh vận tốc mới trong ~300 ms, nó **tự gửi velocity = 0**, không chờ frontend gửi lệnh dừng. Vì vậy đóng browser / rớt Wi-Fi / treo tab đều dẫn tới drone dừng lại, chứ không bay tiếp theo lệnh cuối.

**Phân vai cho phase này:**

```text
NGƯỜI LÁI RC   : cầm RC, mắt LUÔN trên drone, ngón cái trên công tắc mode.
                 KHÔNG nhìn màn hình. Có quyền gạt mode bất cứ lúc nào
                 mà KHÔNG cần hỏi ai.
NGƯỜI BẤM WEB  : ngồi trước laptop, đọc to từng thao tác TRƯỚC khi bấm
                 ("tôi sắp bấm GOTO waypoint 2") và CHỜ người lái RC
                 xác nhận bằng lời. KHÔNG tự bật được quyền cho mình —
                 quyền nằm ở CH7 trên tay người lái.
NGƯỜI QUAN SÁT : nhìn Mission Planner, đọc to độ cao/điện áp/cảnh báo,
                 có quyền hô ABORT.
```

**Kết quả mong đợi:** hotspot chạy, telemetry hiện trên cả Mission Planner và web, `FS_GCS_ENABLE` = 0, ba vai đã phân, cả hai công tắc an toàn đã được chỉ tận tay cho từng người.

**Nếu lỗi:**

- *Web có telemetry nhưng Mission Planner không, hoặc ngược lại:* hai GCS cùng nối vào một luồng MAVLink gây tranh chấp. Dùng `mavp2p` để chia luồng (đã ghi nhận ở `260921-brainstorm-thiet-ke-tong-the.md` mục 3), hoặc chỉ dùng một GCS tại một thời điểm.
- *Không có telemetry ở cả hai:* kiểm tra ESP32 có nối được hotspot không; sau đó kiểm tra mục (3) ở trên — GCS đã gửi gói đầu tiên chưa.

### 21.2 Diễn tập trên bàn — bắt buộc trước MỖI bài

> **AN TOÀN: NO PROPELLERS.** Tháo cả 4 cánh, cất ở phòng khác. Kẹp drone xuống bàn. `SAFETY.md` mục 2 liệt kê "mọi lần test lệnh từ web khi drone còn trên bàn" vào danh sách bắt buộc tháo cánh. Nháp cũ GIAI ĐOẠN 61, 62 làm đúng như vậy.

Diễn tập trên bàn trả lời một câu hỏi duy nhất: **"phần mềm có gửi đúng lệnh mà tôi nghĩ nó gửi không?"** Bạn xác nhận điều đó bằng cách nhìn **Mission Planner** (công cụ độc lập, không phải phần mềm của mình) chứ không nhìn giao diện web của chính mình.

**Quy trình chung — lặp lại y hệt trước mỗi bài F5, F6, F7, F8:**

```text
1. Tháo 4 cánh. Kẹp drone xuống bàn. Cắm pin. Bật tay FS-i6X trước.
2. Mở Mission Planner (qua USB hoặc Wi-Fi) VÀ web GCS cùng lúc.
3. Thực hiện ĐÚNG chuỗi thao tác mà bài bay sẽ dùng, không rút gọn bước nào.
4. Sau MỖI thao tác, xác nhận trên MISSION PLANNER (không phải trên web):
   - đổi mode  -> tên mode ở góc dưới trái HUD đổi đúng
   - upload mission -> Mission Planner -> Flight Plan -> "Read WPs"
                       phải ĐỌC RA ĐÚNG mission vừa upload
   - lệnh Guided -> tab Status: nx/ny/nz hoặc các trường target đổi;
                    motor phản ứng (ở đây chỉ thấy idle vì drone chưa bay)
5. Ghi lại: thao tác nào KHÔNG ra kết quả mong đợi -> sửa TRƯỚC khi ra bãi.
6. Rút pin. CHỈ khi đó mới lắp lại cánh.
```

**Ba bài dead-man phải chạy lại trên phần cứng thật** trước F7 (đã pass trên SITL ở Phase 06, nhưng SITL không có Wi-Fi rớt và không có độ trễ thật):

```text
Dead-man 1: nhấn giữ W  -> Mission Planner tab Status hiện target velocity > 0
Dead-man 2: thả W        -> target velocity về 0 trong <= 0,5 giây
Dead-man 3: nhấn giữ W rồi ĐÓNG HẲN TAB BROWSER
            -> target velocity về 0 trong <= 0,5 giây, KHÔNG cần thao tác gì thêm
Dead-man 4 (thêm cho phần cứng thật): nhấn giữ W rồi TẮT WI-FI CỦA LAPTOP
            -> target velocity về 0. Đây là kịch bản thật hay xảy ra nhất.
```

**Kết quả mong đợi:** mọi thao tác của bài sắp bay đều ra đúng kết quả trên Mission Planner; 4 bài dead-man đều pass trên phần cứng thật.

**Nếu lỗi:** *dead-man 3 hoặc 4 không pass trên phần cứng thật dù đã pass trên SITL:* timeout đang phụ thuộc vào một sự kiện của frontend (ví dụ `onclose` của WebSocket) thay vì một bộ đếm độc lập ở backend. **Đây là lỗi chặn — không bay F7 cho tới khi sửa xong và diễn tập lại từ đầu.**

### 21.3 Bài F5 — Auto mission 3 waypoint, tạo bằng Mission Planner

**Mục tiêu:** chứng minh chế độ `Auto` chạy đúng trên drone này, **dùng công cụ đã được kiểm chứng**. Nếu mission bằng Mission Planner không ổn thì web chắc chắn không cứu được (nháp cũ GIAI ĐOẠN 55).

**Điều kiện tiên quyết:** F4 RTL đã PASS; diễn tập trên bàn của F5 đã pass (upload + `Read WPs` đọc ra đúng).

**Quy tắc thiết kế mission cho bài đầu tiên:**

```text
1. LỆNH ĐẦU TIÊN LÀ TAKEOFF       — NAV_TAKEOFF, độ cao 5 m
2. ĐỘ CAO MỌI WAYPOINT: 5-10 m    — cao hơn mọi vật cản, thấp hơn FENCE_ALT_MAX (30 m)
3. LỆNH CUỐI CÙNG LÀ RTL          — không bao giờ để mission kết thúc lơ lửng
4. KHOẢNG CÁCH GIỮA CÁC WP: 10-15 m, TẤT CẢ nằm trong FENCE_RADIUS (50 m)
   trừ đi ít nhất 10 m biên -> mọi WP trong bán kính 40 m quanh home
5. HÌNH DẠNG: tam giác hoặc đường gấp khúc đơn giản. KHÔNG bắt đầu bằng
   hình phức tạp; "square 4 waypoint" để dành cho lần sau.
6. TỐC ĐỘ: WPNAV_SPEED = 200 (cm/s = 2 m/s) cho bài đầu.  <-- chưa xác minh,
   mặc định ArduPilot cao hơn nhiều. Chậm để kịp nhìn và kịp can thiệp.
7. BÁN KÍNH TỚI ĐÍCH: WPNAV_RADIUS = 200 (cm = 2 m), mặc định. Đây là khoảng
   cách mà ArduPilot coi là "đã tới waypoint" và chuyển sang WP tiếp theo.
8. MỌI WAYPOINT PHẢI NHÌN THẤY ĐƯỢC từ chỗ người lái đứng.
```

**Gán `CH8` = `Auto` — việc riêng của phase này:**

Phase 15 để `CH8` trống có chủ đích: một công tắc `Auto` sống trong khi chưa có mission nào được kiểm chứng là một đường vào `Auto` ngoài ý muốn. Bây giờ mới gán:

```text
RC8_OPTION = <giá trị "Auto" trong danh sách RCx_OPTION>   <-- chưa xác minh,
             ĐỌC danh sách ngay trong Mission Planner (Full Parameter List ->
             gõ RC8_OPTION -> xem hộp mô tả liệt kê từng giá trị) thay vì
             gõ theo một con số nhớ được.
```

Sau khi gán, **kiểm trên bàn, không cánh**: gạt `CH8` lên → Mission Planner phải hiện mode `AUTO`; gạt xuống → quay về mode mà `CH5` đang chỉ. Chỉ khi phép thử này đúng mới mang ra bãi.

> **AN TOÀN:** Từ lúc `CH8` được gán, gạt nhầm nó khi đang bay sẽ **chạy mission đang nạp trong bo bay**. Luôn biết mission nào đang nằm trong bo. Sau mỗi buổi bay, nếu không chắc, upload lại một mission đơn giản `Takeoff → RTL` để bo không giữ một mission cũ đã quên.

**Quy trình bay — cất cánh bằng tay trước, rồi mới vào Auto:**

Dự án này **không** dùng cách "arm ở mode Auto rồi đẩy ga để mission tự cất cánh". Lý do: cách đó đưa drone vào tay phần mềm ngay từ giây đầu tiên, đúng lúc rủi ro cao nhất. Thay vào đó cất cánh bằng tay tới độ cao an toàn rồi mới trao quyền — người lái giữ quyền cho tới phút chót và đã biết chắc drone bay bình thường hôm đó.

1. Tạo mission trong Mission Planner → `Flight Plan`, theo 8 quy tắc trên.
2. `Write WPs` để upload. Rồi **`Read WPs`** để đọc lại — **đối chiếu từng dòng**. Upload mà không readback là upload mù.
3. `Save WP File` → lưu thành `missions/21-f5-3wp.waypoints`.
4. Chạy checklist walk-around (`docs/checklist-truoc-bay.md`).
5. Arm ở `Loiter` (`CH5` vị trí 3), cất cánh bằng tay lên **5 m**, giữ ổn định 10 giây. Xác nhận drone bay bình thường (giống F3).
6. **Gạt `CH8` sang `Auto`.** Buông cần.
7. **Không chạm cần.** Quan sát drone đi WP1 → WP2 → WP3 → RTL → hạ cánh.
8. Nếu tất cả bình thường: để drone tự hạ cánh và disarm.

**Cái cần nhìn:**

```text
[ ] Drone chuyển sang WP1 ngay khi gạt Auto, không đứng lại phân vân
[ ] Đường bay giữa các WP THẲNG, không vòng vèo
[ ] Tới gần mỗi WP thì chậm lại rồi chuyển hướng sang WP kế tiếp
[ ] Độ cao giữ đúng mức đã đặt
[ ] Ở WP cuối, tự chuyển sang RTL và bay về
[ ] Trên Mission Planner, waypoint đang hướng tới được tô sáng đúng
```

**Tiêu chí ABORT — gạt ngay sang `Loiter`** (drone sẽ đứng lại tại chỗ, vẫn giữ độ cao):

- Drone bay về hướng **không có waypoint nào**.
- Drone đi ra ngoài khu vực đã định, hoặc tiến về phía vật cản/người.
- Drone không chuyển sang WP tiếp theo dù đã tới nơi (kẹt mission).
- Bất kỳ ai hô ABORT.

> `Loiter` là nút dừng khẩn của phase này: nó **giữ nguyên độ cao và vị trí**, cho bạn thời gian suy nghĩ. `RTL` là nút thoát thứ hai. `Stabilize` là lớp cuối — dùng khi mọi thứ khác không đáp ứng, nhưng nó đòi bạn phải lái tay hoàn toàn.

**Tiêu chí PASS:**

- [ ] Drone tự đi đủ 3 waypoint theo đúng thứ tự, rồi RTL và hạ cánh, **không cần can thiệp**.
- [ ] `Read WPs` sau chuyến bay vẫn đọc ra đúng mission đã upload.
- [ ] Log: đường bay `POS` bám sát đường mission; không `ERR`; VIBE/EKF/compass vẫn trong ngưỡng như Phase 20 mục 20.2.

**Sau chuyến:** quy trình đọc log đầy đủ như Phase 20 mục 20.2, cộng thêm: so đường bay thật với mission đã thiết kế, ghi độ lệch lớn nhất.

### 21.4 Bài F6 — Guided goto và Auto phát đi từ web GCS

**Mục tiêu:** đưa **phần mềm tự viết** vào đường điều khiển lần đầu tiên trên không.

**Điều kiện tiên quyết:** F5 PASS; diễn tập trên bàn của F6 pass (upload mission từ web → Mission Planner `Read WPs` đọc ra **đúng** mission đó).

**Thiết kế mission cho web:** giống hệt 8 quy tắc ở 21.3. Bài đầu từ web nên **dùng lại đúng hình dạng của F5** — như vậy nếu drone bay khác đi, khác biệt chắc chắn nằm ở phần mềm chứ không ở mission.

**Quy trình:**

1. Chạy checklist walk-around. Mở web GCS. **`CH7` (`WEB CONTROL ENABLE`) đang TẮT** — web hiển thị "không có quyền".
2. Trên web: vẽ mission (cùng hình với F5) → `Upload` → **`Readback`**. Web phải hiện lại đúng mission.
3. Xác nhận chéo bằng Mission Planner: `Read WPs` → đúng mission đó. Lưu thành `missions/21-f6-web.waypoints`.
4. Arm ở `Loiter` **bằng RC**, cất cánh bằng tay lên **5 m**, giữ ổn định 10 giây.
5. **Người bấm web đọc to:** "xin bật WEB CONTROL ENABLE". **Người lái RC gạt `CH7` lên** và đáp to "CH7 đã bật". Web phải đổi hiển thị sang "có quyền".
6. **Phần Guided trước:** trên web bấm `GOTO` một điểm cách **10 m**, cùng độ cao.
   - Người lái RC: ngón cái **trên** công tắc mode, mắt trên drone.
   - Drone phải đi tới điểm đó rồi **đứng lại**.
   - Lặp lại với một điểm khác, cách 10 m về hướng khác.
7. **Phần Auto sau:** trên web bấm `Start Mission` (đổi mode sang `Auto` **từ web**, không dùng `CH8` — bài này kiểm đường lệnh của web).
   - Drone chạy đủ mission như F5 rồi RTL.
8. Sau khi hạ cánh và disarm: **người lái RC gạt `CH7` xuống**.

**Cái cần nhìn:**

```text
[ ] Lệnh GOTO có độ trễ nhìn thấy được không? Bao nhiêu giây từ lúc bấm
    tới lúc drone bắt đầu đi? (ghi vào notes.md — đây là số liệu cho báo cáo IoT)
[ ] Drone dừng ĐÚNG ở điểm đã bấm, không vọt qua nhiều
[ ] Mode hiển thị trên web KHỚP với mode hiển thị trên Mission Planner
[ ] Telemetry trên web có bị đứng/nhảy cóc không (dấu hiệu rớt Wi-Fi)
[ ] Event log trên web ghi nhận đủ từng lệnh đã gửi
```

**ABORT:** drone đi sai hướng so với điểm đã bấm, hoặc không dừng lại khi đã tới → **người lái gạt `Loiter` ngay**, rồi người bấm web tắt `WEB CONTROL ENABLE`. Thứ tự này quan trọng: **phần cứng trước, phần mềm sau**.

**Tiêu chí PASS:**

- [ ] 2 lệnh `GOTO` đều tới đúng điểm và dừng lại.
- [ ] Mission từ web chạy đủ và RTL, kết quả giống F5.
- [ ] Mission readback (cả trên web lẫn trên Mission Planner) khớp với mission đã vẽ.
- [ ] Không phải ABORT.
- [ ] `events.json` của web ghi nhận đủ chuỗi lệnh; đối chiếu được với log `.bin` theo dấu thời gian.

**Sau chuyến:** quy trình 20.2, cộng lưu `events.json` vào thư mục log của chuyến.

### 21.5 Bài F7 — điều khiển tay bằng WASD từ web, 0,5 m/s rồi 1,0 m/s

**Mục tiêu:** chứng minh vòng lệnh vận tốc liên tục + dead-man hoạt động trên phần cứng thật.

**Điều kiện tiên quyết:** F6 PASS; **4 bài dead-man ở 21.2 đều pass trên phần cứng thật**.

> **AN TOÀN:** Đây là bài mà phần mềm gửi lệnh **liên tục** (≥ 1 Hz), chứ không phải một lệnh rồi thôi. Nếu có lỗi trong vòng lặp đó, drone sẽ bay liên tục theo hướng sai. Ba lớp bảo vệ: dead-man 300 ms (bảo đảm thực tế ≤ 350 ms, xem phase-06 §6.4) ở backend, `WEB CONTROL ENABLE`, và công tắc mode trên RC. Cả ba đều phải được thử tay trước khi bay.

**Quy trình:**

1. Walk-around. `CH7` TẮT.
2. **Đặt tốc độ trên web = 0,5 m/s.** Xác nhận con số hiển thị đúng trước khi cất cánh.
3. Arm ở `Loiter` bằng RC, cất cánh bằng tay lên **3 m** (thấp hơn F5/F6 — bài này drone sẽ di chuyển theo lệnh liên tục, cần gần và thấp).
4. Giữ ổn định 10 giây ở `Loiter`.
5. Người bấm web xin quyền; **người lái RC gạt `CH7` lên**. Đổi sang `Guided` **từ web**.
6. **Lệnh đầu tiên phải RẤT NGẮN:** nhấn `W` **đúng 1 giây rồi thả**. Drone tiến một đoạn ngắn rồi dừng.
   - Nếu drone **không dừng khi thả** → người lái gạt `CH5` về `Loiter` ngay **và** gạt `CH7` xuống; kết thúc bài, sửa dead-man.
7. Lần lượt thử từng phím, mỗi phím giữ 1 giây rồi thả, **chờ drone đứng hẳn giữa các lần**:

```text
W = tiến    S = lùi    A = sang trái    D = sang phải
R = lên     F = xuống
(tên phím theo nháp cũ GIAI ĐOẠN 64; phím thật lấy theo giao diện Phase 10)
```

8. Khi cả 6 phím đều đúng hướng và đều dừng được: thử giữ **3 giây** cho mỗi hướng.
9. **Chỉ khi toàn bộ bước 7–8 mượt:** tăng tốc độ lên **1,0 m/s**, lặp lại bước 7 với thời gian giữ 1 giây.
10. **Test dead-man trên không — có kế hoạch, không phải tai nạn:** người lái RC **ngón cái đặt sẵn trên công tắc mode**, drone ở chỗ trống cách mọi vật ≥ 10 m. Người bấm web đọc to "tôi sắp thả tay khỏi bàn phím và rời chuột" rồi **giữ `W` 1 giây và thả tay hoàn toàn**. Drone phải dừng.
11. Người lái gạt `CH7` xuống, rồi gạt `CH5` về `Loiter`, hạ cánh bằng tay, disarm.

> **AN TOÀN:** **Không thử tốc độ 5 m/s.** Nháp cũ GIAI ĐOẠN 64 nói rõ: bắt đầu 0,5 m/s, khi đã ổn thì 1 m/s. Ở 1 m/s bạn có thời gian phản ứng; ở 5 m/s drone đi 5 m trong lúc bạn còn đang nhận ra là sai.

**Cái cần nhìn:**

```text
[ ] Mỗi phím đi ĐÚNG hướng so với MŨI DRONE (không phải so với người nhìn)
    -> Guided velocity trong hệ LOCAL_NED bám theo hướng mũi; nếu drone
       xoay mũi thì "tiến" cũng đổi hướng theo. Nói rõ điều này với người
       bấm web TRƯỚC khi bay.
[ ] Thả phím -> drone dừng trong <= 1 giây
[ ] Không trôi tiếp sau khi dừng
[ ] Độ trễ từ lúc bấm phím tới lúc drone nhúc nhích (ghi vào notes.md)
[ ] Telemetry trên web không đứng khi đang gửi lệnh liên tục
```

**ABORT:** drone không dừng khi thả phím, hoặc đi sai hướng, hoặc telemetry đứng quá 2 giây → **người lái gạt `CH5` về `Loiter` ngay, rồi gạt `CH7` xuống**. Thứ tự: mode trước (dừng drone), quyền sau (chặn nguồn lệnh).

**Tiêu chí PASS:**

- [ ] 6 hướng đúng và dừng được ở 0,5 m/s **và** ở 1,0 m/s.
- [ ] Test dead-man trên không (bước 10) pass: thả tay → drone dừng.
- [ ] Không phải ABORT.
- [ ] Log: các đoạn di chuyển ngắn, dứt khoát; không có đoạn nào drone bay tiếp sau khi lệnh ngừng.

### 21.6 Bài F8 — RC giành lại quyền khi web đang điều khiển

**Mục tiêu:** chứng minh trên phần cứng thật rằng **RC có quyền cao nhất**. `SAFETY.md` mục 4 gọi bài này là **bắt buộc** trước khi bay web-guided thật. Về mặt trình tự thì nó nằm sau F7, nhưng về mặt ý nghĩa nó là bài quan trọng nhất của cả phase.

**Điều kiện tiên quyết:** F7 PASS; diễn tập trên bàn của F8 pass (trên bàn: web gửi lệnh Guided, gạt công tắc mode → Mission Planner phải hiện mode mới và lệnh web ngừng có tác dụng).

**Quy trình:**

1. Walk-around. Tốc độ web đặt **0,5 m/s**.
2. Arm ở `Loiter` bằng RC, cất cánh lên **3 m**.
3. Người lái RC gạt `CH7` lên, người bấm web đổi sang `Guided` từ web.
4. **Người bấm web nhấn và GIỮ `W`.** Drone bắt đầu tiến chậm.
5. **Trong lúc drone đang tiến và web vẫn đang giữ `W`:** người lái RC **gạt `CH5` sang `Loiter`**. (Chưa đụng `CH7` — bài này phải chứng minh rằng **chỉ riêng việc đổi mode** đã đủ giành lại quyền, kể cả khi web vẫn còn quyền gửi lệnh.)
6. Quan sát:

```text
KẾT QUẢ ĐÚNG:
  [ ] Drone DỪNG NGAY và giữ vị trí, mặc dù web vẫn đang giữ W
  [ ] Mission Planner hiện mode LOITER
  [ ] Web hiện mode LOITER (nếu web hiện GUIDED thì web đang hiển thị sai,
      ghi lại — đây là lỗi hiển thị, không phải lỗi điều khiển, nhưng
      vẫn phải sửa vì nó đánh lừa operator)
  [ ] Người bấm web THẢ W. Không có gì thay đổi (drone đã ở Loiter).
```

7. **Người lái RC gạt `CH7` xuống** — đây là lớp thứ hai, kiểm riêng sau khi lớp thứ nhất đã chứng minh xong.
8. Người lái gạt `CH5` sang `Stabilize` và **lái tay bình thường** một vòng ngắn — chứng minh quyền đã về hoàn toàn với RC.
9. Gạt `Loiter`, hạ cánh, disarm.

**Biến thể bắt buộc thử thêm (cùng chuyến hoặc chuyến kế tiếp):**

```text
Biến thể A: web đang giữ W  ->  RC gạt CH6 (RTL)
            KẾT QUẢ ĐÚNG: drone dừng tiến và bắt đầu quy trình RTL

Biến thể B: web đang chạy Auto (mission) -> RC gạt CH5 sang Loiter
            KẾT QUẢ ĐÚNG: mission tạm dừng, drone đứng yên.
            Gạt CH8 (Auto) -> mission TIẾP TỤC từ waypoint đang dở.
            (Nắm được hành vi này để không hoảng khi nó xảy ra thật.)
```

**ABORT:** nếu gạt mode mà drone **vẫn tiếp tục đi theo lệnh web** → đây là lỗi nghiêm trọng nhất có thể có trong dự án. Gạt `CH7` xuống ngay (cắt nguồn lệnh), gạt `CH5` về `Stabilize`, hạ ga về giữa, hạ cánh ngay, **kết thúc buổi bay**. Không bay lại cho tới khi hiểu và sửa xong nguyên nhân.

**Tiêu chí PASS:**

- [ ] Gạt `CH5` khi web đang giữ `W` (**chưa đụng `CH7`**) → drone dừng ngay, mode đổi đúng trên cả Mission Planner lẫn web.
- [ ] Biến thể A (sang `RTL`) đúng.
- [ ] Biến thể B (tạm dừng và tiếp tục `Auto`) đúng.
- [ ] Sau khi tắt `WEB CONTROL ENABLE`, lái tay ở `Stabilize` bình thường.
- [ ] Log: có thể thấy rõ thời điểm đổi mode và thời điểm drone ngừng bám lệnh vận tốc, **cách nhau dưới 1 giây**.

> **AN TOÀN — cổng pass cứng:** **F8 phải PASS trước mọi buổi demo có web điều khiển**, kể cả demo cho môn học. `SAFETY.md` mục 4 và mục 10.

### 21.7 Đối chiếu bằng chứng từ log

Ngoài 7 mục của Phase 20 mục 20.2, phase này kiểm thêm 4 mục về đường điều khiển phần mềm:

```text
8. ĐỔI MODE
   Đồ thị/bảng: MODE (tên mode và thời điểm đổi)
   Kiểm : mỗi lần đổi mode trong log KHỚP với một dòng trong events.json
          của web hoặc với một thao tác đã ghi trong notes.md.
          Mode đổi mà KHÔNG ai ra lệnh -> failsafe đã kích hoạt, phải tìm ra
          vì sao (thường là RC hoặc pin).

9. LỆNH GUIDED
   Kiểm : trong các đoạn Guided, drone chỉ di chuyển khi có lệnh,
          và DỪNG trong <= 1 giây sau lệnh cuối. Không có đoạn "trôi tiếp".

10. ĐỘ TRỄ ĐƯỜNG LỆNH (số liệu cho báo cáo IoT)
    Cách đo: lấy dấu thời gian của lệnh trong events.json (giờ laptop)
             trừ đi thời điểm drone bắt đầu phản ứng trong flight.bin.
    Lưu ý: hai đồng hồ khác nhau -> con số này là ƯỚC LƯỢNG, không phải
    phép đo chính xác. Ghi rõ điều đó khi đưa vào báo cáo.

11. CHẤT LƯỢNG LINK WI-FI
    Kiểm : telemetry có khoảng trống (gap) nào không, dài bao nhiêu.
    Ghi lại khoảng cách xa nhất mà link vẫn ổn -> đây là số liệu thực địa
    đầu tiên của dự án cho tầm Wi-Fi 2,4 GHz (tài liệu công bố ~50-200 m
    là điều kiện lý tưởng, CHƯA XÁC MINH trên khung có nhiễu ESC).
```

Điền tất cả vào `docs/do-dac/21-ket-qua-bay-web.md`.

### 21.8 Lưu `06-auto-good.param` và ghi kết quả

**Thời điểm lưu:** sau khi **F8 PASS** (tức là cả 4 bài đã xong).

```text
Mission Planner -> CONFIG -> Full Parameter List -> Save to file
-> firmware/ardupilot/params/06-auto-good.param
```

Commit với prefix `param:`, ghi rõ đã đổi gì so với `05-loiter-good.param`:

```text
param: 06-auto-good — sau khi F5-F8 pass

- WPNAV_SPEED  : 200 cm/s cho bai dau (chua xac minh, tang dan sau)
- WPNAV_RADIUS : 200 cm
- <cac tham so khac da doi khi xu ly loi, kem ly do>
- FS_GCS_ENABLE: VAN GIU 0 (Wi-Fi 2.4GHz con rot lat vat)
```

Ghi `docs/test-log.md`: 4 dòng `F5`–`F8`, mỗi dòng `PASS`/`FAIL` + một câu. Đặc biệt ghi rõ **F8 đã pass ngày nào** — đó là điều kiện `SAFETY.md` mục 4 đòi hỏi trước mọi demo có web.

## Cổng pass

- [ ] **Diễn tập trên bàn (không cánh) đã chạy cho CẢ BỐN bài** F5, F6, F7, F8, và mọi thao tác đều ra đúng kết quả **xác nhận trên Mission Planner**.
- [ ] **4 bài dead-man trên phần cứng thật đều pass**: giữ `W` → tiến; thả `W` → dừng; **đóng tab browser khi đang giữ `W` → dừng**; **tắt Wi-Fi laptop khi đang giữ `W` → dừng**.
- [ ] **F5 PASS:** mission 3 waypoint tạo bằng Mission Planner chạy đủ rồi RTL, không can thiệp; `Read WPs` khớp với mission đã upload; đã lưu `missions/21-f5-3wp.waypoints`.
- [ ] **F6 PASS:** 2 lệnh `GOTO` từ web tới đúng điểm và dừng; mission upload từ web chạy đủ rồi RTL; readback khớp trên **cả web lẫn Mission Planner**; đã lưu `missions/21-f6-web.waypoints`.
- [ ] **F7 PASS:** 6 hướng WASD/RF đúng và dừng được ở **0,5 m/s** và ở **1,0 m/s**; test dead-man trên không (thả tay khỏi bàn phím) → drone dừng.
- [ ] **F8 PASS:** web đang giữ `W` + RC gạt mode → **drone dừng ngay**, mode đổi đúng trên cả hai màn hình; biến thể A (`RTL`) đúng; biến thể B (`Auto` tạm dừng rồi tiếp tục) đúng; sau khi tắt `WEB CONTROL ENABLE` thì lái tay ở `Stabilize` bình thường.
- [ ] **RC nằm trong tay người vận hành trong cả 4 bài**, kể cả F5.
- [ ] `CH7` (`WEB CONTROL ENABLE`) **mặc định TẮT**; backend đọc kênh RC này, không đọc nút trên trình duyệt; web chỉ **hiển thị** trạng thái, không đặt được.
- [ ] `RC8_OPTION` đã gán `Auto` và đã kiểm trên bàn không cánh (gạt `CH8` → Mission Planner hiện `AUTO`; gạt xuống → về mode của `CH5`).
- [ ] Endpoint backend `udpin:0.0.0.0:14550` nhận được telemetry sau khi backend gửi gói đầu tiên.
- [ ] Đủ **4 thư mục** `logs/flight_YYYYMMDD_HHMM/` cho F5–F8, mỗi thư mục có `flight.bin`, `notes.md`, và `events.json` (với F6, F7, F8).
- [ ] 7 mục đọc log của Phase 20 mục 20.2 **cộng** 4 mục 8–11 ở mục 21.7 đã kiểm và ghi vào `docs/do-dac/21-ket-qua-bay-web.md`.
- [ ] Trong log, **mọi lần đổi mode đều truy ngược được** về một thao tác đã ghi trong `events.json` hoặc `notes.md` — không có lần đổi mode nào không giải thích được.
- [ ] Trong mọi đoạn `Guided`, drone **dừng trong ≤ 1 giây** sau lệnh cuối; không đoạn nào bay tiếp.
- [ ] `FS_GCS_ENABLE` **vẫn = 0**.
- [ ] Đã ghi lại khoảng cách xa nhất mà link Wi-Fi còn ổn (số liệu thực địa đầu tiên cho tầm 2,4 GHz).
- [ ] `firmware/ardupilot/params/06-auto-good.param` đã lưu và commit với prefix `param:`.
- [ ] `docs/test-log.md` có đủ 4 dòng F5–F8, ghi rõ ngày F8 pass.
- [ ] `docs/so-tay/21-bay-tu-dong-va-web.md` đã viết xong.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Lỗi vòng lặp lệnh vận tốc → drone bay liên tục theo hướng sai | 3 | 5 | **15** | Ba lớp độc lập: dead-man 300 ms (bảo đảm thực tế ≤ 350 ms, xem phase-06 §6.4) ở backend, `WEB CONTROL ENABLE`, công tắc mode RC. Cả ba thử tay ở 21.2 trước khi bay; F7 bắt đầu bằng lệnh 1 giây ở 0,5 m/s, độ cao 3 m |
| RC **không** giành lại được quyền khi web đang điều khiển | 2 | 5 | **10** | F8 là bài bắt buộc, có biến thể A và B; diễn tập trên bàn trước; tiêu chí ABORT riêng: kết thúc buổi bay ngay và không bay lại cho tới khi hiểu nguyên nhân |
| Dead-man pass trên SITL nhưng fail trên phần cứng thật (timeout phụ thuộc sự kiện frontend) | 3 | 5 | **15** | Bốn bài dead-man chạy lại trên phần cứng thật ở 21.2, **thêm** bài "tắt Wi-Fi laptop" mà SITL không có; đây là lỗi chặn F7 |
| Mission upload sai mà không biết (không readback) | 3 | 4 | 12 | Bắt buộc `Read WPs` sau mỗi upload, và xác nhận chéo bằng Mission Planner với mission từ web; lưu file `.waypoints` để đối chiếu |
| Rớt Wi-Fi giữa bài web → mất telemetry, người bấm web mất tầm nhìn | 4 | 3 | 12 | `FS_GCS_ENABLE` = 0 nên drone **không** đổi hành vi khi mất link; RC vẫn điều khiển được; người lái không phụ thuộc màn hình |
| Người bấm web và người lái RC ra lệnh mâu thuẫn cùng lúc | 3 | 4 | 12 | Phân vai rõ ở 21.1; người bấm web **đọc to trước khi bấm**; người lái RC có quyền gạt mode không cần hỏi; "phần cứng trước, phần mềm sau" khi ABORT |
| Nhầm hướng WASD (lệnh theo mũi drone, không theo hướng người nhìn) | 4 | 3 | 12 | Nói rõ với người bấm web trước khi bay (mục 21.5); mỗi phím thử 1 giây rồi thả; bay ở 3 m và gần |
| Mission đưa drone ra ngoài tầm nhìn hoặc ra ngoài geofence | 2 | 4 | 8 | 8 quy tắc thiết kế mission ở 21.3 (mọi WP trong bán kính 40 m, mọi WP phải nhìn thấy được, `WPNAV_SPEED` 2 m/s) |
| Hai GCS (Mission Planner + web) tranh chấp một luồng MAVLink | 3 | 2 | 6 | Dùng `mavp2p` để chia luồng, hoặc chỉ một GCS tại một thời điểm; phát hiện ở 21.1 |
| Web hiển thị mode sai so với thực tế → operator tưởng đang điều khiển được | 2 | 4 | 8 | F8 kiểm tra **đối chiếu mode trên cả hai màn hình**; sai lệch là lỗi phải sửa dù không ảnh hưởng điều khiển |
| Sửa code backend giữa buổi rồi bay luôn không diễn tập lại | 3 | 4 | 12 | Ngoại lệ có điều kiện ở mục "File sở hữu" bắt buộc chạy lại diễn tập từ đầu sau mỗi lần sửa |
| Hết pin giữa bài dài (F6 có cả Guided lẫn Auto) | 3 | 3 | 9 | Mang ≥ 3 pin; chia F6 thành hai chuyến nếu điện áp xuống dưới 15,0 V sau phần Guided |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 21.1 Dựng hotspot, kiểm endpoint, phân vai | 1,0 | |
| 21.2 Diễn tập trên bàn lần đầu + 4 bài dead-man | **2,5** | Các lần diễn tập sau chỉ còn ~0,5 giờ/bài |
| 21.3 F5 Auto bằng Mission Planner + đọc log | 2,5 | Gồm thiết kế mission và readback |
| 21.4 F6 Guided + Auto từ web + đọc log | 3,0 | Bài dài nhất; có thể phải chia hai chuyến |
| 21.5 F7 web manual WASD + đọc log | 2,5 | Hai mức tốc độ, sáu hướng, cộng test dead-man trên không |
| 21.6 F8 RC override + 2 biến thể + đọc log | 2,0 | |
| 21.7 Đối chiếu log, điền bảng 11 mục | 1,0 | |
| 21.8 Lưu param, ghi `test-log.md` | 0,5 | |
| Dự phòng xử lý lỗi phần mềm phát hiện khi bay | 2,0 | **Dự phòng** |
| Viết `docs/so-tay/21-bay-tu-dong-va-web.md` | 1,0 | |
| **Tổng** | **~18,0** | |

Đường găng: 21.1 → 21.2 → 21.3 → 21.4 → 21.5 → 21.6 (tuần tự, mỗi bài chặn bài sau). Mỗi bài có **hai nửa**: diễn tập trên bàn (trong nhà, không cánh) và chuyến bay (ngoài bãi). Nên gộp diễn tập của 2 bài vào một buổi trong nhà, rồi bay 2 bài trong một buổi ngoài bãi. Không diễn tập và bay cùng một buổi nếu điều đó nghĩa là tháo-lắp cánh nhiều lần tại bãi — mỗi lần tháo-lắp cánh là một cơ hội lắp sai.

## Ghi chú cho sổ tay

- **Bốn chế độ phần mềm dùng tới** — `Auto` (bay theo mission đã nạp), `Guided` (bay theo lệnh gửi từ ngoài, từng lệnh một), `Loiter` (nút dừng khẩn), `RTL` (nút thoát). Vì sao `Loiter` là nút dừng tốt hơn `Stabilize` trong phase này.
- **Mission là gì và nó nằm ở đâu** — mission được **upload và lưu trong bo bay**, không phải chạy từ laptop. Nghĩa là mất Wi-Fi giữa chừng thì mission **vẫn chạy tiếp**. Đây là điều bất ngờ với nhiều người mới và cần nói rõ.
- **Readback là gì và vì sao bắt buộc** — upload mà không đọc lại là upload mù.
- **`WPNAV_RADIUS` là gì** — bán kính coi như "đã tới waypoint"; đặt quá nhỏ thì drone lượn vòng quanh WP mà không chịu đi tiếp, quá lớn thì cắt góc.
- **Guided và hệ toạ độ LOCAL_NED** — vì sao "tiến" là tiến theo **mũi drone**, không theo hướng người nhìn; `type_mask` là gì (nói đơn giản: chọn trường nào trong gói lệnh được dùng).
- **Vì sao lệnh vận tốc phải lặp ≥ 1 Hz** — ArduPilot coi lệnh Guided là "còn hiệu lực trong một khoảng ngắn"; ngừng gửi là ngừng bay theo. Đây cũng chính là cơ chế làm dead-man hoạt động.
- **Dead-man switch** — khái niệm gốc (thiết bị dừng tàu khi người lái buông tay), và vì sao timeout **phải ở backend** chứ không ở frontend: frontend có thể chết, treo, hoặc mất mạng, và khi đó nó không gửi được lệnh dừng.
- **Vì sao `WEB CONTROL ENABLE` tồn tại** — nguyên tắc "web không tự giành quyền"; operator phải có một hành động chủ động.
- **Thứ tự ưu tiên quyền điều khiển** — RC > web > AI; vì sao AI chỉ sinh sự kiện và **không bao giờ** điều khiển motor (`SAFETY.md` mục 1).
- **UDP và việc đăng ký endpoint** — vì sao ESP32 không biết gửi về đâu cho tới khi GCS gửi gói đầu tiên; đây là nguyên nhân số một của "mở lên không thấy gì".
- **Vì sao `FS_GCS_ENABLE` vẫn để 0** — Wi-Fi rớt lặt vặt là bình thường; RC mới là dây cứu sinh.
- **Đo độ trễ giữa hai đồng hồ khác nhau** — vì sao con số đó là ước lượng, và cách trình bày trung thực trong báo cáo.

---

**Prior-art:** rút vật liệu thô từ nháp cũ `README.md` GIAI ĐOẠN 55 (Auto bằng Mission Planner trước, mission đầu `Takeoff → WP1 → WP2 → RTL`, khoảng cách nhỏ, "nếu Mission Planner mission không ổn thì web chắc chắn không cứu được"), 61 (web command khi drone còn trên bàn — không cánh), 62 (web mission upload trên drone thật), 63 (Auto web flight đầu tiên: `Takeoff 3 m → WP1 cách 5–10 m → WP2 → RTL`, RC luôn cầm trong tay, sẵn sàng chuyển `Loiter`/`RTL`), 64 (web manual: cất cánh bằng RC, `Loiter`, rồi bật Web Control và `Guided`; lệnh đầu rất ngắn; 0,5 m/s trước, 1 m/s sau; **không** 5 m/s), 65 (RC override test — bài bắt buộc), 69–71 (test tĩnh/động của camera; phase này chưa dùng camera, các bài đó thuộc Phase 23–24), 87 (`logs/flight_*/` và `notes.md`), 88 (`06-auto-good.param`). Ba bài dead-man lấy từ `SAFETY.md` mục 5; bài thứ tư (tắt Wi-Fi laptop) là mới, thêm vì SITL không mô phỏng được. Chi tiết `SET_POSITION_TARGET_LOCAL_NED` / `type_mask 0x0DC7` / lặp ≥ 1 Hz lấy từ `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` mục 3. Ghi chú đăng ký endpoint UDP và tầm Wi-Fi lấy từ `plans/reports/260921-research-esp32-bridge-camera.md` mục 4. Tám quy tắc thiết kế mission, quy trình diễn tập trên bàn dùng Mission Planner làm trọng tài, hai biến thể của F8, và bốn mục đọc log 8–11 ở đây là mới.
