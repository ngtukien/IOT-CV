"""Lịch sử telemetry phía backend — vòng đệm cho `GET /api/telemetry/history`.

Vì sao có: biểu đồ trên web chỉ vẽ được thứ trình duyệt đã nhận. Mở trang giữa
buổi bay (hoặc tải lại trang) là mất sạch mấy phút trước đó. Backend thì đang
dựng gói telemetry 8 lần/giây từ trước khi có ai mở trang — giữ lại chính các
gói ĐÃ GỬI ĐI đó là đủ, không đọc thêm gì từ MAVLink.

Ba quyết định:

- Lưu bản `Telemetry` ĐÃ DỰNG (đúng thứ đi trên dây), không lưu `TelemetryState`:
  web nhận lịch sử y hệt thứ nó từng nhận trực tiếp, không có hình dạng thứ hai.
- Chỉ ghi khi link CÒN SỐNG (`connected`). Lúc mất link, gói gửi đi toàn `None`
  và số cũ bị che; ghi chúng vào lịch sử chỉ là độn khoảng trống bằng rác.
- `deque(maxlen)` — đầy thì tự bỏ mẫu cũ nhất, không cấp phát lại. Ghi và đọc
  đều trên event loop (vòng telemetry và handler REST), nên không cần khoá.
"""

from __future__ import annotations

import collections
import time

from backend.schemas import Telemetry, TelemetrySample


class TelemetryHistory:
    def __init__(self, seconds: float, hz: float) -> None:
        self.seconds = float(seconds)
        self.hz = float(hz)
        capacity = max(1, int(round(self.seconds * max(self.hz, 1.0))))
        self._buf: collections.deque[tuple[float, Telemetry]] = collections.deque(maxlen=capacity)

    @property
    def capacity(self) -> int:
        return self._buf.maxlen or 0

    def __len__(self) -> int:
        return len(self._buf)

    def record(self, telemetry: Telemetry, ts: float | None = None) -> bool:
        """Ghi một gói. Trả `False` (không ghi) khi link không sống."""
        if not telemetry.connected:
            return False
        self._buf.append((time.time() if ts is None else ts, telemetry))
        return True

    def samples(
        self,
        seconds: float | None = None,
        max_points: int | None = None,
        now: float | None = None,
    ) -> list[TelemetrySample]:
        """Mẫu trong `seconds` giây gần nhất, cũ trước mới sau.

        `max_points` lấy thưa ĐỀU (bước nguyên), luôn giữ mẫu mới nhất — biểu đồ
        không được thiếu đúng điểm cuối cùng.
        """
        now = time.time() if now is None else now
        rows = list(self._buf)
        if seconds is not None:
            since = now - seconds
            rows = [r for r in rows if r[0] >= since]
        if max_points is not None and max_points > 0 and len(rows) > max_points:
            step = -(-len(rows) // max_points)  # làm tròn lên
            picked = rows[::-1][::step][::-1]  # thưa đều tính từ mẫu MỚI NHẤT
            rows = picked
        return [TelemetrySample(ts=ts, data=t) for ts, t in rows]

    def clear(self) -> None:
        self._buf.clear()
