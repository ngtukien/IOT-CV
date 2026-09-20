# Phase 14: Hàng về — kiểm hàng và nạp firmware lần đầu

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 13 + **hàng đã về** | ~3,5 giờ | **Có** — stack SpeedyBee F405 V5, cáp USB-C có dây dữ liệu, toàn bộ đơn hàng |

**AN TOÀN:** toàn bộ phase này không lắp cánh lên motor (NO PROPELLERS, `SAFETY.md` mục 2). Cánh
chỉ được gắn ở Phase 19 bước 19.13.

## Mục tiêu

Xong phase này, bo bay đã từ một bo drone đua (Betaflight) biến thành bo drone nghiên cứu
(ArduPilot 4.7.1 custom build), Mission Planner nhận được nó qua USB, và hai file parameter đã
nằm trong bo. Đồng thời bạn đã kiểm toàn bộ hàng và biết chắc không có món nào lỗi — phát hiện
hàng lỗi lúc này thì còn đổi trả được, phát hiện sau khi đã hàn thì không.

**KHÔNG CẮM PIN trong toàn bộ phase này.** Chỉ dùng USB. Không lắp gì lên khung.

## Đầu vào cần có

- `docs/so-tay/13-checklist-in-ra.md` — **Tờ 1** đã in ra giấy.
- `firmware/ardupilot/build-d450a747/arducopter_with_bl.hex` (Phase 11) và `NOTES.md`.
- `firmware/ardupilot/params/01-base.param` (Phase 11).
- `plans/reports/260921-research-sitl-firmware-toolchain.md` §3 — quy trình DFU, cảnh báo Zadig, §3.6 kiểm tra sau khi nạp.
- Mission Planner + STM32CubeProgrammer đã cài (Phase 00).
- **Một cáp USB-C có dây dữ liệu.** Rất nhiều cáp chỉ có 2 dây sạc — đây là nguyên nhân số một khiến máy không nhận board.
- Sạc SkyRC iMAX B6AC V2 (để đo điện áp từng cell của pin).

## File và thư mục sở hữu

```text
firmware/ardupilot/params/00-after-flash.param    snapshot ngay sau khi nạp
docs/so-tay/14-nap-firmware.md
logs/kiem-hang/                                   ảnh chụp lúc mở thùng (đã .gitignore)
plans/PROGRESS.md                                 chỉ tick các dòng của Phase 14
```

Không sửa `firmware/ardupilot/params/01-base.param` (Phase 11 sở hữu — phase này chỉ **nạp** nó
vào bo, không sửa nội dung).

---

## Việc theo thứ tự

### 14.1 Mở thùng, chụp ảnh, kiểm đếm

Cầm **Tờ 1** đã in. Làm trước khi lắp bất cứ thứ gì.

```text
[ ] CHUP ANH toan bo hang con nguyen trong hop, TRUOC khi boc.
    Anh nay la bang chung neu phai khieu nai. Luu vao logs/kiem-hang/
[ ] Dem du mon theo don hang, doi chieu docs/so-tay/13-mua-sam.md
[ ] Ghi vao docs/so-tay/14-nap-firmware.md: mon nao thieu, mon nao khac mo ta
```

Kiểm từng nhóm:

**Motor (4 × T-Motor AIR2216II)** — việc quan trọng nhất ở đây là **đếm chiều ren**:

```text
[ ] Truc thang? Xoay tay co muot, khong ret?
[ ] Bearing co keu lao xao?
[ ] 3 day co dut hay troc vo?
[ ] Nam cham co ca vao stator?
[ ] DEM CHIEU REN: quad can dung 2 REN THUAN + 2 REN NGHICH.
    Van thu oc chop bang tay:
      siet chat khi xoay CUNG chieu kim dong ho  -> ren THUAN
      siet chat khi xoay NGUOC chieu kim dong ho -> ren NGHICH
    DUNG TIN NHAN HOP. Shop gui 4 cai cung loai ren la chuyen thuong gap.
```

