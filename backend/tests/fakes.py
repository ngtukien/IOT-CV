"""Đồ giả dùng chung cho test — Phase 05, việc 5.5.1.

`FakeMAVLink` là NỀN cho toàn bộ test của Phase 06 (điều khiển) và Phase 07
(mission): cả hai phase đó đều cần kiểm "backend đã gửi ĐÚNG gói MAVLink nào"
mà không được đụng tới drone thật. Làm cho tử tế ngay từ đây.
"""

from __future__ import annotations

from typing import Any


class FakeMessage:
    """Bắt chước message của pymavlink: có get_type() và các attribute.

    Chuyển từ `test_telemetry.py` sang đây ở Phase 05 — một bản duy nhất, file
    cũ import lại từ đây.
    """

    def __init__(self, msg_type: str, **fields) -> None:
        self._type = msg_type
        for key, value in fields.items():
            setattr(self, key, value)

    def get_type(self) -> str:
        return self._type

    def __repr__(self) -> str:  # để assert hỏng đọc được
        fields = {k: v for k, v in self.__dict__.items() if k != "_type"}
        return f"FakeMessage({self._type!r}, {fields})"


class _FakeMav:
    """Chỗ đứng của `master.mav` — ghi lại MỌI lời gọi `*_send()`.

    Không kiểm chữ ký từng lệnh: mục đích là xem backend gọi gì, theo thứ tự
    nào, với tham số nào — chứ không phải viết lại pymavlink.
    """

    def __init__(self, sink: list[tuple[str, dict[str, Any]]]) -> None:
        self._sink = sink

    def __getattr__(self, name: str):
        if not name.endswith("_send"):
            raise AttributeError(name)

        def _record(*args, **kwargs):
            self._sink.append((name, {"args": args, **kwargs}))

        return _record


class FakeMAVLink:
    """Thay `MavlinkConnection.master` trong test.

    Dùng:

        conn = MavlinkConnection()
        conn.master = fake = FakeMAVLink()
        conn.target_system, conn.target_component = 1, 1
        conn.request_streams()
        assert fake.count("command_long_send") == len(STREAM_RATES)
    """

    def __init__(self, queue: list | None = None) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []
        self.mav = _FakeMav(self.sent)
        self.target_system = 1
        self.target_component = 1
        self.closed = False
        self._queue = list(queue or [])

    # -- phía đọc -----------------------------------------------------------
    def push(self, msg: FakeMessage) -> None:
        """Nạp sẵn một message cho `recv_match` trả về."""
        self._queue.append(msg)

    def wait_heartbeat(self, timeout: float | None = None):
        return FakeMessage("HEARTBEAT", base_mode=0, custom_mode=4)

    def recv_match(self, *args, **kwargs):
        """Lấy message kế tiếp trong hàng đợi; hết thì trả None (= im lặng)."""
        if not self._queue:
            return None
        return self._queue.pop(0)

    def close(self) -> None:
        self.closed = True

    # -- phía ghi, tiện ích cho assert --------------------------------------
    def last(self, name: str) -> dict[str, Any] | None:
        """kwargs (và `args`) của gói `name` gần nhất, None nếu chưa gửi lần nào."""
        for sent_name, payload in reversed(self.sent):
            if sent_name == name:
                return payload
        return None

    def count(self, name: str) -> int:
        return sum(1 for sent_name, _ in self.sent if sent_name == name)

    def names(self) -> list[str]:
        return [name for name, _ in self.sent]


# ---------------------------------------------------------------------------
# Bộ đồ giả dựng sẵn — Phase 06, dùng lại cho Phase 07 (mission cũng chờ ack).
# ---------------------------------------------------------------------------
def tu_dong_ack(conn, fake: FakeMAVLink, result: int = 0):
    """Bắt chước thread telemetry: mỗi COMMAND_LONG gửi đi được ack ngay.

    Không có cái này thì mọi test của `arm` / `takeoff` / `set_mode` phải chờ
    hết `COMMAND_ACK_TIMEOUT_S` rồi mới đỏ — 3 giây mỗi bài, và đỏ vì hết giờ
    chứ không phải vì hành vi sai.

    Ack được bơm NGAY TRONG lời gọi `send`, tức là sau khi `expect_ack()` đã
    đăng ký hàng đợi — cùng thứ tự với đời thật, nên nó cũng chính là bài kiểm
    cho thứ tự đăng ký-trước-khi-gửi.

    `result` khác 0 để dựng cảnh FC TỪ CHỐI (2 = MAV_RESULT_DENIED).
    """
    goc = conn.send

    def send(fn, *args, **kwargs):
        ket_qua = goc(fn, *args, **kwargs)
        if fake.sent:
            ten, payload = fake.sent[-1]
            if ten == "command_long_send":
                # args = (target_system, target_component, command_id, confirmation, p1..p7)
                vi_tri = payload.get("args", ())
                if len(vi_tri) >= 3:
                    conn.route_ack(FakeMessage("COMMAND_ACK", command=vi_tri[2], result=result))
        return ket_qua

    conn.send = send
    return conn


