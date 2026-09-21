# Phase 16: Trên bàn — nguồn điện, motor và ESC

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 15 | ~5,0 giờ | **Có** — stack, 4 motor, pin 4S, đồng hồ vạn năng, smoke stopper (nếu có) |

## Mục tiêu

Đây là phase đầu tiên có **điện áp pin 4S** (16,8 V) chạy qua mạch. Xong phase này: đường nguồn đã
được đo và chứng minh không chập, pin đã cắm lần đầu an toàn, bo bay đọc điện áp pin **đúng với
đồng hồ vạn năng** (giải quyết mâu thuẫn 11.0 vs 11.2), và bạn đã tự mắt xác nhận motor nào là
motor A/B/C/D cùng chiều quay của từng cái.

```text
KHONG CANH QUAT.  KHONG NGOAI LE.
```

Đây là phase nguy hiểm nhất trong nhóm test trên bàn. Pin 4S 5300 mAh có thể phóng hàng trăm ampe
vào một chỗ chập mà không có cầu chì nào chặn lại.

## Đầu vào cần có

- Phase 15 đã pass — đặc biệt là **RC failsafe đã test thật** (nếu chưa, quay lại làm cho xong).
- `docs/so-tay/13-dau-day.md` — mục BAT+/BAT−, mục phân bổ nguồn 5V.
- `firmware/ardupilot/params/01-base.param` — `BATT_*`, `MOT_PWM_TYPE`, `SERVO_BLH_*`.
- `plans/reports/260921-research-sitl-firmware-toolchain.md` §4.3 (DShot), **§4.5 (mâu thuẫn `BATT_VOLT_MULT`)**.
- `SAFETY.md` mục 2 (NO PROPELLERS), mục 3 (pre-arm), mục 6 (pin LiPo), mục 7 (nguồn điện).
- Dụng cụ: đồng hồ vạn năng (chế độ continuity **có tiếng beep** + chế độ DC volt), mỏ hàn, gen co nhiệt, băng keo điện, dây rút, túi chống cháy LiPo, **smoke stopper nếu có**.
- Bình chữa cháy hoặc thau cát khô trong tầm với.

## File và thư mục sở hữu

```text
docs/so-tay/16-nguon-motor-esc.md
firmware/ardupilot/params/01-base.param   CHỈ sửa 1 dòng BATT_VOLT_MULT (xem 16.5)
plans/PROGRESS.md                         chỉ tick các dòng của Phase 16
```

> **Ghi chú sở hữu file.** `01-base.param` được **tạo** ở Phase 11 và được **sửa đúng một dòng** ở
> phase này, sau khi đã đo bằng đồng hồ. Hai phase chạy tuần tự nên không có xung đột. Không sửa
> dòng nào khác trong file đó.

---

## Việc theo thứ tự

### 16.1 Hàn nguồn: XT60 và tụ 1000 µF vào tầng ESC

Kiến trúc nguồn của bản dựng này đơn giản hơn nhiều bản khác, vì stack SpeedyBee đã gộp ESC 4-in-1
và mạch phân phối nguồn vào làm một. **Không dùng power board rời của khung S500.**

```text
            LiPo 4S 5300mAh
                  |
                XT60
                  |
                  v
        +---------------------+
        |  ESC OX32 4-in-1    |  <- han day pin vao cap pad BAT+ / BAT-
        |  (tang duoi stack)  |  <- han tu 1000uF 35V vao CUNG cap pad do
        +---------------------+
          |    |    |    |   |
          M1   M2   M3   M4  +-- cap 10 chan --> FC (tin hieu + nguon + do dong)
```

Ba điều bắt buộc:

```text
1. HAN TU 1000uF 35V ngay vao pad BAT+/BAT- cua ESC.
   Hop Deluxe co san 2 tu. Khong lap tu -> xung dien ap luc dong cat
   co the giet FC.
   Chan DAI la (+), chan NGAN la (-). Lap nguoc la NO TU.

2. FC KHONG han day pin rieng.
   FC lay nguon qua dung soi cap 10 chan tu ESC. Hop Deluxe co 2 soi
   (25mm va 75mm) - chon soi vua voi khoang cach giua 2 tang.

3. Chong ngan mach giua hai tang:
   [ ] Boc vo silicone (hop Deluxe co 10 cai) vao FC va ESC
   [ ] Dung oc nylon + dem silicone cua hop de chong tang
   [ ] Khong de duoi chan linh kien tang duoi cham mat dong tang tren
   [ ] Soi cap 10 chan gap gon, khong ket giua hai bo khi siet oc
```

