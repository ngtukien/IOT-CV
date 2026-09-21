# Phase 20: Bay RC cơ bản — F1 Stabilize, F2 AltHold, F3 Loiter, F4 RTL

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 19 | ~14,5 giờ | Có (drone hoàn chỉnh đã pass Phase 19, ≥ 2 pin 4S đã sạc cân bằng, tay FS-i6X, laptop + Mission Planner + cáp USB, đồng hồ vạn năng, kính bảo hộ, cánh dự phòng, túi chống cháy LiPo, bãi bay trống) |

## Mục tiêu

Bốn chuyến bay đầu tiên của chiếc drone này, **chỉ bằng RC, không có web, không có camera, không có ESP32 tham gia điều khiển**. Mỗi bài là một bậc thang: F1 chứng minh drone cất cánh được và không lật; F2 chứng minh nó giữ được độ cao (tức là rung đủ thấp); F3 chứng minh nó giữ được vị trí (tức là GPS + la bàn tốt); F4 chứng minh nó tự bay về được.

**Sau mỗi chuyến đều phải tải log và đọc log** — không chỉ nói *"bay được rồi"*. Bốn bộ log này là nền tảng cho mọi việc còn lại: Phase 21 (bay từ web), Phase 22 (tránh vật cản + tuning), Phase 24 (báo cáo).

Kết thúc phase: 4 bài bay pass, 4 bộ log đã phân tích, `05-loiter-good.param` đã lưu.

> **AN TOÀN — ba luật của phase này:**
> 1. **RC luôn trong tay, ngón cái luôn trên `CH5`.** Mọi bài bay đều có một "đường thoát" định sẵn: gạt `CH5` về `Stabilize` và hạ ga, hoặc gạt `CH6` để `RTL`.
> 2. **Không bao giờ bay bài N+1 khi bài N chưa pass.** Không "thử luôn Loiter cho nhanh".
> 3. **Ba lần thất bại liên tiếp ở cùng một bài → dừng buổi bay, về nhà đọc log.** Không thử lần thứ tư với cùng một cách làm.

## Đầu vào cần có

Phải đọc trước:

- `SAFETY.md` — mục 3, 4, 6, 8, 10.
- `docs/checklist-truoc-bay.md` — viết ở Phase 19 mục 19.15, **đã in ra giấy**.
- `docs/do-dac/19-do-luc-day.md` — tỉ số lực đẩy thật; phải ≥ 2 : 1.
- `docs/bao-cao-tong-quan-du-an.md` mục 3.2 — đặc biệt ghi chú về `MOT_THST_HOVER`: bảng của T-Motor quy ra ga treo ~48–50 % nhưng file tham số chính hãng của ArduPilot cho khung S500 đặt `MOT_THST_HOVER = 0.25`. **Hai nguồn không khớp** — ArduPilot tự học lại trong khi bay (`MOT_HOVER_LEARN`), nên đọc số thật sau chuyến bay đầu thay vì tin con nào.
- Ghi chép Phase 03 về cách dùng UAV Log Viewer (đã học trên drone ảo).

Phải có sẵn và đã pass:

- Phase 19 pass **toàn bộ** cổng pass, đặc biệt: pre-arm sạch, không pre-arm check nào bị disable, cánh đúng chiều, tỉ số lực đẩy ≥ 2 : 1, `FENCE_RADIUS` đã chỉnh theo bãi thật.
- **Ít nhất 2 viên pin 4S** đã sạc cân bằng. Bốn bài bay không làm hết trong một viên.
- **Ít nhất một người quan sát**. Không bay một mình buổi đầu.
- Thời tiết: gió **dưới 3 m/s** (lá cây chỉ lay nhẹ), không mưa, không nắng gắt chiếu thẳng vào mắt người lái theo hướng nhìn drone.

## File và thư mục sở hữu

Tạo mới:

- `logs/flight_YYYYMMDD_HHMM/` — một thư mục cho **mỗi** chuyến bay (F1…F4), mỗi thư mục chứa `flight.bin` và `notes.md` theo mẫu ở mục 20.2. (Phase này chưa có camera/web nên chưa có `video/`, `detections.csv`, `events.json`.)
- `docs/do-dac/20-ket-qua-bay.md` — bảng tổng hợp số liệu đọc từ 4 bộ log (đây là file **được commit**; file `.bin` thì không).
- `docs/so-tay/20-bay-rc-co-ban.md` — sổ tay người mới cho phase này.
- `firmware/ardupilot/params/05-loiter-good.param` — ảnh chụp tham số sau khi F3 pass.

Sửa:

- `plans/PROGRESS.md` — tick checkbox của Phase 20.
- `docs/test-log.md` — tạo nếu chưa có; ghi kết quả 4 bài bay (file này được `SAFETY.md` mục 10 tham chiếu).

**Không đụng:** `backend/`, `frontend/`, `ml/`, `firmware/camera/`, `firmware/dronebridge/`, các file param `00`–`04`.

> Thư mục `logs/` chứa file `.bin` lớn — **không commit file `.bin`**. Phase 24 sở hữu khối `logs/` trong `.gitignore` (phase này không sở hữu `.gitignore`). Thứ được commit là `notes.md` của từng chuyến và bảng tổng hợp `docs/do-dac/20-ket-qua-bay.md`.

## Việc theo thứ tự

### 20.1 Chuẩn bị buổi bay và giao thức ABORT

**Phân vai rõ ràng trước khi cắm pin:**

```text
NGƯỜI LÁI      : cầm RC, KHÔNG nhìn laptop, mắt luôn trên drone
NGƯỜI QUAN SÁT : nhìn Mission Planner, đọc to độ cao / điện áp / cảnh báo,
                 và có quyền hô "ABORT" bất cứ lúc nào
```

Người lái **không được vừa lái vừa nhìn màn hình**. Nếu chỉ có một người, đặt laptop xuống, khoá màn hình, và bay hoàn toàn bằng mắt.

**Giao thức ABORT — thống nhất trước, tập nói to một lần:**

```text
Ai hô "ABORT"  ->  NGƯỜI LÁI làm NGAY, không hỏi lại:
                   1. gạt CH5 về STABILIZE
                   2. hạ ga về giữa, giữ drone thăng bằng
                   3. hạ xuống đất chỗ gần nhất an toàn
                   4. disarm (ga xuống hết + yaw trái 3 giây)
Nếu drone đang lao về phía người -> hạ ga XUỐNG HẾT ngay lập tức.
   Rơi từ 1 m làm hỏng cánh. Đâm vào người làm rách da tới xương.
   Luôn chọn hỏng cánh.
```

