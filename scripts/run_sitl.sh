#!/usr/bin/env bash
# Chạy ArduCopter SITL (Phase 02, việc 02.7).
#
# CHẠY TRONG WSL, KHÔNG PHẢI PowerShell. Từ PowerShell phải gọi qua:
#   wsl -d Ubuntu -- bash -lc "cd /mnt/d/Coding/IOT-CV && ./scripts/run_sitl.sh"
#
# Biến môi trường:
#   ARDUPILOT_DIR : chỗ clone ArduPilot (mặc định ~/ardupilot TRONG WSL)
#   WSL_MIRRORED  : bật nếu .wslconfig đặt networkingMode=mirrored (mặc định bật).
#                   Nhận 1/true/yes/on hoặc 0/false/no/off; giá trị khác thì
#                   script BÁO LỖI chứ không đoán — xem lý do ở khối case bên dưới.
#                   Khi tắt (NAT mặc định) thì KHÔNG được thêm --no-wsl2-network,
#                   vì sim_vehicle.py tự phát hiện WSL2 và tự phát UDP về IP
#                   Windows. Thừa hoặc thiếu cờ này là nguyên nhân phổ biến nhất
#                   của "Mission Planner không thấy gì".
#   SITL_EXTRA    : cờ thêm cho Phase 04 — gắn cảm biến mô phỏng vào cổng serial,
#                   dạng "-A --serialN=sim:<tên>". Dự án dùng Benewake TFmini Plus
#                   (rangefinder MỘT hướng) trên SERIAL3, xem
#                   firmware/ardupilot/params/obstacle-avoidance-tfminiplus-serial3.param
#                   — file đó là nguồn sự thật cho việc chia cổng, không phải hwdef,
#                   vì DEFAULT_SERIAL3_PROTOCOL trong hwdef chỉ là mặc định của
#                   tham số và bản build của dự án đã gỡ hẳn MSP/OSD/VTX.
#                   Tên sim: cụ thể chốt ở Phase 04, chưa kiểm nên chưa ghi ra đây.
#                   MỖI GIÁ TRỊ KHÔNG ĐƯỢC CHỨA DẤU CÁCH — biến này bị tách từ
#                   nên nháy không có tác dụng. Nhiều cảm biến thì lặp lại -A:
#                   SITL_EXTRA="-A --serial3=sim:x -A --serial5=sim:y"
#
# Cờ truyền thẳng trên dòng lệnh cũng được nối vào cuối.
set -euo pipefail

ARDUPILOT_DIR="${ARDUPILOT_DIR:-$HOME/ardupilot}"
WSL_MIRRORED="${WSL_MIRRORED:-1}"
SITL_EXTRA="${SITL_EXTRA:-}"

SIM_VEHICLE="${ARDUPILOT_DIR}/Tools/autotest/sim_vehicle.py"

# Kiểm ĐÚNG file sắp chạy, không chỉ kiểm thư mục. Clone dở dang có thể có
# ArduCopter/ mà thiếu Tools/, khi đó kiểm theo thư mục sẽ lọt và bash ném
# "No such file or directory" trần với mã 127, bỏ qua thông báo bên dưới.
if [[ ! -d "${ARDUPILOT_DIR}/ArduCopter" || ! -x "${SIM_VEHICLE}" ]]; then
  echo "Không chạy được SITL ở ${ARDUPILOT_DIR}" >&2
  echo "  ArduCopter/          : $([[ -d "${ARDUPILOT_DIR}/ArduCopter" ]] && echo 'có' || echo 'THIẾU')" >&2
  echo "  Tools/autotest/sim_vehicle.py : $([[ -x "${SIM_VEHICLE}" ]] && echo 'có' || echo 'THIẾU')" >&2
  echo "Hai nguyên nhân thường gặp:" >&2
  echo "  1. Chưa clone, hoặc clone dở dang — xem plans/phase-02-wsl2-sitl.md việc 02.2." >&2
  echo "     Clone dở thì chạy: git -C '${ARDUPILOT_DIR}' submodule update --init --recursive" >&2
  echo "  2. Đang chạy ngoài WSL. Dấu hiệu chắc chắn: nếu đường dẫn in ở trên bắt" >&2
  echo "     đầu bằng 'C:/' thì bạn đang ở Git Bash, không phải WSL." >&2
  exit 1
fi

# Chỉ nhận giá trị rõ nghĩa. Giá trị lạ thì DỪNG chứ không đoán: đoán nhầm sang
# NAT sẽ làm sim_vehicle.py phát UDP về gateway mặc định thay vì 127.0.0.1, và
# Mission Planner im lặng không thấy gì — không có lỗi nào để lần ra.
case "${WSL_MIRRORED}" in
  1|true|yes|on|TRUE|YES|ON)    NET_FLAG=(--no-wsl2-network); NET_MODE=mirrored ;;
  0|false|no|off|FALSE|NO|OFF)  NET_FLAG=();                  NET_MODE=NAT ;;
  *)
    echo "WSL_MIRRORED='${WSL_MIRRORED}' không hợp lệ." >&2
    echo "Dùng 1/true/yes/on (mirrored) hoặc 0/false/no/off (NAT)." >&2
    exit 2
    ;;
esac

# SITL_EXTRA cố ý KHÔNG bọc nháy: nó chứa nhiều cờ và cần được tách từ.
# set -f trong lúc tách để tắt khớp glob — nếu không, một từ như 'M*e' sẽ nở ra
# theo thư mục ĐANG đứng (gốc repo khi gọi qua `make sitl`), trước cả lệnh cd.
# shellcheck disable=SC2206
set -f; EXTRA_ARGS=(${SITL_EXTRA}); set +f

# In ra quyết định của chính mình. Nếu không có dòng này thì khi Mission Planner
# không thấy gì, không có cách nào biết script đã chọn nhánh nào.
echo "[run_sitl] ArduPilot : ${ARDUPILOT_DIR}" >&2
echo "[run_sitl] mạng      : ${NET_MODE} (WSL_MIRRORED='${WSL_MIRRORED}')" >&2
echo "[run_sitl] chạy      : sim_vehicle.py --map --console ${NET_FLAG[*]-} ${EXTRA_ARGS[*]-} $*" >&2

cd "${ARDUPILOT_DIR}/ArduCopter"
exec "${SIM_VEHICLE}" --map --console \
  "${NET_FLAG[@]}" "${EXTRA_ARGS[@]}" "$@"
