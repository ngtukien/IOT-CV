# Phase 00: Cài công cụ trên Windows

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | – | ~2,75 giờ | Không |

## Mục tiêu

Cài đủ mọi phần mềm chạy trên Windows mà cả dự án sẽ dùng, và kiểm chứng từng cái bằng một lệnh in ra số phiên bản. Sau phase này bạn mở được Mission Planner, gõ được `uv`, `pnpm`, `esptool` trong PowerShell, Docker Desktop đang chạy, và WSL2 Ubuntu 24.04 khởi động được.

Phase này **không sửa một file nào trong repo**. Nó chỉ cài phần mềm lên máy. Mọi phase sau đều giả định các lệnh ở đây gõ được.

## Đầu vào cần có

Phải đọc trước:

- `plans/README.md` — hiểu 25 phase và hai luồng trước khi bắt tay.
- `plans/reports/260921-research-sitl-firmware-toolchain.md` §2 (Mission Planner / MAVProxy / STM32CubeProgrammer) và §5 (danh sách cài ngay).
- `plans/reports/260921-research-esp32-bridge-camera.md` §2 (winget id đã kiểm chứng, esptool v5 đổi cú pháp).
- `plans/reports/260921-research-cai-dat-o-dia-D.md` — toàn bộ (dồn cache/công cụ sang ổ D:, script `scripts/setup-d-drive.ps1`, ba mục "chưa xác minh").

Phải có sẵn (đã xác nhận trên máy này ngày 21/09/2026):

- Windows 11, quyền cài phần mềm.
- Python 3.13, Node 24, pnpm 11, Docker Desktop, `uv` 0.12.
- WSL2 với Ubuntu 24.04 đã đăng ký (**đã dùng ~37 GB**, không phải bản trống).
- Ổ C: còn ~28 GB trống, ổ D: còn ~138 GB trống — lý do bắt buộc có bước 00.0.
- Mạng ổn định, ~3 GB tải về cho riêng phase này.

## File và thư mục sở hữu

**Không có.** Phase này chỉ cài phần mềm hệ thống. File duy nhất được sửa là `plans/PROGRESS.md` (tick checkbox mục Phase 00).

Nếu bạn thấy mình sắp sửa bất kỳ file nào khác trong repo — dừng lại, việc đó thuộc Phase 01.

## Việc theo thứ tự

### 00.0 Dồn công cụ sang ổ D trước khi cài gì

Ổ C: hiện chỉ còn **~28,4 GB trống**, ổ D: còn **~137,9 GB trống**. Nếu làm các bước 00.1–00.9 theo đường dẫn mặc định, mọi cache (`uv`, `pip`, `npm`, `pnpm`) và mọi tool (`uv tool`, `uv python`, PlatformIO) sẽ đổ thêm vài GB nữa vào C: — đúng lúc C: đang chật nhất. Vì vậy bước này phải làm **trước** 00.1.

Chi tiết đầy đủ, bằng chứng, và rủi ro từng mục: `plans/reports/260921-research-cai-dat-o-dia-D.md`. Script `scripts/setup-d-drive.ps1` đã có sẵn trong repo, idempotent (chạy lại nhiều lần không hỏng), mặc định là dry-run.

**Vì sao có HAI thư mục gốc, không phải một.** `D:\DevCache` chứa cache và tool **dùng chung cho TOÀN MÁY** (`uv`, `pip`, `npm`, `pnpm`, `uv tool`, `uv python`, PlatformIO core) — mọi dự án trên máy này đọc/ghi vào đó, nên **không bao giờ được xoá** khi riêng dự án drone kết thúc. `D:\IOT_Tools` giờ chỉ còn chứa app có installer **riêng của dự án này** (Arduino IDE, Mission Planner, MAVProxy, STM32CubeProgrammer) — xoá trọn thư mục này không ảnh hưởng tới dự án nào khác. Ban đầu cả hai gộp chung một thư mục `D:\IOT_Tools`, dễ gây hiểu lầm là cache dùng chung "thuộc về" dự án drone — nên đã tách ra thành hai gốc riêng.

**Đã làm xong (kiểm chứng trên máy này):** script đã chạy `-Apply` — sáu biến môi trường phạm vi User (`UV_CACHE_DIR`, `UV_TOOL_DIR`, `UV_PYTHON_INSTALL_DIR`, `PIP_CACHE_DIR`, `NPM_CONFIG_CACHE`, `PLATFORMIO_CORE_DIR`) đều đã trỏ vào `D:\DevCache\...`; cây thư mục `D:\DevCache\{cache\{uv,pip,npm,pnpm-store},tools\{uv-tools,uv-python,platformio}}` và `D:\IOT_Tools\apps` đều đã tồn tại.

**Còn lại phải làm — tự chạy sau khi đã thoát hẳn VS Code:**

```powershell
# 1. Sao lưu PATH trước khi đụng thêm vào biến môi trường (phòng xa, xem rủi ro #1 dưới)
[Environment]::GetEnvironmentVariable('PATH','User') > D:\path-backup.txt

# 2. Đóng HẲN VS Code và mọi cửa sổ terminal (không chỉ đóng cửa sổ — thoát tiến trình)

# 3. Chuyển nốt dữ liệu cache cũ trên C: sang D: (~7,1 GB: uv 3,86 GB, npm 2,69 GB, pip 4,6 MB)
pwsh -File scripts/setup-d-drive.ps1 -Apply -MoveExisting
```