**Khi nào hô ABORT (bất kỳ điều nào dưới đây):**

- Drone nghiêng hoặc xoay mà không ai điều khiển.
- Có tiếng lạ: kêu rít cao bất thường, tiếng "khục", tiếng va đập.
- Có khói, mùi khét.
- Mission Planner báo cảnh báo đỏ.
- Điện áp tụt dưới 14,4 V.
- Có người, xe, hoặc vật lạ đi vào bãi.
- **Người lái mất phương hướng** — không còn biết đâu là mũi drone. Đây là nguyên nhân gây tai nạn phổ biến nhất với người mới.

**Chạy checklist:** mở `docs/checklist-truoc-bay.md` (đã in), làm **đủ từng dòng**, đánh dấu bằng bút. Không làm bằng trí nhớ.

**Bản đồ công tắc — chốt ở Phase 15, kiểm lại ở Phase 19 mục 19.5. Nói to một lần trước khi cắm pin:**

```text
CH5 (3 vị trí)  vị trí 1 = STABILIZE   <- đường thoát cuối, lái tay hoàn toàn
                vị trí 2 = ALTHOLD
                vị trí 3 = LOITER      <- nút "đứng yên", dùng nhiều nhất
CH6             = RTL                  <- nút "về nhà"
CH7             = WEB CONTROL ENABLE   <- phase này KHÔNG dùng, để TẮT
CH8             = (trống, Auto gán ở Phase 21)
```

> **AN TOÀN:** `CH7` phải ở vị trí **TẮT** trong suốt Phase 20. Bốn bài bay này là bay RC thuần; không có lý do gì để backend được phép gửi lệnh.

**Đặt hướng đứng:** đứng **sau đuôi drone**, cách ≥ 5 m, mũi drone hướng ra xa người. Ở tư thế này, gạt cần roll sang phải thì drone đi sang phải — cùng chiều với cảm giác của bạn. Nếu drone quay mũi về phía bạn, mọi thứ đảo ngược; đó là lúc người mới mất phương hướng.

**Kết quả mong đợi:** vai đã phân, giao thức ABORT đã nói to một lần, checklist đã tick đủ, người đã đứng đúng chỗ.

### 20.2 Quy trình sau mỗi chuyến — tải log và đọc log

Định nghĩa một lần ở đây, **áp dụng y hệt sau cả F1, F2, F3, F4**. Không bay bài tiếp theo trước khi đọc xong log của bài trước.

**Bước A — tải log:**

Bo F405 V5 dùng **dataflash 16 MB gắn trong** (không có thẻ nhớ rời), và `LOG_DISARMED,1` khiến nó ghi từ lúc cắm điện chứ không đợi arm — nên bộ nhớ đầy nhanh.

```text
1. Rút pin, mang drone về chỗ có laptop.
2. Cắm cáp USB từ laptop vào FC. (KHÔNG tải log qua ESP32 Wi-Fi —
   16 MB qua telemetry 2,4 GHz mất hàng chục phút và hay đứt giữa chừng.)
3. Mission Planner -> DataFlash Logs -> Download DataFlash Log Via Mavlink
4. Chọn log mới nhất theo dấu thời gian. Tải về.
5. Tạo thư mục logs/flight_YYYYMMDD_HHMM/ và đổi tên file thành flight.bin
6. Khi dataflash gần đầy: Erase Logs SAU KHI đã tải hết về.
```

**Bước B — viết `notes.md` ngay tại bãi**, trước khi quên (mẫu từ nháp cũ GIAI ĐOẠN 87):

```markdown
# F<N> — <tên bài> — YYYY-MM-DD HH:MM

Wind:        (m/s, hướng, ước lượng bằng gì)
Battery:     (điện áp trước / sau, mAh đã dùng theo MP)
Payload:     (có camera hay chưa, AUW)
Altitude:    (cao nhất đạt được)
Flight mode: (các mode đã dùng)
Duration:    (giây/phút)
Problems:    (mọi thứ bất thường, kể cả "hình như có tiếng lạ")
Changes since previous flight: (đổi tham số gì, sửa cơ khí gì)
```

**Bước C — checklist đọc log trong UAV Log Viewer** (công cụ web đã dùng ở Phase 03). Mở `flight.bin`, kiểm tra **đủ 7 mục**, ghi số vào `docs/do-dac/20-ket-qua-bay.md`:

```text
1. RUNG (VIBE)
   Đồ thị: VIBE.VibeX, VIBE.VibeY, VIBE.VibeZ   (đơn vị m/s^2)
   ĐẠT   : cả 3 trục < 30 trong suốt chuyến; lý tưởng < 15
   CẢNH BÁO: 30-60 -> sẽ hỏng AltHold/Loiter
   HỎNG  : > 60 -> gần như luôn hỏng giữ độ cao và giữ vị trí
   (ngưỡng theo tài liệu ArduPilot, đã trích ở Phase 18 mục 18.8)

2. CLIPPING
   Đồ thị: VIBE.Clip0, VIBE.Clip1, VIBE.Clip2
   ĐẠT   : CẢ BA = 0 trong suốt chuyến.
   Clipping nghĩa là gia tốc kế bị BÃO HOÀ — số nó báo về không còn là
   gia tốc thật nữa. Chỉ cần > 0 là phải xử lý rung trước khi bay tiếp,
   kể cả khi VIBE trung bình vẫn dưới 30.

3. EKF
   Đồ thị: XKF4 (hoặc NKF4) — các biến *VAR* (SV, SP, SH, SM, SVT)
   ĐẠT   : mọi variance < 0.5 và KHÔNG có đoạn nào vọt lên 1.0
   Kiểm tra thêm: tab MSG / ERR có dòng nào chứa "EKF" không.

4. LA BÀN (compass innovation)
   Đồ thị: MAG.MagX / MagY / MagZ, và XKF3.IMX/IMY/IMZ (innovation)
   ĐẠT   : innovation nhỏ và dao động quanh 0, KHÔNG trôi lệch một phía
   Kiểm tra thêm: độ lớn từ trường tổng sqrt(MagX^2+MagY^2+MagZ^2) phải
   GẦN NHƯ KHÔNG ĐỔI khi ga thay đổi. Nếu nó thay đổi theo ga
   -> dây nguồn motor đang làm nhiễu la bàn (xử lý ở 20.7).

5. PIN (sag)
   Đồ thị: BAT.Volt cùng với BAT.Curr
   ĐẠT   : lúc treo, Volt không tụt xuống dưới BATT_LOW_VOLT (14.0)
   Ghi lại: Volt lúc nghỉ trước bay, Volt thấp nhất khi bay, Volt sau khi hạ.
   Sụt > 1,5 V ở ga treo -> pin yếu hoặc dây/mối hàn có điện trở cao.

6. CÂN BẰNG MOTOR (RCOU)
   Đồ thị: RCOU.C1, C2, C3, C4 (lệnh ra 4 motor)
   ĐẠT   : 4 đường CHỤM VÀO NHAU khi treo, chênh lệch nhỏ.
   Chênh lệch lớn và ỔN ĐỊNH giữa một cặp chéo (C1+C2 so với C3+C4)
      -> lệch trọng tâm hoặc một motor/cánh yếu hơn.
   Một đường luôn cao hơn hẳn 3 đường kia
      -> motor/ESC/cánh đó có vấn đề, hoặc cần khung bị vênh.

7. BÁM LỆNH (ATT)
   Đồ thị: ATT.DesRoll so với ATT.Roll; ATT.DesPitch so với ATT.Pitch
   ĐẠT   : đường thực bám sát đường lệnh, trễ nhỏ, không dao động
   Thực DAO ĐỘNG quanh lệnh -> PID quá cao (xử lý ở 20.7)
   Thực BÁM CHẬM / không tới -> PID quá thấp, hoặc drone thiếu lực
```

