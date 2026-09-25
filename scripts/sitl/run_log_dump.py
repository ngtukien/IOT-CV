#!/usr/bin/env python3
"""Runner 5/5 — dump log `.BIN` của chuyến bay ra CSV (Phase 03, việc 03.6).

Plan đòi: *"Mở được log `.BIN` trên UAV Log Viewer; chỉ ra đồ thị độ cao **và**
các lần đổi mode"* (bảng việc 03.6: `CTUN.Alt` cho độ cao, `MODE` cho các lần
đổi mode). Runner này rút đúng hai thứ đó ra CSV để mở bằng Excel hay vẽ bằng
bất cứ công cụ nào — và để có một bản chép lại được, không phải ảnh chụp màn
hình một cái đồ thị.

KHÔNG tự bay. Nó đọc file `.BIN` mới nhất mà các runner khác đã sinh ra. Chạy
sau `run_mode_chain.py` hoặc `run_mission_auto.py`.

Xuất ra `logs/sitl/`:
    <tên-log>-alt.csv    time_s, alt_m, alt_baro_m, desired_alt_m
    <tên-log>-mode.csv   time_s, mode_num, mode_ten
    <tên-log>-tomtat.md  tóm tắt người đọc được

`logs/sitl/*.csv` bị .gitignore chặn (luật `logs/sitl/*`) — cố ý: đây là dữ
liệu bay, không phải mã nguồn. Chỉ `.gitkeep` được commit.

CHẠY TRONG WSL:
    /home/nghaiz/venv-ardupilot/bin/python3 scripts/sitl/run_log_dump.py [đường/dẫn.BIN]
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
from harness import LOGS_DIR, SitlError, print_ket_qua  # noqa: E402

# Thư mục các runner khác ghi log. `--use-dir` của sim_vehicle.py đặt log dưới
# <use-dir>/logs/, nên quét cả hai mức.
# Độ cao tối thiểu để coi một log là log CHUYẾN BAY. Dưới ngưỡng này thì máy
# bay chưa rời đất và cái "đồ thị độ cao" rút ra được là một đường thẳng ở 0.
ALT_TOI_THIEU_M = 5.0

# Quét thư mục làm việc của các runner. `RUN_DIR_BASE` nằm dưới $HOME, không
# phải /tmp — xem chú thích ở `harness.RUN_DIR_BASE`.
THU_MUC_QUET = [
    *sorted(harness.RUN_DIR_BASE.glob("*/logs")),
    *sorted(harness.RUN_DIR_BASE.glob("*")),
    LOGS_DIR,
]

# Log mặc định lấy của `run_mode_chain.py`: đó là runner DUY NHẤT bay qua nhiều
# mode, mà cổng pass 03.6 đòi chỉ ra CẢ đồ thị độ cao LẪN các lần đổi mode. Bản
# trước lấy .BIN mới nhất của bất kỳ runner nào — từ Phase 04 đó thường là log
# của run_avoid_brake.py, không có chuỗi đổi mode nào đáng xem.
THU_MUC_UU_TIEN = [
    harness.RUN_DIR_BASE / "mode-chain" / "logs",
    harness.RUN_DIR_BASE / "mode-chain",
]


def doc_log(duong_dan: Path) -> tuple[list[dict], list[dict]]:
    """Đọc .BIN, trả (các mẫu độ cao, các lần đổi mode)."""
    from pymavlink import mavutil

    log = mavutil.mavlink_connection(str(duong_dan))
    do_cao: list[dict] = []
    doi_mode: list[dict] = []
    goc_us: float | None = None

    while True:
        msg = log.recv_match(type=["CTUN", "MODE"])
        if msg is None:
            break
        thoi_diem_us = getattr(msg, "TimeUS", None)
        if thoi_diem_us is None:
            continue
        if goc_us is None:
            goc_us = thoi_diem_us
        giay = (thoi_diem_us - goc_us) / 1e6

        if msg.get_type() == "CTUN":
            do_cao.append(
                {
                    "time_s": round(giay, 3),
                    # CTUN.Alt là độ cao EKF so với home (m) — đúng thứ UAV Log
                    # Viewer vẽ. BAlt là độ cao khí áp, để đối chiếu.
                    "alt_m": round(getattr(msg, "Alt", 0.0), 3),
                    "alt_baro_m": round(getattr(msg, "BAlt", 0.0), 3),
                    "desired_alt_m": round(getattr(msg, "DAlt", 0.0), 3),
                }
            )
        else:  # MODE
            so = getattr(msg, "Mode", getattr(msg, "ModeNum", -1))
            doi_mode.append(
                {
                    "time_s": round(giay, 3),
                    "mode_num": so,
                    "mode_ten": harness.MODE_ID_TO_NAME.get(so, f"MODE_{so}"),
                }
            )
    return do_cao, doi_mode


def ghi_csv(duong_dan: Path, hang: list[dict]) -> None:
    if not hang:
        return
    with duong_dan.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(hang[0]))
        w.writeheader()
        w.writerows(hang)


def main() -> int:
    if len(sys.argv) > 1:
        log_bin = Path(sys.argv[1])
        if not log_bin.is_file():
            raise SitlError(f"Không thấy file {log_bin}")
    else:
        tim = harness.find_latest_bin(THU_MUC_UU_TIEN) or harness.find_latest_bin(THU_MUC_QUET)
        if tim is None:
            raise SitlError(
                "Không thấy file .BIN nào. Chạy một runner bay trước đã, ví dụ:\n"
                "  ~/venv-ardupilot/bin/python3 scripts/sitl/run_mode_chain.py\n"
                f"Đã quét: {[str(d) for d in THU_MUC_QUET]}"
            )
        log_bin = tim

    do_cao, doi_mode = doc_log(log_bin)

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    goc_ten = log_bin.stem
    f_alt = LOGS_DIR / f"{goc_ten}-alt.csv"
    f_mode = LOGS_DIR / f"{goc_ten}-mode.csv"
    f_tom = LOGS_DIR / f"{goc_ten}-tomtat.md"
    ghi_csv(f_alt, do_cao)
    ghi_csv(f_mode, doi_mode)

    # Gộp các bản ghi MODE liền nhau trùng giá trị. ArduPilot ghi MODE hai lần
    # lúc mở log, nên chuỗi thô hiện ra "AUTO → AUTO" — trông như một lần
    # chuyển tiếp trong khi không có lần nào. Giữ cả hai con số để người đọc
    # phân biệt được "bay một mode suốt" với "log chỉ có bản ghi khởi động".
    chuoi_gon: list[str] = []
    for m in doi_mode:
        if not chuoi_gon or chuoi_gon[-1] != m["mode_ten"]:
            chuoi_gon.append(m["mode_ten"])
    chuoi_mode = " → ".join(chuoi_gon)
    so_chuyen_tiep = max(0, len(chuoi_gon) - 1)
    alt_max = max((r["alt_m"] for r in do_cao), default=0.0)
    keo_dai = do_cao[-1]["time_s"] if do_cao else 0.0

    f_tom.write_text(
        f"""# Tóm tắt log {log_bin.name}