**AN TOÀN:** nếu cả 4 motor cùng một chiều ren, **đổi hàng ngay**, đừng "lắp tạm rồi tính".
Ốc chóp ren sai chiều sẽ tự nới lỏng do chính chiều quay của motor, và cánh quạt văng ra khi
đang bay.

**Stack (SpeedyBee F405 V5 OX32 Deluxe):**

```text
[ ] Khong chay, khong phong tu, khong bien dang
[ ] Du 2 soi cap 10 chan (25mm va 75mm) trong hop Deluxe
[ ] Du 2 tu 1000uF 35V
[ ] Du bo oc nylon + dem silicone + 10 vo boc silicone
[ ] Du day GPS SH1.0 6pin va day receiver SH1.0 4pin
```

**GPS Holybro M10:** không vỡ anten gốm; cột nâng đủ ống + 2 đế + ốc.

**Receiver iA6B:** còn bind plug (jumper nhựa nhỏ) trong hộp.

**Pin Ovonic 4S 5300 mAh** — đo **từng cell** bằng chức năng `Battery Meter` của B6AC V2:

```text
Pin moi xuat xuong o muc storage: 3,80 - 3,85 V moi cell
Tong 4 cell:                      15,2 - 15,4 V
Lech giua cell cao nhat va thap nhat phai < 0,05 V
```

**AN TOÀN:** không dùng pin nếu phồng, rách vỏ, dây lỏng, hoặc lệch cell bất thường
(`SAFETY.md` mục 6). Pin LiPo hỏng không "hỏng nhẹ" — nó cháy. Pin chỉ được lấy ra khỏi túi
chống cháy khi đang dùng, và không sạc khi không có người trông.

**Kết quả mong đợi:** mọi ô đã tick; ảnh đã lưu; danh sách món thiếu/lỗi đã ghi và đã liên hệ shop.

**Nếu lỗi:**
- Thiếu cáp 10 chân → không làm gì được ở Phase 18; báo shop ngay, đừng chờ.
- Pin lệch cell > 0,05 V → sạc cân bằng một lần rồi đo lại. Vẫn lệch → đổi pin.
- Motor rít khi xoay tay → có thể chỉ là mỡ bôi trơn đặc; xoay vài chục vòng rồi thử lại. Vẫn rít
  → đổi.

### 14.2 Cắm USB lần đầu — máy có nhận board không

Chưa nạp gì cả. Chỉ kiểm tra đường USB thông suốt.

```text
1. Cam cap USB-C tu bo bay vao may tinh (KHONG giu nut nao)
2. Windows phai keu "ting" va hien thiet bi moi
```

```powershell
Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match "STM|Serial|COM|DFU" } |
  Format-Table FriendlyName, Status
```

**Kết quả mong đợi:** có một thiết bị mới xuất hiện. Bo còn chạy Betaflight nên tên có thể lạ —
không sao, điều cần biết là **cáp và cổng USB hoạt động**.

**Nếu lỗi:**
- Không có gì xuất hiện → **thử cáp USB khác trước tiên.** Rất nhiều cáp chỉ có 2 dây sạc, không
  có dây dữ liệu. Đây là nguyên nhân phổ biến nhất và là thứ đầu tiên phải loại trừ.
- Vẫn không → thử cổng USB khác, ưu tiên cổng sau máy bàn, tránh hub.
- Vẫn không → thử máy khác. Nếu máy nào cũng không nhận thì bo lỗi, đổi hàng.

### 14.3 Đưa bo vào chế độ DFU

Bo xuất xưởng chạy **Betaflight**. Mission Planner không nhận được bo đang chạy Betaflight, nên
lần nạp **đầu tiên** phải đi qua **DFU** — một chế độ nằm sẵn trong chính con chip STM32, dùng
khi chưa có bootloader ArduPilot nào cả.

