# AI Phase 2: Huấn luyện và thí nghiệm (VisDrone + ảnh suy giảm tổng hợp)

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | **AI Phase 1** (bắt buộc, toàn bộ). Không phụ thuộc luồng chính. Khuyến nghị chạy sau `phase-19`/`phase-21` theo ưu tiên của người dùng, nhưng **không bị chặn kỹ thuật** | ~45 giờ người (nhánh mặc định B+A; 41,5–46 tuỳ nhánh chốt, xem Timeline) + **30–60 giờ GPU chạy nền** *(chưa xác minh — lấy số thật từ `ml/results/smoke_report.md` của A1.10)* | Không |

## Mục tiêu

Trả lời bằng số liệu đo được: model nào tốt hơn cho người nhìn từ trên cao, huấn luyện trên ảnh đã suy giảm có thu hẹp khoảng cách miền không, cắt lát SAHI đổi bao nhiêu mili-giây lấy bao nhiêu điểm mAP, xuất sang TensorRT nhanh thêm bao nhiêu, và bộ khôi phục ảnh nào **thật sự** giúp máy nhận dạng chứ không chỉ làm ảnh đẹp mắt người.

Xong phase này có: ba bộ trọng số đã huấn luyện, một engine TensorRT đã cắm vào backend, một harness so sánh 6 bộ khôi phục ảnh, và `ml/results/REPORT.md` với mọi bảng **chạy được ngay bằng VisDrone + ảnh suy giảm tổng hợp** đã điền số.

**Phạm vi bị khoá có chủ đích.** Phase này **không dùng ảnh tự thu**. Ảnh camera thật, ảnh cặp, và dữ liệu bay theo độ cao thuộc **AI Phase 3** — ở đây chúng chỉ tồn tại dưới dạng **ô trống có nhãn rõ ràng** trong bảng báo cáo và một **giao thức thu dữ liệu** bàn giao sang AI Phase 3. Không chờ dữ liệu bay mới bắt đầu.

## Đầu vào cần có

- **AI Phase 1 đã qua toàn bộ cổng pass.** Đặc biệt: `ml/results/dataset_stats.json`, `ml/results/smoke_report.md` (giây/epoch thật), `ml/degrade/` có test xanh, `evaluate.py` in được `coco.AR_small`.
- `plans/QUYET-DINH-CHUA-CHOT.md` — Quyết định 2 (đề tài Xử lý ảnh). **Phải đọc ở bước A2.0.**
- `plans/reports/260921-research-ai-vision-pipeline.md` §1.4 (kỳ vọng mAP), §3.3–3.6 (suy giảm, khôi phục, ma trận thí nghiệm), §5.2–5.3 (xuất model, SAHI).
- `docs/bao-cao-tong-quan-du-an.md` §6.2 (thang model A→G), §6.4 (ma trận thí nghiệm), §6.5 (nguyên tắc báo cáo).
- `plans/_phase-index.md` — tra chéo số phase.
- Ít nhất **15 GB trống** trên ổ D: cho bản VisDrone đã suy giảm, các checkpoint và trọng số bộ khôi phục.

## File và thư mục sở hữu

**Tạo mới**

```
ml/restore/__init__.py            REGISTRY: none | bicubic | fbcnn | nafnet | realesr | zerodce | sci
ml/restore/base.py                giao diện Restorer chung
ml/restore/none.py                bản đối chứng (identity)
ml/restore/bicubic.py             đối chứng nội suy — BẮT BUỘC, xem A2.5
ml/restore/fbcnn.py
ml/restore/nafnet.py
ml/restore/realesr.py
ml/restore/zerodce.py
ml/restore/sci.py
ml/restore/WEIGHTS.md             URL + sha256 + giấy phép từng file trọng số
ml/scripts/bench_restore.py
ml/scripts/sahi_eval.py
ml/scripts/export_and_bench.py
ml/configs/visdrone_person_degraded.yaml
ml/experiments/README.md
ml/experiments/ma-tran-thi-nghiem.md
ml/experiments/protocol-thu-du-lieu.md      bàn giao sang AI Phase 3
ml/results/REPORT.md
ml/tests/test_restore_registry.py
```

**Sửa file đã có**

```
ml/scripts/evaluate.py        CHỈ THÊM cờ --sahi và --restorer; KHÔNG đổi/xoá khoá nào
                              trong metrics.json (hợp đồng của A1.6)
ml/weights/                   chứa .pt/.onnx/.engine sinh ra (đã gitignore)
plans/QUYET-DINH-CHUA-CHOT.md CHỈ THÊM mục "Đã chốt" ở cuối, không sửa nội dung cũ
.env / .env.example           trỏ YOLO_WEIGHTS sang engine tốt nhất (A2.4)
```

**Sinh ra khi chạy (không commit)**: `ml/datasets/visdrone_person_degraded/**`, `ml/results/r0*/**`, `ml/weights/**`.

**Tuyệt đối không đụng**: `ml/degrade/**` và `ml/scripts/{train,convert_visdrone_person,split_dataset}.py` (thuộc AI Phase 1 — nếu cần sửa thì sửa ở đó rồi chạy lại test của AI Phase 1), `backend/mavlink/**`, `frontend/**`, `firmware/**`, mọi file `plans/phase-*.md` của luồng chính.

---

## Việc theo thứ tự

### A2.0 Chốt đề tài môn Xử lý ảnh

**Làm gì.** Đọc `plans/QUYET-DINH-CHUA-CHOT.md` → Quyết định 2. Nếu file đó **chưa có mục "Đã chốt"**, thì **dừng ở đây** và chạy phiên chốt đề tài theo đúng hướng dẫn ở đầu file đó (mở phiên Claude mới, dán câu lệnh có sẵn trong file). Không đoán thay người dùng.

Bốn hướng đang mở: **A** (đo hồ sơ suy giảm rồi mô phỏng theo số đo), **B** (khôi phục ảnh có thật sự giúp nhận dạng không), **C** (đánh giá khôi phục bằng hình học thay vì bằng AI), **D** (vòng điều khiển chất lượng nén khép kín). Báo cáo nghiên cứu §3.7 xếp hạng và khuyến nghị **B làm trục chính, A bổ trợ** — lý do và lập luận nằm nguyên trong file quyết định, không nhắc lại ở đây.

**Điểm quan trọng: A2.1 → A2.4 chạy giống hệt nhau ở cả bốn nhánh.** Model, dataset, SAHI và xuất engine là **thước đo** dùng chung — không có công sức nào bị lãng phí dù chốt hướng nào. Chỉ **A2.5 và A2.6** rẽ nhánh. Vì vậy nếu quyết định chưa xong, vẫn **bắt đầu A2.1 được ngay**; chỉ không được bắt đầu A2.5.