**AN TOÀN:** lắp tụ ngược cực là **nổ tụ** — tụ điện phân nổ ra khói và mảnh, ngay sát mặt bạn nếu
bạn đang cúi xuống nhìn. Kiểm tra chiều chân **hai lần** trước khi hàn, và đeo kính bảo hộ khi cắm
pin lần đầu.

**AN TOÀN:** hai tầng chạm nhau là chập nguồn 4S — cháy cả stack (~2 triệu) trong chưa đầy một
giây, và có thể kéo theo cháy pin.

**Kết quả mong đợi:** XT60 và tụ đã hàn chắc, mối hàn sáng bóng (đối chiếu với mối mẫu đã giữ từ
Phase 13.6); hai tầng đã chồng với ốc nylon và đệm silicone.

**Nếu lỗi:**
- Mối hàn trên pad BAT xám và sần → mối hàn nguội, ở dòng 58 A nó sẽ nóng chảy. Hàn lại.
- Mỏ hàn 60 W không làm chảy thiếc trên pad lớn → pad nguồn tản nhiệt rất mạnh; giữ mỏ lâu hơn
  một chút và mạ thiếc sẵn cho pad trước.

### 16.2 Đo continuity **trước khi** cắm pin

Đây là luật cứng của dự án (`SAFETY.md` mục 7), không phải khuyến nghị.

```text
Dong ho van nang -> che do CONTINUITY (bieu tuong song am thanh, co tieng beep)

Do:  BAT+   <-->   GND
```

```text
KHONG BEEP (hoac dien tro rat lon)  ->  BINH THUONG. Duoc phep di tiep.
BEEP nhu dang chap                  ->  DUNG LAI. KHONG CAM PIN.
```

Nếu beep: tháo ra, kiểm từng thứ theo thứ tự — (1) hai tầng có chạm nhau không, (2) tụ có lắp
ngược không, (3) có sợi đồng thừa nào bắc cầu giữa hai pad không, (4) vỏ silicone đã bọc chưa.

Đo thêm cho chắc:

```text
[ ] BAT+ <-> BAT-        khong beep
[ ] BAT+ <-> vo kim loai khung (neu co)   khong beep
[ ] Tung pad motor <-> GND                khong beep
```

**AN TOÀN:** đồng hồ vạn năng ở chế độ continuity chỉ phát ra vài mA — hoàn toàn an toàn. Pin 4S
phát ra hàng trăm ampe. Thứ tự "đo trước, cắm sau" là thứ duy nhất ngăn cách hai con số đó.

**Kết quả mong đợi:** cả 4 phép đo đều không beep.

### 16.3 Cắm pin lần đầu

**AN TOÀN — chuẩn bị trước khi cắm:**

```text
[ ] Deo kinh bao ho
[ ] Pin dat trong tui chong chay, chi day dau XT60 ra ngoai
[ ] Binh chua chay / thau cat kho trong tam voi
[ ] Khong co giay to, khan, vat de chay tren ban
[ ] KHONG CANH QUAT tren motor (o phase nay motor con chua lap)
[ ] Duong thoat: biet truoc minh se rut pin bang tay nao
```

Nếu **có smoke stopper** — dùng nó:

```text
Pin 4S --> smoke stopper --> XT60 cua drone
Smoke stopper co bong den noi tiep. Khi cam:
    Bong sang le roi TAT dan  ->  binh thuong (tu dang nap)
    Bong SANG CHOI va giu sang ->  CHAP. Rut ngay. Quay lai 16.2.
```

Nếu **không có smoke stopper**: cắm dứt khoát một nhịp, và **để tay trên đầu XT60 sẵn sàng rút**.
Quan sát trong 5 giây đầu:

```text
[ ] Khong co khoi
[ ] Khong co mui khet
[ ] Khong co linh kien nao nong len nhanh (so nhe mat sau ESC sau 5 giay)
[ ] Den tren FC va ESC sang binh thuong
[ ] ESC phat tieng "bip" khoi dong (neu co loa)
```

