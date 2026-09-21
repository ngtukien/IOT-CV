# Phase 15: Trên bàn — điều khiển RC, GPS và la bàn

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 14 | ~4,2 giờ | **Có** — stack, FS-i6X + iA6B, GPS M10, cáp USB. **KHÔNG cắm pin trong phase này** |

## Mục tiêu

Xong phase này, bo bay nghe được tay điều khiển và biết mình đang ở đâu, đang quay hướng nào.
Cụ thể: tay phát đã bind với bộ thu, tín hiệu iBUS vào đúng chân R6, cần ga và 4 công tắc đã được
hiệu chỉnh và gán chức năng, RC failsafe đã test thật (tắt tay phát và thấy bo bay nhận ra), GPS
bắt được vệ tinh ngoài trời, và la bàn được nhận diện.

Hai ảnh chụp tham số (`02-radio.param`, `03-gps.param`) được lưu và commit.

```text
KHONG CANH QUAT.  KHONG CAM PIN.
Toan bo phase nay chay bang nguon USB.
```

Lý do không cắm pin: đường nguồn chưa được đo continuity (việc đó là Phase 16). Cắm pin trước
khi đo là vi phạm `SAFETY.md` mục 7.

## Đầu vào cần có

- Phase 14 đã pass: Mission Planner nhận bo, `01-base.param` đã nạp.
- `docs/so-tay/13-dau-day.md` — mục R6 (iBUS), mục GPS (bắt chéo T4/R4), mục SDA/SCL.
- `docs/archive/README.md` GIAI ĐOẠN 34–37 — sơ đồ chân GPS chi tiết, ba lỗi kinh điển.
- `docs/huong-dan-bat-dau-tu-con-so-0.md` PHẦN 7 — quy trình bind FlySky từng bước.
- `plans/reports/260921-research-sitl-firmware-toolchain.md` §4.2 (`RC_PROTOCOLS` bitmask), §4.4 (compass ngoài).
- Kìm tuốt dây, mỏ hàn, gen co nhiệt (phải cắt và bấm lại dây GPS).
- Một chỗ **ngoài trời hoặc sát cửa sổ thoáng** để thử GPS.

## File và thư mục sở hữu

```text
firmware/ardupilot/params/02-radio.param     snapshot sau radio calib + map switch
firmware/ardupilot/params/03-gps.param       snapshot sau khi GPS fix + compass nhận diện
docs/so-tay/15-rc-gps-compass.md
plans/PROGRESS.md                            chỉ tick các dòng của Phase 15
```

Không sửa `01-base.param` (Phase 11 sở hữu).

---

## Việc theo thứ tự

### 15.1 Bind tay phát FS-i6X với bộ thu iA6B

Bind là ghép đôi tay phát với bộ thu, giống ghép Bluetooth. Làm một lần, nhớ mãi. Chưa cần bo bay
— chỉ cần nguồn 5 V cho bộ thu.

```text
1. Cam "bind plug" (jumper nhua nho di kem) vao cong B/VCC cua iA6B
   -- cong ngoai cung, thuong ghi chu B/VCC
2. Cap nguon 5V cho iA6B (lay tu pad 5V cua bo bay dang cam USB, hoac nguon 5V bat ky)
   -> den LED tren iA6B NHAP NHAY NHANH
3. Tren tay FS-i6X: GIU nut "BIND KEY" (nut nho mat sau)
4. Vua giu, vua BAT cong tac nguon tay phat
5. Man hinh tay hien "RXBinding..."
6. Den iA6B chuyen tu nhap nhay sang SANG LIEN  ->  DA BIND
7. Tat tay phat, tat nguon iA6B, RUT bind plug ra
8. Bat lai ca hai -> den iA6B phai sang lien NGAY
```

Đặt tay phát về đúng chế độ xuất tín hiệu:

```text
Tren FS-i6X:  System Setup -> RX Setup -> Output mode -> chon  i-BUS
```

**Bắt buộc là i-BUS, không phải lựa chọn ưu tiên mà là lựa chọn duy nhất.** Tài liệu ArduPilot cho
bo này ghi nguyên văn *"PPM is not supported"* — cắm cổng PPM của iA6B vào sẽ không bao giờ lên.
SBUS thì bo có hỗ trợ nhưng phải hàn nối một jumper pad, mà iA6B đã sẵn i-BUS nên không có lý do
gì đụng vào.

