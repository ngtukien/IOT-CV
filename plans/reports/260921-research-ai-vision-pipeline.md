# Nghiên cứu pipeline AI thị giác — phát hiện người từ UAV bằng camera nhúng giá rẻ

> Báo cáo khảo sát, ngày 2026-09-21. Mọi URL đã kiểm tra truy cập được (WebFetch) trừ những mục ghi
> rõ trong phần **URL chưa kiểm chứng** ở cuối. Báo cáo này **bổ sung** cho
> `docs/bao-cao-tong-quan-du-an.md`, không thay thế: mục tiêu là chốt phiên bản/lệnh cụ thể của năm
> 2026 và **hiệu chỉnh vài con số đang bị lạc quan** trong tài liệu đó.

## TL;DR — tám quyết định

| # | Vấn đề | Chốt |
|---|---|---|
| 1 | Model | **YOLO26n** làm dòng chính (có **STAL** cho vật thể nhỏ), giữ **YOLO11n** làm đối chứng |
| 2 | Torch | `--index-url .../whl/cu130` — `cu128` **đã dừng ở torch 2.11**, không còn 2.14 |
| 3 | Kỳ vọng mAP | VisDrone `pedestrian` mAP50 ≈ **22%** với nano@640. **Không phải 90%** |
| 4 | Dataset | VisDrone-person là chính (lấy **cả** `pedestrian` **và** `people`); HERIDAL phụ; **loại UAVDT** (không có lớp người) |
| 5 | Augment | `albumentations` **đã ngừng bảo trì** — ghim `2.0.8`. Rolling shutter + vignette phải **tự viết** |
| 6 | Camera | **Giữ ESP32-CAM** — ảnh xấu là đối tượng nghiên cứu. Nhưng **"bản IPEX" không phải SKU riêng** |
| 7 | Suy luận | Camera chỉ cho **14.19 fps** ⇒ GPU **dư 5–14 lần** ⇒ đổ compute vào SAHI + khôi phục |
| 9 | **Đề tài XLA** | "Phát hiện người" quá yếu làm câu hỏi nghiên cứu — **4 hướng thay thế ở mục 3.7**, khuyến nghị hướng **B** |
| 8 | Dữ liệu | Label Studio tự host + **DVC remote Google Drive** (git-LFS gói free không đủ) |

**Ba điểm cần sửa trong `docs/bao-cao-tong-quan-du-an.md`:** fps VGA `15–25` → **14.19** (kết luận
không đổi, vẫn dư biên ~6×) · rủi ro #3 về "bản IPEX" mô tả sai cơ chế (mục 4.3) · trích dẫn SAHI
6.8%/12.7% **đúng** nhưng phải ghi rõ đó là của detector **FCOS**, không phải YOLO (mục 5.3).

---

## 1. YOLO và môi trường huấn luyện (2026)

### 1.1. Phiên bản hiện hành

- **ultralytics `8.4.157`** (PyPI, 2026-09-20).
- Các họ model được hỗ trợ: **YOLO26** (mới nhất, phát hành **tháng 1/2026**), YOLO11, YOLO12,
  YOLOv10/v9/v8, RT-DETR, YOLO-World, YOLOE, SAM. YOLO27 đang phát triển, chưa phát hành.

### 1.2. Chọn biến thể nào — số liệu COCO đã kiểm chứng

| Model | mAP50-95 | Params (M) | FLOPs (B) | CPU ONNX (ms) | T4 TensorRT (ms) |
|---|---|---|---|---|---|
| **YOLO26n** | **40.9** | **2.4** | **5.5** | **38.9** | 1.7 |
| YOLO11n | 39.5 | 2.6 | 6.5 | 56.1 | **1.5** |
| YOLO26s | 48.6 | 9.5 | 20.9 | 87.2 | 2.5 |
| YOLO11s | 47.0 | 9.4 | 21.6 | 90.0 | 2.5 |

**Khuyến nghị: YOLO26n.** Ba lý do kỹ thuật, không phải "vì nó mới":

1. **STAL — Small-Target-Aware Label Assignment.** YOLO26 thêm đúng cơ chế gán nhãn giữ được
   *positive label coverage* cho vật thể nhỏ. Bài toán của nhóm là người cao ~38 px ở độ cao 8 m —
   chính là trường hợp STAL được thiết kế để xử lý. Đây là lý do mạnh nhất để đổi.
2. **Cao hơn YOLO11n 1.4 điểm mAP với ÍT hơn 0.2M tham số và 1.0 GFLOP** — tốt hơn ở cả hai chiều.
3. **Bỏ DFL + suy luận end-to-end không cần NMS** (`nms=False`) — đầu ra đơn giản hơn khi xuất sang
   ONNX/TensorRT cho khâu triển khai.

**Nhưng giữ YOLO11n làm Model A / đối chứng.** Toàn bộ `docs/bao-cao-tong-quan-du-an.md` và
`ml/scripts/train.py` đang viết quanh YOLO11n, và YOLO11n có nhiều số liệu VisDrone công bố hơn để
đối chiếu (mục 1.4). Chạy cả hai ở cấu hình y hệt là một bảng ablation gần như miễn phí cho báo cáo.

> **Lưu ý ngược — phải ghi trung thực:** trên T4 TensorRT, YOLO26n *chậm hơn* YOLO11n (1.7 vs
> 1.5 ms). Đầu one-to-one end-to-end có chi phí riêng. Ở đề tài này tốc độ không phải nút thắt
> (camera chỉ cho ~14 fps — mục 4), nên đánh đổi chấp nhận được. Đừng viết rằng YOLO26 "nhanh hơn
> mọi mặt".

### 1.3. Cấu hình huấn luyện cho 8GB VRAM

Ultralytics mặc định giả định card ≥16GB. Trên RTX 4060 Laptop 8GB ở `imgsz=640`:

```powershell
yolo detect train data=ml/configs/visdrone_person.yaml model=yolo26n.pt `
  epochs=100 imgsz=640 batch=-1 amp=True patience=30 optimizer=AdamW lr0=0.001
```

- `batch=-1` bật auto-batch (nhắm ~60% VRAM). Nếu vẫn OOM: đặt tay `batch=8`, rồi `4`.
- `amp=True` (mặc định) giảm khoảng một nửa bộ nhớ — **đừng tắt**.
- Bộ nhớ activation tăng gần **bậc hai** theo `imgsz`: 640 → 480 giảm ~44%; 640 → 320 giảm ~75%.
  **Nhưng không được hạ `imgsz` ở đề tài này**: người chỉ chiếm ~38 px ở 640; xuống 320 còn ~19 px
  là mất mục tiêu. Thà giảm batch còn hơn giảm imgsz.
- Giữ **nguyên `imgsz`, tập test và ngưỡng confidence** giữa mọi model A→G, đúng như `train.py` đã ghi.

**Ước lượng thời gian huấn luyện — ESTIMATE, không có benchmark trực tiếp cho cấu hình này:**
~6.5k ảnh VisDrone-person, 100 epoch, imgsz 640, model nano trên RTX 4060 Laptop → ước **5–9 giờ**;
với 15k ảnh → **12–24 giờ**. Ngoại suy từ throughput huấn luyện 15–35 ảnh/giây của model nano. Phụ
thuộc mạnh vào batch, số dataloader worker và tốc độ đĩa. **Hãy đo thật 1 epoch rồi nhân lên** thay
vì tin ước lượng này.

### 1.4. Kỳ vọng mAP thực tế trên VisDrone — phần quan trọng nhất của mục này

Số liệu từ bài CF-YOLO (*Scientific Reports*), dùng chính VisDrone, imgsz 640, 300 epoch, SGD, batch 8:

| Chỉ số | YOLOv11n (baseline) | CF-YOLO (cải tiến) |
|---|---|---|
| mAP50, toàn bộ 10 lớp | **32.2%** | 44.9% |
| mAP50-95, toàn bộ | **18.6%** | 27.5% |
| **mAP50 lớp `pedestrian`** | **21.9%** | 34.1% |
| **mAP50 lớp `people`** | **11.7%** | 21.4% |

**Đọc bảng này cho đúng — đây là phần dễ gây vỡ kỳ vọng nhất của cả đồ án:**

- Một model nano chạy toàn khung 640 trên VisDrone chỉ đạt **mAP50 ≈ 22% cho `pedestrian` và ≈ 12%
  cho `people`**. Đây là hai lớp **khó nhất** trong VisDrone vì nhỏ nhất.
- Vì vậy **tuyệt đối không viết "độ chính xác 95%"** trong báo cáo. Mục 6.5 của tài liệu tổng quan
  đã cảnh báo đúng điều này; bảng trên là bằng chứng định lượng cho cảnh báo đó.
- Lọc còn **một lớp `person` duy nhất** thường **nâng** con số so với bảng trên (bớt nhầm lẫn giữa
  `pedestrian`/`people`, bớt cạnh tranh với 8 lớp phương tiện), nhưng mục tiêu thực tế cho Model B
  nên đặt ở khoảng **mAP50 30–45%**, không phải 80%+.
- Đây chính là lý do **SAHI trở thành bắt buộc chứ không phải tùy chọn**: khoảng cách giữa 22% và
  một con số dùng được nằm ở kỹ thuật cắt lát, không nằm ở việc đổi model.

### 1.5. Cài PyTorch + CUDA trên Windows (driver 610.x)

**Tình hình wheel đã đổi trong 2026 — đừng dùng lệnh `cu121`/`cu118` cũ.** Kiểm tra trực tiếp chỉ
mục wheel của PyTorch:

| Chỉ mục | Bản torch cao nhất |
|---|---|
| `whl/cu128/` | **2.11.0** — đã dừng, không còn 2.14 |
| `whl/cu129/` | 2.9.0 — nhánh đã bị thay thế |
| **`whl/cu130/`** | **2.14.0+cu130**, có `win_amd64`, Python 3.10–3.15 |

PyTorch đã chuyển wheel CUDA ổn định trên PyPI sang **CUDA 13.0** kể từ bản 2.11.

**Lệnh cài đúng:**

```powershell
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130
```

Driver 610.x mới hơn runtime CUDA 13.0 mà wheel mang theo. CUDA có **tương thích tiến** với driver
mới hơn, nên `cu130` là lựa chọn an toàn. **Không cần cài CUDA Toolkit riêng** — wheel đã đóng gói
runtime.

**Thứ tự cài khuyến nghị** (cài torch TRƯỚC, nếu không pip kéo bản CPU về rồi `ultralytics` chạy
bằng CPU mà không báo lỗi gì):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu130
pip install ultralytics
```

