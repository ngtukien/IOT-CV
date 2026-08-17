"""Augmentation degradation — GIAI ĐOẠN 23.

Chỉ nghiên cứu ĐÚNG BA vấn đề, không phải 15:

    Motion Blur
    Brightness (low light)
    JPEG Compression

Chỉ augment TRAIN SET. Không augment test set thật — nếu augment test thì không
còn đo được model chịu degradation thật tốt tới đâu.

    python ml/scripts/augment.py --images ml/datasets/own_split/train/images \
        --out ml/datasets/own_split_aug/train/images
"""

from __future__ import annotations

import argparse
from pathlib import Path

DEGRADATIONS = ("motion_blur", "brightness", "jpeg_compression")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--images", type=Path, required=True, help="Ảnh TRAIN (chỉ train)")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--degradations",
        default=",".join(DEGRADATIONS),
        help=f"Chọn trong: {', '.join(DEGRADATIONS)}",
    )
    parser.add_argument("--copies", type=int, default=1, help="Số bản augment cho mỗi ảnh")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if "test" in str(args.images):
        raise SystemExit("Không augment test set (GIAI ĐOẠN 23).")
    raise NotImplementedError(
        "GIAI ĐOẠN 23: dùng albumentations (MotionBlur, RandomBrightnessContrast, "
        "ImageCompression), giữ nguyên label, ghi ra " + str(args.out)
    )


if __name__ == "__main__":
    main()
