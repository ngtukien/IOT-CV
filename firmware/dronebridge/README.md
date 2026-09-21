# firmware/dronebridge

Cầu nối không dây giữa flight controller (SpeedyBee F405 V5) và máy tính mặt đất.

## Dùng cái gì

**DroneBridge for ESP32** — firmware có sẵn, nạp thẳng vào ESP32 DevKit. Cấu hình và
nạp ở **Phase 12** (`plans/phase-12-firmware-esp32-camera.md`); đấu dây lên `SERIAL2`
của FC ở **Phase 17** (`plans/phase-17-ban-esp32-tfmini-camera.md`).

Không viết sketch tự chế cho việc này. DroneBridge đã xử lý sẵn phần khó: đóng gói
MAVLink qua Wi-Fi, chia sẻ cổng cho nhiều client, web UI cấu hình, và cơ chế
reconnect khi mất sóng.

## `legacy-sketch/` là gì

`legacy-sketch/mavlink_bridge.ino` là bản nháp 39 dòng viết từ thời kế hoạch cũ
(`docs/archive/plan-nhap-92-giai-doan.md`). Nó **không còn được dùng** — DroneBridge
thay thế hoàn toàn.

Giữ lại để đối chiếu khi cần hiểu ý định ban đầu, không phải để nạp vào board.
