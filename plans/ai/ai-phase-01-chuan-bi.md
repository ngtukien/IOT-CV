# AI Phase 1: Chuẩn bị (không phụ thuộc phần cứng)

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | `phase-01` (tái cấu trúc repo + uv) là ràng buộc **kỹ thuật** duy nhất. Khuyến nghị **bắt đầu sau `phase-19`/`phase-21`** theo ưu tiên của người dùng (UAV bay được trước), nhưng **không bị chặn kỹ thuật** — làm sớm lúc nào cũng được | ~30,5 giờ người + ~1 giờ GPU | Không (chỉ laptop RTX 4060) |

> **Ghi chú phạm vi.** Phần thị giác đầy đủ của backend cho web (parser MJPEG + proxy fan-out + nguồn giả cho `phase-10`) **không còn thuộc AI Phase 1** — nó thuộc `plans/phase-07-backend-mission-proximity-safety.md` §7.8.2–§7.8.4, độc lập với AI Phase 1 và không cần chờ AI Phase 1 bắt đầu. AI Phase 1 chỉ giữ lại một công cụ đọc MJPEG nhỏ (`ml/tools/mjpeg_client.py`, xem A1.9) để **thu dữ liệu** cho dataset, dùng cùng hợp đồng header do `phase-07` chốt (`docs/hop-dong-mjpeg.md`).

## Mục tiêu

Dựng toàn bộ nền tảng AI để AI Phase 2 chỉ còn việc bấm nút chạy thí nghiệm: một môi trường Python riêng có GPU chạy thật, dataset VisDrone đã lọc còn một lớp `person` và đếm được số instance, bộ suy giảm ảnh (degradation) viết thành thư viện có kiểm thử, hai script train/evaluate in ra đủ chỉ số kể cả `AR-small` và độ trễ, công cụ gán nhãn và phiên bản hoá dữ liệu đã chạy thử, và phần `backend/vision` đọc được luồng MJPEG bằng parser tự viết.

Phase này **trung lập với đề tài môn Xử lý ảnh**. Bốn hướng A/B/C/D trong `plans/QUYET-DINH-CHUA-CHOT.md` dùng chung y hệt những gì làm ở đây — chốt đề tài là việc của AI Phase 2 (bước A2.0). Không có việc nào trong AI Phase 1 bị lãng phí dù chốt hướng nào.

Phase này **không thu dữ liệu thật**. Ảnh tự chụp bằng camera trên drone thuộc **AI Phase 3**. Ở đây chỉ dùng VisDrone + ảnh suy giảm tổng hợp + một nguồn MJPEG giả lập.

## Đầu vào cần có

Phải đọc trước (theo thứ tự):

