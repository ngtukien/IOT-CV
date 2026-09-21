# Phase 22: Tránh vật cản thật và tuning — F9 AVOID ở Loiter, F10 OA BendyRuler, harmonic notch, AUTOTUNE

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 21 | ~18,5 giờ | Có (drone đã pass Phase 21, ≥ 4 pin 4S, tay FS-i6X, laptop + Mission Planner + web GCS, vật cản mềm: tấm bìa carton lớn / tấm xốp / thùng giấy, cọc đỡ vật cản, thước dây, kính bảo hộ, bãi rộng, túi chống cháy LiPo) |

## Mục tiêu

Bật **tính năng đặc trưng của đề tài** — tránh vật cản bằng TFmini Plus — trên drone thật, và **tinh chỉnh drone bằng số liệu thật** thay vì bằng giá trị mặc định.

Bốn nhóm việc:

- **F9** — `AVOID` ở `Loiter`: drone phanh trước một vật cản mềm ở `AVOID_MARGIN` = 2 m, rồi lùi ra. Đây là tính năng chính, làm trước.
- **F10** — `OA` BendyRuler ở `Auto`: drone tự vòng qua vật cản khi đang chạy mission. Chỉ làm ở **bãi rộng**, và chỉ sau khi đã hiểu rõ **một tia nhìn thẳng làm được gì và không làm được gì**.
- **Harmonic notch từ RPM của ESC** — lọc rung theo vòng quay thật của motor, làm `Loiter` mượt hơn. Đọc FFT trong log để kiểm chứng.
- **AUTOTUNE** (tuỳ chọn) — để ArduPilot tự tìm hệ số PID.

Kết thúc phase: mọi giá trị `AVOID_*`, `OA_*`, `INS_HNTCH_*` đã chỉnh và **ghi lại vào file param**, có log chứng minh từng thứ hoạt động.

> **AN TOÀN — bốn luật của phase này:**
> 1. **Vật cản luôn là vật MỀM và NHẸ**: bìa carton, tấm xốp, thùng giấy rỗng. Không bao giờ là tường, cây, xe, hay người. Nếu tính năng tránh vật cản không hoạt động, drone sẽ đâm vào nó — hãy chọn thứ mà cú đâm đó chỉ làm hỏng cánh.
> 2. **`CH5` về `Loiter`/`Stabilize` là nút hủy**, luôn sẵn dưới ngón cái. Tính năng tránh vật cản là **lớp phụ**, không phải lớp thay thế người lái.
> 3. **Tuning thay đổi cách drone bay.** Mỗi lần đổi một nhóm tham số PID/notch thì bay lại **F1–F3 của Phase 20 rút gọn** trước khi thử bài mới. Không đổi 2 nhóm cùng lúc.
> 4. **Một tia laser nhìn thẳng KHÔNG phải là cảm biến 360°.** Drone này mù ở mọi hướng trừ phía trước. Mọi bài bay của phase này phải được thiết kế với giả định đó.

## Đầu vào cần có

Phải đọc trước:

- `SAFETY.md` — mục 3, 4, 8, 10.
- `params/obstacle-avoidance-tfminiplus-serial3.param` — **toàn bộ**, kể cả phần chú thích dài ở đầu file. Đặc biệt khối giải thích cuối file về `OA_TYPE,0`: *"BendyRuler cần biết đường vòng, mà ta chỉ có 1 tia 3,6 độ nhìn thẳng trước — nó sẽ lệch sang hướng CHƯA CÓ DỮ LIỆU."*
- `plans/reports/260921-research-esp32-bridge-camera.md` mục 5 — thông số TFmini Plus: tầm **12 m trong nhà / 7 m ngoài trời**, baud 115200, frame rate 100 Hz; lưu ý tránh bề mặt hấp thụ (nước, kính, vật rất tối) và **nắng gắt chiếu thẳng vào ống kính**; cách đọc `strength` (rất thấp `< 100` hoặc bão hoà → `dist` không đáng tin).
- `plans/reports/260921-research-sitl-firmware-toolchain.md` mục 4.3 — ESC telemetry trên `SERIAL5` là nguồn RPM cho harmonic notch; ghi chú trong `custombuild` yaml: *"đã có RPM notch từ ESC telemetry nên không cần GyroFFT"*.
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` mục 6 — dòng rủi ro về OA BendyRuler.
- Ghi chép Phase 04 — đã thấy `AVOID`/`BRAKE` và `OA` chạy trên SITL với rangefinder ảo. Phase này là bản thật của bài đó.
- `docs/do-dac/20-ket-qua-bay.md` và `docs/do-dac/21-ket-qua-bay-web.md` — số liệu nền để so sánh trước/sau tuning.

Phải có sẵn và đã pass:

- Phase 21: **F5–F8 đều PASS**, đặc biệt **F8 RC override**.
- **ESC telemetry đang chạy**: `esc1_rpm`…`esc4_rpm` có số trên tab `Status` (kiểm ở Phase 19 mục 19.7). **Không có số này thì không làm được phần harmonic notch** — phải sửa trước.
- TFmini Plus đọc được trên Mission Planner: `Flight Data` → tab `Status` → `rangefinder1` (đã kiểm ở Phase 17 và Phase 18 mục 18.12).
- **Bãi rộng** cho F10: bán kính trống ít nhất 60 m, không người, không vật cản thật.
- **Ít nhất 4 pin 4S** — phase này có nhiều lần bay lặp lại.

## File và thư mục sở hữu

Tạo mới:

- `logs/flight_YYYYMMDD_HHMM/` — cho mỗi chuyến F9, F10, và các chuyến kiểm chứng tuning.
- `docs/do-dac/22-tuning-va-avoid.md` — bảng ghi **mọi giá trị đã thử và kết quả** (đây là nội dung chính cho báo cáo).
- `docs/so-tay/22-tranh-vat-can-tuning.md` — sổ tay người mới.
- `missions/22-f10-oa.waypoints` — mission của bài F10.

Sửa:

- `firmware/ardupilot/params/02-avoid-tfmini.param` — file avoid (là `params/obstacle-avoidance-tfminiplus-serial3.param` sau khi Phase 01 di chuyển và Phase 11 đổi tên). Phase này cập nhật các giá trị `AVOID_*` và `OA_*` **đã kiểm chứng bằng bay thật**, giữ nguyên toàn bộ khối chú thích ở đầu file và **thêm** một khối ghi ngày + giá trị đo được.
- `plans/PROGRESS.md` — tick checkbox Phase 22.
- `docs/test-log.md` — thêm dòng F9, F10 và dòng kết quả notch/autotune.

**Không đụng:** `backend/`, `frontend/`, `ml/`, các file param `00`–`01`, `03`–`06`.

> **`07-final.param` KHÔNG thuộc phase này.** Ảnh chụp tham số cuối cùng là việc của Phase 24. Phase này ghi giá trị vào `02-avoid-tfmini.param` và vào `docs/do-dac/22-tuning-va-avoid.md`; Phase 24 gom lại.

## Việc theo thứ tự

### 22.1 Hiểu giới hạn của một tia nhìn thẳng — đọc trước khi bay

Đây là mục **kiến thức**, không có thao tác, nhưng nó quyết định mọi bài bay phía sau được thiết kế thế nào.

**TFmini Plus trên drone này là MỘT tia, góc mở ~3,6°, chĩa thẳng về phía trước.** Hệ quả:

```text
LÀM ĐƯỢC:
  + Phát hiện một vật cản LỚN, ĐẶC, ở ĐÚNG PHÍA TRƯỚC, trong khoảng 0,1-7 m
    (7 m là tầm ngoài trời; trong nhà 12 m)
  + Cho ArduPilot phanh drone lại trước khi chạm (AVOID ở Loiter/AltHold/PosHold)
  + Cho ArduPilot lùi drone ra nếu vật cản tiến lại gần (AVOID_BEHAVE = 1)