⚠️ **Phải mở PowerShell mới** sau bước 3 — biến môi trường ở phạm vi User chỉ nạp lúc tiến trình khởi động; cửa sổ đang mở vẫn giữ giá trị cũ.

Dọn thêm 633 MB pnpm store còn sót trên C::

```powershell
pnpm store prune
Remove-Item "$env:LOCALAPPDATA\pnpm\store" -Recurse -Force -ErrorAction SilentlyContinue
```

Kiểm chứng (mở cửa sổ PowerShell mới trước khi chạy):

```powershell
uv cache dir; uv tool dir; uv python dir; npm config get cache
```

Cả bốn dòng phải in đường dẫn bắt đầu bằng `D:\DevCache\`.

**Sau khi mở PowerShell mới — sửa nốt `cua-driver` mồ côi.** `cua-driver` được cài từ trước khi `UV_TOOL_DIR` từng được đặt, nên vẫn còn nằm ở vị trí mặc định `C:\Users\Nghaiz\AppData\Roaming\uv\tools\cua-driver` (76 MB) — `uv tool list` không còn thấy nó, dù nó vẫn chạy bình thường. Chỉ chạy lệnh sau khi **MCP server `cua-driver` KHÔNG đang chạy** (nó khoá file venv, reinstall giữa chừng sẽ hỏng):

```powershell
uv tool install cua-driver --reinstall --force
```

**Kết quả thật khi chạy ngày 21/09/2026.** Ổ C: **28,4 GB → 35,41 GB trống**, thu hồi được 7 GB. Đã chuyển: uv cache 3,86 GB, npm cache 2,69 GB, pip cache 5 MB, Arduino IDE 527 MB, và xoá kho pnpm mồ côi 633 MB trên C:. Bốn điều học được, đã ghi vào script:

1. **`pnpm config set store-dir` không ghi được** và cũng **không nên ghi**. Lỗi "global bin directory is not in PATH" chặn nó, nhưng quan trọng hơn: để trống là hành vi đúng, pnpm cố ý tạo một kho cho **mỗi ổ đĩa** vì hardlink chỉ chạy trong cùng ổ. Kho thật là `D:\.pnpm-store`, đã nằm trên D. Script nay chỉ báo cáo, không ép.
2. **Kho pnpm cũ trên C: là mồ côi**, `pnpm store prune` không thấy nó vì prune chỉ dọn kho đang dùng. Phải xoá tay. An toàn: `node_modules` đã cài vẫn chạy nhờ hardlink giữ dữ liệu sống.
3. **Bảng dung lượng trước/sau của script từng luôn in 0.00 GB.** `Get-PSDrive` nhớ đệm từ lúc phiên PowerShell khởi động nên đọc lại vẫn ra số cũ. Một con số vô nghĩa còn tệ hơn không có số, vì nó làm người đọc tưởng script không làm gì. Đã đổi sang `[System.IO.DriveInfo]`.
4. **`uv tool install --reinstall` thiếu `--force` sẽ lỗi** `Executable already exists`, vì shim cũ trong `~/.local/bin` vẫn còn.

**Còn nợ trên C:** `~/.platformio.old` 80 MB (xoá sau khi PlatformIO dựng lại trên D và chạy thử được một project), cache uv 51 MB (34 file bị khoá), `cua-driver` 76 MB (chờ đóng Claude Code).

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

- `py --list` liệt kê `-V:3.13`.
- `node --version` in `v24.x.x`; `pnpm --version` in `11.x.x`.
- `uv --version` in `uv 0.12.x`.
- `docker info --format ...` in ra số phiên bản server (nếu in lỗi nghĩa là Docker Desktop chưa khởi động, không phải chưa cài).
- `wsl --list --verbose` hiện một dòng `Ubuntu ... Stopped ... 2`. Cột cuối phải là **2** (WSL2), không phải 1.

Nếu lỗi:

1. **`py --list` không có `3.13`** → `winget install Python.Python.3.13`.

> ⚠️ **Không dùng bản Python 3.11 của Microsoft Store trên máy này** (đường dẫn cài kiểu `WindowsApps\PythonSoftwareFoundation.Python.3.11_...`). Bản đó hay hỏng khi tạo venv và khi cài gói cần biên dịch. Nếu sau này một phase nào đó cần một phiên bản Python khác 3.13, dùng `uv python install <phiên bản>` để `uv` tự tải một bản độc lập, sạch — không cài qua Microsoft Store.
2. **`docker info` báo `error during connect`** → mở Docker Desktop từ Start Menu, đợi biểu tượng cá voi hết quay, chạy lại.
3. **`wsl --list --verbose` cột VERSION là `1`** → `wsl --set-version Ubuntu 2`. WSL1 không chạy được ArduPilot SITL.
4. **`pnpm` không nhận diện** → `npm install -g pnpm`, rồi mở lại PowerShell (biến PATH chỉ nạp lúc mở cửa sổ).

### 00.2 Mission Planner — trạm mặt đất chính

Mission Planner là phần mềm bạn sẽ dùng nhiều nhất trong cả dự án: nạp firmware, xem toàn bộ danh sách param, hiệu chỉnh radio và la bàn, vẽ mission, tải log. **Không có công cụ nào thay thế được nó** ở khoản Full Parameter List và nạp custom firmware.

Chạy ở **PowerShell (Windows)**:

```powershell
Start-Process "https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.msi"
```

Lệnh này mở trình duyệt tải file `.msi`. Tải xong, `cd` tới thư mục chứa file rồi cài thẳng vào D: bằng dòng lệnh:

```powershell
msiexec /i MissionPlanner-latest.msi INSTALLDIR="D:\IOT_Tools\apps\MissionPlanner" /qb
```

`INSTALLDIR` là property MSI đã kiểm chứng trực tiếp từ mã nguồn sinh installer (`wix/Program.cs` trong repo `ArduPilot/MissionPlanner` in ra `<Directory Id="INSTALLDIR" ...>`). **Không dùng `TARGETDIR`** — installer có một custom action ép nó về `[ProgramFilesFolder]` bất kể truyền gì, nên `TARGETDIR` là cái bẫy. `/qb` = giao diện rút gọn, có thanh tiến trình, không hỏi gì; không thêm dấu `\` ở cuối đường dẫn. Nếu Windows cảnh báo về driver thì chọn **"Install this driver software anyway"** — installer đi kèm driver USB cho các board flight controller, đó là thứ cần thiết.

Nếu vì lý do gì đó flag `INSTALLDIR` bị bỏ qua, dùng giao diện: chạy `.msi`, bấm Next tới trang **"Select Installation Folder"**, bấm **Browse…**, chọn `D:\IOT_Tools\apps\MissionPlanner`.

**Không cài Mission Planner từ `winget`.** Không có package id chính thức nào do ArduPilot phát hành được kiểm chứng (`plans/reports/260921-research-sitl-firmware-toolchain.md` §2). Đây là phần mềm sẽ ghi firmware vào flight controller — không lấy từ nguồn lạ.

Kết quả mong đợi: mở Mission Planner từ Start Menu, thấy màn hình `FLIGHT DATA` với HUD màu xám và bản đồ. Góc trên bên phải có ô chọn cổng (`COM` / `UDP` / `TCP`) và nút `CONNECT`. Kiểm chứng đã cài đúng chỗ:

```powershell
Test-Path "D:\IOT_Tools\apps\MissionPlanner\MissionPlanner.exe"
Get-ItemProperty HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* |
  Where-Object DisplayName -like "*Mission Planner*" |
  Select-Object DisplayName, DisplayVersion, InstallLocation
