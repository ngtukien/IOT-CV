/* Phần việc trên máy tính — Claude làm. Nguồn: AGENTS.md, scripts/, chay-tat-ca.bat, .env.example. */
LR.data.pc = {
  rules: [
    { k: 'Claude làm', v: 'Mọi việc trên laptop: nạp firmware / tham số, đọc trạng thái FC, hiệu chỉnh qua Mission Planner (điều khiển bằng cua-driver), cấu hình ESP32, bật hotspot, chạy backend + web, đọc log, ghi sổ tay và PROGRESS.' },
    { k: 'Bạn làm', v: 'Thao tác tay: hàn, cắm cáp, lắp khung, đo đồng hồ, cầm / xoay / đặt drone khi được báo, gõ số đo vào chat.' },
    { k: 'Ngoại lệ cứng', v: 'Mọi thao tác làm **motor quay thật** — ARM, Motor Test, đo lực đẩy — **bạn** tự bấm, tay giữ tay phát. Claude chỉ mở sẵn màn hình và đặt thông số.' },
    { k: 'Không tự động được', v: 'Claude dừng và nói đúng thao tác cần làm (giữ BOOT, rút cắm cáp…) thay vì thử mò.' },
    { k: 'Git', v: 'Claude chỉ ghi file; commit / push / PR khi bạn bảo.' },
  ],
  modes: [
    {
      id: 'sitl', name: 'Drone ảo (SITL)', cmd: 'chay-tat-ca.bat', stop: 'dung-tat-ca.bat',
      what: 'Bật SITL trong WSL → MQTT (nếu có Docker) → backend `tcp:127.0.0.1:5760` → web `http://localhost:5173`, tự mở trình duyệt. Mission Planner nối SITL ở cổng **5762**.',
      when: ['Tập thao tác web **trước chặng E** (không phải đợi phần cứng)', 'Tập lái web / dead-man **trước Phase 21**', 'Kiểm web còn chạy sau khi sửa code'],
      never: 'Đừng chạy khi đang nối drone thật: nó **tắt** backend đang chạy (cổng 8000) và trỏ backend sang drone ảo.',
    },
    {
      id: 'real', name: 'Drone thật (qua ESP32)', cmd: 'Claude chạy (không dùng file .bat)', stop: 'Claude tắt',
      what: 'Backend nghe `udpin:0.0.0.0:14550` (gói từ ESP32 qua hotspot) + camera thật (`CAMERA_FAKE=0`, `CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream`) + web `pnpm dev`. Bạn chỉ mở `http://localhost:5173`.',
      when: ['Chặng E (bước E5 trở đi)', 'Mọi buổi bay có web (Phase 21+)'],
      never: 'Mission Planner và backend **không** nghe chung cổng UDP 14550: dùng một cái một lúc (hoặc Claude dựng bộ chia mavp2p khi cần cả hai).',
    },
  ],
  ports: [
    ['FC (ArduPilot)', '`COM6`', 'USB `1209:5741`; khi còn Betaflight là COM5', 'Cáp USB-C'],
    ['ESP32 DroneBridge', '`COM4`', 'CP2102 `10C4`, nạp chỉ 115200 baud', '`DroneBridgeESP32.mshome.net`'],
    ['Camera ESP32-S3', '`COM7`', 'CH343P `1A86:55D3`, cổng ghi **USB-UART**', '`iotcv-camera.mshome.net` — `:81/stream`, `:80/status`'],
    ['USB-TTL CP2102', 'COM mới', 'cùng chip với ESP32 DevKit → nhận theo thời điểm cắm', '—'],
    ['Hotspot laptop', '`IOTCV-HOTSPOT`', '2,4 GHz, laptop = `192.168.137.1`', 'tường lửa: `IOTCV MAVLink UDP 14550`'],
    ['Backend / Web', '`:8000` / `:5173`', 'Web mở ở `http://localhost:5173`', 'SITL: `tcp:127.0.0.1:5760`'],
  ],
  params: [
    { f: '00-after-flash.param', st: 'done', when: 'Phase 14 — ngay sau khi nạp (850 tham số)' },
    { f: '01-base.param', st: 'done', when: 'Phase 14 — đã nạp 34/34; sửa 1 dòng `BATT_VOLT_MULT` ở D8' },
    { f: '02-radio.param', st: 'todo', when: 'C6 — sau hiệu chỉnh radio + gán công tắc (snapshot)' },
    { f: '03-gps.param', st: 'todo', when: 'C8 — sau khi GPS có fix, la bàn được nhận (snapshot)' },
    { f: '02-avoid-tfmini.param', st: 'todo', when: 'E8 — file viết sẵn, nạp vào FC' },
    { f: '04-pre-first-flight.param', st: 'todo', when: 'G11 — sau hiệu chỉnh trên khung (snapshot)' },
    { f: '05 → 07', st: 'todo', when: 'Phase 20 · 21 · 24' },
  ],
  never: [
    '`RC*_MIN/MAX/TRIM`, `COMPASS_OFS*`, `INS_ACC*` **không bao giờ** nạp bằng file — chỉ chạy wizard.',
    'Không nạp snapshot của drone khác (hoặc của SITL) lên bo thật.',
    'Không đổi `ARMING_CHECK`.',
  ],
};

