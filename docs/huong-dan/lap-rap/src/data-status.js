/* Trạng thái dự án — nguồn: plans/PROGRESS.md, docs/phan-cung-thuc-te.md, docs/so-tay/14-*.md,
   plans/reports/261025-kiem-tra-phan-cung-that.md, plans/reports/261025-hieu-chinh-bay-trong-nha.md.
   Sửa file này khi tiến độ đổi, rồi chạy lại build.py. */
LR.data.status = {
  asOf: '25/10/2026',
  here: {
    phase: '19–20',
    title: 'Bạn đang ở: đã lắp xong và bay thử trong nhà (Phase 19–20) → việc kế: hiệu chỉnh ngoài trời, bay F1–F4',
    text: 'Drone đã được thợ lắp xong, đã bay 24/10 (pin 6S, ngoài trời) và 25/10 (pin 4S, trong nhà, Stabilize, cao 10–50 cm). Còn lại: trả failsafe và fence về chế độ ngoài trời, hiệu chỉnh la bàn ngoài trời và radio, sửa TFmini, rồi bay F1–F4 chính thức.',
  },
  done: [
    { d: '21/09', p: '00–02', t: 'Công cụ PC (Mission Planner 1.3.83, MAVProxy, STM32CubeProgrammer, PlatformIO, esptool) + SITL ArduCopter 4.7.1 trong WSL2' },
    { d: '22–25/09', p: '05–07', t: 'Backend MAVLink: telemetry 8 Hz, lái có dead-man 300 ms, mission, máy trạng thái an toàn (264 test xanh)' },
    { d: '25/09', p: '08–10', t: 'Web GCS: HUD, bản đồ, soạn mission, lái WASD, panel vật cản, panel video (nguồn giả), 3D' },
    { d: '25/09', p: '11', t: 'Firmware custom `d450a747` (có PRX, AVOID, TFmini, BendyRuler) + `01-base.param`, `02-avoid-tfmini.param`' },
    { d: '12–13/10', p: '12', t: 'ESP32 CP2102 chạy DroneBridge 2.4.1, vào hotspot `IOTCV-HOTSPOT`, đẩy MAVLink về laptop' },
    { d: '13/10', p: '12', t: 'Camera ESP32-S3 + OV3660: firmware thật, VGA ~7,5 fps, nạp qua Wi-Fi (OTA) được' },
    { d: '13/10', p: '14', t: 'FC đã nạp ArduPilot (COM6), lưu `00-after-flash.param`, nạp `01-base.param` 34/34 dòng, baro + gyro đúng dấu' },
    { d: '24/10', p: '18–20', t: 'Thợ lắp xong drone; bay thử pin 6S ngoài trời: Stabilize treo 82 s, Loiter treo 155 s (log dataflash)' },
    { d: '25/10', p: '15', t: 'Cài failsafe RC trên tay phát (trước đó chưa cài) và thử thật: tắt tay phát → `Radio Failsafe` trong < 0,5 s, bật lại thì hết' },
    { d: '25/10', p: '16', t: 'Đổi cài đặt ESC OX32 để M1 hết khựng khi khởi động trên 4S; khôi phục 865 dòng tham số, đọc lại sau reboot' },
    { d: '25/10', p: '17', t: 'Web GCS thấy drone thật qua Wi-Fi sau khi sửa lỗi chốt sysid ở backend; rút USB: 160/160 mẫu, trễ 39–165 ms' },
    { d: '25/10', p: '19', t: 'Hiệu chỉnh accel 6 mặt + Calibrate Level + la bàn (trong nhà); sửa lỗi FC không arm sau khôi phục tham số (thiếu mã thiết bị accel / la bàn) → PreArm sạch' },
    { d: '25/10', p: '20', t: 'Bay thử trong nhà pin 4S, Stabilize: 2 lần rời đất (~24 s và ~33 s), cao 10–50 cm, nhấc ở ~41% ga, rung 0 clip' },
    { d: '25/10', p: '16', t: '`MOT_SPIN_ARM` 0,10 → 0,13: motor khởi động hụt 13/32 → 2/28 lần, M1 hết hụt' },
    { d: '25/10', p: '15', t: 'Bản đồ tay cầm kiểm trên tay phát thật bằng `doc_tay_cam.py`: SwC 3 chế độ, SwD RTL, SwB ARM/DISARM, núm VrB (CH9) qua ~1.800 µs → Auto' },
  ],
  todo: [
    { p: '14.1', t: 'Kiểm chiều ren motor 2+2; sạc đầy pin 4S và đo từng cell' },
    { p: '15', t: 'Hiệu chỉnh radio (RC1–8 vẫn mặc định 1100/1900) rồi lưu `02-radio.param`, `03-gps.param`' },
    { p: '16', t: 'Đo điện áp bằng đồng hồ vạn năng, bật `BATT_ARM_VOLT`; hiệu chỉnh dòng `BATT_AMP_PERVLT` theo mAh sạc lại' },
    { p: '17', t: 'Sửa TFmini (đang 1 khung/giây, đơn vị mm): hàn dây trắng vào T3 hoặc nối qua USB-TTL, chỉnh về mặc định, rồi bật lại `RNGFND1_TYPE 20`, `PRX1_TYPE 4`' },
    { p: '17', t: 'Xử lý Wi-Fi mất 19–32% gói (card Wi-Fi USB riêng hoặc router riêng) trước khi lái từ web' },
    { p: '18', t: 'Phiếu kiểm khung: cân CG và khối lượng, đo thông mạch lần cuối, chụp 13 ảnh' },
    { p: '19', t: 'Trả failsafe về RTL (`FS_THR_ENABLE 1`, `BATT_FS_LOW_ACT 2`), đặt fence theo bãi thật rồi bật lại; hiệu chỉnh la bàn ngoài trời + compassmot (kiểm `COMPASS_ORIENT 6`); đo lực đẩy' },
    { p: '20', t: 'Bay F1–F4 chính thức ngoài trời; sau mỗi buổi tải log kiểm motor khởi động hụt, mất đồng bộ giữa không trung, nhiệt ESC M2' },
  ],
  risks: [
    { lvl: 'danger', t: '**SwB là công tắc ARM/DISARM — gạt SwB lên khi đang bay thì FC disarm ngay, motor tắt, drone rơi.** Arm/disarm bằng cần (`ARMING_RUDDER 2`) vẫn dùng được. Núm VrB = Auto: để hết bên trái khi không dùng.' },
    { lvl: 'danger', t: '**Motor khởi động hụt / mất đồng bộ.** `MOT_SPIN_ARM 0,13` còn hụt 2/28 lần; ESC OX32 với cánh 10" còn sát giới hạn. Xem log mỗi buổi; tụt vòng giữa không trung thì kiểm 12 mối hàn motor.' },
    { lvl: 'warn', t: '**Cấu hình "trong nhà" đang tạm:** TFmini / PRX và fence tắt (chưa có tránh vật cản), failsafe mất sóng và pin yếu đặt Land. Trả về RTL và bật fence trước khi ra ngoài trời.' },
    { lvl: 'warn', t: '**La bàn mới hiệu chỉnh trong nhà**, đọc mạnh hơn mô hình 11% và tăng theo dòng điện (450 → 514 mG khi 0 → 12 A). Hiệu chỉnh lại ngoài trời + compassmot trước khi bay Loiter; không thì Loiter quay vòng.' },
    { lvl: 'warn', t: '**Wi-Fi mất gói** (laptop quét Wi-Fi làm cả hai ESP32 mất sóng 3–6 s): đủ làm dead-man 300 ms tự dừng drone. Chẩn đoán `wifi_ping_check.py`; xử lý trước khi lái từ web.' },
    { lvl: 'warn', t: '**Ngưỡng pin FC đặt cho 4S** (`BATT_LOW_VOLT 14,0`): cắm 6S thì failsafe pin vô tác dụng và ở ga cao motor nhận ~3 lần công suất định mức. Bay 4S; muốn 6S phải đặt ngưỡng 6S và giới hạn `MOT_SPIN_MAX` trước.' },
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
    ['Bản đồ công tắc', 'Arm / disarm bằng cần; CH8 (SwB) để trống cho Auto ở Phase 21', '**SwB (CH8) = ARM/DISARM** (`RC8_OPTION 153`); **Auto = núm VrB (CH9, `RC9_OPTION 16`)**; arm bằng cần vẫn dùng được', 'Phase 15, 25/10'],
    ['Số nấc công tắc', 'SwB 3 vị trí (Phase 15.4)', '**Chỉ SwC có 3 nấc**; SwA, SwB, SwD đều 2 nấc', 'Phase 15, 25/10'],
    ['`MOT_SPIN_ARM`', '`0.10`', '`0.13` — motor khởi động hụt giảm từ 13/32 xuống 2/28 lần; 0,15 không tốt hơn', '01-base.param, 25/10'],
    ['Cài đặt ESC OX32', 'Mặc định motor đua: timing 15°, demag Low, rampup 50%, low-RPM protection ON', '**Timing 20°, demag High, rampup 80%, low-RPM On Adaptive** (đổi qua Betaflight tạm, rồi nạp lại ArduPilot)', 'firmware/esc-ox32/, 25/10'],
    ['Khung motor trong FC', '`FRAME_TYPE 12`', 'FC đang chạy `FRAME_TYPE 1` + `SERVO1..4_FUNCTION 36/33/34/35` — cùng thứ tự motor với `FRAME_TYPE 12`, không cần sửa', 'Báo cáo 25/10'],
    ['Thứ tự cắm nguồn', 'Cắm USB cho FC rồi mới cắm pin', '**Cắm pin trước, USB sau**; tắt thì rút cả hai. USB trước pin thì FC không thấy la bàn (phải khởi động lại FC)', 'Báo cáo 25/10 chiều'],
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
  { n: '13', name: 'Chuẩn bị lắp ráp', st: 'part', note: 'thợ lắp ráp; phiếu chuẩn bị không còn cần' },
  { n: '14', name: 'Hàng về + nạp FC', st: 'part', note: 'FC nạp 13/10; còn kiểm chiều ren motor, cell pin' },
  { n: '15', name: 'Bàn: RC + GPS', st: 'part', hw: true, note: 'RC, GPS, failsafe RC, bản đồ công tắc xong; còn hiệu chỉnh radio, lưu 02-radio/03-gps' },
  { n: '16', name: 'Bàn: nguồn + motor', st: 'part', hw: true, note: 'motor + ESC chạy, thứ tự/chiều đúng (đã bay); còn đo bằng đồng hồ, BATT_ARM_VOLT' },
  { n: '17', name: 'Bàn: ESP32 + TFmini + cam', st: 'part', hw: true, note: 'Wi-Fi, web, camera xong; TFmini sai cấu hình' },
  { n: '18', name: 'Lắp khung', st: 'part', hw: true, note: 'đã lắp xong và bay được; phiếu kiểm khung, cân, ảnh chưa làm' },
  { n: '19', name: 'Hiệu chỉnh + failsafe', st: 'part', hw: true, note: 'accel, level, la bàn (trong nhà) xong, PreArm sạch; còn la bàn ngoài trời, fence, đo lực đẩy' },
  { n: '20', name: 'Bay RC cơ bản', st: 'part', hw: true, note: 'bay thử Stabilize trong nhà 10–50 cm; F1–F4 chính thức chưa' },
  { n: '21', name: 'Bay tự động + web', st: 'todo', hw: true },
  { n: '22', name: 'Vật cản thật + tuning', st: 'todo', hw: true },
  { n: '23', name: 'IoT MQTT', st: 'todo', hw: true },
  { n: '24', name: 'QoS + báo cáo', st: 'todo', hw: true },
];

/* Các bước đã xong theo hai báo cáo 25/10 (plans/reports/261025-*.md). app.js gộp danh sách này
   vào tick của người dùng đúng MỘT lần cho mỗi `ver`: không xoá tick đã có, không ép lại nếu người
   dùng bỏ tick sau đó. Thêm đợt mới = đổi `ver` và cập nhật `ids`.
   Chỉ liệt kê bước mà báo cáo cho thấy kết quả đã có thật; bước đo / chụp / tập hàn / cân / bước
   còn trong danh sách "Còn lại" để trống. */
LR.data.stepsDoneSeeds = [{
  ver: '20261025',
  ids: [
    'B3', 'B5', // 4 motor quay êm, 4 ESC chạy
    'C1', 'C2', 'C3', 'C4', 'C6', 'C7', 'C8', // FC khoẻ, receiver iBUS, bind, tay phát, failsafe RC, GPS M10
    'D2', 'D4', 'D10', 'D11', 'D13', // motor nối ESC, stack, thứ tự + chiều motor (đã bay), PreArm
    'E1', 'E3', 'E4', 'E5', // hotspot, ESP32 SERIAL2, telemetry Wi-Fi, web drone thật
    'F2', 'F4', 'F6', 'F8', 'F11', 'F15', // khung, motor, mối hàn motor, receiver, pin (đã bay)
    'G2', 'G6', 'G9', // accel + level, failsafe RC trên khung, cánh (đã bay có cánh)
  ],
}, {
  ver: '20261025b',
  // người dùng xác nhận 25/10 tối (thợ làm, không có số đo): ren 2+2, tụ (1500 µF 35 V thay tụ 1000 µF), đo chập trước khi cắm pin
  ids: ['B4', 'D3', 'D5'],
}];

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