**Bước D — chốt:** điền bảng trong `docs/do-dac/20-ket-qua-bay.md` và ghi một dòng kết luận `PASS` / `FAIL` + lý do. **`FAIL` thì không bay bài tiếp theo** — xử lý theo 20.7 trước.

**Kết quả mong đợi:** mỗi chuyến có đủ `flight.bin`, `notes.md`, và 7 mục đã điền số.

### 20.3 Bài F1 — Stabilize, hover 0,5–1 m, 30 giây

**Mục tiêu:** chứng minh drone cất cánh được, không lật, và bám lệnh tay. Đây là bài **duy nhất** mà nếu sai thì sai rất nhanh (dưới 1 giây) — nên bay thấp.

**Vì sao Stabilize trước:** `Stabilize` chỉ giữ thăng bằng; nó **không** dùng khí áp kế, **không** dùng GPS, **không** dùng la bàn. Nếu có lỗi ở ba thứ đó, F1 vẫn bay được — nghĩa là F1 tách bạch được "lỗi cơ khí/motor" khỏi "lỗi cảm biến định vị". Bay Loiter ngay sẽ trộn cả ba loại lỗi vào một hiện tượng.

**Điều kiện tiên quyết:**

```text
[ ] Checklist walk-around đã tick đủ (20.1)
[ ] GPS 3D Fix, >= 10 vệ tinh (dù Stabilize không cần — nhưng cần cho log
    và cần để home được ghi nhận)
[ ] Không cảnh báo pre-arm
[ ] CH5 ở vị trí 1, Mission Planner hiện STABILIZE
[ ] CH7 (WEB CONTROL ENABLE) ở vị trí TẮT
[ ] Người lái đứng sau đuôi drone, >= 5 m, mũi drone hướng ra xa
```

**Quy trình:**

1. Arm (ga xuống hết + yaw phải 3 giây). Nghe 4 motor idle đều.
2. **Đẩy ga LÊN TỪ TỪ.** Đếm thầm: ga lên khoảng 40 % thì drone bắt đầu nhẹ trên chân đáp; lên khoảng 50 % thì nó rời đất. Không giật ga.
3. **Ngay khi 4 chân rời đất, dừng tăng ga.** Giữ drone ở **0,5–1 m**.
4. Giữ nguyên **30 giây**. Chỉ chỉnh ga rất nhẹ để giữ độ cao; roll/pitch chỉ chỉnh rất nhỏ để chống trôi.
5. Hạ ga từ từ cho tới khi chạm đất. Giữ ga thấp 2 giây cho drone ổn định trên đất.
6. Disarm.

**Cái cần nhìn trong 30 giây:**

```text
[ ] Drone cất cánh THẲNG LÊN, không nhảy chồm sang một bên
[ ] Không nghiêng hẳn về một góc và giữ nguyên góc đó
[ ] Không tự xoay (yaw) khi bạn không chạm cần yaw
[ ] Tiếng 4 motor đều nhau, không cái nào rít cao hơn hẳn
[ ] Không rung lắc nhìn thấy được ở thân drone
[ ] Trôi ngang chậm là BÌNH THƯỜNG ở Stabilize (không có GPS giữ vị trí) —
    chỉ cần chỉnh nhẹ là giữ được
```

**Tiêu chí ABORT (hạ ga xuống hết ngay):**

- Drone **lật** hoặc nghiêng quá 45° ngay khi rời đất → đây là lỗi thứ tự/chiều motor, hạ ga ngay, không "cố gượng lại".
- Drone tự xoay tròn nhanh dần.
- Drone lao về phía bất kỳ ai.
- Có tiếng "khục" (nghi desync).

**Tiêu chí PASS:**

- [ ] Cất cánh thẳng, giữ được 30 giây ở 0,5–1 m, hạ cánh có kiểm soát, disarm bình thường.
- [ ] Không phải ABORT.
- [ ] Log: VIBE < 30 cả 3 trục, Clip0/1/2 = 0, RCOU 4 đường chụm, ATT bám lệnh không dao động.

**Sau chuyến:** chạy đủ quy trình 20.2. Sờ 4 motor và ESC — **không cái nào nóng đến mức không giữ tay được**.

**Nếu lỗi:** xem bảng chẩn đoán ở 20.7, hàng "lật khi cất cánh" và "rung/nóng".

### 20.4 Bài F2 — AltHold, 1–2 m

**Mục tiêu:** chứng minh drone giữ được độ cao, tức là **rung đủ thấp để khí áp kế và gia tốc kế dùng được**. Đây là bài phát hiện lỗi chống rung ở Phase 18 mục 18.8.

**Điều kiện tiên quyết:** F1 đã PASS **và** log F1 đã đọc xong với VIBE < 30, Clip = 0.

