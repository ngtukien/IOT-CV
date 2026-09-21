# Phase 02: WSL2 + build ArduPilot + chạy drone ảo (SITL)

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 00 | ~5 giờ | Không |

## Mục tiêu

Dựng một con **drone ảo** chạy đúng phần mềm bay sẽ nạp lên board thật (ArduCopter 4.7.1), rồi nối Mission Planner trên Windows vào nó. Sau phase này bạn gõ được một lệnh duy nhất để có drone ảo cất cánh, và đó là môi trường thử nghiệm cho Phase 03, 04, và toàn bộ backend + web (Phase 05–10) trước khi có phần cứng.

Đây là **phase tốn thời gian máy nhiều nhất trong cả dự án phần mềm**: khoảng 40–85 phút chỉ để tải và biên dịch. Bắt đầu sớm, làm việc khác trong lúc chờ.

## Đầu vào cần có

Phải xong trước: **Phase 00** — đặc biệt là `wsl -d Ubuntu` vào được và `df -h /` trong WSL còn > 15 GB. Mission Planner đã cài.

Phải đọc trước:

- `plans/reports/260921-research-sitl-firmware-toolchain.md` §1 toàn bộ — đây là nguồn của mọi lệnh trong phase này, gồm cả bảng ước lượng dung lượng/thời gian ở §1.5 và phương án dự phòng ở §1.6.

Ước lượng tài nguyên (§1.5 — **là ước tính suy ra từ kích thước artifact đã đo, chưa đo thực tế trên máy này, sai số có thể ±50%**):

| Hạng mục | Đĩa | Thời gian |
|---|---|---|
| Clone repo kèm submodule | ~2,5–3,5 GB | 10–20 phút |
| `install-prereqs-ubuntu.sh` (toolchain ARM ~1,5 GB là khoản lớn nhất) | ~2,5–3,5 GB | 20–40 phút |
| Build SITL lần đầu | ~1–1,5 GB | 10–25 phút |
| **Tổng** | **~6–8 GB** | **~40–85 phút** |

Ổ WSL trên máy này nằm ở `/dev/sdd` còn ~920 GB nên dung lượng không phải vấn đề; vẫn chừa dư ~15 GB.

## File và thư mục sở hữu

Trong repo — **rất ít**, vì ArduPilot được clone vào `~/ardupilot` **bên trong WSL**, không phải vào repo:

- `scripts/run_sitl.sh` — sửa cho khớp cách chạy thật.
- `Makefile` — **chỉ mục `sitl:`**, không đụng mục nào khác.
- `plans/PROGRESS.md` — tick checkbox mục Phase 02.
- `docs/so-tay/02-wsl2-sitl.md` — để agent viết sổ tay điền sau.

Ngoài repo (trên máy, không vào git):

- `C:\Users\Nghaiz\.wslconfig`
- `~/ardupilot/` trong WSL (~6–8 GB). `.gitignore` đã có dòng `/ardupilot/` để phòng trường hợp bạn lỡ clone vào trong repo — **đừng làm thế**, clone vào `~` trong WSL.

> ⚠️ Phase 01 và Phase 02 đều chỉ phụ thuộc Phase 00 nên chạy song song được. Ranh giới: Phase 01 sở hữu `Makefile` trừ mục `sitl:`; Phase 02 chỉ chạm mục `sitl:` và `scripts/run_sitl.sh`. Nếu bạn làm tuần tự thì không cần bận tâm.

## Việc theo thứ tự

### 02.1 Bật mirrored networking cho WSL2

Mặc định WSL2 dùng NAT: nó có địa chỉ IP riêng, khác với Windows, và địa chỉ đó đổi mỗi lần khởi động lại. Điều đó làm việc nối Mission Planner (chạy trên Windows) vào SITL (chạy trong WSL) rắc rối hơn cần thiết.

**Mirrored networking** làm WSL dùng chung `localhost` với Windows — sau đó Mission Planner chỉ cần nghe cổng `14550` trên máy mình, không cần biết IP nào cả.

Tạo hoặc sửa file `C:\Users\Nghaiz\.wslconfig` **trên Windows** (không phải trong WSL). Mở bằng Notepad hoặc VS Code, nội dung:

```ini
[wsl2]
networkingMode=mirrored
```

Rồi ở **PowerShell (Windows)**:

```powershell
wsl --shutdown
wsl --update
wsl -d Ubuntu -- bash -lc "ip addr show | head -20"
```

