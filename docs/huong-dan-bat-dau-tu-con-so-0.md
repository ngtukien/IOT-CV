# Hướng dẫn bắt đầu từ con số 0

> Viết cho: bạn — người vừa chi 9.661.000 ₫ mua linh kiện drone, chưa cài phần mềm
> nào, chưa lắp gì, và chưa từng làm drone bao giờ.
>
> Cách đọc: làm **đúng thứ tự từ trên xuống**. Mỗi phần có ô để tick. Đừng nhảy
> cóc. Nếu một bước không chạy, dừng lại ở đó — đừng làm tiếp rồi mới sửa.

---

## Mục lục

| Phần | Nội dung | Thời gian | Cần gì |
|---|---|---|---|
| 0 | Hiểu mình đang làm gì | 5 phút | không |
| 1 | Đặt 3 món còn thiếu | 15 phút | ~280k |
| 2 | Cài phần mềm trên Windows | 2 giờ | mạng |
| 3 | Bay drone ảo lần đầu | 30 phút | phần 2 |
| 4 | Drone ảo xịn hơn (WSL + SITL) | 1–2 giờ | phần 3 |
| 5 | Chạy backend của dự án | 30 phút | phần 4 |
| 6 | Nạp firmware bo bay thật | 1 giờ | bo bay + cáp USB |
| 7 | Bind tay điều khiển FlySky | 20 phút | tay + iA6B |
| 8 | Lịch làm việc 2 tuần đầu | — | — |
| 9 | Khi bị kẹt | — | — |

---

## PHẦN 0 — Hiểu mình đang làm gì (đọc 5 phút)

### Drone của bạn gồm 3 khối, đừng lẫn lộn

```text
+-------------------------------------------------------------+
|  KHOI 1 -- BO BAY (SpeedyBee F405 V5)                       |
|  Chay phan mem ten ArduPilot.                               |
|  Nhiem vu DUY NHAT: giu cho drone khong roi.                |
|  No tu tinh 400 lan moi giay. Ban khong can thiep vao day.  |
+-------------------------------------------------------------+
                              ^
                              |  ra lenh muc cao
                              |  "bay toi toa do nay", "ve nha"
+-------------------------------------------------------------+
|  KHOI 2 -- LAPTOP (code Python cua ban)                     |
|  Gui lenh, nhan telemetry, chay YOLO tim nguoi.             |
|  Day la phan BAN viet. No KHONG BAO GIO dieu khien motor.   |
+-------------------------------------------------------------+
                              ^
                              |  mo tren trinh duyet
+-------------------------------------------------------------+
|  KHOI 3 -- WEB (trang dieu khien)                           |
|  Ban do, nut bam, video. Nguoi dung chi thay khoi nay.      |
+-------------------------------------------------------------+
```

**Điều quan trọng nhất phải nhớ:** nếu code Python của bạn crash giữa lúc bay,
drone **vẫn bay bình thường**, vì bo bay tự lo. Đó là lý do kiến trúc phải tách ra
như vậy. YOLO tuyệt đối không được dính vào việc điều khiển motor.

### "Drone ảo" là gì, và vì sao phải dùng

ArduPilot chạy được **trên máy tính** như một chương trình bình thường, giả lập một
con drone đầy đủ: có GPS, có gia tốc kế, bay được, rơi được. Gọi là **SITL**
(Software In The Loop).

```text
Viet code sai tren drone ao   ->  drone ao roi, chay lai, mat 0 dong
Viet code sai tren drone that ->  9.661.000 d thanh rac trong 2 giay
```

Toàn bộ phần mềm của đề tài (backend, web, waypoint, manual control) **phải chạy
xong trên drone ảo trước**. Đây không phải lời khuyên, đây là điều kiện bắt buộc.

### Bức tranh 3 tháng tới

```text
TUAN 1-2    phan mem tren drone ao          <-- BAN DANG O DAY
TUAN 3-4    lap rap + hieu chinh
TUAN 5      bay that lan dau (chi tay dieu khien)
TUAN 6-7    AltHold -> Loiter -> RTL -> Auto mission
TUAN 8-10   camera + YOLO
TUAN 11-12  ghep tat ca + viet bao cao
```

---

## PHẦN 1 — Đặt hàng 3 món còn thiếu (làm NGAY hôm nay)

Bạn đã có đủ mọi thứ để bay, **trừ 3 nhóm phụ kiện nhỏ**. Tổng khoảng 280.000 ₫.
Chúng chặn toàn bộ khâu lắp ráp, mà hàng thì mất vài ngày mới về — nên đặt trước,
cài phần mềm sau.

### 1.1. Bát chống rung 30,5 × 30,5 mm — BẮT BUỘC

- [ ] Đã đặt