```text
LAN DAU   bo con Betaflight    ->  DFU             ->  nap arducopter_with_bl.hex
LAN SAU   bo da co ArduPilot   ->  Mission Planner ->  nap arducopter.apj
```

Quy trình vào DFU:

```text
1. Tim nut BOOT tren bo bay - nut bam nho mau den, thuong canh cong USB-C.
   (Mot so bo khong co nut ma co 2 pad ghi "BOOT" - noi tat 2 pad do bang nhip)
2. GIU nut BOOT
3. Vua giu, vua cam cap USB-C vao may tinh
4. Dem 2 giay roi THA nut
5. Windows keu "ting"
```

Kiểm tra máy đã nhận DFU chưa:

```text
Windows + X  ->  Device Manager
Tim muc "Universal Serial Bus devices" hoac "STMicroelectronics"
PHAI thay:  "STM32 BOOTLOADER"  hoac  "STM Device in DFU Mode"
```

**Kết quả mong đợi:** Device Manager hiện `STM32 BOOTLOADER` không kèm dấu chấm than vàng.

**Nếu lỗi:**
- Không thấy gì → xem lại 14.2 (cáp, cổng).
- Hiện dấu chấm than vàng / thiết bị lạ → **cài (hoặc cài lại) STM32CubeProgrammer trước**. Nó
  mang theo driver DFU chuẩn của ST, và đây là cách khắc phục được khuyến nghị.
- Chỉ khi cách trên thất bại mới dùng **Zadig** (`https://zadig.akeo.ie/`): Options → tick
  `List All Devices` → chọn `STM32 BOOTLOADER` → chọn driver `WinUSB` → `Replace Driver`, rồi nạp
  bằng `dfu-util`.

> **AN TOÀN (mức công cụ):** Zadig là con dao hai lưỡi. Sau khi nó thay driver thành WinUSB,
> **STM32CubeProgrammer có thể không còn nhận bo nữa**. Đừng chạy Zadig "cho chắc" — chỉ chạy khi
> đã thực sự bế tắc, và nhớ đường quay lui: Device Manager → Uninstall device → tick
> `Delete the driver software` → rút cắm lại.

### 14.4 Nạp `arducopter_with_bl.hex` bằng STM32CubeProgrammer

Đây là công cụ được wiki ArduPilot chỉ định cho việc này, vì nó kèm luôn driver DFU cho Windows.

```text
1. Mo STM32CubeProgrammer
2. Goc tren phai: chon kieu ket noi  USB
3. Bam  Connect        -> phai thay cong USB hien ra
4. Bam  Open file      -> chon
   D:\Coding\IOT-CV\firmware\ardupilot\build-d450a747\arducopter_with_bl.hex
5. Bam  Download
6. Cho thanh tien trinh chay het
7. Rut cap, cam lai - lan nay KHONG giu nut BOOT
```

**AN TOÀN:** **không rút cáp giữa chừng khi đang Download.** Ngắt giữa lúc ghi bootloader có thể
để bo ở trạng thái không khởi động được và cũng không vào lại DFU được. Nếu máy tính có chế độ
ngủ tự động, tắt nó trước khi bắt đầu.

**Không nạp qua WSL.** Wiki ArduPilot ghi thẳng: giải pháp `usbipd` của Microsoft để đưa USB vào
WSL2 **không dùng được** cho bootloader vì thời gian mount quá chậm. Nạp firmware **luôn làm từ
Windows**.

**Kết quả mong đợi:** thanh tiến trình chạy hết, thông báo download thành công; sau khi cắm lại
(không giữ BOOT), Device Manager hiện một **COM port** mới.

**Nếu lỗi:**
- CubeProgrammer không Connect được → bo chưa ở DFU (làm lại 14.3), hoặc driver đã bị Zadig thay
  (gỡ driver, cài lại CubeProgrammer).
- `Error: Data read failed` giữa chừng → thử cổng USB khác, tránh hub, và thử giảm tốc độ nếu
  công cụ có tuỳ chọn đó.
