# Research Report: SITL, nạp firmware và toolchain PC cho SpeedyBee F405 V5 (Copter 4.7.1)

**Ngày:** 2026-09-21 · **Máy:** Windows 11 (build 10.0.26200), WSL2 Ubuntu 24.04 (đang `Stopped`, chưa cài gì), Docker Desktop 29.6.2, Python 3.13/3.11/3.8 trên Windows
**Phạm vi:** những việc làm được trên PC **trước khi** phần cứng về (~1 tuần)

---

## Tóm tắt điều hành

Chạy SITL bằng **WSL2 Ubuntu 24.04 build từ nguồn** là lựa chọn số 1 — đây là đường duy nhất cho bạn `sim_vehicle.py` đầy đủ (map + console + MAVProxy), là đường ArduPilot chính thức khuyến nghị cho Windows, và đồng thời cho bạn build lại custom firmware tại chỗ nếu cần sửa. Docker chỉ là môi trường **build**, không phải môi trường chạy SITL tiện tay; binary SITL dựng sẵn chỉ hữu ích như phương án dự phòng.

Về firmware: bạn **đã có sẵn** `arducopter_with_bl.hex` trong `copter-speedybeef4v5-d450a747.tar.gz` — đúng file cần cho lần nạp đầu tiên qua DFU. Không cần tải lại gì.

Một phát hiện cần lưu ý: **README của board và `hwdef.dat` mâu thuẫn về hệ số đo pin** (chi tiết ở §4.5). Đừng tin số nào cả — phải đo đồng hồ rồi hiệu chỉnh.

---

## 1. Chạy ArduCopter SITL trên máy này

### 1.1 Các phương án đã đánh giá

| Phương án | Ưu | Nhược | Rủi ro triển khai |
|---|---|---|---|
| **A. WSL2 Ubuntu 24.04, build từ nguồn** | Đường chính thức ArduPilot cho Windows; có `sim_vehicle.py --map --console`; build được cả SITL lẫn firmware `speedybeef4v5`; Mission Planner nối vào dễ | Tốn ~1 giờ cài lần đầu, ~6–8 GB đĩa (ước tính, xem §1.5) | **Thấp.** WSL2 đã sẵn sàng trên máy |
| **B. Docker (`Dockerfile` trong repo ArduPilot)** | Môi trường sạch, không đụng host | Repo chỉ cấp **môi trường build**, không có đường chạy `sim_vehicle.py` kèm GUI được tài liệu hoá; vẫn phải clone repo; thêm một lớp X11/network | **Trung bình–cao.** Dùng sai mục đích công cụ |
| **C. Binary SITL dựng sẵn từ firmware.ardupilot.org** | Tải 7,2 MB, không build | Chỉ là file `arducopter` ELF Linux-x86_64 trần — **không kèm** `sim_vehicle.py`, không kèm file `.parm` mặc định, không kèm MAVProxy. Vẫn phải có Linux (tức vẫn WSL) | **Cao** cho người mới: phải tự truyền tham số `-M`, `--defaults` |
| **D. SITL native Windows (Cygwin)** | — | Wiki ghi rõ **"These instructions are out-of-date. We recommend Windows users follow the instructions for ... WSL"** | **Loại bỏ** |

### 1.2 Khuyến nghị

> **Hạng 1 — Phương án A (WSL2 build từ nguồn).**
> Lý do: chỉ A mới cho bạn `sim_vehicle.py`, và đó mới là thứ bạn thực sự cần để tập bay, tập Mission Planner, thử `01-base.param` và thử luồng obstacle-avoidance trước khi có phần cứng. A cũng là tiền đề cho việc build lại custom firmware khi bạn đổi feature trong `params/custombuild/*.yaml`.
>
> **Hạng 2 — Phương án C (binary dựng sẵn)** — chỉ dùng nếu build hỏng và bạn cần một con SITL chạy ngay để không kẹt. Vẫn cần WSL.
>
> **Docker: không khuyến nghị** cho mục tiêu chạy SITL. Nếu sau này cần build firmware trong môi trường sạch (ví dụ CI) thì mới dùng.

### 1.3 Các lệnh chính xác — Phương án A

Bước 0 — bật mirrored networking (giúp Mission Planner trên Windows nối vào SITL trong WSL dễ nhất). Tạo/sửa file `C:\Users\Nghaiz\.wslconfig` **trên Windows** (không phải trong WSL):

```ini
[wsl2]
networkingMode=mirrored
```

Rồi trong PowerShell:

```powershell
wsl --shutdown
wsl --update
```

Bước 1 — vào Ubuntu, clone và cài prerequisites:

```bash
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot
cd ardupilot
Tools/environment_install/install-prereqs-ubuntu.sh -y
. ~/.profile
```

> Lưu ý: tài liệu ghi script **không** hỗ trợ các bản Ubuntu đã hết Standard Support (ví dụ 20.04). Ubuntu 24.04 của bạn nằm trong diện được hỗ trợ (Dockerfile chính thức của ArduPilot cũng đang dùng `ubuntu:24.04` làm base — bằng chứng gián tiếp nhưng trực tiếp từ repo).

