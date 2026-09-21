# Phase 17: Trên bàn — ESP32 không dây, TFmini Plus và camera lên web

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 16 + Phase 10 (web) + Phase 12 (firmware ESP32) | ~6,8 giờ | **Có** — stack, ESP32 DevKit, UBEC 5V 3A, TFmini Plus, USB-TTL, board camera, pin 4S |

## Mục tiêu

Đây là phase khép kín toàn bộ chuỗi **drone thật → Wi-Fi → laptop → website**. Xong phase này,
bạn mở trình duyệt và thấy góc nghiêng, toạ độ GPS, điện áp pin và khoảng cách vật cản của con
drone thật đang nằm trên bàn — không còn drone ảo nữa. Camera cũng đã stream được ảnh lên web
kèm lớp phủ khung nhận diện (hiện vẫn là dữ liệu giả).

Đây cũng là cổng pass lớn nhất của cả nhóm phase phần cứng: nếu website không điều khiển được
drone ảo và không hiện được drone thật trên bàn, thì đừng nghĩ tới việc bay.

```text
KHONG CANH QUAT.  KHONG NGOAI LE.
Drone nam tren ban, co the ARM, va co ESP32 dang nhan lenh tu web.
Day chinh xac la tinh huong ma luat NO PROPELLERS duoc viet ra de phong.
```

## Đầu vào cần có

- Phase 16 đã pass — nguồn an toàn, motor đúng thứ tự và chiều.
- Phase 12 đã pass — DroneBridge `.bin` đã tải, project camera build được, hotspot laptop đã cấu hình, rule tường lửa UDP 14550 đã tạo, `scripts/bench_tfmini.py` đã viết.
- Phase 10 đã pass — Web GCS chạy hoàn chỉnh trên SITL, gồm panel obstacle và panel video (nguồn giả).
- `firmware/ardupilot/params/02-avoid-tfmini.param` (Phase 11).
- `firmware/dronebridge/README.md` (Phase 12) — bảng cấu hình và sơ đồ đấu dây.
- `docs/so-tay/12-hotspot-laptop.md` — SSID, mật khẩu, **IP thật của laptop**.
- `docs/so-tay/13-dau-day.md` — mục T2/R2, mục R3, mục phân bổ nguồn 5V.
- UBEC 5V 3A, mạch USB-TTL 3,3 V, tụ 470–1000 µF (nếu dùng ESP32-CAM).

## File và thư mục sở hữu

```text
docs/so-tay/17-khong-day-tfmini-camera.md
.env.example                                   thêm/sửa dòng MAVLINK_ENDPOINT + CAMERA_STREAM_URL
firmware/camera/include/secrets.h              (local, đã .gitignore — chỉ điền giá trị)
plans/PROGRESS.md                              chỉ tick các dòng của Phase 17
```

Không sửa mã backend hay frontend. Cầu MJPEG (`backend/vision/stream.py`) đã được **Phase 07**
tạo và sở hữu — phase này **không** sở hữu và không viết lại mã đó, chỉ **đổi cấu hình**
(`CAMERA_STREAM_URL` trỏ sang IP camera thật) và **kiểm chứng**. Nếu phát hiện lỗi thật trong mã,
ghi lại và xử lý như một việc riêng, đừng sửa lẫn vào phase này.

---

## Việc theo thứ tự

### 17.1 Nạp DroneBridge và đưa ESP32 về chế độ STA

```text
1. Mo Chrome hoac Edge, vao  https://drone-bridge.com/flasher/
2. Cam ESP32 DevKit qua USB   (driver CP210x da cai o Phase 12)
3. Chon firmware "vehicle/air"  ->  Connect  ->  chon COM port  ->  Install
```

Sau khi nạp, board tự phát Wi-Fi riêng để bạn vào cấu hình **lần đầu**:

```text
SSID     : DroneBridge ESP32
Password : dronebridge
Web UI   : http://dronebridge.local   hoac   http://192.168.2.1
```

Nối laptop vào Wi-Fi đó, mở web UI, điền theo bảng đã chuẩn bị ở
`firmware/dronebridge/README.md` mục (b):

```text
UART TX pin   : GPIO se noi toi R2 cua FC      (ghi lai so GPIO thuc te vao so tay)
UART RX pin   : GPIO se noi toi T2 cua FC
Baud          : 115200
Wi-Fi mode    : WiFi Client (STA)              <-- BAT BUOC doi, mac dinh la AP
SSID          : IOTCV-HOTSPOT                  (SSID hotspot laptop)
Password      : <mat khau hotspot>
GCS IP / UDP  : <IP that cua laptop, vd 192.168.137.1>
Port          : 14550
```