Bất kỳ dấu hiệu nào ở trên sai → **rút pin ngay**, quay lại 16.2.

Sau khi cắm pin ổn, đo lại các đường 5 V bằng đồng hồ ở chế độ DC volt:

```text
[ ] Pad 5V cua stack        4,8 - 5,2 V
[ ] Chan 4V5 cong GPS       >= 4,7 V
    Neu < 4,7V -> han rieng day do cua GPS sang pad 5V, giu nguyen 5 day con lai
                  (Holybro yeu cau 4,7-5,2V)
```

**Kết quả mong đợi:** không khói, không mùi, đèn sáng bình thường, các đường 5 V trong khoảng cho phép.

**Nếu lỗi:**
- Có khói/mùi khét → rút pin, **không cắm lại**, tìm nguyên nhân. Thường là tụ ngược cực hoặc hai
  tầng chạm nhau.
- Chân GPS chỉ có 4,3 V → hàn dây đỏ sang pad 5V như ghi ở trên. Đừng bỏ qua: GPS thiếu điện thì
  I2C (la bàn) chết trước UART, và triệu chứng là "GPS có fix nhưng la bàn im" — rất khó đoán.

### 16.4 Hiệu chỉnh điện áp pin — giải quyết mâu thuẫn 11.0 vs 11.2

Hai nguồn tài liệu chính thức nói khác nhau về hệ số đo pin của bo này:

| Nguồn | `BATT_VOLT_MULT` | `BATT_AMP_PERVLT` |
|---|---|---|
| README của board | 11.2 | 1 |
| `hwdef.dat` (thứ thực sự được biên dịch vào firmware) | **11.0** | **25.0** |

**Quyết định đã chốt: không tin con nào cả.** `01-base.param` đặt 11.0 làm điểm xuất phát (vì
`hwdef.dat` là thứ thực sự nằm trong firmware), rồi **đo bằng đồng hồ vạn năng và ghi đè**. Con số
đúng là con số đo được trên chính con drone này, không phải con số trong bất kỳ tài liệu nào.

Cách 1 — dùng wizard của Mission Planner (dễ hơn):

```text
1. Cam pin, cam USB, Mission Planner CONNECT
2. SETUP -> Optional Hardware -> Battery Monitor
3. Do dien ap THAT o dau XT60 bang dong ho van nang (che do DC volt)
4. Go so vua do vao o "Measured battery voltage"
5. Mission Planner tu tinh lai BATT_VOLT_MULT
6. Doc lai so tren HUD - phai khop voi dong ho trong khoang 0,05 V
```

Cách 2 — tự tính (nếu wizard không chạy):

```text
BATT_VOLT_MULT moi = BATT_VOLT_MULT cu x (dien ap DO DUOC / dien ap Mission Planner HIEN)

Lap lai cho toi khi hai so khop nhau trong khoang 0,05 V.
```

Ghi kết quả vào `docs/so-tay/16-nguon-motor-esc.md`:

```text
Ngay do        : ...
Dong ho do     : ..... V  (tai dau XT60)
Mission Planner: ..... V  (truoc khi hieu chinh)
BATT_VOLT_MULT : 11.0 -> ..... (gia tri cuoi cung)
Sai so con lai : ..... V
```

Rồi **sửa đúng một dòng** trong `firmware/ardupilot/params/01-base.param`:

```text
BATT_VOLT_MULT,<gia tri da do>
# Da hieu chinh bang dong ho van nang ngay <...>. Truoc do la 11.0 (theo hwdef.dat).
# README board ghi 11.2 - ca hai deu KHONG dung voi bo nay.
```

```powershell
git add firmware/ardupilot/params/01-base.param
git commit -m "param: hieu chinh BATT_VOLT_MULT bang dong ho van nang (giai quyet mau thuan 11.0 vs 11.2)"
```

**Về cảm biến dòng (`BATT_AMP_PERVLT,25.0`):** **chưa xác minh** và **chưa hiệu chỉnh được ở phase
này**, vì muốn hiệu chỉnh phải có một tải đã biết hoặc phải so lượng điện đã dùng với lượng sạc
lại vào pin. Việc đó để Phase 20 trở đi: sau một chuyến bay, so `BATT_CAPACITY` đã tiêu thụ trên
Mission Planner với số mAh mà sạc B6AC V2 nạp trả lại. Ghi chú này phải nằm trong sổ tay để không
bị quên.