- Nạp xong mà không có COM port mới → cắm lại có giữ BOOT để vào DFU và nạp lại. Bo vẫn vào được
  DFU nghĩa là chưa hỏng.

### 14.5 Mission Planner nhận board — và xác nhận **đúng bản custom build**

Đây là bước kiểm chứng quan trọng nhất của phase. Có hai thứ phải thấy: đúng phiên bản, và **có
nhóm tham số `PRX_*`**.

```text
1. Mo Mission Planner
2. Goc tren PHAI: chon cong COM cua bo  (thuong la COM so cao nhat)
3. Toc do: 115200
4. Bam CONNECT
5. Cho thanh "Getting params" chay het
```

Kiểm tra 1 — **phiên bản và tên bo**:

```text
Tab Messages (hoac goc duoi man hinh) phai ghi:
    ArduCopter V4.7.1
    SpeedyBeeF405V5
```

Kiểm tra 2 — **có phải bản custom build không**:

```text
CONFIG -> Full Parameter List -> go "PRX1_TYPE" vao o Search

CO param PRX1_TYPE    -> DUNG ban custom build. Di tiep.
KHONG co               -> DA NAP NHAM BAN STOCK.
                          02-avoid-tfmini.param se bao "parameter not found" o Phase 17,
                          va toan bo phan tranh vat can cua du an se khong chay.
                          Quay lai 14.4, nap lai dung file trong build-d450a747/.
```

Kiểm tra thêm cho chắc (cả ba đều phải có):

```text
PRX1_TYPE        nhom proximity
RNGFND1_TYPE     nhom rangefinder
AVOID_ENABLE     nhom avoidance
```

**Kết quả mong đợi:** HUD hiện ra, banner ghi `ArduCopter V4.7.1` + `SpeedyBeeF405V5`, cả ba tham
số trên đều tìm thấy.

**Nếu lỗi:**
- Mission Planner nối được nhưng HUD đứng im → bình thường khi bo nằm trên bàn không có GPS; xem
  giá trị Roll/Pitch có đổi khi nghiêng bo không.
- `No Heartbeat Packets Received` → sai tốc độ (phải là 115200), hoặc chọn nhầm COM port.
- Thiếu `PRX1_TYPE` → xem khối trên. Đây **không** phải lỗi nhỏ, đừng đi tiếp.

### 14.6 Lưu `00-after-flash.param` — **đừng bỏ qua**

Đây là ảnh chụp trạng thái gốc của bo, **trước khi** bạn chạm vào bất kỳ tham số nào. Sau này
chỉnh sai mà không nhớ đã đổi gì, đây là chỗ để quay về.

```text
Mission Planner -> CONFIG -> Full Parameter List -> nut "Save to file"
Luu vao: D:\Coding\IOT-CV\firmware\ardupilot\params\00-after-flash.param
```

Commit ngay:

```powershell
git add firmware/ardupilot/params/00-after-flash.param
git commit -m "param: snapshot 00-after-flash sau khi nap DFU custom build d450a747"
```

**Kết quả mong đợi:** file tồn tại, mở ra thấy hàng trăm dòng `TÊN,giá_trị`; tìm thấy `PRX1_TYPE`
trong đó.

**Nếu lỗi:** nút Save to file bị mờ → chưa tải xong tham số; đợi thanh "Getting params" chạy hết.

### 14.7 Nạp `01-base.param`, khởi động lại, kiểm tra lại

Bây giờ mới nạp cấu hình nền.

```text
Mission Planner -> CONFIG -> Full Parameter List
  -> Load from file  -> chon firmware\ardupilot\params\01-base.param
  -> Write Params
  -> rut cap, cam lai (reboot bo bay)
  -> CONNECT lai
```

Kiểm tra lại 8 tham số then chốt bằng ô Search — **đọc lại từ bo bay**, không tin là "đã ghi rồi
thì chắc đúng":

