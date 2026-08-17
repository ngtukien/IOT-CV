# P4 — Vision & ML Lead

> Đọc trước: [SAFETY.md](../../SAFETY.md) mục 1; [README.md](../../README.md) GĐ 16–23, 66–75, 85.
> Kế hoạch chung: [team-plan.md](../team-plan.md)

**Câu bạn phải trả lời được bất cứ lúc nào:**
*"Model này phát hiện được người ở độ cao bay thật, và tôi chứng minh bằng số nào?"*

---

## Bạn sở hữu

| Nhóm | Chi tiết |
|---|---|
| **ML pipeline** | `ml/` — datasets, scripts, configs, weights, results |
| **YOLO detector** | `backend/vision/detector.py` — inference, bounding box, confidence |
| **Detection pipeline** | `backend/vision/stream.py`, `events.py`, `recorder.py` |
| **MQTT publish** | `backend/mqtt/publisher.py` — phối hợp P3 |
| **5 model** | Model A (COCO), B (VisDrone), C (VisDrone+Own), D (Augmented), E (Final) |
| **4 experiment** | Domain, Own camera, Degradation, Altitude |
| **Dataset** | VisDrone (convert) + ground ESP32 + airborne ESP32 |
| **Safety Observer** | Trong buổi bay: mắt luôn ở drone, không ở màn hình |
| **Logger** | Trong một số buổi bay: quay video, ghi notes.md |

**Bạn KHÔNG sở hữu:** web frontend (P3), backend control/mission (P2), calibration/params (P1).
**YOLO tuyệt đối không điều khiển motor trực tiếp** — đây là nguyên tắc kiến trúc không thương lượng.

---

## Vai trong buổi bay

**Safety Observer** (khi P2 không giữ vai này):
```text
Mắt luôn ở drone, không ở laptop.
Canh người lạ, xe, vật cản tiếp cận từ bên.
Bấm giờ pin (hô "5 phút" khi còn 5 phút pin bay).
Được hô "abort" nếu thấy nguy hiểm.
```

**Logger** (luân phiên với P2):
```text
Quay video toàn bộ buổi bay.
Ghi notes.md theo mẫu GĐ 87 ngay tại sân.
Lưu .BIN và .tlog vào laptop ngay trước khi về.
```

---

## Lịch tuần theo tuần

### Phase 0 — Tuần 1: Setup ML stack

**Mục tiêu:** Môi trường ML chạy được, YOLO predict được ảnh mẫu.

| Việc | File | Output |
|---|---|---|
| Cài SITL (theo P1) | — | CỔNG PASS 3A |
| Cài ML stack | `requirements-ml.txt` | `torch`, `ultralytics`, `albumentations`, `pandas`, `matplotlib` |
| Chạy YOLO11n baseline | `ml/scripts/` | predict ảnh mẫu, thấy class `person` |
| Chuẩn bị mua ESP32-CAM | — | Danh sách: ESP32-CAM + OV2640 + thẻ nhớ + dây |

```python
# Test baseline ngay tuần 1
from ultralytics import YOLO
model = YOLO("yolo11n.pt")
results = model.predict("test_person.jpg", classes=[0])  # 0 = person
print(results[0].boxes)
```

---

### Phase 1 — Tuần 2–3: Model A & B (COCO baseline + VisDrone)

**Mục tiêu:** Có 2 model để so sánh, hiểu rõ metric.

#### Model A — COCO pretrained (GĐ 16)

Không train lại. Chỉ chạy inference với pretrained weights:
```python
model_A = YOLO("yolo11n.pt")  # COCO, 80 class
# Filter chỉ lấy person
results = model_A.predict(img, classes=[0])
```

Evaluate trên test set:
```python
metrics = model_A.val(data="person_test.yaml", classes=[0])
print(metrics.box.map50)   # mAP@50
print(metrics.box.p)       # Precision
print(metrics.box.r)       # Recall
```

#### VisDrone convert (GĐ 17)

VisDrone có class: pedestrian(1), people(2), bicycle, car...

```python
# ml/scripts/convert_visdrone_person.py
VISDRONE_PERSON_CLASSES = {1: "pedestrian", 2: "people"}

def convert_label(src_label_path, dst_label_path):
    with open(src_label_path) as f:
        lines = f.readlines()
    new_lines = []
    for line in lines:
        parts = line.strip().split()
        cls = int(parts[0])
        if cls in VISDRONE_PERSON_CLASSES:
            new_lines.append(f"0 {' '.join(parts[1:])}\n")  # remapped to 0
    # Bỏ qua ảnh không có person
    if new_lines:
        with open(dst_label_path, 'w') as f:
            f.writelines(new_lines)
```

#### Model B — VisDrone fine-tune (GĐ 17–18)

```python
# ml/scripts/train.py
model = YOLO("yolo11n.pt")
model.train(
    data="ml/configs/visdrone_person.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    name="model_B_visdrone"
)
```

#### Bảng metric chuẩn