Bước 2 — checkout đúng nhánh bạn đang nhắm (tuỳ chọn, để SITL khớp firmware 4.7.1):

```bash
git checkout Copter-4.7.1
git submodule update --init --recursive
```

Bước 3 — chạy SITL:

```bash
cd ~/ardupilot/ArduCopter
../Tools/autotest/sim_vehicle.py --map --console --no-wsl2-network
```

`--no-wsl2-network` **bắt buộc khi bạn đã bật `networkingMode=mirrored`**. Nếu bạn KHÔNG bật mirrored (WSL chạy NAT mặc định), bỏ cờ này đi — `sim_vehicle.py` tự phát hiện WSL2 và tự thêm output về IP Windows:

```bash
../Tools/autotest/sim_vehicle.py --map --console
```

Lần chạy đầu `sim_vehicle.py` sẽ tự build — mất thêm thời gian, đây là bình thường.

Lệnh thử ngay trong cửa sổ MAVProxy:

```
mode guided
arm throttle
takeoff 40
mode rtl
```

Build SITL thủ công (không qua `sim_vehicle.py`), nếu cần:

```bash
./waf configure --board=sitl
./waf copter
```

### 1.4 Mission Planner trên Windows nối vào SITL trong WSL2

`sim_vehicle.py` mở sẵn các cổng UDP phụ cho GCS. Gõ trong MAVProxy:

```
output
```

→ liệt kê các cổng, thường là **14550** và **14551**.

- **Có mirrored networking:** WSL dùng chung localhost với Windows. Trong Mission Planner chọn **UDP** (nghe cổng `14550`) → **CONNECT**. Không cần biết IP.
- **Không có mirrored networking (NAT):** thêm output thủ công tới IP Windows. Lấy IP Windows nhìn từ WSL:

  ```bash
  ip route show | grep -i default | awk '{ print $3}'
  ```

  rồi:

  ```bash
  ../Tools/autotest/sim_vehicle.py --map --console --out udp:<IP_WINDOWS>:14550
  ```

  Mission Planner: **UDP**, port `14550`.

Cách nối thứ hai (chắc ăn hơn khi firewall Windows chặn): trong Mission Planner chọn **TCP**, host là IP của WSL, port `5760` (cổng TCP gốc của SITL).

> **Cảnh báo firewall:** lần đầu Mission Planner mở cổng UDP, Windows Defender sẽ hỏi. Phải bấm **Allow** cho cả Private lẫn Public, nếu không gói tin bị nuốt im lặng và bạn sẽ ngồi debug nhầm chỗ.

### 1.5 Dung lượng / thời gian — **ước tính, chưa đo trên máy này**

| Hạng mục | Ước tính | Cơ sở |
|---|---|---|
| Clone repo (kèm submodule) | ~2,5–3,5 GB | GitHub API báo repo bare = **664 MB**; submodule + git history đẩy lên |
| `install-prereqs-ubuntu.sh` (gcc-arm-none-eabi, python deps, v.v.) | ~2,5–3,5 GB | toolchain ARM ~1,5 GB là khoản lớn nhất |
| Build SITL | ~1–1,5 GB | thư mục `build/sitl` |
| **Tổng** | **~6–8 GB** | |
| Thời gian cài prereqs | 20–40 phút | phụ thuộc mạng |
| Build SITL lần đầu | 10–25 phút | |

Đây là **ước tính từ kích thước artifact đã đo, không phải số đo thực tế trên máy bạn**. Hãy để dư ~15 GB cho ổ WSL.

### 1.6 Phương án C — binary dựng sẵn (dự phòng)

```bash
mkdir -p ~/sitl && cd ~/sitl
wget https://firmware.ardupilot.org/Copter/stable-4.7.1/SITL_x86_64_linux_gnu/arducopter
chmod +x arducopter
```

Đã xác thực: file tồn tại, 7.231.384 byte, Last-Modified 2026-09-03. Thư mục cũng có `features.txt` — hữu ích để đối chiếu feature với bản custom build của bạn.

---

## 2. Ground station trên Windows

| Công cụ | Dùng cho việc gì | Cài |
|---|---|---|
| **Mission Planner** | **GCS chính.** Nạp firmware, Full Parameter List, hiệu chỉnh radio/compass/ESC, tải log, Mission planning. Toàn bộ `params/README.md` của dự án bạn viết theo Mission Planner | `.msi` chính thức (bên dưới) |
| **QGroundControl** | Phương án hai khi Mission Planner lỗi; giao diện dễ hơn cho người mới ở phần setup wizard. **Không thay thế được** Mission Planner ở khoản Full Parameter List và nạp custom firmware | trang download chính thức |
| **MAVProxy (Windows)** | Dòng lệnh, script hoá, bắc cầu nhiều GCS cùng lúc, `--out` tới backend của bạn. Cũng là thứ `sim_vehicle.py` dùng bên WSL | `.exe` installer |

