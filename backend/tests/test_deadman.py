"""Test vòng DEAD-MAN — Phase 06, việc 6.5.

Ba bài đầu là **ba test bắt buộc của `SAFETY.md` §5**, ba bài sau là để bảo
đảm rằng ba bài đầu nói thật.

Chạy với `FakeMAVLink`, **không cần SITL**. Mọi bài trừ bài #5 bơm THỜI GIAN
GIẢ qua `tick(now=...)` nên tất định, không chập chờn. Bài #5 bắt buộc dùng
thời gian thật vì thứ nó đo chính là tính đồng thời.
"""

from __future__ import annotations

import asyncio
import json
import threading
import time
from pathlib import Path

import pytest

from backend.mavlink.deadman import DeadmanLoop
from backend.schemas import CmdVelocity
from backend.tests.fakes import stack_gia
from backend.ws import WebSocketHub, _handle_velocity


def _doc_so_kiem(duong_dan: Path) -> list[dict]:
    if not duong_dan.exists():
        return []
    return [
        json.loads(dong)
        for dong in duong_dan.read_text(encoding="utf-8").splitlines()
        if dong.strip()
    ]


def _goi_velocity(fake) -> dict | None:
    return fake.last("set_position_target_local_ned_send")


class _PhongBi:
    """Đủ dùng cho handler: nó chỉ đọc `type` và `id`."""

    type = "cmd.velocity"
    id = "c-1"


def _dung_canh(tmp_path: Path, *, mode: str = "GUIDED", bat_web_control: bool = True):
    """Dựng hub + vòng dead-man đã nối sẵn, và một danh sách thu lỗi."""
    conn, fake, state, safety, control = stack_gia(mode=mode)
    deadman = DeadmanLoop(
        control,
        safety,
        tick_ms=20,
        repeat=3,
        timeout_ms=300,
        log_path=tmp_path / "deadman.jsonl",
    )
    hub = WebSocketHub(state=state, safety=safety, control=control, deadman=deadman)
    if bat_web_control:
        hub.web_control_owner = "s-1"
        safety.enable_web_control()

    loi: list[tuple[str, str]] = []

    async def _ghi_loi(socket_id, code, message, **kwargs):
        loi.append((code, message))

    hub.send_error = _ghi_loi  # type: ignore[method-assign]
    return hub, fake, state, safety, deadman, loi


def _gui_velocity(hub, **truong) -> None:
    asyncio.run(_handle_velocity(hub, "s-1", _PhongBi(), CmdVelocity(**truong)))


# ---------------------------------------------------------------------------
# BA TEST BẮT BUỘC — SAFETY.md §5
# ---------------------------------------------------------------------------
def test_giu_W_thi_gui_velocity_tien(tmp_path):
    """SAFETY.md §5 bài 1: nhấn W -> UAV tiến."""
    hub, fake, _state, _safety, _deadman, loi = _dung_canh(tmp_path)

    _gui_velocity(hub, vx=1.0)

    assert loi == [], f"khong duoc co loi nao: {loi}"
    goi = _goi_velocity(fake)
    assert goi is not None, "chua gui goi velocity nao"
    assert goi["vx"] == pytest.approx(1.0)
    assert goi["coordinate_frame"] == 9, "BODY_OFFSET_NED — theo mui may bay"
    assert goi["type_mask"] == 0x0DC7


def test_tha_W_thi_gui_velocity_zero(tmp_path):
    """SAFETY.md §5 bài 2: thả W -> UAV dừng."""
    hub, fake, _state, _safety, _deadman, loi = _dung_canh(tmp_path)

    _gui_velocity(hub, vx=1.0)
    _gui_velocity(hub, vx=0.0)

    assert loi == []
    assert _goi_velocity(fake)["vx"] == pytest.approx(0.0)


