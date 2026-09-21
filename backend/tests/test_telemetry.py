"""Test chuẩn hoá telemetry (GIAI ĐOẠN 6 + Phase 05) — message giả, không cần SITL."""

import threading

from backend.mavlink.connection import (
    MAV_CMD_REQUEST_MESSAGE,
    MAV_CMD_SET_MESSAGE_INTERVAL,
    STREAM_RATES,
    MavlinkConnection,
)
from backend.mavlink.telemetry import (
    EKF_ATTITUDE,
    EKF_CONST_POS_MODE,
    EKF_POS_HORIZ_ABS,
    EKF_VELOCITY_HORIZ,
    TelemetryState,
    build_telemetry,
    is_link_alive,
    mode_name,
    statustext_event,
    update_state,
)
from backend.tests.fakes import FakeMAVLink, FakeMessage


def test_heartbeat_cap_nhat_mode_va_armed():
    state = TelemetryState()
    # base_mode có bit 0b1000_0000 = đã armed; custom_mode 4 = GUIDED.
    update_state(state, FakeMessage("HEARTBEAT", base_mode=0b1000_0001, custom_mode=4), now=1.0)

    assert state.connected is True
    assert state.mode == "GUIDED"
    assert state.armed is True
    assert state.last_update == 1.0


def test_heartbeat_disarmed():
    state = TelemetryState()
    update_state(state, FakeMessage("HEARTBEAT", base_mode=0b0000_0001, custom_mode=5), now=1.0)

    assert state.mode == "LOITER"
    assert state.armed is False


def test_global_position_int_doi_don_vi():
    state = TelemetryState()
    update_state(
        state,
        FakeMessage(
            "GLOBAL_POSITION_INT",
            lat=101_234_560,
            lon=1_061_234_560,
            alt=12_000,
            relative_alt=5_200,
            hdg=12_500,
        ),
        now=2.0,
    )

    assert state.lat == 10.123456
    assert state.lon == 106.123456
    assert state.relative_alt == 5.2
    assert state.absolute_alt == 12.0
    assert state.heading == 125


def test_heading_khong_xac_dinh_thi_bo_qua():
    state = TelemetryState()
    update_state(
        state,
        FakeMessage("GLOBAL_POSITION_INT", lat=0, lon=0, alt=0, relative_alt=0, hdg=65535),
        now=1.0,
    )

    assert state.heading is None


def test_gps_va_battery():
    state = TelemetryState()
    update_state(state, FakeMessage("GPS_RAW_INT", satellites_visible=14, fix_type=3), now=1.0)
    update_state(state, FakeMessage("SYS_STATUS", voltage_battery=11_400), now=1.1)

    assert state.satellites == 14
    assert state.gps_fix_type == 3
    assert state.battery_voltage == 11.4


def test_battery_khong_co_so_do_thi_giu_none():
    state = TelemetryState()
    update_state(state, FakeMessage("SYS_STATUS", voltage_battery=65535), now=1.0)

    assert state.battery_voltage is None


def test_attitude_doi_sang_do():
    state = TelemetryState()
    update_state(state, FakeMessage("ATTITUDE", roll=0.0, pitch=0.0, yaw=0.0), now=1.0)

    assert state.roll == 0.0
    assert state.pitch == 0.0
    assert state.yaw == 0.0


def test_message_khong_quan_tam_thi_bo_qua():
    state = TelemetryState()
    update_state(state, FakeMessage("RAW_IMU", xacc=1), now=5.0)

    # Không cập nhật gì, kể cả last_update.
    assert state.last_update is None
    assert state.connected is False


def test_schema_json_dung_nhu_giai_doan_6():
    state = TelemetryState()
    payload = state.as_dict()

    for key in (
        "connected",
        "mode",
        "armed",
        "lat",
        "lon",
        "relative_alt",
        "heading",
        "ground_speed",
        "satellites",
        "battery_voltage",
    ):
        assert key in payload


def test_mode_name_khong_biet_thi_khong_crash():
    assert mode_name(4) == "GUIDED"
    assert mode_name(199) == "MODE_199"


def test_link_alive_theo_thoi_gian():
    state = TelemetryState()
    assert is_link_alive(state, now=10.0) is False

    state.last_update = 10.0
    assert is_link_alive(state, now=10.5) is True
    # LINK_TIMEOUT_S mặc định 3s.
    assert is_link_alive(state, now=20.0) is False


# ---------------------------------------------------------------------------
# Phase 05 — message mới
# ---------------------------------------------------------------------------
def test_battery_status_doi_ca_sang_ampe():
    state = TelemetryState()
    # current_battery tính theo cA: 250 cA = 2.5 A.
    update_state(
        state,
        FakeMessage("BATTERY_STATUS", current_battery=250, battery_remaining=76),
        now=1.0,
    )

    assert state.battery_current == 2.5
    assert state.battery_remaining == 76


