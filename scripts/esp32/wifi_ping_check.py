"""Đo mất gói Wi-Fi hotspot: ping ĐỒNG THỜI nhiều ESP32, mỗi giây một gói, tìm giây mất chung.

Chạy:  py -3.13 scripts/esp32/wifi_ping_check.py [--seconds 150] [host ...]
       (mặc định hai bo: iotcv-camera.mshome.net, DroneBridgeESP32.mshome.net)

Mất gói CÙNG giây ở mọi bo = lỗi phía laptop/hotspot (radio rời kênh), không phải phía bo.
13/10/2026 đo được: cả hai bo mất 2-3 s, đều đặn mỗi ~15,5 s (sổ tay 12-hotspot-laptop mục 6).
Mã thoát 1 nếu có giây mất chung ở mọi bo.
"""

from __future__ import annotations

import argparse
import re
import socket
import subprocess
import sys
import threading
import time

DEFAULT_HOSTS = ("iotcv-camera.mshome.net", "DroneBridgeESP32.mshome.net")
PING_TIMEOUT_MS = 800
RTT_PATTERN = re.compile(r"time[=<](\d+)ms")


def ping_once(ip: str) -> int | None:
    proc = subprocess.run(
        ["ping", "-n", "1", "-w", str(PING_TIMEOUT_MS), ip],
        capture_output=True,
        text=True,
        encoding="cp437",
        errors="replace",
        check=False,
    )
    m = RTT_PATTERN.search(proc.stdout)
    return int(m.group(1)) if m else None


def ping_series(ip: str, seconds: int, t0: float, out: list) -> None:
    for i in range(seconds):
        out.append((i, ping_once(ip)))
        time.sleep(max(0.0, (i + 1) - (time.monotonic() - t0)))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("hosts", nargs="*", default=list(DEFAULT_HOSTS))
    ap.add_argument("--seconds", type=int, default=150)
    args = ap.parse_args()
    ips = {h: socket.gethostbyname(h) for h in args.hosts}  # phân giải một lần, trước khi đo
    results: dict[str, list] = {h: [] for h in args.hosts}
    t0 = time.monotonic()
    threads = [
        threading.Thread(target=ping_series, args=(ips[h], args.seconds, t0, results[h]))
        for h in args.hosts
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    lost_sets = []
    for host, series in results.items():
        rtts = sorted(r for _, r in series if r is not None)
        lost = [s for s, r in series if r is None]
        lost_sets.append(set(lost))
        p50 = rtts[len(rtts) // 2] if rtts else None
        p95 = rtts[int(len(rtts) * 0.95)] if rtts else None
        print(f"{host} ({ips[host]}): mất {len(lost)}/{len(series)}  p50={p50} ms  p95={p95} ms")
        print(f"    giây mất: {lost}")
    common = sorted(set.intersection(*lost_sets)) if lost_sets else []
    print(f"Giây mất CHUNG ở mọi bo: {len(common)} {common}")
    return 1 if common else 0


if __name__ == "__main__":
    sys.exit(main())