def test_dong_browser_khi_dang_giu_W_thi_dung(tmp_path):
    """SAFETY.md §5 bài 3 — bài quan trọng nhất của cả phase.

    Đang giữ W thì socket đóng đột ngột. Gói KẾ TIẾP phải là (0,0,0), và sổ
    kiểm phải có dòng `web_disconnected`.

    Bài này bắt đúng cái bẫy của thiết kế: `on_web_disconnected()` tắt cờ
    `web_control_enabled`, mà `should_send_zero_velocity()` trả False ngay khi
    cờ đó tắt. Nếu đường đóng-socket chỉ tắt cờ rồi trông chờ vòng dead-man
    phanh hộ thì KHÔNG AI gửi gì cả — và bài này đỏ.
    """
    hub, fake, _state, safety, deadman, _loi = _dung_canh(tmp_path)
    _gui_velocity(hub, vx=1.0)
    assert _goi_velocity(fake)["vx"] == pytest.approx(1.0)

    # Socket đóng: hub gọi disconnect, không ai kịp gửi lệnh dừng.
    hub._clients["s-1"] = None  # type: ignore[assignment]
    asyncio.run(hub.disconnect("s-1"))

    goi = _goi_velocity(fake)
    assert goi["vx"] == pytest.approx(0.0)
    assert goi["vy"] == pytest.approx(0.0)
    assert goi["vz"] == pytest.approx(0.0)

    dong = _doc_so_kiem(deadman.log_path)
    assert len(dong) == 1, f"mot lan trip = dung mot dong so kiem, thay {len(dong)}"
    assert dong[0]["reason"] == "web_disconnected"
    assert dong[0]["socket_id"] == "s-1"
    assert dong[0]["sent"] is True
    assert safety.deadman_tripped is True
    assert safety.last_zero_velocity_reason == "web_disconnected"


# ---------------------------------------------------------------------------
# BA TEST CỦNG CỐ
# ---------------------------------------------------------------------------
def test_timeout_gui_zero_khi_frontend_treo(tmp_path):
    """Trình duyệt treo: socket còn mở nhưng ngừng gửi lệnh.

    Bảo đảm là `MANUAL_COMMAND_TIMEOUT_MS + DEADMAN_TICK_MS` = 350 ms, không
    phải "đúng 300 ms". 300 là ngưỡng HẾT HẠN, 350 là ngưỡng GIAO HÀNG.
    """
    hub, fake, _state, safety, deadman, _loi = _dung_canh(tmp_path)
    _gui_velocity(hub, vx=1.0)
    safety.note_manual_command(now=100.0)

    # Trong hạn: vòng chỉ GỬI LẠI lệnh cũ, không phanh.
    deadman.tick(now=100.2)
    assert _goi_velocity(fake)["vx"] == pytest.approx(1.0)
    assert safety.deadman_tripped is False

    # Quá hạn 350 ms: phanh.
    deadman.tick(now=100.35)
    assert _goi_velocity(fake)["vx"] == pytest.approx(0.0)
    assert safety.deadman_tripped is True
    assert _doc_so_kiem(deadman.log_path)[0]["reason"] == "deadman_timeout"


def test_timeout_chi_ghi_mot_dong_so_kiem_roi_thoi(tmp_path):
    """Trip xong phải THU QUYỀN, nếu không nó trip lại ở mọi nhịp sau.

    Không có chỗ này thì `logs/deadman.jsonl` nhận 20 dòng giống nhau mỗi giây
    cho tới hết phiên, và phép đo độ trễ của Phase 10 vô nghĩa.
    """
    hub, fake, _state, safety, deadman, _loi = _dung_canh(tmp_path)
    _gui_velocity(hub, vx=1.0)
    safety.note_manual_command(now=100.0)

    for i in range(20):
        deadman.tick(now=100.35 + i * 0.05)

    dong = _doc_so_kiem(deadman.log_path)
    assert len(dong) == 1, f"trip mot lan nhung ghi {len(dong)} dong"
    assert safety.web_control_enabled is False