**AN TOÀN:** cấp nguồn 5 V cho iA6B từ pad 5V của bo bay đang cắm USB là được, nhưng **kiểm tra
cực trước khi cắm** bằng đồng hồ vạn năng. Cắm ngược 5 V vào bộ thu là hỏng bộ thu.

**Kết quả mong đợi:** đèn iA6B sáng liên (không nhấp nháy) khi bật cả hai, và tắt tay phát thì đèn
nhấp nháy trở lại.

**Nếu lỗi:**
- Đèn không nhấp nháy khi cấp nguồn → chưa cắm bind plug, hoặc cắm nhầm cổng (phải là B/VCC, cổng
  ngoài cùng).
- Bind xong nhưng bật lại vẫn nhấp nháy → quên rút bind plug.
- Tay phát không hiện `RXBinding...` → giữ nút BIND KEY **trước** khi bật nguồn, không phải sau.

### 15.2 Đấu iBUS vào chân R6 và kiểm tra bo bay nghe được

Dùng sợi cáp receiver SH1.0 4 chân có sẵn trong hộp Deluxe.

```text
iA6B cong "i-BUS"  (KHONG phai cong PPM, KHONG phai servo 1..6)
       |
       +-- signal --->  R6   (chan UART6_RX cua FC)
       +-- 5V     --->  5V
       +-- GND    --->  GND

KHONG noi signal vao T6.
```

Cắm USB vào bo bay, mở Mission Planner:

```text
Setup -> Mandatory Hardware -> Radio Calibration
Bat tay phat  ->  cac thanh xanh phai NHUC NHICH khi ban day can
```

Kiểm tra tham số (đã nạp từ `01-base.param`, đọc lại cho chắc):

```text
SERIAL6_PROTOCOL = 23    RCIN
RC_PROTOCOLS     = 4     bitmask bit2 = IBUS
```

**Kết quả mong đợi:** 6 thanh trong Radio Calibration phản ứng khi đẩy cần và gạt công tắc.

**Nếu lỗi:**
- Không thanh nào nhúc nhích → kiểm theo thứ tự: (1) đèn iA6B có sáng liên không, (2) signal có
  cắm vào **R6** không (không phải T6), (3) tay phát đã ở Output mode `i-BUS` chưa,
  (4) `RC_PROTOCOLS` có bằng 4 không.
- Thanh nhúc nhích nhưng loạn xạ → sai giao thức; thử tạm `RC_PROTOCOLS,1` (All) để xem bo bay tự
  dò ra gì, rồi đặt lại về 4.
- `RSSI_TYPE,3` là tuỳ chọn nếu muốn đọc cường độ sóng từ iBUS — làm sau, không bắt buộc bây giờ.

### 15.3 Radio calibration

Bo bay cần biết cần ga của **tay bạn** chạy từ giá trị nào tới giá trị nào. Mỗi tay phát một khác,
nên đây là việc **bắt buộc chạy wizard**, không nạp bằng file param được (nạp file là dán số đo
của tay phát người khác lên tay phát của bạn).

```text
Mission Planner -> Setup -> Mandatory Hardware -> Radio Calibration
  -> bam "Calibrate Radio"
  -> day HET BIEN moi can: Throttle, Yaw, Pitch, Roll
  -> gat HET BIEN moi cong tac: SwA, SwB, SwC, SwD
  -> bam "Click when Done"
```

Kiểm tra sau khi xong:

```text
Can o giua      -> gia tri ~1500
Day het ve mot phia -> ~1000
Day het ve phia kia -> ~2000
Khong can nao bi "ket" o mot dau
```

**AN TOÀN:** không có cánh quạt, nhưng vẫn giữ thói quen **cần ga ở vị trí thấp nhất** mỗi khi
không chủ động đẩy. Thói quen này sẽ cứu bạn ở Phase 20.

**Kết quả mong đợi:** 4 cần và các công tắc đều có dải đầy đủ; Mission Planner không báo lỗi.

**Nếu lỗi:**
- Một cần chỉ chạy tới 1700 thay vì 2000 → chưa đẩy hết biên trong lúc calibrate; làm lại.
- Cần ga chạy ngược (đẩy lên thì giá trị giảm) → đảo chiều kênh trên tay phát
  (`Functions Setup → Reverse`), **không** sửa bằng tham số trên bo bay.

