#!/usr/bin/env bash
# Chạy LẦN LƯỢT mọi runner SITL của Phase 03 + 04 và in một bảng tổng.
# Mã thoát khác 0 nếu có runner nào không PASS, hoặc có runner để sót SITL.
#
# CHẠY TRONG WSL. Từ Windows:
#   wsl -d Ubuntu --exec bash -lc 'cd /mnt/d/Coding/IOT-CV && bash scripts/sitl/run-all.sh'
#   ... run-all.sh --chi run_mode_chain,run_log_dump   # chỉ chạy vài runner
#
# Tuần tự, không song song: mỗi runner tự bật một phiên SITL riêng và harness
# TỪ CHỐI chạy khi đã có phiên khác sống. Trọn bộ mất khoảng 6 phút (đo 25/09/2026:
# 5,5 phút, 7/7 PASS).
#
# Chú ý: run_param_load.py và run_avoid_brake.py GHI ĐÈ các file đã commit
# (firmware/ardupilot/params/sitl/0*.param, docs/so-tay/anh/04-avoid-phanh.png).
# Xem `git diff` sau khi chạy rồi mới quyết định có commit hay không.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PY="${SITL_PYTHON:-$HOME/venv-ardupilot/bin/python3}"
OUT="${SITL_RUN_DIR:-$HOME/.cache/iot-cv-sitl}/run-all"
# run_log_dump.py phải chạy SAU run_mode_chain.py: nó đọc log của runner đó.
RUNNERS=(run_mode_chain run_log_dump run_rtl_alt run_mission_auto run_mission_low_alt
         run_param_load run_avoid_brake)

if [[ "${1:-}" == "--chi" && -n "${2:-}" ]]; then
  IFS=',' read -r -a RUNNERS <<< "$2"
fi

dem_sitl() { ps -eo comm= | grep -cxE 'arducopter|xterm' || true; }

if [[ "$(dem_sitl)" != 0 ]]; then
  echo "Đang có SITL/xterm chạy — dừng nó trước: bash scripts/sitl/sitl-headless.sh stop" >&2
  exit 2
fi

mkdir -p -m 700 "$OUT"
cd "$REPO"
declare -a BANG
HONG=0
for r in "${RUNNERS[@]}"; do
  f="scripts/sitl/${r}.py"
  if [[ ! -f "$f" ]]; then
    BANG+=("| $r | KHÔNG CÓ FILE | - | - |"); HONG=1; continue
  fi
  echo "[run-all] $(date +%T) bắt đầu $r" >&2
  t0=$(date +%s)
  "$PY" "$f" >"$OUT/$r.log" 2>&1
  rc=$?
  giay=$(( $(date +%s) - t0 ))
  ket=$(grep -o 'KET QUA: [A-Z]*' "$OUT/$r.log" | tail -1)
  ket="${ket:-KHÔNG CÓ DÒNG KET QUA}"
  sot=$(dem_sitl)
  if [[ "$sot" != 0 ]]; then
    # Runner để sót SITL là lỗi của runner, không phải chuyện dọn dẹp bình thường.
    pkill -x arducopter || true; pkill -x xterm || true
    ket="$ket + SÓT $sot tiến trình SITL"
  fi
  if [[ $rc -ne 0 || "$ket" != "KET QUA: PASS" ]]; then HONG=1; fi
  BANG+=("| $r | $ket | $rc | ${giay}s |")
  echo "[run-all] $r: $ket (mã $rc, ${giay}s)" >&2
done

echo
echo "## Tổng kết run-all ($(date '+%d/%m/%Y %H:%M'))"
echo "| Runner | Kết quả | Mã thoát | Thời gian |"
echo "|---|---|---|---|"
printf '%s\n' "${BANG[@]}"
echo
echo "Log từng runner: $OUT/<runner>.log"
if [[ $HONG -ne 0 ]]; then echo "RUN_ALL: FAIL"; exit 1; fi
echo "RUN_ALL: PASS"
