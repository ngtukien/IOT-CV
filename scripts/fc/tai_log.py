#!/usr/bin/env python3
"""Tải log dataflash `.bin` từ FC thật qua MAVLink (thay "DataFlash Logs → Download" của MP).

Liệt kê log trên FC (`LOG_REQUEST_LIST`), tải log mới nhất, các số `--id` chỉ định, hoặc
`--tat-ca` (`LOG_REQUEST_DATA`); đoạn nào rớt thì xin lại đúng đoạn đó. Lưu vào
`logs/fc-dataflash-<ngày>/<số>-<giờ UTC hoặc khong-gio>.bin`; không ghi đè file đã có — số log
đánh lại từ 1 sau mỗi lần xoá chip, nên tải lần hai trong ngày thì đưa `--thu-muc` khác.

    uv run --with pyserial python scripts/fc/tai_log.py COM6            # log mới nhất
    uv run --with pyserial python scripts/fc/tai_log.py COM6 --liet-ke  # chỉ liệt kê
    uv run --with pyserial python scripts/fc/tai_log.py COM6 --id 3 4
    uv run --with pyserial python scripts/fc/tai_log.py COM6 --tat-ca --thu-muc logs/x

Qua USB nhanh; qua Wi-Fi chậm và hay rớt, nên dùng USB. Không gửi lệnh ARM, motor hay xoá
log nào. `LOG_DISARMED=0` thì mỗi lần ARM là một log mới, kể cả arm thử không cất cánh.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import UTC, date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sitl"))

from harness import SitlError  # noqa: E402
from kiem_fc import noi_fc  # noqa: E402

GOC_REPO = Path(__file__).resolve().parents[2]
CO_DOAN = 90  # byte dữ liệu trong một gói LOG_DATA
IM_LANG_XIN_LAI_S = 1.0  # im chừng này mà còn thiếu đoạn thì xin lại phần thiếu
GIOI_HAN_XIN_LAI = 50


def liet_ke(m, giay: float = 5.0) -> dict[int, tuple[int, int]]:
    """{số log: (kích thước byte, time_utc)}. FC không có GPS thì time_utc = 0."""
    m.mav.log_request_list_send(m.target_system, m.target_component, 0, 0xFFFF)
    ds: dict[int, tuple[int, int]] = {}
    tong = None
    het = time.monotonic() + giay
    while time.monotonic() < het and (tong is None or len(ds) < tong):
        msg = m.recv_match(type="LOG_ENTRY", blocking=True, timeout=1)
        if msg is None:
            continue
        tong = msg.num_logs
        if msg.num_logs and msg.size:
            ds[msg.id] = (msg.size, msg.time_utc)
    return ds


def ten_file(so: int, time_utc: int) -> str:
    if time_utc:
        gio = datetime.fromtimestamp(time_utc, tz=UTC).strftime("%Y%m%d-%H%M%S")
    else:
        gio = "khong-gio"
    return f"{so:03d}-{gio}.bin"


def tai_mot(m, so: int, kich_thuoc: int) -> bytes:
    buf = bytearray(kich_thuoc)
    so_doan = (kich_thuoc + CO_DOAN - 1) // CO_DOAN
    da_co: set[int] = set()
    m.mav.log_request_data_send(m.target_system, m.target_component, so, 0, 0xFFFFFFFF)
    lan_xin_lai = 0
    cuoi = time.monotonic()
    bat_dau = cuoi
    while len(da_co) < so_doan:
        msg = m.recv_match(type="LOG_DATA", blocking=True, timeout=0.2)
        if msg is not None and msg.id == so and msg.count:
            buf[msg.ofs : msg.ofs + msg.count] = bytes(msg.data[: msg.count])
            da_co.add(msg.ofs // CO_DOAN)
            cuoi = time.monotonic()
            continue
        if time.monotonic() - cuoi < IM_LANG_XIN_LAI_S:
            continue
        lan_xin_lai += 1
        if lan_xin_lai > GIOI_HAN_XIN_LAI:
            thieu_con = so_doan - len(da_co)
            raise SitlError(
                f"log {so}: còn thiếu {thieu_con} đoạn sau {GIOI_HAN_XIN_LAI} lần xin lại"
            )
        thieu = next(i for i in range(so_doan) if i not in da_co)
        het_thieu = thieu
        while het_thieu + 1 < so_doan and het_thieu + 1 not in da_co:
            het_thieu += 1
        m.mav.log_request_data_send(
            m.target_system, m.target_component, so,
            thieu * CO_DOAN, (het_thieu - thieu + 1) * CO_DOAN,
        )
        cuoi = time.monotonic()
    m.mav.log_request_end_send(m.target_system, m.target_component)
    giay = time.monotonic() - bat_dau
    print(
        f"[tai_log] log {so}: {kich_thuoc} byte, {giay:.1f} s, xin lại {lan_xin_lai} lần",
        flush=True,
    )
    return bytes(buf)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ket_noi", help="COMx của FC (tự dò lại theo USB 1209:xxxx)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--id", type=int, nargs="*", help="số log cần tải; bỏ trống = log mới nhất")
    ap.add_argument("--tat-ca", action="store_true", help="tải mọi log đang có trên FC")
    ap.add_argument("--liet-ke", action="store_true", help="chỉ liệt kê log trên FC")
    ap.add_argument("--thu-muc", type=Path, help="mặc định logs/fc-dataflash-<hôm nay>/")
    args = ap.parse_args()

    thu_muc = args.thu_muc or GOC_REPO / "logs" / f"fc-dataflash-{date.today():%Y%m%d}"
    try:
        fc = noi_fc(args.ket_noi, args.baud)
    except SitlError as exc:
        print(f"[tai_log] {exc}", file=sys.stderr)
        return 2
    try:
        m = fc.master
        ds = liet_ke(m)
        if not ds:
            print("[tai_log] FC không có log nào", flush=True)
            return 1
        for so in sorted(ds):
            kt, tu = ds[so]
            print(f"  log {so:3d}: {kt / 1024:8.1f} KB  {ten_file(so, tu)}", flush=True)
        if args.liet_ke:
            return 0
        can_tai = sorted(ds) if args.tat_ca else (args.id or [max(ds)])
        thu_muc.mkdir(parents=True, exist_ok=True)
        for so in can_tai:
            if so not in ds:
                raise SitlError(f"FC không có log {so}")
            dich = thu_muc / ten_file(so, ds[so][1])
            if dich.exists():
                raise SitlError(f"{dich} đã có — không ghi đè; đổi tên hoặc dùng --thu-muc khác")
            dich.write_bytes(tai_mot(m, so, ds[so][0]))
            print(f"[tai_log] đã lưu {dich}", flush=True)
        return 0
    except SitlError as exc:
        print(f"[tai_log] {exc}", file=sys.stderr)
        return 1
    finally:
        fc.stop()


if __name__ == "__main__":
    sys.exit(main())