```

`InstallLocation` phải trỏ vào `D:\`. Nếu vẫn in `C:\Program Files (x86)\Mission Planner`, property đã bị bỏ qua — dùng lại đường GUI ở trên.

Nếu lỗi:

1. **Cài xong không mở được, báo thiếu .NET** → installer thường tự kéo về; nếu không, tải ".NET Desktop Runtime" từ trang Microsoft và cài, rồi mở lại.
2. **Mở lên màn hình trắng / treo** → chạy bằng chuột phải → `Run as administrator` một lần đầu; Mission Planner cần ghi file cấu hình.
3. **SmartScreen chặn `.msi`** → `More info` → `Run anyway`. File đến từ `firmware.ardupilot.org` là nguồn chính chủ.

### 00.3 MAVProxy (bản Windows)

MAVProxy là trạm mặt đất dòng lệnh. Bạn gõ chữ thay vì bấm nút, nên ghi lại được, script hoá được, và nó nói cho bạn biết chính xác cái gì đang xảy ra thay vì giấu sau giao diện. Ở Phase 03 và 04 bạn sẽ dùng nó song song với Mission Planner.

```powershell
Start-Process "https://firmware.ardupilot.org/Tools/MAVProxy/MAVProxySetup-latest.exe"
```

Tải xong, mở **PowerShell as administrator** rồi cài thẳng vào D: bằng dòng lệnh:

```powershell
.\MAVProxySetup-latest.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="D:\IOT_Tools\apps\MAVProxy"
```

Đây là installer **Inno Setup 6**, không phải NSIS — dùng `/DIR=`, không phải `/D=` của NSIS. Khác NSIS, Inno cho phép đặt `/DIR=` ở bất kỳ vị trí nào và cho phép dùng dấu nháy. **Phải chạy quyền admin**: installer ghi thư mục cài thẳng vào PATH hệ thống (HKLM) tự động (`ChangesEnvironment=yes` trong script Inno), việc ghi HKLM cần quyền admin — chạy không admin ở `/VERYSILENT` thì bước ghi PATH sẽ hỏng lặng lẽ.

Nếu flag `/DIR=` bị bỏ qua, chạy file `.exe` bằng tay, tới trang **"Select Destination Location"**, bấm **Browse**, chọn `D:\IOT_Tools\apps\MAVProxy`.

Lưu ý: đây là bản **Windows**. Ở Phase 02 bạn sẽ cài thêm một bản MAVProxy nữa **bên trong WSL** — hai bản khác nhau, không thay thế nhau, và đó là chuyện bình thường.

Kết quả mong đợi: mở PowerShell mới, gõ `where.exe mavproxy` phải in đường dẫn bắt đầu bằng `D:\`, rồi `mavproxy.exe --version` in ra số phiên bản. (Nếu không nhận diện, tìm `MAVProxy` trong Start Menu — installer tạo một shortcut riêng.)

Nếu lỗi:

1. **Windows Defender chặn file `.exe`** → `More info` → `Run anyway`. Không tải MAVProxy từ nguồn khác để né cảnh báo.
2. **`mavproxy.exe` không nhận diện trong PowerShell** → chưa chạy installer bằng quyền admin nên PATH chưa được ghi. Cài lại bằng PowerShell as administrator, hoặc thêm `D:\IOT_Tools\apps\MAVProxy` vào PATH bằng tay.
3. **Cửa sổ MAVProxy mở rồi tắt ngay** → bình thường khi chạy không có tham số kết nối; nó cần một nguồn MAVLink để nối vào (sẽ có từ Phase 02).

### 00.4 STM32CubeProgrammer — công cụ nạp firmware lần đầu

Board SpeedyBee F405 V5 xuất xưởng chạy Betaflight. Lần nạp ArduPilot **đầu tiên** phải qua chế độ DFU vì phải ghi cả bootloader, và wiki ArduPilot chỉ định đúng công cụ này — lý do chính: nó mang theo **driver DFU chuẩn của ST** cho Windows.

Việc này chỉ thực sự dùng ở **Phase 14**. Nhưng cài ngay bây giờ vì nó cần đăng ký một tài khoản ST miễn phí, và bạn không muốn ngồi chờ email xác thực vào đúng hôm hàng về.

**Không có lệnh tải trực tiếp, và không có flag đường dẫn một dòng kiểu `/DIR=`.** Đây là installer InstallAnywhere (Java) — tài liệu ST mô tả chạy nó bằng `jre\bin\java -jar SetupSTM32CubeProgrammer-X.Y.Z.exe`, dấu hiệu đặc trưng của InstallAnywhere; cách cài im lặng của nó là cơ chế hai bước (cài tay một lần sinh ra file XML, lần sau chạy XML đó), không có flag đơn lẻ để chỉ định thư mục. Làm bằng tay:

1. Mở trình duyệt vào `st.com`.
2. Tìm "STM32CubeProgrammer".
3. Đăng ký một tài khoản ST miễn phí (họ gửi link tải qua email).
4. Tải bản Windows, giải nén, chạy installer. Có thể cần Java — installer sẽ báo.
5. Ở trang **"Choose Install Folder"**, gõ `D:\IOT_Tools\apps\STM32CubeProgrammer`.

⚠️ **Chưa xác minh:** trang "Choose Install Folder" có chắc chắn xuất hiện hay không — chưa lấy được ảnh chụp/mô tả từ tài liệu ST (`st.com` chặn truy cập tự động, không mở được bằng công cụ). Đây là trang mặc định của InstallAnywhere nên khả năng cao là có. **Dự phòng:** nếu không thấy trang chọn thư mục, cứ cài mặc định và chấp nhận ~200–300 MB trên C: — đây là công cụ dùng đúng một lần ở Phase 14, không phải thứ phình to theo thời gian, nên chi phí này chấp nhận được.

⚠️ URL trang sản phẩm trên `st.com` **chưa xác minh được** bằng công cụ tự động (st.com chặn) — điều đó không có nghĩa trang hỏng, chỉ nghĩa là phải mở bằng trình duyệt tay.

**Chưa cần cài lúc này:** `Zadig` và `dfu-util`. Hai thứ đó chỉ dùng khi driver DFU hỏng ở Phase 14, và Zadig là con dao hai lưỡi — chạy nó "cho chắc" có thể làm STM32CubeProgrammer không nhận board nữa.

Kết quả mong đợi: mở `STM32CubeProgrammer` từ Start Menu, thấy giao diện với ô chọn kiểu kết nối (`ST-LINK` / `UART` / `USB`) ở góc phải trên. Kiểm chứng đã vào D: (nếu bước 5 thành công):

```powershell
Test-Path "D:\IOT_Tools\apps\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe"
```

Nếu lỗi:

1. **Installer báo thiếu Java** → cài JRE theo link nó đưa, rồi chạy lại installer.
2. **Không nhận được email từ ST** → kiểm tra hộp thư rác; tài khoản ST đôi khi mất vài chục phút mới kích hoạt.
3. **Không tìm thấy trang tải** → tìm bằng từ khoá "STM32CubeProg" thay vì tên đầy đủ; ST đổi cấu trúc trang khá thường xuyên.

### 00.5 VS Code + PlatformIO và Arduino IDE

Dùng cho firmware ESP32 ở Phase 12 (project camera). PlatformIO được chọn làm chính vì nó ghim được phiên bản thư viện trong `platformio.ini` và đưa được vào CI; Arduino IDE là hạng hai, cài để đọc được các tutorial ESP32-CAM trên mạng.

VS Code và PlatformIO IDE **đã được cài sẵn trên máy này** trước khi viết phase này. Không cần cài lại — bước này chỉ còn là **xác minh** cộng **dời `PLATFORMIO_CORE_DIR`** (biến này đã được bước 00.0 đặt sang `D:\DevCache\tools\platformio`, nhưng PlatformIO chỉ đọc nó khi dựng lại core dir).

```powershell
winget install ArduinoSA.IDE.stable
```

`winget` id trên đã được kiểm chứng bằng `winget search` trên chính máy Windows 11 này (`plans/reports/260921-research-esp32-bridge-camera.md` §2). Arduino IDE là **tuỳ chọn** — bỏ qua được nếu muốn gọn.

⚠️ **`winget` bỏ qua flag `--location` cho gói này — đã kiểm chứng trên máy này.** `winget install ArduinoSA.IDE.stable --location "D:\..."` vẫn cài thẳng vào `%LOCALAPPDATA%\Programs\arduino-ide` (527 MB, 6379 file) bất kể có truyền `--location` hay không. Dọn bằng cách chuyển thư mục sang D: rồi để lại một **junction** ở chỗ cũ (không cần quyền admin) để Arduino IDE và bộ cập nhật của nó vẫn tự tìm thấy mình:

```powershell
# 1. Cài xong ở %LOCALAPPDATA%\Programs\arduino-ide, đóng hẳn Arduino IDE nếu đang mở
$arduinoOld = "$env:LOCALAPPDATA\Programs\arduino-ide"