KHÔNG LÀM ĐƯỢC:
  - Nhìn thấy gì ở hai bên, phía sau, phía trên, phía dưới. Drone MÙ ở mọi
    hướng khác.
  - Nhìn thấy vật mảnh (dây điện, cành cây nhỏ, lưới) — tia 3,6 độ ở 5 m
    chỉ quét một vòng tròn đường kính ~31 cm; vật mảnh hơn thế có thể lọt.
  - Nhìn thấy bề mặt HẤP THỤ hồng ngoại: nước, kính, vật rất tối, vải nhung.
  - Đo đúng khi NẮNG GẮT chiếu thẳng vào ống kính.
  - Biết ĐƯỜNG VÒNG. Nó chỉ biết "phía trước có gì cách bao xa", không biết
    "bên trái có trống không".

HỆ QUẢ CHO BendyRuler (bài F10):
  BendyRuler cần biết đường vòng thì mới vòng được. Với một tia nhìn thẳng,
  nó sẽ chọn lệch sang một hướng mà nó KHÔNG CÓ DỮ LIỆU — và tự tin bay
  vào đó. Đây chính là lý do params/obstacle-avoidance-*.param đặt OA_TYPE,0
  ngay từ đầu, và vì sao F10 chỉ được làm ở bãi rộng trống hoàn toàn với
  đúng MỘT vật cản giả.
```

**Kiểm tra cảm biến trước mỗi buổi bay của phase này** (trên bàn, không cánh):

```text
1. Cắm pin. Mission Planner -> Flight Data -> tab Status -> rangefinder1
2. Đưa tay/tấm bìa ra trước cảm biến ở các khoảng cách đo bằng thước dây:
   0,5 m / 1 m / 2 m / 3 m / 5 m
3. So số đọc với thước. Sai lệch nên dưới 5 %.
4. Bỏ vật cản ra -> số phải nhảy lên giá trị lớn hoặc báo ngoài tầm,
   KHÔNG được đứng yên ở một giá trị nhỏ (đó là đang quét trúng chính drone).
5. Ghi bảng 5 khoảng cách vào docs/do-dac/22-tuning-va-avoid.md
```

**Kết quả mong đợi:** bảng 5 khoảng cách có sai lệch < 5 %; không có vật cản thì số không bị kẹt ở giá trị nhỏ.

**Nếu lỗi:**

- *Số kẹt ở một giá trị nhỏ cố định:* tia đang quét trúng chân đáp/khung. Chỉnh lại bát gắn (Phase 18 mục 18.12).
- *Không có số:* gửi lại lệnh HEX khôi phục cài đặt gốc rồi lưu (`5A 04 10 6E` rồi `5A 04 11 6F`), cấp nguồn lại — quy trình ở chú thích đầu `params/obstacle-avoidance-tfminiplus-serial3.param`.
- *Số nhảy loạn khi ra nắng:* nắng gắt chiếu thẳng vào ống kính. Làm mái che nhỏ, hoặc bay vào lúc nắng xiên.

### 22.2 Xác nhận cấu hình AVOID hiện tại và dựng vật cản

**Giá trị hiện có trong `params/obstacle-avoidance-tfminiplus-serial3.param`** — xác nhận từng dòng trong Full Parameter List trước khi bay:

```text
RNGFND1_TYPE     20     Benewake-Serial
RNGFND1_ORIENT   0      hướng TRƯỚC
RNGFND1_MIN      0.1    m
RNGFND1_MAX      6      m   (thấp hơn tầm 7 m ngoài trời — biên an toàn)
PRX1_TYPE        4      đưa rangefinder vào hệ proximity
FENCE_ENABLE     1
AVOID_ENABLE     3      bật cả fence lẫn proximity
AVOID_BEHAVE     1      Slide/Backup  (không chỉ dừng, mà lùi ra)
AVOID_MARGIN     2      m   <- khoảng cách drone GIỮ với vật cản
AVOID_BACKUP_SPD 0.75   m/s tốc độ lùi ra
AVOID_BACKUP_DZ  0.10   m   vùng chết để không rung qua lại
AVOID_ACCEL_MAX  3      m/s^2
AVOID_DIST_MAX   5      m   <- khoảng cách bắt đầu "để ý" tới vật cản
AVOID_ANG_MAX    10     độ  <- góc nghiêng tối đa được phép dùng để né
OA_TYPE          0      TẮT path planner (bật ở bài F10)
```

**Dựng vật cản giả — bắt buộc là vật mềm:**

```text
VẬT CẢN ĐẠT YÊU CẦU:
  + Tấm bìa carton lớn (>= 1 x 1 m) dựng trên hai cọc / hai ghế
  + Tấm xốp trắng dày
  + Thùng giấy rỗng xếp chồng
  -> Phải RỘNG hơn nhiều so với vòng tia (ở 2 m, tia phủ ~12 cm),
     cao ít nhất 1,5 m, và ĐẶC (không phải lưới, không phải rèm)
  -> Màu SÁNG, bề mặt nhám. Không dùng vật đen tuyền, không dùng kính,
     không dùng mặt nước, không dùng bạt nhựa bóng.

TUYỆT ĐỐI KHÔNG DÙNG:
  - Tường, cột, cây, xe, hàng rào  (drone sẽ hỏng nếu tính năng không chạy)
  - Người đứng làm vật cản          (không bao giờ, trong mọi hoàn cảnh)