Lưu cấu hình, board khởi động lại. **Từ lúc này board không còn phát Wi-Fi riêng nữa** — nó đi
tìm hotspot của laptop.

```text
Bat hotspot laptop TRUOC khi cap dien cho ESP32.
Windows tu tat Mobile hotspot khi khong co thiet bi nao noi vao.
```

**Kết quả mong đợi:** sau khi bật hotspot và cấp điện cho ESP32, thiết bị xuất hiện trong danh
sách máy đã nối của Mobile hotspot (Settings → Mobile hotspot → Devices connected).

**Nếu lỗi:**
- ESP32 không xuất hiện trong danh sách → SSID/mật khẩu sai (gõ lại, phân biệt hoa thường), hoặc
  hotspot đang ở băng 5 GHz (**ESP32 không nhìn thấy mạng 5 GHz**).
- Lỡ đổi sang STA rồi mà không vào lại được web UI → giữ nút BOOT/reset theo hướng dẫn của
  DroneBridge để về AP, hoặc nạp lại firmware bằng web flasher (`esptool erase-flash` trước).
- Nâng cấp từ bản v1.5 lên v2.x → **phải erase flash trước**, nếu không cấu hình cũ gây lỗi lạ.

### 17.2 Đấu ESP32 vào SERIAL2 và cấp nguồn bằng UBEC

```text
FC  T2  (UART2 TX)  ->  ESP32 RX
FC  R2  (UART2 RX)  ->  ESP32 TX          <-- BAT CHEO
FC  GND             ->  ESP32 GND         <-- BAT BUOC
ESP32 5V            <-  UBEC 5V 3A rieng, lay thang tu pin
```

**AN TOÀN:** **không** cấp nguồn ESP32 từ pad 5V của stack. ESP32 bật Wi-Fi tạo xung dòng đột
ngột; nó có thể kéo sụt toàn bộ đường 5 V và **reset bo bay giữa lúc đang bay**. Đây là lý do
UBEC riêng nằm trong danh sách mua bắt buộc.

**AN TOÀN:** trước khi cắm pin, đo lại bằng đồng hồ: đầu ra UBEC phải là **4,8–5,2 V**, và dây
ra không được chập sang GND. UBEC lắp ngược cực sẽ giết ESP32 ngay.

**AN TOÀN:** GND của UBEC và GND của bo bay **phải nối chung**. Hai mạch không chung GND thì tín
hiệu UART sẽ lúc chạy lúc không, và bạn sẽ đi tìm lỗi ở phần mềm hàng giờ.

Kiểm tra tham số (đã nạp từ `01-base.param`, đọc lại cho chắc):

```text
SERIAL2_PROTOCOL = 2      MAVLink2
SERIAL2_BAUD     = 115    115200
BRD_SER2_RTSCTS  = 0      tat flow control
```

**Kết quả mong đợi:** cắm pin, đèn ESP32 sáng, thiết bị nối vào hotspot, không có gì nóng bất thường.

**Nếu lỗi:**
- ESP32 reset liên tục khi cắm pin → UBEC yếu hoặc dây quá mảnh; đo điện áp đầu ra **khi ESP32
  đang bật Wi-Fi**, không phải lúc không tải.
- Không có dữ liệu ở bước sau → kiểm bắt chéo T2/R2 **trước tiên**, rồi tới GND chung.

### 17.3 Mission Planner nối không dây qua UDP

Đây là phép thử "đường ống đã thông chưa", và nên làm **trước** khi đụng vào backend — Mission
Planner là công cụ chuẩn, nếu nó không nhận thì lỗi nằm ở đường truyền chứ không phải ở mã của bạn.

```text
1. Rut cap USB khoi bo bay  (de chac chan du lieu di qua Wi-Fi, khong phai qua USB)
2. Cam pin
3. Mission Planner -> goc tren phai chon UDP -> port 14550 -> CONNECT
4. Doi thanh "Getting params"
```

**UDP không có khái niệm "kết nối".** GCS phải gửi gói trước (heartbeat) thì ESP32 mới biết địa
chỉ để trả lời. Mission Planner và QGroundControl làm việc này tự động — nếu mở GCS mà không thấy
gì, đây là **nghi phạm số một**.

**Kết quả mong đợi:** HUD hiện ra, tham số tải về, nghiêng bo bay thì HUD phản ứng — tất cả **qua
Wi-Fi, cáp USB đã rút**.

