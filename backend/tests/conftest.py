"""Cấu hình chung cho test — Phase 05.

Một việc duy nhất và nó quan trọng: CHẶN test tự mở link MAVLink. Test phải
chạy được trên máy không có SITL, không có drone, không có mạng.
"""

from __future__ import annotations

import os

# Đặt TRƯỚC khi bất kỳ test nào import `backend.app`: lifespan đọc biến này để
# quyết định có gọi READER.start() hay không.
#
# Gán THẲNG chứ không `setdefault`: trên máy hay runner CI nào đã export sẵn
# TELEMETRY_AUTOSTART=1 thì setdefault là lệnh rỗng, và cả bộ test lặng lẽ mở
# link MAVLink thật — đúng việc duy nhất file này sinh ra để chặn.
os.environ["TELEMETRY_AUTOSTART"] = "0"

import pytest  # noqa: E402

from backend.events import BUS  # noqa: E402


@pytest.fixture(autouse=True)
def _bus_sach():
    """Vòng đệm sự kiện là biến toàn cục của tiến trình — dọn giữa các test,
    nếu không một test sẽ thấy sự kiện do test trước sinh ra."""
    BUS.clear()
    yield
    BUS.clear()