Sau khi hiệu chỉnh xong, đặt lại ngưỡng arm (trong `01-base.param` nó đang là 0 để tránh báo lỗi
nhầm lúc chưa hiệu chỉnh):

```text
BATT_ARM_VOLT = 14.8      # 3,7 V/cell. Duoi muc nay la pin da dung nhieu,
                          # khong nen cat canh. Dat TRUC TIEP tren bo bay,
                          # khong sua vao 01-base.param.
```

**AN TOÀN:** ngưỡng pin chỉ đáng tin khi bo bay đọc điện áp đúng. Số đọc sai + ngưỡng đúng =
drone rơi vì tưởng còn pin, hoặc RTL giữa chừng vì tưởng hết pin. **Không copy ngưỡng khi số đọc
còn sai** — hiệu chỉnh trước, đặt ngưỡng sau.

**Kết quả mong đợi:** HUD và đồng hồ khớp nhau trong 0,05 V; giá trị mới đã commit.

**Nếu lỗi:**
- Mission Planner hiện 0 V → `BATT_MONITOR` chưa bằng 4, hoặc cáp 10 chân chưa cắm hẳn.
- Hiệu chỉnh xong vẫn lệch > 0,1 V và lệch **thay đổi** theo thời gian → pin đang sụt trong lúc
  đo. Đo lại ngay sau khi cắm, đừng để bo bay chạy vài phút rồi mới đo.

### 16.5 Nối motor tạm thời để kiểm thứ tự và chiều quay

Ở phase này khung **chưa lắp** (việc đó là Phase 18), nên motor chưa gắn lên cần. Ta kiểm thứ tự
và chiều quay bằng cách nối tạm.

```text
NOI TAM - KHONG HAN
  Moi motor co 3 day. Xoan tung day motor voi tung day dan tu pad ESC,
  BOC RIENG TUNG MOI bang bang keo dien hoac gen co nhiet.
  Ba moi cua cung mot motor KHONG duoc cham nhau.
  Co dinh moi motor xuong ban bang bang dinh hoac day rut.
  Danh nhan M1 M2 M3 M4 bang bang dinh - ban se KHONG nho duoc.
```

**AN TOÀN:** nối tạm chỉ được dùng ở mức ga **≤ 10%** (motor không cánh, dòng dưới 1 A). Tuyệt đối
không đẩy ga cao hơn với mối nối tạm — mối xoắn ở dòng lớn sẽ nóng, tuột, và chập. Bài test
**desync** (tăng ga từ từ lên tới 50% và nghe tiếng khục) **chỉ làm sau khi đã hàn thật** — việc
đó thuộc Phase 19.

**AN TOÀN:** motor không gắn cánh vẫn quay rất nhanh và có thể văng khỏi bàn nếu không cố định.
Cố định từng cái, và để tay xa trục.

### 16.6 Motor Test — xác minh thứ tự A/B/C/D

Đây là bước **không được bỏ qua và không được đoán**. ArduPilot có **hai kiểu đánh số motor khác
nhau** cho cùng hình chữ X:

```text
QUAD X  (chuan ArduPilot)       QUAD X (BETAFLIGHT)
  motor 1 = truoc-PHAI            motor 1 = sau-PHAI
  motor 2 = sau-TRAI              motor 2 = truoc-PHAI
  motor 3 = truoc-TRAI            motor 3 = sau-TRAI
  motor 4 = sau-PHAI              motor 4 = truoc-TRAI
```

Pad M1–M4 in trên ESC 4-in-1 là thứ tự của thế giới **Betaflight**. Nếu thứ tự thực tế không khớp
`FRAME_TYPE` đang đặt thì **drone lật úp ngay giây đầu tiên nhấc lên** — đây là nguyên nhân số một
làm gãy cánh ở chuyến bay đầu, không phải hạ cánh mạnh.

```text
Mission Planner -> SETUP -> Optional Hardware -> Motor Test
Dat throttle 5-10%, thoi gian 2-3 giay

Test A phai quay motor TRUOC-PHAI
Test B phai quay motor SAU-PHAI        <- thu tu di THEO CHIEU KIM DONG HO,
Test C phai quay motor SAU-TRAI           bat dau tu motor dau tien ben phai
Test D phai quay motor TRUOC-TRAI         cua huong mui

Dung ca 4   -> giu FRAME_TYPE = 1 (X)
Sai thu tu  -> doi FRAME_TYPE sang "X (Betaflight)" roi test LAI ca 4
```

