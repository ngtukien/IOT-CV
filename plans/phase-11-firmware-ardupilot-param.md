# Phase 11: Firmware ArduPilot và file parameter

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 01 (repo đã có `firmware/`) | ~4,5 giờ | Không — làm hết trên PC |

## Mục tiêu

Xong phase này, bản firmware custom đã nằm trên đĩa ở dạng giải nén và bạn đã **tự mắt xác nhận**
nó có đủ ba nhóm tính năng `PROXIMITY`, `TFMINIPLUS`, `AVOID` — nếu thiếu thì toàn bộ phần tránh
vật cản của dự án sẽ chết, và phát hiện bây giờ tốn 30 phút, phát hiện lúc đang cầm bo bay tốn
cả buổi.

Đồng thời hai file parameter chính (`01-base.param`, `02-avoid-tfmini.param`) được viết xong kèm
chú thích, và quy ước đánh số `00..07` được ghi thành văn bản để các phase sau cứ thế mà theo.

Phase này **không** đụng vào phần cứng và không cần chờ hàng về.

## Đầu vào cần có

- `plans/reports/260921-research-sitl-firmware-toolchain.md` — §3 (nạp DFU), §4 (parameter, enum đã xác minh từ mã nguồn), **§4.6 (bản nháp `01-base.param`)**.
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` §3 — bản đồ cổng serial đã chốt.
- File gốc trong repo: `copter-speedybeef4v5-d450a747.tar.gz`.
- File do Phase 01 chuyển vào `firmware/`: `firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml`, và nội dung cũ của `params/obstacle-avoidance-tfminiplus-serial3.param` + `params/README.md`.
- Git đã cài (Phase 00).

> **Đường dẫn.** Phase 01 đã chuyển `params/` vào `firmware/ardupilot/`. Phase này dùng đường dẫn
> **mới** (`firmware/ardupilot/params/...`). Nếu Phase 01 chưa chạy thì làm Phase 01 trước — đừng
> tạo song song hai chỗ rồi sau phải hợp nhất.

## File và thư mục sở hữu

```text
firmware/ardupilot/build-d450a747/              (giải nén; file nhị phân bị .gitignore)
firmware/ardupilot/build-d450a747/NOTES.md      (CÓ commit — đối chiếu feature + cách rebuild)
firmware/ardupilot/custombuild/README.md
firmware/ardupilot/params/README.md
firmware/ardupilot/params/01-base.param
firmware/ardupilot/params/02-avoid-tfmini.param
docs/so-tay/11-firmware-va-param.md
.gitignore                                      (CHỈ thêm 5 dòng, xem 11.1)
```

Không sửa file nào ngoài danh sách. Đặc biệt không sửa `SAFETY.md`, không sửa
`firmware/ardupilot/custombuild/*.yaml` (file đó là đầu vào, giữ nguyên byte).

---

## Việc theo thứ tự

### 11.1 Giải nén custom build và chặn file nhị phân khỏi git

Trước khi giải nén phải chặn git đã, vì file `.hex` nặng 2,5 MB và file `arducopter` còn nặng hơn.
Lỡ commit rồi thì xoá khỏi lịch sử git rất phiền.

Thêm vào `.gitignore`:

```gitignore
firmware/ardupilot/build-*/*.hex
firmware/ardupilot/build-*/*.apj
firmware/ardupilot/build-*/*.bin
firmware/ardupilot/build-*/arducopter
firmware/dronebridge/bin/
```

Rồi giải nén (PowerShell, tại `D:\Coding\IOT-CV`):

```powershell
New-Item -ItemType Directory -Force -Path firmware\ardupilot
tar -xzf .\copter-speedybeef4v5-d450a747.tar.gz -C .\firmware\ardupilot\
Rename-Item .\firmware\ardupilot\copter-speedybeef4v5-d450a747 build-d450a747
Get-ChildItem .\firmware\ardupilot\build-d450a747 | Format-Table Name, Length
git status --short
```

**Kết quả mong đợi:** thư mục có đủ 7 file —

```text
arducopter_with_bl.hex   ~2,4-2,5 MB   <-- file dung cho lan nap DFU dau tien (Phase 14)
arducopter.apj                         <-- dung cho cac lan update SAU nay
arducopter.bin
arducopter
build.log
extra_hwdef.dat
custombuild.yaml
```

`git status --short` **không** liệt kê file `.hex/.apj/.bin/arducopter`.

**Nếu lỗi:**
- `tar: Error opening archive` → file tar.gz hỏng. Dựng lại theo 11.3.
- `Rename-Item` báo trùng tên → đã giải nén lần trước; xoá thư mục cũ rồi làm lại.
- `git status` vẫn hiện file `.hex` → `.gitignore` chưa lưu, hoặc file đã bị `git add` từ trước.
  Gỡ ra bằng `git rm --cached <file>`.

### 11.2 Xác nhận firmware có đúng feature — bước không được bỏ

Bản firmware này được dựng riêng: ArduPilot có hơn 400 tính năng chọn được, bo F405 chỉ có 1 MB
bộ nhớ nên bản stock đã bị cắt bớt, và bản của bạn bật thêm 6 tính năng mà bản stock không có.
Ba trong sáu tính năng đó là xương sống của phần tránh vật cản.

```powershell
Select-String -Path .\firmware\ardupilot\build-d450a747\build.log `
  -Pattern "PROXIMITY|TFMINI|AVOID|OAPATHPLANNER"
Get-Content .\firmware\ardupilot\build-d450a747\custombuild.yaml
Get-Content .\firmware\ardupilot\build-d450a747\extra_hwdef.dat
```