### 15.4 Gán chức năng cho 4 công tắc — quyết định đã chốt

FS-i6X có 4 công tắc: SwA (2 vị trí), SwB (3 vị trí), SwC (3 vị trí), SwD (2 vị trí).

**Quyết định đã chốt cho giai đoạn bay tập:**

| Kênh | Công tắc | Chức năng | Tham số |
|---|---|---|---|
| CH5 | **SwC** (3 vị trí) | Chọn chế độ bay | `FLTMODE_CH,5` |
| CH6 | **SwD** (2 vị trí) | **RTL — công tắc cứu hộ** | `RC6_OPTION` = RTL |
| CH7 | **SwA** (2 vị trí) | **WEB CONTROL ENABLE** (backend đọc, ArduPilot bỏ qua) | `RC7_OPTION,0` |
| CH8 | **SwB** (3 vị trí) | Auto Mode — **chỉ gán từ Phase 21**, trước đó để `0` | `RC8_OPTION,0` cho tới Phase 21 |

Ba chế độ trên SwC. Một công tắc 3 vị trí cho ra PWM khoảng 1000 / 1500 / 2000, rơi vào **khe 1,
khe 4 và khe 6** của ArduPilot:

```text
Khe   Dai PWM        Dat gia tri   Che do
 1    <= 1230        FLTMODE1 = 0  Stabilize
 4    1491 - 1620    FLTMODE4 = 2  AltHold
 6    >= 1750        FLTMODE6 = 5  Loiter
```

**Vì sao chốt như vậy** (và vì sao **không** để Auto trên SwC như bản nháp cũ đề xuất):

```text
1. Ba che do tren SwC di THEO DO KHO TANG DAN, dung thu tu bai bay o Phase 20:
   Stabilize (F1) -> AltHold (F2) -> Loiter (F3).
   Gat nham mot nac chi lam drone de bay hon, khong bao gio kho hon.

2. Auto KHONG nam tren cong tac che do chinh.
   Auto bay theo mission da nap. Gat nham vao Auto giua chuyen bay tap = drone
   tu dong bay di theo mot lo trinh ban khong luong truoc. Auto chi duoc gan
   tu Phase 21, khi ban da quen tay va da co mission duoc kiem chung.

3. RTL nam tren cong tac RIENG (SwD), khong chia khe voi che do khac.
   Luc hoang loan ban chi can gat MOT cong tac, khong phai tim dung nac giua
   cua mot cong tac 3 vi tri.

4. KHONG gan "Motor Emergency Stop" (RCx_OPTION 31) cho bat ky cong tac nao.
   Gat nham la motor tat ngay lap tuc va drone ROI THANG XUONG.
```

Cách gán trong Mission Planner:

```text
CONFIG -> Full Parameter List:
    FLTMODE_CH   = 5
    FLTMODE1     = 0      Stabilize
    FLTMODE4     = 2      AltHold
    FLTMODE6     = 5      Loiter
    RC7_OPTION   = 0      (de ArduPilot BO QUA kenh nay - backend se doc chan_raw)
    RC8_OPTION   = 0      (se doi thanh Auto o Phase 21)

Gan RTL cho CH6: dung giao dien
    CONFIG -> Extended Tuning  hoac  Full Parameter List -> RC6_OPTION
    CHON THEO TEN "RTL" trong danh sach xo xuong, DUNG GO SO.
    (So thu tu cac option co the khac nhau giua cac ban ArduPilot.
     Chon theo ten thi khong bao gio sai.)
```

**AN TOÀN:** `RC7_OPTION` **phải** bằng 0. Kênh 7 là công tắc "cho phép web điều khiển" do backend
đọc qua bản tin `RC_CHANNELS`, không phải chức năng của ArduPilot. Nếu vô tình gán cho nó một
chức năng ArduPilot, gạt công tắc sẽ làm bo bay đổi hành vi bay ngoài ý muốn.

Kiểm tra lại ngay trên bàn:

```text
Mission Planner -> Flight Data -> goc duoi trai hien ten che do hien tai
Gat SwC qua 3 vi tri  ->  ten che do phai doi:  Stabilize -> AltHold -> Loiter
Gat SwD               ->  ten che do doi thanh RTL, gat ve thi tro lai che do cu
```

**Kết quả mong đợi:** tên chế độ đổi đúng theo từng vị trí công tắc; không có vị trí nào cho ra
chế độ lạ.

