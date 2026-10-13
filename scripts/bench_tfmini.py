"""Doc TFmini Plus qua USB-TTL de kiem tra cam bien truoc khi cam vao bo bay (plans/phase-12 §12.7).

Chay:  py -3.13 scripts/bench_tfmini.py COM5        (Ctrl+C de dung)

Ket qua dung: dong chu chay lien tuc ~100 dong/giay, cot ok tang deu,
cot bad gan nhu dung yen. Che tay truoc ong kinh -> dist tut xuong vai chuc cm.

Neu KHONG ra dong nao:
  Cam bien dang o che do Pixhawk (chuoi ky tu) thay vi Standard 9 byte.
  Gui lenh HEX  5A 05 05 01 65  (ep ve Standard 9 bytes)
  roi           5A 04 11 6F     (LUU cai dat)
  roi cap nguon lai.
Neu bad tang bang ok: sai baud, hoac GND khong chung.
Neu bao "khong mo duoc cong": sai so COM.
  Xem lai bang  Get-CimInstance Win32_SerialPort | Format-Table Name, Description

Kiem "con song" bang mat: cap nguon 5V -> nhin THANG vao ong kinh PHAT -> phai thay DEN DO mo.
Khong co den do = cam bien chet, doi tra ngay.

Bo lenh HEX (checksum da kiem, nguon: SJ-PM-TFmini Plus A04 Product Manual muc 6.4):
  5A 04 01 5F      doc firmware version  -> tra ve 5A 07 01 V1 V2 V3 SU
  5A 04 10 6E      khoi phuc cai dat goc (115200 / UART / Standard 9 byte / 100Hz)
  5A 04 11 6F      LUU cai dat   <-- BAT BUOC gui sau moi lenh thay doi
  5A 05 05 01 65   ep ve Standard 9 bytes (cm)  <-- dinh dang ArduPilot can
  5A 05 05 02 66   Pixhawk mode (chuoi ky tu)   <-- ArduPilot >= 3.6.2 KHONG doc duoc
  5A 05 0A 00 69   chuyen ve UART      |    5A 05 0A 01 6A   chuyen sang I2C

AN TOAN: TFmini Plus KHONG co bao ve qua ap va dau nguoc cuc, chi chiu +-0,5 V.
Do lai tung day bang dong ho van nang truoc khi cap dien lan dau - dung tin mau day.
"""

from __future__ import annotations

import sys

import serial

BAUD = 115200
HEADER = 0x59
BODY_LEN = 7  # 2 byte dist + 2 byte strength + 2 byte temp + 1 byte checksum


def parse_body(body: bytes) -> tuple[int, int, float, bool]:
    """7 byte sau cap 0x59 0x59 -> (dist cm, strength, nhiet do C, checksum dung?)."""
    dist = body[0] | (body[1] << 8)
    strength = body[2] | (body[3] << 8)
    temp_raw = body[4] | (body[5] << 8)
    checksum = (HEADER + HEADER + sum(body[:6])) & 0xFF
    return dist, strength, temp_raw / 8.0 - 256, checksum == body[6]


def main() -> int:
    port = sys.argv[1] if len(sys.argv) > 1 else "COM5"
    try:
        ser = serial.Serial(port, BAUD, timeout=1)
    except serial.SerialException as exc:
        print(f"Khong mo duoc cong {port}: {exc}", file=sys.stderr)
        print(
            "Xem so COM: Get-CimInstance Win32_SerialPort | Format-Table Name, Description",
            file=sys.stderr,
        )
        return 2
    ok_count = bad_count = 0
    with ser:
        while True:
            if ser.read(1) != bytes([HEADER]) or ser.read(1) != bytes([HEADER]):
                continue
            body = ser.read(BODY_LEN)
            if len(body) != BODY_LEN:
                continue
            dist, strength, temp_c, valid = parse_body(body)
            if valid:
                ok_count += 1
            else:
                bad_count += 1
            print(
                f"{'OK ' if valid else 'BAD'} dist={dist:5d} cm  strength={strength:6d}  "
                f"temp={temp_c:.1f} C  ok={ok_count} bad={bad_count}"
            )


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
