"""Kết nối MAVLink — GIAI ĐOẠN 5, mở rộng ở Phase 05.

Module này chỉ làm một việc: mở link tới flight controller (SITL hoặc drone thật
qua ESP32 bridge), chờ HEARTBEAT, và là CỬA DUY NHẤT để ghi ra socket. Không
parse telemetry ở đây (xem `telemetry.py`), không quyết định lệnh ở đây (xem
`control.py`).

╔══════════════════════════════════════════════════════════════════════════╗
║  LUẬT CHO PHASE 06 VÀ 07 — ĐỌC TRƯỚC KHI GỬI BẤT KỲ LỆNH NÀO             ║
║                                                                          ║
║  MỌI lời gọi `master.mav.*_send()` PHẢI đi qua `MavlinkConnection.send`: ║
║                                                                          ║
║      conn.send(conn.master.mav.command_long_send, ...)   # ĐÚNG          ║
║      conn.master.mav.command_long_send(...)              # SAI           ║
║                                                                          ║
║  Vì sao: từ Phase 06 sẽ có HAI thread cùng ghi vào một socket — thread   ║
║  đọc telemetry và vòng dead-man. Hai thread ghi xen kẽ làm byte của hai  ║
║  gói đan vào nhau; flight controller bỏ gói TRONG IM LẶNG. Không có      ║
║  exception, không có log, lệnh chỉ đơn giản là không tới nơi. Đây là     ║
║  loại bug khó tìm nhất trong cả dự án.                                   ║
║                                                                          ║
║  Kiểm bằng:  grep -rn "\\.mav\\." backend/                                 ║
╚══════════════════════════════════════════════════════════════════════════╝

Chạy trực tiếp để kiểm tra CỔNG PASS 5A:

    python -m backend.mavlink.connection
"""

from __future__ import annotations

import logging
import threading
import time

from backend import config

log = logging.getLogger(__name__)

# MAV_CMD id — đặt tên thay vì rải số trần trong code.
MAV_CMD_SET_MESSAGE_INTERVAL = 511
MAV_CMD_REQUEST_MESSAGE = 512

# HOME_POSITION không có stream rate: nó là message sự kiện, phải xin từng lần.
MSG_ID_HOME_POSITION = 242

# Tần số ta CHỦ ĐỘNG xin flight controller gửi, message_id -> Hz.
#
# Mặc định ArduPilot gửi một số message rất chậm (ATTITUDE có khi chỉ 1-4 Hz),
# HUD sẽ giật. Xin lại sau MỖI lần nối lại, không phải chỉ lần đầu.
#
# KHÔNG đặt interval cho STATUSTEXT (253) và nhóm MISSION_*: chúng là message
# sự kiện, FC tự đẩy khi có việc — xin nhịp cho chúng là vô nghĩa.
STREAM_RATES: dict[int, float] = {
    0: 1,  # HEARTBEAT            — phát hiện mất link
    1: 2,  # SYS_STATUS           — cờ sức khoẻ cảm biến, điện áp dự phòng
    24: 2,  # GPS_RAW_INT         — fix type + số vệ tinh (đổi chậm)
    30: 10,  # ATTITUDE           — chân trời giả phải mượt
    33: 5,  # GLOBAL_POSITION_INT — marker bản đồ
    74: 5,  # VFR_HUD             — tốc độ mặt đất, tốc độ leo
    132: 5,  # DISTANCE_SENSOR    — khoảng cách vật cản (Phase 07)
    147: 1,  # BATTERY_STATUS     — dòng điện + % pin
    330: 5,  # OBSTACLE_DISTANCE  — mảng 72 cung proximity (Phase 07)
}

# Nghỉ giữa hai lệnh SET_MESSAGE_INTERVAL. Dội 9 lệnh trong 1 ms thì FC hoặc
# link nối tiếp chậm sẽ rớt bớt — mất nhịp của đúng message đó, im lặng.
_STREAM_REQUEST_GAP_S = 0.02