Đối chiếu `custombuild.yaml` trong thư mục build với
`firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml` — hai file phải khớp ở
mục `selected_features` (file trong repo có thêm phần chú thích ở đầu, đó là bình thường):

```powershell
$a = (Get-Content .\firmware\ardupilot\build-d450a747\custombuild.yaml) -match '^\s+- '
$b = (Get-Content .\firmware\ardupilot\custombuild\speedybeef4v5-copter471-tfminiplus.yaml) -match '^\s+- '
Compare-Object $a $b
```

**Kết quả mong đợi:** `Select-String` in ra ít nhất một dòng cho **mỗi** từ khoá;
`Compare-Object` không in ra gì (hai danh sách feature giống hệt nhau); trong `selected_features`
nhìn thấy đủ 6 dòng: `AC_AVOID_ALTHOLD`, `AC_OAPATHPLANNER`, `PROXIMITY`,
`PROXIMITY_RANGEFINDER`, `RFND_BENEWAKE_TFMINIPLUS`, `RANGEFINDER`.

**Nếu lỗi:**
- Không thấy `PROXIMITY` → bản build này **sai**, không dùng được cho dự án. Sang 11.3 dựng lại.
- `Compare-Object` in ra khác biệt → thư mục build được dựng từ một yaml khác. Ghi lại khác biệt
  vào `NOTES.md` và quyết định: hoặc dựng lại từ yaml trong repo, hoặc cập nhật yaml trong repo
  cho khớp với bản build (chọn cái nào cũng được, nhưng **phải chọn một** — hai nguồn lệch nhau
  là mầm lỗi cho Phase 14).

### 11.3 Ghi `NOTES.md` — cách dựng lại firmware khi cần

Ngày nào đó bạn sẽ muốn bật thêm một tính năng (ví dụ `Camera` để bo bay tự bấm chụp). Lúc đó
bạn cần biết dựng lại bằng cách nào, và cần giữ bản cũ để quay về nếu bản mới không bay được.

Viết `firmware/ardupilot/build-d450a747/NOTES.md`:

```text
# Ban custom build d450a747

Ngay giai nen : <dien ngay>
Nguon         : copter-speedybeef4v5-d450a747.tar.gz (co san trong repo tu dau)
Board         : speedybeef4v5
Phien ban     : ArduCopter 4.7.1 stable
Dung cho      : Phase 14 (nap DFU lan dau, file arducopter_with_bl.hex)

## Sau feature bat them so voi ban stock - DA KIEM CHUNG trong build.log

[x] AC_AVOID_ALTHOLD       avoidance theo goc nghieng khi bay AltHold
[x] AC_OAPATHPLANNER       path planner tranh vat can khi bay AUTO/GUIDED
[x] CRASHCATCHER
[x] EKF3_WINDEST           uoc luong gio cho EKF3
[x] PROXIMITY              he thong proximity (nhom param PRX_*)
[x] PROXIMITY_RANGEFINDER  dung rangefinder lam cam bien proximity

## Kiem chung nhanh sau khi nap (Phase 14.4)

Mission Planner -> Full Parameter List -> go "PRX1_TYPE" vao o Search.
  CO param PRX1_TYPE    -> dung ban custom build
  KHONG co               -> da nap nham ban stock, 02-avoid-tfmini.param se bao
                            "parameter not found". Nap lai.

## Dung lai khi can doi feature

1. Mo https://custom.ardupilot.org
2. Keo tha firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml
   vao o "Drag & drop"  ->  server tu tick lai dung 54 feature
3. Sua feature can doi, bam Generate, doi, tai tar.gz ve
4. Giai nen vao firmware/ardupilot/build-<hash-moi>/ , viet NOTES.md moi
5. GIU LAI thu muc build cu cho toi khi ban moi da bay duoc it nhat 1 chuyen

## Luu y ve dung luong flash

F405 chi co 1 MB flash. Bat them feature co the lam build FAIL hoac lam firmware
khong con cho cho log. Neu custom.ardupilot.org bao loi kich thuoc: tat bot
feature khac truoc khi bat cai moi, dung hy vong "chac van vua".
```

Viết thêm `firmware/ardupilot/custombuild/README.md` — ngắn, trỏ sang `NOTES.md` và nhắc rằng
file `.yaml` là **đầu vào của custom build server**, không phải file nạp vào bo bay (người mới
rất hay nhầm hai thứ).

**Kết quả mong đợi:** hai file `.md` tồn tại, `git status` thấy chúng ở dạng file mới.

### 11.4 Quy ước đánh số file parameter

Parameter là toàn bộ "tính cách" của bo bay: nó biết mình là quad hay hexa, cổng nào cắm GPS,
pin mấy cell, ngưỡng nào thì tự bay về nhà. File `.param` là văn bản thuần, mỗi dòng `TÊN,giá_trị`.

Điều quan trọng cần hiểu ngay: có **hai loại** file param, và trộn chúng là nguồn gốc của rất
nhiều tai nạn.

Viết `firmware/ardupilot/params/README.md`:

```text
# Parameter ArduPilot - quy uoc danh so

Thu muc nay DUOC COMMIT (khac voi logs/ va ml/datasets/). Day la lich su cau hinh
bo bay, de khi chinh sai thi restore duoc trang thai da chay tot thay vi nho bang dau.

## Hai loai file - dung tron

FILE NGUOI VIET (nap VAO bo bay)
  01-base.param          cau hinh nen: khung, serial, GPS, pin, failsafe co ban
  02-avoid-tfmini.param  rangefinder + proximity + avoidance
  -> viet tay o Phase 11, co chu thich, doc duoc bang mat thuong

FILE BO BAY XUAT RA (Save to file - snapshot, KHONG sua tay)
  00-after-flash.param   ngay sau khi nap DFU, TRUOC khi cham vao tham so nao   Phase 14
  02-radio.param         sau radio calibration + map switch                     Phase 15
  03-gps.param           sau khi GPS co fix + compass duoc nhan dien            Phase 15
  04-pre-first-flight.param  sau hieu chinh tren khung, TRUOC chuyen bay dau tien  Phase 19
  05-loiter-good.param   khi Loiter da giu vi tri on                            Phase 20
  06-auto-good.param     khi Auto mission chay tron ven                         Phase 21
  07-final.param         cau hinh cuoi cung dem di demo                         Phase 24

## Ba luat

1. KHONG BAO GIO nap mot file snapshot cua ban dung khac vao bo bay cua minh.
   Snapshot chua so do hieu chinh rieng cua tung con drone (gia toc ke, la ban,
   dai tin hieu RC). Dan so cua may khac len may minh = bay lech, hoac khong bay.

2. Ba nhom sau KHONG BAO GIO nap bang file param, bat buoc chay wizard trong
   Mission Planner:
     RC*_MIN / RC*_MAX / RC*_TRIM        Radio Calibration
     COMPASS_OFS* / COMPASS_DIA*         Compass Calibration
     INS_ACC*                            Accelerometer Calibration

3. Moi lan commit file moi, ghi ro trong commit message da doi tham so nao va
   vi sao. Dung prefix `param:`.

## Cach luu

Mission Planner -> Config/Tuning -> Full Parameter List -> nut "Save to file".
```

