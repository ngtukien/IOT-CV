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