**AltHold khác Stabilize thế nào:** ở `AltHold`, cần ga **không còn điều khiển công suất motor** nữa — nó điều khiển **tốc độ lên/xuống**. Cần ga ở **giữa** = giữ nguyên độ cao. Đẩy lên = bay lên. Kéo xuống = hạ xuống. Người mới hay giật mình vì thói quen từ Stabilize; hãy nói to điều này trước khi arm.

**Quy trình:**

1. Arm ở `Stabilize`, cất cánh lên **1 m** đúng như F1.
2. Ổn định 5 giây, rồi **gạt `CH5` sang `AltHold`**. Tay để cần ga về **đúng giữa**.
3. Quan sát 10 giây. Drone phải **đứng yên ở độ cao đó**.
4. Đẩy ga lên nhẹ → lên tới ~2 m. Về giữa → đứng lại.
5. Kéo ga xuống nhẹ → xuống ~1 m. Về giữa → đứng lại.
6. Giữ ở 1–2 m thêm 30 giây.
7. Gạt về `Stabilize`, hạ cánh thủ công. Disarm.

**Cái cần nhìn:**

```text
[ ] Khi cần ga ở giữa, độ cao GIỮ NGUYÊN (dao động <= +-0,3 m là chấp nhận)
[ ] Không "nảy" lên xuống theo chu kỳ (bounce)
[ ] Không từ từ trôi lên hoặc tụt xuống dù không đụng ga
[ ] Đáp ứng khi đẩy/kéo ga mượt, không giật
```

**ABORT:** drone tự trôi lên không dừng, hoặc tụt nhanh → gạt `CH5` ngay về `Stabilize` và lái tay.

**Tiêu chí PASS:**

- [ ] Ở cần ga giữa, độ cao dao động ≤ ±0,3 m trong 30 giây.
- [ ] Không có dao động lên-xuống theo chu kỳ.
- [ ] Log: VIBE < 30, Clip = 0, và đồ thị `CTUN.Alt` so với `CTUN.DAlt` (độ cao thực so với độ cao mong muốn) bám sát nhau.

**Đọc `MOT_THST_HOVER` sau bài này:** `MOT_HOVER_LEARN` khiến ArduPilot tự học ga treo thật. Sau F2, vào Full Parameter List đọc `MOT_THST_HOVER` và **ghi số đó vào `docs/do-dac/20-ket-qua-bay.md`**. Tài liệu ước tính ~0,48–0,50 còn file tham chiếu S500 của ArduPilot ghi 0,25 — số học được là **số thật của chiếc drone này**, và nó cho biết drone đang "nhẹ" hay "ì".

**Hiệu chỉnh `BATT_AMP_PERVLT`** (việc hoãn lại từ Phase 19 mục 19.9): ghi số mAh Mission Planner báo đã dùng trong chuyến này, rồi khi sạc lại bằng iMAX B6AC V2 ghi số mAh thật nạp vào. Nhân tỉ lệ `(mAh thật nạp / mAh MP báo)` vào `BATT_AMP_PERVLT` hiện tại. Lặp sau vài chuyến cho chính xác hơn.

**Sau chuyến:** quy trình 20.2 đầy đủ.

**Nếu lỗi:** bảng 20.7, hàng "độ cao nảy / trôi".

### 20.5 Bài F3 — Loiter, 2–3 m

**Mục tiêu:** chứng minh **GPS và la bàn tốt**. Đây là bài quyết định cho cả Phase 21 (bay tự động) và Phase 22 (tránh vật cản ở Loiter) — cả hai đều đứng trên bài này.

**Điều kiện tiên quyết:** F2 đã PASS **và** log F2 đã đọc.

```text
[ ] GPS: >= 12 vệ tinh, HDOP < 1.2 (chặt hơn F1/F2 vì Loiter thật sự dùng GPS)
[ ] Không cảnh báo EKF, không cảnh báo compass
[ ] Bãi trống, KHÔNG có nhà/tường cao gần (phản xạ tín hiệu GPS)
[ ] Gió < 3 m/s
```

**Loiter là gì:** drone tự giữ **cả độ cao lẫn vị trí ngang**. Buông hết cần → drone đứng yên tại chỗ trong không khí. Đẩy cần roll/pitch → drone di chuyển; buông ra → nó phanh lại và đứng yên ở chỗ mới.

**Quy trình:**

1. Arm ở `Stabilize`, cất cánh lên 1 m, ổn định.
2. Gạt sang `AltHold`, lên **2–3 m**, ổn định 5 giây.
3. Gạt `CH5` sang `Loiter`. **Buông hết các cần** (ga về giữa, roll/pitch/yaw về giữa).
4. **Không chạm cần trong 60 giây.** Chỉ đứng nhìn.
5. Sau đó thử: đẩy cần pitch tới nhẹ 1 giây rồi buông → drone đi tới rồi **tự phanh và đứng lại**.
6. Thử tương tự sang trái, sang phải, lùi.
7. Gạt về `AltHold` → `Stabilize`, hạ cánh, disarm.

**Cái cần nhìn trong 60 giây buông cần:**

```text
[ ] Drone ĐỨNG YÊN. Trôi trong bán kính ~1 m là bình thường với GPS dân dụng.
[ ] KHÔNG trôi một phía và đi xa dần.
[ ] KHÔNG quay vòng tròn mở rộng dần  <-- "TOILET BOWL", xem chẩn đoán bên dưới
[ ] Không dao động trái-phải theo chu kỳ
[ ] Buông cần sau khi di chuyển -> phanh dứt khoát, không vọt lố nhiều
```

**Chẩn đoán "toilet bowl" (drone quay vòng tròn ngày càng rộng quanh một điểm):**

Đây là triệu chứng kinh điển của **la bàn lệch so với GPS**: drone nghĩ mình đang hướng một đằng nhưng GPS nói nó đi một nẻo, nên vòng điều khiển vị trí tự quay tròn. Nguyên nhân theo thứ tự hay gặp:

