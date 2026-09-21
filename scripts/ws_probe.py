#!/usr/bin/env python3
"""Dò WebSocket của backend từ dòng lệnh — Phase 05.

Đây là "Mission Planner của người nghèo": xem hợp đồng WebSocket có chạy thật
không mà chưa cần frontend. Dùng cho 6 bài nghiệm thu ở §5.6 của
`plans/phase-05-backend-mavlink-telemetry.md`.

Ví dụ:

    # xem 20 message telemetry đầu
    uv run python scripts/ws_probe.py --count 20

    # đo nhịp thật (phải ra 7.5-8.5 Hz khi TELEMETRY_HZ=8)
    uv run python scripts/ws_probe.py --measure-rate

    # gửi một lệnh rồi xem server trả gì
    uv run python scripts/ws_probe.py --send '{"v":1,"type":"ping","id":"c-1","data":{}}'

    # chỉ xem sự kiện, bỏ qua telemetry cho đỡ rối
    uv run python scripts/ws_probe.py --only event --count 5
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time

DEFAULT_URL = "ws://127.0.0.1:8000/ws"


def _in(message: dict, pretty: bool) -> None:
    if pretty:
        print(json.dumps(message, indent=2, ensure_ascii=False))
        return

    type_ = message.get("type", "?")
    data = message.get("data", {})
    if type_ == "telemetry":
        print(
            f"[telemetry] connected={data.get('connected')} mode={data.get('mode')} "
            f"armed={data.get('armed')} alt={data.get('relative_alt')} "
            f"lat={data.get('lat')} lon={data.get('lon')} sats={data.get('satellites')} "
            f"age={data.get('link_age_ms')}ms"
        )
    elif type_ == "event":
        print(f"[event/{data.get('level')}] {data.get('code')}: {data.get('message')}")
    elif type_ == "error":
        print(f"[ERROR] code={data.get('code')} ref={data.get('ref')}: {data.get('message')}")
    else:
        print(f"[{type_}] {json.dumps(data, ensure_ascii=False)}")


async def _run(args: argparse.Namespace) -> int:
    try:
        from websockets.asyncio.client import connect
    except ImportError:  # websockets < 13 để ở chỗ khác
        from websockets.client import connect  # type: ignore[no-redef]

    try:
        socket = await asyncio.wait_for(connect(args.url), timeout=args.timeout)
    except (TimeoutError, OSError) as exc:
        print(f"FAIL: không nối được {args.url} ({exc})", file=sys.stderr)
        print("Backend đã chạy chưa?  uv run uvicorn backend.app:app", file=sys.stderr)
        return 1

    print(f"Đã nối {args.url}")
    async with socket:
        if args.send:
            await socket.send(args.send)
            print(f"-> {args.send}")

        moc_telemetry: list[float] = []
        da_in = 0
        han_chot = time.monotonic() + args.duration if args.measure_rate else None

        while True:
            if han_chot is not None and time.monotonic() >= han_chot:
                break
            if han_chot is None and da_in >= args.count:
                break

            try:
                raw = await asyncio.wait_for(socket.recv(), timeout=args.timeout)
            except TimeoutError:
                print(f"FAIL: im lặng quá {args.timeout}s", file=sys.stderr)
                return 1

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                print(f"FAIL: server gửi thứ không phải JSON: {raw[:200]!r}", file=sys.stderr)
                return 1

            if message.get("type") == "telemetry":
                moc_telemetry.append(time.monotonic())

            if args.only and message.get("type") != args.only:
                continue
            if args.measure_rate:
                continue

            _in(message, args.pretty)
            da_in += 1

    if args.measure_rate:
        return _bao_cao_nhip(moc_telemetry, args.duration)
    return 0


def _bao_cao_nhip(moc: list[float], giay: float) -> int:
    if len(moc) < 2:
        print(f"FAIL: chỉ nhận {len(moc)} message telemetry trong {giay:.0f}s", file=sys.stderr)
        return 1

    khoang = moc[-1] - moc[0]
    hz = (len(moc) - 1) / khoang if khoang > 0 else 0.0
    cach_nhau = [(b - a) * 1000 for a, b in zip(moc, moc[1:], strict=False)]

    print()
    print("=== NHỊP TELEMETRY ===")
    print(f"Số message   : {len(moc)} trong {khoang:.1f}s")
    print(f"Nhịp         : {hz:.2f} Hz")
    print(f"Giãn cách    : min {min(cach_nhau):.0f} ms · max {max(cach_nhau):.0f} ms")
    # Cổng pass §5.6 bài 3: 7.5-8.5 Hz với TELEMETRY_HZ=8.
    print(f"Cổng pass 8Hz: {'ĐẠT' if 7.5 <= hz <= 8.5 else 'KHÔNG ĐẠT'} (cần 7.5-8.5 Hz)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--url", default=DEFAULT_URL, help=f"mặc định {DEFAULT_URL}")
    parser.add_argument("--count", type=int, default=10, help="in bao nhiêu message rồi thoát")
    parser.add_argument("--send", help="một message JSON gửi lên ngay sau khi nối")
    parser.add_argument("--pretty", action="store_true", help="in nguyên JSON thay vì tóm tắt")
    parser.add_argument("--only", help="chỉ in type này (telemetry, event, status, error...)")
    parser.add_argument("--measure-rate", action="store_true", help="đo nhịp telemetry thật")
    parser.add_argument("--duration", type=float, default=10.0, help="đo trong bao nhiêu giây")
    parser.add_argument("--timeout", type=float, default=15.0, help="chờ tối đa mỗi message")
    args = parser.parse_args()

    try:
        return asyncio.run(_run(args))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