Vì motor chưa gắn lên khung, hãy **bày 4 motor trên bàn theo đúng vị trí chúng sẽ nằm trên khung**
(dùng sơ đồ trong `docs/so-tay/13-bo-tri-khung.md`), mũi drone hướng ra xa bạn. Rồi mới bấm Test A.

**AN TOÀN:** trước mỗi lần bấm Test, nói to "không cánh" và nhìn lại 4 motor. Thói quen này nghe
buồn cười nhưng nó là thứ ngăn tai nạn ở Phase 19 khi cánh đã ở gần đó trên bàn.

**Kết quả mong đợi:** 4 nút A/B/C/D quay đúng 4 motor theo thứ tự chiều kim đồng hồ; ghi kết quả
vào sổ tay.

**Nếu lỗi:**
- Sai thứ tự → đổi `FRAME_TYPE` sang X (Betaflight) và test lại **cả 4**, không chỉ cái sai.
- Một motor không quay → kiểm mối nối tạm của motor đó; nếu mối nối tốt thì đổi thử sang pad khác
  để phân biệt lỗi ESC và lỗi motor.
- Cả 4 không quay → kiểm `MOT_PWM_TYPE` và xem cáp 10 chân đã cắm hẳn chưa.

### 16.7 Chiều quay motor

```text
QUAD X - chieu quay chuan ArduPilot (nhin tu TREN xuong):
    motor 1 (truoc-phai)  quay NGUOC chieu kim dong ho  (CCW)
    motor 2 (sau-trai)    quay NGUOC chieu kim dong ho  (CCW)
    motor 3 (truoc-trai)  quay CUNG chieu kim dong ho   (CW)
    motor 4 (sau-phai)    quay CUNG chieu kim dong ho   (CW)

Hai motor cheo nhau quay cung chieu. Neu thay 3 cai cung chieu va 1 cai khac
-> chac chan sai.
```

Cách nhìn chiều quay khi không có cánh: dán một mẩu băng dính nhỏ lên chóp motor rồi chạy ở 5–10%
và nhìn mẩu băng.

Đổi chiều quay: **đổi bất kỳ 2 trong 3 dây** giữa motor và ESC. Với mối nối tạm thì chỉ cần tháo
băng keo và đổi hai dây.

Ghi kết quả vào sổ tay ngay — ở Phase 18 khi hàn thật bạn sẽ cần biết motor nào phải đổi dây:

```text
Motor  Vi tri        Chieu do duoc   Can doi day?
M?     truoc-phai    CW / CCW        co / khong
...
```

**Kết quả mong đợi:** 4 motor đúng chiều theo bảng trên; bảng ghi chép đã hoàn chỉnh.

**Nếu lỗi:** nếu phải đổi dây, **ghi lại ngay** cặp dây nào đã đổi cho motor nào. Ở Phase 18 bạn
sẽ hàn lại từ đầu và cần lặp lại đúng cách đổi đó.

### 16.8 DShot300 và ESC telemetry

ESC OX32 trong stack là ESC 32-bit chạy **DShot** — tín hiệu số. Với DShot:

```text
KHONG co dai ga de hieu chinh  ->  KHONG co buoc "ESC calibration"
Lam theo quy trinh cu (keo ga het co roi cam pin) la VO NGHIA va NGUY HIEM.
```

Chỉ cần một tham số, đã nạp từ `01-base.param`:

```text
MOT_PWM_TYPE = 5     DShot300
```

**Vì sao bắt đầu bằng DShot300 chứ không phải 600:** DShot300 dung sai tín hiệu tốt hơn trên dây
signal dài và nhiễu của stack, và quad S500 bay tập không cần băng thông của 600. Nâng lên 6
(DShot600) sau khi đã bay ổn, nếu muốn.

Kiểm tra bằng Motor Test: cả 4 motor phải khởi động **mượt và gần như cùng lúc** ở 5–10%. Một motor
khởi động trễ rõ rệt là dấu hiệu xấu — ghi lại và theo dõi ở bài test desync (Phase 19).

