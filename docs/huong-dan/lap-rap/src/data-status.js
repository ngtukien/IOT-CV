/* Trạng thái dự án — nguồn: plans/PROGRESS.md, docs/phan-cung-thuc-te.md, docs/so-tay/14-*.md.
   Sửa file này khi tiến độ đổi, rồi chạy lại build.py. */
LR.data.status = {
  asOf: '17/10/2026',
  here: {
    phase: '14.1',
    title: 'Bạn đang ở: kiểm hàng (Phase 14.1) → sắp vào lắp ráp',
    text: 'FC đã chạy ArduPilot, hai bo ESP32 đã có firmware. Việc còn lại trước khi bay toàn là việc tay trên phần cứng: kiểm hàng, đấu dây trên bàn, lắp khung, hiệu chỉnh.',
  },
  done: [
    { d: '21/09', p: '00–02', t: 'Công cụ PC (Mission Planner 1.3.83, MAVProxy, STM32CubeProgrammer, PlatformIO, esptool) + SITL ArduCopter 4.7.1 trong WSL2' },
    { d: '22–25/09', p: '05–07', t: 'Backend MAVLink: telemetry 8 Hz, lái có dead-man 300 ms, mission, máy trạng thái an toàn (264 test xanh)' },
    { d: '25/09', p: '08–10', t: 'Web GCS: HUD, bản đồ, soạn mission, lái WASD, panel vật cản, panel video (nguồn giả), 3D' },
    { d: '25/09', p: '11', t: 'Firmware custom `d450a747` (có PRX, AVOID, TFmini, BendyRuler) + `01-base.param`, `02-avoid-tfmini.param`' },
    { d: '12–13/10', p: '12', t: 'ESP32 CP2102 chạy DroneBridge 2.4.1, vào hotspot `IOTCV-HOTSPOT`, đẩy MAVLink về laptop' },
    { d: '13/10', p: '12', t: 'Camera ESP32-S3 + OV3660: firmware thật, VGA ~7,5 fps, nạp qua Wi-Fi (OTA) được' },
    { d: '13/10', p: '14', t: 'FC đã nạp ArduPilot (COM6), lưu `00-after-flash.param`, nạp `01-base.param` 34/34 dòng, baro + gyro đúng dấu' },
  ],
  todo: [
    { p: '14.1', t: 'Kiểm hàng tay: motor + chiều ren 2+2, pin từng cell, phụ kiện hộp Deluxe, GPS, iA6B, khung' },
    { p: '15', t: 'Trên bàn, chỉ cắm USB: bind RC, iBUS vào R6, gán công tắc, failsafe RC, GPS + la bàn' },
    { p: '16', t: 'Trên bàn, lần đầu cắm pin: hàn XT60 + tụ, đo chập, hiệu chỉnh điện áp, thử motor không cánh' },
    { p: '17', t: 'Trên bàn: ESP32 lên SERIAL2, web hiện drone thật qua Wi-Fi, TFmini, camera thật lên web' },
    { p: '18', t: 'Lắp khung S500: motor, 12 mối hàn nối dài, bát chống rung, GPS, receiver, TFmini, camera, pin, cân CG' },
    { p: '19', t: 'Hiệu chỉnh trên khung (accel, la bàn), failsafe, geofence, pre-arm sạch, gắn cánh, đo lực đẩy' },
  ],
  risks: [
    { lvl: 'danger', t: '**FRAME_TYPE / thứ tự motor sai → lật ngay khi nhấc.** Chặn bằng Motor Test ở 16 và 19.' },
    { lvl: 'danger', t: '**Mối hàn nguội trên dây motor → desync → rơi.** Tập hàn trước (bảng tập hàn của hộp Deluxe), test desync ở 19.' },
    { lvl: 'warn', t: '**Laptop quét Wi-Fi → cả hai ESP32 mất sóng 3–6 s.** Chẩn đoán `wifi_ping_check.py`; xử lý trước khi lái từ web.' },
    { lvl: 'warn', t: '**ESC đua OX32 + motor to chậm** có thể desync ở ga cao — test 10→50% ở 19.6, hạ DShot150 nếu cần.' },
    { lvl: 'warn', t: '**La bàn nằm trên GPS** — đặt GPS gần dây nguồn là Loiter quay vòng tròn. Cột GPS phía đuôi, cao ≥ 8–10 cm.' },
  ],
  /* Những chỗ tài liệu cũ đã sai / đã đổi — hướng dẫn này đi theo cột "Đúng hiện tại". */
  changed: [
    ['Đánh số motor', 'Quad X chuẩn ArduPilot (FRAME_TYPE 1)', '**X kiểu Betaflight, FRAME_TYPE 12**: M1 sau-phải, M2 trước-phải, M3 sau-trái, M4 trước-trái = đúng nhãn in trên ESC', '01-base.param, 12/10'],
    ['Cảm biến dòng', '`BATT_AMP_PERVLT 25`', '`370.4` + `BATT_AMP_OFFSET 0.0071` (số của chính ESC OX32)', '01-base.param, 12/10'],
    ['Baud ESC telemetry', '`SERIAL5_BAUD 19`', 'Không đặt — firmware tự ép 115200', 'Phase 04, 25/09'],
    ['Camera', 'ESP32-CAM / XIAO S3 Sense', '**ESP32-S3 N16R8 + OV3660**, cổng USB-UART (COM7), XCLK **10 MHz**, nạp lại qua Wi-Fi (OTA)', 'Phase 12, 13/10'],
    ['Cấu hình DroneBridge', 'Nối laptop vào Wi-Fi của bo rồi bấm web UI', 'Ghi thẳng qua cáp USB: `scripts\\esp32\\dronebridge-nvs.ps1`', 'Phase 12, 13/10'],
    ['Địa chỉ bo', 'IP cứng 192.168.x.x', 'Tên `DroneBridgeESP32.mshome.net`, `iotcv-camera.mshome.net` (IP DHCP đổi)', 'Phase 12, 13/10'],
    ['Tụ trong hộp Deluxe', '2 tụ 1000 µF', '**1** tụ 1000 µF 35 V (+ 2 gen co đỏ/đen)', 'Kiểm hàng, 12/10'],
    ['Vào DFU để nạp FC', 'Giữ nút BOOT khi cắm cáp', 'Lệnh MSP tự đưa vào DFU; từ nay nạp file `.apj` qua Mission Planner', 'Phase 14, 13/10'],
    ['Độ cao RTL', '`RTL_ALT` (cm)', '`RTL_ALT_M` (mét) — tên cũ không còn trong 4.7.1', 'Phase 03, 22/09'],
    ['Chạy web', '`chay-tat-ca.bat` cho mọi việc', 'File đó **chỉ cho drone ảo (SITL)**; drone thật chạy chế độ riêng (mục Máy tính)', 'Hướng dẫn này, 17/10'],
  ],
};