def test_battery_status_khong_do_duoc_thi_none():
    """FC báo -1 nghĩa là KHÔNG ĐO ĐƯỢC. Để -1 lọt ra UI thì màn hình sẽ hiện
    'dòng điện -1 A' — vô nghĩa và khiến người đọc tưởng có số đo.

    Nạp giá trị THẬT trước rồi mới nạp -1: nếu chỉ nạp -1 vào state mới tinh
    thì test xanh cả khi xoá sạch nhánh BATTERY_STATUS, vì hai trường đó vốn
    đã là None.
    """
    state = TelemetryState()
    update_state(
        state,
        FakeMessage("BATTERY_STATUS", current_battery=250, battery_remaining=76),
        now=1.0,
    )
    assert state.battery_current == 2.5  # có số đo thật trước đã

    update_state(
        state,
        FakeMessage("BATTERY_STATUS", current_battery=-1, battery_remaining=-1),
        now=2.0,
    )

    assert state.battery_current is None
    assert state.battery_remaining is None
    # Message ĐÃ được xử lý, không phải bị bỏ qua — nếu không thì "đổi -1 thành
    # None" và "rơi mất message" trông giống hệt nhau.
    assert state.last_update == 2.0


def test_vfr_hud_climb_rate():
    state = TelemetryState()
    update_state(
        state,
        FakeMessage("VFR_HUD", groundspeed=3.5, climb=1.2, heading=90),
        now=1.0,
    )

    assert state.ground_speed == 3.5
    assert state.climb_rate == 1.2
    # Chưa có heading từ nguồn tốt hơn thì VFR_HUD được điền vào.
    assert state.heading == 90


def test_vfr_hud_khong_de_len_heading_cua_global_position():
    """GLOBAL_POSITION_INT cho heading chính xác hơn VFR_HUD. Bỏ cái canh
    `if state.heading is None` thì VFR_HUD (5 Hz) sẽ ghi đè liên tục và la bàn
    mất độ chính xác — im lặng, vì cả hai đều ra một con số trông hợp lý."""
    state = TelemetryState()
    update_state(
        state,
        FakeMessage("GLOBAL_POSITION_INT", lat=0, lon=0, alt=0, relative_alt=0, hdg=12_500),
        now=1.0,
    )
    assert state.heading == 125

    update_state(state, FakeMessage("VFR_HUD", groundspeed=1.0, climb=0.0, heading=90), now=2.0)

    assert state.heading == 125, "VFR_HUD đã ghi đè heading của GLOBAL_POSITION_INT"


def test_yaw_chuan_hoa_ve_0_359():
    """MAVLink cho yaw trong -pi..pi; la bàn của UI cần 0..359."""
    state = TelemetryState()
    update_state(state, FakeMessage("ATTITUDE", roll=0.0, pitch=0.0, yaw=-1.5708), now=1.0)

    assert 269.9 < state.yaw < 270.1


def test_home_position_chia_1e7():
    state = TelemetryState()
    update_state(
        state,
        FakeMessage("HOME_POSITION", latitude=107_600_000, longitude=1_066_600_000),
        now=1.0,
    )

    assert abs(state.home_lat - 10.76) < 1e-9
    assert abs(state.home_lon - 106.66) < 1e-9


def test_ekf_ok_khong_lay_tu_sys_status():
    """`ekf_ok` KHÔNG suy từ SYS_STATUS — đã đo và bác bỏ cách đó.

    Bit AHRS 0x20000000 thậm chí không có trong `onboard_control_sensors_present`
    trên build này; lấy theo nó thì `ekf_ok` luôn False và Phase 06 chặn arm
    nhầm mãi mãi. Chi tiết phép đo: docstring `_ekf_ok_tu_flags`.
    """
    state = TelemetryState()
    update_state(state, FakeMessage("SYS_STATUS", voltage_battery=11_400), now=1.0)

    assert state.ekf_ok is None, "SYS_STATUS không được phép đặt ekf_ok"


def test_ekf_ok_khoe_khi_co_du_loi_giai():
    """flags=0x033F — số ĐO THẬT từ SITL lúc GPS bật, EKF khoẻ."""
    state = TelemetryState()
    update_state(state, FakeMessage("EKF_STATUS_REPORT", flags=0x033F), now=1.0)

    assert state.ekf_ok is True


def test_ekf_ok_hong_khi_mat_vi_tri_tuyet_doi():
    """flags=0x00A7 — số ĐO THẬT lúc GPS tắt: mất POS_HORIZ_ABS và bật
    CONST_POS_MODE (EKF bỏ cuộc, ghim vị trí cố định)."""
    state = TelemetryState()
    update_state(state, FakeMessage("EKF_STATUS_REPORT", flags=0x00A7), now=1.0)

    assert state.ekf_ok is False