def test_lap_lai_goi_zero_chong_rot_goi_udp(tmp_path):
    """`ZERO_VELOCITY_REPEAT` nhịp zero liên tiếp, một dòng sổ kiểm duy nhất."""
    hub, fake, _state, safety, deadman, _loi = _dung_canh(tmp_path)  # repeat=3
    _gui_velocity(hub, vx=1.0)
    safety.note_manual_command(now=100.0)

    deadman.tick(now=100.35)  # trip: gói zero thứ 1
    deadman.tick(now=100.40)  # gói zero thứ 2
    deadman.tick(now=100.45)  # gói zero thứ 3

    so_goi_zero = sum(
        1 for ten, p in fake.sent if ten == "set_position_target_local_ned_send" and p["vx"] == 0.0
    )
    assert so_goi_zero == 3
    assert len(_doc_so_kiem(deadman.log_path)) == 1


def test_event_loop_bi_chen_van_gui_zero(tmp_path):
    """Test #5 — LÝ DO TỒN TẠI của việc vòng dead-man nằm ở thread riêng.

    Một task async chẹn event loop bằng `time.sleep(0.6)` (gọi nhầm hàm
    blocking — chuyện sẽ xảy ra thật khi Phase 19 nhét vòng suy luận ảnh vào).
    Vòng dead-man vẫn phải phanh đúng hạn, TRONG lúc loop đang đứng hình.

    **Chuyển `DeadmanLoop` vào asyncio là bài này ĐỎ.** Đó là toàn bộ mục đích
    của nó. Khẳng định `mono < het_chen` mới là phần có răng: nó nói lệnh zero
    đã bay đi TRONG lúc chẹn, chứ không phải sau khi loop được thả ra.
    """
    conn, fake, _state, safety, control = stack_gia()
    deadman = DeadmanLoop(
        control,
        safety,
        tick_ms=20,
        repeat=2,
        timeout_ms=100,
        log_path=tmp_path / "deadman.jsonl",
    )
    safety.enable_web_control()
    safety.note_manual_command()
    deadman.note_velocity(1.0, 0.0, 0.0, 0.0)

    # `start()` được gọi TỪ BÊN TRONG event loop rồi loop đó bị chẹn ngay sau.
    #
    # Thứ tự này là cả bài test. Gọi `start()` TRƯỚC `asyncio.run` thì một bản
    # `asyncio.create_task` cũng qua được — nó sẽ tự dựng loop riêng ở thread
    # riêng và chẳng liên quan gì tới loop bị chẹn. Đã thử và nó xanh, tức là
    # bài test khi đó không canh được gì cả. Phải chẹn ĐÚNG cái loop mà vòng
    # dead-man sẽ bám vào nếu ai đó viết nó bằng asyncio.
    async def chen_event_loop() -> float:
        deadman.start()
        await asyncio.sleep(0)  # nhường một vòng: task asyncio (nếu có) kịp chạy
        time.sleep(0.6)  # noqa: ASYNC251 — chẹn loop LÀ nội dung bài test
        return time.monotonic()

    try:
        het_chen = asyncio.run(chen_event_loop())
    finally:
        deadman.stop()

    # Canh thêm về mặt CẤU TRÚC, không chỉ về thời gian: một bản viết bằng
    # `asyncio.create_task` sẽ không có thread nào, nên dòng này đỏ ngay cả khi
    # phép đo thời gian tình cờ thuận lợi.
    assert isinstance(deadman._thread, threading.Thread | type(None))
    assert safety.deadman_tripped is True, (
        "vong dead-man khong chay khi event loop bi chen — no co dang nam trong asyncio khong?"
    )
    dong = _doc_so_kiem(deadman.log_path)
    assert dong, "khong co dong so kiem nao"
    assert dong[0]["reason"] == "deadman_timeout"
    assert dong[0]["mono"] < het_chen, (
        "lenh zero chi bay di SAU khi loop duoc tha ra — do khong phai dead-man"
    )
    assert _goi_velocity(fake)["vx"] == pytest.approx(0.0)


