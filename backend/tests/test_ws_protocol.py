"""Test Hợp đồng WebSocket — Phase 05, việc 5.5.2.

Những test này canh HỢP ĐỒNG, không canh cách hiện thực. Khi test ở đây đỏ,
mặc định là code sai chứ không phải test sai: sửa hợp đồng cho vừa test là làm
ngược chiều (xem `plans/phase-05-backend-mavlink-telemetry.md` §5.5.3).

Không cần SITL: `conftest.py` đặt TELEMETRY_AUTOSTART=0.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app import HUB, SAFETY, app
from backend.schemas import (
    CONTRACT_VERSION,
    DOWNLINK_MODELS,
    UPLINK_IMPLEMENTED_IN,
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


def test_json_schema_moi_ref_tro_vao_dinh_nghia_co_that():
    """Mọi `$ref` phải trỏ vào một định nghĩa có thật, nếu không Phase 08 sinh
    TypeScript ra type rỗng mà không báo lỗi gì.

    Cố ý KHÔNG khẳng định `"ping" in schema["uplink"]`: hai dict đó là
    comprehension trên chính `UPLINK_MODELS`/`DOWNLINK_MODELS` mà test sẽ lặp
    qua, nên khẳng định kiểu đó xanh với mọi nội dung. Việc "file trên đĩa có
    đủ type không" do test dưới đảm nhiệm.
    """
    schema = contract_json_schema()
    defs = schema["$defs"]

    for nhom in ("uplink", "downlink"):
        for type_, ref in schema[nhom].items():
            ten = ref["$ref"].removeprefix("#/$defs/")
            assert ten in defs, f"{nhom}.{type_} trỏ vào $defs/{ten} không tồn tại"


def test_file_schema_da_commit_khong_bi_cu():
    """`backend/ws-contract.schema.json` là thứ Phase 08 THẬT SỰ đọc, và nó là
    file đã commit — tức là nó lệch được so với `schemas.py` mà không ai hay.

    Đây là khẳng định duy nhất trong bộ test có thể bắt được việc quên chạy lại
    `uv run python -m backend.schemas`.
    """
    duong_dan = Path(__file__).resolve().parents[1] / "ws-contract.schema.json"
    assert duong_dan.is_file(), "chưa sinh backend/ws-contract.schema.json"

    tren_dia = json.loads(duong_dan.read_text(encoding="utf-8"))

    assert tren_dia["contract_version"] == CONTRACT_VERSION
    assert set(tren_dia["uplink"]) == set(UPLINK_MODELS), "file schema lệch ở chiều LÊN"
    assert set(tren_dia["downlink"]) == set(DOWNLINK_MODELS), "file schema lệch ở chiều XUỐNG"
    assert tren_dia == contract_json_schema(), (
        "backend/ws-contract.schema.json đã cũ so với schemas.py — "
        "chạy: uv run python -m backend.schemas > backend/ws-contract.schema.json"
    )


def test_data_khong_bao_gio_null():
    """Hợp đồng: `data` rỗng thì là `{}`, không phải `null`.

    Kiểm CẢ HAI dạng. Trình duyệt gửi `JSON.stringify({data: null})` ra
    `"data": null` thật, nên chỉ kiểm dạng thiếu khoá là bỏ sót đúng dạng hay
    gặp nhất.
    """
    assert Envelope.model_validate({"v": 1, "type": "ping"}).data == {}
    assert Envelope.model_validate({"v": 1, "type": "ping", "data": None}).data == {}


def test_thieu_v_thi_bi_tu_choi():
    """`v` KHÔNG được có giá trị mặc định: đây là trường duy nhất có nhiệm vụ
    chặn lại, có mặc định thì bỏ hẳn nó đi vẫn lọt như thể là v1."""
    with pytest.raises(ValidationError):
        Envelope.model_validate({"type": "ping", "data": {}})


# ---------------------------------------------------------------------------
# Hành vi trên socket thật
# ---------------------------------------------------------------------------
def test_mo_socket_nhan_status_ngay():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        # Khẳng định frame ĐẦU TIÊN, không phải "có status ở đâu đó trong 60
        # frame đầu". Bất biến ở ws.py là status đi TRƯỚC telemetry — tab mới
        # mở phải biết giới hạn an toàn trước khi vẽ. Dùng nhan_den_khi() ở đây
        # thì một hồi quy làm status đến sau telemetry vẫn xanh.
        message = ws.receive_json()
        assert message["type"] == "status", f"frame đầu là {message['type']}, không phải status"

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
    """Lệnh có trong hợp đồng nhưng chưa ai hiện thực -> nói RÕ phase nào làm.

    Dùng `cmd.mission.upload` (Phase 07). Bài này vốn dùng `cmd.arm`, nhưng
    Phase 06 đã hiện thực arm nên nó chuyển sang trả `not_connected` — đúng
    hành vi mới, sai bài test cũ. Đổi sang một lệnh THẬT SỰ còn chờ thay vì hạ
    yêu cầu: nhánh `not_implemented` vẫn phải có người canh.
    """
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        gui(ws, "cmd.mission.upload", {"waypoints": []}, id_="c-3")

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "not_implemented"
        # Message phải nói RÕ phase nào sẽ làm, không chỉ "chưa hỗ trợ".
        assert "07" in loi["data"]["message"]


def test_lenh_phase_06_khong_con_not_implemented():
    """Cổng canh chiều ngược lại: 7 lệnh của Phase 06 phải RỜI KHỎI nhánh đó.

    Không có bài này thì việc quên đăng ký một handler sẽ lặng lẽ trôi qua —
    người dùng nhận `not_implemented` cho một lệnh mà plan bảo là đã xong.
    """
    from backend.ws import COMMAND_HANDLERS

    cua_phase_06 = [
        ten for ten, phase in UPLINK_IMPLEMENTED_IN.items() if phase == 6
    ]
    assert len(cua_phase_06) == 7
    thieu = [ten for ten in cua_phase_06 if ten not in COMMAND_HANDLERS]
    assert thieu == [], f"Phase 06 chua dang ky handler cho: {thieu}"


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


def test_frame_nhi_phan_khong_dong_socket():
    """`ws.send(new Uint8Array(...))` từ trình duyệt. Bản đầu dùng
    `receive_text()`, ném KeyError('text') và giết luôn socket — trái hẳn
    quyết định 'message hỏng KHÔNG đóng socket'."""
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        ws.send_bytes(b"\x00\x01\x02")

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "bad_payload"

        gui(ws, "ping", id_="c-2")
        assert nhan_den_khi(ws, "pong") is not None


def test_socket_gui_hong_thi_lenh_KHONG_duoc_thuc_thi():
    """Socket "xác sống": một lần `send_json` hỏng làm client bị gỡ khỏi
    `_clients`, nhưng `receive_loop` chạy trên đối tượng `ws` thô nên vẫn đọc
    và vẫn THỰC THI lệnh.

    Hậu quả đo được ở bản đầu: client giành được quyền lái, mọi tab khác nhận
    `command_denied`, còn chính nó không nhận lại một frame nào — không ack,
    không error, không telemetry. Đó đúng là "im lặng nuốt một lệnh" mà hợp
    đồng cấm bằng chữ.
    """
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        nhan_den_khi(ws, "telemetry")
        socket_id = next(reversed(HUB._clients))

        # Đầu độc đường gửi của ĐÚNG socket đó, phía server.
        HUB._clients[socket_id].ws.send_json = _luon_hong  # type: ignore[method-assign]

        gui(ws, "cmd.web_control_enable", {"enabled": True}, id_="c-1")
        time.sleep(0.5)

        assert HUB.web_control_owner is None, (
            f"socket {socket_id} giành được quyền lái dù không nhận nổi một frame "
            "nào — lệnh đã bị nuốt trong im lặng"
        )


async def _luon_hong(*args, **kwargs):
    raise RuntimeError("socket chet - co y")


def test_thieu_v_tren_socket_bi_tu_choi():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "ping", "id": "c-1", "data": {}})

        loi = nhan_den_khi(ws, "error")
        assert loi["data"]["code"] == "bad_payload"


def test_vong_telemetry_song_sot_qua_mot_lan_broadcast_loi():
    """Vòng telemetry là chỗ DUY NHẤT thu hồi quyền lái khi mode rời GUIDED
    hoặc mất link. Nó chết lặng lẽ = mất cơ chế an toàn mà socket vẫn mở và
    `/api/health` vẫn 200. Một lỗi trong thân vòng phải được ghi lại rồi đi
    tiếp, không được giết task.

    Khẳng định trên TRẠNG THÁI TASK chứ không chờ frame kế tiếp. Bản đầu chờ
    frame, nên khi gỡ bản vá ra thì task chết, không còn frame nào, và test
    TREO 300 giây rồi bị CI giết thay vì đỏ. Treo gần bằng vô dụng: người đọc
    log thấy timeout chứ không thấy "cơ chế an toàn đã chết".
    """
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        nhan_den_khi(ws, "telemetry")

        task = next(t for t in HUB._tasks if t.get_name() == "ws-telemetry")
        assert not task.done()

        goc = HUB.broadcast
        lan_goi = {"n": 0}

        async def broadcast_no_mot_lan(*args, **kwargs):
            lan_goi["n"] += 1
            if lan_goi["n"] == 1:
                raise RuntimeError("thuoc doc - co y")
            return await goc(*args, **kwargs)

        HUB.broadcast = broadcast_no_mot_lan  # type: ignore[method-assign]
        try:
            # Vòng chạy 8 Hz -> 0,6 s là khoảng 5 nhịp, thừa để nổ.
            time.sleep(0.6)
            assert lan_goi["n"] >= 1, "vòng telemetry không quay — test không kiểm được gì"
            assert not task.done(), (
                "vòng telemetry đã chết vì một lỗi broadcast — mất luôn cơ chế "
                "thu hồi quyền lái, mà socket vẫn mở nên không ai thấy"
            )
        finally:
            HUB.broadcast = goc  # type: ignore[method-assign]

        # Và nó phải còn bơm thật, không chỉ còn sống trên giấy.
        assert nhan_den_khi(ws, "telemetry") is not None


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