**Kiểm tra GPU:**

```python
import torch
print(torch.__version__)              # kỳ vọng: 2.14.0+cu130
print(torch.cuda.is_available())      # kỳ vọng: True
print(torch.cuda.get_device_name(0))  # kỳ vọng: NVIDIA GeForce RTX 4060 Laptop GPU
print(torch.cuda.get_device_properties(0).total_memory / 1e9)  # ~8.0
```

```powershell
nvidia-smi
```

> **Cảnh báo về nguồn:** trang `pytorch.org/get-started/locally/` trả về nội dung cũ khi fetch tự
> động (hiện PyTorch 1.13 / CUDA 11.8) vì bộ chọn phiên bản render bằng JavaScript. **Đừng lấy số
> phiên bản từ trang đó.** Nguồn đáng tin là chỉ mục wheel `download.pytorch.org/whl/cu130/torch/`
> và blog phát hành 2.14 — cả hai đã kiểm chứng và khớp nhau.

---

## 2. Dữ liệu

### 2.1. VisDrone2019-DET — nguồn tải và giấy phép

Repo chính thức: `github.com/VisDrone/VisDrone-Dataset` (AISKYEYE, Đại học Thiên Tân).

| Tập | Dung lượng | Số ảnh |
|---|---|---|
| Train | 1.44 GB | 6,471 |
| Val | 0.07 GB | 548 |
| Test-dev (có nhãn) | 0.28 GB | 1,610 |
| Test-challenge (không nhãn) | 0.28 GB | — |

Link Google Drive + Baidu nằm trong README của repo. **Đường tắt khuyến nghị:** để Ultralytics tự
tải và tự chuyển đổi qua `VisDrone.yaml` — nó tải zip, giải nén và chạy sẵn hàm `visdrone2yolo()`.

> **Giấy phép — cần ghi trung thực:** repo VisDrone **không có file LICENSE**, và trang dataset của
> Ultralytics hiển thị badge "No license". VisDrone là benchmark học thuật lâu đời (workshop
> ICCV/ECCV) và theo thông lệ được dùng tự do cho nghiên cứu, **nhưng không có văn bản cho phép phát
> hành lại**. Với đồ án sinh viên thì không vấn đề: trích dẫn bài báo gốc, **không đăng lại ảnh thô**,
> không giả định quyền dùng thương mại. Nên ghi rõ sự mơ hồ này trong phần giấy phép của báo cáo.

### 2.2. Lớp và định dạng nhãn

10 lớp (đã kiểm chứng trong `ultralytics/cfg/datasets/VisDrone.yaml`):

```
0: pedestrian   1: people   2: bicycle   3: car   4: van
5: truck   6: tricycle   7: awning-tricycle   8: bus   9: motor
```

- `pedestrian` (0) = người **đứng / đi**; `people` (1) = người ở **tư thế khác** (ngồi, nằm, đang
  đi xe, trong đám đông).
- **Muốn có lớp `person` gộp thì phải lấy CẢ id 0 và id 1.** Chỉ lấy `pedestrian` là mất toàn bộ
  người ngồi và người nằm — mà **người nằm bất động chính là dấu hiệu nạn nhân** trong kịch bản tìm
  kiếm cứu nạn của đề tài (mục 5.5c tài liệu tổng quan). Đây là lỗi dễ mắc nhất khi lọc dataset.

Mỗi dòng nhãn thô VisDrone:

```
<bbox_left>,<bbox_top>,<bbox_width>,<bbox_height>,<score>,<object_category>,<truncation>,<occlusion>
```

- Toạ độ là **pixel tuyệt đối**, góc trên-trái + rộng/cao.
- `score` trong file ground-truth **KHÔNG phải độ tin cậy**: `0` = vùng phải **bỏ qua**, `1` = đối
  tượng hợp lệ. Phải lọc bỏ mọi dòng `score == 0`.
- `object_category` trong file thô dùng đánh số có thêm `0 = ignored-regions` và `11 = others`;
  lớp 0–9 trong YAML Ultralytics là bản **đã ánh xạ lại**. Luôn kiểm tra lệch-một trên chính bản sao
  của mình trước khi tin.
- `truncation` 0→1 (bị cắt bởi biên ảnh); `occlusion` 0 / 1 (1–50%) / 2 (>50%). Hai trường này nên
  **giữ lại trong metadata** — chúng cho phép phân tầng kết quả theo mức che khuất ở phần đánh giá.

### 2.3. Công thức chuyển sang YOLO

```
dw = 1.0 / img_width
dh = 1.0 / img_height
x_center = (bbox_left + bbox_width  / 2) * dw
y_center = (bbox_top  + bbox_height / 2) * dh
w_norm   =  bbox_width  * dw
h_norm   =  bbox_height * dh
```

Ghi ra `class_id x_center y_center w_norm h_norm`.

**Quy trình lọc còn một lớp `person`** (dùng cho `ml/scripts/convert_visdrone_person.py`):

1. Bỏ mọi dòng có `score == 0`.
2. Giữ **chỉ** các dòng thuộc `pedestrian` và `people`.
3. Ghi `class_id = 0` cho cả hai (gộp thành lớp `person`).
4. Chuẩn hoá toạ độ theo công thức trên.
5. **Ảnh không còn hộp nào sau khi lọc: GIỮ LẠI một phần làm ảnh nền (negative).** Ultralytics xử lý
   tốt ảnh nền và chúng giúp **giảm dương tính giả** — vốn là rủi ro lớn nhất khi bay thật trên bãi
   cỏ/bê tông. Đừng xoá sạch.
6. `nc: 1`, `names: ['person']` — khớp với `ml/configs/visdrone_person.yaml` hiện có.

Nên **đếm thật** số instance `person` sau khi lọc và ghi con số đó vào báo cáo, thay vì trích dẫn
tỉ lệ từ bài báo khác.

### 2.4. Các dataset hàng không khác