```text
1. La bàn chưa hiệu chỉnh đúng, hoặc hiệu chỉnh ở nơi có kim loại
   -> làm lại Phase 19 mục 19.4, ngoài trời, xa mọi thứ bằng sắt

2. La bàn bị nhiễu bởi dây nguồn motor
   -> bằng chứng trong log: độ lớn từ trường tổng THAY ĐỔI THEO GA (20.2 mục 4)
   -> xử lý cơ khí: nâng cột GPS cao hơn, đi lại dây nguồn (Phase 18 mục 18.11)
   -> nếu buộc phải: bật COMPASS_MOT (hiệu chỉnh bù nhiễu theo dòng điện)
      nhưng CHỈ sau khi đã thử xử lý cơ khí, vì đó là vá lỗi chứ không phải sửa

3. COMPASS_ORIENT sai (la bàn bị xoay so với khai báo)
   -> kiểm tra lại bằng phép thử "chĩa mũi về Bắc thật" ở Phase 19 mục 19.4

4. Rung cao làm EKF nhầm lẫn gia tốc với nghiêng
   -> xem VIBE và Clip trong log
```

> **AN TOÀN:** **Loiter quay vòng thì KHÔNG đi tiếp Auto.** Bài F4 (RTL) và toàn bộ Phase 21 đều dựa trên việc drone biết mình đang ở đâu và hướng nào. Bay Auto với la bàn sai là cách drone bay mất — nó sẽ "về nhà" theo một hướng hoàn toàn khác. (Nháp cũ GIAI ĐOẠN 53.)

**Tiêu chí PASS:**

- [ ] 60 giây buông cần: trôi trong bán kính ≤ 1,5 m, **không** toilet bowl, **không** trôi xa dần.
- [ ] Phanh dứt khoát sau khi di chuyển theo cả 4 hướng.
- [ ] Log: compass innovation nhỏ và dao động quanh 0; độ lớn từ trường **không** thay đổi theo ga; EKF variance < 0.5; VIBE < 30; Clip = 0.

**Sau chuyến:** quy trình 20.2 đầy đủ. **Nếu PASS, lưu `05-loiter-good.param` ngay** (mục 20.8) — đây là trạng thái tham số tốt đã được chứng minh, mọi thử nghiệm sau này có thể quay về đây.

### 20.6 Bài F4 — RTL từ 20 m

**Mục tiêu:** chứng minh drone **tự bay về được**. Đây là điều kiện bắt buộc trước mọi bài bay tự động — RTL là cái phao cứu sinh của Phase 21 và Phase 22.

**Điều kiện tiên quyết:** F3 đã PASS **và** log F3 đã đọc, **không** có toilet bowl.

**Đặt tham số RTL trước khi bay** (Full Parameter List):

```text
RTL_ALT       1500   cm = 15 m. Độ cao drone sẽ leo lên trước khi bay về.
                     Phải CAO HƠN mọi vật cản trong bãi, và THẤP HƠN
                     FENCE_ALT_MAX (30 m).  <-- chưa xác minh, chỉnh theo bãi thật
RTL_ALT_FINAL 0      cm = hạ cánh hẳn sau khi về tới home
RTL_LOIT_TIME 5000   ms = dừng 5 giây phía trên home trước khi hạ
```

**Hiểu "home" là ở đâu:** home được ghi nhận **tại thời điểm arm** (với GPS fix tốt). Nghĩa là drone sẽ bay về **đúng chỗ nó cất cánh**, không phải chỗ bạn đang đứng. Ghi nhớ điều này và đứng cách điểm cất cánh ≥ 5 m.

**Quy trình:**

1. Arm tại điểm cất cánh. **Xác nhận home đã được ghi**: Mission Planner hiện biểu tượng home trên bản đồ đúng chỗ.
2. Cất cánh `Stabilize` → `AltHold` → `Loiter`, lên **10 m**.
3. Ở `Loiter`, bay ra xa **20 m** theo phương ngang (vẫn trong `FENCE_RADIUS` 50 m). Giữ drone **luôn trong tầm mắt**.
4. Buông cần, để drone đứng yên 5 giây.
5. **Gạt `CH6` sang `RTL`.**
6. **Không chạm cần nữa.** Quan sát.
7. Drone phải: leo lên `RTL_ALT` (15 m) → bay ngang về phía home → dừng 5 giây phía trên home → hạ cánh xuống.
8. Sau khi chạm đất, drone tự disarm (hoặc disarm thủ công).

**Cái cần nhìn:**

```text
[ ] Drone leo lên trước khi bay ngang (không bay ngang ở độ cao thấp)
[ ] Hướng bay về ĐÚNG về phía điểm cất cánh, đường bay thẳng
[ ] Dừng lại phía trên home, không vọt qua rồi quay lại nhiều lần
[ ] Hạ cánh đều, không lao xuống
[ ] Điểm chạm đất cách điểm cất cánh <= 3 m
```

**ABORT:** drone bay về **sai hướng** → gạt `CH5` ngay về `Loiter` (drone sẽ đứng lại), rồi lái tay về. Sai hướng RTL gần như luôn là lỗi la bàn → quay lại 20.5 mục chẩn đoán toilet bowl.

**Tiêu chí PASS:**

- [ ] Drone tự về và hạ cánh trong bán kính ≤ 3 m quanh điểm cất cánh, **không** cần can thiệp.
- [ ] Không phải ABORT.
- [ ] Log: đường bay `POS` về thẳng; EKF variance < 0.5; không có `ERR` liên quan EKF/compass.

> **AN TOÀN — cổng pass cứng của phase:** **Không phát triển Auto Mission thật trước khi RTL đã được test thành công.** (`SAFETY.md` mục 10; nháp cũ GIAI ĐOẠN 54.) Phase 21 bị chặn cho tới khi F4 pass.

**Sau chuyến:** quy trình 20.2 đầy đủ.

### 20.7 Bảng chẩn đoán lỗi hay gặp

Tra bảng này **trước** khi đổi bất kỳ tham số nào. Mỗi hàng: triệu chứng → nguyên nhân theo thứ tự xác suất → cách xác nhận → cách sửa.