**Mặc định nếu chưa chốt khi tới bước này: B+A** (đúng khuyến nghị trong `plans/QUYET-DINH-CHUA-CHOT.md`) — dùng con số Timeline của nhánh B+A bên dưới và tiếp tục A2.5/A2.6 theo nhánh đó; đổi lại sau nếu người dùng chốt khác.

**Bảng rẽ nhánh — đề tài đã chốt quyết định cái gì thay đổi:**

| Đề tài đã chốt | A2.5 làm gì | Thí nghiệm trọng tâm ở A2.6 | Dữ liệu cần thêm (AI Phase 3) | Việc phát sinh ngoài AI Phase 2 |
|---|---|---|---|---|
| **B** — "khôi phục ảnh có thật sự giúp nhận dạng không" | Harness đầy đủ 7 mục `none / bicubic / FBCNN / NAFNet / realesr-general-x4v3 / Zero-DCE / SCI`, chạy ngay trên VisDrone-val đã suy giảm; chạy lại trên ảnh cặp thật ở AI Phase 3 | TN C là trung tâm; TN A và B bổ trợ | 300–500 cặp ESP32 ↔ điện thoại (A3.5) | Script căn chỉnh ORB/SIFT + homography + RANSAC (AI Phase 3); thêm PSNR/SSIM/LPIPS vào bảng |
| **B + A** (khuyến nghị trong file quyết định) | Như B, **cộng thêm**: thay phân bố tham số phỏng đoán trong `degrade_esp32.yaml` bằng số đo thật rồi sinh lại tập suy giảm | TN B (augment suy giảm) lên thành thí nghiệm chính thứ hai: *suy giảm theo số đo* vs *suy giảm đoán bừa* | Thêm buổi chụp bảng ISO 12233 / thang xám / lưới ô vuông / con lắc (A3.7, chi phí ~0₫) | Script đo MTF, (a,b) nhiễu Poisson–Gauss, hệ số méo → ghi vào YAML; huấn luyện lại `r04_yolo26n_degraded_measured` |
| **C** — đánh giá bằng hình học | Harness giữ nguyên bộ khôi phục nhưng **đổi chỉ số**: tỉ lệ đặc trưng inlier (ORB/AKAZE) và sai số reprojection thay cho mAP; YOLO tụt xuống vai trò kiểm chứng phụ | TN C với chỉ số hình học; **bỏ TN D** | Ảnh bay tuyến zigzag hoặc thu bằng sào, có chồng lấn (A3.6) | Script ghép ảnh / đăng ký ảnh mới; gần như không cần GPU |
| **D** — vòng QoS khép kín | Harness giữ nguyên, **thêm `jpeg_quality` (0–63) làm một trục biến thiên** | Thí nghiệm riêng: đường cong mAP theo q, và "độ chính xác trên mỗi byte truyền" | Quét toàn dải q trong một chuyến bay (A3.4); cần firmware `set_quality()` của `phase-12` và vòng điều khiển của `phase-24` | Bộ điều khiển trong backend; **rủi ro tiến độ cao nhất** vì phụ thuộc toàn chuỗi firmware → backend → detector |

Ghi kết quả chốt vào cuối `plans/QUYET-DINH-CHUA-CHOT.md` dưới dạng:

```markdown
## Đã chốt (ngày YYYY-MM-DD)

- Quyết định 1 (camera): <phương án> — lý do: <một câu>
- Quyết định 2 (đề tài XLA): <A | B | C | D | B+A> — lý do: <một câu>
- Người chốt: <tên>. Các phase bị ảnh hưởng: ai-phase-02 (A2.5, A2.6), ai-phase-03, ai-phase-04.
```

**Kết quả mong đợi.** File quyết định có mục "Đã chốt"; đọc bảng trên biết ngay A2.5 sẽ làm gì.

**Nếu lỗi:**

- Người dùng chưa quyết được: vẫn chạy A2.1 → A2.4 bình thường, để trống A2.5, và **ghi rõ trong `REPORT.md`** rằng phần đó đang chờ. Không tự chọn thay.
- Chốt hướng D: kiểm luôn `phase-12` và `phase-24` đã tới đâu — D là hướng duy nhất **bị chặn** bởi luồng chính.

---

### A2.1 Model đối chứng và model chính trên VisDrone-person

**Làm gì.** Huấn luyện hai model **ở cấu hình y hệt nhau** rồi so sánh. YOLO11n là bản đối chứng (có nhiều số liệu VisDrone công bố để đối chiếu); YOLO26n là dòng chính vì nó có **STAL — Small-Target-Aware Label Assignment**, đúng cơ chế gán nhãn giữ được độ phủ nhãn dương cho vật thể nhỏ. Bài toán ở đây là người cao ~38 px ở độ cao 8 m — chính là trường hợp STAL được thiết kế để xử lý.

Phải ghi trung thực một điểm ngược: trên T4 với TensorRT, YOLO26n **chậm hơn** YOLO11n (1.7 ms vs 1.5 ms) vì đầu one-to-one end-to-end có chi phí riêng. Ở đề tài này tốc độ không phải nút thắt (camera chỉ cho 14.19 fps), nên đánh đổi chấp nhận được. **Đừng viết rằng YOLO26 "nhanh hơn mọi mặt".**

**Lệnh chạy (PowerShell, trong `ml\.venv`):**