/* 25 phase luồng chính. st: done | part | todo. */
LR.data.phases = [
  { n: '00', name: 'Công cụ PC', st: 'done' },
  { n: '01', name: 'Tái cấu trúc repo', st: 'done' },
  { n: '02', name: 'WSL2 + SITL', st: 'done' },
  { n: '03', name: 'Học ArduPilot (ảo)', st: 'part', note: 'còn 3 bài tự làm của người học' },
  { n: '04', name: 'Param + vật cản ảo', st: 'done' },
  { n: '05', name: 'Backend telemetry', st: 'done' },
  { n: '06', name: 'Backend điều khiển', st: 'done' },
  { n: '07', name: 'Mission + an toàn', st: 'done' },
  { n: '08', name: 'Web HUD', st: 'done' },
  { n: '09', name: 'Web bản đồ', st: 'done' },
  { n: '10', name: 'Web lái + video', st: 'done' },
  { n: '11', name: 'Firmware + param', st: 'done' },
  { n: '12', name: 'ESP32 + camera', st: 'done' },
  { n: '13', name: 'Chuẩn bị lắp ráp', st: 'part', note: 'camera đã chốt; còn tập hàn, chỗ làm' },
  { n: '14', name: 'Hàng về + nạp FC', st: 'part', note: 'FC đã nạp 13/10; còn kiểm hàng tay' },
  { n: '15', name: 'Bàn: RC + GPS', st: 'todo', hw: true },
  { n: '16', name: 'Bàn: nguồn + motor', st: 'todo', hw: true },
  { n: '17', name: 'Bàn: ESP32 + TFmini + cam', st: 'todo', hw: true },
  { n: '18', name: 'Lắp khung', st: 'todo', hw: true },
  { n: '19', name: 'Hiệu chỉnh + failsafe', st: 'todo', hw: true },
  { n: '20', name: 'Bay RC cơ bản', st: 'todo', hw: true },
  { n: '21', name: 'Bay tự động + web', st: 'todo', hw: true },
  { n: '22', name: 'Vật cản thật + tuning', st: 'todo', hw: true },
  { n: '23', name: 'IoT MQTT', st: 'todo', hw: true },
  { n: '24', name: 'QoS + báo cáo', st: 'todo', hw: true },
];

/* Lộ trình lắp ráp: 7 chặng, mỗi chặng ứng với một nhóm bước ở mục "Từng bước". */
LR.data.route = [
  { id: 'A', ph: '13', name: 'Chuẩn bị', time: '~2 giờ', where: 'Bàn làm việc', sum: 'Chỗ làm an toàn, đủ dụng cụ, tập hàn trên bảng tập hàn' },
  { id: 'B', ph: '14.1', name: 'Kiểm hàng', time: '~1 giờ', where: 'Bàn', sum: 'Đếm đồ, phân loại ren motor 2+2, đo cell pin' },
  { id: 'C', ph: '15', name: 'RC + GPS', time: '~4 giờ', where: 'Bàn, chỉ USB', sum: 'Bind, iBUS → R6, công tắc, failsafe RC, GPS + la bàn' },
  { id: 'D', ph: '16', name: 'Nguồn + motor', time: '~5 giờ', where: 'Bàn, có pin', sum: 'Hàn XT60 + tụ + dây motor, đo chập, cắm pin lần đầu, thử motor' },
  { id: 'E', ph: '17', name: 'ESP32 + TFmini + camera', time: '~7 giờ', where: 'Bàn, có pin', sum: 'Wi-Fi telemetry, web hiện drone thật, cảm biến vật cản, camera' },
  { id: 'F', ph: '18', name: 'Lắp khung', time: '~16 giờ', where: 'Bàn, 2–3 buổi', sum: 'Khung, motor, 12 mối nối, stack, GPS, receiver, pin, cân CG' },
  { id: 'G', ph: '19', name: 'Hiệu chỉnh + cánh', time: '~13 giờ', where: 'Trong nhà + ngoài trời', sum: 'Accel, la bàn, failsafe, geofence, gắn cánh, đo lực đẩy' },
];