**Nếu lỗi — kiểm theo đúng thứ tự này, đừng nhảy cóc:**

```text
1. Hotspot con bat khong?   (Windows tu tat khi khong co thiet bi noi vao)
2. ESP32 co trong danh sach thiet bi da noi cua hotspot khong?
3. Rule tuong lua UDP 14550 con khong?
   Get-NetFirewallRule -DisplayName "IOTCV*"
   Tuong lua Windows nuot goi UDP IM LANG - khong bao loi gi ca.
4. IP laptop co doi khong?  (hotspot co the cap IP khac sau khi restart)
   Get-NetIPAddress -AddressFamily IPv4 | Format-Table InterfaceAlias, IPAddress
   Doi lai trong web UI cua DroneBridge neu can.
5. Bat cheo T2/R2 dung chua?  GND co chung khong?
6. SERIAL2_BAUD co khop voi baud trong web UI DroneBridge khong?
```

Chỉ sau khi đã loại trừ đủ 6 mục trên mới nghi ESP32 hỏng.

### 17.4 Đổi backend từ drone ảo sang drone thật

Backend đọc điểm kết nối từ biến môi trường, nên đây chỉ là đổi **một dòng cấu hình** — không sửa mã.

```text
Truoc (drone ao / SITL):   MAVLINK_ENDPOINT=udpin:127.0.0.1:14551
Sau  (drone that qua ESP32): MAVLINK_ENDPOINT=udpin:0.0.0.0:14550
```

```text
Y nghia:
  udpin:0.0.0.0:14550   backend NGHE tren moi card mang, cong 14550.
                        0.0.0.0 la bat buoc: goi tu ESP32 den qua card hotspot,
                        khong phai qua localhost.
  udp:...               trong pymavlink day thuong la bi danh cua udpin,
                        nhung *chua xac minh* tren dung phien ban dang cai.
                        Ghi ro udpin de khong phu thuoc vao bi danh do.
```

Cập nhật `.env.example` (và file `.env` cục bộ của bạn):

```dotenv
# Drone ao (SITL) - dung o Phase 05..10 (14550 la cua Mission Planner)
# MAVLINK_ENDPOINT=udpin:127.0.0.1:14551

# Drone that qua ESP32 DroneBridge - dung tu Phase 17
MAVLINK_ENDPOINT=udpin:0.0.0.0:14550
```

Chạy backend và kiểm:

```powershell
# cua so 1
.\scripts\run_backend.ps1        # hoac lenh tuong duong ma Phase 01 da tao
```

**Vấn đề sẽ gặp: hai chương trình không nghe chung một cổng UDP được.** Mission Planner đang giữ
14550 thì backend không mở được, và ngược lại. Hai cách:

```text
CACH A (don gian) - dung MOT cai tai mot thoi diem.
  Dong Mission Planner, roi chay backend. Du cho phase nay.

CACH B (can ca hai cung luc) - dung mavp2p lam bo chia.
  mavp2p nhan mot dau vao roi nhan ban ra nhieu dau ra.

  mavp2p udps:0.0.0.0:14550 udpc:127.0.0.1:14551 udpc:127.0.0.1:14552

  Roi:  Mission Planner -> UDP port 14551
        backend         -> MAVLINK_ENDPOINT=udpin:0.0.0.0:14552

  *Chua xac minh* cu phap chinh xac cua mavp2p tren ban dang cai - doc
  `mavp2p --help` truoc khi dung, va ghi cu phap dung duoc vao so tay.
```

**Khuyến nghị cho phase này:** dùng **Cách A**. Đơn giản hơn, ít biến số hơn. Cách B để dành cho
Phase 20+ khi cần Mission Planner theo dõi song song lúc bay thật.

**Kết quả mong đợi:** log backend hiện đã nhận heartbeat từ `SYSTEM_ID` của bo bay thật (không phải
của SITL); endpoint in ra trong log đúng là `udpin:0.0.0.0:14550`.

**Nếu lỗi:**
- Backend chạy nhưng không có heartbeat → Mission Planner vẫn đang giữ cổng 14550. Đóng nó.
- `Address already in use` → như trên.
- Có heartbeat nhưng dữ liệu thưa thớt → tốc độ gói; kiểm `SET_MESSAGE_INTERVAL` mà backend gửi
  (đã làm ở Phase 05), và nhớ rằng Wi-Fi 2,4 GHz hẹp hơn USB rất nhiều.

### 17.5 Web GCS hiện telemetry của drone thật

