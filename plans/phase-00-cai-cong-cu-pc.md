# Phase 00: Cài công cụ trên Windows

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | – | ~2,5 giờ | Không |

## Mục tiêu

Cài đủ mọi phần mềm chạy trên Windows mà cả dự án sẽ dùng, và kiểm chứng từng cái bằng một lệnh in ra số phiên bản. Sau phase này bạn mở được Mission Planner, gõ được `uv`, `pnpm`, `esptool` trong PowerShell, Docker Desktop đang chạy, và WSL2 Ubuntu 24.04 khởi động được.

Phase này **không sửa một file nào trong repo**. Nó chỉ cài phần mềm lên máy. Mọi phase sau đều giả định các lệnh ở đây gõ được.

## Đầu vào cần có

Phải đọc trước:

- `plans/README.md` — hiểu 25 phase và hai luồng trước khi bắt tay.
- `plans/reports/260921-research-sitl-firmware-toolchain.md` §2 (Mission Planner / MAVProxy / STM32CubeProgrammer) và §5 (danh sách cài ngay).
- `plans/reports/260921-research-esp32-bridge-camera.md` §2 (winget id đã kiểm chứng, esptool v5 đổi cú pháp).

Phải có sẵn (đã xác nhận trên máy này ngày 21/09/2026):

- Windows 11, quyền cài phần mềm.
- Python 3.13 và Python 3.11, Node 24, pnpm 11, Docker Desktop, `uv` 0.12.
- WSL2 với Ubuntu 24.04 đã đăng ký (đang trống, chưa cài gì).
- Mạng ổn định, ~3 GB tải về cho riêng phase này.

## File và thư mục sở hữu

**Không có.** Phase này chỉ cài phần mềm hệ thống. File duy nhất được sửa là `plans/PROGRESS.md` (tick checkbox mục Phase 00).

Nếu bạn thấy mình sắp sửa bất kỳ file nào khác trong repo — dừng lại, việc đó thuộc Phase 01.

## Việc theo thứ tự

### 00.1 Kiểm kê thứ đã có sẵn

Trước khi cài gì, xác nhận những thứ được cho là đã có thật sự có. Mỗi dòng phải in ra một số phiên bản; dòng nào báo lỗi thì đó là việc cần làm thêm.

Chạy ở **PowerShell (Windows)**:

```powershell
py --list
node --version
pnpm --version
uv --version
docker --version
docker info --format "{{.ServerVersion}}"
wsl --list --verbose
git --version
```

Kết quả mong đợi:

- `py --list` liệt kê cả `-V:3.13` lẫn `-V:3.11`.
- `node --version` in `v24.x.x`; `pnpm --version` in `11.x.x`.
- `uv --version` in `uv 0.12.x`.
- `docker info --format ...` in ra số phiên bản server (nếu in lỗi nghĩa là Docker Desktop chưa khởi động, không phải chưa cài).
- `wsl --list --verbose` hiện một dòng `Ubuntu ... Stopped ... 2`. Cột cuối phải là **2** (WSL2), không phải 1.

Nếu lỗi:

1. **`py --list` không có `3.11`** → `winget install Python.Python.3.11`. Backend bắt buộc 3.11 vì `pymavlink`/`MAVProxy` có phần biên dịch C, wheel dựng sẵn thường ra chậm với bản Python mới nhất.
2. **`docker info` báo `error during connect`** → mở Docker Desktop từ Start Menu, đợi biểu tượng cá voi hết quay, chạy lại.
3. **`wsl --list --verbose` cột VERSION là `1`** → `wsl --set-version Ubuntu 2`. WSL1 không chạy được ArduPilot SITL.
4. **`pnpm` không nhận diện** → `npm install -g pnpm`, rồi mở lại PowerShell (biến PATH chỉ nạp lúc mở cửa sổ).

### 00.2 Mission Planner — trạm mặt đất chính

Mission Planner là phần mềm bạn sẽ dùng nhiều nhất trong cả dự án: nạp firmware, xem toàn bộ danh sách param, hiệu chỉnh radio và la bàn, vẽ mission, tải log. **Không có công cụ nào thay thế được nó** ở khoản Full Parameter List và nạp custom firmware.

Chạy ở **PowerShell (Windows)**:

```powershell
Start-Process "https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.msi"
```

Lệnh này mở trình duyệt tải file `.msi`. Tải xong, chạy file đó, bấm Next tới hết. Nếu Windows cảnh báo về driver thì chọn **"Install this driver software anyway"** — installer đi kèm driver USB cho các board flight controller, đó là thứ cần thiết.

Mặc định cài vào `C:\Program Files (x86)\Mission Planner`.

**Không cài Mission Planner từ `winget`.** Không có package id chính thức nào do ArduPilot phát hành được kiểm chứng (`plans/reports/260921-research-sitl-firmware-toolchain.md` §2). Đây là phần mềm sẽ ghi firmware vào flight controller — không lấy từ nguồn lạ.

Kết quả mong đợi: mở Mission Planner từ Start Menu, thấy màn hình `FLIGHT DATA` với HUD màu xám và bản đồ. Góc trên bên phải có ô chọn cổng (`COM` / `UDP` / `TCP`) và nút `CONNECT`.

Nếu lỗi:

1. **Cài xong không mở được, báo thiếu .NET** → installer thường tự kéo về; nếu không, tải ".NET Desktop Runtime" từ trang Microsoft và cài, rồi mở lại.
2. **Mở lên màn hình trắng / treo** → chạy bằng chuột phải → `Run as administrator` một lần đầu; Mission Planner cần ghi file cấu hình.
3. **SmartScreen chặn `.msi`** → `More info` → `Run anyway`. File đến từ `firmware.ardupilot.org` là nguồn chính chủ.

### 00.3 MAVProxy (bản Windows)

MAVProxy là trạm mặt đất dòng lệnh. Bạn gõ chữ thay vì bấm nút, nên ghi lại được, script hoá được, và nó nói cho bạn biết chính xác cái gì đang xảy ra thay vì giấu sau giao diện. Ở Phase 03 và 04 bạn sẽ dùng nó song song với Mission Planner.

```powershell
Start-Process "https://firmware.ardupilot.org/Tools/MAVProxy/MAVProxySetup-latest.exe"
```

Tải xong chạy file `.exe`, cài mặc định.

Lưu ý: đây là bản **Windows**. Ở Phase 02 bạn sẽ cài thêm một bản MAVProxy nữa **bên trong WSL** — hai bản khác nhau, không thay thế nhau, và đó là chuyện bình thường.

Kết quả mong đợi: mở PowerShell mới, gõ `mavproxy.exe --version` in ra số phiên bản. (Nếu không nhận diện, tìm `MAVProxy` trong Start Menu — installer tạo một shortcut riêng.)

Nếu lỗi:

1. **Windows Defender chặn file `.exe`** → `More info` → `Run anyway`. Không tải MAVProxy từ nguồn khác để né cảnh báo.
2. **`mavproxy.exe` không nhận diện trong PowerShell** → đường dẫn cài chưa vào PATH. Dùng shortcut trong Start Menu, hoặc thêm thư mục cài vào PATH bằng tay.
3. **Cửa sổ MAVProxy mở rồi tắt ngay** → bình thường khi chạy không có tham số kết nối; nó cần một nguồn MAVLink để nối vào (sẽ có từ Phase 02).

### 00.4 STM32CubeProgrammer — công cụ nạp firmware lần đầu

Board SpeedyBee F405 V5 xuất xưởng chạy Betaflight. Lần nạp ArduPilot **đầu tiên** phải qua chế độ DFU vì phải ghi cả bootloader, và wiki ArduPilot chỉ định đúng công cụ này — lý do chính: nó mang theo **driver DFU chuẩn của ST** cho Windows.

Việc này chỉ thực sự dùng ở **Phase 14**. Nhưng cài ngay bây giờ vì nó cần đăng ký một tài khoản ST miễn phí, và bạn không muốn ngồi chờ email xác thực vào đúng hôm hàng về.

**Không có lệnh tải trực tiếp.** Làm bằng tay:

1. Mở trình duyệt vào `st.com`.
2. Tìm "STM32CubeProgrammer".
3. Đăng ký một tài khoản ST miễn phí (họ gửi link tải qua email).
4. Tải bản Windows, giải nén, chạy installer. Có thể cần Java — installer sẽ báo.

