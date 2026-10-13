"""Đọc log Serial của một ESP32 (tuỳ chọn reset chip trước) — thay cho việc rút cắm cáp.

Chạy:  py -3.13 scripts/esp32/esp32_log.py COM7 --reset --seconds 15
       py -3.13 scripts/esp32/esp32_log.py COM7 --until "WIFI connected" --seconds 30

- `--reset`: kéo EN xuống rồi thả qua RTS (DTR giữ mức "chạy"), giống nút RST.
  Bẫy Windows + usbser.sys (CH343P): đổi RTS một mình KHÔNG tới chip — phải ghi lại DTR ngay
  sau đó, đúng mẹo `_setRTS` của esptool. Thiếu bước này thì reset im lặng không xảy ra.
- `--until TEXT`: dừng ngay khi gặp dòng chứa TEXT (mã thoát 0); hết giờ mà chưa gặp → mã 1.
- Mật khẩu Wi-Fi bị che trước khi in: log boot DroneBridge in `PASS: <mật khẩu>` dạng chữ thường.
"""

from __future__ import annotations

import argparse
import re
import sys
import time

import serial

PASSWORD_PATTERN = re.compile(r"((?:PASS|pass|password|PASSWORD)\s*[:=]\s*)[^\s)]+")
RESET_PULSE_S = 0.1


def redact(line: str) -> str:
    return PASSWORD_PATTERN.sub(r"\1[redacted]", line)


def reset_chip(ser: serial.Serial) -> None:
    ser.dtr = False  # IO0 cao = khởi động bình thường, không vào chế độ nạp
    ser.rts = True  # EN thấp = giữ reset
    ser.dtr = ser.dtr  # usbser.sys chỉ gửi trạng thái RTS khi DTR được ghi lại
    time.sleep(RESET_PULSE_S)
    ser.rts = False
    ser.dtr = ser.dtr


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("port")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--until", default=None)
    args = ap.parse_args()

    # Đặt DTR/RTS TRƯỚC khi mở cổng: mặc định pyserial bật cả hai lúc mở, mạch tự reset của bo
    # coi đó là xung reset -> "chỉ đọc log" cũng làm bo khởi động lại (gặp thật 13/10/2026).
    ser = serial.Serial()
    ser.port = args.port
    ser.baudrate = args.baud
    ser.timeout = 0.2
    ser.dtr = False
    ser.rts = False
    try:
        ser.open()
    except serial.SerialException as exc:
        print(f"Không mở được {args.port}: {exc}", file=sys.stderr)
        return 2
    with ser:
        if args.reset:
            reset_chip(ser)
        deadline = time.monotonic() + args.seconds
        pending = b""
        while time.monotonic() < deadline:
            pending += ser.read(512)
            *lines, pending = pending.split(b"\n")
            for raw in lines:
                line = redact(raw.decode("utf-8", "replace").rstrip("\r"))
                print(line, flush=True)
                if args.until and args.until in line:
                    return 0
        if pending:
            print(redact(pending.decode("utf-8", "replace")), flush=True)
    return 1 if args.until else 0


if __name__ == "__main__":
    sys.exit(main())
