#!/usr/bin/env bash
# Chạy ArduCopter SITL (Phase 02, việc 02.7).
#
# CHẠY TRONG WSL, KHÔNG PHẢI PowerShell. Từ PowerShell phải gọi qua:
#   wsl -d Ubuntu -- bash -lc "cd /mnt/d/Coding/IOT-CV && ./scripts/run_sitl.sh"
#
# Biến môi trường:
#   ARDUPILOT_DIR : chỗ clone ArduPilot (mặc định ~/ardupilot TRONG WSL)
#   WSL_MIRRORED  : 1 nếu .wslconfig đặt networkingMode=mirrored (mặc định 1).
#                   0 nếu WSL chạy NAT mặc định — khi đó KHÔNG được thêm
#                   --no-wsl2-network, vì sim_vehicle.py tự phát hiện WSL2 và
#                   tự phát UDP về IP Windows. Thừa hoặc thiếu cờ này là nguyên
#                   nhân phổ biến nhất của "Mission Planner không thấy gì".
#   SITL_EXTRA    : cờ thêm cho Phase 04 — gắn cảm biến mô phỏng vào một cổng
#                   serial, dạng "-A --serialN=sim:<tên>". Dự án dùng TFMini Plus
#                   (rangefinder MỘT hướng, không phải lidar 360°) trên SERIAL5,
#                   vì UART5 của board này chỉ có chân RX mà TFMini chỉ phát.
#                   Tên sim: cụ thể chốt ở Phase 04, chưa kiểm nên chưa ghi ra đây.
#
# Cờ truyền thẳng trên dòng lệnh cũng được nối vào cuối.
set -euo pipefail

ARDUPILOT_DIR="${ARDUPILOT_DIR:-$HOME/ardupilot}"
WSL_MIRRORED="${WSL_MIRRORED:-1}"
SITL_EXTRA="${SITL_EXTRA:-}"

if [[ ! -d "${ARDUPILOT_DIR}/ArduCopter" ]]; then
  echo "Không tìm thấy ${ARDUPILOT_DIR}/ArduCopter" >&2
  echo "Hai nguyên nhân thường gặp:" >&2
  echo "  1. Chưa clone ArduPilot — xem plans/phase-02-wsl2-sitl.md việc 02.2" >&2
  echo "  2. Đang chạy ngoài WSL (Git Bash / PowerShell) — script này chỉ chạy trong WSL" >&2
  exit 1
fi

NET_FLAG=()
if [[ "${WSL_MIRRORED}" == "1" ]]; then
  NET_FLAG=(--no-wsl2-network)
fi

# SITL_EXTRA cố ý KHÔNG bọc nháy: nó chứa nhiều cờ và cần được tách từ.
# shellcheck disable=SC2206
EXTRA_ARGS=(${SITL_EXTRA})

cd "${ARDUPILOT_DIR}/ArduCopter"
exec ../Tools/autotest/sim_vehicle.py --map --console \
  "${NET_FLAG[@]}" "${EXTRA_ARGS[@]}" "$@"
