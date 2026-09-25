# Sổ tay 11-firmware-ardupilot-param

Trang này dành cho người **chưa từng cầm bo bay**. Đọc xong bạn biết firmware nằm ở đâu
trong repo, vì sao lần nạp đầu tiên khác mọi lần sau, file parameter là gì, và tại sao có
những file tuyệt đối không được nạp.

Những gì đã kiểm chứng ở phase này (số thật, không chép từ plan) nằm ở
[`firmware/ardupilot/build-d450a747/NOTES.md`](../../firmware/ardupilot/build-d450a747/NOTES.md).
Quy ước tên file param nằm ở
[`firmware/ardupilot/params/README.md`](../../firmware/ardupilot/params/README.md).
Phần param tránh vật cản (rangefinder, proximity, `AVOID_*`) đã giải thích kỹ ở
[sổ tay 04](04-param-va-tranh-vat-can-ao.md), trang này không lặp lại.

## 1. Firmware, bootloader, DFU — ba thứ khác nhau

Hình dung con chip STM32F405 trên bo SpeedyBee như một cái máy tính rất nhỏ:

```text
  bộ nhớ flash 1 MB của chip
  ┌──────────────┬──────────────────────────────────────────┐
  │  bootloader  │  firmware ArduPilot (≈ 742 KB)           │
  │  (≈ 48 KB)   │  = "hệ điều hành" của drone               │
  └──────────────┴──────────────────────────────────────────┘
        ▲
        │  DFU: nằm sẵn trong ROM của chip, KHÔNG nằm trong flash,
        │  không bao giờ bị xoá. Chỉ dùng khi flash còn trống trơn.
```

- **Firmware** là phần mềm chính: đọc cảm biến, giữ thăng bằng, điều khiển motor.
- **Bootloader** là đoạn mã nhỏ chạy **trước** firmware mỗi lần cắm điện. Việc duy nhất của
  nó: hỏi "có ai muốn gửi firmware mới không?" qua USB. Có thì nhận và ghi đè, không thì
  nhảy sang firmware.
- **DFU** (Device Firmware Upgrade) là chế độ khắc sẵn trong ROM của chính con chip, do nhà
  sản xuất ST làm. Nó luôn có mặt, kể cả khi flash trắng trơn.

**Vì sao lần nạp đầu khác mọi lần sau.** Bo mới về đang chạy firmware Betaflight, không có
bootloader của ArduPilot. Mission Planner không nói chuyện được với nó. Nên lần đầu (Phase 14)
phải ép chip vào DFU (giữ nút BOOT khi cắm USB) và ghi **cả bootloader lẫn firmware** bằng
STM32CubeProgrammer. Từ lần sau, bootloader ArduPilot đã nằm sẵn, Mission Planner tự nạp
firmware mới qua USB, không cần nút BOOT.

## 2. Vì sao file tên là `_with_bl.hex`

`bl` = **b**oot**l**oader. Thư mục `firmware/ardupilot/build-d450a747/` có hai file nạp được:

| File | Chứa | Dùng khi |
|---|---|---|
| `arducopter_with_bl.hex` | bootloader **+** firmware | **Lần đầu**, qua DFU (Phase 14) |
| `arducopter.apj` | chỉ firmware | Các lần **cập nhật sau**, qua Mission Planner |

Nạp nhầm `.apj` lần đầu: không có bootloader để nhận nó, không chạy. Nạp `_with_bl.hex` ở
lần sau: được, nhưng thừa công. Hai file nhị phân này **không** được commit (nặng, và tải lại
được), chỉ có `NOTES.md`, `build.log`, `extra_hwdef.dat`, `custombuild.yaml` được commit.

## 3. Custom build, và giới hạn 1 MB flash

ArduPilot có khoảng 410 tính năng chọn được: driver cho hàng chục loại GPS, la bàn, cảm biến
khoảng cách, giao thức tay điều khiển, mode bay... Nhét hết vào 1 MB flash của F405 là
không vừa. Nên bản **stock** (bản dựng sẵn trên firmware.ardupilot.org) cho bo này đã bị cắt
còn 110 tính năng — và bị cắt đúng mấy thứ dự án cần: `PROXIMITY`, path planner tránh vật cản.

