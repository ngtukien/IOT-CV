"""Kết nối MAVLink — GIAI ĐOẠN 5.

Module này chỉ làm một việc: mở link tới flight controller (SITL hoặc drone thật
qua ESP32 bridge) và chờ HEARTBEAT. Không parse telemetry ở đây (xem
`telemetry.py`), không gửi lệnh ở đây (xem `control.py`).

Chạy trực tiếp để kiểm tra CỔNG PASS 5A:

    python -m backend.mavlink.connection
"""

from __future__ import annotations

import logging

from backend import config

log = logging.getLogger(__name__)


class MavlinkConnection:
    """Bọc `mavutil.mavlink_connection` với endpoint lấy từ config."""

    def __init__(self, endpoint: str | None = None) -> None:
        self.endpoint = endpoint or config.MAVLINK_ENDPOINT
        self.master = None
        self.target_system: int | None = None
        self.target_component: int | None = None

    def connect(self, timeout: float | None = None) -> tuple[int, int]:
        """Mở link và chờ heartbeat đầu tiên.

        Raises:
            TimeoutError: không nhận được heartbeat trong `timeout` giây.
        """
        # Import trong hàm để unit test (pure logic) không phụ thuộc pymavlink.
        from pymavlink import mavutil

        wait = config.HEARTBEAT_TIMEOUT_S if timeout is None else timeout
        log.info("Mở MAVLink tới %s", self.endpoint)
        self.master = mavutil.mavlink_connection(self.endpoint, baud=config.MAVLINK_BAUD)

        heartbeat = self.master.wait_heartbeat(timeout=wait)
        if heartbeat is None:
            raise TimeoutError(
                f"Không nhận được HEARTBEAT từ {self.endpoint} sau {wait:.0f}s"
            )

        self.target_system = self.master.target_system
        self.target_component = self.master.target_component
        log.info(
            "Heartbeat OK — system=%s component=%s",
            self.target_system,
            self.target_component,
        )
        return self.target_system, self.target_component

    @property
    def connected(self) -> bool:
        return self.master is not None and self.target_system is not None

    def recv_match(self, *, blocking: bool = True, timeout: float = 1.0):
        """Nhận message MAVLink kế tiếp (bất kể loại nào)."""
        if self.master is None:
            return None
        return self.master.recv_match(blocking=blocking, timeout=timeout)

    def close(self) -> None:
        if self.master is not None:
            self.master.close()
            self.master = None
        self.target_system = None
        self.target_component = None


def _main() -> int:
    """CỔNG PASS 5A — in ra system ID và trạng thái heartbeat."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    conn = MavlinkConnection()
    print(f"Đang kết nối tới {conn.endpoint} ...")
    try:
        system, component = conn.connect()
    except (TimeoutError, OSError) as exc:
        print(f"FAIL: {exc}")
        print("Kiểm tra SITL đã chạy chưa:  make sitl")
        return 1

    print()
    print("=== CỔNG PASS 5A ===")
    print("Python connected   : yes")
    print(f"System ID          : {system}")
    print(f"Component ID       : {component}")
    print("Heartbeat received : yes")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