**Kết quả mong đợi:** file tồn tại, đọc xong bạn biết file nào sinh ra ở phase nào.

### 11.5 Viết `01-base.param`

Chép **nguyên văn** bản nháp trong `plans/reports/260921-research-sitl-firmware-toolchain.md` §4.6,
giữ toàn bộ dòng chú thích — chú thích chính là thứ đáng giá nhất trong file đó, vì nó ghi lại
**vì sao** mỗi con số là con số đó.

Nội dung file (đã áp ba sửa đổi có chủ ý, xem bảng ngay dưới):

```text
# 01-base.param - cau hinh nen truoc chuyen bay dau
# Board: SpeedyBee F405 V5 | ArduCopter 4.7.1 CUSTOM BUILD (custom.ardupilot.org)
# Nap SAU khi 00-after-flash.param da luu.
# Cach load: Mission Planner -> Config/Tuning -> Full Parameter List
#            -> Load from file -> Write Params -> reboot FC
#
# CHUA bao gom: obstacle avoidance (xem 02-avoid-tfmini.param)
#               radio calibration, compass calibration, ESC calibration
#               -> ba thu do PHAI lam bang wizard, khong nap bang file param.

# ---------- khung ----------
# FRAME_CLASS 1 = Quad, FRAME_TYPE 1 = X  (khung S500)
# FRAME_TYPE con phai KIEM CHUNG bang Motor Test o Phase 16 - bo nay danh so
# motor kieu Betaflight, co the khac chuan ArduPilot.
FRAME_CLASS,1
FRAME_TYPE,1

# ---------- cong serial ----------
# SERIAL1 = module Bluetooth noi bo, ArduPilot KHONG dung duoc -> de None
SERIAL1_PROTOCOL,-1

# SERIAL2 = ESP32 DroneBridge (Phase 17). UART2 la cong duy nhat co DMA.
# 2 = MAVLink2, baud 115 = 115200 (mac dinh cua DroneBridge)
SERIAL2_PROTOCOL,2
SERIAL2_BAUD,115

# SERIAL3 = TFmini Plus (nap tu 02-avoid-tfmini.param, ghi lai o day de doi chieu)
# Mac dinh cua board la MSP DisplayPort nhung ban custom build da TAT OSD/MSP.
SERIAL3_PROTOCOL,9
SERIAL3_BAUD,115

# SERIAL4 = GPS Holybro M10 (u-blox). 5 = GPS, baud 230 = 230400 (mac dinh board)
SERIAL4_PROTOCOL,5
SERIAL4_BAUD,230

# SERIAL5 = ESC telemetry (OX32 4in1). 16 = ESC Telemetry, 19200 la mac dinh board
SERIAL5_PROTOCOL,16
SERIAL5_BAUD,19

# SERIAL6 = receiver FlySky iA6B qua iBUS tren chan R6. 23 = RCIN
SERIAL6_PROTOCOL,23

# ---------- receiver ----------
# RC_PROTOCOLS la BITMASK. bit2 = IBUS -> gia tri 4.
# Chi bat iBUS (thay vi 1 = All) de tranh nhan nham protocol.
RC_PROTOCOLS,4

# ---------- GPS ----------
# Ten param doi tu GPS_TYPE -> GPS1_TYPE tu ban 4.6 tro di.
# 2 = uBlox (M10 la u-blox; firmware custom da BO driver NMEA)
GPS1_TYPE,2

# ---------- compass ----------
# Board KHONG co compass tich hop. M10 mang IST8310 tren I2C.
# ArduPilot tu do driver -> khong ep bang param.
# PHAI chay Onboard Mag Calibration SAU khi lap len khung (Phase 19).
COMPASS_ENABLE,1
COMPASS_USE,1

# ---------- motor / ESC ----------
# 5 = DShot300. Bat dau bang 300 (dung sai nhieu tot hon 600).
# Nang len 6 = DShot600 SAU khi da bay on, neu muon.
MOT_PWM_TYPE,5
# So cuc nam cham cua motor. 14 la mac dinh, dung cho HAU HET motor 2212/2216.
# KIEM TRA datasheet motor thuc te; sai so nay -> RPM telemetry sai.
SERVO_BLH_POLES,14
# 10Hz du cho hien thi; nang len 100 khi bat harmonic notch theo RPM (Phase 22).
SERVO_BLH_TRATE,10

# ---------- pin 4S ----------
# 4 = Analog Voltage and Current (mac dinh cua board)
BATT_MONITOR,4
# CANH BAO: README board ghi VOLT_MULT 11.2 / AMP_PERVLT 1,
#           nhung hwdef.dat ghi 11.0 / 25.0. Hai nguon MAU THUAN.
#           Dat theo hwdef roi PHAI hieu chinh bang dong ho van nang o Phase 16:
#           Mission Planner -> Setup -> Optional Hardware -> Battery Monitor
#           -> go dien ap do duoc vao o "Measured battery voltage".
BATT_VOLT_MULT,11.0
BATT_AMP_PERVLT,25.0
# Dien dung THUC TE cua pin: Ovonic 4S 5300mAh
BATT_CAPACITY,5300
# Nguong 4S: 3.5V/cell = 14.0V (canh bao), 3.3V/cell = 13.2V (nguy hiem).
# Bao thu cho pin moi; siet lai sau khi biet sut ap thuc te.
BATT_LOW_VOLT,14.0
BATT_CRT_VOLT,13.2
# 20% cua 5300 - chua 20% cho tuoi tho pin
BATT_LOW_MAH,1060
BATT_FS_LOW_ACT,2
BATT_FS_CRT_ACT,1
# Bo qua kiem tra dien ap pin luc khoi dong o lan dau tien de tranh
# bao loi nham khi chua hieu chinh xong. DAT LAI 0 sau khi calib xong (Phase 16).
BATT_ARM_VOLT,0

# ---------- failsafe co ban ----------
FS_THR_ENABLE,1
FS_EKF_ACTION,1
# Wi-Fi 2.4GHz SE rot lat vat. De 1 (RTL) thi drone tu bay ve chi vi laptop
# mat goi 5 giay. Cac chuyen dau de 0 va dua vao RC failsafe - bo RC moi la
# duong day cuu sinh, khong phai Wi-Fi.
FS_GCS_ENABLE,0

# ---------- log ----------
# Board co 16MB dataflash. Ghi log ngay tu khi cam dien (khong doi arm)
# de bat duoc loi luc khoi dong.
LOG_BITMASK,176126
LOG_DISARMED,1
```

