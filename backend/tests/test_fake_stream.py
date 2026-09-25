"""Test nguồn video giả + box giả — Phase 07 §7.8.3.

Dựng một clip nhỏ ngay trong `tmp_path` bằng OpenCV; không phụ thuộc
`backend/vision/assets/sample-clip.mp4`.
"""

from __future__ import annotations

import pytest

cv2 = pytest.importorskip("cv2")
np = pytest.importorskip("numpy")

from backend.vision.fake_stream import (  # noqa: E402
    FRAMESIZES,
    FakeMjpegSource,
    build_fake_detection,
    cv2_quality,
    fake_box,
)
from backend.vision.stream import MjpegFrame, iter_multipart_frames  # noqa: E402


@pytest.fixture
def clip(tmp_path):
    path = tmp_path / "clip.avi"
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 10, (640, 480))
    for i in range(12):
        img = np.full((480, 640, 3), i * 20, dtype=np.uint8)
        w.write(img)
    w.release()
    return path


def _tach(data: bytes) -> list[MjpegFrame]:
    pos = 0

    def read(n):
        nonlocal pos
        c = data[pos : pos + n]
        pos += len(c)
        return c

    return list(iter_multipart_frames(read))


@pytest.mark.parametrize("ten", ["QVGA", "VGA", "SVGA"])
def test_khung_dung_co_va_header_khop_co(clip, ten):
    src = FakeMjpegSource(str(clip), fps=100, framesize=ten, jpeg_quality=12)
    frames = _tach(b"".join(src.next_part() for _ in range(3)))
    src.close()

    assert [f.frame_id for f in frames] == [0, 1, 2]
    assert all(f.framesize == ten and f.jpeg_quality == 12 for f in frames)
    img = cv2.imdecode(np.frombuffer(frames[0].jpeg, np.uint8), cv2.IMREAD_COLOR)
    rong, cao = FRAMESIZES[ten]
    assert img.shape[:2] == (cao, rong)
    assert frames[1].timestamp_ms >= frames[0].timestamp_ms


def test_mac_dinh_la_vga_cho_de_xem(clip):
    src = FakeMjpegSource(str(clip), fps=100)
    (f,) = _tach(src.next_part())
    src.close()
    assert f.framesize == "VGA"


def test_framesize_la_bao_loi_ro(clip):
    with pytest.raises(RuntimeError, match="không hỗ trợ"):
        FakeMjpegSource(str(clip), framesize="UXGA")


def test_doi_thang_chat_luong_esp32_sang_opencv():
    # Thang esp32 NGƯỢC thang OpenCV: số esp32 nhỏ hơn phải ra số OpenCV lớn hơn.
    assert cv2_quality(10) > cv2_quality(30) > cv2_quality(63)
    assert cv2_quality(0) == 100 and cv2_quality(63) >= 1


def test_lap_lai_khi_het_clip(clip):
    src = FakeMjpegSource(str(clip), fps=100)
    parts = [src.next_part() for _ in range(30)]  # clip chỉ có 12 khung
    src.close()
    assert [f.frame_id for f in _tach(b"".join(parts))] == list(range(30))


def test_thieu_clip_bao_loi_ro_rang(tmp_path):
    src = FakeMjpegSource(str(tmp_path / "khong-co.mp4"))
    with pytest.raises(RuntimeError, match="CAMERA_FAKE"):
        src.next_part()


@pytest.mark.parametrize("rong, cao", list(FRAMESIZES.values()))
def test_box_nam_trong_khung_va_di_chuyen(rong, cao):
    boxes = [fake_box(t / 10, width=rong, height=cao) for t in range(0, 160)]
    for b in boxes:
        assert 0 <= b.x1 < b.x2 <= rong
        assert 0 <= b.y1 < b.y2 <= cao
        assert b.label == "fake"
    vi_tri = {(round(b.x1), round(b.y1)) for b in boxes}
    assert len(vi_tri) > 20


def test_box_chay_vong_chu_nhat_va_quay_ve_cho_cu():
    b0, b_nua = fake_box(0.0, width=640, height=480), fake_box(4.0, width=640, height=480)
    assert (b0.x1, b0.y1) != (b_nua.x1, b_nua.y1)
    assert fake_box(8.0, width=640, height=480) == b0  # chu kỳ 8 s


def test_detection_gan_voi_khung_that():
    assert build_fake_detection(None, 1.0) is None
    f = MjpegFrame(b"x", 77, 5000, 30, "QVGA", 0.0)
    d = build_fake_detection(f, 1.0)
    assert d.frame_id == 77 and d.frame_ts == 5.0
    assert (d.width, d.height) == (320, 240) and len(d.boxes) == 1
    # Cỡ theo CHÍNH khung đang phát, không theo cấu hình.
    d2 = build_fake_detection(MjpegFrame(b"x", 1, 0, 10, "VGA", 0.0), 1.0)
    assert (d2.width, d2.height) == (640, 480)
    assert d2.boxes[0].x2 <= 640
