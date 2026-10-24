/* Linh kiện — khớp docs/phan-cung-thuc-te.md (SSOT, cập nhật 12–13/10/2026).
   st: ok = đã kiểm trên phần cứng; part = kiểm một phần; todo = chưa kiểm. */
LR.data.parts = [
  {
    id: 'fc', name: 'Bo bay SpeedyBee F405 V5', sub: 'bản "Model Aircraft" — não của drone',
    st: 'ok', stText: 'Đã nạp ArduPilot 4.7.1 (13/10) — COM6',
    img: 'real_fc_top', more: ['real_fc_bot', 'real_fc_side', 'sb_fclayout', 'sb_wiring', 'sb_dims'], diag: 'fcTop',
    specs: [
      ['Chip', 'STM32F405, 1 MB flash, gyro ICM-42688, baro SPA06, blackbox 16 MB'],
      ['Kích thước', '39 × 39 mm, lỗ bắt 30,5 × 30,5 (M3)'],
      ['Firmware', 'ArduCopter 4.7.1 custom `d450a747`, banner `speedybeef4v5`'],
      ['UART', 'SERIAL2 = ESP32 · SERIAL3 = TFmini · SERIAL4 = GPS · SERIAL5 = ESC telem · SERIAL6 = receiver'],
      ['Nguồn ra', '5V (BEC), 9V (VTX), 4V5 — 4V5 có điện cả khi chỉ cắm USB (≤ 1 A chung)'],
      ['Cổng cắm', 'USB-C · SH1.0 6P GPS (mặt dưới, mép trước) · SH1.0 4P receiver + 6P "HD" (mặt dưới, mép sau) · 10P sang ESC'],
    ],
    traps: [
      'Pad **9V** nằm ngay cạnh T3/R3; **chân 1 cổng HD là 9V** — không bao giờ cho TFmini (5 V) chạm vào.',
      'Không có la bàn trong bo — la bàn duy nhất nằm trong GPS M10.',
      'Jumper SBUS để hở, jumper "BARO →" đã nối sẵn — để nguyên.',
      'Mũi tên trên mặt FC chỉ về **mép trước** = mép có cổng 10 chân, cổng GPS, pad T2/R2.',
    ],
  },
  {
    id: 'esc', name: 'ESC SpeedyBee OX32 55A 4-in-1', sub: 'tầng dưới của stack — cấp dòng cho 4 motor',
    st: 'todo', stText: 'Chưa kiểm bằng mắt',
    img: 'sb_esc_top', more: ['sb_esc_bot', 'sb_esclayout', 'sb_motor', 'sb_fcesc'], diag: 'escTop',
    specs: [
      ['Dòng', '55 A liên tục mỗi kênh, pin 3–6S'],
      ['Kích thước', '40,9 × 44,9 mm, dày 8 mm, lỗ 30,5'],
      ['Tín hiệu', 'DShot300 (`MOT_PWM_TYPE 5`) — không cần "calib ESC"'],
      ['Pad', '12 pad motor (hai bên) · pad nguồn + − ở mép sau · cổng 10 chân ở mặt dưới'],
      ['Đo dòng', '`BATT_AMP_PERVLT 370.4`, `BATT_AMP_OFFSET 0.0071` (đã nạp)'],
    ],
    traps: [
      'Lắp chuẩn: mặt tản nhiệt "55A" quay **lên** (về phía FC), cáp 10 chân vòng qua mép trước.',
      'Motor **4** trước-trái, **2** trước-phải, **3** sau-trái, **1** sau-phải — đây chính là số ArduPilot dùng với `FRAME_TYPE 12`.',
    ],
  },
  {
    id: 'motor', name: 'Motor T-Motor AIR2216 II KV920 × 4', sub: 'bộ AIR GEAR 450 II',
    st: 'todo', stText: 'Chưa kiểm ren 2+2',
    img: 'tm_motors', more: ['tm_dims', 'tm_props'], diag: 'threadSort',
    specs: [
      ['Kích thước', 'Ø27,7 × 31 mm, 64 g; trục ren M6 (cánh vặn thẳng lên, tự siết)'],
      ['Bắt cần', '4 × M3 trên lỗ 16 × 19 mm'],
      ['Dây gốc', '150 mm, ba màu xanh dương / đen / đỏ → **phải nối dài ~30 cm**'],
      ['Lực đẩy', '1332 g/motor ở 4S + T1045 (trần cánh 1200 g)'],
    ],
    traps: [
      'Bộ có **2 motor ren phải + 2 ren trái**. Ren phải → vị trí CCW (M2, M3); ren trái → vị trí CW (M1, M4).',
      'Ốc M3 quá dài đâm vào cuộn dây → chập motor. Dùng ốc đi kèm motor.',
    ],
  },
  {
    id: 'prop', name: 'Cánh T1045 × 8', sub: '4 dùng + 4 dự phòng',
    st: 'todo', stText: 'Chưa kiểm — để trong hộp tới bước 19.13',
    img: 'tm_props', more: ['ap_cwlegend'], diag: 'propId',
    specs: [
      ['Cỡ', '10 inch, bước 4,5'],
      ['Chiều', 'CW = cánh "pusher" (thường có chữ R) · CCW = cánh thường'],
      ['Giới hạn', '1,2 kg lực đẩy/cánh, đẹp nhất 6000–7000 vòng/phút'],
    ],
    traps: ['Gắn cánh **chỉ sau khi toàn bộ checklist 19.12 đã qua**. Mỗi lần chạm cánh: rút pin trước.'],
  },
  {
    id: 'frame', name: 'Khung Holybro S500 V2', sub: '480 mm, tấm đế là bo chia nguồn (PDB)',
    st: 'todo', stText: 'Chưa kiểm',
    img: 's500_parts', more: ['s500_built', 's500_side'], diag: 'frameTop',
    specs: [
      ['Khối lượng', '782 g (khung + chân đáp, theo Holybro)'],
      ['Bộ', '4 cần · tấm đế PDB (pad + −, khe luồn dây đai) · tấm trên hình chữ X · 2 chân carbon + 2 thanh đáp bọc xốp · ray gắn phụ kiện'],
      ['Motor-motor', '480 mm theo đường chéo'],
    ],
    traps: [
      '**CẤM KHOAN tấm đế**: có đường đồng đúc chìm bên trong — khoan trúng là đứt mạch hoặc chập chờn khi nóng.',
      'Không có lỗ 30,5 × 30,5 → bắt stack qua **bát chống rung**, không bắt cứng.',
    ],
  },
  {
    id: 'gps', name: 'GPS Holybro M10 + la bàn IST8310', sub: 'cáp JST-GH 1,25 mm 10 chân + cột nâng',
    st: 'todo', stText: 'Chưa kiểm (xem vỏ là V1 hay V2)',
    img: 'm10_pin_v1', more: ['m10_pin_v2'], diag: 'cableGps',
    specs: [
      ['Nguồn', '4,7–5,2 V (cổng GPS của FC ghi 4V5 — phải đo)'],
      ['Tín hiệu', 'UART → SERIAL4 230400 (`GPS1_TYPE 2`), la bàn I2C (SDA/SCL)'],
      ['Chân GH 10P', '1 VCC (đỏ) · 2 RX · 3 TX · 4 SCL · 5 SDA · 6–9 phụ/NC · 10 GND'],
    ],
    traps: [
      'Giắc GH 1,25 của M10 **không** cắm vừa cổng SH 1,0 của FC → nối 6 dây qua cáp GPS của hộp Deluxe.',
      '**Bắt chéo**: GPS TX → R4, GPS RX → T4. Sai thì đèn GPS vẫn sáng nhưng báo "No GPS".',
      'Bản V1: chân 6–9 là SAFETY_SWITCH, LED, **3V3**, BUZZER− — cắt và bọc riêng từng sợi.',
    ],
  },
  {
    id: 'rc', name: 'Tay phát FlySky FS-i6X', sub: 'AFHDS 2A, 4 công tắc SwA–SwD',
    st: 'todo', stText: 'Chưa bind',
    img: 'fs_i6x', more: [], diag: 'txSwitches',
    specs: [
      ['Gán kênh (chốt)', 'CH5 = SwC (chế độ bay) · CH6 = SwD (RTL) · CH7 = SwA (WEB CONTROL) · CH8 = SwB (để dành Auto)'],
      ['Phải đặt', 'Output **i-BUS**; failsafe kênh ga = thấp nhất'],
    ],
    traps: ['Failsafe phải đặt **cả trên tay phát** (lớp 1) **và** trên FC (`FS_THR_ENABLE 1`, lớp 2).'],
  },
  {
    id: 'rx', name: 'Bộ thu FlySky FS-iA6B', sub: 'nói với FC bằng i-BUS',
    st: 'todo', stText: 'Chưa kiểm (còn bind plug?)',
    img: 'ia6b_ports', more: [], diag: 'cableRx',
    specs: [
      ['Nguồn', '4,0–8,4 V'],
      ['Kích thước', '47 × 26,2 × 15 mm, 14,9 g, 2 anten'],
      ['Nối FC', 'cổng **Servo (i-BUS)** → R6 (SERIAL6, `RC_PROTOCOLS 4`)'],
    ],
    traps: ['Không dùng cổng PPM (F405 V5 không hỗ trợ PPM), không dùng cổng SENS.'],
  },
  {
    id: 'tfmini', name: 'Cảm biến khoảng cách TFmini Plus', sub: 'Benewake LiDAR, nhìn thẳng phía trước',
    st: 'todo', stText: 'Chưa thử (Phase 17)',
    img: 'tfmini', more: ['tfmini_holes'], diag: 'cableTf',
    specs: [
      ['Nguồn', '**5 V ± 0,5 V**, ≤ 110 mA (đỉnh 140 mA), không có bảo vệ quá áp / ngược cực'],
      ['Tín hiệu', 'UART 115200, logic 3,3 V: TXD → R3, RXD ← T3 (SERIAL3, `RNGFND1_TYPE 20`)'],
      ['Tầm', '0,1–12 m (vật sáng), 0,1–4 m (vật tối); chùm tia 3,6°'],
      ['Cơ khí', '35 × 18,5 × 21 mm, 12 g, 2 lỗ M2 cách 28 × 11,5 mm, cáp 30 cm'],
      ['Màu dây', 'đỏ +5V · trắng RXD · xanh TXD · đen GND'],
    ],
    traps: ['Pad 9V ngay cạnh R3 và cáp DJI 6 chân có 9V — cả hai giết TFmini ngay lập tức.'],
  },
  {
    id: 'esp32', name: 'ESP32 DevKit CP2102 — cầu MAVLink Wi-Fi', sub: 'ESP32-D0WD-V3, flash 4 MB, 30 chân',
    st: 'ok', stText: 'Đã nạp DroneBridge 2.4.1 (12/10), STA vào hotspot (13/10) — COM4',
    img: 'real_esp32', more: ['real_esp32_pins'], diag: 'cableEsp',
    specs: [
      ['Firmware', 'DroneBridge 2.4.1 — Wi-Fi client vào `IOTCV-HOTSPOT`, đẩy về `192.168.137.1:14550`'],
      ['Tên mạng', '`DroneBridgeESP32.mshome.net`'],
      ['UART', 'TX2 = GPIO17 → R2 của FC · RX2 = GPIO16 ← T2 của FC · 115200'],
      ['Cổng', 'micro-USB (CP2102), header đực sẵn → dùng dây Dupont **cái**'],
    ],
    traps: ['Nạp chỉ ở **115200 baud**. Nguồn lấy từ UBEC, **không** từ pad 5V của stack.'],
  },
  {
    id: 'cam', name: 'Camera ESP32-S3 N16R8 + OV3660', sub: 'phát MJPEG qua Wi-Fi về laptop',
    st: 'ok', stText: 'Firmware thật + OTA (13/10) — COM7',
    img: 'real_s3_top', more: ['real_s3_bot', 's3_dims'], diag: 'cablePwr',
    specs: [
      ['Bo', '57,2 × 28,1 mm, 12,3 g; flash 16 MB, PSRAM 8 MB'],
      ['Cổng', '2 USB-C (mặt dưới in **USB-UART** = COM7 và USB-OTG), khe microSD'],
      ['Mạng', '`http://iotcv-camera.mshome.net:81/stream`, `/status` và `/set` ở cổng 80'],
      ['Chân nguồn', '**5V** ở góc trên-trái, **GND** ở góc dưới-trái (cạnh hai cổng USB)'],
    ],
    traps: [
      'Bo **chưa hàn header** — lỗ chân trống. Cấp nguồn: hàn 2 chân (5V, GND) hoặc qua cổng USB-C.',
      'Tem "KHÔNG ĐƯỢC XÉ" cạnh nút BOOT — bấm qua tem được, đừng bóc.',
      'XCLK phải 10 MHz (đã đặt trong firmware) — 20 MHz làm hỏng Wi-Fi của chính bo.',
    ],
  },
  {
    id: 'usbttl', name: 'Mạch USB-TTL CP2102', sub: 'đọc TFmini trên máy tính trước khi cắm FC',
    st: 'todo', stText: 'Đã mua, chưa dùng',
    img: null, more: [], diag: 'cableTfBench',
    specs: [
      ['Logic', '3,3 V (khớp TFmini và ESP32)'],
      ['Chân thường có', '5V · 3V3 · GND · TXD · RXD (đọc nhãn in trên mạch thật)'],
      ['Driver', 'CP210x đã có sẵn trên máy (bản cài lưu ở `D:\\IOT_Tools\\downloads\\drivers\\cp210x\\`)'],
    ],
    traps: ['Bắt chéo: TXD của mạch → RXD của cảm biến và ngược lại.'],
  },
  {
    id: 'ubec', name: 'UBEC 5V 3A', sub: 'nguồn riêng cho hai bo ESP32',
    st: 'todo', stText: 'Đã mua, chưa đo',
    img: null, more: [], diag: 'power',
    specs: [
      ['Vào', 'thẳng từ pin 4S (hàn song song pad + − của ESC)'],
      ['Ra', '5 V, tới 3 A → bảng chia nguồn → ESP32 DevKit + camera (< 1 A thực tế)'],
    ],
    traps: [
      'Đo đầu ra **trước khi** nối ESP32 (một số UBEC có jumper 5V/6V).',
      'Hai bo ESP32 bật Wi-Fi gây sụt áp — vì thế **không** ăn chung 5V với FC.',
      'GND của UBEC và GND của FC phải chung (qua pin) — UART cần GND chung.',
    ],
  },
  {
    id: 'bat', name: 'Pin Ovonic LiPo 4S 5300 mAh 110C', sub: 'giắc XT60 + dây cân bằng',
    st: 'todo', stText: 'Chưa đo từng cell',
    img: null, more: [], diag: 'charger',
    specs: [
      ['Khối lượng', '423 g'],
      ['Điện áp', '16,8 V đầy · 14,8 V danh định · storage 15,2–15,4 V (3,80–3,85 V/cell)'],
      ['Ngưỡng FC', '`BATT_LOW_VOLT 14.0` → RTL · `BATT_CRT_VOLT 13.2` → LAND'],
    ],
    traps: ['Không dùng pin phồng / rách / lệch cell > 0,05 V. Không sạc khi không có người trông.'],
  },
  {
    id: 'charger', name: 'Sạc SkyRC iMAX B6AC V2', sub: '50 W, có Battery Meter',
    st: 'todo', stText: 'Chưa dùng',
    img: null, more: [], diag: 'charger',
    specs: [
      ['Chế độ dùng', 'LiPo **Balance** (sạc đầy trước buổi bay) · **Storage** (cất pin) · Battery Meter (đo từng cell)'],
      ['Dòng sạc', '≤ 1C = 5,3 A; khuyên 3–5 A (máy 50 W tối đa ~3 A ở 4S)'],
    ],
    traps: ['Cắm XT60 trước rồi mới cắm dây cân bằng; sạc trong túi chống cháy.'],
  },
  {
    id: 'acc', name: 'Phụ kiện lắp ráp', sub: 'theo danh sách mua Phase 13',
    st: 'todo', stText: 'Đối chiếu ở bước A2',
    img: null, more: [], diag: 'gauges',
    specs: [
      ['Cơ khí', 'bát chống rung 30,5 × 30,5 · băng keo xốp 3M VHB · dây rút 2,5 × 100 · velcro + dây đai pin'],
      ['Dây', 'silicone **16AWG** 3 màu ~4,5 m (nối dài motor) · dây tín hiệu 24–28AWG · dây Dupont cái-cái và đực-cái'],
      ['Điện', 'gen co nhiệt 2–10 mm · (tuỳ) tụ 470–1000 µF ≥ 16 V low-ESR cho camera'],
    ],
    traps: ['Dây 16AWG phải là loại **nhiều sợi mảnh, mềm** — lõi cứng nứt mối hàn khi rung.'],
  },
];