Lệnh/URL:

```powershell
# Mission Planner (đã xác thực HTTP 200)
# https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.msi
```

Tài liệu cài đặt ghi rõ: tải `.msi`, chạy, "will automatically install any necessary software drivers"; nếu Windows cảnh báo driver thì chọn **"Install this driver software anyway"**. Mặc định cài vào `C:\Program Files (x86)\Mission Planner`.

```powershell
# MAVProxy trên Windows (đã xác thực HTTP 200)
# https://firmware.ardupilot.org/Tools/MAVProxy/MAVProxySetup-latest.exe
```

MAVProxy trong WSL (tài liệu chính thức, verbatim):

```bash
sudo apt-get install python3-dev python3-opencv python3-wxgtk4.0 python3-pip python3-matplotlib python3-lxml python3-pygame
python3 -m pip install PyYAML mavproxy --user
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc
```

> **Lưu ý về `winget`:** tôi **không xác minh được** một `winget` package id chính thức cho Mission Planner do ArduPilot phát hành. Dùng `.msi` ở trên. Đừng cài từ nguồn `winget` không rõ publisher cho phần mềm sẽ nạp firmware vào FC.

**Khuyến nghị thứ hạng:** 1) Mission Planner (bắt buộc), 2) MAVProxy (cho SITL + script), 3) QGroundControl (chỉ cài nếu muốn có phương án dự phòng — không bắt buộc).

---

## 3. Nạp ArduPilot lần đầu lên SpeedyBee F405 V5

### 3.1 Bối cảnh

Board xuất xưởng chạy Betaflight. Lần nạp ArduPilot **đầu tiên** phải qua **DFU** vì phải ghi cả bootloader. README của board ghi verbatim:

> "Initial firmware load can be done with DFU by plugging in USB with the bootloader button pressed. Then you should load the **"with_bl.hex"** firmware, using your favourite DFU loading tool."

### 3.2 File cần — bạn đã có

Đã kiểm tra `copter-speedybeef4v5-d450a747.tar.gz` trong repo, nội dung:

```
copter-speedybeef4v5-d450a747/arducopter_with_bl.hex   <-- dùng file NÀY cho DFU
copter-speedybeef4v5-d450a747/arducopter.apj           <-- dùng cho các lần update SAU
copter-speedybeef4v5-d450a747/arducopter.bin
copter-speedybeef4v5-d450a747/arducopter
copter-speedybeef4v5-d450a747/build.log
copter-speedybeef4v5-d450a747/extra_hwdef.dat
copter-speedybeef4v5-d450a747/custombuild.yaml
```

Giải nén ra trước:

```powershell
tar -xzf D:\Coding\IOT-CV\copter-speedybeef4v5-d450a747.tar.gz -C D:\Coding\IOT-CV\firmware\
```

Bản stock 4.7.1 (nếu cần đối chiếu, đã xác thực tồn tại):
`https://firmware.ardupilot.org/Copter/stable-4.7.1/speedybeef4v5/arducopter_with_bl.hex` — 2.485.180 byte.

### 3.3 Quy trình (theo wiki chính thức)

1. **Cài STM32CubeProgrammer** — wiki chỉ định đúng công cụ này vì nó kèm luôn **driver DFU** cho Windows. (Có thể cần Java.)
2. **Vào DFU:** giữ nút BOOT trên board (hoặc nối tắt 2 pad `BOOT`) → **rồi** cắm USB → thả nút sau khi board có điện.
3. **Xác nhận:** Device Manager (Windows) phải hiện **"STM32 BOOTLOADER"** dưới mục **"Universal Serial Bus devices"**. Không thấy → xem §3.4.
4. **Nạp:** mở STM32CubeProgrammer → chọn kiểu kết nối **USB** → **Connect** (phải thấy cổng USB) → **Open file** → chọn `arducopter_with_bl.hex` → **Download**.
5. **Khởi động lại board**, rút cắm USB.

### 3.4 Vấn đề driver trên Windows (Zadig)

Nếu Device Manager hiện thiết bị lạ / dấu chấm than thay vì "STM32 BOOTLOADER":

- Cách ưu tiên: cài (hoặc cài lại) STM32CubeProgrammer — nó mang driver DFU chuẩn của ST.
- Chỉ khi cách trên thất bại mới dùng **Zadig** (`https://zadig.akeo.ie/`) gán driver **WinUSB** cho thiết bị `STM32 BOOTLOADER`, rồi nạp bằng `dfu-util`.

> ⚠️ **Zadig là con dao hai lưỡi.** Sau khi Zadig thay driver thành WinUSB, **STM32CubeProgrammer có thể không còn nhận board**. Đừng chạy Zadig "cho chắc" — chỉ chạy khi đã thực sự bế tắc, và nhớ đường quay lui (Device Manager → Uninstall device → tick "Delete the driver software" → rút cắm lại).