| Triệu chứng | Nguyên nhân hay gặp nhất | Cách xác nhận | Cách sửa |
|---|---|---|---|
| **Lật ngay khi cất cánh** | Thứ tự motor sai, hoặc chiều quay motor sai | Chạy lại Motor Test không cánh (Phase 19 mục 19.6) và đối chiếu với **sơ đồ khung trong Mission Planner** | Sửa thứ tự (đổi dây/mapping) hoặc chiều quay (đổi 2 trong 3 dây). **Không bay lại cho tới khi Motor Test đúng 4/4.** |
| **Lật ngay khi cất cánh, Motor Test đúng** | Cánh lắp sai chiều (CW vào vị trí CCW) | Tháo cánh, kiểm tra lại theo 3 lớp ở Phase 19 mục 19.13; kiểm chứng bằng lực đẩy đo trên cân | Lắp lại đúng cánh |
| **Lật ngay khi cất cánh, motor + cánh đều đúng** | `FRAME_TYPE` sai (không phải X) | Kiểm tra `FRAME_CLASS,1` và `FRAME_TYPE,1` | Đặt đúng, reboot, chạy lại Motor Test |
| **Trôi ngang đều một phía ở Stabilize** | Trim của tay RC bị lệch, hoặc `AHRS_TRIM` sai | Nhìn `rcin` ở tab Status: cần về giữa có ra 1500 ±20 không | Chỉnh trim trên tay về 0 rồi `Calibrate Radio`; chạy lại `Calibrate Level` trên mặt phẳng ngang (Phase 19 mục 19.3) |
| **Trôi ngang đều một phía, trim đúng** | Gia tốc kế hiệu chỉnh khi cầm trên tay, hoặc bo bay lệch trên bát | Log: `ATT.Roll`/`ATT.Pitch` lúc treo không quanh 0 | Hiệu chỉnh lại accel 6 vị trí, **đặt xuống mặt phẳng, buông tay**; kiểm tra bát chống rung có lệch không |
| **Dao động trái-phải / chúi-ngửa theo chu kỳ nhanh** | PID quá cao (thường `ATC_RAT_RLL_P` / `ATC_RAT_PIT_P`) | Log: `ATT.Roll` dao động quanh `ATT.DesRoll` ở tần số đều | Giảm `ATC_RAT_RLL_P` và `ATC_RAT_PIT_P` **10–15 % mỗi lần**, bay lại. Nếu vẫn thế sau 3 vòng, dừng và cân nhắc AUTOTUNE ở Phase 22 |
| **Dao động chậm, biên độ lớn, "bồng bềnh"** | PID quá thấp, hoặc drone quá nặng so với lực đẩy | So tỉ số lực đẩy với `docs/do-dac/19-do-luc-day.md` | Nếu tỉ số < 2:1 → giảm payload/đổi cánh. Nếu tỉ số tốt → tăng nhẹ P, hoặc để AUTOTUNE xử lý ở Phase 22 |
| **Độ cao nảy lên xuống ở AltHold** | Rung quá cao → gia tốc kế lẫn lộn | Log: `VIBE` > 30, hoặc `Clip*` > 0 | Xử lý rung: cân cánh, kiểm tra trục motor cong, kiểm tra bát chống rung (Phase 18 mục 18.8). **Không** chỉnh PID để "chữa" rung |
| **Độ cao trôi lên/xuống chậm và đều ở AltHold** | Khí áp kế bị gió từ cánh thổi vào | Log: `CTUN.Alt` trôi mà `VIBE` vẫn thấp | Dán một miếng **mút xốp lỗ hở (open-cell foam)** lên chip khí áp kế của FC, hoặc bọc kín thân FC bằng mút. Đây là cách chuẩn, không phải mẹo |
| **Loiter quay vòng tròn mở rộng (toilet bowl)** | La bàn lệch | Xem 4 nguyên nhân ở 20.5 | Hiệu chỉnh lại la bàn ngoài trời; nâng cột GPS; kiểm tra `COMPASS_ORIENT`. **Không bay Auto khi chưa sửa** |
| **Loiter trôi xa dần một phía** | GPS kém (ít vệ tinh, HDOP cao), hoặc có gió | Log: `GPS.NSats`, `GPS.HDop`; đối chiếu `notes.md` về gió | Đợi GPS tốt hơn; bay khi gió nhẹ hơn; ra bãi trống hơn |
| **Một motor nóng hơn hẳn 3 cái kia** | Cần khung vênh, motor lệch tâm, hoặc cánh mất cân bằng | Log: `RCOU.C*` của motor đó luôn cao hơn | Kiểm tra khung phẳng (Phase 18 mục 18.2), đổi cánh khác, đổi motor sang cần khác để phân biệt lỗi motor hay lỗi cần |
| **Tất cả 4 motor nóng, hover throttle cao** | Drone quá nặng, hoặc cánh sai kích cỡ | `MOT_THST_HOVER` học được > 0,65 | Giảm payload. Không bay tiếp với "chỉ thêm mấy chục gram" (nháp cũ GIAI ĐOẠN 68) |
| **Điện áp tụt mạnh ngay khi tăng ga** | Pin yếu/cũ, hoặc mối hàn nguồn có điện trở cao | Log: `BAT.Volt` sụt > 1,5 V ở ga treo | Thử pin khác. Nếu vẫn sụt → kiểm tra lại mối hàn XT60 và pad nguồn (Phase 18 mục 18.6) |
| **Mất tín hiệu RC giữa chừng** | Anten đặt sai, hoặc bị che bởi pin/khung | Log: `RCIN` mất, hoặc `ERR` có radio failsafe | Quay lại Phase 18 mục 18.10: hai anten 90°, phần đầu nhạy duỗi thẳng, cách dây nguồn ≥ 5 cm |

> **AN TOÀN — luật 3 lần.** Sau **3 lần** thử sửa cùng một triệu chứng mà không hết, **dừng lại**. Không thử lần thứ tư với cùng cách nghĩ. Về nhà, đọc log kỹ, và đặt lại câu hỏi "có phải mình đang sửa đúng nguyên nhân không?" (`rules/agent-anti-rationalization.md`, `SAFETY.md` mục 10.)

### 20.8 Lưu `05-loiter-good.param` và ghi kết quả

**Thời điểm lưu:** ngay sau khi **F3 (Loiter) PASS và log đã đọc xong**. Tên file theo quy ước ở `params/README.md`.

```text
Mission Planner -> CONFIG -> Full Parameter List -> Save to file
-> firmware/ardupilot/params/05-loiter-good.param
```

Commit với prefix `param:` và ghi rõ đã đổi gì so với `04-pre-first-flight.param`:

```text
param: 05-loiter-good — sau khi F3 Loiter pass

- MOT_THST_HOVER : <gia tri hoc duoc>  (MOT_HOVER_LEARN tu hoc trong F2)
- BATT_AMP_PERVLT: <cu> -> <moi>, hieu chinh theo mAh sac lai (20.4)
- RTL_ALT        : 1500 cm, RTL_ALT_FINAL 0, RTL_LOIT_TIME 5000 (20.6)
- <moi tham so khac da doi khi xu ly loi o 20.7, kem ly do>
```