Sinh bởi `scripts/sitl/run_log_dump.py`. Đây là dữ liệu bay, không commit.

| Mục | Giá trị |
|---|---|
| File gốc | `{log_bin}` |
| Thời lượng | {keo_dai:.1f} s |
| Số mẫu độ cao (CTUN) | {len(do_cao)} |
| Độ cao lớn nhất | {alt_max:.1f} m |
| Bản ghi MODE | {len(doi_mode)} |
| Số lần ĐỔI mode thật | {so_chuyen_tiep} |
| Chuỗi mode | {chuoi_mode} |

## Mở bằng gì

- `{f_alt.name}` — đồ thị độ cao. Cột `alt_m` là `CTUN.Alt` (EKF, so với home),
  `alt_baro_m` là khí áp, `desired_alt_m` là độ cao MONG MUỐN. So `alt_m` với
  `desired_alt_m` thấy được máy bay bám lệnh tốt tới đâu.
- `{f_mode.name}` — mốc thời gian từng lần đổi mode, ghép được vào đồ thị trên.
- File `.BIN` gốc mở được bằng UAV Log Viewer (https://plot.ardupilot.org).
""",
        encoding="utf-8",
    )

    print_ket_qua(
        [
            ("File .BIN", str(log_bin)),
            ("Thời lượng", f"{keo_dai:.1f} s"),
            ("Mẫu độ cao (CTUN)", str(len(do_cao))),
            ("Độ cao lớn nhất", f"{alt_max:.1f} m"),
            ("Bản ghi MODE", str(len(doi_mode))),
            ("Số lần ĐỔI mode thật", str(so_chuyen_tiep)),
            ("Chuỗi mode", chuoi_mode or "(không có)"),
            *(
                [
                    (
                        "Lưu ý",
                        "Log này bay MỘT mode suốt (mission AUTO thường vậy) nên không "
                        "có lần đổi mode nào để vẽ. Muốn xem chuỗi đổi mode thì chỉ đích "
                        "danh log của run_mode_chain.py.",
                    )
                ]
                if so_chuyen_tiep == 0
                else []
            ),
            ("CSV độ cao", str(f_alt)),
            ("CSV đổi mode", str(f_mode)),
            ("Tóm tắt", str(f_tom)),
        ],
        title="Dump log .BIN ra CSV (Phase 03, việc 03.6)",
    )

    if not do_cao:
        print("Không rút được mẫu CTUN nào", file=sys.stderr)
        return 1
    if not doi_mode:
        print("Không rút được bản ghi MODE nào", file=sys.stderr)
        return 1
    # Cổng phải chứng minh ĐÂY LÀ LOG MỘT CHUYẾN BAY, không phải log máy bay
    # nằm dưới đất. Bản trước chỉ đòi "≥1 mẫu CTUN và ≥1 bản ghi MODE", nên nó
    # PASS trên hai log 24,9 s có độ cao lớn nhất -0,006 m — đúng loại báo xanh
    # không chứng minh được thứ nó sinh ra để chứng minh.
    if alt_max < ALT_TOI_THIEU_M:
        print(
            f"Độ cao lớn nhất chỉ {alt_max:.2f} m (cần ≥ {ALT_TOI_THIEU_M} m) — "
            "đây là log máy bay chưa rời mặt đất, không dùng cho đồ thị độ cao được. "
            "Chạy một runner bay trước, hoặc chỉ đích danh file .BIN.",
            file=sys.stderr,
        )
        return 1
    # Cổng 03.6 đòi "các lần đổi mode". Log bay một mode suốt không chỉ ra được
    # điều đó, nên không được PASS — bản trước chỉ in một dòng "Lưu ý" rồi vẫn xanh.
    if so_chuyen_tiep < 1:
        print(
            "Log không có lần đổi mode nào — không dùng cho cổng 03.6 được. "
            "Chạy run_mode_chain.py trước, hoặc chỉ đích danh log có đổi mode.",
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