**ESC telemetry** — hwdef của bo đã gán sẵn `SERIAL5 = ESC Telemetry, 19200 baud`, và
`01-base.param` đã đặt đúng. Kiểm tra:

```text
Mission Planner -> Flight Data -> tab Status
Chay Motor Test o 10%, tim cac dong:
    esc1_rpm ... esc4_rpm       co so khac 0 khi motor quay
    esc1_volt / esc1_curr       (co the co hoac khong, tuy firmware ESC)
```

**Chưa xác minh:** báo cáo nghiên cứu ghi rõ **không xác minh được** ESC OX32 4-in-1 hỗ trợ giao
thức telemetry nào (BLHeli_32 / AM32 / KISS). `SERVO_BLH_POLES,14` và `SERIAL5_BAUD,19` là giá trị
mặc định phổ biến, **không phải** giá trị đã xác nhận cho ESC này.

```text
Neu KHONG co RPM:
  - Khong phai loi nghiem trong. ESC telemetry la thu "co thi tot", dung de
    loc rung theo RPM (harmonic notch) o Phase 22.
  - Ghi vao so tay la "chua co RPM" roi DI TIEP. Dung ngoi sua o day.
  - Thu lai o Phase 22 sau khi tra duoc tai lieu cua ESC.
Neu CO RPM nhung so vo ly (vd 200.000 vong/phut):
  - SERVO_BLH_POLES sai. Motor AIR2216 thuong la 14 cuc; dem nam cham trong
    chuong motor de biet chac.
```

**Kết quả mong đợi:** 4 motor khởi động mượt và gần như cùng lúc; RPM hiện ra (hoặc đã ghi nhận là
chưa có và đi tiếp).

### 16.9 Thử arm — và hiểu vì sao bị chặn là **kết quả đúng**

Bài test cuối của phase: thử arm bo bay bằng RC, ở chế độ Stabilize, **không cánh**.

```text
1. Gat SwC ve vi tri 1  -> Stabilize
2. Can ga o vi tri THAP NHAT
3. Giu can ga xuong + day can lai (yaw) HET sang PHAI, giu 5 giay
4. Quan sat Mission Planner
```

**Kỳ vọng ở phase này: bo bay TỪ CHỐI arm, và báo một thông điệp pre-arm.** Ví dụ:

```text
PreArm: Accelerometers not calibrated
PreArm: Compass not calibrated
PreArm: 3D Accel calibration needed
```

Đó là **kết quả đúng và tốt**. Lý do: hiệu chỉnh gia tốc kế (6 vị trí) và hiệu chỉnh la bàn chỉ
làm được **sau khi bo đã nằm trên khung** — việc đó thuộc Phase 19. Bo bay từ chối arm nghĩa là hệ
thống pre-arm đang hoạt động đúng như thiết kế.

Việc cần làm ở đây là **đọc và ghi lại** chính xác thông điệp pre-arm nào xuất hiện. Danh sách đó
là checklist cho Phase 19: mỗi dòng sẽ biến mất sau khi bạn làm xong hạng mục tương ứng.

**AN TOÀN — luật cứng:** **không disable hàng loạt pre-arm check để "cho nó arm được"**
(`SAFETY.md` mục 3). Pre-arm báo lỗi nghĩa là có nguyên nhân thật (RC, GPS, la bàn, baro, pin,
EKF). Sửa nguyên nhân, không tắt cảnh báo. Cụ thể: **không** đụng vào `ARMING_CHECK` ở bất kỳ phase
nào của dự án này.

Nếu bo bay **arm được** (một số pre-arm có thể đã thoả ở bàn): để motor quay ở mức `MOT_SPIN_ARM`
trong vài giây, xác nhận cả 4 quay đều, rồi **disarm ngay** (giữ ga thấp + yaw hết sang trái). Đừng
đẩy ga. Bài arm đầy đủ thuộc Phase 19, sau khi đã hiệu chỉnh xong.

**Kết quả mong đợi:** danh sách thông điệp pre-arm đã được ghi vào sổ tay; hoặc arm được rồi disarm
an toàn.

**Nếu lỗi:**
- Không có thông điệp nào và cũng không arm → kiểm cần lái yaw có đẩy hết biên không (Radio
  Calibration ở Phase 15 phải pass trước).
