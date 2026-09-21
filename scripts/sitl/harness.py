#!/usr/bin/env python3
"""Harness dùng chung cho các runner tự động hoá SITL (Phase 03).

Mọi giao tiếp với ArduCopter SITL đi qua MAVLink THẬT bằng pymavlink — không gõ
lệnh MAVProxy giả lập, không hack. Mission được nạp bằng đúng giao thức
MISSION_COUNT -> MISSION_REQUEST_INT -> MISSION_ITEM_INT -> MISSION_ACK, vì
Phase 07 sẽ viết lại luồng này ở backend web và cần một tham chiếu đã chạy
thật để so sánh.

CHẠY TRONG WSL bằng python có pymavlink:
    /home/nghaiz/venv-ardupilot/bin/python3 scripts/sitl/<runner>.py

Mỗi runner tự khởi động MỘT phiên SITL riêng (cách ly qua --use-dir, không
dùng cổng/thư mục log mặc định của ./scripts/run_sitl.sh) rồi tự tắt khi xong
-- không tranh chấp với phiên SITL người dùng đang mở tay qua Mission Planner.
Trước khi khởi động, harness từ chối chạy nếu đã có sim_vehicle.py/arducopter
sống -- KHÔNG đoán, KHÔNG tự ý dùng chung.

CẤM: không có hàm nào ở đây gửi PWM thẳng ra động cơ thật -- đây là SITL ảo
hoàn toàn (xem SAFETY.md mục 1). RC_CHANNELS_OVERRIDE trong square_via_rc()
chỉ tác động lên drone ẢO trong tiến trình arducopter SITL tự khởi động.
"""

from __future__ import annotations

import contextlib
import math
import os
import signal
import subprocess
import sys
import time
from collections.abc import Iterable
from pathlib import Path

from pymavlink import mavutil

REPO_ROOT = Path(__file__).resolve().parents[2]
ARDUPILOT_DIR = Path(os.environ.get("ARDUPILOT_DIR", os.path.expanduser("~/ardupilot")))
SIM_VEHICLE = ARDUPILOT_DIR / "Tools" / "autotest" / "sim_vehicle.py"
VEHICLE_DIR = ARDUPILOT_DIR / "ArduCopter"
VENV_PYTHON = os.environ.get("SITL_PYTHON", os.path.expanduser("~/venv-ardupilot/bin/python3"))
SITL_BINARY = ARDUPILOT_DIR / "build" / "sitl" / "bin" / "arducopter"
LOGS_DIR = REPO_ROOT / "logs" / "sitl"

# Nơi mỗi runner dựng thư mục làm việc riêng cho phiên SITL của nó.
#
# KHÔNG dùng /tmp: đó là thư mục ai cũng ghi được, nên một đường dẫn đoán trước
# được như `/tmp/sitl-mode-chain` có thể bị người dùng khác trên cùng máy chèn
# symlink vào (SonarCloud python:S5443). Thư mục dưới $HOME thuộc về một người.
#
# Cũng KHÔNG đặt trong repo: repo nằm trên ổ Windows gắn qua 9p, mà SITL ghi log
# rất dày — để đó là tự làm chậm mô phỏng. `~/.cache` là ext4 gốc của WSL.
RUN_DIR_BASE = Path(os.environ.get("SITL_RUN_DIR", os.path.expanduser("~/.cache/iot-cv-sitl")))


def run_dir(ten: str) -> Path:
    """Thư mục làm việc riêng cho một runner. Tạo sẵn với quyền chỉ chủ sở hữu."""
    d = RUN_DIR_BASE / ten
    d.mkdir(parents=True, exist_ok=True, mode=0o700)
    return d


# Cờ EKF_STATUS_REPORT.flags — đồng bộ với backend/mavlink/telemetry.py, nơi
# các giá trị này được xác định bằng đo A/B trên SITL chứ không tra tài liệu.
_EKF_ATTITUDE = 1
_EKF_VELOCITY_HORIZ = 2
_EKF_POS_HORIZ_ABS = 16
_EKF_CONST_POS_MODE = 128
_EKF_CAN_CO = _EKF_ATTITUDE | _EKF_VELOCITY_HORIZ | _EKF_POS_HORIZ_ABS

MODE_ID_TO_NAME = mavutil.mode_mapping_acm  # {0: "STABILIZE", 4: "GUIDED", ...}
MODE_NAME_TO_ID = {name: mode_id for mode_id, name in MODE_ID_TO_NAME.items()}

# Bán kính Trái Đất trung bình (m) -- dùng cho xấp xỉ toạ độ phẳng khi đặt
# waypoint cách home vài chục/trăm mét. Sai số ở quy mô này không đáng kể.
_EARTH_RADIUS_M = 6378137.0


