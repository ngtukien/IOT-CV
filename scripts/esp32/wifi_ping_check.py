"""Đo mất gói Wi-Fi hotspot: ping ĐỒNG THỜI nhiều ESP32, tìm giây mất chung và lúc laptop quét.

Chạy:  py -3.13 scripts/esp32/wifi_ping_check.py [--seconds 150] [--no-scan-watch] [host ...]
       (mặc định hai bo: iotcv-camera.mshome.net, DroneBridgeESP32.mshome.net)

- Mỗi giây một gói tới mỗi bo. Mất gói CÙNG giây ở mọi bo = lỗi phía laptop/hotspot (radio rời
  kênh), không phải phía bo.
- Song song chạy `wifi_scan_watch.ps1` để biết lúc nào card Wi-Fi của laptop quét: mỗi lần quét,
  radio rời kênh hotspot vài giây. Đo 13/10/2026: ép quét một lần -> cả hai bo mất 3 s; trước đó
  có chương trình nào đó bắt quét đều mỗi ~15,5 s (sổ tay 12-hotspot-laptop mục 6).
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
from pathlib import Path

DEFAULT_HOSTS = ("iotcv-camera.mshome.net", "DroneBridgeESP32.mshome.net")
PING_TIMEOUT_MS = 800
RTT_PATTERN = re.compile(r"time[=<](\d+)ms")
SCAN_WATCHER = Path(__file__).with_name("wifi_scan_watch.ps1")
SCAN_DURATION_S = 6  # một lần quét đo được 4,2-4,9 s; giây mất trong khoảng này coi là do quét
WATCHER_GRACE_S = 15
WATCH_TAIL_S = 2


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


def start_scan_watch() -> subprocess.Popen | None:
    """Chạy wifi_scan_watch.ps1 tới khi bị dừng. Lệnh chỉ gồm hằng số, không lấy từ dòng lệnh."""
    if sys.platform != "win32" or not SCAN_WATCHER.exists():
        print(
            "Không theo dõi được lần quét Wi-Fi (chỉ chạy trên Windows, cần wifi_scan_watch.ps1)."
        )
        return None
    cmd = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]
    return subprocess.Popen(
        [*cmd, str(SCAN_WATCHER)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def scan_end_seconds(proc: subprocess.Popen, t0_wall: float) -> list[float] | None:
    """Dừng bộ theo dõi, trả các giây (tính từ lúc bắt đầu ping) mà mỗi lần quét kết thúc.

    None = không theo dõi được. Bộ theo dõi ghi và đẩy từng dòng ngay, nên dừng nó giữa chừng
    không mất dòng nào đã in.
    """
    time.sleep(WATCH_TAIL_S)  # đợi lần quét đang dở (nếu có) kịp in
    proc.terminate()
    try:
        out, _ = proc.communicate(timeout=WATCHER_GRACE_S)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, _ = proc.communicate()
    if "ACCESS Allowed" not in out:
        print(f"Không theo dõi được lần quét Wi-Fi: {out.strip()[:200]}")
        return None
    ends = []
    for line in out.splitlines():
        kind, _, value = line.partition(" ")
        if kind == "SCAN" and value.strip().isdigit():
            ends.append(round(int(value) / 1000 - t0_wall, 1))
    return ends


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("hosts", nargs="*", default=list(DEFAULT_HOSTS))
    ap.add_argument("--seconds", type=int, default=150)
    ap.add_argument("--no-scan-watch", action="store_true", help="không theo dõi lần quét Wi-Fi")
    args = ap.parse_args()
    ips = {h: socket.gethostbyname(h) for h in args.hosts}  # phân giải một lần, trước khi đo
    watcher = None if args.no_scan_watch else start_scan_watch()
    results: dict[str, list] = {h: [] for h in args.hosts}
    t0 = time.monotonic()
    t0_wall = time.time()
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

    ends = scan_end_seconds(watcher, t0_wall) if watcher else None
    if ends is not None:
        print(f"Laptop quét Wi-Fi {len(ends)} lần, xong ở giây: {ends}")
        during = [s for s in common if any(e - SCAN_DURATION_S <= s <= e + 1 for e in ends)]
        print(f"Giây mất chung TRÙNG lúc laptop quét: {len(during)}/{len(common)} {during}")
        if common and len(during) == len(common):
            print("=> Mất sóng do laptop quét Wi-Fi. Cách tìm chương trình bắt quét:")
            print("   docs/so-tay/12-hotspot-laptop.md mục 6.")
    return 1 if common else 0


if __name__ == "__main__":
    sys.exit(main())