def test_ekf_ok_const_pos_mode_du_mot_minh_da_la_hong():
    """CONST_POS_MODE bật nghĩa là vị trí không đáng tin, kể cả khi mọi cờ
    khác đều sáng. Bỏ vế `not CONST_POS_MODE` thì test này đỏ."""
    day_du = EKF_ATTITUDE | EKF_VELOCITY_HORIZ | EKF_POS_HORIZ_ABS
    state = TelemetryState()

    update_state(state, FakeMessage("EKF_STATUS_REPORT", flags=day_du), now=1.0)
    assert state.ekf_ok is True

    update_state(
        state,
        FakeMessage("EKF_STATUS_REPORT", flags=day_du | EKF_CONST_POS_MODE),
        now=2.0,
    )
    assert state.ekf_ok is False


def test_ekf_status_report_co_trong_stream_rates():
    """Không xin nhịp thì FC không gửi EKF_STATUS_REPORT, và `ekf_ok` sẽ ở
    None mãi mãi mà không có gì báo."""
    assert 193 in STREAM_RATES


def test_statustext_khong_vao_state():
    """STATUSTEXT là SỰ KIỆN, không phải trạng thái.

    Nạp một message THẬT trước để chốt là `update_state` đang hoạt động — nếu
    không, test vẫn xanh cả khi `update_state` thoái hoá thành hàm rỗng cho
    MỌI loại message.
    """
    state = TelemetryState()
    update_state(state, FakeMessage("HEARTBEAT", base_mode=0, custom_mode=4), now=5.0)
    assert state.last_update == 5.0

    update_state(state, FakeMessage("STATUSTEXT", severity=4, text="PreArm: GPS"), now=9.0)

    assert state.last_update == 5.0, "STATUSTEXT đã lọt vào state"


def test_statustext_doi_severity_sang_level():
    assert statustext_event(FakeMessage("STATUSTEXT", severity=0, text="x")).level == "error"
    assert statustext_event(FakeMessage("STATUSTEXT", severity=3, text="x")).level == "error"
    assert statustext_event(FakeMessage("STATUSTEXT", severity=4, text="x")).level == "warn"
    assert statustext_event(FakeMessage("STATUSTEXT", severity=6, text="x")).level == "info"


def test_statustext_cat_byte_va_null():
    event = statustext_event(FakeMessage("STATUSTEXT", severity=4, text=b"PreArm: GPS\x00\x00"))

    assert event.message == "PreArm: GPS"
    assert event.source == "mavlink"
    assert event.code == "statustext"


# ---------------------------------------------------------------------------
# Phase 05 — giá trị dẫn xuất
# ---------------------------------------------------------------------------
def test_link_age_ms_duoc_tinh_chu_khong_luu():
    state = TelemetryState()
    state.connected = True
    state.last_update = 100.0

    telemetry = build_telemetry(state, now=100.25)

    assert telemetry.link_age_ms == 250
    assert telemetry.connected is True
    # Không được lưu giá trị dẫn xuất vào bản state.
    assert "link_age_ms" not in state.as_dict()


def test_connected_tren_day_nghia_la_link_con_song():
    """State `connected=True` chỉ nghĩa là ĐÃ TỪNG nhận heartbeat. Trên dây nó
    phải nghĩa là link CÒN SỐNG, nếu không UI báo xanh khi drone đã mất tích."""
    state = TelemetryState()
    state.connected = True
    state.last_update = 100.0

    assert build_telemetry(state, now=100.5).connected is True
    assert build_telemetry(state, now=200.0).connected is False


def test_telemetry_co_du_truong_cua_hop_dong():
    payload = build_telemetry(TelemetryState(), now=1.0).model_dump()

    for key in (
        "connected",
        "link_age_ms",
        "mode",
        "armed",
        "lat",
        "lon",
        "relative_alt",
        "absolute_alt",
        "heading",
        "ground_speed",
        "climb_rate",
        "roll",
        "pitch",
        "yaw",
        "gps_fix_type",
        "satellites",
        "battery_voltage",
        "battery_current",
        "battery_remaining",
        "home_lat",
        "home_lon",
        "obstacle_distance",
        "obstacle_sectors",
        "rangefinder_healthy",
        "avoid_state",
        "ekf_ok",
    ):
        assert key in payload, f"telemetry.data thiếu {key}"

    # Trường Phase 07 phải CÓ MẶT với giá trị rỗng, để Phase 08 dựng UI trước.
    assert len(payload["obstacle_sectors"]) == 8
    assert payload["avoid_state"] == "UNKNOWN"
    # `last_update` là chuyện nội bộ, không ra dây.
    assert "last_update" not in payload