Kết quả mong đợi: sau khi bật mirrored, danh sách địa chỉ trong WSL trông giống của Windows (thấy cả IP LAN thật của máy, ví dụ `192.168.x.x`), chứ không phải một mạng `172.x` riêng biệt.

⚠️ **Ghi nhớ hệ quả này, nó chi phối mọi lệnh sau:** khi mirrored đang bật, `sim_vehicle.py` **bắt buộc** phải thêm cờ `--no-wsl2-network`. Nếu bạn không bật mirrored thì **bỏ cờ đó đi** — `sim_vehicle.py` tự phát hiện WSL2 và tự thêm output về IP Windows. Chọn một đường rồi nhất quán; lẫn lộn hai đường là nguyên nhân phổ biến nhất của "Mission Planner không thấy gì".

Nếu lỗi:

1. **`.wslconfig` không có tác dụng** → sai chỗ hoặc sai tên. Phải đúng `C:\Users\Nghaiz\.wslconfig` (không phải `.wslconfig.txt` — Notepad hay thêm đuôi). Kiểm bằng `Get-ChildItem $env:USERPROFILE\.wslconfig`.
2. **`wsl --update` báo lỗi mạng** → mở PowerShell as administrator rồi chạy lại.
3. **Mirrored làm mất mạng trong WSL** → gỡ dòng `networkingMode=mirrored`, `wsl --shutdown`, quay về NAT và bỏ cờ `--no-wsl2-network` ở mọi lệnh sau. Cả hai đường đều dùng được.

### 02.2 Clone ArduPilot và cài môi trường build

Chạy ở **bash trong WSL** (vào bằng `wsl -d Ubuntu` từ PowerShell):

```bash
cd ~
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot
cd ardupilot
```

`--recurse-submodules` quan trọng: ArduPilot dùng hàng chục repo con (thư viện MAVLink, ChibiOS…). Thiếu cờ này thì build sẽ chết với lỗi kiểu "file not found" rất khó hiểu.

Cài các gói cần để biên dịch:

```bash
Tools/environment_install/install-prereqs-ubuntu.sh -y
. ~/.profile
```

Script này cài toolchain ARM (~1,5 GB), thư viện Python, và một loạt công cụ. Nó chạy 20–40 phút. Tài liệu ghi rõ script **không** hỗ trợ các bản Ubuntu đã hết Standard Support (ví dụ 20.04); Ubuntu 24.04 nằm trong diện được hỗ trợ.

Dòng `. ~/.profile` (có dấu chấm và khoảng trắng ở đầu) nạp lại biến môi trường trong phiên hiện tại — thiếu nó thì `sim_vehicle.py` sẽ báo `command not found` dù đã cài xong.

Kết quả mong đợi:

- Script kết thúc với dòng đại ý "you should log out and log in again" hoặc không có dòng `ERROR`.
- `which sim_vehicle.py` in ra một đường dẫn (sau khi đã `. ~/.profile`).
- `du -sh ~/ardupilot` in khoảng 3–4 GB.

Nếu lỗi:

1. **Clone đứt giữa chừng** → `cd ~/ardupilot && git submodule update --init --recursive` để lấy nốt phần thiếu, không cần clone lại từ đầu.
2. **`install-prereqs-ubuntu.sh` fail ở một gói apt** → `sudo apt-get update` rồi chạy lại script; nó chạy lại được nhiều lần, không hỏng gì.
3. **`sim_vehicle.py: command not found` sau khi cài xong** → chưa `. ~/.profile`, hoặc đang ở phiên bash khác. Thoát WSL rồi vào lại cũng được.
4. **Hết dung lượng giữa chừng** → `df -h /` để xác nhận; nếu ổ WSL trên ổ C thì phải chuyển ổ (xem Phase 00 việc 00.7) rồi làm lại.

### 02.3 Chốt đúng nhánh Copter-4.7.1

Bản firmware sẽ nạp lên board thật là ArduCopter 4.7.1. Để drone ảo hành xử giống drone thật nhất có thể, checkout đúng nhánh đó.

```bash
cd ~/ardupilot
git checkout Copter-4.7.1
git submodule update --init --recursive
git log -1 --oneline
```

Kết quả mong đợi: `git log -1 --oneline` in một commit, và `git status` báo `HEAD detached at Copter-4.7.1` (điều này bình thường khi checkout một tag).

