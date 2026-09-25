"""Test parser MJPEG + reader giữ khung mới nhất + fan-out — Phase 07 §7.8.2, §7.8.4.

Dữ liệu multipart dựng TAY trong test — không cần `fake_stream.py`, không cần
OpenCV, không cần mạng (trừ bài fan-out dựng một HTTP server cục bộ).
"""

from __future__ import annotations

import asyncio
import http.server
import threading
from pathlib import Path

import pytest

from backend.vision.stream import (
    MJPEG_MEDIA_TYPE,
    MjpegFrame,
    MjpegLatestFrameReader,
    iter_multipart_frames,
    mjpeg_multipart,
    parse_part_headers,
    render_frame_part,
)

JPEG_A = b"\xff\xd8\xffA-frame-bytes\xff\xd9"
# Thân có cả \r\n lẫn chuỗi "--frame" giả boundary: chỉ Content-Length cứu được.
JPEG_B = b"\xff\xd8\r\n--frame\r\nContent-Length: 1\r\n\r\nX\xff\xd9"


def _part(jpeg: bytes, *, fid=0, ts=1000, q=30, fs="QVGA", headers=None) -> bytes:
    lines = headers or [
        "Content-Type: image/jpeg",
        f"X-Frame-Id: {fid}",
        f"X-Timestamp-Ms: {ts}",
        f"X-Jpeg-Quality: {q}",
        f"X-Framesize: {fs}",
        f"Content-Length: {len(jpeg)}",
    ]
    return b"--frame\r\n" + ("\r\n".join(lines) + "\r\n\r\n").encode() + jpeg + b"\r\n"


def _reader_tu(data: bytes, buoc: int = 4096):
    """`read(n)` trả tối đa `buoc` byte mỗi lần — như socket thật."""
    pos = 0

    def read(n: int) -> bytes:
        nonlocal pos
        k = min(n, buoc)
        chunk = data[pos : pos + k]
        pos += len(chunk)
        return chunk

    return read


def _tach(data: bytes, buoc: int = 4096) -> list[MjpegFrame]:
    return list(iter_multipart_frames(_reader_tu(data, buoc)))


def test_tach_nhieu_khung_dung_byte_va_du_bon_header():
    frames = _tach(_part(JPEG_A, fid=7, ts=1234) + _part(JPEG_B, fid=8, ts=1300))

    assert [f.jpeg for f in frames] == [JPEG_A, JPEG_B]
    f = frames[0]
    assert (f.frame_id, f.timestamp_ms, f.jpeg_quality, f.framesize) == (7, 1234, 30, "QVGA")
    assert frames[1].frame_id == 8


@pytest.mark.parametrize("buoc", [1, 2, 3, 7])
def test_doc_tung_vai_byte_van_dung(buoc):
    """Lỗi "đọc được khung đầu rồi treo" (§7.8.4): `read(n)` trả ÍT hơn n byte."""
    data = _part(JPEG_A, fid=1) + _part(JPEG_B, fid=2) + _part(JPEG_A, fid=3)
    frames = _tach(data, buoc)
    assert [f.frame_id for f in frames] == [1, 2, 3]
    assert frames[1].jpeg == JPEG_B


def test_than_jpeg_chua_boundary_gia_van_dung_nho_content_length():
    frames = _tach(_part(JPEG_B, fid=5) + _part(JPEG_A, fid=6))
    assert [f.frame_id for f in frames] == [5, 6]
    assert frames[0].jpeg == JPEG_B


def test_ten_header_khong_phan_biet_hoa_thuong():
    hdr = [
        "content-type: image/jpeg",
        "x-frame-id: 42",
        "X-TIMESTAMP-MS: 99",
        "x-Jpeg-Quality:12",
        "X-FrameSize:   VGA  ",
        f"CONTENT-LENGTH: {len(JPEG_A)}",
    ]
    (f,) = _tach(_part(JPEG_A, headers=hdr))
    assert (f.frame_id, f.timestamp_ms, f.jpeg_quality, f.framesize) == (42, 99, 12, "VGA")


def test_thieu_content_length_bi_bo_phan_sau_van_doc():
    thieu = _part(b"XYZ", headers=["Content-Type: image/jpeg", "X-Frame-Id: 1"])
    frames = _tach(thieu + _part(JPEG_A, fid=2))
    assert [f.frame_id for f in frames] == [2]


def test_thieu_header_rieng_thi_none():
    (f,) = _tach(_part(JPEG_A, headers=[f"Content-Length: {len(JPEG_A)}"]))
    assert f.jpeg == JPEG_A
    assert (f.frame_id, f.timestamp_ms, f.jpeg_quality, f.framesize) == (None,) * 4


def test_rac_truoc_boundary_dau_bi_bo():
    frames = _tach(b"HTTP noise\r\nblah blah\r\n" + _part(JPEG_A, fid=9))
    assert [f.frame_id for f in frames] == [9]


def test_boundary_ket_thuc_dung_vong():
    frames = _tach(_part(JPEG_A, fid=1) + b"--frame--\r\n" + _part(JPEG_A, fid=2))
    assert [f.frame_id for f in frames] == [1]


def test_luong_dut_giua_than_thi_dung_khong_treo():
    data = _part(JPEG_A, fid=1)
    assert _tach(data[:-8]) == []


