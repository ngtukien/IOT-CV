#!/usr/bin/env python3
"""Đưa FC đang chạy Betaflight vào chế độ DFU qua USB — không cần bấm nút BOOT.

Cách Betaflight Configurator làm khi nạp firmware: gửi lệnh MSP_REBOOT kiểu
"bootloader ROM" (MSP 68, tham số 1). Không ăn thì dùng lệnh `bl` trong CLI Betaflight.
Trước khi ra lệnh, script hỏi tên bo qua MSP và TỪ CHỐI nếu không phải bo mong đợi —
để không bao giờ đưa nhầm một thiết bị khác vào DFU.

Chạy (Windows, bo cắm USB, đang chạy Betaflight):

    uv run --with pyserial python scripts/fc/vao_dfu.py            # tự tìm cổng
    uv run --with pyserial python scripts/fc/vao_dfu.py --port COM7 --bo SPEEDYBEEF405V5

Mã thoát 0 = Windows đã thấy thiết bị DFU (USB VID 0483, PID DF11); 1 = không vào được, cần
bấm BOOT bằng tay (script in cách làm); 2 = sai bo, đã từ chối. Lệnh này không làm motor
quay; bo nằm trên bàn, không pin (SAFETY.md). `nap_dfu.py` gọi lại hàm `dua_vao_dfu`.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time

import serial
from serial.tools import list_ports

BF_VID, BF_PID = 0x0483, 0x5740  # STM32 Virtual COM Port — cổng USB của Betaflight
MSP_FC_VARIANT, MSP_FC_VERSION, MSP_BOARD_INFO, MSP_REBOOT = 2, 3, 4, 68
MSP_REBOOT_BOOTLOADER_ROM = 1
DFU_PNP = "VID_0483&PID_DF11"
HUONG_DAN_BOOT = (
    "Cần bạn làm tay: rút cáp USB khỏi bo; GIỮ nút BOOT (mặt trên, mép trái, ngay dưới chữ "
    "BOOT); vừa giữ vừa cắm lại cáp USB-C; đếm 2 giây rồi thả."
)


class SaiBo(RuntimeError):
    """Thiết bị trả lời MSP không phải bo mong đợi — không được đưa vào DFU."""


class KhongVaoDuocDfu(RuntimeError):
    """Không đưa được bo vào DFU bằng lệnh qua USB; phải bấm BOOT bằng tay."""


def msp_khung(cmd: int, payload: bytes = b"") -> bytes:
    chk = len(payload) ^ cmd
    for b in payload:
        chk ^= b
    return b"$M<" + bytes([len(payload), cmd]) + payload + bytes([chk])


def msp_hoi(ser: serial.Serial, cmd: int, payload: bytes = b"", timeout: float = 1.5) -> bytes:
    ser.reset_input_buffer()
    ser.write(msp_khung(cmd, payload))
    het = time.monotonic() + timeout
    buf = b""
    while time.monotonic() < het:
        buf += ser.read(ser.in_waiting or 1)
        i = buf.find(b"$M>")
        if i >= 0 and len(buf) >= i + 5:
            size, rcmd = buf[i + 3], buf[i + 4]
            end = i + 5 + size + 1
            if len(buf) >= end and rcmd == cmd:
                data = buf[i + 5 : i + 5 + size]
                chk = size ^ rcmd
                for b in data:
                    chk ^= b
                if chk == buf[end - 1]:
                    return data
        if b"$M!" in buf:
            raise RuntimeError(f"FC báo lỗi cho lệnh MSP {cmd}")
    raise TimeoutError(f"Không có trả lời MSP {cmd} sau {timeout} s")


def doc_chuoi(data: bytes, i: int) -> tuple[str, int]:
    n = data[i] if i < len(data) else 0
    return data[i + 1 : i + 1 + n].decode("ascii", "replace"), i + 1 + n


def thong_tin_bo(ser: serial.Serial) -> dict:
    variant = msp_hoi(ser, MSP_FC_VARIANT).decode("ascii", "replace")
    ver = msp_hoi(ser, MSP_FC_VERSION)
    info = msp_hoi(ser, MSP_BOARD_INFO)
    ket = {
        "firmware": f"{variant} {ver[0]}.{ver[1]}.{ver[2]}",
        "ma_bo": info[:4].decode("ascii", "replace"),
    }
    # Sau 4 byte mã bo: u16 phiên bản phần cứng, u8 kiểu bo, u8 khả năng target,
    # rồi chuỗi (độ dài + nội dung): tên target, tên bo, mã hãng.
    i = 8
    ket["target"], i = doc_chuoi(info, i)
    ket["ten_bo"], i = doc_chuoi(info, i)
    ket["hang"], _ = doc_chuoi(info, i)
    return ket


def thay_dfu() -> bool:
    lenh = (
        "Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | "
        f"Where-Object {{ $_.InstanceId -match '{DFU_PNP}' }} | "
        "Select-Object -First 1 -ExpandProperty FriendlyName"
    )
    out = subprocess.run(
        ["powershell", "-NoProfile", "-Command", lenh], capture_output=True, text=True, check=False
    ).stdout.strip()
    if out:
        print(f"Windows thấy thiết bị DFU: {out}")
    return bool(out)


def cho_dfu(giay: float) -> bool:
    het = time.monotonic() + giay
    while time.monotonic() < het:
        if thay_dfu():
            return True
        time.sleep(1.0)
    return False


def tim_cong() -> str:
    for p in list_ports.comports():
        if p.vid == BF_VID and p.pid == BF_PID:
            return p.device
    raise KhongVaoDuocDfu(
        "không thấy cổng Betaflight (USB 0483:5740) — bo chưa cắm, hoặc không chạy Betaflight"
    )


def dua_vao_dfu(port: str | None, bo: str, *, chi_hoi: bool = False) -> dict:
    """Hỏi tên bo qua MSP; khớp `bo` thì ra lệnh vào DFU và đợi Windows thấy thiết bị DFU.
    Trả thông tin bo đọc được (firmware, tên…) để bên gọi biết flash đang chứa gì."""
    port = port or tim_cong()
    try:
        with serial.Serial(port, 115200, timeout=0.2) as ser:
            time.sleep(0.3)
            tt = thong_tin_bo(ser)
            print(f"{port}: {tt}")
            if bo.upper() not in (tt["ten_bo"] + tt["target"]).upper():
                raise SaiBo(f"tên bo không chứa '{bo}': {tt}")
            if chi_hoi:
                return tt
            print("Gửi MSP_REBOOT (bootloader ROM)...")
            ser.write(msp_khung(MSP_REBOOT, bytes([MSP_REBOOT_BOOTLOADER_ROM])))
            ser.flush()
    except (serial.SerialException, TimeoutError) as exc:
        # Cổng bận (Betaflight Configurator / Mission Planner đang mở) hoặc không nói MSP.
        raise KhongVaoDuocDfu(f"{port}: {exc}") from exc
    if cho_dfu(10):
        return tt

    print("MSP không đưa được vào DFU, thử lệnh 'bl' trong CLI Betaflight...")
    try:
        with serial.Serial(port, 115200, timeout=0.5) as ser:
            ser.write(b"#")
            time.sleep(1.0)
            ser.reset_input_buffer()
            ser.write(b"bl\r\n")
            ser.flush()
    except serial.SerialException as exc:
        print(f"Không mở lại được {port}: {exc}")
    if cho_dfu(10):
        return tt
    raise KhongVaoDuocDfu("đã thử MSP_REBOOT và lệnh 'bl', Windows vẫn không thấy thiết bị DFU")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", help="cổng COM của FC; bỏ trống thì tự tìm theo USB 0483:5740")
    ap.add_argument("--bo", default="SPEEDYBEEF405V5", help="tên bo bắt buộc phải khớp")
    ap.add_argument("--chi-hoi", action="store_true", help="chỉ đọc thông tin bo, không vào DFU")
    args = ap.parse_args()

    if thay_dfu():
        print("Bo đã ở sẵn chế độ DFU — không cần làm gì.")
        return 0
    try:
        dua_vao_dfu(args.port, args.bo, chi_hoi=args.chi_hoi)
    except SaiBo as exc:
        print(f"TỪ CHỐI: {exc}. Không vào DFU.")
        return 2
    except KhongVaoDuocDfu as exc:
        print(f"THẤT BẠI: {exc}.\n{HUONG_DAN_BOOT}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