**Từ khoá tìm:** `bát chống rung 30.5x30.5` hoặc `FC anti-vibration mount 30.5mm`
**Giá:** 50.000 – 150.000 ₫
**Hình dạng:** một tấm vuông nhỏ, có 4 quả cao su tròn ở giữa, hai mặt có lỗ.

**Vì sao bắt buộc — đọc kỹ chỗ này:**

Khung S500 **không có lỗ 30,5×30,5mm**, còn stack SpeedyBee thì bắt theo đúng chuẩn
đó. Hai bên không khớp. Có 3 đường đi, 2 đường sai:

```text
SAI 1 -- Tu khoan lo moi tren khung
  De duoi S500 KHONG phai tam nhua. No la bo mach nguon, co duong dong
  DUC CHIM BEN TRONG. Ban khong nhin thay chung. Khoan trung = dut mach
  nguon, va ban chi phat hien khi cam pin thay khong len dien.

SAI 2 -- Bat cung stack thang vao khung bang oc
  Truyen toan bo rung cua 4 motor vao dung cai cam bien gia toc ma bo bay
  dung de giu do cao. Hau qua: bat AltHold thi drone tu troi len / tut xuong
  du ban khong dung can ga. Dung hai che do ma ca de tai phu thuoc vao.

DUNG -- Bat chong rung
  Mat tren bat stack chuan 30,5. Mat duoi bat vao lo CO SAN cua tam tren
  khung, hoac dan bang keo xop 3M. Giai quyet ca hai van de cung luc.
```

> **Đã kiểm chứng 20/09/2026.** Trang sản phẩm Holybro xác nhận đế dưới S500 có PDB
> tích hợp (60A liên tục / 100A đỉnh) — nên cảnh báo cấm khoan là có cơ sở. Và bản
> dựng tham chiếu S500 V2 của chính Holybro (PX4 build guide) **dán băng keo hai
> mặt** để gắn bo bay chứ không bắt ốc cứng. Nói cách khác: cách làm ở trên trùng
> với khuyến nghị của nhà sản xuất, không phải mẹo của người dùng.

### 1.2. Dây silicone 16AWG — BẮT BUỘC

- [ ] Đã đặt

**Từ khoá:** `dây silicone 16AWG` — mua **4,5 mét**, **3 màu khác nhau**
**Giá:** khoảng 150.000 ₫

**Vì sao:** dây của motor T-Motor chỉ dài **150mm**, mà ESC nằm giữa drone, mỗi
motor cách tâm khoảng **240mm**. Phải nối dài. Cần 30cm × 3 dây × 4 motor = 3,6m,
mua 4,5m cho dư.

**Vì sao phải đúng 16AWG, không phải 14AWG:**

```text
Day nguon pin  -> ca drone rut 58A  -> can 14AWG (day to, cung)
Day motor      -> moi motor rut 15A -> 16AWG la thua suc (chiu duoc 80A)

Dung 14AWG cho day motor: qua cung, kho luon trong can khung, va no
truyen rung dong lam NUT MOI HAN theo thoi gian.
```

**Vì sao 3 màu:** giá như nhau, nhưng đấu đúng chiều quay cả 4 motor ngay lần đầu.
Cùng màu hết thì bạn sẽ đấu lộn và phải tháo ra làm lại.

### 1.3. Gen co nhiệt + dây rút — BẮT BUỘC

- [ ] Đã đặt

**Từ khoá:** `gen co nhiệt bộ nhiều cỡ 2mm-10mm` (khoảng 50k) và
`dây rút nhựa 2.5x100mm` (khoảng 30k)

**Vì sao:** bạn sẽ có 12 mối hàn dây motor. Hở một mối chạm vào cần khung là **chập
và cháy ESC** (2 triệu). Dây lủng lẳng không buộc sẽ **bị cánh quạt chém đứt** giữa
lúc bay.

### 1.4. Bốn câu hỏi gửi shop trước khi trả tiền

Nhắn trong khung chat của sàn để có bằng chứng nếu cần khiếu nại:

```text
1. Bat chong rung co dung lo 30.5 x 30.5mm khong, va kem may qua cao su?
2. Day silicone 16AWG loi nhieu soi manh hay loi cung? (phai la nhieu soi manh)
3. Bo gen co co co nao den co nao?
4. Giao hang trong bao nhieu ngay?
```

### 1.5. ĐỪNG mua mấy thứ này

```text
KHONG -- Bo thu ELRS            : khong ghep duoc voi tay FlySky (khac chuan song)
KHONG -- ESC 30A roi            : stack da co ESC 4-in-1 55A khoe hon
KHONG -- Power board (PDB)      : stack da kiem luon viec nay
KHONG -- Pin 3S                 : khung S500 bat buoc 4S, ban da co dung roi
KHONG -- Dong ho do cell pin    : sac B6AC V2 da co san chuc nang nay
KHONG -- ESP32-CAM ngay bay gio : de sau, khi drone bay on dinh da
```

