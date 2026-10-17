/* Dụng cụ và linh kiện ngoài — cách dùng gọn, kèm sơ đồ. */
LR.data.tools = [
  {
    id: 'meter', name: 'Đồng hồ vạn năng', diag: ['meterContinuity', 'meterVolt'],
    use: [
      '**Thông mạch** (biểu tượng loa / sóng): kêu = hai điểm nối nhau. Dùng: dò dây, tìm chập. Luôn đo khi **không có pin**.',
      '**DC V, thang 20 V**: que đen vào GND, que đỏ vào điểm cần đo. Dùng: pad 5V, 4V5, UBEC, XT60.',
      '**Ω (điện trở)**: so 3 cặp pha motor — ba số phải bằng nhau.',
      '"OL" hoặc "1" ở mép trái = hở mạch (không nối).',
    ],
    warn: 'Que đỏ cắm lỗ **V/Ω**, không cắm lỗ A/10A. Đo pin ở thang dòng = chập pin qua đồng hồ.',
    steps: ['D5', 'D7', 'F8', 'F18'],
  },
  {
    id: 'iron', name: 'Mỏ hàn', diag: ['solderJoint'],
    use: [
      'Nhiệt: 330–350 °C pad nhỏ · 380–400 °C dây 16AWG, pad nguồn. Đầu vát to cho pad nguồn.',
      'Lau đầu mỏ vào bọt biển ẩm, mạ thiếc mỏng; mạ lại khi đầu mỏ xám.',
      '**Nung kim loại, không nung thiếc**: áp mỏ vào pad / dây, đưa thiếc vào phía đối diện.',
      'Mạ trước cả hai phía, ghép, nung 2–4 s, **giữ yên** tới khi nguội.',
      'Sau 8–10 s thiếc vẫn không chảy → dừng, để nguội, thêm flux (không nung tiếp).',
    ],
    warn: 'Luôn đặt mỏ vào giá. Rút điện khi rời bàn quá 5 phút.',
    steps: ['A3', 'C2', 'C7', 'D2', 'D3', 'F8'],
  },
  {
    id: 'shrink', name: 'Gen co nhiệt', diag: ['heatShrink'],
    use: [
      '**Luồn gen vào dây TRƯỚC khi hàn** — ai cũng quên ít nhất một lần.',
      'Chọn cỡ gấp ~2 lần đường kính dây; trùm qua mối hàn ≥ 5 mm mỗi bên.',
      'Co bằng máy sấy tóc / khò, xoay đều. **Không** dùng mỏ hàn (làm thủng gen).',
      'Dây motor: gen nhỏ từng mối + gen to cả bó.',
    ],
    steps: ['A3', 'F8'],
  },
  {
    id: 'smoke', name: 'Smoke stopper (Short-Circuit Protection Tool — hộp Deluxe)', diag: ['smoke'],
    use: [
      '**BAT IN ← pin**, **BAT OUT → drone**. Nhận pin 4–6S.',
      'Đổi ngưỡng **1A / 2A** khi đầu ra đang **tắt**; bấm **ON** để cấp ra.',
      'Màn hiện **điện áp và dòng**. Quá ngưỡng → ngắt trong ~5 ms.',
      'Chế độ 2A: dòng > 1,5 A liên tục 60 s → tự tắt.',
      '**Đèn đỏ nháy** = lớp bảo vệ phần cứng đã nhảy → rút pin ngay.',
    ],
    warn: 'Chỉ dùng khi cấp điện lần đầu / sau khi sửa dây. Tháo ra trước khi chạy motor.',
    steps: ['D6', 'G1'],
  },
  {
    id: 'practice', name: 'Bảng tập hàn (hộp Deluxe)', diag: [],
    img: 'dx_practice',
    use: ['Tập 3 kiểu: pad nhỏ (giống T2/R2, R3), pad to (giống pad nguồn ESC), nối chồng dây 16AWG.', 'Đạt khi 5 mối liên tiếp bóng, thấy sợi đồng.'],
    steps: ['A3'],
  },
  {
    id: 'pexp', name: 'Bảng chia nguồn (hộp Deluxe)', diag: ['cablePwr'],
    img: 'dx_pexp',
    use: ['Một cặp vào (V_IN / GND), bốn cặp ra song song.', 'Dự án dùng cho **5V của UBEC** → ESP32 + camera.', 'Không dùng cho dòng pin (hàng chục ampe).'],
    steps: ['E2'],
  },
  {
    id: 'charger', name: 'Sạc SkyRC iMAX B6AC V2', diag: ['charger'],
    use: [
      'Cắm XT60 của pin vào sạc **trước**, rồi dây cân bằng (5 chân) vào cổng **4S**.',
      '**LiPo BALANCE**, 4S (14,8 V), dòng **3,0 A** (máy 50 W chỉ ra được ~3 A ở 4S) → sạc trước buổi bay.',
      '**STORAGE** → đưa về 3,80–3,85 V/cell khi cất vài ngày.',
      '**Battery Meter** → đọc từng cell (B8).',
    ],
    warn: 'Sạc trong túi chống cháy, có người trông.',
    steps: ['B8', 'D14', 'G11'],
  },
  {
    id: 'screws', name: 'Lục giác, ốc, keo khoá ren', diag: ['crossTighten'],
    use: [
      'Khung dùng cả M3 và M2.5 — vào không êm là sai cỡ, đừng ép (tước ren nhựa).',
      'Vặn chớm hết rồi mới siết vòng hai theo đường chéo.',
      'Ốc motor: dùng ốc **kèm motor**; ốc dài đâm vào cuộn dây.',
      'Keo khoá ren: chỉ loại **xanh** (tháo được), không dùng loại đỏ.',
    ],
    steps: ['F2', 'F4', 'F6'],
  },
  {
    id: 'mount', name: 'Băng keo xốp VHB, dây rút, velcro', diag: ['antenna90'],
    use: [
      'VHB: lau cồn, dán **kín cả mặt**, ép 30 s; bám tối đa sau 24 h.',
      'Dây rút: siết vừa giữ (vỏ dây không lõm), cắt đuôi sát và phẳng.',
      'Pin: velcro chống trượt **+ dây đai** giữ pin — velcro một mình không đủ.',
    ],
    steps: ['F7', 'F9', 'F11', 'F15'],
  },
  {
    id: 'dupont', name: 'Dây Dupont, header, breadboard', diag: ['connectors'],
    use: [
      'Header **đực** trên bo (ESP32, USB-TTL, iA6B) → đầu dây **cái**.',
      'Làm đầu cái cho dây trần: cắt đôi một dây Dupont cái-cái, hàn đầu trần vào dây, bọc gen.',
      'Thử trên bàn (TFmini ↔ USB-TTL) dùng Dupont thoải mái; trên drone thì chấm keo nóng / quấn băng giữ đầu cắm.',
      'Bo camera ESP32-S3 chưa có header: hàn 2 chân đực (5V, GND) để cắm Dupont.',
    ],
    steps: ['C2', 'E3', 'E6', 'E9'],
  },
  {
    id: 'cap', name: 'Tụ điện 1000 µF (có cực)', diag: ['capPolarity'],
    use: ['Chân **dài = +**; vạch trên thân đánh dấu chân **−** — đối chiếu cả hai.', 'Đặt sát pad nguồn của ESC — xa thì không hấp thụ được xung.', 'Gen đỏ cho chân +, gen đen cho chân −.'],
    warn: 'Ngược cực = nổ tụ. Đeo kính khi cắm pin lần đầu.',
    steps: ['D3'],
  },
  {
    id: 'ubec', name: 'UBEC 5V 3A', diag: ['power'],
    use: ['Đầu vào: dây đỏ / đen nối pin 4S (pad + − của ESC).', 'Đầu ra: 5 V — đo trước khi nối bất cứ thứ gì; có jumper 5/6 V thì để **5 V**.', 'Nuôi ESP32 DevKit + camera (< 1 A thực tế, còn dư nhiều).'],
    steps: ['D3', 'D7', 'E2'],
  },
  {
    id: 'usbttl', name: 'Mạch USB-TTL CP2102', diag: ['cableTfBench'],
    use: ['Cắm vào laptop → hiện một cổng COM mới.', 'Bắt chéo: TXD mạch → RX thiết bị, RXD mạch ← TX thiết bị; GND chung.', 'Chân 5V cấp nguồn cho TFmini khi thử trên bàn.'],
    steps: ['E6'],
  },
  {
    id: 'ppe', name: 'Kính bảo hộ, túi LiPo, bình chữa cháy, kẹp', diag: ['safetyRules'],
    use: ['Kính: lần cắm pin đầu, thử motor, đo lực đẩy.', 'Túi LiPo: pin luôn ở trong khi không dùng; sạc trong túi.', 'Kẹp chữ C / dây rút lớn: giữ drone xuống bàn khi thử motor.'],
    steps: ['D6', 'G5', 'G10'],
  },
];