/* Hộp Deluxe — 24 món (ảnh chính hãng v5_29). use: dung | duphong | tuychon | khong | cam */
LR.data.deluxe = [
  { img: 'dx_fc', name: 'Bo bay F405 V5', qty: 1, use: 'dung', how: 'Tầng trên của stack.', step: 'D4' },
  { img: 'dx_esc', name: 'ESC OX32 55A 4-in-1', qty: 1, use: 'dung', how: 'Tầng dưới của stack, mặt "55A" quay lên.', step: 'D4' },
  { img: 'dx_practice', name: 'Bảng tập hàn', qty: 1, use: 'dung', how: '**Dùng trước tiên.** Tập trên pad nhỏ (giống pad UART) và pad to (giống pad nguồn) tới khi 5 mối liên tiếp đạt.', step: 'A3' },
  { img: 'dx_smoke', name: 'Short-Circuit Protection Tool (smoke stopper)', qty: 1, use: 'dung', how: 'Cắm giữa pin và drone ở **lần cấp điện đầu** (chọn 1A). Đèn đỏ nháy / tự ngắt = chập → rút pin. Tháo ra trước khi chạy motor.', step: 'D6' },
  { img: 'dx_c10s', name: 'Cáp 10 chân SH1.0 — 25 mm', qty: 1, use: 'dung', how: 'Nối ESC ↔ FC khi chồng tầng chuẩn. Cắm một chiều, không dùng lực.', step: 'D4' },
  { img: 'dx_c10l', name: 'Cáp 10 chân SH1.0 — 75 mm', qty: 1, use: 'duphong', how: 'Chỉ dùng khi FC và ESC đặt xa nhau. Giữ làm dự phòng.' },
  { img: 'dx_dji', name: 'Cáp DJI Air Unit 6 chân', qty: 1, use: 'cam', how: '**KHÔNG DÙNG.** Chân 1 mang **9 V** — cắm cho TFmini là cháy cảm biến. Dự án không có kính FPV.' },
  { img: 'dx_gps6', name: 'Cáp GPS 6 chân + đầu SH1.0 rời', qty: 1, use: 'dung', how: 'Đầu SH1.0 cắm cổng GPS của FC; đầu dây nối với 6 dây của M10 theo **tên tín hiệu**. Vỏ giắc rời không dùng (M10 là họ GH1.25).', step: 'C7' },
  { img: 'dx_gps4', name: 'Cáp GPS 6 → 4 chân', qty: 1, use: 'khong', how: 'Dành cho GPS **không có la bàn**. M10 có la bàn → không dùng.' },
  { img: 'dx_typecc', name: 'Cáp module Type-C 4 chân', qty: 1, use: 'tuychon', how: 'Đi cùng module Type-C rời (bên dưới).' },
  { img: 'dx_rx4', name: 'Cáp receiver 4 chân 100 mm', qty: 1, use: 'dung', how: 'Đầu SH1.0 cắm cổng receiver; đầu dây làm thành 3 đầu Dupont cái (S, +, −) cắm cổng i-BUS của iA6B. Dây T6 bỏ, bọc lại.', step: 'C2' },
  { img: 'dx_bzw', name: 'Dây còi đỏ-đen 100 mm', qty: 1, use: 'dung', how: 'Nối còi với pad B+ / B−.', step: 'C9' },
  { img: 'dx_buzzer', name: 'Còi active', qty: 1, use: 'dung', how: '**Nên lắp**: ArduPilot kêu khi arm, khi pin yếu, và giúp tìm drone rơi (`HAL_BUZZER_PIN` có trong hwdef). Đỏ → B+, đen → B−.', step: 'C9' },
  { img: 'dx_typecm', name: 'Module USB-C rời', qty: 1, use: 'tuychon', how: 'Đưa cổng USB ra chỗ dễ cắm (hàn vào pad G / D− / D+ / IN ở mặt dưới FC). Không bắt buộc: cổng USB-C của FC vẫn với tới khi stack nằm trên tấm trên.' },
  { img: 'dx_nuts', name: '5 ốc nylon M3', qty: 5, use: 'dung', how: 'Vặn trên cùng, giữ FC. Nylon = không dẫn điện.', step: 'D4' },
  { img: 'dx_fccov', name: '5 vỏ silicone FC (vàng)', qty: 5, use: 'dung', how: 'Đã gắn sẵn trong 4 lỗ FC — giảm rung, cách điện ốc.', step: 'D4' },
  { img: 'dx_xt60', name: 'Dây nguồn XT60 120 mm', qty: 1, use: 'dung', how: 'Hàn vào pad + − của ESC. Không vươn tới pin dưới bụng thì nối qua pad + − của tấm đế PDB.', step: 'D3' },
  { img: 'dx_washers', name: '5 đệm silicone đen M3', qty: 5, use: 'dung', how: 'Kẹp **giữa** ESC và FC trên mỗi ốc — giữ khe hở, chống hai tầng chạm nhau.', step: 'D4' },
  { img: 'dx_esccov', name: '5 vỏ silicone ESC', qty: 5, use: 'dung', how: 'Gắn vào 4 lỗ của ESC.', step: 'D4' },
  { img: 'dx_capshr', name: '2 gen co cho tụ (đỏ, đen)', qty: 2, use: 'dung', how: 'Gen **đỏ** bọc chân +, gen **đen** bọc chân − của tụ.', step: 'D3' },
  { img: 'dx_screws', name: '4 ốc M3 × 30 mm', qty: 4, use: 'dung', how: 'Xuyên từ dưới qua ESC và FC, khoá trên bằng ốc nylon.', step: 'D4' },
  { img: 'dx_cap', name: 'Tụ 35 V 1000 µF', qty: 1, use: 'dung', how: 'Hàn sát pad + − của ESC, **đúng cực** (chân dài = +). Hấp thụ xung điện áp khi ESC đóng cắt.', step: 'D3' },
  { img: 'dx_pexp', name: '4 bảng chia nguồn (GND / V_IN)', qty: 4, use: 'dung', how: 'Dùng 1 cái: 5V của UBEC vào, chia ra ESP32 DevKit + camera. Còn lại để dự phòng.', step: 'E2' },
  { img: 'dx_qsg', name: 'Hướng dẫn nhanh (giấy)', qty: 1, use: 'tuychon', how: 'Viết theo Betaflight. Dự án dùng ArduPilot — tham khảo sơ đồ chân, không làm theo phần cài đặt.' },
];

LR.USE = {
  dung: { label: 'DÙNG', cls: 'b-ok' },
  duphong: { label: 'DỰ PHÒNG', cls: 'b-gray' },
  tuychon: { label: 'TUỲ CHỌN', cls: 'b-warn' },
  khong: { label: 'KHÔNG DÙNG', cls: 'b-gray' },
  cam: { label: 'CẤM DÙNG', cls: 'b-danger' },
};
