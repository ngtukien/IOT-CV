#!/usr/bin/env python3
"""Runner Phase 07 (việc 7.6.3 + 7.6.5) — ĐO, không đoán, dữ liệu proximity thật.

Phase 07 cần bốn sự thật về SITL trước khi viết `backend/mavlink/proximity.py`:

1. Bit nào trong `SYS_STATUS` báo rangefinder khoẻ, và nó có thật sự được
   bật trong `onboard_control_sensors_present` không. (Bài học Phase 05: plan
   từng đoán sai bit AHRS; `ekf_ok` suýt thành LUÔN False.)
2. `DISTANCE_SENSOR` tới với những `(id, orientation)` nào — chỉ một tia TFmini,
   hay proximity còn phát thêm 8 cung.
3. `OBSTACLE_DISTANCE` (id 330) có tới không.
4. Chuỗi `STATUSTEXT` chính xác ArduCopter phát khi AVOID phanh.

Dùng lại nguyên cấu hình của Phase 04 (`run_avoid_brake.py`): file param dự án,
TFmini Plus ảo trên SERIAL3, lưới cột ảo. Bay hai chặng về phía cột:
LOITER (AC_Avoid chạy) rồi GUIDED (AC_Avoid KHÔNG chạy, OA_TYPE=0).

Kết quả:
    logs/statustext-sitl.txt                  toàn bộ STATUSTEXT, có mốc thời gian
    <run_dir>/proximity-probe/ket-qua.json    tóm tắt bốn câu hỏi trên

CHẠY TRONG WSL:
    ~/venv-ardupilot/bin/python3 scripts/sitl/run_proximity_probe.py

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import collections
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
import run_avoid_brake as avoid  # noqa: E402
from harness import SitlError, SitlInstance, print_ket_qua  # noqa: E402

USE_DIR = "proximity-probe"
STATUSTEXT_FILE = harness.REPO_ROOT / "logs" / "statustext-sitl.txt"
CHANG_S = 25.0  # mỗi chặng bay bao nhiêu giây thật


def _bit_names() -> dict[int, str]:
    from pymavlink import mavutil

    enum = mavutil.mavlink.enums["MAV_SYS_STATUS_SENSOR"]
    return {k: v.name for k, v in enum.items() if k and (k & (k - 1)) == 0}


class BoDo:
    def __init__(self) -> None:
        self.dem: collections.Counter[str] = collections.Counter()
        self.ds: dict[str, dict] = {}
        self.od: list[dict] = []
        self.sys: list[tuple[int, int, int]] = []
        self.st: list[str] = []
        self.chang = "chuan-bi"
        self.t0 = time.monotonic()

    def nhan(self, m) -> None:
        loai = m.get_type()
        self.dem[f"{self.chang}:{loai}"] += 1
        if loai == "DISTANCE_SENSOR":
            k = f"id={m.id} orient={m.orientation}"
            rec = self.ds.setdefault(
                k,
                {"n": 0, "min_cm": m.min_distance, "max_cm": m.max_distance, "gia_tri_cm": []},
            )
            rec["n"] += 1
            if len(rec["gia_tri_cm"]) < 400:
                rec["gia_tri_cm"].append(m.current_distance)
        elif loai == "OBSTACLE_DISTANCE" and len(self.od) < 20:
            self.od.append(
                {
                    "increment": m.increment,
                    "angle_offset": getattr(m, "angle_offset", None),
                    "min_cm": m.min_distance,
                    "max_cm": m.max_distance,
                    "khac_65535": [(i, d) for i, d in enumerate(m.distances) if d != 65535][:10],
                }
            )
        elif loai == "SYS_STATUS":
            self.sys.append(
                (
                    m.onboard_control_sensors_present,
                    m.onboard_control_sensors_enabled,
                    m.onboard_control_sensors_health,
                )
            )
        elif loai == "STATUSTEXT":
            t = time.monotonic() - self.t0
            self.st.append(f"{t:8.2f}  [{self.chang}] sev={m.severity} {m.text}")


def bay(sitl: SitlInstance, do: BoDo, chang: str, mode: str) -> None:
    do.chang = chang
    sitl.set_mode(mode)
    giua = {1: 1500, 2: 1500, 3: 1500, 4: 1500}
    tien = {**giua, 2: avoid.PWM_TIEN}
    het = time.monotonic() + CHANG_S
    gui = 0.0
    while time.monotonic() < het:
        if time.monotonic() - gui > 0.2:
            if mode == "LOITER":
                sitl.rc_override(tien)
            else:
                # GUIDED: tiến 1 m/s về phía bắc bằng velocity — đúng kiểu lệnh
                # backend gửi, để thấy AC_Avoid có phanh ở GUIDED không.
                sitl.master.mav.set_position_target_local_ned_send(
                    0,
                    sitl.master.target_system,
                    sitl.master.target_component,
                    1,
                    0x0DC7,
                    0,
                    0,
                    0,
                    1.0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                )
            gui = time.monotonic()
        m = sitl.master.recv_match(blocking=True, timeout=0.2)
        if m is not None:
            do.nhan(m)
    sitl.rc_override(giua)


def tom_tat_sys(sys_rows: list[tuple[int, int, int]]) -> dict:
    ten = _bit_names()
    if not sys_rows:
        return {"loi": "không nhận SYS_STATUS nào"}
    p, e, h = sys_rows[-1]
    luon_khoe = ~0
    tung_hong = 0
    for _, _, hh in sys_rows:
        luon_khoe &= hh
        tung_hong |= ~hh
    ket = {}
    for bit, name in sorted(ten.items()):
        if "LASER" in name or "PROXIMITY" in name or "SONAR" in name or "RANGE" in name:
            ket[name] = {
                "bit": hex(bit),
                "present": bool(p & bit),
                "enabled": bool(e & bit),
                "healthy_cuoi": bool(h & bit),
                "tung_hong": bool(tung_hong & bit),
            }
    return ket


def main() -> int:
    d = harness.run_dir(USE_DIR)
    param = dict(harness.read_param_file(avoid.AVOID_FILE))
    param.update(avoid.SITL_THAY_PARAM)
    thieu = avoid.ap_dung(d, param)
    do = BoDo()
    with SitlInstance(d, speedup=1, wipe_eeprom=False, extra_args=avoid.extra_args()) as sitl:
        sitl.wait_ready(timeout=150)
        sitl.set_mode("GUIDED")
        sitl.arm()
        sitl.takeoff(avoid.DO_CAO_BAY_M)
        bay(sitl, do, "loiter", "LOITER")
        bay(sitl, do, "guided", "GUIDED")
        sitl.set_mode("LAND")
    STATUSTEXT_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATUSTEXT_FILE.write_text("\n".join(do.st) + "\n", encoding="utf-8")
    ket = {
        "khong_ton_tai": thieu,
        "dem_goi": dict(sorted(do.dem.items())),
        "distance_sensor": {
            k: {**v, "gia_tri_cm": sorted(set(v["gia_tri_cm"]))[:40]} for k, v in do.ds.items()
        },
        "obstacle_distance": do.od,
        "sys_status_bits": tom_tat_sys(do.sys),
        "statustext_so_dong": len(do.st),
    }
    (d / "ket-qua.json").write_text(json.dumps(ket, ensure_ascii=False, indent=2), encoding="utf-8")
    print_ket_qua(
        [(k, json.dumps(v, ensure_ascii=False)[:600]) for k, v in ket.items()],
        title="Proximity trên SITL (Phase 07, việc 7.6)",
    )
    print(f"STATUSTEXT -> {STATUSTEXT_FILE}")
    print(f"JSON -> {d / 'ket-qua.json'}")
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
