"""Trích frame từ video để làm dataset — GIAI ĐOẠN 20.

Quy tắc: KHÔNG lấy 30 frame liên tiếp gần như giống nhau. Lấy 1 frame mỗi 1-2 s
để dataset đa dạng thật.

    python ml/scripts/extract_frames.py --video raw/session_01.mp4 \
        --out ml/datasets/own/images --every 1.5
"""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, required=True, help="File video nguồn")
    parser.add_argument("--out", type=Path, required=True, help="Thư mục ảnh đầu ra")
    parser.add_argument(
        "--every",
        type=float,
        default=1.5,
        help="Khoảng cách giữa hai frame được lấy, tính theo giây",
    )
    parser.add_argument(
        "--prefix",
        default="frame",
        help="Tiền tố tên file, nên chứa tên session để biết frame thuộc video nào",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raise NotImplementedError(
        "GIAI ĐOẠN 20: implement bằng cv2.VideoCapture — đọc FPS, lấy 1 frame mỗi "
        f"{args.every}s, ghi ra {args.out}"
    )


if __name__ == "__main__":
    main()
