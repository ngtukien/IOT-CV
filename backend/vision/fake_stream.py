"""Nguồn MJPEG GIẢ + box nhận diện giả — Phase 07 §7.8.3.

Camera thật chỉ có ở Phase 17, bộ nhận diện thật ở `plans/ai/`. Phase 10 cần một
luồng video để dựng panel video + canvas overlay ngay bây giờ. File này là MỘT
NGUỒN hợp lệ cho `stream.py` đọc — không phải một đường phục vụ video song song.
Chiều phụ thuộc chỉ một chiều: file này được nhập kiểu `MjpegFrame` từ
`stream.py`; `stream.py` không bao giờ biết file này tồn tại.

Hai cách chạy:

- Gắn vào backend ở `GET /api/video/fake-source` (mặc định, `CAMERA_FAKE=1`).
- Chạy riêng như một "thiết bị" giống ESP32-CAM:

      uv run python -m backend.vision.fake_stream --port 8081
      # rồi CAMERA_FAKE=0 CAMERA_STREAM_URL=http://127.0.0.1:8081/stream

Khung đọc từ một video mẫu thật lặp vô hạn (`backend/vision/assets/sample-clip.mp4`),
thu về cỡ `CAMERA_FAKE_FRAMESIZE` (mặc định VGA 640×480 cho dễ xem; QVGA 320×240 là
mốc thiết kế của ESP32-CAM — 44 fps ở QVGA so với 14 fps ở VGA — đặt QVGA để thử
đúng cỡ đó).
Cần OpenCV: `uv sync --extra vision` (hoặc `--extra dev`).
"""

from __future__ import annotations

import argparse
import asyncio
import time
from collections.abc import AsyncIterator
from pathlib import Path

from backend import config
from backend.schemas import DetectionBox, DetectionPayload
from backend.vision.stream import MJPEG_BOUNDARY, MJPEG_MEDIA_TYPE, MjpegFrame

# Tên khung hình của esp32-camera -> (rộng, cao). Chỉ những cỡ dự án dùng.
FRAMESIZES: dict[str, tuple[int, int]] = {
    "QVGA": (320, 240),
    "VGA": (640, 480),
    "SVGA": (800, 600),
}


def _framesize(name: str | None = None) -> tuple[str, int, int]:
    ten = (name or config.CAMERA_FAKE_FRAMESIZE).upper()
    if ten not in FRAMESIZES:
        raise RuntimeError(
            f"CAMERA_FAKE_FRAMESIZE='{ten}' không hỗ trợ — chọn một trong {sorted(FRAMESIZES)}"
        )
    return (ten, *FRAMESIZES[ten])


def cv2_quality(esp32_quality: int) -> int:
    """Thang esp32-camera (0–63, số NHỎ = nét) -> thang OpenCV (0–100, số LỚN = nét).

    Đổi tuyến tính 100 - q*100/63 (q=10 -> 84, q=30 -> 52). Không có công thức
    chuẩn nào giữa hai thang; header vẫn ghi số theo thang ESP32 vì đó là cái
    thiết bị thật sẽ gửi.
    """
    return max(1, min(100, round(100 - esp32_quality * 100 / 63)))


# Quỹ đạo box giả: chạy vòng quanh một hình chữ nhật lùi vào trong khung.
_BOX_PERIOD_S = 8.0
_BOX_INSET_FRAC = 0.0625  # 20 px ở QVGA


def render_part(
    jpeg: bytes,
    *,
    frame_id: int,
    timestamp_ms: int,
    jpeg_quality: int,
    framesize: str,
) -> bytes:
    """Một phần multipart đúng `docs/hop-dong-mjpeg.md` §2 (có `\\r\\n` sau thân)."""
    header = (
        f"--{MJPEG_BOUNDARY}\r\n"
        "Content-Type: image/jpeg\r\n"
        f"X-Frame-Id: {frame_id}\r\n"
        f"X-Timestamp-Ms: {timestamp_ms}\r\n"
        f"X-Jpeg-Quality: {jpeg_quality}\r\n"
        f"X-Framesize: {framesize}\r\n"
        f"Content-Length: {len(jpeg)}\r\n"
        "\r\n"
    )
    return header.encode("ascii") + jpeg + b"\r\n"


def _import_cv2():
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover — chỉ xảy ra trên máy thiếu extra
        raise RuntimeError(
            "Nguồn video giả cần OpenCV. Chạy: uv sync --extra vision (hoặc --extra dev), "
            "hoặc tắt nguồn giả bằng CAMERA_FAKE=0."
        ) from exc
    return cv2


