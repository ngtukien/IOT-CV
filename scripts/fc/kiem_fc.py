#!/usr/bin/env python3
"""Kiểm FC SpeedyBee F405 V5 ngay sau khi nạp ArduPilot (Phase 14, mục 14.5 – 14.6).

Thay cho việc bấm tay trong Mission Planner. Đọc qua USB, KHÔNG gửi lệnh ARM hay
lệnh motor nào — an toàn khi bo nằm trên bàn, không pin (SAFETY.md).

Chạy (máy Windows, bo cắm USB, KHÔNG giữ nút BOOT):

    uv run --with pyserial python scripts/fc/kiem_fc.py COM5
    uv run --with pyserial python scripts/fc/kiem_fc.py COM5 --nghieng 20
    uv run --with pyserial python scripts/fc/kiem_fc.py COM5 \
        --luu-param firmware/ardupilot/params/00-after-flash.param

`--with pyserial`: môi trường của dự án chưa có pyserial, mà pymavlink cần nó để mở
cổng COM. Thử trên SITL thì chạy trong WSL bằng `~/venv-ardupilot/bin/python3` với
`tcp:127.0.0.1:5760` (sandbox của agent chặn tiến trình Windows mở socket TCP). Trên
SITL vài mục FAIL đúng như dự kiến: tên bo khác, không có `AVOID_ANG_MAX` và
`SERVO_BLH_*`, không ai nghiêng drone ảo — đã chạy thử 12/10/2026.

Mã thoát 0 = mọi mục bắt buộc PASS.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sitl"))

import harness  # noqa: E402  (dùng lại hàm đọc/ghi tham số đã chạy thật trên SITL)
from harness import SitlError, SitlInstance  # noqa: E402
from pymavlink import mavutil  # noqa: E402

PHIEN_BAN = "ArduCopter V4.7.1 (dbe79216)"
TEN_BO = "speedybeef4v5"
# Có mặt = đúng bản custom build d450a747 (firmware/ardupilot/build-d450a747/NOTES.md).
THAM_SO_CUSTOM = [
    "PRX1_TYPE",
    "RNGFND1_TYPE",
    "AVOID_ENABLE",
    "AVOID_ANG_MAX",
    "SERVO_BLH_POLES",
]
# Áp suất hợp lý ở mặt đất (hPa). Ngoài khoảng này là baro đọc rác.
AP_SUAT_MIN, AP_SUAT_MAX = 850.0, 1100.0
GOC_NGHIENG_DO = 15.0  # nghiêng tay ít nhất chừng này mới tính là đã thử
CMD_DO_SEND_BANNER = 42428
CAM_BIEN = {
    "gyro": mavutil.mavlink.MAV_SYS_STATUS_SENSOR_3D_GYRO,
    "accel": mavutil.mavlink.MAV_SYS_STATUS_SENSOR_3D_ACCEL,
    "baro": mavutil.mavlink.MAV_SYS_STATUS_SENSOR_ABSOLUTE_PRESSURE,
}


class FcThat(SitlInstance):
    """FC thật qua một chuỗi kết nối pymavlink (COMx hoặc tcp:...). Kế thừa
    SitlInstance để dùng lại recv_match / fetch_all_params, nhưng không khởi động
    hay tắt SITL nào."""

    def __init__(self, ket_noi: str, baud: int) -> None:
        super().__init__(Path("."), wipe_eeprom=False)
        self.ket_noi = ket_noi
        self.baud = baud

    def start(self) -> None:
        m = mavutil.mavlink_connection(self.ket_noi, baud=self.baud, source_system=255)
        if m.wait_heartbeat(timeout=20) is None:
            raise SitlError(
                f"Không có HEARTBEAT từ {self.ket_noi} sau 20 s — "
                "sai cổng COM, hoặc bo còn ở chế độ DFU."
            )
        self.master = m
        m.mav.request_data_stream_send(
            m.target_system, m.target_component, mavutil.mavlink.MAV_DATA_STREAM_ALL, 4, 1
        )

    def stop(self) -> None:
        if self.master is not None:
            self.master.close()


def doc_banner(fc: FcThat, giay: float = 4.0) -> list[str]:
    m = fc.master
    m.mav.command_long_send(
        m.target_system, m.target_component, CMD_DO_SEND_BANNER, 0, 0, 0, 0, 0, 0, 0, 0
    )
    het = time.monotonic() + giay
    while time.monotonic() < het:
        fc.recv_match("STATUSTEXT", timeout=max(0.1, het - time.monotonic()))
    return list(fc.statustext_log)


def doc_cam_bien(fc: FcThat) -> dict:
    ss = fc.recv_match("SYS_STATUS", timeout=10)
    sp = fc.recv_match("SCALED_PRESSURE", timeout=10)
    ket = {"ap_suat_hpa": round(sp.press_abs, 1) if sp else None}
    for ten, bit in CAM_BIEN.items():
        if ss is None:
            ket[ten] = None
            continue
        ket[ten] = {
            "co": bool(ss.onboard_control_sensors_present & bit),
            "tot": bool(ss.onboard_control_sensors_health & bit),
        }
    return ket


def theo_doi_nghieng(fc: FcThat, giay: float) -> tuple[float, float, float, float]:
    print(
        f"\n>>> {giay:.0f} giây: mũi tên trên bo chỉ RA XA bạn. "
        "Chúc mũi tên XUỐNG, rồi hạ cạnh PHẢI xuống."
    )
    rmin = rmax = pmin = pmax = 0.0
    het = time.monotonic() + giay
    lan_in = 0.0
    while time.monotonic() < het:
        a = fc.recv_match("ATTITUDE", timeout=1.0)
        if a is None:
            continue
        r, p = a.roll * 57.2958, a.pitch * 57.2958
        rmin, rmax, pmin, pmax = min(rmin, r), max(rmax, r), min(pmin, p), max(pmax, p)
        if time.monotonic() - lan_in > 0.5:
            print(f"    roll {r:+6.1f}°   pitch {p:+6.1f}°", flush=True)
            lan_in = time.monotonic()
    return rmin, rmax, pmin, pmax


def kq(dat: bool, chi_tiet: str) -> str:
    return f"{'PASS' if dat else 'FAIL'} — {chi_tiet}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ket_noi", help="COMx của FC, hoặc tcp:127.0.0.1:5760 để thử trên SITL")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument(
        "--nghieng",
        type=float,
        default=0.0,
        help="số giây theo dõi khi nghiêng bo bằng tay (0 = bỏ qua)",
    )
    ap.add_argument(
        "--luu-param", type=Path, help="lưu toàn bộ tham số ra file kiểu Mission Planner"
    )
    args = ap.parse_args()

    fc = FcThat(args.ket_noi, args.baud)
    fc.start()
    rows: list[tuple[str, str]] = []
    dat = True
    try:
        banner = doc_banner(fc)
        co_phien_ban = any(PHIEN_BAN in t for t in banner)
        dong_ten_bo = next((t for t in banner if t.startswith(TEN_BO)), None)
        co_ten_bo = dong_ten_bo is not None
        dat &= co_phien_ban and co_ten_bo
        rows.append(("Banner phiên bản", kq(co_phien_ban, f"cần '{PHIEN_BAN}'")))
        rows.append(("Banner tên bo", kq(co_ten_bo, f"cần dòng bắt đầu '{TEN_BO}'")))

        params = fc.fetch_all_params(timeout=120)
        thieu = [t for t in THAM_SO_CUSTOM if t not in params]
        dat &= not thieu
        rows.append(("Tham số bản custom", kq(not thieu, f"thiếu: {', '.join(thieu) or 'không'}")))
        rows.append(("Số tham số đọc được", str(len(params))))

        cb = doc_cam_bien(fc)
        for ten in CAM_BIEN:
            v = cb[ten]
            ok = bool(v and v["co"] and v["tot"])
            dat &= ok
            rows.append((f"Cảm biến {ten}", kq(ok, str(v))))
        p = cb["ap_suat_hpa"]
        ok_p = p is not None and AP_SUAT_MIN <= p <= AP_SUAT_MAX
        dat &= ok_p
        rows.append(("press_abs", kq(ok_p, f"{p} hPa (cần {AP_SUAT_MIN:.0f}–{AP_SUAT_MAX:.0f})")))

        if args.nghieng > 0:
            _rmin, rmax, pmin, _pmax = theo_doi_nghieng(fc, args.nghieng)
            ok_n = pmin <= -GOC_NGHIENG_DO and rmax >= GOC_NGHIENG_DO
            dat &= ok_n
            yeu_cau = f"cần ≤ −{GOC_NGHIENG_DO:.0f}° và ≥ +{GOC_NGHIENG_DO:.0f}°"
            chi_tiet = f"pitch nhỏ nhất {pmin:+.0f}°, roll lớn nhất {rmax:+.0f}° ({yeu_cau})"
            rows.append(("Hướng gyro", kq(ok_n, chi_tiet)))

        if args.luu_param:
            harness.write_param_file(
                args.luu_param,
                params,
                [
                    "00 - snapshot ngay sau khi nap firmware, TRUOC khi sua bat ky tham so nao.",
                    f"Banner bo: {dong_ten_bo or 'KHONG thay ' + TEN_BO}. "
                    f"Doc qua {args.ket_noi} boi scripts/fc/kiem_fc.py, "
                    f"{time.strftime('%d/%m/%Y %H:%M')}.",
                ],
            )
            rows.append(("Đã lưu tham số", str(args.luu_param)))

        tu_khoa = ("baro", "config error", "fail", "error")
        canh_bao = [t for t in fc.statustext_log if any(k in t.lower() for k in tu_khoa)]
        rows.append(("STATUSTEXT đáng chú ý", "; ".join(canh_bao[-8:]) or "(không có)"))
    finally:
        fc.stop()

    harness.print_ket_qua(rows, title="Kiểm FC sau khi nạp")
    print("KET QUA:", "PASS" if dat else "FAIL")
    return 0 if dat else 1


if __name__ == "__main__":
    sys.exit(main())