---

## PHẦN 2 — Cài phần mềm trên Windows

Làm trong lúc chờ hàng về. Tất cả đều miễn phí.

> **Quy ước:** khi tôi viết "mở PowerShell", nghĩa là: bấm phím `Windows`, gõ
> `powershell`, bấm Enter. Khi tôi viết "mở PowerShell **quyền admin**", nghĩa là:
> bấm phím `Windows`, gõ `powershell`, **chuột phải** vào kết quả đầu tiên, chọn
> `Run as administrator`.

### 2.1. Mission Planner — trạm mặt đất (cài đầu tiên)

- [ ] Đã cài

Đây là phần mềm bạn sẽ dùng nhiều nhất: nạp firmware, hiệu chỉnh cảm biến, xem
telemetry, chạy motor test.

```text
1. Mo trinh duyet, vao:  https://firmware.ardupilot.org/Tools/MissionPlanner/
2. Tai file moi nhat ten dang:  MissionPlanner-latest.msi
3. Chay file .msi -> Next -> Next -> Install
4. Khi hien bang hoi cai driver -> BAM DONG Y TAT CA
   (day la driver USB de may tinh nhan bo bay;
    bo qua la sau nay khong ket noi duoc)
5. Mo Mission Planner tu Start Menu
```

Lần đầu mở sẽ trống trơn, chưa kết nối gì — đúng rồi, chưa sai đâu.

**Nếu Windows chặn:** bấm `More info` → `Run anyway`. Phần mềm này là mã nguồn mở
của cộng đồng ArduPilot, không có chữ ký số đắt tiền của Microsoft.

### 2.2. Git — để quản lý code

- [ ] Đã cài

```text
1. Vao:  https://git-scm.com/download/win
2. Tai "64-bit Git for Windows Setup"
3. Chay file, bam Next lien tuc cho toi het. Moi mac dinh deu dung.
```

Kiểm tra — mở PowerShell, gõ:

```powershell
git --version
```

Phải hiện ra dạng `git version 2.4x.x`. Nếu báo "not recognized" thì đóng
PowerShell, mở lại (biến môi trường cần shell mới).

### 2.3. Python 3.12 — để chạy backend

- [ ] Đã cài

```text
1. Vao:  https://www.python.org/downloads/windows/
2. Tai "Windows installer (64-bit)" ban 3.12.x
   (DUNG lay 3.13 -- vai thu vien ML chua ho tro)
3. Chay file cai dat
4. MAN HINH DAU TIEN: TICK VAO O "Add python.exe to PATH" o DUOI CUNG
   Day la loi so 1 cua nguoi moi. Quen tick la moi lenh python sau nay deu loi.
5. Bam "Install Now"
```

Kiểm tra:

```powershell
python --version
pip --version
```

Phải ra `Python 3.12.x` và một dòng pip. Nếu gõ `python` mà nó mở Microsoft Store
thì bạn đã quên tick "Add to PATH" — gỡ ra cài lại.

### 2.4. VS Code — để viết code

- [ ] Đã cài

```text
1. Vao:  https://code.visualstudio.com/
2. Tai ban Windows, chay file cai
3. TICK o "Add Open with Code action to Windows Explorer file context menu"
4. Mo VS Code -> bieu tuong 4 o vuong ben trai (Extensions) -> cai 2 cai:
      - Python    (cua Microsoft)
      - Pylance   (cua Microsoft)
```

### 2.5. Kiểm tra code dự án

- [ ] Đã kiểm tra

Bạn đã có sẵn thư mục `D:\Coding\IOT-CV`, nên không cần clone. Chỉ cần:

```powershell
cd D:\Coding\IOT-CV
git status
```

Phải hiện `On branch main`.

### 2.6. Tạo môi trường Python riêng cho dự án

- [ ] Đã tạo

"Môi trường ảo" (virtual environment) là một thư mục chứa riêng các thư viện của dự
án này, để không đụng vào Python chung của máy. Luôn làm bước này.

```powershell
cd D:\Coding\IOT-CV
python -m venv .venv
```

Chờ khoảng 20 giây. Sau đó **kích hoạt** nó:

```powershell
.\.venv\Scripts\Activate.ps1
```

Đầu dòng lệnh phải xuất hiện `(.venv)`. Đó là dấu hiệu đã vào đúng môi trường.

> **Nếu báo lỗi `cannot be loaded because running scripts is disabled`:**
> Windows chặn chạy script theo mặc định. Mở PowerShell **quyền admin**, chạy
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, gõ `Y` rồi Enter. Đóng, mở
> lại PowerShell thường, thử lại lệnh Activate.