### 3.5 Ba cách nạp — xếp hạng

| Cách | Khi nào | Đánh giá |
|---|---|---|
| **STM32CubeProgrammer** | Lần nạp ĐẦU TIÊN (Betaflight → ArduPilot) | **Hạng 1** — đúng theo wiki, kèm driver |
| **Mission Planner "Load custom firmware"** | Các lần **sau**, dùng file `.apj` | **Hạng 2** — không dùng cho lần đầu vì cần ghi bootloader |
| **`dfu-util`** | Chỉ khi CubeProgrammer hỏng, và đã Zadig | **Hạng 3** — cho người đã quen |

> **Không nạp qua WSL.** Wiki nói thẳng: *"Microsoft's solution of providing USB access to WSL2 via usbipd does not work for accessing the bootloader on the device due to slow mounting times."* Nạp firmware **luôn làm từ Windows**.

### 3.6 Kiểm tra sau khi nạp

1. Cắm USB (không giữ BOOT). Device Manager phải hiện một **COM port** mới.
2. Mission Planner → chọn COM port → **CONNECT**. Phải thấy HUD.
3. **Messages tab**: dòng banner phải ghi `ArduCopter V4.7.1` và board `SpeedyBeeF405V5`.
4. **Full Parameter List** → tìm `PRX1_TYPE`. **Có nhóm `PRX_*` = đúng bản custom build**; nếu **không có** thì bạn đã nạp nhầm bản stock và `params/obstacle-avoidance-tfminiplus-serial3.param` sẽ báo "parameter not found" (chính `params/obstacle-avoidance-tfminiplus-serial3.param` đã ghi cảnh báo này).
5. Lưu ngay snapshot: **Full Parameter List → Save to file →** `params/00-after-flash.param`, commit theo quy ước trong `params/README.md`.

### 3.7 Về trang wiki cho `speedybeef4v5`

**Không tồn tại** trang `https://ardupilot.org/copter/docs/common-speedybeef4v5.html` (đã kiểm tra: **HTTP 404**). Tài liệu chính thức cho board này là **README trong hwdef của mã nguồn ArduPilot**:

`https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_HAL_ChibiOS/hwdef/speedybeef4v5/README.md` (đã xác thực 200)

Đừng nhầm với `common-speedybeef405aio.html` hay `common-speedybeef4-v3.html` — đó là board **khác**, sơ đồ UART khác.

---

## 4. Parameter chính cho build này (Copter 4.7)

### 4.1 Mặc định của board (đọc trực tiếp từ `hwdef.dat` trên nhánh master)

```
SERIAL_ORDER  OTG1 USART1 USART2 USART3 UART4 UART5 USART6
DEFAULT_SERIAL1_PROTOCOL  SerialProtocol_None            (UART1 = module BT nội bộ)
DEFAULT_SERIAL2_PROTOCOL  SerialProtocol_None
DEFAULT_SERIAL3_PROTOCOL  SerialProtocol_MSP_DisplayPort
DEFAULT_SERIAL4_PROTOCOL  SerialProtocol_GPS     DEFAULT_SERIAL4_BAUD 230400
DEFAULT_SERIAL5_PROTOCOL  SerialProtocol_ESCTelemetry    DEFAULT_SERIAL5_BAUD 19200
DEFAULT_SERIAL6_PROTOCOL  SerialProtocol_RCIN
HAL_BATT_MONITOR_DEFAULT  4
HAL_BATT_VOLT_PIN 11   HAL_BATT_VOLT_SCALE 11.0
HAL_BATT_CURR_PIN 15   HAL_BATT_CURR_SCALE 25.0
```

Tin tốt: **phân bổ UART bạn đã chọn trùng khít với mặc định của board** — SERIAL4 = GPS, SERIAL5 = ESC telem, SERIAL6 = RCIN. Phần lớn `01-base.param` chỉ là ghi lại cho tường minh chứ không phải ép đổi.

### 4.2 Giá trị enum — đã xác minh từ mã nguồn ArduPilot

| Param | Giá trị | Nguồn (verbatim từ mã nguồn) |
|---|---|---|
| `SERIALn_PROTOCOL` | `2`=MAVLink2, `5`=GPS, `9`=Rangefinder, `16`=ESC Telemetry, `23`=RCIN | `AP_SerialManager.cpp` dòng 188 |
| `MOT_PWM_TYPE` | `5`=DShot300, `6`=DShot600 | `AP_MotorsMulticopter.cpp` dòng 95 |
| `RC_PROTOCOLS` | bitmask `0:All,1:PPM,**2:IBUS**,3:SBUS,...` → **iBUS = bit 2 = giá trị `4`** | `RC_Channels_VarInfo.h` dòng 104 |
| `GPS1_TYPE` | `1`=AUTO, `2`=uBlox | `AP_GPS.cpp` dòng 2062 |
| `BATT_MONITOR` | `4`=Analog Voltage and Current | `AP_BattMonitor_Params.cpp` |

