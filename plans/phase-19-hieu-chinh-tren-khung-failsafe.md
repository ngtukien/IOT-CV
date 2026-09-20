# Phase 19: Hiệu chỉnh trên khung + failsafe + gắn cánh

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 18 | ~13 giờ | Có (drone đã lắp xong ở Phase 18, pin 4S, sạc iMAX B6AC V2, đồng hồ vạn năng, smoke stopper, tay FS-i6X, laptop + Mission Planner, cân điện tử, kính bảo hộ, kẹp chữ C / dây rút cỡ lớn, túi chống cháy LiPo, cánh T1045) |

## Mục tiêu

Phase này biến một khung đã lắp xong thành **một chiếc drone đủ điều kiện cất cánh**. Toàn bộ hiệu chỉnh cảm biến được làm lại **trên khung thật** (không phải trên bàn như Phase 14–16, vì gia tốc kế và la bàn chỉ đúng khi đã ở đúng vị trí cuối cùng), mọi failsafe được **test thật chứ không chỉ đặt tham số**, geofence được bật, mọi pre-arm check phải sạch, rồi mới gắn cánh.

Kết thúc phase: drone arm được, pre-arm không còn cảnh báo nào, tắt tay điều khiển thì drone phản ứng đúng, ngưỡng pin đã đối chiếu với đồng hồ vạn năng, cánh đã gắn đúng chiều, tỉ số lực đẩy đã đo thật, và `04-pre-first-flight.param` đã lưu.

Phase này **vẫn chưa cất cánh**. Chuyến bay đầu tiên là Phase 20 bài F1.

> **AN TOÀN — quy tắc cánh trong phase này.** Từ 19.1 đến 19.12 là **NO PROPELLERS** tuyệt đối (`SAFETY.md` mục 2). Cánh chỉ được gắn ở 19.13, và chỉ khi **toàn bộ** checklist ở 19.12 đã pass. Từ 19.13 trở đi, mỗi lần chạm vào drone phải rút pin trước.

## Đầu vào cần có

Phải đọc trước:

- `SAFETY.md` — mục 2 (NO PROPELLERS), 3 (không disable pre-arm check), 4 (RC luôn có quyền cao nhất), 6 (pin LiPo), 7 (nguồn điện), 8 (địa điểm bay + geofence).
- `plans/reports/260921-research-sitl-firmware-toolchain.md` mục 4 — đặc biệt 4.4 (la bàn ngoài IST8310, **không** đặt cứng `COMPASS_ORIENT`, **không** đặt tay `COMPASS_PRIO*_ID`), 4.5 (mâu thuẫn `BATT_VOLT_MULT` 11.0 vs 11.2, ngưỡng 4S 14.0/13.2 V), 4.6 (bản nháp `01-base.param` và **danh sách tham số KHÔNG được nạp từ file**).
- `plans/reports/260921-research-esp32-bridge-camera.md` mục 4 — bảng giá trị `FS_GCS_ENABLE` và cảnh báo vì sao các chuyến đầu phải để `0`.
- `params/obstacle-avoidance-tfminiplus-serial3.param` — đã nạp ở Phase 17; ở phase này chỉ xác nhận `FENCE_ENABLE,1` và các `AVOID_*` còn nguyên (việc chỉnh `AVOID_*` thuộc Phase 22).
- `docs/do-dac/18-can-khoi-luong.md` — số AUW cân thật ở Phase 18, dùng ở mục 19.14.
- Checklist đấu dây in giấy (Phase 13) và 13 ảnh lắp ráp (`docs/so-tay/anh/18/`).
- **Ghi chú Phase 15** — bản đồ công tắc đã chốt: `CH5` (3 vị trí) = `Stabilize` / `AltHold` / `Loiter`; `CH6` = `RTL`; `CH7` = `WEB CONTROL ENABLE` (backend đọc kênh này); `CH8` để dành cho `Auto`, gán ở Phase 21.
- **Ghi chú Phase 16** — danh sách lỗi pre-arm ghi nhận khi bo còn trên bàn. Danh sách đó là checklist của mục 19.12.

Phải có sẵn và đã pass:

- Phase 18 đã pass toàn bộ cổng pass, đặc biệt: continuity `BAT+`↔`BAT−` không chập, 12 mối hàn motor OK, tụ đúng cực.
- Pin 4S đã sạc cân bằng đầy bằng iMAX B6AC V2, chênh lệch giữa các cell ≤ 0,03 V.
- Mission Planner đã nối được với bo bay qua USB (Phase 14) và qua ESP32 bridge (Phase 17).
- Bãi trống để hiệu chỉnh la bàn: ngoài trời, cách xa nhà, xe, cột điện, nắp cống, cốt thép sàn.

## File và thư mục sở hữu

Tạo mới:

- `firmware/ardupilot/params/04-pre-first-flight.param` — ảnh chụp toàn bộ tham số sau khi phase này pass.
- `docs/so-tay/19-hieu-chinh-failsafe.md` — sổ tay người mới cho phase này.
- `docs/checklist-truoc-bay.md` — checklist walk-around in ra giấy, dùng lại ở mọi phase bay sau (20, 21, 22, 24).
- `docs/do-dac/19-do-luc-day.md` — bảng đo lực đẩy trên cân ở mục 19.14.

Sửa:

- `plans/PROGRESS.md` — tick checkbox của Phase 19.

**Không đụng:** `backend/`, `frontend/`, `ml/`, `plans/reports/`, `SAFETY.md`, các file param `00`–`03` (chúng là lịch sử, không sửa đè). Nếu phải thay đổi một giá trị đã có trong `01-base.param`, **ghi giá trị mới vào `04-pre-first-flight.param`** và nêu lý do trong commit message — không sửa file cũ.

> **Ghi chú tên file cần đối chiếu:** `params/README.md` (quy ước cũ) từng liệt kê mốc này là `04-first-flight.param`, còn `plans/_phase-index.md` gọi là `04-pre-first-flight`. Phase này dùng **`04-pre-first-flight.param`** theo index. Phase-11 đã đặt tên file này là `04-pre-first-flight.param` trong `firmware/ardupilot/params/README.md`.

## Việc theo thứ tự

### 19.1 Đo lại continuity trên khung đã lắp xong

Phase 18 đã đo, nhưng đó là lúc chưa siết hết ốc, chưa gập dây, chưa lắp tầng. Rung và lực siết có thể tạo ra một điểm chạm mới. Đo lại là 5 phút; bỏ qua có thể mất cả stack.

```text
Chuẩn bị: PIN VẪN TRONG TÚI, chưa lấy ra. Đồng hồ ở chế độ continuity.

Đo 1: chân + của XT60  <->  chân - của XT60
      ĐÚNG: không kêu bíp liên tục (có thể bíp ngắn rồi tắt do tụ đang nạp)

Đo 2: chân + của XT60  <->  từng ốc kim loại trên khung (thử ít nhất 6 điểm)
      ĐÚNG: không kêu

Đo 3: chân - của XT60  <->  thân từng motor (4 điểm)
      ĐÚNG: không kêu, hoặc kêu nếu thiết kế nối đất chung —
            ghi lại kết quả và so với Phase 18, quan trọng là KHÔNG ĐỔI

Đo 4: từng pha motor  <->  ốc bắt cần (12 phép, làm nhanh)
      ĐÚNG: không kêu
```

> **AN TOÀN:** Nếu bất kỳ phép đo nào đổi kết quả so với Phase 18, **dừng lại và tìm nguyên nhân**. Không cắm pin để "xem thử".

**Kết quả mong đợi:** 4 nhóm phép đo cho kết quả giống hệt Phase 18.

**Nếu lỗi:** *đo 1 kêu liên tục:* có dây bị ép thủng khi siết ốc (nghi ngờ đầu tiên: cáp 10 chân giữa hai tầng — Phase 18 mục 18.9). Tháo tầng ra kiểm tra.

### 19.2 Cấp điện lần đầu trên khung, qua smoke stopper

**Smoke stopper** là một mạch nhỏ nối giữa pin và drone, có một bóng đèn sợi đốt mắc nối tiếp. Nếu drone chập, dòng đi qua bóng đèn làm nó **sáng rực** thay vì đốt cháy dây — bạn có vài giây để rút pin.

1. Đeo **kính bảo hộ**. Đặt drone trong khoảng trống, không có gì dễ cháy xung quanh.
2. Cắm smoke stopper vào giữa pin và XT60 của drone.
3. Cắm pin. **Nhìn vào bóng đèn.**

```text
Bóng nháy sáng rồi TẮT / mờ hẳn   -> BÌNH THƯỜNG (tụ 1000uF đang nạp)
Bóng SÁNG RỰC và GIỮ NGUYÊN        -> CHẬP. RÚT PIN NGAY.
Có khói, mùi khét, tiếng nổ nhỏ    -> RÚT PIN NGAY, không chạm tay vào board
```

4. Nếu bình thường: quan sát 30 giây. Đèn của FC, ESC, GPS, receiver phải sáng. Sờ (nhẹ, bằng mu bàn tay) từng board — **không board nào được nóng**.
5. Rút pin, tháo smoke stopper, cắm pin trực tiếp, lặp lại quan sát 30 giây.
6. Nối Mission Planner (qua USB hoặc qua ESP32 bridge) và xác nhận bo bay lên bình thường.

> **AN TOÀN:** Không có smoke stopper thì thay bằng cách: cắm pin **trong 2 giây rồi rút ngay**, sờ kiểm tra nhiệt, lặp lại 3 lần tăng dần thời gian. Kém hơn nhiều nhưng còn hơn cắm thẳng 30 giây. (`SAFETY.md` mục 7.)