```powershell
.\ml\.venv\Scripts\Activate.ps1

# Đối chứng
python ml\scripts\train.py --data ml\configs\visdrone_person.yaml `
  --model yolo11n.pt --epochs 100 --imgsz 640 --batch -1 --seed 0 `
  --patience 30 --optimizer AdamW --lr0 0.001 --name r01_yolo11n_visdrone

# Dòng chính
python ml\scripts\train.py --data ml\configs\visdrone_person.yaml `
  --model yolo26n.pt --epochs 100 --imgsz 640 --batch -1 --seed 0 `
  --patience 30 --optimizer AdamW --lr0 0.001 --name r02_yolo26n_visdrone

# Đánh giá trên val VÀ trên test-dev, cùng ngưỡng, cùng imgsz
foreach ($r in "r01_yolo11n_visdrone","r02_yolo26n_visdrone") {
  foreach ($s in "val","test") {
    python ml\scripts\evaluate.py --weights ml\results\$r\weights\best.pt `
      --data ml\configs\visdrone_person.yaml --split $s --condition normal
  }
}
```

Đánh giá thêm **Model A của §6.2** (COCO pretrained, không tinh chỉnh) để có điểm xuất phát: chạy `evaluate.py` với `--weights yolo26n.pt` trên `visdrone_person/val`. Không train gì.

**Nguyên tắc so sánh công bằng — giữ cố định giữa mọi run:** `imgsz=640`, `seed=0`, cùng tập val/test, cùng `conf=0.001` và `iou=0.7` khi val (chuẩn kiểu COCO), cùng phiên bản ultralytics. Chỉ đổi đúng một thứ mỗi lần so.

**Về phương sai do seed — điều dễ bị bỏ qua nhất.** Chênh lệch 1–2 điểm mAP giữa hai model **có thể chỉ là nhiễu của seed**, không phải sự khác biệt thật. Luật:

- Đọc `ml/results/smoke_report.md` (A1.10). Nếu tổng thời gian cho **2 seed × 2 model ≤ ~30 giờ GPU** thì chạy thêm `--seed 1` cho cả hai và báo cáo **trung bình ± khoảng** của 2 seed.
- Nếu không đủ thời gian: chạy 1 seed, và **ghi thẳng trong `REPORT.md`**: *"mỗi cấu hình chạy 1 seed; chênh lệch dưới 2 điểm mAP không được diễn giải là khác biệt thật."* Trung thực về hạn chế đáng giá hơn một bảng đẹp không kiểm chứng được.

**Kỳ vọng — phần dễ gây vỡ kỳ vọng nhất của cả đồ án.** Số liệu công bố (CF-YOLO, *Scientific Reports*, cùng VisDrone, imgsz 640):

| Chỉ số | YOLOv11n baseline |
|---|---|
| mAP50 toàn bộ 10 lớp | 32.2% |
| mAP50-95 toàn bộ | 18.6% |
| **mAP50 lớp `pedestrian`** | **21.9%** |
| **mAP50 lớp `people`** | **11.7%** |

Lọc còn một lớp `person` duy nhất thường **nâng** con số trên (bớt nhầm lẫn giữa hai lớp, bớt cạnh tranh với 8 lớp phương tiện). **Mục tiêu thực tế cho `r02`: mAP50 trong khoảng 30–45%**, không phải 80%+.

**Kết quả mong đợi.** Hai thư mục run với `best.pt`, bốn file `metrics.json` (2 model × 2 split), `r02` đạt mAP50 ≥ 30% trên `visdrone_person/val`.

**Nếu lỗi:**

- `r02` dưới 30%: **không được lặng lẽ chấp nhận.** Chạy checklist chẩn đoán ở "Cổng pass" bên dưới trước khi kết luận.
- `r01` và `r02` chênh dưới 1 điểm: bình thường — đó là kết quả hợp lệ và phải báo cáo đúng như vậy, kèm ghi chú về seed.
- Huấn luyện dừng sớm ở epoch ~40 vì `patience=30`: bình thường, không phải lỗi. Ghi lại epoch tốt nhất.
- Mất điện / máy sập giữa chừng: `--resume` tiếp tục từ `last.pt`.

---

### A2.2 Model huấn luyện trên VisDrone đã suy giảm

**Làm gì.** Trả lời câu hỏi: *thêm pipeline suy giảm lúc huấn luyện có làm model bền hơn trước ảnh xấu không, ngay cả khi chưa hề có ảnh camera thật?*

**Chọn cách áp suy giảm: sinh sẵn ra đĩa (offline), không áp lúc chạy (online).** Lý do: tái lập được (cùng seed cho cùng byte), kiểm tra bằng mắt được, và khớp với khái niệm "tập VisDrone-ESP32 tổng hợp" ở §6.1. Giá phải trả là ~2 GB đĩa và ít đa dạng hơn — chấp nhận được.

**Thành phần tập train: trộn 50/50 ảnh sạch và ảnh suy giảm**, không thay thế hoàn toàn. Nếu chỉ train trên ảnh xấu, model mất luôn khả năng trên ảnh sạch và bảng 2×2 dưới đây mất một nửa ý nghĩa.

```powershell
# Sinh bản suy giảm cho TRAIN và VAL. KHÔNG sinh cho TEST.
python ml\scripts\make_degraded_dataset.py `
  --src ml\datasets\visdrone_person\train --out ml\datasets\visdrone_person_degraded\train `
  --config ml\configs\degrade_esp32.yaml --seed 0 --workers 8
python ml\scripts\make_degraded_dataset.py `
  --src ml\datasets\visdrone_person\val --out ml\datasets\visdrone_person_degraded\val `
  --config ml\configs\degrade_esp32.yaml --seed 0 --workers 8

# Train trên tập trộn
python ml\scripts\train.py --data ml\configs\visdrone_person_degraded.yaml `
  --model yolo26n.pt --epochs 100 --imgsz 640 --batch -1 --seed 0 `
  --name r03_yolo26n_visdrone_degraded
```

`ml/configs/visdrone_person_degraded.yaml` trỏ `train:` vào một file danh sách gồm **cả** `visdrone_person/train/images` lẫn `visdrone_person_degraded/train/images`; `val:` giữ nguyên tập sạch để so sánh được với `r02`.

**Bảng 2×2 phải điền — đây là bảng khoảng cách miền:**

| | Đánh giá trên **val sạch** | Đánh giá trên **val đã suy giảm** |
|---|---|---|
| `r02` (train ảnh sạch) | (chuẩn tham chiếu) | ô này cho thấy model tụt bao nhiêu khi gặp ảnh xấu |
| `r03` (train có suy giảm) | có tụt trên ảnh sạch không? | có phục hồi được phần đã mất không? |

Mỗi ô ghi mAP50 / mAP50-95 / **AR-small**.

> **Ghi chú trung thực bắt buộc.** Đây là **đại diện** cho khoảng cách miền, **không phải khoảng cách miền thật**: cả hai phía đều là ảnh VisDrone, chỉ khác là một bên bị suy giảm bằng tham số **phỏng đoán**. Khoảng cách miền thật chỉ đo được khi có ảnh camera của nhóm (AI Phase 3, TN A). Phải viết đúng điều này trong `REPORT.md`; nếu không thì bảng trên bị đọc thành một kết luận mạnh hơn dữ liệu cho phép.

**Kết quả mong đợi.** `r03` đạt mAP50 trên **val đã suy giảm** cao hơn `r02` trên cùng tập đó — nếu không, pipeline suy giảm hoặc quá nhẹ (không dạy được gì) hoặc quá nặng (huỷ mục tiêu). Cả hai trường hợp đều đáng báo cáo, kèm ảnh xem thử để người đọc tự đánh giá.

**Nếu lỗi:**

- Sinh tập suy giảm chạy hàng giờ: dùng `--workers 8`; ảnh VisDrone tới 2000×1500 nên `cv2.remap` nặng.
- Hết đĩa: sinh tập train trước, train xong rồi mới sinh val; hoặc giảm tỉ lệ trộn.
- `r03` tệ hơn `r02` **ở cả hai cột**: tỉ lệ trộn sai (đang gần 100% ảnh xấu) hoặc suy giảm quá tay. Mở `ml/results/degrade_preview/` ra xem bằng mắt.

---

### A2.3 SAHI — suy luận theo lát cắt

**Làm gì.** Người nhìn từ 8 m chỉ chiếm ~38 px. Nếu đưa cả ảnh 2000×1500 về 640 thì người teo xuống còn hơn chục pixel. SAHI cắt ảnh **ở độ phân giải gốc** thành các lát chồng lấn, chạy phát hiện trên từng lát rồi gộp lại — mỗi lát người chiếm tỉ lệ lớn hơn nhiều.

Đây là chỗ **đổ ngân sách tính toán dư thừa vào độ chính xác**: camera chỉ cho 14.19 fps, còn GPU thì dư gấp 5–14 lần, nên chạy N lát mỗi khung là đánh đổi đúng hướng.

```powershell
uv pip install "sahi>=0.12.6"