- `plans/reports/260921-research-ai-vision-pipeline.md` — nguồn chính của phase này. Mọi phiên bản gói, lệnh cài, cạm bẫy đều lấy từ đây.
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` §2, §3 — kiến trúc đã duyệt và bảng rủi ro.
- `plans/_phase-index.md` — SSOT đánh số phase, để tra chéo cho đúng.
- `plans/QUYET-DINH-CHUA-CHOT.md` — để biết cái gì đang mở (đọc thôi, AI Phase 1 không cần chốt).
- `plans/_phase-template.md` — cấu trúc file này.

Phần mềm phải có sẵn:

- Từ `phase-00`: `uv`, `git`, VS Code. Từ `phase-01`: cây thư mục repo đã tái cấu trúc, `pyproject.toml` cho backend.
- Windows 11, driver NVIDIA 610.x (kiểm tra: `nvidia-smi`), RTX 4060 Laptop 8 GB.
- Ít nhất **40 GB trống trên ổ D:** (hiện ~138 GB). Ước lượng chiếm dụng: torch + CUDA runtime ~6 GB, VisDrone thô + đã chuyển ~5 GB, bản suy giảm ~3 GB, HERIDAL ~2 GB *(chưa xác minh dung lượng)*, weights + kết quả ~2 GB.
- **Không cần cài CUDA Toolkit riêng** — wheel `cu130` đã đóng gói runtime.

Không cần: drone, camera, hay bất kỳ linh kiện nào.

## Hiện trạng từng file (đọc trước khi viết — luật prior-art)

Mọi script trong `ml/scripts/` hiện là **khung rỗng**: có `parse_args()` đầy đủ rồi `raise NotImplementedError`. Không có dòng logic nào chạy được. Cụ thể:

| File | Số dòng | Hiện có gì | Thiếu gì |
|---|---|---|---|
| `ml/scripts/train.py` | 45 | `--data --model(yolo11n.pt) --epochs 100 --imgsz 640 --batch 16 --name --project(ml/results)`; docstring mô tả thang model A→E | `--seed`, `--amp`, `--patience`, `--optimizer`, `--lr0`, `--device`; `batch` mặc định 16 (phải đổi sang `-1`); không ghi lại thời gian mỗi epoch; docstring đặt tên model xung đột với cách đặt tên ở AI Phase 2 (xử lý ở A1.6) |
| `ml/scripts/evaluate.py` | 45 | `--weights --data --imgsz --condition --out(metrics.csv)`; hằng `CONDITIONS`, `METRICS` (precision/recall/mAP50/mAP50-95) | **AR-small**, phân tầng theo kích thước, độ trễ ms/khung, ghi JSON. Hiện chỉ định ghi CSV |
| `ml/scripts/convert_visdrone_person.py` | 48 | `--visdrone --out --skip-empty`; hằng `VISDRONE_PERSON_CATEGORIES = (1, 2)` theo **đánh số THÔ** (file `.txt` gốc có `0 = ignored-regions`) | Lọc `score == 0`; giữ metadata `truncation`/`occlusion`; giữ một phần ảnh nền; đếm instance; ghi `dataset_stats.json`; công cụ tự kiểm tra lệch-một |
| `ml/scripts/split_dataset.py` | 41 | `--images --labels --train --val --test --out`; ý tưởng chia theo session **đã đúng** | Thân hàm; kiểm tra giao nhau giữa các split; ghi manifest |
| `ml/scripts/augment.py` | 48 | `--images --out --degradations --copies`; **đã có guard chặn đường dẫn chứa `test`** (giữ nguyên, rất đúng) | Chỉ liệt kê 3 phép suy giảm; chưa nối vào `ml/degrade/`; chưa cập nhật bbox |
| `ml/scripts/extract_frames.py` | 43 | `--video --out --every 1.5 --prefix` | Thân hàm. AI Phase 1 chỉ implement đủ để cắt khung từ video; dùng thật ở **AI Phase 3** |
| `ml/configs/visdrone_person.yaml` | 10 | `path: ../datasets/visdrone_person`, train/val/test, `names: {0: person}` | Dòng `nc: 1` (Ultralytics suy ra được nhưng nên ghi rõ) |
| `ml/configs/own_camera.yaml` | 10 | trỏ `../datasets/own_split` | Không sửa ở AI Phase 1 (AI Phase 3 dùng) |
Kết luận prior-art: **không có gì phải xoá, chỉ có điền thân hàm và thêm file mới.** Hai chỗ cần sửa nội dung đã có: `train.py` (mặc định batch + docstring tên model), `ml/pyproject.toml` (Phase 01 đã tạo khung đúng ghim — chỉ chỉnh nếu cần thêm/bớt gói, xem A1.1).

`backend/vision/*`, `backend/config.py`, `.gitignore` **không còn trong bảng này** — AI Phase 1 không sở hữu các file đó nữa (xem "Ranh giới với luồng chính" bên dưới): `backend/vision/stream.py`/`fake_stream.py` và `docs/hop-dong-mjpeg.md` thuộc `phase-07`; khoá Vision mới trong `backend/config.py` thuộc `phase-05`; dòng `.gitignore` cho DVC thuộc `phase-01`.

**Bảng này mô tả trạng thái trước `phase-01`; nếu `phase-01` đã chạy, đọc lại file thật trước khi sửa.**

## File và thư mục sở hữu

AI Phase 1 được tạo/sửa đúng những đường dẫn sau. Không đụng file nào ngoài danh sách.

**Tạo mới**

```
ml/.venv/                                (không commit, .gitignore đã loại)
ml/scripts/check_gpu.py
ml/scripts/download_visdrone.py
ml/scripts/make_degraded_dataset.py
ml/scripts/prelabel_to_labelstudio.py
ml/scripts/coco_eval.py
ml/degrade/__init__.py
ml/degrade/params.py
ml/degrade/custom.py
ml/degrade/pipeline.py
ml/configs/degrade_esp32.yaml
ml/configs/heridal.yaml
ml/tests/__init__.py
ml/tests/test_degrade_bbox.py
ml/tests/test_degrade_pipeline.py
ml/tests/test_convert_visdrone.py
ml/tests/test_split_no_leak.py
ml/data/README.md                        (giấy phép — đặt NGOÀI ml/datasets/ vì thư mục đó bị gitignore)
ml/labeling/README.md
ml/labeling/label_config.xml
ml/tools/mjpeg_client.py                 (đọc MJPEG đúng docs/hop-dong-mjpeg.md, chỉ để thu dữ liệu — xem A1.9)
.dvc/                                    (do `dvc init` sinh)
ml/datasets/visdrone_person.dvc
```

**Sửa file đã có**

```
ml/pyproject.toml                        (chỉ nếu cần thêm/bớt gói — Phase 01 đã tạo khung đúng ghim)
ml/configs/visdrone_person.yaml          (thêm nc: 1)
ml/scripts/train.py                      (điền thân + thêm args + sửa docstring)
ml/scripts/evaluate.py                   (điền thân + thêm chỉ số)
ml/scripts/convert_visdrone_person.py    (điền thân)
ml/scripts/split_dataset.py              (điền thân)
ml/scripts/augment.py                    (nối vào ml/degrade/, giữ nguyên guard test)
ml/scripts/extract_frames.py             (điền thân)
```

**Sinh ra khi chạy (không commit)**: `ml/datasets/**`, `ml/weights/**`, `ml/results/**`.

**Tuyệt đối không đụng**: `backend/**` (toàn bộ, kể cả `backend/vision/*` và `backend/config.py` — xem bảng ranh giới), `frontend/**`, `firmware/**`, `params/**`, `.gitignore`, `docs/**` (trừ đọc `docs/hop-dong-mjpeg.md`).

**Ranh giới với luồng chính** (tránh hai phase cùng sửa một file):

| File | Ai sở hữu | Ai chỉ được dùng |
|---|---|---|
| `backend/vision/stream.py`, `fake_stream.py` | **`phase-07`** | AI Phase 1 chỉ **đọc** (qua `ml/tools/mjpeg_client.py`, cùng URL `CAMERA_STREAM_URL`) |
| `backend/vision/detector.py`, `events.py` | Chốt ở phase khác (ngoài phạm vi `phase-07` lẫn AI Phase 1) | AI Phase 1 không đụng |
| Hợp đồng header MJPEG (`docs/hop-dong-mjpeg.md`) | **`phase-07` là SSOT** | AI Phase 1 và `phase-12` chỉ **trích dẫn**, không định nghĩa lại |
| `backend/config.py` | `phase-05` | AI Phase 1 không sửa; khoá Vision mới (`YOLO_DEVICE`, `DETECTION_IMGSZ`, `VISION_ENABLED`) do `phase-05` §5.7 thêm |
| `backend/vision/recorder.py` | `phase-23` | AI Phase 1 không đụng |
| `.gitignore` (ngoại lệ `!ml/datasets/*.dvc`) | `phase-01` §01.5 | AI Phase 1 không sửa — chỉ dùng |

---

## Việc theo thứ tự

### A1.1 Môi trường ML riêng, torch cu130, kiểm tra GPU thật

**Làm gì.** Tạo một môi trường Python **tách khỏi backend**, dù **cùng phiên bản 3.11** với backend (`plans/reports/260921-review-plan-consistency.md` mục A — một interpreter duy nhất cho cả dự án). Lý do tách vẫn còn nguyên dù cùng phiên bản: torch + CUDA runtime nặng ~6 GB, trộn vào env của backend thì mỗi lần CI backend `uv sync` phải kéo 6 GB vô ích cho một thứ nó không cần.

`ml/` là một **dự án `uv` riêng**, khung `ml/pyproject.toml` đã được **Phase 01** tạo sẵn (§01.6) — Python `3.11`, ghim đúng `albumentations==2.0.8`, `opencv-python>=4.10,<5`, chưa có `torch`. **3.11 nằm trong giao của mọi ràng buộc:** wheel `torch cu130` hỗ trợ 3.10–3.15, `tensorrt` bản pip hỗ trợ 3.8–3.13 (AI Phase 2 cần) — giao của hai khoảng đó là 3.10–3.13, và 3.11 vừa khớp phiên bản backend đang dùng nên không cần cài thêm một interpreter khác trên máy.

**Label Studio và DVC KHÔNG cài vào `ml/.venv`** — cài bằng `uv tool install` để chúng có env riêng. Label Studio kéo theo Django và hàng chục gói web; trộn với torch là mời xung đột dependency mà không được lợi gì.

Cạm bẫy lớn nhất của cả phase nằm ở đây: nếu cài `ultralytics` **trước** `torch`, pip sẽ kéo bản torch **CPU** về, rồi mọi lệnh train vẫn chạy bình thường — chỉ là chậm gấp 30 lần và **không báo lỗi gì cả**. Vì vậy phải cài torch trước và có một script chặn cứng.

**Lệnh chạy (PowerShell, Windows, tại `D:\Coding\IOT-CV`):**

```powershell
# 0. Nếu PowerShell chặn script kích hoạt venv:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 1. Kiểm tra chỗ trống và driver TRƯỚC khi tải 6 GB
Get-PSDrive D | Select-Object Used,Free
nvidia-smi

# 2. Vào dự án uv riêng của ml/, ghim đúng Python (khớp pyproject.toml Phase 01 đã tạo)
Set-Location ml
uv python pin 3.11
uv venv
.\.venv\Scripts\Activate.ps1

# 3. CÀI TORCH TRƯỚC (bắt buộc đúng thứ tự này) — KHÔNG nằm trong ml/pyproject.toml
uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu130

# 4. Rồi mới đồng bộ phần còn lại từ ml/pyproject.toml
uv sync

# 5. Kiểm tra GPU — phải PASS trước khi làm bất cứ việc nào sau
Set-Location ..
python ml\scripts\check_gpu.py
```

`ml/pyproject.toml` (Phase 01 đã tạo khung, nội dung ghim đúng — xem `plans/phase-01-tai-cau-truc-repo.md` §01.6) là nơi khai báo phụ thuộc ML; sửa **file đó** nếu cần thêm/bớt gói, không tạo lại `requirements-ml.txt`.

**`ml/scripts/check_gpu.py` phải in và kiểm tra:**

| Dòng in ra | Kỳ vọng | Nếu sai thì sao |
|---|---|---|
| `torch.__version__` | `2.14.0+cu130` | Có hậu tố `+cpu` → cài sai, xoá venv làm lại |
| `torch.cuda.is_available()` | `True` | `False` → torch CPU hoặc driver quá cũ |
| `torch.cuda.get_device_name(0)` | `NVIDIA GeForce RTX 4060 Laptop GPU` | Tên khác → chạy nhầm GPU tích hợp |
| `total_memory / 1e9` | `~8.0` | — |
| Một phép nhân ma trận 4096×4096 **trên GPU** + `torch.cuda.synchronize()` | chạy xong, in thời gian | Đây là bằng chứng kernel CUDA chạy thật, không chỉ "import được" |
| `ultralytics.__version__` | `>= 8.4.157` | — |
| `cv2.__version__` | `4.x` | — |

Script **thoát với mã 1** nếu bất kỳ kiểm tra nào hỏng (luật "lỗi rõ hơn fallback im lặng"). Mọi việc sau trong phase đều coi `check_gpu.py` là cổng vào.

**Kết quả mong đợi.** `python ml\scripts\check_gpu.py` in đủ 7 dòng trên, kết thúc bằng `OK — GPU sẵn sàng`, mã thoát 0.

**Nếu lỗi:**

- `torch.cuda.is_available() == False` và version có `+cpu`: đã cài sai thứ tự. `deactivate`, xoá `ml\.venv`, làm lại từ bước 2.
- `Could not find a version that satisfies torch`: gõ nhầm URL chỉ mục, hoặc Python 3.11 chưa có trên máy → `uv python install 3.11` rồi làm lại.
- `OSError: [WinError 126] ... fbgemm.dll`: thiếu Visual C++ Redistributable → cài `vc_redist.x64.exe` của Microsoft rồi thử lại.
- `Activate.ps1 cannot be loaded`: chạy lại bước 0.

---

### A1.2 Bố cục thư mục dữ liệu và ghi chú giấy phép

**Làm gì.** Định ra một chỗ ở cố định cho từng loại dữ liệu ngay bây giờ, trước khi có dữ liệu. Sau này chuyển thư mục thì phải sửa hàng chục đường dẫn trong config và trong các file `.dvc`.

```text
ml/datasets/
├─ _raw/                     zip đã tải + bản giải nén thô (XOÁ ĐƯỢC, tái tạo lại được)
│  ├─ VisDrone2019-DET-train/{images,annotations}
│  ├─ VisDrone2019-DET-val/{images,annotations}
│  └─ VisDrone2019-DET-test-dev/{images,annotations}
├─ visdrone_person/          bản đã lọc còn 1 lớp person  ← dataset chính của AI Phase 2
│  ├─ train/{images,labels,meta}
│  ├─ val/{images,labels,meta}
│  └─ test/{images,labels,meta}
├─ visdrone_person_degraded/ bản đã chạy qua ml/degrade (AI Phase 2 sinh, cùng cấu trúc)
├─ heridal/{images,labels}   bổ sung nền hoang dã, giấy phép CC BY
├─ own_camera/               TRỐNG ở AI Phase 1 — ảnh tự thu, AI Phase 3 đổ vào
│  └─ sessions/<session_id>/{images,labels}
└─ paired/                   TRỐNG ở AI Phase 1 — cặp ảnh camera rẻ ↔ điện thoại, AI Phase 3
   ├─ esp32/<session_id>/
   ├─ phone/<session_id>/
   └─ aligned/<session_id>/  bản đã căn chỉnh homography
```

Thư mục `meta/` là chỗ giữ `truncation`/`occlusion` của VisDrone dưới dạng JSON cạnh mỗi ảnh. Lý do tách khỏi file `.txt`: định dạng nhãn YOLO chỉ chấp nhận đúng 5 số mỗi dòng, thêm cột thứ 6 là Ultralytics báo lỗi. Nhưng hai trường này cần cho việc phân tầng kết quả theo mức che khuất ở phần đánh giá, nên không được vứt.

`ml/data/README.md` phải ghi (đặt ở `ml/data/` chứ không phải `ml/datasets/` vì `.gitignore` dòng 36 loại sạch `ml/datasets/*`):

| Nguồn | Giấy phép | Ràng buộc thực tế phải tuân |
|---|---|---|
| VisDrone2019-DET | **Không có file LICENSE** trong repo gốc; trang Ultralytics hiển thị "No license" | Dùng cho nghiên cứu theo thông lệ học thuật. **Trích dẫn bài báo gốc. KHÔNG đăng lại ảnh thô** trong báo cáo hay repo. Không giả định quyền thương mại. **Ghi rõ sự mơ hồ này trong mục giấy phép của báo cáo** — đây là cách trung thực duy nhất |
| HERIDAL | **CC BY** | Được dùng thoải mái kể cả thương mại, **bắt buộc ghi công tác giả** |
| SARD | Chưa xác minh (trang Kaggle render bằng JS) | *Chưa xác minh* — phải mở trình duyệt kiểm tra tay trước khi dùng. Chưa đưa vào kế hoạch |
| TinyPerson | Hạn chế: cấm thương mại, **cấm đăng ảnh nhận dạng được người** | **Loại khỏi kế hoạch** |
| UAVDT | "Research only" | **Loại** — không chú thích người, chỉ có xe |
| `albumentations` 2.0.8 | MIT | Lý do ghim: xem A1.1 |
| `albumentationsx` | AGPL-3.0 / thương mại | Không dùng trừ khi bắt buộc; nếu dùng phải khai báo |
| Ảnh tự thu (AI Phase 3) | Của nhóm | **Có hình ảnh người thật → vấn đề riêng tư.** Không đưa lên dịch vụ cloud công cộng. DVC đẩy lên thư mục Drive **riêng tư**. Xin phép người xuất hiện trong ảnh |

**Lệnh chạy (PowerShell):**

```powershell
$dirs = @(
  "ml\datasets\_raw",
  "ml\datasets\visdrone_person\train\images","ml\datasets\visdrone_person\train\labels","ml\datasets\visdrone_person\train\meta",
  "ml\datasets\visdrone_person\val\images","ml\datasets\visdrone_person\val\labels","ml\datasets\visdrone_person\val\meta",
  "ml\datasets\visdrone_person\test\images","ml\datasets\visdrone_person\test\labels","ml\datasets\visdrone_person\test\meta",
  "ml\datasets\heridal\images","ml\datasets\heridal\labels",
  "ml\datasets\own_camera\sessions",
  "ml\datasets\paired\esp32","ml\datasets\paired\phone","ml\datasets\paired\aligned",
  "ml\data","ml\labeling","ml\degrade","ml\tests","ml\weights"
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
git check-ignore -v ml\data\README.md    # phải KHÔNG in ra gì
```

**Kết quả mong đợi.** Cây thư mục khớp sơ đồ trên; `ml/data/README.md` tồn tại và vào được git.

**Nếu lỗi:**

- `git status` không thấy `ml/data/README.md`: bị luật ignore nào đó bắt → `git check-ignore -v <file>` cho biết dòng nào của `.gitignore` gây ra, rồi thêm ngoại lệ.
- Trùng tên `ml/data` và `ml/datasets` gây nhầm khi gõ: chấp nhận, nhưng nhớ quy ước — `data` là **tài liệu về dữ liệu** (vào git), `datasets` là **dữ liệu** (không vào git).

---

### A1.3 Tải VisDrone và viết script chuyển sang một lớp `person`

**Làm gì.** VisDrone là bộ ảnh chụp từ drone có 10 lớp. Dự án chỉ cần người, nhưng "người" trong VisDrone bị tách làm hai lớp: `pedestrian` (đang đứng/đi) và `people` (tư thế khác — ngồi, nằm, trong đám đông). **Phải lấy cả hai.** Chỉ lấy `pedestrian` là mất sạch người ngồi và người nằm — mà người nằm bất động chính là dấu hiệu nạn nhân trong kịch bản tìm kiếm cứu nạn của đề tài. Đây là lỗi dễ mắc nhất khi lọc dataset này.

**Tải.** Dùng Ultralytics làm bộ tải (nó tự tải zip từ nguồn chính thức và giải nén), nhưng **tự chuyển đổi từ file annotation thô**, không dùng bản chuyển của Ultralytics. Lý do: hàm `visdrone2yolo()` của họ giữ cả 10 lớp và dùng cách đánh số riêng; ta cần kiểm soát bước lọc `score == 0` và giữ metadata, nên phải đọc thẳng `annotations/*.txt`.

```powershell
# Bắt Ultralytics tải dataset vào ổ D thay vì thư mục mặc định trên ổ C
yolo settings datasets_dir="D:\Coding\IOT-CV\ml\datasets\_raw"
yolo settings weights_dir="D:\Coding\IOT-CV\ml\weights"
yolo settings                      # in ra để xác nhận đường dẫn đã đổi

python ml\scripts\download_visdrone.py       # gọi check_det_dataset("VisDrone.yaml")
```

`ml/scripts/download_visdrone.py` chỉ làm ba việc: gọi `from ultralytics.data.utils import check_det_dataset` rồi `check_det_dataset("VisDrone.yaml")`, in ra đường dẫn thực tế đã giải nén, và kiểm tra ba thư mục `annotations/` tồn tại. Nếu tải qua Google Drive bị chặn quota, in ra link thủ công trong README của repo `VisDrone/VisDrone-Dataset` và hướng dẫn giải nén tay vào `ml/datasets/_raw/`.

Dung lượng kỳ vọng (đã kiểm chứng trong báo cáo nghiên cứu): train 1.44 GB / 6.471 ảnh, val 0.07 GB / 548 ảnh, test-dev 0.28 GB / 1.610 ảnh (có nhãn).

**Định dạng nhãn thô.** Mỗi dòng trong `annotations/<tên ảnh>.txt`:

```text
<bbox_left>,<bbox_top>,<bbox_width>,<bbox_height>,<score>,<object_category>,<truncation>,<occlusion>
```

- Toạ độ là **pixel tuyệt đối**, góc trên-trái + rộng/cao (không phải x1y1x2y2).
- `score` trong file ground-truth **KHÔNG phải độ tin cậy**: `0` = vùng phải **bỏ qua**, `1` = đối tượng hợp lệ. Mọi dòng `score == 0` phải bị loại.
- `object_category` trong file thô đánh số có thêm `0 = ignored-regions` và `11 = others`, nên `1 = pedestrian`, `2 = people`. Hằng `VISDRONE_PERSON_CATEGORIES = (1, 2)` đang có trong script là **đúng cho file thô**, nhưng bảng lớp trong `VisDrone.yaml` của Ultralytics là bản **đã ánh xạ lại** (`0 = pedestrian`, `1 = people`). Hai cách đánh số lệch nhau đúng một đơn vị. **Không được tin, phải kiểm chứng trên chính bản sao của mình.**

**Công thức chuyển sang YOLO:**

```text
dw = 1.0 / img_width
dh = 1.0 / img_height
x_center = (bbox_left + bbox_width  / 2) * dw
y_center = (bbox_top  + bbox_height / 2) * dh
w_norm   =  bbox_width  * dw
h_norm   =  bbox_height * dh
```

Ghi ra `0 x_center y_center w_norm h_norm` (lớp 0 = `person` cho cả `pedestrian` lẫn `people`).

**Spec cho `ml/scripts/convert_visdrone_person.py`** (điền thân, giữ nguyên `--visdrone --out --skip-empty` đã có):

| Tham số thêm | Mặc định | Ý nghĩa |
|---|---|---|
| `--category-ids` | `1,2` | Cho phép sửa đánh số **mà không phải sửa code** khi phát hiện lệch-một |
| `--background-ratio` | `0.10` | Tỉ lệ ảnh **không còn hộp nào** vẫn được giữ làm ảnh nền |
| `--seed` | `0` | Lấy mẫu ảnh nền theo hash tên file + seed → tái lập được |
| `--verify-sample` | `20` | Vẽ hộp lên N ảnh, ghi vào `ml/results/convert_check/` để **mắt người** kiểm tra |
| `--stats-out` | `ml/results/dataset_stats.json` | — |

Các bước bắt buộc, theo đúng thứ tự:

1. In **histogram toàn bộ `object_category` gặp được** trước khi lọc. Nếu id lớn nhất là 11 → đang đọc file thô (đúng). Nếu lớn nhất là 9 → đang đọc bản đã ánh xạ, phải đổi `--category-ids 0,1`.
2. Bỏ mọi dòng `score == 0`, đếm số dòng bỏ.
3. Giữ chỉ các dòng có category thuộc `--category-ids`, đếm riêng từng loại.
4. Ghi `class_id = 0` cho cả hai.
5. Chuẩn hoá theo công thức trên; **kẹp** về `[0, 1]`; bỏ hộp có `w_norm <= 0` hoặc `h_norm <= 0` sau khi kẹp, đếm số bỏ.
6. Ghi `meta/<stem>.json`: `{"image_w":.., "image_h":.., "boxes":[{"truncation":0,"occlusion":2,"src_category":1,"xywhn":[..]}]}` — cùng thứ tự với các dòng trong file `.txt`.
7. **Ảnh không còn hộp nào: giữ lại `--background-ratio` (mặc định 10%) làm ảnh nền**, ghi file `.txt` **rỗng** cho chúng. Ultralytics xử lý tốt ảnh nền và chúng giảm dương tính giả — vốn là rủi ro lớn nhất khi bay thật trên bãi cỏ/bê tông. Đừng xoá sạch.
8. `--verify-sample 20`: vẽ hộp lên ảnh và ghi ra `ml/results/convert_check/`. **Bước này là cổng chống lệch-một duy nhất đáng tin.** Mở 20 ảnh đó ra xem: hộp có trùm lên người không? Nếu hộp trùm lên xe máy hoặc ô tô thì đã lệch đánh số.
9. Ghi `ml/results/dataset_stats.json`.

Schema `dataset_stats.json`:

```json
{
  "generated_at": "2026-09-21T10:00:00",
  "source": "ml/datasets/_raw/VisDrone2019-DET-*",
  "category_ids_used": [1, 2],
  "splits": {
    "train": {
      "images_total": 6471,
      "images_with_person": 0,
      "images_background_kept": 0,
      "instances_person": 0,
      "instances_pedestrian": 0,
      "instances_people": 0,
      "boxes_dropped_score0": 0,
      "boxes_dropped_degenerate": 0,
      "bbox_height_px": {"p10": 0, "p50": 0, "p90": 0},
      "size_buckets_px": {"lt16": 0, "16_32": 0, "32_64": 0, "gt64": 0},
      "occlusion_hist": {"0": 0, "1": 0, "2": 0}
    },
    "val": {},
    "test": {}
  }
}
```

> Số instance `person` thật sau khi lọc: **chưa xác minh** — không trích dẫn con số từ bài báo khác. Script phải tự đếm, và **con số trong báo cáo lấy từ file JSON này**.

`size_buckets_px` được thiết kế để khớp với phần đánh giá ở A1.6: đây là chỗ nhìn thấy "hầu hết người trong VisDrone nhỏ tới mức nào" trước khi chạy train.

**Lệnh chạy:**

```powershell
python ml\scripts\convert_visdrone_person.py `
  --visdrone ml\datasets\_raw\VisDrone2019-DET-train `
  --out ml\datasets\visdrone_person\train --verify-sample 20
python ml\scripts\convert_visdrone_person.py `
  --visdrone ml\datasets\_raw\VisDrone2019-DET-val `
  --out ml\datasets\visdrone_person\val
python ml\scripts\convert_visdrone_person.py `
  --visdrone ml\datasets\_raw\VisDrone2019-DET-test-dev `
  --out ml\datasets\visdrone_person\test
```

Rồi thêm `nc: 1` vào `ml/configs/visdrone_person.yaml` cho rõ ràng.

**Kết quả mong đợi.** Ba cặp `images/labels/meta` đầy đủ, `dataset_stats.json` có `instances_person > 0` cho cả ba split, và 20 ảnh trong `ml/results/convert_check/` có hộp **trùm lên người**.

**Nếu lỗi:**

- Hộp vẽ lên ô tô/xe máy: lệch-một. Đổi `--category-ids 0,1` và chạy lại — đừng sửa code trước khi thử cờ này.
- `instances_person` bằng 0: đang đọc nhầm thư mục (trỏ vào `images/` thay vì thư mục cha chứa cả `annotations/`).
- Số ảnh ra ít hơn hẳn 6.471: `--skip-empty` đang bật hoặc `--background-ratio 0` → nhiều ảnh VisDrone hoàn toàn không có người.
- `UnicodeDecodeError` khi đọc `.txt`: mở bằng `encoding="utf-8-sig"` (một số file có BOM).

---

### A1.4 Luật chia dữ liệu theo session

**Làm gì.** Nếu khung hình số 100 vào tập train và khung 101 (gần như giống hệt) vào tập test thì điểm số đẹp một cách vô nghĩa — model chỉ đang nhớ lại ảnh nó đã thấy. Hiện tượng này gọi là **rò rỉ dữ liệu** (data leakage), và nó là cách phổ biến nhất để một đồ án tự lừa chính mình.

Luật cứng của dự án, áp cho mọi dataset:

1. **VisDrone giữ nguyên split chính thức** (train 6.471 / val 548 / test-dev 1.610). Không chia lại. Các split này do ban tổ chức tách theo cảnh quay sẵn.
2. **Mọi dữ liệu trích từ video** (ảnh tự thu ở AI Phase 3, và bất cứ thứ gì qua `extract_frames.py`) **chia theo session/lượt bay, không bao giờ random theo khung.** Một session chỉ được nằm trong đúng một split.
3. **Tập test luôn là ảnh thật, chưa augment, chưa suy giảm nhân tạo.** Augment tập test là tự xoá bỏ khả năng đo độ bền trước suy giảm thật.
4. Tên file phải mang tên session: `<session_id>_<frame_index>.jpg` — đây là điều kiện để luật 2 kiểm chứng được bằng máy. Quy ước đặt tên `session_id` đầy đủ nằm ở **AI Phase 3 (A3.2)**; AI Phase 1 chỉ cần script tôn trọng tiền tố.

**Spec cho `ml/scripts/split_dataset.py`** (giữ nguyên các tham số đã có):

- Gom file theo tiền tố session (phần trước dấu `_` đầu tiên), hoặc theo thư mục cha nếu dữ liệu đã nằm trong `sessions/<id>/`.
- **Kiểm tra giao nhau: nếu một session xuất hiện ở hai split → `SystemExit` với thông báo rõ.** Không cảnh báo rồi chạy tiếp.
- Mặc định **copy** file, không symlink (symlink trên Windows cần quyền admin). Thêm `--dry-run` in ra bảng dự kiến mà không copy.
- Ghi `ml/results/split_manifest.json`: `{"train": {"sessions": [...], "n_images": N}, "val": {...}, "test": {...}, "created_at": ...}`.

`ml/tests/test_split_no_leak.py` kiểm: dựng 3 session giả bằng file rỗng trong `tmp_path`, chạy hàm chia, khẳng định (a) không có stem nào xuất hiện ở hai split, (b) đưa cùng một session vào cả train lẫn val thì hàm **phải** raise.

**Lệnh chạy (ở AI Phase 1 chỉ chạy thử trên dữ liệu giả; dữ liệu thật ở AI Phase 3):**

```powershell
python -m pytest ml\tests\test_split_no_leak.py -v
python ml\scripts\split_dataset.py --images ml\datasets\own_camera\sessions `
  --train s01,s02 --val s03 --test s04 --dry-run
```

**Kết quả mong đợi.** Test pass; `--dry-run` in bảng session → split mà không tạo file nào.

**Nếu lỗi:**

- `--dry-run` báo 0 ảnh: đúng, `own_camera/` đang trống ở AI Phase 1. Đủ để xác nhận script chạy.
- Test báo không raise khi trùng session: thiếu bước kiểm giao nhau — đây chính là lỗi test sinh ra để bắt.

---

### A1.5 Gói suy giảm ảnh `ml/degrade/`

**Làm gì.** Camera nhúng giá rẻ tạo ra ảnh xấu theo những cách có thể mô tả bằng toán: nén JPEG mạnh, nhoè do chuyển động, nhiễu cảm biến, tối góc ảnh, méo do kiểu đọc cảm biến. Mục tiêu của gói này là **áp cái xấu đó lên ảnh VisDrone vốn sạch**, để huấn luyện model quen với ảnh xấu **trước khi** có camera thật trong tay.

Thiết kế theo Real-ESRGAN: suy giảm **bậc hai** (second-order) — lặp hai vòng của (nhoè → hạ mẫu → nhiễu → nén JPEG), vì một ảnh thật đi qua chuỗi thu-nén-truyền-giải nén nhiều lần chứ không chỉ một. BSRGAN đóng góp ý tưởng thứ hai: **hoán vị ngẫu nhiên thứ tự** thay vì cố định.

**Điểm đề tài vượt lên trên hai bài báo đó:** Real-ESRGAN và BSRGAN phải *đoán* phân bố tham số vì họ không biết camera đích. Dự án này **đo được** tham số thật từ chính camera của mình (**AI Phase 3**, và là trục chính nếu chốt hướng A). Vì vậy **cấu trúc giữ nguyên, nhưng mọi phân bố tham số nằm trong một file YAML** để sau này thay số đoán bằng số đo mà không phải sửa một dòng code nào. Mỗi khối trong YAML mang cờ `measured: false` và trường `source` ghi rõ số này từ đâu ra.

**Cấu trúc gói:**

```text
ml/degrade/
├─ __init__.py     export: load_config(), degrade_image(), REGISTRY
├─ params.py       đọc YAML → dataclass; mỗi tham số là một phân bố, không phải một số
├─ custom.py       vignette_cos4(), rolling_shutter()  ← hai thứ albumentations KHÔNG có
└─ pipeline.py     ghép thứ tự, quản lý seed, cập nhật bbox
```

**Bảng phân công — cái gì có sẵn, cái gì phải tự viết:**

| Hiện tượng | Dùng gì | Ảnh hưởng bbox |
|---|---|---|
| Nén JPEG theo chất lượng q | `A.ImageCompression` | Không |
| Nhoè chuyển động | `A.MotionBlur` | Không |
| Nhoè lệch tiêu | `A.Defocus`, `A.GaussianBlur`, `A.AdvancedBlur` | Không |
| Nhiễu Gauss / shot / ISO | `A.GaussNoise`, `A.ShotNoise`, `A.ISONoise` | Không |
| Hạ rồi nâng độ phân giải | `A.Downscale` | Không (kích thước ảnh giữ nguyên) |
| Quang sai màu | `A.ChromaticAberration(mode="red_blue")` | Không |
| Thiếu sáng / gamma | `A.RandomGamma`, `A.RandomToneCurve` | Không |
| Lệch cân bằng trắng | `A.PlanckianJitter` (theo quỹ tích Planck, đúng vật lý hơn `ColorJitter`) | Không |
| **Vignetting (tối góc)** | **Tự viết `custom.vignette_cos4()`** | Không (thuần quang trắc) |
| **Rolling shutter** | **Tự viết `custom.rolling_shutter()`** | **CÓ — đây là cái bẫy** |

**Cái bẫy phải xử lý đúng.** Rolling shutter làm **biến dạng hình học**: mỗi hàng pixel bị dịch ngang một lượng khác nhau. Nếu áp phép biến đổi này mà **không cập nhật toạ độ bounding box** thì nhãn lệch khỏi vật thể — và **không có lỗi nào được in ra**. Cả tập dữ liệu hỏng trong im lặng. Vignetting thì ngược lại: chỉ làm tối, không dịch pixel, nên nhãn giữ nguyên.

Cách cập nhật bbox cho rolling shutter (ghi rõ vào docstring của hàm):

```text
Trường dịch chuyển: d(y) = A * sin(2*pi*f*y/H + phi)      (tần số thấp, trơn)
Áp lên ảnh bằng cv2.remap.
Với mỗi hộp [x1, y1, x2, y2]:
    shifts = [d(y) for y in range(y1, y2+1)]
    x1_moi = x1 + min(shifts)
    x2_moi = x2 + max(shifts)
    y giữ nguyên (chỉ dịch ngang)
    kẹp về biên ảnh; bỏ hộp nếu diện tích còn lại < 40% diện tích cũ
```

Lấy `min`/`max` trên toàn bộ các hàng mà hộp chiếm chỗ cho ra một hộp **bao trùm** — hơi rộng hơn vật thể một chút, nhưng **không bao giờ cắt mất một phần vật thể**. Đó đúng là điều kiện cần cho nhãn phát hiện đối tượng: thà hộp rộng hơn một chút, tuyệt đối không được hẹp hơn.

**`ml/configs/degrade_esp32.yaml`** — cấu trúc (mọi số hiện tại là **phỏng đoán, chưa xác minh**, chờ AI Phase 3 thay bằng số đo):

```yaml
version: 1
seed: 0
measured: false
source: "Phỏng đoán khởi đầu theo Real-ESRGAN/BSRGAN. CHƯA ĐO trên camera thật.
         AI Phase 3 (A3.7, nhánh A) thay bằng số đo MTF / (a,b) nhiễu Poisson-Gauss /
         hệ số méo, theo docs/bao-cao-tong-quan-du-an.md §5.1."

# Áp một lần, ở đầu chuỗi: đây là hiệu ứng lúc CHỤP, trước mọi khâu nén/truyền.
capture:
  rolling_shutter:
    p: 0.5
    amplitude_px: {dist: uniform, low: 0.0, high: 6.0}   # biên độ dịch ngang tối đa
    freq_cycles:  {dist: uniform, low: 0.5, high: 2.0}   # số chu kỳ trên chiều cao ảnh
    phase:        {dist: uniform, low: 0.0, high: 6.2832}
  vignette_cos4:
    p: 0.7
    strength: {dist: uniform, low: 0.15, high: 0.55}     # 0 = không tối góc, 1 = tối hẳn
  chromatic_aberration:
    p: 0.3
    shift_px: {dist: uniform, low: 0.5, high: 2.0}

# Vòng 1 và vòng 2 của suy giảm bậc hai (Real-ESRGAN).
rounds:
  - name: round1
    shuffle: false          # true = trộn thứ tự theo kiểu BSRGAN
    blur:
      p: 0.8
      kind: {dist: choice, values: [gauss_iso, gauss_aniso, motion], p: [0.4, 0.3, 0.3]}
      sigma:      {dist: uniform, low: 0.2, high: 2.0}
      motion_len: {dist: uniform, low: 3,   high: 11}
    resize:
      p: 1.0
      scale:  {dist: uniform, low: 0.45, high: 1.0}
      interp: {dist: choice, values: [nearest, bilinear, bicubic, area], p: [0.1, 0.4, 0.3, 0.2]}
    noise:
      p: 0.8
      kind:  {dist: choice, values: [gauss, shot, iso], p: [0.4, 0.3, 0.3]}
      sigma: {dist: uniform, low: 1.0, high: 12.0}
    jpeg:
      p: 1.0
      quality: {dist: uniform, low: 40, high: 90}   # thang OpenCV 0-100, CAO = ĐẸP
  - name: round2
    shuffle: true
    blur:   {p: 0.5, kind: {dist: choice, values: [gauss_iso, motion], p: [0.6, 0.4]},
             sigma: {dist: uniform, low: 0.2, high: 1.2}, motion_len: {dist: uniform, low: 3, high: 7}}
    resize: {p: 1.0, scale: {dist: uniform, low: 0.7, high: 1.0},
             interp: {dist: choice, values: [bilinear, bicubic, area], p: [0.4, 0.3, 0.3]}}
    noise:  {p: 0.5, kind: {dist: choice, values: [gauss, shot], p: [0.5, 0.5]},
             sigma: {dist: uniform, low: 1.0, high: 6.0}}
    jpeg:   {p: 1.0, quality: {dist: uniform, low: 25, high: 70}}

# Áp cuối cùng: trả về đúng kích thước ảnh gốc rồi nén một lần nữa (khâu truyền Wi-Fi).
final:
  restore_size: true
  jpeg:
    p: 1.0
    quality: {dist: uniform, low: 20, high: 60}
  low_light:
    p: 0.3
    gamma: {dist: uniform, low: 0.7, high: 1.6}
```

> **Ghi chú về thang chất lượng JPEG.** File YAML này dùng thang **OpenCV 0–100, số CAO = ảnh ĐẸP**. Camera ESP32 dùng thang **0–63, số THẤP = ảnh ĐẸP** — ngược nhau. Không trộn hai thang. Khi AI Phase 3 đưa phân bố `jpeg_quality` đo được từ log camera vào đây, phải chuyển thang trước và ghi rõ công thức chuyển trong `source`.

**Kiểm thử bắt buộc — `ml/tests/test_degrade_bbox.py`.** Đây là phần quan trọng nhất của việc A1.5, vì lỗi bbox không tự báo:

| Test | Kiểm gì |
|---|---|
| `test_vignette_khong_doi_bbox` | Áp `vignette_cos4`, khẳng định toạ độ hộp ra **bằng đúng** hộp vào |
| `test_rolling_shutter_hop_van_bao_tron_vat_the` | Dựng ảnh đen 480×640, vẽ một hình chữ nhật trắng ở vị trí biết trước. Áp `rolling_shutter`. Tìm lại toàn bộ pixel trắng bằng `np.nonzero`. Khẳng định **mọi pixel trắng đều nằm trong hộp trả về** (điều kiện bao trùm), và diện tích hộp trả về **không lớn hơn 1.8 lần** diện tích thật (điều kiện không quá lỏng) |
| `test_rolling_shutter_bien_do_0_la_khong_doi` | `amplitude_px = 0` → ảnh và hộp không đổi (kiểm biên) |
| `test_hop_ra_ngoai_bien_bi_bo` | Hộp sát mép, dịch mạnh → hộp bị bỏ chứ không trả về toạ độ âm |
| `test_pipeline_giu_nguyen_kich_thuoc` | Ảnh ra cùng `shape` với ảnh vào (vì `final.restore_size: true`) |
| `test_cung_seed_cho_cung_ket_qua` | Chạy hai lần với cùng seed → hai mảng byte **giống hệt**. Không tái lập được thì mọi thí nghiệm về sau vô nghĩa |
| `test_tat_het_stage_la_khong_doi` | Đặt mọi `p: 0` → ảnh ra gần như ảnh vào |
| `test_khong_augment_test_split` | Gọi pipeline với đường dẫn chứa `test` → raise. Mở rộng guard đã có trong `augment.py` |

**Quan trọng:** `ml/tests/` **không được import torch**. Chỉ numpy + opencv + albumentations. Như vậy CI (`phase-01`) chạy được bộ test này mà không phải cài 6 GB torch.

**Lệnh chạy:**

```powershell
python -m pytest ml\tests -v
python ml\scripts\make_degraded_dataset.py `
  --src ml\datasets\visdrone_person\val --out ml\datasets\visdrone_person_degraded\val `
  --config ml\configs\degrade_esp32.yaml --limit 30 --save-preview ml\results\degrade_preview
```

(Ở AI Phase 1 chỉ chạy `--limit 30` để xem thử. Sinh toàn bộ tập là việc của AI Phase 2.)

**Kết quả mong đợi.** Toàn bộ test pass. `ml/results/degrade_preview/` có 30 cặp ảnh trước–sau đặt cạnh nhau, và **nhìn bằng mắt thấy giống ảnh camera rẻ**: nhoè, nhiễu hạt, tối góc, vỡ khối JPEG.

**Nếu lỗi:**

- Test bao trùm thất bại: đang lấy `d(y)` ở tâm hộp thay vì `min`/`max` trên cả dải hàng. Sửa theo công thức trên.
- Ảnh xem thử trông **quá xấu** (không còn nhận ra người): giảm `high` của `noise.sigma` và nâng `low` của `jpeg.quality`. Suy giảm phải khó nhưng không được vô vọng.
- `AttributeError: module 'albumentations' has no attribute 'ShotNoise'`: cài nhầm bản cũ. Kiểm `albumentations.__version__` phải là `2.0.8`.
- Chạy rất chậm: `cv2.remap` trên ảnh 2000×1500 tốn thời gian. Thêm `--workers` dùng `multiprocessing` khi sinh cả tập ở AI Phase 2.

---

### A1.6 Script huấn luyện và đánh giá

**Làm gì.** Hai script này là công cụ đo của toàn bộ AI Phase 2, 3, 4. Chúng phải in ra những con số **đúng chỗ đề tài quan tâm**, không phải những con số dễ nhìn.

**Quy ước đặt tên run (chốt tại đây, các AI Phase sau dùng lại).** Docstring hiện tại của `train.py` mô tả thang "Model A..E", `docs/bao-cao-tong-quan-du-an.md` §6.2 mở rộng tới **A..G**, còn báo cáo nghiên cứu lại dùng "Thí nghiệm A..D" với nghĩa **hoàn toàn khác**. Ba cách đặt tên trùng chữ cái nhưng khác nghĩa — chắc chắn gây nhầm trong báo cáo. Chốt một hệ id không dùng chữ cái, kèm bảng ánh xạ:

| Run id | Nghĩa | Tương ứng §6.2 | Chạy ở đâu |
|---|---|---|---|
| — | YOLO11n/YOLO26n pretrained COCO, không tinh chỉnh | **A** | A2.1 (chỉ đánh giá, không train) |
| `r01_yolo11n_visdrone` | YOLO11n + VisDrone-person — bản đối chứng | **B** | A2.1 |
| `r02_yolo26n_visdrone` | YOLO26n, cùng cấu hình — dòng chính | **B** | A2.1 |
| `r03_yolo26n_visdrone_degraded` | YOLO26n, train trên VisDrone đã suy giảm | **D** (phần tổng hợp) | A2.2 |
| `r04_yolo26n_degraded_measured` | Như r03 nhưng tham số suy giảm là **số đo thật** | **D** (phần đo được) | AI Phase 3 |
| `r05_yolo26n_own` | Tinh chỉnh thêm trên ảnh tự thu | **C** | AI Phase 3 |
| *(không phải run train)* | + SAHI / + khôi phục / + hợp nhất đa khung | **E / F / G** | A2.3, A2.5, AI Phase 3 — đây là **cấu hình lúc suy luận**, không sinh checkpoint mới |

Docstring của `train.py` phải được viết lại theo bảng này. Ghi rõ điểm dễ nhầm: **E, F, G trong §6.2 không phải là model được huấn luyện lại** mà là các lớp thêm vào lúc suy luận — nên chúng không có run id.

**`train.py` — tham số đầy đủ:**

| Tham số | Mặc định | Ghi chú |
|---|---|---|
| `--data` | (bắt buộc) | file YAML dataset |
| `--model` | `yolo26n.pt` | đổi mặc định từ `yolo11n.pt`; vẫn truyền được `yolo11n.pt` |
| `--epochs` | `100` | — |
| `--imgsz` | `640` | **Không được hạ.** Người chỉ cao ~38 px ở 8 m (§3.7); xuống 320 còn ~19 px là mất mục tiêu. Thà giảm batch |
| `--batch` | `-1` | đổi từ `16`. `-1` = tự dò, nhắm ~60% VRAM |
| `--amp` / `--no-amp` | bật | giảm khoảng một nửa bộ nhớ. **Đừng tắt** |
| `--seed` | `0` | mới; bắt buộc để tái lập |
| `--deterministic` | bật | — |
| `--patience` | `30` | dừng sớm khi không cải thiện |
| `--optimizer` | `AdamW` | — |
| `--lr0` | `0.001` | — |
| `--device` | `0` | — |
| `--workers` | `8` | Ryzen 9 7945HX dư nhân; lỗi shared memory thì hạ xuống 4 |
| `--name` | (bắt buộc) | dùng run id ở bảng trên |
| `--project` | `ml/results` | giữ nguyên |
| `--resume` | tắt | — |

`train.py` phải ghi thêm, ngoài những gì Ultralytics tự ghi:

- `ml/results/<run>/train_args.json` — toàn bộ tham số đã dùng.
- `ml/results/<run>/env.json` — `torch.__version__`, `ultralytics.__version__`, tên GPU, phiên bản driver, **git SHA hiện tại**, đường dẫn tuyệt đối của file data YAML và **hash nội dung của nó**. Không có khối này thì sáu tháng sau không ai dựng lại được kết quả, và `ml/scripts/reproduce.ps1` của AI Phase 4 không có gì để bám vào.
- `ml/results/<run>/epoch_times.json` — `[{"epoch": 0, "seconds": 214.3}, ...]`. Nguồn số liệu cho việc A1.10 và cho mọi ước lượng lịch sau này.

**`evaluate.py` — phải in đủ bốn nhóm chỉ số:**

1. **Chỉ số Ultralytics**: precision, recall, mAP50, mAP50-95 (đã có trong hằng `METRICS`, giữ nguyên).
2. **Chỉ số COCO, trong đó có `AR-small`** — bổ sung quan trọng nhất. Ultralytics không trả về `AR-small` trực tiếp, nên cần `ml/scripts/coco_eval.py` làm ba bước: (a) chuyển nhãn YOLO của split đang đánh giá sang một file COCO ground-truth JSON, (b) chạy suy luận gom dự đoán thành COCO detections JSON, (c) gọi `pycocotools.cocoeval.COCOeval`. Bảng `COCOeval.stats` có 12 phần tử; cần nhớ vị trí:

   | Chỉ số | Vị trí | Nghĩa |
   |---|---|---|
   | AP@[.5:.95] | `stats[0]` | mAP50-95 |
   | AP@.5 | `stats[1]` | mAP50 |
   | AP small | `stats[3]` | vật thể diện tích < 32² px |
   | AP medium / large | `stats[4]` / `stats[5]` | — |
   | AR@100 | `stats[8]` | — |
   | **AR small** | **`stats[9]`** | **chỉ số trung tâm của đề tài** |
   | AR medium / large | `stats[10]` / `stats[11]` | — |

3. **Phân tầng theo kích thước.** Ngưỡng COCO (small < 32² px) quá thô cho bài toán này: ở VisDrone gần như **mọi người đều là "small"**, nên chỉ số đó bão hoà và không phân biệt được gì. Vì vậy thêm bốn rổ riêng theo **chiều cao hộp tính bằng pixel ở đúng `imgsz` đang đánh giá**: `<16`, `16–32`, `32–64`, `>64`. Mỗi rổ báo cáo số instance và recall. Đây là chỗ nhìn thấy được "khôi phục ảnh giúp ở cỡ nào" ở A2.5, và khớp trực tiếp với bảng độ cao ở §3.7 (8 m → ~38 px, 12 m → ~26 px, 15 m → ~21 px).
4. **Độ trễ.** Warmup 20 khung rồi đo 200 khung ở `batch=1`; tách `preprocess` / `inference` / `postprocess` (Ultralytics trả về trong `results[0].speed`); báo cáo mean, p50, p95 và fps. Ghi rõ backend (`pt` / `pt-half` / `onnx` / `engine`), thiết bị và `imgsz` — một con số fps không kèm ba thứ này là vô nghĩa.

**Schema `ml/results/<run>/metrics.json`** (các phase sau chỉ được **thêm** khoá, không đổi tên hay xoá khoá — đây là hợp đồng giữa AI Phase 1, 2, 3, 4):

```json
{
  "run": "r02_yolo26n_visdrone",
  "weights": "ml/results/r02_yolo26n_visdrone/weights/best.pt",
  "backend": "pt",
  "data": "ml/configs/visdrone_person.yaml",
  "split": "val",
  "imgsz": 640,
  "conf": 0.001,
  "iou": 0.7,
  "n_images": 548,
  "n_instances": 0,
  "ultralytics": {"precision": 0.0, "recall": 0.0, "mAP50": 0.0, "mAP50_95": 0.0},
  "coco": {"AP": 0.0, "AP50": 0.0, "AP75": 0.0,
           "AP_small": 0.0, "AP_medium": 0.0, "AP_large": 0.0,
           "AR_100": 0.0, "AR_small": 0.0, "AR_medium": 0.0, "AR_large": 0.0},
  "buckets_by_height_px": {
    "lt16":  {"n": 0, "recall": 0.0},
    "16_32": {"n": 0, "recall": 0.0},
    "32_64": {"n": 0, "recall": 0.0},
    "gt64":  {"n": 0, "recall": 0.0}
  },
  "latency_ms": {"preprocess": 0.0, "inference": 0.0, "postprocess": 0.0,
                 "total_mean": 0.0, "total_p50": 0.0, "total_p95": 0.0, "fps": 0.0},
  "env": {"torch": "", "ultralytics": "", "gpu": "", "driver": "", "git_sha": ""},
  "notes": ""
}
```

Giữ `--condition` đã có nhưng mở rộng tập giá trị: `normal`, `degraded_synth`, `blur`, `low_light`, `compression`. Và giữ nguyên nguyên tắc: **script từ chối chạy nếu đường dẫn dữ liệu đánh giá chứa dấu hiệu đã augment.**

**Lệnh chạy:**

```powershell
python ml\scripts\train.py --data ml\configs\visdrone_person.yaml `
  --model yolo26n.pt --epochs 1 --name smoke_yolo26n --seed 0
python ml\scripts\evaluate.py --weights ml\results\smoke_yolo26n\weights\best.pt `
  --data ml\configs\visdrone_person.yaml --split val --condition normal
```

**Kết quả mong đợi.** `metrics.json` tồn tại, có khoá `coco.AR_small` và `latency_ms.fps` với giá trị số (dù xấu — model mới train 1 epoch).

**Nếu lỗi:**

- `pycocotools` không cài được trên Windows (cần trình biên dịch C): dùng `pip install pycocotools-windows`, hoặc `uv pip install pycocotools --no-build-isolation` sau khi cài Build Tools. Nếu vẫn tắc: cài `faster-coco-eval` (API tương thích) và ghi lại sự thay thế này trong `env.json`.
- `AR_small` bằng `-1`: COCOeval trả `-1` khi **không có instance nào** rơi vào rổ đó. Kiểm lại định nghĩa diện tích trong file GT JSON (phải là diện tích **pixel ở kích thước ảnh gốc**, không phải toạ độ chuẩn hoá).
- fps đo được cao bất thường (>500): quên `torch.cuda.synchronize()` trước khi dừng đồng hồ → đang đo thời gian **xếp lệnh** chứ không phải thời gian chạy.

---

### A1.7 Label Studio và quy trình tiền-gán-nhãn

**Làm gì.** Ở AI Phase 3 sẽ có 1.500–2.500 ảnh tự chụp cần gán nhãn tay — rất tốn thời gian. AI Phase 1 dựng sẵn công cụ và **tập dượt toàn bộ quy trình trên 30–50 ảnh VisDrone**, để đến lúc có ảnh thật thì chỉ việc làm, không phải vừa làm vừa học.

Chọn **Label Studio tự host**. Lý do: dễ nhất cho một người dùng, xuất thẳng định dạng YOLO, và **không phụ thuộc cloud** — quan trọng vì dữ liệu sẽ có hình ảnh người thật. Không dùng Roboflow (cloud-first, đưa ảnh người lên dịch vụ bên thứ ba). CVAT chỉ đáng chọn nếu có nhiều người gán nhãn song song.

**Lệnh chạy (PowerShell):**

```powershell
# Cài vào env riêng của tool, KHÔNG vào ml\.venv (tránh đụng dependency với torch)
uv tool install label-studio

# Cho phép phục vụ ảnh từ ổ đĩa mà không phải upload từng file
$env:LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED = "true"
$env:LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT   = "D:\Coding\IOT-CV\ml\datasets"

label-studio start --data-dir D:\Coding\IOT-CV\ml\labeling\ls-data -p 8080
# Mở http://localhost:8080, tạo tài khoản cục bộ (email gì cũng được, chạy trên máy mình)
```

**`ml/labeling/label_config.xml`:**

```xml
<View>
  <Image name="image" value="$image" zoom="true" zoomControl="true"/>
  <RectangleLabels name="label" toName="image">
    <Label value="person" background="#FF0000"/>
  </RectangleLabels>
  <Choices name="pose" toName="image" choice="single" showInline="true">
    <Choice value="dung_di"/>
    <Choice value="ngoi"/>
    <Choice value="nam"/>
    <Choice value="khong_ro"/>
  </Choices>
  <Choices name="kho" toName="image" choice="multiple" showInline="true">
    <Choice value="mo"/>
    <Choice value="qua_nho"/>
    <Choice value="bi_che"/>
    <Choice value="thieu_sang"/>
  </Choices>
</View>
```

Trường `pose` phục vụ nhánh phân loại tư thế ở §5.5c (người **nằm** là dấu hiệu nạn nhân). Trường `kho` cho phép lọc ra "tập con khó" để báo cáo riêng ở AI Phase 4. Cả hai là tuỳ chọn khi gán — không bắt buộc điền.

**Quy trình tiền-gán-nhãn (pre-labelling) và bước kiểm tra thiên lệch.** Ý tưởng: dùng model đã train trên VisDrone chạy trước lên ảnh chưa gán nhãn, rồi người chỉ sửa. Tiết kiệm rất nhiều thời gian — nhưng **có một cái bẫy nghiêm trọng**: model sẽ bỏ sót đúng những trường hợp khó nhất, tức đúng những trường hợp đề tài quan tâm nhất. Người sửa nhãn nhìn vào màn hình đã có sẵn hộp thì mắt bị "mỏ neo": chỗ nào model không vẽ hộp thì rất dễ lướt qua. Kết quả: nhãn nhiễm thiên lệch của chính model, và **mọi số đo sau đó đều vô nghĩa**.

Quy trình bắt buộc, theo đúng thứ tự (AI Phase 3 thực hiện trên dữ liệu thật; AI Phase 1 chạy thử để chứng minh đường ống):

1. **Trước khi tiền-gán-nhãn**, rút ngẫu nhiên (có seed) **K = 100 ảnh** làm *tập kiểm thiên lệch*. Gán nhãn 100% bằng tay, **không cho model chạy trước, không nhìn output của model**.
2. Chạy model lên đúng 100 ảnh đó. So với nhãn tay: tính **tỉ lệ bỏ sót** (recall của bước tiền-gán-nhãn) và **tỉ lệ dương tính giả**, **phân tầng theo chiều cao hộp** (`<16`, `16–32`, `32–64`, `>64` px).
3. Ghi kết quả vào `ml/results/prelabel_bias.json`.
4. **Luật quyết định:** nếu recall của rổ `<16 px` dưới **0.5**, thì với toàn bộ phần còn lại của dataset, các hộp nhỏ **phải được rà bằng tay 100%** — tiền-gán-nhãn chỉ được dùng cho hộp lớn. Nếu recall tổng dưới 0.7, bỏ luôn bước tiền-gán-nhãn.
5. Chỉ sau khi có con số ở bước 3 mới chạy `prelabel_to_labelstudio.py` cho phần còn lại.

**`ml/scripts/prelabel_to_labelstudio.py`** chuyển dự đoán YOLO sang JSON nhập vào Label Studio. Lưu ý định dạng: Label Studio dùng **phần trăm 0–100** cho `x`, `y`, `width`, `height` (gốc ở góc trên-trái), không phải toạ độ chuẩn hoá 0–1 như YOLO. Nhầm chỗ này thì hộp nằm dồn ở góc trên-trái ảnh:

```text
x      = (x_center - w_norm/2) * 100
y      = (y_center - h_norm/2) * 100
width  =  w_norm * 100
height =  h_norm * 100
```

**Xuất.** Label Studio → Export → **YOLO** → file zip chứa `images/`, `labels/`, `classes.txt`. Giải nén vào `ml/datasets/own_camera/sessions/<session_id>/`. Kiểm `classes.txt` chỉ có đúng một dòng `person`.

**Kết quả mong đợi (ở AI Phase 1, chạy thử).** Mở được `localhost:8080`; nhập 30 ảnh VisDrone kèm dự đoán; sửa tay vài hộp; xuất ra YOLO và kiểm được rằng file `.txt` xuất ra khớp với nhãn gốc. `prelabel_bias.json` tồn tại.

**Nếu lỗi:**

- Ảnh không hiện, báo "Can't resolve URL": chưa đặt hai biến môi trường `LABEL_STUDIO_LOCAL_FILES_*`, hoặc đặt sau khi đã khởi động. Dừng, đặt lại, khởi động lại.
- Hộp tiền-gán-nhãn dồn ở góc trên-trái: dùng nhầm thang 0–1 thay vì 0–100.
- `uv tool install label-studio` thất bại vì xung đột phiên bản Python: dùng Docker thay thế — `docker run -it -p 8080:8080 -v D:\Coding\IOT-CV\ml\labeling\ls-data:/label-studio/data heartexlabs/label-studio:latest`.
- Cổng 8080 bận (backend FastAPI có thể đang dùng): đổi `-p 8081`.

---

### A1.8 DVC và remote Google Drive

**Làm gì.** Dataset sẽ lên tới 10–30 GB. GitHub cảnh báo ở 50 MB và **chặn push ở 100 MB mỗi file**; Git LFS gói miễn phí chỉ cho ~1–2 GB lưu trữ — không đủ. DVC giải quyết bằng cách: git giữ **file con trỏ** nhỏ (`.dvc`), còn dữ liệu thật nằm ở remote (Google Drive). Repo vẫn nhẹ, mà vẫn có phiên bản và rollback thật — khác hẳn cách đặt tên thư mục `dataset_v2_final_thuc_su_cuoi` (không diff được, không rollback được, và mục rữa trong im lặng).

Ngưỡng áp dụng: bật DVC khi một thư mục dữ liệu **vượt 1 GB**. `visdrone_person/` đạt ngưỡng ngay (~2 GB), nên làm luôn ở AI Phase 1.

**Lệnh chạy:**

```powershell
uv tool install "dvc[gdrive]"
dvc --version

dvc init
# Tạo một thư mục RIÊNG TƯ trên Google Drive, lấy folder-id từ thanh địa chỉ
# https://drive.google.com/drive/folders/<FOLDER_ID>
dvc remote add -d gdrive gdrive://<FOLDER_ID>

dvc add ml\datasets\visdrone_person
git add ml\datasets\visdrone_person.dvc ml\datasets\.gitignore .dvc\config .dvcignore
dvc push
```

**Sửa `.gitignore` — bắt buộc, nếu không con trỏ DVC không commit được.** Dòng 36 hiện là `ml/datasets/*`, nó nuốt luôn cả file `.dvc`. Thêm ngay dưới:

```gitignore
!ml/datasets/*.dvc
!ml/datasets/.gitignore
```

Kiểm bằng `git check-ignore -v ml/datasets/visdrone_person.dvc` — sau khi sửa, lệnh này phải **không in gì**.

**Những gì DVC theo dõi và không theo dõi:**

| Đường dẫn | DVC? | Lý do |
|---|---|---|
| `ml/datasets/visdrone_person/` | Có | >1 GB, tái tạo lại tốn ~1 giờ |
| `ml/datasets/own_camera/` | Có (AI Phase 3) | **Không thể tái tạo** — quay lại không bay được nữa. Quan trọng nhất |
| `ml/datasets/paired/` | Có (AI Phase 3) | như trên |
| `ml/datasets/_raw/` | Không | Tải lại được từ nguồn gốc; chỉ tốn chỗ trên Drive |
| `ml/datasets/visdrone_person_degraded/` | Không | Tái tạo được từ `visdrone_person` + YAML + seed. **Tính tái lập đến từ việc ghim seed, không từ việc lưu ảnh** |
| `ml/weights/*.pt` | Có, từ AI Phase 2 | File nhỏ (~5 MB) nhưng git đã ignore `*.pt`; DVC hoá weights cuối để báo cáo dựng lại được |
| `ml/weights/*.engine` | **Không bao giờ** | Gắn chặt với GPU và phiên bản driver của đúng máy này |

**Kết quả mong đợi.** `dvc push` chạy xong; `dvc status` in `Data and pipelines are up to date.`; `git status` thấy `ml/datasets/visdrone_person.dvc` sẵn sàng commit; xoá thư mục dữ liệu rồi `dvc pull` lấy lại được nguyên vẹn (**hãy thử thật một lần** — đây là bài kiểm tra duy nhất chứng minh sao lưu có tác dụng).

**Nếu lỗi:**

- Lần `dvc push` đầu mở trình duyệt xin quyền Google: bình thường, đăng nhập rồi cho phép.
- `Quota exceeded` hoặc `rate limit`: DVC dùng chung một OAuth client mặc định cho mọi người dùng nên hay bị giới hạn. Tạo OAuth client riêng trong Google Cloud Console rồi `dvc remote modify gdrive gdrive_client_id <id>` và `gdrive_client_secret <secret>`.
- Không thiết lập được Drive: dùng tạm remote cục bộ `dvc remote add -d local D:\dvc-store`. Có phiên bản hoá nhưng **không có bản sao ngoài máy**; ghi rõ hạn chế này và chuyển sang Drive khi xong.
- `dvc add` mất rất lâu: DVC tính hash toàn bộ 6.471 ảnh. Bình thường, vài phút.

---

### A1.9 Công cụ đọc MJPEG để thu dữ liệu (`ml/tools/mjpeg_client.py`)

> Phần thị giác đầy đủ của backend (parser multipart thủ công giữ khung mới nhất, proxy fan-out `GET /api/video/stream`, `detector.py`, `events.py`) **không còn thuộc AI Phase 1** — xem `plans/phase-07-backend-mission-proximity-safety.md` §7.8.2–§7.8.4 (parser + proxy + nguồn giả) và `docs/hop-dong-mjpeg.md` (hợp đồng header, SSOT do `phase-07` tạo). AI Phase 1 chỉ **trích dẫn** hợp đồng đó, không định nghĩa lại.

**Làm gì.** AI Phase 3 sẽ thu ảnh thật từ camera trên drone để làm dataset `own_camera/`. Việc đó cần một công cụ nhỏ, **độc lập với backend**, đọc luồng MJPEG và lưu từng khung ra `.jpg` — không cần chạy FastAPI, không cần `stream.py`. Viết `ml/tools/mjpeg_client.py`:

- `requests.get(url, stream=True, timeout=(3, 10))`, tự tách boundary theo header `Content-Type` của phản hồi (không hardcode), đọc đúng bốn header ở `docs/hop-dong-mjpeg.md`: `X-Frame-Id`, `X-Timestamp-Ms`, `X-Jpeg-Quality`, `X-Framesize` — so khớp tên **không phân biệt hoa/thường**; thiếu header nào thì trả `None` cho trường đó, không đoán.
- Tham số dòng lệnh: `--url`, `--out <thư mục>`, `--limit N` (dừng sau N khung, mặc định không giới hạn), `--every-ms` (chỉ lưu 1 khung mỗi khoảng đó, tránh ảnh gần giống hệt nhau khi thu tay).
- Mỗi khung lưu `<out>/<X-Frame-Id đệm 6 số>.jpg` + một dòng vào `<out>/manifest.jsonl`: `{"frame_id":, "timestamp_ms":, "jpeg_quality":, "framesize":, "path":}` — manifest này là đầu vào cho việc gán session ở AI Phase 3 (A3.2).
- Không cần "giữ khung mới nhất" như `stream.py` (đó là bài toán thời gian thực của web) — ở đây mục tiêu là **lưu hết**, nên đọc tuần tự, không chủ động rớt khung.

**Lệnh chạy:**

```powershell
python ml\tools\mjpeg_client.py --url http://127.0.0.1:8000/api/video/stream --out ml\results\mjpeg_client_smoke --limit 20
```

(Chỉ chạy được sau khi `phase-07` đã dựng xong `GET /api/video/stream` + `fake_stream.py`. Nếu `phase-07` chưa xong, hoãn bước nghiệm thu này lại — không tự dựng một server giả riêng ở đây, đó chính là trùng lặp SSOT mà bản kế hoạch trước đã mắc phải.)

**Kết quả mong đợi.** 20 file `.jpg` trong `ml/results/mjpeg_client_smoke/`, `manifest.jsonl` có 20 dòng, `frame_id` tăng dần không trùng.

**Nếu lỗi:**

- Không nối được `http://127.0.0.1:8000`: `phase-07` chưa chạy backend (`uv run uvicorn backend.app:app ...`) hoặc chưa bật nguồn giả.
- Cột `jpeg_quality`/`framesize` toàn `null` trong manifest: kiểm `phase-07` đã cài đúng `docs/hop-dong-mjpeg.md` chưa — không tự đoán giá trị ở công cụ này.
- Bộ đệm tăng dần (RAM lên liên tục): đang nối thêm vào `bytearray` mà không cắt bỏ phần đã dùng sau mỗi khung.

---

### A1.10 Chạy thử một epoch và đo để ngoại suy

**Làm gì.** Mọi ước lượng thời gian huấn luyện trong tài liệu đều là **ngoại suy, không phải đo đạc**. Báo cáo nghiên cứu nói thẳng điều đó. Cách duy nhất đáng tin: chạy đúng **một epoch**, đo thời gian thật, rồi nhân lên. Việc này quyết định lịch của cả AI Phase 2 — nếu một epoch mất 12 phút thì 100 epoch là 20 giờ, và kế hoạch chạy 4 run ở A2.1 phải viết lại.

**Lệnh chạy:**

```powershell
python ml\scripts\train.py --data ml\configs\visdrone_person.yaml `
  --model yolo26n.pt --epochs 1 --batch -1 --imgsz 640 --seed 0 --name smoke_yolo26n

python ml\scripts\train.py --data ml\configs\visdrone_person.yaml `
  --model yolo11n.pt --epochs 1 --batch -1 --imgsz 640 --seed 0 --name smoke_yolo11n

Get-Content ml\results\smoke_yolo26n\epoch_times.json
```

Ghi vào `ml/results/smoke_report.md`:

| Cần ghi | Ví dụ |
|---|---|
| Batch mà `--batch -1` chọn | `16` |
| VRAM đỉnh (`nvidia-smi` lúc đang chạy) | `6.8 / 8.0 GB` |
| Giây mỗi epoch, YOLO26n | — |
| Giây mỗi epoch, YOLO11n | — |
| Ngoại suy 100 epoch cho mỗi model | giây × 100 / 3600 |
| Ngoại suy tổng cho A2.1 + A2.2 (3 run) | — |
| Có chạy được 2 seed mỗi model không | có nếu tổng ≤ ~30 giờ |

**Ước lượng ban đầu, CHƯA XÁC MINH — ghi để đối chiếu, không dùng thay số đo:** ~6.5k ảnh, nano, imgsz 640, RTX 4060 Laptop → khoảng **3–8 phút/epoch**, tức **5–13 giờ cho 100 epoch**. Nếu số đo thật lệch xa khoảng này thì có gì đó sai (đang chạy CPU, đang đọc dữ liệu từ ổ chậm, hoặc `--workers` quá thấp) — dừng lại điều tra trước khi chạy tiếp.

Chạy luôn `evaluate.py` trên weights 1-epoch. **Điểm số sẽ rất tệ và đó là chuyện bình thường** — mục đích chỉ là chứng minh đường ống `metrics.json` chạy thông.

**Kết quả mong đợi.** `epoch_times.json` có số thật; `smoke_report.md` có bảng trên đã điền; `metrics.json` của run smoke tồn tại và có `coco.AR_small`.

**Nếu lỗi:**

- `CUDA out of memory` khi `--batch -1`: đặt tay `--batch 8`, nếu vẫn lỗi thì `4`. **Không hạ `imgsz`**.
- Một epoch mất >30 phút: kiểm `check_gpu.py` lại (có thể đang chạy CPU), kiểm dataset có nằm trên ổ SSD không, thử `--workers 4`.
- Ultralytics tải `yolo26n.pt` về nhầm chỗ: đặt lại `yolo settings weights_dir=...` ở việc A1.3.
- Chạy được nhưng `mAP50 = 0`: khả năng cao là nhãn sai — quay lại việc A1.3, mở `ml/results/convert_check/` ra xem.

---

## Cổng pass

- [ ] `python ml\scripts\check_gpu.py` thoát mã 0, in `2.14.0+cu130` và `NVIDIA GeForce RTX 4060 Laptop GPU`, và phép nhân ma trận trên GPU chạy xong.
- [ ] `ml/pyproject.toml` ghim `albumentations==2.0.8` và `opencv-python>=4.10,<5`; `ml/.venv` là Python **3.11**, tách khỏi `.venv` của backend (cùng phiên bản, khác dự án `uv`).
- [ ] `ml/results/dataset_stats.json` tồn tại, `instances_person > 0` cho cả ba split, và **20 ảnh trong `ml/results/convert_check/` có hộp trùm lên người** (kiểm bằng mắt, ghi lại trong `smoke_report.md`).
- [ ] `ml/data/README.md` nằm trong git và ghi đủ giấy phép của VisDrone (không có LICENSE), HERIDAL (CC BY), albumentations (MIT, lý do ghim).
- [ ] `python -m pytest ml\tests -v` toàn bộ pass, **trong đó có test bao trùm bbox của rolling shutter**, và bộ test này **không import torch**.
- [ ] `ml/results/degrade_preview/` có ≥ 30 cặp ảnh trước–sau, nhìn thấy rõ ảnh sau giống ảnh camera rẻ.
- [ ] `split_dataset.py --dry-run` chạy được và `test_split_no_leak.py` chứng minh trùng session thì **raise**.
- [ ] Một epoch huấn luyện chạy xong cho cả `yolo26n` và `yolo11n`; `epoch_times.json` có số thật; `smoke_report.md` đã điền bảng ngoại suy.
- [ ] `metrics.json` của run smoke có khoá `coco.AR_small`, `buckets_by_height_px` và `latency_ms.fps` với giá trị số.
- [ ] Label Studio mở được ở `localhost:8080`, nhập 30 ảnh có tiền-gán-nhãn, sửa được, xuất ra YOLO đúng định dạng; `prelabel_bias.json` tồn tại.
- [ ] `dvc status` in `up to date`; `ml/datasets/visdrone_person.dvc` **commit được** (`git check-ignore -v` không in gì); đã thử xoá thư mục và `dvc pull` lấy lại thành công.
- [ ] `ml/tools/mjpeg_client.py --limit 20` (chạy sau khi `phase-07` dựng xong `GET /api/video/stream`) lưu đúng 20 `.jpg` + `manifest.jsonl` 20 dòng, `frame_id` tăng dần không trùng.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Cài nhầm torch CPU (pip kéo bản CPU theo ultralytics), train chậm 30× mà **không báo lỗi** | 4 | 4 | **16** | Cài torch **trước** bằng `--index-url cu130`; `check_gpu.py` thoát mã 1 và là cổng vào mọi việc sau |
| Tiền-gán-nhãn làm nhãn nhiễm thiên lệch của model, mọi kết quả sau đó vô nghĩa | 4 | 4 | **16** | Tập kiểm thiên lệch 100 ảnh gán tay hoàn toàn **trước** khi tiền-gán-nhãn; luật quyết định ở A1.7 bước 4 |
| Lệch-một khi lọc category VisDrone (thang thô `1,2` vs thang YAML `0,1`) → toàn bộ nhãn sai | 3 | 5 | **15** | Cờ `--category-ids` sửa được không cần đổi code; in histogram category; `--verify-sample 20` vẽ hộp để mắt người duyệt |
| Rolling shutter không cập nhật bbox → hỏng cả tập, **không có lỗi nào được in** | 3 | 5 | **15** | Test bao trùm bbox là cổng pass bắt buộc; hàm trả hộp bao trùm (min/max trên dải hàng), không phải hộp tâm |
| Tập test bị augment nhầm → mất khả năng đo độ bền | 2 | 5 | **10** | Giữ guard đường dẫn đã có trong `augment.py`, nhân bản sang `ml/degrade` và `evaluate.py`; có test riêng |
| Xoá sạch ảnh nền → rất nhiều dương tính giả khi bay trên cỏ/bê tông | 3 | 3 | **9** | `--background-ratio 0.10` mặc định; ghi số ảnh nền giữ lại vào `dataset_stats.json` |
| `ml/tools/mjpeg_client.py` giả định sai hợp đồng header vì `phase-07` đổi `docs/hop-dong-mjpeg.md` sau khi AI Phase 1 đã viết công cụ | 2 | 2 | **4** | `mjpeg_client.py` chỉ đọc, không hardcode boundary/tên header ngoài bốn cái đã chốt trong `docs/hop-dong-mjpeg.md`; hợp đồng đổi thì sửa lại công cụ, không tự định nghĩa hợp đồng riêng |
| DVC + Google Drive vướng OAuth/quota | 3 | 2 | **6** | Tự tạo OAuth client riêng; dự phòng remote cục bộ `D:\dvc-store` và ghi rõ hạn chế |
| `CUDA out of memory` trên 8 GB | 3 | 2 | **6** | `--batch -1` → 8 → 4. **Không hạ `imgsz`** |
| Ổ D: đầy (torch + dataset + bản suy giảm ~25–35 GB) | 2 | 3 | **6** | Đo `Get-PSDrive D` trước khi bắt đầu; `_raw/` xoá được bất cứ lúc nào; bản suy giảm không DVC hoá |
| `albumentations 2.0.8` xung đột numpy/pydantic với gói khác | 2 | 3 | **6** | Ghim `numpy<3`; env ML tách riêng; Label Studio và DVC ở env tool riêng |
| `pycocotools` không build được trên Windows | 3 | 2 | **6** | `pycocotools-windows`, hoặc `faster-coco-eval` thay thế; ghi lại sự thay thế vào `env.json` |
## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| A1.1 Môi trường ML + torch cu130 + `check_gpu.py` | 2.5 | Phần lớn là chờ tải ~4 GB |
| A1.2 Bố cục thư mục + `ml/data/README.md` giấy phép | 1.5 | |
| A1.3 Tải VisDrone + viết `convert_visdrone_person.py` | 4.0 | Gồm 1 giờ chờ tải + kiểm bằng mắt 20 ảnh |
| A1.4 Luật chia theo session + `split_dataset.py` + test | 1.5 | Chạy thật ở AI Phase 3 |
| A1.5 Gói `ml/degrade/` + YAML + 8 test | 8.0 | **Việc lớn nhất.** Rolling shutter + cập nhật bbox chiếm quá nửa |
| A1.6 `train.py` + `evaluate.py` + `coco_eval.py` | 5.0 | `AR-small` qua COCOeval là phần dễ sai nhất |
| A1.7 Label Studio + tiền-gán-nhãn + kiểm thiên lệch | 3.0 | Chạy thử trên 30 ảnh; dùng thật ở AI Phase 3 |
| A1.8 DVC + remote Drive + sửa `.gitignore` | 2.0 | Gồm một lần thử `dvc pull` để xác nhận |
| A1.9 Công cụ đọc MJPEG để thu dữ liệu (`ml/tools/mjpeg_client.py`) | 1.5 | Phần thị giác đầy đủ (parser + proxy + nguồn giả) đã chuyển sang `phase-07` |
| A1.10 Chạy thử 1 epoch + ghi ngoại suy | 1.5 | Thêm ~0.5 h GPU chạy |
| **Tổng** | **30,5** | ≈ 4–6 buổi làm. Thêm ~1 giờ GPU chạy nền |

Đường găng: A1.1 → A1.3 → A1.6 → A1.10 (không có A1.10 thì không lên lịch được AI Phase 2). Các việc A1.5, A1.7, A1.8, A1.9 **độc lập nhau** — làm song song được nếu có nhiều phiên.

## Ghi chú cho sổ tay

Những khái niệm phase này cần giải thích cho người chưa biết gì (để agent viết `docs/so-tay/ai-01-chuan-bi.md` sau):

**Về môi trường**

- *Virtual environment (venv)* — một "hộp" chứa riêng các thư viện Python của một dự án, để dự án này không phá dự án kia. Vì sao ML cần hộp riêng: torch nặng 6 GB và backend không cần nó.
- *Driver / CUDA runtime / wheel* — ba tầng khác nhau. Driver điều khiển card, do NVIDIA cài. CUDA runtime là thư viện tính toán, **đi kèm trong wheel torch** nên không cần cài riêng. Wheel là gói cài sẵn của Python. "Tương thích tiến" nghĩa là driver mới chạy được runtime cũ, nên driver 610.x chạy được `cu130`.
- *Vì sao thứ tự cài quan trọng* — pip cài cái nào trước thì cái đó quyết định phiên bản; cài `ultralytics` trước là mời nó kéo torch CPU về.

**Về dữ liệu và nhãn**

- *Bounding box* — hộp chữ nhật bao quanh vật thể. Định dạng YOLO: `class x_center y_center width height`, **mọi số đã chia cho kích thước ảnh nên nằm trong 0–1**, gốc toạ độ ở góc trên-trái.
- *Vì sao VisDrone tách `pedestrian` và `people`* và vì sao dự án này **gộp cả hai** — người nằm là dấu hiệu nạn nhân.
- *`score == 0` trong file nhãn VisDrone không phải độ tin cậy* mà là "vùng cần bỏ qua". Điểm cực dễ hiểu sai.
- *Ảnh nền (negative sample)* — ảnh không có vật thể nào. Giữ chúng lại để model học cách **không** vẽ hộp lên bãi cỏ.
- *Data leakage (rò rỉ dữ liệu)* — khi tập test chứa thứ gần giống tập train, điểm số đẹp giả. Ví dụ đời thường: ôn đúng đề thi rồi tự khen mình giỏi.
- *Session-based split* — chia theo lượt quay/lượt bay thay vì chia theo từng ảnh.

**Về huấn luyện**

- *Epoch / batch / learning rate / seed* bằng lời thường: epoch = học hết một lượt toàn bộ ảnh; batch = mỗi lần đưa vào bao nhiêu ảnh; learning rate = bước chân mỗi lần sửa; seed = con số làm mọi chỗ ngẫu nhiên lặp lại y hệt.
- *AMP (mixed precision)* — dùng số thực 16 bit thay vì 32 bit ở những chỗ chịu được, tiết kiệm khoảng một nửa bộ nhớ.
- *VRAM và vì sao 8 GB là ràng buộc* — bộ nhớ activation tăng gần **bậc hai** theo `imgsz`; nhưng hạ `imgsz` ở đề tài này là tự bắn vào chân vì người chỉ cao ~38 px ở 8 m.

**Về đánh giá**

- *Precision và recall* bằng ví dụ: precision = "trong những chỗ tôi bảo có người, bao nhiêu phần trăm đúng"; recall = "trong tất cả người thật sự có, tôi tìm ra bao nhiêu phần trăm".
- *IoU* — mức trùm nhau giữa hộp đoán và hộp thật.
- *mAP50 và mAP50-95* — mAP50 dễ hơn (chỉ cần trùm 50%), mAP50-95 khắt khe hơn.
- *AR-small và vì sao nó là chỉ số trung tâm* — mAP tổng hợp che mất đúng thứ đề tài quan tâm: người cao 21–38 px. Một model có thể có mAP đẹp nhờ bắt tốt người ở gần mà vẫn mù hoàn toàn với người ở xa.
- *Ngưỡng kích thước COCO (32²/96² px)* và vì sao dự án phải thêm bốn rổ riêng theo chiều cao pixel.
- **Kỳ vọng trung thực:** model nano chạy toàn khung trên VisDrone chỉ đạt mAP50 ≈ **22% cho `pedestrian`** và ≈ **12% cho `people`**. Đây là hai lớp khó nhất trong bộ dữ liệu. **Tuyệt đối không viết "độ chính xác 95%"** trong bất kỳ báo cáo nào.

**Về suy giảm ảnh**

- *Degradation / domain gap* — ảnh huấn luyện sạch, ảnh thật xấu; khoảng cách giữa hai thứ đó làm model tụt điểm.
- *Suy giảm bậc hai (second-order)* — lặp hai vòng nhoè/hạ-mẫu/nhiễu/nén, vì ảnh thật đi qua chuỗi thu-nén-truyền nhiều lần.
- *Rolling shutter* — cảm biến rẻ đọc ảnh **theo từng hàng chứ không chụp cả khung cùng lúc**, nên vật đang di chuyển bị nghiêng. Ví dụ đời thường: chụp cánh quạt đang quay bằng điện thoại thấy cánh bị cong.
- *Vignetting* — bốn góc ảnh tối hơn tâm, do ống kính. Mô hình `cos⁴`.
- *Vì sao phép biến đổi hình học phải cập nhật bbox còn phép quang trắc thì không.*
- *Thang `jpeg_quality` của ESP32 đi ngược trực giác* (0–63, **nhỏ = đẹp**) trong khi OpenCV là 0–100, cao = đẹp.

**Về công cụ**

- *MJPEG và multipart* — hình dung một xấp ảnh gửi qua bưu điện, mỗi ảnh kẹp giữa hai tờ giấy đánh dấu.
- *Vì sao phải tự viết parser thay vì dùng `cv2.VideoCapture`* — trễ tích luỹ và không đọc được header.
- *Mẫu "giữ khung mới nhất"* — thà vứt ảnh cũ còn hơn xem ảnh của 3 giây trước.
- *DVC* — như git nhưng cho file to: git giữ tờ giấy ghi "hộp số 7", còn hộp thật nằm ở kho (Google Drive).
- *Vì sao GitHub không chứa nổi dataset* (chặn ở 100 MB mỗi file).
- *Thiên lệch của tiền-gán-nhãn* — nếu để máy vẽ hộp trước rồi người chỉ sửa, người sẽ bỏ sót đúng những chỗ máy bỏ sót.

**Về giấy phép**

- Vì sao VisDrone **không có file LICENSE** lại là chuyện phải ghi rõ trong báo cáo thay vì lờ đi.
- CC BY (phải ghi công) vs CC BY-NC (cấm thương mại) vs MIT vs AGPL — bốn loại sẽ gặp trong dự án này.
- Vì sao ảnh có người thật không được đẩy lên dịch vụ cloud công cộng.