**Mỗi lần mở PowerShell mới để làm việc với dự án, bạn phải chạy lại lệnh Activate
này.** Quên là mọi thứ sẽ báo "module not found".

### 2.7. Cài thư viện

- [ ] Đã cài

Đứng tại thư mục gốc của dự án (`D:\Coding\IOT-CV`). Lệnh này **không** cần bạn
Activate gì trước — `uv` tự tạo `.venv` và tự cài vào đúng đó:

```powershell
uv sync --extra dev
```

Mất 2–5 phút. Kiểm tra (`uv run` tự dùng `.venv` của dự án):

```powershell
uv run python -c "import pymavlink, fastapi; print('OK')"
```

Phải in ra `OK`.

### 2.8. Chạy thử bộ test của dự án

- [ ] Đã chạy, tất cả xanh

```powershell
python -m pytest -q
```

Tất cả phải `passed`. Nếu có test đỏ, **dừng lại và báo** — đừng làm tiếp, vì bạn
sẽ không phân biệt được lỗi có sẵn với lỗi mình tạo ra.

---

## PHẦN 3 — Bay thử drone ảo lần đầu

Đây là phần vui nhất và dễ nhất. Mission Planner có sẵn drone ảo bên trong, không
cần cài thêm gì.

- [ ] Đã bay được drone ảo

```text
1. Mo Mission Planner
2. Nhin thanh bieu tuong tren cung, bam vao tab "SIMULATION"
3. Chon "Multirotor"
4. Chon "Stable"  -> no se tu tai ve (lan dau mat 1-2 phut)
5. Cho. Khi man hinh chinh hien day so lieu (Alt, GroundSpeed, ...) la XONG.
   Ban vua co mot con drone ao dang chay.
```

### Bay nó lên

```text
1. Bam tab "DATA" (goc tren trai)
2. Nhin goc duoi trai: bang "Actions"
3. O o mode, chon "GUIDED"  ->  bam nut "Set Mode"
4. Bam nut "Arm/Disarm"     ->  cho toi khi thay chu ARMED
5. Menu "Actions" -> chon "Takeoff" -> nhap 10 -> OK
6. Nhin o Alt: so se tang dan len 10. DRONE AO CUA BAN DANG BAY.
```

### Cho nó bay tới một điểm

```text
1. Bam tab "PLAN" (ban do)
2. Chuot phai vao mot diem bat ky tren ban do, gan drone
3. Chon "Fly To Here" -> nhap do cao 15 -> OK
4. Quay lai tab "DATA", xem drone di chuyen tren ban do
```

### Cho nó về nhà

```text
Actions -> chon mode "RTL" -> Set Mode
Drone se tu bay ve diem cat canh va ha xuong.
```

**Bạn vừa làm xong một chuyến bay tự động hoàn chỉnh.** Chơi với nó 30 phút: thử
mode `LOITER`, `ALT_HOLD`, `LAND`. Thử vẽ một mission nhiều waypoint trong tab
`PLAN` rồi `Write` xuống và chuyển mode `AUTO`.

> **Sai cũng không sao.** Drone ảo rơi thì bấm lại từ bước 1. Đây chính là lý do
> chúng ta làm phần này trước.

---

## PHẦN 4 — Drone ảo xịn hơn (WSL + SITL)

Drone ảo của Mission Planner đủ để học, nhưng **backend Python của dự án cần bản
SITL đầy đủ** (có MAVProxy để chia luồng dữ liệu cho nhiều chương trình cùng lúc).
Bản đó chạy trên Linux.

Windows 11 có sẵn Linux bên trong, gọi là **WSL**. Không phải cài máy ảo.

### 4.1. Cài WSL + Ubuntu

- [ ] Đã cài

Mở PowerShell **quyền admin**:

```powershell
wsl --install -d Ubuntu
```

Chờ tải (khoảng 2GB). Sau đó **khởi động lại máy tính**.

Sau khi khởi động lại, cửa sổ Ubuntu tự mở và hỏi:

```text
Enter new UNIX username:  -> go ten khong dau, vi du: kien
New password:             -> go mat khau (MAN HINH KHONG HIEN GI KHI GO)
Retype new password:      -> go lai
```

> **Màn hình không hiện dấu sao khi gõ mật khẩu là đúng**, không phải bàn phím hỏng.
> Đó là cách Linux làm.

Từ giờ, mở Ubuntu bằng: phím `Windows` → gõ `Ubuntu` → Enter.

### 4.2. Cài ArduPilot SITL trong Ubuntu

- [ ] Đã cài

