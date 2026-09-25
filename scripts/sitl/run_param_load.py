#!/usr/bin/env python3
"""Runner Phase 04 (việc 04.1–04.3) — nạp bộ param của dự án vào SITL và ghi
lại CHÍNH XÁC param nào SITL nhận, param nào từ chối.

Thay cho chuỗi `param fetch` / `param load` / `param save` gõ tay trong MAVProxy.
Mỗi lần "reboot" là tắt hẳn SITL rồi bật lại cùng thư mục, KHÔNG xoá EEPROM —
tham số đã ghi vẫn còn, y như FC thật khởi động lại.

    lượt 1 (-w, EEPROM trắng) : fetch -> 00-sitl-default.param ; nạp base
    lượt 2 (reboot)            : kiểm base, nạp lại cái chưa có
                                 -> 01-sitl-base-loaded.param ; nạp avoid
    lượt 3 (reboot)            : kiểm avoid, nạp lại cái chưa có
    lượt 4 (reboot, nếu cần)   : kiểm lần cuối ; thử arm + cất cánh 5 m với bộ param này

Vì sao phải kiểm SAU reboot: nhiều tham số con chỉ XUẤT HIỆN khi tham số cha đã
bật và FC đã khởi động lại (kiểu `PRX1_*` sau `PRX1_TYPE`). Mission Planner báo
chúng là "not found" ở lần nạp đầu — nhìn vậy dễ tưởng firmware thiếu tính năng.
Runner phân biệt ba trường hợp: nhận ngay / chỉ có sau reboot / không tồn tại.

CHẠY TRONG WSL:
    ~/venv-ardupilot/bin/python3 scripts/sitl/run_param_load.py

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
from harness import SitlError, SitlInstance, print_ket_qua  # noqa: E402

USE_DIR = "param-load"
PARAMS_DIR = harness.REPO_ROOT / "firmware" / "ardupilot" / "params"
SITL_DIR = PARAMS_DIR / "sitl"
BASE_CHINH_THUC = PARAMS_DIR / "01-base.param"  # Phase 11 sở hữu
BASE_NHAP = SITL_DIR / "01-base-draft.param"
AVOID = PARAMS_DIR / "02-avoid-tfmini.param"

# 9 dòng bảng bắt buộc của plan (việc 04.3b) — (tên, file nguồn, ghi chú của plan).
BANG_9 = [
    ("FRAME_CLASS", "base", "1 = Quad"),
    ("SERIAL3_PROTOCOL", "base", "9 = Rangefinder"),
    ("GPS1_TYPE", "base", "tên cũ `GPS_TYPE`, đổi từ 4.6"),
    ("MOT_PWM_TYPE", "base", "5 = DShot300"),
    ("BATT_VOLT_MULT", "base", ""),
    ("RNGFND1_TYPE", "avoid", "20 = Benewake TFmini Plus UART"),
    ("PRX1_TYPE", "avoid", "4 = rangefinder"),
    ("AVOID_ENABLE", "avoid", ""),
    ("OA_TYPE", "avoid", "0 = tắt, cố ý"),
]

# SITL phải được "đi dây" giống board thật, nếu không bộ param của dự án tự làm
# hỏng mô phỏng. Đo thật 25/09/2026, lần chạy đầu KHÔNG có hai thứ dưới đây:
# nạp base rồi reboot thì `GPS fix=0 sats=0`, `EKF3 waiting for GPS config data`,
# `PreArm: Battery 1 low voltage failsafe`, SITL không bao giờ sẵn sàng.
#
# 1. GPS ảo của SITL nằm CỨNG ở SERIAL3 (`_serial_path[3] = "GPS1"` trong
#    libraries/AP_HAL_SITL/SITL_State.h). Dự án đặt GPS ở SERIAL4 và TFmini ở
#    SERIAL3 -> dời GPS ảo sang SERIAL4, gắn TFmini ảo vào SERIAL3. Chỉ một cờ
#    `-A`: nhiều cờ thì cờ sau ĐÈ cờ trước (optparse kiểu chuỗi).
SITL_DI_DAY = ["-A", "--serial3=sim:benewake_tfmini --serial4=GPS1"]
# 2. Tham số chỉ của mô phỏng (tiền tố SIM_, board thật không có):
#    pin ảo mặc định 12,6 V (3S) thấp hơn BATT_LOW_VOLT 14,0 của pin 4S dự án;
#    rangefinder ảo mặc định nhìn XUỐNG, TFmini dự án nhìn THẲNG TRƯỚC (ORIENT 0).
SITL_THAY_PARAM = {"SIM_BATT_VOLTAGE": 16.8, "SIM_SONAR_ROT": 0}
# 3. RC ảo của SITL đi qua giao thức "SITL UDP" = bit 18 của RC_PROTOCOLS. Base
#    đặt RC_PROTOCOLS 4 (chỉ iBUS — ĐÚNG cho board thật) là tắt luôn RC ảo:
#    `PreArm: RC not found`. Chỉ bù SAU khi đã thử bay nguyên bản, để bằng chứng
#    "trước / sau" nằm cạnh nhau, và để hai snapshot giữ đúng giá trị dự án.
BIT_RC_SITL_UDP = 1 << 18

NHAN = "nhận"
NHAN_SAU_REBOOT = "nhận, nhưng chỉ sau reboot"
KHONG_TON_TAI = "TỪ CHỐI — không tồn tại"
KHAC_GIA_TRI = "nhận nhưng FC đổi giá trị"
KHONG_XAC_NHAN = "tồn tại nhưng FC không xác nhận"
# FC xác nhận đúng lúc nạp, rồi TỰ ĐỔI khi khởi động. Bản đầu của runner lưu giá
# trị sau reboot mà quên so, nên xếp `SERIAL5_BAUD 19` là "nhận" trong khi đọc
# lại là 115: AP_SerialManager ép cứng 115200 cho cổng ESC telemetry.
DOI_SAU_REBOOT = "nhận lúc nạp, FC TỰ ĐỔI sau reboot"

# Mọi dòng KHÔNG "nhận" ngay, đúng như firmware/ardupilot/params/sitl/README.md
# ghi (đo 25/09/2026). Đây là mốc cố định: runner so THEO TÊN, cả hai chiều. Có
# dòng mới lệch -> README thiếu; dòng cũ hết lệch -> README nói sai. Cả hai đều
# phải sửa README trước; KHÔNG sửa danh sách này cho khớp số đo mà chưa hiểu vì sao
# nó đổi (firmware đổi? file param đổi?).
# `base:SERIAL5_BAUD` (DOI_SAU_REBOOT) từng nằm đây khi nạp bản nháp; Phase 11 bỏ
# hẳn dòng đó khỏi 01-base.param vì FC ép cứng 115200 nên nó vô tác dụng.
KY_VONG_KHONG_NHAN = {
    "base:SERVO_BLH_POLES": KHONG_TON_TAI,
    "base:SERVO_BLH_TRATE": KHONG_TON_TAI,
    "avoid:RNGFND1_ORIENT": NHAN_SAU_REBOOT,
    "avoid:RNGFND1_MIN": NHAN_SAU_REBOOT,
    "avoid:RNGFND1_MAX": NHAN_SAU_REBOOT,
    "avoid:AVOID_ANG_MAX": KHONG_TON_TAI,
}


def gan(a: float, b: float) -> bool:
    return abs(a - b) <= max(1e-4, abs(b) * 1e-5)


def chon_file_base() -> Path:
    if BASE_CHINH_THUC.is_file():
        return BASE_CHINH_THUC
    if BASE_NHAP.is_file():
        return BASE_NHAP
    raise SitlError(
        f"Không có {BASE_CHINH_THUC.name} (Phase 11) lẫn bản nháp {BASE_NHAP}. "
        "Tạo bản nháp theo plan Phase 04 mục 'Đầu vào cần có'."
    )


def nap(sitl: SitlInstance, co_san: dict[str, float], ds: list[tuple[str, float]]) -> dict:
    """Nạp từng dòng theo thứ tự file, như `param load`. Trả {tên: bản ghi}."""
    ket: dict[str, dict] = {}
    for ten, gia_tri in ds:
        bg = {"yeu_cau": gia_tri, "trang_thai": None, "fc": None}
        if ten not in co_san:
            bg["trang_thai"] = KHONG_TON_TAI
        else:
            fc = sitl.try_set_param(ten, gia_tri)
            bg["fc"] = fc
            if fc is None:
                bg["trang_thai"] = KHONG_XAC_NHAN
            elif gan(fc, gia_tri):
                bg["trang_thai"] = NHAN
            else:
                bg["trang_thai"] = KHAC_GIA_TRI
        ket[ten] = bg
        print(f"[param_load] {ten:<20} {gia_tri:<10g} -> {bg['trang_thai']}", flush=True)
    return ket


def kiem_sau_reboot(sitl: SitlInstance, sau: dict[str, float], ket: dict[str, dict]) -> list[str]:
    """Sau một lần reboot: (a) cái đã nhận phải CÒN đúng giá trị; (b) cái trước
    đó không tồn tại mà nay xuất hiện thì nạp lại. Trả danh sách vừa nạp lại."""
    nap_lai: list[str] = []
    for ten, bg in ket.items():
        if bg["trang_thai"] in (NHAN, NHAN_SAU_REBOOT, KHAC_GIA_TRI, DOI_SAU_REBOOT):
            bg["sau_reboot"] = sau.get(ten)
            if bg["sau_reboot"] is None or not gan(bg["sau_reboot"], bg["yeu_cau"]):
                bg["trang_thai"] = DOI_SAU_REBOOT
            continue
        if bg["trang_thai"] == KHONG_TON_TAI and ten in sau:
            fc = sitl.try_set_param(ten, bg["yeu_cau"])
            bg["fc"] = fc
            bg["trang_thai"] = (
                NHAN_SAU_REBOOT if fc is not None and gan(fc, bg["yeu_cau"]) else KHAC_GIA_TRI
            )
            nap_lai.append(ten)
            print(f"[param_load] {ten:<20} xuất hiện sau reboot -> {bg['trang_thai']}", flush=True)
    return nap_lai


def bat(dir_: Path, *, wipe: bool) -> SitlInstance:
    # Lượt đầu (wipe) giữ SITL nguyên gốc để snapshot 00 đúng là "mặc định".
    sitl = SitlInstance(dir_, speedup=5, wipe_eeprom=wipe, extra_args=[] if wipe else SITL_DI_DAY)
    sitl.start()
    return sitl


def header(mo_ta: str) -> list[str]:
    return [
        mo_ta,
        "SITL ArduCopter 4.7.1 (build tu nguon, Phase 02) - KHONG nap file nay len board that.",
        f"Sinh boi scripts/sitl/run_param_load.py, {time.strftime('%d/%m/%Y %H:%M')}.",
    ]


def thu_bay(sitl: SitlInstance) -> dict:
    """Bộ param dự án có cho drone ẢO cất cánh không? Chỉ QUAN SÁT, không làm
    hỏng runner: thứ cần biết là FC nói gì, không phải nó có bay hay không."""
    ket = {"arm": None, "cat_canh": None, "statustext": []}
    n0 = len(sitl.statustext_log)
    try:
        sitl.wait_ready(timeout=120)
        sitl.set_mode("GUIDED")
        sitl.arm()
        ket["arm"] = "OK"
        sitl.takeoff(5.0, timeout=45)
        ket["cat_canh"] = "OK"
        het = time.monotonic() + 20
        while time.monotonic() < het:
            sitl.recv_match("HEARTBEAT", timeout=1.0)
        ket["mode_sau_20s"] = sitl.get_mode_name()
        ss = sitl.master.messages.get("SYS_STATUS")
        ket["pin_v"] = round(ss.voltage_battery / 1000, 2) if ss else None
        rf = sitl.master.messages.get("DISTANCE_SENSOR")
        ket["tfmini_ao_cm"] = rf.current_distance if rf else None
    except SitlError as exc:
        ket["loi"] = str(exc)
    ket["statustext"] = sitl.statustext_log[n0:][-15:]
    return ket


def luot_1(d: Path, base: list[tuple[str, float]]) -> dict:
    """EEPROM trắng: snapshot 00, đặt tham số mô phỏng, nạp base."""
    sitl = bat(d, wipe=True)
    try:
        sitl.wait_ready(timeout=120)
        goc = sitl.fetch_all_params()
        harness.write_param_file(
            SITL_DIR / "00-sitl-default.param",
            goc,
            header("00 - param goc cua SITL (EEPROM trang, -w)."),
        )
        print(f"[param_load] snapshot gốc: {len(goc)} tham số", flush=True)
        for ten, gia_tri in SITL_THAY_PARAM.items():
            sitl.set_param(ten, gia_tri)
        return nap(sitl, goc, base)
    finally:
        sitl.stop()


def luot_2(d: Path, kq_base: dict, avoid: list[tuple[str, float]], file_base: Path) -> dict:
    """Reboot sau base: kiểm base, snapshot 01, nạp avoid."""
    sitl = bat(d, wipe=False)
    try:
        sitl.wait_ready(timeout=120)
        kiem_sau_reboot(sitl, sitl.fetch_all_params(), kq_base)
        sau_base = sitl.fetch_all_params()
        harness.write_param_file(
            SITL_DIR / "01-sitl-base-loaded.param",
            sau_base,
            header(f"01 - sau khi nap {file_base.name} va reboot."),
        )
        return nap(sitl, sau_base, avoid)
    finally:
        sitl.stop()


def thu_bay_co_bu_rc(sitl: SitlInstance, sau: dict[str, float]) -> dict:
    """Thử bay nguyên bản; không cất cánh được thì bù đúng bit RC ảo và thử lại."""
    bay = {"nguyen_ban": thu_bay(sitl)}
    if bay["nguyen_ban"].get("cat_canh") != "OK":
        rc = int(sau.get("RC_PROTOCOLS", 1)) | BIT_RC_SITL_UDP
        sitl.set_param("RC_PROTOCOLS", rc)
        bay[f"sau_khi_bu_RC_PROTOCOLS={rc}"] = thu_bay(sitl)
    return bay


def luot_cuoi(d: Path, kq_base: dict, kq_avoid: dict) -> dict:
    """Reboot sau avoid (thêm một lần nếu có param mới xuất hiện), rồi thử bay."""
    for luot in (3, 4):
        sitl = bat(d, wipe=False)
        try:
            sitl.wait_ready(timeout=120)
            sau = sitl.fetch_all_params()
            nap_lai = kiem_sau_reboot(sitl, sau, kq_avoid) + kiem_sau_reboot(sitl, sau, kq_base)
            if not nap_lai or luot == 4:
                return thu_bay_co_bu_rc(sitl, sau)
        finally:
            sitl.stop()
    return {}


def mo_ta(bg: dict) -> str:
    """Trạng thái một dòng param, kèm con số khi FC không giữ đúng giá trị nạp."""
    chi_tiet = bg["trang_thai"]
    if bg.get("fc") is not None and not gan(bg["fc"], bg["yeu_cau"]):
        chi_tiet += f" (gửi {bg['yeu_cau']:g}, FC trả {bg['fc']:g})"
    if bg["trang_thai"] == DOI_SAU_REBOOT:
        chi_tiet += f" (nạp {bg['yeu_cau']:g}, sau reboot {bg.get('sau_reboot')})"
    return chi_tiet


def bang_ket_qua(
    file_base: Path, kq_base: dict, kq_avoid: dict, tat_ca: dict, bay: dict, ket_json: Path
) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = [("File base đã nạp", file_base.name)]
    for ten, nguon, ghi_chu in BANG_9:
        bg = (kq_base if nguon == "base" else kq_avoid).get(ten)
        chi_tiet = "KHÔNG CÓ trong file nguồn" if bg is None else mo_ta(bg)
        rows.append((f"`{ten}` ({nguon}) {ghi_chu}", chi_tiet))
    khong_nhan = [f"{k} [{mo_ta(v)}]" for k, v in tat_ca.items() if v["trang_thai"] != NHAN]
    rows.append(("Mọi dòng KHÔNG phải 'nhận' ngay", ", ".join(khong_nhan) or "không có"))
    rows.append(("Thử bay với bộ param này", json.dumps(bay, ensure_ascii=False)))
    rows.append(("Chi tiết từng dòng", str(ket_json)))
    return rows


def kiem_moc(tat_ca: dict, bay: dict) -> str | None:
    """So kết quả với mốc README, theo tên, hai chiều. Trả câu lỗi hoặc None."""
    chua_ro = [k for k, v in tat_ca.items() if v["trang_thai"] == KHONG_XAC_NHAN]
    if chua_ro:
        return f"Có tham số tồn tại mà FC không xác nhận: {chua_ro}"
    thuc_te = {k: v["trang_thai"] for k, v in tat_ca.items() if v["trang_thai"] != NHAN}
    moi = {k: v for k, v in thuc_te.items() if KY_VONG_KHONG_NHAN.get(k) != v}
    het = {k: v for k, v in KY_VONG_KHONG_NHAN.items() if thuc_te.get(k) != v}
    if moi or het:
        return (
            "Kết quả nạp param KHÁC mốc trong firmware/ardupilot/params/sitl/README.md.\n"
            f"  lệch mới / đổi trạng thái: {moi}\n"
            f"  trước lệch, nay không còn: {het}\n"
            "Sửa README (và tìm hiểu vì sao) trước, rồi mới cập nhật KY_VONG_KHONG_NHAN."
        )
    # README khẳng định: bộ param dự án cất cánh được trên SITL khi bù đúng bit RC ảo.
    if not any(lan.get("cat_canh") == "OK" for lan in bay.values()):
        return f"Bộ param dự án không cất cánh được trên SITL kể cả khi bù RC: {bay}"
    return None


def main() -> int:
    SITL_DIR.mkdir(parents=True, exist_ok=True)
    file_base = chon_file_base()
    d = harness.run_dir(USE_DIR)

    kq_base = luot_1(d, harness.read_param_file(file_base))
    kq_avoid = luot_2(d, kq_base, harness.read_param_file(AVOID), file_base)
    bay = luot_cuoi(d, kq_base, kq_avoid)

    tat_ca = {
        **{f"base:{k}": v for k, v in kq_base.items()},
        **{f"avoid:{k}": v for k, v in kq_avoid.items()},
    }
    ket_json = d / "ket-qua.json"
    ket_json.write_text(
        json.dumps(
            {"file_base": str(file_base), "param": tat_ca, "thu_bay": bay},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    rows = bang_ket_qua(file_base, kq_base, kq_avoid, tat_ca, bay, ket_json)
    print_ket_qua(rows, title="Nạp param dự án vào SITL (Phase 04, việc 04.1–04.3)")

    loi = kiem_moc(tat_ca, bay)
    if loi:
        print(loi, file=sys.stderr)
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