**Nếu lỗi:**
- Gạt SwC mà tên chế độ không đổi → CH5 chưa được gán cho SwC trên tay phát. Vào
  `Functions Setup → Aux. channels` trên FS-i6X, gán CH5 = SwC.
- Vị trí giữa của SwC cho ra Stabilize (khe 1) thay vì AltHold (khe 4) → PWM vị trí giữa không nằm
  trong 1491–1620. Xem giá trị thật ở tab `Radio Calibration` rồi đặt `FLTMODE` vào đúng khe tương
  ứng, **không** cố chỉnh tay phát cho khớp con số.

### 15.5 Test RC failsafe — tắt tay phát và xem bo bay có biết không

Đây là đường dây cứu sinh của cả dự án. Wi-Fi sẽ rớt, laptop sẽ treo, nhưng RC failsafe phải luôn
hoạt động.

Có **hai lớp** phải cấu hình, và người mới thường chỉ làm một lớp:

```text
LOP 1 - phia TAY PHAT / BO THU: day phai xuat gia tri ga THAP khi mat song
  FS-i6X:  System Setup -> RX Setup -> Failsafe
           -> chon Channel 3 (Throttle) -> bat Failsafe -> dat ve muc THAP NHAT
  Khong lam buoc nay thi bo thu se GIU NGUYEN gia tri cuoi cung khi mat song,
  va bo bay khong bao gio biet la da mat song.

LOP 2 - phia BO BAY: nguong va hanh dong
  FS_THR_ENABLE = 1     (da nap tu 01-base.param)
  FS_THR_VALUE          de mac dinh; chi doi neu buoc test duoi khong kich hoat
```

Bài test (USB, **không cánh, không pin**):

```text
1. Bo bay cam USB, Mission Planner dang CONNECT, tay phat dang BAT
2. Xem tab Flight Data - khong co canh bao radio
3. TAT tay phat
4. Trong vong vai giay, Mission Planner phai bao:
       "Radio Failsafe"   (bang chu do tren HUD, va mot dong trong tab Messages)
5. BAT lai tay phat  ->  canh bao phai tu bien mat
```

**AN TOÀN:** bài test này là **bắt buộc**, không phải tuỳ chọn (`SAFETY.md` mục 2 liệt kê nó trong
danh sách phải tháo cánh — ở đây còn chưa có cánh nào để tháo, nhưng luật vẫn là luật). Nếu bo bay
**không** nhận ra mất sóng, drone sẽ bay tiếp theo lệnh cuối cùng cho tới khi hết pin và rơi.

**Kết quả mong đợi:** dòng `Radio Failsafe` xuất hiện khi tắt tay phát và biến mất khi bật lại.

**Nếu lỗi:**
- Không có cảnh báo nào → gần như chắc chắn chưa làm **Lớp 1**. Bộ thu đang giữ nguyên giá trị
  cuối. Quay lại menu Failsafe trên FS-i6X.
- Cảnh báo xuất hiện nhưng không biến mất khi bật lại → đợi thêm vài giây; nếu vẫn không, kiểm tra
  đèn iA6B đã sáng liên chưa.
- Cảnh báo xuất hiện **ngẫu nhiên** dù tay phát vẫn bật → tín hiệu yếu hoặc dây signal tiếp xúc
  kém. Đừng bỏ qua — trên không đây là RTL giữa chừng.

### 15.6 Lưu `02-radio.param`

```text
Mission Planner -> CONFIG -> Full Parameter List -> "Save to file"
Luu vao: firmware\ardupilot\params\02-radio.param
```

```powershell
git add firmware/ardupilot/params/02-radio.param
git commit -m "param: 02-radio sau radio calibration va map 4 cong tac"
```

**Kết quả mong đợi:** file có các giá trị `RC1_MIN/MAX/TRIM`… khác giá trị mặc định (tức
calibration thật sự đã ghi vào bo).

### 15.7 Đấu GPS M10 và la bàn I2C

Đây là **món khó đấu nhất của cả bản dựng**, vì hai đầu dùng hai họ giắc khác nhau và thứ tự chân
ngược nhau. Phải cắt và bấm lại dây — không có cách tránh.

Bên trong module GPS luôn là **hai thiết bị**:

| Thiết bị | Nhiệm vụ | Đường truyền | Dây |
|---|---|---|---|
| Chip u-blox M10 | drone đang ở toạ độ nào | UART | TX, RX |
| La bàn IST8310 | mũi drone quay hướng nào | I2C | SDA, SCL |
| Nguồn chung | nuôi cả hai | — | VCC, GND |

Cộng lại đúng **6 dây**. Cáp 10 chân của bản V1 mang 6 tín hiệu đó cộng 4 chân thừa (safety
switch, LED, 3V3, buzzer) — cắt bỏ 4 chân đó không mất gì, vì F405 V5 không có cổng cho chúng.

Nối **theo TÊN TÍN HIỆU, không theo màu dây**:

```text
GPS VCC   -> FC 4V5
GPS GND   -> FC GND
GPS TX    -> FC R4      <-- CHEO
GPS RX    -> FC T4      <-- CHEO
GPS SCL   -> FC SCL
GPS SDA   -> FC SDA
4 chan NC -> CAT BO
```

**AN TOÀN:** Holybro yêu cầu 4,7–5,2 V, mà chân cổng GPS của bo ghi là "4V5" — trên giấy là hơi
thấp. Sau khi có điện (Phase 16, khi đã cắm pin), **đo chân đó bằng đồng hồ**:

```text
>= 4,7V  -> dung binh thuong
<  4,7V  -> han rieng day do sang pad 5V, giu nguyen 5 day con lai
```

Ở phase này (chỉ có USB) điện áp có thể thấp hơn bình thường — đó là lý do phép đo thật nằm ở
Phase 16, không phải ở đây.

**Kết quả mong đợi:** 6 dây đã bấm đúng, đo continuity từng dây đầu này sang đầu kia đều thông,
và **không** có dây nào thông sang dây bên cạnh (đo chéo để loại trừ chập).

**Nếu lỗi — ba lỗi kinh điển:**

```text
1. Noi TX->TX (quen bat cheo)
   Trieu chung: GPS VAN SANG DEN binh thuong, Mission Planner bao "No GPS".
   Khong hong gi ca, chi la khong bao gio len. Day la cho kiem tra DAU TIEN.
2. Chap hai day canh nhau khi bam giac
   Trieu chung: bo bay reset khi cam GPS. Do cheo bang dong ho truoc khi cap dien.
3. Cat nham day tin hieu thay vi day NC
   Dem lai thu tu chan tren giac TRUOC khi cat. Cat roi khong noi lai duoc.
```

### 15.8 Kiểm tra GPS bắt được vệ tinh và la bàn được nhận diện

Cắm USB, mang cả bo bay ra **ngoài trời** hoặc đặt sát cửa sổ thoáng nhìn thấy trời.

```text
Mission Planner -> Flight Data -> tab Status (hoac thanh trang thai tren HUD)
```

Chờ **1–2 phút** cho lần bắt đầu tiên (lần đầu tiên bao giờ cũng lâu nhất — module phải tải lịch
vệ tinh từ đầu).

```text
PASS khi:
    GPS: 3D Fix
    HDOP < 1.5
    So ve tinh >= 9
```

**Trong nhà không bao giờ có fix — đừng tưởng là hỏng.** Đây là hiểu lầm phổ biến nhất của người
mới với GPS.

Kiểm tra la bàn được nhận diện (chưa hiệu chỉnh, chỉ xác nhận bo bay **thấy** nó):

```text
CONFIG -> Full Parameter List -> go "COMPASS_DEV_ID" vao o Search
    COMPASS_DEV_ID khac 0   ->  bo bay da nhin thay mot la ban tren I2C
    COMPASS_DEV_ID = 0      ->  chua thay: kiem tra day SDA/SCL va nguon GPS

Hoac: Setup -> Mandatory Hardware -> Compass
      -> phai liet ke it nhat mot compass (thuong ghi IST8310)
```

**KHÔNG hiệu chỉnh la bàn ở phase này.** Hiệu chỉnh la bàn phải làm **sau khi đã lắp lên khung**,
ngoài trời, xa kim loại — việc đó thuộc Phase 19. Hiệu chỉnh bây giờ (bo bay rời, trên bàn, cạnh
laptop) sẽ cho ra số đo vô nghĩa mà bạn lại tưởng là đã xong.