class SitlError(RuntimeError):
    """Lỗi khi khởi động/điều khiển SITL -- luôn kèm ngữ cảnh, không nuốt lặng."""


def _enum_name(enum_name: str, value: int) -> str:
    """Tên chữ của một giá trị enum MAVLink (vd MAV_RESULT, MAV_MISSION_RESULT).
    mavlink.enums[...].get() trả về đối tượng EnumEntry chứ không phải chuỗi,
    in thẳng ra sẽ ra địa chỉ object vô nghĩa -- phải lấy .name."""
    entry = mavutil.mavlink.enums.get(enum_name, {}).get(value)
    return entry.name if entry is not None else str(value)


# ---------------------------------------------------------------------------
# Toạ độ
# ---------------------------------------------------------------------------


def offset_latlon(
    lat_deg: float, lon_deg: float, north_m: float, east_m: float
) -> tuple[float, float]:
    """Dịch một toạ độ (độ) đi north_m/east_m mét, xấp xỉ phẳng cục bộ."""
    d_lat = (north_m / _EARTH_RADIUS_M) * (180.0 / math.pi)
    d_lon = (east_m / (_EARTH_RADIUS_M * math.cos(math.radians(lat_deg)))) * (180.0 / math.pi)
    return lat_deg + d_lat, lon_deg + d_lon


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Khoảng cách mặt đất (m) giữa hai toạ độ độ."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Khởi động / tắt SITL
# ---------------------------------------------------------------------------


def _check_binaries() -> None:
    if not VEHICLE_DIR.is_dir() or not SIM_VEHICLE.is_file():
        raise SitlError(
            f"Không thấy ArduCopter/sim_vehicle.py dưới {ARDUPILOT_DIR}. "
            "Xem plans/phase-02-wsl2-sitl.md -- chưa clone hoặc clone dở dang."
        )
    if not Path(VENV_PYTHON).is_file():
        raise SitlError(
            f"Không thấy python venv tại {VENV_PYTHON}. Đặt biến môi trường "
            "SITL_PYTHON trỏ đúng /path/to/venv/bin/python3 có pymavlink."
        )
    if not SITL_BINARY.is_file():
        raise SitlError(
            f"Chưa có binary SITL tại {SITL_BINARY}.\n"
            "Harness chạy với --no-rebuild (xem chú thích ở start()), nên nó KHÔNG "
            "tự build. Build một lần bằng ĐÚNG python của venv:\n"
            f"  cd {VEHICLE_DIR} && {VENV_PYTHON} {ARDUPILOT_DIR}/modules/waf/waf-light "
            "configure --board sitl && \\\n"
            f"  {VENV_PYTHON} {ARDUPILOT_DIR}/modules/waf/waf-light build --target "
            "bin/arducopter\n"
            "Phải là python venv: waf cần `empy`, mà empy chỉ có trong venv."
        )


def _running_sitl_pids() -> list[str]:
    """Trả về danh sách dòng mô tả tiến trình sim_vehicle/arducopter đang sống."""
    out = subprocess.run(
        ["pgrep", "-af", "sim_vehicle.py|bin/arducopter"],
        capture_output=True,
        text=True,
        check=False,
    )
    lines = [ln for ln in out.stdout.splitlines() if ln.strip()]
    return lines


def refuse_if_conflict() -> None:
    """Từ chối chạy nếu đã có phiên SITL khác sống -- không đoán, không dùng chung."""
    lines = _running_sitl_pids()
    if lines:
        joined = "\n  ".join(lines)
        raise SitlError(
            "Đã có tiến trình SITL đang chạy -- không tự khởi động thêm để tránh "
            "tranh chấp cổng/log với phiên bạn đang mở tay.\n"
            f"  {joined}\n"
            "Đóng phiên đó trước (hoặc `pkill -f sim_vehicle` trong WSL nếu chắc "
            "chắn là rác còn sót), rồi chạy lại runner này."
        )