python ml\scripts\sahi_eval.py --weights ml\results\r02_yolo26n_visdrone\weights\best.pt `
  --data ml\configs\visdrone_person.yaml --split val `
  --slice 256,320,512 --overlap 0.1,0.2,0.3 --with-standard-pred `
  --out ml\results\sahi_sweep.json
```

`ml/scripts/sahi_eval.py` dùng `AutoDetectionModel.from_pretrained(model_type="ultralytics", ...)` rồi `get_sliced_prediction(..., postprocess_type="GREEDYNMM", postprocess_match_metric="IOS")`, xuất dự đoán ra **cùng định dạng COCO detections** mà `coco_eval.py` của A1.6 đọc được — để mọi con số so sánh được trực tiếp với A2.1.

**Bảng quét (tối thiểu 6 cấu hình):** `slice ∈ {256, 320, 512}` × `overlap ∈ {0.1, 0.2, 0.3}`, mỗi ô ghi mAP50, mAP50-95, **AR-small**, ms/khung, số lát mỗi khung. Cộng một dòng "toàn khung, không SAHI" làm mốc.

**Cách diễn giải phải đúng.** Bài báo SAHI báo cáo tăng AP **6.8%** (chỉ suy luận) và **12.7%** (cộng dồn với tinh chỉnh theo lát) — nhưng đó là của detector **FCOS**, trên VisDrone + xView, **không phải YOLO**. Khi viết báo cáo phải ghi rõ tên detector. Mức tăng khi áp lên YOLO26n là **câu hỏi mở mà đề tài tự trả lời** — một đóng góp nhỏ nhưng thật.

**Ràng buộc thời gian cần ghi lại.** Với 12–20 lát mỗi khung, độ trễ ước **60–150 ms/khung** *(chưa xác minh — phải đo)*. Nếu đúng vậy thì SAHI chạy ~7–16 fps, tức phải chạy phát hiện ở tốc độ thấp hơn camera. Điều này khớp với kiến trúc đã duyệt (YOLO 3–5 fps, tách khỏi fps video) — ghi số đo thật vào `REPORT.md` để biện minh cho lựa chọn đó bằng dữ liệu thay vì bằng phỏng đoán.

**Kết quả mong đợi.** `sahi_sweep.json` có ≥ 6 cấu hình; xác định được cấu hình tốt nhất theo **điểm mAP tăng thêm trên mỗi ms bỏ ra**, không chỉ theo mAP cao nhất.

**Nếu lỗi:**

- OOM khi lát nhỏ + ảnh lớn: giảm `batch` trong SAHI, hoặc tăng kích thước lát.
- SAHI chậm hơn dự kiến nhiều: tắt `perform_standard_pred` (bỏ lượt chạy toàn khung) và đo lại.
- mAP **giảm** khi bật SAHI: thường do khâu gộp — thử `postprocess_type="NMS"` và chỉnh ngưỡng; cũng kiểm xem đang chạy trên ảnh gốc hay ảnh đã bị thu nhỏ (chạy SAHI trên ảnh đã thu nhỏ là vô nghĩa).

---

### A2.4 Xuất ONNX / TensorRT, đo fps, cắm vào backend

**Làm gì.** Model `.pt` chạy được nhưng chậm hơn mức có thể. TensorRT biên dịch riêng cho đúng GPU này nên nhanh hơn đáng kể. Phần này đo thật rồi cắm bản nhanh nhất vào backend.

```powershell
uv pip install tensorrt onnxruntime-gpu      # chọn biến thể CUDA-13 cho khớp torch cu130

python ml\scripts\export_and_bench.py `
  --weights ml\results\r02_yolo26n_visdrone\weights\best.pt `
  --formats pt,pt-half,onnx,engine --imgsz 640 --warmup 30 --frames 300 `
  --out ml\results\bench_backends.json
