"""Train YOLO person detector — GIAI ĐOẠN 18, 22, 73.

Các model của đồ án:

    Model A = YOLO pretrained COCO (baseline, không train)
    Model B = A + VisDrone Person
    Model C = B + own ESP32-CAM ground dataset
    Model D = C + degradation augmentation
    Model E = C/D + airborne ESP32-CAM dataset  <- FINAL DEPLOYMENT MODEL

Giữ NGUYÊN image size, test set và cách đánh giá confidence giữa các model để so
sánh công bằng.

    python ml/scripts/train.py --data ml/configs/visdrone_person.yaml \
        --model yolo11n.pt --epochs 100 --name model_b
"""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="File dataset YAML")
    parser.add_argument("--model", default="yolo11n.pt", help="Weights khởi đầu")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640, help="Giữ giống nhau giữa các model")
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--name", required=True, help="Tên run, ví dụ model_b")
    parser.add_argument("--project", type=Path, default=Path("ml/results"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raise NotImplementedError(
        "GIAI ĐOẠN 18: from ultralytics import YOLO; YOLO(args.model).train(...) rồi "
        f"lưu kết quả vào {args.project / args.name}"
    )


if __name__ == "__main__":
    main()
