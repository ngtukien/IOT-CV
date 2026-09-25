#!/usr/bin/env bash
# Bật / tắt / xem một phiên SITL CHẠY NỀN (không MAVProxy, không cửa sổ) để
# nghiệm thu backend. Khác với ./scripts/run_sitl.sh (phiên mở tay, có map +
# console) và khác các runner trong scripts/sitl/ (tự bật tự tắt phiên riêng).
#
# CHẠY TRONG WSL. Từ Windows:
#   wsl -d Ubuntu --exec bash -lc 'cd /mnt/d/Coding/IOT-CV && bash scripts/sitl/sitl-headless.sh start'
#   ... stop | status
# Dùng --exec, KHÔNG dùng `--`: với `--`, wsl.exe đưa lệnh qua thêm một lớp
# shell, lớp đó mở rộng $? trước bash bên trong, nên mọi "rc=$?" in ra 0 dù
# lệnh hỏng (đo 25/09/2026: `bash -c "exit 1"; echo $?` in 0).
#
# Backend nối vào bằng MAVLINK_ENDPOINT=tcp:127.0.0.1:5760.
# Phiên này chỉ nhận MỘT client TCP: đừng để hai backend cùng nối.
#
# Biến môi trường:
#   SITL_SPEEDUP : mặc định 1. Bắt buộc 1 khi bài nghiệm thu ĐO THỜI GIAN.
#   WSL_MIRRORED : như run_sitl.sh (mặc định 1 = thêm --no-wsl2-network).
#   ARDUPILOT_DIR, SITL_PYTHON, SITL_RUN_DIR : như harness.py.
#
# Mỗi bẫy dưới đây đã sập thật một lần (22/09/2026), đừng "đơn giản hoá" lại:
#   - pkill -f <tên> tự giết luôn shell đang chạy nó -> chỉ dùng pkill -x / PID.
#   - thiếu setsid + sleep sau disown thì SITL chết theo phiên wsl, log 0 byte.
#   - sim_vehicle.py có thể bọc arducopter trong `xterm -hold`: tiến trình chết
#     nhưng cửa sổ còn -> stop giết cả xterm, status đếm cả xterm.
set -euo pipefail

ARDUPILOT_DIR="${ARDUPILOT_DIR:-$HOME/ardupilot}"
SITL_PYTHON="${SITL_PYTHON:-$HOME/venv-ardupilot/bin/python3}"
RUN_DIR="${SITL_RUN_DIR:-$HOME/.cache/iot-cv-sitl}/headless"
SPEEDUP="${SITL_SPEEDUP:-1}"
WSL_MIRRORED="${WSL_MIRRORED:-1}"
STARTUP_WAIT_S=8

count_alive() {
  # In "<số arducopter> <số xterm>". ps theo comm, không theo cmdline.
  local a x
  a=$(ps -eo comm= | grep -cx arducopter || true)
  x=$(ps -eo comm= | grep -cx xterm || true)
  echo "${a} ${x}"
}

cmd_status() {
  local a x
  read -r a x < <(count_alive)
  echo "arducopter=${a} xterm=${x}"
  if [[ "${a}" == 0 && "${x}" == 0 ]]; then echo "SACH"; else echo "DANG CHAY"; fi
}

cmd_stop() {
  pkill -x arducopter || true
  pkill -x xterm || true
  # sim_vehicle.py là tiến trình python: tìm theo đường dẫn, loại PID của mình.
  local pid
  for pid in $(pgrep -f 'Tools/autotest/sim_vehicle.py' || true); do
    if [[ "${pid}" != "$$" ]]; then kill "${pid}" 2>/dev/null || true; fi
  done
  sleep 1
  cmd_status
}

cmd_start() {
  local a x
  read -r a x < <(count_alive)
  if [[ "${a}" != 0 ]]; then
    echo "Đã có ${a} arducopter đang chạy. Từ chối bật phiên thứ hai." >&2
    echo "Nếu đó là phiên cũ bỏ quên: bash $0 stop" >&2
    exit 1
  fi
  if [[ ! -x "${ARDUPILOT_DIR}/build/sitl/bin/arducopter" ]]; then
    echo "Chưa build binary SITL ở ${ARDUPILOT_DIR}/build/sitl/bin/arducopter" >&2
    echo "Xem scripts/sitl/README.md mục 'Binary phải build sẵn'." >&2
    exit 1
  fi

  local net_flag=()
  case "${WSL_MIRRORED}" in
    1|true|yes|on) net_flag=(--no-wsl2-network) ;;
    0|false|no|off) net_flag=() ;;
    *) echo "WSL_MIRRORED='${WSL_MIRRORED}' không hợp lệ (1/0)." >&2; exit 2 ;;
  esac

  rm -rf "${RUN_DIR}"
  mkdir -p -m 700 "${RUN_DIR}"
  cd "${ARDUPILOT_DIR}/ArduCopter"
  setsid nohup "${SITL_PYTHON}" "${ARDUPILOT_DIR}/Tools/autotest/sim_vehicle.py" \
    -v ArduCopter --no-mavproxy "${net_flag[@]}" --no-rebuild -w \
    --speedup="${SPEEDUP}" --use-dir="${RUN_DIR}" \
    >"${RUN_DIR}/out.log" 2>&1 </dev/null &
  disown
  sleep "${STARTUP_WAIT_S}"

  read -r a x < <(count_alive)
  if [[ "${a}" == 0 ]]; then
    echo "SITL không lên. 20 dòng cuối ${RUN_DIR}/out.log:" >&2
    tail -20 "${RUN_DIR}/out.log" >&2 || true
    exit 1
  fi
  echo "SITL đang chạy (speedup=${SPEEDUP}). Endpoint: tcp:127.0.0.1:5760"
  echo "Log: ${RUN_DIR}/out.log"
}

case "${1:-}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  *) echo "Dùng: $0 start|stop|status" >&2; exit 2 ;;
esac