- Thông điệp lạ không hiểu → chép nguyên văn vào sổ tay, tra ở `ardupilot.org` mục "Arming Checks".
  Đừng đoán.

### 16.10 Rút pin, cất pin, ghi sổ tay

```text
1. Disarm (neu da arm)
2. Rut XT60
3. Thao moi noi tam cua 4 motor, boc lai dau day bang bang keo
4. Cat pin vao tui chong chay
```

**AN TOÀN:** pin LiPo để lâu ở mức đầy sẽ phồng. Nếu không dùng trong vài ngày, sạc/xả về mức
storage 3,80–3,85 V/cell bằng chức năng `Storage` của B6AC V2. Và không sạc khi không có người trông.

Viết `docs/so-tay/16-nguon-motor-esc.md`:

- Kết quả đo continuity (4 phép đo).
- Điện áp đo được ở các đường 5 V, và có phải hàn thêm dây cho GPS không.
- Bảng hiệu chỉnh điện áp pin (16.4) — con số `BATT_VOLT_MULT` cuối cùng.
- Ghi chú: `BATT_AMP_PERVLT` **chưa hiệu chỉnh**, cách hiệu chỉnh ở Phase 20+.
- Bảng thứ tự motor A/B/C/D → vị trí thật, và `FRAME_TYPE` cuối cùng là X hay X (Betaflight).
- Bảng chiều quay 4 motor và motor nào phải đổi dây (dùng lại ở Phase 18).
- ESC telemetry có RPM hay không.
- Danh sách thông điệp pre-arm — **checklist cho Phase 19**.

Tick các dòng Phase 16 trong `plans/PROGRESS.md`.

---

## Cổng pass

- [ ] Tụ 1000 µF đã hàn đúng cực vào pad BAT của ESC; hai tầng đã chồng có ốc nylon + đệm silicone.
- [ ] **4 phép đo continuity đều không beep** — làm **trước** khi cắm pin.
- [ ] Cắm pin lần đầu: không khói, không mùi khét, không linh kiện nóng bất thường, đèn sáng bình thường.
- [ ] Đường 5V của stack trong 4,8–5,2 V; chân 4V5 của cổng GPS ≥ 4,7 V (hoặc đã hàn dây bù).
- [ ] HUD và đồng hồ vạn năng khớp nhau trong **0,05 V**; `BATT_VOLT_MULT` mới đã ghi vào `01-base.param` và **đã commit**.
- [ ] `BATT_ARM_VOLT` đã đặt 14.8 trên bo bay.
- [ ] Motor Test: nút A/B/C/D quay đúng 4 motor theo thứ tự chiều kim đồng hồ; `FRAME_TYPE` cuối cùng đã xác định (X hoặc X Betaflight) **bằng thực nghiệm, không phải bằng phỏng đoán**.
- [ ] Chiều quay 4 motor đúng bảng CCW/CCW/CW/CW; bảng "motor nào phải đổi dây" đã ghi.
- [ ] 4 motor khởi động mượt và gần như cùng lúc ở 5–10% với DShot300.
- [ ] ESC telemetry: có RPM, **hoặc** đã ghi nhận "chưa có" và quyết định thử lại ở Phase 22.
- [ ] Thông điệp pre-arm đã ghi nguyên văn vào sổ tay; **`ARMING_CHECK` không bị đụng tới**.
- [ ] Pin đã rút và cất trong túi chống cháy; mối nối tạm đã tháo và bọc lại.
- [ ] **Không có cánh quạt nào được gắn trong toàn bộ phase.**

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Chập BAT+/GND, cắm pin 4S → cháy stack, có thể cháy pin | 2 | 5 | 10 | 16.2 đo continuity là **luật cứng**, 4 phép đo; 16.3 dùng smoke stopper + kính bảo hộ + bình chữa cháy trong tầm với. |
| Lắp tụ ngược cực → nổ tụ ngay mặt | 2 | 4 | 8 | 16.1 kiểm chiều chân hai lần; đeo kính khi cắm pin lần đầu. |
| `FRAME_TYPE` sai (ArduPilot X vs Betaflight X) → **drone lật úp ngay giây đầu nhấc lên** | 3 | 5 | **15** | **Rủi ro cao.** 16.6 bắt buộc kiểm chứng bằng Motor Test, cấm đoán; Phase 19 kiểm lại lần nữa sau khi lắp lên khung; Phase 20 F1 chỉ hover 0,5–1 m để hạn chế thiệt hại nếu vẫn sai. |
| Mối nối tạm tuột/chập khi đẩy ga cao | 3 | 4 | **12** | 16.5 giới hạn cứng ≤ 10% ga; bọc riêng từng mối; test desync (ga cao) **dời sang Phase 19** sau khi hàn thật. |
| Tin số đo pin sai → ngưỡng failsafe vô nghĩa → rơi vì tưởng còn pin | 3 | 5 | **15** | **Rủi ro cao.** 16.4 hiệu chỉnh bằng đồng hồ trước, đặt ngưỡng sau; cổng pass yêu cầu khớp trong 0,05 V; `BATT_ARM_VOLT` chặn cất cánh với pin yếu. |
| Cám dỗ tắt pre-arm check để arm được trên bàn | 3 | 5 | **15** | **Rủi ro cao.** 16.9 giải thích bị chặn là **đúng**; `SAFETY.md` mục 3 là luật cứng; cổng pass kiểm `ARMING_CHECK` không bị đụng. |
| GPS thiếu điện (chân 4V5 < 4,7 V) → la bàn im mà GPS vẫn có fix, rất khó đoán | 3 | 3 | 9 | 16.3 đo chân 4V5 ngay sau khi có pin; cách xử lý (hàn dây bù) đã ghi sẵn. |
| ESC telemetry không chạy (OX32 *chưa xác minh* giao thức) | 3 | 1 | 3 | 16.8 ghi rõ đây là thứ "có thì tốt"; không dừng phase vì nó; thử lại ở Phase 22. |

