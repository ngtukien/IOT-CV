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
