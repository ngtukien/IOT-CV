#!/usr/bin/env python3
"""Runner 3/5 — mission 5 waypoint chạy AUTO (Phase 03, việc 03.4).

Plan giao: `TAKEOFF` → 3 × `WAYPOINT` → `RTL`, chạy ở mode AUTO, và `wp list`
phải khớp với bảng trong Mission Planner. Runner này nạp mission bằng ĐÚNG
giao thức MAVLink (MISSION_COUNT → MISSION_REQUEST_INT → MISSION_ITEM_INT →
MISSION_ACK), đọc ngược lại để đối chiếu, rồi bay thật.

Đọc ngược là phần quan trọng nhất, không phải phần trang trí: "đã gửi" và "FC
đã nhận đúng" là hai chuyện khác nhau, và Phase 07 sẽ viết lại đúng luồng này
ở backend web. Ở đó `mission.source` phân biệt `local` (chỉ có trong bộ nhớ
backend) với `readback` (đã đọc lại từ FC — đáng tin). Runner này là tham chiếu
đã chạy thật cho cái `readback` đó.

CHẠY TRONG WSL:
    /home/nghaiz/venv-ardupilot/bin/python3 scripts/sitl/run_mission_auto.py

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

USE_DIR = "mission-auto"
DO_CAO_M = 25.0
CANH_M = 60.0  # cạnh tam giác waypoint
DA_ARM = 0b1000_0000  # MAV_MODE_FLAG_SAFETY_ARMED

# Lệnh mission không mang lat/lon/alt, nên `frame` của chúng vô nghĩa và FC
# chuẩn hoá về GLOBAL(0) bất kể ta gửi gì. Xem chú thích trong `so_khop`.
LENH_KHONG_CO_TOA_DO = frozenset({20})  # MAV_CMD_NAV_RETURN_TO_LAUNCH


def dung_mission(lat0: float, lon0: float) -> list[dict]:
    """HOME + TAKEOFF -> 3 WAYPOINT (tam giác) -> RTL.

    Nạp 6 item nhưng chỉ 5 LỆNH, đúng như plan yêu cầu — item 0 là ô home theo
    quy ước ArduPilot, không phải một lệnh bay.
    """
    from pymavlink import mavutil

    goc = [(CANH_M, 0.0), (CANH_M, CANH_M), (0.0, CANH_M)]
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
            "z": DO_CAO_M,
            "current": 0,
            "autocontinue": 1,
        },
    ]
    for bac_m, dong_m in goc:
        lat, lon = harness.offset_latlon(lat0, lon0, bac_m, dong_m)
        items.append(
            {
                "command": mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
                "frame": mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
                "x": int(lat * 1e7),
                "y": int(lon * 1e7),
                "z": DO_CAO_M,
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


def so_khop(da_gui: list[dict], doc_lai: list[dict]) -> list[str]:
    """So item gửi đi với item đọc về. Trả danh sách chỗ lệch.

    So bốn trường mà `download_mission` mang về: `command`, `frame`, `x`, `y`,
    `z`. KHÔNG so `param1..4` — giao thức đọc ngược hiện chưa mang chúng về,
    nên đừng hứa điều mình không kiểm được.
    """
    lech: list[str] = []
    if len(da_gui) != len(doc_lai):
        lech.append(f"số item: gửi {len(da_gui)} đọc về {len(doc_lai)}")
        return lech
    for i, (g, d) in enumerate(zip(da_gui, doc_lai, strict=True)):
        if i == 0:
            # Item 0 là ô HOME: FC ghi đè bằng home THẬT của nó, nên so với cái
            # ta gửi là vô nghĩa. Chỉ kiểm nó có tồn tại (đã lọt vào vòng lặp).
            continue
        if g["command"] != d.get("command"):
            lech.append(f"item {i}: command {g['command']} != {d.get('command')}")
        # `frame` LÀ trường phải so. Mission gửi đi GLOBAL_RELATIVE_ALT mà đọc
        # về GLOBAL thì `z` vẫn khớp về SỐ, còn máy bay thì bay ở một độ cao
        # hoàn toàn khác — đó chính là lỗi nạp mission kinh điển, và bỏ nó ra
        # khỏi phép so là làm phép so mù đúng chỗ nguy hiểm nhất.
        #
        # Trừ các lệnh KHÔNG MANG TOẠ ĐỘ. Thêm phép so này vào là bắt được ngay
        # (22/09/2026): gửi `NAV_RETURN_TO_LAUNCH` với frame 3
        # (GLOBAL_RELATIVE_ALT), FC trả về frame 0 (GLOBAL). Không phải nạp
        # sai — với lệnh không có lat/lon/alt thì frame vô nghĩa và ArduPilot
        # chuẩn hoá nó về 0. GHI CHO PHASE 07: backend đọc ngược mission phải
        # biết chuyện này, nếu không nó sẽ báo "mission lệch" trên một mission
        # hoàn toàn đúng.
        if g["command"] not in LENH_KHONG_CO_TOA_DO and g["frame"] != d.get("frame"):
            lech.append(f"item {i}: frame {g['frame']} != {d.get('frame')}")
        # Toạ độ so theo số nguyên 1e7; sai 1 đơn vị là ~1 cm, không đáng kể,
        # nhưng lệch hơn 10 đơn vị (~10 cm) thì là nạp sai chứ không phải làm tròn.
        for truc in ("x", "y"):
            if abs(int(g[truc]) - int(d.get(truc, 0))) > 10:
                lech.append(f"item {i}: {truc} {g[truc]} != {d.get(truc)}")
        if abs(float(g["z"]) - float(d.get("z", 0))) > 0.5:
            lech.append(f"item {i}: z {g['z']} != {d.get('z')}")
    return lech


def main() -> int:
    ket_qua: list[tuple[str, str]] = []

    with SitlInstance(harness.run_dir(USE_DIR), speedup=8) as sitl:
        sitl.wait_ready()
        home = sitl.get_position()
        lat0, lon0 = home["lat"], home["lon"]

        items = dung_mission(lat0, lon0)
        harness.upload_mission(sitl, items)
        doc_lai = harness.download_mission(sitl)
        lech = so_khop(items, doc_lai)
        ket_qua.append(("Nạp mission", f"{len(items)} item ({len(items) - 1} lệnh + 1 ô home)"))
        ket_qua.append(
            (
                "Đọc lại từ FC khớp command/frame/x/y/z",
                "khớp" if not lech else f"LỆCH: {lech}",
            )
        )

        sitl.start_auto_mission()

        # Theo dõi waypoint nào đã tới. MISSION_ITEM_REACHED là bằng chứng FC
        # THẬT SỰ bay qua từng điểm, khác hẳn "đã vào mode AUTO".
        da_toi: list[int] = []
        alt_dinh = 0.0
        t0 = time.monotonic()
        while time.monotonic() - t0 < 420:
            msg = sitl.recv_match("MISSION_ITEM_REACHED", timeout=3.0)
            if msg is not None and msg.seq not in da_toi:
                da_toi.append(msg.seq)
            with contextlib.suppress(SitlError):
                alt_dinh = max(alt_dinh, sitl.get_position()["alt_rel_m"])
            hb = sitl.master.messages.get("HEARTBEAT")
            if hb is not None and not (hb.base_mode & DA_ARM) and da_toi:
                break

        ket_qua.append(("Waypoint đã tới (seq)", str(da_toi) if da_toi else "KHÔNG CÓ"))
        ket_qua.append(("Độ cao đỉnh", f"{alt_dinh:.1f} m"))

        sitl.wait_disarmed(timeout=180.0)
        cuoi = sitl.get_position()
        ve_lech = harness.haversine_m(lat0, lon0, cuoi["lat"], cuoi["lon"])
        ket_qua.append(("RTL cuối mission, về cách home", f"{ve_lech:.1f} m"))

    print_ket_qua(ket_qua, title="Mission 5 waypoint chạy AUTO (Phase 03, việc 03.4)")

    if lech:
        print(f"Mission đọc lại không khớp: {lech}", file=sys.stderr)
        return 1
    # 3 waypoint giữa PHẢI được ghé qua. Chỉ vào mode AUTO rồi hạ thì không tính.
    # seq: 0=home, 1=TAKEOFF, 2..4=WAYPOINT, 5=RTL.
    if len([s for s in da_toi if 2 <= s <= 4]) < 3:
        print(f"Chỉ tới {da_toi}, cần đủ seq 2..4", file=sys.stderr)
        return 1
    if ve_lech > 10.0:
        print(f"RTL cuối mission về lệch {ve_lech:.1f} m", file=sys.stderr)
        return 1
    # `harness.start_auto_mission` gọi thẳng "độ cao đỉnh là 0,0 m" là TRIỆU
    # CHỨNG của mission không chạy. Đã biết vậy thì phải chặn, không chỉ in ra.
    if alt_dinh < DO_CAO_M * 0.9:
        print(f"Độ cao đỉnh chỉ {alt_dinh:.1f} m, chờ đợi ≈ {DO_CAO_M} m", file=sys.stderr)
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
