#!/usr/bin/env python3
"""Runner 1/5 — chuỗi 7 mode ArduCopter (Phase 03, việc 03.3).

Chạy hết BẢY mode mà plan liệt kê ở bảng việc 03.3 và kiểm chứng từng cái có
tác dụng thật, thay cho việc gõ tay `mode guided` / `mode loiter`... trong
MAVProxy hàng chục lần:

    STABILIZE · ALT_HOLD · LOITER · GUIDED · AUTO · RTL · LAND

CHẠY TRONG WSL:
    /home/nghaiz/venv-ardupilot/bin/python3 scripts/sitl/run_mode_chain.py

Hai điểm về THỨ TỰ, cả hai đều học được bằng cách làm sai trước:

1. `STABILIZE` chỉ thử khi CÒN DƯỚI ĐẤT. Chuyển sang STABILIZE lúc đang bay mà
   không có cần ga ở giữa thì drone rơi tự do — chính là bẫy số 3 trong mục
   "Nếu lỗi" của việc 03.3. Máy bay ảo nên không ai việc gì, nhưng để nó rơi
   thì bài kiểm này chẳng chứng minh được gì.

2. `LAND` phải gọi RIÊNG, và cần HAI chuyến bay. Plan việc 03.3 (dòng 141) nói
   "sau `mode rtl`... mode phải tự chuyển sang `LAND` rồi `DISARMED`" — ĐO THẬT
   ngày 22/09/2026 cho thấy điều đó KHÔNG đúng với ArduCopter 4.7.1: RTL tự hạ
   và tự disarm NGAY TRONG mode RTL, mode không bao giờ đổi sang LAND.
   STATUSTEXT quan sát được: `SIM Hit ground at 0.50 m/s` -> `Disarming motors`,
   trong khi `get_mode_name()` vẫn trả `RTL` suốt 180 s.
   Nên: chuyến 1 kết thúc bằng LAND gọi tường minh, chuyến 2 kết thúc bằng RTL.

Máy bay ẢO hoàn toàn. Không có motor thật nào quay — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
from harness import SitlError, SitlInstance, print_ket_qua  # noqa: E402

DO_CAO_M = 20.0
USE_DIR = "/tmp/sitl-mode-chain"

# Mode bay thử khi ĐANG TRÊN KHÔNG, theo thứ tự. STABILIZE và LAND không nằm ở
# đây: xem hai điểm về thứ tự trong docstring.
CHUOI_TREN_KHONG = ["ALT_HOLD", "LOITER", "GUIDED"]


def mission_toi_thieu(lat_deg: float, lon_deg: float) -> list[dict]:
    """Một mission 2 item đủ để AUTO có việc mà làm.

    AUTO không có mission thì ArduPilot hoặc từ chối, hoặc vào rồi đứng im —
    cả hai đều không chứng minh được AUTO chạy.
    """
    from pymavlink import mavutil

    bac, dong = harness.offset_latlon(lat_deg, lon_deg, 30.0, 0.0)
    return [
        {
            "command": mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
            "frame": mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
            "x": int(lat_deg * 1e7),
            "y": int(lon_deg * 1e7),
            "z": DO_CAO_M,
            "current": 1,
            "autocontinue": 1,
        },
        {
            "command": mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
            "frame": mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
            "x": int(bac * 1e7),
            "y": int(dong * 1e7),
            "z": DO_CAO_M,
            "current": 0,
            "autocontinue": 1,
        },
    ]


def main() -> int:
    ket_qua: list[tuple[str, str]] = []
    da_qua: list[str] = []

    with SitlInstance(USE_DIR, speedup=5) as sitl:
        # --- 1. STABILIZE, dưới đất ---------------------------------------
        sitl.set_mode("STABILIZE")
        da_qua.append("STABILIZE")
        ket_qua.append(("STABILIZE (dưới đất)", "đạt"))

        # --- sẵn sàng bay --------------------------------------------------
        t0 = time.monotonic()
        sitl.wait_ready()
        ket_qua.append(("Chờ EKF + GPS sẵn sàng", f"{time.monotonic() - t0:.0f}s"))

        vi_tri_dau = sitl.get_position()
        lat0, lon0 = vi_tri_dau["lat"], vi_tri_dau["lon"]

        # --- 2. GUIDED + cất cánh ------------------------------------------
        sitl.set_mode("GUIDED")
        da_qua.append("GUIDED")
        sitl.arm()
        t0 = time.monotonic()
        sitl.takeoff(DO_CAO_M)
        ket_qua.append((f"GUIDED + takeoff {DO_CAO_M:.0f} m", f"{time.monotonic() - t0:.0f}s"))

        # --- 3. các mode trên không ----------------------------------------
        for ten in CHUOI_TREN_KHONG:
            t0 = time.monotonic()
            sitl.set_mode(ten)
            if ten not in da_qua:
                da_qua.append(ten)
            alt = sitl.get_position()["alt_rel_m"]
            ket_qua.append(
                (f"{ten} trên không", f"đạt sau {time.monotonic() - t0:.1f}s, alt {alt:.1f} m")
            )

        # --- 4. AUTO, có mission thật để chạy -------------------------------
        harness.upload_mission(sitl, mission_toi_thieu(lat0, lon0))
        doc_lai = harness.download_mission(sitl)
        ket_qua.append(("Mission tối thiểu nạp + đọc lại", f"{len(doc_lai)} item"))
        sitl.set_mode("AUTO")
        da_qua.append("AUTO")
        ket_qua.append(("AUTO", "đạt"))
        time.sleep(5)  # cho nó thật sự chạy waypoint, không chỉ vào mode rồi ra

        # --- 5. LAND, kết thúc chuyến 1 -------------------------------------
        sitl.set_mode("LAND")
        da_qua.append("LAND")
        t0 = time.monotonic()
        sitl.wait_disarmed(timeout=180.0)
        ket_qua.append(("LAND rồi tự DISARM", f"sau {time.monotonic() - t0:.0f}s"))

        # --- 6. Chuyến 2, ngắn, chỉ để thử RTL ------------------------------
        # RTL phải đi riêng một chuyến: nó là mode DUY NHẤT có tính chất "đưa
        # được máy bay VỀ chỗ cũ", mà tính chất đó chỉ kiểm được khi máy bay
        # đang ở xa home. Gộp chung với LAND thì mất luôn phép đo đó.
        sitl.wait_ready()
        sitl.set_mode("GUIDED")
        sitl.arm()

        # ĐỌC LẠI home SAU KHI ARM. ArduPilot đặt lại home ở MỖI lần arm, nên
        # home của chuyến 2 là chỗ chuyến 1 vừa hạ (cuối mission AUTO), KHÔNG
        # phải điểm xuất phát ban đầu. So RTL với `lat0/lon0` cho ra "lệch
        # 30,3 m" và làm tưởng RTL hỏng, trong khi RTL về đúng home của nó —
        # sai ở thước đo, không sai ở máy bay (đo được 22/09/2026).
        home2 = sitl.get_position()
        lat_h2, lon_h2 = home2["lat"], home2["lon"]
        sitl.takeoff(DO_CAO_M)

        # Bay ra xa home rồi mới gọi RTL, nếu không thì "về đúng chỗ" là hiển
        # nhiên và phép đo không chứng minh được gì.
        bac, dong = harness.offset_latlon(lat_h2, lon_h2, 40.0, 0.0)
        sitl.master.mav.set_position_target_global_int_send(
            0,
            sitl.master.target_system,
            sitl.master.target_component,
            harness.mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
            0b0000_1111_1111_1000,  # chỉ dùng 3 trường vị trí
            int(bac * 1e7),
            int(dong * 1e7),
            DO_CAO_M,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
        )
        t0 = time.monotonic()
        while time.monotonic() - t0 < 90:
            p = sitl.get_position()
            if harness.haversine_m(lat_h2, lon_h2, p["lat"], p["lon"]) >= 30.0:
                break
        xa_nhat = harness.haversine_m(lat_h2, lon_h2, p["lat"], p["lon"])
        ket_qua.append(("Bay ra xa home trước khi RTL", f"{xa_nhat:.0f} m"))

        sitl.set_mode("RTL")
        da_qua.append("RTL")
        t0 = time.monotonic()
        sitl.wait_disarmed(timeout=240.0)
        ket_qua.append(
            (
                "RTL tự hạ + DISARM (mode vẫn RTL, KHÔNG đổi sang LAND)",
                f"sau {time.monotonic() - t0:.0f}s",
            )
        )

        vi_tri_cuoi = sitl.get_position()
        lech = harness.haversine_m(lat_h2, lon_h2, vi_tri_cuoi["lat"], vi_tri_cuoi["lon"])
        ket_qua.append(("RTL về cách home CỦA CHUYẾN 2", f"{lech:.1f} m"))

    thieu = {"STABILIZE", "ALT_HOLD", "LOITER", "GUIDED", "AUTO", "RTL", "LAND"} - set(da_qua)
    ket_qua.insert(0, ("Số mode đã qua", f"{len(set(da_qua))}/7 — {', '.join(da_qua)}"))
    print_ket_qua(ket_qua, title="Chuỗi 7 mode (Phase 03, việc 03.3)")

    if thieu:
        print(f"THIẾU mode: {sorted(thieu)}", file=sys.stderr)
        return 1
    # RTL mà về lệch quá 10 m so với điểm cất cánh là RTL không làm đúng việc.
    if lech > 10.0:
        print(f"RTL về lệch {lech:.1f} m, quá 10 m", file=sys.stderr)
        return 1
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