```

> **AN TOÀN:** Cắm cọc đỡ vật cản cho chắc nhưng **không dùng cọc kim loại nhọn chĩa lên**. Nếu drone đâm vào và rơi, cọc nhọn biến một cú rơi thành một mảnh vỡ văng.

**Kết quả mong đợi:** 14 tham số đúng giá trị; vật cản mềm, sáng màu, ≥ 1×1 m, dựng chắc ở chỗ trống.

### 22.3 Bài F9 — AVOID ở Loiter, tiến chậm vào vật cản

**Mục tiêu:** chứng minh drone **tự phanh** trước vật cản ở `AVOID_MARGIN` = 2 m, rồi **lùi ra** khi bị ép lại gần.

**Điều kiện tiên quyết:** 22.1 và 22.2 pass; F3 Loiter của Phase 20 vẫn tốt (nếu đã lâu không bay, bay lại F3 rút gọn 30 giây trước).

**Bố trí:**

```text
        vật cản (bìa carton 1x1 m, cao 1,5 m)
              |
              |
        <-- 10 m -->
              |
          drone cất cánh ở đây, mũi HƯỚNG THẲNG vào vật cản
              |
        <-- 5 m -->
              |
        người lái đứng ở đây (SAU drone, KHÔNG đứng giữa drone và vật cản)
```

**Quy trình — ba vòng, mỗi vòng thêm một thứ:**

**Vòng 1 — phanh (`AVOID_MARGIN`):**

1. Walk-around. `CH7` TẮT (bài này không dùng web).
2. Arm `Loiter` (`CH5` vị trí 3), cất cánh lên **2 m** — ngang tầm giữa của tấm bìa.
3. Xác nhận mũi drone **hướng thẳng vào vật cản** (quan trọng: cảm biến chỉ nhìn theo mũi).
4. **Đẩy cần pitch tới RẤT NHẸ** — tốc độ đi bộ chậm, khoảng 0,5 m/s. Người lái nhìn drone, người quan sát đọc to số `rangefinder1`.
5. Khi drone tới cách vật cản **~5 m** (`AVOID_DIST_MAX`), ArduPilot bắt đầu "để ý".
6. **Kết quả mong đợi:** drone **chậm lại và dừng hẳn ở khoảng 2 m** (`AVOID_MARGIN`) **mặc dù bạn vẫn đang đẩy cần tới**. Cảm giác như có một bức tường vô hình.
7. Buông cần. Drone đứng yên.
8. Đo bằng thước dây (sau khi hạ cánh) hoặc ước lượng bằng mắt: khoảng cách dừng thật là bao nhiêu? Ghi lại.

**Vòng 2 — lùi ra (`AVOID_BEHAVE`, `AVOID_BACKUP_SPD`):**

9. Drone vẫn đang treo ở 2 m trước vật cản, buông cần.
10. **Người quan sát từ từ đẩy tấm bìa tiến về phía drone** (đi bộ chậm, đẩy bằng cọc, **người đứng sau tấm bìa**, không bao giờ giữa drone và tấm bìa).
11. **Kết quả mong đợi:** drone **tự lùi ra**, giữ khoảng cách ~2 m, với tốc độ khoảng `AVOID_BACKUP_SPD` = 0,75 m/s.
12. Dừng đẩy. Drone đứng lại.

**Vòng 3 — ép nhẹ:**

13. Đẩy cần pitch tới **mạnh hơn** (vẫn không hết cỡ) và giữ 3 giây.
14. **Kết quả mong đợi:** drone vẫn **không vượt qua** mốc `AVOID_MARGIN`. Nó có thể nhích vào gần hơn một chút rồi bị đẩy ra — đó là hành vi bình thường của vòng điều khiển.
15. Buông cần. Gạt `CH5` về `Stabilize` **chỉ khi đã lùi drone ra xa vật cản ≥ 5 m**. Hạ cánh, disarm.

> **AN TOÀN:** Ở `Stabilize` và `Auto`, `AVOID` **không hoạt động** — `AC_Avoid` chỉ chạy ở `Loiter` / `PosHold` / `AltHold` (ghi rõ trong chú thích file param). Đừng gạt `CH5` về `Stabilize` khi drone còn đang đứng sát vật cản: bức tường vô hình biến mất ngay lập tức.

**Tiêu chí ABORT:**

- Drone **không chậm lại** khi tới gần vật cản → gạt `CH5` về `Stabilize` ngay và kéo drone ra bằng tay (ở `Stabilize` bạn có toàn quyền). Hạ cánh, kiểm tra lại `rangefinder1` và `AVOID_ENABLE`.
- Drone phanh rồi **rung/lắc mạnh** quanh mốc 2 m → buông cần; nếu không hết, gạt về `Stabilize` và kéo ra. Đây là dấu hiệu `AVOID_ACCEL_MAX` hoặc `AVOID_ANG_MAX` chưa hợp.

**Tiêu chí PASS:**

- [ ] Vòng 1: drone dừng ở **2 m ± 0,5 m** trước vật cản dù vẫn đang đẩy cần tới.
- [ ] Vòng 2: drone tự lùi ra khi vật cản tiến lại, giữ khoảng cách.
- [ ] Vòng 3: đẩy cần mạnh hơn vẫn không vượt qua mốc.
- [ ] Không rung lắc mạnh quanh mốc.
- [ ] Log: `RFND` (khoảng cách) và `POS` khớp nhau — thấy rõ drone dừng khi `RFND` chạm 2 m.

### 22.4 Chỉnh `AVOID_DIST_MAX` và `AVOID_ANG_MAX`

Chỉ làm **sau khi F9 vòng 1–3 đã pass với giá trị mặc định**. Mỗi lần chỉ đổi **một** tham số, bay lại vòng 1, ghi kết quả.

| Tham số | Hiện tại | Đổi khi nào | Hướng đổi |
|---|---|---|---|
| `AVOID_MARGIN` | 2 m | Dừng quá gần vật cản khiến bạn thót tim | Tăng lên 2,5–3 m. **Chưa xác minh** — nhưng không nên vượt quá `AVOID_DIST_MAX` − 1 m |
| `AVOID_DIST_MAX` | 5 m | Drone phanh quá gấp (giật) khi tới gần | Tăng lên 6 m để nó bắt đầu giảm tốc sớm hơn. **Trần cứng: `RNGFND1_MAX` = 6 m** — đặt cao hơn là vô nghĩa vì không có dữ liệu |
| | | Drone phản ứng với thứ ở quá xa, bay giật ở nơi trống | Giảm xuống 4 m |
| `AVOID_ANG_MAX` | 10° | Drone phanh không kịp, trôi vào sát vật cản | Tăng lên 15°. **Chưa xác minh.** Góc lớn hơn = phanh mạnh hơn, nhưng cũng = drone nghiêng mạnh hơn và dễ làm người lái giật mình |
| | | Drone nghiêng mạnh quá khi né, trông đáng sợ | Giảm xuống 7° |
| `AVOID_BACKUP_SPD` | 0,75 m/s | Lùi quá chậm, vật cản "đuổi kịp" | Tăng lên 1,0 m/s |
| | | Lùi giật cục | Giảm xuống 0,5 m/s và tăng `AVOID_BACKUP_DZ` lên 0,15 |
| `AVOID_ACCEL_MAX` | 3 m/s² | Phanh quá gấp | Giảm xuống 2 |
| | | Phanh không đủ, trôi qua mốc nhiều | Tăng lên 4 |

**Quy trình chỉnh, lặp cho từng tham số:**

```text
1. Ghi giá trị CŨ vào docs/do-dac/22-tuning-va-avoid.md
2. Đổi MỘT tham số. Reboot bo bay.
3. Bay lại F9 vòng 1 (chỉ vòng 1, ~2 phút).
4. Ghi: khoảng cách dừng thật, có giật không, có rung không.
5. Tốt hơn -> giữ. Xấu hơn -> trả về giá trị cũ NGAY, không "để đó xem sao".
6. Sang tham số tiếp theo.
```

> **AN TOÀN:** **Không đổi 2 tham số cùng lúc.** Nếu kết quả xấu đi, bạn sẽ không biết cái nào gây ra, và cách duy nhất là trả cả hai về — mất toàn bộ công sức.

**Kết quả mong đợi:** bảng trong `docs/do-dac/22-tuning-va-avoid.md` có ít nhất một dòng cho mỗi tham số đã thử, kèm kết luận giữ hay trả về.

### 22.5 Bài F10 — OA BendyRuler ở Auto, chỉ ở bãi rộng

> **AN TOÀN — đọc lại mục 22.1 trước khi làm bài này.** BendyRuler cần biết đường vòng, nhưng một tia 3,6° nhìn thẳng **không cung cấp được dữ liệu đó**. Nó sẽ chọn lệch sang một hướng **chưa có dữ liệu** và bay vào đó một cách tự tin. Bài này là một **thí nghiệm để hiểu giới hạn**, không phải một tính năng để dựa vào. Kết quả "nó vòng sai hướng" cũng là một kết quả hợp lệ và đáng ghi vào báo cáo.

**Điều kiện tiên quyết:**

```text
[ ] F9 PASS và đã chỉnh AVOID_* xong
[ ] BÃI RỘNG: bán kính trống >= 60 m quanh điểm cất cánh, KHÔNG người ngoài,
    KHÔNG vật cản thật ở bất kỳ hướng nào