**Ba chỗ sửa có chủ ý so với bản nháp — đã ghi lý do vào chú thích trong file:**

| Dòng | Bản nháp §4.6 | File này | Vì sao |
|---|---|---|---|
| `SERIAL2_BAUD` | `57` | `115` | DroneBridge mặc định 115200. Bản nháp tự ghi "57 (hoac 115)" nên đây là chốt, không phải sửa sai. |
| `BATT_CAPACITY` | `5000` | `5300` | Pin thật là Ovonic 4S **5300** mAh. Bản nháp ghi rõ "doi theo pin ban mua". |
| `BATT_LOW_MAH` | `1000` | `1060` | 20% của 5300, đúng thông lệ chừa 20% cho tuổi thọ pin. |

**Quyết định đã chốt về `BATT_VOLT_MULT` (11.0 hay 11.2):** đặt **11.0** vì `hwdef.dat` là thứ
thực sự được biên dịch vào firmware, còn 11.2 chỉ nằm trong README của board. Nhưng **không tin
con nào cả** — Phase 16 sẽ đo bằng đồng hồ vạn năng và ghi đè giá trị đúng. Con số 11.0 ở đây chỉ
là điểm xuất phát để bo bay không báo lỗi vô nghĩa.

**Kết quả mong đợi:** file có đúng **33 dòng tham số** (dòng bắt đầu bằng chữ in hoa):