Nếu lỗi:

1. **`pathspec 'Copter-4.7.1' did not match`** → `git fetch --all --tags` rồi thử lại; hoặc xem danh sách bằng `git tag | grep Copter-4.7`.
2. **Sau checkout, build báo lỗi lạ** → submodule chưa theo kịp nhánh mới. Chạy lại `git submodule update --init --recursive`.

### 02.4 Cài MAVProxy trong WSL

`sim_vehicle.py` dùng MAVProxy làm giao diện dòng lệnh của nó. Đây là bản **trong WSL**, khác với bản Windows đã cài ở Phase 00 — hai bản song song là bình thường.

> ⚠️ **Việc này gần như đã xong ở 02.2, đừng chạy lại khối `pip` cũ.** Kiểm chứng 21/09/2026 trên chính `install-prereqs-ubuntu.sh` bản 4.7.1: `PYTHON_PKGS` dòng 197 đã gồm `MAVProxy` và `pymavlink`; `SITL_PKGS` đã gồm `python3-wxgtk4.0`, `python3-matplotlib`, `python3-opencv`, `python3-yaml` và bộ SDL cho pygame. Trên Ubuntu 24.04 script còn tạo venv ở `~/venv-ardupilot` và cài MAVProxy **vào đó**. Chạy thêm `python3 -m pip install mavproxy --user` sẽ đặt **bản thứ hai ngoài venv**, rồi hai bản tranh nhau PATH — hại chứ không lợi.

Chỉ cần **đo**, ở **bash trong WSL**:

```bash
mavproxy.py --version
```

Kết quả mong đợi: in ra số phiên bản (đo được 21/09/2026: `1.8.74`).

`python3-wxgtk4.0` và `python3-matplotlib` là thứ vẽ ra cửa sổ `--map` và `--console`; thiếu chúng thì SITL vẫn chạy nhưng không có bản đồ để nhìn. Kiểm bằng `import`, đừng kiểm bằng `dpkg` — `dpkg` báo đã cài không có nghĩa là Python **đang dùng** nhìn thấy nó:

```bash
~/venv-ardupilot/bin/python -c "import wx, matplotlib, pexpect; print('du goi')"
```

Nếu dòng đó báo `No module named 'pexpect'` thì đọc lỗi #4 bên dưới **trước khi** build, vì `./waf copter` sẽ chết vì đúng lý do đó.

Kết quả mong đợi: `mavproxy.py --version` in ra số phiên bản.

Nếu lỗi:

1. **`pip install` báo `externally-managed-environment`** → chỉ xảy ra nếu bạn cài vào Python hệ thống. Cài vào venv thì không gặp: `~/venv-ardupilot/bin/pip install <gói>`.
2. **`python3-wxgtk4.0` không tìm thấy** → `sudo apt-get update` trước; nếu vẫn thiếu thì tên gói đã đổi, tìm bằng `apt-cache search wxgtk`.
3. **`mavproxy.py` không nhận diện** → chưa `. ~/.profile`, hoặc đang ở phiên bash cũ. Script đã nối `source ~/venv-ardupilot/bin/activate` vào `~/.profile`; thoát WSL rồi vào lại cũng được.
4. **`./waf copter` chết với `you need to install pexpect`, dù `dpkg` báo `python3-pexpect` đã cài.** Đã gặp 21/09/2026. Nguyên nhân: `install-prereqs` tạo venv bằng `python3` **đứng đầu PATH**; nếu máy bạn có conda/miniforge thì đó là Python 3.13 của miniforge, không phải Python 3.12 của Ubuntu — mà gói apt `python3-pexpect` nằm trong `dist-packages` của 3.12 nên venv không thấy. Sửa: `~/venv-ardupilot/bin/pip install pexpect`. Kiểm bản Python của venv bằng `~/venv-ardupilot/bin/python -V` và `readlink -f ~/venv-ardupilot/bin/python`. **Đừng suy rộng** — lần đo đó `wx`, `matplotlib`, `numpy`, `cv2`, `lxml` vẫn import được, chỉ thiếu đúng `pexpect`.
5. **`sudo` hỏi lại mật khẩu giữa chừng rồi đứng im.** Timestamp mặc định 15 phút, mà `install-prereqs` chạy 12–40 phút. Chạy `sudo -v` trước, rồi `while true; do sudo -n true; sleep 60; done &` để giữ phiên, `kill` nó sau khi xong.