**Điền bảng tổng hợp** `docs/do-dac/20-ket-qua-bay.md`:

| Bài | Ngày | Gió | VIBE X/Y/Z max | Clip0/1/2 | EKF var max | Sụt áp (V) | Chênh RCOU | MOT_THST_HOVER | Kết luận |
|---|---|---|---|---|---|---|---|---|---|
| F1 Stabilize | | | | | | | | — | |
| F2 AltHold | | | | | | | | | |
| F3 Loiter | | | | | | | | | |
| F4 RTL | | | | | | | | | |

**Ghi `docs/test-log.md`:** một dòng cho mỗi bài — `F<N> | ngày | PASS/FAIL | ghi chú một câu`. File này là thứ `SAFETY.md` mục 10 tham chiếu khi hỏi "chức năng này đã pass standalone test chưa".

## Cổng pass

- [ ] **F1 Stabilize PASS:** cất cánh thẳng, hover 0,5–1 m trong 30 giây, hạ cánh có kiểm soát, không phải ABORT.
- [ ] **F2 AltHold PASS:** ở cần ga giữa, độ cao dao động ≤ ±0,3 m trong 30 giây; không nảy theo chu kỳ.
- [ ] **F3 Loiter PASS:** buông hết cần 60 giây, trôi trong bán kính ≤ 1,5 m, **không toilet bowl**, phanh dứt khoát theo cả 4 hướng.
- [ ] **F4 RTL PASS:** từ 20 m ngang / 10 m cao, gạt RTL → tự leo, tự bay về, tự hạ cánh trong bán kính ≤ 3 m quanh điểm cất cánh, không can thiệp.
- [ ] Đủ **4 thư mục** `logs/flight_YYYYMMDD_HHMM/`, mỗi thư mục có `flight.bin` **và** `notes.md` đã điền đủ 8 dòng.
- [ ] Với **cả 4** bộ log, 7 mục checklist ở 20.2 đã kiểm và ghi số vào `docs/do-dac/20-ket-qua-bay.md`.
- [ ] Với **cả 4** bộ log: `VIBE` X/Y/Z < 30 m/s²; `Clip0` = `Clip1` = `Clip2` = **0**; EKF variance < 0.5; compass innovation dao động quanh 0 và độ lớn từ trường **không đổi theo ga**; `BAT.Volt` lúc treo **không** tụt dưới 14,0 V; 4 đường `RCOU` chụm.
- [ ] `MOT_THST_HOVER` học được đã ghi lại; nếu > 0,65 thì đã xử lý (giảm payload) trước khi sang Phase 21.
- [ ] `BATT_AMP_PERVLT` đã hiệu chỉnh ít nhất một vòng theo mAh sạc lại.
- [ ] `RTL_ALT` đã đặt cao hơn mọi vật cản trong bãi và thấp hơn `FENCE_ALT_MAX`.
- [ ] `firmware/ardupilot/params/05-loiter-good.param` đã lưu và commit với prefix `param:`.
- [ ] `docs/test-log.md` có đủ 4 dòng F1–F4.
- [ ] `docs/so-tay/20-bay-rc-co-ban.md` đã viết xong.
- [ ] Sau mỗi chuyến, sờ 4 motor và ESC: **không cái nào nóng tới mức không giữ tay được**.
- [ ] `CH7` (`WEB CONTROL ENABLE`) ở vị trí **TẮT** trong cả 4 bài; `CH8` vẫn chưa gán.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Lật khi cất cánh do thứ tự/chiều motor hoặc cánh sai chiều | 3 | 5 | **15** | Ba lớp kiểm ở Phase 19 (Motor Test, chiều quay, ren tự siết); F1 bay ở 0,5–1 m để hạn chế thiệt hại; tiêu chí ABORT "hạ ga xuống hết ngay", không cố gượng |
| Người lái mất phương hướng (không biết đâu là mũi drone) → lái ngược → đâm | 4 | 4 | **16** | Luật đứng sau đuôi drone ≥ 5 m ở 20.1; mũi hướng ra xa; bay thấp và gần ở F1–F2; có người quan sát hô ABORT |
| Toilet bowl ở Loiter, vẫn cố bay Auto ở Phase 21 | 3 | 5 | **15** | Cổng pass cứng: F3 phải hết toilet bowl mới được sang F4; F4 phải pass mới được sang Phase 21; bảng chẩn đoán 4 nguyên nhân ở 20.5 |
| RTL bay sai hướng do la bàn → drone bay mất | 2 | 5 | **10** | F3 phải pass trước; tiêu chí ABORT "gạt về Loiter ngay khi thấy sai hướng"; `FENCE_RADIUS` 50 m là lưới chắn cuối |
| Rung cao (bát chống rung sai) làm hỏng AltHold/Loiter, đi sửa PID thay vì sửa rung | 3 | 4 | 12 | Checklist log ở 20.2 kiểm `VIBE` và `Clip` **trước** mọi thay đổi PID; bảng 20.7 nói rõ "không chỉnh PID để chữa rung" |
| Hết pin giữa chuyến do ngưỡng chưa chuẩn | 2 | 5 | **10** | `BATT_LOW_VOLT,14.0` + `BATT_FS_LOW_ACT,2` (RTL) đã đặt và đã hiệu chỉnh bằng đồng hồ ở Phase 19; người quan sát đọc to điện áp; ABORT ở 14,4 V |
| Desync motor xuất hiện lần đầu khi đang bay | 2 | 5 | **10** | Đã test desync tới 50 % ga không cánh ở Phase 19 mục 19.6; F1 bay thấp; tiêu chí ABORT có "tiếng khục"; sờ motor sau mỗi chuyến |
| Bay khi gió mạnh hơn khả năng của drone | 3 | 3 | 9 | Điều kiện gió < 3 m/s ở phần Đầu vào; ghi gió vào `notes.md` mỗi chuyến |
| Không đọc log, chỉ nói "bay được rồi", để lỗi tích tụ sang Phase 21–22 | 3 | 4 | 12 | Quy trình 20.2 là một mục việc bắt buộc riêng; cổng pass yêu cầu đủ 4 bộ log đã điền số |
| Tải log qua Wi-Fi bị đứt giữa chừng, mất dữ liệu chuyến bay | 3 | 2 | 6 | Quy tắc "tải qua USB, không qua ESP32" ở 20.2 bước A |
| Dataflash 16 MB đầy giữa buổi bay (do `LOG_DISARMED,1`) | 3 | 3 | 9 | Tải hết log về sau mỗi buổi rồi `Erase Logs`; kiểm tra dung lượng trước khi ra bãi |
| Sửa cùng một lỗi lần thứ 4 với cùng cách nghĩ, làm hỏng thêm | 3 | 3 | 9 | Luật 3 lần ở cuối 20.7; dừng buổi bay, về đọc log |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 20.1 Chuẩn bị, phân vai, giao thức ABORT | 1,0 | Làm ở nhà trước, nhắc lại tại bãi |
| 20.2 Dựng quy trình đọc log (lần đầu, có học) | 1,5 | Các lần sau chỉ còn ~0,5 giờ/chuyến |
| 20.3 F1 Stabilize + đọc log | 2,0 | Gồm cả thời gian di chuyển tới bãi |
| 20.4 F2 AltHold + đọc log + `MOT_THST_HOVER` + `BATT_AMP_PERVLT` | 2,0 | |
| 20.5 F3 Loiter + đọc log | 2,5 | Bài dễ phải bay lại nhiều lần nhất |
| 20.6 F4 RTL + đọc log | 2,0 | |
| 20.7 Xử lý lỗi phát sinh | 2,0 | **Dự phòng** — có thể bằng 0, có thể gấp đôi |
| 20.8 Lưu param, điền bảng, ghi `test-log.md` | 0,5 | |
| Viết `docs/so-tay/20-bay-rc-co-ban.md` | 1,0 | |
| **Tổng** | **~14,5** | |