```powershell
(Select-String -Path .\firmware\ardupilot\params\01-base.param -Pattern "^[A-Z]").Count
```

**Nếu lỗi:**
- Đếm ra khác 33 → thiếu hoặc thừa dòng, so lại với khối trên.
- Lưu bằng UTF-8 **có BOM** làm Mission Planner bỏ qua dòng đầu → lưu dạng UTF-8 không BOM hoặc ANSI.
- Dùng `=` thay dấu phẩy: Mission Planner đọc được cả hai, nhưng giữ dấu phẩy cho đồng bộ.

### 11.6 Viết `02-avoid-tfmini.param`

Đây là **đổi tên**, không phải viết lại. Toàn bộ nội dung file
`params/obstacle-avoidance-tfminiplus-serial3.param` cũ đã được kiểm chứng và còn đúng — giữ 100%,
kể cả phần chú thích dài về màu dây Benewake, phân bổ nguồn 5V, và các lệnh HEX kiểm tra hàng cũ.

Chỉ đổi ba thứ:

```text
1. Dong tieu de:  "# 02-avoid-tfmini.param - obstacle avoidance huong TRUOC
                   - Benewake TFmini Plus tren SERIAL3 (UART3)"
2. Moi tham chieu "params/obstacle-avoidance-tfminiplus-serial3.param"
   -> "firmware/ardupilot/params/02-avoid-tfmini.param"
3. Moi tham chieu "params/custombuild/..."
   -> "firmware/ardupilot/custombuild/..."
```

Phần tham số giữ nguyên:

```text
SERIAL3_PROTOCOL,9
SERIAL3_BAUD,115
RNGFND1_TYPE,20
RNGFND1_ORIENT,0
RNGFND1_MIN,0.1
RNGFND1_MAX,6
PRX1_TYPE,4
FENCE_ENABLE,1
AVOID_ENABLE,3
AVOID_BEHAVE,1
AVOID_MARGIN,2
AVOID_BACKUP_SPD,0.75
AVOID_BACKUP_DZ,0.10
AVOID_ACCEL_MAX,3
AVOID_DIST_MAX,5
AVOID_ANG_MAX,10
OA_TYPE,0
```

Ba điều cần hiểu trước khi dùng file này (ghi vào sổ tay ở 11.8):

```text
RNGFND1_TYPE,20  = Benewake-Serial, dung cho CA TFmini va TFmini Plus qua UART.
PRX1_TYPE,4      = lay rangefinder lam cam bien proximity. Param nay CHI TON TAI
                   tren ban custom build. Khong co no = da nap nham ban stock.
AVOID_ENABLE,3   = bitmask: bit0 dung hang rao (fence) + bit1 dung cam bien
                   proximity. Vi the FENCE_ENABLE,1 la BAT BUOC di kem.
OA_TYPE,0        = TAT path planner luc dau. Ta chi co MOT tia nhin thang truoc
                   (goc 3,6 do). BendyRuler can biet duong vong, ma no se lech
                   sang huong CHUA CO DU LIEU. Chi bat len 1 o Phase 22, ngoai
                   bai rong, co vat can gia.
```

**Kết quả mong đợi:** file tồn tại, `grep` không còn chuỗi `params/obstacle-avoidance`.

```powershell
Select-String -Path .\firmware\ardupilot\params\*.param -Pattern "obstacle-avoidance-tfminiplus|params/custombuild"
```
→ không trả về dòng nào.

### 11.7 Nạp thử cả hai file vào SITL (drone ảo)