**Kết quả mong đợi:** không chập, mọi đèn sáng, không board nào nóng, Mission Planner nhận bo bay.

**Nếu lỗi:**

- *Đèn smoke stopper sáng rực:* chập nguồn. Rút pin, quay lại 19.1, kiểm tra cáp 10 chân và mối hàn XT60.
- *FC không lên đèn nhưng ESC có:* cáp 10 chân cắm không tới hoặc gãy chân. Không cắm/rút khi còn pin.
- *GPS/receiver không lên:* BEC 5V của stack quá tải hoặc dây 5V đứt. Đo điện áp tại chân 5V bằng đồng hồ.

### 19.3 Hiệu chỉnh gia tốc kế — 6 vị trí

Gia tốc kế phải được hiệu chỉnh **sau khi bo bay đã ở vị trí cuối cùng trên khung**. Hiệu chỉnh trên bàn ở Phase 14 chỉ để kiểm tra cảm biến còn sống; kết quả đó không dùng được nữa.

1. Mission Planner → `SETUP` → `Mandatory Hardware` → `Accel Calibration` → `Calibrate Accel`.
2. Mission Planner sẽ lần lượt yêu cầu 6 tư thế: **LEVEL** (nằm ngang), **LEFT** (nghiêng trái 90°), **RIGHT**, **NOSE DOWN** (chúi mũi xuống), **NOSE UP**, **BACK** (lật ngửa).
3. Với mỗi tư thế: **đặt drone xuống mặt phẳng chắc chắn, buông tay hoàn toàn**, rồi mới bấm nút tiếp tục.

> **AN TOÀN cho chất lượng dữ liệu:** **Không cầm drone trên tay khi Mission Planner đang lấy mẫu.** Tay người luôn rung; gia tốc kế sẽ học luôn cái rung đó thành "mức 0". Hậu quả không hiện ngay — nó hiện ở Phase 20 dưới dạng drone trôi ngang trong AltHold và bạn sẽ đi tìm lỗi ở chỗ khác. (Nháp cũ GIAI ĐOẠN 38.)

4. Tư thế `LEVEL` và `BACK` là khó nhất vì drone có chân đáp và GPS mast. Dùng hộp/sách kê cho phẳng và **ổn định**; đừng để drone chông chênh.
5. Kết thúc: Mission Planner báo `Calibration Successful`.

**Sau đó làm `Calibrate Level` (level trim):**

Đặt drone ở tư thế **đúng như khi nó đậu trên đất trước khi cất cánh** (trên chân đáp, trên mặt phẳng ngang), rồi Mission Planner → `SETUP` → `Mandatory Hardware` → `Accel Calibration` → `Calibrate Level`. Bước này dạy ArduPilot biết "thế nào là ngang" ở đúng tư thế nó sẽ cất cánh.

> Nếu mặt đất ở bãi bay dốc, đừng làm `Calibrate Level` ở đó. Làm ở một mặt phẳng ngang thật (mặt bàn có kiểm tra bằng nivo hoặc app thước thuỷ trên điện thoại).

**Kết quả mong đợi:** `Calibration Successful`; trong màn hình `Flight Data` của Mission Planner, chân trời nhân tạo (HUD) nằm **ngang** khi drone đậu trên mặt phẳng ngang.

**Nếu lỗi:**

- *`Calibration FAILED`:* thường do một tư thế bị lay. Làm lại, kê chắc hơn.
- *HUD nghiêng dù drone đặt ngang:* chạy lại `Calibrate Level`. Nếu vẫn nghiêng > 2°, kiểm tra bát chống rung có bị lệch không.
- *HUD nghiêng đúng 90° hoặc lộn ngược:* bo bay đang bị xoay mà chưa khai báo. Đặt `AHRS_ORIENTATION` cho đúng, reboot, rồi hiệu chỉnh lại từ đầu.

### 19.4 Hiệu chỉnh la bàn — ngoài trời, xa kim loại

Bo F405 V5 **không có la bàn tích hợp**; la bàn duy nhất là IST8310 nằm trên GPS M10. Nó nhạy với mọi thứ bằng sắt và mọi dòng điện lớn.

**Chọn chỗ:**

```text
TRÁNH:  bàn sắt, laptop đặt sát, loa, nguồn điện lớn, ô tô/xe máy,
        cột điện, nắp cống, sàn bê tông có cốt thép, hàng rào sắt
NÊN:    bãi cỏ / sân đất trống, cách mọi vật kim loại lớn ít nhất 5 m,
        laptop đặt cách drone ít nhất 3 m (nối qua ESP32 bridge cho tiện)
```

**Quy trình (Onboard Mag Calibration):**

1. Cắm pin, đợi GPS có fix (đèn GPS nhấp nháy đều / Mission Planner báo `3D Fix`). Không bắt buộc nhưng giúp ArduPilot ghi nhận từ trường Trái Đất tại vị trí đó.
2. Mission Planner → `SETUP` → `Mandatory Hardware` → `Compass`.
3. Để nguyên các tuỳ chọn mặc định. **Không tự đặt `COMPASS_ORIENT` trước khi calibrate** — ArduPilot tự suy ra hướng trong quá trình hiệu chỉnh (`260921-research-sitl-firmware-toolchain.md` mục 4.4). **Không bao giờ đặt tay `COMPASS_PRIO*_ID`** — các ID đó chỉ sinh ra sau khi bo thực sự nhìn thấy cảm biến.
4. Bấm `Start`. Cầm drone (đã rút cánh — chưa có cánh), **xoay chậm và đều quanh cả ba trục**: quay tròn khi cầm ngang, rồi cầm dựng mũi lên quay tròn, rồi cầm lật nghiêng quay tròn, rồi lật ngửa quay tròn. Mỗi hướng xoay đủ 360°. Mất khoảng 60–90 giây.
5. Thanh tiến trình chạy tới 100% → Mission Planner báo hoàn tất và yêu cầu **reboot** bo bay.

**Thế nào là một kết quả tốt:**

```text
[ ] Thanh tiến trình chạy tới 100% MÀ KHÔNG bị tụt lùi giữa chừng
    (tụt lùi = ArduPilot đang loại bỏ mẫu xấu -> chỗ đứng bị nhiễu)
[ ] Mission Planner báo thành công cho ĐÚNG SỐ la bàn đang bật (dự án này: 1)
[ ] Giá trị offset báo về (COMPASS_OFS_X/Y/Z) có độ lớn tổng
    sqrt(X^2+Y^2+Z^2) NHỎ. Dưới ~600 là tốt.  (chưa xác minh con số ngưỡng
    chính xác cho 4.7 — đối chiếu COMPASS_OFFS_MAX trong Full Parameter List)
[ ] Sau reboot, KHÔNG còn cảnh báo pre-arm nào liên quan compass
[ ] Xoay drone tại chỗ và nhìn mũi drone trên bản đồ Mission Planner:
    hướng hiển thị phải xoay CÙNG CHIỀU và ĐÚNG GÓC với thực tế
```

Kiểm tra cuối cùng và là kiểm tra quan trọng nhất: **chĩa mũi drone về hướng Bắc thật** (dùng la bàn điện thoại, đứng cách drone 2 m) và xem biểu tượng drone trên bản đồ Mission Planner có chỉ lên Bắc không. Lệch > 15° là có vấn đề.

**Khi nào mới đặt tay `COMPASS_ORIENT`:** chỉ khi bước hiệu chỉnh **báo lỗi orientation**, hoặc khi kiểm tra hướng Bắc ở trên cho kết quả lệch một góc cố định rõ ràng (45°, 90°, 180°). Khi đó tra bảng orientation của ArduPilot, đặt giá trị, reboot, **rồi hiệu chỉnh lại từ đầu**.

**Kết quả mong đợi:** hiệu chỉnh thành công, offset nhỏ, hướng trên bản đồ khớp thực tế, không còn cảnh báo compass.

**Nếu lỗi:**

- *Thanh tiến trình đứng im hoặc tụt lùi liên tục:* chỗ đứng bị nhiễu từ. Đi xa thêm 10 m, thử lại. Nếu vẫn vậy ở nơi trống hoàn toàn → nghi la bàn nằm quá gần dây nguồn (Phase 18 mục 18.11), phải nâng cột GPS cao hơn.
- *`Compass inconsistent` sau khi reboot:* hai la bàn (nếu có) bất đồng. Dự án này chỉ có một; nếu báo lỗi này thì có một la bàn "ma" đang bật — kiểm tra `COMPASS_USE2`/`COMPASS_USE3` phải là 0.
- *Offset rất lớn (> 1000):* có vật sắt gắn ngay cạnh GPS, hoặc GPS mast đang nằm sát dây nguồn. Xử lý cơ khí, không "chấp nhận cho xong".

### 19.5 Kiểm tra lại radio và bản đồ switch

Radio đã hiệu chỉnh ở Phase 15, nhưng phải kiểm tra lại **trên khung** vì receiver đã đổi vị trí và anten đã đổi hướng.

1. Bật tay FS-i6X **trước**, rồi cắm pin cho drone. (Luôn theo thứ tự này — bật tay sau khi drone đã có điện có thể gửi xung rác.)
2. Mission Planner → `SETUP` → `Mandatory Hardware` → `Radio Calibration`. **Không bấm `Calibrate Radio`** — chỉ nhìn.
3. Gạt từng cần và từng công tắc, kiểm tra:

