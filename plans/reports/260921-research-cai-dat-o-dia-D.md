# Nghiên cứu: cài toàn bộ công cụ sang ổ D:, cứu ổ C:

| Ngày | Người thực hiện | Trạng thái |
|---|---|---|
| 21/09/2026 | t1k-researcher | Xong — có 3 mục đánh dấu "chưa xác minh", đều có phương án dự phòng |

## Tóm tắt điều hành

Ổ C: còn **28,4 GB**, ổ D: còn **137,9 GB**. Phase 00 hiện tại cài mọi thứ theo đường
dẫn mặc định, nghĩa là đổ thêm vài GB nữa vào C:. Báo cáo này đưa ra lệnh cài đặt và
lệnh dời chỗ đã kiểm chứng cho từng công cụ, cộng một script `scripts/setup-d-drive.ps1`
chạy được ngay.

Ba phát hiện quan trọng nhất, đều đo trực tiếp trên máy này chứ không suy đoán:

1. **`setx` sẽ phá hỏng PATH của bạn.** PATH ở phạm vi User trên máy này dài **1552 ký
   tự**, trong khi `setx` cắt cụt mọi giá trị ở 1024 ký tự. Bất kỳ hướng dẫn nào bảo
   `setx PATH ...` đều sẽ xoá mất 528 ký tự cuối. Script trong báo cáo này dùng
   `[Environment]::SetEnvironmentVariable` nên không dính lỗi đó.
2. **WSL đã an toàn rồi.** `D:\WSL\Ubuntu\ext4.vhdx` = 42,48 GB, và **không có file
   `.vhdx` nào** dưới `%LOCALAPPDATA%\Packages`. ArduPilot build thêm 6–8 GB sẽ nằm trọn
   trên D:. Không cần làm gì cho mục này ngoài một việc phòng xa (file swap, xem §7).
3. **Dọn được ngay khoảng 7 GB khỏi C:** mà chưa cần cài thêm gì — uv cache 3,7 GB, npm
   cache 2,6 GB, pnpm store trên C: 633 MB, PlatformIO 80 MB, pip cache 5 MB.

Một điều chỉnh so với đề bài: PlatformIO trên máy này mới chỉ **79,76 MB** và **chưa có
thư mục `platforms`** — tức là chưa tải toolchain nào. Đây gần như là bản cài mới, nên
cách xử lý đúng là *xoá đi cho nó dựng lại trên D:*, **không phải** "move" như đề bài giả
định. Lý do ở §5.5, có bằng chứng từ chính maintainer PlatformIO.

## Hiện trạng đo được trên máy (21/09/2026)

```
C: Used=171,00 GB  Free=28,38 GB
D: Used=613,73 GB  Free=137,91 GB
```

| Thứ | Vị trí hiện tại | Dung lượng |
|---|---|---|
| uv cache | `C:\Users\Nghaiz\AppData\Local\uv\cache` | **3 789 MB** |
| npm cache | `C:\Users\Nghaiz\AppData\Local\npm-cache` | **2 692 MB** |
| pnpm store (trên C:) | `C:\Users\Nghaiz\AppData\Local\pnpm\store` | **633 MB** |
| PlatformIO | `C:\Users\Nghaiz\.platformio` | **80 MB** (chưa có `platforms`) |
| pip cache | `C:\Users\Nghaiz\AppData\Local\pip\Cache` | 4,6 MB |
| uv tools | `C:\Users\Nghaiz\AppData\Roaming\uv\tools` | 0 MB (chưa cài tool nào) |
| uv managed Python | `C:\Users\Nghaiz\AppData\Roaming\uv\python` | chưa tồn tại |
| uv tool bin | `C:\Users\Nghaiz\.local\bin` | 223 MB — **chỉ chứa `claude.exe`**, đã nằm trong PATH |
| pnpm store (trên D:) | `D:\.pnpm-store\v11` | 3 874 MB — đã đúng chỗ |
| WSL Ubuntu | `D:\WSL\Ubuntu\ext4.vhdx` | 42,48 GB — đã đúng chỗ |
| Docker WSL | `D:\DockerDesktopWSL\disk\docker_data.vhdx` | 35,83 GB — đã đúng chỗ |

Tổng dọn được khỏi C: ≈ **7,1 GB**.

> Con số dung lượng trống nhảy nhẹ giữa các lần đo (28,38 → 30,45 GB trong lúc chạy thử)
> vì Windows tự dọn nền. Đừng ngạc nhiên nếu bạn đo ra số hơi khác.

## Quy ước thư mục dùng trong cả báo cáo

```
D:\IOT_Tools\
├─ apps\      <- phần mềm có installer (Mission Planner, MAVProxy, CubeProgrammer)
├─ cache\     <- uv, pip, npm, pnpm-store
├─ tools\     <- uv-tools, uv-python, platformio
└─ bin\       <- (tuỳ chọn) shim của uv tool, chỉ dùng nếu bạn bật -ToolBinOnD
```

---

## 1. Mission Planner — thuộc tính MSI là `INSTALLDIR`

**Kết luận: `INSTALLDIR`.** Không phải `TARGETDIR`, không phải `APPLICATIONFOLDER`,
không phải `INSTALLFOLDER`. Đã kiểm chứng hai lần độc lập.

### Bằng chứng

File `MissionPlanner-latest.msi` không build từ một file `.wxs` viết tay. Nó được sinh ra
bởi một chương trình C# — `wix/Program.cs` trong repo `ArduPilot/MissionPlanner` — chương
trình này *in ra* file `installer.wxs` rồi WiX biên dịch. Chuỗi bằng chứng:

`Msi/installer.bat` (tải trực tiếp từ raw.githubusercontent.com) gọi:

```
.\net472\wix.exe ..\bin\release\net461\
```

`wix.exe` chính là bản biên dịch của `wix/Program.cs`. Trong file đó (tôi tự tải và grep,
không nhận lại từ bên thứ ba):

```
91:  sw.WriteLine("    <Directory Id=\"INSTALLDIR\" Name=\"Mission Planner\">");
280: <Property Id=""WIXUI_INSTALLDIR"" Value=""INSTALLDIR"" />
285: <UIRef Id=""WixUI_InstallDir"" />
```

Ba dòng này nói đủ mọi thứ cần biết:

- Dòng 91 — `Directory Id` viết **HOA toàn bộ**. Theo quy ước WiX/MSI, một Directory Id
  viết hoa toàn bộ tự động trở thành **public property**, tức là đặt được từ dòng lệnh.
- Dòng 280 — `WIXUI_INSTALLDIR` trỏ vào `INSTALLDIR`, đây là cách chuẩn để nối trang
  "chọn thư mục" của giao diện vào đúng property đó.
- Dòng 285 — bộ giao diện là `WixUI_InstallDir`, bộ *duy nhất* của WiX có nút **Browse**.
  Nghĩa là đường GUI chắc chắn tồn tại (xem phần dự phòng).

Vì sao **không** phải `TARGETDIR` — dòng 177 ép nó về `[ProgramFilesFolder]`:

```
177: <SetProperty Action='SetTARGETDIR' Before='LaunchConditions' Id='TARGETDIR' Value=""[ProgramFilesFolder]"" />
```

Truyền `TARGETDIR` trên dòng lệnh sẽ bị custom action này ghi đè. Đây đúng là cái bẫy mà
đề bài yêu cầu không được đoán mò.

URL đã kiểm chứng bằng `curl.exe -sI`:

```
https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.msi
  HTTP/1.1 200 OK
  Content-Length: 119841133          (~114 MB)
  Last-Modified: Wed, 10 Sep 2025 11:33:52 GMT
```

### Lệnh cài

Mở PowerShell, `cd` tới thư mục chứa file `.msi` vừa tải:

```powershell
msiexec /i MissionPlanner-latest.msi INSTALLDIR="D:\IOT_Tools\apps\MissionPlanner" /qb
```

- `/qb` = giao diện rút gọn, có thanh tiến trình, không hỏi gì. Vì `INSTALLDIR` đã truyền
  thẳng nên không cần trang chọn thư mục.
- **Không thêm dấu `\` ở cuối đường dẫn.**
- Thư mục đích không cần tạo trước — installer có một component `InstallDirPermissions`
  chạy `CreateFolder` nên nó tự tạo.
- Muốn im lặng hoàn toàn: đổi `/qb` thành `/qn /norestart`. Tài liệu ArduPilot **không**
  xác nhận `/qn` đã được thử với chính file MSI này — đây là hành vi MSI tổng quát, nên
  dùng `/qb` cho lần đầu để còn nhìn thấy lỗi nếu có.

### Cách kiểm chứng đã vào đúng chỗ

```powershell
Test-Path "D:\IOT_Tools\apps\MissionPlanner\MissionPlanner.exe"
Get-ChildItem "D:\IOT_Tools\apps\MissionPlanner" | Measure-Object Length -Sum
Get-ItemProperty HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* |
  Where-Object DisplayName -like "*Mission Planner*" |
  Select-Object DisplayName, DisplayVersion, InstallLocation
