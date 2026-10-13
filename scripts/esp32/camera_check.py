"""Nghiệm thu firmware camera ESP32-S3 + OV3660 qua Wi-Fi (plans/phase-12 §12.4).

Chạy (trong repo, cần env của backend vì dùng chính parser MJPEG của backend):
    uv run python scripts/esp32/camera_check.py [--frames 300] [--save khung.jpg]

Camera gọi bằng tên cố định CAMERA_HOST trong camera_net.py (hotspot Windows phân giải tên máy);
`--save` ghi vào logs/camera/ (đã .gitignore). Không nhận địa chỉ tuỳ ý từ dòng lệnh: script chỉ
để kiểm đúng con camera của dự án.

Kiểm, theo thứ tự, và dừng mã 1 ở lỗi đầu tiên:
 1. `/status` trả đủ trường, camera OK, cảm biến PID 0x3660.
 2. `/set` từ chối quality sai (chữ, -1, 64, thiếu tham số) bằng 400; nhận 0..63 bằng 200.
 3. `/stream` đúng docs/hop-dong-mjpeg.md: đủ 4 header X-, JPEG giải mã SẠCH (libjpeg không
    cảnh báo — SOI/EOI đúng chưa đủ), Content-Length khớp, X-Frame-Id tăng dần, X-Timestamp-Ms
    tăng dần và không vượt uptime. Đo fps + cỡ khung.
 4. Đổi quality GIỮA luồng (cả hai chiều): khung đầu tiên mang nhãn mới phải có cỡ gần mức ổn
    định MỚI hơn hẳn mức CŨ — tức X-Jpeg-Quality là giá trị THẬT lúc chụp, không phải
    giá trị biến cấu hình (điểm bắt buộc số 3 của plan).
Cuối cùng trả quality về giá trị lúc bắt đầu.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request
from itertools import pairwise
from pathlib import Path

from camera_net import CONTROL_PORT, camera_url

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
from backend.vision.stream import MJPEG_MEDIA_TYPE, iter_multipart_frames  # noqa: E402

SAVE_DIR = REPO / "logs" / "camera"
STATUS_KEYS = ("quality", "framesize", "rssi", "uptime_ms", "frames_sent")
X_FIELDS = ("frame_id", "timestamp_ms", "jpeg_quality", "framesize")  # 4 header X- đã tách
OV3660_PID = "0x3660"
HTTP_TIMEOUT_S = 5.0
BASELINE_FRAMES = 60
SWITCH_STEADY_FRAMES = 15  # số khung đo mỗi mức chất lượng sau khi đổi
QUALITY_HIGH = 8  # nét (file to)
QUALITY_LOW = 60  # mờ (file nhỏ)
# Cỡ JPEG phụ thuộc cảnh (trần trơn chênh ít, cảnh nhiều chi tiết chênh nhiều), nên không so
# ngưỡng tuyệt đối. Khung đầu nhãn mới phải gần cỡ ổn định MỚI hơn cỡ ổn định CŨ ít nhất
# CLOSER_FACTOR lần; và hai mức phải khác nhau rõ hơn nhiễu cỡ khung (~1% khi cảnh đứng yên),
# không thì phép so trên vô nghĩa.
CLOSER_FACTOR = 3.0
MIN_LEVEL_GAP = 0.10


class CheckFailed(Exception):
    pass


# Tiến trình con giải mã từng khung. Sau mỗi khung nó ghi dấu kết thúc vào CÙNG ống stderr,
# nên mọi cảnh báo libjpeg đứng trước dấu đó thuộc đúng khung vừa giải mã.
_DECODER_CHILD = r"""
import os, struct, sys
import cv2, numpy as np
inp = sys.stdin.buffer
while True:
    head = inp.read(4)
    if len(head) < 4:
        break
    data = inp.read(struct.unpack("<I", head)[0])
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        os.write(2, b"khong giai ma duoc\n")
    os.write(2, b"__END__\n")