Tương tự, **không hiệu chỉnh gia tốc kế** ở phase này. Phase 19 làm đủ 6 vị trí khi bo đã nằm trên
khung. Ở đây chỉ cần kiểm nhanh: đặt bo bay phẳng trên bàn, HUD phải hiện gần nằm ngang; nghiêng
bo sang trái thì đường chân trời trên HUD nghiêng theo đúng chiều.

`COMPASS_ORIENT` cũng để nguyên — ArduPilot sẽ tự suy ra trong quá trình hiệu chỉnh ở Phase 19.
Chỉ chỉnh tay nếu lúc đó nó báo lỗi orientation.

**Kết quả mong đợi:** `3D Fix`, `HDOP < 1.5`, ≥ 9 vệ tinh; `COMPASS_DEV_ID` khác 0; HUD phản ứng
đúng chiều khi nghiêng bo.

**Nếu lỗi:**
- `No GPS` nhưng đèn GPS vẫn sáng → **kiểm tra bắt chéo TX/RX trước tiên** (lỗi kinh điển số 1).
- `No Fix` sau 5 phút ngoài trời quang → kiểm `SERIAL4_PROTOCOL,5` và `GPS1_TYPE,2`; thử
  `GPS1_TYPE,1` (AUTO) để xem bo bay tự dò ra gì.
- `COMPASS_DEV_ID = 0` → dây SDA/SCL chưa thông, hoặc GPS chưa đủ điện (I2C chết trước UART khi
  thiếu điện — GPS vẫn báo fix mà la bàn im là dấu hiệu này).
- HUD nghiêng **ngược chiều** khi nghiêng bo → bo đang bị đặt lộn; chưa cần xử lý ở đây, ghi lại
  và xử lý bằng `AHRS_ORIENTATION` ở Phase 18 khi gắn lên khung.

### 15.9 Lưu `03-gps.param` và ghi sổ tay

```text
Mission Planner -> CONFIG -> Full Parameter List -> "Save to file"
Luu vao: firmware\ardupilot\params\03-gps.param
```

```powershell
git add firmware/ardupilot/params/03-gps.param
git commit -m "param: 03-gps sau khi GPS co 3D fix va compass duoc nhan dien"
```

Viết `docs/so-tay/15-rc-gps-compass.md`:

- Bảng gán 4 công tắc (chép từ 15.4) — **tờ này sẽ dán lên tay phát**.
- Số vệ tinh và HDOP đo được ở lần fix đầu tiên, và mất bao lâu.
- `COMPASS_DEV_ID` đọc được là bao nhiêu (để sau này biết la bàn có bị đổi không).
- Ghi chú: la bàn và gia tốc kế **chưa** hiệu chỉnh, sẽ làm ở Phase 19 khi đã lên khung.
- Ba lỗi kinh điển của GPS (chép từ 15.7) — để lần sau đọc là nhớ.

Tick các dòng Phase 15 trong `plans/PROGRESS.md`.

---

## Cổng pass