# ---------------------------------------------------------------------------
# Phase 05 — lớp kết nối
# ---------------------------------------------------------------------------
def test_send_bat_buoc_co_link():
    conn = MavlinkConnection()

    try:
        conn.send(lambda: None)
    except ConnectionError:
        pass
    else:
        raise AssertionError("send() phải ném ConnectionError khi chưa có link")


def test_request_streams_gui_dung_so_lenh_va_dung_id():
    conn = MavlinkConnection()
    conn.master = fake = FakeMAVLink()
    conn.target_system, conn.target_component = 1, 1

    conn.request_streams({30: 10})  # chỉ ATTITUDE, cho test chạy nhanh

    assert fake.count("command_long_send") == 1
    args = fake.last("command_long_send")["args"]
    assert args[2] == MAV_CMD_SET_MESSAGE_INTERVAL
    assert args[4] == 30  # param1 = message_id
    assert args[5] == 100_000  # param2 = 10 Hz -> 100000 us


def test_request_streams_mac_dinh_dung_bang_STREAM_RATES():
    """Đường mặc định (`rates=None`) là đường production thật sự chạy; test chỉ
    truyền bảng riêng thì nó không bao giờ được thực thi."""
    conn = MavlinkConnection()
    conn.master = fake = FakeMAVLink()
    conn.target_system, conn.target_component = 1, 1

    conn.request_streams()

    assert fake.count("command_long_send") == len(STREAM_RATES)
    da_xin = {payload["args"][4] for name, payload in fake.sent if name == "command_long_send"}
    assert da_xin == set(STREAM_RATES)


def test_moi_loi_goi_mav_deu_di_qua_send():
    """LUẬT ở đầu connection.py: mọi `master.mav.*_send()` phải đi qua `send()`.

    `FakeMAVLink` ghi lại y hệt dù gọi thẳng hay qua khoá, nên nó KHÔNG canh
    được luật này — phải canh bằng cách đọc chính mã nguồn. Không có test này
    thì thứ duy nhất giữ luật là một comment.
    """
    import re
    from pathlib import Path

    goc = Path(__file__).resolve().parent.parent  # backend/
    vi_pham: list[str] = []
    for path in goc.rglob("*.py"):
        if path.name == "connection.py" or "tests" in path.parts:
            continue
        for so_dong, dong in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            sach = dong.split("#", 1)[0]
            if re.search(r"\.mav\.\w+_send\s*\(", sach):
                vi_pham.append(f"{path.relative_to(goc)}:{so_dong}: {dong.strip()}")

    assert not vi_pham, (
        "Gọi thẳng mav.*_send() không qua MavlinkConnection.send() — hai thread "
        "ghi xen kẽ sẽ làm FC bỏ gói TRONG IM LẶNG:\n" + "\n".join(vi_pham)
    )


def test_stream_rates_co_du_message_hud_can():
    """Thiếu một dòng ở đây là HUD giật mà không ai hiểu vì sao."""
    for msg_id in (0, 1, 24, 30, 33, 74):
        assert msg_id in STREAM_RATES
    assert STREAM_RATES[30] == 10  # ATTITUDE phải 10 Hz cho chân trời giả mượt


def test_request_message_dung_id_512():
    conn = MavlinkConnection()
    conn.master = fake = FakeMAVLink()
    conn.target_system, conn.target_component = 1, 1

    conn.request_message(242)

    assert fake.count("command_long_send") == 1, "xin HOME_POSITION nhiều hơn một lần"
    args = fake.last("command_long_send")["args"]
    assert args[2] == MAV_CMD_REQUEST_MESSAGE
    assert args[4] == 242


def test_send_noi_tiep_hoa_hai_thread():
    """Rủi ro điểm 16 của Phase 05: hai thread cùng ghi làm byte hai gói đan
    vào nhau và FC bỏ gói TRONG IM LẶNG. Test này chứng minh khoá ghi thật sự
    nối tiếp hoá — nếu bỏ `with self._send_lock` thì nó đỏ."""
    conn = MavlinkConnection()
    conn.master = FakeMAVLink()

    dang_ghi = []
    chong_lan = []

    def cham_chap(_i):
        dang_ghi.append(1)
        if len(dang_ghi) > 1:
            chong_lan.append(1)
        # Giữ "socket" đủ lâu để thread kia chắc chắn tới nơi nếu không có khoá.
        threading.Event().wait(0.002)
        dang_ghi.pop()

    threads = [
        threading.Thread(target=lambda i=i: [conn.send(cham_chap, i) for _ in range(20)])
        for i in range(2)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert chong_lan == [], "hai thread đã ghi chồng lên nhau — khoá ghi không hoạt động"