Đây là bài kiểm tra rẻ nhất của cả phase: nạp file param vào **drone ảo** để xem có dòng nào bị
từ chối. SITL không chạy bản custom build của bạn, nên nó **sẽ** từ chối một số tham số — và đó
chính là thông tin cần: bạn biết trước tham số nào phụ thuộc vào firmware custom, thay vì phát
hiện lúc đang cầm bo bay thật.

Cần Phase 04 đã chạy được SITL. Trong Mission Planner đang nối với SITL:

```text
Config/Tuning -> Full Parameter List -> Load from file
  -> chon firmware/ardupilot/params/01-base.param -> Write Params
  -> chon firmware/ardupilot/params/02-avoid-tfmini.param -> Write Params
```

Ghi lại **mọi** dòng Mission Planner báo đỏ vào cuối `NOTES.md`:

```text
## Param SITL tu choi (ghi o Phase 11.7)

<dan nguyen van danh sach Mission Planner bao>

Ky vong: nhom PRX1_* bi tu choi tren SITL vi SITL khong build kem PROXIMITY.
Day KHONG phai loi cua file param. Tren bo bay that (custom build) no se nhan.
Neu bo bay THAT cung tu choi PRX1_TYPE -> da nap nham ban stock, quay lai 11.2.
```

**Kết quả mong đợi:** `01-base.param` nạp gần như trọn vẹn; `02-avoid-tfmini.param` báo lỗi ở
nhóm `PRX1_*` (đúng dự kiến); danh sách bị từ chối đã được dán vào `NOTES.md`.

**Nếu lỗi:**
- Mission Planner treo khi Write Params → nạp lại từng nửa file để khoanh vùng dòng gây treo.
- `FRAME_CLASS` bị từ chối trên SITL → SITL đang mô phỏng loại xe khác; khởi động lại
  `sim_vehicle.py` với `-v ArduCopter`.
- **Không bỏ qua bước này** vì "dù sao cũng nạp lại ở Phase 14" — mục đích của nó không phải nạp
  param, mà là lấy trước danh sách tham số phụ thuộc custom build.

### 11.8 Sổ tay: firmware và parameter cho người mới

Viết `docs/so-tay/11-firmware-va-param.md`, giải thích bằng lời thường (không giả định người đọc
biết gì về bo bay):

- **Firmware, bootloader, DFU là ba thứ khác nhau.** Firmware là phần mềm chính. Bootloader là
  đoạn mã nhỏ chạy trước, có nhiệm vụ nhận firmware mới. DFU là chế độ nằm sẵn trong chính con
  chip, dùng khi chưa có bootloader nào cả — đó là lý do lần nạp đầu tiên khác mọi lần sau.
- **Vì sao file tên là `_with_bl.hex`** — "bl" là bootloader; file này ghi cả bootloader lẫn firmware.
- **Custom build là gì** và vì sao F405 chỉ có 1 MB flash nên phải tắt bớt tính năng để bật tính
  năng khác.
- **Parameter là gì**, khác gì với firmware (đổi parameter không cần nạp lại firmware).
- **Hai loại file param** và ba luật ở 11.4 — nhắc lại, vì đây là chỗ dễ gây hỏng nhất.
- **Bitmask là gì** (lấy `RC_PROTOCOLS,4` và `AVOID_ENABLE,3` làm ví dụ): mỗi bit là một công tắc
  bật/tắt, số thập phân là tổng các công tắc đang bật.
- **UART, baud rate, và vì sao TX phải nối vào RX** (bắt chéo) — sẽ dùng lại rất nhiều ở Phase 13.

---

## Cổng pass

