#!/usr/bin/env python3
"""Nạp một file `.param` vào FC thật, khởi động lại FC, rồi đọc lại từng dòng (Phase 14.7).

Thay cho chuỗi Mission Planner "Load from file → Write Params → rút cắm cáp → CONNECT lại →
Search từng tham số". Dùng lại đúng hàm nạp và hàm kiểm-sau-reboot của runner SITL Phase 04
(`scripts/sitl/run_param_load.py`), nên mỗi dòng được xếp cùng một kiểu: nhận / chỉ có sau
reboot / không tồn tại / FC tự đổi sau reboot.

Khởi động lại bằng lệnh MAVLink `MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN`, không cần rút cáp. Tham
số chỉ xuất hiện sau reboot (kiểu `RNGFND1_*` sau `RNGFND1_TYPE`) được nạp nốt rồi reboot thêm
để kiểm, tối đa 3 lần.

    uv run --with pyserial python scripts/fc/nap_param.py COM5 \
        firmware/ardupilot/params/01-base.param

Không gửi lệnh ARM hay lệnh motor nào; ArduPilot tự từ chối reboot khi đang ARM. Thử trên
SITL thì chạy trong WSL với `tcp:127.0.0.1:5760`, như `kiem_fc.py`.

Mã thoát 0 = mọi dòng trong file đọc lại đúng giá trị sau lần reboot cuối.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sitl"))

import harness  # noqa: E402
import run_param_load as rpl  # noqa: E402  (hàm nạp + phân loại đã chạy thật trên SITL)
from harness import SitlError  # noqa: E402
from kiem_fc import FcThat, noi_fc  # noqa: E402
from pymavlink import mavutil  # noqa: E402

SO_LAN_REBOOT_TOI_DA = 3
DAT = (rpl.NHAN, rpl.NHAN_SAU_REBOOT)
CMD_REBOOT = mavutil.mavlink.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN


def reboot(fc: FcThat) -> None:
    """Gửi lệnh khởi động lại (param1 = 1) rồi đóng cổng. ArduPilot gửi ACK, ghi nốt tham số
    còn đợi (`AP_Param::flush`), đợi 200 ms rồi mới khởi động lại."""
    m = fc.master
    m.mav.command_long_send(m.target_system, m.target_component, CMD_REBOOT, 0, 1, 0, 0, 0, 0, 0, 0)
    try:
        dk = f"COMMAND_ACK.command=={CMD_REBOOT}"
        ack = fc.recv_match("COMMAND_ACK", condition=dk, timeout=5)
    except OSError:
        ack = None  # cổng USB biến mất trước khi kịp đọc ACK — FC đã khởi động lại
    fc.stop()
    if ack is not None and ack.result != mavutil.mavlink.MAV_RESULT_ACCEPTED:
        raise SitlError(f"FC từ chối reboot (result={ack.result}) — đang ARM?")
    # Nối lại ngay thì còn kịp bắt HEARTBEAT của FC CŨ trong 200 ms trước khi nó reset.
    time.sleep(3.0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ket_noi", help="COMx của FC, hoặc tcp:127.0.0.1:5760 để thử trên SITL")
    ap.add_argument("file_param", type=Path)
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--luu-param", type=Path, help="lưu toàn bộ tham số sau lần reboot cuối")
    args = ap.parse_args()

    ds = harness.read_param_file(args.file_param)
    fc = noi_fc(args.ket_noi, args.baud)
    con_cho_kiem: list[str] = []
    try:
        ket = rpl.nap(fc, fc.fetch_all_params(timeout=120), ds)
        for lan in range(1, SO_LAN_REBOOT_TOI_DA + 1):
            print(f"[nap_param] reboot lần {lan}", flush=True)
            reboot(fc)
            fc = noi_fc(args.ket_noi, args.baud)
            sau = fc.fetch_all_params(timeout=120)
            con_cho_kiem = rpl.kiem_sau_reboot(fc, sau, ket)
            if not con_cho_kiem:
                break
        if args.luu_param:
            harness.write_param_file(
                args.luu_param,
                sau,
                [
                    f"Sau khi nap {args.file_param.name} va reboot {lan} lan.",
                    f"Doc qua {args.ket_noi} boi scripts/fc/nap_param.py, "
                    f"{time.strftime('%d/%m/%Y %H:%M')}.",
                ],
            )
    finally:
        fc.stop()

    rows = [(f"`{ten}` = {bg['yeu_cau']:g}", rpl.mo_ta(bg)) for ten, bg in ket.items()]
    khong_dat = [ten for ten, bg in ket.items() if bg["trang_thai"] not in DAT]
    rows.append(("Số lần reboot", str(lan)))
    rows.append(("Dòng KHÔNG đạt", ", ".join(khong_dat) or "không có"))
    if con_cho_kiem:
        rows.append(("Nạp sau reboot cuối, chưa kiểm lại", ", ".join(con_cho_kiem)))
    rows.append(("SITL từ chối (mốc Phase 11.7)", ", ".join(rpl.KY_VONG_KHONG_NHAN)))
    if args.luu_param:
        rows.append(("Đã lưu tham số", str(args.luu_param)))
    harness.print_ket_qua(rows, title=f"Nạp {args.file_param.name}")
    dat = not khong_dat and not con_cho_kiem
    print("KET QUA:", "PASS" if dat else "FAIL")
    return 0 if dat else 1


if __name__ == "__main__":
    sys.exit(main())
