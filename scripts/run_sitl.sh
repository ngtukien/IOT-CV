#!/usr/bin/env bash
# Chạy ArduCopter SITL (GIAI ĐOẠN 3.3).
#
# CỔNG PASS 3A: phải thấy MAVProxy Console + Map + ArduCopter SITL running.
set -euo pipefail

ARDUPILOT_DIR="${ARDUPILOT_DIR:-./ardupilot}"

if [[ ! -d "${ARDUPILOT_DIR}/ArduCopter" ]]; then
  echo "Không tìm thấy ${ARDUPILOT_DIR}/ArduCopter" >&2
  echo "Clone ArduPilot rồi trỏ ARDUPILOT_DIR tới đó — xem docs/dev-env.md" >&2
  exit 1
fi

cd "${ARDUPILOT_DIR}/ArduCopter"
exec ../Tools/autotest/sim_vehicle.py --map --console "$@"