```text
1. Backend dang chay va da nhan heartbeat
2. Mo trinh duyet vao dia chi ma backend serve (Phase 08 da dung)
3. Kiem tung o tren HUD:
```

```text
[ ] Goc nghieng (roll/pitch)  -> nghieng bo bay bang tay, web phai doi theo NGAY
[ ] Huong (heading)           -> xoay bo bay, kim la ban tren web quay theo
[ ] Dien ap pin               -> khop voi dong ho van nang (da hieu chinh o Phase 16)
[ ] So ve tinh / GPS fix      -> khop voi Mission Planner (can de gan cua so)
[ ] Che do bay                -> gat SwC, ten che do tren web doi theo
[ ] Trang thai armed/disarmed -> dung
[ ] Event log                 -> co dong ket noi, khong co dong loi lap lai
```

**AN TOÀN:** từ giây phút này, website có thể gửi lệnh tới một con drone **thật** có thể quay
motor. Trước khi bấm bất cứ nút nào trên web:

```text
[ ] Xac nhan bang mat: KHONG CO CANH QUAT tren 4 motor
[ ] Tay phat DANG BAT va o trong tam tay
[ ] Cong tac WEB CONTROL ENABLE (SwA / CH7) dang o vi tri TAT
[ ] Bo bay duoc co dinh xuong ban
```

Đây đúng là tình huống mà `SAFETY.md` mục 2 và mục 4 được viết ra để phòng: "mọi lần test lệnh từ
web khi drone còn trên bàn" nằm trong danh sách bắt buộc tháo cánh, và "người vận hành luôn cầm RC
transmitter trong mọi bài bay có web tham gia".

**Kết quả mong đợi:** cả 7 mục đều đúng; độ trễ giữa nghiêng bo bay và web đổi theo là dưới khoảng
nửa giây.

**Nếu lỗi:**
- Web hiện dữ liệu nhưng đứng im → WebSocket đã nối nhưng backend không đẩy; kiểm log backend.
- Điện áp trên web khác Mission Planner → hai bên đọc hai trường khác nhau; kiểm lại tên trường
  trong hợp đồng WS (Phase 05).
- Trễ vài giây → băng thông Wi-Fi; giảm tần suất các bản tin không cần thiết, và nhớ rằng đây là
  đường 2,4 GHz chia sẻ với chính bộ RC.

### 17.6 TFmini Plus — thử trên bàn bằng USB-TTL **trước**

Đừng cắm thẳng vào bo bay. Nếu cảm biến câm thì bạn có ba nghi phạm cùng lúc (cảm biến, dây, tham
số bo bay), mỗi nghi phạm một buổi mò. Thử riêng nó trước thì chỉ còn một.

Kiểm tra sống chết bằng mắt trước:

```text
Cap nguon 5V -> nhin THANG vao ong kinh PHAT -> phai thay DEN DO mo.
Khong co den do = cam bien chet, doi tra ngay.
```

Đấu sang USB-TTL — màu dây theo datasheet Benewake bảng 5.1:

```text
TFmini Plus                    USB-TTL (logic 3.3V, cap nguon 5V)
  Do     PIN-1  +5V    --->     5V
  Trang  PIN-2  RXD    --->     TX
  Xanh   PIN-3  TXD    --->     RX     <-- day nay mang so lieu ve
  Den    PIN-4  GND    --->     GND
```

**AN TOÀN:** datasheet ghi rõ TFmini Plus **không có mạch bảo vệ quá áp và không có bảo vệ đấu
ngược cực**, chỉ chịu dao động ±0,5 V. Cắm nhầm 5 V vào chân GND là hỏng vĩnh viễn, không có tín
hiệu báo trước. **Đo lại từng dây bằng đồng hồ trước khi cấp điện — đừng tin màu dây.**

```powershell
Get-CimInstance Win32_SerialPort | Format-Table Name, Description
py -3.13 scripts\bench_tfmini.py COM5     # doi COM5 thanh so that
```

**Kết quả mong đợi:** dòng chữ chạy liên tục (~100 dòng/giây), cột `ok` tăng đều, cột `bad` gần
như đứng yên. Che tay trước ống kính → `dist` tụt xuống vài chục cm. Ghi vào sổ tay: khoảng cách
đo được ở 0,5 m / 1 m / 3 m và giá trị `strength` tương ứng.

**Nếu lỗi:**
- Không ra dòng nào → cảm biến đang ở chế độ Pixhawk (chuỗi ký tự) thay vì Standard 9 byte. Gửi
  `5A 05 05 01 65` rồi `5A 04 11 6F` (lưu), cấp nguồn lại.