def test_khong_gui_velocity_khi_chua_bat_web_control(tmp_path):
    """Web không tự giành quyền (SAFETY.md mục 4)."""
    hub, fake, _state, _safety, deadman, loi = _dung_canh(tmp_path, bat_web_control=False)

    _gui_velocity(hub, vx=1.0)
    deadman.tick(now=100.0)
    deadman.tick(now=200.0)  # quá hạn rất xa — vẫn không được gửi gì

    assert _goi_velocity(fake) is None, "khong duoc co goi velocity nao"
    assert loi and loi[0][0] == "web_control_disabled"


# ---------------------------------------------------------------------------
# Các cổng còn lại
# ---------------------------------------------------------------------------
def test_khong_lai_duoc_ngoai_guided(tmp_path):
    hub, fake, _state, _safety, _deadman, loi = _dung_canh(tmp_path, mode="LOITER")

    _gui_velocity(hub, vx=1.0)

    assert _goi_velocity(fake) is None
    assert loi and loi[0][0] == "wrong_mode"


def test_tab_khac_khong_lai_duoc(tmp_path):
    """Một người lái. Tab thứ hai bị từ chối, không cướp được quyền."""
    hub, fake, _state, _safety, _deadman, loi = _dung_canh(tmp_path)

    asyncio.run(_handle_velocity(hub, "s-2", _PhongBi(), CmdVelocity(vx=1.0)))

    assert _goi_velocity(fake) is None
    assert loi and loi[0][0] == "command_denied"


def test_velocity_bi_kep_theo_max_velocity(tmp_path):
    """Kẹp IM LẶNG, cố ý — khác takeoff. Xem `takeoff` trong control.py."""
    from backend import config

    hub, fake, _state, _safety, _deadman, loi = _dung_canh(tmp_path)
    assert config.MAX_VELOCITY == 1.0

    _gui_velocity(hub, vx=5.0, vy=-5.0)

    assert loi == []
    goi = _goi_velocity(fake)
    assert goi["vx"] == pytest.approx(1.0)
    assert goi["vy"] == pytest.approx(-1.0)


def test_yaw_rate_kep_bang_nguong_rieng_khong_phai_max_velocity(tmp_path):
    """MAX_VELOCITY tính m/s; ép nó lên deg/s là kẹp yaw xuống 1 độ/giây."""
    import math

    from backend import config

    hub, fake, _state, _safety, _deadman, _loi = _dung_canh(tmp_path)

    _gui_velocity(hub, yaw_rate=180.0)

    goi = _goi_velocity(fake)
    assert goi["yaw_rate"] == pytest.approx(math.radians(config.MAX_YAW_RATE))
    assert goi["yaw_rate"] > math.radians(1.0), "bi kep bang MAX_VELOCITY -> lan don vi"


def test_bat_lai_web_control_xoa_co_deadman(tmp_path):
    """`deadman_tripped` DÍNH cho tới khi operator chủ động bật lại."""
    hub, _fake, _state, safety, deadman, _loi = _dung_canh(tmp_path)
    deadman.trip("deadman_timeout")
    assert safety.deadman_tripped is True

    deadman.clear_trip()

    assert safety.deadman_tripped is False
    assert safety.last_zero_velocity_reason is None


def test_reason_la_khoa_dong_khong_nhan_gia_tri_la(tmp_path):
    """Sổ kiểm là bằng chứng an toàn — `reason` sai làm hỏng phép đo Phase 10."""
    _hub, _fake, _state, _safety, deadman, _loi = _dung_canh(tmp_path)

    with pytest.raises(ValueError, match="ZERO_REASONS"):
        deadman.trip("tu_dung_thoi")


