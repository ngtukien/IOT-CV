# Phase 01: Tái cấu trúc repo, `uv`, Vite, mosquitto, CI

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 00 | ~6 giờ | Không |

## Mục tiêu

Sắp lại repo đúng cấu trúc đã duyệt và dựng đủ ba đường ray mà mọi phase sau chạy trên đó: backend quản lý bằng `uv` trên Python 3.13, frontend là Vite + React + TypeScript build ra `frontend/dist`, MQTT broker chạy trong Docker. Kết thúc phase, CI trên GitHub xanh cả ba job (`ruff`, `pytest`, `pnpm build`), và có khung `docs/so-tay/` + `plans/PROGRESS.md` để theo dõi 25 phase còn lại.

Phase này **không viết logic nghiệp vụ nào**. Nó chỉ dọn nhà và dựng khung.

## Đầu vào cần có

Phải xong trước: **Phase 00** (`uv`, `pnpm`, Docker Desktop, `git` đều gõ được).

Phải đọc trước:

- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` §5 — cấu trúc repo đích.
- `plans/reports/260921-research-web-gcs-stack.md` §2.5 (phiên bản npm/PyPI) và §5 (layout monorepo, lệnh `uv`/`pnpm`, `docker-compose`).
- `plans/_phase-index.md` — danh sách 25 phase chính + 4 phase AI, dùng để tạo khung `docs/so-tay/`.

Trạng thái repo hiện tại (đã kiểm ngày 21/09/2026): `backend/` (5 module + 4 file test), `frontend/` (7 file JS thuần + html + css), `ml/`, `esp32/` (2 sketch `.ino`), `params/` (3 file), `scripts/`, `Makefile`, `pyproject.toml` (chỉ có `[tool.ruff]` + `[tool.pytest]`), `README.md` 3808 dòng, `requirements*.txt` × 3, `copter-speedybeef4v5-d450a747.tar.gz` chưa giải nén.

## File và thư mục sở hữu

Tạo mới:

- `firmware/ardupilot/{params,custombuild,build-d450a747}/`, `firmware/dronebridge/`, `firmware/camera/`
- `docs/archive/`, `docs/archive/frontend-vanilla/`
- `docs/so-tay/` — 29 file khung (25 luồng chính `00`…`24`, 4 luồng AI `ai-01`…`ai-04`)
- `deploy/mosquitto.conf`, `docker-compose.yml`
- `frontend/` cây Vite mới (`package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/`)
- `.python-version`, `uv.lock`
- `ml/pyproject.toml` — khung dự án `uv` riêng cho ML (Python 3.13, **không có** `torch` — AI Phase 1 tự cài torch bằng `--index-url cu130`, xem 01.6)

Di chuyển bằng `git mv` (**không** xoá rồi tạo lại):

- `esp32/camera/camera.ino` → `firmware/camera/camera.ino`
- `esp32/mavlink_bridge/` → `firmware/dronebridge/legacy-sketch/`
- `params/custombuild/` → `firmware/ardupilot/custombuild/`
- `params/obstacle-avoidance-tfminiplus-serial3.param`, `params/README.md` → `firmware/ardupilot/params/`
- `README.md` → `docs/archive/plan-nhap-92-giai-doan.md`
- `docs/so-tay-lap-f450.html` → `docs/archive/so-tay-lap-f450.html`
- 9 file frontend cũ → `docs/archive/frontend-vanilla/`

Sửa: `README.md` (viết mới), `.gitignore`, `pyproject.toml`, `Makefile`, `.github/workflows/ci.yml`, `backend/app.py` (một dòng), `backend/tests/test_app.py` (một test), `plans/PROGRESS.md`.

Xoá: `requirements.txt`, `requirements-dev.txt` (nội dung chuyển vào `pyproject.toml` gốc), `requirements-ml.txt` (nội dung chuyển vào `ml/pyproject.toml` — khung dự án `uv` riêng cho ML, xem 01.6).

**Không đụng:** `backend/mavlink/`, `backend/mqtt/`, `backend/vision/`, `ml/`, `scripts/run_sitl.sh` (Phase 02 sở hữu), `scripts/github/`, `SAFETY.md`, `LICENSE`, `CONTRIBUTING.md`, `plans/reports/`, `plans/_phase-index.md`.

> ⚠️ **Phase 02 cũng chỉ phụ thuộc Phase 00**, nên hai phase có thể chạy song song. Nếu làm song song: Phase 01 sở hữu toàn bộ `Makefile` **trừ** mục `sitl:`; Phase 02 chỉ sửa đúng mục `sitl:` và `scripts/run_sitl.sh`. Ngoài ra không có file nào chồng lấn.

## Việc theo thứ tự

### 01.1 Tạo cây thư mục mới

Chạy ở **PowerShell (Windows)**, đứng tại `D:\Coding\IOT-CV`:

```powershell
Set-Location D:\Coding\IOT-CV
New-Item -ItemType Directory -Force -Path firmware\ardupilot\params,
                                          firmware\ardupilot\custombuild,
                                          firmware\ardupilot\build-d450a747,
                                          firmware\dronebridge,
                                          firmware\camera,
                                          docs\archive\frontend-vanilla,
                                          docs\so-tay,
                                          deploy