```text
[ ] Cần ga (throttle) : kéo xuống hết -> thanh về ~1000, đẩy lên hết -> ~2000
[ ] Cần roll/pitch/yaw: về giữa -> ~1500, hai đầu -> ~1000 / ~2000
[ ] Không cần nào bị lệch tâm (về giữa mà không ra 1500 +-20)
[ ] Công tắc mode đổi đúng chế độ hiển thị trên Mission Planner
    (Flight Data -> góc dưới trái hiện tên mode)
[ ] Bản đồ công tắc ĐÃ CHỐT Ở PHASE 15 — kiểm đủ 4 kênh:
      CH5 (3 vị trí, FLTMODE_CH) : Stabilize / AltHold / Loiter
      CH6 (RC6_OPTION)           : RTL
      CH7 (RC7_OPTION / đọc thô) : WEB CONTROL ENABLE — BACKEND đọc kênh này
      CH8                        : ĐỂ DÀNH cho Auto, sẽ gán RC8_OPTION ở Phase 21
```

4. Kiểm tra **tầm** sơ bộ: nhờ người giữ drone (hoặc đặt xuống đất), cầm tay đi ra **50 m**, gạt công tắc và xem Mission Planner có đổi mode không. Đây chưa phải test tầm đầy đủ nhưng bắt được lỗi anten đặt sai ở Phase 18 mục 18.10.

**Kết quả mong đợi:** cả 4 cần và các công tắc đúng; CH5 ra đủ 3 mode, CH6 ra `RTL`; ở 50 m vẫn điều khiển được.

> **CH7 = `WEB CONTROL ENABLE`, và backend đọc thẳng kênh RC này.** Nghĩa là công tắc cho phép web điều khiển **nằm trên tay người vận hành**, không phải chỉ là một nút trên trình duyệt. Đây là hiện thực mạnh nhất của `SAFETY.md` mục 4 ("web không được tự giành quyền"): muốn cắt mọi lệnh từ web, gạt CH7 về tắt — không cần laptop, không cần Wi-Fi. Ở phase này chỉ **kiểm tra kênh có ra đúng giá trị** khi gạt (nhìn `rcin` kênh 7 trên tab `Status`); việc backend dùng nó được test ở Phase 21.
>
> **CH8 để trống ở phase này.** `RC8_OPTION` cho `Auto` sẽ được gán ở Phase 21 mục 21.3 — không gán sớm, vì một công tắc `Auto` sống trong khi chưa có mission nào được kiểm chứng là một cách vào `Auto` ngoài ý muốn.

**Nếu lỗi:**

- *Một cần lệch tâm:* chỉnh trim trên tay FS-i6X về 0 rồi chạy lại `Calibrate Radio`. **Không** sửa `RC*_TRIM` bằng file param — đó là một trong những tham số không được nạp từ file (`260921-research-sitl-firmware-toolchain.md` mục 4.6).
- *Mất tín hiệu ở 50 m:* anten đặt sai. Quay lại Phase 18 mục 18.10. Đừng bay.

### 19.6 Kiểm tra lại thứ tự và chiều quay motor — KHÔNG CÁNH

> **AN TOÀN:** Đây là bước có xác suất gây thương tích cao nhất trong phase. **Cánh phải ở trong hộp, trong một phòng khác.** Kẹp chặt drone xuống bàn bằng kẹp chữ C hoặc dây rút cỡ lớn — motor chạy có thể làm drone tự trượt đi. Không để ngón tay, dây, hay tóc trong tầm trục motor. Đeo kính bảo hộ. (`SAFETY.md` mục 2; nháp cũ GIAI ĐOẠN 41.)

**Kiểm tra thứ tự:**

1. Mission Planner → `SETUP` → `Optional Hardware` → `Motor Test`.
2. Đặt `Throttle %` = **5**, `Duration` = **2** giây.
3. Bấm `Test motor A` → quan sát **motor nào quay**.

> **Điểm rất dễ nhầm:** chữ cái A/B/C/D trong Motor Test **đi theo chiều kim đồng hồ quanh khung, bắt đầu từ trước-phải**, **không** đi theo số thứ tự motor. Với Quad X:
>
> ```text
> Test A -> motor TRƯỚC-PHẢI  = M1
> Test B -> motor SAU-PHẢI    = M4
> Test C -> motor SAU-TRÁI    = M2
> Test D -> motor TRƯỚC-TRÁI  = M3
> ```
>
> (chưa xác minh trên bản 4.7 — **đối chiếu ngay với sơ đồ khung mà Mission Planner hiển thị** trong `SETUP` → `Mandatory Hardware` → `Frame Type`. Sơ đồ đó là nguồn đúng, không phải trí nhớ.)

4. Ghi lại kết quả cả 4 nút. Nếu sai, **sửa dây / sửa mapping output**, không nghĩ *"bay thử xem sao"* (nháp cũ GIAI ĐOẠN 42).

**Kiểm tra chiều quay:**

5. Dán một mẩu băng dính nhỏ lên trục từng motor để nhìn rõ chiều quay, hoặc quay phim chậm bằng điện thoại.
6. Chạy lại từng motor và đối chiếu với quy ước ArduPilot Quad X:

```text
M1 trước-phải : CCW (ngược kim đồng hồ, nhìn từ trên xuống)
M2 sau-trái   : CCW
M3 trước-trái : CW
M4 sau-phải   : CW
```

7. Motor nào quay sai chiều: **rút pin**, đổi **bất kỳ 2 trong 3 dây** của motor đó, cắm lại, test lại. (Nháp cũ GIAI ĐOẠN 43; đây cũng là cách ArduPilot hướng dẫn.)
8. Sau khi đổi, **kiểm tra lại chiều ren** (Phase 18 mục 18.3): vặn cánh vào bằng tay rồi xoay cánh theo chiều motor sẽ quay — phải thấy **siết chặt vào**, không được nới ra. Nếu nới ra thì motor đang đứng nhầm vị trí, phải **đổi chỗ hai motor** chứ không phải đổi dây.

**Test desync — bắt buộc, làm trước khi ra ngoài trời:**

> **Đây là lần chạy ga thật đầu tiên của hệ thống.** Phase 16 chỉ chạy motor tới **≤ 10 %** và chạy trên **mối nối tạm** (chưa nối dài dây). Phase 18 vừa tạo **12 mối hàn 16AWG thật** trên dây motor dài 30 cm — mà mối hàn nguội trên chính những mối đó là một trong hai nguyên nhân gây desync. Vì vậy số liệu "10 % chạy tốt ở Phase 16" **không chứng minh được gì** cho dải ga 20–50 %; phải chạy lại đủ dải ở đây.

ESC OX32 55A thiết kế cho drone đua (motor nhỏ, ~25.000 vòng/phút). Motor AIR2216II to và chậm hơn nhiều (~7.900 vòng/phút ở ga đầy). Cặp này đôi khi **mất đồng bộ (desync)**: motor đang quay thì khựng lại. Trên không, desync một motor là rơi.

```text
1. Drone VẪN KẸP CHẶT xuống bàn. VẪN CHƯA LẮP CÁNH.
2. Motor Test, đẩy ga TỪ TỪ theo nấc: 10% -> 20% -> 30% -> 50%
3. NGHE. Tiếng phải là tiếng rít đều, lên đều theo ga.
4. Nghe thấy "khục", giật, hoặc motor tự dừng rồi chạy lại
   -> ĐÂY LÀ DESYNC. KHÔNG BAY. Xử lý trước:
      - hạ MOT_PWM_TYPE xuống 4 (DShot150) rồi test lại
        (hiện đang là 5 = DShot300 theo 01-base.param)
      - kiểm tra lại 12 mối hàn dây motor — mối hàn nguội gây đúng triệu chứng này
      - nếu vẫn còn, phải chỉnh timing trong phần mềm cấu hình ESC
5. Thử cả 4 motor riêng, rồi thử TĂNG GA ĐỘT NGỘT (mô phỏng gượng gió)
6. Cuối cùng: `Test all motors in sequence` — cả 4 phải khởi động MƯỢT và
   GẦN NHƯ CÙNG LÚC ở 5-10%.
```

Nếu một motor start rất muộn hoặc khựng: **không gắn cánh.**

**Kết quả mong đợi:** 4 nút Motor Test đúng motor; 4 chiều quay đúng quy ước; không có dấu hiệu desync ở mọi mức ga tới 50%; cả 4 khởi động đều.

**Nếu lỗi:**

- *Một motor không quay:* mối hàn đứt (quay lại đo 3 pha như Phase 18 mục 18.5), hoặc kênh ESC hỏng. Đổi dây motor đó sang kênh khác để phân biệt hỏng motor hay hỏng ESC.
- *Motor rung mạnh và kêu to ở ga thấp:* thường là dấu hiệu sớm của desync. Hạ xuống DShot150 và test lại.

### 19.7 Xác nhận ESC telemetry và các tham số nền

Không phải bước hiệu chỉnh, chỉ là xác nhận những gì `01-base.param` đã đặt vẫn đúng sau khi lắp lên khung. Mission Planner → `CONFIG` → `Full Parameter List`, tìm và đối chiếu:

```text
FRAME_CLASS      1     Quad
FRAME_TYPE       1     X
MOT_PWM_TYPE     5     DShot300  (chưa nâng lên 6 — nâng sau khi bay ổn)
SERIAL2_PROTOCOL 2     MAVLink2  -> ESP32 bridge
SERIAL3_PROTOCOL 9     Rangefinder -> TFmini Plus
SERIAL4_PROTOCOL 5     GPS
SERIAL5_PROTOCOL 16    ESC Telemetry
SERIAL6_PROTOCOL 23    RCIN -> iA6B iBUS
RC_PROTOCOLS     4     chỉ iBUS
GPS1_TYPE        2     uBlox
COMPASS_ENABLE   1
SERVO_BLH_POLES  14    KIỂM TRA datasheet motor AIR2216II — sai số này làm RPM sai
SERVO_BLH_TRATE  10    đủ cho hiển thị; nâng lên 100 ở Phase 22 khi bật notch
LOG_BITMASK      176126
LOG_DISARMED     1     ghi log ngay từ khi cắm điện, để bắt lỗi lúc khởi động
```

Kiểm tra ESC telemetry đang chạy: Mission Planner → `Flight Data` → tab `Status`, tìm `esc1_rpm` … `esc4_rpm`. Chạy Motor Test ở 10% (vẫn không cánh, vẫn kẹp chặt) — số RPM phải nhảy lên. Đây là nguồn RPM cho harmonic notch ở Phase 22; nếu không có số ở đây thì Phase 22 làm không được.

**Kết quả mong đợi:** mọi tham số đúng bảng trên; `esc1..4_rpm` có số khi chạy Motor Test.

**Nếu lỗi:** *không có `esc*_rpm`:* dây telemetry của ESC chưa cắm vào SERIAL5, hoặc baud sai (phải là `SERIAL5_BAUD,19` = 19200). Đây **không chặn** chuyến bay đầu — ghi lại và xử lý trước Phase 22.

### 19.8 Test RC failsafe — tắt tay điều khiển

> **AN TOÀN:** Không cánh. Drone vẫn kẹp trên bàn. (`SAFETY.md` mục 2; nháp cũ GIAI ĐOẠN 46.)

`FS_THR_ENABLE,1` đã đặt trong `01-base.param`, nhưng **đặt tham số không phải là test**.

1. Drone có điện, tay FS-i6X bật, Mission Planner đang nối, **drone DISARM**.
2. Xác nhận Mission Planner đang hiện mode bình thường và không có cảnh báo RC.
3. **Tắt tay FS-i6X.**
4. Quan sát Mission Planner trong 3 giây.

```text
KẾT QUẢ ĐÚNG (khi drone đang DISARM):
  Mission Planner hiện cảnh báo đỏ "Radio Failsafe" hoặc "NO RC Receiver"
  Trên tab Status: rcin các kênh đứng yên hoặc về giá trị failsafe
  Pre-arm xuất hiện lỗi liên quan RC -> KHÔNG ARM ĐƯỢC. Đây là điều mong muốn.
```

5. Bật lại tay FS-i6X. Cảnh báo phải **tự mất** trong vài giây.

**Hành vi khi đang ARM và đang bay** (không test ở phase này — chỉ cần hiểu): với `FS_THR_ENABLE,1`, mất tín hiệu RC khi đang bay sẽ kích **RTL** (hoặc `LAND` nếu chưa có GPS fix). Bài test thật khi bay thuộc Phase 24 (ma trận test hỏng hóc), **không** làm ở chuyến bay đầu.

6. Kiểm tra thêm phía receiver: iA6B phải được đặt chế độ failsafe đúng ở Phase 15 (tay FS-i6X → `RX Setup` → `Failsafe`). Nếu receiver vẫn phát ra giá trị cuối cùng thay vì giá trị failsafe, ArduPilot sẽ **không** biết là đã mất sóng. Test lại: tắt tay, nhìn `rcin` của kênh ga trên tab `Status` — giá trị phải tụt xuống **dưới** `FS_THR_VALUE` (mặc định 975), không phải giữ nguyên ở vị trí cuối.

**Kết quả mong đợi:** tắt tay → cảnh báo hiện ra trong ≤ 3 giây và kênh ga tụt xuống dưới ngưỡng; bật lại → cảnh báo tự hết.

**Nếu lỗi:**

- *Không có cảnh báo gì khi tắt tay:* receiver đang giữ giá trị cuối (hold). Phải cấu hình failsafe trong tay FS-i6X cho iA6B. **Đây là lỗi chặn — không bay khi chưa sửa.**
- *Cảnh báo không tự hết khi bật lại tay:* bind bị mất. Bind lại theo Phase 15.

### 19.9 Battery failsafe — hiệu chỉnh trước, đặt ngưỡng sau

Battery failsafe chỉ đáng tin khi bo bay **đọc điện áp đúng**. Làm đúng thứ tự: hiệu chỉnh, rồi mới đặt ngưỡng.

**Bước 1 — biết mình đang tin con số nào.** `01-base.param` đặt `BATT_VOLT_MULT,11.0` theo `hwdef.dat`, trong khi README của bo ghi `11.2`. **Hai nguồn chính thức mâu thuẫn nhau** (`260921-research-sitl-firmware-toolchain.md` mục 4.5) — nên không tin con nào, phải tự đo.

**Bước 2 — hiệu chỉnh điện áp bằng đồng hồ vạn năng:**

```text
1. Cắm pin. Đọc điện áp trên Mission Planner (Flight Data -> ô Battery).
2. Đo điện áp THẬT ở đầu XT60 bằng đồng hồ (chế độ DC Volt, thang 20V).
3. Lệch > 0,1 V thì sửa:

   BATT_VOLT_MULT mới = BATT_VOLT_MULT cũ x (điện áp đo được / điện áp MP hiện)

4. Ghi giá trị mới, reboot, đo lại.
5. Lặp cho tới khi hai số khớp nhau trong khoảng 0,05 V.
```

Cách nhanh hơn: Mission Planner → `SETUP` → `Optional Hardware` → `Battery Monitor` → gõ điện áp đo được vào ô `Measured battery voltage`, Mission Planner tự tính lại `BATT_VOLT_MULT`.

> **AN TOÀN:** **Không copy ngưỡng khi số đọc còn sai.** Số đọc sai + ngưỡng đúng = drone rơi vì tưởng còn pin, hoặc RTL giữa chừng vì tưởng hết pin. (Nháp cũ GIAI ĐOẠN 48.)

**Bước 3 — đặt ngưỡng cho pin 4S 5300 mAh:**

```text
Số cell:          4
Nghỉ đầy:         16,8 V   (4,20 V/cell)
Nghỉ an toàn hết: 14,8 V   (3,70 V/cell) — điểm NÊN hạ cánh
Dưới tải:         sụt thêm 0,3-0,6 V so với lúc nghỉ

BATT_CAPACITY      5300
BATT_LOW_VOLT      14.0    3,50 V/cell dưới tải -> cảnh báo + RTL
BATT_CRT_VOLT      13.2    3,30 V/cell dưới tải -> LAND ngay
BATT_FS_LOW_ACT    2       RTL
BATT_FS_CRT_ACT    1       LAND
BATT_LOW_TIMER     10      giây — tránh báo giả khi tăng ga đột ngột
BATT_FS_LOW_MAH    1060    dùng tối đa 80% (chỉ bật SAU khi đã hiệu chỉnh
                           BATT_AMP_PERVLT xong; trước đó để 0)
```

`BATT_LOW_VOLT = 14.0` trùng đúng con số trong `Holybro-S500.param` chính hãng của ArduPilot, nên dùng nó thay vì tự nghĩ ngưỡng khác. Muốn nương pin hơn thì nâng lên 14.4 / 13.6 (3,60 / 3,40 V/cell) — đổi lại mỗi chuyến ngắn hơn khoảng một phút.

**Bước 4 — bật lại kiểm tra điện áp lúc arm.** `01-base.param` đặt `BATT_ARM_VOLT,0` (tắt) để tránh báo lỗi nhầm khi chưa hiệu chỉnh. Sau khi bước 2 xong, đặt lại `BATT_ARM_VOLT,14.8` (3,70 V/cell lúc nghỉ — **chưa xác minh**, siết lại sau khi biết sụt áp thật của bộ pin này). Mục đích: không cho arm với một viên pin đã cạn dở.

> Chú thích trong `01-base.param` hiện ghi *"DAT LAI 0 sau khi calib xong"*, mâu thuẫn với chính nó (0 nghĩa là tắt). Ghi nhận và sửa lại chú thích khi Phase 24 chốt `07-final.param`.

**Bước 5 — hiệu chỉnh dòng điện** (`BATT_AMP_PERVLT`): để **sau chuyến bay đầu**. Cách làm: bay một chuyến, ghi số mAh Mission Planner báo đã dùng, rồi so với số mAh sạc thật nạp vào khi sạc lại bằng iMAX B6AC V2; nhân tỉ lệ vào `BATT_AMP_PERVLT`. Không chặn Phase 20.

**Kết quả mong đợi:** điện áp Mission Planner khớp đồng hồ trong 0,05 V; các ngưỡng đã đặt; `BATT_ARM_VOLT` đã bật lại.

**Nếu lỗi:** *số điện áp nhảy loạn:* dây đo điện áp trong cáp 10 chân bị nhiễu hoặc tiếp xúc kém. Kiểm tra cáp; không đặt ngưỡng dựa trên một số nhảy loạn.

### 19.10 GCS failsafe — để TẮT cho các chuyến đầu

`FS_GCS_ENABLE` quyết định drone làm gì khi mất heartbeat từ trạm mặt đất (mặc định sau `FS_GCS_TIMEOUT` = 5 giây).

```text
FS_GCS_ENABLE = 0   Disabled   <-- GIÁ TRỊ CỦA DỰ ÁN NÀY cho Phase 20-21
              = 1   RTL (Land nếu không có GPS)
              = 3   SmartRTL -> RTL -> Land
              = 4   SmartRTL -> Land
              = 5   Luôn Land
              = 6   Auto DO_LAND_START hoặc RTL
              = 7   BRAKE, không được thì LAND
FS_GCS_TIMEOUT = 5  giây
```