```text
KHÔNG được báo "accuracy = 95%" mà không biết accuracy đó là gì.
Luôn báo đủ 4 số:
```

| Model | Precision | Recall | mAP@50 | mAP@50-95 |
|---|---|---|---|---|
| A — COCO | ? | ? | ? | ? |
| B — VisDrone | ? | ? | ? | ? |

---

### Phase 2 — Tuần 4–5: ESP32-CAM trên bàn & own dataset

**Mục tiêu:** Camera thu dữ liệu thực tế, test detect khoảng cách.

#### ESP32-CAM setup (GĐ 19) — phối hợp P3

P3 viết firmware stream, P4 nhận stream và chạy YOLO:

```python
# backend/vision/stream.py
import cv2

def get_frame(url="http://192.168.x.x/capture"):
    # Lấy từng JPEG frame từ ESP32-CAM
    cap = cv2.VideoCapture(url)
    ret, frame = cap.read()
    return frame
```

#### Test khoảng cách (phối hợp P3 làm tại sân)

```text
Người đứng tại: 2m, 4m, 6m, 8m
Điều kiện: ngoài trời, ban ngày

Ghi vào ml/results/distance_test.csv:
distance_m | confidence | detected | notes
2          | 0.91       | True     | áo trắng
4          | 0.78       | True     | áo trắng
6          | 0.43       | True     | áo trắng, loại bỏ bóng râm
8          | 0.21       | False    | sáng bình thường
```

> **⚠️ Cổng G2 camera:** Nếu recall < 0.3 ở 4m ngoài sáng → báo ngay tuần 5, không chờ drone xong.

#### Own dataset (GĐ 20–21)

**Cách thu đúng:**
```text
1. Gắn ESP32-CAM lên tripod/gậy ở độ cao 2–4m
2. Quay video, người đi/đứng/ngồi/quay lưng
3. Extract frame: 1 frame / 1–2 giây (không lấy liên tiếp)
4. Target: 200–400 ảnh đầu tiên
```

**Chia dataset đúng (theo session, không random):**
```python
# ml/scripts/split_dataset.py
# session_01, session_02 → train
# session_03 → val
# session_04 → test
# KHÔNG split random frame từ cùng video
```

---

### Phase 3 — Tuần 6–7: Model C & D

**Mục tiêu:** 4 model có thể so sánh công bằng.

#### Model C — VisDrone + Own ESP32-CAM data (GĐ 22)

```yaml
# ml/configs/combined_person.yaml
train: ml/datasets/combined/train
val:   ml/datasets/combined/val
nc: 1
names: ['person']
```

```python
model = YOLO("yolo11n.pt")
model.train(data="ml/configs/combined_person.yaml", epochs=50, name="model_C")
```

#### Model D — Augmentation degradation (GĐ 23)

Chỉ 3 loại degradation (không nghiên cứu 15 loại):

```python
# ml/scripts/augment.py
import albumentations as A

degradation_transform = A.Compose([
    A.MotionBlur(blur_limit=(3, 9), p=0.5),
    A.RandomBrightnessContrast(brightness_limit=0.4, p=0.5),
    A.ImageCompression(quality_lower=30, quality_upper=70, p=0.5),
])
# Chỉ augment TRAIN SET, không augment test
```

#### Bảng 4 model × 4 điều kiện

| Model | Normal | Motion Blur | Low Light | JPEG Compress |
|---|---|---|---|---|
| A COCO | — | — | — | — |
| B VisDrone | — | — | — | — |
| C Combined | — | — | — | — |
| D Augmented | — | — | — | — |

Điền vào khi train xong. **Cùng test set cho tất cả model.**

---

### Phase 4 — Tuần 8–9: Detection pipeline ghép vào backend

**Mục tiêu:** Detection event lên được dashboard, chống spam.

#### Detector (GĐ 74)

```python
# backend/vision/detector.py
from ultralytics import YOLO

class PersonDetector:
    def __init__(self, model_path, conf_threshold=0.6):
        self.model = YOLO(model_path)
        self.conf = conf_threshold

    def detect(self, frame) -> list[dict]:
        results = self.model.predict(frame, classes=[0], conf=self.conf, verbose=False)
        detections = []
        for box in results[0].boxes:
            detections.append({
                "confidence": float(box.conf[0]),
                "bbox": box.xyxy[0].tolist()
            })
        return detections
```

#### Event manager — chống spam (GĐ 75)

```python
# backend/vision/events.py
import time

class DetectionEventManager:
    CONSECUTIVE_FRAMES = 3   # phải detect liên tiếp mới tạo event
    COOLDOWN_SEC = 5         # không tạo event mới trong 5s

    def __init__(self):
        self._consecutive = 0
        self._last_event_time = 0

    def process(self, detections: list, telemetry: dict) -> dict | None:
        if detections:
            self._consecutive += 1
        else:
            self._consecutive = 0
            return None

        now = time.time()
        if (self._consecutive >= self.CONSECUTIVE_FRAMES and
                now - self._last_event_time > self.COOLDOWN_SEC):
            self._last_event_time = now
            best = max(detections, key=lambda d: d["confidence"])
            return {
                "event": "person_detected",
                "confidence": best["confidence"],
                "timestamp": now,
                "uav_lat": telemetry.get("lat"),
                "uav_lon": telemetry.get("lon"),
                "uav_alt": telemetry.get("relative_alt"),
                "snapshot": self._save_snapshot()
            }
        return None
```

