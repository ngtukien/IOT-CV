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

USE_DIR = "/tmp/sitl-mission-low"
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


def main() -> int:
    ket_qua: list[tuple[str, str]] = []

    with SitlInstance(USE_DIR, speedup=8) as sitl:
        sitl.wait_ready()
        home = sitl.get_position()
        lat0, lon0 = home["lat"], home["lon"]

        items = dung_mission(lat0, lon0)

        # Câu hỏi 1: FC có TỪ CHỐI lúc nạp không?
        nap_duoc = True
        loi_nap = ""
        try:
            harness.upload_mission(sitl, items)
        except SitlError as exc:
            nap_duoc = False
            loi_nap = str(exc)
        ket_qua.append(
            (
                f"FC nhận mission có waypoint {DO_CAO_THAP_M:.0f} m?",
                "NHẬN" if nap_duoc else f"TỪ CHỐI — {loi_nap[:120]}",
            )
        )

        alt_thap_nhat_khi_bay = None
        da_toi: list[int] = []
        if nap_duoc:
            doc_lai = harness.download_mission(sitl)
            alt_doc_lai = [round(float(d.get("z", 0)), 1) for d in doc_lai]
            ket_qua.append(("Độ cao từng item đọc lại từ FC", str(alt_doc_lai)))

            # Câu hỏi 2: nó có BAY XUỐNG thật không?
            sitl.start_auto_mission()

            # Chỉ lấy mẫu độ cao SAU khi đã qua waypoint 1 — trước đó máy bay
            # còn dưới đất, tính vào thì đáy luôn là 0 và phép đo vô nghĩa.
            t0 = time.monotonic()
            while time.monotonic() - t0 < 480:
                msg = sitl.recv_match("MISSION_ITEM_REACHED", timeout=2.0)
                if msg is not None and msg.seq not in da_toi:
                    da_toi.append(msg.seq)
                if da_toi:
                    with contextlib.suppress(SitlError):
                        alt = sitl.get_position()["alt_rel_m"]
                        if alt_thap_nhat_khi_bay is None:
                            alt_thap_nhat_khi_bay = alt
                        else:
                            alt_thap_nhat_khi_bay = min(alt_thap_nhat_khi_bay, alt)
                # seq: 0=home, 1=TAKEOFF, 2..4=WAYPOINT, 5=RTL
                hb = sitl.master.messages.get("HEARTBEAT")
                if hb is not None and not (hb.base_mode & 128) and len(da_toi) >= 3:
                    break

            ket_qua.append(("Waypoint đã tới (seq)", str(da_toi)))
            ket_qua.append(
                (
                    "Độ cao THẤP NHẤT khi đang bay mission",
                    f"{alt_thap_nhat_khi_bay:.1f} m"
                    if alt_thap_nhat_khi_bay is not None
                    else "không đo được",
                )
            )
            sitl.wait_disarmed(timeout=240.0)

    bay_xuong_that = (
        alt_thap_nhat_khi_bay is not None and alt_thap_nhat_khi_bay < DO_CAO_THAP_M + 3.0
    )
    ket_qua.append(
        (
            "KẾT LUẬN cho Phase 07",
            (
                f"FC NHẬN và BAY waypoint {DO_CAO_THAP_M:.0f} m (xuống tới "
                f"{alt_thap_nhat_khi_bay:.1f} m) — nó KHÔNG kiểm hộ độ cao tối thiểu, "
                f"nên `validate_mission()` ở backend là BẮT BUỘC, không phải thừa"
            )
            if bay_xuong_that
            else (
                "FC không bay xuống thấp như mission yêu cầu — xem số đo ở trên "
                "trước khi kết luận backend được phép tin FC"
            ),
        )
    )
    ket_qua.append(
        (
            "MIN_ALT của dự án (backend/config.py)",
            f"{MIN_ALT_DU_AN_M:.0f} m — thấp hơn nữa phải chặn ở backend",
        )
    )
    print_ket_qua(ket_qua, title="Mission waypoint thấp 3 m (Phase 03)")

    if not nap_duoc:
        # Không phải lỗi runner: đây cũng là một câu trả lời hợp lệ, chỉ là
        # câu trả lời KHÁC. Ghi rõ rồi thoát khác 0 để người đọc phải xem.
        print("FC từ chối mission ngay lúc nạp — kết luận Phase 07 đổi hướng", file=sys.stderr)
        return 1
    if not da_toi:
        print("Mission không chạy waypoint nào", file=sys.stderr)
        return 1
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