> ⚠️ `GPS_TYPE` **đã đổi tên thành `GPS1_TYPE` từ 4.6 trở đi** (ghi rõ trong mã: *"Renamed in 4.6 and later to GPS1_TYPE"*). Tương tự `RNGFND1_MIN_CM`/`MAX_CM` đã thành `RNGFND1_MIN`/`MAX` tính bằng **mét** — file `params/obstacle-avoidance-tfminiplus-serial3.param` của bạn đã dùng đúng dạng mới (`RNGFND1_MIN,0.1`).

### 4.3 DShot cho OX32 4in1

README board: *"Channels within the same group need to use the same output rate. If any channel in a group uses DShot then all channels in the group need to use DShot. **Channels 1-4 support bi-directional DShot**."* M1–M4 nằm ở group1 (PWM 1-2) và group2 (PWM 3-4) — cả 4 motor đều DShot được.

**Khuyến nghị: bắt đầu bằng `MOT_PWM_TYPE,5` (DShot300), KHÔNG phải 600.** Lý do: DShot300 dung sai tín hiệu tốt hơn trên dây signal dài/nhiễu của stack, và bạn không cần băng thông của 600 cho quad S500 bay tập. Nâng lên 6 sau khi đã bay ổn, nếu muốn.

Bi-directional DShot (`SERVO_BLH_BDMASK`) cho RPM notch — **để sau**, sau chuyến bay đầu. Bạn đã có ESC telemetry trên SERIAL5 làm nguồn RPM rồi (đúng như ghi chú trong `custombuild` yaml: *"da co RPM notch tu ESC telemetry nen khong can"* GyroFFT).

### 4.4 Compass ngoài IST8310

Board **không có compass tích hợp** (README: *"does not have a builtin compass, but you can attach an external compass using I2C on the SDA and SCL pads"*). Holybro M10 mang compass trên I2C.

Không đặt cứng driver bằng param — ArduPilot tự dò trên I2C. Việc của bạn:
- `COMPASS_ENABLE,1`
- Hiệu chỉnh **sau khi lắp lên khung** (Mission Planner → Setup → Mandatory Hardware → Compass → Onboard Mag Calibration).
- `COMPASS_ORIENT` để ArduPilot tự suy ra trong quá trình calibrate; chỉ chỉnh tay nếu calibrate báo lỗi orientation.
- **Không** đặt `COMPASS_PRIO*_ID` bằng tay — các ID này chỉ sinh ra sau khi board thực sự nhìn thấy sensor.

### 4.5 ⚠️ Mâu thuẫn về hệ số đo pin — phải tự đo

| Nguồn | `BATT_VOLT_MULT` | `BATT_AMP_PERVLT` |
|---|---|---|
| README của board (mục "Battery Monitoring") | **11.2** | **1** |
| `hwdef.dat` master (`HAL_BATT_VOLT_SCALE` / `HAL_BATT_CURR_SCALE`) | **11.0** | **25.0** |

Hai nguồn chính thức nói khác nhau. `hwdef.dat` là thứ **thực sự compile vào firmware**, nên tôi tin `hwdef.dat` hơn — nhưng **đừng tin con nào cả**: sau khi lắp, đo điện áp pin bằng đồng hồ vạn năng rồi dùng chức năng hiệu chỉnh trong Mission Planner (Setup → Optional Hardware → Battery Monitor → "Measured battery voltage") để nó tự tính lại `BATT_VOLT_MULT`. Dòng điện thì hiệu chỉnh sau bằng cách so với điện năng nạp vào pin.

**Pin 4S:** `BATT_LOW_VOLT` 14.0 V (3.5 V/cell), `BATT_CRT_VOLT` 13.2 V (3.3 V/cell) — đây là ngưỡng bảo thủ cho pin mới; siết lại sau khi biết sụt áp thực tế của bộ pin. `BATT_CAPACITY` điền đúng mAh ghi trên pin.

### 4.6 Bản nháp `params/01-base.param`