```

Bên trong: `model.export(format="onnx", opset=17, dynamic=True, simplify=True)` và `model.export(format="engine", device=0, half=True)`. **`opset=17`** là mức Ultralytics khuyến nghị cho tương thích TensorRT.

**Giao thức đo:** warmup 30 khung, đo 300 khung, `batch=1`, `imgsz=640`, báo cáo p50/p95/fps cho từng backend, kèm tên GPU và phiên bản driver.

**Kiểm tra tương đương độ chính xác — bước dễ bị bỏ qua và là cái bẫy kinh điển.** Sau khi xuất, chạy `evaluate.py` trên `.engine` và so mAP50 với `.pt`. **Chênh quá ±0.5 điểm là có vấn đề** (thường do FP16 hoặc do khác biệt ở khâu tiền xử lý), không được lặng lẽ dùng tiếp. Một bản xuất nhanh hơn nhưng kém chính xác hơn mà không ai phát hiện là cách tệ nhất để mất điểm.

**Ước lượng fps, CHƯA XÁC MINH — phải tự đo, không trích dẫn:** PyTorch CUDA FP16 khoảng **60–120 fps**; TensorRT FP16 khoảng **100–200+ fps**. Ultralytics quảng cáo "tăng tốc tới 5× với TensorRT" — đó là **con số marketing của nhà cung cấp**, không phải benchmark độc lập. Ghi số tự đo.

**Cắm vào backend:** đặt trong `.env`

```dotenv
YOLO_WEIGHTS=ml/weights/r02_yolo26n_visdrone.engine
YOLO_DEVICE=0
DETECTION_IMGSZ=640
```

`backend/vision/detector.py` (chủ sở hữu chốt ở phase khác, ngoài phạm vi AI Phase 1/2 — xem `plans/ai/ai-phase-01-chuan-bi.md` bảng ranh giới) đã được thiết kế nhận cả ba đuôi nên không phải sửa code khi đổi weights. Thêm một điều: khi nạp `.engine` thất bại (deserialize lỗi), detector phải **quay về `.pt` kèm cảnh báo to**, không im lặng. Lý do: file `.engine` gắn chặt với GPU và phiên bản driver/TensorRT — **cập nhật driver là nó chết**. Không commit `.engine` vào git, không chia sẻ giữa máy khác nhau.

**Kết quả mong đợi.** `bench_backends.json` có 4 dòng; `.engine` nhanh nhất; mAP50 của `.engine` nằm trong ±0.5 điểm so với `.pt`; backend khởi động được với engine.

**Nếu lỗi:**

- `pip install tensorrt` không có wheel khớp CUDA 13 trên Python 3.11 (bản pip hỗ trợ 3.8–3.13, nên bản thân 3.11 không phải nghi phạm — nhưng khớp CUDA 13 thì **chưa xác minh** ở thời điểm viết kế hoạch). Dự phòng: dùng `.pt` với `half=True` và ghi rõ trong báo cáo rằng nhánh TensorRT chưa chạy được, kèm lý do.
- `onnxruntime-gpu` đòi CUDA 12: dùng ORT trên CPU chỉ để kiểm tính đúng, còn đo tốc độ thì dựa vào `.pt`/`.engine`.
- Xuất engine mất 10–20 phút: bình thường, TensorRT đang dò thuật toán tối ưu.
- mAP của engine tụt hẳn: thử xuất lại với `half=False` để tách nguyên nhân FP16.

---

### A2.5 Harness so sánh các bộ khôi phục ảnh

> Việc này **rẽ nhánh theo đề tài đã chốt ở A2.0**. Nội dung dưới đây viết cho nhánh **B / B+A** (trục chính). Nhánh C đổi chỉ số sang hình học; nhánh D thêm trục `jpeg_quality`. Xem bảng ở A2.0.

**Làm gì.** Trả lời câu hỏi trung tâm: *cho ảnh xấu qua phần mềm làm đẹp trước rồi mới đưa cho YOLO, thì YOLO nhận ra người tốt hơn — hay ảnh chỉ đẹp với mắt người còn máy vẫn mù như cũ?*

Câu hỏi này **đang có hai đáp án trái ngược trong tài liệu công khai**: một bài báo cáo siêu phân giải tăng **13–36% mAP**; bài khác báo cáo siêu phân giải **không hơn nội suy nearest-neighbor** (chênh 0.0002 AP). Việc nhóm đo lại trên dữ liệu của chính mình vì thế là đóng góp hợp lệ, không phải chạy lại thư viện.

**Thiết kế: registry cắm-rút được**, để thêm một bộ khôi phục chỉ cần thêm một file (luật "dữ liệu điều khiển, không hardcode"):

```python
# ml/restore/__init__.py
REGISTRY = {
    "none":     NoneRestorer,      # đối chứng 1: không làm gì
    "bicubic":  BicubicRestorer,   # đối chứng 2: BẮT BUỘC (xem dưới)
    "fbcnn":    FbcnnRestorer,
    "nafnet":   NafnetRestorer,
    "realesr":  RealEsrGeneralRestorer,
    "zerodce":  ZeroDceRestorer,
    "sci":      SciRestorer,
}
```

Mỗi lớp cài `base.Restorer`: `name`, `warmup()`, `__call__(bgr) -> bgr`, `ms_last`.

**Đối chứng `bicubic` là bắt buộc, không phải tuỳ chọn.** Bài báo "SR không giúp" so siêu phân giải với **nội suy đơn giản** và thấy gần như bằng nhau. Nếu harness không có dòng nội suy thuần thì **không thể kết luận được gì** — mọi mức tăng đo được đều có thể chỉ là hiệu ứng của việc phóng to ảnh. Đây là điều kiện cần của toàn bộ thí nghiệm.

**Bảng bộ khôi phục và giấy phép:**

| Mục | Nhắm vào trục suy giảm nào | Giấy phép | Ghi chú |
|---|---|---|---|
| `none` | — | — | Đối chứng bắt buộc |
| `bicubic` | phóng đại | OpenCV, BSD | **Đối chứng bắt buộc**, xem trên |
| `fbcnn` | artifact nén JPEG | Apache-2.0 | Khớp nhất với trục nén JPEG; một model phủ toàn dải hệ số chất lượng |
| `nafnet` | nhoè + nhiễu | **kiểm LICENSE trong repo trước khi dùng** | Hiệu quả rất cao trên mỗi FLOP; có biến thể width-32 nhẹ |
| `realesr` (`realesr-general-x4v3`) | tổng hợp | BSD-3-Clause | Bản nhẹ SRVGGNetCompact; dùng làm **trần trên chất lượng** |
| `zerodce` | thiếu sáng | **CC BY-NC 4.0 — chỉ phi thương mại** | Ổn cho đồ án, **bắt buộc ghi rõ** trong mục giấy phép |
| `sci` | thiếu sáng | **kiểm LICENSE** | Thiết kế để rẻ; repo có sẵn kết quả downstream detection để đối chiếu |

`ml/restore/WEIGHTS.md` ghi mỗi file trọng số: URL tải, **sha256**, giấy phép, ngày tải. Trọng số để ở `ml/weights/restore/` (đã gitignore), **không commit**.

**Harness `ml/scripts/bench_restore.py`:**

```powershell
python ml\scripts\bench_restore.py `
  --weights ml\results\r02_yolo26n_visdrone\weights\best.pt `
  --restorers none,bicubic,fbcnn,nafnet,realesr,zerodce,sci `
  --data ml\datasets\visdrone_person_degraded\val `
  --out ml\results\restore_bench.json