| Dataset | Quy mô | Nhãn | Giấy phép | Dùng? |
|---|---|---|---|---|
| **VisDrone2019-DET** | 6,471 / 548 / 1,610 ảnh | Hộp, 10 lớp | Không có LICENSE; thông lệ học thuật | **CHÍNH** |
| **HERIDAL** | ~1,647 ảnh / 3,229 nhãn người | Hộp, 1 lớp `person` | **CC BY** — cho cả thương mại/giáo dục | **PHỤ** |
| SARD | 1,981 ảnh | Hộp + **tư thế** (đứng/đi/chạy/ngồi/**nằm**) | Chưa rõ (trang Kaggle render JS) | Cân nhắc |
| TinyPerson | 1,610 ảnh, 72,651 nhãn, đa số <32×32 px | Hộp | **Hạn chế**: cấm thương mại, cấm đăng ảnh nhận dạng được người | Bỏ qua |
| Okutama-Action | 43 chuỗi 4K, 77,365 khung | Hộp + hành động, **video** | CC BY-NC-SA 3.0 (cần xác nhận) | Bỏ qua |
| **UAVDT** | ~80,000 khung | Hộp: **car, truck, bus** | "Research only" | **LOẠI** |

> **Sửa một hiểu nhầm phổ biến:** UAVDT thường bị liệt kê trong các danh sách "dataset UAV" cho bài
> toán phát hiện người. **Nó không chú thích người** — chỉ phương tiện. Loại khỏi kế hoạch.

**HERIDAL đáng giá vì hai lý do khớp riêng với đề tài này:** (a) giấy phép **CC BY** rõ ràng — là
dataset duy nhất trong bảng không vướng pháp lý; (b) cảnh **hoang dã / ít lộn xộn**, bù cho VisDrone
vốn gần như toàn đường phố đô thị, giúp model bớt học thiên lệch theo nền đường nhựa.

**SARD** tuy nhỏ nhưng là dataset duy nhất có **nhãn tư thế bao gồm "nằm"** — trùng đúng mục 5.5c
(phân loại đứng/ngồi/nằm). Nếu xác nhận được giấy phép, đây là nguồn tốt để khởi động nhánh phân
loại tư thế mà không phải tự gán nhãn từ đầu.

### 2.5. Kế hoạch dữ liệu đề xuất

| Vai trò | Nguồn | Quy mô | Model liên quan |
|---|---|---|---|
| Huấn luyện nền | VisDrone-person (gộp `pedestrian`+`people`) | 6,471 train / 548 val | B |
| Bổ sung đa dạng nền | HERIDAL (CC BY) | ~1,500 ảnh | B (tuỳ chọn) |
| Thích nghi miền | VisDrone-ESP32 tổng hợp | = quy mô VisDrone | D |
| Miền đích thật | ESP32-CAM tự thu | 1,500–2,500 ảnh có nhãn | C |
| **Tập kiểm thử** | **ESP32-CAM thật, KHÔNG augment** | 300–500 ảnh | mọi model |
| Tham chiếu khôi phục | Cặp ESP32 ↔ điện thoại (homography) | 300–500 cặp | PSNR/SSIM/LPIPS |

**Hai nguyên tắc bắt buộc** (đã có trong tài liệu tổng quan, khảo sát này xác nhận):

1. **Chia theo cảnh quay/session, không chia theo khung ảnh.** Các khung liên tiếp gần như trùng
   nhau; chia ngẫu nhiên theo khung làm rò rỉ dữ liệu và thổi phồng mAP một cách vô nghĩa.
   `ml/scripts/split_dataset.py` đã ghi đúng yêu cầu này.
2. **Tập test luôn là ảnh ESP32 thật, chưa augment.** Augment tập test là tự xoá bỏ khả năng đo độ
   bền trước suy giảm thật. `ml/scripts/augment.py` đã có guard chặn đường dẫn chứa `test` — giữ nguyên.

---

## 3. Suy giảm ảnh, khôi phục và thích nghi miền

### 3.1. CẢNH BÁO PHIÊN BẢN — `albumentations` đã ngừng bảo trì

Đây là phát hiện cần xử lý ngay vì `ml/requirements.txt` hiện ghi `albumentations>=1.4`.

- Gói **`albumentations`** gốc (MIT) **không còn được bảo trì tích cực** — README của repo nói rõ
  điều này. Tag cuối: **2.0.8 (27/05/2025)**.
- Toàn bộ phát triển đã chuyển sang **`albumentationsx`** (`pip install albumentationsx`), **giữ
  nguyên tên import `albumentations`** nên là drop-in. Bản mới nhất: **2.4.10 (14/09/2026)**.
- **Khác biệt giấy phép, cần cân nhắc:** AlbumentationsX là **dual-license AGPL-3.0-only / thương mại**,
  trong khi bản cũ là MIT. Với đồ án sinh viên công khai mã nguồn thì AGPL không vấn đề, **nhưng phải
  ghi rõ trong phần giấy phép** của báo cáo.

**Khuyến nghị:** dùng `albumentations==2.0.8` (MIT, ổn định, đủ mọi transform cần thiết ở bảng 3.2)
để tránh ràng buộc AGPL; chỉ chuyển sang `albumentationsx` nếu cần một transform mới. Ghi quyết định
này kèm lý do vào `requirements.txt`.

### 3.2. Mô phỏng suy giảm — transform nào có sẵn, cái nào phải tự viết

| Hiện tượng | Lớp albumentations | Tự viết? |
|---|---|---|
| Nén JPEG theo chất lượng q | `ImageCompression` | Có sẵn |
| Nhòe chuyển động | `MotionBlur` | Có sẵn |
| Nhòe lệch tiêu (defocus) | `Defocus`, `GaussianBlur`, `AdvancedBlur`, `ZoomBlur`, `GlassBlur` | Có sẵn |
| Nhiễu Gauss | `GaussNoise` | Có sẵn |
| Nhiễu Poisson / shot | `ShotNoise` (Poisson trong không gian tuyến tính) | Có sẵn |
| Nhiễu cảm biến ISO | `ISONoise` | Có sẵn |
| Nhiễu khác | `AdditiveNoise`, `MultiplicativeNoise`, `SaltAndPepper`, `FilmGrain` | Có sẵn |
| Hạ rồi nâng độ phân giải | `Downscale` | Có sẵn |
| Quang sai màu | `ChromaticAberration` (`mode="red_blue"`) | Có sẵn |
| Thiếu sáng / gamma | `RandomGamma`, `RandomToneCurve` | Có sẵn |
| Lệch cân bằng trắng | `PlanckianJitter` (theo quỹ tích Planck — đúng vật lý hơn `ColorJitter`) | Có sẵn |
| **Rolling shutter** | — | **Tự viết OpenCV** |
| **Vignetting** | — | **Tự viết OpenCV** |

**Hai transform phải tự viết:**

- **Rolling shutter:** dịch chuyển ngang theo hàng, biến thiên theo thời gian — dựng trường dịch
  chuyển tần số thấp trơn (sin hoặc Perlin) theo từng hàng rồi áp bằng `cv2.remap`. Tham số (độ
  nghiêng trên mỗi đơn vị tốc độ) lấy từ phép đo con lắc/quạt quay ở Lớp 1 của tài liệu tổng quan.
- **Vignetting:** mặt nạ tối dần theo bán kính — dùng mô hình suy giảm **cos⁴** (đúng như tài liệu
  tổng quan đã ghi) hoặc tích ngoài của `cv2.getGaussianKernel`, rồi nhân vào ảnh.

> **Lưu ý khi gắn vào pipeline YOLO:** rolling shutter và vignetting **làm biến dạng hình học** (ít
> nhất là rolling shutter). Nếu tự viết ngoài framework albumentations thì **phải tự cập nhật toạ độ
> bounding box** tương ứng, nếu không nhãn sẽ lệch khỏi vật thể. Vignetting thuần photometric nên
> không đụng nhãn. Đây là cái bẫy dễ làm hỏng cả tập VisDrone-ESP32 mà không báo lỗi gì.

### 3.3. Hai pipeline suy giảm chuẩn để trích dẫn

- **Real-ESRGAN — suy giảm "bậc hai" (second-order):** lặp **hai vòng** của (nhòe → hạ mẫu → nhiễu →
  nén JPEG), mô hình hoá hiệu ứng cộng dồn của chuỗi thu-và-truyền thật. Thêm bước lọc sinc để mô
  phỏng artifact ringing/overshoot. *Wang et al., ICCVW 2021* — arXiv:2107.10833, repo BSD-3-Clause.
- **BSRGAN — suy giảm xáo trộn ngẫu nhiên:** nhòe (Gauss đẳng hướng/bất đẳng hướng), hạ mẫu
  (nearest/bilinear/bicubic ngẫu nhiên) và nhiễu (Gauss + JPEG + nhiễu cảm biến qua mô hình ISP
  nghịch-thuận), áp theo **hoán vị ngẫu nhiên** thay vì thứ tự cố định. *Zhang et al., ICCV 2021* —
  arXiv:2103.14006, repo Apache-2.0.

**Liên hệ với đề tài:** đây chính là chỗ đề tài **vượt lên trên** hai bài báo trên. Real-ESRGAN và
BSRGAN phải *đoán* phân bố tham số suy giảm vì không biết camera đích. Nhóm **đo được** tham số thật
từ chính ESP32-CAM (Lớp 1: MTF, (a,b) của nhiễu Poisson–Gauss, hệ số méo, phân bố q thực tế từ log
điều tiết QoS). Vậy nên **giữ cấu trúc bậc hai của Real-ESRGAN nhưng thay phân bố tham số bằng phân
bố đo được** — đó là đóng góp có thể nêu thành một câu rõ ràng trong báo cáo.

### 3.4. Front-end khôi phục — so sánh và giấy phép

| Model | Giấy phép | Tốc độ / kích thước | Bản nhẹ | Ghi chú cho đề tài |
|---|---|---|---|---|
| **FBCNN** | Apache-2.0 | CNN nhẹ, nhanh | Không cần (một model phủ toàn dải QF) | **Khớp nhất với trục nén JPEG** — dự đoán được hệ số chất lượng và cho phép điều chỉnh mức khử artifact. ICCV 2021, arXiv:2109.14573 |
| **Real-ESRGAN** | BSD-3-Clause | RRDB nặng; 4060 chạy được ảnh đơn | **Có** — `realesr-general-x4v3` (SRVGGNetCompact, 64 feat / 32 conv), kèm tuỳ chọn `-dn` chỉnh mức khử nhiễu | Dùng làm **trần trên chất lượng**, đúng như tài liệu tổng quan xếp loại |
| **NAFNet** | Kiểm tra LICENSE trong repo | Rất hiệu quả trên mỗi FLOP: 33.69 dB PSNR khử nhòe GoPro ở **8.4%** compute của SOTA trước; 40.30 dB khử nhiễu SIDD ở <50% | **Có** — biến thể width-32 và width-64 | Ứng viên tốt nhất cho "chất lượng cao / chi phí thấp". ECCV 2022, arXiv:2204.04676 |
| **Restormer** | MIT | Transformer, attention tuyến tính; nặng hơn NAFNet | Không có checkpoint tiny chính thức | CVPR 2022 oral, arXiv:2111.09881 |
| **SCUNet** | Apache-2.0 | Swin-Conv UNet, khử nhiễu mù | Có checkpoint màu/xám | arXiv:2203.13278 |
| **Zero-DCE** | **CC BY-NC 4.0 — chỉ nghiên cứu phi thương mại** | Rất nhẹ (ước lượng đường cong, không cần dữ liệu cặp) | Vốn đã nhẹ | Trục thiếu sáng. CVPR 2020, arXiv:2001.06826. **Giấy phép NC — ổn cho đồ án, phải ghi rõ** |
| **SCI** | Kiểm tra LICENSE | Thiết kế để rẻ: một khối cơ bản khi suy luận | Vốn đã nhẹ | CVPR 2022 oral, arXiv:2204.10137. **Repo có sẵn kết quả downstream detection/segmentation** — hữu ích để đối chiếu |

**Khôi phục hướng-tác-vụ (detection-aware restoration) có tài liệu** và liên quan trực tiếp đến
Thí nghiệm C: hướng nghiên cứu này huấn luyện/tinh chỉnh bộ khôi phục theo nhu cầu của bộ phát hiện
phía sau thay vì theo PSNR chung chung. Xem danh sách chưa kiểm chứng ở cuối (JR², MWFormer, các bài
joint restoration + detection).

### 3.5. Hai bài báo bắt buộc phải trích — và chúng mâu thuẫn nhau

Đây là cặp trích dẫn quan trọng nhất cho luận điểm trung tâm của đề tài:

| Kết luận | Bài | URL |
|---|---|---|
| **SR GIÚP detection**: tăng **13–36% mAP** khi siêu phân giải ảnh vệ tinh 30cm→15cm | Shermeyer & Van Etten, CVPRW EarthVision 2019 | arXiv:1812.04098 |
| **SR KHÔNG giúp**: SR so với nội suy nearest-neighbor cho AP gần như **y hệt (chênh 0.0002)** | Koester & Sahin | arXiv:1907.05283 |

**Đây chính là bằng chứng cho "kết luận dự kiến" ở mục 5.4 của tài liệu tổng quan** — rằng ảnh đẹp
hơn với mắt người không đồng nghĩa phát hiện tốt hơn. Câu hỏi đã có hai câu trả lời trái ngược trong
tài liệu công khai, nên việc nhóm **đo lại trên camera của chính mình** là đóng góp hợp lệ chứ không
phải chạy lại thư viện. Đưa cả hai bài vào phần liên quan và nêu rõ mâu thuẫn.

**Hai benchmark độ bền để định khung phương pháp đánh giá:**

- *Michaelis et al.*, "Benchmarking Robustness in Object Detection" — giới thiệu Pascal-C / COCO-C /
  Cityscapes-C; báo cáo AP giảm tới **30–60%** dưới nhiễu loạn. arXiv:1907.07484. Đây là khuôn mẫu
  phương pháp luận cho bảng ma trận thí nghiệm của nhóm.
- *He, Ding, Xu, Xia*, "On the Robustness of Object Detection Models on Aerial Images," **IEEE TGRS
  2025** — benchmark trên DOTA-v1.0 với 19 loại nhiễu loạn + suy giảm do mây. arXiv:2308.15378.
  **Đây là bài gần đề tài nhất** (hàng không + độ bền) — nên là trích dẫn nền tảng.
- Thích nghi miền cho UAV: *Kiefer, Messmer, Zell*, ICAR 2021 — arXiv:2101.12677.

### 3.6. Ma trận 4 thí nghiệm

Bốn thí nghiệm dưới đây **bổ trợ chứ không thay thế** bảng model A→G ở mục 6.2/6.4 tài liệu tổng
quan: A→G là *cái gì được huấn luyện*, còn A→D dưới đây là *câu hỏi nào được trả lời*.

| TN | Trục | Giả thuyết | Train / Test | Biến thiên | Chỉ số | Công sức |
|---|---|---|---|---|---|---|
| **A — Khoảng cách miền** | VisDrone → camera của nhóm | Model chỉ huấn luyện trên VisDrone **mất đáng kể mAP** khi đánh giá zero-shot trên ảnh ESP32-CAM thật, do khác biệt cảm biến/ống kính/độ cao/nén — không chỉ do ngoại hình vật thể | Train: chỉ VisDrone. Test: (i) VisDrone val (baseline cùng miền), (ii) ảnh ESP32 tự thu (miền đích) | Không gì — cùng bộ trọng số, hai tập test | mAP50, mAP50-95, **AR-small** | **Thấp** — không huấn luyện lại, chỉ cần ≥100–200 khung ESP32 đã gán nhãn |
| **B — Augment suy giảm khi huấn luyện** | Độ bền nhờ pipeline suy giảm | Thêm pipeline JPEG/nhòe/nhiễu/hạ-mẫu/vignette/rolling-shutter khi huấn luyện **thu hẹp một phần** khoảng cách ở TN A, vì ép model bất biến với artifact kiểu camera nhúng ngay cả khi **không có** ảnh miền đích | Train: VisDrone, có vs không pipeline suy giảm (hai checkpoint). Test: cùng tập ESP32 của TN A, **cộng thêm** VisDrone-val đã suy giảm tổng hợp | Có/không + mức độ của pipeline bậc hai | mAP50, mAP50-95, AR-small trên cả hai tập; chênh lệch so với TN A | **Trung bình** — một lần huấn luyện thêm |
| **C — Front-end khôi phục khi suy luận** | Khôi phục trước khi phát hiện | Chạy bộ khôi phục nhẹ trước bộ phát hiện cải thiện mAP trên ảnh ESP32 thật **nhiều hơn** so với chỉ augment (TN B), nhưng **đánh đổi độ trễ**; và mức cải thiện **lớn hơn với mục tiêu nhỏ/xa** (AR-small) so với mục tiêu lớn/gần | Cùng trọng số TN A (hoặc TN B), đánh giá có vs không front-end trên tập test ESP32 | Có/không khôi phục; so ba biến thể: `realesr-general-x4v3` vs **FBCNN** (thuần khử artifact JPEG) vs **Zero-DCE/SCI** (thiếu sáng) | mAP50, mAP50-95, AR-small **+** PSNR/SSIM/LPIPS (khi có ảnh cặp điện thoại) hoặc **NIQE/BRISQUE** không tham chiếu **+ ms/khung** | **Trung bình–Cao** — không cần huấn luyện lại nếu dùng trọng số pretrained |
| **D — Độ cao / tỉ lệ** | 5 m vs 8 m vs 12–15 m | Độ chính xác **suy giảm nhanh hơn** so với dự đoán chỉ dựa trên số pixel của vật thể, vì ở độ cao lớn hơn thì cùng lượng artifact JPEG/nhiễu/nhòe **chiếm tỉ lệ lớn hơn** trên diện tích (nay nhỏ hơn) của mỗi người — tức **suy giảm và tỉ lệ tương tác với nhau**, không độc lập | Thu + gán nhãn ảnh ESP32 ở 3 dải độ cao, giữ điều kiện khác tương đương (số người, tư thế, giờ trong ngày) | Chỉ độ cao; model giữ cố định trong từng phép so | mAP50/mAP50-95/**AR-small phân tầng theo dải độ cao** cho cả 3 biến thể model A/B/C → bảng 3×3 | **Cao** — cần bay thu dữ liệu đa độ cao |

**Giả thuyết của TN D là đóng góp trí tuệ nguyên bản nhất trong bốn cái** — nó dự đoán một *tương
tác* chứ không phải một hiệu ứng chính, và có thể bị bác bỏ bằng dữ liệu. Nếu số liệu cho thấy suy
giảm theo độ cao khớp đúng với dự đoán thuần theo pixel thì giả thuyết sai — và đó vẫn là một kết
quả đáng báo cáo.

**Thứ tự thực hiện đề xuất:** thu dữ liệu cho B và D chạy song song với phần đánh giá baseline của A;
C bổ sung cuối cùng vì rẻ nhất (tái dùng trọng số A/B, chỉ thêm một module lúc suy luận).
**Nút thắt là dữ liệu tự thu, không phải compute** — hãy dồn thời gian lịch cho việc có được tập
test ESP32 đã gán nhãn, phân tầng theo độ cao, cỡ ≥300–500 khung.

**Một chỉ số phải thêm vào mọi bảng:** `AR-small` (average recall cho vật thể nhỏ theo chuẩn COCO).
mAP tổng hợp che mất đúng thứ đề tài quan tâm — người cao 21–38 px. Thiếu chỉ số này thì mọi kết
luận về "khôi phục có giúp không" đều không đo được ở đúng chỗ.

---

### 3.7. BỐN HƯỚNG ĐỀ TÀI THAY THẾ cho môn Xử lý ảnh

"Phát hiện người" là một **bài toán ứng dụng**, không phải một **câu hỏi nghiên cứu xử lý ảnh** — nó
chỉ là chạy lại một thư viện có sẵn. Bốn hướng dưới đây **giữ nguyên toàn bộ phần cứng, dữ liệu và
code đã có**, chỉ đổi *câu hỏi được hỏi*: bộ phát hiện tụt xuống thành **thước đo**, không còn là
đối tượng nghiên cứu. Tất cả đều khả thi trên RTX 4060 8GB.

| | Hướng | Câu hỏi nghiên cứu | Tính mới | Nguồn dữ liệu | Khả thi trên 8GB | Công sức |
|---|---|---|---|---|---|---|
| **A** | **Hồ sơ suy giảm định lượng + mô phỏng có căn cứ vật lý** | Suy giảm của một camera nhúng cụ thể **đo được bằng bao nhiêu**, và mô phỏng **theo tham số đo được** có thu hẹp domain gap tốt hơn suy giảm ngẫu nhiên kiểu Real-ESRGAN/BSRGAN không? | **Cao.** Chưa có hồ sơ suy giảm công khai nào cho OV2640/ESP32-CAM. Real-ESRGAN và BSRGAN phải **đoán** phân bố tham số vì không biết camera đích — ở đây ta **đo được** | ESP32-CAM + bảng ISO 12233 in bìa cứng, thang xám, lưới ô vuông, con lắc. **Chi phí ~0₫** | **Rất cao** — hầu hết là OpenCV/CPU; GPU chỉ dùng cho phần ablation detector | Trung bình |
| **B** | **"Khôi phục ảnh có thực sự giúp nhận dạng không?"** | Trên **ảnh cặp THẬT** (không phải suy giảm giả lập), phương pháp khôi phục nào tăng mAP, phương pháp nào chỉ tăng PSNR mà **giảm** mAP, và đổi bao nhiêu ms/khung? | **Cao và có tranh cãi sẵn trong tài liệu:** arXiv 1812.04098 báo cáo SR tăng **13–36% mAP**; arXiv 1907.05283 báo cáo SR **không hơn nội suy nearest-neighbor (chênh 0.0002 AP)**. Hai kết quả trái ngược ⇒ đo lại trên camera của mình là đóng góp hợp lệ | Cặp ESP32-CAM ↔ điện thoại căn chỉnh bằng ORB/SIFT + homography + RANSAC (300–500 cặp). **Rất ít đồ án có ảnh cặp thật** | **Rất cao** — dùng trọng số pretrained, **không cần huấn luyện gì** | **Thấp nhất** |
| **C** | **Khôi phục ảnh đánh giá bằng hình học, không bằng mAP** | Mỗi phương pháp khôi phục làm **tỉ lệ đặc trưng inlier** tăng bao nhiêu và **sai số reprojection** giảm bao nhiêu khi ghép ảnh (mosaicking) / đăng ký ảnh đa thời điểm? | **Cao.** Khôi phục gần như luôn được đánh giá bằng PSNR hoặc bằng detection. Đánh giá bằng **chất lượng khớp đặc trưng** là góc hiếm — và là xử lý ảnh **thuần hình học, không dính học sâu** | Bay tuyến zigzag bằng chính drone; hoặc thu bằng sào nếu chưa bay được | **Rất cao** — ORB/AKAZE/RANSAC chạy CPU, **gần như không cần GPU** | Trung bình |
| **D** | **Vòng điều khiển chất lượng ảnh theo phản hồi của tác vụ** | Đóng vòng: độ tin cậy/entropy của bộ phát hiện điều khiển **`jpeg_quality` của camera theo thời gian thực**. Điểm làm việc nào tối ưu *độ chính xác trên mỗi byte truyền*? | **Cao, và là cầu nối hai môn.** Vòng kín giữa một tác vụ thị giác phía sau và một **tham số mã hoá nhúng** phía trước, đo trên phần cứng thật — không phải mô phỏng | Chính hệ thống đang xây; `set_quality()` đổi được lúc chạy nên **quét toàn dải q ngay trong một chuyến bay** | **Cao** — nút thắt là firmware + backend, không phải GPU | Cao |

**Xếp hạng khuyến nghị:**

1. **B là lựa chọn số một** — rẻ nhất (không huấn luyện), rủi ro thấp nhất, và trả lời một câu hỏi
   **đang có hai đáp án trái ngược trong tài liệu công khai**. Bộ ảnh cặp thật là thứ khiến báo cáo
   khác hẳn "chạy lại thư viện". Có thể hoàn thành kể cả khi drone chưa bay được (thu bằng sào).
2. **A là bổ trợ tự nhiên cho B** và tạo ra **dữ liệu gốc** — chương dữ liệu không thể sao chép từ
   bất kỳ bài báo nào. A + B gộp lại đã đủ cho một đồ án môn Xử lý ảnh mạnh.
3. **C nếu giảng viên muốn nội dung xử lý ảnh cổ điển** (biến đổi hình học, khớp đặc trưng, RANSAC)
   thay vì học sâu. Đây là hướng **ít phụ thuộc GPU nhất** và an toàn nhất nếu lịch bay bị trễ.
4. **D nếu muốn một đề tài chung cho CẢ hai môn** — nhưng phụ thuộc vào việc toàn bộ chuỗi
   firmware → backend → detector chạy thông, nên **rủi ro tiến độ cao nhất**. Để dành làm chương mở rộng.

> **Điểm chung quan trọng:** cả bốn hướng đều **vẫn dùng bộ phát hiện người** — chỉ khác ở chỗ nó
> trở thành **thước đo** chứ không phải kết quả. Nghĩa là **không có công sức nào đã bỏ ra bị lãng phí**:
> toàn bộ `ml/scripts/`, dataset VisDrone-person và ladder model A→G vẫn giữ nguyên giá trị. Thay đổi
> nằm ở phần **câu hỏi nghiên cứu và chương kết luận** của báo cáo, không nằm ở code.

---

## 4. Chọn camera

### 4.1. Số liệu đã kiểm chứng

| | ESP32-CAM (OV2640) | XIAO ESP32S3 Sense | RPi Zero 2W + Cam 3 | Điện thoại (IP Webcam) |
|---|---|---|---|---|
| Độ phân giải / fps thực đo | **14.19 fps @ VGA 640×480**; 8.25 @ SVGA; 44.4 @ QVGA; 1.29 @ UXGA | OV2640 như trên; nâng cấp được **OV5640** (tới 2592×1944) | H.264 640×480 qua UDP/RTSP ổn định | 1080p30+ dễ dàng |
| Độ trễ | Thấp (MJPEG, không có B-frame) | Thấp | **150–300 ms** nếu tinh chỉnh; **>1 s** nếu để mặc định | 200 ms – 2 s tuỳ app |
| Tầm Wi-Fi | PCB ~20–50 m; ngoài trời kém hơn. Anten ngoài cải thiện đáng kể | Như ESP32-CAM | Tốt hơn (Wi-Fi Pi) | Tốt nhất (có thể dùng 4G) |
| Khối lượng | **~10 g** (27×40.5×4.5 mm) | ~<10 g (21×17.5 mm) | Zero 2W ~11 g + Cam 3 ~4 g + cáp | **180–200 g** |
| Dòng tiêu thụ | **200–500 mA @5V** khi stream | Tương tự | ~350–600 mA | Tự có pin |
| AI on-board | Không | Không (thực tế) | **KHÔNG khả thi: YOLOv8n ≈ 7.6 s/ảnh (~0.13 fps); NCNN ≈ 3.8 s (~0.26 fps)** | Có (NNAPI) nhưng không cần |
| Giá VN | **180.000₫** (hshop.vn, có lúc 225.000₫) | **459.000₫** | **729.000₫ + ~890.000₫ ≈ 1.6 triệu₫** | Đã có sẵn |
| Giá trị nghiên cứu | **CAO — ảnh xấu là ĐỐI TƯỢNG nghiên cứu** | Trung bình (vẫn OV2640 ở bản gốc) | Thấp (ảnh quá tốt) | **Là ảnh THAM CHIẾU** |

### 4.2. Hiệu chỉnh ba con số trong tài liệu tổng quan

1. **fps ở VGA: tài liệu ghi "15–25 fps", đo thật là 14.19 fps.** Hơi lạc quan nhưng **kết luận
   không đổi**: cần ~2.4 fps để chồng lấn dọc 80% ở 8 m / 3 m/s, nên 14.19 fps vẫn dư biên **~6 lần**.
   Luận điểm "fps không phải nút thắt, chất lượng ảnh mới là" **vẫn đúng**. Chỉ cần sửa con số.
2. **SVGA chỉ 8.25 fps** — nếu có lúc nào muốn tăng độ phân giải lên 800×600 để có thêm pixel trên
   mỗi người thì phải biết là mất gần một nửa fps. Ở 8.25 fps vẫn còn dư biên ~3.4 lần, nên
   **SVGA là một lựa chọn khả thi đáng cân nhắc** — thêm 56% pixel/mét đổi lấy fps vẫn thừa.
   Nên đưa **độ phân giải thành một biến trong ma trận thí nghiệm**, không chốt cứng VGA.
3. **Nhiệt độ chip 69.7–74.2 °C ở MỌI độ phân giải.** Tài liệu chưa nêu con số này. Nó quan trọng:
   nhiệt không phụ thuộc độ phân giải, nghĩa là **không thể hạ nhiệt bằng cách giảm độ phân giải** —
   phải giải quyết bằng luồng gió/tản nhiệt. Trên drone thì luồng gió từ cánh quạt giúp ích, nhưng
   phải kiểm tra khi treo tĩnh (hover) và khi nằm chờ trên mặt đất trước khi cất cánh.

### 4.3. RỦI RO MUA HÀNG — bản IPEX

Tài liệu tổng quan ghi (rủi ro #3): *"ESP32-CAM phải là bản có cổng IPEX"*. Khảo sát cho thấy:

> **Trang sản phẩm ESP32-CAM trên hshop.vn ghi rõ "Antenna: Onboard PCB antenna, gain 2dBi" và
> KHÔNG niêm yết SKU bản IPEX riêng.**

Board AI-Thinker ESP32-CAM tiêu chuẩn có **sẵn đế hàn u.FL/IPEX trên mạch** cùng một **điện trở
0 Ω** chọn đường anten — chuyển sang anten ngoài là **thao tác hàn lại điện trở đó**, không phải mua
một SKU khác. Hệ quả thực tế:

- **Đừng đi tìm "bản IPEX" như một mã hàng riêng** — dễ mất thời gian hoặc mua nhầm ở giá cao.
- Mua board thường **180.000₫** + **anten 2.4GHz 3dBi IPEX 13.000₫** và tự dịch điện trở 0 Ω.
  Tổng ~**193.000₫**, rẻ hơn nhiều so với đi săn SKU đặc biệt.
- **Kiểm tra bằng mắt trước khi mua** ảnh sản phẩm xem có đế u.FL không. Nếu mua online, hỏi người bán.
- Nên **nhắn lại nội dung này vào tài liệu tổng quan** — rủi ro #3 hiện đang mô tả sai cơ chế.

> Lưu ý: con số "anten ngoài nâng độ tin cậy liên kết từ 32% lên 94% ở 45 m" chỉ là **một giai thoại
> triển khai đơn lẻ**, không phải benchmark có đối chứng. Đừng trích dẫn như số liệu khoa học. Điều
> chắc chắn duy nhất là anten ngoài **tốt hơn đáng kể** anten PCB; con số cụ thể phải tự đo.

### 4.4. `jpeg_quality` — tham số trung tâm của cả đề tài

Driver `esp32-camera` cho `jpeg_quality` **dải 0–63, SỐ NHỎ = CHẤT LƯỢNG CAO** (ngược trực giác).
Đặt lúc khởi tạo qua `camera_config_t.jpeg_quality`, đổi lúc chạy qua `sensor_t->set_quality()`.

Bậc cấp phát bộ đệm: `0–5` (960 KB ở UXGA / 240 KB ở SVGA) · `6–10` (384 / 96 KB) · `11+` (240 / 60 KB).

**Đây là tham số quan trọng nhất của toàn đề tài**, vì:

- Nó là **biến điều khiển của vòng QoS thích ứng** ở mục 7.2 (nội dung IoT).
- Nó là **trục suy giảm chính** của Lớp 3 (nội dung Xử lý ảnh) — và `set_quality()` đổi được lúc
  chạy nghĩa là có thể **quét toàn dải q ngay trên một chuyến bay**, thu được đường cong
  mAP-theo-q trên dữ liệu thật chứ không phải mô phỏng.
- Nó nối hai môn học lại với nhau bằng một biến duy nhất — đây là điểm mạnh nhất của đề tài, nên
  nêu rõ trong báo cáo.

**Đề xuất cụ thể:** ghi `jpeg_quality` thực tế vào metadata của **từng khung ảnh** thu được. Không
làm việc này thì sau không thể phân tầng kết quả theo q, và mất luôn một trục của ma trận thí nghiệm.

### 4.5. Khuyến nghị xếp hạng

**1. Chính — ESP32-CAM AI-Thinker + anten IPEX ngoài (~193.000₫).** Giữ nguyên lựa chọn của tài
liệu tổng quan. Lý do quyết định: **ảnh xấu của nó CHÍNH LÀ đối tượng nghiên cứu** — rolling shutter
nhoè khi bay, nén JPEG mạnh, throttle nhiệt ~70–74 °C, mất khung do Wi-Fi. Một camera tốt hơn sẽ
**phá hỏng đề tài**, không cải thiện nó. Đồng thời thoả mãn trục IoT (MCU + Wi-Fi + điều tiết thích
ứng) và chỉ tốn 10 g trong ngân sách tải 1.8 kg.

**2. Dự phòng — RPi Zero 2W + Camera Module 3 (~1.6 triệu₫), CHỈ STREAM.** Dùng nếu ESP32-CAM chứng
tỏ không bay nổi (rớt link do EMI motor, tắt vì nhiệt giữa chuyến). **Tuyệt đối không chạy YOLO trên
Pi Zero 2W** — 0.13 fps thô, 0.26 fps với NCNN; chênh **50–100 lần** so với mức dùng được. Kiến trúc
"suy luận trên laptop" của đề tài là đúng và khảo sát này xác nhận.

**3. Tham chiếu — điện thoại.** Đúng như kế hoạch: dùng làm ảnh chất lượng cao cho cặp PSNR/SSIM/LPIPS.
Không gắn lên drone (180–200 g là 10% tải hữu ích). Gắn cạnh ESP32-CAM trên **giá đỡ mặt đất / sào**
khi thu cặp ảnh, đúng như mục 5.4 đã mô tả.

**Không khuyến nghị XIAO ESP32S3 Sense** ở bản gốc: vẫn là cảm biến OV2640, nên **không cải thiện
chất lượng ảnh** mà đắt gấp 2.5 lần. Chỉ đáng cân nhắc nếu muốn nâng cấp **OV5640** để có camera
"trung bình" làm điểm thứ ba trên trục chất lượng (ESP32-CAM xấu → OV5640 trung bình → điện thoại
tốt) — đó sẽ là một trục thí nghiệm đẹp, nhưng là mở rộng, không bắt buộc.

### 4.6. Bốn rủi ro và cách giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| **Sụt áp (brownout)** khi Wi-Fi phát, dòng vọt 200–500 mA | Nguồn 5V riêng ≥1 A qua UBEC, **không dùng chung BEC của FC** (đúng như mục 3.5 đã ghi). Thêm tụ decouple gần module để lọc nhiễu từ đường ESC/motor |
| **Throttle nhiệt** ở 70–74 °C duy trì | Không giảm được bằng hạ độ phân giải. Dựa vào luồng gió cánh quạt; **kiểm tra riêng lúc hover và lúc chờ trên mặt đất**. Đưa hiện tượng suy giảm fps theo thời gian bay vào giao thức đo |
| **Xung đột 2.4 GHz** với RC/telemetry | Tách anten Wi-Fi xa anten receiver hết mức khung cho phép; chọn **kênh Wi-Fi 1 hoặc 11** (rìa băng tần); **bench-test RC + Wi-Fi cùng lúc TRƯỚC chuyến bay đầu**. ELRS-2.4 nhạy cảm hơn FlySky AFHDS |
| **Nhoè rolling shutter** theo tốc độ tịnh tiến/xoay | **Đây là kết quả nghiên cứu hợp lệ, không phải lỗi cần sửa.** Đo nó, mô hình hoá nó, đưa vào pipeline suy giảm |

---

## 5. Triển khai suy luận và công cụ

### 5.1. Đọc luồng MJPEG bằng OpenCV trên Windows

`cv2.VideoCapture("http://<ip>:81/stream")` **hoạt động được** với luồng multipart
`x-mixed-replace` của ESP32-CAM qua backend FFmpeg (mặc định trên Windows).

**Hai cái bẫy:**

1. **Trễ tích luỹ.** `VideoCapture` đệm khung nhanh hơn tốc độ tiêu thụ; nếu vòng lặp phát hiện chậm
   hơn fps camera thì **càng lúc càng tụt xa thời gian thực**. Với UAV đang bay, ảnh trễ 3 giây là
   ảnh vô dụng.
2. **Treo ngẫu nhiên** trên một số server MJPEG của ESP32 trong vài điều kiện mạng.

**Mẫu khuyến nghị:**

```python
import cv2
cap = cv2.VideoCapture("http://192.168.4.1:81/stream")
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)   # giảm đệm nội bộ
while True:
    ok, frame = cap.read()
    if not ok:
        continue
    # suy luận NGAY trên `frame` — không đưa vào hàng đợi
```

**Nếu `CAP_PROP_BUFFERSIZE` bị bỏ qua** (hạn chế đã biết của backend FFmpeg ở một số bản build) —
và trường hợp này **khá phổ biến** — thì dùng **parser multipart thủ công**: `requests` với
`stream=True`, đọc byte thô, tự tách theo marker JPEG SOI `\xff\xd8` và EOI `\xff\xd9`, chạy trong
**luồng nền** và **chỉ giữ khung mới nhất** (mẫu grab-latest). Cách này bỏ qua hoàn toàn hàng đợi
nội bộ mờ đục của OpenCV.

> **Khuyến nghị cho `backend/.../stream.py`: viết luôn parser thủ công ngay từ đầu.** Nó không khó
> hơn nhiều, tránh được cả hai cái bẫy, và cho phép **đọc được header multipart** — nơi có thể nhúng
> timestamp và `jpeg_quality` của từng khung (mục 4.4). `VideoCapture` không cho truy cập header.

### 5.2. Xuất ONNX / TensorRT

```python
from ultralytics import YOLO
model = YOLO("yolo26n.pt")                            # hoặc yolo11n.pt
model.export(format="onnx", opset=17, dynamic=True)   # cho onnxruntime-gpu
model.export(format="engine", device=0)               # xuất thẳng .engine TensorRT
```

```powershell
yolo export model=yolo26n.pt format=engine device=0 half=True
```

- **`opset=17`** là mức Ultralytics khuyến nghị cho tương thích TensorRT 10.7.
- **TensorRT ĐÃ cài được bằng pip trên Windows**: `pip install tensorrt` — bản **11.3.0.99
  (09/09/2026)**, Windows x64 (Win10+), Python 3.8–3.13, mặc định CUDA-13, có biến thể `-cu12` /
  `-cu13`. **Chọn bản CUDA-13 để khớp với `torch+cu130` ở mục 1.5.** Đây là thay đổi lớn so với
  trước — không còn phải tải zip từ NVIDIA và chỉnh PATH thủ công.
- `.engine` của TensorRT **gắn chặt với GPU và phiên bản driver/TensorRT cụ thể**. Phải build lại
  trên chính máy chạy; **không commit `.engine` vào git**, không chia sẻ giữa máy khác nhau.
- Ultralytics công bố "tăng tốc tới 5× với TensorRT" — **đây là con số marketing của nhà cung cấp**,
  không phải benchmark độc lập. Đừng trích dẫn như sự thật đã kiểm chứng; hãy tự đo và báo cáo.

**FPS kỳ vọng trên RTX 4060 Laptop @ imgsz 640 — ESTIMATE, không tìm được benchmark trực tiếp:**

| Đường chạy | FPS ước lượng |
|---|---|
| PyTorch CUDA FP16 | **60–120** |
| TensorRT FP16 (`.engine`) | **100–200+** |

Cơ sở ngoại suy: một báo cáo không chính thức cho YOLOv8n đạt 35 fps trên RTX 3080 Ti Laptop; model
nano ở batch=1 bị giới hạn bởi băng thông bộ nhớ và overhead launch kernel hơn là bởi compute.
**Hãy tự đo bằng `model.benchmark()` và ghi con số thật vào báo cáo** thay vì dùng ước lượng này.

> **Điều quan trọng hơn con số FPS:** camera chỉ cấp **14.19 fps**. Mọi con số trên đều **dư thừa
> gấp 5–14 lần**. Vậy nên **tối ưu tốc độ suy luận KHÔNG phải ưu tiên của đề tài này** — ngân sách
> tính toán dư ra nên đổ vào **SAHI** (chạy N lát mỗi khung) và **front-end khôi phục**, tức đổi
> thời gian tính toán lấy độ chính xác. Điều này khớp đúng với câu hỏi nghiên cứu chính ở tài liệu
> tổng quan: *"chuỗi xử lý ảnh nào phục hồi hiệu năng phát hiện tốt nhất trên mỗi đơn vị thời gian
> tính toán bỏ ra?"* — và khảo sát này cho thấy ngân sách đó **rộng hơn nhiều** so với cảm giác ban đầu.

### 5.3. SAHI — xác nhận số liệu trong tài liệu tổng quan

- Repo `github.com/obss/sahi`, PyPI **0.12.6 (16/08/2026)**.
- **Hỗ trợ cả YOLO11 và YOLO26** qua tích hợp Ultralytics (`ultralytics>=8.3.161`), dùng chung
  notebook `inference_for_ultralytics.ipynb`.

**Kiểm chứng trích dẫn ở mục 5.5a tài liệu tổng quan — CHÍNH XÁC**, nguyên văn abstract (arXiv 2202.06934):

> *"the proposed inference method can increase object detection AP by **6.8%, 5.1% and 5.3%** for
> FCOS, VFNet and TOOD detectors, respectively... the detection accuracy can be further increased
> with a slicing aided fine-tuning, resulting in a cumulative increase of **12.7%, 13.4% and 14.5%**
> AP in the same order."*

**Một hiệu chỉnh cần thiết về cách diễn giải:** hai con số 6.8% và 12.7% là của detector **FCOS**,
không phải YOLO, và đo trên VisDrone + xView. **Không có số liệu SAHI+YOLO trên VisDrone được công bố**
mà khảo sát này tìm thấy. Vậy nên trong báo cáo hãy viết *"SAHI được báo cáo tăng AP 6.8% (FCOS,
chỉ suy luận) và 12.7% (cộng dồn với tinh chỉnh theo lát)"* — ghi rõ detector. Mức tăng khi áp lên
YOLO26n là **câu hỏi mở mà đề tài sẽ tự trả lời**, và đó là một đóng góp nhỏ nhưng thật.

### 5.4. Công cụ gán nhãn

| Công cụ | Tự host | Giấy phép | Xuất YOLO | Độ dễ trên Windows |
|---|---|---|---|---|
| **Label Studio** | Có (pip hoặc Docker) | OSS | COCO, YOLO, VOC, JSON, CSV | **Dễ nhất cho một người** |
| CVAT | Có (Docker Compose) | MIT | Rộng nhất: COCO, YOLO 1.1, VOC, LabelMe, Datumaro | Trung bình (cần Docker) |
| Roboflow | Không (cloud-first) | Freemium | Có, kèm pipeline augment/train | Không cần cài đặt |

**Khuyến nghị: Label Studio tự host.** Cài bằng `pip install label-studio`, đủ cho 1.500–2.500 ảnh,
xuất thẳng định dạng YOLO, **không phụ thuộc cloud** — quan trọng vì dữ liệu có hình ảnh người
thật (vấn đề riêng tư) và vì môn học cần pipeline **tái lập được tại chỗ**. CVAT chỉ đáng chọn nếu
cần nhiều người gán nhãn song song. **Roboflow không khuyến nghị** — cloud-first, khó tái lập, và
đưa ảnh người thật lên dịch vụ bên thứ ba.

**Mẹo tiết kiệm công:** gán nhãn thủ công 2.500 ảnh rất tốn thời gian. Dùng **Model B (đã huấn luyện
trên VisDrone) để tiền-gán-nhãn** ảnh ESP32, rồi chỉ sửa tay. Nhưng phải **kiểm tra thiên lệch**:
model sẽ bỏ sót đúng những trường hợp khó mà đề tài quan tâm nhất, nên **một tập con phải được gán
nhãn hoàn toàn thủ công** để đo tỉ lệ bỏ sót của bước tiền-gán-nhãn. Không làm bước kiểm tra này thì
nhãn bị nhiễm thiên lệch của chính model và mọi kết quả sau đó đều vô nghĩa.

### 5.5. Phiên bản hoá dữ liệu

**Giới hạn cứng của GitHub:** cảnh báo ở 50 MB, **chặn push ở 100 MB/file**. Git LFS nâng giới hạn
mỗi file lên 2 GB nhưng **hạn mức lưu trữ/băng thông của gói miễn phí chỉ ~1–2 GB** — **không đủ**
cho dataset 10–30 GB.

**Khuyến nghị: DVC với remote Google Drive.**

- Repo git giữ code + file con trỏ `.dvc` + file nhãn/cấu hình nhỏ → repo vẫn nhẹ và nhanh.
- Ảnh thật đẩy lên thư mục Drive qua `dvc remote add` / `dvc push` → miễn phí với tài khoản sinh viên.
- Có **phiên bản hoá và rollback thật**, khác với cách đặt tên thư mục thủ công (không diff được,
  không rollback được, và mục rữa trong im lặng).

```bash
pip install "dvc[gdrive]"
dvc init
dvc remote add -d gdrive gdrive://<folder-id>
dvc add ml/datasets/visdrone_person
git add ml/datasets/visdrone_person.dvc .gitignore
dvc push
```

Cách thư mục-có-phiên-bản + manifest chỉ chấp nhận được như giải pháp tạm ở giai đoạn đầu; nên
chuyển sang DVC khi dataset vượt ~500 MB – 1 GB.

> **Kiểm tra `.gitignore` ngay bây giờ:** đảm bảo `ml/datasets/`, `ml/weights/`, `ml/results/` đã bị
> loại trừ. Một lần `git add .` vô ý với 15 GB ảnh sẽ làm hỏng lịch sử repo và **rất khó gỡ**.
> Các file `.gitkeep` hiện có cho thấy ý định này đã đúng — chỉ cần xác nhận quy tắc ignore đủ chặt.

---

## 6. Danh sách việc cần làm ngay (theo thứ tự)

| # | Việc | Lý do |
|---|---|---|
| 1 | Sửa `ml/requirements.txt`: ghim `albumentations==2.0.8` + chú thích về AlbumentationsX/AGPL | Gói đã ngừng bảo trì; quyết định giấy phép phải có chủ đích |
| 2 | Cài `torch --index-url .../cu130`, chạy đoạn kiểm tra GPU ở mục 1.5 | `cu128` không còn bản 2.14; cài sai ⇒ chạy CPU trong im lặng |
| 3 | Tải VisDrone qua `VisDrone.yaml` của Ultralytics, cài `convert_visdrone_person.py` theo mục 2.3 | **Nhớ lấy CẢ `pedestrian` VÀ `people`** |
| 4 | Huấn luyện Model B bằng cả `yolo26n` và `yolo11n`, cùng cấu hình | Bảng ablation gần như miễn phí; đối chiếu được với baseline 21.9% mAP50 |
| 5 | Mua ESP32-CAM thường + anten IPEX 13.000₫, tự dịch điện trở 0 Ω | Bản "IPEX" không phải SKU riêng — mục 4.3 |
| 6 | Ghi `jpeg_quality` vào metadata **từng khung** ngay từ firmware đầu tiên | Không có nó thì mất một trục thí nghiệm, và không lấy lại được |
| 7 | Viết parser MJPEG thủ công (không dùng `VideoCapture`) cho `stream.py` | Tránh trễ tích luỹ; đọc được header |
| 8 | Dựng DVC + remote Drive trước khi dataset vượt 1 GB | Chuyển sau sẽ đau hơn nhiều |
| 9 | Thêm **AR-small** vào mọi bảng đánh giá | mAP tổng che mất đúng thứ đề tài quan tâm |
| 10 | Sửa hai con số trong `docs/bao-cao-tong-quan-du-an.md`: fps VGA 15–25 → **14.19**; rủi ro #3 về bản IPEX | Giữ tài liệu đúng sự thật |

---

## 7. Những gì báo cáo này KHÔNG trả lời được

Trung thực về giới hạn của khảo sát:

- **Không tìm được benchmark FPS cho RTX 4060 Laptop** với YOLO11n/YOLO26n ở imgsz 640. Con số
  60–200 fps ở mục 5.2 là **ngoại suy có lập luận**, không phải số đo. Phải tự đo.
- **Không tìm được thời gian huấn luyện thực đo** cho cấu hình này. Ước lượng 5–9 giờ ở mục 1.3 là
  ngoại suy. Đo 1 epoch rồi nhân lên.
- **Không có số liệu SAHI + YOLO trên VisDrone** được công bố. Con số 6.8%/12.7% là của FCOS.
- **Không có số đo tầm Wi-Fi có đối chứng** cho anten IPEX ngoài trời trên drone. Chỉ có giai thoại.
- **Giấy phép SARD chưa xác nhận được** (trang Kaggle render bằng JS). Phải mở trình duyệt kiểm tra tay.
- **Không có benchmark so sánh ESP32-CAM với XIAO ESP32S3 Sense** chạy cùng driver ở VGA. Nhận định
  "S3 không cải thiện chất lượng ảnh" dựa trên việc **cùng dùng cảm biến OV2640**, là suy luận chứ
  không phải phép đo.
- **Giá UBEC 5V tại VN** không xác minh được — ước 80.000–150.000₫ cho loại 3A.
- **Không kiểm tra được giá ở thegioiic.com và banlinhkien.com** trong đợt khảo sát này.

Mọi con số trong báo cáo này đều nên được **đo lại trên chính hệ thống của nhóm** trước khi đưa vào
báo cáo môn học. Đây là khảo sát để định hướng, không phải nguồn số liệu để trích dẫn.

---

## 8. URL đã kiểm chứng

**Model / framework**
- https://pypi.org/project/ultralytics/
- https://docs.ultralytics.com/models/
- https://docs.ultralytics.com/models/yolo26/
- https://docs.ultralytics.com/models/yolo11/
- https://docs.ultralytics.com/guides/raspberry-pi
- https://docs.ultralytics.com/integrations/tensorrt
- https://docs.ultralytics.com/datasets/detect/visdrone/
- https://github.com/ultralytics/ultralytics/issues/16211
- https://arxiv.org/abs/2509.25164 (YOLO26: Key Architectural Enhancements)

**PyTorch / CUDA / TensorRT**
- https://pytorch.org/blog/pytorch-2-14-release-blog/
- https://download.pytorch.org/whl/cu130/torch/
- https://download.pytorch.org/whl/cu128/torch/
- https://pypi.org/project/torch/
- https://pypi.org/project/tensorrt/

**Dữ liệu**
- https://github.com/VisDrone/VisDrone-Dataset
- https://github.com/ultralytics/ultralytics/blob/main/ultralytics/cfg/datasets/VisDrone.yaml
- https://ieee-dataport.org/documents/search-and-rescue-image-dataset-person-detection-sard
- https://github.com/ucas-vg/PointTinyBenchmark/tree/master/dataset (TinyPerson)
- https://github.com/miquelmarti/Okutama-Action
- https://huggingface.co/datasets/dronefreak/UAVDT

**Suy giảm / khôi phục**
- https://albumentations.ai/docs/
- https://pypi.org/project/albumentations/
- https://pypi.org/project/albumentationsx/
- https://github.com/albumentations-team/albumentations
- https://albumentations.ai/docs/api-reference/albumentations/augmentations/blur/transforms/
- https://albumentations.ai/docs/api-reference/albumentations/augmentations/pixel/noise/
- https://arxiv.org/abs/2107.10833 (Real-ESRGAN) · https://github.com/xinntao/Real-ESRGAN
- https://arxiv.org/abs/2103.14006 (BSRGAN) · https://github.com/cszn/BSRGAN
- https://arxiv.org/abs/2204.04676 (NAFNet) · https://github.com/megvii-research/NAFNet
- https://arxiv.org/abs/2111.09881 (Restormer) · https://github.com/swz30/Restormer
- https://github.com/cszn/SCUNet
- https://arxiv.org/abs/2109.14573 (FBCNN) · https://github.com/jiaxi-jiang/FBCNN
- https://arxiv.org/abs/2001.06826 (Zero-DCE) · https://github.com/Li-Chongyi/Zero-DCE
- https://arxiv.org/abs/2204.10137 (SCI) · https://github.com/vis-opt-group/SCI

**SR có giúp detection không / độ bền / thích nghi miền**
- https://arxiv.org/abs/1812.04098 (SR GIÚP: +13–36% mAP)
- https://arxiv.org/abs/1907.05283 (SR KHÔNG giúp: chênh 0.0002 AP)
- https://arxiv.org/abs/1907.07484 (COCO-C / Pascal-C benchmark độ bền)
- https://arxiv.org/abs/2308.15378 (độ bền trên ảnh hàng không, IEEE TGRS 2025)
- https://arxiv.org/abs/2101.12677 (thích nghi miền UAV)

**Phần cứng / công cụ**
- https://arxiv.org/abs/2505.24081 và https://arxiv.org/html/2505.24081v1 (benchmark ESP32-CAM)
- https://github.com/espressif/esp32-camera/issues/185 (`jpeg_quality` 0–63)
- https://blog.arducam.com/ov2640/ (OV2640 rolling shutter)
- https://components101.com/modules/esp32-cam-camera-module
- https://www.espboards.dev/esp32/esp32cam/
- https://www.raspberrypi.com/products/raspberry-pi-global-shutter-camera/
- https://hshop.vn/kit-rf-thu-phat-wifi-ble-esp32-cam
- https://hshop.vn/may-tinh-raspberry-pi-zero-2-w
- https://github.com/obss/sahi · https://pypi.org/project/sahi/
- https://arxiv.org/abs/2202.06934 (SAHI paper)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12078580/ (CF-YOLO — baseline VisDrone)
- https://github.com/DroneBridge/ESP32 · https://ardupilot.org/copter/docs/common-esp32-telemetry.html

## 9. URL CHƯA kiểm chứng (chỉ từ snippet tìm kiếm — kiểm tra lại trước khi trích dẫn)

- `pytorch.org/get-started/locally/` — **trả về nội dung CŨ** (PyTorch 1.13 / CUDA 11.8). Không dùng.
- `github.com/ultralytics/ultralytics/releases` — số phiên bản đúng nhưng **ngày tháng trả về sai**.
- `docs.ultralytics.com/compare/yolov8-vs-yolo26` — chỉ thấy qua tìm kiếm.
- arXiv 2605.24831 (YOLO26 vs YOLOv8 trên VisDrone) — **chỉ snippet, chưa mở**. Mở trước khi trích số.
- arXiv:2203.13278 (bài SCUNet — repo đã kiểm chứng, trang abstract thì chưa).
- arXiv:2609.13791 (JR², "Restore What Matters") · arXiv:2411.17226 (MWFormer) — hướng khôi phục
  hướng-tác-vụ, chỉ qua tìm kiếm.
- `github.com/bethgelab/robust-detection-benchmark` — chưa mở.
- `ipsar.fesb.unist.hr/HERIDAL database.html` — chỉ qua snippet; URL có dấu cách, cần `%20`.
- Trang Kaggle của SARD và HERIDAL — render JS, không đọc được badge giấy phép.
- `huggingface.co/datasets/Voxel51/VisDrone2019-DET` — mirror, chỉ qua tìm kiếm.
- `github.com/Akshathakrbhat/Manipal-UAV-Person-Dataset` — dataset UAV-person mới, chưa kiểm tra.
- Giá tại thegioiic.com và banlinhkien.com — chưa xác minh.
- Khối lượng XIAO ESP32S3 Sense (gram) — không tìm được.
- Giai thoại tầm anten IPEX "32% → 94% ở 45 m" — **một trường hợp đơn lẻ, không phải benchmark**.