def stack_gia(*, mode: str = "GUIDED", armed: bool = True, gps_fix_type: int = 3):
    """Dựng (connection, fake, state, safety, control) đã nối sẵn với nhau.

    `state` mặc định là một drone ĐANG BAY hợp lệ: link sống, GUIDED, armed,
    3D fix. Test nào muốn dựng cảnh hỏng thì sửa trường tương ứng.
    """
    import time

    from backend.mavlink.connection import MavlinkConnection
    from backend.mavlink.control import FlightControl
    from backend.mavlink.safety import SafetyState
    from backend.schemas import TelemetryState

    fake = FakeMAVLink()
    conn = MavlinkConnection()
    conn.master = fake
    conn.target_system = 1
    conn.target_component = 1

    state = TelemetryState(
        connected=True,
        last_update=time.monotonic(),
        mode=mode,
        armed=armed,
        gps_fix_type=gps_fix_type,
        ekf_ok=True,
    )
    safety = SafetyState(current_mode=mode)
    control = FlightControl(conn, state=state)
    return conn, fake, state, safety, control


# ---------------------------------------------------------------------------
# Phase 07 — flight controller giả biết Mission Protocol.
# ---------------------------------------------------------------------------
class FakeMissionFC:
    """Bắt chước phía FC của Mission Protocol, đủ để test `MissionManager`.

    Móc vào `conn.send` như `tu_dong_ack`: mỗi gói MISSION_* ta gửi đi sinh ngay
    gói trả lời, bơm thẳng vào `manager.on_message` — đúng đường thread telemetry
    sẽ đi ngoài đời thật.

    Kịch bản điều chỉnh được:
      `order`        thứ tự seq FC HỎI (mặc định 0..n-1). Lặp một seq = FC hỏi lại.
      `request_type` "MISSION_REQUEST_INT" hoặc bản cũ "MISSION_REQUEST".
      `ack`          mã MISSION_ACK cuối upload (0 = accepted).
      `silent`       FC im lặng hoàn toàn (thử timeout).
      `mangle`       hàm (item dict) -> item dict, áp khi FC trả item lúc đọc lại
                     — dựng cảnh "FC giữ khác cái ta gửi".
      `mission_start_result` COMMAND_ACK.result cho MAV_CMD_MISSION_START.
    """

    def __init__(
        self,
        conn,
        fake: FakeMAVLink,
        manager,
        *,
        order: list[int] | None = None,
        request_type: str = "MISSION_REQUEST_INT",
        ack: int = 0,
        silent: bool = False,
        mangle=None,
        mission_start_result: int = 0,
    ) -> None:
        self.conn = conn
        self.fake = fake
        self.manager = manager
        self.order = order
        self.request_type = request_type
        self.ack = ack
        self.silent = silent
        self.mangle = mangle
        self.mission_start_result = mission_start_result
        self.stored: dict[int, dict] = {}
        self._pending: list[int] = []
        self._count = 0
        goc = conn.send

        def send(fn, *args, **kwargs):
            ket_qua = goc(fn, *args, **kwargs)
            ten, payload = fake.sent[-1]
            self._react(ten, payload.get("args", ()))
            return ket_qua

        conn.send = send

    def _push(self, msg_type: str, **fields) -> None:
        fields.setdefault("target_system", 254)
        fields.setdefault("mission_type", 0)
        self.manager.on_message(FakeMessage(msg_type, **fields))

    def _next_request(self) -> None:
        if self._pending:
            self._push(self.request_type, seq=self._pending.pop(0))
        else:
            self._push("MISSION_ACK", type=self.ack)

    def _react(self, ten: str, a: tuple) -> None:
        if self.silent:
            return
        if ten == "mission_count_send":
            self._count = a[2]
            self._pending = list(self.order) if self.order is not None else list(range(a[2]))
            self._next_request()
        elif ten == "mission_item_int_send":
            self.stored[a[2]] = {
                "seq": a[2],
                "frame": a[3],
                "command": a[4],
                "param1": a[7],
                "x": a[11],
                "y": a[12],
                "z": a[13],
            }
            self._next_request()
        elif ten == "mission_request_list_send":
            self._push("MISSION_COUNT", count=len(self.stored))
        elif ten == "mission_request_int_send":
            item = dict(self.stored[a[2]])
            if self.mangle is not None:
                item = self.mangle(item)
            self._push("MISSION_ITEM_INT", **item)
        elif ten == "mission_clear_all_send":
            self.stored.clear()
            self._push("MISSION_ACK", type=0)
        elif ten == "command_long_send" and a[2] == 300:
            self.conn.route_ack(
                FakeMessage("COMMAND_ACK", command=300, result=self.mission_start_result)
            )

    # -- tiện ích cho assert --------------------------------------------------
    def seq_da_tra_loi(self) -> list[int]:
        """Các seq ta đã gửi MISSION_ITEM_INT, theo thứ tự gửi."""
        return [p["args"][2] for n, p in self.fake.sent if n == "mission_item_int_send"]
