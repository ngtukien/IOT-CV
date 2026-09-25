"""Máy trạng thái an toàn — Phase 07 §7.7, §7.9, §7.10.1.

Mỗi dòng bảng §7.7 một test, và mỗi test khẳng định CẢ cột "KHÔNG LÀM": sau
khi bơm sự kiện, `FakeMAVLink.sent` KHÔNG chứa lệnh đổi mode, arm/disarm, hay
bất kỳ gói mission nào. Cột đó là phần dễ bị vi phạm nhất bởi một lập trình
viên có thiện chí ("mất link thì cho RTL luôn cho an toàn").
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import pytest

from backend.mavlink.deadman import DeadmanLoop
from backend.mavlink.mission import MissionManager
from backend.mavlink.safety import SafetyMonitor, flight_readiness_problem
from backend.schemas import CmdMissionUpload, CmdTakeoff, MissionWaypoint
from backend.tests.fakes import stack_gia
from backend.tests.test_control import (
    FORCE_DISARM_MAGIC,
    LENH_BI_CAM,
    TEN_BI_CAM,
    _ten_va_so_trong,
)
from backend.ws import WebSocketHub, _handle_takeoff

BACKEND = Path(__file__).resolve().parents[1]

# MAV_CMD mà backend KHÔNG BAO GIỜ được tự gửi khi phản ứng với sự cố.
MAV_CMD_DO_SET_MODE = 176
MAV_CMD_COMPONENT_ARM_DISARM = 400
MAV_CMD_MISSION_START = 300
LENH_TU_QUYET = {MAV_CMD_DO_SET_MODE, MAV_CMD_COMPONENT_ARM_DISARM, MAV_CMD_MISSION_START, 20, 21}


def _lenh_tu_quyet(fake) -> list:
    """Mọi gói trong `sent` là tự-quyết của backend: đổi mode, arm, RTL/LAND,
    mission. Velocity zero KHÔNG nằm trong danh sách — nó là rút lệnh, không
    phải can thiệp thêm (lý do 4)."""
    vi_pham = []
    for ten, payload in fake.sent:
        if ten == "command_long_send" and payload["args"][2] in LENH_TU_QUYET:
            vi_pham.append((ten, payload["args"][2]))
        elif ten.startswith("mission_") or ten == "set_mode_send":
            vi_pham.append((ten, None))
    return vi_pham


def _goi_zero(fake) -> int:
    return sum(
        1
        for ten, p in fake.sent
        if ten == "set_position_target_local_ned_send"
        and (p["vx"], p["vy"], p["vz"], p["yaw_rate"]) == (0.0, 0.0, 0.0, 0.0)
    )


def _so_kiem(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(d) for d in path.read_text(encoding="utf-8").splitlines() if d.strip()]


def _canh(tmp_path: Path, *, dang_lai: bool = True):
    conn, fake, state, safety, control = stack_gia()
    deadman = DeadmanLoop(
        control, safety, tick_ms=20, repeat=2, timeout_ms=300, log_path=tmp_path / "dm.jsonl"
    )
    mission = MissionManager(conn, state=state, control=control)
    hub = WebSocketHub(
        state=state, safety=safety, control=control, deadman=deadman, mission=mission
    )
    # Đồng bộ ảnh chụp "lần trước" để lần reconcile đầu không coi mọi thứ là đổi.
    hub._last_mode = state.mode
    hub._last_link_alive = True
    if dang_lai:
        hub.web_control_owner = "s-1"
        safety.enable_web_control()
    return hub, fake, state, safety, deadman


# ---------------------------------------------------------------------------
# Dòng 1 — mất link MAVLink
# ---------------------------------------------------------------------------
def test_mat_link_thu_quyen_ghi_so_kiem_va_khong_tu_doi_mode(tmp_path):
    hub, fake, state, safety, _ = _canh(tmp_path)
    state.last_update = time.monotonic() - 60  # im lặng quá LINK_TIMEOUT_S

    asyncio.run(hub._reconcile_control_ownership())

    assert safety.web_control_enabled is False
    assert hub.web_control_owner is None
    assert [d["reason"] for d in _so_kiem(tmp_path / "dm.jsonl")] == ["link_lost"]
    assert hub.build_status().connected is False
    # KHÔNG LÀM: không RTL/LAND/đổi mode — gửi vào đâu? link đã mất.
    assert _lenh_tu_quyet(fake) == []


def test_event_link_lost_muc_error():
    """Thread telemetry phát `link.lost` mức error (§7.7), không còn warn."""
    src = (BACKEND / "mavlink" / "telemetry.py").read_text(encoding="utf-8")
    khoi = src[src.index('"link.lost"') - 200 : src.index('"link.lost"')]
    assert '"error"' in khoi


# ---------------------------------------------------------------------------
# Dòng 2 — WebSocket đóng
# ---------------------------------------------------------------------------
def test_dong_socket_gui_zero_ngay_va_khong_doi_mode(tmp_path):
    hub, fake, state, safety, _ = _canh(tmp_path)

    asyncio.run(hub.disconnect("s-1"))

    assert _goi_zero(fake) >= 1
    assert safety.web_control_enabled is False
    assert [d["reason"] for d in _so_kiem(tmp_path / "dm.jsonl")] == ["web_disconnected"]
    assert state.mode == "GUIDED"
    assert _lenh_tu_quyet(fake) == []  # KHÔNG đổi mode, KHÔNG disarm


# ---------------------------------------------------------------------------
# Dòng 3 — dead-man hết hạn (trình duyệt treo)
# ---------------------------------------------------------------------------
def test_deadman_het_han_gui_zero_danh_dau_va_khong_doi_mode(tmp_path):
    hub, fake, _, safety, deadman = _canh(tmp_path)
    safety.note_manual_command(now=100.0)
    deadman.note_velocity(0.5, 0, 0)

    deadman.tick(now=100.5)  # quá 300 ms

    assert _goi_zero(fake) >= 1
    assert safety.deadman_tripped is True
    assert safety.last_zero_velocity_reason == "deadman_timeout"
    assert _lenh_tu_quyet(fake) == []


# ---------------------------------------------------------------------------
# Dòng 4 — phi công gạt RC ra khỏi GUIDED
# ---------------------------------------------------------------------------
def test_rc_gat_khoi_guided_thu_quyen_va_khong_ep_quay_lai(tmp_path):
    hub, fake, state, safety, _ = _canh(tmp_path)
    state.mode = "LOITER"

    asyncio.run(hub._reconcile_control_ownership())

    assert safety.web_control_enabled is False
    assert hub.web_control_owner is None
    assert state.mode == "LOITER"
    # KHÔNG ép quay lại GUIDED: RC có quyền cao nhất (SAFETY.md mục 4).
    assert _lenh_tu_quyet(fake) == []


# ---------------------------------------------------------------------------
# Dòng 5 — EKF hỏng / chưa 3D fix
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("truong", "gia_tri"),
    [("ekf_ok", False), ("gps_fix_type", 2), ("gps_fix_type", None)],
)
def test_chua_san_sang_bay(truong, gia_tri):
    _, _, state, _, _ = stack_gia()
    setattr(state, truong, gia_tri)
    assert flight_readiness_problem(state) is not None


def test_ekf_chua_biet_khong_chan():
    """`ekf_ok is None` = CHƯA BIẾT, chặn vì chưa biết là chặn nhầm."""
    _, _, state, _, _ = stack_gia()
    state.ekf_ok = None
    assert flight_readiness_problem(state) is None


def test_ekf_hong_tu_choi_takeoff_va_mission_nhung_khong_disarm(tmp_path):
    hub, fake, state, _, _ = _canh(tmp_path, dang_lai=False)
    state.ekf_ok = False
    state.home_lat, state.home_lon = 10.0, 106.0
    loi: list[str] = []

    async def ghi_loi(socket_id, code, message, **kw):
        loi.append(code)

    hub.send_error = ghi_loi  # type: ignore[method-assign]

    class _PB:
        type = "cmd.takeoff"
        id = "c-1"

    asyncio.run(_handle_takeoff(hub, "s-1", _PB(), CmdTakeoff(altitude=5.0)))
    upload = CmdMissionUpload(
        waypoints=[MissionWaypoint(seq=1, lat=10.0, lon=106.0, alt=5.0, command=22)]
    )
    kq = asyncio.run(hub.upload_mission(upload, socket_id="s-1"))

    assert loi == ["validation_failed"]
    assert kq.code == "validation_failed"
    assert fake.sent == []  # KHÔNG gửi gì: không takeoff, không mission, không disarm


def test_monitor_bao_khi_ekf_hong_va_khi_hoi_lai_chi_mot_lan():
    _, _, state, _, _ = stack_gia()
    mon = SafetyMonitor()
    assert mon.observe(state) == []  # đang khoẻ: không báo gì

    state.ekf_ok = False
    ev = mon.observe(state)
    assert [e.code for e in ev] == ["safety.not_ready"]
    assert ev[0].level == "warn"
    assert mon.observe(state) == []  # không báo lại mỗi nhịp

    state.ekf_ok = True
    assert [e.code for e in mon.observe(state)] == ["safety.ready"]


def test_monitor_luc_moi_noi_chua_co_gps_khong_bao():
    _, _, state, _, _ = stack_gia()
    state.gps_fix_type = None
    assert SafetyMonitor().observe(state) == []


# ---------------------------------------------------------------------------
# Dòng 6 — pin thấp
# ---------------------------------------------------------------------------
def test_pin_thap_chi_canh_bao_mot_lan_va_khong_tu_rtl(tmp_path):
    hub, fake, state, _, _ = _canh(tmp_path, dang_lai=False)
    state.battery_remaining = 24

    for _ in range(5):
        asyncio.run(hub._observe_safety())

    codes = [e.code for e in hub.bus.recent()]
    assert codes.count("battery.low") == 1
    assert _lenh_tu_quyet(fake) == []  # KHÔNG tự RTL


def test_pin_can_hoi_qua_nguong_tre_moi_bao_lai():
    _, _, state, _, _ = stack_gia()
    mon = SafetyMonitor()
    state.battery_remaining = 24
    assert len(mon.observe(state)) == 1
    state.battery_remaining = 26  # vừa qua ngưỡng, chưa qua trễ 3%
    mon.observe(state)
    state.battery_remaining = 24
    assert mon.observe(state) == []
    state.battery_remaining = 30
    mon.observe(state)
    state.battery_remaining = 20
    assert [e.code for e in mon.observe(state)] == ["battery.low"]


# ---------------------------------------------------------------------------
# Dòng 7 — operator tắt WEB CONTROL
# ---------------------------------------------------------------------------
def test_operator_tat_web_control_gui_zero_khong_doi_mode(tmp_path):
    from backend.schemas import CmdWebControlEnable
    from backend.ws import _handle_web_control_enable

    hub, fake, _, safety, _ = _canh(tmp_path)

    async def bo_qua(*a, **k):
        return None

    hub.send_ack = bo_qua  # type: ignore[method-assign]

    class _PB:
        type = "cmd.web_control_enable"
        id = "c-1"

    asyncio.run(_handle_web_control_enable(hub, "s-1", _PB(), CmdWebControlEnable(enabled=False)))

    assert _goi_zero(fake) >= 1
    assert [d["reason"] for d in _so_kiem(tmp_path / "dm.jsonl")] == ["operator_disabled"]
    assert _lenh_tu_quyet(fake) == []


# ---------------------------------------------------------------------------
# Dòng 8 — mất camera
# ---------------------------------------------------------------------------
class _CameraGia:
    def __init__(self) -> None:
        self.available = True

    def latest(self):
        return None


def test_mat_camera_bao_warn_status_doi_telemetry_van_chay(tmp_path):
    hub, fake, state, safety, _ = _canh(tmp_path)
    hub.camera = _CameraGia()
    asyncio.run(hub._observe_safety())
    assert hub.build_status().camera.available is True

    hub.camera.available = False
    asyncio.run(hub._observe_safety())

    assert hub.build_status().camera.available is False
    ev = [e for e in hub.bus.recent() if e.code == "camera.lost"]
    assert len(ev) == 1 and ev[0].level == "warn" and ev[0].source == "vision"
    # KHÔNG ảnh hưởng telemetry / quyền lái / lệnh (SAFETY.md mục 9).
    assert safety.web_control_enabled is True
    assert hub.web_control_owner == "s-1"
    assert fake.sent == []


# ---------------------------------------------------------------------------
# §7.9 — quét hàm cấm trên TOÀN backend/
# ---------------------------------------------------------------------------
def _ten_va_so(path: Path) -> tuple[set[str], set[float]]:
    """Dùng CHUNG `_ten_va_so_trong` của test_control.py (AST, bỏ comment và
    docstring), cộng thêm tên hàm `*_send` truyền dạng CHUỖI — cách lách kiểu
    `getattr(mav, "rc_channels_override_send")` mà quét tên thuần không thấy.

    Không dùng regex theo dòng như lệnh gợi ý trong plan §7.9: lệnh đó chỉ lọc
    dòng bắt đầu bằng `#`, nên nó ĐỎ ngay trên code sạch — bắt trúng docstring
    của control.py ("KHÔNG có `send_motor_pwm()`", "`param2 = 21196`"). Chạy thật
    25/09/2026 in ra 2 dòng. Một cổng đỏ thường trực thì chẳng ai còn đọc nó.
    """
    import ast

    ten, so = _ten_va_so_trong(path)
    for nut in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        is_str = isinstance(nut, ast.Constant) and isinstance(nut.value, str)
        if is_str and nut.value.endswith("_send"):
            ten.add(nut.value)
    return ten, so


def _file_backend() -> list[Path]:
    return [p for p in BACKEND.rglob("*.py") if "tests" not in p.parts]


def test_quet_ham_cam_toan_backend():
    vi_pham: list[str] = []
    for path in _file_backend():
        ten, so = _ten_va_so(path)
        for cam in sorted(ten & set(TEN_BI_CAM)):
            vi_pham.append(f"{path.relative_to(BACKEND)}: gọi {cam}")
        if float(FORCE_DISARM_MAGIC) in so:
            vi_pham.append(f"{path.relative_to(BACKEND)}: có 21196 (force disarm)")
    assert vi_pham == [], "\n".join(vi_pham)


def test_quet_lenh_cam_trong_code_gui_lenh():
    """MAV_CMD cấm (DO_MOTOR_TEST 209, PREFLIGHT_REBOOT 246, DO_SET_SERVO...) —
    chỉ quét file GỬI lệnh MAVLink. Quét cả backend thì số 209 trong danh sách
    trắng mission (schemas.py nói "209 bị cấm") hay trong config sẽ báo nhầm."""
    gui_lenh = [BACKEND / "mavlink" / f for f in ("control.py", "mission.py", "deadman.py")]
    for path in gui_lenh:
        _, so = _ten_va_so(path)
        co = sorted(ma for ma in LENH_BI_CAM if float(ma) in so)
        assert co == [], f"{path.name} có MAV_CMD bị cấm: {co}"


def test_quet_ham_cam_tu_do():
    """Cổng quét phải ĐỎ khi có vi phạm — một cổng chưa từng thấy đỏ là chưa
    được chứng minh (rules/green-that-proves-nothing.md)."""
    import tempfile

    src = "def f(conn):\n    conn.master.mav.rc_channels_override_send(1, 1)\n    x = 21196\n"
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as fh:
        fh.write(src)
    ten, so = _ten_va_so(Path(fh.name))
    assert "rc_channels_override_send" in ten & set(TEN_BI_CAM)
    assert float(FORCE_DISARM_MAGIC) in so
    Path(fh.name).unlink()


def test_backend_khong_co_ham_tu_doi_mode_khi_su_co():
    """§6.6 dòng cuối: `auto_rtl_on_link_loss()`, `auto_land_on_low_battery()`."""
    for path in _file_backend():
        ten, _ = _ten_va_so(path)
        tu_quyet = sorted(t for t in ten if t.startswith(("auto_rtl", "auto_land")))
        assert tu_quyet == [], f"{path.name}: {tu_quyet}"