class FakeMjpegSource:
    """Lặp một video mẫu thành luồng MJPEG QVGA."""

    def __init__(
        self,
        clip_path: str | None = None,
        *,
        fps: float | None = None,
        framesize: str | None = None,
        jpeg_quality: int | None = None,
    ) -> None:
        self.clip_path = Path(clip_path or config.CAMERA_FAKE_CLIP)
        self.fps = config.CAMERA_FAKE_FPS if fps is None else fps
        self.framesize, self.width, self.height = _framesize(framesize)
        self.jpeg_quality = (
            config.CAMERA_FAKE_JPEG_QUALITY if jpeg_quality is None else jpeg_quality
        )
        self._cap = None
        self._frame_id = 0

    def _open(self):
        cv2 = _import_cv2()
        if not self.clip_path.is_file():
            raise RuntimeError(
                f"Không thấy video mẫu {self.clip_path}. Đặt CAMERA_FAKE_CLIP trỏ tới một "
                "file .mp4, hoặc tắt nguồn giả bằng CAMERA_FAKE=0."
            )
        cap = cv2.VideoCapture(str(self.clip_path))
        if not cap.isOpened():
            raise RuntimeError(f"OpenCV không mở được {self.clip_path}")
        return cap

    def next_jpeg(self) -> bytes:
        """Khung kế tiếp (tua lại đầu khi hết clip), đã thu về 320×240 và nén JPEG.

        CHẶN (đọc file + nén) — gọi qua `asyncio.to_thread` trên event loop.
        """
        cv2 = _import_cv2()
        if self._cap is None:
            self._cap = self._open()
        ok, img = self._cap.read()
        if not ok:
            self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, img = self._cap.read()
            if not ok:
                raise RuntimeError(f"Video mẫu {self.clip_path} không có khung nào đọc được")
        # Thu nhỏ: INTER_AREA (khử răng cưa). Phóng to: INTER_CUBIC (đỡ nhoè).
        thu_nho = img.shape[1] >= self.width
        cach = cv2.INTER_AREA if thu_nho else cv2.INTER_CUBIC
        img = cv2.resize(img, (self.width, self.height), interpolation=cach)
        ok, buf = cv2.imencode(
            ".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, cv2_quality(self.jpeg_quality)]
        )
        if not ok:
            raise RuntimeError("OpenCV không nén được khung JPEG")
        return buf.tobytes()

    def next_part(self) -> bytes:
        jpeg = self.next_jpeg()
        part = render_part(
            jpeg,
            frame_id=self._frame_id,
            timestamp_ms=int(time.monotonic() * 1000) & 0xFFFFFFFF,
            jpeg_quality=self.jpeg_quality,
            framesize=self.framesize,
        )
        self._frame_id = (self._frame_id + 1) & 0xFFFFFFFF
        return part

    async def parts(self) -> AsyncIterator[bytes]:
        """Phát đều `fps` phần/giây. Ngủ tới MỐC KẾ để nhịp không trôi."""
        interval = 1.0 / max(self.fps, 1.0)
        loop = asyncio.get_running_loop()
        moc = loop.time()
        try:
            while True:
                yield await asyncio.to_thread(self.next_part)
                moc += interval
                cho = moc - loop.time()
                if cho < 0:
                    moc = loop.time()
                    cho = 0
                await asyncio.sleep(cho)
        finally:
            self.close()

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None


def fake_box(t: float, *, width: int, height: int, size: int | None = None) -> DetectionBox:
    """Box cố định kích thước chạy vòng quanh chu vi một hình chữ nhật. THUẦN.

    Box KHÔNG cần khớp nội dung video: nó chỉ để kiểm chứng canvas overlay ở
    Phase 10 vẽ đúng chỗ, không phải kiểm độ chính xác nhận diện.
    """
    # Box và lề tỉ lệ theo khung: cùng một quỹ đạo trông giống nhau ở mọi cỡ.
    size = round(width * 0.19) if size is None else size
    inset = round(width * _BOX_INSET_FRAC)
    x_min, y_min = inset, inset
    x_max, y_max = width - inset - size, height - inset - size
    w, h = x_max - x_min, y_max - y_min
    perimeter = 2 * (w + h)
    s = (t % _BOX_PERIOD_S) / _BOX_PERIOD_S * perimeter
    if s < w:
        x, y = x_min + s, y_min
    elif s < w + h:
        x, y = x_max, y_min + (s - w)
    elif s < 2 * w + h:
        x, y = x_max - (s - w - h), y_max
    else:
        x, y = x_min, y_max - (s - 2 * w - h)
    return DetectionBox(
        x1=float(x),
        y1=float(y),
        x2=float(x + size),
        y2=float(y + size),
        confidence=0.99,
        label="fake",
    )


def build_fake_detection(frame: MjpegFrame | None, t: float) -> DetectionPayload | None:
    """Message `detection` giả gắn với khung thật đang phát. None khi không có khung."""
    if frame is None:
        return None
    frame_ts = frame.timestamp_ms / 1000.0 if frame.timestamp_ms is not None else t
    # Cỡ lấy từ CHÍNH khung đang phát (header X-Framesize), không từ cấu hình:
    # box phải khớp khung mà trình duyệt đang thấy.
    _, width, height = _framesize(frame.framesize)
    return DetectionPayload(
        frame_id=frame.frame_id or 0,
        frame_ts=frame_ts,
        width=width,
        height=height,
        boxes=[fake_box(t, width=width, height=height)],
    )


def _main() -> None:  # pragma: no cover — chạy tay
    import uvicorn
    from fastapi import FastAPI
    from fastapi.responses import StreamingResponse

    ap = argparse.ArgumentParser(description="Nguồn MJPEG giả chạy như một thiết bị riêng")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8081)
    ap.add_argument("--clip", default=None)
    ap.add_argument("--fps", type=float, default=None)
    args = ap.parse_args()

    app = FastAPI(title="IOT-CV fake MJPEG source")

    @app.get("/stream")
    async def stream() -> StreamingResponse:
        return StreamingResponse(
            FakeMjpegSource(args.clip, fps=args.fps).parts(), media_type=MJPEG_MEDIA_TYPE
        )

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":  # pragma: no cover
    _main()