```
# 01-base.param - cau hinh nen truoc chuyen bay dau
# Board: SpeedyBee F405 V5 | ArduCopter 4.7.1 CUSTOM BUILD (custom.ardupilot.org)
# Nap SAU khi 00-after-flash.param da luu.
# Cach load: Mission Planner -> Config/Tuning -> Full Parameter List
#            -> Load from file -> Write Params -> reboot FC
#
# CHUA bao gom: obstacle avoidance (xem obstacle-avoidance-tfminiplus-serial3.param)
#               radio calibration, compass calibration, ESC calibration
#               -> ba thu do PHAI lam bang wizard, khong nap bang file param.

# ---------- khung ----------
# FRAME_CLASS 1 = Quad, FRAME_TYPE 1 = X  (khung S500)
FRAME_CLASS,1
FRAME_TYPE,1

# ---------- cong serial ----------
# SERIAL1 = module Bluetooth noi bo, ArduPilot KHONG dung duoc -> de None
SERIAL1_PROTOCOL,-1

# SERIAL2 = danh cho ESP32 MAVLink bridge (DOT 3, chua lap).
# UART2 la cong duy nhat co DMA. De 2 = MAVLink2 san.
SERIAL2_PROTOCOL,2
SERIAL2_BAUD,57

# SERIAL3 = TFmini Plus (nap tu file obstacle-avoidance-*.param, ghi lai o day de doi chieu)
# Mac dinh cua board la MSP DisplayPort nhung ban custom build da TAT OSD/MSP.
SERIAL3_PROTOCOL,9
SERIAL3_BAUD,115

# SERIAL4 = GPS Holybro M10 (u-blox). 5 = GPS, baud 230 = 230400 (mac dinh cua board)
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
# PHAI chay Onboard Mag Calibration SAU khi lap len khung.
COMPASS_ENABLE,1
COMPASS_USE,1

# ---------- motor / ESC ----------
# 5 = DShot300. Bat dau bang 300 (dung sai nhieu tot hon 600).
# Nang len 6 = DShot600 SAU khi da bay on, neu muon.
MOT_PWM_TYPE,5
# So cuc nam cham cua motor. 14 la mac dinh, dung cho HAU HET motor 2212/2216.
# KIEM TRA datasheet motor thuc te; sai so nay -> RPM telemetry sai.
SERVO_BLH_POLES,14
# 10Hz du cho hien thi; nang len 100 khi bat harmonic notch theo RPM.
SERVO_BLH_TRATE,10

# ---------- pin 4S ----------
# 4 = Analog Voltage and Current (mac dinh cua board)
BATT_MONITOR,4
# CANH BAO: README board ghi VOLT_MULT 11.2 / AMP_PERVLT 1,
#           nhung hwdef.dat ghi 11.0 / 25.0. Hai nguon MAU THUAN.
#           Dat theo hwdef roi PHAI hieu chinh bang dong ho van nang:
#           Mission Planner -> Setup -> Optional Hardware -> Battery Monitor
#           -> go dien ap do duoc vao o "Measured battery voltage".
BATT_VOLT_MULT,11.0
BATT_AMP_PERVLT,25.0
# Dien dung THUC TE cua pin, doi theo pin ban mua.
BATT_CAPACITY,5000
# Nguong 4S: 3.5V/cell = 14.0V (canh bao), 3.3V/cell = 13.2V (nguy hiem).
# Bao thu cho pin moi; siet lai sau khi biet sut ap thuc te.
BATT_LOW_VOLT,14.0
BATT_CRT_VOLT,13.2
BATT_LOW_MAH,1000
BATT_FS_LOW_ACT,2
BATT_FS_CRT_ACT,1
# Bo qua kiem tra dien ap pin luc khoi dong o lan dau tien de tranh
# bao loi nham khi chua hieu chinh xong. DAT LAI 0 sau khi calib xong.
BATT_ARM_VOLT,0

# ---------- failsafe co ban ----------
FS_THR_ENABLE,1
FS_EKF_ACTION,1
FS_GCS_ENABLE,0

# ---------- log ----------
# Board co 16MB dataflash. Ghi log ngay tu khi cam dien (khong doi arm)
# de bat duoc loi luc khoi dong.
LOG_BITMASK,176126
LOG_DISARMED,1
```

**Điều KHÔNG nên nạp bằng file param** — bắt buộc chạy wizard trong Mission Planner:
`RC*_MIN/MAX/TRIM` (Radio Calibration) · `COMPASS_OFS*`, `COMPASS_DIA*` (Compass Calibration) · `INS_ACC*` (Accel Calibration) · ESC calibration. Nạp bằng file sẽ dán giá trị của một con drone khác lên drone của bạn.

---

## 5. Cài gì lên PC ngay bây giờ (trước khi hàng về)

Thứ tự ưu tiên:

**Bắt buộc (làm ngay):**

```powershell
# 1. Mission Planner
Start-Process "https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.msi"

# 2. STM32CubeProgrammer - tim tren st.com, can tai khoan ST mien phi
#    (URL trang san pham KHONG xac thuc duoc tu day, xem muc "URL khong xac thuc")

# 3. MAVProxy tren Windows
Start-Process "https://firmware.ardupilot.org/Tools/MAVProxy/MAVProxySetup-latest.exe"

# 4. pymavlink cho backend Python cua ban
py -3.11 -m pip install --upgrade pymavlink
```

> Dùng **Python 3.11**, không phải 3.13. `pymavlink` và `MAVProxy` có phần build C (`mavnative`) và các wheel dựng sẵn thường trễ so với bản Python mới nhất — 3.11 là điểm an toàn. Bạn đã có sẵn 3.11 trên máy.

**WSL2 (song song, tốn thời gian nhất nên bắt đầu sớm):**

```powershell
wsl --update
wsl -d Ubuntu
```

rồi trong Ubuntu chạy khối lệnh ở §1.3.

**Công cụ xem log (cài sau cũng được, chưa có log để xem):**

