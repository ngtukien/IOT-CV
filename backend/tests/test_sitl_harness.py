"""Test các hàm THUẦN của `scripts/sitl/` — chạy trong pytest, không cần SITL.

Chỉ nhắm vào phần không có I/O: toạ độ, so khớp mission, diễn giải số đo, chọn
log. Cố ý KHÔNG mock pymavlink để test phần bay: mọi lỗi mà adversarial review
tìm ra trên nhánh này đều là *cổng nối vào sai thứ*, và một bộ test quanh
pymavlink giả sẽ kiểm đúng những cổng sai đó một cách trung thành.

Đặt ở `backend/tests/` vì `pyproject.toml` đặt `testpaths = ["backend/tests"]`;
đổi testpaths chỉ vì một file là tốn hơn giá trị nó mang lại.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_SITL = Path(__file__).resolve().parents[2] / "scripts" / "sitl"
sys.path.insert(0, str(_SITL))

pytest.importorskip("pymavlink", reason="harness cần pymavlink")

import harness  # noqa: E402
import run_mission_auto  # noqa: E402
import run_mission_low_alt  # noqa: E402


# ---------------------------------------------------------------------------
# Toạ độ
# ---------------------------------------------------------------------------
def test_haversine_khoang_cach_0_khi_trung_diem():
    assert harness.haversine_m(10.76, 106.66, 10.76, 106.66) == 0.0


def test_offset_latlon_di_dung_huong_va_dung_khoang():
    lat0, lon0 = 10.76, 106.66
    lat, lon = harness.offset_latlon(lat0, lon0, 100.0, 0.0)

    assert lat > lat0, "đi 100 m về phía BẮC thì vĩ độ phải tăng"
    assert lon == pytest.approx(lon0), "không dịch đông/tây thì kinh độ giữ nguyên"
    assert harness.haversine_m(lat0, lon0, lat, lon) == pytest.approx(100.0, abs=0.5)


def test_offset_latlon_huong_dong():
    lat0, lon0 = 10.76, 106.66
    lat, lon = harness.offset_latlon(lat0, lon0, 0.0, 250.0)

    assert lon > lon0
    assert harness.haversine_m(lat0, lon0, lat, lon) == pytest.approx(250.0, abs=1.0)


# ---------------------------------------------------------------------------
# So khớp mission — cái canh lỗi nạp mission kinh điển
# ---------------------------------------------------------------------------
def _item(command=16, frame=3, x=107_600_000, y=1_066_600_000, z=25.0):
    return {"command": command, "frame": frame, "x": x, "y": y, "z": z}


def test_so_khop_giong_het_thi_khong_lech():
    items = [_item(), _item(x=107_610_000)]
    assert run_mission_auto.so_khop(items, [dict(i) for i in items]) == []


def test_so_khop_bo_qua_item_0_vi_do_la_o_home():
    """FC ghi đè item 0 bằng home THẬT của nó, so với cái ta gửi là vô nghĩa."""
    gui = [_item(z=0.0), _item()]
    doc = [_item(z=584.1, x=1, y=2, command=999), _item()]

    assert run_mission_auto.so_khop(gui, doc) == []


def test_so_khop_bat_lech_frame():
    """Lỗi kinh điển: gửi GLOBAL_RELATIVE_ALT, nhận về GLOBAL. `z` vẫn khớp về
    SỐ nhưng máy bay bay ở độ cao hoàn toàn khác. Bỏ `frame` ra khỏi phép so là
    làm nó mù đúng chỗ nguy hiểm nhất."""
    gui = [_item(), _item(frame=3)]
    doc = [_item(), _item(frame=0)]

    lech = run_mission_auto.so_khop(gui, doc)

    assert len(lech) == 1
    assert "frame" in lech[0]


def test_so_khop_bat_lech_do_cao():
    gui = [_item(), _item(z=25.0)]
    doc = [_item(), _item(z=3.0)]

    assert any("z" in ln for ln in run_mission_auto.so_khop(gui, doc))


def test_so_khop_bat_lech_so_luong_va_dung_ngay():
    lech = run_mission_auto.so_khop([_item(), _item()], [_item()])

    assert len(lech) == 1, "lệch số item thì báo một dòng rồi dừng, không so tiếp"
    assert "số item" in lech[0]


def test_so_khop_bo_qua_sai_lech_lam_tron_toa_do():
    """Lệch 1 đơn vị 1e7 là ~1 cm — làm tròn, không phải nạp sai."""
    gui = [_item(), _item(x=107_600_000)]
    doc = [_item(), _item(x=107_600_003)]

    assert run_mission_auto.so_khop(gui, doc) == []


# ---------------------------------------------------------------------------
# Diễn giải số đo — tách riêng để câu kết luận không mạnh hơn số đo
# ---------------------------------------------------------------------------
def test_ket_luan_khong_do_duoc_thi_tu_choi_ket_luan():
    dat, cau = run_mission_low_alt.ket_luan_phase_07(None)

    assert dat is False
    assert "Chưa kết luận" in cau


def test_ket_luan_day_bang_0_la_dinh_doan_ha_canh_nen_tu_choi():
    """Đáy ~0 nghĩa là phép đo dính đoạn hạ cánh chứ không phải waypoint thấp.
    Đây chính là lỗi đã tự bắt được: con số đó không phân biệt được hai khả
    năng nó sinh ra để phân biệt."""
    dat, cau = run_mission_low_alt.ket_luan_phase_07(-0.006)

    assert dat is False
    assert "Chưa kết luận" in cau


def test_ket_luan_day_dung_dai_thi_ket_luan_duoc():
    dat, cau = run_mission_low_alt.ket_luan_phase_07(3.2)

    assert dat is True
    assert "BẮT BUỘC" in cau


def test_ket_luan_day_qua_cao_thi_khong_ket_luan():
    """Không xuống tới gần waypoint thấp thì cũng không kết luận được gì."""
    dat, _ = run_mission_low_alt.ket_luan_phase_07(24.0)

    assert dat is False


# ---------------------------------------------------------------------------
# Chọn log
# ---------------------------------------------------------------------------
def test_find_latest_bin_lay_file_moi_nhat(tmp_path):
    import os
    import time

    a, b = tmp_path / "00000001.BIN", tmp_path / "00000002.BIN"
    a.write_bytes(b"x")
    b.write_bytes(b"y")
    os.utime(a, (time.time() - 100, time.time() - 100))

    assert harness.find_latest_bin([tmp_path]) == b


def test_find_latest_bin_khong_co_thi_tra_none(tmp_path):
    assert harness.find_latest_bin([tmp_path, tmp_path / "khong-ton-tai"]) is None


def test_run_dir_nam_duoi_home_chu_khong_phai_tmp():
    """/tmp là thư mục ai cũng ghi được — đường dẫn đoán trước được ở đó bị
    chèn symlink được (SonarCloud python:S5443)."""
    assert not str(harness.RUN_DIR_BASE).startswith("/tmp")


def test_so_khop_bo_qua_frame_cua_lenh_khong_co_toa_do():
    """`NAV_RETURN_TO_LAUNCH` không mang lat/lon/alt nên `frame` của nó vô
    nghĩa, và ArduPilot chuẩn hoá về GLOBAL(0) bất kể ta gửi gì. Đã đo thật
    22/09/2026: gửi frame 3, FC trả 0. Báo lệch ở đây là báo nhầm."""
    rtl = run_mission_auto.LENH_KHONG_CO_TOA_DO
    lenh_rtl = next(iter(rtl))
    gui = [_item(), _item(command=lenh_rtl, frame=3)]
    doc = [_item(), _item(command=lenh_rtl, frame=0)]

    assert run_mission_auto.so_khop(gui, doc) == []


def test_so_khop_van_bat_frame_cua_lenh_CO_toa_do():
    """Nới cho RTL không được nới cho waypoint — đó mới là chỗ frame quan trọng."""
    gui = [_item(), _item(command=16, frame=3)]
    doc = [_item(), _item(command=16, frame=0)]

    assert any("frame" in ln for ln in run_mission_auto.so_khop(gui, doc))