⚠️ URL trang sản phẩm trên `st.com` **chưa xác minh được** bằng công cụ tự động (st.com chặn) — điều đó không có nghĩa trang hỏng, chỉ nghĩa là phải mở bằng trình duyệt tay.

**Chưa cần cài lúc này:** `Zadig` và `dfu-util`. Hai thứ đó chỉ dùng khi driver DFU hỏng ở Phase 14, và Zadig là con dao hai lưỡi — chạy nó "cho chắc" có thể làm STM32CubeProgrammer không nhận board nữa.

Kết quả mong đợi: mở `STM32CubeProgrammer` từ Start Menu, thấy giao diện với ô chọn kiểu kết nối (`ST-LINK` / `UART` / `USB`) ở góc phải trên.

Nếu lỗi:

1. **Installer báo thiếu Java** → cài JRE theo link nó đưa, rồi chạy lại installer.
2. **Không nhận được email từ ST** → kiểm tra hộp thư rác; tài khoản ST đôi khi mất vài chục phút mới kích hoạt.
3. **Không tìm thấy trang tải** → tìm bằng từ khoá "STM32CubeProg" thay vì tên đầy đủ; ST đổi cấu trúc trang khá thường xuyên.

### 00.5 VS Code + PlatformIO và Arduino IDE

Dùng cho firmware ESP32 ở Phase 12 (project camera). PlatformIO được chọn làm chính vì nó ghim được phiên bản thư viện trong `platformio.ini` và đưa được vào CI; Arduino IDE là hạng hai, cài để đọc được các tutorial ESP32-CAM trên mạng.

```powershell
winget install Microsoft.VisualStudioCode
winget install ArduinoSA.IDE.stable
```

Cả hai `winget` id trên đã được kiểm chứng bằng `winget search` trên chính máy Windows 11 này (`plans/reports/260921-research-esp32-bridge-camera.md` §2). Arduino IDE là **tuỳ chọn** — bỏ qua được nếu muốn gọn.

PlatformIO **không có package winget**. Cài như một extension:

1. Mở VS Code.
2. Thanh bên trái → biểu tượng `Extensions` (bốn ô vuông).
3. Gõ `PlatformIO IDE`.
4. Bấm `Install`. Lần đầu nó tự tải toolchain, mất vài phút.

Kiểm chứng:

```powershell
code --version
```

Kết quả mong đợi: `code --version` in 3 dòng (phiên bản, commit hash, kiến trúc). Trong VS Code, thanh trạng thái dưới cùng xuất hiện biểu tượng con kiến của PlatformIO sau khi cài xong.

Nếu lỗi:

1. **`winget` báo không tìm thấy id** → cập nhật "App Installer" từ Microsoft Store, rồi `winget source update`.
2. **`code` không nhận diện trong PowerShell** → lúc cài VS Code có một ô tick "Add to PATH"; nếu bỏ sót, gỡ và cài lại, hoặc thêm thủ công.
3. **PlatformIO cài mãi không xong** → nó đang tải Python riêng và toolchain; để yên 5–10 phút. Nếu thất bại, mở `View → Output → PlatformIO` đọc lỗi thật.

### 00.6 esptool và pymavlink trên Python 3.11

`esptool` nạp firmware vào ESP32 bằng dòng lệnh (Phase 12, 17). `pymavlink` là thư viện backend dùng để nói chuyện MAVLink (Phase 05 trở đi).

**Dùng `py -3.11`, không dùng `python` trần.** Máy có cả 3.13 và 3.11; gõ `python` sẽ trúng 3.13 và backend cần 3.11.

```powershell
py -3.11 -m pip install --upgrade pip
py -3.11 -m pip install --upgrade esptool pymavlink
esptool version
py -3.11 -m pip show pymavlink
```

⚠️ **esptool v5 đã đổi cú pháp lệnh.** Bây giờ gọi là `esptool` (không còn `esptool.py`) và subcommand dùng gạch nối:

```powershell
# dung o phase 12/17 - khong chay bay gio vi chua co board
# esptool -p COM3 flash-id
# esptool -p COM3 erase-flash
# esptool --chip esp32 -p COM3 -b 460800 write-flash 0x0 firmware.bin
```