class MavlinkConnection:
    """Bọc `mavutil.mavlink_connection` với endpoint lấy từ config."""

    def __init__(self, endpoint: str | None = None) -> None:
        self.endpoint = endpoint or config.MAVLINK_ENDPOINT
        self.master = None
        self.target_system: int | None = None
        self.target_component: int | None = None
        # Xem khối LUẬT ở đầu file.
        self._send_lock = threading.Lock()

    def connect(self, timeout: float | None = None) -> tuple[int, int]:
        """Mở link và chờ heartbeat đầu tiên.

        Raises:
            TimeoutError: không nhận được heartbeat trong `timeout` giây.
        """
        # Import trong hàm để unit test (pure logic) không phụ thuộc pymavlink.
        from pymavlink import mavutil

        wait = config.HEARTBEAT_TIMEOUT_S if timeout is None else timeout
        log.info(
            "Mở MAVLink tới %s (sysid=%s compid=%s)",
            self.endpoint,
            config.MAVLINK_SOURCE_SYSTEM,
            config.MAVLINK_SOURCE_COMPONENT,
        )
        self.master = mavutil.mavlink_connection(
            self.endpoint,
            baud=config.MAVLINK_BAUD,
            source_system=config.MAVLINK_SOURCE_SYSTEM,
            source_component=config.MAVLINK_SOURCE_COMPONENT,
        )

        heartbeat = self.master.wait_heartbeat(timeout=wait)
        if heartbeat is None:
            # Đóng trước khi ném: `self.master` đã bind cổng UDP ở dòng trên,
            # để nguyên là bỏ lại một cổng đã chiếm cho gc dọn hộ.
            self.close()
            raise TimeoutError(f"Không nhận được HEARTBEAT từ {self.endpoint} sau {wait:.0f}s")

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

    # -- ghi ----------------------------------------------------------------
    def send(self, fn, *args, **kwargs):
        """Cửa DUY NHẤT để ghi ra socket MAVLink. Xem khối LUẬT ở đầu file.

        Raises:
            ConnectionError: chưa có link. Gọi được thì ít nhất socket đã mở —
                không im lặng nuốt lệnh khi chưa nối.
        """
        if self.master is None:
            raise ConnectionError("Chưa có link MAVLink — không gửi được lệnh")
        with self._send_lock:
            return fn(*args, **kwargs)

    def request_streams(self, rates: dict[int, float] | None = None) -> None:
        """Xin FC gửi từng message ở tần số trong `STREAM_RATES`.

        PHẢI gọi lại sau MỖI lần nối lại. Đặt ngoài vòng reconnect là lỗi kinh
        điển: nối lại xong HUD giật mà không ai hiểu vì sao.
        """
        if self.master is None:
            raise ConnectionError("Chưa có link MAVLink — không xin được stream")
        table = STREAM_RATES if rates is None else rates
        for msg_id, hz in table.items():
            self.send(
                self.master.mav.command_long_send,
                self.target_system,
                self.target_component,
                MAV_CMD_SET_MESSAGE_INTERVAL,
                0,  # confirmation
                msg_id,
                int(1_000_000 / hz),  # param2: chu kỳ tính bằng micro-giây
                0,
                0,
                0,
                0,
                0,
            )
            time.sleep(_STREAM_REQUEST_GAP_S)
        log.info("Đã xin %d stream rate", len(table))

    def request_message(self, msg_id: int) -> None:
        """Xin FC gửi MỘT message, một lần (MAV_CMD_REQUEST_MESSAGE).

        Dùng cho message sự kiện không có nhịp, như HOME_POSITION.
        """
        if self.master is None:
            raise ConnectionError("Chưa có link MAVLink — không xin được message")
        self.send(
            self.master.mav.command_long_send,
            self.target_system,
            self.target_component,
            MAV_CMD_REQUEST_MESSAGE,
            0,
            msg_id,
            0,
            0,
            0,
            0,
            0,
            0,
        )

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

    try:
        conn.request_streams()
        print(f"Stream rates       : đã xin {len(STREAM_RATES)} message")
    except Exception as exc:  # noqa: BLE001 — chỉ là bước kiểm, không chặn cổng pass
        print(f"Stream rates       : FAIL ({exc})")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
