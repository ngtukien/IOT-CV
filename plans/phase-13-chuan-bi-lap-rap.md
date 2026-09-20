# Phase 13: Chuẩn bị lắp ráp — đấu dây, mua sắm, bố trí khung, tập hàn

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 11 | ~5,3 giờ | Không (trừ 13.6 tập hàn: cần mỏ hàn + dây thừa) |

## Mục tiêu

Xong phase này, bạn có ba tờ giấy in ra và một đơn hàng đã đặt. Tờ thứ nhất là bảng tra từng
chân của bo bay — cắm gì vào đâu, dây nào bắt chéo. Tờ thứ hai là sơ đồ bố trí trên khung S500 —
cái gì nằm chỗ nào và vì sao. Tờ thứ ba là checklist mở thùng hàng.

Và quan trọng nhất: **tay bạn đã biết hàn** trước khi chạm vào 12 mối hàn dây motor thật. Một mối
hàn nguội trên dây motor sẽ gây desync giữa lúc bay, và desync một motor là rơi.

Phase này không cần hàng về. Đặt hàng càng sớm càng tốt — hàng phụ kiện thường về chậm hơn hàng chính.

## Đầu vào cần có

- `firmware/ardupilot/params/01-base.param` (Phase 11) — bản đồ cổng serial đã chốt.
- `firmware/ardupilot/params/02-avoid-tfmini.param` (Phase 11) — phần chú thích về màu dây TFmini và phân bổ nguồn 5V.
- `firmware/dronebridge/README.md` (Phase 12) mục (c) — đấu dây ESP32 sang T2/R2.
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` §3 — kiến trúc.
- `plans/QUYET-DINH-CHUA-CHOT.md` — Quyết định 1, cần chốt **trước khi bấm nút mua**.
- `SAFETY.md` — đọc lại mục 2 (NO PROPELLERS), mục 6 (pin LiPo), mục 7 (nguồn điện).
- `docs/archive/README.md` (bản nháp cũ Phase 01 đã lưu trữ) — GIAI ĐOẠN 26–31, 37 có sơ đồ chân GPS chi tiết.
- Dụng cụ đã có: mỏ hàn 60 W, đồng hồ vạn năng, bộ lục giác, túi chống cháy LiPo.

## File và thư mục sở hữu

```text
docs/so-tay/13-dau-day.md           bảng tra từng chân + hai điều tuyệt đối không làm
docs/so-tay/13-bo-tri-khung.md      sơ đồ bố trí trên khung S500 + lý do từng vị trí
docs/so-tay/13-mua-sam.md           danh sách mua + giá ước tính + câu hỏi shop
docs/so-tay/13-checklist-in-ra.md   ba tờ in ra giấy
docs/so-tay/13-tap-han.md           bài tập hàn + tiêu chí mối hàn đạt
```

Không đụng `firmware/**` (Phase 11–12 sở hữu). Không đụng `SAFETY.md`.

---

## Việc theo thứ tự

### 13.1 Danh sách mua thêm và câu hỏi gửi shop — **làm đầu tiên**

Làm việc này trước mọi việc khác trong phase, vì hàng cần thời gian về. Mua thiếu một món
30.000 ₫ có thể chặn cả tuần.

Viết `docs/so-tay/13-mua-sam.md`. **Mọi giá đều *chưa xác minh*** — giá tham khảo thị trường Việt
Nam tháng 09/2026, dùng để ước ngân sách chứ không dùng để mặc cả.

Đã có sẵn (không mua lại): khung Holybro S500, stack SpeedyBee F405 V5 OX32 55A Deluxe,
T-Motor AIR GEAR 450 II (4× AIR2216 KV920 + 8 cánh T1045), Holybro M10 GPS 10 chân + cột nâng,
FlySky FS-i6X + iA6B, pin Ovonic 4S 5300 mAh, sạc SkyRC iMAX B6AC V2, TFmini Plus.

| Món | SL | Giá ước tính *(chưa xác minh)* | Vì sao cần — **chặn việc nào** |
|---|---|---|---|
| Bát chống rung 30,5×30,5 mm | 1 | 50.000 – 150.000 ₫ | Khung S500 **không có** lỗ 30,5×30,5, stack thì bắt đúng chuẩn đó. Bắt cứng = truyền rung 4 motor thẳng vào cảm biến gia tốc → AltHold tự trôi lên/tụt xuống, Loiter trôi ngang. **Chặn Phase 18.** |
| Dây silicone **16AWG**, 3 màu | 4,5 m | ~150.000 ₫ | Dây motor T-Motor chỉ dài 150 mm, mỗi cần khung ~240 mm. Cần 30 cm × 3 dây × 4 motor = 3,6 m, mua dư. **Chặn Phase 18.** |
| Gen co nhiệt bộ nhiều cỡ 2–10 mm | 1 bộ | ~50.000 ₫ | Bọc 12 mối hàn dây motor. Hở một mối chạm cần khung = chập, cháy ESC. **Chặn Phase 18.** |
| Dây rút nhựa 2,5×100 mm | 1 bịch | ~30.000 ₫ | Dây lủng lẳng bị cánh quạt chém đứt giữa lúc bay. **Chặn Phase 18.** |
| UBEC 5V 3A | 1 | ~80.000 ₫ | Nguồn riêng cho ESP32 + camera. Ăn ké 5V của stack = bo bay reset khi Wi-Fi bật. **Chặn Phase 17.** |
| ESP32 DevKit, chip **CP210x** | 1 | ~120.000 ₫ | Chạy DroneBridge. Ưu tiên CP210x hơn CH340 vì driver tải từ trang chính hãng Silicon Labs, ít rủi ro hơn. **Chặn Phase 17.** |
| Mạch USB-TTL 3,3 V (CP2102) | 1 | ~30.000 ₫ | Bắt buộc cho **hai** việc: bench test TFmini (Phase 17) và nạp ESP32-CAM (không có cổng USB). **Chặn Phase 17.** |
| Tụ 470–1000 µF, ≥16 V, low-ESR | 2 | ~20.000 ₫ | Chống brownout cho ESP32-CAM lúc Wi-Fi bật. **Chặn Phase 17** — chỉ khi chọn nhánh camera A. |
| Anten ngoài 2,4 GHz u.FL | 1 | ~13.000 ₫ | Chỉ cần nếu chọn ESP32-CAM. **Cảnh báo: phải hàn lại một điện trở SMD 0-ohm** — việc khó với người mới, và chỉ dùng được một trong hai anten. |
| Smoke stopper | 1 | ~150.000 ₫ | **Tuỳ chọn nhưng rất nên có.** Lần cắm pin đầu tiên, nếu có ngắn mạch nó chặn dòng thay vì để cháy stack ~2 triệu. |
| Camera | 1 | xem dưới | **Quyết định đang mở** |

Camera — ghi cả ba nhánh, **chốt trước khi bấm nút mua**:

```text
Nhanh A - ESP32-CAM AI-Thinker    ~180.000d + anten 13.000d + tu 20.000d
  Re nhat. Anh xau nhat -> co gia tri nhat cho de tai Xu ly anh.
  Doi lai: khong co cong USB (nghi thuc IO0->GND moi lan nap), hay brownout,
  phai han SMD neu muon anten ngoai.

Nhanh B - XIAO ESP32S3 Sense      ~459.000d
  USB-C (cam la nap), 8MB PSRAM, kem san anten ngoai, cam bien OV3660 moi hon.
  Tiet kiem rat nhieu thoi gian cho nguoi moi.

Nhanh C - mua ca hai              ~640.000d
  XIAO gan len drone; ESP32-CAM de ban lam "camera xau nhat" de so sanh
  3 muc chat luong.
```

Năm câu nhắn shop **trước khi trả tiền** (nhắn trong khung chat của sàn để có bằng chứng nếu
phải khiếu nại):

```text
1. Bat chong rung co dung lo 30.5 x 30.5mm khong, va kem may qua cao su?
2. Day silicone 16AWG loi NHIEU SOI MANH hay loi cung?  (phai la nhieu soi manh)
3. Bo gen co nhiet co co nao den co nao?
4. ESP32 DevKit dung chip USB nao - CP2102 hay CH340?
5. Giao hang trong bao nhieu ngay?
```

Danh sách **đừng mua**:

```text
KHONG -- Bo thu ELRS         : khong ghep duoc voi tay FlySky (khac chuan song AFHDS-2A)
KHONG -- ESC 30A roi         : stack da co ESC 4-in-1 55A khoe hon
KHONG -- Power board (PDB)   : stack da kiem luon viec phan phoi nguon
KHONG -- Pin 3S              : khung S500 bat buoc 4S, ban da co dung roi
KHONG -- Dong ho do cell pin : sac B6AC V2 da co san chuc nang Battery Meter
KHONG -- Day 14AWG cho motor : xem muc 13.2
```

**Kết quả mong đợi:** danh sách có tổng tiền cho từng nhánh camera; mỗi món nói rõ nó chặn phase
nào; **đơn hàng đã đặt**.

**Nếu lỗi:**
- Shop không trả lời câu hỏi 2 → đổi shop. Dây 16AWG lõi cứng sẽ nứt mối hàn theo thời gian, và
  bạn không phát hiện được cho tới khi nó hỏng trên không.
- Chưa chốt được camera → vẫn đặt 10 món còn lại ngay hôm nay, camera đặt sau. Đừng để cả đơn chờ.
- Nếu chưa chốt camera (`plans/QUYET-DINH-CHUA-CHOT.md`) vào ngày đặt hàng: đặt ngay 10 món còn lại, camera đặt riêng sau khi chốt; không đặt "tạm" một loại.

### 13.2 Bảng tra từng chân bo bay — tờ giấy quan trọng nhất

Đây là tờ bạn cầm trong tay lúc hàn. Viết `docs/so-tay/13-dau-day.md` theo đúng cấu trúc dưới —
mỗi cổng một dòng, ghi rõ **cái gì cắm vào**, **màu dây**, **có bắt chéo hay không**.

```text
BANG TRA CHAN - SpeedyBee F405 V5

Cong / pad     Noi den                        Bat cheo?   Ghi chu
-----------    ---------------------------    ---------   ----------------------------
M1 M2 M3 M4    4 motor qua ESC OX32           -           Di qua cap 10 chan giua 2 tang.
                                                          KHONG han day tin hieu rieng.
BAT+ / BAT-    day pin XT60 + tu 1000uF       -           Han o TANG ESC, khong phai tang FC.
                                                          Chan DAI cua tu la (+). Lap nguoc = no tu.
5V / GND pads  GPS + receiver + TFmini        -           Tong tai ~200mA. BEC cua stack
                                                          chiu 2.5A -> thua rat nhieu.
T4 / R4        GPS Holybro M10 (UART)         CO          GPS TX -> R4 ; GPS RX -> T4
SDA / SCL      la ban IST8310 (trong GPS)     KHONG        I2C: SDA->SDA, SCL->SCL
R6             iA6B cong i-BUS                -           CHI noi signal vao R6.
                                                          KHONG noi vao T6. KHONG dung cong PPM.
T2 / R2        ESP32 DroneBridge              CO          FC T2 -> ESP32 RX ; FC R2 -> ESP32 TX
R3             TFmini Plus, day XANH (TXD)    -           Chi can 1 day du lieu.
                                                          PIN-2 (trang, RXD) DE TRONG.
T5 / R5        ESC telemetry OX32             -           19200 baud, di trong cap 10 chan.
USB-C          nap firmware + Mission Planner -           KHONG cam pin cung luc o Phase 14.
```

Chi tiết từng cụm, viết thành mục riêng trong file:

**(a) GPS Holybro M10 — món khó đấu nhất của cả bản dựng.** Hai đầu dùng hai họ giắc khác nhau và
thứ tự chân ngược nhau; phải cắt và bấm lại dây, không có cách tránh. Nối **theo TÊN TÍN HIỆU,
không theo màu dây**:

```text
GPS VCC   -> FC 4V5
GPS GND   -> FC GND
GPS TX    -> FC R4      <-- CHEO
GPS RX    -> FC T4      <-- CHEO
GPS SCL   -> FC SCL
GPS SDA   -> FC SDA
4 chan NC -> CAT BO     (safety switch, LED, 3V3, buzzer - F405 V5 khong co cong cho chung)
```

Ba lỗi kinh điển ở bước này:

```text
1. Noi TX->TX (quen bat cheo)
   Trieu chung: GPS van sang den binh thuong, Mission Planner bao "No GPS".
   Khong hong gi, chi la khong bao gio len. Day la cho kiem tra DAU TIEN.

2. Khong do dien ap chan nguon
   Holybro yeu cau 4,7-5,2V; chan cong GPS cua bo ghi la "4V5" - tren giay la hoi thap.
   Cam pin roi DO chan do bang dong ho:
       >= 4,7V  -> dung binh thuong
       <  4,7V  -> han rieng day do sang pad 5V, giu nguyen 5 day con lai

3. Dat GPS thap va gan day nguon
   Dong 58A cua motor sinh tu truong lan at tu truong Trai Dat -> la ban sai ->
   bat Loiter la drone bay vong tron moi luc mot rong.
   Loi kinh dien cua nguoi moi, va no KHONG bao loi gi ca.
```

**(b) TFmini Plus** — màu dây theo datasheet Benewake bảng 5.1:

```text
Do    PIN-1  +5V   -> pad 5V cua stack  (KHONG dung chung UBEC voi camera)
Trang PIN-2  RXD   -> DE TRONG (driver ArduPilot chi doc, khong gui lenh ra cam bien)
Xanh  PIN-3  TXD   -> chan R3 cua FC
Den   PIN-4  GND   -> GND chung
```

Dây GH1.25-4P dài 30 cm. Datasheet khuyến cáo dây nối dài **không quá 1 m**.

**(c) Phân bổ nguồn 5V — quan trọng, đừng gộp chung:**

```text
BEC 5V cua stack (2.5A):   GPS M10 ~40mA + receiver iA6B ~50mA
                           + TFmini Plus 110mA (dinh 140mA)  = ~200mA. Thua rat nhieu.
UBEC 5V 3A rieng:          ESP32 DevKit (DroneBridge) + camera.

Ly do tach: ESP32 bat Wi-Fi gay burst dong va sut ap. Datasheet TFmini Plus ghi ro
san pham KHONG co bao ve qua ap/nguoc cuc, chi chiu dao dong +-0.5V.
Cho ESP32-CAM: han them tu 470-1000uF sat chan nguon de chong brownout.
```

**(d) Hai điều tuyệt đối không làm** — in to, tách riêng trên tờ giấy:

```text
1. KHONG KHOAN vao de duoi khung S500.

   De duoi S500 KHONG phai tam nhua tron. No la bo phan phoi nguon, co duong dong
   DUC CHIM ben trong lop vat lieu - ban khong nhin thay chung.
     Khoan trung duong dong  -> dut mach nguon. Khong len dien, khong do duoc bang mat.
     Mat dong bam thanh lo    -> chap chon: luc dau van chay, nong len moi chap
                                 (va luc do drone dang o tren khong).

   Nhan biet: tam nao co diem han dong va ky hieu cuc + - thi CAM KHOAN.
   Cach dung: bat chong rung 30,5x30,5, mat duoi bat vao lo CO SAN cua tam tren,
              hoac dan bang keo xop hai mat day 1-2mm (dan KIN ca mat, khong dan 4 goc).
   KHONG bat oc xuyen qua bat chong rung xuong thang khung - lam vay la noi cung
   tro lai, 4 qua cao su mat sach tac dung.

2. KHONG dung day 14AWG cho day motor.

   14AWG la co day NGUON PIN (ca drone rut 58A). Moi motor chi rut ~15A, ma 16AWG
   chiu toi 80A - thua suc.
   Day 14AWG qua cung, kho luon trong can khung, va no truyen rung dong lam
   NUT MOI HAN theo thoi gian. Nut mot moi han tren khong = mat mot motor = roi.
```

**(e) Danh sách 12 mối hàn** có ô tick để đánh dấu từng mối đã bọc gen co nhiệt (4 motor × 3 dây).

**Kết quả mong đợi:** file in ra vừa 2 mặt A4, đọc được mà không cần mở máy tính.

**Nếu lỗi:** nếu lúc hàn (Phase 18) bạn phải mở máy tra thêm → bảng còn thiếu. Bổ sung **ngay lúc
đó** rồi commit, đừng hẹn lại.

### 13.3 Sơ đồ bố trí trên khung S500

Viết `docs/so-tay/13-bo-tri-khung.md`. Mỗi thiết bị một vị trí, kèm **lý do** — vì ở Phase 18 bạn
sẽ bị cám dỗ đặt cho tiện tay.

```text
NHIN TU TREN XUONG (mui drone huong LEN tren trang giay)

                     mui drone
                         ^
              [TFmini Plus] [camera]        <- ca hai NHIN THANG TRUOC
                    \        /
        motor 3 ------ TANG TREN ------ motor 1
         (truoc-trai)  [ bat chong rung ]  (truoc-phai)
                       [    stack FC    ]
                       [    ESC OX32    ]
        motor 2 ------              ------ motor 4
         (sau-trai)    [cot GPS M10]        (sau-phai)
                       [ESP32] [UBEC]
                            |
                     pin 4S duoi bung

Thu tu motor o tren la thu tu QUAD X chuan ArduPilot - CHUA DUOC XAC NHAN.
Phai kiem chung bang Motor Test o Phase 16 truoc khi tin.
```

Sáu quyết định về vị trí, đã chốt:

| Thiết bị | Vị trí | Vì sao |
|---|---|---|
| Stack FC + ESC | tâm khung, **tầng trên**, trên bát chống rung | Càng gần tâm quay càng ít rung; bát chống rung nối được hai chuẩn lỗ và cách ly rung |
| Mũi tên trên FC | **hướng về phía trước** | Nếu buộc phải xoay, khai báo `AHRS_ORIENTATION`. **Không bao giờ "tự nhớ offset"** |
| GPS M10 | **cột nâng phía SAU**, cao hơn mặt khung ≥ 8–10 cm | Phía trước đã có TFmini và camera. Cột ở phía trước sẽ lọt vào khung hình camera **và có thể phản xạ tia lidar về, cho số đo khoảng cách giả**. Cột cao để tránh từ trường của dây nguồn 58 A |
| TFmini Plus | mép trước, **nhìn thẳng ngang về phía trước**, không bị càng đáp che | Đây là cảm biến tránh vật cản hướng trước (`RNGFND1_ORIENT,0`). Bị che = đọc ra khoảng cách của chính cái càng |
| ESP32 + UBEC | tầng dưới, phía sau, xa GPS | ESP32 phát Wi-Fi 2,4 GHz; đặt cạnh GPS/receiver gây nhiễu |
| Pin 4S | dưới bụng, **trượt được tới lui** | Dùng để cân bằng trọng tâm ở Phase 18. Đừng dán chết |

**AN TOÀN:** đánh dấu **mũi tên hướng trước** lên vỏ GPS, cùng chiều mũi tên của FC, **trước khi**
lắp lên cột. Lắp xong rồi mới phát hiện xoay 90° thì phải tháo cả cụm. Nếu buộc phải xoay, khai
báo `COMPASS_ORIENT` — đừng tự nhớ.

**AN TOÀN:** mọi dây đi dọc cần khung phải được buộc bằng dây rút. Dây lủng lẳng trong mặt phẳng
cánh quạt sẽ bị chém đứt giữa lúc bay — và dây bị chém thường là dây nguồn hoặc dây tín hiệu motor.

**Kết quả mong đợi:** sơ đồ vẽ xong, mỗi thiết bị có một dòng lý do.

### 13.4 Ba tờ checklist in ra giấy

In thật, không đọc trên màn hình — lúc đấu dây tay bạn bẩn và màn hình thì đã tắt.

Viết `docs/so-tay/13-checklist-in-ra.md`, ba phần tách trang rõ ràng.

**Tờ 1 — MỞ THÙNG HÀNG** (dùng ở Phase 14.1):

```text
[ ] Dem du mon theo don hang, doi chieu voi 13-mua-sam.md
[ ] CHUP ANH toan bo hang truoc khi lap        <-- can neu phai khieu nai
[ ] 4 motor: xoay tay muot, khong ret, bearing khong lao xao, 3 day khong troc,
    nam cham khong ca vao stator
[ ] DEM CHIEU REN oc chop motor: phai co dung 2 REN THUAN + 2 REN NGHICH.
    Van thu bang tay: siet chat khi xoay CUNG chieu kim dong ho = ren thuan.
    DUNG TIN NHAN HOP. Neu shop gui 4 cai cung loai ren -> doi ngay.
[ ] Stack: khong chay, khong phong tu, khong bien dang.
    Du 2 soi cap 10 chan trong hop Deluxe (25mm va 75mm)
[ ] FC: cam USB vao may tinh -> Windows keu "ting", hien thiet bi moi.
    CHUA CAN CAM PIN.
[ ] GPS: khong vo anten gom; cot nang du ong + 2 de + oc
[ ] iA6B: bind duoc voi FS-i6X (chi can nguon 5V, chua can bo bay)
[ ] LiPo: do TUNG cell bang chuc nang Battery Meter cua B6AC V2
        Pin moi xuat xuong: 3,80-3,85 V/cell, tong 15,2-15,4 V
        Lech giua cell cao nhat va thap nhat < 0,05 V
        KHONG dung pin: phong / rach vo / day long / cell lech bat thuong
```

**Tờ 2 — BẢNG TRA CHÂN + HAI ĐIỀU CẤM** (bản rút gọn của `13-dau-day.md`).

**Tờ 3 — THỨ TỰ TEST TRÊN BÀN, KHÔNG CÁNH** (bản rút gọn của Phase 14–17):

```text
[ ] 14  Nap DFU -> Mission Planner nhan board -> co param PRX1_TYPE -> luu 00-after-flash
[ ] 14  Nap 01-base.param, reboot, kiem tra lai
[ ] 15  Bind RC, iBUS vao R6, radio calibration, map switch, test RC failsafe
[ ] 15  GPS len T4/R4 + I2C compass, ra ngoai troi cho 3D Fix
[ ] 16  DO CONTINUITY BAT+/GND TRUOC KHI CAM PIN
[ ] 16  Cam pin lan dau (smoke stopper neu co), hieu chinh dien ap bang dong ho
[ ] 16  Motor test 5-10% - KHONG CANH - kiem thu tu va chieu quay
[ ] 17  ESP32 + DroneBridge len SERIAL2, Mission Planner khong day
[ ] 17  TFmini bench bang USB-TTL, roi cam vao R3, nap 02-avoid-tfmini.param
[ ] 17  Backend doi SITL -> drone that, Web GCS hien telemetry that
```

Trên **mỗi tờ**, in ở đầu trang một dòng duy nhất, cỡ chữ lớn nhất trang:

```text
KHONG CANH QUAT TRONG TOAN BO PHASE 14-17
```

**AN TOÀN:** đây không phải khẩu hiệu. `SAFETY.md` mục 2 liệt kê mọi việc bắt buộc tháo cánh:
motor test, kiểm chiều quay, test RC failsafe, test mất Wi-Fi, mọi lần test lệnh từ web khi drone
còn trên bàn, test camera khi motor chạy. Cánh chỉ được gắn sau khi **toàn bộ** checklist Phase 19
đã pass.

**Kết quả mong đợi:** ba tờ giấy nằm cạnh bàn làm việc.

### 13.5 Chuẩn bị chỗ làm và dụng cụ

Viết mục này vào `docs/so-tay/13-tap-han.md`.

```text
CHO LAM
  [ ] Ban phang, du sang, co o cam gan
  [ ] Tham chong tinh dien hoac it nhat la mat ban khong phai kim loai tran
  [ ] Tui chong chay LiPo de canh - pin CHI nam trong tui khi khong dung
  [ ] Binh chua chay hoac thau cat kho trong tam voi
  [ ] Quat hut khoi han hoac mo cua so - khoi nhua thong doc

DUNG CU DA CO
  [ ] Mo han 60W (du cho day 16AWG; mo han 30W se khong du nhiet, gay MOI HAN NGUOI)
  [ ] Dong ho van nang (can che do continuity co tieng beep va che do do DC volt)
  [ ] Bo luc giac
  [ ] Tui LiPo

CAN THEM
  [ ] Thiec han co nhua thong (rosin core) - 0.8mm
  [ ] Gia do mo han + mieng bot bien lau dau mo
  [ ] Kim tuot day (hoac dao roc, nhung kim tuot de hon nhieu)
  [ ] Kep giu ("tay thu ba") - han day 16AWG bang 2 tay la rat kho
  [ ] May say toc hoac bat lua ga de lam co gen (dung mo han de lam co gen -
      no lam chay gen)
```

**AN TOÀN:** pin LiPo chỉ được lấy ra khỏi túi chống cháy khi đang dùng, và **không bao giờ sạc
khi không có người trông** (`SAFETY.md` mục 6). Trong toàn bộ Phase 13–17, pin nằm trong túi trừ
đúng lúc Phase 16 cần cắm.

### 13.6 Tập hàn trên dây thừa — **trước khi** chạm vào dây motor thật

Ở Phase 18 bạn sẽ hàn **12 mối** trên dây motor (4 motor × 3 dây). Một mối hàn nguội sẽ gây
desync — motor đang quay thì khựng lại — và desync một motor trên không là rơi. Đây là lý do phải
tập trước, không phải học trên chính dây motor.

Ba bài, làm theo thứ tự, mỗi bài làm tới khi đạt rồi mới sang bài sau:

```text
BAI 1 - Tuot day va xe soi (10 phut)
  Tuot 5mm vo silicone khoi doan day 16AWG thua. Khong duoc dut mot soi dong nao.
  Xoan cac soi lai theo mot chieu.
  DAT: loi dong sang bong, khong soi nao thua ra ngoai.

BAI 2 - Tinning (ma thiec) hai dau roi noi (20 phut, lam 5 lan)
  Ma thiec rieng tung dau day truoc, roi ap hai dau da ma vao nhau va nung lai.
  DUNG doi thiec tu chay tu dau mo han xuong moi noi.
  DAT: moi han SANG BONG, nhin thay ro hinh soi dong ben trong lop thiec,
       keo manh bang tay khong tuot.
  HONG (moi han NGUOI): mat thiec xam, san sui, vun cuc nhu giot nuoc dong tren
       la sen. Moi han nay dan dien luc dau va DUT khi rung. Han lai.

BAI 3 - Gen co nhiet (10 phut)
  Long gen VAO day TRUOC KHI han - quen buoc nay la phai cat ra han lai,
  va ban se quen it nhat mot lan.
  Gen phai dai hon moi han moi ben 5mm.
  Lam co bang may say toc, xoay deu. KHONG dung mo han.
  DAT: gen om sat, khong thay mot mm dong nao lo ra.
```

Tiêu chí dừng: **hàn được 5 mối liên tiếp đều đạt** ở bài 2. Nếu chưa, đừng sang Phase 18.

```text
BA LOI HAY GAP CUA NGUOI MOI
1. Mo han chua du nong -> thiec khong chay deu -> moi han nguoi.
   Doi mo han nong hoan toan (thu bang cach cham vao thiec: phai chay NGAY).
2. Nung qua lau -> chay vo silicone, tut vo lo loi dong ra ngoai.
   Moi noi chi can 2-4 giay.
3. Quen long gen co nhiet truoc khi han. Lan nao cung co nguoi quen.
```

**AN TOÀN:** mỏ hàn 60 W đạt ~350 °C, không có tín hiệu nhìn thấy được là nó đang nóng. Luôn đặt
vào giá đỡ, không đặt xuống bàn. Khói nhựa thông độc — bật quạt hút hoặc mở cửa sổ.

**Kết quả mong đợi:** 5 mối hàn mẫu đạt tiêu chí, giữ lại để đối chiếu ở Phase 18. Chụp ảnh một
mối đạt và một mối nguội, dán vào `docs/so-tay/13-tap-han.md` để lần sau nhìn là biết.

**Nếu lỗi:**
- Thiếc không bám vào dây → đầu mỏ hàn bị oxy hoá. Lau vào bọt biển ẩm rồi mạ thiếc lại đầu mỏ.
- Vỏ silicone co tụt khi hàn → nung quá lâu hoặc mỏ hàn quá nóng; giảm thời gian chạm.
- Không phân biệt được mối đạt và mối nguội → mối đạt **sáng bóng như gương**, mối nguội **xám và
  sần**. Chụp cả hai cạnh nhau dưới ánh sáng tốt.

---

## Cổng pass

- [ ] `docs/so-tay/13-mua-sam.md` có đủ 11 dòng món kèm cột "chặn phase nào"; **đơn hàng đã đặt**.
- [ ] Camera đã chốt nhánh (A/B/C) **hoặc** đã đặt 10 món còn lại và ghi rõ camera đặt sau.
- [ ] `docs/so-tay/13-dau-day.md` có: bảng tra 10 cổng, mục GPS với 3 lỗi kinh điển, mục TFmini với màu dây, mục phân bổ nguồn 5V, hai điều cấm, danh sách 12 mối hàn có ô tick.
- [ ] `docs/so-tay/13-bo-tri-khung.md` có sơ đồ nhìn từ trên và bảng 6 quyết định vị trí kèm lý do.
- [ ] Ba tờ checklist đã **in ra giấy** và đang nằm cạnh bàn; mỗi tờ có dòng "KHÔNG CÁNH QUẠT" ở đầu trang.
- [ ] Chỗ làm đã chuẩn bị: bàn phẳng, túi LiPo, quạt hút/cửa sổ mở, dụng cụ bổ sung đã mua.
- [ ] **Đã hàn được 5 mối liên tiếp đạt tiêu chí** ở bài 2; ảnh mối đạt và mối nguội đã dán vào sổ tay.
- [ ] Mọi giá trong danh sách mua đều được đánh dấu *chưa xác minh*.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Mối hàn nguội trên dây motor → desync trên không → rơi | 3 | 5 | **15** | **Rủi ro cao — bắt buộc giảm trước khi sang Phase 18.** 13.6 tập hàn tới khi 5 mối liên tiếp đạt; Phase 16 có bài test desync (tăng ga từ từ 10→50%, nghe tiếng khục); Phase 18 bọc gen co nhiệt từng mối và tick vào danh sách 12 mối. |
| Mua thiếu một món nhỏ (USB-TTL, tụ, UBEC) → chặn cả tuần | 3 | 4 | **12** | 13.1 làm **đầu tiên** trong phase; mỗi món ghi rõ chặn phase nào; đặt hàng ngay cả khi camera chưa chốt. |
| Khoan vào đế dưới S500 → đứt mạch nguồn ngầm, không dò được bằng mắt | 2 | 5 | 10 | In điều cấm số 1 lên tờ giấy cỡ chữ lớn; mua bát chống rung để **không cần khoan gì cả**. |
| Mua nhầm dây 14AWG hoặc dây lõi cứng | 3 | 3 | 9 | Câu hỏi số 2 gửi shop; điều cấm số 2 trên tờ in. |
| Đấu GPS TX→TX (quên bắt chéo) | 4 | 2 | 8 | Ghi thành "chỗ kiểm tra ĐẦU TIÊN" trong mục GPS; triệu chứng (đèn sáng nhưng MP báo No GPS) đã ghi sẵn. |
| Đặt GPS thấp/gần dây nguồn → la bàn sai → Loiter bay vòng tròn, không báo lỗi gì | 3 | 4 | **12** | 13.3 chốt vị trí cột nâng phía sau ≥ 8–10 cm kèm lý do; Phase 19 hiệu chỉnh la bàn ngoài trời; Phase 20 F3 có cổng pass "không toilet-bowl". |
| Camera chưa chốt làm cả đơn hàng chờ | 3 | 3 | 9 | 13.1 tách rõ: đặt 10 món trước, camera sau. |

**Rủi ro điểm 15 (mối hàn nguội)** là rủi ro cao nhất của cả nhóm phase phần cứng. Biện pháp giảm
thiểu nằm ở ba chỗ (13.6 tập hàn, 16.x test desync, 18.x bọc gen + tick 12 mối) và **phải hoàn
thành 13.6 trước khi bắt đầu Phase 18**.

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 13.1 Danh sách mua + câu hỏi shop | 1,0 | **Làm đầu tiên**, đặt hàng ngay trong ngày |
| 13.2 Bảng tra chân | 1,5 | Tờ giấy quan trọng nhất của cả dự án |
| 13.3 Sơ đồ bố trí khung | 0,7 | |
| 13.4 Ba tờ checklist + in | 0,8 | |
| 13.5 Chuẩn bị chỗ làm | 0,3 | Mua thêm dụng cụ hàn cùng đơn 13.1 |
| 13.6 Tập hàn | 1,0 | Cần mỏ hàn + dây thừa; nếu dây 16AWG chưa về thì tập trên dây bất kỳ cùng cỡ |
| **Tổng** | **5,3** | Đường găng: 13.1 → đặt hàng. Phần còn lại rải ra trong lúc chờ hàng về. |

## Ghi chú cho sổ tay

Khái niệm cần giải thích cho người chưa biết gì:

- **Mối hàn nguội là gì**, nhìn ra sao, và vì sao nó nguy hiểm hơn mối hàn hở (hở thì không chạy
  ngay, nguội thì chạy được một thời gian rồi đứt giữa lúc bay).
- **AWG là gì** — số càng **nhỏ** thì dây càng **to**. 14AWG to hơn 16AWG. Ngược trực giác.
- **Bắt chéo TX-RX** — TX là "tôi nói", RX là "tôi nghe"; hai thiết bị nói chuyện thì miệng bên
  này phải đấu vào tai bên kia.
- **I2C khác UART ra sao** — I2C nối thẳng SDA→SDA, SCL→SCL (không bắt chéo), và nhiều thiết bị
  dùng chung được một cặp dây.
- **BEC và UBEC là gì** — mạch hạ áp từ pin 4S (16,8 V) xuống 5 V cho thiết bị ngoại vi.
- **Brownout** — sụt áp tức thời làm vi điều khiển reset, khác với mất điện hẳn.
- **Rung động và vì sao nó phá hỏng AltHold/Loiter** — cảm biến gia tốc không phân biệt được
  "drone đang tăng độ cao" với "drone đang rung"; ngưỡng 30 m/s² bắt đầu có vấn đề, 60 m/s² thì
  gần như luôn hỏng giữ độ cao và giữ vị trí.
- **Desync là gì** — ESC mất đồng bộ với motor, motor khựng lại giữa lúc quay.
