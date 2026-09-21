#!/usr/bin/env python3
"""Runner 4/5 — mission có waypoint thấp 3 m (Phase 03).

Câu hỏi cần trả lời bằng SỐ ĐO, không phải bằng suy đoán:

    Nạp một mission có waypoint ở `Alt` = 3 m thì ArduPilot làm gì? Nó từ chối
    ngay lúc nạp, hay nhận rồi bay xuống thật?

Câu trả lời quyết định thiết kế của Phase 07: backend web phải tự kiểm
`MIN_ALT` (mặc định 2 m) hay dựa được vào flight controller? `mission.py` đã có
sẵn `validate_mission()`, và runner này là bằng chứng nói hàm đó CẦN thiết hay
THỪA. "FC chắc sẽ chặn thôi" là đúng loại giả định mà một chuyến bay thật sẽ
chứng minh là sai.

Mission: TAKEOFF 25 m -> WP 25 m -> WP **3 m** -> WP 25 m -> RTL. Waypoint thấp
kẹp giữa hai waypoint cao để độ cao tụt xuống rồi lên lại — nếu FC bay thật thì
đồ thị độ cao có một chữ V rõ ràng, không thể nhầm với nhiễu.

CHẠY TRONG WSL:
    /home/nghaiz/venv-ardupilot/bin/python3 scripts/sitl/run_mission_low_alt.py

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import contextlib
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
from harness import SitlError, SitlInstance, print_ket_qua  # noqa: E402

USE_DIR = "mission-low"
DO_CAO_CAO_M = 25.0
DO_CAO_THAP_M = 3.0
CANH_M = 50.0

# Ngưỡng MIN_ALT của dự án, khai trong backend/config.py. Waypoint 3 m nằm TRÊN
# ngưỡng này, nên nếu FC bay được thì backend vẫn phải tự kiểm cho mốc 2 m.
MIN_ALT_DU_AN_M = 2.0


def dung_mission(lat0: float, lon0: float) -> list[dict]:
    from pymavlink import mavutil

    chang = [
        (CANH_M, 0.0, DO_CAO_CAO_M),
        (CANH_M, CANH_M, DO_CAO_THAP_M),  # <- waypoint thấp, giữa hai cái cao
        (0.0, CANH_M, DO_CAO_CAO_M),
    ]
    # ITEM 0 LÀ HOME, KHÔNG PHẢI LỆNH — quy ước của ArduPilot.
    # Bỏ chỗ này thì `NAV_TAKEOFF` rơi vào ô home và FC coi như mission không có
    # lệnh cất cánh: vào AUTO từ dưới đất sẽ bị từ chối bằng
    # `Auto: Missing Takeoff Cmd` -> `Mode change to Auto failed: init failed`.
    # (Đo thật 22/09/2026. Runner chuỗi-7-mode KHÔNG lộ lỗi này vì ở đó máy bay
    # đã ở trên không rồi, mà kiểm tra takeoff chỉ áp dụng khi còn dưới đất.)
    items = [
        {
            "command": mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
            "frame": mavutil.mavlink.MAV_FRAME_GLOBAL,
            "x": int(lat0 * 1e7),
            "y": int(lon0 * 1e7),
            "z": 0.0,
            "current": 1,
            "autocontinue": 1,
        },
        {
            "command": mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
            "frame": mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
            "x": int(lat0 * 1e7),
            "y": int(lon0 * 1e7),
            "z": DO_CAO_CAO_M,
            "current": 0,
            "autocontinue": 1,
        },
    ]
    for bac_m, dong_m, alt in chang:
        lat, lon = harness.offset_latlon(lat0, lon0, bac_m, dong_m)
        items.append(
            {
                "command": mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
                "frame": mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
                "x": int(lat * 1e7),
                "y": int(lon * 1e7),
                "z": alt,
                "current": 0,
                "autocontinue": 1,
            }
        )
    items.append(
        {
            "command": mavutil.mavlink.MAV_CMD_NAV_RETURN_TO_LAUNCH,
            "frame": mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
            "x": 0,
            "y": 0,
            "z": 0,
            "current": 0,
            "autocontinue": 1,
        }
    )
    return items


def bay_va_do(sitl: SitlInstance) -> tuple[list[int], float | None]:
    """Chạy mission AUTO và đo độ cao thấp nhất TRÊN ĐÚNG CHẶNG có waypoint thấp.

    CỬA SỔ LẤY MẪU rất hẹp, và đó là điểm mấu chốt: chỉ từ lúc TỚI waypoint 2
    (cao 25 m) đến lúc TỚI waypoint 4 (cao 25 m) — đúng chặng đi xuống waypoint
    3 rồi leo trở lên.

    Bản đầu lấy mẫu suốt cả mission, kể cả đoạn RTL HẠ CÁNH cuối. Đáy khi đó
    luôn là ~0 m vì máy bay chạm đất — BẤT KỂ FC có bay xuống waypoint thấp hay
    không. Phép đo đó không phân biệt được hai khả năng nó sinh ra để phân
    biệt, nên con số "-0,0 m" nó cho KHÔNG chứng minh điều gì.
    (Tự bắt được 22/09/2026.)
    """
    sitl.start_auto_mission()
    da_toi: list[int] = []
    day: float | None = None

    t0 = time.monotonic()
    while time.monotonic() - t0 < 480:
        msg = sitl.recv_match("MISSION_ITEM_REACHED", timeout=2.0)
        if msg is not None and msg.seq not in da_toi:
            da_toi.append(msg.seq)
        if 2 in da_toi and 4 not in da_toi:
            with contextlib.suppress(SitlError):
                alt = sitl.get_position()["alt_rel_m"]
                day = alt if day is None else min(day, alt)
        # seq: 0=home, 1=TAKEOFF, 2..4=WAYPOINT, 5=RTL
        hb = sitl.master.messages.get("HEARTBEAT")
        if hb is not None and not (hb.base_mode & 128) and len(da_toi) >= 3:
            break

    sitl.wait_disarmed(timeout=240.0)
    return da_toi, day


def ket_luan_phase_07(day: float | None) -> tuple[bool, str]:
    """Diễn giải số đo. Tách riêng để câu kết luận không bao giờ mạnh hơn số đo.

    Cận dưới 0,5 m: nếu đáy vẫn ~0 thì phép đo lại dính đoạn hạ cánh chứ không
    phải waypoint thấp — khi đó TỪ CHỐI kết luận thay vì báo bừa.
    """
    dat = day is not None and 0.5 < day < DO_CAO_THAP_M + 3.0
    if dat:
        return True, (
            f"FC NHẬN và BAY waypoint {DO_CAO_THAP_M:.0f} m (xuống tới {day:.1f} m) "
            f"— nó KHÔNG kiểm hộ độ cao tối thiểu, nên `validate_mission()` ở "
            f"backend là BẮT BUỘC, không phải thừa"
        )
    return False, (
        "Chưa kết luận được: độ cao đáy nằm ngoài dải tin được (xem số đo ở "
        "trên). Đừng suy ra điều gì về việc backend có được tin FC hay không."
    )


def main() -> int:
    ket_qua: list[tuple[str, str]] = []

    with SitlInstance(harness.run_dir(USE_DIR), speedup=8) as sitl:
        sitl.wait_ready()
        home = sitl.get_position()
        items = dung_mission(home["lat"], home["lon"])

        # Câu hỏi 1: FC có TỪ CHỐI ngay lúc nạp không?
        try:
            harness.upload_mission(sitl, items)
        except SitlError as exc:
            ket_qua.append(
                (f"FC nhận mission có waypoint {DO_CAO_THAP_M:.0f} m?", f"TỪ CHỐI — {exc}")
            )
            print_ket_qua(ket_qua, title="Mission waypoint thấp 3 m (Phase 03)")
            # Cũng là một câu trả lời hợp lệ, chỉ là câu trả lời KHÁC.
            print("FC từ chối mission ngay lúc nạp — kết luận Phase 07 đổi hướng", file=sys.stderr)
            return 1

        ket_qua.append((f"FC nhận mission có waypoint {DO_CAO_THAP_M:.0f} m?", "NHẬN"))
        doc_lai = harness.download_mission(sitl)
        ket_qua.append(
            (
                "Độ cao từng item đọc lại từ FC",
                str([round(float(d.get("z", 0)), 1) for d in doc_lai]),
            )
        )

        # Câu hỏi 2: nó có BAY XUỐNG thật không?
        da_toi, day = bay_va_do(sitl)

    ket_qua.append(("Waypoint đã tới (seq)", str(da_toi)))
    ket_qua.append(
        (
            "Độ cao THẤP NHẤT trên chặng waypoint 2→4 (chặng có WP thấp)",
            f"{day:.1f} m" if day is not None else "không đo được",
        )
    )
    dat, cau_ket = ket_luan_phase_07(day)
    ket_qua.append(("KẾT LUẬN cho Phase 07", cau_ket))
    ket_qua.append(
        (
            "MIN_ALT của dự án (backend/config.py)",
            f"{MIN_ALT_DU_AN_M:.0f} m — thấp hơn nữa phải chặn ở backend",
        )
    )
    print_ket_qua(ket_qua, title="Mission waypoint thấp 3 m (Phase 03)")

    if not da_toi:
        print("Mission không chạy waypoint nào", file=sys.stderr)
        return 1
    if not dat:
        print("Phép đo không nằm trong dải tin được — không kết luận", file=sys.stderr)
        return 1
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