| Công cụ | Cài | Dùng cho |
|---|---|---|
| **UAV Log Viewer** (web, không cần cài) | `https://plotbeta.ardupilot.org/` (đã xác thực 200) | Xem `.bin` log nhanh, kéo thả trên trình duyệt. Tốt nhất cho người mới |
| **MAVExplorer** (đi kèm MAVProxy) | đã có sau khi cài MAVProxy | Phân tích sâu, đồ thị nhiều biến, script hoá |
| **Mission Planner log review** | đã có | Tải log từ FC qua USB + xem luôn |

**Không cần cài lúc này:** QGroundControl (chỉ khi muốn dự phòng) · Zadig (chỉ tải khi driver DFU hỏng — xem §3.4) · `dfu-util`.

**Việc làm được ngay khi chưa có phần cứng:**

1. Chạy SITL, tập Mission Planner: arm/disarm, đổi mode, vẽ mission, xem log.
2. **Nạp thử `01-base.param` + `obstacle-avoidance-tfminiplus-serial3.param` vào SITL.** SITL không có PRX_* của bản custom build nên một số param sẽ báo lỗi — đó chính là thông tin hữu ích: bạn biết trước param nào phụ thuộc custom build.
3. Giải nén `copter-speedybeef4v5-d450a747.tar.gz`, đọc `build.log` và `features.txt` để xác nhận feature đã build đúng ý.
4. Viết và test backend MAVLink của bạn **nối vào SITL** — không cần drone thật.

---

## Hạn chế của báo cáo này

- **Số liệu dung lượng/thời gian ở §1.5 là ước tính**, suy ra từ kích thước artifact đã đo (repo 664 MB, SITL binary 7,2 MB), **không phải đo thực tế trên máy bạn**. Sai số có thể ±50%.
- **Không có `winget` id chính thức** nào cho Mission Planner được xác minh. Kết luận này là về **phạm vi tìm kiếm của tôi** (web search + trang cài đặt chính thức của ArduPilot), không phải bằng chứng rằng nó không tồn tại.
- **Mâu thuẫn `BATT_VOLT_MULT`** ở §4.5 chưa giải quyết được từ tài liệu — chỉ giải quyết được bằng đồng hồ vạn năng trên phần cứng thật.
- Tôi **không xác minh** được ESC OX32 4in1 hỗ trợ giao thức telemetry nào (BLHeli_32 / AM32 / KISS) — bạn cần kiểm tra tài liệu của ESC. `SERVO_BLH_POLES,14` và `SERIAL5_BAUD,19` là mặc định phổ biến, không phải giá trị đã xác nhận cho ESC cụ thể này.
- Trang wiki riêng cho `speedybeef4v5` **không tồn tại**; mọi thông tin board lấy từ README hwdef trong mã nguồn.
- Phương án Docker tôi **không chạy thử**, chỉ đọc `Dockerfile` + `BUILD.md`.

---

## Nguồn — đã xác thực HTTP 200 (2026-09-21)

