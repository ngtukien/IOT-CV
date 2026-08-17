"""Đánh giá model — GIAI ĐOẠN 18, 23, 85.

Bắt buộc báo cáo đủ bốn metric, KHÔNG được chỉ ghi "accuracy = 95%":

    precision
    recall
    mAP50
    mAP50-95

Bảng kết quả cuối cùng (GIAI ĐOẠN 23) so 4 model trên 4 điều kiện: normal, blur,
low light, compression.

    python ml/scripts/evaluate.py --weights ml/weights/model_c.pt \
        --data ml/configs/own_camera.yaml --condition blur
"""

from __future__ import annotations

import argparse
from pathlib import Path

CONDITIONS = ("normal", "blur", "low_light", "compression")
METRICS = ("precision", "recall", "mAP50", "mAP50-95")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--condition", choices=CONDITIONS, default="normal")
    parser.add_argument("--out", type=Path, default=Path("ml/results/metrics.csv"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raise NotImplementedError(
        "GIAI ĐOẠN 18: YOLO(args.weights).val(...) rồi append "
        f"{', '.join(METRICS)} vào {args.out} kèm tên model và condition"
    )


if __name__ == "__main__":
    main()
