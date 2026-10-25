#!/usr/bin/env python3
"""Đọc bản đồ công tắc tay cầm từ FC thật: kênh nào đổi chế độ bay, kênh nào ARM (Phase 19.5, 20).

Thay cho việc chụp ảnh tay phát rồi đoán. In cài đặt FC đang giữ (`FLTMODE_CH`,
`FLTMODE1..6`, `RCx_OPTION`, `ARMING_RUDDER`), rồi trong `--giay` giây in một dòng mỗi khi
một kênh nhảy: kênh, giá trị cũ → mới, và FC hiểu vị trí đó là gì. Người vận hành gạt lần lượt
từng công tắc; thứ tự các dòng in ra cho biết công tắc nào nằm ở kênh nào.

Chỉ ĐỌC — không gửi lệnh ARM, lệnh motor hay ghi tham số nào. Chạy khi chỉ cắm USB, KHÔNG cắm
pin: receiver iA6B lấy 5 V từ FC qua USB, còn motor không có điện nên gạt nhầm công tắc ARM cũng
không quay (SAFETY.md).

    uv run --with pyserial python scripts/fc/doc_tay_cam.py COM6
    uv run --with pyserial python scripts/fc/doc_tay_cam.py udpin:0.0.0.0:14550 --giay 120

Ngưỡng lấy từ mã ArduPilot 4.7: công tắc chế độ chia 6 khoảng tại 1230/1360/1490/1620/1749 µs
(`RC_Channel::read_mode_switch`); công tắc chức năng thấp ≤ 1200, cao ≥ 1800
(`AUX_SWITCH_PWM_TRIGGER_LOW/HIGH`). Cả hai đọc PWM thô, không phụ thuộc hiệu chỉnh radio.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sitl"))

from harness import SitlError  # noqa: E402
from kiem_fc import noi_fc  # noqa: E402
from pymavlink import mavutil  # noqa: E402

SO_KENH = 14  # iBUS của iA6B mang 14 kênh
NGUONG_CHE_DO = (1230, 1360, 1490, 1620, 1749)
AUX_THAP, AUX_CAO = 1200, 1800
NHAY_TOI_THIEU = 60  # µs; nhỏ hơn là nhiễu hoặc rung tay, không phải gạt công tắc
TAN_SO_RC_HZ = 10
PIN_CAM_MV = 6000  # chỉ cắm USB thì cảm biến áp pin đọc gần 0; trên ngưỡng này là pin đang cắm
# Vài giá trị RCx_OPTION hay gặp; số khác thì in số, tra bảng RCx_OPTION trong Mission Planner.
TEN_OPTION = {
    3: "Simple mode",
    4: "RTL",
    7: "Save WP",
    11: "Fence",
    16: "Auto",
    18: "Land",
    31: "Motor Emergency Stop",
    41: "ArmDisarm (kiểu cũ)",
    56: "Loiter",
    153: "ArmDisarm",
    154: "ArmDisarm + AirMode",
    165: "Arm / Emergency Motor Stop",
}
OPTION_ARM = {41, 153, 154, 165}


def vi_tri_che_do(pwm: int) -> int:
    """Vị trí 1..6 của công tắc chế độ."""
    return 1 + sum(pwm > n for n in NGUONG_CHE_DO)


def vi_tri_aux(pwm: int) -> str:
    if pwm <= AUX_THAP:
        return "thấp"
    return "cao" if pwm >= AUX_CAO else "giữa"


def y_nghia(kenh: int, pwm: int, ts: dict[str, float]) -> str:
    if kenh == int(ts["FLTMODE_CH"]):
        vt = vi_tri_che_do(pwm)
        so = int(ts[f"FLTMODE{vt}"])
        return f"chế độ vị trí {vt} = {mavutil.mode_mapping_acm.get(so, so)}"
    opt = int(ts.get(f"RC{kenh}_OPTION", 0))
    if opt == 0:
        return "(kênh này chưa gán chức năng trên FC)"
    ten = TEN_OPTION.get(opt, f"option {opt}")
    vt = vi_tri_aux(pwm)
    if opt in OPTION_ARM and vt != "giữa":
        return f"{ten}: {vt} = {'ARM' if vt == 'cao' else 'DISARM'}"
    return f"{ten}: {vt}"


def in_cai_dat(ts: dict[str, float]) -> None:
    ch = int(ts["FLTMODE_CH"])
    print(f"\n=== Cài đặt trên FC ===\nKênh chế độ bay: CH{ch} (FLTMODE_CH)")
    tren = [900, *NGUONG_CHE_DO]
    for i in range(6):
        so = int(ts[f"FLTMODE{i + 1}"])
        khoang = f"{tren[i] + 1}-{NGUONG_CHE_DO[i]}" if i < 5 else f">= {NGUONG_CHE_DO[4] + 1}"
        print(f"  vị trí {i + 1} ({khoang} µs): {mavutil.mode_mapping_acm.get(so, so)}")
    print("Kênh có chức năng (RCx_OPTION khác 0):")
    co = False
    for k in range(1, SO_KENH + 1):
        opt = int(ts.get(f"RC{k}_OPTION", 0))
        if opt:
            co = True
            print(f"  CH{k}: {opt} = {TEN_OPTION.get(opt, '?')}")
    if not co:
        print("  (không có)")
    rudder = int(ts.get("ARMING_RUDDER", 0))
    cach = {0: "tắt", 1: "chỉ ARM", 2: "ARM và DISARM"}.get(rudder, str(rudder))
    print(f"ARM bằng cần (ga hết + yaw phải / yaw trái): ARMING_RUDDER={rudder} ({cach})")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ket_noi", help="COMx (tự dò lại theo USB 1209:xxxx) hoặc udpin:0.0.0.0:14550")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--giay", type=float, default=90.0, help="thời gian theo dõi công tắc")
    args = ap.parse_args()

    try:
        fc = noi_fc(args.ket_noi, args.baud)
    except SitlError as exc:
        print(f"[tay-cam] {exc}", file=sys.stderr)
        return 2
    try:
        ts = fc.fetch_all_params()
        in_cai_dat(ts)
        m = fc.master
        ss = fc.recv_match("SYS_STATUS", timeout=5)
        if ss is not None and ss.voltage_battery > PIN_CAM_MV:
            print(
                f"\n!!! FC đọc {ss.voltage_battery / 1000:.1f} V — PIN ĐANG CẮM. Rút pin trước khi "
                "gạt công tắc: gạt trúng công tắc ARM là motor quay.",
                flush=True,
            )
        m.mav.command_long_send(
            m.target_system, m.target_component,
            mavutil.mavlink.MAV_CMD_SET_MESSAGE_INTERVAL, 0,
            mavutil.mavlink.MAVLINK_MSG_ID_RC_CHANNELS, 1e6 / TAN_SO_RC_HZ, 0, 0, 0, 0, 0,
        )
        print(f"\n=== Theo dõi {args.giay:.0f} s — gạt từng công tắc một ===", flush=True)
        cuoi: dict[int, int] = {}
        thay_doi: dict[int, set[int]] = {}
        che_do_cuoi, arm_cuoi = None, None
        da_in_text: set[str] = set()
        bat_dau = time.monotonic()
        while (t := time.monotonic() - bat_dau) < args.giay:
            msg = m.recv_match(
                type=["RC_CHANNELS", "HEARTBEAT", "STATUSTEXT"], blocking=True, timeout=1
            )
            if msg is None or msg.get_srcSystem() != m.target_system:
                continue
            loai = msg.get_type()
            if loai == "STATUSTEXT":
                if msg.text not in da_in_text:
                    da_in_text.add(msg.text)
                    print(f"[{t:6.1f}s] FC nói: {msg.text}", flush=True)
            elif loai == "HEARTBEAT" and msg.get_srcComponent() == 1:
                che_do = mavutil.mode_mapping_acm.get(msg.custom_mode, msg.custom_mode)
                arm = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
                if (che_do, arm) != (che_do_cuoi, arm_cuoi):
                    trang_thai = "ARMED" if arm else "disarmed"
                    print(f"[{t:6.1f}s] FC đang ở chế độ {che_do}, {trang_thai}", flush=True)
                    che_do_cuoi, arm_cuoi = che_do, arm
            elif loai == "RC_CHANNELS":
                for k in range(1, min(msg.chancount, SO_KENH) + 1):
                    pwm = getattr(msg, f"chan{k}_raw")
                    cu = cuoi.get(k)
                    if cu is None:
                        cuoi[k] = pwm
                        if k == SO_KENH or k == msg.chancount:
                            hien = "  ".join(f"CH{i}={cuoi[i]}" for i in sorted(cuoi))
                            print(f"[{t:6.1f}s] giá trị đầu: {hien}", flush=True)
                        continue
                    if abs(pwm - cu) >= NHAY_TOI_THIEU:
                        nghia = y_nghia(k, pwm, ts)
                        print(f"[{t:6.1f}s] CH{k:<2} {cu} -> {pwm}  {nghia}", flush=True)
                        cuoi[k] = pwm
                        thay_doi.setdefault(k, {cu}).add(pwm)
        print("\n=== Tóm tắt kênh đã nhảy ===")
        if not thay_doi:
            print("  Không kênh nào nhảy — receiver chưa có điện, tay phát tắt, hoặc chưa gạt gì.")
        for k in sorted(thay_doi):
            muc = sorted(thay_doi[k])
            print(f"  CH{k}: {len(muc)} mức {muc}")
        return 0
    finally:
        fc.stop()


if __name__ == "__main__":
    sys.exit(main())
