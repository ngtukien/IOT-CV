"""Dựng docs/huong-dan/lap-rap-phan-cung.html — MỘT file HTML tự chứa, mở thẳng bằng trình duyệt.

Ảnh (nén WebP, nhúng base64), three.js (gói sẵn bằng rolldown) và toàn bộ mã đều nằm trong file
kết quả, nên mở offline được và gửi đi một file là đủ.

Chạy (từ gốc repo):
    py -3.13 docs/huong-dan/lap-rap/build.py

Cần có:
  - ImageMagick (`magick` trong PATH) — đọc được cả HEIC.
  - Node 24 + `frontend/node_modules` đã `pnpm install` (lấy rolldown và three từ đó).
  - Ảnh chính hãng ở `assignment/_build/img/official/` — thư mục này đã .gitignore, chỉ có trên máy
    dự án. Thiếu ảnh nào thì build DỪNG và in đúng đường dẫn thiếu, không lặng lẽ bỏ qua.

File trung gian (ảnh đã nén, bundle 3D) để ở `LAP_RAP_BUILD_DIR`, mặc định
`D:\\DevCache\\tmp\\lap-rap-build`, không ghi gì rác vào repo.
"""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
ROOT = HERE.parents[2]
OUT = ROOT / "docs" / "huong-dan" / "lap-rap-phan-cung.html"
CACHE = Path(os.environ.get("LAP_RAP_BUILD_DIR", r"D:\DevCache\tmp\lap-rap-build"))

# Thứ tự ghép mã JS: dữ liệu trước, vẽ hình, rồi giao diện.
JS_ORDER = [
    "core.js",
    "data-status.js",
    "data-parts.js",
    "data-cables.js",
    "data-steps.js",
    "data-steps2.js",
    "data-pc.js",
    "data-tools.js",
    "diag-kit.js",
    "diag-boards.js",
    "diag-system.js",
    "diag-cables.js",
    "diag-tools.js",
    "app.js",
]


def fail(msg: str) -> None:
    print(f"[build] LOI: {msg}", file=sys.stderr)
    sys.exit(1)


def need_tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        fail(f"khong thay '{name}' trong PATH")
    return path


def image_data_uri(spec: dict, magick: str) -> str:
    src = ROOT / spec["src"]
    if not src.exists():
        fail(f"thieu anh '{spec['id']}': {src}")
    sig = json.dumps(spec, sort_keys=True) + str(src.stat().st_mtime_ns)
    key = hashlib.sha1(sig.encode()).hexdigest()[:12]
    out = CACHE / "img" / f"{spec['id']}-{key}.webp"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        args = [magick, str(src), "-auto-orient"]
        if spec.get("crop"):
            args += ["-crop", spec["crop"], "+repage"]
        size = spec.get("max", 1100)
        quality = str(spec.get("q", 78))
        args += ["-resize", f"{size}x{size}>", "-quality", quality, "-strip", str(out)]
        subprocess.run(args, check=True)
    return "data:image/webp;base64," + base64.b64encode(out.read_bytes()).decode("ascii")


def bundle_3d() -> str:
    node = need_tool("node")
    out = CACHE / "scene3d.bundle.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [node, str(HERE / "bundle3d.mjs"), str(SRC / "scene3d.js"), str(out)],
        check=True,
        cwd=ROOT,
    )
    return out.read_text(encoding="utf-8")


def git_head() -> str:
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            cwd=ROOT,
            check=True,
        )
        return res.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "?"


def safe_inline(js: str) -> str:
    # "</script" bên trong mã inline sẽ đóng thẻ sớm.
    return js.replace("</script", "<\\/script")


def main() -> None:
    magick = need_tool("magick")
    manifest = json.loads((SRC / "images.json").read_text(encoding="utf-8"))
    images = {spec["id"]: image_data_uri(spec, magick) for spec in manifest}
    print(f"[build] {len(images)} anh")

    js_parts = []
    for name in JS_ORDER:
        path = SRC / name
        if not path.exists():
            fail(f"thieu file nguon {path}")
        js_parts.append(f"/* ---- {name} ---- */\n" + path.read_text(encoding="utf-8"))
    app_js = "\n".join(js_parts)

    scene_js = bundle_3d()
    print(f"[build] bundle 3D {len(scene_js) // 1024} KB")

    meta = {
        "built": dt.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "commit": git_head(),
    }
    html = (SRC / "page.html").read_text(encoding="utf-8")
    replacements = {
        "/*@@STYLE@@*/": (SRC / "styles.css").read_text(encoding="utf-8"),
        "/*@@META@@*/": "window.LR_META=" + json.dumps(meta, ensure_ascii=False) + ";",
        "/*@@IMAGES@@*/": "window.LR_IMG=" + json.dumps(images) + ";",
        "/*@@APP@@*/": safe_inline(app_js),
        "/*@@SCENE@@*/": safe_inline(scene_js),
    }
    for marker, value in replacements.items():
        if marker not in html:
            fail(f"page.html thieu dau {marker}")
        html = html.replace(marker, value)

    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"[build] {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1_048_576:.2f} MB")


if __name__ == "__main__":
    main()
