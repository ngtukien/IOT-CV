"""Bus sự kiện nội bộ — Phase 05, việc 5.2.4.

Rất nhỏ, cố ý: một vòng đệm N sự kiện gần nhất, cộng một danh sách subscriber.
Không có thư viện message queue nào ở đây, và không cần.

Vòng đệm tồn tại để tab mới mở KHÔNG thấy bảng log trống — người dùng mở web
sau khi drone đã bay 5 phút vẫn thấy chuyện gì đã xảy ra. Phase 07 phơi nó ra
qua `GET /api/events`.

Ràng buộc luồng: `emit()` bị gọi từ THREAD TELEMETRY (không phải event loop
asyncio). Subscriber vì thế phải tự lo việc nhảy về đúng loop của mình —
`backend/ws.py` làm việc đó bằng `loop.call_soon_threadsafe`. Đừng để một
subscriber chặn: nó chạy ngay trong thread đọc MAVLink.
"""

from __future__ import annotations

import collections
import logging
import threading
import time
from collections.abc import Callable

from backend.schemas import EventPayload

log = logging.getLogger(__name__)

Subscriber = Callable[[EventPayload], None]

DEFAULT_CAPACITY = 200


class EventBus:
    """Vòng đệm sự kiện + fan-out tới subscriber."""

    def __init__(self, capacity: int = DEFAULT_CAPACITY) -> None:
        self._buf: collections.deque[EventPayload] = collections.deque(maxlen=capacity)
        self._subscribers: list[Subscriber] = []
        self._lock = threading.Lock()

    def emit(
        self,
        level: str,
        source: str,
        code: str,
        message: str,
        detail: dict | None = None,
    ) -> EventPayload:
        """Ghi một sự kiện và đẩy tới mọi subscriber."""
        payload = EventPayload(
            level=level,  # type: ignore[arg-type]
            source=source,  # type: ignore[arg-type]
            code=code,
            message=message,
            detail=detail,
            ts=time.time(),
        )
        with self._lock:
            self._buf.append(payload)
            subscribers = list(self._subscribers)

        for fn in subscribers:
            try:
                fn(payload)
            except Exception:  # noqa: BLE001
                # Một subscriber hỏng KHÔNG được làm chết thread telemetry, và
                # cũng không được nuốt lỗi im lặng — log rồi đi tiếp.
                log.exception("Subscriber sự kiện ném lỗi (code=%s)", code)
        return payload

    def recent(self, limit: int = 100) -> list[EventPayload]:
        """N sự kiện gần nhất, cũ trước mới sau."""
        with self._lock:
            items = list(self._buf)
        return items[-limit:] if limit > 0 else []

    def subscribe(self, fn: Subscriber) -> None:
        with self._lock:
            self._subscribers.append(fn)

    def unsubscribe(self, fn: Subscriber) -> None:
        with self._lock:
            if fn in self._subscribers:
                self._subscribers.remove(fn)

    def clear(self) -> None:
        """Chỉ dùng trong test."""
        with self._lock:
            self._buf.clear()


# Bus dùng chung của tiến trình. `telemetry.py` ghi vào, `ws.py` đọc ra.
BUS = EventBus()
