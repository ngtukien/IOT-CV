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

    # chạy cả một chuỗi lệnh, CHỜ ack giữa các bước (Phase 06 §6.1)
    uv run python scripts/ws_probe.py --script plans/samples/takeoff.jsonl
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

DEFAULT_URL = "ws://127.0.0.1:8000/ws"

# Gốc repo — mọi đường dẫn người dùng đưa vào đều được neo vào đây.
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def duong_dan_trong_repo(tho: str) -> Path:
    """Giải một đường dẫn từ dòng lệnh và BẮT nó nằm trong repo.

    Hai lý do, lý do thứ hai mới là lý do chính:

    1. Máy quét bảo đây là path traversal. Với một CLI chạy bằng quyền của
       chính người gõ thì đó là báo động quá mức — không có ranh giới quyền nào
       bị vượt.
    2. Nhưng ràng buộc này ĐÚNG về mặt dự án, độc lập với máy quét: file kịch
       bản và sổ kiểm là **tang chứng của một lần chạy**. Một kịch bản nằm ở
       `/tmp` sinh ra kết quả mà không ai khác xem lại được. Cùng lý do với
       `DEADMAN_LOG_PATH` trong `backend/config.py`.

    Đường dẫn tương đối được neo vào gốc repo (không vào CWD), nên lệnh chạy
    được giống nhau dù gõ từ thư mục nào.
    """
    duong = Path(tho)
    if not duong.is_absolute():
        duong = PROJECT_ROOT / duong
    duong = duong.resolve()
    if not duong.is_relative_to(PROJECT_ROOT):
        raise ValueError(f"'{tho}' nam ngoai repo {PROJECT_ROOT} — khong nhan")
    return duong


# Dải nhịp telemetry được coi là đạt, với TELEMETRY_HZ=8 (cổng pass §5.6 bài 3).
HZ_MIN = 7.5
HZ_MAX = 8.5


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


async def _chay_kich_ban(socket, duong: Path, timeout: float) -> int:
    """Gửi từng dòng của một file .jsonl, CHỜ ack/error rồi mới sang dòng sau.

    Vì sao phải chờ chứ không bắn một loạt: thứ tự GUIDED -> arm -> takeoff là
    thứ tự BẮT BUỘC của ArduCopter. Bắn dồn thì arm tới nơi trước khi FC kịp
    sang GUIDED, bị từ chối, rồi takeoff cũng hỏng theo — và không nhìn ra
    được là hỏng vì thứ tự hay vì lệnh sai.

    Mỗi dòng là một phong bì hợp đồng đầy đủ. Dòng trống và dòng bắt đầu bằng
    `//` được bỏ qua để file mẫu chú thích được cho người đọc.
    """
    buoc = 0
    for so_dong, raw in enumerate(duong.read_text(encoding="utf-8").splitlines(), 1):
        dong = raw.strip()
        if not dong or dong.startswith("//"):
            continue
        try:
            phong_bi = json.loads(dong)
        except json.JSONDecodeError as exc:
            print(f"FAIL: dong {so_dong} khong phai JSON: {exc}", file=sys.stderr)
            return 1

        buoc += 1
        phong_bi.setdefault("v", 1)
        phong_bi.setdefault("id", f"probe-{buoc}")
        ten = phong_bi.get("type", "?")
        await socket.send(json.dumps(phong_bi))
        print(f"[{buoc}] -> {ten} {json.dumps(phong_bi.get('data', {}), ensure_ascii=False)}")

        # `cmd.velocity` cố ý KHÔNG sinh ack (hợp đồng Phase 05) — chờ nó là
        # treo vĩnh viễn. Chỉ lắng nghe error trong một khoảng ngắn.
        if ten == "cmd.velocity":
            ket_qua = await _cho_phan_hoi(socket, phong_bi["id"], timeout=0.3, can_ack=False)
        else:
            ket_qua = await _cho_phan_hoi(socket, phong_bi["id"], timeout=timeout, can_ack=True)

        if ket_qua is not None:
            print(f"    FAIL: {ket_qua}", file=sys.stderr)
            return 1
        print("    OK")

    print()
    print(f"KET QUA: PASS ({buoc} lenh)")
    return 0


async def _cho_phan_hoi(socket, ref: str, *, timeout: float, can_ack: bool) -> str | None:
    """None = xong. Chuỗi = mô tả lỗi.

    Chờ tới khi thấy `ack status=done` (hoặc `error`) MANG ĐÚNG `ref` của mình.
    Lọc theo `ref` chứ không lấy ack đầu tiên gặp: telemetry vẫn chảy 8 Hz xen
    giữa, và một `error` của lệnh trước có thể tới muộn.
    """
    han_chot = time.monotonic() + timeout
    while True:
        con_lai = han_chot - time.monotonic()
        if con_lai <= 0:
            return None if not can_ack else f"khong nhan duoc ack trong {timeout:.0f}s"
        try:
            async with asyncio.timeout(con_lai):
                raw = await socket.recv()
        except TimeoutError:
            return None if not can_ack else f"khong nhan duoc ack trong {timeout:.0f}s"

        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            continue
        data = message.get("data", {})
        if data.get("ref") != ref:
            continue
        if message.get("type") == "error":
            return f"{data.get('code')}: {data.get('message')}"
        if message.get("type") == "ack" and data.get("status") == "done":
            return None