# ---------------------------------------------------------------------------
# Hồi quy của hai lỗi bắt được trên SITL THẬT ngày 2026-09-22
# ---------------------------------------------------------------------------
def test_bat_web_control_xong_ma_chua_lai_thi_khong_tu_trip(tmp_path):
    """Bật quyền lái rồi ngồi yên KHÔNG được làm mất quyền lái.

    `SafetyState.should_send_zero_velocity()` trả True khi chưa có lệnh nào —
    đúng cho riêng nó, nhưng nối thẳng vào vòng dead-man thì nhịp ĐẦU TIÊN sau
    `cmd.web_control_enable` đã trip. Quan sát thật trong bảng sự kiện của
    backend chạy với SITL:

        web_control.enabled -> deadman.zero_velocity (deadman_timeout)

    Tệ hơn: nó bắn một gói velocity ra dây khi drone CÒN TRÊN MẶT ĐẤT.

    Không test đơn vị nào cũ bắt được, vì bài nào cũng gửi một lệnh velocity
    trước khi bơm thời gian giả.
    """
    _hub, fake, _state, safety, deadman, _loi = _dung_canh(tmp_path)

    for i in range(10):
        deadman.tick(now=100.0 + i * 0.5)  # rất quá hạn, nhiều lần

    assert _goi_velocity(fake) is None, "gui velocity khi chua ai lai lan nao"
    assert safety.deadman_tripped is False
    assert safety.web_control_enabled is True, "bat quyen lai xong lai mat quyen lai"
    assert _doc_so_kiem(deadman.log_path) == []


def test_nha_phim_roi_ngoi_yen_khong_bi_thu_quyen(tmp_path):
    """Lệnh cuối đã là DỪNG thì hết hạn không phải sự cố.

    Frontend gửi 0 khi nhả phím rồi thôi (xem `frontend/control.js`). Coi đó là
    dead-man thì banner đỏ chớp sau MỖI nhịp gõ và quyền lái bị thu liên tục.
    """
    hub, fake, _state, safety, deadman, _loi = _dung_canh(tmp_path)
    _gui_velocity(hub, vx=1.0)  # giữ W
    _gui_velocity(hub, vx=0.0)  # nhả W
    safety.note_manual_command(now=100.0)

    deadman.tick(now=100.5)  # quá hạn rất xa

    assert safety.deadman_tripped is False, "nha phim ma bi coi la dead-man"
    assert safety.web_control_enabled is True, "nha phim ma bi thu quyen lai"
    assert _doc_so_kiem(deadman.log_path) == []
    # Vẫn phải gửi thêm một gói zero cho chắc.
    assert _goi_velocity(fake)["vx"] == pytest.approx(0.0)


def test_doi_sang_guided_khong_bi_quy_ket_la_thu_quyen(tmp_path):
    """Khối mode-change chỉ được nhận công khi CHÍNH nó thu quyền.

    GUIDED nằm trong whitelist nên `on_mode_change` không thu gì. Bản đầu vẫn
    in "Mode đổi sang GUIDED — web mất quyền lái" khi quyền đã bị vòng dead-man
    thu từ trước ở thread khác. Một dòng log đổ tội sai dẫn người đọc đi sai
    hướng còn hại hơn không log.
    """
    from backend.events import BUS

    hub, _fake, state, safety, _deadman, _loi = _dung_canh(tmp_path, mode="STABILIZE")
    # Vòng dead-man (thread khác) đã thu quyền trước đó.
    safety.disable_web_control()
    state.mode = "GUIDED"
    state.last_update = time.monotonic()

    asyncio.run(hub._reconcile_control_ownership())

    ly_do = [
        e.detail.get("reason")
        for e in BUS.recent(50)
        if e.code == "web_control.revoked" and e.detail
    ]
    assert "mode_change" not in ly_do, f"quy ket sai cho mode change: {ly_do}"