### 02.5 Chạy SITL lần đầu

Chạy ở **bash trong WSL**:

```bash
cd ~/ardupilot/ArduCopter
../Tools/autotest/sim_vehicle.py --map --console --no-wsl2-network
```

Nhắc lại: bỏ `--no-wsl2-network` nếu bạn **không** bật mirrored ở 02.1.

**Lần chạy đầu nó sẽ tự biên dịch** — mất 10–25 phút, màn hình cuộn đầy dòng compile. Đó là bình thường, đừng tắt.

Xong, bạn sẽ có **ba cửa sổ**:

1. Cửa sổ terminal với dấu nhắc `STABILIZE>` — đây là MAVProxy, chỗ **gõ lệnh**.
2. Cửa sổ `Console` — bảng số liệu, chỉ để nhìn.
3. Cửa sổ `Map` — bản đồ có một icon máy bay.

Gõ vào cửa sổ **thứ nhất**:

```
mode guided
arm throttle
takeoff 40
mode rtl
```

Kết quả mong đợi: console in `ARMED`, icon trên Map bay lên (số `Alt` trong Console tăng dần tới ~40), `mode rtl` đưa nó về điểm xuất phát rồi tự chuyển `LAND` và `DISARMED`.

Nếu muốn build tay (không qua `sim_vehicle.py`):

```bash
cd ~/ardupilot
./waf configure --board=sitl
./waf copter
```

Nếu lỗi:

1. **Không hiện cửa sổ Map/Console** → thiếu `python3-wxgtk4.0`/`matplotlib` (xem 02.4), hoặc WSLg chưa hoạt động. Chạy `wsl --update` từ PowerShell rồi `wsl --shutdown`.
2. **`arm throttle` bị từ chối `PreArm: ...`** → đọc đúng dòng lỗi; phổ biến nhất là EKF chưa hội tụ — đợi thêm 30 giây rồi thử lại. Đây là chuyện bình thường, Phase 03 sẽ học kỹ phần này.
3. **Build chết vì hết RAM** → thêm `-j2` vào `sim_vehicle.py`, hoặc giới hạn tài nguyên trong `.wslconfig` (`memory=16GB`, `processors=8`) rồi `wsl --shutdown`.
4. **Build fail và bạn cần một SITL chạy ngay** → phương án dự phòng: tải binary dựng sẵn (vẫn cần WSL):
   ```bash
   mkdir -p ~/sitl && cd ~/sitl
   wget https://firmware.ardupilot.org/Copter/stable-4.7.1/SITL_x86_64_linux_gnu/arducopter
   chmod +x arducopter
   ```
   Lưu ý: bản này **không kèm** `sim_vehicle.py`, không kèm map/console, không kèm file `.parm` mặc định — bạn phải tự truyền `-M`, `--defaults`. Dùng để không bị kẹt, không dùng lâu dài.

### 02.6 Nối Mission Planner (Windows) vào SITL (WSL)

Trong cửa sổ MAVProxy, gõ:

```
output
```

Nó liệt kê các cổng UDP đang phát ra cho GCS ngoài — thường là `14550` và `14551`.

**Trường hợp A — có mirrored networking** (đường đã chọn ở 02.1):

1. Mở Mission Planner.
2. Góc trên bên phải, ô chọn kiểu kết nối → chọn `UDP`.
3. Bấm `CONNECT`.
4. Nó hỏi cổng → gõ `14550` → OK.

Không cần biết IP nào cả, đó là toàn bộ lý do bật mirrored.

**Trường hợp B — không mirrored (NAT)**: lấy IP Windows nhìn từ WSL rồi phát thẳng tới đó.

```bash
ip route show | grep -i default | awk '{ print $3}'
```

rồi chạy lại SITL với:

```bash
../Tools/autotest/sim_vehicle.py --map --console --out udp:<IP_WINDOWS>:14550
```

Mission Planner: `UDP`, cổng `14550`.

**Trường hợp C — firewall chặn UDP, cần đường chắc ăn hơn**: Mission Planner chọn `TCP`, host là IP của WSL, port `5760` (cổng TCP gốc của SITL).