Get-ChildItem firmware -Recurse -Directory | Select-Object FullName
```

Kết quả mong đợi: 5 dòng đường dẫn dưới `firmware\` được in ra.

Nếu lỗi:

1. **`Set-Location` báo không tìm thấy** → repo ở chỗ khác; chạy `Get-Location` rồi dùng đường dẫn thật.
2. **Báo lỗi quyền ghi** → thư mục đang mở trong một chương trình khác (VS Code, Explorer); đóng rồi thử lại.
3. **Git không thấy thư mục mới** → bình thường, git không theo dõi thư mục rỗng; chúng chỉ xuất hiện khi có file bên trong.

### 01.2 Chuyển `esp32/` và `params/` vào `firmware/`

Nguyên tắc: **luôn `git mv`**. Copy-paste rồi xoá sẽ làm đứt lịch sử file, và khi cần biết "vì sao dòng này lại thế" thì `git log --follow` không truy ngược được nữa.

Chạy ở **PowerShell (Windows)**:

```powershell
git mv esp32/camera/camera.ino firmware/camera/camera.ino
git mv esp32/mavlink_bridge firmware/dronebridge/legacy-sketch
git mv params/custombuild/speedybeef4v5-copter471-tfminiplus.yaml firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml
git mv params/obstacle-avoidance-tfminiplus-serial3.param firmware/ardupilot/params/obstacle-avoidance-tfminiplus-serial3.param
git mv params/README.md firmware/ardupilot/params/README.md
git status --short
```

`esp32/mavlink_bridge/mavlink_bridge.ino` là bản nháp 39 dòng, sẽ bị **DroneBridge for ESP32 thay thế** ở Phase 12. Giữ dưới `legacy-sketch/` để đối chiếu, không dùng nữa. Tạo `firmware/dronebridge/README.md` một đoạn ngắn nói rõ điều đó và trỏ sang Phase 12.

Kết quả mong đợi: `git status --short` hiện các dòng bắt đầu bằng `R ` (renamed), không phải `D ` + `??`. Nếu thấy `D`/`??` nghĩa là bạn đã copy tay chứ không `git mv`.

Nếu lỗi:

1. **`git mv` báo `destination exists`** → chưa chạy 01.1, hoặc đích đã có file trùng tên.
2. **`git mv` báo `not under version control`** → file đó chưa từng được commit. `git add <file>` trước rồi `git mv`.
3. **Sau khi mv, `esp32/` và `params/` vẫn còn trong Explorer** → còn file ẩn hoặc file chưa track bên trong. `Get-ChildItem esp32 -Force -Recurse` để xem, xử lý rồi xoá thư mục rỗng.

### 01.3 Lưu trữ README cũ, viết README mới

`README.md` hiện là kế hoạch nháp 3808 dòng theo 92 giai đoạn. Nó có giá trị tham khảo nhưng **không phải kế hoạch đang bám theo** — bản hiệu lực là `plans/`.

```powershell
git mv README.md docs/archive/plan-nhap-92-giai-doan.md
git mv docs/so-tay-lap-f450.html docs/archive/so-tay-lap-f450.html
```

Viết `README.md` mới, **tối đa ~60 dòng**, gồm đúng sáu phần:

1. Một câu mục tiêu: quadcopter S500 + ArduPilot, web GCS, tránh vật cản, AI nhận diện người.
2. Trạng thái: đang ở phase nào (link `plans/PROGRESS.md`).
3. Bảng "đọc gì trước": `plans/README.md` (kế hoạch), `SAFETY.md` (luật an toàn), `docs/so-tay/` (giải thích cho người mới).
4. Khối "chạy thử nhanh": `uv sync --extra dev`, `uv run pytest`, `pnpm build` (trong `frontend/`), `docker compose up -d mosquitto`.
5. Cấu trúc thư mục 10 dòng.
6. Một dòng ở cuối: *"Kế hoạch 92 giai đoạn cũ đã chuyển sang `docs/archive/plan-nhap-92-giai-doan.md`, giữ làm tham khảo, không phải kế hoạch đang bám theo."*

Kết quả mong đợi: `(Get-Content README.md).Count` ≤ 60; `docs/archive/plan-nhap-92-giai-doan.md` tồn tại; `git log --follow --oneline docs/archive/plan-nhap-92-giai-doan.md` hiện lịch sử cũ.

Nếu lỗi:

1. **README mới bị mất khi `git mv`** → bạn tạo file mới **trước** khi mv. Thứ tự đúng: `git mv` trước, viết file mới sau.
2. **`git log --follow` không hiện lịch sử** → git cần đủ độ tương đồng để nhận ra rename; với file bị thay hoàn toàn thì chuyện này bình thường, không sao.

### 01.4 Khung `docs/so-tay/` — 29 file

Mỗi phase có một trang sổ tay giải thích cho người chưa biết gì. Ở phase này chỉ tạo khung; nội dung do agent viết sổ tay điền sau, dựa trên mục "Ghi chú cho sổ tay" ở cuối mỗi file phase.

Danh sách slug lấy từ `plans/_phase-index.md`. Chạy ở **PowerShell (Windows)**:

```powershell
$sotay = @(
  "00-cai-cong-cu-pc", "01-tai-cau-truc-repo", "02-wsl2-sitl",
  "03-hoc-ardupilot-drone-ao", "04-param-va-tranh-vat-can-ao",
  "05-backend-mavlink-telemetry", "06-backend-dieu-khien-deadman",
  "07-backend-mission-proximity-safety", "08-web-khung-hud",
  "09-web-ban-do-mission", "10-web-dieu-khien-obstacle-video",
  "11-firmware-ardupilot-param", "12-firmware-esp32-camera",
  "13-chuan-bi-lap-rap", "14-hang-ve-nap-firmware",
  "15-ban-rc-gps-compass", "16-ban-nguon-motor-esc",
  "17-ban-esp32-tfmini-camera", "18-lap-rap-khung",
  "19-hieu-chinh-tren-khung-failsafe", "20-bay-rc-co-ban",
  "21-bay-tu-dong-va-web", "22-tranh-vat-can-that-va-tuning",
  "23-iot-mqtt-su-kien-dashboard", "24-iot-qos-hong-hoc-bao-cao",
  "ai-01-chuan-bi", "ai-02-huan-luyen-thi-nghiem",
  "ai-03-du-lieu-that", "ai-04-bao-cao-xla"
)
foreach ($s in $sotay) {
  Set-Content -Path "docs\so-tay\$s.md" -Value @("# So tay $s", "", "chua viet") -Encoding utf8
}
(Get-ChildItem docs\so-tay\*.md).Count
```

Tiêu đề đặt không dấu để tránh lỗi encoding của PowerShell; sửa lại thành tiếng Việt có dấu bằng editor sau, hoặc để agent viết sổ tay sửa.

Kết quả mong đợi: lệnh cuối in `29`.

Nếu lỗi:

1. **In ra số khác 29** → thiếu dấu phẩy trong mảng `$sotay`, hoặc trùng slug. Đối chiếu lại với `plans/_phase-index.md`.
2. **File mở ra thấy ký tự lạ** → thiếu `-Encoding utf8`; xoá và chạy lại.

### 01.5 Giải nén custom build firmware và sửa `.gitignore`

**(a) Giải nén** — chạy ở **PowerShell (Windows)**:

```powershell
tar -xzf copter-speedybeef4v5-d450a747.tar.gz --strip-components=1 -C firmware\ardupilot\build-d450a747
Get-ChildItem firmware\ardupilot\build-d450a747 | Select-Object Name, Length
```

Kết quả mong đợi: 7 file — `arducopter_with_bl.hex`, `arducopter.apj`, `arducopter.bin`, `arducopter`, `build.log`, `extra_hwdef.dat`, `custombuild.yaml`.

**Chỉ commit 3 file nhẹ**: `custombuild.yaml`, `extra_hwdef.dat`, `build.log`. Bốn file nhị phân tái tạo được bất cứ lúc nào từ `custom.ardupilot.org` bằng đúng `custombuild.yaml` đó, và riêng `arducopter_with_bl.hex` đã ~2,5 MB.

**(b) Sửa `.gitignore` — cái bẫy quan trọng nhất của phase này**

`.gitignore` hiện tại đã có hai dòng `*.bin` và `*.log` ở phạm vi toàn repo. Nghĩa là `build.log` **đang bị nuốt sẵn**: `git add` bỏ qua nó **im lặng, không báo gì**. Phải thêm dòng phủ định `!`, và phải đặt **sau** dòng `*.log`, vì git lấy luật khớp cuối cùng.

Thêm vào **cuối** `.gitignore`:

```gitignore
# ---------------------------------------------------------------------------
# Firmware ArduPilot: nhi phan tai ve / build ra -> KHONG commit.
# Tai lai bat cu luc nao tu custom.ardupilot.org bang dung file
# firmware/ardupilot/custombuild/*.yaml
# ---------------------------------------------------------------------------
firmware/ardupilot/**/*.hex
firmware/ardupilot/**/*.apj
firmware/ardupilot/**/*.elf
firmware/ardupilot/**/arducopter
copter-speedybeef4v5-d450a747.tar.gz