**ArduPilot — board & firmware**
- [SpeedyBee F405 v5 hwdef README](https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_HAL_ChibiOS/hwdef/speedybeef4v5/README.md) — tài liệu board chính thức
- [Firmware stable-4.7.1 cho speedybeef4v5](https://firmware.ardupilot.org/Copter/stable-4.7.1/speedybeef4v5/) — chứa `arducopter_with_bl.hex`, `arducopter.apj`
- [Loading Firmware onto boards without existing ArduPilot firmware](https://ardupilot.org/copter/docs/common-loading-firmware-onto-chibios-only-boards.html)
- [custom.ardupilot.org](https://custom.ardupilot.org/) — custom build server

**SITL / build**
- [SITL on Windows using WSL](https://ardupilot.org/dev/docs/sitl-on-windows-wsl.html)
- [Setting up the Build Environment (Windows 11 + WSL)](https://ardupilot.org/dev/docs/building-setup-windows11.html)
- [Setting up the Build Environment (Linux/Ubuntu)](https://ardupilot.org/dev/docs/building-setup-linux.html)
- [Setting Up SITL — landing page](https://ardupilot.org/dev/docs/SITL-setup-landingpage.html)
- [Using SITL](https://ardupilot.org/dev/docs/using-sitl-for-ardupilot-testing.html)
- [SITL native on Windows (đã lỗi thời — trang tự ghi vậy)](https://ardupilot.org/dev/docs/sitl-native-on-windows.html)
- [BUILD.md (waf + Docker)](https://github.com/ArduPilot/ardupilot/blob/master/BUILD.md)
- [Dockerfile](https://github.com/ArduPilot/ardupilot/blob/master/Dockerfile) — base `ubuntu:24.04`
- [Binary SITL dựng sẵn x86_64 linux](https://firmware.ardupilot.org/Copter/stable-4.7.1/SITL_x86_64_linux_gnu/)
- [Pre-built binaries](https://ardupilot.org/dev/docs/pre-built-binaries.html)
- [Docker Hub: ardupilot/ardupilot-dev-chibios](https://hub.docker.com/r/ardupilot/ardupilot-dev-chibios)

**Ground station / tooling**
- [Mission Planner Installation](https://ardupilot.org/planner/docs/mission-planner-installation.html)
- [MissionPlanner-latest.msi](https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.msi)
- [MAVProxy Download & Installation](https://ardupilot.org/mavproxy/docs/getting_started/download_and_installation.html)
- [MAVProxySetup-latest.exe](https://firmware.ardupilot.org/Tools/MAVProxy/MAVProxySetup-latest.exe)
- [QGroundControl Download & Install](https://docs.qgroundcontrol.com/master/en/qgc-user-guide/getting_started/download_and_install.html)
- [pymavlink trên PyPI](https://pypi.org/project/pymavlink/) · [MAVProxy trên PyPI](https://pypi.org/project/MAVProxy/)
- [UAV Log Viewer (web)](https://plotbeta.ardupilot.org/) · [UAVLogViewer repo](https://github.com/ArduPilot/UAVLogViewer) · [wiki](https://ardupilot.org/copter/docs/common-uavlogviewer.html)
- [MAVExplorer for log analysis](https://ardupilot.org/dev/docs/using-mavexplorer-for-log-analysis.html)
- [Zadig](https://zadig.akeo.ie/)
- [WSL networking (Microsoft)](https://learn.microsoft.com/en-us/windows/wsl/networking)

**Parameter / cảm biến**
- [Benewake TFmini / TFmini Plus lidar](https://ardupilot.org/copter/docs/common-benewake-tfmini-lidar.html)
- [ESC Telemetry](https://ardupilot.org/copter/docs/common-esc-telemetry.html)
- [Copter Parameters (toàn bộ)](https://ardupilot.org/copter/docs/parameters.html)
- [Initial Setup](https://ardupilot.org/copter/docs/initial-setup.html) · [Configuring Hardware](https://ardupilot.org/copter/docs/configuring-hardware.html)
- [ESC Calibration](https://ardupilot.org/copter/docs/esc-calibration.html)
- [Compass Calibration in Mission Planner](https://ardupilot.org/copter/docs/common-compass-calibration-in-mission-planner.html)
- [Connect ESCs and Motors](https://ardupilot.org/copter/docs/connect-escs-and-motors.html)
- [Common RC Systems](https://ardupilot.org/copter/docs/common-rc-systems.html)
- [Downloading and Analyzing Data Logs in Mission Planner](https://ardupilot.org/copter/docs/common-downloading-and-analyzing-data-logs-in-mission-planner.html)

**Mã nguồn tra cứu trực tiếp (raw.githubusercontent.com, nhánh `master`)**
- `libraries/AP_HAL_ChibiOS/hwdef/speedybeef4v5/hwdef.dat` — mặc định SERIAL/BATT của board
- `libraries/AP_SerialManager/AP_SerialManager.cpp` dòng 188 — enum `SERIALn_PROTOCOL`
- `libraries/AP_Motors/AP_MotorsMulticopter.cpp` dòng 95 — enum `MOT_PWM_TYPE`
- `libraries/RC_Channel/RC_Channels_VarInfo.h` dòng 104 — bitmask `RC_PROTOCOLS`
- `libraries/AP_GPS/AP_GPS.cpp` dòng 2062 — enum `GPS1_TYPE`

## URL KHÔNG xác thực được

| URL | Kết quả | Ghi chú |
|---|---|---|
| `https://ardupilot.org/copter/docs/common-speedybeef4v5.html` | **404** | Trang này **không tồn tại**. Dùng README hwdef thay thế |
| `https://ardupilot.org/dev/docs/sitl-with-wsl2.html` | **404** | Tên đúng là `sitl-on-windows-wsl.html` |
| `https://www.st.com/en/development-tools/stm32cubeprog.html` | **000** (kết nối bị chặn) | st.com chặn tự động hoá. Không phải bằng chứng trang hỏng — mở bằng trình duyệt. Tìm "STM32CubeProgrammer" trên st.com, cần tài khoản ST miễn phí |
| `winget` package id cho Mission Planner | không tìm thấy | Dùng `.msi` chính thức |
| `https://github.com/ArduPilot/ardupilot/blob/master/docker_build_sitl.sh` | **404** | Script này **không tồn tại** trong repo. Docker chỉ qua `Dockerfile` + `BUILD.md` |

---

**Status:** DONE_WITH_CONCERNS
**Concerns:** (1) mâu thuẫn `BATT_VOLT_MULT` 11.0 vs 11.2 giữa hai nguồn chính thức — chỉ giải được bằng đồng hồ vạn năng; (2) số liệu dung lượng/thời gian là ước tính chưa đo thực tế; (3) không xác minh được giao thức telemetry của ESC OX32 4in1 nên `SERVO_BLH_POLES`/`SERIAL5_BAUD` chỉ là mặc định phổ biến; (4) trang st.com không truy cập được bằng công cụ tự động.
