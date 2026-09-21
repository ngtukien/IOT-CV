"""Test Hợp đồng WebSocket — Phase 05, việc 5.5.2.

Những test này canh HỢP ĐỒNG, không canh cách hiện thực. Khi test ở đây đỏ,
mặc định là code sai chứ không phải test sai: sửa hợp đồng cho vừa test là làm
ngược chiều (xem `plans/phase-05-backend-mavlink-telemetry.md` §5.5.3).

Không cần SITL: `conftest.py` đặt TELEMETRY_AUTOSTART=0.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app import HUB, SAFETY, app
from backend.schemas import (
    CONTRACT_VERSION,
    DOWNLINK_MODELS,
    UPLINK_MODELS,
    Envelope,
    contract_json_schema,
)

# Payload mẫu HỢP LỆ cho từng type chiều lên. Thêm type mới vào hợp đồng mà
# quên thêm ở đây thì `test_moi_type_trong_hop_dong_parse_duoc` sẽ đỏ — cố ý.
MAU_CHIEU_LEN: dict[str, dict] = {
    "ping": {},
    "cmd.web_control_enable": {"enabled": True},
    "cmd.mode": {"mode": "GUIDED"},
    "cmd.arm": {"arm": True},
    "cmd.takeoff": {"altitude": 5.0},
    "cmd.velocity": {"vx": 1.0, "vy": 0.0, "vz": 0.0, "yaw_rate": 0.0},
    "cmd.hold": {},
    "cmd.rtl": {},
    "cmd.land": {},
    "cmd.mission.upload": {
        "waypoints": [{"seq": 1, "lat": 10.76, "lon": 106.66, "alt": 5.0}],
        "auto_start": False,
    },
}


@pytest.fixture(autouse=True)
def _hub_sach():
    """HUB và SAFETY là singleton của tiến trình — dọn giữa các test."""
    HUB.web_control_owner = None
    SAFETY.disable_web_control()
    yield
    HUB.web_control_owner = None
    SAFETY.disable_web_control()


def nhan_den_khi(ws, type_: str, gioi_han: int = 60) -> dict:
    """Đọc tới khi gặp message đúng `type_`.

    Cần vì socket luôn có dòng `telemetry` 8 Hz chảy xen vào giữa mọi thứ.
    """
    for _ in range(gioi_han):
        message = ws.receive_json()
        if message["type"] == type_:
            return message
    raise AssertionError(f"Không thấy message type={type_} sau {gioi_han} lần đọc")


def gui(ws, type_: str, data: dict | None = None, *, v: int = CONTRACT_VERSION, id_: str = "c-1"):
    ws.send_json({"v": v, "type": type_, "id": id_, "data": data or {}})


# ---------------------------------------------------------------------------
# Hình dạng hợp đồng (không cần socket)
# ---------------------------------------------------------------------------
def test_moi_type_trong_hop_dong_parse_duoc():
    thieu = set(UPLINK_MODELS) - set(MAU_CHIEU_LEN)
    assert not thieu, f"Hợp đồng có type chưa có payload mẫu: {sorted(thieu)}"

    for type_, data in MAU_CHIEU_LEN.items():
        envelope = Envelope.model_validate(
            {"v": CONTRACT_VERSION, "type": type_, "id": "c-1", "data": data}
        )
        assert envelope.type == type_
        # Bước hai: `data` phải khớp model của đúng type đó.
        UPLINK_MODELS[type_].model_validate(envelope.data)


def test_json_schema_co_du_type():
    schema = contract_json_schema()

    assert schema["contract_version"] == CONTRACT_VERSION
    for type_ in UPLINK_MODELS:
        assert type_ in schema["uplink"], f"thiếu {type_} chiều lên"
    for type_ in DOWNLINK_MODELS:
        assert type_ in schema["downlink"], f"thiếu {type_} chiều xuống"
    # Mọi $ref phải trỏ vào một định nghĩa có thật, nếu không Phase 08 sinh
    # TypeScript sẽ ra type rỗng mà không báo lỗi.
    defs = schema["$defs"]
    for nhom in ("uplink", "downlink"):
        for type_, ref in schema[nhom].items():
            ten = ref["$ref"].removeprefix("#/$defs/")
            assert ten in defs, f"{nhom}.{type_} trỏ vào $defs/{ten} không tồn tại"


def test_data_khong_bao_gio_null():
    """Hợp đồng: `data` rỗng thì là `{}`, không phải `null`."""
    envelope = Envelope.model_validate({"v": 1, "type": "ping"})

    assert envelope.data == {}


# ---------------------------------------------------------------------------
# Hành vi trên socket thật
# ---------------------------------------------------------------------------
def test_mo_socket_nhan_status_ngay():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        message = nhan_den_khi(ws, "status")

        assert message["v"] == CONTRACT_VERSION
        data = message["data"]
        assert data["connected"] is False  # không có SITL trong test
        # UI đọc MỌI ngưỡng từ `limits` — thiếu một khoá là Phase 08 hardcode.
        for khoa in (
            "max_alt",
            "min_alt",
            "max_distance_home",
            "max_waypoints",
            "max_velocity",
            "manual_command_timeout_ms",
            "deadman_tick_ms",
            "avoid_margin_m",
            "avoid_dist_max_m",
            "rangefinder_max_m",
        ):
            assert khoa in data["limits"], f"limits thiếu {khoa}"
        assert data["safety"]["web_control_owner"] is None


def test_ping_nhan_pong():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        gui(ws, "ping")

        message = nhan_den_khi(ws, "pong")
        assert "server_ts" in message["data"]


def test_type_la_tra_error_va_khong_dong_socket():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        gui(ws, "khong-ton-tai", id_="c-1")

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "unknown_type"
        assert loi["data"]["ref"] == "c-1"

        # Điểm mấu chốt: socket VẪN MỞ. Đóng socket vì một message hỏng là làm
        # mất luôn telemetry.
        gui(ws, "ping", id_="c-2")
        assert nhan_den_khi(ws, "pong") is not None


def test_payload_sai_kieu_tra_bad_payload():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        gui(ws, "cmd.takeoff", {"altitude": "cao"}, id_="c-7")

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "bad_payload"
        assert loi["data"]["ref"] == "c-7"
        assert loi["data"]["command"] == "cmd.takeoff"


def test_json_hong_tra_bad_payload_va_khong_dong_socket():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        ws.send_text("{khong phai json")

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "bad_payload"

        gui(ws, "ping", id_="c-2")
        assert nhan_den_khi(ws, "pong") is not None


def test_version_khac_1_bi_tu_choi():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        gui(ws, "ping", v=2, id_="c-9")

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "unsupported_version"
        assert loi["data"]["ref"] == "c-9"


def test_lenh_cua_phase_sau_tra_not_implemented():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        gui(ws, "cmd.arm", {"arm": True}, id_="c-3")

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "not_implemented"
        # Message phải nói RÕ phase nào sẽ làm, không chỉ "chưa hỗ trợ".
        assert "06" in loi["data"]["message"]


def test_mot_nguoi_lai():
    with (
        TestClient(app) as client,
        client.websocket_connect("/ws") as a,
        client.websocket_connect("/ws") as b,
    ):
        gui(a, "cmd.web_control_enable", {"enabled": True}, id_="a-1")
        ack = nhan_den_khi(a, "ack")
        assert ack["data"]["status"] == "done"
        assert HUB.web_control_owner is not None

        gui(b, "cmd.web_control_enable", {"enabled": True}, id_="b-1")
        loi = nhan_den_khi(b, "error")
        assert loi["data"]["code"] == "command_denied"
        assert loi["data"]["message"] == "Mot tab khac dang giu quyen lai"
        assert loi["data"]["ref"] == "b-1"


def test_dong_socket_thi_tra_lai_quyen_lai():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as a:
            gui(a, "cmd.web_control_enable", {"enabled": True}, id_="a-1")
            nhan_den_khi(a, "ack")
            assert HUB.web_control_owner is not None

        # Ra khỏi `with` = socket đóng. Đây chính là cơ chế an toàn dead-man.
        assert HUB.web_control_owner is None
        assert SAFETY.web_control_enabled is False


def test_gui_qua_nhanh_bi_rate_limited():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        # `cmd.arm` giới hạn 2/giây; 12 cái liên tiếp chắc chắn vượt.
        for i in range(12):
            gui(ws, "cmd.arm", {"arm": True}, id_=f"c-{i}")

        ma_loi = set()
        for _ in range(80):
            message = ws.receive_json()
            if message["type"] == "error":
                ma_loi.add(message["data"]["code"])
            if "rate_limited" in ma_loi:
                break

        assert "rate_limited" in ma_loi