# 2. Chuyển toàn bộ thư mục sang D:
Move-Item $arduinoOld "D:\IOT_Tools\apps\ArduinoIDE"

# 3. Tạo junction tại chỗ cũ trỏ về D: — không cần quyền admin
New-Item -ItemType Junction -Path $arduinoOld -Target "D:\IOT_Tools\apps\ArduinoIDE"
```

Đây là công thức dự phòng dùng chung cho **bất kỳ installer nào phớt lờ đường dẫn tuỳ chỉnh**: cài mặc định, `Move-Item` phần nặng sang D:, rồi `New-Item -ItemType Junction` tại chỗ cũ để phần mềm (và bộ cập nhật của nó) vẫn tìm đúng chỗ.

**Dời PlatformIO core dir sang D: — bắt buộc làm SỚM.** Máy này đo được `~/.platformio` hiện chỉ **79,76 MB**, **chưa có thư mục `platforms`** — nghĩa là chưa từng tải toolchain nào, gần như bản cài trắng. **Không được "move" (copy) thư mục này** — đã kiểm chứng là hỏng: `penv` là một virtualenv, nướng cứng đường dẫn tuyệt đối vào shebang script và `pyvenv.cfg`; copy sang chỗ khác cho lỗi `bad interpreter: No such file or directory` (issue `platformio/platformio-core#3554`, xác nhận bởi chính maintainer). Cách đúng — và với 80 MB không toolchain thì cũng là cách rẻ nhất — là **đổi tên rồi để PlatformIO tự dựng lại**:

```powershell
# 1. Biến PLATFORMIO_CORE_DIR đã được đặt ở bước 00.0 — xác nhận:
[Environment]::GetEnvironmentVariable('PLATFORMIO_CORE_DIR', 'User')

# 2. Đóng HẲN VS Code (thoát tiến trình, không chỉ đóng cửa sổ)

# 3. Đổi tên thư mục cũ (đổi tên, KHÔNG xoá — còn đường lùi)
Rename-Item "$env:USERPROFILE\.platformio" ".platformio.old"

# 4. Mở lại VS Code, để PlatformIO tự dựng lại penv trên D: (vài phút)
```

Chạy thử một project ESP32 (Phase 12) rồi mới xoá `.platformio.old`:

```powershell
Remove-Item "$env:USERPROFILE\.platformio.old" -Recurse -Force
```

Kiểm chứng:

```powershell
code --version
pio system info
```

Kết quả mong đợi: `code --version` in 3 dòng (phiên bản, commit hash, kiến trúc). Thanh trạng thái dưới cùng VS Code có biểu tượng con kiến của PlatformIO. `pio system info` in dòng `Core Directory` trỏ về `D:\DevCache\tools\platformio`.

Nếu lỗi:

1. **`winget` báo không tìm thấy id** → cập nhật "App Installer" từ Microsoft Store, rồi `winget source update`.
2. **`code` không nhận diện trong PowerShell** → lúc cài VS Code có một ô tick "Add to PATH"; nếu bỏ sót, gỡ và cài lại, hoặc thêm thủ công.
3. **PlatformIO cài mãi không xong** → nó đang tải Python riêng và toolchain; để yên 5–10 phút. Nếu thất bại, mở `View → Output → PlatformIO` đọc lỗi thật.
4. **`pio system info` vẫn in `Core Directory` ở `C:\Users\...\.platformio`** → chưa xác minh được liệu extension VS Code có tự đọc `PLATFORMIO_CORE_DIR` hay không (không tìm được câu khẳng định trong tài liệu). Mở VS Code bằng `code .` từ một PowerShell **đã có** biến này để tiến trình con thừa kế biến.

### 00.6 esptool và pymavlink

`esptool` là một **ứng dụng dòng lệnh** nạp firmware vào ESP32 (Phase 12, 17). `pymavlink` là một **thư viện** dùng để `import`, backend dùng nói chuyện MAVLink (Phase 05 trở đi). Hai thứ này khác bản chất nên không cài cùng kiểu — và **không** dùng `py -3.13 -m pip install` cho cả hai như bản cũ của phase này, vì lệnh đó ghi thẳng vào `site-packages` trên C:.

**esptool — CLI độc lập, cài bằng `uv tool install`:**

```powershell
uv tool install esptool --python 3.13
```

`uv tool install` không có flag `--tools-dir` (đã đọc hết `uv tool install --help`, flag đó không tồn tại) — đường duy nhất để đưa payload sang D: là biến `UV_TOOL_DIR`, và biến đó đã được đặt ở bước 00.0. Giữ `UV_TOOL_BIN_DIR` ở mặc định (`~/.local\bin`, đã nằm trong PATH, chỉ chứa vài trăm KB shim) — phần nặng (venv của tool) nằm trong `UV_TOOL_DIR` trên D:, tức là `D:\DevCache\tools\uv-tools\esptool`.

```powershell
esptool version
where.exe esptool
uv tool list
```

⚠️ **esptool v5 đã đổi cú pháp lệnh.** Bây giờ gọi là `esptool` (không còn `esptool.py`) và subcommand dùng gạch nối:

```powershell
# dung o phase 12/17 - khong chay bay gio vi chua co board
# esptool -p COM3 flash-id
# esptool -p COM3 erase-flash
# esptool --chip esp32 -p COM3 -b 460800 write-flash 0x0 firmware.bin
```

Mọi tutorial cũ viết `esptool.py write_flash` (gạch dưới) là cú pháp v4 — sẽ báo lỗi.

**pymavlink — thư viện của dự án, cài vào venv trên D::**

```powershell
cd D:\Coding\IOT-CV
uv venv --python 3.13
uv pip install pymavlink
.\.venv\Scripts\python.exe -c "import pymavlink, sys; print(pymavlink.__version__); print(sys.executable)"
```

`uv venv` tạo `.venv` ngay trong thư mục dự án (đã ở D: vì repo nằm ở `D:\Coding\IOT-CV`). Dòng `sys.executable` phải bắt đầu bằng `D:\`. Không cần thêm gì vào PATH — mọi script/test của dự án gọi qua `uv run` hoặc `.venv\Scripts\python.exe`. Việc cài `pymavlink` đầy đủ cho môi trường dự án (kèm các gói khác) sẽ lặp lại/mở rộng ở Phase 01; ở đây chỉ cần xác nhận gói cài được và venv nằm trên D:.

Kết quả mong đợi: `esptool version` in `esptool v5.x.x`; `import pymavlink` in ra số phiên bản `2.4.x` và `sys.executable` bắt đầu bằng `D:\`.

Nếu lỗi:

1. **`esptool` không nhận diện** → `UV_TOOL_BIN_DIR` (mặc định `~/.local\bin`) chưa vào PATH, hoặc chưa mở cửa sổ PowerShell mới sau bước 00.0. Chạy thay bằng `uv tool run esptool version`, hoặc chạy `uv tool update-shell` rồi mở cửa sổ mới.
2. **`uv pip install pymavlink` fail khi biên dịch** → kiểm tra đang chạy đúng Python 3.13 bằng `uv run python -c "import sys; print(sys.version)"` trong thư mục dự án — không dùng bản Microsoft Store hay bản trong WSL.
3. **`sys.executable` không bắt đầu bằng `D:\`** → `.venv` bị tạo nhầm chỗ; xác nhận `cd D:\Coding\IOT-CV` trước khi chạy `uv venv`.

### 00.7 Khởi động WSL2 Ubuntu lần đầu

Phase 02 sẽ build ArduPilot trong WSL, đó là việc nặng nhất. Ở đây chỉ xác nhận WSL mở được và cập nhật nhân.

```powershell
wsl --update
wsl -d Ubuntu
```

Ubuntu **đã được cài và dùng qua** trên máy này (không phải bản trống) — `df -h /` cho thấy đã dùng khoảng 37 GB. Không cần tạo user mới nếu đã có; nếu đây là lần đầu, nó sẽ hỏi tạo user và mật khẩu — đặt một cái dễ nhớ, bạn sẽ gõ nó mỗi lần `sudo`.

Trong **bash trong WSL**, kiểm tra dung lượng ổ (ArduPilot cần thêm ~6–8 GB):

```bash
lsb_release -a
df -h /
free -h
exit
```

Kết quả mong đợi:

- `lsb_release -a` in `Ubuntu 24.04...`.
- `df -h /` hiện ổ WSL còn **trên 900 GB**. Cần dư ít nhất 15 GB. **Đừng ghim tên thiết bị vào tài liệu** (ví dụ `/dev/sdX`) — tên đổi theo thứ tự gắn đĩa giữa các lần khởi động; chỉ dựa vào con số `Avail`.
- `free -h` hiện RAM WSL được cấp (mặc định khoảng một nửa RAM máy).

**Bịt lỗ hổng file swap trước khi build ArduPilot ở Phase 02.** Ổ ảo Ubuntu (`ext4.vhdx`) đã nằm đúng trên D: (đã xác nhận qua registry Lxss + quét không thấy `.vhdx` nào dưới `%LOCALAPPDATA%\Packages`), nhưng file **swap** của WSL2 mặc định nằm ở `%Temp%\swap.vhdx` trên **C:**, bất kể distro ở đâu (tài liệu Microsoft, `wsl-config`). Build ArduPilot ngốn RAM có thể kích hoạt swap đúng lúc C: đang chật. Tạo `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
swapFile=D:\\WSL\\swap.vhdx
```

(Trong `.wslconfig`, dấu `\` phải viết đôi.) Rồi nạp lại:

```powershell
wsl --shutdown
```

Nếu lỗi:

1. **`wsl -d Ubuntu` báo `The system cannot find the file specified`** → distro chưa đăng ký. `wsl --install -d Ubuntu-24.04`.
2. **`wsl --update` báo lỗi mạng** → chạy PowerShell as administrator rồi thử lại.
3. **`df -h /` báo ổ chỉ còn vài GB** → ổ ảo WSL đang nằm trên ổ C. Chuyển sang ổ khác bằng `wsl --export` / `wsl --import` trước khi sang Phase 02, nếu không build sẽ chết giữa chừng.

### 00.8 Kiểm tra bộ điều khiển giao diện đồ họa

Từ Phase 14 trở đi bạn sẽ phải bấm qua nhiều wizard chỉ có giao diện: Mission Planner
(hiệu chỉnh radio, la bàn, gia tốc kế, Motor Test), STM32CubeProgrammer (nạp DFU), trình
nạp web của DroneBridge. Đây là chỗ người mới kẹt lâu nhất vì không biết bấm vào đâu.

`scripts/gui/gui.ps1` cho phép Claude nhìn màn hình, đọc tên nút bằng UIAutomation và bấm
hộ. Đọc `scripts/gui/README.md` trước khi dùng lần đầu, đặc biệt phần bốn rào an toàn.

```powershell
pwsh -File scripts/gui/gui.ps1 -Action monitors
pwsh -File scripts/gui/gui.ps1 -Action windows
pwsh -File scripts/gui/gui.ps1 -Action shot -Monitor 0 -Out tmp/thu.png
```

**AN TOÀN:** không dùng công cụ này cho ARM, Motor Test, hay bất cứ thao tác nào làm motor
quay. Những nút đó người vận hành tự bấm, tay luôn cầm RC. Xem `SAFETY.md` mục 1 và 2.

### 00.9 Ghi lại vào PROGRESS

Mở `plans/PROGRESS.md`, mục **Phase 00**:

1. Điền `Ngày bắt đầu` và `Ngày xong`.
2. Tick các ô ở "Cổng pass" bên dưới.
3. Ghi vào `Ghi chú` số phiên bản thực tế bạn nhận được (Mission Planner, esptool, uv, pnpm) — sau này có lỗi lạ thì biết mình đang ở bản nào.

Commit với prefix `chore(plans):`.

## Cổng pass

- [ ] Sáu biến môi trường User (`UV_CACHE_DIR`, `UV_TOOL_DIR`, `UV_PYTHON_INSTALL_DIR`, `PIP_CACHE_DIR`, `NPM_CONFIG_CACHE`, `PLATFORMIO_CORE_DIR`) đều trỏ vào `D:\DevCache\...` — kiểm bằng `uv cache dir; uv tool dir; uv python dir; npm config get cache`.
- [ ] Cây thư mục `D:\DevCache\{cache\{uv,pip,npm,pnpm-store},tools\{uv-tools,uv-python,platformio}}` và `D:\IOT_Tools\apps` tồn tại.
- [ ] `py --list` hiện `3.13`.
- [ ] `node --version` in v24.x, `pnpm --version` in 11.x, `uv --version` in 0.12.x.
- [ ] `pwsh -File scripts/gui/gui.ps1 -Action windows` liệt kê được cửa sổ đang mở; `-Action shot -Monitor 0` tạo ra file PNG đọc được.
- [ ] `docker info --format "{{.ServerVersion}}"` in ra số phiên bản (Docker Desktop đang chạy).
- [ ] `wsl --list --verbose` hiện `Ubuntu` với VERSION = `2`; vào được bằng `wsl -d Ubuntu`; `df -h /` trong WSL còn > 15 GB.
- [ ] Mission Planner cài trong `D:\IOT_Tools\apps\MissionPlanner\` (kiểm bằng `InstallLocation` trong registry Uninstall), mở được, hiện màn hình `FLIGHT DATA` với nút `CONNECT`.
- [ ] MAVProxy cài trong `D:\IOT_Tools\apps\MAVProxy\`; `where.exe mavproxy` in đường dẫn `D:\`; `mavproxy.exe --version` chạy được.
- [ ] STM32CubeProgrammer mở được, thấy ô chọn kiểu kết nối.
- [ ] `code --version` in 3 dòng; PlatformIO IDE hiện trong danh sách extension đã cài của VS Code; `pio system info` in `Core Directory` trỏ `D:\DevCache\tools\platformio`.
- [ ] `esptool version` in `v5.x`; `uv run python -c "import pymavlink; print(pymavlink.__version__)"` (trong `D:\Coding\IOT-CV`) in `2.4.x` và `sys.executable` bắt đầu bằng `D:\`.
- [ ] `plans/PROGRESS.md` mục Phase 00 đã tick, ghi số phiên bản thực tế, và đã commit.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| **`setx PATH` cắt cụt PATH ở 1024 ký tự** — PATH máy này dài 1552 ký tự, mất 528 ký tự cuối, hỏng nhiều công cụ | 5 nếu dùng `setx` | 5 | **25** | Không bao giờ dùng `setx` cho PATH; `scripts/setup-d-drive.ps1` dùng `[Environment]::SetEnvironmentVariable`. Sao lưu trước bằng `[Environment]::GetEnvironmentVariable('PATH','User') > D:\path-backup.txt` |
| Ổ ảo WSL nằm trên ổ C không đủ chỗ → Phase 02 build chết giữa chừng sau 40 phút | 2 | 5 | **10** | Kiểm tra `df -h /` ngay ở 00.7, **trước khi** sang Phase 02; chuyển ổ WSL nếu cần |
| Copy (thay vì đổi tên) `~/.platformio` sang D: → lỗi `bad interpreter` vì `penv` chứa đường dẫn tuyệt đối | 5 nếu copy | 4 | **20** | Đổi tên (`Rename-Item`), không copy; để PlatformIO tự dựng lại — xem 00.5 |
| Dùng nhầm bản Python 3.11 của Microsoft Store (hoặc bản trong WSL) khi cài `pymavlink`/`esptool`, tới Phase 05 mới phát hiện | 3 | 3 | 9 | Luôn gọi `uv tool install ... --python 3.13` / `uv venv --python 3.13`; cổng pass kiểm `sys.executable` |
| Tài khoản ST chậm kích hoạt, chặn Phase 14 vào đúng hôm hàng về | 3 | 3 | 9 | Đăng ký ngay ở phase này, sớm hơn nhu cầu thực 13 phase |
| Tải Mission Planner từ nguồn `winget` lạ / trang mirror | 2 | 5 | **10** | Chỉ dùng `.msi` từ `firmware.ardupilot.org`; đã ghi rõ ở 00.2 |
| WSL tạo `swap.vhdx` trên C: giữa lúc build ArduPilot (Phase 02) tốn RAM | 3 | 3 | 9 | Tạo `.wslconfig` với `swapFile=D:\\WSL\\swap.vhdx` ở 00.7 |
| SmartScreen / Defender chặn installer → người mới tưởng file độc, bỏ cuộc | 4 | 2 | 8 | Đã ghi trước ở từng bước: `More info` → `Run anyway` cho file từ `firmware.ardupilot.org` |
| Chép lệnh `esptool.py write_flash` từ tutorial cũ (cú pháp v4) rồi tưởng esptool hỏng | 3 | 2 | 6 | Ghi rõ đổi cú pháp ở 00.6; sổ tay nhắc lại |
| PlatformIO tải toolchain lâu, tưởng treo rồi tắt giữa chừng | 3 | 2 | 6 | Xem `View → Output → PlatformIO` để thấy nó đang làm gì |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 00.0 Dồn công cụ sang ổ D | 0,25 | Biến môi trường + thư mục đã xong; còn lại là `-MoveExisting` |
| 00.1 Kiểm kê thứ đã có | 0,25 | |
| 00.2 Mission Planner | 0,5 | Phần lớn là chờ tải |
| 00.3 MAVProxy | 0,25 | |
| 00.4 STM32CubeProgrammer | 0,5 | Gồm đăng ký tài khoản ST |
| 00.5 VS Code + PlatformIO + Arduino IDE | 0,5 | PlatformIO tự tải toolchain |
| 00.6 esptool + pymavlink | 0,25 | |
| 00.7 WSL2 lần đầu | 0,25 | |
| 00.8 Ghi PROGRESS | 0,1 | |
| **Tổng** | **2,75** | Có thể làm song song: bấm tải Mission Planner rồi làm bước khác trong lúc chờ |

## Ghi chú cho sổ tay

Những khái niệm `docs/so-tay/00-cai-cong-cu-pc.md` cần giải thích cho người chưa biết gì:

- **PowerShell là gì, chạy lệnh ở đâu** — cách mở, cách dán lệnh, vì sao phải mở lại cửa sổ sau khi cài thứ gì đó (biến PATH chỉ nạp lúc mở).
- **Phân biệt "chạy ở PowerShell" và "chạy ở bash trong WSL"** — đây là chỗ người mới sai nhiều nhất trong cả dự án. Mỗi khối lệnh trong mọi file phase đều ghi rõ, phải tập thói quen nhìn dòng đó trước khi dán.
- **GCS là gì** — trạm mặt đất; vì sao dự án có tới ba thứ (Mission Planner, MAVProxy, website tự làm) và mỗi thứ mạnh ở đâu.
- **Vì sao phải ghim (pin) một phiên bản Python cho dự án, và ghim bằng hai lớp** — file `.python-version` (uv đọc, commit vào git) cộng với `requires-python` trong `pyproject.toml` (chặn cài nhầm gói lên bản Python sai). Không ghim thì máy mỗi người chạy một bản khác nhau, lỗi "chạy được ở máy tôi" xuất hiện.
- **Vì sao Python 3.13 dùng được cho dự án này** — thư viện MAVLink (`pymavlink`, `MAVProxy`), GUI (`wxPython`), thị giác máy tính (`opencv-python`) và YOLO (`ultralytics`) đều có bản build sẵn (wheel) cho 3.13, đã kiểm chứng trực tiếp trên PyPI ngày 21/09/2026: `pymavlink` 2.4.49 (wheel `cp313`), `MAVProxy` 1.8.74 (pure-python), `wxPython` 4.3.1 (wheel `cp313`), `opencv-python` 5.0.0.93 (wheel `abi3`, chạy được từ 3.7 trở lên), `ultralytics` 8.4.157 (pure-python).
- **Vì sao tránh bản Python của Microsoft Store** — bản đó (đường dẫn `WindowsApps\PythonSoftwareFoundation...`) hay hỏng khi tạo virtual environment và khi cài gói có phần biên dịch C; dùng bản cài từ `winget install Python.Python.3.13` hoặc bản `uv python install` tự quản lý.
- **DFU là gì (giới thiệu sớm)** — chế độ nạp firmware cấp thấp của chip STM32; vì sao lần nạp đầu bắt buộc qua nó; vì sao STM32CubeProgrammer là công cụ đúng (nó mang driver).
- **WSL là gì** — một máy Linux chạy bên trong Windows; vì sao dự án cần nó (ArduPilot chỉ build ngon trên Linux).
- **winget là gì** — cửa hàng ứng dụng dòng lệnh của Windows; vì sao có thứ cài được bằng nó và có thứ không.
- **Cảnh báo bảo mật của Windows** — SmartScreen/Defender hay chặn installer ít người dùng; quy tắc: chỉ bấm "Run anyway" khi file đến từ nguồn chính chủ đã ghi trong phase, không bao giờ để né một cảnh báo ở nguồn lạ.