Mọi tutorial cũ viết `esptool.py write_flash` (gạch dưới) là cú pháp v4 — sẽ báo lỗi.

Kết quả mong đợi: `esptool version` in `esptool v5.x.x`; `pip show pymavlink` in `Version: 2.4.x`.

Nếu lỗi:

1. **`esptool` không nhận diện** → thư mục `Scripts` của Python 3.11 chưa vào PATH. Chạy thay bằng `py -3.11 -m esptool version`.
2. **`pip install pymavlink` fail khi biên dịch** → đang dùng nhầm Python 3.13. Kiểm tra bằng `py -3.11 -c "import sys; print(sys.version)"`.
3. **`pip` báo lỗi quyền** → đừng chạy PowerShell as administrator; thêm `--user` vào lệnh `pip install`.

### 00.7 Khởi động WSL2 Ubuntu lần đầu

Phase 02 sẽ build ArduPilot trong WSL, đó là việc nặng nhất. Ở đây chỉ xác nhận WSL mở được và cập nhật nhân.

```powershell
wsl --update
wsl -d Ubuntu
```

Lần đầu vào Ubuntu, nó hỏi tạo user và mật khẩu — đặt một cái dễ nhớ, bạn sẽ gõ nó mỗi lần `sudo`.

Trong **bash trong WSL**, kiểm tra dung lượng ổ (ArduPilot cần ~6–8 GB):

```bash
lsb_release -a
df -h /
free -h
exit
```

Kết quả mong đợi:

- `lsb_release -a` in `Ubuntu 24.04...`.
- `df -h /` hiện ổ WSL (trên máy này là `/dev/sdd`) còn **trên 900 GB**. Cần dư ít nhất 15 GB.
- `free -h` hiện RAM WSL được cấp (mặc định khoảng một nửa RAM máy).

Nếu lỗi:

1. **`wsl -d Ubuntu` báo `The system cannot find the file specified`** → distro chưa đăng ký. `wsl --install -d Ubuntu-24.04`.
2. **`wsl --update` báo lỗi mạng** → chạy PowerShell as administrator rồi thử lại.
3. **`df -h /` báo ổ chỉ còn vài GB** → ổ ảo WSL đang nằm trên ổ C. Chuyển sang ổ khác bằng `wsl --export` / `wsl --import` trước khi sang Phase 02, nếu không build sẽ chết giữa chừng.

### 00.8 Ghi lại vào PROGRESS

Mở `plans/PROGRESS.md`, mục **Phase 00**:

1. Điền `Ngày bắt đầu` và `Ngày xong`.
2. Tick các ô ở "Cổng pass" bên dưới.
3. Ghi vào `Ghi chú` số phiên bản thực tế bạn nhận được (Mission Planner, esptool, uv, pnpm) — sau này có lỗi lạ thì biết mình đang ở bản nào.

Commit với prefix `chore(plans):`.

## Cổng pass

