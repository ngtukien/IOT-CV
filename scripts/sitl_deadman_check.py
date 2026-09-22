#!/usr/bin/env python3
"""Nghiệm thu dead-man trên SITL THẬT — Phase 06, việc 6.7.

Pytest ở `backend/tests/test_deadman.py` chứng minh **logic** đúng. Script này
chứng minh **hệ thống lắp ráp xong** đúng: nó bay một chuyến ngắn rồi cố tình
giết socket giữa lúc đang lái, đúng như người dùng đóng tab.

Hai loại lỗi khác nhau, cần hai loại bằng chứng khác nhau:

    pytest  -> bắt lỗi SUY NGHĨ  (điều kiện sai, dấu sai, thứ tự sai)
    script  -> bắt lỗi LẮP RÁP   (quên bật vòng, sai frame, gói không tới nơi)

Một cái xanh không thay được cái kia. Cổng pass §6 đòi cả hai.

Cần chạy sẵn TRƯỚC:

    1. SITL          make sitl            (trong WSL)
    2. backend       make run

Rồi:

    uv run python scripts/sitl_deadman_check.py --url ws://127.0.0.1:8000/ws
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

DEFAULT_URL = "ws://127.0.0.1:8000/ws"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LOG = PROJECT_ROOT / "logs" / "deadman.jsonl"

# Nhãn của bước quyết định — xuất hiện ở bốn nhánh kết quả khác nhau, để một
# chỗ cho bốn nhánh không trôi thành bốn chữ khác nhau.
BUOC_DONG_SOCKET = "[6/6] socket closed"


def duong_dan_trong_repo(tho: str) -> Path:
    """Giải một đường dẫn từ dòng lệnh và BẮT nó nằm trong repo.

    Ràng buộc này đúng về mặt dự án, độc lập với việc máy quét có kêu hay
    không: sổ kiểm dead-man là **tang chứng của một lần chạy**. Một file nằm
    ngoài repo sinh ra kết quả mà không ai khác xem lại được — cùng lý do với
    `DEADMAN_LOG_PATH` trong `backend/config.py`.

    Đường dẫn tương đối neo vào gốc repo (không vào CWD), nên lệnh chạy được
    giống nhau dù gõ từ thư mục nào.
    """
    duong = Path(tho)
    if not duong.is_absolute():
        duong = PROJECT_ROOT / duong
    duong = duong.resolve()
    if not duong.is_relative_to(PROJECT_ROOT):
        raise ValueError(f"'{tho}' nam ngoai repo {PROJECT_ROOT} — khong nhan")
    return duong


# Ngưỡng của cổng pass §6.
DO_TRE_TOI_DA_MS = 300.0
GROUND_SPEED_DUNG = 0.2  # m/s — dưới mức này coi như đã dừng
GROUND_SPEED_TOI_THIEU_KHI_LAI = 0.5  # m/s — trên mức này coi như thật sự đang đi


class KhongDat(RuntimeError):
    """Một bước nghiệm thu không đạt. Mang sẵn câu nói phải làm gì tiếp."""


def _phong_bi(type_: str, data: dict | None = None, id_: str | None = None) -> str:
    return json.dumps(
        {
            "v": 1,
            "type": type_,
            "id": id_ or f"chk-{int(time.time() * 1000) % 100000}",
            "data": data or {},
        },
        ensure_ascii=False,
    )


async def _cho_ack(socket, ref: str, timeout: float) -> None:
    """Chờ `ack done` mang đúng `ref`. Ném `KhongDat` nếu error hoặc hết giờ."""
    han = time.monotonic() + timeout
    while True:
        con_lai = han - time.monotonic()
        if con_lai <= 0:
            raise KhongDat(f"khong nhan duoc ack cho {ref} trong {timeout:.0f}s")
        async with asyncio.timeout(con_lai):
            raw = await socket.recv()
        msg = json.loads(raw)
        data = msg.get("data", {})
        if data.get("ref") != ref:
            continue
        if msg.get("type") == "error":
            raise KhongDat(f"{data.get('code')}: {data.get('message')}")
        if msg.get("type") == "ack" and data.get("status") == "done":
            return


async def _lenh(socket, type_: str, data: dict | None = None, *, timeout: float = 15.0) -> None:
    ref = f"chk-{type_}-{int(time.monotonic() * 1000) % 1000000}"
    await socket.send(_phong_bi(type_, data, id_=ref))
    await _cho_ack(socket, ref, timeout)


async def _doc_telemetry(socket, timeout: float = 5.0) -> dict:
    """Frame telemetry kế tiếp. Bỏ qua status/event/ack chen giữa."""
    han = time.monotonic() + timeout
    while True:
        con_lai = han - time.monotonic()
        if con_lai <= 0:
            raise KhongDat(f"khong nhan duoc telemetry trong {timeout:.0f}s")
        async with asyncio.timeout(con_lai):
            msg = json.loads(await socket.recv())
        if msg.get("type") == "telemetry":
            return msg["data"]


async def _cho_takeoff_xong(socket, muc_tieu: float, timeout: float = 90.0) -> float:
    """Chờ takeoff KẾT THÚC, không chỉ chờ "gần tới".

    ┌─ ĐÃ ĐO TRÊN SITL (2026-09-22) ──────────────────────────────────────────┐
    │ Bản đầu chờ `alt >= 0.9 * muc_tieu` rồi gửi velocity ngay. ArduCopter   │
    │ BỎ QUA velocity trong lúc GUIDED takeoff còn chạy, nên bước [5/6] báo   │
    │ `ground_speed = 0.02 m/s` và script kết luận "drone khong thuc su di" — │
    │ sai hoàn toàn: gửi cùng lệnh đó sau khi takeoff xong cho 0.993 m/s.     │
    │                                                                          │
    │ Một cổng đỏ vì lý do sai dạy người đọc bỏ qua màu đỏ. Điều kiện đúng là │
    │ tới đủ độ cao VÀ tốc độ leo đã về ~0.                                   │
    └──────────────────────────────────────────────────────────────────────────┘
    """
    han = time.monotonic() + timeout
    cao_nhat = 0.0
    while time.monotonic() < han:
        tele = await _doc_telemetry(socket)
        alt = tele.get("relative_alt") or 0.0
        climb = abs(tele.get("climb_rate") or 0.0)
        cao_nhat = max(cao_nhat, alt)
        if alt >= muc_tieu * 0.98 and climb < 0.2:
            return alt
    raise KhongDat(
        f"sau {timeout:.0f}s takeoff chua on dinh, cao nhat {cao_nhat:.1f} m, can {muc_tieu:.1f} m"
    )


async def _cho_san_sang(socket, *, timeout: float) -> None:
    """Chờ 3D fix + EKF hội tụ. Hai điều kiện `arm` của backend kiểm."""
    han = time.monotonic() + timeout
    cuoi = {}
    while time.monotonic() < han:
        tele = await _doc_telemetry(socket, timeout=min(10.0, han - time.monotonic()))
        cuoi = tele
        if (tele.get("gps_fix_type") or 0) >= 3 and tele.get("ekf_ok") is True:
            return
    raise KhongDat(
        f"sau {timeout:.0f}s van chua san sang: "
        f"gps_fix_type={cuoi.get('gps_fix_type')} ekf_ok={cuoi.get('ekf_ok')}"
    )


def _dem_dong(duong_dan: Path) -> int:
    if not duong_dan.exists():
        return 0
    return sum(1 for d in duong_dan.read_text(encoding="utf-8").splitlines() if d.strip())


def _dong_moi(duong_dan: Path, tu_dong: int) -> list[dict]:
    if not duong_dan.exists():
        return []
    dong = [d for d in duong_dan.read_text(encoding="utf-8").splitlines() if d.strip()]
    return [json.loads(d) for d in dong[tu_dong:]]


async def _chay(args: argparse.Namespace) -> int:
    try:
        from websockets.asyncio.client import connect
    except ImportError:
        from websockets.client import connect  # type: ignore[no-redef]
    from websockets.exceptions import WebSocketException

    try:
        so_kiem = duong_dan_trong_repo(args.log)
    except ValueError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    dong_truoc = _dem_dong(so_kiem)
    ket: list[tuple[str, str]] = []

    try:
        async with asyncio.timeout(10.0):
            socket = await connect(args.url)
    # TimeoutError la con cua OSError -> liet ke ca hai la thua.
    except (OSError, WebSocketException) as exc:
        print(f"FAIL: khong noi duoc {args.url} ({exc})", file=sys.stderr)
        print("Backend da chay chua?  make run", file=sys.stderr)
        return 1

    try:
        moc_dong = await _bay_va_giet_socket(socket, args, ket)
    except KhongDat as loi:
        ket.append(("FAIL", str(loi)))
        _in_ket_qua(ket)
        return 1
    except (TimeoutError, WebSocketException) as loi:
        ket.append(("FAIL", f"socket: {loi}"))
        _in_ket_qua(ket)
        return 1

    return await _cham_diem(connect, args, so_kiem, dong_truoc, moc_dong, ket)


async def _bay_va_giet_socket(socket, args, ket: list[tuple[str, str]]) -> float:
    """Bước [0/6] .. [6/6]: bay lên, lái, rồi GIẾT socket. Trả mốc lúc giết.

    Tách khỏi `_chay()` không phải để chiều máy quét độ-rối: `_chay()` trước đó
    làm ba việc rất khác nhau trong một thân hàm — bay, đo độ trễ, chấm điểm —
    nên đọc tới đoạn nào cũng phải giữ trong đầu cả hai đoạn kia.
    """
    # [0/6] — chờ SITL sẵn sàng TRƯỚC khi arm.
    #
    # Không có bước này thì script đỏ vì `ekf_ok=False` — tức là đỏ vì
    # chạy sớm, không phải vì dead-man hỏng. Một cổng đỏ sai lý do còn tệ
    # hơn không có cổng: nó dạy người đọc bỏ qua màu đỏ.
    # Đo trên SITL ArduCopter 4.7-dev: GPS fix về sau ~5 s, EKF hội tụ sau
    # ~25 s kể từ lúc backend nối.
    await _cho_san_sang(socket, timeout=args.cho_san_sang)
    ket.append(("[0/6] SITL san sang", "OK  (3D fix + EKF)"))

    # [1/6] .. [4/6] — đưa drone lên trời.
    await _lenh(socket, "cmd.web_control_enable", {"enabled": True})
    ket.append(("[1/6] web control ON", "OK"))

    await _lenh(socket, "cmd.mode", {"mode": "GUIDED"})
    ket.append(("[2/6] mode GUIDED", "OK"))

    await _lenh(socket, "cmd.arm", {"arm": True}, timeout=25.0)
    ket.append(("[3/6] armed", "OK"))

    await _lenh(socket, "cmd.takeoff", {"altitude": args.alt}, timeout=25.0)
    alt = await _cho_takeoff_xong(socket, args.alt)
    ket.append((f"[4/6] takeoff {args.alt:g}m", f"OK  -> alt {alt:.1f} m, on dinh"))

    # [5/6] — lái tay 10 Hz, ĐỌC LUÔN frame trả về trong lúc lái.
    #
    # Phải đọc `error`: không đọc thì một lệnh bị backend TỪ CHỐI cũng hiện
    # ra thành "ground_speed = 0" và script đổ tội cho type_mask hoặc frame.
    # Đó là cổng đo sai thứ mình tưởng mình đang đo.
    moc = time.monotonic()
    toc_do = 0.0
    so_lenh = 0
    while time.monotonic() - moc < args.giay_lai:
        await socket.send(_phong_bi("cmd.velocity", {"vx": 1.0}))
        so_lenh += 1
        # Vét frame về trong ~100 ms — vừa là nhịp 10 Hz, vừa là chỗ bắt lỗi.
        het = time.monotonic() + 0.1
        while True:
            con = het - time.monotonic()
            if con <= 0:
                break
            try:
                async with asyncio.timeout(con):
                    msg = json.loads(await socket.recv())
            except TimeoutError:
                break
            if msg.get("type") == "error":
                d = msg["data"]
                raise KhongDat(f"backend TU CHOI cmd.velocity: {d.get('code')}: {d.get('message')}")
            if msg.get("type") == "telemetry":
                toc_do = max(toc_do, msg["data"].get("ground_speed") or 0.0)

    if toc_do < GROUND_SPEED_TOI_THIEU_KHI_LAI:
        raise KhongDat(
            f"ground_speed cao nhat chi {toc_do:.2f} m/s sau {so_lenh} lenh — "
            "drone khong thuc su di. Khong co loi nao tra ve, nen kiem "
            "type_mask (phai la 0x0DC7) va coordinate_frame (phai la 9)."
        )
    ket.append((f"[5/6] vx=1.0 trong {args.giay_lai:.1f}s", f"ground_speed = {toc_do:.2f} m/s"))

    # [6/6] — GIẾT SOCKET, không gửi lệnh dừng. Đây là toàn bộ bài test.
    moc_dong = time.monotonic()
    await socket.close()
    return moc_dong


async def _cham_diem(
    connect,
    args,
    so_kiem: Path,
    dong_truoc: int,
    moc_dong: float,
    ket: list[tuple[str, str]],
) -> int:
    """Đọc sổ kiểm, đo độ trễ, và xác nhận drone ĐÃ DỪNG THẬT."""
    from websockets.exceptions import WebSocketException

    # Đọc sổ kiểm để đo ĐỘ TRỄ. Đợi một nhịp cho backend kịp ghi.
    await asyncio.sleep(0.5)
    moi = _dong_moi(so_kiem, dong_truoc)
    if not moi:
        ket.append((BUOC_DONG_SOCKET, f"FAIL — khong co dong moi trong {so_kiem}"))
        _in_ket_qua(ket)
        print(
            "\nBackend khong ghi so kiem. Vong dead-man co duoc bat khong?\n"
            "Kiem TELEMETRY_AUTOSTART va muc 6.4.6 cua plan.",
            file=sys.stderr,
        )
        return 1

    dau = moi[0]
    # `mono` cua backend va `moc_dong` cua script KHONG cung goc thoi gian khi
    # chay khac tien trinh — dung `ts` (wall clock) de tru. Do chinh xac cua no
    # thap hon nhung du de phan biet 30 ms voi 300 ms.
    do_tre_ms = (dau["ts"] - (time.time() - (time.monotonic() - moc_dong))) * 1000.0
    # Duoi 1 ms la BINH THUONG, khong phai loi do: `hub.disconnect()` goi
    # `trip()` dong bo ngay trong event loop, khong qua hang doi nao. Am thi
    # la lech dong ho -> KHONG DAT, khong lam tron thanh 0.
    dat_do_tre = 0 <= do_tre_ms < DO_TRE_TOI_DA_MS

    # Mở socket MỚI để xác nhận drone ĐÃ DỪNG THẬT, không chỉ "đã gửi lệnh".
    # Đây là điểm cả phase xoay quanh: transport thành công không phải kết quả.
    toc_do_sau = None
    try:
        async with asyncio.timeout(10.0):
            socket2 = await connect(args.url)
        async with socket2:
            han = time.monotonic() + 3.0
            while time.monotonic() < han:
                tele = await _doc_telemetry(socket2)
                toc_do_sau = tele.get("ground_speed") or 0.0
                if toc_do_sau < GROUND_SPEED_DUNG:
                    break
    except (OSError, WebSocketException) as exc:
        ket.append((BUOC_DONG_SOCKET, f"FAIL — khong mo lai duoc socket: {exc}"))
        _in_ket_qua(ket)
        return 1

    dat_dung = toc_do_sau is not None and toc_do_sau < GROUND_SPEED_DUNG
    ket.append(
        (
            BUOC_DONG_SOCKET,
            f"reason={dau['reason']} · zero-velocity sau {do_tre_ms:.1f} ms "
            f"-> ground_speed {toc_do_sau:.2f} m/s",
        )
    )
    _in_ket_qua(ket)

    if not dat_do_tre:
        print(
            f"\nKHONG DAT: do tre {do_tre_ms:.0f} ms >= {DO_TRE_TOI_DA_MS:.0f} ms.\n"
            "`on_web_disconnected` co dang cho het han 300 ms thay vi gui zero "
            "ngay khong? Xem muc 6.4.3 cua plan.",
            file=sys.stderr,
        )
    if not dat_dung:
        print(
            f"\nKHONG DAT: ground_speed van {toc_do_sau:.2f} m/s sau 3 s.\n"
            "Velocity 0 co gui nhung bi rot goi. Tang ZERO_VELOCITY_REPEAT, va "
            "kiem hai thread co dang ghi socket qua MavlinkConnection.send() khong.",
            file=sys.stderr,
        )

    dat = dat_do_tre and dat_dung
    print(f"KET QUA: {'PASS' if dat else 'FAIL'}")
    return 0 if dat else 1


def _in_ket_qua(rows: list[tuple[str, str]]) -> None:
    print()
    rong = max((len(a) for a, _ in rows), default=0)
    for nhan, gia_tri in rows:
        print(f"{nhan:<{rong}}  {gia_tri}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--url", default=DEFAULT_URL, help=f"mac dinh {DEFAULT_URL}")
    parser.add_argument("--log", default=str(DEFAULT_LOG), help="so kiem deadman.jsonl")
    parser.add_argument("--alt", type=float, default=5.0, help="do cao takeoff, m")
    parser.add_argument("--giay-lai", type=float, default=4.0, help="giu vx=1 bao lau")
    parser.add_argument("--cho-san-sang", type=float, default=90.0, help="cho 3D fix + EKF bao lau")
    args = parser.parse_args()
    try:
        return asyncio.run(_chay(args))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