LR.data.safety = [
  { ic: 'noprop', t: 'Không cánh trên bàn', d: 'Thử motor, failsafe, lệnh web: đều không cánh. Cánh chỉ gắn ở G9.' },
  { ic: 'meter', t: 'Đo trước, cắm pin sau', d: 'Thông mạch XT60 + ↔ − trước lần cắm đầu; lần đầu qua smoke stopper 1A.' },
  { ic: 'rc', t: 'Tay phát luôn trong tay', d: 'RC có quyền cao nhất. WEB CONTROL (SwA) mặc định tắt.' },
  { ic: 'prearm', t: 'Không tắt pre-arm', d: 'Báo lỗi = có nguyên nhân thật. Sửa nguyên nhân, không sửa `ARMING_CHECK`.' },
  { ic: 'lipo', t: 'Pin LiPo', d: 'Không phồng, đo từng cell, sạc có người trông, cất ở Storage.' },
  { ic: 'hand', t: 'Motor quay thật: bạn bấm', d: 'Kẹp drone, kính bảo hộ, đứng ngoài mặt phẳng cánh. Claude không bấm ARM / Motor Test.' },
  { ic: 'wifi', t: 'Wi-Fi không phải dây cứu sinh', d: '`FS_GCS_ENABLE 0`. Mất camera / Wi-Fi không được làm drone đổi hành vi.' },
  { ic: 'field', t: 'Bãi bay', d: 'Rộng, không người, không xe; geofence ArduPilot bật; bay thấp trước.' },
];