Mở Ubuntu, gõ **từng khối một**, chờ khối trước xong mới gõ khối sau:

```bash
sudo apt update && sudo apt upgrade -y
```

(hỏi mật khẩu thì gõ mật khẩu Ubuntu vừa tạo)

```bash
sudo apt install -y git python3-pip python3-venv
```

```bash
cd ~
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot.git
```

Bước này tải khoảng 2GB, mất 10–20 phút tuỳ mạng. Cứ để chạy.

```bash
cd ~/ardupilot
Tools/environment_install/install-prereqs-ubuntu.sh -y
```

Bước này cũng lâu (khoảng 15 phút). Khi xong:

```bash
source ~/.profile
```

### 4.3. Chạy drone ảo lần đầu

- [ ] Đã chạy được

```bash
cd /mnt/d/Coding/IOT-CV
./scripts/run_sitl.sh
```

Script đó gói sẵn đường dẫn và **cờ mạng đúng** cho máy này. Nếu bạn muốn gõ tay thì phải nhớ thêm cờ:

```bash
cd ~/ardupilot/ArduCopter
sim_vehicle.py -v ArduCopter --console --map --no-wsl2-network
```

⚠️ **`--no-wsl2-network` là bắt buộc trên máy này.** `C:\Users\Nghaiz\.wslconfig` đang đặt `networkingMode=mirrored` (xem `plans/PROGRESS.md` mục Phase 02). Thiếu cờ đó, `sim_vehicle.py` tưởng đang chạy NAT nên phát dữ liệu về gateway mặc định thay vì `127.0.0.1`, và Mission Planner **không thấy gì — không có thông báo lỗi nào**. Ngược lại, nếu bạn gỡ `networkingMode=mirrored` khỏi `.wslconfig` thì phải **bỏ** cờ này đi. Dùng `./scripts/run_sitl.sh` thì không phải nhớ: nó đọc biến `WSL_MIRRORED` và tự in ra nó đang chọn nhánh nào.

**Lần đầu chạy sẽ biên dịch mã nguồn, mất 10–30 phút.** Màn hình chạy hàng nghìn
dòng chữ — bình thường. Những lần sau chỉ mất khoảng 10 giây.

Khi xong, bạn thấy:

```text
- mot cua so "MAVProxy Console" day so lieu
- mot cua so ban do co icon drone
- dong lenh doi thanh:  STABILIZE>
```

Đó là **CỔNG PASS 3A** trong checklist. Tick được rồi.

### 4.4. Bay bằng dòng lệnh

Gõ vào cửa sổ có dấu nhắc `STABILIZE>`:

```text
mode guided
arm throttle
takeoff 10
```

Nhìn bản đồ: drone bay lên. Cho về nhà:

```text
mode rtl
```

### 4.5. Vài lệnh cần nhớ

```text
Ctrl + C                    dung SITL
mode loiter                 giu vi tri
mode land                   ha canh
status                      xem trang thai day du
param show WPNAV_SPEED      xem mot tham so
param set WPNAV_SPEED 300   doi tham so (cm/s)
```

---

## PHẦN 5 — Chạy backend của dự án

Giờ nối code Python của bạn vào drone ảo.

### 5.1. Mở SITL và chừa một cổng cho backend

- [ ] Đã chạy

Trong Ubuntu:

```bash
cd /mnt/d/Coding/IOT-CV
./scripts/run_sitl.sh
```

Thực ra **không cần làm gì thêm**: `sim_vehicle.py` đã tự phát sẵn ra cổng `14550`.
Đo được ngày 21/09/2026, dòng lệnh nó tự dựng là
`mavproxy.py --out 127.0.0.1:14550 --master tcp:127.0.0.1:5760 …`. Nghĩa là ngoài
cửa sổ điều khiển của chính nó, SITL còn phát một luồng dữ liệu ra cổng 14550 cho
chương trình khác dùng — backend của bạn, hoặc Mission Planner.

Muốn gõ tay thì nhớ cờ mạng, đừng bỏ quên như mục 4.3 đã cảnh báo:

```bash
cd ~/ardupilot/ArduCopter
sim_vehicle.py -v ArduCopter --console --map --no-wsl2-network --out=udp:127.0.0.1:14550
```

### 5.2. Chạy backend (cửa sổ Ubuntu THỨ HAI)

- [ ] Backend chạy được

Mở **một cửa sổ Ubuntu mới** (đừng tắt cửa sổ SITL):