- `bad` tăng bằng `ok` → sai baud, hoặc GND không chung.
- `strength` rất thấp (< 100) hoặc bão hoà → `dist` không đáng tin. Đây chính là lý do ArduPilot
  có `RNGFND1_MIN`/`MAX`.

### 17.7 Cắm TFmini vào R3 và nạp `02-avoid-tfmini.param`

```text
Do    PIN-1  +5V   -> pad 5V cua stack   (KHONG dung chung UBEC voi camera/ESP32)
Trang PIN-2  RXD   -> DE TRONG           (driver ArduPilot chi doc, khong gui lenh)
Xanh  PIN-3  TXD   -> chan R3 cua FC
Den   PIN-4  GND   -> GND chung
```

Vì sao lấy 5 V từ stack chứ không từ UBEC: BEC của stack (2,5 A) đang tải GPS ~40 mA + receiver
~50 mA + TFmini 110 mA (đỉnh 140 mA) = ~200 mA — thừa rất nhiều. Còn UBEC thì đang nuôi ESP32 và
camera, hai thứ gây burst dòng khi Wi-Fi bật, mà TFmini chỉ chịu dao động ±0,5 V.

Nạp tham số:

```text
Mission Planner -> CONFIG -> Full Parameter List
  -> Load from file -> firmware\ardupilot\params\02-avoid-tfmini.param
  -> Write Params -> reboot bo bay
```

**Nếu Mission Planner báo `parameter not found` ở nhóm `PRX1_*`:** bo bay đang chạy **bản stock**,
không phải bản custom build. Quay lại Phase 14 và nạp lại đúng file trong `build-d450a747/`. Đừng
đi tiếp — toàn bộ phần tránh vật cản sẽ không chạy.

Kiểm tra trong Mission Planner:

```text
Flight Data -> tab Status -> tim muc  rangefinder1
    Dua tay cach cam bien ~50cm  ->  so phai doi theo
    Che kin cam bien             ->  so ve gia tri toi thieu hoac bao khong hop le
```

Kiểm tra proximity đã nhận:

```text
CONFIG -> Full Parameter List:
    PRX1_TYPE    = 4      dung rangefinder lam cam bien proximity
    RNGFND1_TYPE = 20     Benewake-Serial
    AVOID_ENABLE = 3      fence + proximity
    FENCE_ENABLE = 1      BAT BUOC di kem AVOID_ENABLE=3
    OA_TYPE      = 0      path planner TAT luc dau - dung
```

**Kết quả mong đợi:** `rangefinder1` hiện số và đổi theo khoảng cách tay; các tham số đọc lại đúng.

**Nếu lỗi:**
- `rangefinder1` bằng 0 hoặc không có → kiểm `SERIAL3_PROTOCOL,9` và `SERIAL3_BAUD,115`; kiểm dây
  xanh có cắm đúng **R3** không (không phải T3).
- Cảm biến chạy trên USB-TTL nhưng không chạy trên bo bay → gần như chắc chắn là sai chân hoặc sai
  tham số serial, vì bản thân cảm biến đã được chứng minh ở 17.6. Đây chính là giá trị của việc
  thử riêng trước.
- Số nhảy loạn khi motor quay → nhiễu. Ghi lại và xử lý khi đi dây thật ở Phase 18 (tách dây tín
  hiệu khỏi dây nguồn motor).

### 17.8 Panel obstacle trên web hiện số thật

Panel này đã được xây và kiểm trên nguồn giả ở Phase 10. Bây giờ nó phải hiện số của cảm biến thật.

```text
[ ] Panel obstacle tren web hien khoang cach, va doi khi ban dua tay lai gan
[ ] Vung "trong nguong AVOID_MARGIN (2 m)" duoc danh dau ro rang
[ ] Khi che kin cam bien, panel bao trang thai khong hop le chu khong hien so rac
[ ] Event log ghi lai su kien khi vuot nguong
```

**AN TOÀN:** đây mới chỉ là **hiển thị**. Hành vi phanh/tránh thật chỉ xảy ra khi bay ở
Loiter/AltHold, và bài test đó thuộc Phase 22 — ngoài bãi rộng, với vật cản mềm. Đừng kết luận
"tránh vật cản đã chạy" chỉ vì con số hiện lên web.

**Kết quả mong đợi:** panel obstacle phản ứng theo tay bạn, độ trễ dưới khoảng nửa giây.

### 17.9 Camera lên web với lớp phủ giả