Ba rủi ro điểm 15 đều được giảm thiểu bằng kiểm chứng thực nghiệm ngay trong phase (Motor Test,
đồng hồ vạn năng) và được kiểm lại một lần nữa ở Phase 19 trước khi gắn cánh.

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 16.1 Hàn XT60 + tụ, chồng tầng | 1,0 | Dùng kỹ năng đã tập ở Phase 13.6 |
| 16.2 Đo continuity | 0,3 | **Không được rút ngắn** |
| 16.3 Cắm pin lần đầu + đo 5V | 0,5 | Chuẩn bị an toàn chiếm phần lớn thời gian |
| 16.4 Hiệu chỉnh điện áp pin | 0,7 | Có thể phải lặp 2–3 vòng |
| 16.5 Nối motor tạm | 0,5 | |
| 16.6 Motor Test thứ tự A/B/C/D | 0,5 | |
| 16.7 Chiều quay | 0,4 | |
| 16.8 DShot300 + ESC telemetry | 0,3 | |
| 16.9 Thử arm + ghi pre-arm | 0,3 | |
| 16.10 Rút pin, cất, ghi sổ tay | 0,5 | |
| **Tổng** | **5,0** | Làm trong **một buổi liền**, đừng để pin đã cắm qua đêm. Nếu phải dừng giữa chừng: rút pin, cất túi. |

## Ghi chú cho sổ tay

- **Vì sao đo continuity trước khi cắm pin** — đồng hồ phát vài mA, pin 4S phát hàng trăm ampe.
- **Smoke stopper hoạt động thế nào** — bóng đèn nối tiếp làm cầu chì "mềm"; sáng chói giữ nguyên
  = chập.
- **Tụ điện làm gì trên đường nguồn** — hấp thụ xung điện áp lúc ESC đóng cắt; thiếu nó có thể
  giết FC.
- **Vì sao ESC DShot không cần calibration** — DShot là tín hiệu số, không có "dải ga" để dạy.
- **Hai kiểu đánh số motor** (ArduPilot X vs Betaflight X) và vì sao đoán sai là lật úp.
- **Đổi chiều quay motor brushless** bằng cách đổi 2 trong 3 dây — và vì sao đổi dây nào cũng được.
- **`BATT_VOLT_MULT` là gì** — hệ số quy đổi từ điện áp mà chip đo được sang điện áp pin thật;
  mỗi bo một khác nên phải đo.
- **Pre-arm check là bạn, không phải kẻ cản đường** — mỗi dòng báo lỗi là một hạng mục chưa xong.
- **Desync là gì** và vì sao bài test đó phải đợi tới khi hàn thật (Phase 19).
