"""Chuyển VisDrone sang dataset 1 class `person` — GIAI ĐOẠN 17.

VisDrone detection: 6471 train / 548 val / 1610 test-dev, nhiều class aerial
(pedestrian, people, bicycle, car, motor...).

Với project này:

    pedestrian + people  ->  PERSON (class 0)
    các class khác       ->  bỏ

    python ml/scripts/convert_visdrone_person.py \
        --visdrone ml/datasets/VisDrone2019-DET-train \
        --out ml/datasets/visdrone_person/train
"""

from __future__ import annotations

import argparse
from pathlib import Path

# Trong annotation VisDrone: 1 = pedestrian, 2 = people.
VISDRONE_PERSON_CATEGORIES = (1, 2)
PERSON_CLASS_ID = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--visdrone", type=Path, required=True, help="Thư mục VisDrone gốc")
    parser.add_argument("--out", type=Path, required=True, help="Thư mục YOLO format đầu ra")
    parser.add_argument(
        "--skip-empty",
        action="store_true",
        help="Bỏ ảnh không còn box nào sau khi lọc",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raise NotImplementedError(
        "GIAI ĐOẠN 17: đọc annotations/*.txt của VisDrone, giữ category "
        f"{VISDRONE_PERSON_CATEGORIES}, đổi sang YOLO format (class {PERSON_CLASS_ID}, "
        f"toạ độ normalized) và ghi vào {args.out}"
    )


if __name__ == "__main__":
    main()
