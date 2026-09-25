#!/usr/bin/env python3
"""Runner Phase 04 (việc 04.4–04.5) — TFmini Plus ảo và AVOID phanh máy bay.

Dự án CHỈ có một cảm biến khoảng cách: Benewake TFmini Plus, một tia, nhìn
thẳng trước, trên SERIAL3 (chủ dự án chốt 25/09/2026 — không LD06, không lidar
360°, không rangefinder analog). SITL có sẵn `sim:benewake_tfmini`, nên runner
thử ĐÚNG cấu hình drone thật: nạp NGUYÊN file
`firmware/ardupilot/params/obstacle-avoidance-tfminiplus-serial3.param`.

Hai kịch bản, cùng một bài bay (LOITER, giữ `rc 2 1300` về phía một cột ảo):

    doi-chung    file avoid + AVOID_ENABLE 0 -> PHẢI bay xuyên qua cột.
                 Không có nó thì "đã dừng" có thể do bất cứ gì khác (cần không
                 vào, hết quãng, LOITER không nhận RC...).
    tfmini-that  nguyên file avoid                -> phải tự dừng trước cột.

Vật cản ở đâu: SITL dựng một lưới 20x20 cột, bán kính 1 m, cách nhau 10 m,
gốc cố định tại 51.8752066, 14.6487830 (libraries/SITL/SITL.cpp,
`post_origin` và `measure_distance_at_angle_bf`). Cột (x, y) ở
(x*10+3 m bắc, y*10+2 m đông). Rangefinder ảo có hướng NGANG (SIM_SONAR_ROT 0)
đo tới chính lưới cột này.

Toạ độ plan đưa (51.8752066, 14.6487840) rơi GIỮA lưới, cách cột gần nhất
3,6 m. Runner cất cánh ở phía NAM lưới, thẳng hàng với cột (-10, 0): cách tâm
cột 23 m, cách bề mặt 22 m. Khoảng cách tới cột tính từ vị trí GPS, KHÔNG lấy
từ chính cảm biến đang bị thử — và chính nhờ thế mà đo được TFmini ảo đọc lệch
bao nhiêu.

Ba chỗ SITL phải "đi dây" cho giống board, nếu không bộ param dự án tự làm hỏng
mô phỏng (đo thật, xem run_param_load.py):
  - GPS ảo nằm cứng ở SERIAL3 -> dời sang SERIAL4 (`--serial4=GPS1`).
  - `SIM_SONAR_ROT 0`: rangefinder ảo mặc định nhìn XUỐNG.
  - Chỉ MỘT cờ `-A`: nhiều cờ thì cờ sau đè cờ trước.

CHẠY TRONG WSL:
    ~/venv-ardupilot/bin/python3 scripts/sitl/run_avoid_brake.py
    ~/venv-ardupilot/bin/python3 scripts/sitl/run_avoid_brake.py --chi tfmini-that

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
from harness import SitlError, SitlInstance, print_ket_qua  # noqa: E402

USE_DIR = "avoid-brake"
PARAMS_DIR = harness.REPO_ROOT / "firmware" / "ardupilot" / "params"
AVOID_FILE = PARAMS_DIR / "obstacle-avoidance-tfminiplus-serial3.param"
SNAPSHOT = PARAMS_DIR / "sitl" / "02-sitl-avoid.param"
ANH = harness.REPO_ROOT / "docs" / "so-tay" / "anh" / "04-avoid-phanh.png"
SPEEDUP = 2

SITL_DI_DAY = "--serial3=sim:benewake_tfmini --serial4=GPS1"
SITL_THAY_PARAM = {"SIM_SONAR_ROT": 0}

# -- hình học lưới cột (sao y libraries/SITL/SITL.cpp) ---------------------
GOC_COT = (51.8752066, 14.6487830)
BAN_KINH_COT_M = 1.0
COT = [(x * 10 + 3.0, y * 10 + 2.0) for x in range(-10, 10) for y in range(-10, 10)]
COT_DICH_BAC = -97.0  # cột (-10, 0): hàng đầu tiên phía nam
XUAT_PHAT_NE = (-120.0, 2.0)  # thẳng hàng với cột đích
DO_CAO_MAT_DAT = 54.15

# -- bài bay -------------------------------------------------------------
DO_CAO_BAY_M = 10.0
PWM_TIEN = 1300  # đúng lệnh `rc 2 1300` của plan
GIU_CAN_S = 40.0  # thời gian mô phỏng, đọc từ time_boot_ms

KICH_BAN = {
    "doi-chung": {"them": {"AVOID_ENABLE": 0}, "ky_vong": "xuyen"},
    "tfmini-that": {"them": {}, "ky_vong": "phanh"},
}
MAU_SAC = {"doi-chung": "#c0392b", "tfmini-that": "#1e8449"}


def ne(lat: float, lon: float) -> tuple[float, float]:
    """Toạ độ (bắc, đông) tính bằng mét so với gốc lưới cột."""
    r = 6378137.0
    n = math.radians(lat - GOC_COT[0]) * r
    e = math.radians(lon - GOC_COT[1]) * r * math.cos(math.radians(GOC_COT[0]))
    return n, e


def khoang_cach_be_mat(n: float, e: float) -> float:
    return min(math.hypot(n - cn, e - ce) for cn, ce in COT) - BAN_KINH_COT_M


def extra_args() -> list[str]:
    lat, lon = harness.offset_latlon(GOC_COT[0], GOC_COT[1], *XUAT_PHAT_NE)
    return ["-l", f"{lat:.7f},{lon:.7f},{DO_CAO_MAT_DAT},0", "-A", SITL_DI_DAY]


def ap_dung(d: Path, param: dict[str, float]) -> list[str]:
    """Đặt tham số qua các lần reboot — tham số con (RNGFND1_ORIENT/MIN/MAX) chỉ
    xuất hiện sau khi RNGFND1_TYPE đã bật + reboot. Trả tên không bao giờ tồn tại."""
    con = dict(param)
    for luot in range(3):
        with SitlInstance(
            d, speedup=SPEEDUP, wipe_eeprom=(luot == 0), extra_args=extra_args()
        ) as sitl:
            co_san = sitl.fetch_all_params()
            for ten in [t for t in con if t in co_san]:
                sitl.set_param(ten, con.pop(ten))
        if not con:
            break
    return sorted(con)


class BoGhiMau:
    """Gom các gói MAVLink thành từng mẫu, mỗi gói vị trí là một mẫu. Tốc độ và
    số TFmini đến ở gói riêng, nên giữ giá trị mới nhất của chúng tới khi có
    gói vị trí kế tiếp."""

    def __init__(self, sitl: SitlInstance) -> None:
        self.sitl = sitl
        self.mau: list[dict] = []
        self.xong = False
        self._gs = 0.0
        self._tfmini: tuple[float, float] | None = None  # (lúc nhận, mét)
        self._t0: float | None = None

    def nhan(self, m) -> None:
        loai = m.get_type()
        if loai == "STATUSTEXT":
            self.sitl.statustext_log.append(m.text)
        elif loai == "VFR_HUD":
            self._gs = m.groundspeed
        elif loai == "DISTANCE_SENSOR" and m.orientation == 0:
            # orientation 0 = nhìn thẳng trước = TFmini (RNGFND1_ORIENT 0)
            self._tfmini = (time.monotonic(), m.current_distance / 100)
        elif loai == "GLOBAL_POSITION_INT":
            self._them_mau(m)

    def _them_mau(self, m) -> None:
        t = m.time_boot_ms / 1000
        self._t0 = t if self._t0 is None else self._t0
        n, e = ne(m.lat / 1e7, m.lon / 1e7)
        moi = self._tfmini is not None and time.monotonic() - self._tfmini[0] < 1.0
        self.mau.append(
            {
                "t": round(t - self._t0, 2),
                "bac_m": round(n, 2),
                "dong_m": round(e, 2),
                "toc_do_ms": round(self._gs, 2),
                "be_mat_cot_m": round(khoang_cach_be_mat(n, e), 2),
                "tfmini_m": self._tfmini[1] if moi else None,
                "cao_m": round(m.relative_alt / 1000, 2),
            }
        )
        self.xong = t - self._t0 >= GIU_CAN_S or n > COT_DICH_BAC + 10


def bay_toi_cot(sitl: SitlInstance) -> list[dict]:
    """LOITER, giữ cần tiến GIU_CAN_S giây mô phỏng, lấy mẫu mỗi gói vị trí."""
    sitl.wait_ready(timeout=150)
    sitl.set_mode("GUIDED")
    sitl.arm()
    sitl.takeoff(DO_CAO_BAY_M)
    sitl.set_mode("LOITER")
    giua = {1: 1500, 2: 1500, 3: 1500, 4: 1500}
    tien = {**giua, 2: PWM_TIEN}
    ghi = BoGhiMau(sitl)
    gui = 0.0
    while not ghi.xong:
        if time.monotonic() - gui > 0.2:
            sitl.rc_override(tien)
            gui = time.monotonic()
        m = sitl.master.recv_match(
            type=["GLOBAL_POSITION_INT", "VFR_HUD", "DISTANCE_SENSOR", "STATUSTEXT"],
            blocking=True,
            timeout=0.2,
        )
        if m is not None:
            ghi.nhan(m)
    sitl.rc_override(giua)
    return ghi.mau


def danh_gia(mau: list[dict], ky_vong: str, param: dict[str, float]) -> dict:
    rng_max = param.get("RNGFND1_MAX", 6.0)
    dist_max = param.get("AVOID_DIST_MAX", 5.0)
    vuot = max(s["bac_m"] for s in mau) > COT_DICH_BAC
    duoi = [s for s in mau if s["t"] >= mau[-1]["t"] - 5]
    cuoi = [s["be_mat_cot_m"] for s in mau if s["t"] >= mau[-1]["t"] - 20]
    # TFmini đọc lệch bao nhiêu: chỉ so khi cột nằm trong tầm (RNGFND1_MAX).
    cap = [
        (s["tfmini_m"], s["be_mat_cot_m"])
        for s in mau
        if s["tfmini_m"] is not None and 0 < s["be_mat_cot_m"] < rng_max - 0.2
    ]
    kq = {
        "vuot_qua_cot": vuot,
        "be_mat_min_m": min(s["be_mat_cot_m"] for s in mau),
        "toc_do_5s_cuoi_ms": round(sum(s["toc_do_ms"] for s in duoi) / len(duoi), 2),
        "dao_dong_20s_cuoi_m": [min(cuoi), max(cuoi)],
        "giu_can_s": mau[-1]["t"],
        "tfmini_so_mau_trong_tam": len(cap),
        "tfmini_lech_tb_m": round(sum(abs(a - b) for a, b in cap) / len(cap), 2) if cap else None,
    }
    if ky_vong == "xuyen":
        kq["dat"] = vuot
    else:
        # "Phanh" = bị CHẶN trước cột dù vẫn giữ cần: không vượt, không sát hơn
        # 0,8 m, và 20 s cuối vẫn bị giữ trong vùng phản ứng AVOID_DIST_MAX (5 m).
        # KHÔNG đòi tốc độ ~0: file dự án đặt AVOID_BACKUP_SPD 0.75 nên máy bay
        # CỐ Ý lùi lại khi lấn vào margin -> dao động tới/lùi là hành vi thiết
        # kế, được ghi thành số đo (dao_dong_20s_cuoi_m, toc_do_5s_cuoi_ms) chứ
        # không phải điều kiện đạt. Đo 25/09/2026: dao động 1,3–3,1 m, chu kỳ ~4 s.
        kq["dat"] = (
            not vuot
            and kq["be_mat_min_m"] >= 0.8
            and max(cuoi) <= dist_max
            and kq["giu_can_s"] >= GIU_CAN_S - 0.5
            and len(cap) > 0
        )
    return kq


def thu(d: Path, ten: str, kb: dict) -> dict:
    param = dict(harness.read_param_file(AVOID_FILE))
    param.update(SITL_THAY_PARAM)
    param.update(kb["them"])
    thieu = ap_dung(d, param)
    with SitlInstance(d, speedup=SPEEDUP, wipe_eeprom=False, extra_args=extra_args()) as sitl:
        n0 = len(sitl.statustext_log)
        mau = bay_toi_cot(sitl)
        if ten == "tfmini-that":
            harness.write_param_file(
                SNAPSHOT,
                sitl.fetch_all_params(),
                [
                    "02 - file avoid cua du an (TFmini Plus SERIAL3) DA THAY PHANH "
                    "o LOITER tren SITL.",
                    "SITL ArduCopter 4.7.1 - KHONG nap len board that: co SIM_* va "
                    "GPS ao doi sang SERIAL4.",
                    f"Sinh boi scripts/sitl/run_avoid_brake.py, {time.strftime('%d/%m/%Y %H:%M')}.",
                ],
            )
        statustext = sitl.statustext_log[n0:][-8:]
    with (d / f"{ten}.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(mau[0]))
        w.writeheader()
        w.writerows(mau)
    return {
        "kich_ban": ten,
        "khong_ton_tai": thieu,
        "statustext": statustext,
        "mau": mau,
        **danh_gia(mau, kb["ky_vong"], param),
    }


def ve(ket: list[dict]) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, (a, b, c) = plt.subplots(1, 3, figsize=(16, 5.2))
    for cn, ce in COT:
        if -115 < cn < -80 and -12 < ce < 16:
            a.add_patch(plt.Circle((ce, cn), BAN_KINH_COT_M, color="#555"))
    for k in ket:
        m, mau_sac, ten = k["mau"], MAU_SAC[k["kich_ban"]], k["kich_ban"]
        a.plot([s["dong_m"] for s in m], [s["bac_m"] for s in m], color=mau_sac, label=ten)
        b.plot(
            [s["t"] for s in m], [s["be_mat_cot_m"] for s in m], color=mau_sac, label=f"{ten}: GPS"
        )
        tf = [s for s in m if s["tfmini_m"] is not None and s["be_mat_cot_m"] > 0]
        b.plot(
            [s["t"] for s in tf],
            [s["tfmini_m"] for s in tf],
            ".",
            ms=3,
            color=mau_sac,
            label=f"{ten}: TFmini ảo đọc",
        )
        c.plot([s["t"] for s in m], [s["toc_do_ms"] for s in m], color=mau_sac, label=ten)
    a.plot(XUAT_PHAT_NE[1], XUAT_PHAT_NE[0], "k^", label="xuất phát")
    a.set(
        xlim=(-12, 16),
        ylim=(-122, -80),
        aspect="equal",
        xlabel="đông (m)",
        ylabel="bắc (m)",
        title="Nhìn từ trên xuống (chấm xám = cột ảo)",
    )
    b.axhline(2.0, ls="--", color="#888", label="AVOID_MARGIN 2 m")
    b.axhline(0.0, color="k", lw=0.8)
    b.set(
        ylim=(-3, 24),
        xlabel="thời gian giữ cần (s)",
        ylabel="m",
        title="Khoảng cách tới bề mặt cột",
    )
    c.set(
        xlabel="thời gian giữ cần (s)", ylabel="m/s", title=f"Tốc độ — cần vẫn giữ rc 2 {PWM_TIEN}"
    )
    for ax in (a, b, c):
        ax.grid(alpha=0.3)
        ax.legend(fontsize=8)
    fig.suptitle(
        "Phase 04 — SITL ArduCopter 4.7.1, TFmini Plus ảo trên SERIAL3: "
        "AVOID phanh trước cột (telemetry thật)"
    )
    fig.tight_layout()
    ANH.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(ANH, dpi=110)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chi", default="", help="chỉ chạy các kịch bản này, cách nhau dấu phẩy")
    chi = {s for s in ap.parse_args().chi.split(",") if s}
    d = harness.run_dir(USE_DIR)

    ket = [thu(d, t, kb) for t, kb in KICH_BAN.items() if not chi or t in chi]
    if len(ket) == len(KICH_BAN):
        ve(ket)
    (d / "ket-qua.json").write_text(
        json.dumps(
            [{k: v for k, v in x.items() if k != "mau"} for x in ket], ensure_ascii=False, indent=2
        ),
        encoding="utf-8",
    )
    print_ket_qua(
        [
            (
                x["kich_ban"],
                json.dumps(
                    {k: v for k, v in x.items() if k not in ("mau", "kich_ban")}, ensure_ascii=False
                ),
            )
            for x in ket
        ],
        title="TFmini Plus ảo và AVOID (Phase 04, việc 04.4–04.5)",
    )
    hong = [x["kich_ban"] for x in ket if not x["dat"]]
    if hong:
        print(f"Không đạt: {hong}", file=sys.stderr)
        return 1
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
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