**Custom build** là tự chọn danh sách tính năng rồi để server
[custom.ardupilot.org](https://custom.ardupilot.org) biên dịch riêng cho mình. Bản của dự án:
tắt 62 tính năng không dùng (OSD, VTX, CRSF, SBUS, driver GPS NMEA...) để lấy chỗ, rồi bật
thêm 6 cái bản stock không có, còn 54 tính năng. Kết quả vẫn còn trống ≈ 234 KB.

Hệ quả thực tế: **muốn bật tính năng mới thì phải tắt tính năng khác trước**. Đây là cân đo,
không phải "tick thêm cho chắc". File `.yaml` trong `firmware/ardupilot/custombuild/` là công
thức của bản build — kéo thả vào trang web là tick lại đủ 54 ô. Nó **không** phải file nạp vào
bo bay.

## 4. Parameter là gì, khác firmware ra sao

Firmware là **chương trình**. Parameter là **cài đặt** của chương trình đó, khoảng 1.370 công
tắc nhỏ dạng `TÊN,giá_trị`, lưu trong bộ nhớ riêng của bo bay:

```text
FRAME_CLASS,1       khung loại 1 = quad
BATT_CAPACITY,5300  pin 5300 mAh
SERIAL4_PROTOCOL,5  cổng serial 4 là GPS
```

| | Firmware | Parameter |
|---|---|---|
| Đổi bằng cách | Nạp file `.hex`/`.apj` | Sửa trong Mission Planner, hoặc nạp file `.param` |
| Cần nạp lại firmware? | — | **Không** |
| Mất khi nạp firmware mới? | — | Thường **giữ lại** |
| Quyết định | Drone **có thể** làm gì | Drone **đang được cài** làm gì |

Ví dụ rõ nhất: firmware có hay không có tính năng proximity quyết định param `PRX1_TYPE` có
tồn tại hay không. Nạp `PRX1_TYPE,4` vào bản stock, Mission Planner báo "parameter not found"
— lỗi nằm ở firmware, không phải ở file param. Đó là lý do bước kiểm đầu tiên ở Phase 14 là
tìm `PRX1_TYPE` trong Full Parameter List.

Một điều bất ngờ đã đo được trên drone ảo: gửi một tên param **không tồn tại**, ArduPilot
**không báo lỗi gì**, chỉ im lặng bỏ qua. Nên "nạp xong không thấy lỗi" chưa chứng minh gì cả.
Phải mở Full Parameter List và tìm lại đúng tên đó.

## 5. Hai loại file param — và ba luật

| Loại | Ví dụ | Ai tạo | Có nạp vào bo? |
|---|---|---|---|
| **File người viết** | `01-base.param`, `02-avoid-tfmini.param` | Viết tay, có chú thích vì sao | **Có** |
| **Snapshot** | `00-after-flash.param`, `05-loiter-good.param`... | Bo bay xuất ra (Save to file) | Chỉ nạp lại **vào chính con drone đã xuất ra nó** |

Ba luật, vì đây là chỗ dễ làm hỏng drone nhất:

1. **Không bao giờ nạp snapshot của con drone khác.** Snapshot chứa số hiệu chỉnh riêng của
   từng con (gia tốc kế, la bàn, dải tay điều khiển). Dán số của máy khác = bay lệch, hoặc không bay.
2. **Ba nhóm không bao giờ nạp bằng file**, luôn chạy wizard: `RC*_MIN/MAX/TRIM` (Radio
   Calibration), `COMPASS_OFS*/DIA*` (Compass Calibration), `INS_ACC*` (Accel Calibration).
3. **Mỗi commit file param ghi rõ đã đổi tham số nào và vì sao**, prefix `param:`.

Bảng đầy đủ file nào sinh ra ở phase nào: [`params/README.md`](../../firmware/ardupilot/params/README.md).

**Thứ tự nạp** (Phase 14 trở đi): nạp firmware → **Save to file** thành `00-after-flash.param`
trước khi chạm bất cứ gì → nạp `01-base.param` → reboot → nạp `02-avoid-tfmini.param` → reboot
→ nạp lại `02-avoid-tfmini.param` lần nữa (nhóm `RNGFND1_*` chỉ hiện ra sau reboot đầu).

## 6. Bitmask — một con số, nhiều công tắc

Một số param không phải là "một giá trị" mà là **nhiều công tắc bật/tắt gộp lại**. Mỗi công
tắc là một **bit**, có giá trị 1, 2, 4, 8, 16... (lũy thừa của 2). Con số thập phân bạn ghi
vào param là **tổng các công tắc đang bật**.

**`RC_PROTOCOLS,4`** — chọn giao thức tay điều khiển:

```text
bit:     0     1     2      3      4    ...   18
giá trị: 1     2     4      8      16   ...   262144
nghĩa:   All   PPM   IBUS   SBUS   ...        SITL UDP (RC ảo)

4 = chỉ bit 2 = chỉ iBUS
```

Receiver FlySky iA6B nói iBUS, nên chỉ bật đúng iBUS để bo bay không đoán nhầm giao thức.
Trên drone ảo, giá trị này lại làm `PreArm: RC not found`, vì tay điều khiển ảo đi qua bit 18.
Muốn bay SITL phải bật thêm bit 18: 4 + 262144 = **262148**. Số này **chỉ cho SITL**, không
bao giờ nạp lên board thật.

**`AVOID_ENABLE,3`** — tránh vật cản dựa vào nguồn nào:

```text
bit 0 (1) = dùng hàng rào (fence)
bit 1 (2) = dùng cảm biến proximity
bit 2 (4) = dùng beacon fence

3 = 1 + 2 = fence + proximity
```

Vì bit 0 bật nên `FENCE_ENABLE,1` là **bắt buộc** đi kèm, như file `02-avoid-tfmini.param` ghi.

Đọc ngược một bitmask: trừ dần bit lớn nhất nhỏ hơn con số. `3` → trừ 2 còn 1 → trừ 1 còn 0
→ bật bit 1 và bit 0.

## 7. UART, baud rate, và vì sao TX nối vào RX

**UART** là kiểu nói chuyện nối tiếp đơn giản nhất: hai dây dữ liệu, mỗi dây một chiều.

- **TX** (transmit) = chân **nói**. **RX** (receive) = chân **nghe**.
- Chân nói của thiết bị A phải nối vào chân nghe của thiết bị B, và ngược lại. Nên dây luôn
  **bắt chéo**: TX→RX, RX→TX. Nối TX vào TX là hai cái miệng nói vào nhau, không ai nghe.
- Thêm **GND chung**: hai bên phải cùng mốc 0 V, thiếu dây này thì dữ liệu thành rác.

```text
  TFmini Plus                 Bo bay (UART3 = SERIAL3)
  TXD (dây xanh)  ─────────▶  RX3
  RXD (dây trắng)     ✗       TX3   (để trống: ArduPilot chỉ đọc, không ra lệnh cho cảm biến)
  GND (dây đen)   ─────────── GND
  +5V (dây đỏ)    ─────────── 5V
```

**Baud rate** là tốc độ nói, tính bằng bit mỗi giây. Hai đầu phải **cùng tốc độ**, lệch là
nhận toàn ký tự rác. ArduPilot viết tắt baud trong param: `115` = 115200, `230` = 230400,
`57` = 57600. Ví dụ `SERIAL3_BAUD,115` vì TFmini Plus xuất xưởng ở 115200.

Mỗi cổng serial của bo bay được gán một **vai trò** bằng `SERIALn_PROTOCOL`:

| Cổng | Vai trò | `PROTOCOL` | Baud |
|---|---|---|---|
| SERIAL1 | Module Bluetooth nội bộ, ArduPilot không dùng được | `-1` (tắt) | — |
| SERIAL2 | ESP32 DroneBridge → Wi-Fi về laptop | `2` (MAVLink2) | 115200 |
| SERIAL3 | TFmini Plus | `9` (Rangefinder) | 115200 |
| SERIAL4 | GPS Holybro M10 | `5` (GPS) | 230400 |
| SERIAL5 | ESC telemetry | `16` | *không đặt* — firmware tự ép 115200 |
| SERIAL6 | Receiver iA6B (iBUS) | `23` (RCIN) | — |

Phase 13 và 17 sẽ đi dây đúng theo bảng này.

## 8. Vì sao `OA_TYPE` để 0 lúc đầu

ArduPilot có hai cơ chế tránh vật cản (chi tiết ở [sổ tay 04](04-param-va-tranh-vat-can-ao.md) mục 6):
**AVOID** phanh lại khi bay tay, và **OA path planner** (`OA_TYPE`) tự tìm đường vòng khi bay
tự động.

Path planner BendyRuler (`OA_TYPE,1`) cần biết **xung quanh** có gì để chọn hướng vòng. Dự án
chỉ có **một tia** nhìn thẳng trước, rộng 3,6°. Gặp vật cản, BendyRuler sẽ lách sang trái hoặc
phải — đúng những hướng mà cảm biến **không nhìn thấy**. Tức là né một vật cản đã biết bằng
cách lao vào vùng chưa có dữ liệu.

Nên `02-avoid-tfmini.param` để `OA_TYPE,0` (tắt). Chỉ bật lên 1 ở Phase 22, ngoài bãi rộng,
với vật cản giả, khi đã quen cách drone phản ứng.

## 9. Những điều phase này phát hiện, khác với plan

| Plan ghi | Thực tế | Bằng chứng |
|---|---|---|
| `01-base.param` có 33 dòng, kèm `SERIAL5_BAUD,19` | Khối trong plan có **34** dòng. Đã bỏ `SERIAL5_BAUD` → 33 | Firmware ép 115200 cho cổng ESC telemetry; đo trên SITL ở Phase 04 |
| `.hex` ≈ 2,4–2,5 MB | **2.224.308 byte** | `NOTES.md` — con số trong plan là cỡ file `.tar.gz` |
| SITL sẽ từ chối nhóm `PRX1_*` | SITL **nhận** `PRX1_TYPE` | Runner `run_param_load`, 25/09/2026 |
| (sổ tay 04) `AVOID_ANG_MAX` chắc board thật cũng không có | Board thật **có** | `extra_hwdef.dat`: `define AP_AVOIDANCE_ALTHOLD_ENABLED 1` |
| Lệnh `Compare-Object` với `-match '^\s+- '` | Bắt 0 dòng của yaml trong thư mục build, báo khác 54 dòng dù giống hệt | Dùng `'^\s*- '` + `Trim()` — xem `NOTES.md` |

## Tự chạy lại

```bash
# Nạp 01-base.param + 02-avoid-tfmini.param vào SITL, so từng dòng với mốc (~1 phút)
wsl -d Ubuntu --exec bash -lc 'cd /mnt/d/Coding/IOT-CV && bash scripts/sitl/run-all.sh --chi run_param_load'
```

Runner ghi đè `firmware/ardupilot/params/sitl/00-*.param` và `01-*.param`. Xem `git diff` rồi
mới commit.
