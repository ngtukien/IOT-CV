#!/usr/bin/env python3
"""Runner Phase 07 §7.11 bài 5 — backend thấy AVOID đúng như FC làm.

Dựng lại đúng cảnh của Phase 04 (`run_avoid_brake.py`: file param dự án, TFmini
Plus ảo trên SERIAL3, lưới cột ảo), nhưng lần này BACKEND nghe cùng lúc qua cổng
SERIAL2 (tcp:5763) và phía Windows ghi `avoid_state` theo thời gian. Runner chỉ
bay và in MỐC THỜI GIAN (epoch) của từng chặng để hai bên đối chiếu:

    PHASE loiter <epoch>   LOITER, giữ cần tiến về cột — AC_Avoid PHẢI phanh
    PHASE guided <epoch>   GUIDED, velocity tiến 0,5 m/s — AC_Avoid KHÔNG chạy
                           (OA_TYPE=0), backend không được báo ACTIVE
    PHASE end <epoch>

CHẠY TRONG WSL (backend chạy trước với MAVLINK_ENDPOINT=tcp:127.0.0.1:5763):
    ~/venv-ardupilot/bin/python3 scripts/sitl/run_backend_avoid.py

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
import run_avoid_brake as avoid  # noqa: E402
from harness import SitlError, SitlInstance  # noqa: E402

USE_DIR = "backend-avoid"
LOITER_S = 35.0
GUIDED_S = 15.0
GUIDED_VX = 0.5  # m/s, tiến theo mũi


def moc(ten: str) -> None:
    print(f"PHASE {ten} {time.time():.3f}", flush=True)


def main() -> int:
    d = harness.run_dir(USE_DIR)
    param = dict(harness.read_param_file(avoid.AVOID_FILE))
    param.update(avoid.SITL_THAY_PARAM)
    thieu = avoid.ap_dung(d, param)
    print(f"Tham số không tồn tại (đã biết): {thieu}", flush=True)
    with SitlInstance(d, speedup=1, wipe_eeprom=False, extra_args=avoid.extra_args()) as sitl:
        sitl.wait_ready(timeout=150)
        sitl.set_mode("GUIDED")
        sitl.arm()
        sitl.takeoff(avoid.DO_CAO_BAY_M)
        moc("ready")
        time.sleep(5)  # để backend thấy vài giây OFF trước khi tiến

        sitl.set_mode("LOITER")
        moc("loiter")
        giua = {1: 1500, 2: 1500, 3: 1500, 4: 1500}
        tien = {**giua, 2: avoid.PWM_TIEN}
        het = time.monotonic() + LOITER_S
        while time.monotonic() < het:
            sitl.rc_override(tien)
            time.sleep(0.2)
        sitl.rc_override(giua)

        sitl.set_mode("GUIDED")
        moc("guided")
        het = time.monotonic() + GUIDED_S
        while time.monotonic() < het:
            sitl.master.mav.set_position_target_local_ned_send(
                0,
                sitl.master.target_system,
                sitl.master.target_component,
                9,
                0x0DC7,
                0,
                0,
                0,
                GUIDED_VX,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
            )  # frame 9 = BODY_OFFSET_NED, giống hệt lệnh backend gửi
            time.sleep(0.2)
        moc("end")
        sitl.set_mode("LAND")
        time.sleep(3)
    print("KET QUA: PASS (runner chỉ bay; phán quyết nằm ở phía backend)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
