"""Chia dataset THEO SESSION, không random theo frame — GIAI ĐOẠN 21.

Nếu frame 100 vào train mà frame 101 gần giống hệt vào test thì metric sẽ đẹp
giả. Vì vậy chia theo session/video:

    video_session_01 -> train
    video_session_02 -> train
    video_session_03 -> val
    video_session_04 -> test

    python ml/scripts/split_dataset.py --images ml/datasets/own/images \
        --train session_01,session_02 --val session_03 --test session_04
"""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--images", type=Path, required=True, help="Thư mục ảnh nguồn")
    parser.add_argument("--labels", type=Path, help="Thư mục label (mặc định cạnh images)")
    parser.add_argument("--train", required=True, help="Danh sách session cho train, cách nhau ,")
    parser.add_argument("--val", required=True, help="Danh sách session cho validation")
    parser.add_argument("--test", required=True, help="Danh sách session cho test")
    parser.add_argument("--out", type=Path, default=Path("ml/datasets/own_split"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raise NotImplementedError(
        "GIAI ĐOẠN 21: gom file theo tên session rồi copy sang "
        f"{args.out}/(train|val|test)/(images|labels). Tuyệt đối không random theo frame."
    )


if __name__ == "__main__":
    main()