```text
FRAME_CLASS      = 1
FRAME_TYPE       = 1        (con phai KIEM CHUNG bang Motor Test o Phase 16)
SERIAL2_PROTOCOL = 2
SERIAL2_BAUD     = 115
SERIAL4_PROTOCOL = 5
SERIAL6_PROTOCOL = 23
RC_PROTOCOLS     = 4
MOT_PWM_TYPE     = 5        (DShot300)
BATT_MONITOR     = 4
```

Ghi vào `docs/so-tay/14-nap-firmware.md` **mọi dòng Mission Planner báo đỏ** khi Write Params.
Đối chiếu với danh sách "param SITL từ chối" đã ghi ở Phase 11.7: trên bo thật, danh sách này
phải **ngắn hơn** (vì bo thật có nhóm `PRX_*` mà SITL không có). Nếu bo thật từ chối nhiều hơn
SITL → có gì đó sai, dừng lại và tìm hiểu.

**Kết quả mong đợi:** cả 8 tham số đọc ra đúng giá trị; không có tham số nào bị từ chối, hoặc
danh sách bị từ chối ngắn hơn danh sách của SITL.

**Nếu lỗi:**
- `Write Params` treo → nạp lại từng nửa file để khoanh vùng dòng gây treo.
- Tham số đọc ra vẫn là giá trị cũ → chưa bấm Write Params, hoặc chưa reboot. Một số tham số
  (nhất là `SERIAL*`, `FRAME_*`) chỉ có hiệu lực sau khi khởi động lại.
- `SERIAL1_PROTOCOL,-1` bị từ chối → không quan trọng ở giai đoạn này; ghi lại rồi đi tiếp.

### 14.8 Ghi sổ tay và tick PROGRESS

Viết `docs/so-tay/14-nap-firmware.md`:

- Ngày nạp, phiên bản đọc được từ banner, hash bản build đã dùng (`d450a747`).
- Số COM port của bo (ghi lại — sẽ dùng suốt các phase sau).
- Danh sách tham số bị từ chối ở 14.7.
- Món hàng thiếu/lỗi ở 14.1 và trạng thái xử lý.
- Ba ghi chú cho lần sau:

```text
1. Tu gio tro di KHONG can DFU nua. Cac lan update firmware sau dung
   Mission Planner -> Setup -> Install Firmware -> Load custom firmware
   -> chon file arducopter.apj trong build-d450a747/
2. So COM cua bo co the DOI khi cam vao cong USB khac. Khong hoang so.
3. Truoc moi lan nap firmware moi: luu snapshot param truoc da.
   Nap firmware co the xoa het tham so.
```

Tick các dòng Phase 14 trong `plans/PROGRESS.md`.

---

## Cổng pass