⚠️ **Gõ `127.0.0.1`, KHÔNG gõ `localhost`.** Kiểm chứng 21/09/2026 khi đang bật mirrored: `127.0.0.1:5760` nối được, `localhost:5760` **không**. Lý do: trên Windows `localhost` phân giải ra `::1` (IPv6) trước, mà SITL chỉ bind IPv4. Triệu chứng khi gõ nhầm giống hệt bị firewall chặn, nên bạn sẽ đi debug nhầm chỗ.

⚠️ **Cảnh báo firewall.** Lần đầu Mission Planner mở cổng UDP, Windows Defender hiện hộp thoại hỏi. **Phải bấm Allow cho cả Private lẫn Public.** Nếu lỡ bấm Cancel, gói tin bị nuốt **im lặng** — không có thông báo lỗi nào — và bạn sẽ ngồi debug nhầm chỗ hàng giờ. Sửa bằng: `Windows Security` → `Firewall & network protection` → `Allow an app through firewall` → tìm `Mission Planner`, tick cả hai cột.

Kết quả mong đợi: Mission Planner hiện HUD sống (đường chân trời nhúc nhích), bản đồ có icon máy bay, thanh trạng thái ghi `ArduCopter V4.7.1`. Gõ `takeoff 20` trong MAVProxy thì thấy số Alt trên Mission Planner tăng — chứng minh cả hai đang nhìn cùng một con drone.

Nếu lỗi:

1. **Mission Planner báo `No heartbeat packets received`** → firewall (xem cảnh báo trên), hoặc quên `--no-wsl2-network` khi đang bật mirrored, hoặc thêm nó khi không bật mirrored. Thử đường TCP `5760` để loại trừ firewall.
2. **Nối được nhưng HUD đứng hình** → mất gói UDP; chuyển sang TCP.
3. **Nối được rồi mất ngay sau vài giây** → có hai GCS cùng nghe một cổng (ví dụ bạn mở hai Mission Planner). Đóng bớt.

### 02.7 Gói lại thành một lệnh: `scripts/run_sitl.sh`

Bạn sẽ chạy SITL hàng trăm lần trong các phase tới. Đừng gõ lại đường dẫn dài mỗi lần.

Sửa `scripts/run_sitl.sh` (file đã có sẵn trong repo) thành đại ý:

```bash
#!/usr/bin/env bash
# Chay ArduCopter SITL. CHAY TRONG WSL, khong phai PowerShell.
#   ARDUPILOT_DIR : cho clone ArduPilot (mac dinh ~/ardupilot)
#   WSL_MIRRORED  : 1 neu .wslconfig dat networkingMode=mirrored (mac dinh 1)
#   SITL_EXTRA    : co them, vd "-A --serial5=sim:ld06" cho Phase 04
set -euo pipefail

ARDUPILOT_DIR="${ARDUPILOT_DIR:-$HOME/ardupilot}"
WSL_MIRRORED="${WSL_MIRRORED:-1}"
SITL_EXTRA="${SITL_EXTRA:-}"

NET_FLAG=""
if [ "$WSL_MIRRORED" = "1" ]; then
  NET_FLAG="--no-wsl2-network"
fi

cd "$ARDUPILOT_DIR/ArduCopter"
exec ../Tools/autotest/sim_vehicle.py --map --console $NET_FLAG $SITL_EXTRA
```

Và sửa **chỉ mục `sitl:`** trong `Makefile` cho khớp (`ARDUPILOT_DIR ?= $(HOME)/ardupilot` thay vì `./ardupilot`). Đừng đụng mục nào khác — Phase 01 sở hữu phần còn lại của `Makefile`.

Chạy thử ở **bash trong WSL**:

```bash
cd /mnt/d/Coding/IOT-CV
chmod +x scripts/run_sitl.sh
./scripts/run_sitl.sh
```

(Trong WSL, ổ D của Windows nằm ở `/mnt/d/`.)

Kết quả mong đợi: SITL khởi động y hệt bước 02.5, nhưng chỉ bằng một lệnh.

Nếu lỗi:

1. **`Permission denied`** → thiếu `chmod +x`.
2. **`bad interpreter: ... ^M`** → file có ký tự xuống dòng kiểu Windows. Sửa bằng `sed -i 's/\r$//' scripts/run_sitl.sh`, và đặt `*.sh text eol=lf` trong `.gitattributes` để không tái diễn.
3. **Chạy được trong WSL nhưng lỗi khi gọi từ PowerShell** → đúng vậy, script này **chỉ chạy trong WSL**. Từ PowerShell phải gọi `wsl -d Ubuntu -- bash -lc "cd /mnt/d/Coding/IOT-CV && ./scripts/run_sitl.sh"`.