def test_parse_part_headers():
    h = parse_part_headers(b"A: 1\r\nX-Frame-Id:  5 \r\nkhong-co-hai-cham")
    assert h == {"a": "1", "x-frame-id": "5"}


def test_render_roi_parse_lai_khu_hoan_toan():
    goc = MjpegFrame(JPEG_B, 11, 2222, 30, "QVGA", 0.0)
    (lai,) = _tach(render_frame_part(goc))
    assert (lai.jpeg, lai.frame_id, lai.timestamp_ms, lai.jpeg_quality, lai.framesize) == (
        goc.jpeg,
        11,
        2222,
        30,
        "QVGA",
    )


def test_fake_stream_render_part_khop_hop_dong_va_parser():
    """Nguồn giả và parser cùng khớp `docs/hop-dong-mjpeg.md` — đủ bốn header."""
    from backend.vision.fake_stream import render_part

    part = render_part(JPEG_A, frame_id=3, timestamp_ms=4567)
    for header in (b"X-Frame-Id: 3", b"X-Timestamp-Ms: 4567", b"X-Jpeg-Quality: 30"):
        assert header in part
    assert b"X-Framesize: QVGA" in part
    (f,) = _tach(part)
    assert (f.jpeg, f.frame_id, f.timestamp_ms) == (JPEG_A, 3, 4567)


def test_hop_dong_ghi_du_bon_header():
    doc = (Path(__file__).resolve().parents[2] / "docs" / "hop-dong-mjpeg.md").read_text(
        encoding="utf-8"
    )
    for ten in ("X-Frame-Id", "X-Timestamp-Ms", "X-Jpeg-Quality", "X-Framesize"):
        assert ten in doc


def test_stream_khong_biet_fake_stream():
    """`stream.py` không phụ thuộc nguồn cụ thể (rủi ro cuối bảng Phase 07)."""
    src = (Path(__file__).resolve().parents[1] / "vision" / "stream.py").read_text(encoding="utf-8")
    assert "fake_stream" not in src


# ---------------------------------------------------------------------------
# Reader: khung mới nhất, không hàng đợi
# ---------------------------------------------------------------------------
class _Dong:
    def __init__(self, t: float = 100.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


def _khung(fid: int, t: float) -> MjpegFrame:
    return MjpegFrame(JPEG_A, fid, fid, 30, "QVGA", t)


def test_reader_ghi_de_khung_moi_nhat():
    r = MjpegLatestFrameReader("http://x", clock=_Dong())
    for i in range(5):
        r.publish(_khung(i, 100.0))
    assert r.latest().frame_id == 4
    assert r.frames_received == 5


def test_reader_available_theo_do_tuoi_khung():
    dong = _Dong(100.0)
    r = MjpegLatestFrameReader("http://x", stale_s=2.0, clock=dong)
    assert r.available is False  # chưa có khung nào
    r.publish(_khung(1, 100.0))
    assert r.available is True
    dong.t = 102.5
    assert r.available is False  # khung cũ = camera mất


# ---------------------------------------------------------------------------
# Fan-out: N tab, MỘT kết nối tới nguồn
# ---------------------------------------------------------------------------
class _Nguon(http.server.BaseHTTPRequestHandler):
    so_ket_noi = 0

    def do_GET(self):  # noqa: N802 — tên do http.server quy định
        type(self).so_ket_noi += 1
        self.send_response(200)
        self.send_header("Content-Type", MJPEG_MEDIA_TYPE)
        self.end_headers()
        try:
            for i in range(200):
                self.wfile.write(_part(JPEG_A, fid=i))
                self.wfile.flush()
                threading.Event().wait(0.01)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def log_message(self, *args):
        pass


def test_nhieu_tab_dung_chung_mot_ket_noi_toi_nguon():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Nguon)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    reader = MjpegLatestFrameReader(f"http://127.0.0.1:{srv.server_address[1]}/stream")
    reader.start()

    async def mot_tab(n: int) -> list[bytes]:
        parts: list[bytes] = []
        agen = mjpeg_multipart(reader, poll_s=0.005)
        async for part in agen:
            parts.append(part)
            if len(parts) >= n:
                await agen.aclose()
                return parts
        return parts

    async def ba_tab():
        return await asyncio.wait_for(
            asyncio.gather(mot_tab(5), mot_tab(5), mot_tab(5)), timeout=10
        )

    try:
        ket_qua = asyncio.run(ba_tab())
    finally:
        reader.stop()
        srv.shutdown()

    assert all(len(p) == 5 for p in ket_qua)
    assert all(p.startswith(b"--frame\r\n") for tab in ket_qua for p in tab)
    assert reader.connections_opened == 1
    assert _Nguon.so_ket_noi == 1
    # Và phần phát lại vẫn tách được bằng chính parser.
    assert _tach(b"".join(ket_qua[0]))[0].jpeg == JPEG_A


def test_nguon_chet_thi_reader_khong_nem_loi():
    reader = MjpegLatestFrameReader("http://127.0.0.1:9/khong-co", stale_s=0.5)
    reader.start()
    threading.Event().wait(0.3)
    reader.stop()
    assert reader.available is False
    assert reader.latest() is None
