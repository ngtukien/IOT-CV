"""Nạp firmware camera qua Wi-Fi (OTA) và chứng minh chip đang chạy đúng bản vừa nạp (plan §12.9).

Chạy (sau khi build):  py -3.13 scripts/esp32/ota_camera.py [--force]
Thường gọi qua:        powershell.exe ... -File scripts\\esp32\\nap_camera.ps1 -Ota

1. Đọc firmware.bin vừa build: SHA-256 của file ELF mà chip sẽ tự báo (esp_app_desc_t), và MD5.
2. Hỏi /status. Chip đã chạy đúng bản này thì thôi, trừ khi có --force.
3. POST /update kèm X-OTA-Token (đọc từ include/secrets.h) và X-OTA-MD5.
4. Chờ bo khởi động lại; đạt khi firmware_sha = SHA của file, khe chạy đã đổi (app0 <-> app1) và
   camera OK. Chip quay về bản cũ (SHA cũ) nghĩa là nạp hỏng — firmware cũ vẫn chạy bình thường.

Mã thoát: 0 = chip chạy đúng bản mới (hoặc đã đúng sẵn); 1 = hỏng, có in lý do.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from camera_net import CONTROL_PORT, camera_url

REPO = Path(__file__).resolve().parents[2]
FIRMWARE_BIN = REPO / "firmware/camera/.pio/build/esp32s3_n16r8/firmware.bin"
SECRETS_H = REPO / "firmware/camera/include/secrets.h"
TOKEN_PATTERN = re.compile(r'^#define\s+OTA_TOKEN\s+"([0-9a-f]{32})"', re.MULTILINE)

# Bố cục ảnh firmware ESP32: header 24 byte + header đoạn đầu 8 byte, rồi tới esp_app_desc_t
# (esp_app_format.h). Trong đó app_elf_sha256 nằm ở byte 144. Đã đối chiếu 13/10/2026:
# 16 hex đầu bằng đúng sha256sum của firmware.elf.
IMAGE_MAGIC = 0xE9
APP_DESC_OFFSET = 24 + 8
APP_DESC_MAGIC = 0xABCD5432
ELF_SHA_OFFSET = APP_DESC_OFFSET + 144
SHA_PREFIX_BYTES = 8  # firmware báo 16 ký tự hex đầu

UPLOAD_TIMEOUT_S = 90
STATUS_TIMEOUT_S = 3
REBOOT_WAIT_S = 60
POLL_INTERVAL_S = 1.0


class OtaFailed(Exception):
    pass


def expected_sha(image: bytes) -> str:
    if len(image) < ELF_SHA_OFFSET + SHA_PREFIX_BYTES or image[0] != IMAGE_MAGIC:
        raise OtaFailed(f"{FIRMWARE_BIN} không phải ảnh firmware ESP32")
    (magic,) = struct.unpack_from("<I", image, APP_DESC_OFFSET)
    if magic != APP_DESC_MAGIC:
        raise OtaFailed(f"không thấy esp_app_desc_t trong {FIRMWARE_BIN} (magic 0x{magic:08x})")
    return image[ELF_SHA_OFFSET : ELF_SHA_OFFSET + SHA_PREFIX_BYTES].hex()


def read_token() -> str:
    if not SECRETS_H.exists():
        raise OtaFailed(
            f"thiếu {SECRETS_H} — chạy scripts\\esp32\\camera-secrets.ps1 rồi build lại"
        )
    m = TOKEN_PATTERN.search(SECRETS_H.read_text(encoding="utf-8"))
    if not m:
        raise OtaFailed(
            "secrets.h chưa có OTA_TOKEN thật — chạy camera-secrets.ps1, rồi nạp USB một lần"
        )
    return m.group(1)


def get_status() -> dict | None:
    """/status của camera, hoặc None nếu bo chưa trả lời (đang khởi động lại, mất sóng)."""
    try:
        url = camera_url(CONTROL_PORT, "/status")
        with urllib.request.urlopen(url, timeout=STATUS_TIMEOUT_S) as resp:  # noqa: S310
            return json.loads(resp.read())
    except (OSError, ValueError):
        return None


def upload(image: bytes, token: str) -> tuple[int, str]:
    req = urllib.request.Request(  # noqa: S310 - URL chỉ dựng từ hằng số trong camera_net.py
        camera_url(CONTROL_PORT, "/update"),
        data=image,
        method="POST",
        headers={
            "Content-Type": "application/octet-stream",
            "X-OTA-Token": token,
            # MD5 chỉ để kiểm toàn vẹn (thư viện Update trên chip chỉ có MD5);
            # phần bảo mật là X-OTA-Token.
            "X-OTA-MD5": hashlib.md5(image, usedforsecurity=False).hexdigest(),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=UPLOAD_TIMEOUT_S) as resp:  # noqa: S310
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", "replace")


def wait_for_reboot(before: dict) -> dict:
    """Chờ bo khởi động lại (uptime_ms tụt) và trả lời /status lại."""
    deadline = time.monotonic() + REBOOT_WAIT_S
    while time.monotonic() < deadline:
        time.sleep(POLL_INTERVAL_S)
        st = get_status()
        if st and st.get("uptime_ms", 0) < before.get("uptime_ms", 0):
            return st
    raise OtaFailed(f"bo không trả lời /status sau {REBOOT_WAIT_S} s — xem log: esp32_log.py COM7")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--force", action="store_true", help="nạp cả khi chip đã chạy đúng bản này")
    args = ap.parse_args()
    try:
        image = FIRMWARE_BIN.read_bytes()
        want = expected_sha(image)
        token = read_token()
        before = get_status()
        if before is None:
            raise OtaFailed("camera không trả lời /status — hotspot bật chưa? bo có điện chưa?")
        print(f"Chip đang chạy: sha={before.get('firmware_sha')} khe={before.get('partition')}")
        print(f"Sẽ nạp:         sha={want} ({len(image)} byte)")
        if before.get("firmware_sha") == want and not args.force:
            print("Chip đã chạy đúng bản này — không nạp (thêm --force để nạp lại).")
            return 0
        t0 = time.monotonic()
        code, body = upload(image, token)
        print(f"POST /update -> {code} {body.strip()} ({time.monotonic() - t0:.1f} s)")
        if code != 200:
            raise OtaFailed(f"camera từ chối bản nạp ({code}); bản cũ vẫn chạy")
        after = wait_for_reboot(before)
        print(
            f"Sau khởi động lại ({time.monotonic() - t0:.1f} s): sha={after.get('firmware_sha')}"
            f" khe={after.get('partition')} camera={after.get('camera')}"
        )
        if after.get("firmware_sha") != want:
            raise OtaFailed("chip KHÔNG chạy bản vừa nạp")
        if after.get("partition") == before.get("partition"):
            raise OtaFailed("khe chạy không đổi — ảnh mới không được chọn")
        if after.get("camera") != "OK":
            raise OtaFailed(f"bản mới chạy nhưng camera = {after.get('camera')}")
    except OtaFailed as exc:
        print(f"FAIL {exc}")
        return 1
    print("PASS — chip chạy đúng bản vừa nạp qua Wi-Fi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