**Vì sao để 0:** trạm mặt đất của dự án này nối qua Wi-Fi 2,4 GHz (ESP32 + DroneBridge). Link Wi-Fi 2,4 GHz **sẽ** rớt lặt vặt — tầm công bố chỉ ~50–200 m trong điều kiện lý tưởng, còn ở đây có thêm nhiễu từ ESC và nhiễu từ chính bộ RC cũng ở 2,4 GHz. Nếu để `FS_GCS_ENABLE = 1`, drone sẽ **tự RTL giữa chừng chỉ vì laptop mất gói 5 giây**, trong khi thực ra nó đang bay hoàn toàn bình thường và bạn vẫn đang cầm RC. (`260921-research-esp32-bridge-camera.md` mục 4; `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` mục 6.)

**Đường dây cứu sinh là bộ RC (`FS_THR_ENABLE`), không phải Wi-Fi.** `SAFETY.md` mục 4: người vận hành luôn cầm RC trong mọi bài bay có web tham gia.

Chỉ bật GCS failsafe khi đã thực sự bay dựa vào telemetry ngoài tầm nhìn — việc đó **không nằm trong phạm vi dự án này**. Bài test hỏng hóc "mất Wi-Fi" ở Phase 24 được thiết kế để chứng minh rằng mất Wi-Fi **không** làm drone đổi hành vi bay, đúng như `SAFETY.md` mục 9.

**Kết quả mong đợi:** `FS_GCS_ENABLE` = 0 trong Full Parameter List.

### 19.11 Geofence — bật lớp authoritative của ArduPilot

Website cũng có geofence phần mềm, nhưng **ArduPilot geofence mới là lớp authoritative** (`SAFETY.md` mục 8; nháp cũ GIAI ĐOẠN 83). Bật ngay từ chuyến bay đầu, không đợi tới demo.

```text
FENCE_ENABLE    1      (đã có sẵn trong obstacle-avoidance-tfminiplus-serial3.param)
FENCE_TYPE      3      bitmask: 1 = trần độ cao, 2 = hàng rào tròn -> 1+2 = 3
FENCE_ALT_MAX   30     mét    <-- ĐỀ XUẤT, chưa xác minh
FENCE_RADIUS    50     mét    <-- ĐỀ XUẤT, chưa xác minh
FENCE_ACTION    1      RTL, hoặc LAND nếu không RTL được
FENCE_MARGIN    2      mét — khoảng cách bắt đầu phanh trước hàng rào
```

**Vì sao 30 m / 50 m:** 30 m cao hơn mọi bài bay trong kế hoạch (cao nhất là 20 m ở bài F4 RTL) nhưng thấp hơn nhiều so với ngưỡng gây nguy hiểm; 50 m bán kính đủ cho 3 waypoint của bài F5 mà vẫn giữ drone trong tầm mắt. **Hai con số này chưa xác minh** — phải đo bãi bay thật trước Phase 20 và chỉnh lại: bán kính phải **nhỏ hơn** khoảng cách từ điểm cất cánh tới vật cản/ranh giới gần nhất, trừ đi ít nhất 10 m biên.

> **AN TOÀN:** `FENCE_ACTION = 1` (RTL) là hành vi an toàn cho bãi trống. Nhưng phải hiểu: nếu drone chạm hàng rào, **nó sẽ tự bay về nhà và bạn mất quyền điều khiển tạm thời** cho tới khi bạn gạt mode khác. Đừng để tình huống đó xảy ra lần đầu ở độ cao 0,5 m — đó là lý do hàng rào đặt rộng hơn mọi bài bay đã lên kế hoạch.

**Kiểm tra sau khi đặt:** reboot, nối Mission Planner, vào `Flight Data` → chuột phải trên bản đồ → `Draw Polygon`/`Geofence` để xem hàng rào tròn có hiện đúng bán kính quanh điểm home không. Home được đặt khi arm — nên phải arm (không cánh) một lần để thấy.

**Kết quả mong đợi:** 6 tham số trên đúng giá trị; hàng rào hiện trên bản đồ Mission Planner đúng bán kính.

### 19.12 Pre-arm phải sạch, rồi test arm không cánh

> **AN TOÀN:** Vẫn KHÔNG CÁNH. Drone vẫn kẹp xuống bàn. **Đây là lần arm thật đầu tiên của cả dự án** — Phase 16 cố tình không arm, chỉ chạy Motor Test và ghi lại danh sách lỗi pre-arm. Đây cũng là lần cuối cùng bạn được arm mà không có cánh; tận dụng nó để nhìn kỹ.

> **Danh sách pre-arm của Phase 16 chính là checklist của mục này.** Ở Phase 16, bo bay nằm trên bàn và chưa hiệu chỉnh gì, nên nó báo một loạt lỗi pre-arm (`Accels not calibrated`, `Compass not calibrated`, `Need 3D Fix`, …). Danh sách đó đã được **ghi lại ở Phase 16 như một việc phải làm**, không phải như một lỗi phải tắt. Mục này đóng **từng dòng một bằng cách hiệu chỉnh** (19.3, 19.4, 19.5, 19.9) — và **không dòng nào được đóng bằng cách sửa `ARMING_CHECK`**. Mở lại ghi chú Phase 16, đối chiếu từng dòng, đánh dấu dòng nào đã hết và vì sao.

**Pre-arm:**

1. Đưa drone ra ngoài trời, chờ GPS `3D Fix` với `HDOP < 1.5` và ít nhất 10 vệ tinh.
2. Mission Planner → `Flight Data`. Nhìn dòng thông báo ở đầu HUD.
3. **Mọi cảnh báo pre-arm phải biến mất.** ArduPilot có pre-arm check cho RC, GPS, la bàn, khí áp kế, pin, EKF và nhiều hệ con khác.

> **AN TOÀN — luật cứng.** **Không disable hàng loạt pre-arm check chỉ để "cho nó arm được".** Pre-arm báo lỗi nghĩa là có nguyên nhân thật. **Sửa nguyên nhân, không tắt cảnh báo.** Đây là `SAFETY.md` mục 3 và nháp cũ GIAI ĐOẠN 45. Nếu bạn thấy mình đang gõ `ARMING_CHECK` để đổi giá trị, hãy dừng lại và đọc lại dòng này.

Bảng cảnh báo hay gặp và cách sửa **đúng**:

| Cảnh báo | Nguyên nhân thật | Sửa |
|---|---|---|
| `PreArm: Need 3D Fix` | GPS chưa fix | Ra chỗ trống, đợi. Không tắt check. |
| `PreArm: High GPS HDOP` | Chất lượng GPS kém | Đợi thêm, hoặc đổi chỗ đứng. |
| `PreArm: Compass not calibrated` | Chưa chạy 19.4 | Chạy 19.4. |
| `PreArm: Compass offsets too high` | La bàn quá gần nguồn nhiễu | Nâng cột GPS, đi dây lại (Phase 18 mục 18.11). |
| `PreArm: Accels not calibrated` | Chưa chạy 19.3 | Chạy 19.3. |
| `PreArm: Check mag field` | Từ trường quanh drone bất thường | Đi ra xa kim loại rồi thử lại. |
| `PreArm: RC not calibrated` | Radio chưa calib trên bo này | Chạy `Calibrate Radio` (Phase 15). |
| `PreArm: Battery below minimum arming voltage` | Pin yếu, hoặc `BATT_ARM_VOLT` đặt cao quá | Sạc pin. Chỉ chỉnh ngưỡng nếu đã chứng minh số đọc sai. |
| `PreArm: EKF ... variance` | EKF chưa hội tụ | Đợi 30–60 giây sau khi cắm pin, không di chuyển drone. |
| `PreArm: Throttle below failsafe` | Cần ga chưa kéo xuống hết, hoặc failsafe RC đang active | Kéo ga xuống hết; kiểm tra 19.8. |

**Test arm (không cánh):**

4. Kéo cần ga xuống hết. Gạt mode về `Stabilize`.
5. **Arm:** giữ cần yaw sang phải hết cỡ trong 3–5 giây (hoặc dùng nút arm đã map ở Phase 15).
6. Quan sát:

```text
[ ] Mission Planner báo ARMED, đèn FC đổi trạng thái
[ ] CẢ 4 MOTOR quay ở tốc độ idle, ĐỀU NHAU, KHÔNG có motor nào đứng im
[ ] Không có motor nào kêu khác hẳn 3 cái còn lại
[ ] Đẩy ga lên rất nhẹ (10%): cả 4 lên đều
```

7. **Disarm:** kéo ga xuống hết, giữ cần yaw sang trái 3–5 giây. Cả 4 motor phải dừng.
8. Lặp lại chu trình arm/disarm 3 lần.

**Kết quả mong đợi:** không còn cảnh báo pre-arm nào; arm/disarm 3/3 lần thành công; 4 motor idle đều.

**Nếu lỗi:**

- *Arm được nhưng một motor không quay ở idle:* `MOT_SPIN_ARM` quá thấp cho motor đó, hoặc ESC kênh đó yếu. Không bay. Quay lại 19.6.
- *Không arm được và không có thông báo gì:* cần yaw chưa đủ hành trình (quay lại 19.5), hoặc `ARMING_CHECK` đang chặn ở một mục mà Mission Planner hiện ở tab `Messages` chứ không ở HUD — mở tab đó đọc.

### 19.13 Gắn cánh