async def _run(args: argparse.Namespace) -> int:
    # Xác thực tham số TRƯỚC khi mở socket: hỏng ở dòng lệnh thì đừng bắt
    # backend và mạng chịu trận, và đừng in "Đã nối" rồi mới báo lỗi tham số.
    kich_ban: Path | None = None
    if args.script:
        try:
            kich_ban = duong_dan_trong_repo(args.script)
        except ValueError as exc:
            print(f"FAIL: {exc}", file=sys.stderr)
            return 1
        if not kich_ban.is_file():
            print(f"FAIL: khong thay file kich ban {kich_ban}", file=sys.stderr)
            return 1

    try:
        from websockets.asyncio.client import connect
    except ImportError:  # websockets < 13 để ở chỗ khác
        from websockets.client import connect  # type: ignore[no-redef]

    # WebSocketException cũng phải bắt: backend ĐANG chạy nhưng từ chối nâng cấp
    # (gõ sai đường dẫn -> rơi vào StaticFiles) ném InvalidStatus/InvalidHandshake,
    # không phải OSError, nên nếu thiếu thì người dùng nhận traceback trần thay vì
    # dòng "Backend đã chạy chưa?".
    from websockets.exceptions import WebSocketException

    try:
        async with asyncio.timeout(args.timeout):
            socket = await connect(args.url)
    except (TimeoutError, OSError, WebSocketException) as exc:
        print(f"FAIL: không nối được {args.url} ({exc})", file=sys.stderr)
        print("Backend đã chạy chưa?  uv run uvicorn backend.app:app", file=sys.stderr)
        print(f"Đường dẫn đúng là /ws — đang thử: {args.url}", file=sys.stderr)
        return 1

    print(f"Đã nối {args.url}")
    async with socket:
        if kich_ban is not None:
            return await _chay_kich_ban(socket, kich_ban, args.ack_timeout)
        if args.send:
            await socket.send(args.send)
            print(f"-> {args.send}")

        ma_loi, moc_telemetry = await _vong_doc(socket, args)

    if ma_loi:
        return ma_loi
    if args.measure_rate:
        return _bao_cao_nhip(moc_telemetry, args.duration)
    return 0


async def _vong_doc(socket, args) -> tuple[int, list[float]]:
    """Đọc message tới khi đủ `--count` (hoặc hết `--duration` khi đo nhịp).

    Trả `(mã lỗi, mốc thời gian các frame telemetry)`. Mã 0 là bình thường —
    tách khỏi `_run` để chỗ đó chỉ còn lo việc nối và việc chọn chế độ.
    """
    moc_telemetry: list[float] = []
    da_in = 0
    han_chot = time.monotonic() + args.duration if args.measure_rate else None

    while True:
        if han_chot is not None and time.monotonic() >= han_chot:
            return 0, moc_telemetry
        if han_chot is None and da_in >= args.count:
            return 0, moc_telemetry

        try:
            async with asyncio.timeout(args.timeout):
                raw = await socket.recv()
        except TimeoutError:
            print(f"FAIL: im lặng quá {args.timeout}s", file=sys.stderr)
            return 1, moc_telemetry

        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            print(f"FAIL: server gửi thứ không phải JSON: {raw[:200]!r}", file=sys.stderr)
            return 1, moc_telemetry

        if message.get("type") == "telemetry":
            moc_telemetry.append(time.monotonic())

        if (args.only and message.get("type") != args.only) or args.measure_rate:
            continue

        _in(message, args.pretty)
        da_in += 1


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
    # Mã thoát PHẢI theo phán quyết. Bản trước in "KHÔNG ĐẠT" rồi vẫn `return 0`
    # — một cổng mà việc duy nhất của nó là đỏ, lại không đỏ được, nên backend
    # chạy 2 Hz hay 40 Hz đều qua trong mọi lần dùng có kịch bản.
    dat = HZ_MIN <= hz <= HZ_MAX
    print(f"Cổng pass 8Hz: {'ĐẠT' if dat else 'KHÔNG ĐẠT'} (cần {HZ_MIN}-{HZ_MAX} Hz)")
    return 0 if dat else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--url", default=DEFAULT_URL, help=f"mặc định {DEFAULT_URL}")
    parser.add_argument("--count", type=int, default=10, help="in bao nhiêu message rồi thoát")
    parser.add_argument("--send", help="một message JSON gửi lên ngay sau khi nối")
    parser.add_argument("--script", help="file .jsonl: gửi từng dòng, chờ ack giữa các bước")
    parser.add_argument(
        "--ack-timeout", type=float, default=10.0, help="chờ ack mỗi bước của --script"
    )
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