- [ ] Đèn iA6B sáng liên khi bật cả hai; tay phát đã ở Output mode `i-BUS`.
- [ ] Radio Calibration: 4 cần có dải ~1000–2000, cần ở giữa ~1500; không cần nào bị kẹt một đầu.
- [ ] Gạt SwC qua 3 vị trí → tên chế độ đổi đúng **Stabilize → AltHold → Loiter**.
- [ ] Gạt SwD → chế độ đổi thành **RTL**; gạt về thì trở lại chế độ cũ.
- [ ] `RC7_OPTION = 0` và `RC8_OPTION = 0` (chưa gán Auto).
- [ ] **RC failsafe đã test thật**: tắt tay phát → Mission Planner báo `Radio Failsafe`; bật lại → hết báo. Đã cấu hình **cả hai lớp** (failsafe trên FS-i6X + `FS_THR_ENABLE` trên bo bay).
- [ ] GPS ngoài trời: `3D Fix`, `HDOP < 1.5`, số vệ tinh ≥ 9.
- [ ] `COMPASS_DEV_ID` khác 0 (la bàn được nhận diện).
- [ ] HUD phản ứng đúng chiều khi nghiêng bo bay.
- [ ] `02-radio.param` và `03-gps.param` đã lưu **và đã commit**.
- [ ] **Chưa cắm pin lần nào.** **Chưa hiệu chỉnh la bàn và gia tốc kế** (để Phase 19).

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Chỉ cấu hình failsafe ở bo bay mà quên ở tay phát → bộ thu giữ nguyên giá trị cuối khi mất sóng → drone bay tiếp tới hết pin | 4 | 5 | **20** | **Rủi ro cao nhất của phase.** 15.5 tách rõ hai lớp; bài test tắt tay phát là cổng pass bắt buộc; nếu không thấy `Radio Failsafe` thì **không được sang Phase 16**. |
| Đấu GPS TX→TX (quên bắt chéo) | 4 | 2 | 8 | 15.7 ghi thành "chỗ kiểm tra ĐẦU TIÊN"; triệu chứng (đèn sáng nhưng báo No GPS) đã ghi sẵn. |
| Chập hai dây khi bấm giắc GPS → bo bay reset khi cắm | 3 | 4 | **12** | 15.7 bắt buộc đo chéo bằng đồng hồ **trước khi** cấp điện. |
| Gán nhầm Auto hoặc Motor Emergency Stop cho công tắc → gạt nhầm khi bay | 2 | 5 | 10 | 15.4 chốt Auto **không** nằm trên công tắc chính, và cấm gán Emergency Stop; RC8 để 0 tới Phase 21. |
| Gán số `RCx_OPTION` bằng tay nhưng số option khác giữa các bản ArduPilot | 3 | 3 | 9 | 15.4 bắt buộc chọn **theo tên** trong danh sách xổ xuống, không gõ số. |
| Hiệu chỉnh la bàn trên bàn (cạnh laptop) rồi tưởng là xong | 3 | 4 | **12** | 15.8 ghi rõ **không** hiệu chỉnh ở phase này; cổng pass kiểm "chưa hiệu chỉnh". Phase 19 mới làm, ngoài trời, trên khung. |
| Không có chỗ ngoài trời để thử GPS → tưởng GPS hỏng | 3 | 2 | 6 | 15.8 ghi rõ trong nhà không bao giờ có fix; sát cửa sổ thoáng là đủ để thử. |

**Rủi ro điểm 20 (failsafe một lớp)** là rủi ro cao nhất. Bắt buộc giảm thiểu trước khi sang
Phase 16: cấu hình đủ hai lớp và chạy bài test ở 15.5 cho tới khi thấy `Radio Failsafe`.

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 15.1 Bind FS-i6X ↔ iA6B | 0,3 | |
| 15.2 Đấu iBUS vào R6 | 0,3 | |
| 15.3 Radio calibration | 0,3 | |
| 15.4 Gán 4 công tắc | 0,5 | Gồm cả gán kênh trên tay phát |
| 15.5 Test RC failsafe (2 lớp) | 0,5 | **Không được rút ngắn** |
| 15.6 Lưu `02-radio.param` | 0,2 | |
| 15.7 Đấu GPS + la bàn | 1,2 | Phải cắt, bấm lại dây và đo chéo. Đây là việc lâu nhất |
| 15.8 Kiểm GPS fix + la bàn | 0,5 | Cần ra ngoài trời; chờ 1–2 phút cho lần fix đầu |
| 15.9 Lưu `03-gps.param` + sổ tay | 0,4 | |
| **Tổng** | **4,2** | Đường găng: 15.7 (đấu GPS) và 15.8 (phụ thuộc thời tiết — trời mưa thì hoãn) |

## Ghi chú cho sổ tay

- **Bind là gì** và vì sao chỉ làm một lần.
- **i-BUS, PPM, SBUS khác nhau ra sao**, và vì sao bo này bắt buộc i-BUS.
- **Vì sao radio calibration không nạp được bằng file param.**
- **Khe chế độ bay (flight mode slot)** — một công tắc 3 vị trí chỉ chạm vào 3 trong 6 khe, và
  cách đọc giá trị PWM để biết mình đang ở khe nào.
- **Failsafe có hai lớp** — bộ thu phải xuất giá trị thấp, bo bay mới nhận ra. Đây là hiểu lầm
  chết người phổ biến nhất.
- **HDOP là gì** — chỉ số chất lượng hình học của vệ tinh; số càng nhỏ càng tốt, dưới 1,5 là dùng được.
- **Vì sao trong nhà không có GPS fix.**
- **La bàn "được nhận diện" khác "đã hiệu chỉnh"** — nhận diện là bo bay thấy thiết bị; hiệu chỉnh
  là dạy cho nó biết từ trường của chính con drone này. Hai việc khác nhau, làm ở hai phase khác nhau.