```bash
cd /mnt/d/Coding/IOT-CV
# BAT BUOC dat UV_PROJECT_ENVIRONMENT: mac dinh uv dung dung thu muc `.venv`,
# nen neu khong doi ten, lan sync nay se DE LEN venv Windows dang nam cung cho.
export UV_PROJECT_ENVIRONMENT=.venv-linux
uv sync --extra dev
uv run uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

> `/mnt/d/` là cách Linux nhìn thấy ổ `D:` của Windows. Cùng một thư mục, hai lối
> vào. Dùng `.venv-linux` riêng vì thư viện Windows và Linux không dùng chung được.

Phải thấy dòng:

```text
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 5.3. Xem kết quả trên trình duyệt Windows

- [ ] Thấy `connected: true`

Mở trình duyệt trên Windows, vào `http://localhost:8000/api/status`.

Phải thấy JSON có `"connected": true`. Nếu là `false`, xem Phần 9.

Rồi mở trang điều khiển: `http://localhost:8000/`

**Đây là lúc đề tài của bạn thật sự bắt đầu.** Từ đây trở đi là GIAI ĐOẠN 5–15
trong checklist: telemetry, bản đồ, control API, dead-man safety, mission upload.

---

## PHẦN 6 — Nạp firmware cho bo bay thật

Làm được **ngay bây giờ**, chưa cần lắp gì, chưa cần pin. Chỉ cần bo bay + cáp USB-C.

> **KHÔNG CẮM PIN trong toàn bộ phần này.** Chỉ USB.

### 6.1. Hiểu vì sao lần đầu khác mọi lần sau

Bo xuất xưởng chạy **Betaflight** (phần mềm cho drone đua). Mission Planner không
nhận được bo đang chạy Betaflight. Nên lần đầu phải dùng chế độ đặc biệt của con
chip, gọi là **DFU**.

```text
LAN DAU   bo con Betaflight   ->  che do DFU        ->  nap file .hex
LAN SAU   bo da co ArduPilot  ->  Mission Planner   ->  nap file .apj
```

### 6.2. Tải firmware

- [ ] Đã tải

```text
Vao:  https://firmware.ardupilot.org/Copter/stable/speedybeef4v5/
Tai file:  arducopter_with_bl.hex
```

Kiểm tra bạn đang ở đúng thư mục: file `firmware-version.txt` trong đó phải ghi
`4.7.1`. Thư mục phải tên đúng **`speedybeef4v5`** — không phải `v4`, không phải
`SpeedyBeeF405AIO`.

### 6.3. Cài công cụ nạp DFU

- [ ] Đã cài

Cách dễ nhất là dùng **Betaflight Configurator** (nó có sẵn công cụ DFU và tự lo
driver):

```text
1. Vao:  https://github.com/betaflight/betaflight-configurator/releases
2. Tai ban moi nhat cho Windows
3. Cai va mo len
```

### 6.4. Đưa bo vào chế độ DFU

- [ ] Máy nhận DFU

```text
1. Tim nut BOOT tren bo bay -- mot nut bam nho mau den, thuong canh cong USB-C
2. GIU nut BOOT
3. Vua giu, vua cam cap USB-C vao may tinh
4. Dem 2 giay roi THA nut
5. Windows keu "ting"
```

Kiểm tra máy đã nhận chưa:

```text
Bam Windows + X -> chon "Device Manager"
Tim muc "Universal Serial Bus devices" hoac "STMicroelectronics"
Phai thay:  "STM32 BOOTLOADER"  hoac  "STM Device in DFU Mode"
```

> **Nếu hiện dấu chấm than vàng, hoặc không thấy gì:**
> - Thử cáp USB khác. **Rất nhiều cáp chỉ có 2 dây sạc, không có dây dữ liệu.**
>   Đây là nguyên nhân phổ biến nhất.
> - Thử cổng USB khác (ưu tiên cổng sau máy bàn, tránh hub).
> - Cài driver bằng **Zadig**: tải ở https://zadig.akeo.ie/ → mở → menu `Options`
>   → tick `List All Devices` → chọn `STM32 BOOTLOADER` trong danh sách → chọn
>   driver `WinUSB` → bấm `Replace Driver`.

### 6.5. Nạp firmware

- [ ] Đã nạp xong

```text
1. Mo Betaflight Configurator
2. Goc tren phai phai hien "DFU" thay vi so cong COM
3. Vao tab "Firmware Flasher"
4. Bat cong tac "Full chip erase"          <-- QUAN TRONG
5. Bam "Load Firmware [Local]"
6. Chon file  arducopter_with_bl.hex  vua tai
7. Bam "Flash Firmware"
8. Cho thanh tien trinh chay het. KHONG RUT CAP giua chung.
```

Xong, rút cáp, cắm lại (lần này **không** giữ nút BOOT).

### 6.6. Kiểm tra bằng Mission Planner

- [ ] Kết nối thành công

```text
1. Mo Mission Planner
2. Goc tren PHAI: chon cong COM cua bo (thuong la COM so cao nhat)
3. Toc do: chon 115200
4. Bam nut "CONNECT"
5. Cho no tai tham so (thanh chay "Getting params")
```