Nhánh camera đã chốt ở Phase 13. Làm theo nhánh tương ứng.

```text
NHANH A - ESP32-CAM AI-Thinker
  1. Han tu 470-1000uF low-ESR sat chan nguon  <-- BAT BUOC, khong phai tuy chon
  2. Noi IO0 -> GND, nap bang USB-TTL theo nghi thuc o firmware/camera/README.md
  3. Thao day IO0, bam RST

NHANH B - XIAO ESP32S3 Sense
  1. Cam USB-C, chon env xiao_esp32s3, bam Upload
```

Trước khi nạp, điền `firmware/camera/include/secrets.h` với SSID/mật khẩu hotspot thật.

**AN TOÀN:** cấp nguồn camera từ **UBEC 5V 3A**, không từ pad 5V của stack và không từ chân 3,3 V
của USB-TTL. ESP32-CAM kéo 250–500 mA lúc khởi động; thiếu dòng thì nó reset liên tục và bạn sẽ đi
tìm lỗi trong phần mềm trong khi lỗi nằm ở nguồn.

Kiểm tra theo thứ tự — **mỗi bước một nghi phạm**:

```text
1. Camera noi duoc vao hotspot?
   Settings -> Mobile hotspot -> Devices connected -> phai thay them mot may
   Ghi lai IP cua camera.

2. Truy cap truc tiep bang trinh duyet (KHONG qua backend):
   http://<ip-camera>/status     -> tra ve JSON
   http://<ip-camera>/stream     -> thay anh chay trong trinh duyet
   Neu buoc nay khong chay thi khong phai loi cua backend.

3. Doi quality luc dang chay:
   http://<ip-camera>/set?quality=30   -> anh xau di, muot hon
   http://<ip-camera>/set?quality=8    -> anh net hon, giat hon
   (So NHO = net hon = file to hon = fps thap hon)

4. Dong trinh duyet lai.  Camera chi phuc vu duoc MOT client.
   Backend phai la client duy nhat, roi no fan-out cho trinh duyet.

5. Tro backend vao camera:
   Trong .env:  CAMERA_STREAM_URL=http://<ip-camera>/stream
   Khoi dong lai backend.

6. Mo Web GCS -> panel video:
   [ ] Thay hinh anh that
   [ ] Lop phu khung nhan dien van la DU LIEU GIA (Phase 10 da lam)
   [ ] Khung phu nam DUNG cho tren anh, khong lech, khong tre nhieu so voi anh
   [ ] Do lai fps thuc te va ghi vao so tay
```

**Ghi rõ vào sổ tay:** phase này **không** làm gì với AI. Lớp phủ vẫn là dữ liệu giả. Phần nhận
diện thật thuộc luồng AI riêng (`plans/ai/`), bắt đầu sau khi drone đã bay được.

**Chưa xác minh:** mọi con số fps của camera (cả ESP32-CAM lẫn S3) đều đến từ benchmark cộng đồng,
không phải số liệu chính thức. **Tự đo và ghi lại** con số của chính bạn — đó là số liệu gốc, và
nó có giá trị hơn mọi con số chép trên mạng.

**Nếu lỗi:**
- `/stream` mở được nhưng backend không lấy được → kiểm bạn đã đóng tab trình duyệt chưa (camera
  chỉ phục vụ một client).
- Camera reset khi bật Wi-Fi → brownout. Nhánh A: hàn tụ. Cả hai nhánh: kiểm dòng UBEC khi tải.
- Ảnh rất giật → giảm `quality` (số lớn hơn) hoặc hạ độ phân giải; đừng bắt đầu ở độ phân giải cao.
- Camera nối được nhưng ảnh đen → sai bảng chân trong `camera_pins.h`, hoặc thiếu `-DBOARD_HAS_PSRAM`.

### 17.10 Bài kiểm tổng — toàn chuỗi cùng lúc

Chạy đồng thời tất cả, trong 10 phút liên tục, và quan sát xem có gì rụng không.

```text
Cam pin -> ESP32 bridge + camera + TFmini + GPS deu dang chay
Backend dang chay, Web GCS dang mo

[ ] Trong 10 phut, telemetry KHONG dut
[ ] Video KHONG dut  (neu dut thi ghi lai dut o phut thu may)
[ ] Rangefinder van cap nhat
[ ] Khong co thiet bi nao nong bat thuong
[ ] Dien ap pin tut dan mot cach hop ly, khong nhay lung tung
```