- [ ] `firmware/ardupilot/build-d450a747/` có đủ 7 file, `arducopter_with_bl.hex` khoảng 2,4–2,5 MB.
- [ ] `git status --short` **không** liệt kê file `.hex`, `.apj`, `.bin`, `arducopter`.
- [ ] `Select-String ... -Pattern "PROXIMITY|TFMINI|AVOID|OAPATHPLANNER"` trên `build.log` trả về ≥ 1 dòng cho mỗi từ khoá.
- [ ] `Compare-Object` giữa hai danh sách `selected_features` trả về rỗng (hoặc khác biệt đã được ghi và xử lý trong `NOTES.md`).
- [ ] `NOTES.md` có: bảng 6 feature đã tick, cách rebuild 5 bước, cách kiểm chứng `PRX1_TYPE`.
- [ ] `firmware/ardupilot/params/README.md` mô tả đủ quy ước `00..07` và ba luật.
- [ ] `01-base.param` có đúng 33 dòng tham số; mở bằng Notepad không thấy ký tự lạ.
- [ ] `02-avoid-tfmini.param` có đủ 17 dòng tham số và giữ nguyên phần chú thích gốc; không còn tham chiếu tới đường dẫn cũ.
- [ ] Đã nạp thử cả hai file vào SITL; danh sách tham số bị từ chối đã dán vào `NOTES.md`.
- [ ] `docs/so-tay/11-firmware-va-param.md` tồn tại và giải thích đủ 7 khái niệm ở 11.8.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Bản custom build thiếu `PROXIMITY`/`TFMINIPLUS` → toàn bộ phần tránh vật cản chết ở Phase 17/22 | 2 | 5 | **10** | 11.2 bắt buộc `Select-String` + `Compare-Object`, kết quả ghi vào `NOTES.md`. Thiếu thì dựng lại ngay trong phase này (11.3), đừng để sang Phase 14. |
| Commit nhầm file `.hex` 2,5 MB vào git | 3 | 2 | 6 | Thêm 5 dòng `.gitignore` **trước** khi giải nén (11.1), kiểm tra bằng `git status` ở cổng pass. |
| Chép sai một con số trong `01-base.param` (ví dụ `BATT_VOLT_MULT` thành `1.10`) | 2 | 4 | 8 | Đếm 33 dòng ở cổng pass; nạp thử vào SITL ở 11.7 sẽ lộ giá trị ngoài khoảng cho phép. |
| Bản build trong tar.gz lệch với yaml trong repo → Phase 14 nạp một đằng, tài liệu ghi một nẻo | 2 | 3 | 6 | `Compare-Object` ở 11.2; bắt buộc chọn **một** nguồn làm chuẩn và ghi vào `NOTES.md`. |
| `custom.ardupilot.org` không còn dựng được bản 4.7.1 khi cần rebuild | 2 | 3 | 6 | Bản build hiện tại đã có sẵn trên đĩa và được commit `NOTES.md` — không phụ thuộc server còn sống để bay chuyến đầu. |

Không có rủi ro nào ≥ 15.

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 11.1 `.gitignore` + giải nén | 0,5 | |
| 11.2 Xác nhận feature | 0,5 | Bước đáng giá nhất của phase |
| 11.3 Viết `NOTES.md` + `custombuild/README.md` | 0,5 | |
| 11.4 `params/README.md` (quy ước đánh số) | 0,5 | |
| 11.5 Viết `01-base.param` | 1,0 | Phần lớn thời gian là **đọc hiểu** từng tham số, đừng chép máy móc |
| 11.6 Viết `02-avoid-tfmini.param` | 0,3 | Chỉ là đổi tên + sửa 3 tham chiếu |
| 11.7 Nạp thử vào SITL | 0,5 | Cần Phase 04 đã chạy được SITL |
| 11.8 Sổ tay | 0,7 | |
| **Tổng** | **4,5** | Đường găng: không có. Phase này chạy song song được với Phase 05–10 (backend/web). |

## Ghi chú cho sổ tay

Khái niệm cần giải thích cho người chưa biết gì (đã liệt kê chi tiết ở 11.8):
firmware vs bootloader vs DFU · vì sao lần nạp đầu khác mọi lần sau · custom build và giới hạn
1 MB flash · parameter là gì và khác firmware ra sao · hai loại file param và ba luật không được
vi phạm · bitmask (`RC_PROTOCOLS,4`, `AVOID_ENABLE,3`) · UART / baud rate / bắt chéo TX-RX ·
vì sao `OA_TYPE` để 0 lúc đầu (một tia nhìn thẳng không đủ để vòng tránh).