[ ] FENCE_RADIUS đã đặt lại cho bãi này (>= mọi waypoint + 10 m biên)
[ ] ĐÚNG MỘT vật cản giả, mềm, đặt giữa hai waypoint
[ ] Gió < 2 m/s (nhẹ hơn yêu cầu của các bài trước — drone sẽ tự bay,
    bạn cần nhiều thời gian phản ứng hơn)
```

**Bật path planner:**

```text
OA_TYPE            1      BendyRuler
OA_LOOKAHEAD       5      m   — nhìn trước bao xa khi tìm đường  <-- chưa xác minh
OA_MARGIN_MAX      3      m   — khoảng cách muốn giữ với vật cản <-- chưa xác minh
OA_BR_TYPE         1      BendyRuler ngang (horizontal)          <-- chưa xác minh
```

> **Cả bốn giá trị đều CHƯA XÁC MINH.** Tên tham số `OA_*` và `OA_BR_*` khác nhau giữa các bản ArduPilot. **Đọc mô tả ngay trong Mission Planner** (`Full Parameter List` → gõ `OA_` → đọc hộp mô tả của từng dòng) thay vì gõ theo bảng này. Ghi tên và giá trị thật vào `docs/do-dac/22-tuning-va-avoid.md`.

**Thiết kế mission:**

```text
Takeoff 5 m
   |
WP1  (cách home 15 m)
   |
   |   <-- VẬT CẢN GIẢ đặt ĐÚNG GIỮA đoạn WP1 -> WP2,
   |        lệch sang một bên KHÔNG quá 1 m
   |
WP2  (cách WP1 30 m)
   |
RTL

WPNAV_SPEED = 150 cm/s (1,5 m/s) — CHẬM HƠN bài F5, vì drone phải kịp
                                    phát hiện và kịp tính đường vòng
```

Cả hai bên của đoạn WP1→WP2 phải **trống hoàn toàn trong 20 m** — vì bạn không biết BendyRuler sẽ chọn vòng sang bên nào.

**Quy trình:**

1. **Diễn tập trên bàn trước** (như Phase 21 mục 21.2): upload mission, `Read WPs`, xác nhận `OA_TYPE` = 1 sau reboot.
2. Walk-around. Arm `Loiter`, cất cánh bằng tay lên 5 m, ổn định.
3. Gạt `CH8` sang `Auto`. Buông cần.
4. **Ngón cái đặt sẵn trên `CH5`.** Theo dõi drone đi WP1 → tiến về WP2 → gặp vật cản.
5. Quan sát: drone có **vòng qua** không? Vòng sang bên nào? Vòng rộng bao nhiêu?
6. Sau khi qua vật cản, drone tiếp tục tới WP2 rồi RTL.

**Ba kết quả có thể xảy ra — cả ba đều là dữ liệu hợp lệ:**

```text
KẾT QUẢ A — vòng qua đúng và về lại đường bay
   -> BendyRuler chạy được trong điều kiện lý tưởng này. Ghi lại, và ghi RÕ
      rằng đây là điều kiện lý tưởng (một vật cản, hai bên trống 20 m).

KẾT QUẢ B — drone DỪNG trước vật cản và không đi tiếp (mission kẹt)
   -> BendyRuler không tìm được đường nó tin tưởng. Đây là hành vi AN TOÀN.
      Gạt CH5 về Loiter, lái tay vòng qua, rồi gạt CH8 lại để mission tiếp tục.

KẾT QUẢ C — drone vòng sang một hướng bất kỳ và đi khá xa khỏi đường bay
   -> Đây chính là điều mà file param đã cảnh báo trước: nó lệch sang hướng
      CHƯA CÓ DỮ LIỆU. Gạt CH5 về Loiter NGAY.
      Kết luận: với một tia nhìn thẳng, BendyRuler KHÔNG dùng được.
      Đặt lại OA_TYPE,0 và ghi kết luận này vào báo cáo — đây là một
      phát hiện có giá trị, không phải một thất bại.
