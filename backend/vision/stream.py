"""Đọc luồng MJPEG từ camera và phát lại cho nhiều trình duyệt — Phase 07 §7.8.2.

File này KHÔNG biết nguồn là gì. Nó đọc `multipart/x-mixed-replace` từ một URL
— nguồn video giả của Phase 07 hay ESP32-CAM thật (Phase 17) đều như nhau, miễn
đúng hợp đồng `docs/hop-dong-mjpeg.md`. Nó không import gì từ module nguồn giả,
và tên module đó không xuất hiện trong file này — test canh bằng chính phép
`grep` của plan (rủi ro cuối bảng Phase 07).

Ba mảnh:

- `iter_multipart_frames()` — parser VIẾT TAY, cố ý không dùng thư viện
  multipart: mục tiêu môn học là hiểu đúng định dạng. Đọc header tới dòng trống,
  rồi đọc ĐÚNG `Content-Length` byte — không đọc theo dòng, vì JPEG là nhị phân
  và có thể chứa byte `\\n` lẫn chuỗi `--frame`.
- `MjpegLatestFrameReader` — MỘT kết nối tới nguồn, chạy nền, giữ đúng MỘT khung
  mới nhất (ghi đè, không hàng đợi: nguồn nhanh hơn người xem thì hàng đợi chỉ
  làm hình trễ dần).
- `mjpeg_multipart()` — mỗi tab trình duyệt một vòng lặp đọc CHUNG khung mới
  nhất đó. N tab, vẫn một kết nối tới nguồn: proxy fan-out.

Mất camera không bao giờ ném lỗi ra ngoài — chỉ `available = False`
(SAFETY.md mục 9: camera chết không được kéo telemetry chết theo).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import threading
import time
import urllib.request
from collections.abc import AsyncIterator, Callable, Iterator
from dataclasses import dataclass

from backend import config

log = logging.getLogger(__name__)

MJPEG_BOUNDARY = "frame"
MJPEG_MEDIA_TYPE = f"multipart/x-mixed-replace; boundary={MJPEG_BOUNDARY}"

# Bốn header riêng của hợp đồng (docs/hop-dong-mjpeg.md §3), viết thường vì so
# khớp không phân biệt hoa/thường.
H_FRAME_ID = "x-frame-id"
H_TIMESTAMP = "x-timestamp-ms"
H_QUALITY = "x-jpeg-quality"
H_FRAMESIZE = "x-framesize"

# Header một phần không bao giờ dài tới chừng này. Vượt = nguồn gửi rác, bỏ
# phần đó thay vì đọc mãi vào bộ nhớ.
_MAX_HEADER_BYTES = 8192
# Một khung QVGA ~10 KB, SVGA ~60 KB. 5 MB là rác chắc chắn.
_MAX_JPEG_BYTES = 5 * 1024 * 1024

_BACKOFF_START_S = 0.5
_BACKOFF_MAX_S = 5.0
_READ_CHUNK = 4096


@dataclass(frozen=True)
class MjpegFrame:
    """Một khung đã tách. Bốn trường X- là None khi nguồn không gửi."""

    jpeg: bytes
    frame_id: int | None
    timestamp_ms: int | None
    jpeg_quality: int | None
    framesize: str | None
    received_at: float  # time.monotonic() phía ta lúc tách xong


def parse_part_headers(raw: bytes) -> dict[str, str]:
    """Khối header của một phần -> dict, khoá viết thường, giá trị đã trim."""
    headers: dict[str, str] = {}
    for line in raw.decode("latin-1").split("\r\n"):
        name, sep, value = line.partition(":")
        if sep:
            headers[name.strip().lower()] = value.strip()
    return headers


def _int_or_none(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


class _ByteReader:
    """Bộ đệm nhỏ quanh `read(n)` để tìm dấu phân cách và đọc đúng N byte.

    `read(n)` của socket được phép trả ÍT hơn n byte — đọc một lần rồi coi là
    đủ là bug kinh điển "đọc được khung đầu rồi treo" (§7.8.4).
    """

    def __init__(self, read: Callable[[int], bytes]) -> None:
        self._read = read
        self._buf = bytearray()
        self.eof = False

    def _fill(self) -> bool:
        chunk = self._read(_READ_CHUNK)
        if not chunk:
            self.eof = True
            return False
        self._buf += chunk
        return True

    def read_until(self, marker: bytes, limit: int) -> bytes | None:
        """Đọc tới HẾT `marker` (bỏ marker). None = EOF hoặc vượt `limit`."""
        start = 0
        while True:
            idx = self._buf.find(marker, start)
            if idx >= 0:
                data = bytes(self._buf[:idx])
                del self._buf[: idx + len(marker)]
                return data
            if len(self._buf) > limit:
                # Giữ lại đuôi đủ dài để marker bị cắt đôi vẫn khớp được lần sau.
                del self._buf[: len(self._buf) - len(marker)]
                return None
            start = max(0, len(self._buf) - len(marker) + 1)
            if not self._fill():
                return None

    def read_exact(self, n: int) -> bytes | None:
        while len(self._buf) < n:
            if not self._fill():
                return None
        data = bytes(self._buf[:n])
        del self._buf[:n]
        return data


def iter_multipart_frames(
    read: Callable[[int], bytes], boundary: str = MJPEG_BOUNDARY
) -> Iterator[MjpegFrame]:
    """Tách từng khung JPEG khỏi một luồng multipart. Dừng khi EOF.

    Phần thiếu `Content-Length` bị BỎ (hợp đồng §4): không có cách an toàn biết
    JPEG dài bao nhiêu. Rác trước boundary đầu tiên cũng bị bỏ qua.
    """
    reader = _ByteReader(read)
    marker = f"--{boundary}".encode()
    while True:
        # Tới boundary kế tiếp. Không giới hạn byte bị bỏ ở đây: giữa hai phần
        # có thể là \r\n, lời mở đầu, hoặc đuôi của một phần hỏng.
        if reader.read_until(marker, limit=_MAX_JPEG_BYTES) is None:
            if reader.eof:
                return
            continue
        # Hết dòng boundary. "--frame--" là boundary kết thúc.
        rest = reader.read_until(b"\r\n", limit=64)
        if rest is None:
            return
        if rest.startswith(b"--"):
            return
        raw_headers = reader.read_until(b"\r\n\r\n", limit=_MAX_HEADER_BYTES)
        if raw_headers is None:
            if reader.eof:
                return
            continue
        headers = parse_part_headers(raw_headers)
        length = _int_or_none(headers.get("content-length"))
        if length is None or not 0 < length <= _MAX_JPEG_BYTES:
            log.debug("Bỏ một phần MJPEG thiếu/sai Content-Length: %r", headers)
            continue
        body = reader.read_exact(length)
        if body is None:
            return
        yield MjpegFrame(
            jpeg=body,
            frame_id=_int_or_none(headers.get(H_FRAME_ID)),
            timestamp_ms=_int_or_none(headers.get(H_TIMESTAMP)),
            jpeg_quality=_int_or_none(headers.get(H_QUALITY)),
            framesize=headers.get(H_FRAMESIZE),
            received_at=time.monotonic(),
        )


def render_frame_part(frame: MjpegFrame, boundary: str = MJPEG_BOUNDARY) -> bytes:
    """Một phần multipart theo đúng hợp đồng, từ một khung đã đọc (để phát lại)."""
    lines = [f"--{boundary}", "Content-Type: image/jpeg"]
    if frame.frame_id is not None:
        lines.append(f"X-Frame-Id: {frame.frame_id}")
    if frame.timestamp_ms is not None:
        lines.append(f"X-Timestamp-Ms: {frame.timestamp_ms}")
    if frame.jpeg_quality is not None:
        lines.append(f"X-Jpeg-Quality: {frame.jpeg_quality}")
    if frame.framesize is not None:
        lines.append(f"X-Framesize: {frame.framesize}")
    lines.append(f"Content-Length: {len(frame.jpeg)}")
    return ("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + frame.jpeg + b"\r\n"


class MjpegLatestFrameReader:
    """MỘT kết nối tới nguồn, giữ khung mới nhất. Dùng chung cho mọi tab."""

    def __init__(
        self,
        url: str | None = None,
        *,
        stale_s: float | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.url = url or config.camera_source_url()
        self.stale_s = config.CAMERA_STALE_S if stale_s is None else stale_s
        self._clock = clock
        self._lock = threading.Lock()
        self._latest: MjpegFrame | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._response = None
        self.frames_received = 0
        self.connections_opened = 0

    # -- khung ---------------------------------------------------------------
    def publish(self, frame: MjpegFrame) -> None:
        """Ghi đè khung mới nhất. Thread đọc gọi; test gọi thẳng được."""
        with self._lock:
            self._latest = frame
            self.frames_received += 1

    def latest(self) -> MjpegFrame | None:
        with self._lock:
            return self._latest

    @property
    def available(self) -> bool:
        frame = self.latest()
        return frame is not None and (self._clock() - frame.received_at) <= self.stale_s

    # -- vòng đời --------------------------------------------------------------
    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="mjpeg-reader", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 3.0) -> None:
        self._stop.set()
        resp = self._response
        if resp is not None:
            # Cắt ngang lần `read()` đang chặn; không thì stop() chờ hết timeout.
            with contextlib.suppress(Exception):  # đang dọn, lỗi đóng không quan trọng
                resp.close()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=timeout)
            if not thread.is_alive():
                self._thread = None

    def _run(self) -> None:
        backoff = _BACKOFF_START_S
        dang_hong = False
        while not self._stop.is_set():
            try:
                self.connections_opened += 1
                with urllib.request.urlopen(self.url, timeout=5.0) as resp:  # noqa: S310
                    self._response = resp
                    if dang_hong:
                        log.info("Đã nối lại nguồn video %s", self.url)
                    dang_hong = False
                    backoff = _BACKOFF_START_S
                    for frame in iter_multipart_frames(resp.read1):
                        if self._stop.is_set():
                            return
                        self.publish(frame)
            except Exception as exc:  # noqa: BLE001 — mất camera KHÔNG được ném ra ngoài
                # Chỉ báo một lần mỗi đợt mất: nguồn tắt một tiếng không được
                # biến log thành một dòng lặp mỗi 5 giây.
                if not dang_hong and not self._stop.is_set():
                    log.warning("Mất nguồn video %s: %s. Sẽ tự nối lại.", self.url, exc)
                dang_hong = True
            finally:
                self._response = None
            self._stop.wait(backoff)
            backoff = min(backoff * 2, _BACKOFF_MAX_S)


async def mjpeg_multipart(
    reader: MjpegLatestFrameReader, *, poll_s: float = 0.02
) -> AsyncIterator[bytes]:
    """Vòng phát cho MỘT tab: mỗi khung MỚI của reader thành một phần multipart.

    N tab = N vòng này, cùng đọc một `reader` — một kết nối tới nguồn.
    """
    last: MjpegFrame | None = None
    while True:
        frame = reader.latest()
        if frame is not None and frame is not last:
            last = frame
            yield render_frame_part(frame)
        await asyncio.sleep(poll_s)


class CameraStream:
    """Nguồn khung cho bộ nhận diện (AI phase). Trả JPEG bytes — giải mã là việc
    của detector. Mất camera thì `available = False`, không ném lỗi."""

    def __init__(self, url: str | None = None, reader: MjpegLatestFrameReader | None = None):
        self.reader = reader or MjpegLatestFrameReader(url)
        self.url = self.reader.url
        self.available = False

    def frames(self, poll_s: float = 0.02) -> Iterator[MjpegFrame]:
        """Yield từng khung MỚI, vô hạn. Không có khung thì chờ, không ném lỗi."""
        self.reader.start()
        last: MjpegFrame | None = None
        while True:
            self.available = self.reader.available
            frame = self.reader.latest()
            if frame is not None and frame is not last:
                last = frame
                yield frame
            else:
                time.sleep(poll_s)

    def close(self) -> None:
        self.reader.stop()
        self.available = False