> **AN TOÀN — cổng bắt buộc.** Chỉ gắn cánh khi **toàn bộ** danh sách dưới đây đã pass (nháp cũ GIAI ĐOẠN 49):
>
> ```text
> [x] thứ tự motor        (19.6)
> [x] chiều quay motor     (19.6)
> [x] không desync         (19.6)
> [x] radio                (19.5)
> [x] GPS                  (19.12)
> [x] la bàn               (19.4)
> [x] gia tốc kế           (19.3)
> [x] ESC / DShot          (19.7)
> [x] RC failsafe          (19.8)
> [x] battery failsafe     (19.9)
> [x] geofence             (19.11)
> [x] pre-arm sạch         (19.12)
> ```
>
> **RÚT PIN TRƯỚC KHI CHẠM VÀO CÁNH. Mỗi lần. Không có ngoại lệ.**

**Cánh nào vào motor nào:**

```text
        MŨI drone
   M3 (trước-trái)      M1 (trước-phải)
   cánh CW              cánh CCW
             \     /
              \   /
               / \
              /   \
   M2 (sau-trái)        M4 (sau-phải)
   cánh CCW             cánh CW
        ĐUÔI
```

Cánh phải quay **cùng chiều với motor mang nó**. Vì motor M1 và M2 quay CCW nên chúng mang **cánh CCW**; M3 và M4 quay CW nên mang **cánh CW**.

**Cách nhận dạng cánh CW và CCW (T1045):**

1. **Ký hiệu in trên cánh.** T-Motor thường in `1045` cho một loại và `1045R` (R = reverse) cho loại kia. Một số lô in `CW`/`CCW` hoặc có vạch màu. **Đọc kỹ trước khi tin** — một số hãng dùng `R` theo nghĩa ngược lại.
2. **Cách không phụ thuộc ký hiệu (dùng cái này để kiểm chứng):** đặt cánh nằm ngang, **mặt có chữ / mặt cong lồi hướng LÊN TRÊN** (đó luôn là mặt hướng lên trời khi lắp). Nhìn từ trên xuống, tìm **cạnh dày và tròn** của lá cánh — đó là **cạnh trước (leading edge)**, cạnh mỏng và sắc là cạnh sau. Cánh sẽ quay theo hướng mà **cạnh dày đi trước**.
   - Cạnh dày đi theo chiều kim đồng hồ → **cánh CW** → lắp lên M3, M4.
   - Cạnh dày đi ngược chiều kim đồng hồ → **cánh CCW** → lắp lên M1, M2.
3. **Kiểm tra cuối bằng ren (đặc thù AIR GEAR, tự siết):** vặn cánh vào trục M6 bằng tay. **Vào ngọt, không cần lực** thì đúng cặp. **Phải dùng lực** thì sai cặp — dừng lại, đổi cánh, đừng ép (ép là tước ren M6 của motor, hỏng vĩnh viễn).
4. **Kiểm tra chiều tự siết:** sau khi vặn vào, dùng tay xoay cánh **theo đúng chiều motor sẽ quay** — phải cảm thấy nó **siết chặt thêm**, không được nới ra. Nếu nới ra thì motor đang đứng sai vị trí (quay lại Phase 18 mục 18.3) — **phải đổi chỗ motor, không phải đổi cánh**.

**Độ chặt:**

- Vặn bằng tay tới chặt, rồi dùng cờ lê/tuýp đi kèm siết thêm **khoảng 1/4 vòng**. Không siết hết sức — trục M6 bằng nhôm, tước ren là hỏng cả motor.
- Với đai ốc tự siết, lực siết ban đầu chỉ cần đủ để cánh không lắc; chính chiều quay sẽ siết tiếp.
- **Kiểm tra bằng tay sau khi siết:** cầm thân motor, lắc cánh theo phương dọc trục — không được có độ rơ. Lắc theo phương xoay — không được xoay tự do.

> **AN TOÀN:** Kiểm tra cánh có **nứt, sứt, cong** không trước khi lắp. Một cánh nứt ở gốc sẽ văng ra ở ga cao. Cánh T1045 đi kèm 8 chiếc (4 dùng + 4 dự phòng) — không tiếc, thấy nghi là thay.
>
> **AN TOÀN:** Từ giây phút này, drone đã có cánh. Mọi lần cắm pin phải coi như drone **có thể quay cánh bất cứ lúc nào**. Không đặt drone hướng về phía người. Không đứng trong mặt phẳng quay của cánh. Không cầm drone khi đã armed.

**Kết quả mong đợi:** 4 cánh đúng chiều, vặn vào không cần lực, siết chặt không rơ, chiều tự siết đúng, không cánh nào nứt.

### 19.14 Đo lực đẩy thật trên cân

`docs/bao-cao-tong-quan-du-an.md` mục 3.2 yêu cầu **bắt buộc đo thật trước lần bay đầu** — mọi con số lực đẩy trong tài liệu đều là ước lượng từ bảng của hãng.

> **AN TOÀN — đây là bước nguy hiểm nhất có cánh của cả dự án.** Đọc hết trước khi làm:
> - Đeo **kính bảo hộ**. Bắt buộc, không thương lượng.
> - Làm ở nơi không có người khác, không có vật nhẹ bay được, không có vật nuôi.
> - **Bắt cố định một cần của khung xuống bàn** bằng kẹp chữ C, với **motor hướng XUỐNG DƯỚI** (để lực đẩy ấn xuống cân, không phải nhấc drone lên).
> - Đặt toàn bộ cụm lên **cân điện tử**.
> - Tháo hết vật cản trong bán kính 1 m quanh cánh.
> - **Đứng ngoài mặt phẳng quay của cánh**, điều khiển bằng laptop đặt xa.
> - Tay luôn sẵn trên nút `Stop` của Mission Planner.

1. Mission Planner → `Motor Test`, chạy **một motor duy nhất**, `Duration` = 3 giây.
2. Chạy lần lượt **25 % → 50 % → 75 % → 100 %**, ghi số gam mà cân hiển thị ở mỗi mức.
3. Ghi vào `docs/do-dac/19-do-luc-day.md`:

| Mức ga | Lực đẩy đo được (g) | Tài liệu T-Motor (g) |
|---|---|---|
| 25 % | | |
| 50 % | | |
| 75 % | | |
| 100 % | | 1332 |

4. **Tính tỉ số:** `(lực đẩy 100% đo được × 4) / AUW cân thật ở Phase 18`.

```text
Tỉ số >= 2,5 : 1   -> tốt, bay được thoải mái
Tỉ số 2,0 - 2,5    -> chấp nhận được, bay nhẹ nhàng, tránh gió
Tỉ số <  2,0 : 1   -> KHÔNG BAY. Giảm payload, hoặc đổi sang cánh 1047 / 1147.
```

> **AN TOÀN:** Không giữ ga 100 % quá 3 giây. Cánh T1045 có giới hạn lực đẩy công bố 1,2 kg và vùng vòng quay đẹp 6000–7000 rpm, trong khi motor ở ga 100 % đạt 1332 g tại 9857 rpm — **vượt cả hai mức**. Bay bình thường ở ga treo (~50 %) thì nằm sâu trong vùng an toàn; giữ ga hết cỡ kéo dài là cách làm gãy cánh.

**Kết quả mong đợi:** bảng 4 mức đã điền; tỉ số ≥ 2 : 1.

**Nếu lỗi:** *lực đẩy thấp hơn tài liệu > 20 %:* kiểm tra pin có đầy không (đo lúc pin gần cạn cho số thấp hơn nhiều), cánh có lắp đúng chiều không (lắp ngược vẫn quay nhưng đẩy rất yếu — đây là cách phát hiện lắp sai cánh rất tốt), và ESC có đang giới hạn dòng không.

### 19.15 Checklist walk-around, luật bãi bay, kiểm pin từng cell

Viết ra `docs/checklist-truoc-bay.md`, **in ra giấy**, mang theo mỗi buổi bay. Dùng lại nguyên si ở Phase 20, 21, 22, 24.