### 02.8 Ba lệnh MAVProxy cần thuộc ngay

Phase 03 sẽ học kỹ, nhưng ba lệnh này dùng từ giờ:

```
status          # in trang thai hien tai (mode, arm, vi tri, pin gia)
param show ARMING_CHECK    # xem gia tri mot param
output          # liet ke cac cong UDP dang phat cho GCS ngoai
```

Mẹo: MAVProxy có tab-completion. Gõ `param sh` rồi nhấn `Tab`.

Ghi vào `plans/PROGRESS.md` mục Phase 02: thời gian build thực tế trên máy bạn và dung lượng `du -sh ~/ardupilot` — hai con số đó thay thế phần ước lượng ở đầu file này bằng số đo thật.

## Cổng pass

- [ ] `C:\Users\Nghaiz\.wslconfig` tồn tại với `networkingMode=mirrored` (hoặc bạn ghi rõ trong PROGRESS là đã chọn đường NAT). Kiểm bằng giao tập IP, đừng nhìn bằng mắt: `ip -4 -o addr show` trong WSL phải in ra **IP LAN thật của Windows**; còn thấy `172.x` trên `eth0` là vẫn NAT.
- [ ] `git -C ~/ardupilot rev-parse HEAD` **khớp byte-for-byte** với `git -C ~/ardupilot rev-parse Copter-4.7.1^{commit}`, và `grep THISFIRMWARE ~/ardupilot/ArduCopter/version.h` in ra `ArduCopter V4.7.1`.
- [ ] **Hai** số đo đĩa, ghi riêng — đừng gộp: `du -sh ~/ardupilot` ra **~2–3,5 GB** (chỉ repo + `build/sitl`), và **delta `df --output=used /`** đo từ trước khi clone tới sau khi build ra **~5–8 GB** (gồm toolchain ở `/opt` và venv ở `~/venv-ardupilot`, cả hai **nằm ngoài** `~/ardupilot`). Bản cũ của cổng này đòi `du` ra 6–8 GB nên **đỏ kể cả khi cài hoàn toàn đúng** — đo 21/09/2026: `du` = 2,0 GB, tổng thật 5,2 GB.
- [ ] `mavproxy.py --version` trong WSL in ra số phiên bản.
- [ ] `./scripts/run_sitl.sh` khởi động SITL với đủ ba cửa sổ (MAVProxy, Console, Map).
- [ ] Chuỗi `mode guided` → `arm throttle` → `takeoff 40` → `mode rtl` chạy trọn: drone lên ~40 m rồi về và disarm. **Đừng grep chữ `DISARMED`** — ArduCopter 4.7.1 phát STATUSTEXT là `Arming motors` / `Disarming`. Bằng chứng chắc hơn: `relative_alt` lớn nhất trong `GLOBAL_POSITION_INT` chạm ~40 000 mm rồi về ~0, và HEARTBEAT cuối có `base_mode` **thiếu bit 128 (`SAFETY_ARMED`)** kèm `system_status: 3` (STANDBY).
- [ ] Mission Planner trên Windows nối được vào SITL: HUD sống, thanh trạng thái ghi `ArduCopter V4.7.1`, và khi gõ `takeoff 20` trong MAVProxy thì số Alt trên Mission Planner tăng theo.
- [ ] `scripts/run_sitl.sh` đã sửa và commit; mục `sitl:` trong `Makefile` trỏ đúng đường dẫn mới.
- [ ] `plans/PROGRESS.md` mục Phase 02 đã tick và ghi **thời gian build thực tế + dung lượng thực tế**.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Windows Defender chặn cổng UDP của Mission Planner, **không báo lỗi gì** → tưởng SITL hỏng | 4 | 3 | **12** | Bấm Allow cho cả Private lẫn Public ngay lần hỏi đầu; nếu lỡ Cancel, sửa trong `Allow an app through firewall`; thử TCP `5760` để loại trừ trước khi nghi ngờ SITL |
| Lẫn lộn mirrored / NAT → thừa hoặc thiếu cờ `--no-wsl2-network` | 4 | 3 | **12** | Chọn một đường ở 02.1 và ghi vào PROGRESS; `run_sitl.sh` có biến `WSL_MIRRORED` để không phải nhớ |
| Build thất bại giữa chừng (mạng đứt, hết RAM, submodule thiếu) sau 40 phút chờ | 3 | 4 | **12** | `git submodule update --init --recursive` lấy nốt phần thiếu thay vì clone lại; giảm luồng `-j2`; phương án dự phòng binary dựng sẵn ở 02.5 |
| Ổ WSL hết chỗ giữa chừng | 2 | 5 | **10** | Phase 00 đã kiểm `df -h /`; kiểm lại trước khi bắt đầu build |
| Clone ArduPilot nhầm vào trong repo dự án → `git status` ngập 2 GB file lạ | 2 | 4 | 8 | `.gitignore` đã có `/ardupilot/`; lệnh ở 02.2 bắt đầu bằng `cd ~` — làm đúng thứ tự thì không xảy ra |
| Thiếu `python3-wxgtk4.0` → SITL chạy nhưng không có Map, Phase 04 không quan sát được vật cản | 3 | 3 | 9 | Cài đủ khối apt ở 02.4; cổng pass yêu cầu thấy đủ **ba** cửa sổ |
| `scripts/run_sitl.sh` bị lưu với xuống dòng kiểu Windows → `bad interpreter` | 3 | 2 | 6 | `sed -i 's/\r$//'` và thêm `*.sh text eol=lf` vào `.gitattributes` |
| Phase 01 và 02 chạy song song cùng sửa `Makefile` | 3 | 2 | 6 | Ranh giới đã ghi ở "File và thư mục sở hữu": Phase 02 chỉ chạm mục `sitl:` |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 02.1 Mirrored networking | 0,25 | |
| 02.2 Clone + install-prereqs | 1,25 | Phần lớn là chờ máy; làm việc khác song song |
| 02.3 Checkout Copter-4.7.1 | 0,25 | |
| 02.4 MAVProxy trong WSL | 0,5 | |
| 02.5 Chạy SITL lần đầu | 1,0 | Gồm 10–25 phút build lần đầu |
| 02.6 Nối Mission Planner | 0,75 | Firewall hay ăn mất thời gian ở đây |
| 02.7 `run_sitl.sh` | 0,5 | |
| 02.8 Ba lệnh MAVProxy + ghi PROGRESS | 0,25 | |
| Dự phòng | 0,25 | |
| **Tổng** | **5,0** | Thời gian ngồi trước máy; thời gian máy chạy nền thêm ~40–85 phút |

