"""Vòng DEAD-MAN — Phase 06, việc 6.4. Đây là thứ phải đúng tuyệt đối.

Dead-man switch là cần gạt trên đầu máy xe lửa: người lái buông tay thì tàu tự
phanh. Ở đây "buông tay" là trình duyệt ngừng gửi lệnh, và "phanh" là velocity
(0, 0, 0).

╔══════════════════════════════════════════════════════════════════════════╗
║  VÒNG NÀY CHẠY TRONG `threading.Thread` RIÊNG, **KHÔNG** TRONG ASYNCIO.  ║
║                                                                          ║
║  Nếu một handler async nào đó chẹn event loop — gọi nhầm một hàm         ║
║  blocking, ghi file chậm, sau này là vòng suy luận ảnh của Phase 19 —    ║
║  thì vòng dead-man nằm trong event loop sẽ KHÔNG CHẠY đúng vào lúc cần   ║
║  nó nhất. Thread riêng miễn nhiễm với chuyện đó.                        ║
║                                                                          ║
║  `test_event_loop_bi_chen_van_gui_zero` sinh ra để canh đúng điều này:   ║
║  chuyển vòng lặp vào asyncio là test đó phải ĐỎ.                        ║
╚══════════════════════════════════════════════════════════════════════════╝

Ba lớp phòng thủ, độc lập nhau — và chúng KHÔNG cùng một con số:

    đóng tab / rớt mạng   socket đóng -> gửi zero NGAY            < 50 ms
    trình duyệt treo      hết hạn 300 ms -> nhịp kế gửi zero      <= 350 ms
    backend chết hẳn      ArduPilot tự huỷ lệnh movement          ~ 3 s

Bảo đảm của hệ thống là **`MANUAL_COMMAND_TIMEOUT_MS + DEADMAN_TICK_MS` =
350 ms**, không phải "đúng 300 ms". 300 là ngưỡng HẾT HẠN, 350 là ngưỡng GIAO
HÀNG. Nói 300 mà thực tế 350 là overclaim.

Vòng này còn một việc thứ hai, quan trọng không kém việc phanh: **gửi lại
velocity gần nhất**. ArduPilot cố ý huỷ lệnh movement sau ~3 giây nếu không
nhận lệnh mới (đó là tính năng an toàn của FC, không phải bug), nên nếu không
gửi lại thì drone sẽ khựng từng nhịp.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path

from backend import config
from backend.events import BUS

log = logging.getLogger(__name__)

# `reason` hợp lệ. Đây là HỢP ĐỒNG với Phase 10 §10.7 — test Playwright đọc
# `logs/deadman.jsonl` để đo độ trễ. Thêm/đổi giá trị thì phải sửa cả
# `plans/phase-10-web-dieu-khien-obstacle-video.md` trong CÙNG một commit.
ZERO_REASONS = (
    "web_disconnected",  # socket đóng (đóng tab, rút mạng)
    "deadman_timeout",  # trình duyệt còn kết nối nhưng ngừng gửi lệnh
    "mode_changed",  # pilot gạt RC ra khỏi GUIDED
    "link_lost",  # mất liên lạc MAVLink
    "operator_disabled",  # operator tự tắt WEB CONTROL
)


class DeadmanLoop:
    """Vòng quét độc lập: phanh khi mất liên lạc, giữ lệnh khi còn liên lạc.

    `tick()` tách khỏi thân thread để test bơm được thời gian giả — mọi test
    trừ test #5 (test chẹn event loop) gọi thẳng `tick(now=...)` và vì thế
    tất định, không chập chờn.
    """

    def __init__(
        self,
        control,
        safety,
        *,
        bus=BUS,
        tick_ms: int | None = None,
        repeat: int | None = None,
        timeout_ms: int | None = None,
        log_path: str | Path | None = None,
    ) -> None:
        self.control = control
        self.safety = safety
        self.bus = bus
        self.tick_s = (config.DEADMAN_TICK_MS if tick_ms is None else tick_ms) / 1000.0
        self.repeat = config.ZERO_VELOCITY_REPEAT if repeat is None else repeat
        self.timeout_ms = timeout_ms
        self.log_path = Path(config.DEADMAN_LOG_PATH if log_path is None else log_path)

        # Velocity gần nhất được chấp nhận, hoặc None khi chưa có lệnh nào.
        self._last: tuple[float, float, float, float] | None = None
        # Số nhịp còn phải lặp lại gói (0,0,0) của lần trip đang chạy.
        self._con_lap = 0
        self._lock = threading.Lock()

        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # -- vòng đời -----------------------------------------------------------
    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="deadman", daemon=True)
        self._thread.start()
        log.info(
            "Vòng dead-man chạy: tick=%.0f ms, timeout=%d ms, lặp zero=%d nhịp",
            self.tick_s * 1000,
            self.timeout_ms or config.MANUAL_COMMAND_TIMEOUT_MS,
            self.repeat,
        )

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=timeout)
            if thread.is_alive():
                # Giữ tham chiếu để `start()` không đẻ ra thread thứ hai cùng
                # ghi vào một socket — cùng lý do với `TelemetryReader.stop`.
                log.error("Thread dead-man chưa dừng sau %.0fs", timeout)
            else:
                self._thread = None

    def _run(self) -> None:
        # Ngủ tới MỐC KẾ chứ không ngủ đủ `tick_s` sau khi làm việc: ngủ đủ thì
        # chu kỳ = việc + tick và nhịp trôi xuống dưới 20 Hz, kéo theo bảo đảm
        # 350 ms trôi theo. Cùng bài học với `telemetry_loop` ở ws.py.
        moc_ke = time.monotonic()
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:  # noqa: BLE001
                # Vòng này CHẾT là mất cả cơ chế an toàn, mà socket vẫn mở nên
                # không ai thấy gì. Ghi lại rồi đi tiếp — tuyệt đối không để
                # exception thoát ra khỏi thread.
                log.exception("Nhịp dead-man ném lỗi — đã ghi lại và chạy tiếp")
            moc_ke += self.tick_s
            cho = moc_ke - time.monotonic()
            if cho < 0:
                moc_ke = time.monotonic()
                cho = 0.0
            self._stop.wait(cho)

    # -- một nhịp -----------------------------------------------------------
    def tick(self, now: float | None = None) -> None:
        """Một nhịp quét. Thứ tự ba nhánh là có chủ đích, đừng đảo."""
        # 0. Đang lặp lại gói zero của một lần trip vừa nổ — ưu tiên trên hết,
        #    kể cả khi quyền lái đã bị thu (thu quyền không tự dừng drone).
        with self._lock:
            if self._con_lap > 0:
                self._con_lap -= 1
                con_lai = self._con_lap
            else:
                con_lai = -1
        if con_lai >= 0:
            self._gui_zero()
            return

        # 1. Web không có quyền lái -> không làm gì. Không phải "không cần
        #    phanh" mà là "không có ai đang lái để mà buông tay".
        if not self.safety.web_control_enabled:
            return

        # 2. Quá hạn dead-man -> PHANH.
        if self.safety.should_send_zero_velocity(now=now, timeout_ms=self.timeout_ms):
            self.trip("deadman_timeout")
            return

        # 3. Còn liên lạc -> gửi lại lệnh gần nhất, giữ cho nó còn hiệu lực.
        with self._lock:
            lenh = self._last
        if lenh is not None:
            self._gui(*lenh)

    # -- API cho phần còn lại của backend -----------------------------------
    def note_velocity(self, vx: float, vy: float, vz: float, yaw_rate: float = 0.0) -> None:
        """Ghi nhận một lệnh velocity vừa được CHẤP NHẬN (đã kẹp, đã qua cổng).

        Gọi từ event loop; vòng dead-man đọc ở thread khác nên phải có khoá.
        """
        with self._lock:
            self._last = (vx, vy, vz, yaw_rate)
            # Có lệnh mới nghĩa là người lái quay lại — huỷ phần lặp zero còn
            # dở, nếu không ta vừa nhận lệnh tiến vừa bắn zero đè lên.
            self._con_lap = 0

    def trip(self, reason: str, *, socket_id: str | None = None) -> None:
        """Phanh NGAY: gửi (0,0,0), ghi sổ kiểm, phát sự kiện, thu quyền lái.

        Gọi được từ MỌI thread — event loop gọi nó khi socket đóng, thread
        dead-man gọi nó khi hết hạn.

        Thu quyền lái ở cuối không phải dọn dẹp phụ: thiếu nó thì nhánh 2 của
        `tick()` sẽ trip lại ở mọi nhịp sau đó (điều kiện hết hạn vẫn đúng),
        đẻ ra 20 dòng sổ kiểm mỗi giây cho tới hết phiên.
        """
        if reason not in ZERO_REASONS:
            # Không im lặng nuốt một `reason` lạ: file này là bằng chứng an
            # toàn, một giá trị sai ở đây làm hỏng phép đo của Phase 10.
            raise ValueError(f"reason '{reason}' khong nam trong ZERO_REASONS")

        with self._lock:
            self._last = (0.0, 0.0, 0.0, 0.0)
            self._con_lap = max(0, self.repeat - 1)

        loi = self._gui_zero()
        self.safety.note_zero_velocity(reason)
        self._ghi_so_kiem(reason, socket_id=socket_id, loi=loi)
        self.safety.disable_web_control()

        self.bus.emit(
            "warn",
            "safety",
            "deadman.zero_velocity",
            f"Dead-man: da gui velocity 0 ({reason})",
            {"reason": reason, "socket_id": socket_id, "repeat": self.repeat},
        )

    def clear_trip(self) -> None:
        """Operator bật lại WEB CONTROL = xác nhận đã thấy lần mất lái trước."""
        with self._lock:
            self._last = None
            self._con_lap = 0
        self.safety.clear_deadman()

    # -- gửi ----------------------------------------------------------------
    def _gui(self, vx: float, vy: float, vz: float, yaw_rate: float) -> str | None:
        """Gửi một gói velocity. Trả chuỗi lỗi nếu hỏng, None nếu xong.

        KHÔNG ném ra ngoài: một lần gửi hỏng (chưa có link) không được làm chết
        vòng lặp, nhưng cũng không được biến mất — nó được ghi vào sổ kiểm ở
        trường `error` và vào log backend.
        """
        try:
            self.control.send_velocity_body(vx, vy, vz, yaw_rate)
        except Exception as exc:  # noqa: BLE001
            log.warning("Dead-man khong gui duoc velocity: %s", exc)
            return str(exc)[:200]
        return None

    def _gui_zero(self) -> str | None:
        return self._gui(0.0, 0.0, 0.0, 0.0)

    # -- sổ kiểm ------------------------------------------------------------
    def _ghi_so_kiem(self, reason: str, *, socket_id: str | None, loi: str | None) -> None:
        """Một dòng JSON cho MỘT LẦN trip — không phải một dòng cho mỗi gói.

        Vì sao một-dòng-một-trip: `ZERO_VELOCITY_REPEAT` gói là MỘT hành động
        an toàn, chỉ lặp để chống rơi gói UDP. Ghi 5 dòng giống nhau cách nhau
        50 ms thì Phase 10 đọc file để đo độ trễ sẽ phải đoán lấy dòng nào.
        Số lần lặp nằm ở trường `repeat`.

        Ghi ĐỒNG BỘ và `flush()` ngay: bằng chứng an toàn quan trọng hơn vài
        micro-giây. Đẩy qua `asyncio.to_thread` là đúng cách để test đọc phải
        một file rỗng.
        """
        dong = {
            "ts": time.time(),
            "mono": time.monotonic(),
            "reason": reason,
            "vx": 0.0,
            "vy": 0.0,
            "vz": 0.0,
            "socket_id": socket_id,
            "repeat": self.repeat,
            "sent": loi is None,
        }
        if loi is not None:
            dong["error"] = loi
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with self.log_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(dong, ensure_ascii=False) + "\n")
                f.flush()
        except OSError as exc:
            # Không ghi được sổ kiểm KHÔNG được ngăn việc phanh (đã phanh xong
            # ở trên rồi), nhưng phải kêu to: mất bằng chứng là mất cổng pass.
            log.error("Khong ghi duoc so kiem dead-man %s: %s", self.log_path, exc)