- [ ] Tờ 1 (mở thùng) đã tick hết; ảnh đã lưu vào `logs/kiem-hang/`.
- [ ] Motor: đủ **2 ren thuận + 2 ren nghịch** (đã tự vặn tay kiểm, không tin nhãn hộp).
- [ ] Pin: 4 cell đều trong khoảng 3,80–3,85 V, lệch < 0,05 V.
- [ ] Device Manager hiện `STM32 BOOTLOADER` khi vào DFU (không có dấu chấm than).
- [ ] STM32CubeProgrammer báo Download thành công với `arducopter_with_bl.hex`.
- [ ] Mission Planner CONNECT được; banner ghi `ArduCopter V4.7.1` + `SpeedyBeeF405V5`.
- [ ] **Tìm thấy `PRX1_TYPE`, `RNGFND1_TYPE`, `AVOID_ENABLE` trong Full Parameter List.**
- [ ] `firmware/ardupilot/params/00-after-flash.param` đã lưu **và đã commit**.
- [ ] `01-base.param` đã Write + reboot; 8 tham số then chốt đọc lại đúng giá trị.
- [ ] Danh sách tham số bị từ chối đã ghi vào `docs/so-tay/14-nap-firmware.md` và ngắn hơn danh sách của SITL (Phase 11.7).
- [ ] **Chưa cắm pin lần nào trong phase này.**

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Nạp nhầm bản stock (không có `PRX_*`) → phát hiện muộn ở Phase 17 | 2 | 4 | 8 | 14.5 kiểm `PRX1_TYPE` **ngay sau khi nạp**, trước khi làm bất cứ việc gì khác. Cổng pass bắt buộc. |
| Rút cáp giữa lúc ghi bootloader → bo không khởi động và không vào lại DFU được | 2 | 5 | 10 | Cảnh báo AN TOÀN ở 14.4; tắt chế độ ngủ tự động của máy trước khi bắt đầu. |
| Chạy Zadig "cho chắc" → CubeProgrammer không nhận bo nữa | 3 | 3 | 9 | 14.3 ghi rõ Zadig là phương án **cuối**, kèm đường quay lui. |
| Cáp USB chỉ có dây sạc → mất hàng giờ nghi bo hỏng | 4 | 2 | 8 | 14.2 kiểm đường USB **trước** khi vào DFU; "thử cáp khác" là bước xử lý đầu tiên. |
| Motor giao 4 cái cùng chiều ren → ốc chóp tự nới, cánh văng khi bay | 2 | 5 | 10 | 14.1 bắt buộc tự vặn tay kiểm chiều ren; phát hiện lúc này còn đổi trả được. |
| Pin lỗi (phồng / lệch cell) không phát hiện sớm | 2 | 5 | 10 | 14.1 đo từng cell bằng B6AC V2; `SAFETY.md` mục 6 là luật cứng, không phải khuyến nghị. |
| Quên lưu `00-after-flash.param` → mất trạng thái gốc để quay về | 3 | 2 | 6 | 14.6 tách thành bước riêng, có commit ngay; cổng pass kiểm. |

Không có rủi ro nào ≥ 15.

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 14.1 Mở thùng, chụp ảnh, kiểm đếm | 1,0 | Đừng vội. Đây là cửa sổ duy nhất để đổi trả |
| 14.2 Kiểm đường USB | 0,2 | |
| 14.3 Vào DFU | 0,3 | Có thể mất thêm 0,5 h nếu phải xử lý driver |
| 14.4 Nạp `.hex` | 0,3 | |
| 14.5 Mission Planner + kiểm `PRX1_TYPE` | 0,5 | Bước kiểm chứng quan trọng nhất |
| 14.6 Lưu + commit `00-after-flash.param` | 0,2 | |
| 14.7 Nạp `01-base.param` + kiểm lại | 0,5 | |
| 14.8 Sổ tay + PROGRESS | 0,5 | |
| **Tổng** | **3,5** | Dự phòng thêm 1 h cho sự cố driver DFU. Làm trong một buổi, đừng chia đôi. |

## Ghi chú cho sổ tay

- **DFU là gì** và vì sao lần nạp đầu tiên khác mọi lần sau (chưa có bootloader ArduPilot).
- **`_with_bl.hex` khác `.apj` ra sao** — một cái ghi cả bootloader, một cái chỉ ghi firmware.
- **Vì sao Mission Planner không nhận bo đang chạy Betaflight.**
- **Snapshot param là gì** và vì sao phải lưu **trước** khi chạm vào tham số nào.
- **Cách đọc banner phiên bản** trong Mission Planner, và vì sao `PRX1_TYPE` là dấu hiệu nhận biết
  bản custom build.
- **Chiều ren ốc chóp motor** — vì sao quad cần 2 thuận 2 nghịch, và chuyện gì xảy ra nếu sai.
- **Điện áp storage của pin LiPo** (3,80–3,85 V/cell) khác điện áp đầy (4,20 V/cell) và vì sao pin
  mới về không được sạc đầy ngay.