class SitlInstance:
    """Một phiên ArduCopter SITL headless, cách ly, tự dọn khi thoát `with`."""

    def __init__(
        self,
        use_dir: Path,
        *,
        speedup: int = 5,
        wipe_eeprom: bool = True,
        extra_args: Iterable[str] | None = None,
        connect_timeout_s: float = 90.0,
    ) -> None:
        self.use_dir = Path(use_dir)
        self.speedup = speedup
        self.wipe_eeprom = wipe_eeprom
        self.extra_args = list(extra_args or [])
        self.connect_timeout_s = connect_timeout_s
        self.proc: subprocess.Popen | None = None
        self.master: mavutil.mavfile | None = None
        self.statustext_log: list[str] = []
        self._log_file = None

    def __enter__(self) -> SitlInstance:
        self.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.stop()

    # -- khởi động ---------------------------------------------------------

    def start(self) -> None:
        _check_binaries()
        refuse_if_conflict()
        self.use_dir.mkdir(parents=True, exist_ok=True)
        cmd = [
            VENV_PYTHON,
            str(SIM_VEHICLE),
            "-v",
            "ArduCopter",
            "--no-mavproxy",
            "--no-wsl2-network",
            # --no-rebuild BẮT BUỘC, hai lý do:
            #
            # 1. Harness là bộ chạy thử, không phải bộ build. Mỗi runner tự mở
            #    một phiên SITL; để sim_vehicle.py build lại mỗi lần là cộng vài
            #    phút cho mỗi runner, không đổi lại được gì.
            # 2. Build tại đây THẤT BẠI trên máy này, và lỗi rất khó lần:
            #    sim_vehicle.py chạy bằng python của venv, nhưng nó gọi waf qua
            #    `waf-light` với shebang `#!/usr/bin/env python3` -> rơi về python
            #    HỆ THỐNG, nơi KHÔNG có `empy`. Build chết với
            #    "you need to install empy", còn sim_vehicle.py chỉ báo
            #    "Build failed" rồi thoát 1 — không nhắc gì tới python nào.
            #    Tệ hơn: nó chạy `configure` TRƯỚC khi build hỏng, tức là một lần
            #    chạy thử hỏng cũng đủ động vào cấu hình build đang tốt.
            #
            # Đổi lại: binary phải có sẵn. `_check_binaries()` canh việc đó và in
            # ra đúng lệnh build (bằng python venv) khi thiếu.
            "--no-rebuild",
            f"--speedup={self.speedup}",
            f"--use-dir={self.use_dir}",
        ]
        if self.wipe_eeprom:
            cmd.append("-w")
        cmd.extend(self.extra_args)

        log_path = self.use_dir / "sim_vehicle_stdout.log"
        # noqa SIM115 có chủ đích: file này phải sống bằng tuổi tiến trình SITL
        # (nó là stdout của Popen), nên không bọc `with` được. `stop()` đóng nó.
        self._log_file = open(log_path, "w", encoding="utf-8")  # noqa: SIM115
        print(f"[harness] khởi động: {' '.join(cmd)}", file=sys.stderr)
        print(f"[harness] log sim_vehicle.py: {log_path}", file=sys.stderr)
        self.proc = subprocess.Popen(
            cmd,
            cwd=VEHICLE_DIR,
            stdout=self._log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        self._connect()

    def _connect(self) -> None:
        deadline = time.monotonic() + self.connect_timeout_s
        last_err: Exception | None = None
        while time.monotonic() < deadline:
            if self.proc.poll() is not None:
                raise SitlError(
                    f"sim_vehicle.py thoát sớm (exit={self.proc.returncode}) trước khi "
                    f"kết nối được. Xem log: {self.use_dir}/sim_vehicle_stdout.log"
                )
            try:
                m = mavutil.mavlink_connection("tcp:127.0.0.1:5760", source_system=250)
                hb = m.wait_heartbeat(timeout=5)
            except (ConnectionRefusedError, OSError, TimeoutError) as exc:
                last_err = exc
                time.sleep(1.0)
                continue
            if hb is None:
                last_err = TimeoutError("wait_heartbeat trả về None")
                time.sleep(1.0)
                continue
            self.master = m
            # Bật luồng telemetry -- ArduCopter KHÔNG tự phát GLOBAL_POSITION_INT/
            # VFR_HUD nếu không ai yêu cầu (đã kiểm chứng thực nghiệm 21/09/2026:
            # 0 gói trong 3s khi không request, có gói ngay khi request).
            m.mav.request_data_stream_send(
                m.target_system,
                m.target_component,
                mavutil.mavlink.MAV_DATA_STREAM_ALL,
                4,
                1,
            )
            return
        raise SitlError(
            f"Không kết nối được tcp:127.0.0.1:5760 sau {self.connect_timeout_s}s. "
            f"Lỗi cuối: {last_err!r}. Xem log: {self.use_dir}/sim_vehicle_stdout.log"
        )

    # -- tắt -----------------------------------------------------------

    def stop(self) -> None:
        if self.master is not None:
            with contextlib.suppress(Exception):
                self.master.close()
        if self.proc is not None:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            try:
                self.proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
        # Lưới an toàn thứ hai: sim_vehicle.py chạy arducopter qua một trình bọc
        # xterm (-hold -iconic) mà thực nghiệm 21/09/2026 cho thấy KHÔNG cùng
        # process group với sim_vehicle.py -- SIGTERM vào riêng sim_vehicle.py
        # để lại xterm + arducopter sống. Diệt thẳng theo tên tiến trình; an
        # toàn vì refuse_if_conflict() đã đảm bảo không có phiên nào khác chạy
        # trước khi ta start().
        for _ in range(5):
            r1 = subprocess.run(["pkill", "-9", "-f", "bin/arducopter"], check=False)
            r2 = subprocess.run(["pkill", "-9", "-f", "xterm.*-name ArduCopter"], check=False)
            if r1.returncode != 0 and r2.returncode != 0:
                break
            time.sleep(0.3)
        if self._log_file is not None:
            self._log_file.close()
        leftover = _running_sitl_pids()
        if leftover:
            print(
                "[harness] CẢNH BÁO: vẫn còn tiến trình SITL sau khi dọn:\n  "
                + "\n  ".join(leftover),
                file=sys.stderr,
            )

    # -- nhận gói, vừa đợi vừa hớt STATUSTEXT ---------------------------

    def recv_match(self, type_: str, *, condition: str | None = None, timeout: float = 15.0):
        """recv_match nhưng luôn hớt STATUSTEXT vào self.statustext_log dọc đường,
        để lỗi PreArm/mission không bị bỏ lỡ dù ta đang đợi loại gói khác."""
        types = [type_, "STATUSTEXT"] if type_ != "STATUSTEXT" else [type_]
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None
            msg = self.master.recv_match(
                type=types, condition=condition, blocking=True, timeout=remaining
            )
            if msg is None:
                return None
            if msg.get_type() == "STATUSTEXT":
                self.statustext_log.append(msg.text)
                if type_ == "STATUSTEXT":
                    return msg
                continue
            return msg

    # -- mode / arm / takeoff -------------------------------------------

    def wait_ready(self, *, timeout: float = 180.0, gps_min_sats: int = 6) -> None:
        """Chờ EKF có lời giải vị trí tuyệt đối VÀ GPS 3D fix.

        PHẢI gọi trước khi sang bất kỳ mode nào cần vị trí (GUIDED, AUTO, RTL,
        LOITER, POSHOLD). Bỏ bước này là cái bẫy đã sập ngay lần chạy thật đầu
        tiên của harness (22/09/2026): `set_mode("GUIDED")` ngay sau khi nối
        thì THÀNH CÔNG — heartbeat báo đúng GUIDED — nhưng vài giây sau EKF chưa
        có lời giải nên ArduPilot tự rơi về STABILIZE. Không có lỗi nào được
        ném ở chỗ đổi mode; hỏng chỉ lộ ra mãi sau, ở `takeoff()`, dưới dạng
        một chữ `MAV_RESULT_FAILED` trơ trọi.

        Ngưỡng cờ EKF lấy từ SỐ ĐO thật, không đoán (xem
        `backend/mavlink/telemetry.py::_ekf_ok_tu_flags`): khoẻ = 0x033F,
        mất GPS = 0x00A7 kèm CONST_POS_MODE bật.
        """
        deadline = time.monotonic() + timeout
        ekf_ok = False
        gps_ok = False
        cuoi = "chưa nhận được gói nào"

        while time.monotonic() < deadline:
            msg = self.recv_match(
                "EKF_STATUS_REPORT", timeout=min(5.0, deadline - time.monotonic())
            )
            if msg is not None:
                flags = msg.flags
                ekf_ok = (flags & _EKF_CAN_CO) == _EKF_CAN_CO and not (flags & _EKF_CONST_POS_MODE)
                cuoi = f"EKF flags=0x{flags:04X}"

            gps = self.master.messages.get("GPS_RAW_INT")
            if gps is not None:
                gps_ok = gps.fix_type >= 3 and gps.satellites_visible >= gps_min_sats
                cuoi += f", GPS fix={gps.fix_type} sats={gps.satellites_visible}"

            if ekf_ok and gps_ok:
                return

        raise SitlError(
            f"SITL không sẵn sàng sau {timeout:.0f}s (ekf_ok={ekf_ok} gps_ok={gps_ok}). "
            f"Trạng thái cuối: {cuoi}. STATUSTEXT gần nhất: {self.statustext_log[-5:]}"
        )

    def set_mode(self, mode_name: str, *, timeout: float = 15.0) -> None:
        if mode_name not in MODE_NAME_TO_ID:
            raise SitlError(
                f"Mode '{mode_name}' không có trong bảng mode của ArduCopter: "
                f"{sorted(MODE_NAME_TO_ID)}"
            )
        mode_id = MODE_NAME_TO_ID[mode_name]
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            mode_id,
            0,
            0,
            0,
            0,
            0,
        )
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            hb = self.recv_match("HEARTBEAT", timeout=deadline - time.monotonic())
            if hb is None:
                break
            if hb.custom_mode == mode_id:
                return
        raise SitlError(
            f"Đổi mode sang {mode_name} không có tác dụng sau {timeout}s. "
            f"STATUSTEXT gần nhất: {self.statustext_log[-5:]}"
        )

    def arm(self, *, timeout: float = 20.0) -> None:
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
        )
        ack = self.recv_match(
            "COMMAND_ACK",
            condition="COMMAND_ACK.command==400",
            timeout=timeout,
        )
        if ack is not None and ack.result != mavutil.mavlink.MAV_RESULT_ACCEPTED:
            result_name = _enum_name("MAV_RESULT", ack.result)
            raise SitlError(
                f"arm() bị từ chối: COMMAND_ACK result={result_name}. "
                f"STATUSTEXT gần nhất (PreArm...): {self.statustext_log[-5:]}"
            )
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            hb = self.recv_match("HEARTBEAT", timeout=deadline - time.monotonic())
            if hb is None:
                break
            if hb.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED:
                return
        raise SitlError(
            f"arm() gửi ACCEPTED nhưng chưa thấy ARMED sau {timeout}s. "
            f"STATUSTEXT gần nhất: {self.statustext_log[-5:]}"
        )

    def _rc_override(self, *, roll=1500, pitch=1500, throttle=1500, yaw=1500) -> None:
        self.master.mav.rc_channels_override_send(
            self.master.target_system,
            self.master.target_component,
            roll,
            pitch,
            throttle,
            yaw,
            0,
            0,
            0,
            0,
        )

    def start_auto_mission(self, *, timeout: float = 90.0) -> None:
        """Khởi động một mission AUTO TỪ MẶT ĐẤT.

        ╔══════════════════════════════════════════════════════════════════╗
        ║  Ba cách SAI, đo thật 22/09/2026 trên ArduCopter 4.7.1           ║
        ║                                                                  ║
        ║  1. `MAV_CMD_MISSION_START` (id 300) khi đã armed + ở AUTO trả    ║
        ║     `COMMAND_ACK result=2` = MAV_RESULT_DENIED. Mission vẫn hiện ║
        ║     `Mission: 1 Takeoff` (do vào AUTO), nhưng máy bay KHÔNG nhấc ║
        ║     lên, rồi `Disarming motors` sau ~10 s: `DISARM_DELAY = 10.0` ║
        ║     thắng, vì nó nằm dưới đất với ga bằng 0.                     ║
        ║                                                                  ║
        ║  2. Giả lập nâng ga bằng RC override sau khi arm — chạy đua với  ║
        ║     đồng hồ tự-disarm, và mong manh.                             ║
        ║                                                                  ║
        ║  3. Arm THẲNG trong AUTO — bị từ chối `MAV_RESULT_FAILED`.       ║
        ║     ArduCopter mặc định KHÔNG cho arm ở AUTO.                    ║
        ║                                                                  ║
        ║  Cách ĐÚNG là một tham số, không phải mẹo: `AUTO_OPTIONS`        ║
        ║  (mặc định 0, đã kiểm là có tồn tại trên firmware này)           ║
        ║      bit 0 = cho phép ARM trong AUTO                             ║
        ║      bit 1 = cho phép CẤT CÁNH mà không cần nâng ga              ║
        ║  Đặt 3 là bật cả hai.                                            ║
        ║                                                                  ║
        ║  Triệu chứng khi làm sai: mission nạp đúng, đọc lại đúng, vào    ║
        ║  AUTO đúng, mà `MISSION_ITEM_REACHED` không bao giờ tới và độ    ║
        ║  cao đỉnh là 0,0 m.                                              ║
        ╚══════════════════════════════════════════════════════════════════╝

        Chỉ hợp lệ trên SITL và trên bàn thử. Với drone THẬT, `AUTO_OPTIONS`
        bit 1 nghĩa là máy bay có thể tự nhấc lên mà không ai chạm cần ga —
        xem `SAFETY.md` trước khi đặt nó lên phần cứng thật.
        """
        self.set_param("AUTO_OPTIONS", 3)
        self.set_mode("AUTO")
        self.arm()

        het = time.monotonic() + timeout
        while time.monotonic() < het:
            if self.get_position(timeout=3.0)["alt_rel_m"] > 1.0:
                return
            time.sleep(0.3)
        raise SitlError(
            f"Mission AUTO không nhấc máy bay lên sau {timeout:.0f}s. "
            f"STATUSTEXT gần nhất: {self.statustext_log[-6:]}"
        )

    def wait_disarmed(self, *, timeout: float = 120.0) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            hb = self.recv_match("HEARTBEAT", timeout=deadline - time.monotonic())
            if hb is None:
                break
            if not (hb.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED):
                return
        raise SitlError(f"Chưa DISARMED sau {timeout}s -- có thể mission/RTL bị kẹt.")

    def takeoff(self, alt_m: float, *, timeout: float = 60.0) -> None:
        # Kiểm điều kiện TRƯỚC khi gửi. ArduPilot từ chối NAV_TAKEOFF ngoài
        # GUIDED/AUTO bằng đúng một chữ `MAV_RESULT_FAILED` — không nói lý do,
        # nên nếu không kiểm ở đây thì người đọc log chỉ thấy "bị từ chối" và
        # phải tự đoán. Đã mất một lượt gỡ lỗi vì chuyện này (22/09/2026).
        mode = self.get_mode_name()
        if mode not in ("GUIDED", "AUTO"):
            raise SitlError(
                f"takeoff({alt_m}) cần mode GUIDED hoặc AUTO, hiện đang {mode}. "
                "Thứ tự đúng: wait_ready() -> set_mode('GUIDED') -> arm() -> takeoff()."
            )
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            alt_m,
        )
        ack = self.recv_match("COMMAND_ACK", condition="COMMAND_ACK.command==22", timeout=timeout)
        if ack is not None and ack.result != mavutil.mavlink.MAV_RESULT_ACCEPTED:
            result_name = _enum_name("MAV_RESULT", ack.result)
            raise SitlError(f"takeoff({alt_m}) bị từ chối: COMMAND_ACK result={result_name}")
        self.wait_altitude(alt_m * 0.95, timeout=timeout)

    def wait_altitude(self, target_alt_m: float, *, timeout: float = 60.0) -> float:
        deadline = time.monotonic() + timeout
        last_alt = None
        while time.monotonic() < deadline:
            msg = self.recv_match("GLOBAL_POSITION_INT", timeout=deadline - time.monotonic())
            if msg is None:
                break
            last_alt = msg.relative_alt / 1000.0
            if last_alt >= target_alt_m:
                return last_alt
        raise SitlError(
            f"Chưa đạt độ cao {target_alt_m:.1f} m sau {timeout}s (độ cao cuối đọc được: "
            f"{last_alt if last_alt is not None else 'không có dữ liệu'})."
        )

    def get_position(self, *, timeout: float = 10.0):
        msg = self.recv_match("GLOBAL_POSITION_INT", timeout=timeout)
        if msg is None:
            raise SitlError("Không đọc được GLOBAL_POSITION_INT.")
        return {
            "lat": msg.lat / 1e7,
            "lon": msg.lon / 1e7,
            "alt_rel_m": msg.relative_alt / 1000.0,
            "alt_amsl_m": msg.alt / 1000.0,
        }

    def get_mode_name(self) -> str:
        hb = self.recv_match("HEARTBEAT", timeout=10.0)
        if hb is None:
            raise SitlError("Không đọc được HEARTBEAT để biết mode hiện tại.")
        return MODE_ID_TO_NAME.get(hb.custom_mode, f"UNKNOWN({hb.custom_mode})")

    def set_param(self, name: str, value: float, *, timeout: float = 45.0) -> None:
        """Đặt một tham số và ĐỢI FC xác nhận đúng tham số đó.

        Gửi lại định kỳ thay vì gửi một lần rồi ngồi đợi. Lý do đo được
        (22/09/2026): SITL khởi động với `-w` (xoá EEPROM) sẽ ĐỔ TOÀN BỘ danh
        sách ~1300 tham số ngay sau khi nối. Vòng đợi cũ chỉ lọc theo
        `type="PARAM_VALUE"` nên nó vớ phải từng gói một trong cơn lũ đó và hết
        10 giây trước khi tới lượt `RTL_ALT`. Triệu chứng đánh lừa: xin đọc
        `RTL_ALT` mà nhận về `BARO1_GND_PRESS`.

        PARAM_SET là thao tác idempotent nên gửi lại vô hại, và nó cũng vá
        luôn ca gói bị rớt (MAVLink chạy trên UDP, không đảm bảo tới nơi).
        """
        deadline = time.monotonic() + timeout
        gui_luc = 0.0
        while time.monotonic() < deadline:
            if time.monotonic() - gui_luc > 5.0:
                self.master.mav.param_set_send(
                    self.master.target_system,
                    self.master.target_component,
                    name.encode("utf-8"),
                    float(value),
                    mavutil.mavlink.MAV_PARAM_TYPE_REAL32,
                )
                gui_luc = time.monotonic()

            msg = self.master.recv_match(
                type="PARAM_VALUE",
                blocking=True,
                timeout=min(2.0, max(0.1, deadline - time.monotonic())),
            )
            if msg is None:
                continue
            if msg.param_id.rstrip("\x00") == name:
                if abs(msg.param_value - value) > 1e-3:
                    raise SitlError(
                        f"set_param({name}, {value}) -- FC báo lại giá trị khác: {msg.param_value}"
                    )
                return
        raise SitlError(f"set_param({name}, {value}) không có PARAM_VALUE xác nhận sau {timeout}s.")

    # -- bay hình vuông bằng rc override trong LOITER --------------------

    def square_via_rc(
        self, side_m: float, *, pwm_delta: int = 150, max_leg_s: float = 40.0
    ) -> list[dict]:
        """Bay một hình vuông cạnh side_m mét bằng RC_CHANNELS_OVERRIDE khi đang
        ở LOITER, mô phỏng đúng cách người dùng đẩy cần theo việc 03.3 (rc 1 /
        rc 2), nhưng CẮT theo khoảng cách thật đo bằng GLOBAL_POSITION_INT thay
        vì đoán thời gian -- để cạnh vuông đúng ~side_m, không phải "chờ N giây
        rồi hy vọng đúng". Trả về danh sách các chặng: hướng, khoảng cách thật,
        thời gian thật.

        Kênh RC: 1=roll, 2=pitch, 3=throttle (giữ 1500 = giữ độ cao ở LOITER),
        4=yaw. pitch giảm dưới 1500 = bay tới (theo quy ước MAVProxy `rc 2 1400`
        ở phase doc). roll tăng trên 1500 = bay phải.
        """
        legs = [
            ("tới (pitch-)", 2, 1500 - pwm_delta),
            ("phải (roll+)", 1, 1500 + pwm_delta),
            ("lùi (pitch+)", 2, 1500 + pwm_delta),
            ("trái (roll-)", 1, 1500 - pwm_delta),
        ]
        results = []
        for label, channel, value in legs:
            start = self.get_position()
            t0 = time.monotonic()
            traveled = 0.0
            rc = {1: 1500, 2: 1500, 3: 1500, 4: 1500}
            rc[channel] = value
            while traveled < side_m and (time.monotonic() - t0) < max_leg_s:
                self.master.mav.rc_channels_override_send(
                    self.master.target_system,
                    self.master.target_component,
                    rc[1],
                    rc[2],
                    rc[3],
                    rc[4],
                    0,
                    0,
                    0,
                    0,
                )
                pos = self.get_position(timeout=3.0)
                traveled = haversine_m(start["lat"], start["lon"], pos["lat"], pos["lon"])
                time.sleep(0.3)
            # Trả cần về giữa -- người mới hay quên bước này (phase doc 03.3, lỗi #4).
            self.master.mav.rc_channels_override_send(
                self.master.target_system,
                self.master.target_component,
                1500,
                1500,
                1500,
                1500,
                0,
                0,
                0,
                0,
            )
            time.sleep(2.0)  # đợi drone phanh lại ở LOITER trước khi đo chặng kế
            elapsed = time.monotonic() - t0
            results.append(
                {"chang": label, "khoang_cach_m": round(traveled, 1), "giay": round(elapsed, 1)}
            )
        return results