Đường găng: 20.1 → 20.3 → 20.4 → 20.5 → 20.6 (hoàn toàn tuần tự, mỗi bài chặn bài sau). Chia buổi: **buổi 1** F1 + F2 (một viên pin mỗi bài, cộng thời gian đọc log giữa hai bài — nên mang 2–3 viên); **buổi 2** F3 + F4. Không cố ép 4 bài vào một buổi: đọc log tử tế mất thời gian hơn bay, và bay khi đã mệt là lúc dễ mất phương hướng nhất.

## Ghi chú cho sổ tay

- **Ba chế độ bay và chúng dùng cảm biến nào** — bảng: `Stabilize` (chỉ IMU), `AltHold` (+ khí áp kế), `Loiter` (+ GPS + la bàn). Giải thích vì sao thứ tự bài bay chính là thứ tự bật thêm cảm biến, và vì sao điều đó giúp tách bạch nguyên nhân lỗi.
- **Cần ga có ý nghĩa khác nhau ở Stabilize và AltHold** — ở Stabilize là công suất, ở AltHold là tốc độ lên/xuống; giữa = giữ độ cao.
- **Mất phương hướng (orientation loss) là gì** và ba cách phòng: đứng sau đuôi drone, dán màu khác nhau cho cánh trước/sau, bay thấp và gần khi mới tập.
- **File log `.bin` là gì**, dataflash khác thẻ nhớ thế nào, `LOG_BITMASK` và `LOG_DISARMED` làm gì.
- **Đọc đồ thị trong UAV Log Viewer** — cách chọn trường, cách so hai đường (`DesRoll` vs `Roll`), cách đọc trục thời gian.
- **Rung và clipping** — clipping nghĩa là gì (cảm biến bão hoà), vì sao `Clip > 0` nghiêm trọng hơn `VIBE` trung bình cao.
- **EKF là gì** (nói đơn giản: bộ lọc ghép nhiều cảm biến để đoán vị trí và tư thế), variance nghĩa là gì, vì sao variance cao là "EKF đang không tin cảm biến nào".
- **Compass innovation** — hiệu giữa "la bàn nói" và "EKF đoán"; vì sao innovation trôi lệch một phía là dấu hiệu la bàn sai.
- **Toilet bowl** — cơ chế, vì sao chỉ xuất hiện ở Loiter, và vì sao nó chặn Auto.
- **RTL và "home"** — home ghi tại lúc arm, không phải chỗ người đứng; `RTL_ALT` phải cao hơn vật cản và thấp hơn geofence.
- **Sụt áp (voltage sag) của pin LiPo** — vì sao điện áp lúc tải thấp hơn lúc nghỉ, và vì sao ngưỡng failsafe đặt theo điện áp dưới tải.
- **`MOT_THST_HOVER` và `MOT_HOVER_LEARN`** — ga treo thật là chỉ số sức khoẻ của drone; đọc nó sau chuyến bay đầu thay vì tin bảng của hãng.
- **Vì sao không chỉnh PID để chữa rung** — PID chữa triệu chứng, rung là nguyên nhân; chỉnh PID chỉ làm drone chậm phản ứng hơn với mọi thứ.
- **Luật 3 lần** — vì sao lần thử thứ tư với cùng cách nghĩ gần như luôn thất bại, và cần dừng để đặt lại giả thuyết.

---

**Prior-art:** rút vật liệu thô từ nháp cũ `README.md` GIAI ĐOẠN 50 (first flight chỉ RC, Stabilize, 0,5–1 m, hover ngắn, không bay mission ngay), 51 (đọc log sau first hop: vibration, attitude, GPS, battery, EKF, motor outputs; xử lý rung), 52 (AltHold 1–2 m, đánh giá altitude drift và vertical oscillation), 53 (Loiter, không động stick, chẩn đoán toilet bowl, "Loiter quay vòng thì không đi Auto"), 54 (RTL, bay ra 10–20 m, cổng pass "không phát triển Auto trước khi RTL pass"), 68 (kiểm tra payload, hover throttle, motor nóng), 87 (cấu trúc thư mục `logs/flight_*/` và mẫu `notes.md`), 88 (quy ước `05-loiter-good.param`). Ngưỡng rung 30/60 m/s² lấy từ nháp cũ GIAI ĐOẠN 31 (trích tài liệu ArduPilot). Ghi chú `MOT_THST_HOVER` và mâu thuẫn 0,48–0,50 vs 0,25 lấy từ `docs/bao-cao-tong-quan-du-an.md` mục 3.2. Ngưỡng pin 14,0/13,2 V lấy từ `plans/reports/260921-research-sitl-firmware-toolchain.md` mục 4.5. Checklist 7 mục đọc log, giao thức ABORT, bảng chẩn đoán triệu chứng→nguyên nhân→xác nhận→cách sửa, và toàn bộ cấu trúc flight card ở đây là mới.