```text
=== TRƯỚC KHI RỜI NHÀ ===
[ ] Pin đã sạc cân bằng đầy, đo từng cell: chênh lệch <= 0,03 V
[ ] Không pin nào phồng, rách vỏ, dây lỏng, hoặc lệch cell bất thường
[ ] Pin để trong túi chống cháy khi vận chuyển
[ ] Mang: tay FS-i6X (pin tay còn), laptop sạc đầy, đồng hồ vạn năng,
    lục giác, cánh dự phòng, băng dính, túi chống cháy, kính bảo hộ
[ ] In sẵn checklist này + sổ ghi chép

=== ĐẾN BÃI: LUẬT BÃI BAY ===
[ ] Sân rộng, KHÔNG người ngoài, KHÔNG xe, KHÔNG cây gần
[ ] Xác định khoảng cách tới vật cản gần nhất -> đối chiếu FENCE_RADIUS
    (đặt ở 19.11 là 50 m; PHẢI nhỏ hơn khoảng cách đó trừ 10 m biên)
[ ] Xác định hướng gió. Cất cánh ngược gió.
[ ] Chọn một điểm đứng: sau lưng drone, cách >= 5 m, không đứng trong
    mặt phẳng quay của cánh
[ ] Thống nhất với người quan sát (nếu có): ai hô "ABORT"
[ ] Biết trước sẽ chạy đi đâu nếu drone lao về phía mình

=== WALK-AROUND (làm ngay trước mỗi chuyến, mất 2 phút) ===
[ ] 4 cánh: đúng chiều (CCW ở M1/M2, CW ở M3/M4), không nứt, không rơ
[ ] 4 motor: xoay bằng tay thấy trơn, không cà
[ ] Mọi ốc: không có con nào lỏng (sờ, không cần cờ lê)
[ ] Dây: không sợi nào lủng lẳng, không sợi nào trong tầm cánh
[ ] Pin: velcro dính, DÂY ĐAI đã siết, xách drone bằng pin không xê dịch
[ ] XT60 cắm chắc, không nằm dưới cánh
[ ] GPS mast thẳng, không lắc
[ ] TFmini: ống kính sạch, không có gì che
[ ] Anten receiver: đúng góc 90 độ, không bị kẹp

=== SAU KHI CẮM PIN (drone đặt xuống, người lùi ra) ===
[ ] Bật tay FS-i6X TRƯỚC, rồi mới cắm pin
[ ] Cần ga đã kéo xuống hết
[ ] Mission Planner nối được, không cảnh báo pre-arm nào
[ ] GPS: >= 10 vệ tinh, HDOP < 1.5, 3D Fix
[ ] Điện áp pin trên MP khớp với số đo bằng đồng hồ
[ ] Mode hiện đúng chế độ của bài bay
[ ] Đợi 60 giây cho EKF hội tụ trước khi arm

=== SAU MỖI CHUYẾN ===
[ ] Disarm, RÚT PIN trước khi chạm vào drone
[ ] Sờ motor và ESC: không cái nào nóng quá mức chịu được bằng tay
[ ] Tải log .bin về (xem Phase 20 mục 20.5)
[ ] Ghi notes.md: gió, pin, payload, độ cao, mode, sự cố, thay đổi so với chuyến trước
```

**Kiểm pin từng cell** (`SAFETY.md` mục 6): dùng chức năng đo cell của iMAX B6AC V2 hoặc một đồng hồ báo cell rời cắm vào cổng balance.

```text
Pin 4S đầy khoẻ:    4,20 / 4,20 / 4,20 / 4,20 V, chênh lệch <= 0,03 V
Chênh lệch > 0,05 V -> chạy chế độ Balance trên iMAX B6AC V2, sạc lại
Chênh lệch > 0,10 V -> pin đang hỏng cell. KHÔNG BAY. Thải pin đúng cách.
Một cell < 3,00 V   -> pin đã xả quá sâu. KHÔNG sạc lại. Thải.
```

> **AN TOÀN:** Không sạc pin khi không có người trông. Sạc trong túi chống cháy, trên nền không cháy, xa vật dễ cháy. (`SAFETY.md` mục 6.)

**Kết quả mong đợi:** `docs/checklist-truoc-bay.md` đã viết và in; pin đo đủ 4 cell trong ngưỡng.

### 19.16 Lưu `04-pre-first-flight.param`

Mission Planner → `CONFIG` → `Full Parameter List` → `Save to file` → lưu vào `firmware/ardupilot/params/04-pre-first-flight.param`.

Commit với prefix `param:` và ghi rõ trong commit message những gì đã đổi so với `03-gps.param`:

```text
param: 04-pre-first-flight — hieu chinh tren khung + failsafe

- INS_ACC*      : hieu chinh gia toc ke 6 vi tri tren khung (19.3)
- AHRS_TRIM*    : calibrate level tren mat phang ngang (19.3)
- COMPASS_OFS*  : onboard mag calibration ngoai troi (19.4)
- COMPASS_ORIENT: <gia tri, hoac "khong doi">        (19.4)
- BATT_VOLT_MULT: <cu> -> <moi>, hieu chinh bang dong ho van nang (19.9)
- BATT_ARM_VOLT : 0 -> 14.8 (chua xac minh, siet lai sau)          (19.9)
- BATT_LOW_TIMER: 10                                               (19.9)
- FENCE_TYPE/ALT_MAX/RADIUS/ACTION/MARGIN: 3 / 30 / 50 / 1 / 2     (19.11)
- FS_GCS_ENABLE : giu 0 cho cac chuyen dau (19.10)
```

> **Không bao giờ nạp lại file param này lên một bo bay khác.** Nó chứa `INS_ACC*` và `COMPASS_OFS*` — là dấu vân tay của **đúng con drone này**. Nạp sang bo khác là dán số hiệu chỉnh của một chiếc drone khác lên drone của bạn (`260921-research-sitl-firmware-toolchain.md` mục 4.6).

**Kết quả mong đợi:** file đã lưu và commit.

## Cổng pass

- [ ] 4 nhóm phép đo continuity trên khung đã lắp cho kết quả **giống hệt** Phase 18.
- [ ] Cấp điện qua smoke stopper: đèn nháy rồi tắt, không board nào nóng, mọi đèn sáng, Mission Planner nhận bo bay.
- [ ] `Accel Calibration` 6 vị trí báo `Calibration Successful`; `Calibrate Level` đã chạy trên mặt phẳng ngang; HUD nằm ngang khi drone đậu trên mặt phẳng ngang.
- [ ] `Onboard Mag Calibration` chạy **ngoài trời**, thanh tiến trình tới 100% không tụt lùi; offset tổng nhỏ; chĩa mũi drone về Bắc thật thì biểu tượng trên bản đồ Mission Planner cũng chỉ Bắc (lệch ≤ 15°); không còn cảnh báo compass.
- [ ] Radio: 4 cần đúng dải 1000/1500/2000; CH5 ra đủ `Stabilize`/`AltHold`/`Loiter`, CH6 ra `RTL`, CH7 (`WEB CONTROL ENABLE`) đổi giá trị `rcin` khi gạt, CH8 vẫn để trống; ở 50 m vẫn đổi được mode.
- [ ] Motor Test: 4 nút A/B/C/D ra đúng 4 motor (đã đối chiếu với **sơ đồ khung hiển thị trong Mission Planner**, không dựa vào trí nhớ).
- [ ] 4 chiều quay đúng: M1 CCW, M2 CCW, M3 CW, M4 CW.
- [ ] Test desync: đẩy ga 10→20→30→50 % trên cả 4 motor, **không** có tiếng khục / giật / tự dừng; tăng ga đột ngột cũng không; 4 motor khởi động mượt và gần như cùng lúc ở 5–10 %.
- [ ] `esc1..4_rpm` có số trên tab `Status` khi chạy Motor Test (nếu không có: đã ghi lại, không chặn Phase 20, phải xử lý trước Phase 22).
- [ ] Test RC failsafe: tắt tay FS-i6X → cảnh báo hiện trong ≤ 3 giây **và** giá trị kênh ga tụt xuống dưới `FS_THR_VALUE`; bật lại → cảnh báo tự hết.
- [ ] Điện áp Mission Planner khớp đồng hồ vạn năng trong **0,05 V**; `BATT_LOW_VOLT,14.0` / `BATT_CRT_VOLT,13.2` / `BATT_FS_LOW_ACT,2` / `BATT_FS_CRT_ACT,1` / `BATT_LOW_TIMER,10` / `BATT_CAPACITY,5300` đã đặt; `BATT_ARM_VOLT` đã bật lại.
- [ ] `FS_GCS_ENABLE` = **0**.
- [ ] `FENCE_ENABLE,1` + `FENCE_TYPE,3` + `FENCE_ALT_MAX,30` + `FENCE_RADIUS,50` + `FENCE_ACTION,1` + `FENCE_MARGIN,2`; hàng rào hiện đúng trên bản đồ Mission Planner; giá trị 30/50 đã được đối chiếu với kích thước bãi bay thật.
- [ ] **Không còn cảnh báo pre-arm nào**, và **không một pre-arm check nào bị disable** (`ARMING_CHECK` giữ nguyên giá trị mặc định đầy đủ).
- [ ] Arm/disarm không cánh 3/3 lần thành công; cả 4 motor idle đều, không motor nào đứng im.
- [ ] 4 cánh gắn đúng: CCW trên M1/M2, CW trên M3/M4; vặn vào **không cần lực**; xoay theo chiều quay thì **siết chặt thêm**; không rơ; không cánh nào nứt.
- [ ] Đo lực đẩy thật trên cân ở 25/50/75/100 %; tỉ số `(lực đẩy 100% × 4) / AUW` ≥ **2 : 1**; đã ghi vào `docs/do-dac/19-do-luc-day.md`.
- [ ] `docs/checklist-truoc-bay.md` đã viết và **đã in ra giấy**.
- [ ] Pin 4S: 4 cell đều 4,20 V ±0,03 V, không phồng, không rách.
- [ ] `firmware/ardupilot/params/04-pre-first-flight.param` đã lưu và commit với prefix `param:`.
- [ ] `docs/so-tay/19-hieu-chinh-failsafe.md` đã viết xong.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Tắt bớt pre-arm check để "cho nó arm được" → bay với lỗi thật chưa sửa | 4 | 5 | **20** | Luật cứng `SAFETY.md` mục 3 nhắc lại ở 19.12; bảng cảnh báo → nguyên nhân thật → cách sửa; cổng pass có dòng "không một pre-arm check nào bị disable" |
| Desync motor không phát hiện ra trên bàn → khựng motor giữa không trung | 3 | 5 | **15** | Quy trình test desync 6 bước ở 19.6 (bắt buộc, làm trước khi ra sân); hạ DShot300 → DShot150; kiểm tra lại 12 mối hàn |
| Gắn cánh sai chiều (CW vào vị trí CCW) → lật ngay khi cất cánh | 3 | 5 | **15** | Ba lớp kiểm tra độc lập ở 19.13: ký hiệu in, cạnh trước dày, và ren tự siết (cánh sai **không vặn vào được**); xác nhận lần cuối bằng lực đẩy đo được ở 19.14 |
| Hiệu chỉnh la bàn ở nơi có kim loại → Loiter quay vòng "toilet bowl" | 3 | 4 | 12 | Danh sách TRÁNH/NÊN ở 19.4; tiêu chí "thanh tiến trình không tụt lùi"; kiểm tra hướng Bắc thật; chẩn đoán lại ở Phase 20 mục 20.7 |
| Số đọc điện áp sai → failsafe pin không đúng lúc → rơi vì hết pin | 3 | 5 | **15** | Bắt buộc hiệu chỉnh bằng đồng hồ vạn năng **trước** khi đặt ngưỡng (19.9); cổng pass yêu cầu khớp trong 0,05 V |
| Receiver iA6B giữ giá trị cuối thay vì phát failsafe → ArduPilot không biết mất sóng | 3 | 5 | **15** | Test ở 19.8 kiểm tra **giá trị kênh ga tụt xuống dưới ngưỡng**, không chỉ kiểm tra "có cảnh báo"; lỗi này chặn bay |
| Hiệu chỉnh gia tốc kế khi cầm trên tay → AltHold trôi, đi tìm lỗi sai chỗ | 3 | 3 | 9 | Cảnh báo "AN TOÀN cho chất lượng dữ liệu" ở 19.3; yêu cầu buông tay trước khi bấm |
| Chập nguồn chỉ hiện khi đã siết hết ốc (cáp 10 chân bị ép thủng) | 2 | 5 | **10** | Đo lại continuity ở 19.1 **sau khi** lắp hoàn chỉnh; smoke stopper ở 19.2 |
| Tỉ số lực đẩy thật < 2:1 → drone ì, không đủ biên khi có gió | 2 | 4 | 8 | Đo thật trên cân ở 19.14 trước chuyến bay đầu; ngưỡng dừng rõ ràng; phương án đổi cánh 1047/1147 |
| `FENCE_RADIUS` 50 m lớn hơn bãi thật → drone ra khỏi tầm nhìn trước khi hàng rào tác động | 3 | 4 | 12 | Bắt buộc đo bãi và chỉnh lại trước Phase 20 (checklist bãi bay ở 19.15); hai con số 30/50 đánh dấu **chưa xác minh** |
| Bật `FS_GCS_ENABLE` ≠ 0 → drone tự RTL giữa chừng vì Wi-Fi rớt 5 giây | 3 | 3 | 9 | Giải thích lý do ở 19.10; cổng pass kiểm tra giá trị = 0 |
| Tai nạn khi đo lực đẩy (cánh quay, drone chưa kẹp chặt) | 2 | 5 | **10** | Khối AN TOÀN 7 dòng ở 19.14: kính bảo hộ, kẹp chữ C, motor hướng xuống, đứng ngoài mặt phẳng quay, tay sẵn trên nút Stop |
| Nạp nhầm `04-pre-first-flight.param` sang bo bay khác | 2 | 3 | 6 | Cảnh báo ở 19.16; giải thích `INS_ACC*` và `COMPASS_OFS*` là dấu vân tay của riêng bo này |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 19.1 Đo lại continuity trên khung | 0,5 | |
| 19.2 Cấp điện lần đầu qua smoke stopper | 0,5 | |
| 19.3 Accel 6 vị trí + Calibrate Level | 1,0 | Trong nhà, mặt phẳng ngang |
| 19.4 Compass ngoài trời | 1,5 | **Phải ra ngoài trời**; tính cả thời gian di chuyển |
| 19.5 Radio recheck + thử tầm 50 m | 0,5 | Làm luôn khi đang ở ngoài trời |
| 19.6 Motor order + direction + desync | **2,0** | Việc quan trọng nhất; không vội |
| 19.7 Xác nhận tham số nền + ESC telemetry | 0,5 | |
| 19.8 Test RC failsafe | 0,5 | |
| 19.9 Battery failsafe: hiệu chỉnh + ngưỡng | 1,5 | Lặp đo–sửa–reboot vài vòng |
| 19.10 GCS failsafe = 0 | 0,25 | |
| 19.11 Geofence | 0,5 | Cần biết kích thước bãi thật |
| 19.12 Pre-arm sạch + arm test không cánh | 1,0 | Có thể kéo dài nếu còn cảnh báo |
| 19.13 Gắn cánh | 0,5 | |
| 19.14 Đo lực đẩy trên cân | 1,0 | Chuẩn bị kẹp/cân mất phần lớn thời gian |
| 19.15 Viết + in checklist, kiểm pin | 0,5 | |
| 19.16 Lưu + commit `04-pre-first-flight.param` | 0,25 | |
| Viết `docs/so-tay/19-hieu-chinh-failsafe.md` | 1,0 | |
| **Tổng** | **~13,0** | |