# build.log cua custom build PHAI duoc commit: no la bang chung feature da build
# dung y (PRX_*, OAPATHPLANNER, TFMINIPLUS...). Dong "!" nay PHAI nam SAU dong
# "*.log" o phia tren, neu khong git van bo qua file.
!firmware/ardupilot/**/build.log
```

Hai chỗ tinh tế: `arducopter` là file ELF **không có đuôi** nên `*.elf` không bắt được — cần dòng riêng. `arducopter.bin` thì luật `*.bin` toàn repo đã bắt sẵn, không cần lặp.

**Việc trả về luồng chính (nhận từ AI Phase 1, A1.8 — DVC).** AI Phase 1 dùng DVC để phiên bản-hoá `ml/datasets/`. Dòng `ml/datasets/*` đã có sẵn trong `.gitignore` hiện tại (loại cả file dữ liệu lẫn con trỏ DVC), nên cần thêm hai dòng phủ định `!` để con trỏ `.dvc` và file `.gitignore` riêng của DVC trong thư mục đó vẫn commit được. Thêm ngay dưới dòng `!ml/datasets/.gitkeep` đang có:

```gitignore
!ml/datasets/*.dvc
!ml/datasets/.gitignore
```

**(c) Kiểm chứng trước khi commit**

```powershell
git check-ignore -v firmware/ardupilot/build-d450a747/arducopter_with_bl.hex
echo "exit=$LASTEXITCODE"
git check-ignore -v firmware/ardupilot/build-d450a747/build.log
echo "exit=$LASTEXITCODE"
```

Kết quả mong đợi:

- Lệnh đầu: in ra dòng luật đã bắt nó, `exit=0` → **đang bị ignore, đúng ý**.
- Lệnh sau: **không in gì**, `exit=1` → **không bị ignore, commit được**.

Rồi commit:

```powershell
git add -A
git commit -m "refactor(repo): gop esp32 + params vao firmware/, luu tru README cu, dung khung docs/so-tay"
git log --stat -1 | Select-String "build.log"
```

Dòng cuối phải in ra `build.log` — bằng chứng nó thực sự vào commit.

Nếu lỗi:

1. **`build.log` vẫn bị ignore** → dòng `!` đặt sai chỗ. `git check-ignore -v` in ra **số dòng** của luật đang bắt; chuyển dòng `!` xuống dưới dòng đó.
2. **`tar` báo `Cannot open`** → đứng sai thư mục; `Get-Location` phải là `D:\Coding\IOT-CV`.
3. **Giải nén ra thư mục lồng `copter-speedybeef4v5-d450a747/`** → thiếu `--strip-components=1`. Xoá thư mục thừa và chạy lại.

### 01.6 Backend: chuyển sang `uv` + Python 3.13

Hiện phụ thuộc khai báo ở ba file `requirements*.txt`, còn `pyproject.toml` chỉ có cấu hình `ruff`/`pytest`. `uv` cần khối `[project]`. Gộp về một chỗ là việc dọn nợ bắt buộc — giữ hai nguồn khai báo sớm muộn cũng lệch nhau.

```powershell
uv python pin 3.13
Get-Content .python-version
```

> **Ghim (pin) phiên bản Python bằng hai lớp, mỗi lớp một việc.** `uv python pin 3.13` ghi ra file `.python-version` — file này commit vào git, và `uv` tự đọc nó mỗi lần `uv sync`/`uv run` để biết chạy bằng interpreter nào, người khác clone repo không phải tự nhớ chọn đúng bản. Lớp thứ hai là `requires-python` trong `pyproject.toml` (thêm ngay dưới đây) — đây là **giới hạn cứng**: nếu ai đó (hoặc CI) lỡ chạy `uv sync` bằng một Python nằm ngoài khoảng này, `uv` báo lỗi và dừng lại thay vì âm thầm cài gói lên sai bản. Hai lớp bổ sung nhau: `.python-version` chọn đúng bản; `requires-python` chặn khi chọn sai.

Sửa `pyproject.toml`, thêm khối `[project]` **lên đầu file**, giữ nguyên `[tool.ruff]` và `[tool.pytest.ini_options]` đang có:

```toml
[project]
name = "iot-cv"
version = "0.1.0"
description = "UAV IoT + Computer Vision - web GCS va pipeline AI"
requires-python = ">=3.13,<3.14"
dependencies = [
    "pymavlink>=2.4.49",
    "fastapi>=0.141",
    "uvicorn[standard]>=0.53",
    "websockets>=13.0",
    "paho-mqtt>=2.1",
    "numpy>=1.26",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
    "ruff>=0.7",
]

# Day la ung dung, khong phai thu vien de publish -> uv khong can build no.
[tool.uv]
package = false
```

> File này **chỉ có phụ thuộc backend**. Không có nhóm `ml` — AI Phase 1 dùng một dự án `uv` riêng ở `ml/pyproject.toml` (tạo bên dưới), vì `torch` + CUDA runtime ~6 GB không nên kéo theo mỗi lần CI backend chạy `uv sync`.

Rồi:

```powershell
uv sync --extra dev
uv run ruff check .
uv run pytest
Remove-Item requirements.txt, requirements-dev.txt, requirements-ml.txt
```

> **Không copy venv có sẵn từ dự án khác.** Trên Windows, copy nguyên thư mục `.venv/` từ một dự án khác vào đây hỏng ngầm: các file `.exe` trong `.venv\Scripts\` (như `pip.exe`) nhúng cứng đường dẫn tuyệt đối tới `python.exe` của venv gốc, nên sau khi copy, `pip.exe` vẫn âm thầm chạy interpreter cũ — không báo lỗi gì cả. Và việc này cũng không tiết kiệm được gì: cache của `uv` (đã có sẵn trên máy này) tạo venv mới bằng hardlink chỉ trong vài giây, không tải lại gói nào đã có sẵn trong cache. Đường đúng luôn là `uv sync`.

Sửa `Makefile` cho khớp: `setup` → `uv sync --extra dev`; `setup-ml` → `cd ml && uv sync` (chỉ cài phụ thuộc Python thuần của ML; `torch` **không** nằm trong đó, phải cài riêng bằng `--index-url cu130` — xem AI Phase 1 §A1.1, Makefile không tự làm việc này); `lint` → `uv run ruff check .`; `fmt` → `uv run ruff format .`; `test` → `uv run pytest`; `run` → `uv run uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000`. Bỏ luôn khối `if [ -d backend/tests ]` trong mục `test` — thư mục đó đã tồn tại, điều kiện ấy chỉ che lỗi. Để nguyên mục `sitl:` (Phase 02 sở hữu).

**Khung `ml/pyproject.toml`.** Một interpreter Python **3.13** chạy cả backend lẫn ML (không dùng phiên bản khác riêng cho ML — xem AI Phase 1 §A1.1), nhưng `ml/` vẫn là một **dự án `uv` riêng** với `pyproject.toml` của chính nó, để tách phụ thuộc nặng (torch, ultralytics, opencv) khỏi backend. Tạo `ml/pyproject.toml`:

```toml
[project]
name = "iot-cv-ml"
version = "0.1.0"
description = "Pipeline AI: dataset, suy giam anh, huan luyen, danh gia"
requires-python = ">=3.13,<3.14"
dependencies = [
    "ultralytics>=8.4.157",
    # PIN <5: opencv-python da nhay major 4.x -> 5.0.0.93, chua kiem tra API.
    "opencv-python>=4.10,<5",
    # PIN cung 2.0.8: ban goc MIT da ngung bao tri; albumentationsx la AGPL, tranh.
    "albumentations==2.0.8",
    "numpy<3",
    "pyyaml>=6",
    "pandas>=2.2",
    "matplotlib>=3.9",
    "tqdm>=4.66",
    "pycocotools>=2.0.8",
    "pytest>=8",
]
# torch/torchvision KHONG nam trong file nay: phai cai TRUOC bang
#   uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu130
# (AI Phase 1, A1.1). De pip tu keo torch theo ultralytics se ra ban CPU va
# KHONG co canh bao gi.

[tool.uv]
package = false
```

Đây chỉ là **khung**: nội dung phụ thuộc ở trên đã chốt đúng (ghim `albumentations==2.0.8`, chặn `opencv-python<5`), nhưng việc cài đặt và kiểm chứng thật sự (torch, `check_gpu.py`) thuộc AI Phase 1 §A1.1. Nếu sau này cần thêm/bớt gói ML, sửa **file này** — không tạo lại `requirements-ml.txt`.

Kết quả mong đợi:

- `uv sync --extra dev` tạo `.venv/` và `uv.lock`, in danh sách gói đã cài.
- `uv run ruff check .` in `All checks passed!`.
- `uv run pytest` in `4 passed` (hiện có 4 file test trong `backend/tests/`).

Nếu lỗi:

1. **`No interpreter found for Python 3.13`** → `uv python install 3.13` rồi chạy lại.
2. **`pytest` báo `ModuleNotFoundError: backend`** → bạn chạy `pytest` trần. Phải là `uv run pytest`.
3. **`ruff` báo lỗi trong `ardupilot/`** → không xảy ra nếu chưa clone ArduPilot vào trong repo; `extend-exclude` trong `pyproject.toml` đã loại thư mục đó rồi.
4. **`uv sync` báo không tìm thấy `[build-system]`** → thiếu `[tool.uv] package = false`.

### 01.7 Frontend: dựng lại bằng Vite + React + TypeScript

`frontend/` hiện là 7 file JS thuần. Thiết kế đã duyệt thay chúng bằng Vite + React 19 + TS + Tailwind 4 + shadcn/ui. Các file cũ **không xoá** mà chuyển vào lưu trữ — chúng ghi lại cách chia panel (telemetry / map / mission / control / video) mà Phase 08–10 sẽ dựng lại bằng React.

**(a) Dọn chỗ**

```powershell
git mv frontend/app.js frontend/control.js frontend/map.js frontend/mission.js `
       frontend/telemetry.js frontend/ui.js frontend/video.js `
       frontend/index.html frontend/styles.css docs/archive/frontend-vanilla/
Get-ChildItem frontend -Force
```

Lệnh cuối phải cho ra danh sách **rỗng**. `pnpm create vite .` từ chối chạy trong thư mục không rỗng (hoặc hỏi ghi đè — đừng bấm bừa).

**(b) Dựng Vite**

```powershell
Set-Location frontend
pnpm create vite . --template react-ts
pnpm install
pnpm add zustand leaflet react-leaflet
pnpm add -D tailwindcss "@tailwindcss/vite" "@types/leaflet"
pnpm dlx shadcn@latest init
pnpm build
Set-Location ..
```

Phiên bản tham chiếu ngày 21/09/2026 (`plans/reports/260921-research-web-gcs-stack.md` §2.5): react 19.3.0, vite 8.3.0, typescript 5.103.1, tailwindcss 4.3.3, zustand 5.0.15, leaflet 1.9.4, react-leaflet 5.0.0. Báo cáo tự ghi rằng số của `vite` và `typescript` nhảy bậc bất thường — **chưa xác minh lại**. Đừng ghim cứng; để `pnpm` lấy bản mới nhất rồi ghi số thực tế vào `plans/PROGRESS.md`.

**(c) Nối Tailwind 4 và proxy dev**

Tailwind 4 nối vào Vite bằng plugin, không còn bắt buộc `tailwind.config.js` như v3. Sửa `frontend/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/ws": { target: "ws://127.0.0.1:8000", ws: true },
    },
  },
});
```

Và thêm một dòng vào đầu `frontend/src/index.css`:

```css
@import "tailwindcss";
```

Khối `server.proxy` là thứ cho phép Phase 08 chạy `pnpm dev` (hot reload) mà vẫn gọi được backend ở cổng 8000.

**(d) Đổi chỗ FastAPI phục vụ file tĩnh**

`backend/app.py` dòng 93 đang trỏ `frontend/`. Sau khi có Vite, file tĩnh nằm ở `frontend/dist/`:

```python
_FRONTEND_DIR = config.PROJECT_ROOT / "frontend" / "dist"
```

⚠️ **Việc này làm hỏng một test đang xanh.** `backend/tests/test_app.py::test_frontend_duoc_serve` yêu cầu `GET /` trả 200 và có chữ "UAV". Sau khi đổi, nó đỏ trên CI (job Python không build frontend) và đỏ trên máy bạn tới khi chạy `pnpm build`. Sửa thành bỏ qua có điều kiện:

```python
import pytest
from backend import config

_DIST = config.PROJECT_ROOT / "frontend" / "dist"


@pytest.mark.skipif(not _DIST.is_dir(), reason="chua chay pnpm build")
def test_frontend_duoc_serve():
    response = client.get("/")
    assert response.status_code == 200
```

Bỏ luôn `assert "UAV" in response.text` — trang Vite mặc định chưa có chữ đó. Phase 10 sẽ kiểm chứng thật bằng Playwright; **không xoá test**, chỉ hạ nó xuống mức "có dist thì kiểm".

Kiểm chứng end-to-end:

```powershell
uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Mở `http://127.0.0.1:8000` — phải thấy trang mặc định của Vite (logo React quay). `Ctrl+C` để dừng.

Kết quả mong đợi: `frontend/dist/index.html` tồn tại; trang mở được ở cổng 8000; `uv run pytest` vẫn xanh.

Nếu lỗi:

1. **`pnpm create vite .` báo thư mục không rỗng** → còn sót file; `Get-ChildItem frontend -Force` (có `-Force` để thấy file ẩn) và chuyển nốt.
2. **`pnpm dlx shadcn@latest init` hỏi alias đường dẫn** → chấp nhận mặc định (`@/components`, `@/lib/utils`); nó tự thêm `paths` vào `tsconfig.json`.
3. **Mở cổng 8000 bị 404** → chưa `pnpm build`, hoặc `frontend/dist` chưa tồn tại nên `app.py` bỏ qua phần mount (có `if _FRONTEND_DIR.is_dir()`).
4. **Tailwind không ăn** → thiếu `@import "tailwindcss";` trong `src/index.css`, hoặc quên thêm `tailwindcss()` vào mảng `plugins`.

### 01.8 Docker: chỉ chạy mosquitto

MQTT broker là nơi backend bắn dữ liệu IoT lên (Phase 23–24). Dựng sẵn từ giờ để khi tới đó không phải dừng lại cài.

**Backend thì không đóng gói Docker.** `network_mode: host` không hoạt động trên Docker Desktop for Windows, mà backend cần nghe UDP MAVLink trực tiếp — nên backend chạy native bằng `uv` (`plans/reports/260921-research-web-gcs-stack.md` §5).

Tạo `deploy/mosquitto.conf`:

```conf
# Broker chay trong LAN noi bo cua mot nguoi dung, khong mo ra Internet.
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest stdout
```

Tạo `docker-compose.yml` ở gốc repo:

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: iotcv-mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - ./deploy/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - mosquitto_data:/mosquitto/data

volumes:
  mosquitto_data:
```

Dùng **named volume** cho `/mosquitto/data` (không để Docker tự tạo volume ẩn danh), để sau này `docker volume prune` không xoá nhầm dữ liệu thật.

```powershell
docker compose up -d mosquitto
docker compose ps
docker compose logs mosquitto --tail 20
```

Kết quả mong đợi: `docker compose ps` hiện `iotcv-mosquitto` trạng thái `running`; log có dòng `mosquitto version 2.x.x running`.

Nếu lỗi:

1. **`port is already allocated`** → có mosquitto khác đang chạy. `docker ps -a` tìm và gỡ, hoặc đổi sang `"1884:1883"` rồi ghi lại vào PROGRESS.
2. **`bind source path does not exist`** → đường dẫn `./deploy/mosquitto.conf` sai; phải chạy `docker compose` từ gốc repo.
3. **Container khởi động rồi tắt ngay** → cú pháp trong `mosquitto.conf` sai; `docker compose logs mosquitto` in đúng dòng lỗi.

### 01.9 Cập nhật CI

`.github/workflows/ci.yml` hiện có 2 job: `lint` (cài ruff bằng `pip`), `test` (cài `requirements-dev.txt`, ma trận 3.11/3.12). Sau 01.6 và 01.7 thì cả hai đều sai nguồn phụ thuộc, sai cả phiên bản Python, và thiếu hẳn frontend.

Sửa thành 3 job. Bốn ràng buộc bắt buộc:

- **Mỗi job phải có `timeout-minutes`** (lint 5, test 10, frontend 10). Mặc định của GitHub là 6 giờ.
- **Không thêm `paths:` filter** vào workflow này. Nếu nó là required check, GitHub báo check bị bỏ qua vì `paths` là `Expected — Waiting` vĩnh viễn → không merge được nữa.
- Giữ `concurrency` và `permissions: contents: read` đang có.
- Chỉ chạy Python 3.13 (bỏ ma trận 3.11/3.12 cũ) vì `requires-python` đã khoá `>=3.13,<3.14`.
- Phiên bản action lấy bản mới nhất đã kiểm chứng ngày 21/09/2026: `actions/checkout@v7`,
  `actions/setup-node@v7`, `astral-sh/setup-uv@v10`, `pnpm/action-setup@v4`. Bảy PR dependabot
  đề xuất đúng các bản này đã bị đóng ngày 21/09/2026 vì chúng sửa `requirements*.txt` (phase
  này xoá) và `ci.yml` (phase này viết lại); nội dung của chúng nằm ngay ở đây.

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10
      - run: uv sync --extra dev
      - run: uv run ruff check .

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10
      - run: uv sync --extra dev
      - run: uv run pytest

  frontend:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: frontend
      - run: pnpm lint
        working-directory: frontend
      - run: pnpm build
        working-directory: frontend
```

Đẩy lên và xem tab Actions:

```powershell
git add -A
git commit -m "ci: chay ruff/pytest qua uv va them job build frontend"
git push
```

Kết quả mong đợi: tab Actions hiện 3 job xanh.

Nếu lỗi:

1. **`pnpm install --frozen-lockfile` fail** → `frontend/pnpm-lock.yaml` chưa commit. `git add frontend/pnpm-lock.yaml` rồi đẩy lại.
2. **`pnpm lint` báo không có script** → thêm `"lint": "eslint ."` vào `frontend/package.json` (template react-ts của Vite đã sinh sẵn file cấu hình eslint).
3. **`uv sync` fail trên runner vì `.python-version`** → `setup-uv` tự tải đúng bản Python được ghim; nếu vẫn lỗi, thêm `- run: uv python install 3.13` trước bước `uv sync`.

### 01.10 Bật `plans/PROGRESS.md` thành sổ theo dõi

`plans/PROGRESS.md` là **nơi duy nhất** ghi tiến độ — không GitHub Projects, không công cụ ngoài. Toàn bộ theo dõi là file trong repo.

Cách dùng, áp cho cả 25 phase:

1. Xong một cổng pass → đổi `- [ ]` thành `- [x]` trong mục phase đó.
2. Điền `Ngày bắt đầu` khi bắt tay, `Ngày xong` khi cụm checkbox đã tick hết.
3. Trục trặc → một dòng ngắn vào `Ghi chú`; chi tiết viết vào `docs/so-tay/NN-*.md`.
4. Commit `plans/PROGRESS.md` cùng công việc tương ứng, prefix `chore(plans):`.

Cuối phase này, tick đủ cụm Phase 01 và commit.

## Cổng pass

- [ ] `uv run pytest` in `N passed`, không `failed`, không `error`.
- [ ] `uv run ruff check .` in `All checks passed!`.
- [ ] `pnpm build` trong `frontend/` sinh `frontend/dist/index.html`; chạy `uv run uvicorn backend.app:app --port 8000` rồi mở `http://127.0.0.1:8000` thấy trang React, không 404.
- [ ] `git check-ignore -v firmware/ardupilot/build-d450a747/build.log` trả exit code **1**, và `git log --stat -1` (hoặc `git log --oneline -- .../build.log`) chứng minh file đã vào commit.
- [ ] `git check-ignore -v firmware/ardupilot/build-d450a747/arducopter_with_bl.hex` trả exit code **0** (đang bị ignore, đúng ý).
- [ ] `git log --follow --oneline firmware/ardupilot/params/README.md` hiện lịch sử có từ trước khi đổi chỗ (chứng minh đã `git mv`).
- [ ] `(Get-ChildItem docs\so-tay\*.md).Count` in `29`.
- [ ] `README.md` mới ≤ 60 dòng; `docs/archive/plan-nhap-92-giai-doan.md` và `docs/archive/so-tay-lap-f450.html` tồn tại.
- [ ] Ba file `requirements*.txt` đã xoá; `pyproject.toml` (gốc) có khối `[project]` **không có** `[project.optional-dependencies] ml`; `ml/pyproject.toml` tồn tại, là dự án `uv` riêng, **không có** `torch`; `.python-version` chứa `3.13`.
- [ ] `docker compose ps` hiện `iotcv-mosquitto` đang `running`.
- [ ] CI trên GitHub xanh cả 3 job (`lint`, `test`, `frontend`).
- [ ] `plans/PROGRESS.md` mục Phase 01 đã tick, ghi số phiên bản npm thực tế, và đã commit.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| `.gitignore` có sẵn `*.log`/`*.bin` nuốt im lặng `build.log` → mất bằng chứng feature đã build | 4 | 3 | **12** | Dòng `!firmware/ardupilot/**/build.log` đặt cuối file; bắt buộc kiểm bằng `git check-ignore -v` **trước** commit (01.5c) |
| Đổi mount sang `frontend/dist` làm `test_frontend_duoc_serve` đỏ trên CI | 4 | 2 | 8 | `pytest.mark.skipif` khi `dist` chưa có (01.7d); Phase 10 kiểm chứng thật bằng Playwright |
| `pnpm create vite .` ghi đè nhầm file frontend cũ chưa kịp lưu trữ | 3 | 4 | **12** | Bắt buộc 01.7(a) trước, và kiểm `Get-ChildItem frontend -Force` rỗng rồi mới scaffold |
| `git mv` xong nhưng quên sửa đường dẫn trong `Makefile` / `ci.yml` / script | 3 | 3 | 9 | Sau khi di chuyển, `Select-String -Pattern "esp32/|params/|requirements" -Path Makefile,scripts\*,.github\workflows\*` và sửa hết trước khi commit |
| Làm song song Phase 01 và Phase 02 → hai bên cùng sửa `Makefile`, ghi đè nhau | 3 | 2 | 6 | Ranh giới đã ghi ở mục "File và thư mục sở hữu": Phase 02 chỉ chạm mục `sitl:` |
| Copy-paste thay vì `git mv` → đứt lịch sử file, `git log --follow` vô dụng | 3 | 3 | 9 | Cổng pass kiểm bằng `git log --follow`; `git status --short` phải hiện `R`, không phải `D`+`??` |
| Số phiên bản npm trong báo cáo (`vite 8.3.0`, `typescript 5.103.1`) **chưa xác minh lại** | 3 | 1 | 3 | Không ghim cứng; ghi số thực tế vào `plans/PROGRESS.md` sau khi `pnpm install` |
| Xoá `requirements*.txt` nhưng `ml/` hoặc tài liệu còn trỏ vào | 2 | 2 | 4 | `Select-String -Pattern "requirements" -Path *.md,ml\**\*.py` rồi sửa; `Makefile` đã nằm trong danh sách sửa |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 01.1 Tạo cây thư mục | 0,25 | |
| 01.2 `git mv` esp32 + params | 0,5 | |
| 01.3 Lưu trữ README cũ + viết README mới | 1,0 | Viết README mới chiếm phần lớn |
| 01.4 Khung `docs/so-tay/` 29 file | 0,5 | |
| 01.5 Giải nén firmware + `.gitignore` | 0,75 | Cái bẫy `*.log` dễ tốn thời gian |
| 01.6 Backend sang `uv` | 1,0 | |
| 01.7 Frontend Vite + React | 1,25 | Gồm sửa `app.py` và một test |
| 01.8 Docker mosquitto | 0,25 | |
| 01.9 Cập nhật CI | 0,75 | Thường mất 2–3 vòng đẩy commit mới xanh |
| 01.10 Bật PROGRESS | 0,25 | |
| Dự phòng | 0,5 | |
| **Tổng** | **6,0** | |

## Ghi chú cho sổ tay

Những khái niệm `docs/so-tay/01-tai-cau-truc-repo.md` cần giải thích cho người chưa biết gì:

- **`git mv` khác gì xoá-rồi-tạo-lại** — lịch sử file là gì, vì sao mất nó là mất tiền sau này; cách đọc `git log --follow`.
- **`.gitignore` và luật khớp cuối cùng** — vì sao `*.log` lại nuốt mất `build.log`; dấu `!` làm gì; đọc `git check-ignore -v` thế nào; vì sao một file bị ignore lại không có thông báo lỗi.
- **Vì sao không commit file firmware nhị phân** — repo phình to, và chúng tái tạo được từ `custombuild.yaml`; ngược lại vì sao `build.log` thì phải giữ.
- **Trình quản lý gói là gì** — `uv` cho Python, `pnpm` cho JavaScript; lockfile là gì và vì sao nó quan trọng; vì sao gộp ba `requirements*.txt` về hai `pyproject.toml` (gốc cho backend, `ml/pyproject.toml` cho AI) thay vì một file `.txt`.
- **Vì sao phải ghim một phiên bản Python cho dự án, và ghim bằng hai lớp** — `.python-version` (uv đọc, commit vào git) chọn đúng bản; `requires-python` trong `pyproject.toml` chặn khi ai đó chạy nhầm bản khác. Backend dùng được Python 3.13 mới nhất vì mọi thư viện cần (`pymavlink`, `MAVProxy`, `wxPython`, `opencv-python`, `ultralytics`) đều đã có wheel/bản pure-python cho 3.13, kiểm chứng trên PyPI ngày 21/09/2026 — xem bảng ở `plans/reports/260921-brainstorm-thiet-ke-tong-the.md`.
- **Build frontend là gì** — vì sao React phải "build" mới chạy được, `frontend/dist` là gì, vì sao FastAPI phục vụ thư mục đó chứ không phục vụ mã nguồn.
- **Proxy trong `vite.config.ts`** — vì sao lúc phát triển có hai cổng (5173 và 8000) mà trình duyệt vẫn gọi được cả hai.
- **Docker và container là gì (mức rất nông)** — vì sao mosquitto chạy trong container còn backend thì không; named volume so với anonymous volume và vì sao dữ liệu cần cái thứ nhất.
- **MQTT là gì (giới thiệu sớm)** — broker, topic; vì sao dựng từ Phase 01 dù tới Phase 23 mới dùng.
- **CI là gì** — máy chủ GitHub tự chạy lại bài kiểm tra mỗi lần đẩy code; xanh/đỏ nghĩa là gì; vì sao mỗi job phải có `timeout-minutes`.