**AN TOÀN:** đặt hẹn giờ 10 phút và **không rời khỏi bàn**. Pin đang cắm, ESP32 đang phát sóng,
và bo bay đang ở trạng thái có thể arm.

Nếu video đứt trước telemetry: đó là **hành vi đúng và đã dự kiến** — MJPEG cần băng thông cao hơn
nhiều so với telemetry. Ghi lại, đừng coi là lỗi.

Nếu **telemetry** đứt: đó là vấn đề thật, ghi lại thời điểm và điều kiện. Nhớ rằng
`FS_GCS_ENABLE=0` đang bảo vệ bạn — nếu để 1, drone sẽ tự RTL chỉ vì laptop mất gói 5 giây.

### 17.11 Ghi sổ tay và tick PROGRESS

Viết `docs/so-tay/17-khong-day-tfmini-camera.md`:

- Số GPIO thật đã dùng cho UART trên ESP32 DevKit (điền vào ô *chưa xác minh* của Phase 12).
- Tên chính xác của ô "GCS IP" trong web UI DroneBridge (điền nốt ô *chưa xác minh* còn lại).
- IP của laptop, IP của ESP32 bridge, IP của camera.
- Cú pháp `mavp2p` dùng được (nếu đã thử) — điền vào ô *chưa xác minh*.
- Số đo TFmini ở 0,5 m / 1 m / 3 m và `strength` tương ứng.
- **fps camera đo được** ở VGA với `quality` mặc định — số liệu gốc của bạn.
- Thời điểm video đứt (nếu có) trong bài 10 phút.
- Sáu bước kiểm lỗi UDP ở 17.3 — chép lại để lần sau đọc là làm.

Tick các dòng Phase 17 trong `plans/PROGRESS.md`.

---

## Cổng pass

**Cổng pass chính của cả nhóm phase test trên bàn:**

- [ ] **Web GCS hiện telemetry SỐNG của drone THẬT đang nằm trên bàn** — góc nghiêng, hướng, GPS, điện áp pin, chế độ bay, trạng thái armed — và **tất cả đi qua Wi-Fi với cáp USB đã rút**.
- [ ] **Panel obstacle trên web hiện số thật của TFmini Plus** và đổi theo khi đưa tay lại gần.

Các cổng phụ:

- [ ] ESP32 bridge ở chế độ STA, nối được vào hotspot laptop.
- [ ] Mission Planner nối được qua UDP 14550 không dây (đã rút USB).
- [ ] `MAVLINK_ENDPOINT=udpin:0.0.0.0:14550` trong `.env`; log backend hiện heartbeat của bo bay thật.
- [ ] `rangefinder1` hiện trong Mission Planner tab Status và phản ứng đúng.
- [ ] `PRX1_TYPE`, `RNGFND1_TYPE`, `AVOID_ENABLE`, `FENCE_ENABLE`, `OA_TYPE=0` đọc lại đúng giá trị sau khi nạp `02-avoid-tfmini.param`.
- [ ] Camera nối hotspot; `/stream` và `/set?quality=` chạy được khi truy cập trực tiếp; panel video trên web hiện ảnh thật kèm lớp phủ **giả**.
- [ ] Bài kiểm tổng 10 phút: telemetry không đứt; mọi lần đứt (kể cả video) đã ghi lại.
- [ ] fps camera thật đã đo và ghi vào sổ tay (thay cho con số *chưa xác minh* chép trên mạng).
- [ ] **Không có cánh quạt nào trong toàn bộ phase; tay phát luôn bật và trong tầm tay khi bấm nút trên web; `FS_GCS_ENABLE` vẫn bằng 0.**

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Gửi lệnh từ web tới drone thật trên bàn mà quên kiểm cánh quạt | 2 | 5 | 10 | Checklist 4 ô ở 17.5 trước khi bấm nút web đầu tiên; `SAFETY.md` mục 2 + mục 4; cổng pass kiểm. |
| ESP32 ăn nguồn 5V của stack → bo bay reset khi Wi-Fi bật | 3 | 5 | **15** | **Rủi ro cao.** 17.2 bắt buộc UBEC riêng, đo điện áp đầu ra **khi đang tải**; nếu thấy bo bay reset thì dừng ngay, không "thử bay xem sao". |
| Tường lửa Windows nuốt gói UDP im lặng → debug nhầm chỗ hàng giờ | 4 | 2 | 8 | Rule đã tạo ở Phase 12; 17.3 có 6 bước kiểm lỗi theo thứ tự, tường lửa là bước 3. |
| Hotspot Windows tự tắt / đổi IP giữa chừng | 4 | 2 | 8 | Ghi vào sổ tay: bật hotspot trước, cấp điện sau; bước 4 của danh sách kiểm lỗi là kiểm IP. |
| Nạp nhầm bản stock ở Phase 14 → `PRX1_*` không tồn tại, phát hiện ở đây | 2 | 4 | 8 | 17.7 nói rõ triệu chứng và bắt quay lại Phase 14; Phase 14 đã có cổng pass kiểm `PRX1_TYPE`. |
| Cắm TFmini sai cực → hỏng vĩnh viễn (không có bảo vệ ngược cực) | 3 | 4 | **12** | 17.6 bắt buộc đo từng dây bằng đồng hồ trước khi cấp điện; thử trên USB-TTL trước khi cắm vào bo bay. |
| Camera brownout khi bật Wi-Fi (nhánh A) | 4 | 2 | 8 | Tụ 470–1000 µF là **bắt buộc** chứ không tuỳ chọn; UBEC riêng; đo điện áp khi đang tải. |
| Wi-Fi 2,4 GHz rớt lặt vặt → nếu bật GCS failsafe thì drone tự RTL giữa chừng | 3 | 4 | **12** | `FS_GCS_ENABLE=0` đã nằm trong `01-base.param` và là cổng pass; RC mới là đường dây cứu sinh, không phải Wi-Fi. |
| Backend và Mission Planner giành nhau cổng 14550 → tưởng ESP32 hỏng | 4 | 2 | 8 | 17.4 nêu rõ và đưa hai cách; khuyến nghị Cách A (dùng một cái) cho phase này. |