## Ghi chú cho sổ tay

Những khái niệm `docs/so-tay/02-wsl2-sitl.md` cần giải thích cho người chưa biết gì:

- **SITL là gì** — "drone ảo": đúng phần mềm bay chạy trên board thật, nhưng chạy trên máy tính với cảm biến giả. Rơi không mất tiền. Vì sao phải học trên SITL trước khi động vào drone thật.
- **Phân biệt "chạy ở PowerShell" và "chạy ở bash trong WSL"** — nhắc lại lần hai, đây là chỗ sai nhiều nhất; kèm mẹo: dấu nhắc PowerShell là `PS D:\...>`, dấu nhắc WSL là `user@may:~$`.
- **`/mnt/d/` là gì** — ổ D của Windows nhìn từ trong WSL; vì sao đường dẫn hai bên khác nhau.
- **Mirrored networking so với NAT** — vẽ hai sơ đồ đơn giản; vì sao bật mirrored thì Mission Planner thấy SITL mà không cần biết IP; vì sao khi bật rồi thì `sim_vehicle.py` **phải** thêm `--no-wsl2-network`.
- **Biên dịch (build) là gì** — vì sao phải chờ 25 phút; vì sao chỉ chờ lần đầu, các lần sau nhanh.
- **Submodule là gì** — repo lồng trong repo; vì sao thiếu `--recurse-submodules` lại gây lỗi khó hiểu.
- **Ba cửa sổ của `sim_vehicle.py`** — cái nào gõ lệnh được, cái nào chỉ để nhìn. Người mới hay gõ nhầm vào cửa sổ Console và tưởng máy treo.
- **Firewall là gì và vì sao nó im lặng** — gói tin bị chặn không tạo ra thông báo lỗi; quy tắc: khi "không thấy gì" mà mọi thứ khác đúng, nghi firewall trước.
- **Cổng mạng là gì (mức rất nông)** — `14550`, `14551`, `5760`; vì sao UDP hay dùng cho telemetry còn TCP chắc ăn hơn khi mạng xấu.