#### Recorder (GĐ 74)

```python
# backend/vision/recorder.py
import cv2, os, time

class SnapshotRecorder:
    def __init__(self, output_dir="detections"):
        os.makedirs(output_dir, exist_ok=True)
        self.output_dir = output_dir

    def save(self, frame, event: dict) -> str:
        filename = f"{self.output_dir}/{int(time.time())}.jpg"
        cv2.imwrite(filename, frame)
        return filename
```

---

### Phase 5 — Tuần 10–11: Dataset bay thật & Model E

**Mục tiêu:** Model E dùng dữ liệu từ UAV thật ở độ cao bay thật.

#### Thu dataset bay thật (GĐ 72)

```text
Bay bằng RC theo P1 (PIC), P4 điều phối người đứng dưới.
Độ cao: 3m, 5m, 7m
Người: đứng, đi bộ, ngồi
Session: ít nhất 4 session khác nhau
Extract: 1 frame / 1–2 giây
```

#### Model E — Final deployment model (GĐ 73)

```python
model = YOLO("yolo11n.pt")
model.train(
    data="ml/configs/final.yaml",  # VisDrone + ground + airborne
    epochs=100,
    imgsz=640,
    name="model_E_final"
)
```

Model E là model duy nhất chạy trong production. Deploy:
```python
# backend/vision/detector.py
MODEL_PATH = "ml/weights/model_E_final.pt"
```

---

### Phase 6 — Tuần 12: 4 Experiment & báo cáo

**Mục tiêu:** Đủ nội dung cho môn Xử lý ảnh.

#### Experiment 1 — Domain adaptation

```text
Câu hỏi: COCO pretrained vs VisDrone fine-tune, khác nhau bao nhiêu trên ảnh aerial?
Test set: VisDrone test-dev + own ground test
Metric: Precision, Recall, mAP@50
```

#### Experiment 2 — Camera-specific data

```text
Câu hỏi: Thêm dữ liệu từ ESP32-CAM có cải thiện detect trên camera đó không?
Test set: own ESP32-CAM test set (KHÔNG dùng VisDrone)
So sánh: Model B vs Model C
```

#### Experiment 3 — Degradation augmentation

```text
Câu hỏi: Augment blur/brightness/compression lúc train có giúp tốt hơn khi gặp điều kiện đó lúc test không?
Tạo test set nhân tạo có degradation
So sánh: Model C vs Model D
```

#### Experiment 4 — Altitude effect

```text
Câu hỏi: Độ cao bay ảnh hưởng detection như thế nào?
Test tại: 3m, 5m, 7m (dữ liệu từ GĐ 72)
Model: Model E
Metric: confidence trung bình, recall theo khoảng cách pixel người
```

---

## Cấu trúc thư mục P4 sở hữu

```text
ml/
├── datasets/
│   ├── visdrone_person/    ← sau khi convert
│   ├── own_ground/         ← ESP32-CAM trên tripod
│   ├── own_airborne/       ← ESP32-CAM trên drone
│   └── combined/           ← ghép cho Model C/D/E
├── scripts/
│   ├── convert_visdrone_person.py
│   ├── extract_frames.py
│   ├── split_dataset.py
│   ├── augment.py
│   ├── train.py
│   └── evaluate.py
├── configs/
│   ├── visdrone_person.yaml
│   ├── combined_person.yaml
│   └── final.yaml
├── weights/
│   ├── model_B_visdrone.pt
│   ├── model_C_combined.pt
│   ├── model_D_augmented.pt
│   └── model_E_final.pt     ← production
└── results/
    ├── distance_test.csv
    ├── experiment_1_domain.csv
    ├── experiment_2_camera.csv
    ├── experiment_3_degradation.csv
    └── experiment_4_altitude.csv

backend/
└── vision/
    ├── stream.py     ← nhận MJPEG từ ESP32-CAM
    ├── detector.py   ← PersonDetector, YOLO inference
    ├── events.py     ← DetectionEventManager, chống spam
    └── recorder.py   ← lưu snapshot
```

---

## Nguyên tắc quan trọng

```text
1. YOLO chạy trên LAPTOP, không trên ESP32-CAM.
2. YOLO output (event) → MQTT → dashboard. KHÔNG → motor.
3. Khi camera chết: detector dừng, flight vẫn chạy bình thường.
4. Không augment TEST SET — chỉ augment train.
5. Không split frame liên tiếp từ cùng video vào train/test.
6. "uav_lat/lon" trong event = tọa độ UAV, không phải tọa độ người.
   Phải ghi rõ điều này trong báo cáo và trong tooltip dashboard.
```