Rủi ro điểm 15 (nguồn ESP32) được giảm thiểu bằng yêu cầu cứng "UBEC riêng" ngay từ danh sách mua
ở Phase 13 và phép đo điện áp khi đang tải ở 17.2.

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 17.1 Nạp DroneBridge + cấu hình STA | 0,8 | Cấu hình lần đầu phải nối vào AP mặc định của nó |
| 17.2 Đấu SERIAL2 + UBEC | 0,7 | Gồm đo điện áp UBEC khi đang tải |
| 17.3 Mission Planner qua UDP | 0,7 | Có thể mất thêm 1 h nếu vướng tường lửa/IP |
| 17.4 Đổi backend sang drone thật | 0,5 | Chỉ đổi cấu hình, không sửa mã |
| 17.5 Web GCS hiện telemetry thật | 0,5 | **Cổng pass chính** |
| 17.6 TFmini bench bằng USB-TTL | 0,7 | |
| 17.7 TFmini vào R3 + nạp param | 0,6 | |
| 17.8 Panel obstacle hiện số thật | 0,3 | **Cổng pass chính** |
| 17.9 Camera lên web + lớp phủ giả | 1,2 | Nhánh A tốn thêm ~0,5 h cho hàn tụ + nghi thức nạp |
| 17.10 Bài kiểm tổng 10 phút | 0,3 | Không rời bàn |
| 17.11 Sổ tay + PROGRESS | 0,5 | Điền nốt các ô *chưa xác minh* của Phase 12 |
| **Tổng** | **6,8** | Dự phòng thêm 1–1,5 h cho sự cố mạng (tường lửa, IP, hotspot tự tắt) |

## Ghi chú cho sổ tay

- **Vì sao thử Mission Planner trước, backend sau** — Mission Planner là công cụ chuẩn; nếu nó
  không nhận thì lỗi ở đường truyền, không phải ở mã của bạn. Đây là nguyên tắc khoanh vùng lỗi:
  **mỗi bước chỉ thêm một nghi phạm**.
- **UDP không có kết nối** và hệ quả: GCS phải gửi gói trước.
- **`udpin` khác `udpout`** — một bên nghe, một bên gửi; và vì sao phải là `0.0.0.0` chứ không
  phải `127.0.0.1` khi gói đến qua card hotspot.
- **Hai chương trình không nghe chung một cổng UDP được**, và mavp2p giải quyết bằng cách nào.
- **Vì sao camera chỉ phục vụ được một client**, và vì sao backend phải đứng giữa làm cầu phân phối.
- **Vì sao video đứt trước telemetry** — băng thông, không phải lỗi.
- **`FS_GCS_ENABLE=0` nghĩa là gì** và vì sao các chuyến đầu phải để 0.
- **"Hiện được số" khác "tránh được vật cản"** — panel obstacle hiện số chỉ chứng minh đường dữ
  liệu thông; hành vi phanh/tránh thật phải test ngoài bãi ở Phase 22.