Đường găng: 19.1 → 19.2 → 19.3 → 19.4 → 19.6 → 19.12 → 19.13 → 19.14. Chia buổi hợp lý: **buổi 1 trong nhà** (19.1, 19.2, 19.3, 19.6, 19.7, 19.8, 19.9); **buổi 2 ngoài trời** (19.4, 19.5, 19.11, 19.12); **buổi 3** (19.13, 19.14, 19.15, 19.16). 19.10 và 19.16 làm ở đâu cũng được.

## Ghi chú cho sổ tay

- **Vì sao phải hiệu chỉnh lại trên khung** dù đã hiệu chỉnh trên bàn ở Phase 14 — gia tốc kế và la bàn đo *môi trường quanh chúng*, mà môi trường đó vừa thay đổi hoàn toàn.
- **Gia tốc kế làm gì** — đo gia tốc gồm cả trọng lực, nên 6 tư thế là 6 phương trình để tìm ra "đâu là 0 và đâu là 1 g theo mỗi trục".
- **Level trim khác accel calibration thế nào** — một cái dạy cảm biến, một cái dạy "tư thế đậu của chính chiếc drone này là ngang".
- **La bàn, độ lệch cứng (hard iron) và độ lệch mềm (soft iron)** — vì sao phải xoay đủ ba trục, và `COMPASS_OFS*` thật ra là con số gì.
- **Toilet bowl là gì** — hiện tượng, nguyên nhân (la bàn lệch so với GPS), và vì sao nó chỉ xuất hiện ở Loiter chứ không ở Stabilize.
- **Pre-arm check là gì và vì sao nó tồn tại** — kèm câu chuyện: mỗi dòng cảnh báo là kết quả của một vụ rơi có thật của ai đó.
- **Failsafe là gì** — phân biệt ba loại của dự án này (RC / GCS / pin), cái nào là dây cứu sinh (RC), cái nào tạm tắt (GCS) và vì sao.
- **Desync của ESC** — giải thích đơn giản: ESC đoán vị trí rotor bằng sức điện động ngược; motor to quay chậm làm tín hiệu đó yếu, ESC đoán sai thì motor khựng.
- **DShot là gì và vì sao không có bước ESC calibration** — tín hiệu số truyền thẳng giá trị ga, không có "dải ga" để dạy. Làm theo quy trình cũ (kéo ga hết cỡ rồi cắm pin) là **vô nghĩa và nguy hiểm**.
- **Geofence** — hai loại (trần độ cao, hàng rào tròn), `FENCE_MARGIN` là gì, và vì sao geofence của ArduPilot mới là lớp authoritative còn geofence trên web chỉ là lớp phụ.
- **Cánh CW / CCW và ren tự siết** — cách nhận dạng bằng cạnh trước, và vì sao ren tự siết là một lớp an toàn (cánh sai không vặn vào được).
- **Tỉ số lực đẩy / khối lượng** — ý nghĩa 2:1, và vì sao đo thật quan trọng hơn bảng của hãng.
- **Cân bằng cell của pin LiPo** — vì sao chênh lệch cell là dấu hiệu pin sắp hỏng, và vì sao một cell dưới 3,0 V thì không được sạc lại.
- **Vì sao không bao giờ nạp file param của drone này sang drone khác.**

---

**Prior-art:** rút vật liệu thô từ nháp cũ `README.md` GIAI ĐOẠN 30 (đo đồng hồ trước khi cấp điện, smoke stopper), 38 (accel calibration, không cầm trên tay), 39 (compass calibration ngoài trời, danh sách vật cần tránh), 41 (tuyệt đối tháo prop), 42 (motor test, không "bay thử xem sao"), 43 (motor direction, đổi 2 trong 3 dây), 44 (không calibrate ESC vì dùng DShot; quy trình test desync 6 bước), 45 (pre-arm check, danh sách hệ con), 46 (test RC failsafe bằng cách tắt tay), 47 (GCS failsafe), 48 (battery failsafe: hiệu chỉnh trước, ngưỡng sau; công thức `BATT_VOLT_MULT` mới; ngưỡng 4S 14.0/13.2), 49 (cổng gắn prop), 83 (geofence là lớp authoritative), 88 (quy ước đánh số file param). Giá trị tham số và cảnh báo mâu thuẫn `BATT_VOLT_MULT` lấy từ `plans/reports/260921-research-sitl-firmware-toolchain.md` mục 4.4–4.6. Bảng `FS_GCS_ENABLE` và lý do để 0 lấy từ `plans/reports/260921-research-esp32-bridge-camera.md` mục 4. Quy trình đo lực đẩy lấy từ `docs/bao-cao-tong-quan-du-an.md` mục 3.2. Cấu trúc phase, thứ tự việc, bảng cảnh báo pre-arm→nguyên nhân→cách sửa, và toàn bộ checklist walk-around ở đây là mới.
