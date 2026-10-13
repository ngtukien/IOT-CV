#!/usr/bin/env python3
"""Nạp ArduPilot vào FC qua DFU, tới lúc ArduPilot lên cổng COM (Phase 14.3 – 14.4).

Làm lần lượt, hỏng ở đâu dừng ở đó:

1. Bo đang chạy Betaflight → vào DFU bằng lệnh MSP (`vao_dfu.py`), không bấm BOOT.
2. Đọc option byte: RDP phải 0xAA (chip không khoá đọc). Khác → DỪNG, không gỡ khoá:
   gỡ khoá là xoá sạch chip, phải hỏi người dùng trước.
3. Sao lưu 1 MB flash vào ổ D, MỘT lần: đã có bản sao lưu nhà máy thì không đọc lại.
4. Nạp `arducopter_with_bl.hex`, đọc lại so từng byte (`-v`).
5. Ra lệnh chạy từ 0x08000000 thay cho rút cắm cáp.
6. Đợi cổng COM của ArduPilot (USB 1209:5741) đứng yên 8 giây.

    uv run --with pyserial python scripts/fc/nap_dfu.py

Bước nào không tự làm được, script in đúng việc người vận hành phải làm bằng tay rồi thoát
mã khác 0: 1 = lỗi / cần bấm BOOT, 2 = sai bo, 3 = chip khoá đọc, 4 = cần rút cắm cáp.
Không làm motor quay; bo không cắm pin (SAFETY.md). KHÔNG rút cáp trong lúc nạp (bước 4).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
from pathlib import Path

import vao_dfu
from serial.tools import list_ports

REPO = Path(__file__).resolve().parents[2]
CLI = Path(r"D:\IOT_Tools\apps\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe")
HEX_MAC_DINH = REPO / "firmware" / "ardupilot" / "build-d450a747" / "arducopter_with_bl.hex"
THU_MUC_SAO_LUU = Path(r"D:\IOT_Tools\downloads\speedybee-f405v5")
TEN_BO = "SPEEDYBEEF405V5"
FLASH_DAU, FLASH_CO = 0x08000000, 0x100000  # STM32F405: 1 MB flash
# Bo một cổng USB: cả bootloader lẫn firmware ArduPilot đều là 1209:5741
# (get_USB_IDs trong libraries/AP_HAL_ChibiOS/hwdef/scripts/chibios_hwdef.py).
AP_VID = 0x1209
HUONG_DAN_CAM_LAI = (
    "Cần bạn làm tay: rút cáp USB khỏi bo, đợi 2 giây, cắm lại — KHÔNG giữ nút BOOT."
)


class CanLamTay(RuntimeError):
    """Bước này máy không tự làm được; thông báo là việc người vận hành phải làm."""

    def __init__(self, ma: int, thong_bao: str) -> None:
        super().__init__(thong_bao)
        self.ma = ma


def cli(*doi: str, giay: float = 300.0, lan: int = 1) -> str:
    """Chạy STM32_Programmer_CLI trên thiết bị DFU đầu tiên. Có dòng `Error` hoặc mã thoát
    khác 0 là hỏng. `lan` > 1: thử lại sau 2 s (driver DFU có khi chưa sẵn ngay khi Windows
    vừa thấy thiết bị)."""
    lenh = [str(CLI), "-c", "port=USB1", *doi]
    for thu in range(1, lan + 1):
        print("$", " ".join(lenh), flush=True)
        kq = subprocess.run(
            lenh,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=giay,
            check=False,
        )
        ra = kq.stdout + kq.stderr
        dong = [d.strip() for d in ra.splitlines() if d.strip()]
        for d in dong:
            if "\u2588" not in d and "\ufffd" not in d:  # bỏ thanh tiến trình
                print("   ", d)
        loi = [d for d in dong if d.startswith("Error")]
        if kq.returncode == 0 and not loi:
            return ra
        if thu < lan:
            time.sleep(2.0)
    raise RuntimeError(f"STM32_Programmer_CLI {' '.join(doi)}: mã {kq.returncode}, {loi}")


def doc_rdp() -> str | None:
    ra = cli("-ob", "displ", giay=60, lan=3)
    m = re.search(r"RDP\s*:\s*(0x[0-9A-Fa-f]+)", ra)
    return m.group(1).upper().replace("0X", "0x") if m else None


def sao_luu(tt: dict | None) -> Path | None:
    """Đọc toàn bộ flash ra ổ D. Tên file nói rõ đang chứa gì: biết là Betaflight (đọc qua
    MSP trước khi vào DFU) thì `factory-betaflight-<phiên bản>.bin`, không biết thì gắn
    giờ. Đã có bản `factory-*` thì bỏ qua — đó mới là bản cần giữ."""
    THU_MUC_SAO_LUU.mkdir(parents=True, exist_ok=True)
    nha_may = sorted(THU_MUC_SAO_LUU.glob("factory-*.bin"))
    if nha_may:
        print(f"Đã có bản sao lưu nhà máy {nha_may[0]} — không đọc lại.")
        return None
    if tt and tt["firmware"].startswith("BTFL"):
        ten = f"factory-betaflight-{tt['firmware'].split()[1]}.bin"
    else:
        ten = time.strftime("flash-truoc-khi-nap-%Y%m%d-%H%M%S.bin")
    dich = THU_MUC_SAO_LUU / ten
    cli("-u", hex(FLASH_DAU), hex(FLASH_CO), str(dich), giay=300)
    co = dich.stat().st_size if dich.is_file() else 0
    if co != FLASH_CO:
        raise RuntimeError(f"Bản sao lưu {dich} có {co} byte, cần đúng {FLASH_CO}")
    print(f"Đã sao lưu {dich} ({co} byte)")
    return dich


def cong_ardupilot() -> str | None:
    for p in list_ports.comports():
        if p.vid == AP_VID:
            return p.device
    return None


def cho_cong_ardupilot(giay: float, dung_yen: float = 8.0) -> str | None:
    """Đợi cổng 1209:xxxx xuất hiện và còn nguyên `dung_yen` giây — bootloader ArduPilot
    cũng dùng mã USB đó, rồi nhường chỗ cho firmware."""
    het = time.monotonic() + giay
    thay_tu: float | None = None
    while time.monotonic() < het:
        cong = cong_ardupilot()
        if cong is None:
            thay_tu = None
        elif thay_tu is None:
            thay_tu = time.monotonic()
        elif time.monotonic() - thay_tu >= dung_yen:
            return cong
        time.sleep(0.5)
    return None


def chay(file_hex: Path) -> str:
    for f in (CLI, file_hex):
        if not f.is_file():
            raise RuntimeError(f"Không thấy {f}")

    tt = None
    if vao_dfu.thay_dfu():
        print("Bo đã ở sẵn DFU — không biết flash đang chứa gì.")
    else:
        tt = vao_dfu.dua_vao_dfu(None, TEN_BO)
    time.sleep(2.0)

    rdp = doc_rdp()
    print(f"RDP = {rdp}")
    if rdp != "0xAA":
        raise CanLamTay(
            3,
            f"DỪNG: RDP = {rdp}, chip đang khoá đọc (hoặc không đọc được). Không sao lưu và "
            "không nạp được khi còn khoá; gỡ khoá sẽ XOÁ SẠCH chip — cần bạn quyết.",
        )

    sao_luu(tt)

    ra = cli("-w", str(file_hex), "-v", giay=600)
    if "Download verified successfully" not in ra:
        raise RuntimeError("Nạp xong mà không thấy 'Download verified successfully'")

    try:
        cli("-s", hex(FLASH_DAU), giay=60)
    except RuntimeError as exc:
        print(f"Lệnh chạy không ăn ({exc}) — đợi xem bo có tự lên không.")

    cong = cho_cong_ardupilot(45)
    if cong is None:
        con_dfu = vao_dfu.thay_dfu()
        raise CanLamTay(
            4,
            "Nạp và đọc lại đã ĐÚNG, nhưng ArduPilot chưa lên cổng COM sau 45 s"
            f"{' (bo vẫn ở DFU)' if con_dfu else ''}. {HUONG_DAN_CAM_LAI}",
        )
    return cong


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--hex", type=Path, default=HEX_MAC_DINH, help="file *_with_bl.hex để nạp")
    args = ap.parse_args()
    try:
        cong = chay(args.hex)
    except vao_dfu.SaiBo as exc:
        print(f"TỪ CHỐI: {exc}. Không vào DFU.")
        return 2
    except vao_dfu.KhongVaoDuocDfu as exc:
        print(f"THẤT BẠI: {exc}.\n{vao_dfu.HUONG_DAN_BOOT}")
        return 1
    except CanLamTay as exc:
        print(exc)
        return exc.ma
    print(f"KET QUA: PASS — ArduPilot đã lên {cong}. Bước sau: scripts/fc/kiem_fc.py {cong}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