/* Tra cứu nhanh — pad FC (mặt trên) dự án dùng. */
LR.data.pads = [
  ['T2 · R2 · G', 'Mặt trên, mép trước, hàng trong', 'ESP32 RX2 · TX2 · GND', 'E3'],
  ['B+ · B−', 'Mặt trên, mép trước, hàng ngoài', 'Còi (đỏ · đen)', 'C9'],
  ['T3 · R3', 'Mặt trên, mép sau, hàng ngoài (cạnh **9V**)', 'TFmini trắng (RXD) · xanh (TXD)', 'E7'],
  ['5V · G (cụm LED1)', 'Mặt trên, góc sau-phải', 'TFmini đỏ · đen', 'E7'],
  ['Cổng GPS 6P', 'Mặt dưới, mép trước', 'GPS M10 qua cáp hộp Deluxe', 'C7'],
  ['Cổng receiver 4P', 'Mặt dưới, mép sau', 'iA6B i-BUS qua cáp hộp Deluxe', 'C2'],
  ['Cổng 10P', 'Mặt dưới, mép trước', 'ESC (cáp 25 mm)', 'D4'],
  ['Cổng HD 6P', 'Mặt dưới, mép sau', '**Không dùng** (chân 1 = 9V)', '—'],
];

LR.data.motors = [
  ['M1', 'sau-phải', 'CW', 'ren trái', 'cánh CW (pusher)', 'B'],
  ['M2', 'trước-phải', 'CCW', 'ren phải', 'cánh CCW (thường)', 'A'],
  ['M3', 'sau-trái', 'CCW', 'ren phải', 'cánh CCW (thường)', 'C'],
  ['M4', 'trước-trái', 'CW', 'ren trái', 'cánh CW (pusher)', 'D'],
];

LR.data.thresholds = [
  ['Pin đầy / danh định / storage', '16,8 V · 14,8 V · 15,2–15,4 V'],
  ['Cell lệch tối đa', '< 0,05 V (bay: ≤ 0,03 V sau Balance)'],
  ['`BATT_LOW_VOLT` / `BATT_CRT_VOLT`', '14,0 V → RTL · 13,2 V → LAND'],
  ['`BATT_ARM_VOLT`', '14,8 V (đặt sau khi hiệu chỉnh điện áp)'],
  ['Đường 5V / 4V5 / UBEC', '4,8–5,2 V · ≥ 4,7 V · 4,8–5,2 V'],
  ['GPS dùng được', '3D Fix, HDOP < 1,5, ≥ 9 vệ tinh (≥ 10 khi bay)'],
  ['Rung (log)', '< 30 m/s² ổn · > 60 m/s² hỏng giữ độ cao'],
  ['Tỉ số lực đẩy', '≥ 2 : 1 (dự kiến 2,6–2,8)'],
  ['Geofence đề xuất', 'trần 30 m, bán kính ≤ 50 m (theo bãi)'],
];