```

Dòng cuối phải in `InstallLocation` trỏ về `D:\`. Nếu nó vẫn in
`C:\Program Files (x86)\Mission Planner` thì property đã bị bỏ qua — chuyển sang đường GUI.

### Nếu installer bỏ qua flag

Dùng giao diện, đường này chắc chắn có vì `WixUI_InstallDir` đã được khai báo ở dòng 285:

1. Double-click `MissionPlanner-latest.msi`.
2. Bấm **Next** qua màn hình chào và giấy phép.
3. Tới trang **"Select Installation Folder"**, bấm **Browse…**.
4. Gõ hoặc chọn `D:\IOT_Tools\apps\MissionPlanner`.
5. Next → Install.

### Rủi ro riêng của mục này

Các custom action đăng ký COM đều dùng `[INSTALLDIR]` động, không hardcode đường dẫn:

```
230: ExeCommand='...regasm.exe"" ""[INSTALLDIR]tlogThumbnailHandler.dll"" /codebase""'
253: <Shortcut ... Target=""[INSTALLDIR]MissionPlanner.exe"" WorkingDirectory=""INSTALLDIR"" />
```

Nên shortcut Start Menu và phần đăng ký COM đi theo đường dẫn mới, không hỏng.

⚠️ Có **một** chỗ hardcode nhưng **không nằm trong file MSI này**: `ExtLibs/Installer/Installer.cs`
(một công cụ cập nhật riêng, `Installer.exe`) có dòng
`private string installlocation = @"C:\Program Files (x86)\Mission Planner";`. Nếu sau này
bạn dùng chức năng tự cập nhật trong app, đường dẫn mặc định C: có thể quay lại. Chưa xác
minh công cụ đó còn được phát hành kèm hay không — chỉ ghi nhận để biết mà kiểm tra.

---

## 2. MAVProxy — Inno Setup, dùng `/DIR=`

**Kết luận: Inno Setup 6, dùng `/DIR=`. KHÔNG phải NSIS, nên KHÔNG dùng `/D=`.**

Đề bài lo đúng chỗ: `/D=` của NSIS bắt buộc phải là tham số **cuối cùng** và **không được
đặt trong dấu nháy**. Nhưng quy tắc đó không áp dụng ở đây, vì MAVProxy không dùng NSIS.

### Bằng chứng

`windows/mavproxy.iss` trong repo `ArduPilot/MAVProxy` (tôi tự tải về và đọc):

```
; Script generated by the Inno Setup Script Wizard.
...
[Setup]
AppId={{D81B9EDA-1357-462E-96E4-B47372709F7C}
AppName={#MyAppName}
DefaultDirName={pf}\{#MyAppName}
OutputBaseFilename=MAVProxySetup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
ChangesEnvironment=yes
```

`[Setup]`, `DefaultDirName`, `OutputBaseFilename`, `ChangesEnvironment` là các khoá đặc
trưng của Inno Setup, không tồn tại trong NSIS. Thêm nữa, workflow CI
`.github/workflows/windows_build.yml` tải đúng Inno Setup rồi biên dịch bằng `ISCC.exe`
(trình biên dịch của Inno) — nên file `.exe` phát hành chính là bản Inno.

Tài liệu chính thức Inno Setup (jrsoftware.org, trang `topic_setupcmdline.htm`):

> `/DIR="x:\dirname"`
> Overrides the default directory name displayed on the Select Destination Location wizard
> page. A fully qualified pathname must be specified.

URL đã kiểm chứng:

```
https://firmware.ardupilot.org/Tools/MAVProxy/MAVProxySetup-latest.exe
  HTTP/1.1 200 OK
  Content-Length: 236926085          (~226 MB)
  Last-Modified: Fri, 01 Aug 2025 23:39:10 GMT
```

### Lệnh cài

Phải mở PowerShell **as administrator** (lý do ngay dưới):

```powershell
.\MAVProxySetup-latest.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="D:\IOT_Tools\apps\MAVProxy"
```

Khác với NSIS, Inno cho phép đặt `/DIR=` ở bất kỳ vị trí nào và **cho phép dùng dấu nháy**.

### PATH tự động — điểm cộng

Trong `mavproxy.iss`:

```
30: ChangesEnvironment=yes
73: [Registry]
75:   ValueType: expandsz; ValueName: "PATH"; ValueData: "{olddata};{app}"; \
76:   Check: NeedsAddPath('{app}')
```

`{app}` là thư mục cài. Nghĩa là cài vào `D:\IOT_Tools\apps\MAVProxy` thì chính đường dẫn
đó được thêm vào PATH **hệ thống** (HKLM) tự động, gỡ ra thì xoá. Bạn không phải sửa PATH
tay.

Đây cũng là lý do **bắt buộc chạy quyền admin**: ghi HKLM cần quyền đó. Chạy không admin
ở chế độ `/VERYSILENT` thì bước ghi PATH sẽ hỏng lặng lẽ.

### Một chi tiết dễ giật mình

```
[InstallDelete]
Type: filesandordirs; Name: {pf}\{#MyAppName}
```

Installer **xoá** `C:\Program Files (x86)\MAVProxy` bất kể bạn cài vào đâu. Đây là dọn bản
cũ, không phải lỗi — và với mục tiêu của chúng ta thì nó còn có lợi: cài sang D: sẽ tự dọn
sạch bản C: nếu trước đó đã lỡ cài.

### Kiểm chứng

```powershell
Test-Path "D:\IOT_Tools\apps\MAVProxy\mavproxy.exe"
# mở cửa sổ PowerShell MỚI rồi:
where.exe mavproxy
mavproxy.exe --version
```

`where.exe mavproxy` phải in đường dẫn `D:\`.

### Nếu flag bị bỏ qua

Chạy file `.exe` bằng tay, tới trang **"Select Destination Location"**, bấm **Browse**,
chọn `D:\IOT_Tools\apps\MAVProxy`. Inno luôn có trang này trừ khi tác giả tắt đi — file
`.iss` ở trên không tắt.

---

## 3. STM32CubeProgrammer — InstallAnywhere, không có flag đường dẫn một dòng

**Kết luận: dùng giao diện. Không có flag kiểu `/DIR=` cho công cụ này.**

### Bằng chứng

Tài liệu hiện hành của ST tại `dev.st.com/stm32cube-docs/prog/2.23.0/en/docs/markup/CubeProg_How_To_Start/CubeProg_Installation.html`
(HTTP 200) mô tả cách cài từ dòng lệnh:

> Run the command `jre\bin\java -jar SetupSTM32CubeProgrammer-X.Y.Z.exe -console`.

Gọi installer bằng `java -jar` là dấu hiệu không thể nhầm của **InstallAnywhere** (trình
cài Java, kèm sẵn JRE). Một installer NSIS/Inno/MSI không bao giờ khởi động kiểu này.

Về cài im lặng, chính tài liệu đó nói:

> At end of an installation … it is possible to generate an auto-installation script
> containing user configuration and preferences selected during the installation process.
> … Run the Command `jre\bin\java -jar SetupSTM32CubeProgrammer-X.Y.Z.exe ABSOLUTE_PATH_TO_AUTO_INSTALL.xml`.

Tức là cơ chế là **hai bước**: cài tay một lần để nó sinh file XML ghi lại lựa chọn (gồm
thư mục cài), rồi các lần sau chạy im lặng theo file XML đó. Không có flag đơn lẻ.

### Cách làm

1. Tải bản Windows từ `st.com` (cần tài khoản ST miễn phí), giải nén.
2. Chạy `SetupSTM32CubeProgrammer-<ver>.exe`.
3. Ở trang **"Choose Install Folder"**, gõ `D:\IOT_Tools\apps\STM32CubeProgrammer`.
4. Cài xong, nếu muốn lặp lại trên máy khác thì giữ file auto-install XML nó sinh ra.

### Kiểm chứng

```powershell
Test-Path "D:\IOT_Tools\apps\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe"
& "D:\IOT_Tools\apps\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe" --version
```

### Chưa xác minh

- **Trang "Choose Install Folder" có thật sự tồn tại hay không** — chưa lấy được ảnh chụp
  hay câu mô tả từ tài liệu ST. Đây là trang mặc định của InstallAnywhere nên khả năng cao
  là có, nhưng không có câu trích dẫn để khẳng định.
  *Dự phòng:* nếu không thấy trang chọn thư mục, cứ cài mặc định rồi chấp nhận ~200–300 MB
  trên C:. Đây là công cụ dùng đúng một lần ở Phase 14, không phải thứ phình to theo thời
  gian, nên chi phí chấp nhận được.
- **Tên khoá trong file auto-install XML** (kiểu `USER_INSTALL_DIR`) — chưa xác minh. Không
  đoán. Muốn biết thì cài tay một lần rồi mở file XML nó sinh ra mà đọc.
- **Dung lượng cài đặt** — chưa xác minh; `st.com` chặn truy cập tự động (curl timeout,
  exit 28). Con số 150–300 MB hay gặp trên mạng **không** kiểm chứng được trong phiên này.

---

## 4. esptool và pymavlink — không ghi vào `Python313\`

Bối cảnh: Python 3.13 đang ở `C:\Users\Nghaiz\AppData\Local\Programs\Python\Python313\`,
và cả thư mục đó lẫn `Scripts\` đều đã nằm trong PATH. Nên lệnh trong Phase 00 hiện tại —
`py -3.13 -m pip install esptool pymavlink` — sẽ ghi thẳng vào `site-packages` trên C:.

Điều quan trọng cần phân biệt trước khi chọn cách: **`esptool` là một ứng dụng dòng lệnh,
còn `pymavlink` là một thư viện.** Hai thứ này không nên cài cùng kiểu.

### So sánh ba phương án

| | `uv tool install` + `UV_TOOL_DIR` | venv thường trên D: | `pip install --target` |
|---|---|---|---|
| Hợp với | CLI độc lập (`esptool`) | thư viện của dự án (`pymavlink`) | không hợp với cái nào |
| Nằm trên D: | Có (payload trong `UV_TOOL_DIR`) | Có (toàn bộ venv) | Có |
| Vào PATH thế nào | uv tạo sẵn shim trong thư mục bin | phải `activate`, hoặc gọi đường dẫn đầy đủ | không có gì vào PATH |
| Cô lập phiên bản | Mỗi tool một venv riêng | Một venv cho cả dự án | Không cô lập, dễ đụng nhau |
| Nhược điểm | Thêm một lớp khái niệm | Phải nhớ activate | `--target` hay vỡ với gói có entry point |
| **Xếp hạng** | **1 — cho esptool** | **1 — cho pymavlink** | **Không dùng** |

`--target` bị loại vì nó không tạo script trong `Scripts\` một cách đáng tin và dễ tạo ra
tình trạng gói chồng gói.

### 4a. esptool — `uv tool install`

Biến `UV_TOOL_DIR` đã được kiểm chứng **thực nghiệm ngay trên máy này**, không phải đọc tài
liệu rồi tin. Tôi đặt biến ở phạm vi tiến trình rồi hỏi lại uv:

```
$env:UV_TOOL_DIR='D:\IOT_Tools\_probe\tools'   ->  uv tool dir       -> D:\IOT_Tools\_probe\tools
$env:UV_TOOL_BIN_DIR='D:\IOT_Tools\_probe\bin' ->  uv tool dir --bin -> D:\IOT_Tools\_probe\bin
$env:UV_CACHE_DIR='D:\IOT_Tools\_probe\cache'  ->  uv cache dir      -> D:\IOT_Tools\_probe\cache
$env:UV_PYTHON_INSTALL_DIR='D:\IOT_Tools\_probe\python' -> uv python dir -> D:\IOT_Tools\_probe\python
```

Cả bốn đều được tôn trọng trên `uv 0.12.12`. Tài liệu chính thức
(`docs.astral.sh/uv/reference/environment/`, HTTP 200) khớp:

> `UV_TOOL_DIR`: "Specifies the directory where uv stores managed tools."
> `UV_TOOL_BIN_DIR`: "Specifies the 'bin' directory for installing tool executables."

⚠️ **Đề bài hỏi so sánh với `uv tool install --tools-dir`. Flag đó KHÔNG TỒN TẠI.** Tôi đã
đọc toàn bộ `uv tool install --help` trên máy: chỉ có `--cache-dir`, không có `--tools-dir`.
`uv tool dir --help` cũng chỉ có đúng một tuỳ chọn là `--bin`. Vậy đường duy nhất là biến
môi trường.

Lệnh (sau khi đã đặt biến ở §5 và mở cửa sổ mới):

```powershell
uv tool install esptool --python 3.13
```

**Về thư mục bin — khuyến nghị giữ mặc định.** `uv tool dir --bin` đang trả về
`C:\Users\Nghaiz\.local\bin`. Thư mục đó **đã nằm trong PATH** và hiện chỉ chứa đúng một
file (`claude.exe`). Shim mà uv tạo ra chỉ vài trăm KB, còn phần nặng (venv của tool) nằm
trong `UV_TOOL_DIR` trên D:. Giữ bin ở mặc định thì **không phải đụng vào PATH lần nào** —
mà sửa PATH chính là thao tác rủi ro nhất trong cả quy trình này (xem §9).

Nếu vẫn muốn bin nằm trên D:, dùng `-ToolBinOnD` của script; nó sẽ thêm đường dẫn vào PATH
bằng .NET API chứ không dùng `setx`. Sau đó:

```powershell
uv tool update-shell
```

Tài liệu (`docs.astral.sh/uv/concepts/tools/`) xác nhận lệnh này tồn tại:

> "The `uv tool update-shell` command can be used to add the executable directory to the
> `PATH` in common shell configuration files."

Kiểm chứng:

```powershell
where.exe esptool
esptool version
uv tool list
```

`esptool version` phải in `v5.x`. Nhớ cú pháp v5 dùng gạch nối (`write-flash`), không phải
gạch dưới.

### 4b. pymavlink — venv của dự án trên D:

`pymavlink` là thư viện được `import`, không phải lệnh để gõ. Chỗ đúng của nó là venv của
dự án, và vì repo nằm ở `D:\Coding\IOT-CV` nên venv cũng ở D: luôn:

```powershell
cd D:\Coding\IOT-CV
uv venv --python 3.13
uv pip install pymavlink
```

`uv venv` tạo `.venv` ngay trong thư mục dự án, tức là trên D:. Kiểm chứng:

```powershell
.\.venv\Scripts\python.exe -c "import pymavlink, sys; print(pymavlink.__version__); print(sys.executable)"
```

Dòng `sys.executable` phải bắt đầu bằng `D:\`.

Không cần thêm gì vào PATH — mọi script và test của dự án đều gọi qua `uv run` hoặc qua
`.venv\Scripts\python.exe`.

> **Điểm cộng bất ngờ:** vì cache uv sẽ nằm trên D: (§5) và venv cũng trên D:, hai thứ
> **cùng ổ** nên uv hardlink được từ cache vào venv thay vì copy. Tài liệu uv
> (`docs.astral.sh/uv/concepts/cache/`) nói thẳng:
> > "It is important for performance for the cache directory to be located on the same file
> > system as the Python environment uv is operating on."
>
> Nếu để cache ở C: mà venv ở D: thì mỗi lần cài gói sẽ là copy thật — chậm hơn và tốn chỗ
> gấp đôi. Dời cache sang D: vừa cứu C:, vừa nhanh hơn.

---

## 5. Dời cache — lệnh và quy trình

Nguyên tắc chung, áp dụng cho mọi biến dưới đây: **dùng `[Environment]::SetEnvironmentVariable`,
tuyệt đối không dùng `setx`.** Lý do ở §9, rủi ro #1.

### Bảng tổng hợp

| Biến / cấu hình | Giá trị đặt | Mặc định cũ | Đã kiểm chứng bằng |
|---|---|---|---|
| `UV_CACHE_DIR` | `D:\IOT_Tools\cache\uv` | `%LOCALAPPDATA%\uv\cache` | thực nghiệm + docs |
| `UV_TOOL_DIR` | `D:\IOT_Tools\tools\uv-tools` | `%APPDATA%\uv\tools` | thực nghiệm + docs |
| `UV_PYTHON_INSTALL_DIR` | `D:\IOT_Tools\tools\uv-python` | `%APPDATA%\uv\python` | thực nghiệm + docs |
| `PIP_CACHE_DIR` | `D:\IOT_Tools\cache\pip` | `%LOCALAPPDATA%\pip\Cache` | docs |
| `NPM_CONFIG_CACHE` | `D:\IOT_Tools\cache\npm` | `%LOCALAPPDATA%\npm-cache` | docs |
| pnpm `store-dir` | `D:\IOT_Tools\cache\pnpm-store` | tự tạo theo từng ổ | docs + thực nghiệm |
| `PLATFORMIO_CORE_DIR` | `D:\IOT_Tools\tools\platformio` | `%HOMEPATH%\.platformio` | docs + issue #3554 |

### 5.1 `UV_CACHE_DIR` — 3 789 MB

```powershell
[Environment]::SetEnvironmentVariable('UV_CACHE_DIR','D:\IOT_Tools\cache\uv','User')
```

**Dời dữ liệu cũ.** Đây là chỗ tôi phải nói rõ giới hạn: tài liệu uv **không mô tả** quy
trình chuyển thư mục cache có sẵn. Chỉ có `uv cache clean` (xoá sạch) và `uv cache prune`
(xoá phần không dùng). Nên có hai đường:

**Đường A — chuyển thư mục (giữ được 3,7 GB đã tải, KHÔNG được tài liệu bảo chứng):**

```powershell
# đóng hết VS Code / terminal / tiến trình python trước
robocopy "$env:LOCALAPPDATA\uv\cache" "D:\IOT_Tools\cache\uv" /E /MOVE /R:1 /W:1 /MT:16
```

**Đường B — xoá rồi để nó tự tải lại (được tài liệu bảo chứng, mất 3,7 GB tải lại):**

```powershell
uv cache clean
Remove-Item "$env:LOCALAPPDATA\uv" -Recurse -Force -ErrorAction SilentlyContinue
```

Khuyến nghị: **thử đường A trước**. Cache của uv là content-addressed nên chuyển thường
không sao. Nếu sau đó `uv pip install` báo lỗi lạ về cache, chạy `uv cache clean` là về
đường B — **mất mát tối đa là phải tải lại, không mất dữ liệu dự án**. Đó là lý do rủi ro
này chấp nhận được.

Kiểm chứng: `uv cache dir` in đường dẫn D:, rồi `uv pip install --dry-run pymavlink` chạy
trót lọt.

### 5.2 `PIP_CACHE_DIR` — 4,6 MB

Tài liệu pip (`pip.pypa.io/en/stable/topics/configuration/`) cho quy tắc ánh xạ:

> "Pip's command line options can be set with environment variables using the format
> `PIP_<UPPER_LONG_NAME>`. Dashes (`-`) have to be replaced with underscores (`_`)."

`--cache-dir` → `PIP_CACHE_DIR`.

```powershell
[Environment]::SetEnvironmentVariable('PIP_CACHE_DIR','D:\IOT_Tools\cache\pip','User')
robocopy "$env:LOCALAPPDATA\pip\Cache" "D:\IOT_Tools\cache\pip" /E /MOVE /R:1 /W:1
```

Chỉ 4,6 MB nên xoá đi cũng chẳng sao. Kiểm chứng: `py -3.13 -m pip cache dir`.

### 5.3 pnpm store — và một hiểu lầm cần gỡ

Trên máy này có chuyện thú vị: `pnpm config get store-dir` trả về `undefined`, nhưng
`pnpm store path` lại trả về `D:\.pnpm-store\v11` (3 874 MB). Đồng thời vẫn còn một store
nữa ở `C:\Users\Nghaiz\AppData\Local\pnpm\store` (633 MB).

Không phải lỗi. Tài liệu pnpm (`pnpm.io/faq`) giải thích chính xác:

> "The package store should be on the same drive and filesystem as installations, otherwise
> packages will be copied, not linked."
> "If the store path is not set, then multiple stores are created (one per drive or filesystem)."

Tức là chưa cấu hình gì thì pnpm **tự tạo một store cho mỗi ổ đĩa**. Store trên D: phục vụ
project trên D:, store trên C: là tàn dư từ project nào đó trên C:.

Cố định store về D::

```powershell
pnpm config set store-dir D:\IOT_Tools\cache\pnpm-store --global
```

Lưu ý: đây là **cấu hình của pnpm ghi vào `.npmrc`**, không phải biến môi trường Windows.

Dọn 633 MB trên C::

```powershell
pnpm store prune
Remove-Item "$env:LOCALAPPDATA\pnpm\store" -Recurse -Force -ErrorAction SilentlyContinue
```

Kiểm chứng: `pnpm config get store-dir` và `pnpm store path` cùng in đường dẫn mới.

⚠️ Đánh đổi cần biết: khi đã cố định store về D:, nếu sau này bạn có project nằm trên C:
thì pnpm sẽ **copy** thay vì hardlink cho project đó. Mọi project của dự án này đều ở D:
nên không ảnh hưởng.

### 5.4 npm cache — 2 692 MB

Tài liệu npm (`docs.npmjs.com/cli/v11/using-npm/config`) xác nhận cả hai đường:

> "Any environment variables that start with `npm_config_` will be interpreted as a
> configuration parameter."
> "Config values are case-insensitive, so `NPM_CONFIG_FOO=bar` will work the same."

Chọn **một** trong hai, đừng dùng cả hai (thứ tự ưu tiên giữa `.npmrc` và biến môi trường
chưa xác minh được bằng trích dẫn trực tiếp):

```powershell
# Cách 1 - ghi vào .npmrc, bền vững, KHUYẾN NGHỊ
npm config set cache D:\IOT_Tools\cache\npm --global

# Cách 2 - biến môi trường
[Environment]::SetEnvironmentVariable('NPM_CONFIG_CACHE','D:\IOT_Tools\cache\npm','User')
```

Dời dữ liệu cũ (cache npm là content-addressable, chuyển an toàn):

```powershell
robocopy "$env:LOCALAPPDATA\npm-cache" "D:\IOT_Tools\cache\npm" /E /MOVE /R:1 /W:1 /MT:16
npm cache verify
```

`npm cache verify` là bước kiểm chứng đồng thời là bước sửa: tài liệu mô tả nó
"Verify the contents of the cache folder, garbage collecting any unneeded data, and
verifying the integrity of the cache index and all cached data."

Kiểm chứng: `npm config get cache`.

### 5.5 `PLATFORMIO_CORE_DIR` — đây là chỗ đề bài cần chỉnh

Đề bài nói "user đã cài PlatformIO nên đây là MOVE, không phải cài mới". Tôi đo lại và
thấy khác:

```
C:\Users\Nghaiz\.platformio  = 79,76 MB
  .cache     1,88 MB
  packages   3,99 MB
  penv      34,33 MB
  python3   39,56 MB
```

**Không có thư mục `platforms`.** Nghĩa là PlatformIO chưa từng tải toolchain nào về —
extension mới cài xong, chưa mở project ESP32 lần nào. Đây thực chất là bản cài trắng.

Và quan trọng hơn: **"move" là cách làm SAI, đã được maintainer xác nhận là hỏng.**
Issue `platformio/platformio-core#3554`, người dùng làm đúng cái mà đề bài mô tả —
`mv .platformio new_folder` rồi set `PLATFORMIO_CORE_DIR` — và nhận lỗi:

```
/home/user/new_folder_name/penv/bin/platformio:
/home/user/.platformio/penv/bin/python: bad interpreter: No such file or directory
```

Vì `penv` là một virtualenv, mà virtualenv **nướng cứng đường dẫn tuyệt đối** vào shebang
của script và vào `pyvenv.cfg`. Copy sang chỗ khác là gãy.

Ivan Kravets (chủ repo PlatformIO) trả lời nguyên văn:

> "You have to set custom system environments before our installer. So, export custom envs,
> remove `.platformio`."

Vậy quy trình đúng — và với 80 MB không toolchain thì đây cũng là quy trình **rẻ nhất**:

```powershell
# 1. Đặt biến TRƯỚC
[Environment]::SetEnvironmentVariable('PLATFORMIO_CORE_DIR','D:\IOT_Tools\tools\platformio','User')

# 2. Đóng hoàn toàn VS Code (không chỉ đóng cửa sổ - thoát hẳn)

# 3. Đổi tên thư mục cũ (đổi tên, KHÔNG xoá - còn đường lùi)
Rename-Item "$env:USERPROFILE\.platformio" ".platformio.old"

# 4. Mở lại VS Code, để PlatformIO tự dựng lại penv trên D: (vài phút)

# 5. Chạy thử một project. Chạy được thì mới xoá:
#    Remove-Item "$env:USERPROFILE\.platformio.old" -Recurse -Force
```

Tài liệu (`docs.platformio.org/en/latest/projectconf/.../core_dir.html`) xác nhận đây là
thư mục chứa toàn bộ phần nặng:

> "The `core_dir` variable points out the directory used for all development platform
> packages (toolchains, frameworks, SDKs, upload and debug tools), global libraries for
> Library Dependency Finder (LDF), and other PlatformIO Core service data."

Đúng vì sao phải làm sớm: một khi cài platform ESP32, thư mục này phình lên **hàng GB**
(toolchain xtensa + framework Arduino/ESP-IDF). Làm bây giờ tốn 80 MB tải lại; làm sau
Phase 12 thì tốn hàng GB và rủi ro cao hơn nhiều.

⚠️ **Chưa xác minh:** không tìm được câu nào trong tài liệu hay issue nào nói thẳng
"extension VS Code có đọc `PLATFORMIO_CORE_DIR`". Suy luận là có, vì trang cài đặt của
extension (`docs.platformio.org/.../vscode.html`) **không có** tuỳ chọn nào tương đương
`core_dir` (chỉ có `platformio-ide.customPATH`, `useBuiltinPIOCore`, `useBuiltinPython`,
`useDevelopmentPIOCore`), nên extension không tự quyết định chỗ này mà để Core tự phân
giải — và Core thì chắc chắn đọc biến đó.
*Dự phòng:* sau bước 4, mở terminal trong VS Code và chạy `pio system info`; dòng
`Core Directory` phải trỏ về D:. Nếu vẫn ra C:, khởi động VS Code từ một PowerShell đã có
biến (`code .`) để tiến trình con thừa kế biến.

Kiểm chứng chung:

```powershell
pio system info
# hoặc nếu pio chưa vào PATH:
& "D:\IOT_Tools\tools\platformio\penv\Scripts\pio.exe" system info
```

---

## 6. uv quản lý Python — `UV_PYTHON_INSTALL_DIR`

**Mặc định trên máy này:** `uv python dir` trả về `C:\Users\Nghaiz\AppData\Roaming\uv\python`
(hiện chưa tồn tại — chưa cài bản Python nào qua uv).

**Chuyển được sang D:, đã kiểm chứng thực nghiệm** (xem §4a — đặt biến rồi hỏi `uv python dir`,
nó trả về đúng đường dẫn D:). Tài liệu
(`docs.astral.sh/uv/reference/environment/`) xác nhận:

> `UV_PYTHON_INSTALL_DIR`: "Specifies the directory for storing managed Python installations."

```powershell
[Environment]::SetEnvironmentVariable('UV_PYTHON_INSTALL_DIR','D:\IOT_Tools\tools\uv-python','User')
```

Kiểm chứng:

```powershell
uv python dir            # phải in D:\IOT_Tools\tools\uv-python
uv python list
```

Vì sao đáng quan tâm dù dự án ghim 3.13 (đã có sẵn bản cài từ winget trên C:): mỗi bản
Python do uv quản lý nặng khoảng **150–200 MB**. Nếu về sau có phase nào cần một bản khác
(ví dụ một thư viện thị giác máy tính chưa có wheel cho 3.13), `uv python install` sẽ đổ
vào C: nếu không đặt biến. Đặt trước thì khỏi phải nhớ.

Lưu ý: biến này **không** ảnh hưởng tới bản Python 3.13 đã cài bằng winget — bản đó vẫn ở
`C:\Users\Nghaiz\AppData\Local\Programs\Python\Python313\` và vẫn là bản `py -3.13` gọi
tới. Chúng ta không đụng vào nó.

---

## 7. WSL — đã nằm đúng chỗ, chỉ còn một lỗ hổng phòng xa

### Xác nhận: vhdx trên D:, không ăn C:

Bằng chứng mạnh nhất là registry Lxss, nơi Windows ghi nhận chỗ ở thật của từng distro:

```
DistributionName : Ubuntu
BasePath         : D:\WSL\Ubuntu
Version          : 2

DistributionName : docker-desktop
BasePath         : \\?\D:\DockerDesktopWSL\main
Version          : 2
```

File thật:

```
D:\WSL\Ubuntu\ext4.vhdx                    42,48 GB
D:\DockerDesktopWSL\disk\docker_data.vhdx  35,83 GB
D:\DockerDesktopWSL\main\ext4.vhdx          0,10 GB
```

Và bằng chứng phủ định — quét `%LOCALAPPDATA%\Packages` tìm `*.vhdx`: **không có file nào.**
Kết luận: toàn bộ hệ thống file của Ubuntu tăng trưởng trong `ext4.vhdx` trên D:. ArduPilot
clone + build 6–8 GB sẽ nằm trọn trên D:.

Bên trong Ubuntu:

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sdf       1007G   37G  920G   4% /
```

> ⚠️ Hai chỗ Phase 00 hiện đang mô tả sai, cần sửa khi cập nhật file phase:
> - Phase 00 nói Ubuntu "đang trống, chưa cài gì" — thực tế **đã dùng 37 GB**.
> - Phase 00 ghi thiết bị là `/dev/sdd` — hiện tại là `/dev/sdf`. Tên thiết bị đổi theo
>   thứ tự gắn đĩa, **đừng ghim nó vào tài liệu**; kiểm tra bằng `df -h /` là đủ.

### Lỗ hổng duy nhất: file swap mặc định nằm trên C:

Tài liệu Microsoft (`learn.microsoft.com/en-us/windows/wsl/wsl-config`, HTTP 200), mục
`[wsl2]`:

> `swap` — Default: "25% of memory size on Windows rounded up to the nearest GB"
> `swapFile` — Default: `%Temp%\swap.vhdx`

và chú thích trong ví dụ `.wslconfig` của chính trang đó:

> `# Sets swapfile path location, default is %UserProfile%\AppData\Local\Temp\swap.vhdx`

Tức là file swap của WSL mặc định nằm **trên C:**, bất kể distro ở đâu. Hiện tại máy này
**chưa có** `.wslconfig` và **chưa có** `swap.vhdx` nào trong `%TEMP%` — nên lỗ hổng đang
ngủ. Nhưng khi build ArduPilot (việc ngốn RAM), swap có thể được tạo và ăn vài GB của C:
đúng lúc C: đang chật.

Bịt trước bằng cách tạo `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
swapFile=D:\\WSL\\swap.vhdx
```

(Trong `.wslconfig`, dấu `\` phải viết đôi.) Rồi `wsl --shutdown` để nạp lại.
Muốn tắt hẳn swap thì dùng `swap=0` — nhưng với việc build ArduPilot thì **không nên tắt**,
cứ chuyển nó sang D:.

### Nén vhdx khi cần

Đo được: file 42,48 GB, size-on-disk cũng 42,48 GB, `fsutil sparse queryflag` báo
**"This file is NOT set as sparse"**. Nghĩa là nó đã cấp phát thật toàn bộ 42 GB — nén sẽ
có tác dụng nếu bên trong đã xoá bớt.

Hai công cụ thông dụng **đều không dùng được trên máy này**, đã kiểm tra:

- `Optimize-VHD` → `NOT AVAILABLE`. Nó thuộc module Hyper-V, mà đây là **Windows 11 Home**.
- `wsl --manage <Distro> --set-sparse true` → `wsl --help` trên máy này **không có**
  `--manage` lẫn `--set-sparse`; `wsl --version` không in gì, tức là đang dùng bản WSL
  inbox cũ. Tài liệu MS ghi rõ `wsl --manage` chỉ có từ "WSL releases 2.5 and higher".

**Bước nên làm trước tiên** — nâng WSL lên bản Store để có `--manage`:

```powershell
wsl --update
wsl --version        # sau khi update phải in ra số phiên bản
```

Nếu sau đó `--manage` xuất hiện, đường sạch nhất là:

```powershell
wsl --shutdown
wsl --manage Ubuntu --set-sparse true
```

⚠️ **Chưa xác minh — đọc kỹ trước khi chạy diskpart.** Đề bài giả định trang
`learn.microsoft.com/en-us/windows/wsl/disk-space` có mô tả quy trình `compact vdisk`.
Đã đọc hết trang đó: **không có**. Trang chỉ mô tả cách *mở rộng* (`expand vdisk maximum=`)
và cách sửa lỗi bằng `e2fsck`. Không có `compact vdisk`, không có `attach vdisk readonly`.

Công thức diskpart hay lưu truyền dưới đây là **khả năng có thật của diskpart** (một công
cụ inbox của Windows, không cần Hyper-V) nhưng **không lấy được câu bảo chứng từ tài liệu
WSL của Microsoft**:

```
wsl --shutdown
diskpart
  select vdisk file="D:\WSL\Ubuntu\ext4.vhdx"
  attach vdisk readonly
  compact vdisk
  detach vdisk
  exit
```

*Dự phòng an toàn:* **sao lưu `ext4.vhdx` trước khi nén** (copy sang chỗ khác trên D:, cần
42 GB trống — hiện có 137 GB nên thoải mái). Ưu tiên đường `wsl --update` rồi `--set-sparse`
hơn là diskpart. Và thành thật mà nói: **hiện tại chưa cần nén gì cả** — D: còn 137 GB,
việc này chỉ đáng làm khi D: bắt đầu chật.

Một tuỳ chọn phòng xa nữa, cho các vhdx **tạo mới về sau**:

```ini
[experimental]
sparseVhd=true
```

Tài liệu ghi "any **newly created** VHD will be set to sparse automatically" — nên nó
**không** làm gì với file 42 GB đang có. Chỉ có lợi về sau.

---

## 8. `scripts/setup-d-drive.ps1`

Script dưới đây đã **parse sạch** (`[Parser]::ParseFile` báo không lỗi cú pháp) và đã
**chạy thử dry-run thành công** trên chính máy này. Mặc định là chạy thử; muốn thi hành
thật phải thêm `-Apply`.

```
pwsh -File scripts/setup-d-drive.ps1                        # chạy thử, không đổi gì
pwsh -File scripts/setup-d-drive.ps1 -Apply                 # đặt biến + tạo thư mục
pwsh -File scripts/setup-d-drive.ps1 -Apply -MoveExisting   # + chuyển dữ liệu cũ
```

Tính idempotent: biến nào đã đúng giá trị thì in `[SKIP]`, thư mục đã có thì bỏ qua. Chạy
lại bao nhiêu lần cũng không hỏng.

```powershell
<#
.SYNOPSIS
    Dồn toàn bộ cache và công cụ của dự án IOT-CV sang ổ D:, giải phóng ổ C:.

.DESCRIPTION
    Idempotent: chạy lại nhiều lần không hỏng gì. Mặc định là DRY-RUN.
    Muốn thi hành thật thì thêm -Apply.

.EXAMPLE
    pwsh -File scripts/setup-d-drive.ps1
    pwsh -File scripts/setup-d-drive.ps1 -Apply
    pwsh -File scripts/setup-d-drive.ps1 -Apply -MoveExisting
#>
[CmdletBinding()]
param(
    [string] $Root = 'D:\IOT_Tools',
    [switch] $Apply,
    [switch] $MoveExisting,
    [switch] $ToolBinOnD
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ----------------------------------------------------------------------------
# Tiện ích
# ----------------------------------------------------------------------------

function Get-FreeSpaceTable {
    foreach ($letter in 'C', 'D') {
        $d = Get-PSDrive -Name $letter -PSProvider FileSystem -ErrorAction SilentlyContinue
        if ($d) {
            [pscustomobject]@{
                Drive  = "$letter`:"
                FreeGB = [math]::Round($d.Free / 1GB, 2)
                UsedGB = [math]::Round($d.Used / 1GB, 2)
            }
        }
    }
}

function Get-DirSizeMB {
    param([string] $Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $sum = (Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum
    if (-not $sum) { return 0 }
    return [math]::Round($sum / 1MB, 2)
}

function Write-Step {
    param([string] $Text)
    Write-Host ''
    Write-Host "== $Text" -ForegroundColor Cyan
}

function Write-Act {
    param([string] $Text, [string] $State = 'DO')
    $color = switch ($State) {
        'OK'   { 'Green' }
        'SKIP' { 'DarkGray' }
        'WARN' { 'Yellow' }
        'DRY'  { 'Magenta' }
        default { 'White' }
    }
    Write-Host ("  [{0,-4}] {1}" -f $State, $Text) -ForegroundColor $color
}

function Ensure-Dir {
    param([string] $Path)
    if (Test-Path -LiteralPath $Path) {
        Write-Act "thư mục đã có: $Path" 'SKIP'
        return
    }
    if ($Apply) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Act "tạo thư mục: $Path" 'OK'
    }
    else {
        Write-Act "sẽ tạo thư mục: $Path" 'DRY'
    }
}

# QUAN TRỌNG: KHÔNG dùng setx. setx cắt cụt giá trị ở 1024 ký tự.
# PATH của người dùng này dài 1552 ký tự -> setx PATH sẽ phá hỏng PATH.
function Set-UserEnv {
    param([string] $Name, [string] $Value)
    $current = [Environment]::GetEnvironmentVariable($Name, 'User')
    if ($current -eq $Value) {
        Write-Act "$Name đã đúng: $Value" 'SKIP'
        return
    }
    if ($Apply) {
        [Environment]::SetEnvironmentVariable($Name, $Value, 'User')
        Set-Item -Path "Env:$Name" -Value $Value   # có hiệu lực ngay trong phiên này
        Write-Act "$Name = $Value  (cũ: '$current')" 'OK'
    }
    else {
        Write-Act "sẽ đặt $Name = $Value  (cũ: '$current')" 'DRY'
    }
}

function Move-Tree {
    param([string] $From, [string] $To, [string] $Label)

    if (-not (Test-Path -LiteralPath $From)) {
        Write-Act "$Label - nguồn không tồn tại, bỏ qua: $From" 'SKIP'
        return
    }
    $sizeMB = Get-DirSizeMB -Path $From
    if ($sizeMB -eq 0) {
        Write-Act "$Label - nguồn rỗng, bỏ qua" 'SKIP'
        return
    }

    if (-not $MoveExisting) {
        Write-Act "$Label - có $sizeMB MB ở $From (thêm -MoveExisting để chuyển)" 'WARN'
        return
    }
    if (-not $Apply) {
        Write-Act "sẽ chuyển $Label ($sizeMB MB): $From -> $To" 'DRY'
        return
    }

    Ensure-Dir $To
    Write-Act "đang chuyển $Label ($sizeMB MB)..." 'DO'
    # robocopy chịu được đường dẫn dài và cây thư mục sâu, tốt hơn Move-Item
    $null = robocopy $From $To /E /MOVE /NFL /NDL /NJH /NJS /R:1 /W:1 /MT:16
    $rc = $LASTEXITCODE
    if ($rc -lt 8) {
        Write-Act "$Label đã chuyển xong (robocopy rc=$rc)" 'OK'
    }
    else {
        Write-Act "$Label CHUYỂN LỖI (robocopy rc=$rc) - dữ liệu cũ vẫn còn ở $From" 'WARN'
    }
}

# ----------------------------------------------------------------------------
# 0. Kiểm tra tiền đề
# ----------------------------------------------------------------------------

Write-Host ''
Write-Host '=============================================================' -ForegroundColor White
Write-Host ' setup-d-drive.ps1 - dồn cache/công cụ sang ổ D:' -ForegroundColor White
Write-Host '=============================================================' -ForegroundColor White
if (-not $Apply) {
    Write-Host ' CHE DO THU (dry-run). Them -Apply de thi hanh that.' -ForegroundColor Magenta
}

$rootDrive = (Split-Path -Qualifier $Root)
if (-not (Test-Path -LiteralPath "$rootDrive\")) {
    throw "Không thấy ổ $rootDrive. Sửa tham số -Root."
}

Write-Step 'Dung lượng TRƯỚC khi chạy'
$before = Get-FreeSpaceTable
$before | Format-Table -AutoSize | Out-String | Write-Host

# ----------------------------------------------------------------------------
# 1. Tạo cây thư mục
# ----------------------------------------------------------------------------

Write-Step "1. Tạo cây thư mục dưới $Root"

$dirCache = Join-Path $Root 'cache'
$dirTools = Join-Path $Root 'tools'
$dirApps  = Join-Path $Root 'apps'
$dirBin   = Join-Path $Root 'bin'

Ensure-Dir $Root
Ensure-Dir $dirCache
Ensure-Dir $dirTools
Ensure-Dir $dirApps
if ($ToolBinOnD) { Ensure-Dir $dirBin }

$pUvCache   = Join-Path $dirCache 'uv'
$pPipCache  = Join-Path $dirCache 'pip'
$pNpmCache  = Join-Path $dirCache 'npm'
$pPnpmStore = Join-Path $dirCache 'pnpm-store'
$pUvTools   = Join-Path $dirTools 'uv-tools'
$pUvPython  = Join-Path $dirTools 'uv-python'
$pPio       = Join-Path $dirTools 'platformio'

foreach ($p in $pUvCache, $pPipCache, $pNpmCache, $pPnpmStore, $pUvTools, $pUvPython, $pPio) {
    Ensure-Dir $p
}

# ----------------------------------------------------------------------------
# 2. Biến môi trường (User scope)
# ----------------------------------------------------------------------------

Write-Step '2. Đặt biến môi trường ở phạm vi User'

Set-UserEnv 'UV_CACHE_DIR'          $pUvCache
Set-UserEnv 'UV_TOOL_DIR'           $pUvTools
Set-UserEnv 'UV_PYTHON_INSTALL_DIR' $pUvPython
Set-UserEnv 'PIP_CACHE_DIR'         $pPipCache
Set-UserEnv 'NPM_CONFIG_CACHE'      $pNpmCache
Set-UserEnv 'PLATFORMIO_CORE_DIR'   $pPio

if ($ToolBinOnD) {
    Set-UserEnv 'UV_TOOL_BIN_DIR' $dirBin
    # Sửa PATH bằng .NET API, TUYỆT ĐỐI không dùng setx (cắt cụt ở 1024 ký tự)
    $userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($userPath -split ';' -contains $dirBin) {
        Write-Act "PATH đã chứa $dirBin" 'SKIP'
    }
    elseif ($Apply) {
        [Environment]::SetEnvironmentVariable('PATH', ($userPath.TrimEnd(';') + ';' + $dirBin), 'User')
        Write-Act "đã thêm $dirBin vào PATH (User), độ dài mới = $(($userPath + ';' + $dirBin).Length)" 'OK'
    }
    else {
        Write-Act "sẽ thêm $dirBin vào PATH (User)" 'DRY'
    }
}
else {
    $defaultBin = Join-Path $env:USERPROFILE '.local\bin'
    Write-Act "UV_TOOL_BIN_DIR giữ mặc định ($defaultBin) - đã nằm trong PATH, chỉ chứa shim vài trăm KB" 'SKIP'
}

# ----------------------------------------------------------------------------
# 3. pnpm store (không phải biến môi trường - là config của pnpm)
# ----------------------------------------------------------------------------

Write-Step '3. pnpm store-dir'

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $curStore = (pnpm config get store-dir 2>$null)
    if ($curStore -eq $pPnpmStore) {
        Write-Act "pnpm store-dir đã đúng: $pPnpmStore" 'SKIP'
    }
    elseif ($Apply) {
        pnpm config set store-dir $pPnpmStore --global | Out-Null
        Write-Act "pnpm config set store-dir $pPnpmStore (cũ: '$curStore')" 'OK'
    }
    else {
        Write-Act "sẽ đặt pnpm store-dir = $pPnpmStore (cũ: '$curStore')" 'DRY'
    }
    Write-Act "LƯU Ý: store phải cùng ổ với project thì pnpm mới hardlink được. Project ở D: -> store ở D: là đúng." 'WARN'
}
else {
    Write-Act 'không tìm thấy pnpm, bỏ qua' 'SKIP'
}

# ----------------------------------------------------------------------------
# 4. Chuyển dữ liệu cũ
# ----------------------------------------------------------------------------

Write-Step '4. Chuyển cache đang nằm trên ổ C:'

$running = Get-Process -Name node, npm, pnpm, python, py, uv, Code, platformio -ErrorAction SilentlyContinue
if ($running) {
    $names = ($running | Select-Object -ExpandProperty Name -Unique) -join ', '
    Write-Act "Đang có tiến trình chạy: $names -- đóng hết trước khi chuyển, nếu không robocopy sẽ bỏ sót file đang bị khoá." 'WARN'
}

# uv cache: tài liệu uv KHÔNG mô tả quy trình move. Chuyển thư mục thường chạy tốt
# (cache là content-addressed). Nếu sau đó uv báo lỗi cache -> chạy: uv cache clean
Move-Tree (Join-Path $env:LOCALAPPDATA 'uv\cache')  $pUvCache   'uv cache'
Move-Tree (Join-Path $env:LOCALAPPDATA 'pip\Cache') $pPipCache  'pip cache'
Move-Tree (Join-Path $env:LOCALAPPDATA 'npm-cache') $pNpmCache  'npm cache'

# pnpm: KHÔNG chuyển store bằng tay. pnpm store là content-addressable,
# cách an toàn là để store cũ lại rồi prune, store mới tự đầy lên khi cài.
$oldPnpmStore = Join-Path $env:LOCALAPPDATA 'pnpm\store'
$oldPnpmMB = Get-DirSizeMB -Path $oldPnpmStore
if ($oldPnpmMB) {
    Write-Act "store pnpm cũ trên C: còn $oldPnpmMB MB tại $oldPnpmStore" 'WARN'
    Write-Act "  giải phóng bằng: pnpm store prune   (rồi xoá tay thư mục trên nếu vẫn còn)" 'WARN'
}

# ----------------------------------------------------------------------------
# 5. PlatformIO - trường hợp đặc biệt
# ----------------------------------------------------------------------------

Write-Step '5. PlatformIO core dir'

$oldPio = Join-Path $env:USERPROFILE '.platformio'
$oldPioMB = Get-DirSizeMB -Path $oldPio

if ($null -eq $oldPioMB) {
    Write-Act 'chưa có ~/.platformio, sẽ tự tạo trên D: ở lần chạy đầu' 'SKIP'
}
else {
    Write-Act "~/.platformio hiện $oldPioMB MB" 'DO'
    # penv là virtualenv chứa ĐƯỜNG DẪN TUYỆT ĐỐI -> copy sang chỗ khác là hỏng.
    # (platformio/platformio-core#3554: "bad interpreter"). Cách sạch: đổi tên, để PIO dựng lại.
    if ($Apply -and $MoveExisting) {
        $backup = "$oldPio.old"
        if (Test-Path -LiteralPath $backup) {
            Write-Act "đã có $backup - xoá tay nếu chắc chắn không cần" 'WARN'
        }
        else {
            Rename-Item -LiteralPath $oldPio -NewName '.platformio.old'
            Write-Act "đổi tên $oldPio -> $backup ; PlatformIO sẽ dựng lại trên D:" 'OK'
            Write-Act "  mở lại VS Code, đợi PlatformIO tải lại, chạy thử 1 project, rồi xoá $backup" 'WARN'
        }
    }
    else {
        Write-Act "sẽ đổi tên $oldPio -> $oldPio.old (KHÔNG copy: penv chứa đường dẫn tuyệt đối)" 'DRY'
    }
}

# ----------------------------------------------------------------------------
# 6. Kết quả
# ----------------------------------------------------------------------------

Write-Step 'Dung lượng SAU khi chạy'
$after = Get-FreeSpaceTable

$rows = foreach ($b in $before) {
    $a = $after | Where-Object { $_.Drive -eq $b.Drive }
    [pscustomobject]@{
        'Ổ'           = $b.Drive
        'Trống trước' = '{0:N2} GB' -f $b.FreeGB
        'Trống sau'   = '{0:N2} GB' -f $a.FreeGB
        'Chênh lệch'  = '{0:+0.00;-0.00;0.00} GB' -f ($a.FreeGB - $b.FreeGB)
    }
}
$rows | Format-Table -AutoSize | Out-String | Write-Host

Write-Host ''
Write-Host 'XONG.' -ForegroundColor Green
if ($Apply) {
    Write-Host 'PHẢI MỞ CỬA SỔ POWERSHELL MỚI thì biến môi trường mới có hiệu lực.' -ForegroundColor Yellow
    Write-Host 'Kiểm chứng bằng:' -ForegroundColor Yellow
    Write-Host '    uv cache dir; uv tool dir; uv python dir; pnpm store path; npm config get cache' -ForegroundColor Yellow
}
else {
    Write-Host 'Đây mới chỉ là chạy thử. Thêm -Apply (và -MoveExisting nếu muốn chuyển dữ liệu cũ).' -ForegroundColor Magenta
}
```

### Kết quả chạy thử trên máy này

```
== 2. Đặt biến môi trường ở phạm vi User
  [DRY ] sẽ đặt UV_CACHE_DIR = D:\IOT_Tools\cache\uv  (cũ: '')
  [DRY ] sẽ đặt UV_TOOL_DIR = D:\IOT_Tools\tools\uv-tools  (cũ: '')
  [DRY ] sẽ đặt UV_PYTHON_INSTALL_DIR = D:\IOT_Tools\tools\uv-python  (cũ: '')
  [DRY ] sẽ đặt PIP_CACHE_DIR = D:\IOT_Tools\cache\pip  (cũ: '')
  [DRY ] sẽ đặt NPM_CONFIG_CACHE = D:\IOT_Tools\cache\npm  (cũ: '')
  [DRY ] sẽ đặt PLATFORMIO_CORE_DIR = D:\IOT_Tools\tools\platformio  (cũ: '')
  [SKIP] UV_TOOL_BIN_DIR giữ mặc định (C:\Users\Nghaiz\.local\bin) - đã nằm trong PATH

== 4. Chuyển cache đang nằm trên ổ C:
  [WARN] Đang có tiến trình chạy: Code, node, python, uv -- đóng hết trước khi chuyển
  [WARN] uv cache - có 3789.07 MB ở C:\Users\Nghaiz\AppData\Local\uv\cache
  [WARN] npm cache - có 2692.19 MB ở C:\Users\Nghaiz\AppData\Local\npm-cache
  [WARN] store pnpm cũ trên C: còn 632.92 MB
```

Phát hiện tiến trình đang chạy hoạt động đúng — nó nhìn thấy VS Code, node, python, uv và
cảnh báo trước khi cho chuyển.

---

## 9. Rủi ro

| # | Rủi ro | Khả năng | Ảnh hưởng | Điểm | Xử lý |
|---|---|---|---|---|---|
| 1 | **`setx PATH` cắt cụt PATH ở 1024 ký tự** — PATH máy này 1552 ký tự, mất 528 ký tự cuối, hỏng ~8 công cụ | 5 nếu dùng setx | 5 | **25** | Script dùng `[Environment]::SetEnvironmentVariable`. Sao lưu trước: `[Environment]::GetEnvironmentVariable('PATH','User') > D:\path-backup.txt` |
| 2 | Chuyển cache trong lúc tiến trình đang giữ file → robocopy bỏ sót, cache lẫn lộn hai nơi | 4 | 3 | 12 | Script cảnh báo khi thấy Code/node/python/uv đang chạy. Đóng hết rồi mới `-MoveExisting` |
| 3 | **Copy `~/.platformio` sang D: → `bad interpreter`** | 5 nếu copy | 4 | **20** | Đổi tên, không copy. Xem §5.5 |
| 4 | Đặt biến rồi quên mở cửa sổ mới, tưởng biến không ăn | 5 | 1 | 5 | Script in nhắc ở cuối; nó cũng `Set-Item Env:` cho phiên hiện tại |
| 5 | uv phải tải lại 3,7 GB nếu cache không chuyển được | 3 | 2 | 6 | Thử chuyển trước; hỏng thì `uv cache clean` |
| 6 | STM32CubeProgrammer không cho đổi đường dẫn | 2 | 2 | 4 | Chấp nhận ~250 MB trên C:, dùng một lần ở Phase 14 |
| 7 | pnpm copy thay vì hardlink nếu có project trên C: | 2 | 2 | 4 | Giữ mọi project trên D: |
| 8 | WSL tạo `swap.vhdx` trên C: giữa lúc build ArduPilot | 3 | 3 | 9 | Tạo `.wslconfig` với `swapFile=D:\\WSL\\swap.vhdx` (§7) |
| 9 | Extension VS Code không đọc `PLATFORMIO_CORE_DIR` | 2 | 3 | 6 | Kiểm bằng `pio system info`; nếu sai thì mở VS Code bằng `code .` từ shell đã có biến |
| 10 | `compact vdisk` làm hỏng vhdx (quy trình chưa được tài liệu WSL bảo chứng) | 2 | 5 | **10** | Sao lưu `ext4.vhdx` trước. Ưu tiên `wsl --update` + `--set-sparse`. Hiện chưa cần nén |

### Trả lời trực tiếp bốn câu hỏi trong mục 9 của đề bài

**"Biến ở phạm vi User cần mở shell mới"** — đúng, và đây là nguồn nhầm lẫn số một. Windows
nạp biến môi trường lúc tiến trình khởi động. Cửa sổ PowerShell đang mở, VS Code đang chạy,
Explorer — tất cả vẫn giữ giá trị cũ. Script có `Set-Item Env:` để phiên chạy script nhìn
thấy ngay, nhưng **mọi tiến trình khác phải khởi động lại**. Với VS Code phải **thoát hẳn**,
không chỉ đóng cửa sổ.

**"Một số installer hardcode `C:\Program Files`"** — trong ba installer đã khảo sát thì:
Mission Planner **không** hardcode (mọi đường dẫn dùng `[INSTALLDIR]` động); MAVProxy
**không** hardcode chỗ cài, nhưng *có* xoá `{pf}\MAVProxy` (dọn bản cũ, vô hại và còn có
lợi); STM32CubeProgrammer chưa xác minh được. Trường hợp gặp installer thật sự cứng đầu:
chấp nhận cài vào C: rồi dùng **directory junction** để chuyển phần nặng:
`New-Item -ItemType Junction -Path "C:\...\App" -Target "D:\IOT_Tools\apps\App"`. Đây là
phương án cuối, vì một số installer kiểm tra và từ chối junction.

**"Chuyển cache khi có tiến trình đang giữ"** — Windows khoá file đang mở, robocopy sẽ bỏ
qua file đó và trả mã lỗi ≥ 8. Hậu quả: cache bị chia đôi, một phần ở C: một phần ở D: —
không mất dữ liệu nhưng lộn xộn. Script kiểm tra tiến trình trước và cảnh báo. Nếu lỡ dính,
cách sửa sạch là xoá cả hai bên rồi để tải lại (`uv cache clean`, `npm cache verify`).

**"uv có tải lại sau khi đổi `UV_CACHE_DIR` không?"** — **Có, nếu bạn không chuyển thư mục.**
uv chỉ nhìn vào đường dẫn mới; thư mục cũ trên C: thành mồ côi (vẫn chiếm 3,7 GB cho tới khi
xoá tay). Gói đã cài vào venv **không hề hấn gì** — chúng đã nằm trong venv rồi, cache chỉ
là kho tải về. Nên chi phí tệ nhất là **tải lại**, không phải hỏng môi trường. Chuyển được
thư mục thì không phải tải lại gì cả.

---

## Thứ tự nên làm

1. Sao lưu PATH: `[Environment]::GetEnvironmentVariable('PATH','User') > D:\path-backup.txt`
2. `pwsh -File scripts/setup-d-drive.ps1` — xem thử.
3. Đóng VS Code và mọi terminal.
4. `pwsh -File scripts/setup-d-drive.ps1 -Apply -MoveExisting`
5. Mở PowerShell **mới**, kiểm chứng:
   `uv cache dir; uv tool dir; uv python dir; npm config get cache; pnpm store path`
6. `pnpm store prune`, rồi xoá `C:\Users\Nghaiz\AppData\Local\pnpm\store` nếu còn.
7. Mở lại VS Code, `pio system info` — `Core Directory` phải trỏ D:.
8. Tạo `%USERPROFILE%\.wslconfig` với `swapFile=D:\\WSL\\swap.vhdx`, rồi `wsl --shutdown`.
9. Cài Mission Planner / MAVProxy bằng lệnh có đường dẫn D: ở §1 và §2.

## Việc cần sửa trong `plans/phase-00-cai-cong-cu-pc.md`

- **00.2** — thêm lệnh `msiexec` có `INSTALLDIR=`, thay cho "bấm Next tới hết".
- **00.3** — thêm `/DIR=`; ghi rõ cần chạy admin và installer tự thêm vào PATH.
- **00.4** — ghi rõ chỉ đổi được đường dẫn qua giao diện.
- **00.5** — đặt `PLATFORMIO_CORE_DIR` **trước** khi mở VS Code lần đầu sau khi cài extension.
- **00.6** — thay `py -3.13 -m pip install` bằng `uv tool install esptool` + `uv venv` cho pymavlink.
- **00.7** — sửa hai chi tiết sai: Ubuntu **đã dùng 37 GB** (không trống), thiết bị là
  `/dev/sdf` chứ không phải `/dev/sdd`. Thêm bước tạo `.wslconfig`.
- **Thêm bước 00.0** — chạy `scripts/setup-d-drive.ps1` *trước mọi thứ khác*.
- **Bảng rủi ro** — thêm dòng `setx` cắt cụt PATH.

## Nguồn

| Nguồn | Trạng thái |
|---|---|
| `raw.githubusercontent.com/ArduPilot/MissionPlanner/master/wix/Program.cs` | 200, tự tải + grep |
| `raw.githubusercontent.com/ArduPilot/MissionPlanner/master/Msi/installer.bat` | 200, tự tải |
| `raw.githubusercontent.com/ArduPilot/MAVProxy/master/windows/mavproxy.iss` | 200, tự tải |
| `firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.msi` | 200, 119 841 133 B |
| `firmware.ardupilot.org/Tools/MAVProxy/MAVProxySetup-latest.exe` | 200, 236 926 085 B |
| `jrsoftware.org/ishelp` → `topic_setupcmdline.htm` (`/DIR=`) | 200 |
| `learn.microsoft.com/.../windows-commands/msiexec` | 200 |
| `docs.astral.sh/uv/reference/environment/` | 200 |
| `docs.astral.sh/uv/concepts/cache/` · `/tools/` · `/python-versions/` | 200 |
| `pip.pypa.io/en/stable/topics/caching/` · `/configuration/` | 200 |
| `pnpm.io/faq` · `/cli/store` · `/cli/setup` | 200 |
| `docs.npmjs.com/cli/v11/using-npm/config` · `/commands/npm-cache` | 200 |
| `docs.platformio.org/en/latest/envvars.html` · `.../core_dir.html` · `.../vscode.html` | 200 |
| `github.com/platformio/platformio-core/issues/3554` | đọc qua `gh` |
| `learn.microsoft.com/en-us/windows/wsl/wsl-config` | 200 |
| `learn.microsoft.com/en-us/windows/wsl/disk-space` | 200 — **không** có `compact vdisk` |
| `dev.st.com/stm32cube-docs/prog/2.23.0/.../CubeProg_Installation.html` | 200 |
| `www.st.com/en/development-tools/stm32cubeprog.html` | **timeout (exit 28)** — chưa xác minh |

### Ba mục "chưa xác minh"

| Mục | Vì sao | Dự phòng |
|---|---|---|
| STM32CubeProgrammer: trang chọn thư mục, tên khoá XML, dung lượng | `st.com` chặn truy cập tự động | Cài giao diện; nếu không có trang chọn thư mục thì chấp nhận ~250 MB trên C: |
| Extension VS Code có đọc `PLATFORMIO_CORE_DIR` | Không có câu khẳng định trong tài liệu hay issue | Kiểm bằng `pio system info`; nếu sai, mở VS Code bằng `code .` từ shell đã có biến |
| Quy trình `compact vdisk` cho WSL | Trang `wsl/disk-space` của MS **không** mô tả nén, chỉ mô tả mở rộng | Sao lưu vhdx trước; ưu tiên `wsl --update` rồi `wsl --manage --set-sparse`; hiện chưa cần nén |

---

# BỔ SUNG 21/09/2026 — tách D:\DevCache khỏi D:\IOT_Tools

## Vì sao tách

Thư mục `D:\IOT_Tools` duy nhất nêu ở toàn bộ báo cáo trên đã bị tách làm hai, vì nó gây
hiểu lầm: nó vừa chứa cache/tool **dùng chung cho TOÀN MÁY** (`uv`, `pip`, `npm`, `pnpm`,
`uv tool`, `uv python`, PlatformIO core) — thứ mọi dự án trên máy đọc/ghi vào — vừa chứa
app **chỉ riêng dự án drone** (Mission Planner, MAVProxy, STM32CubeProgrammer), trong khi
cái tên `IOT_Tools` lại ngụ ý toàn bộ thư mục chỉ thuộc về dự án này. Hậu quả thực tế: nếu
dự án drone kết thúc và ai đó xoá `D:\IOT_Tools` theo đúng nghĩa cái tên, sẽ xoá luôn cache
mà các dự án khác trên máy đang dùng.

Tách thành hai gốc:

- **`D:\DevCache`** — dùng chung TOÀN MÁY, mọi dự án. Không bao giờ được xoá theo vòng đời
  của riêng dự án drone.
- **`D:\IOT_Tools`** — chỉ còn app có installer riêng của dự án drone. Xoá trọn thư mục này
  khi dự án kết thúc không ảnh hưởng dự án nào khác.

## Cây thư mục mới, đã đo trên máy

```
D:\DevCache\                      dùng chung TOÀN MÁY, mọi dự án
  cache\uv            3.895 MB
  cache\npm           2.692 MB
  cache\pip               5 MB
  cache\pnpm-store        0 MB
  tools\uv-tools         26 MB   (esptool)
  tools\uv-python         0 MB
  tools\platformio        0 MB
D:\IOT_Tools\                     chỉ của dự án drone
  apps\ArduinoIDE       527 MB
```

Sáu biến môi trường phạm vi User (`UV_CACHE_DIR`, `PIP_CACHE_DIR`, `NPM_CONFIG_CACHE`,
`UV_TOOL_DIR`, `UV_PYTHON_INSTALL_DIR`, `PLATFORMIO_CORE_DIR`) nay trỏ vào `D:\DevCache\...`.
`scripts/setup-d-drive.ps1` đã cập nhật theo cấu trúc này — tham số `-Root` cũ đổi thành hai
tham số `-CacheRoot` (mặc định `D:\DevCache`) và `-AppRoot` (mặc định `D:\IOT_Tools`).

## Bốn điều học được cách khó (phải ghi lại)

1. **`winget` bỏ qua `--location` cho Arduino IDE.**
   `winget install ArduinoSA.IDE.stable --location "D:\..."` vẫn cài vào
   `%LOCALAPPDATA%\Programs\arduino-ide` (544 MB, 6379 file) bất kể có truyền `--location`
   hay không. Cách sửa đã dùng: `Move-Item` thư mục đó sang `D:\IOT_Tools\apps\ArduinoIDE`,
   rồi `New-Item -ItemType Junction` tại đúng chỗ cũ để Arduino IDE và bộ cập nhật của nó
   vẫn tự tìm thấy mình. Junction không cần quyền admin. Đây là công thức dự phòng dùng
   chung cho bất kỳ installer nào phớt lờ đường dẫn tuỳ chỉnh.

2. **Dời thư mục `uv tool` làm hỏng shim của nó.** Sau khi dời, `esptool.exe` báo lỗi
   `uv trampoline failed to canonicalize script path` vì shim trong `~/.local/bin` nướng
   cứng đường dẫn tuyệt đối. Cách sửa: `uv tool install <tên> --reinstall` sau khi dời.

3. **`cua-driver` bị mồ côi, vẫn còn ở C:.** Nó được cài từ trước khi `UV_TOOL_DIR` từng
   được đặt, nên nằm ở `C:\Users\Nghaiz\AppData\Roaming\uv\tools\cua-driver` (76 MB) và
   `uv tool list` không còn thấy nó nữa. Nó vẫn chạy được. Cách sửa chỉ là một lệnh, nhưng
   CHỈ chạy khi MCP server đó KHÔNG đang chạy: `uv tool install cua-driver --reinstall`.
   Đây là bước rõ ràng người dùng tự chạy sau khi khởi động lại phiên làm việc.

4. **Vẫn còn sót trên C:, cần thoát hẳn VS Code mới dọn được:** 633 MB pnpm store cũ
   (`pnpm store prune`), 80 MB `~/.platformio` (đổi tên, không bao giờ copy), và phần cache
   `uv` còn sót (34 file đang bị khoá).