```

Mỗi bộ khôi phục cho một dòng: mAP50, mAP50-95, **AR-small**, `ms_restore`, `ms_detect`, `ms_total`, fps, và — quan trọng nhất — **phân tầng theo rổ chiều cao hộp** (`<16`, `16–32`, `32–64`, `>64` px). Giả thuyết cần kiểm: *mức cải thiện lớn hơn với mục tiêu nhỏ/xa so với mục tiêu lớn/gần.* Không phân tầng thì không kiểm được giả thuyết này.

Chỉ số chất lượng ảnh: ở AI Phase 2 chỉ có **không tham chiếu** (NIQE/BRISQUE, tuỳ chọn) vì không có ảnh gốc "đẹp thật". PSNR/SSIM/LPIPS chỉ có nghĩa khi có **ảnh cặp thật** — thuộc AI Phase 3.

**Vị trí cắm vào đường ống phải ghi rõ:** bộ khôi phục chạy **trên ảnh gốc, trước bước letterbox/resize của detector**. Cắm sau đó là đang khôi phục một ảnh đã mất thông tin, và kết quả sẽ vô nghĩa.

**Kết quả mong đợi.** `restore_bench.json` có ≥ 5 dòng (trong đó bắt buộc có `none` và `bicubic`); vẽ được biểu đồ "Δ mAP50 theo ms/khung" và "Δ AR-small theo ms/khung".

**Nếu lỗi:**

- Tải được model nhưng chạy sai màu (ảnh tím/xanh): nhầm BGR ↔ RGB. Giao diện `Restorer` quy định **vào BGR, ra BGR**; mỗi lớp tự chuyển bên trong.
- `zerodce`/`sci` làm mAP giảm mạnh: hợp lý — chúng nhắm vào thiếu sáng, mà VisDrone chủ yếu ban ngày. **Đây là kết quả, không phải lỗi**: nó cho thấy chọn bộ khôi phục phải khớp với trục suy giảm thật.
- OOM khi chạy `realesr` trên ảnh 2000×1500: xử lý theo ô (tile) — Real-ESRGAN có sẵn tuỳ chọn tile.
- Chênh lệch giữa các bộ nhỏ hơn nhiễu: tăng số ảnh đánh giá, và báo cáo **khoảng tin cậy bootstrap** thay vì một con số trần trụi.

---

### A2.6 Ma trận bốn thí nghiệm và giao thức bàn giao cho AI Phase 3

**Làm gì.** Viết `ml/experiments/ma-tran-thi-nghiem.md` — bảng nói rõ **câu hỏi nào đang được trả lời**, khác với bảng model ở §6.2 vốn nói *cái gì được huấn luyện*.

| TN | Câu hỏi | Giả thuyết | Biến thiên | Chỉ số | Chạy được ở AI Phase 2? |
|---|---|---|---|---|---|
| **A — Khoảng cách miền** | Model chỉ train trên VisDrone tụt bao nhiêu khi gặp ảnh camera thật? | Tụt đáng kể, do khác biệt cảm biến/ống kính/độ cao/nén, không chỉ do ngoại hình vật thể | Không gì — cùng trọng số, hai tập test | mAP50, mAP50-95, AR-small | **Chỉ đại diện.** Bản thật cần ≥100–200 khung camera đã gán nhãn → **AI Phase 3** |
| **B — Augment suy giảm khi huấn luyện** | Thêm pipeline suy giảm lúc train có thu hẹp khoảng cách ở TN A không? | Thu hẹp một phần, vì ép model bất biến với artifact kiểu camera nhúng ngay cả khi **không có** ảnh miền đích | Có / không pipeline suy giảm | như trên, trên cả hai tập | **CÓ — đó chính là A2.2** |
| **C — Front-end khôi phục lúc suy luận** | Bộ khôi phục nào tăng mAP, bộ nào chỉ tăng độ đẹp, và mỗi bộ tốn bao nhiêu ms? | Cải thiện nhiều hơn so với chỉ augment (TN B), nhưng đánh đổi độ trễ; và **mức cải thiện lớn hơn với mục tiêu nhỏ** | 7 mục trong registry | mAP, AR-small, ms/khung, phân tầng theo cỡ | **CÓ trên ảnh suy giảm tổng hợp (A2.5).** Trên ảnh cặp thật → AI Phase 3 |
| **D — Độ cao / tỉ lệ** | Độ chính xác giảm theo độ cao nhanh hơn hay đúng bằng dự đoán thuần theo số pixel? | **Nhanh hơn** — vì ở độ cao lớn hơn, cùng lượng artifact chiếm tỉ lệ lớn hơn trên diện tích (nay nhỏ hơn) của mỗi người, tức **suy giảm và tỉ lệ tương tác với nhau** | Chỉ độ cao: 5 m / 8 m / 12–15 m | AR-small phân tầng theo dải độ cao, bảng 3×3 | **KHÔNG — bắt buộc phải bay thật.** Chuyển sang AI Phase 3 (A3.3) |

Giả thuyết của **TN D là đóng góp trí tuệ nguyên bản nhất trong bốn cái** — nó dự đoán một *tương tác* chứ không phải một hiệu ứng chính, và **có thể bị bác bỏ bằng dữ liệu**. Nếu số liệu cho thấy suy giảm theo độ cao khớp đúng dự đoán thuần theo pixel thì giả thuyết sai — và đó **vẫn là một kết quả đáng báo cáo**.

**Giao thức bàn giao — `ml/experiments/protocol-thu-du-lieu.md`.** Đây là sản phẩm quan trọng nhất của A2.6: danh sách yêu cầu để AI Phase 3 đi thu đúng thứ cần, không phải bay lại lần hai. Tối thiểu phải ghi:

- **Ba dải độ cao** 5 m / 8 m / 12–15 m, mỗi dải **≥ 100–150 khung đã gán nhãn**. Giữ các điều kiện khác tương đương: cùng số người, cùng tư thế, cùng khoảng giờ trong ngày, cùng nền.
- **Quét `jpeg_quality`** trong cùng một chuyến bay (giá trị đổi được lúc chạy) để có đường cong mAP theo q trên dữ liệu thật.
- **Ghi `jpeg_quality` vào metadata của TỪNG khung.** Không làm thì sau này không phân tầng theo q được, và **mất luôn một trục của ma trận** — đây là thứ mất rồi thì không lấy lại được.
- Ghi độ cao từ telemetry cho từng khung; ghi `session_id` theo quy ước của A1.4.
- **300–500 cặp ảnh** camera rẻ ↔ điện thoại cho nhánh B (chụp bằng sào cũng được, không nhất thiết phải bay).
- Tập test cuối cùng: **300–500 khung ảnh thật, chưa augment**.

**Kết quả mong đợi.** Hai file trong `ml/experiments/`; mỗi TN ghi rõ trạng thái *đã chạy* / *chờ dữ liệu bay*.

**Nếu lỗi:**

- Muốn chạy TN D bằng cách cắt ảnh VisDrone cho nhỏ lại để giả lập độ cao: **không hợp lệ.** Thu nhỏ ảnh không tái tạo được việc artifact chiếm tỉ lệ lớn hơn — mà đó chính là nội dung của giả thuyết. Ghi vào phần "đã cân nhắc và loại".

---

### A2.7 Mẫu báo cáo `ml/results/REPORT.md`

**Làm gì.** Một file duy nhất tập hợp mọi bảng, để AI Phase 4 chỉ việc viết prose quanh nó. **Mọi bảng đều có cột AR-small.**

**Bảng 1 — So sánh model (VisDrone-val và test-dev)**

| Run | Model | Train trên | mAP50 | mAP50-95 | **AR-small** | Params (M) | GFLOPs | ms/khung | fps |
|---|---|---|---|---|---|---|---|---|---|
| — | YOLO26n COCO (§6.2 A) | — | | | | 2.4 | 5.5 | | |
| r01 | YOLO11n (§6.2 B) | VisDrone-person | | | | 2.6 | 6.5 | | |
| r02 | YOLO26n (§6.2 B) | VisDrone-person | | | | 2.4 | 5.5 | | |

**Bảng 2 — Khoảng cách miền (đại diện, 2×2)**

| Model \ Tập đánh giá | val sạch | val đã suy giảm |
|---|---|---|
| r02 (train sạch) | | |
| r03 (train có suy giảm) | | |

**Bảng 3 — Quét SAHI**

| Kích thước lát | Chồng lấn | Số lát/khung | mAP50 | **AR-small** | ms/khung | Δ mAP50 so với toàn khung | Δ mAP50 trên mỗi ms |
|---|---|---|---|---|---|---|---|

**Bảng 4 — Backend suy luận**

| Backend | fps p50 | fps p95 | ms/khung | mAP50 | Chênh mAP50 so với `.pt` |
|---|---|---|---|---|---|
| pt fp32 | | | | | 0 (mốc) |
| pt fp16 | | | | | |
| onnx | | | | | |
| engine fp16 | | | | | |

**Bảng 5 — Bộ khôi phục ảnh** (trên VisDrone-val đã suy giảm; lặp lại ở AI Phase 3 trên ảnh thật)

| Bộ khôi phục | mAP50 | mAP50-95 | **AR-small** | recall `<16px` | recall `16–32px` | recall `>64px` | ms khôi phục | ms tổng | Δ mAP50 trên mỗi ms | Giấy phép |
|---|---|---|---|---|---|---|---|---|---|---|
| none (đối chứng) | | | | | | | 0 | | — | — |
| bicubic (đối chứng) | | | | | | | | | | BSD |
| fbcnn | | | | | | | | | | Apache-2.0 |
| nafnet | | | | | | | | | | *kiểm* |
| realesr-general-x4v3 | | | | | | | | | | BSD-3 |
| zerodce | | | | | | | | | | **CC BY-NC** |
| sci | | | | | | | | | | *kiểm* |

**Bảng 6 — Độ cao × model** — *để trống, ghi rõ* **"chờ dữ liệu bay — AI Phase 3 (A3.3)"**.

**Mục bắt buộc trong `REPORT.md`:**

1. **Kỳ vọng trung thực.** Baseline công bố: VisDrone `pedestrian` ≈ 21.9% mAP50, `people` ≈ 11.7% với model nano ở 640. Mục tiêu của dự án cho lớp `person` gộp: **30–45%**. **Cấm viết "độ chính xác 90–95%".** Mọi con số kèm: tên chỉ số, tập dữ liệu, ngưỡng IoU, ngưỡng tin cậy, số mẫu (§6.5).
2. **Số seed và phương sai.** Ghi rõ mỗi cấu hình chạy mấy seed. Một seed thì nói thẳng là một seed.
3. **Ghi rõ detector khi trích dẫn SAHI**: 6.8% / 12.7% là của **FCOS**, không phải YOLO.
4. **Điều kiện đo tốc độ**: RTX 4060 Laptop, batch 1, imgsz 640, driver bản nào, backend nào.
5. **Giấy phép và trích dẫn**: VisDrone không có LICENSE (ghi rõ sự mơ hồ), HERIDAL CC BY, Zero-DCE CC BY-NC, albumentations MIT (lý do ghim 2.0.8).
6. **Giới hạn và những gì chưa đo** — bảng nào đang trống và vì sao.

**Kết quả mong đợi.** `REPORT.md` có đủ 6 bảng; bảng 1–5 đã điền số; bảng 6 trống nhưng có nhãn lý do.

---

## Cổng pass

- [ ] `plans/QUYET-DINH-CHUA-CHOT.md` có mục "Đã chốt" (hoặc `REPORT.md` ghi rõ đang chờ và A2.5 để trống có chủ đích).
- [ ] `r01` và `r02` train xong 100 epoch; bốn file `metrics.json` (2 model × val/test) đều có `coco.AR_small` khác `-1`.
- [ ] **`r02` đạt mAP50 ≥ 30% trên `visdrone_person/val`.** Nếu không đạt, chạy hết checklist chẩn đoán dưới đây **trước khi** ghi kết quả là cuối cùng:
  - nhãn đúng chưa (mở lại `ml/results/convert_check/`)
  - `dataset_stats.json` có `instances_person` hợp lý không
  - train có thật sự chạy GPU không (`epoch_times.json`)
  - thử thêm HERIDAL vào tập train
  - thử `imgsz` 960 nếu VRAM cho phép (giảm batch)
  - nếu vẫn thấp: **báo cáo trung thực con số thật** kèm phân tích, không nâng khống
- [ ] `r03` train xong; bảng 2×2 đã điền đủ 4 ô.
- [ ] `sahi_sweep.json` có ≥ 6 cấu hình, kèm ms/khung cho từng cấu hình.
- [ ] `.engine` build được; `bench_backends.json` có 4 backend; **mAP50 của `.engine` trong ±0.5 điểm so với `.pt`**.
- [ ] Backend khởi động được với `YOLO_WEIGHTS` trỏ vào `.engine`; khi engine hỏng thì quay về `.pt` **kèm cảnh báo rõ**, không im lặng.
- [ ] `restore_bench.json` có ≥ 5 bộ khôi phục, **bắt buộc có cả `none` và `bicubic`**, kèm phân tầng theo rổ kích thước.
- [ ] `ml/experiments/ma-tran-thi-nghiem.md` và `protocol-thu-du-lieu.md` tồn tại; mỗi TN ghi rõ đã chạy hay chờ dữ liệu bay.
- [ ] `ml/results/REPORT.md` có 6 bảng; **mọi bảng có cột AR-small**; mục "Kỳ vọng trung thực" và "Giới hạn" đã viết.
- [ ] `ml/scripts/evaluate.py` chỉ **thêm** cờ, schema `metrics.json` của A1.6 không bị đổi tên/xoá khoá nào.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| `r02` không đạt mAP50 ≥ 30% → hụt mục tiêu chính của phase | 3 | 4 | **12** | Checklist chẩn đoán ở cổng pass; thêm HERIDAL; cân nhắc imgsz 960; cuối cùng **báo cáo trung thực** thay vì nâng khống |
| Chênh lệch giữa các bộ khôi phục nhỏ hơn nhiễu → không kết luận được gì | 3 | 4 | **12** | Đối chứng `bicubic` bắt buộc; đánh giá trên nhiều ảnh; báo cáo khoảng tin cậy bootstrap; phân tầng theo cỡ để tìm hiệu ứng ở đúng chỗ |
| Chờ dữ liệu bay (TN D, TN A bản thật) làm kẹt tiến độ báo cáo | 4 | 3 | **12** | Phạm vi AI Phase 2 khoá ở VisDrone + tổng hợp; bảng AI Phase 3 để trống **có nhãn lý do**; giao thức thu dữ liệu bàn giao sẵn |
| Thời gian GPU vượt dự kiến (4 run × 13 giờ) | 3 | 3 | **9** | Số đo thật từ A1.10 quyết định có chạy 2 seed không; `patience=30`; chạy qua đêm, tuần tự |
| `pip install tensorrt` không có wheel khớp CUDA 13 trên Python 3.11 | 3 | 3 | **9** | Dự phòng `.pt half=True`; ghi rõ "chưa xác minh" và lý do trong báo cáo |
| `.engine` chết sau khi cập nhật driver NVIDIA | 3 | 2 | **6** | Build lại trên chính máy; detector quay về `.pt` kèm cảnh báo; không commit `.engine` |
| Hết đĩa khi sinh tập VisDrone suy giảm (~2 GB) | 2 | 3 | **6** | Sinh train trước, val sau; `_raw/` xoá được; không DVC hoá tập suy giảm |
| Giấy phép NAFNet/SCI chưa xác minh | 3 | 2 | **6** | Mở LICENSE trong repo **trước khi** đưa vào bảng; nếu không rõ thì loại khỏi bảng chính và ghi lý do |
| OOM khi chạy SAHI hoặc Real-ESRGAN trên ảnh 2000×1500 | 2 | 2 | **4** | Tăng kích thước lát; bật tile cho Real-ESRGAN |
| Đổi đề tài sau khi đã chạy thí nghiệm | 2 | 2 | **4** | A2.1–A2.4 dùng chung mọi nhánh; chỉ A2.5/A2.6 phải làm lại |
| Sửa nhầm schema `metrics.json` làm hỏng so sánh với AI Phase 3 | 2 | 3 | **6** | Hợp đồng ở A1.6: chỉ được thêm khoá; thêm một test kiểm sự tồn tại của các khoá cũ |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| A2.0 Chốt đề tài + viết bảng rẽ nhánh | 1.0 | Cộng thời gian phiên trao đổi với người dùng (ngoài phạm vi phase) |
| A2.1 Train + đánh giá r01, r02 | 6.0 người | **+ 10–26 giờ GPU** *(chưa xác minh)*; chạy qua đêm |
| A2.2 Sinh tập suy giảm + train r03 | 5.0 người | + 2 giờ sinh dữ liệu, **+ 5–13 giờ GPU** |
| A2.3 Quét SAHI | 6.0 | SAHI chạy chậm; 9 cấu hình × 548 ảnh |
| A2.4 Xuất ONNX/TensorRT + đo + cắm backend | 5.0 | Xuất engine 10–20 phút mỗi lần |
| A2.5 Harness khôi phục (7 mục) — nhánh **B+A** (mặc định) | 13.0 | **Việc lớn nhất.** Tải trọng số + bọc từng model + kiểm giấy phép + đo tham số thật |
| A2.6 Ma trận thí nghiệm + giao thức thu dữ liệu — nhánh **B+A** | 4.0 | Sản phẩm bàn giao cho AI Phase 3 |
| A2.7 `REPORT.md` + điền bảng | 5.0 | |
| **Tổng (nhánh B+A)** | **45 giờ người** | **+ 30–60 giờ GPU chạy nền** *(chưa xác minh — lấy số thật từ A1.10)* |

**Ước lượng A2.5 + A2.6 theo nhánh** (bảng trên dùng nhánh mặc định **B+A**; đổi Tổng theo nhánh thật sự chốt):

| Nhánh | A2.5 (giờ) | A2.6 (giờ) | Hai việc cộng lại | Tổng cả phase |
|---|---|---|---|---|
| **B+A** (mặc định) | 13.0 | 4.0 | 17.0 | 45.0 |
| B | 12.0 | 4.0 | 16.0 | 44.0 |
| C | 10.0 | 3.5 | 13.5 | 41.5 |
| D | 12.0 | 6.0 | 18.0 | 46.0 |

Đường găng: A2.1 → A2.2 → (A2.3 ∥ A2.4 ∥ A2.5) → A2.7. Ba việc giữa **độc lập nhau**, làm song song được khi GPU rảnh giữa các lượt train. A2.0 nên làm **trước** để không phải làm lại A2.5.

## Ghi chú cho sổ tay

Để agent viết `docs/so-tay/ai-02-huan-luyen-thi-nghiem.md`:

**Về việc so sánh cho công bằng**

- *Ablation* — đổi đúng **một** thứ mỗi lần rồi đo, để biết thứ đó đóng góp bao nhiêu. Ví dụ đời thường: muốn biết đường có làm cà phê ngon hơn không thì chỉ đổi đường, không đổi luôn cả loại cà phê.
- *Seed và phương sai* — huấn luyện có yếu tố ngẫu nhiên, nên chạy hai lần cùng một cấu hình vẫn ra số khác nhau. Chênh 1–2 điểm mAP **có thể chỉ là nhiễu**. Vì sao phải ghi rõ đã chạy mấy seed.
- *Nhóm đối chứng (control)* — vì sao bảng khôi phục ảnh **bắt buộc** có dòng "không làm gì" và dòng "nội suy đơn giản". Không có chúng thì mọi con số tăng đều không diễn giải được.

**Về các kỹ thuật**

- *STAL* của YOLO26 và vì sao nó quan trọng với người nhỏ 38 px.
- *SAHI* bằng ví dụ: thay vì nhìn cả bức ảnh lớn từ xa, ta chia ảnh thành nhiều ô nhỏ rồi soi từng ô bằng kính lúp, sau đó ghép kết quả lại. Vì sao các ô phải **chồng lấn** (người đứng ngay đường cắt).
- *NMS / gộp kết quả* — cùng một người bị phát hiện ở hai ô chồng lấn thì phải gộp thành một.
- *ONNX và TensorRT* — ONNX là định dạng chung để model chạy được ở nhiều nơi; TensorRT biên dịch riêng cho đúng card đồ hoạ này nên nhanh hơn nhưng **không đem sang máy khác được**.
- *FP16 (nửa độ chính xác)* — dùng số ít chữ số hơn để chạy nhanh hơn; đổi lại có thể lệch kết quả chút ít, nên phải kiểm tra tương đương.
- *Khôi phục ảnh (image restoration)* — làm sạch ảnh xấu. Khác với siêu phân giải (phóng to), khử nhiễu, khử nhoè, khử artifact nén: mỗi thứ nhắm vào một kiểu hỏng khác nhau, nên **chọn sai công cụ thì không giúp gì**.
- *Vì sao ảnh đẹp với mắt người chưa chắc giúp máy* — làm mượt ảnh cho dễ nhìn thì đồng thời xoá luôn chi tiết nhỏ mà máy dùng để nhận ra người ở xa. Đây là kết luận trung tâm của đề tài.

**Về cách đọc kết quả**

- Vì sao **mAP50 22%** không phải là "đồ án làm dở" mà là mức của bài toán này với model nhỏ.
- Vì sao phải ghi rõ "6.8% là của FCOS, không phải YOLO" khi trích dẫn SAHI.
- *Δ mAP trên mỗi mili-giây* — cách so sánh đúng khi phải đổi thời gian lấy độ chính xác.
- *Một giả thuyết bị bác bỏ vẫn là kết quả.* TN D dự đoán một tương tác; nếu dữ liệu nói không có tương tác thì đó là phát hiện, không phải thất bại.