Khi xong, góc dưới màn hình phải ghi dạng `ArduCopter V4.7.1`.

**Nếu thấy dòng đó: bạn đã biến một bo drone đua thành bo drone nghiên cứu.** Đây là
cột mốc lớn.

### 6.7. Lưu bản sao tham số gốc — ĐỪNG BỎ QUA

- [ ] Đã lưu

```text
Mission Planner -> CONFIG -> Full Parameter List -> nut "Save to file"
Luu vao:  D:\Coding\IOT-CV\params\00-after-flash.param
```

Sau này chỉnh tham số sai mà không nhớ đã đổi gì, bạn có chỗ để quay về. Commit file
này vào git.

### 6.8. Đặt mấy tham số đầu tiên

- [ ] Đã đặt

Trong `Full Parameter List`, tìm và đổi (gõ tên vào ô `Search`):

```text
FRAME_CLASS   = 1      Quad
FRAME_TYPE    = 1      X          <-- tam thoi, se kiem chung bang Motor Test
MOT_PWM_TYPE  = 6      DShot600   <-- vi ESC OX32 la ESC so, KHONG calibrate
```

Bấm `Write Params`. Rồi rút cáp, cắm lại.

> **`FRAME_TYPE = X` chưa chắc đúng.** Bo này đánh số motor kiểu Betaflight, có thể
> khác kiểu chuẩn của ArduPilot. Nếu sai thì **drone lật úp ngay giây đầu tiên nhấc
> lên**. Bắt buộc kiểm chứng bằng Motor Test khi đã lắp xong motor — xem GIAI ĐOẠN
> 33 và 42 trong `README.md`.

---

## PHẦN 7 — Bind tay điều khiển FlySky

Làm được ngay, chỉ cần tay phát + bộ thu iA6B + nguồn 5V.

- [ ] Đã bind xong

Bind là ghép đôi tay phát với bộ thu, giống ghép Bluetooth. Làm một lần, nhớ mãi.

```text
1. Cam "bind plug" (cai jumper nhua nho di kem) vao cong B/VCC cua iA6B
   -- cong ngoai cung, thuong ghi chu B/VCC
2. Cap nguon 5V cho iA6B (tu cong USB cua bo bay, hoac nguon 5V bat ky)
   -> den LED tren iA6B NHAP NHAY NHANH
3. Tren tay FS-i6X: GIU nut "BIND KEY" (nut nho mat sau)
4. Vua giu, vua BAT cong tac nguon tay phat
5. Man hinh tay hien "RXBinding..."
6. Den iA6B chuyen tu nhap nhay sang SANG LIEN  ->  DA BIND
7. Tat tay, tat nguon iA6B, RUT bind plug ra
8. Bat lai ca hai -> den iA6B phai sang lien ngay
```

### Đặt tay phát về đúng chế độ

```text
Tren FS-i6X, vao menu:
  System Setup -> RX Setup -> Output mode -> chon  i-BUS
```

> **Bắt buộc là i-BUS.** Bo F405 V5 **không hỗ trợ PPM** (tài liệu ArduPilot ghi
> nguyên văn "PPM is not supported"). Cắm cổng PPM vào sẽ không bao giờ lên.

Sau này khi đấu vào bo bay: cổng **i-BUS** của iA6B nối vào chân **R6** của FC.

---

## PHẦN 8 — Lịch làm việc 2 tuần đầu

Bạn không có deadline cứng, nên đây là nhịp hợp lý, không ép.

### Tuần 1 — phần mềm, không chạm phần cứng

| Ngày | Việc | Xong khi |
|---|---|---|
| Hôm nay | Phần 1 (đặt hàng) + Phần 2.1→2.4 | Mission Planner mở được |
| Ngày 2 | Phần 2.5→2.8 | `pytest` xanh hết |
| Ngày 3 | Phần 3 | Bay được drone ảo trong Mission Planner |
| Ngày 4 | Phần 4.1→4.2 | Ubuntu cài xong ArduPilot |
| Ngày 5 | Phần 4.3→4.5 | `sim_vehicle.py` chạy, gõ lệnh bay được |
| Ngày 6 | Phần 5 | Trình duyệt thấy `connected: true` |
| Ngày 7 | Đọc `README.md` GIAI ĐOẠN 4 | Hiểu các flight mode |

### Tuần 2 — phần cứng trên bàn + phần mềm tiếp