# ---------------------------------------------------------------------------
# Mission -- đúng giao thức MAVLink thật (Phase 07 sẽ tái dùng luồng này)
# ---------------------------------------------------------------------------


def upload_mission(sitl: SitlInstance, items: list[dict], *, timeout: float = 30.0) -> None:
    """Nạp mission bằng giao thức chuẩn:
    MISSION_COUNT -> (FC hỏi từng seq bằng MISSION_REQUEST_INT) -> ta trả lời
    bằng MISSION_ITEM_INT -> kết thúc bằng MISSION_ACK.

    items: list dict với khoá command, frame, x(lat*1e7 int), y(lon*1e7 int),
    z(alt m float), param1..4, current(0/1), autocontinue(0/1).
    """
    master = sitl.master
    master.mav.mission_count_send(
        master.target_system,
        master.target_component,
        len(items),
        mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
    )
    sent = set()
    deadline = time.monotonic() + timeout
    while len(sent) < len(items):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise SitlError(
                f"upload_mission: hết {timeout}s, mới gửi được {len(sent)}/{len(items)} item. "
                f"STATUSTEXT gần nhất: {sitl.statustext_log[-5:]}"
            )
        msg = master.recv_match(
            type=["MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK"],
            blocking=True,
            timeout=remaining,
        )
        if msg is None:
            continue
        if msg.get_type() == "MISSION_ACK":
            if msg.type != mavutil.mavlink.MAV_MISSION_ACCEPTED:
                result_name = _enum_name("MAV_MISSION_RESULT", msg.type)
                raise SitlError(f"upload_mission: FC từ chối với MISSION_ACK={result_name}")
            if len(sent) < len(items):
                raise SitlError(
                    f"upload_mission: nhận MISSION_ACK sớm khi mới gửi "
                    f"{len(sent)}/{len(items)} item."
                )
            return
        seq = msg.seq
        if seq in sent or seq >= len(items):
            continue
        item = items[seq]
        master.mav.mission_item_int_send(
            master.target_system,
            master.target_component,
            seq,
            item.get("frame", mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT),
            item["command"],
            1 if seq == 0 else 0,  # current -- chỉ item đầu đánh dấu current theo quy ước upload
            item.get("autocontinue", 1),
            item.get("param1", 0.0),
            item.get("param2", 0.0),
            item.get("param3", 0.0),
            item.get("param4", 0.0),
            item.get("x", 0),
            item.get("y", 0),
            item.get("z", 0.0),
            mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
        )
        sent.add(seq)
    # Đã gửi đủ item, đợi MISSION_ACK cuối cùng.
    remaining = deadline - time.monotonic()
    ack = master.recv_match(type="MISSION_ACK", blocking=True, timeout=max(remaining, 5))
    if ack is None:
        raise SitlError("upload_mission: gửi đủ item nhưng không thấy MISSION_ACK.")
    if ack.type != mavutil.mavlink.MAV_MISSION_ACCEPTED:
        result_name = _enum_name("MAV_MISSION_RESULT", ack.type)
        raise SitlError(f"upload_mission: FC từ chối với MISSION_ACK={result_name}")