- [ ] `py --list` hiện cả `3.13` và `3.11`.
- [ ] `node --version` in v24.x, `pnpm --version` in 11.x, `uv --version` in 0.12.x.
- [ ] `docker info --format "{{.ServerVersion}}"` in ra số phiên bản (Docker Desktop đang chạy).
- [ ] `wsl --list --verbose` hiện `Ubuntu` với VERSION = `2`; vào được bằng `wsl -d Ubuntu`; `df -h /` trong WSL còn > 15 GB.
- [ ] Mission Planner mở được, hiện màn hình `FLIGHT DATA` với nút `CONNECT`.
- [ ] MAVProxy đã cài (có shortcut trong Start Menu hoặc `mavproxy.exe --version` chạy được).
- [ ] STM32CubeProgrammer mở được, thấy ô chọn kiểu kết nối.
- [ ] `code --version` in 3 dòng; PlatformIO IDE hiện trong danh sách extension đã cài của VS Code.
- [ ] `esptool version` in `v5.x`; `py -3.11 -m pip show pymavlink` in `Version: 2.4.x`.
- [ ] `plans/PROGRESS.md` mục Phase 00 đã tick, ghi số phiên bản thực tế, và đã commit.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Ổ ảo WSL nằm trên ổ C không đủ chỗ → Phase 02 build chết giữa chừng sau 40 phút | 2 | 5 | **10** | Kiểm tra `df -h /` ngay ở 00.7, **trước khi** sang Phase 02; chuyển ổ WSL nếu cần |
| Cài `pymavlink` nhầm lên Python 3.13, tới Phase 05 mới phát hiện | 3 | 3 | 9 | Luôn gọi `py -3.11 -m pip`; cổng pass kiểm tra bằng `pip show` của đúng 3.11 |
| Tài khoản ST chậm kích hoạt, chặn Phase 14 vào đúng hôm hàng về | 3 | 3 | 9 | Đăng ký ngay ở phase này, sớm hơn nhu cầu thực 13 phase |
| Tải Mission Planner từ nguồn `winget` lạ / trang mirror | 2 | 5 | **10** | Chỉ dùng `.msi` từ `firmware.ardupilot.org`; đã ghi rõ ở 00.2 |
| SmartScreen / Defender chặn installer → người mới tưởng file độc, bỏ cuộc | 4 | 2 | 8 | Đã ghi trước ở từng bước: `More info` → `Run anyway` cho file từ `firmware.ardupilot.org` |
| Chép lệnh `esptool.py write_flash` từ tutorial cũ (cú pháp v4) rồi tưởng esptool hỏng | 3 | 2 | 6 | Ghi rõ đổi cú pháp ở 00.6; sổ tay nhắc lại |
| PlatformIO tải toolchain lâu, tưởng treo rồi tắt giữa chừng | 3 | 2 | 6 | Xem `View → Output → PlatformIO` để thấy nó đang làm gì |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 00.1 Kiểm kê thứ đã có | 0,25 | |
| 00.2 Mission Planner | 0,5 | Phần lớn là chờ tải |
| 00.3 MAVProxy | 0,25 | |
| 00.4 STM32CubeProgrammer | 0,5 | Gồm đăng ký tài khoản ST |
| 00.5 VS Code + PlatformIO + Arduino IDE | 0,5 | PlatformIO tự tải toolchain |
| 00.6 esptool + pymavlink | 0,25 | |
| 00.7 WSL2 lần đầu | 0,25 | |
| 00.8 Ghi PROGRESS | 0,1 | |
| **Tổng** | **2,5** | Có thể làm song song: bấm tải Mission Planner rồi làm bước khác trong lúc chờ |

## Ghi chú cho sổ tay

Những khái niệm `docs/so-tay/00-cai-cong-cu-pc.md` cần giải thích cho người chưa biết gì:

- **PowerShell là gì, chạy lệnh ở đâu** — cách mở, cách dán lệnh, vì sao phải mở lại cửa sổ sau khi cài thứ gì đó (biến PATH chỉ nạp lúc mở).
- **Phân biệt "chạy ở PowerShell" và "chạy ở bash trong WSL"** — đây là chỗ người mới sai nhiều nhất trong cả dự án. Mỗi khối lệnh trong mọi file phase đều ghi rõ, phải tập thói quen nhìn dòng đó trước khi dán.
- **GCS là gì** — trạm mặt đất; vì sao dự án có tới ba thứ (Mission Planner, MAVProxy, website tự làm) và mỗi thứ mạnh ở đâu.
- **Vì sao phải dùng Python 3.11 chứ không phải 3.13 mới nhất** — thư viện có phần biên dịch C; "mới nhất" không phải lúc nào cũng là "chạy được".
- **DFU là gì (giới thiệu sớm)** — chế độ nạp firmware cấp thấp của chip STM32; vì sao lần nạp đầu bắt buộc qua nó; vì sao STM32CubeProgrammer là công cụ đúng (nó mang driver).
- **WSL là gì** — một máy Linux chạy bên trong Windows; vì sao dự án cần nó (ArduPilot chỉ build ngon trên Linux).
- **winget là gì** — cửa hàng ứng dụng dòng lệnh của Windows; vì sao có thứ cài được bằng nó và có thứ không.
- **Cảnh báo bảo mật của Windows** — SmartScreen/Defender hay chặn installer ít người dùng; quy tắc: chỉ bấm "Run anyway" khi file đến từ nguồn chính chủ đã ghi trong phase, không bao giờ để né một cảnh báo ở nguồn lạ.
