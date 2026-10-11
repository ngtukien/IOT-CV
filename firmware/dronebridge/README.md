# firmware/dronebridge

Cầu nối không dây giữa flight controller (SpeedyBee F405 V5) và máy tính mặt đất.

## Dùng cái gì

**DroneBridge for ESP32** — firmware có sẵn, nạp thẳng vào ESP32 DevKit. Cấu hình và
nạp ở **Phase 12** (`plans/phase-12-firmware-esp32-camera.md`); đấu dây lên `SERIAL2`
của FC ở **Phase 17** (`plans/phase-17-ban-esp32-tfmini-camera.md`).

Không viết sketch tự chế cho việc này. DroneBridge đã xử lý sẵn phần khó: đóng gói
MAVLink qua Wi-Fi, chia sẻ cổng cho nhiều client, web UI cấu hình, và cơ chế
reconnect khi mất sóng.

## Đã nạp gì vào board

12/10/2026: **DroneBridge v2.4.1 (stable)** — tải bằng
`gh release download v2.4.1 -R DroneBridge/ESP32 -D firmware/dronebridge/bin`, giải nén vào
`bin/v2.4.1/` (thư mục `bin/` đã `.gitignore`), dùng thư mục con `esp32/`.

Board: ESP32-D0WD-V3 rev 3.1, flash 4 MB, USB-UART CP2102 (driver CP210x Universal v11.6.0), lên
COM4 trên máy dự án. Không cần bấm BOOT — mạch auto-reset của board tự đưa chip vào chế độ nạp.

```powershell
cd firmware\dronebridge\bin\v2.4.1\DroneBridge_ESP32_v2_4_1_stable\esp32
esptool --chip esp32 -p COM4 -b 115200 erase-flash
esptool --chip esp32 -p COM4 -b 115200 --before default-reset --after hard-reset write-flash `
  --flash-mode dio --flash-size 2MB --flash-freq 40m `
  0x1000 bootloader.bin 0x8000 partition-table.bin 0x10000 db_esp32.bin 0x190000 www.bin
```

**Chỉ dùng 115200 baud** — 460800 và 921600 làm hỏng dữ liệu serial trên board này.

Sau khi nạp, board tự phát Wi-Fi (chưa cấu hình gì thêm):

| | |
|---|---|
| SSID | `DroneBridge for ESP32` |
| IP / web UI | `192.168.2.1` |
| Kênh | 6 (2,4 GHz) |
| Chế độ | AP (`esp32_mode: 1`) — Phase 12.6 đổi sang STA nối hotspot laptop |

Firmware gốc trước khi xoá được sao lưu ngoài repo (4 MB, đọc ở 115200 baud).

## Cấu hình qua cáp USB (không cần vào Wi-Fi của board)

Trang web cấu hình chỉ mở được khi laptop nối vào Wi-Fi của board, mà Wi-Fi đó không có internet.
Thay vào đó ghi cấu hình thẳng vào phân vùng NVS (`0x9000`, dài `0x6000`) qua USB:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\dronebridge-nvs.ps1            # -Port COM4 mac dinh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\dronebridge-nvs.ps1 -NoFlash   # chi tao nvs.bin
```

Script làm bốn việc:
1. Kiểm tra cổng COM đúng là chip CP210x. FC cắm cùng lúc sẽ ở cổng khác, script không ghi nhầm sang đó.
2. Đọc SSID và mật khẩu Mobile Hotspot của Windows. Script dừng nếu băng tần không phải 2,4 GHz.
3. Điền vào mẫu `db_params.iotcv.csv`, tạo `bin/config/nvs.bin`, rồi xoá file CSV tạm chứa mật khẩu.
4. Ghi `nvs.bin` ở 115200 baud. Firmware DroneBridge không bị đụng tới.

Mật khẩu không bao giờ vào git và không được in ra màn hình. Muốn đổi chân, baud hay mạng thì sửa
mẫu CSV rồi chạy lại script. Tên khoá và kiểu dữ liệu trong mẫu khớp với `main/db_parameters.c`
của v2.4.1 (26 khoá).

Kết quả 12/10/2026: ESP32 ở chế độ STA, nhận IP `192.168.137.9` từ hotspot. Nó đẩy HEARTBEAT và
RADIO_STATUS (1 Hz) về `192.168.137.1:14550`. Web UI vẫn mở được ở `http://192.168.137.9/`.

**Cứu khi cấu hình sai** (ở chế độ STA, firmware thử kết nối lại mãi, không tự lùi về AP):
- Sửa mẫu rồi chạy lại script. Cách này luôn được vì đi qua USB.
- Hoặc nhấn nút BOOT (GPIO0) **đúng một lần**. Firmware đưa SSID và mật khẩu về mặc định,
  chuyển sang AP `DroneBridge for ESP32` / `dronebridge`, rồi khởi động lại. Giữ lâu thì xoá toàn
  bộ cấu hình. Nhấn 2 đến 4 lần là các lệnh ghép cặp ESP-NOW, không phải để cứu.

Log khởi động có một dòng in mật khẩu Wi-Fi dạng chữ thường (`Init of WiFi Client-Mode finished
(SSID: … PASS: …)`). Che dòng đó trước khi dán log vào đâu.

## Bẫy đã gặp

1. **Đừng cho laptop nối vào Wi-Fi không có internet.** Wi-Fi của chính board DroneBridge
   (`DroneBridge for ESP32`) và Wi-Fi của camera đều không có internet. Laptop chỉ có một card
   Wi-Fi, nên nối vào đó là mất internet, và phiên Claude Code hay agent khác bị cắt giữa chừng.
   Muốn cấu hình thì làm qua USB bằng `scripts\esp32\dronebridge-nvs.ps1`, như mục trên. Mobile
   Hotspot để băng 2,4 GHz. Laptop vẫn nối mạng 5 GHz cùng lúc được, đã thử trên card RZ616 ngày
   12/10/2026.
2. **Log khởi động in mật khẩu Wi-Fi dạng chữ thường.** Dòng `Init of WiFi Client-Mode finished
   (SSID: … PASS: …)` lộ mật khẩu hotspot. Che dòng đó trước khi in, dán log hay lưu file log vào
   repo, ví dụ: `sed -E 's/(PASS: )[^)]*/\1[redacted]/'`. Dòng `DB_PARAM: wifi_pass` thì firmware
   đã tự che.
3. **Chỉ nạp ở 115200 baud** (xem mục "Đã nạp gì vào board").
4. **Bấm BOOT đúng một lần** khi muốn trả board về AP mặc định. Nhấn 2 đến 4 lần là các lệnh
   ghép cặp ESP-NOW.

## `legacy-sketch/` là gì

`legacy-sketch/mavlink_bridge.ino` là bản nháp 39 dòng viết từ thời kế hoạch cũ
(`docs/archive/plan-nhap-92-giai-doan.md`). Nó **không còn được dùng** — DroneBridge
thay thế hoàn toàn.

Giữ lại để đối chiếu khi cần hiểu ý định ban đầu, không phải để nạp vào board.