def download_mission(sitl: SitlInstance, *, timeout: float = 30.0) -> list[dict]:
    """Đọc ngược mission đang nằm trên FC -- tương đương lệnh `wp list` của
    MAVProxy, nhưng qua đúng giao thức MISSION_REQUEST_LIST -> MISSION_COUNT ->
    (ta hỏi MISSION_REQUEST_INT từng seq) -> MISSION_ITEM_INT -> MISSION_ACK."""
    master = sitl.master
    master.mav.mission_request_list_send(
        master.target_system,
        master.target_component,
        mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
    )
    deadline = time.monotonic() + timeout
    count_msg = master.recv_match(type="MISSION_COUNT", blocking=True, timeout=timeout)
    if count_msg is None:
        raise SitlError("download_mission: không nhận được MISSION_COUNT.")
    count = count_msg.count
    items: list[dict] = []
    for seq in range(count):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise SitlError(f"download_mission: hết giờ ở seq={seq}/{count}.")
        master.mav.mission_request_int_send(
            master.target_system,
            master.target_component,
            seq,
            mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
        )
        item_msg = master.recv_match(type="MISSION_ITEM_INT", blocking=True, timeout=remaining)
        if item_msg is None:
            raise SitlError(f"download_mission: không nhận được MISSION_ITEM_INT cho seq={seq}.")
        items.append(
            {
                "seq": item_msg.seq,
                "command": item_msg.command,
                "frame": item_msg.frame,
                "x": item_msg.x,
                "y": item_msg.y,
                "z": item_msg.z,
            }
        )
    master.mav.mission_ack_send(
        master.target_system,
        master.target_component,
        mavutil.mavlink.MAV_MISSION_ACCEPTED,
        mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
    )
    return items


# ---------------------------------------------------------------------------
# Tiện ích cho các runner
# ---------------------------------------------------------------------------


def print_ket_qua(rows: list[tuple[str, str]], *, title: str = "") -> None:
    """In một khối markdown bắt đầu bằng dòng `## KET QUA` để bên gọi parse được."""
    print()
    print("## KET QUA")
    if title:
        print(f"### {title}")
    print("| Mục | Giá trị |")
    print("|---|---|")
    for key, val in rows:
        print(f"| {key} | {val} |")
    print()


def find_latest_bin(search_dirs: Iterable[Path]) -> Path | None:
    candidates: list[Path] = []
    for d in search_dirs:
        d = Path(d)
        if d.is_dir():
            candidates.extend(d.glob("*.BIN"))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)