```

**Tiêu chí ABORT:** drone đi lệch quá **10 m** khỏi đường WP1→WP2, hoặc tiến về phía người/ranh giới bãi → gạt `CH5` về `Loiter` ngay.

**Tiêu chí PASS của bài này** — lưu ý: pass **không** nghĩa là "BendyRuler hoạt động":

- [ ] Đã bay đủ mission với `OA_TYPE,1`, có log, và đã **phân loại được kết quả là A, B hay C**.
- [ ] Không phải ABORT vì lý do an toàn (đi quá 10 m hoặc hướng về người).
- [ ] Đã ghi kết luận vào `docs/do-dac/22-tuning-va-avoid.md`, và **đặt `OA_TYPE` về giá trị cuối cùng** (1 nếu kết quả A; **0** nếu kết quả B hoặc C).

> **AN TOÀN — giá trị mặc định sau phase này.** Nếu kết quả là B hoặc C, `OA_TYPE` **phải trở về 0** trong file param và trong bo bay. Để `OA_TYPE,1` trong khi nó không dùng được nghĩa là mỗi chuyến `Auto` sau này đều mang theo một hành vi không dự đoán được.

### 22.6 Harmonic notch từ RPM của ESC

**Vấn đề nó giải:** cánh quay tạo rung ở tần số tỉ lệ với vòng quay. Bộ lọc thông thấp mặc định của ArduPilot phải đặt thấp để chặn được rung đó, nhưng đặt thấp thì cũng làm chậm phản ứng điều khiển. **Harmonic notch** là bộ lọc **chỉ cắt đúng tần số của cánh** và **bám theo RPM khi RPM thay đổi** — cắt rung mà không làm chậm phần còn lại.

Dự án này có **RPM thật từ ESC telemetry trên `SERIAL5`**, nên không cần GyroFFT (ghi rõ trong `custombuild` yaml).

**Bước 1 — đo baseline trước khi bật notch:**

1. Bay một chuyến `Loiter` 60 giây ở 3 m, không chạm cần.
2. Tải log. Mở trong công cụ phân tích FFT của Mission Planner: `CONFIG` → `Planner` → bật `Advanced`, rồi `DataFlash Log` → `Review a Log` → nút **`FFT`**.
3. Đọc đồ thị: trục hoành là tần số (Hz), trục tung là biên độ rung.

```text
CÁI CẦN TÌM: một ĐỈNH NHỌN ở tần số nào đó.
   Ước lượng tần số cánh ở ga treo:
     RPM treo (đọc từ esc*_rpm trong log) / 60 = tần số cơ bản (Hz)
   Ví dụ 4800 rpm -> 80 Hz. Đỉnh ở ~80 Hz chính là cánh.
   Thường có thêm đỉnh nhỏ hơn ở 160 Hz, 240 Hz (hài bậc 2, bậc 3).
4. GHI LẠI: tần số đỉnh, biên độ đỉnh, và VIBE X/Y/Z trung bình.
   Đây là số "trước" để so sánh.
```

**Bước 2 — bật notch theo RPM:**

```text
INS_HNTCH_ENABLE  1
INS_HNTCH_MODE    3      Theo ESC telemetry (RPM)     <-- chưa xác minh giá trị
                         enum: ĐỌC mô tả trong Mission Planner trước khi đặt
INS_HNTCH_REF     <giá trị>   <-- chưa xác minh; với chế độ theo RPM thì
                         tham số này mang ý nghĩa khác so với chế độ theo ga.
                         ĐỌC mô tả trong Mission Planner.
