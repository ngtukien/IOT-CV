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
# Quét thư mục làm việc của các runner. `RUN_DIR_BASE` nằm dưới $HOME, không
# phải /tmp — xem chú thích ở `harness.RUN_DIR_BASE`.
THU_MUC_QUET = [
    *sorted(harness.RUN_DIR_BASE.glob("*/logs")),
    *sorted(harness.RUN_DIR_BASE.glob("*")),
    LOGS_DIR,
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
        tim = harness.find_latest_bin(THU_MUC_QUET)
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

    chuoi_mode = " → ".join(m["mode_ten"] for m in doi_mode)
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
| Số lần đổi mode | {len(doi_mode)} |
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
            ("Số lần đổi mode", str(len(doi_mode))),
            ("Chuỗi mode", chuoi_mode or "(không có)"),
            ("CSV độ cao", str(f_alt)),
            ("CSV đổi mode", str(f_mode)),
            ("Tóm tắt", str(f_tom)),
        ],
        title="Dump log .BIN ra CSV (Phase 03, việc 03.6)",
    )

    # Một log chuyến bay mà không có mẫu độ cao hoặc không có lần đổi mode nào
    # thì hoặc log rỗng, hoặc ta đọc sai loại bản ghi — cả hai đều không dùng
    # được cho việc "chỉ ra đồ thị độ cao VÀ các lần đổi mode".
    if not do_cao:
        print("Không rút được mẫu CTUN nào", file=sys.stderr)
        return 1
    if not doi_mode:
        print("Không rút được lần đổi mode nào", file=sys.stderr)
        return 1
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
