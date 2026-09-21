#!/usr/bin/env python3
"""Runner 2/5 — thí nghiệm RTL_ALT 15 m so với 50 m (Phase 03, việc 03.5).

Plan giao bài: *"đổi `RTL_ALT` từ mặc định sang `5000` (50 m), bay lại, **mô tả
bằng lời** sự khác biệt quan sát được"*. Runner này ĐO sự khác biệt đó thay vì
bắt người học ngồi nhìn hai lần.

Cách đo: bay cùng một kịch bản HAI lần, chỉ khác mỗi `RTL_ALT`, rồi so ĐỘ CAO
ĐỈNH mà máy bay đạt tới trong lúc RTL.

    cất cánh 20 m -> bay ra ~60 m -> RTL -> theo dõi độ cao tới khi disarm

Điều đáng học nằm ở chỗ này: `RTL_ALT` là độ cao TỐI THIỂU để bay về, không
phải độ cao bắt buộc. Đang ở 20 m mà `RTL_ALT` = 15 m thì máy bay KHÔNG hạ
xuống 15 m — nó bay về ở nguyên 20 m. Còn `RTL_ALT` = 50 m thì nó phải LEO lên
50 m trước đã. Đó mới là "sự khác biệt quan sát được" mà bài tập hỏi.

╔══════════════════════════════════════════════════════════════════════════╗
║  TÊN THAM SỐ ĐÃ ĐỔI — plan việc 03.2 và 03.5 ghi theo firmware CŨ        ║
║                                                                          ║
║  Plan viết `RTL_ALT`, đơn vị centimet, đặt 1500 / 5000. ĐO THẬT trên     ║
║  ArduCopter 4.7.1 (22/09/2026): tham số `RTL_ALT` KHÔNG CÒN TỒN TẠI.     ║
║  Liệt kê cả 1370 tham số của FC, nhóm RTL* chỉ có:                       ║
║                                                                          ║
║      RTL_ALT_M = 15.0   <- thay cho RTL_ALT, đơn vị MÉT                  ║
║      RTL_ALT_FINAL_M · RTL_CLIMB_MIN_M · RTL_SPEED_MS · RTL_ALT_TYPE     ║
║      RTL_CONE_SLOPE · RTL_LOIT_TIME · RTL_OPTIONS                        ║
║                                                                          ║
║  ArduPilot 4.7 đã chuyển sang hậu tố đơn vị SI tường minh (`_M`, `_MS`). ║
║  Nên 1500 cm -> 15 m và 5000 cm -> 50 m: cùng con số vật lý, khác tên     ║
║  tham số và khác đơn vị.                                                 ║
║                                                                          ║
║  Runner tự dò cả hai tên để còn chạy được trên firmware cũ — xem          ║
║  `chon_ten_tham_so()`.                                                   ║
╚══════════════════════════════════════════════════════════════════════════╝

CHẠY TRONG WSL:
    /home/nghaiz/venv-ardupilot/bin/python3 scripts/sitl/run_rtl_alt.py

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
from harness import SitlError, SitlInstance, print_ket_qua  # noqa: E402

USE_DIR = "rtl-alt"
DO_CAO_CAT_CANH_M = 20.0
KHOANG_BAY_RA_M = 60.0

# Hai mốc cần so, tính bằng MÉT. Plan ghi 1500/5000 centimet — cùng con số này.
RTL_ALT_THU_M = [15.0, 50.0]
DA_ARM = 0b1000_0000  # MAV_MODE_FLAG_SAFETY_ARMED


def chon_ten_tham_so(sitl: SitlInstance) -> tuple[str, float]:
    """Trả (tên tham số RTL alt của firmware này, hệ số đổi từ mét sang đơn vị của nó).

    ArduCopter >= 4.7 : `RTL_ALT_M`, đơn vị mét   -> hệ số 1
    ArduCopter <  4.7 : `RTL_ALT`,   đơn vị cm    -> hệ số 100
    """
    m = sitl.master
    for ten, he_so in (("RTL_ALT_M", 1.0), ("RTL_ALT", 100.0)):
        m.mav.param_request_read_send(m.target_system, m.target_component, ten.encode(), -1)
        het = time.monotonic() + 8.0
        while time.monotonic() < het:
            msg = m.recv_match(type="PARAM_VALUE", blocking=True, timeout=2.0)
            if msg is not None and msg.param_id.rstrip("\x00") == ten:
                print(f"[rtl_alt] firmware dùng {ten} (hiện {msg.param_value})", flush=True)
                return ten, he_so
    raise SitlError(
        "Firmware không có cả RTL_ALT_M lẫn RTL_ALT. Liệt kê tham số RTL* rồi "
        "cập nhật `chon_ten_tham_so()` — đừng đoán tên."
    )


def bay_mot_luot(
    sitl: SitlInstance, ten_ts: str, he_so: float, rtl_alt_m: float, lat0: float, lon0: float
) -> dict:
    """Một lượt: đặt RTL alt, cất cánh, bay ra xa, RTL, đo độ cao đỉnh."""
    sitl.set_param(ten_ts, rtl_alt_m * he_so)

    sitl.wait_ready()
    sitl.set_mode("GUIDED")
    sitl.arm()
    # ĐỌC LẠI home SAU KHI ARM. ArduPilot đặt lại home ở MỖI lần arm, nên lượt
    # thứ hai có home tại chỗ lượt đầu vừa hạ, không phải điểm xuất phát ban
    # đầu. Dùng `lat0/lon0` cho cả hai lượt là đo lượt hai bằng thước của lượt
    # một — đúng cái bẫy đã sập ở `run_mode_chain.py` và được ghi lại ở đó.
    home = sitl.get_position()
    lat_home, lon_home = home["lat"], home["lon"]
    sitl.takeoff(DO_CAO_CAT_CANH_M)
    alt_truoc_rtl = sitl.get_position()["alt_rel_m"]

    # Bay ra xa để RTL có quãng đường mà leo.
    bac, dong = harness.offset_latlon(lat_home, lon_home, KHOANG_BAY_RA_M, 0.0)
    sitl.master.mav.set_position_target_global_int_send(
        0,
        sitl.master.target_system,
        sitl.master.target_component,
        harness.mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
        0b0000_1111_1111_1000,
        int(bac * 1e7),
        int(dong * 1e7),
        DO_CAO_CAT_CANH_M,
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
    xa = 0.0
    while time.monotonic() - t0 < 120:
        p = sitl.get_position()
        xa = harness.haversine_m(lat_home, lon_home, p["lat"], p["lon"])
        if xa >= KHOANG_BAY_RA_M * 0.8:
            break

    sitl.set_mode("RTL")
    # Lấy mẫu độ cao suốt RTL. Đỉnh của chuỗi này CHÍNH LÀ số cần so sánh.
    alt_dinh = sitl.get_position()["alt_rel_m"]
    t0 = time.monotonic()
    while time.monotonic() - t0 < 300:
        hb = sitl.master.messages.get("HEARTBEAT")
        armed = bool(hb.base_mode & DA_ARM) if hb else True
        if not armed:
            break
        alt_dinh = max(alt_dinh, sitl.get_position()["alt_rel_m"])
        sitl.recv_match("HEARTBEAT", timeout=1.0)
    sitl.wait_disarmed(timeout=120.0)

    p = sitl.get_position()
    return {
        "rtl_alt_m": rtl_alt_m,
        "alt_truoc_rtl_m": alt_truoc_rtl,
        "alt_dinh_m": alt_dinh,
        "xa_nhat_m": xa,
        "lech_ve_m": harness.haversine_m(lat_home, lon_home, p["lat"], p["lon"]),
    }


def main() -> int:
    ket_qua: list[tuple[str, str]] = []
    luot: list[dict] = []

    with SitlInstance(harness.run_dir(USE_DIR), speedup=5) as sitl:
        sitl.wait_ready()
        home = sitl.get_position()
        lat0, lon0 = home["lat"], home["lon"]

        ten_ts, he_so = chon_ten_tham_so(sitl)
        ket_qua.append(
            ("Tham số firmware dùng", f"{ten_ts} (đơn vị {'mét' if he_so == 1 else 'cm'})")
        )

        for rtl_alt_m in RTL_ALT_THU_M:
            r = bay_mot_luot(sitl, ten_ts, he_so, rtl_alt_m, lat0, lon0)
            luot.append(r)
            ket_qua.append(
                (
                    f"{ten_ts} = {rtl_alt_m * he_so:.0f} ({rtl_alt_m:.0f} m)",
                    f"trước RTL {r['alt_truoc_rtl_m']:.1f} m · ĐỈNH khi RTL "
                    f"{r['alt_dinh_m']:.1f} m · ra xa {r['xa_nhat_m']:.0f} m · "
                    f"về lệch {r['lech_ve_m']:.1f} m",
                )
            )

    thap, cao = luot[0], luot[1]
    chenh = cao["alt_dinh_m"] - thap["alt_dinh_m"]
    ket_qua.append(("Chênh lệch độ cao đỉnh", f"{chenh:.1f} m"))
    ket_qua.append(
        (
            "Kết luận (câu trả lời cho bài tập 03.5)",
            f"{ten_ts} là độ cao TỐI THIỂU, không phải bắt buộc: ở "
            f"{thap['rtl_alt_m']:.0f} m máy bay đang cao hơn ngưỡng nên KHÔNG leo "
            f"(đỉnh {thap['alt_dinh_m']:.1f} m ≈ độ cao đang bay); ở "
            f"{cao['rtl_alt_m']:.0f} m nó phải leo lên trước khi về "
            f"(đỉnh {cao['alt_dinh_m']:.1f} m)",
        )
    )
    print_ket_qua(ket_qua, title="Thí nghiệm RTL_ALT (Phase 03, việc 03.5)")

    # Cổng: RTL_ALT cao PHẢI làm máy bay leo cao hơn hẳn. Không thì hoặc tham số
    # không vào, hoặc phép đo sai — cả hai đều là hỏng, không phải "gần đúng".
    if chenh < 15.0:
        print(
            f"Chênh lệch chỉ {chenh:.1f} m, chờ đợi ≥ 15 m — {ten_ts} có vẻ không có tác dụng",
            file=sys.stderr,
        )
        return 1
    if cao["alt_dinh_m"] < cao["rtl_alt_m"] * 0.9:
        print(
            f"{ten_ts}={cao['rtl_alt_m']:.0f} m nhưng đỉnh chỉ {cao['alt_dinh_m']:.1f} m",
            file=sys.stderr,
        )
        return 1
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
    # Bắt MỌI Exception, không riêng SitlError. README hứa "mã thoát khác 0 khi
    # hỏng, cắm được vào CI" — mà một AttributeError/OSError lọt ra ngoài thì
    # thoát bằng traceback trần, KHÔNG có dòng `KET QUA:` nào. Job CI quét
    # `KET QUA: FAIL` khi đó không thấy gì cả: không PASS, không FAIL.
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    except Exception as exc:  # noqa: BLE001
        import traceback

        traceback.print_exc()
        print(f"KET QUA: FAIL — lỗi ngoài dự kiến: {exc!r}", file=sys.stderr)
        raise SystemExit(1) from exc