"""
_END_MARK = b"__END__\n"


class JpegDecodeChecker:
    """Giải mã JPEG thật và trả cảnh báo của libjpeg (chuỗi rỗng = ảnh sạch).

    SOI/EOI đúng KHÔNG đủ: khung mất byte ở giữa vẫn đủ đầu đuôi, giải mã ra nửa dưới thành
    sọc tím (gặp thật 13/10/2026) và libjpeg chỉ báo "Corrupt JPEG data: premature end of data
    segment" ra stderr ở tầng C. DLL OpenCV có bảng fd riêng nên `os.dup2` trong cùng tiến
    trình KHÔNG bắt được (đã thử, trả rỗng cả với khung hỏng) -> phải giải mã ở tiến trình con.
    """

    def __init__(self) -> None:
        import subprocess

        self._proc = subprocess.Popen(
            [sys.executable, "-c", _DECODER_CHILD], stdin=subprocess.PIPE, stderr=subprocess.PIPE
        )
        self._buf = b""

    def warnings(self, jpeg: bytes) -> str:
        import struct

        self._proc.stdin.write(struct.pack("<I", len(jpeg)) + jpeg)
        self._proc.stdin.flush()
        while _END_MARK not in self._buf:
            chunk = self._proc.stderr.read1(4096)
            if not chunk:
                raise CheckFailed("tiến trình giải mã JPEG chết (thiếu OpenCV? chạy bằng `uv run`)")
            self._buf += chunk
        text, _, self._buf = self._buf.partition(_END_MARK)
        return text.decode("utf-8", "replace").strip()

    def close(self) -> None:
        self._proc.stdin.close()
        self._proc.wait(timeout=10)


def expect(cond: bool, msg: str) -> None:
    if not cond:
        raise CheckFailed(msg)
    print(f"  OK  {msg}")


def http_get(url: str) -> tuple[int, bytes]:
    try:
        with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT_S) as resp:  # noqa: S310
            return resp.status, resp.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()


def get_status(base: str) -> dict:
    code, body = http_get(f"{base}/status")
    expect(code == 200, f"/status trả 200 (được {code})")
    return json.loads(body)


def set_quality(base: str, q: int) -> None:
    code, body = http_get(f"{base}/set?quality={q}")
    if code != 200 or json.loads(body).get("quality") != q:
        raise CheckFailed(f"/set?quality={q} trả {code} {body!r}")


class StreamCollector:
    """Đọc /stream ở luồng nền, gom mọi khung (kèm header) vào danh sách."""

    def __init__(self, url: str) -> None:
        self.frames: list = []
        self.error: str | None = None
        self.content_type = ""
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, args=(url,), daemon=True)
        self._thread.start()

    def _run(self, url: str) -> None:
        try:
            with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT_S) as resp:  # noqa: S310
                self.content_type = resp.headers.get("Content-Type", "")
                for frame in iter_multipart_frames(resp.read1):
                    self.frames.append(frame)
                    if self._stop.is_set():
                        return
        except Exception as exc:  # noqa: BLE001 — báo lại cho luồng chính
            self.error = repr(exc)

    def wait_for(self, count: int, timeout_s: float = 30.0) -> None:
        deadline = time.monotonic() + timeout_s
        while len(self.frames) < count:
            if self.error:
                raise CheckFailed(f"luồng /stream lỗi: {self.error}")
            if time.monotonic() > deadline:
                got = len(self.frames)
                raise CheckFailed(f"chỉ nhận {got}/{count} khung sau {timeout_s:.0f} s")
            time.sleep(0.02)

    def stop(self) -> None:
        self._stop.set()


def check_status(base: str) -> dict:
    print("1. /status")
    st = get_status(base)
    expect(all(k in st for k in STATUS_KEYS), f"có đủ {STATUS_KEYS}")
    expect(st.get("camera") == "OK", f"camera OK (được {st.get('camera')})")
    pid = st.get("sensor_pid")
    expect(pid == OV3660_PID, f"cảm biến {OV3660_PID} (được {pid})")
    expect(0 <= st["quality"] <= 63, f"quality {st['quality']} trong 0..63")
    print(f"      {st}")
    return st


def check_set_validation(base: str, original: int) -> None:
    print("2. /set kiểm tham số")
    for bad in ("abc", "-1", "64", "12x", ""):
        code, _ = http_get(f"{base}/set?quality={bad}")
        expect(code == 400, f"quality='{bad}' -> 400 (được {code})")
    code, _ = http_get(f"{base}/set")
    expect(code == 400, f"thiếu tham số -> 400 (được {code})")
    for good in (0, 63, original):
        set_quality(base, good)
        reported = get_status(base)["quality"]
        expect(reported == good, f"quality={good} -> 200 và /status báo {reported}")


def check_contract(base: str, frames: list, status: dict) -> None:
    print("3. /stream đúng hợp đồng MJPEG")
    for f in frames:
        missing = [n for n in X_FIELDS if getattr(f, n) is None]
        if missing:
            raise CheckFailed(f"khung thiếu header {missing}")
        if not (f.jpeg[:2] == b"\xff\xd8" and f.jpeg[-2:] == b"\xff\xd9"):
            raise CheckFailed(f"khung {f.frame_id} không phải JPEG trọn vẹn (SOI/EOI sai)")
    expect(True, f"{len(frames)} khung đủ 4 header X-, JPEG có SOI/EOI (Content-Length khớp)")
    decoder = JpegDecodeChecker()
    try:
        corrupt = [(f.frame_id, w) for f in frames if (w := decoder.warnings(f.jpeg))]
    finally:
        decoder.close()
    expect(
        not corrupt,
        f"{len(frames) - len(corrupt)}/{len(frames)} khung giải mã sạch"
        + (f" — hỏng: {corrupt[:5]}" if corrupt else ""),
    )
    ids = [f.frame_id for f in frames]
    expect(all(b > a for a, b in pairwise(ids)), f"X-Frame-Id tăng dần ({ids[0]}..{ids[-1]})")
    ts = [f.timestamp_ms for f in frames]
    expect(all(b >= a for a, b in pairwise(ts)), "X-Timestamp-Ms tăng dần")
    uptime_now = get_status_quiet(base)["uptime_ms"]
    expect(ts[-1] <= uptime_now, f"X-Timestamp-Ms ({ts[-1]}) không vượt uptime ({uptime_now})")
    framesizes = {f.framesize for f in frames}
    expect(framesizes == {status["framesize"]}, f"X-Framesize = {status['framesize']}")
    qualities = {f.jpeg_quality for f in frames}
    expect(qualities == {status["quality"]}, f"X-Jpeg-Quality = {status['quality']}")
    gaps = sum(b - a - 1 for a, b in pairwise(ids))
    sizes = [len(f.jpeg) for f in frames]
    # fps tính từ khung đầu tới khung cuối (không gồm thời gian mở kết nối). Khoảng cách
    # X-Timestamp-Ms (đồng hồ chip) đều = cảm biến là giới hạn; thất thường = mạng là giới hạn.
    fps = (len(frames) - 1) / (frames[-1].received_at - frames[0].received_at)
    dts = [b - a for a, b in pairwise(ts)]
    print(
        f"      fps={fps:.1f}  khoảng chụp trung vị={statistics.median(dts):.0f} ms"
        f" (min {min(dts)} / max {max(dts)})"
    )
    print(
        f"      cỡ trung vị={statistics.median(sizes) / 1024:.1f} KB"
        f"  (min {min(sizes)} / max {max(sizes)} byte)  khung nhảy cóc={gaps}"
    )


def get_status_quiet(base: str) -> dict:
    _, body = http_get(f"{base}/status")
    return json.loads(body)


def steady_size(frames: list) -> float:
    return statistics.median(len(f.jpeg) for f in frames)


def switch_and_measure(
    base: str, col: StreamCollector, new_q: int
) -> tuple[int, float, float, int]:
    """Đổi quality giữa luồng.

    Trả (cỡ khung đầu nhãn mới, cỡ ổn định mức cũ, cỡ ổn định mức mới, số khung bị bỏ).
    """
    start = len(col.frames)
    old_steady = steady_size(col.frames[max(0, start - SWITCH_STEADY_FRAMES + 5) : start])
    set_quality(base, new_q)
    deadline = time.monotonic() + 20
    while True:
        tagged = [f for f in col.frames[start:] if f.jpeg_quality == new_q]
        if len(tagged) >= SWITCH_STEADY_FRAMES + 1:
            break
        if time.monotonic() > deadline or col.error:
            raise CheckFailed(f"không thấy đủ khung nhãn {new_q} sau khi đổi ({col.error})")
        time.sleep(0.02)
    after = col.frames[start:]
    labels = [f.jpeg_quality for f in after]
    first_idx = labels.index(new_q)
    if any(q != new_q for q in labels[first_idx:]):
        raise CheckFailed(f"nhãn quality nhảy qua lại sau khi đổi: {labels}")
    first = after[first_idx]
    prev_id = after[first_idx - 1].frame_id if first_idx > 0 else col.frames[start - 1].frame_id
    new_steady = steady_size(after[first_idx + 5 : first_idx + 1 + SWITCH_STEADY_FRAMES])
    return len(first.jpeg), old_steady, new_steady, first.frame_id - prev_id - 1


def check_quality_switch(base: str, stream_url: str) -> None:
    print("4. Đổi quality giữa luồng — nhãn phải khớp khung thật")
    set_quality(base, QUALITY_HIGH)
    col = StreamCollector(stream_url)
    try:
        col.wait_for(SWITCH_STEADY_FRAMES)
        for new_q in (QUALITY_LOW, QUALITY_HIGH):
            first, old, new, skipped = switch_and_measure(base, col, new_q)
            gap = abs(old - new) / max(old, new)
            expect(
                gap >= MIN_LEVEL_GAP,
                f"-> {new_q}: hai mức khác nhau rõ ({old:.0f} B vs {new:.0f} B, {gap:.0%})",
            )
            expect(
                abs(first - new) * CLOSER_FACTOR <= abs(first - old),
                f"-> {new_q}: khung đầu nhãn mới {first} B gần mức mới {new:.0f} B,"
                f" xa mức cũ {old:.0f} B (bỏ {skipped} khung chuyển tiếp)",
            )
    finally:
        col.stop()


def resolve_save_path(name: str) -> Path:
    """Đường dẫn ghi khung ảnh, neo vào logs/camera/ — không cho ghi ra ngoài thư mục đó."""
    path = (SAVE_DIR / name).resolve()
    if not path.is_relative_to(SAVE_DIR.resolve()):
        raise ValueError(f"--save '{name}' nằm ngoài {SAVE_DIR} — không nhận")
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--frames", type=int, default=BASELINE_FRAMES, help="số khung kiểm ở bước 3")
    ap.add_argument("--save", metavar="TEN.jpg", help="lưu một khung JPEG vào logs/camera/TEN.jpg")
    args = ap.parse_args()
    try:
        save_path = resolve_save_path(args.save) if args.save else None
    except ValueError as exc:
        ap.error(str(exc))
    base = camera_url(CONTROL_PORT)
    original = None
    try:
        status = check_status(base)
        original = status["quality"]
        stream_url = camera_url(int(status["stream_port"]), "/stream")
        check_set_validation(base, original)

        col = StreamCollector(stream_url)
        try:
            col.wait_for(args.frames, timeout_s=30 + args.frames / 2)
        finally:
            col.stop()
        expect(col.content_type == MJPEG_MEDIA_TYPE, f"Content-Type '{col.content_type}'")
        check_contract(base, col.frames[: args.frames], status)
        if save_path:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            save_path.write_bytes(col.frames[-1].jpeg)
            print(f"      đã lưu {save_path}")
        time.sleep(0.5)  # để firmware đóng phiên /stream trước khi mở phiên mới
        check_quality_switch(base, stream_url)
    except CheckFailed as exc:
        print(f"  FAIL {exc}")
        return 1
    finally:
        if original is not None:
            set_quality(base, original)
    print("PASS — camera đúng hợp đồng, /set và /status chạy, nhãn quality khớp khung thật.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