| Ngày | Việc | Xong khi |
|---|---|---|
| Ngày 8 | Phần 6 (nạp firmware) | Mission Planner báo `ArduCopter V4.7.1` |
| Ngày 9 | Phần 7 (bind tay) + GIAI ĐOẠN 25 (kiểm hàng) | Đếm đủ 2+2 chiều ren motor |
| Ngày 10–11 | GIAI ĐOẠN 5–7 | Backend đọc được telemetry, web hiện số |
| Ngày 12–14 | GIAI ĐOẠN 8–11 | Bản đồ + control + dead-man safety |

**Khi hàng phụ kiện về** thì xen kẽ: sáng lắp ráp, tối code. Đừng bỏ hẳn nhánh phần
mềm để lắp.

### Ba việc TUYỆT ĐỐI không làm sớm

```text
KHONG -- Lap canh quat truoc khi Motor Test xac nhan du 4 motor dung chieu
KHONG -- Cam pin truoc khi do thong mach BAT+ <-> GND bang dong ho van nang
KHONG -- Bay thu trong nha (trong nha khong co GPS, drone se troi va dam)
```

---

## PHẦN 9 — Khi bị kẹt

### Bảng tra lỗi thường gặp

| Triệu chứng | Nguyên nhân hay gặp nhất | Cách sửa |
|---|---|---|
| Gõ `python` thì mở Microsoft Store | Quên tick "Add to PATH" | Gỡ Python, cài lại, nhớ tick |
| `running scripts is disabled` | Windows chặn script | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` trong PowerShell admin |
| `ModuleNotFoundError` | Quên kích hoạt venv | Chạy lại `.\.venv\Scripts\Activate.ps1`, kiểm tra có `(.venv)` ở đầu dòng |
| Máy không nhận bo bay qua USB | **Cáp chỉ có dây sạc** | Đổi cáp khác. Đây là lỗi số 1. |
| Device Manager hiện chấm than vàng | Thiếu driver DFU | Dùng Zadig cài driver WinUSB |
| `/api/status` trả `connected: false` | SITL chưa chạy, hoặc thiếu `--out=udp:127.0.0.1:14550` | Khởi động lại SITL đúng lệnh ở mục 5.1 |
| SITL chạy nhưng không có cửa sổ bản đồ | WSL thiếu giao diện đồ hoạ | `wsl --update` trong PowerShell admin, khởi động lại |
| Mission Planner báo "No Heartbeat" | Sai cổng COM hoặc sai baud | Thử từng cổng COM, baud để 115200 |
| GPS không bao giờ có fix | Đang ở trong nhà | Ra ngoài trời, chờ 1–2 phút |
| GPS sáng đèn nhưng MP báo "No GPS" | Quên bắt chéo TX/RX | Đảo lại: GPS TX vào FC R4, GPS RX vào FC T4 |

### Nguyên tắc khi gặp lỗi

```text
1. DOC dong loi cuoi cung. Khong doc ma doan la mat gap 10 lan thoi gian.
2. Chep nguyen van dong loi do di tim -- dung dien giai lai bang loi minh.
3. Thu 3 lan. Van khong duoc thi DUNG va hoi.
   Lan thu 4 lam lai cung mot cach la lang phi.
4. Moi lan chi doi MOT thu. Doi 3 thu cung luc roi chay duoc thi
   ban van khong biet cai nao da sua.
```

### Nguồn tra cứu chính thức

| Cần gì | Vào đâu |
|---|---|
| Tài liệu ArduPilot Copter | https://ardupilot.org/copter/ |
| Firmware bo của bạn | https://firmware.ardupilot.org/Copter/stable/speedybeef4v5/ |
| Diễn đàn hỏi đáp | https://discuss.ardupilot.org/ |
| Bản kê linh kiện của dự án | `docs/linh-kien-s500.html` (mở bằng trình duyệt) |
| Checklist 92 giai đoạn | `README.md` |
| Quy tắc an toàn | `SAFETY.md` |

---

## Nhắc lại ba điều, đọc lại mỗi khi sắp làm gì lớn

> **1. Cánh quạt không phải quạt bàn.**
> Ở ga tối đa, đầu cánh đi khoảng 510 km/h. Kể cả lúc treo lơ lửng vẫn khoảng
> 300 km/h. Drone rơi thì **buông cần ga xuống hết và để nó rơi**. Một cánh gãy giá
> 82.600 ₫. Một bàn tay thì không mua lại được, và tai nạn đó cũng chấm dứt luôn
> đề tài.

> **2. Chưa chạy được trên drone ảo thì đừng đụng vào drone thật.**
> Sai trên drone ảo: chạy lại. Sai trên drone thật: 9.661.000 ₫.

> **3. Lắp cánh là bước CUỐI CÙNG, không phải bước đầu tiên.**
> Nạp firmware, hiệu chỉnh, Motor Test đủ 4 motor đúng vị trí đúng chiều — **rồi
> mới** lắp cánh.
