"""Đọc log Serial của một ESP32 (tuỳ chọn reset chip trước) — thay cho việc rút cắm cáp.

Chạy:  py -3.13 scripts/esp32/esp32_log.py COM7 --reset --seconds 15
       py -3.13 scripts/esp32/esp32_log.py COM7 --until "WIFI connected" --seconds 30

- `--reset`: kéo EN xuống rồi thả qua RTS (DTR giữ mức "chạy"), giống nút RST.
  Bẫy Windows + usbser.sys (CH343P): đổi RTS một mình KHÔNG tới chip — phải ghi lại DTR ngay
  sau đó, đúng mẹo `_setRTS` của esptool. Thiếu bước này thì reset im lặng không xảy ra.
- `--until TEXT`: dừng ngay khi gặp dòng chứa TEXT (mã thoát 0); hết giờ mà chưa gặp → mã 1.
- Mật khẩu Wi-Fi bị che trước khi in: log boot DroneBridge in `PASS: <mật khẩu>` dạng chữ thường.
- Không `--reset` thì bo KHÔNG khởi động lại (DTR/RTS được tắt trước khi mở cổng).
- Mã thoát 3: nhận nhanh hơn mức cổng chở nổi = dữ liệu giả của driver; chạy lại với `--reset`.
"""

from __future__ import annotations

import argparse
import re
import sys
import time

import serial

PASSWORD_PATTERN = re.compile(r"((?:PASS|pass|password|PASSWORD)\s*[:=]\s*)[^\s)]+")
RESET_PULSE_S = 0.1
PLAUSIBLE_SLACK_BYTES = 8192  # bộ đệm của chip USB-UART có thể xả một mạch lúc mới mở cổng


def redact(line: str) -> str:
    return PASSWORD_PATTERN.sub(r"\1[redacted]", line)


def max_plausible_bytes(baud: int, elapsed_s: float) -> float:
    """Số byte tối đa cổng nối tiếp chở nổi (10 bit/byte), cộng biên cho bộ đệm USB."""
    return baud / 10 * elapsed_s * 1.5 + PLAUSIBLE_SLACK_BYTES


def set_rts(ser: serial.Serial, level: bool) -> None:
    """Đặt RTS (nối EN qua mạch tự reset) rồi GHI LẠI DTR mức thấp (IO0 cao = chạy bình thường).

    usbser.sys (CH343P) chỉ đẩy trạng thái RTS xuống chip khi DTR được ghi lại — mẹo `_setRTS`
    của esptool. Setter của pyserial luôn gửi lệnh xuống driver, kể cả khi giá trị không đổi.
    """
    ser.rts = level
    ser.dtr = False


def reset_chip(ser: serial.Serial) -> None:
    set_rts(ser, True)  # EN thấp = giữ reset
    time.sleep(RESET_PULSE_S)
    set_rts(ser, False)


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
        # Bỏ dữ liệu cũ còn kẹt trong driver. 13/10/2026 driver CP210x (COM4) trả lặp một đoạn
        # "ending complete" ~350 KB/s — gấp 30 lần mức 115200 baud chở được — tới khi esptool mở
        # cổng lại. Bo vẫn chạy tốt; dữ liệu là của driver, không phải của bo.
        ser.reset_input_buffer()
        if args.reset:
            reset_chip(ser)
        start = time.monotonic()
        deadline = start + args.seconds
        received = 0
        pending = b""
        while time.monotonic() < deadline:
            chunk = ser.read(512)
            received += len(chunk)
            if received > max_plausible_bytes(args.baud, time.monotonic() - start):
                elapsed = time.monotonic() - start
                print(
                    f"CANH BAO: nhan {received} byte trong {elapsed:.1f} s, nhanh hon"
                    f" muc {args.baud} baud cho duoc -> du lieu gia cua driver, khong phai cua bo."
                    " Chay lai voi --reset (hoac esptool flash-id) de xoa.",
                    file=sys.stderr,
                )
                return 3
            pending += chunk
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