INS_HNTCH_FREQ    <tần số đỉnh đo được ở bước 1, Hz>
INS_HNTCH_BW      <khoảng nửa tần số cơ bản>   <-- chưa xác minh
INS_HNTCH_HMNCS   3      bitmask: bậc 1 + bậc 2   <-- chưa xác minh
SERVO_BLH_TRATE   100    nâng từ 10 lên 100 Hz để RPM cập nhật đủ nhanh
                         (01-base.param ghi rõ: "nâng lên 100 khi bật
                          harmonic notch theo RPM")
SERVO_BLH_POLES   <số cực nam châm của AIR2216II — KIỂM TRA DATASHEET>
                         Sai số này làm RPM sai -> notch cắt SAI TẦN SỐ
```

> **Mọi giá trị `INS_HNTCH_*` ở trên đều CHƯA XÁC MINH.** Tên và ý nghĩa enum của nhóm này thay đổi giữa các bản ArduPilot. **Đọc mô tả của từng tham số ngay trong Mission Planner** trước khi đặt, và ghi giá trị thật đã dùng vào `docs/do-dac/22-tuning-va-avoid.md`.

> **AN TOÀN — `SERVO_BLH_POLES` là điều kiện tiên quyết.** Notch theo RPM chỉ đúng khi RPM đúng, và RPM chỉ đúng khi số cực nam châm đúng. `01-base.param` đặt tạm 14 với ghi chú "KIỂM TRA datasheet motor thực tế". **Kiểm tra trước khi bật notch.** Nếu không tìm được datasheet: đếm nam châm bên trong chuông motor (tháo vòng hãm), hoặc so `esc*_rpm` với một máy đo vòng quay quang học.

**Bước 3 — kiểm chứng:**

4. Bay lại **đúng bài ở bước 1**: `Loiter` 60 giây ở 3 m, không chạm cần, cùng viên pin, cùng điều kiện gió nếu có thể.
5. Tải log, mở FFT.
6. So sánh:

```text
ĐẠT:  Đỉnh ở tần số cánh ĐÃ NHỎ ĐI RÕ RỆT (lý tưởng: gần như biến mất)
      VIBE X/Y/Z trung bình GIẢM so với baseline
      Clip vẫn = 0
      Loiter cảm giác "chắc" hơn, ít trôi vặt hơn

KHÔNG ĐẠT: đỉnh vẫn nguyên -> notch đang cắt sai tần số
      -> kiểm tra SERVO_BLH_POLES, kiểm tra INS_HNTCH_MODE có thật sự
         đang theo RPM không, kiểm tra esc*_rpm có số không

XẤU ĐI: drone bay kém hơn, dao động mới xuất hiện
      -> TẮT NGAY (INS_HNTCH_ENABLE,0), bay lại để xác nhận đã về như cũ,
         rồi mới thử lại với giá trị khác
```

**Ghi vào `docs/do-dac/22-tuning-va-avoid.md`:** bảng trước/sau với tần số đỉnh, biên độ đỉnh, VIBE X/Y/Z. **Đây là một trong những bảng số liệu tốt nhất cho báo cáo** — nó cho thấy một phép đo, một can thiệp, và một phép đo lại.

### 22.7 AUTOTUNE — tuỳ chọn, có luật an toàn riêng

AUTOTUNE để ArduPilot tự lắc drone theo từng trục và tự tìm hệ số PID. Nó cho kết quả tốt hơn tay người mới, nhưng nó **cố tình làm drone lắc mạnh**, nên có luật riêng.

> **AN TOÀN — bảy luật của AUTOTUNE:**
> 1. **Chỉ chạy khi đã pass F9 và đã xong harmonic notch.** Tune trên một drone còn rung là tune vào nhiễu.
> 2. **Bãi rất rộng, trống hoàn toàn.** Drone sẽ tự di chuyển khá xa khi lắc.
> 3. **Gió < 2 m/s.** Gió làm AUTOTUNE ra kết quả sai.
> 4. **Độ cao ≥ 10 m** — đủ chỗ để drone phục hồi nếu một lần lắc quá tay.
> 5. **`CH5` luôn dưới ngón cái.** Gạt về `Loiter` là hủy AUTOTUNE ngay.
> 6. **Cần ít nhất 2 pin** — AUTOTUNE một trục mất vài phút; đủ 3 trục thường hết hơn một viên. Có thể tạm dừng, đổi pin, chạy tiếp.
> 7. **Sau khi xong, PHẢI bay thử một vòng trước khi lưu.** ArduPilot giữ hệ số mới cho tới khi bạn disarm ở chế độ AUTOTUNE — bay thử, nếu tốt thì hạ cánh và disarm **trong khi vẫn ở AUTOTUNE** để lưu; nếu xấu thì gạt sang mode khác rồi disarm để **bỏ** kết quả.

**Quy trình rút gọn:**

1. Gán `AUTOTUNE` cho một kênh phụ còn trống (`RC6_OPTION` đang là `RTL`; dùng một kênh khác, hoặc tạm gán rồi trả lại sau). **Đọc danh sách `RCx_OPTION` trong Mission Planner** để lấy giá trị đúng cho `AUTOTUNE` — **chưa xác minh**.
2. Đặt `AUTOTUNE_AXES` = chỉ **một trục** cho lần đầu (roll), thay vì cả ba. Chậm hơn nhưng dễ hủy hơn.
3. Cất cánh `Loiter`, lên 10 m, ổn định.
4. Gạt công tắc AUTOTUNE. Drone bắt đầu tự lắc theo trục roll.
5. **Không chạm cần**, trừ khi drone trôi ra ngoài khu vực — khi đó cứ chỉnh nhẹ, AUTOTUNE sẽ tiếp tục sau khi bạn buông.
6. Mission Planner báo hoàn tất trục đó.
7. Bay thử: gạt AUTOTUNE **tắt rồi bật lại** để lái thử với hệ số mới (hoặc theo hướng dẫn hiện trên Mission Planner).
8. Tốt → hạ cánh và disarm **khi vẫn đang ở AUTOTUNE** → hệ số được lưu. Xấu → gạt sang `Loiter` rồi disarm → hệ số bị bỏ.
9. Lặp cho trục pitch, rồi yaw.

**Nếu bỏ qua AUTOTUNE:** hoàn toàn chấp nhận được. Hệ số PID mặc định của ArduPilot cho khung quad cỡ này thường bay ổn, và Phase 20 đã chứng minh drone bay được. Ghi rõ trong báo cáo là **đã cân nhắc và quyết định không chạy**, kèm lý do — điều đó tốt hơn nhiều so với im lặng.

### 22.8 Ghi lại mọi giá trị cuối cùng

**Cập nhật `firmware/ardupilot/params/02-avoid-tfmini.param`:**

- Giữ **nguyên vẹn** toàn bộ khối chú thích ở đầu file (đấu dây, phân bổ nguồn 5V, lệnh HEX kiểm tra hàng cũ, lý do chọn SERIAL3). Những ghi chú đó vẫn đúng và vẫn cần.
- Cập nhật các dòng `AVOID_*` theo giá trị đã kiểm chứng ở 22.4.
- Cập nhật dòng `OA_TYPE` theo kết luận của 22.5.
- **Thêm một khối chú thích mới ở cuối file:**

```text
# === DA KIEM CHUNG BANG BAY THAT — Phase 22, ngay <YYYY-MM-DD> ===
# F9 (AVOID o Loiter): drone dung o <X> m truoc vat can bia carton 1x1 m,
#   lui ra o <Y> m/s khi vat can tien lai. Log: logs/flight_<...>/
# AVOID_MARGIN   <cu> -> <moi>   ly do: <...>
# AVOID_DIST_MAX <cu> -> <moi>   ly do: <...>
# AVOID_ANG_MAX  <cu> -> <moi>   ly do: <...>
# F10 (OA BendyRuler): ket qua <A/B/C>. <mot cau mo ta>.
#   -> OA_TYPE dat cuoi cung = <0 hoac 1>
# Harmonic notch: dinh FFT <f0> Hz truoc -> <f1> Hz sau; VIBE tb <v0> -> <v1>
# AUTOTUNE: <da chay truc nao / khong chay va vi sao>
```

**Điền `docs/do-dac/22-tuning-va-avoid.md`** — cấu trúc:

| Mục | Nội dung |
|---|---|
| Bảng hiệu chuẩn TFmini | 5 khoảng cách đo bằng thước vs số đọc (22.1) |
| Bảng thử `AVOID_*` | mỗi dòng: tham số, giá trị cũ, giá trị mới, kết quả bay, giữ hay trả về (22.4) |
| Kết quả F10 | phân loại A/B/C, mô tả, kết luận về giới hạn của một tia nhìn thẳng (22.5) |
| Bảng notch trước/sau | tần số đỉnh, biên độ, VIBE X/Y/Z (22.6) |
| AUTOTUNE | đã chạy trục nào, hệ số trước/sau, hoặc lý do không chạy (22.7) |

**Ghi `docs/test-log.md`:** dòng `F9`, dòng `F10`, và một dòng cho kết quả notch.

## Cổng pass

- [ ] Bảng hiệu chuẩn TFmini ở **5 khoảng cách** (0,5 / 1 / 2 / 3 / 5 m) có sai lệch < 5 % so với thước dây; khi không có vật cản thì số đọc **không kẹt** ở một giá trị nhỏ.
- [ ] 14 tham số `AVOID_*` / `RNGFND1_*` / `PRX1_TYPE` / `OA_TYPE` đã xác nhận đúng trong Full Parameter List trước khi bay.
- [ ] Vật cản giả là **vật mềm, sáng màu, ≥ 1×1 m, cao ≥ 1,5 m**; **không** dùng tường/cây/xe/người.
- [ ] **F9 vòng 1 PASS:** drone tự dừng ở **2 m ± 0,5 m** trước vật cản dù người lái vẫn đẩy cần tới.
- [ ] **F9 vòng 2 PASS:** drone tự lùi ra khi vật cản tiến lại, giữ khoảng cách.
- [ ] **F9 vòng 3 PASS:** đẩy cần mạnh hơn vẫn không vượt qua mốc `AVOID_MARGIN`; không rung lắc mạnh quanh mốc.
- [ ] Log F9 cho thấy `RFND` và `POS` khớp nhau tại thời điểm drone dừng.
- [ ] Đã thử và ghi kết quả cho **ít nhất 3** tham số trong `AVOID_DIST_MAX` / `AVOID_ANG_MAX` / `AVOID_BACKUP_SPD` / `AVOID_ACCEL_MAX`, mỗi lần **chỉ đổi một** tham số.
- [ ] **F10 đã bay** với `OA_TYPE,1` ở bãi bán kính trống ≥ 60 m, đúng một vật cản giả, hai bên trống ≥ 20 m; kết quả đã **phân loại là A, B hoặc C**; không ABORT vì lý do an toàn.
- [ ] `OA_TYPE` đã được đặt về **giá trị cuối cùng** (0 nếu kết quả B/C) trong **cả bo bay lẫn file param**.
- [ ] `SERVO_BLH_POLES` đã **kiểm tra theo datasheet motor** (hoặc đếm nam châm), không còn là giá trị tạm.
- [ ] Đã đo FFT **baseline trước** khi bật notch: tần số đỉnh, biên độ, VIBE X/Y/Z đã ghi.
- [ ] Harmonic notch đã bật theo RPM của ESC (`SERVO_BLH_TRATE` nâng lên 100); đã bay lại **đúng bài baseline** và đo FFT **sau**; đỉnh ở tần số cánh **nhỏ đi rõ rệt** và VIBE trung bình **giảm**; `Clip` vẫn = 0. (Nếu không đạt hoặc xấu đi: đã tắt notch và ghi lại kết luận — đây cũng là kết quả hợp lệ.)
- [ ] AUTOTUNE: **hoặc** đã chạy ít nhất một trục với đủ 7 luật an toàn và hệ số mới đã bay thử trước khi lưu, **hoặc** đã ghi rõ quyết định không chạy kèm lý do.
- [ ] `firmware/ardupilot/params/02-avoid-tfmini.param` đã cập nhật, **giữ nguyên khối chú thích đầu file**, và có khối "ĐÃ KIỂM CHỨNG BẰNG BAY THẬT" ở cuối với ngày tháng và số liệu thật.
- [ ] `docs/do-dac/22-tuning-va-avoid.md` có đủ 5 mục của bảng ở 22.8.
- [ ] `docs/test-log.md` có dòng F9, F10 và dòng kết quả notch.
- [ ] Mỗi chuyến bay của phase này có `logs/flight_YYYYMMDD_HHMM/` với `flight.bin` + `notes.md`.
- [ ] `docs/so-tay/22-tranh-vat-can-tuning.md` đã viết xong.
- [ ] **`07-final.param` CHƯA được tạo** — đó là việc của Phase 24.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| BendyRuler vòng sang hướng không có dữ liệu → drone bay vào chỗ không kiểm soát | 4 | 5 | **20** | Bãi trống bán kính ≥ 60 m và hai bên đường bay trống ≥ 20 m; `WPNAV_SPEED` 1,5 m/s; ABORT khi lệch > 10 m; kết quả C là kết quả **dự kiến** và dẫn tới `OA_TYPE,0`, không phải tới "thử lại lần nữa" |
| `AVOID` không hoạt động khi bay → drone đâm vật cản | 3 | 4 | 12 | Vật cản **luôn mềm**; kiểm `rangefinder1` bằng thước dây trước mỗi buổi (22.1); tiến vào ở 0,5 m/s; `CH5` về `Stabilize` là nút hủy |
| Người đứng giữa drone và vật cản khi làm vòng 2 (đẩy vật cản) | 3 | 5 | **15** | Quy định người đẩy **đứng sau tấm bìa**, đẩy bằng cọc; người lái đứng sau drone; nói to bố trí trước khi cất cánh |
| Gạt `CH5` về `Stabilize` khi drone còn sát vật cản → mất `AVOID` đột ngột | 3 | 4 | 12 | Cảnh báo ở 22.3 bước 15: chỉ gạt `Stabilize` khi đã lùi ra ≥ 5 m; `AC_Avoid` **không** chạy ở `Stabilize`/`Auto` |
| `SERVO_BLH_POLES` sai → notch cắt sai tần số → drone bay tệ hơn | 3 | 4 | 12 | Đặt kiểm tra `SERVO_BLH_POLES` thành điều kiện tiên quyết ở 22.6; đo FFT trước/sau để phát hiện; quy tắc "xấu đi thì tắt ngay" |
| Đổi nhiều tham số cùng lúc → không biết cái nào gây ra kết quả | 4 | 3 | 12 | Quy trình 6 bước ở 22.4 bắt buộc đổi một tham số mỗi lần; luật 3 của phase |
| AUTOTUNE làm drone lắc mạnh ngoài dự kiến ở độ cao thấp | 2 | 5 | **10** | Bảy luật ở 22.7: độ cao ≥ 10 m, bãi rất rộng, gió < 2 m/s, `CH5` hủy được, chạy **một trục** cho lần đầu |
| Lưu nhầm hệ số AUTOTUNE xấu (disarm sai mode) | 3 | 3 | 9 | Luật 7 ở 22.7 giải thích rõ cơ chế lưu/bỏ; bay thử trước khi hạ cánh |
| Nắng gắt chiếu vào ống kính TFmini → số rác → `AVOID` phanh ở chỗ trống | 3 | 3 | 9 | Kiểm `rangefinder1` ngay tại bãi trước khi bay (22.1); mái che nhỏ; bay lúc nắng xiên |
| Để `OA_TYPE,1` sau khi F10 cho kết quả B/C | 3 | 4 | 12 | Cổng pass có dòng riêng bắt buộc đặt về giá trị cuối cùng ở **cả bo bay lẫn file param**; khối chú thích cuối file ghi rõ kết luận |
| `CH8` (`Auto`) gạt nhầm khi bo đang giữ một mission cũ đã quên | 2 | 4 | 8 | Quy tắc ở Phase 21 mục 21.3: sau mỗi buổi, upload lại mission đơn giản `Takeoff → RTL` nếu không chắc |
| Ghi đè mất khối chú thích quý ở đầu file param | 2 | 3 | 6 | Mục "File sở hữu" và 22.8 nêu rõ **giữ nguyên vẹn** khối đầu file, chỉ **thêm** khối mới ở cuối |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 22.1 Đọc giới hạn cảm biến + hiệu chuẩn TFmini bằng thước | 1,0 | Trong nhà / tại bãi |
| 22.2 Xác nhận 14 tham số + dựng vật cản | 1,0 | |
| 22.3 F9 ba vòng + đọc log | 2,5 | |
| 22.4 Chỉnh `AVOID_*`, ≥ 3 tham số × bay lại vòng 1 | **3,0** | Mỗi vòng ~2 phút bay nhưng nhiều lần cất/hạ |
| 22.5 F10 BendyRuler: diễn tập + bay + đọc log | 3,0 | Cần bãi rộng — có thể phải đi xa |
| 22.6 Harmonic notch: baseline + bật + kiểm chứng | **3,5** | Hai chuyến bay giống hệt nhau, cộng phân tích FFT |
| 22.7 AUTOTUNE (tuỳ chọn) | 2,5 | Bỏ qua được; nếu chạy thì cần ≥ 2 pin |
| 22.8 Cập nhật param + điền bảng + `test-log.md` | 1,0 | |
| Viết `docs/so-tay/22-tranh-vat-can-tuning.md` | 1,0 | |
| **Tổng** | **~18,5** | ~16 nếu bỏ AUTOTUNE |

Đường găng: 22.1 → 22.2 → 22.3 → 22.4 → 22.5. Nhánh **22.6 (harmonic notch) độc lập với 22.3–22.5** — làm song song được, ở một buổi khác, miễn là mỗi buổi chỉ đổi một nhóm tham số. **22.7 phải đi sau 22.6** (tune trên drone còn rung là tune vào nhiễu). Chia buổi: **buổi 1** 22.1–22.3; **buổi 2** 22.4; **buổi 3** (bãi rộng) 22.5; **buổi 4** 22.6; **buổi 5** 22.7 nếu làm.

## Ghi chú cho sổ tay

- **Rangefinder, proximity và avoidance là ba lớp khác nhau** — `RNGFND1_*` đo khoảng cách; `PRX1_TYPE` biến số đo đó thành "có vật cản ở hướng này"; `AVOID_*` quyết định drone làm gì với thông tin đó. Hiểu ba lớp thì mới biết chỉnh cái nào khi có vấn đề.
- **`AVOID_MARGIN` khác `AVOID_DIST_MAX` thế nào** — một cái là khoảng cách **muốn giữ**, một cái là khoảng cách **bắt đầu để ý**. Vẽ hình.
- **`AC_Avoid` chỉ chạy ở `Loiter`/`PosHold`/`AltHold`** — không chạy ở `Stabilize`, không chạy ở `Auto`/`Guided`/`RTL`. Đây là chi tiết dễ gây tai nạn nhất của cả phase.
- **Path planner (`OA_*`) là một thứ khác hẳn** — nó lập lại **đường bay** ở `Auto`; `AC_Avoid` chỉ **phanh và trượt** ở chế độ bay tay.
- **Một tia nhìn thẳng làm được gì** — tính diện tích vòng tia theo khoảng cách (`đường kính ≈ 2 × d × tan(1,8°)`), và vì sao vật mảnh lọt qua.
- **Vì sao vật cản phải sáng màu và nhám** — nguyên lý đo thời gian bay của tia hồng ngoại; vì sao nước, kính, vật đen tuyền không phản xạ đủ; ý nghĩa của trường `strength`.
- **BendyRuler nghĩ như thế nào** — nói đơn giản: nó thử vài hướng, chọn hướng "có vẻ thoáng nhất". Vấn đề là "thoáng" với nó nghĩa là "không có dữ liệu", chứ không phải "đã kiểm tra và trống".
- **Rung có tần số** — vì sao cánh quay tạo rung ở đúng một tần số tỉ lệ với RPM, và vì sao tần số đó **thay đổi khi ga thay đổi**.
- **Bộ lọc thông thấp so với notch** — hình minh hoạ: một cái cắt tất cả phía trên một ngưỡng (và làm chậm phản ứng), một cái chỉ khoét đúng một rãnh hẹp.
- **Vì sao notch theo RPM tốt hơn notch cố định** — rãnh khoét bám theo cánh khi cánh đổi tốc độ.
- **Đọc đồ thị FFT** — trục hoành là tần số, trục tung là biên độ; đỉnh nhọn nghĩa là gì; cách quy đổi RPM ra Hz (`RPM / 60`); hài bậc 2, bậc 3 là gì.
- **PID là gì** (giải thích cho người chưa biết, không dùng công thức) và **AUTOTUNE làm gì** — vì sao nó phải lắc drone thì mới đo được.
- **Vì sao một kết quả "không hoạt động" vẫn là kết quả tốt cho báo cáo** — phân biệt "thí nghiệm thất bại" với "thí nghiệm cho ra kết luận âm"; kết luận âm có giá trị khi nó được đo đàng hoàng và nêu rõ điều kiện.

---

**Prior-art:** rút vật liệu thô từ nháp cũ `README.md` GIAI ĐOẠN 83 (geofence là lớp authoritative, geofence trên web chỉ là lớp phụ), 87 (`logs/flight_*/` và `notes.md`), 88 (quy ước đánh số file param — và lý do phase này **không** tạo `07-final.param`). Toàn bộ giá trị `AVOID_*` / `RNGFND1_*` / `PRX1_TYPE` / `OA_TYPE,0` cùng lời cảnh báo về BendyRuler với một tia 3,6° lấy nguyên từ `params/obstacle-avoidance-tfminiplus-serial3.param`. Thông số TFmini Plus (tầm 12 m trong nhà / 7 m ngoài trời, `strength`, bề mặt hấp thụ, nắng gắt) lấy từ `plans/reports/260921-research-esp32-bridge-camera.md` mục 5. Nguồn RPM từ ESC telemetry trên `SERIAL5` và ghi chú "đã có RPM notch từ ESC telemetry nên không cần GyroFFT" lấy từ `plans/reports/260921-research-sitl-firmware-toolchain.md` mục 4.3 và `01-base.param`. Ba vòng của bài F9, bảng chỉnh `AVOID_*` theo triệu chứng, phân loại kết quả A/B/C của F10, quy trình baseline-FFT → bật notch → kiểm chứng, và bảy luật AUTOTUNE ở đây là mới.
