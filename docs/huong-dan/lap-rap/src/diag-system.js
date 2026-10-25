/* Sơ đồ hệ thống: đấu dây tổng, nguồn, bố trí khung, stack, máy tính, tiến độ. */
(function () {
  const K = LR.k;
  const W = K.W;
  const g = (id, ph, body) => `<g class="cx" data-cx="${id}" data-ph="${ph}">${body}</g>`;

  /* ================= SƠ ĐỒ ĐẤU DÂY TỔNG (logic, nhìn từ trên, mũi ở trên) ================= */
  LR.diag.wiring = () => {
    const Wd = 1240;
    const H = 1000;
    let b = '';
    b += K.text(Wd / 2, 30, 'SƠ ĐỒ ĐẤU DÂY TỔNG — rê chuột / bấm vào một dây để xem chi tiết', { a: 'middle', s: 17, w: 800 });
    b += K.text(Wd / 2, 52, 'Nhìn từ trên, MŨI ở trên. Ô nét đứt = cổng ở mặt dưới FC. Vị trí ở đây là logic — vị trí thật xem mục "Bố trí khung".', { a: 'middle', s: 12, c: 'var(--muted)' });

    // ---- motor 4 góc
    const motors = [
      { n: 4, x: 120, y: 130, cw: true, pos: 'trước-trái', pad: [460, 400] },
      { n: 2, x: 1120, y: 130, cw: false, pos: 'trước-phải', pad: [780, 400] },
      { n: 3, x: 120, y: 880, cw: false, pos: 'sau-trái', pad: [460, 590] },
      { n: 1, x: 1120, y: 880, cw: true, pos: 'sau-phải', pad: [780, 590] },
    ];
    let mw = '';
    motors.forEach((m) => {
      const [px, py] = m.pad;
      const dx = m.x - px;
      const dy = m.y - py;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      [[-7, W.blue], [0, W.black], [7, W.red]].forEach(([o, c]) => {
        mw += K.wire(`M${px + nx * o} ${py + ny * o}L${m.x + nx * o} ${m.y + ny * o}`, c, { sw: 3.2, outline: c === W.black });
      });
    });
    b += g('motor', '16 18', mw + motors.map((m) =>
      K.circle(m.x, m.y, 50, { fill: 'var(--surface2)', stroke: 'var(--ink)', sw: 2 }) +
      K.circle(m.x, m.y, 16, { fill: 'var(--ink)' }) + K.spin(m.x, m.y, 36, m.cw) +
      K.text(m.x, m.y + (m.y < 400 ? -78 : 78), `M${m.n} ${m.pos}`, { a: 'middle', s: 15, w: 800 }) +
      K.text(m.x, m.y + (m.y < 400 ? -61 : 94), m.cw ? 'CW · ren trái' : 'CCW · ren phải', { a: 'middle', s: 12, c: 'var(--muted)' })).join(''));

    // ---- stack: ESC (lớn) + FC (nhỏ)
    b += K.rect(456, 332, 328, 330, { rx: 14, fill: '#22201a', stroke: '#000' });
    [[456, 375], [456, 565], [764, 375], [764, 565]].forEach(([x, y]) => {
      for (let i = 0; i < 3; i += 1) b += K.rect(x, y + i * 18, 20, 13, { rx: 2, fill: 'var(--pad)' });
    });
    b += K.text(472, 652, 'ESC', { s: 12, w: 800, c: '#d9c58f' });
    b += K.rect(500, 662, 60, 36, { rx: 4, fill: 'var(--pad)' }) + K.text(530, 686, '+', { a: 'middle', s: 22, w: 900, c: '#8a0000' });
    b += K.rect(680, 662, 60, 36, { rx: 4, fill: 'var(--pad)' }) + K.text(710, 688, '−', { a: 'middle', s: 24, w: 900, c: '#111' });
    b += K.board(490, 352, 260, 260, { rx: 12 });
    b += K.text(620, 470, 'FC F405 V5', { a: 'middle', s: 16, w: 800, c: 'var(--silk)' });
    b += K.text(620, 490, '▲ mũi tên FC', { a: 'middle', s: 11, c: 'var(--silk)' });
    // pad mặt trên dùng tới
    const padsTop = [['T2', 510, 362], ['R2', 534, 362], ['G', 558, 362], ['B+', 616, 362], ['B−', 640, 362]];
    padsTop.forEach(([l, x, y]) => { b += K.pad(x, y, 18, 18, l, { on: true, ls: 9, lblY: y + 30 }); });
    const padsRear = [['9V', 598, 584, true], ['G', 622, 584], ['T3', 646, 584], ['R3', 670, 584], ['5V', 708, 548], ['G', 732, 548]];
    padsRear.forEach(([l, x, y, bad]) => { b += K.pad(x, y, 18, 18, l, { on: !bad && !(l === 'G' && x === 622), bad, ls: 9, lblY: y - 5 }); });
    b += K.text(729, 580, 'LED1', { a: 'middle', s: 9, w: 700, c: 'var(--silk)' });
    // cổng mặt dưới (nét đứt)
    const under = (x, y, w, lab) => K.rect(x, y, w, 22, { rx: 4, fill: 'none', stroke: '#e8d9a8', sw: 1.6, dash: '4 3' }) + K.text(x + w / 2, y + 15, lab, { a: 'middle', s: 9.5, w: 700, c: '#e8d9a8' });
    b += under(496, 392, 78, 'GPS 6P (dưới)');
    b += under(660, 392, 84, '10P ESC (dưới)');
    b += under(652, 500, 92, 'RX 4P (dưới)');
    b += K.rect(750, 450, 22, 46, { rx: 5, fill: '#c9cdd0' }) + K.text(778, 476, 'USB-C', { s: 10, w: 800, c: 'var(--silk)' });

    // ---- ESC ↔ FC (cáp 10P vòng mép trước)
    b += g('stack', '16', K.wire('M700 392C700 320 780 320 772 346', W.gray, { sw: 4 }));

    // ---- Pin + XT60 + tụ
    b += K.rect(520, 880, 200, 82, { rx: 12, fill: '#2d3a54', stroke: '#111' });
    b += K.text(620, 916, 'PIN 4S 5300', { a: 'middle', s: 15, w: 800, c: '#fff' });
    b += K.text(620, 936, '14,8–16,8 V · XT60', { a: 'middle', s: 11, c: '#cfd8ea' });
    b += g('bat', '16', K.wire('M530 698L560 880', W.red, { sw: 5 }) + K.wire('M710 698L680 880', W.black, { sw: 5, outline: true }) +
      K.rect(596, 790, 48, 26, { rx: 5, fill: '#f3c623', stroke: '#7a5b00' }) + K.text(620, 808, 'XT60', { a: 'middle', s: 11, w: 800, c: '#3a2b00' }));
    b += g('cap', '16', K.rect(604, 706, 30, 22, { rx: 4, fill: '#9aa3ad', stroke: '#444' }) + K.path('M560 717L604 717M634 717L680 717', { stroke: 'var(--ink)', sw: 2 }) +
      K.text(620, 744, 'tụ 1000 µF', { a: 'middle', s: 11, w: 700 }));

    // ---- UBEC + bảng chia + ESP32 + camera
    b += K.box(318, 716, 150, 56, 'UBEC 5V 3A', 'nguồn riêng ESP32', { bg: 'var(--surface)' });
    b += g('ubecin', '16', K.wire('M515 698C515 722 494 734 468 734', W.red, { sw: 3 }) + K.wire('M690 698C690 770 600 772 468 760', W.black, { sw: 3, outline: true }));
    b += K.box(328, 830, 130, 44, 'bảng chia', 'hộp Deluxe', { bg: 'var(--surface)', ts: 12.5, ss: 10.5 });
    b += g('ubecout', '17', K.wire('M378 772L378 830', W.red, { sw: 3 }) + K.wire('M408 772L408 830', W.black, { sw: 3, outline: true }));
    b += K.rect(70, 470, 180, 160, { rx: 10, fill: 'var(--surface)', stroke: 'var(--line2)', sw: 1.4 });
    b += K.text(84, 494, 'ESP32 DevKit', { s: 14, w: 700 }) + K.text(84, 511, 'DroneBridge · COM4', { s: 11, c: 'var(--muted)' });
    const espPins = [['RX2 (16)', 530], ['TX2 (17)', 555], ['GND', 580], ['VIN', 606]];
    espPins.forEach(([l, y]) => { b += K.circle(250, y, 5, { fill: 'var(--pad)' }) + K.text(240, y + 4, l, { a: 'end', s: 11, w: 700 }); });
    b += g('espuart', '17', K.wire('M519 362L519 336L430 336C360 336 330 530 255 530', W.yellow, { sw: 2.6 }) +
      K.wire('M543 362L543 330L425 330C350 330 320 555 255 555', W.green, { sw: 2.6 }) +
      K.wire('M567 362L567 324L420 324C340 324 310 580 255 580', W.black, { sw: 2.6, outline: true }) +
      K.pill(395, 300, 'T2→RX2 · R2→TX2 · G→GND', { s: 11, c: 'var(--pc)', bd: 'var(--pc)' }));
    b += g('esppwr', '17', K.wire('M328 852C280 852 292 606 255 606', W.red, { sw: 2.6 }) + K.text(274, 734, '5V', { a: 'end', s: 11, w: 700, c: 'var(--w-red)' }));
    b += K.box(250, 70, 200, 70, 'Camera ESP32-S3', 'OV3660 · COM7', { bg: 'var(--surface)' });
    b += g('campwr', '17', K.wire('M393 874L393 900', W.red, { sw: 2.6 }) + K.pill(393, 912, '→ camera 5V', { s: 10.5, a: 'middle', c: 'var(--w-red)' }) +
      K.wire('M350 140L350 168', W.red, { sw: 2.6 }) + K.pill(350, 180, '5V từ bảng chia', { s: 10.5, a: 'middle', c: 'var(--w-red)' }));

    // ---- Wi-Fi
    const waves = (x, y) => [10, 18, 26].map((r) => K.path(`M${x - r * 0.7} ${y - r * 0.7}A${r} ${r} 0 0 1 ${x + r * 0.7} ${y - r * 0.7}`, { stroke: 'var(--pc)', sw: 2 })).join('');
    b += g('wifi', '17', waves(160, 462) + waves(268, 62) + K.text(160, 430, 'Wi-Fi → laptop', { a: 'middle', s: 11, w: 700, c: 'var(--pc)' }));

    // ---- Còi
    b += K.circle(628, 222, 26, { fill: '#222', stroke: '#000' }) + K.circle(628, 222, 7, { fill: '#555' }) + K.text(628, 186, 'Còi', { a: 'middle', s: 13, w: 800 });
    b += g('buzzer', '15', K.wire('M625 362L625 248', W.red, { sw: 2.6 }) + K.wire('M649 362L640 247', W.black, { sw: 2.6, outline: true }));

    // ---- TFmini (phía trước, dây chạy trên FC về mép sau)
    b += K.box(800, 70, 200, 70, 'TFmini Plus', 'nhìn thẳng trước', { bg: 'var(--surface)' });
    b += g('tfmini', '17', K.wire('M860 140C840 230 700 260 679 584', W.green, { sw: 2.6 }) +
      K.wire('M840 140C820 230 676 260 655 584', W.white, { sw: 2.6, outline: true }) +
      K.wire('M880 140C870 260 730 300 717 548', W.red, { sw: 2.6 }) +
      K.wire('M900 140C900 280 760 320 741 548', W.black, { sw: 2.6, outline: true }) +
      K.pill(905, 260, 'xanh→R3 · trắng→T3 · đỏ→5V · đen→G', { s: 11, c: 'var(--accent)', bd: 'var(--accent)' }) +
      K.pill(560, 640, '9V: KHÔNG', { s: 10.5, a: 'middle', c: 'var(--danger)', bd: 'var(--danger)' }));

    // ---- GPS
    b += K.box(70, 300, 180, 70, 'GPS M10 + la bàn', 'cột nâng, phía đuôi', { bg: 'var(--surface)' });
    b += g('gps', '15', K.wire('M496 403L420 403C360 403 330 360 252 345', W.blue, { sw: 4 }) + K.pill(398, 425, 'cáp GPS 6P', { s: 10.5, a: 'middle', c: 'var(--you)', bd: 'var(--you)' }));

    // ---- Receiver
    b += K.box(800, 790, 180, 66, 'Receiver iA6B', 'i-BUS · 2 anten', { bg: 'var(--surface)' });
    b += g('rx', '15', K.wire('M744 511L774 511L774 760C774 790 790 800 800 812', W.white, { sw: 3.2, outline: true }) + K.pill(842, 760, 'cáp RX 4P → Dupont', { s: 10.5, a: 'middle', c: 'var(--you)', bd: 'var(--you)' }));

    // ---- Laptop qua USB
    b += K.box(1010, 380, 180, 70, 'Laptop (Claude)', 'COM6 · Mission Planner', { bg: 'var(--pc-soft)', bd: 'var(--pc)', tc: 'var(--pc)' });
    b += g('usbfc', '14', K.wire('M772 474L900 474C950 474 960 415 1010 415', W.gray, { sw: 4, dash: '8 5' }) + K.text(890, 500, 'USB-C (bàn)', { s: 11, w: 700, c: 'var(--muted)' }));

    return K.svg(Wd, H, b, { cls: 'wiring', title: 'Sơ đồ đấu dây tổng' });
  };

  /* ================= CÂY NGUỒN ================= */
  LR.diag.power = () => {
    const Wd = 1100;
    const H = 560;
    let b = '';
    b += K.text(Wd / 2, 28, 'CÂY NGUỒN — điện đi từ pin tới từng món', { a: 'middle', s: 17, w: 800 });
    const node = (x, y, w, h, t, s, col) => K.box(x, y, w, h, t, s, { bg: 'var(--surface)', bd: col || 'var(--line2)', tc: col || 'var(--ink)' });
    const arr = (d, col, lab, lx, ly) => K.path(d, { stroke: col, sw: 3, arrow: col === 'var(--danger)' ? 'danger' : 'ink' }) + (lab ? K.text(lx, ly, lab, { s: 11.5, w: 700, c: 'var(--muted)', a: 'middle' }) : '');
    b += node(30, 230, 130, 70, 'Pin 4S', '14,8–16,8 V', 'var(--danger)');
    b += K.box(195, 150, 130, 56, 'Smoke stopper', 'chỉ lần đầu · 1A', { dash: '6 4', bg: 'var(--surface2)' });
    b += arr('M160 250L190 190', 'var(--muted)', '', 0, 0);
    b += node(195, 230, 130, 70, 'XT60 → pad + −', '+ tụ 1000 µF', 'var(--danger)');
    b += arr('M160 265L193 265', 'var(--danger)');
    b += node(390, 70, 170, 64, 'ESC 4-in-1', 'tới ~15 A / motor', 'var(--accent)');
    b += node(390, 230, 170, 70, 'FC qua cáp 10P', 'VBAT → BEC trên FC');
    b += node(390, 410, 170, 70, 'UBEC 5V 3A', 'nguồn riêng', 'var(--pc)');
    b += arr('M325 255L388 110', 'var(--danger)');
    b += arr('M325 265L388 265', 'var(--danger)');
    b += arr('M325 275L388 440', 'var(--danger)');
    b += node(640, 46, 180, 56, '4 motor', 'treo ~13 A tổng · max ~58 A');
    b += arr('M560 100L638 76', 'var(--accent)');
    b += node(620, 150, 150, 52, 'BEC 5V', '4,8–5,2 V', 'var(--ok)');
    b += node(620, 228, 150, 52, 'Đường 4V5', '≥ 4,7 V (đo ở D7)', 'var(--ok)');
    b += node(620, 306, 150, 52, 'BEC 9V', 'KHÔNG dùng', 'var(--danger)');
    b += arr('M560 255L618 178', 'var(--ink)') + arr('M560 262L618 254', 'var(--ink)') + arr('M560 272L618 330', 'var(--danger)');
    b += node(850, 120, 220, 46, 'TFmini Plus', '110 mA (đỉnh 140) · 5V cụm LED1');
    b += node(850, 172, 220, 40, 'Còi', 'B+ / B−');
    b += node(850, 226, 220, 46, 'GPS M10', '~40 mA · cổng GPS (4V5)');
    b += node(850, 278, 220, 46, 'Receiver iA6B', '~50 mA · cổng RX (4V5)');
    b += arr('M770 170L848 143', 'var(--ok)') + arr('M770 178L848 192', 'var(--ok)') + arr('M770 250L848 249', 'var(--ok)') + arr('M770 258L848 300', 'var(--ok)');
    b += node(620, 410, 150, 60, 'Bảng chia', 'hộp Deluxe', 'var(--pc)');
    b += arr('M560 445L618 440', 'var(--pc)');
    b += node(850, 380, 220, 50, 'ESP32 DevKit', 'VIN · ~0,1–0,25 A khi Wi-Fi');
    b += node(850, 440, 220, 50, 'Camera ESP32-S3', '5V · ~0,2–0,4 A (+ tụ nếu reset)');
    b += arr('M770 430L848 405', 'var(--pc)') + arr('M770 450L848 465', 'var(--pc)');
    b += K.text(Wd / 2, 530, 'Vì sao tách UBEC: hai bo ESP32 bật Wi-Fi gây xung dòng, sụt áp. Ăn chung 5V với FC = FC có thể reset giữa lúc bay. GND chung qua pin.', { a: 'middle', s: 12.5, w: 600, c: 'var(--ink2)' });
    return K.svg(Wd, H, b, { title: 'Cây nguồn' });
  };

  /* ================= BỐ TRÍ TRÊN KHUNG — nhìn từ trên (1,4 px/mm) ================= */
  LR.diag.frameTop = (a = {}) => {
    const Wd = 900;
    const H = 940;
    const cx = 450;
    const cy = 480;
    const s = 1.4;
    const m = 169.7 * s;
    let b = '';
    b += K.text(Wd / 2, 28, 'BỐ TRÍ TRÊN KHUNG — nhìn từ trên (đúng tỉ lệ ~1,4 px/mm)', { a: 'middle', s: 16, w: 800 });
    b += K.nose(cx, 40);
    const mot = [
      { n: 4, x: cx - m, y: cy - m, cw: true, l: 'M4 trước-trái' },
      { n: 2, x: cx + m, y: cy - m, cw: false, l: 'M2 trước-phải' },
      { n: 3, x: cx - m, y: cy + m, cw: false, l: 'M3 sau-trái' },
      { n: 1, x: cx + m, y: cy + m, cw: true, l: 'M1 sau-phải' },
    ];
    // cánh (vòng tròn quét)
    if (a.props !== false) mot.forEach((o) => { b += K.circle(o.x, o.y, 127 * s, { fill: o.cw ? 'color-mix(in srgb,var(--ok) 9%,transparent)' : 'color-mix(in srgb,var(--you) 9%,transparent)', stroke: o.cw ? 'var(--ok)' : 'var(--you)', sw: 1, dash: '5 5' }); });
    // cần
    mot.forEach((o) => { b += K.line(cx, cy, o.x, o.y, { stroke: '#30363a', sw: 30, lc: 'round' }); });
    // tấm đế (dưới, nét đứt) + tấm trên
    b += K.rect(cx - 62 * s, cy - 92 * s, 124 * s, 184 * s, { rx: 14, fill: 'none', stroke: 'var(--muted)', sw: 1.4, dash: '6 4' });
    b += K.poly([[cx - 70 * s, cy - 40 * s], [cx - 40 * s, cy - 70 * s], [cx + 40 * s, cy - 70 * s], [cx + 70 * s, cy - 40 * s], [cx + 70 * s, cy + 40 * s], [cx + 40 * s, cy + 70 * s], [cx - 40 * s, cy + 70 * s], [cx - 70 * s, cy + 40 * s]], { fill: '#1d2421', stroke: '#000', sw: 1.5 });
    // pin (dưới bụng)
    b += K.rect(cx - 24 * s, cy - 75 * s, 48 * s, 150 * s, { rx: 8, fill: 'none', stroke: 'var(--w-blue)', sw: 2, dash: '7 4' });
    b += K.path(`M${cx - 24 * s} ${cy}L${cx - 104 * s} ${cy}`, { stroke: 'var(--w-blue)', sw: 1.4 });
    b += K.pill(cx - 104 * s, cy, 'pin 4S (dưới bụng)', { a: 'end', s: 11, fw: 700, c: 'var(--w-blue)', bd: 'var(--w-blue)', bg: 'var(--surface)' });
    // stack + mũi tên
    b += K.rect(cx - 22 * s, cy - 22 * s, 44 * s, 44 * s, { rx: 6, fill: '#3a3528', stroke: '#E9C21F', sw: 2 });
    b += K.path(`M${cx} ${cy + 12}L${cx} ${cy - 22}`, { stroke: '#E9C21F', sw: 3, arrow: 'accent' });
    b += K.text(cx, cy + 42, 'stack FC+ESC', { a: 'middle', s: 11, w: 800, c: '#fff' });
    // TFmini + camera phía trước
    b += K.rect(cx + 6 * s, cy - 82 * s, 35 * s, 18 * s, { rx: 4, fill: '#222', stroke: 'var(--accent)', sw: 2 });
    b += K.path(`M${cx + 23.5 * s} ${cy - 82 * s}L${cx + 23.5 * s} ${cy - 170 * s}`, { stroke: 'var(--accent)', sw: 1.5, dash: '3 3', arrow: 'accent' });
    b += K.path(`M${cx + 58} ${cy - 174}L${cx + 44} ${cy - 116}`, { stroke: 'var(--accent)', sw: 1.4 });
    b += K.text(cx + 52, cy - 180, 'TFmini Plus', { s: 12, w: 800, c: 'var(--accent)' });
    b += K.rect(cx - 44 * s, cy - 86 * s, 28 * s, 22 * s, { rx: 3, fill: '#111', stroke: 'var(--pc)', sw: 2, dash: '4 2' });
    b += K.path(`M${cx - 28} ${cy - 164}L${cx - 42} ${cy - 122}`, { stroke: 'var(--pc)', sw: 1.4 });
    b += K.text(cx - 12, cy - 192, 'camera (tầng dưới,\nchĩa trước-xuống)', { a: 'end', s: 11, w: 700, c: 'var(--pc)' });
    // GPS phía đuôi
    b += K.circle(cx, cy + 58 * s, 25 * s, { fill: '#e8e8e8', stroke: '#555', sw: 2 });
    b += K.path(`M${cx} ${cy + 70 * s}L${cx} ${cy + 46 * s}`, { stroke: '#d33', sw: 3, arrow: 'danger' });
    b += K.path(`M${cx} ${cy + 83 * s}L${cx} ${cy + 186}`, { stroke: 'var(--ink)', sw: 1.4 });
    b += K.text(cx, cy + 200, 'GPS M10 trên cột (≥ 8–10 cm)', { a: 'middle', s: 12, w: 800 });
    // receiver + anten
    b += K.rect(cx - 64 * s, cy + 30 * s, 26 * s, 47 * s, { rx: 3, fill: '#111', stroke: 'var(--you)', sw: 2 });
    b += K.path(`M${cx - 64 * s} ${cy + 40 * s}L${cx - 120 * s} ${cy + 40 * s}M${cx - 51 * s} ${cy + 77 * s}L${cx - 51 * s} ${cy + 130 * s}`, { stroke: 'var(--you)', sw: 2.4 });
    b += K.text(cx - 124 * s, cy + 30 * s, 'iA6B: 2 anten 90°', { a: 'end', s: 12, w: 800, c: 'var(--you)' });
    // ESP32 + UBEC tầng dưới phía sau
    b += K.rect(cx + 28 * s, cy + 40 * s, 30 * s, 50 * s, { rx: 3, fill: 'none', stroke: 'var(--pc)', sw: 2, dash: '4 2' });
    b += K.path(`M${cx + 58 * s} ${cy + 44 * s}L${cx + 146} ${cy + 4}`, { stroke: 'var(--pc)', sw: 1.4 });
    b += K.text(cx + 150, cy + 4, 'ESP32 + UBEC\n(tầng dưới, anten ló ra)', { s: 11, w: 700, c: 'var(--pc)' });
    // motor
    mot.forEach((o) => {
      b += K.circle(o.x, o.y, 14 * s, { fill: '#2b2b2b', stroke: '#000' });
      b += K.spin(o.x, o.y, 26 * s, o.cw);
      b += K.text(o.x, o.y + (o.y < cy ? -42 * s : 52 * s), o.l, { a: 'middle', s: 14, w: 800 });
      b += K.text(o.x, o.y + (o.y < cy ? -30 * s : 64 * s), o.cw ? 'CW · cánh pusher (R)' : 'CCW · cánh thường', { a: 'middle', s: 11.5, w: 600, c: o.cw ? 'var(--ok)' : 'var(--you)' });
    });
    b += K.text(Wd / 2, H - 12, 'Motor–motor 480 mm đường chéo. Vòng nét đứt = vùng quét cánh 10 inch. Nét đứt xám = tấm đế (PDB) bên dưới.', { a: 'middle', s: 11.5, c: 'var(--muted)' });
    return K.svg(Wd, H, b, { title: 'Bố trí trên khung' });
  };

  /* ================= BỐ TRÍ — nhìn ngang (mũi bên trái) ================= */
  LR.diag.frameSide = () => {
    const Wd = 1000;
    const H = 600;
    const s = 1.6;
    const cx = 520;
    const yTop = 270;
    let b = '';
    b += K.text(Wd / 2, 28, 'NHÌN NGANG — mũi bên TRÁI (đúng tỉ lệ ~1,6 px/mm)', { a: 'middle', s: 16, w: 800 });
    b += K.path('M60 70L20 70', { stroke: 'var(--accent)', sw: 3, arrow: 'accent' }) + K.text(66, 75, 'MŨI', { s: 12, w: 800, c: 'var(--accent)' });
    b += K.line(40, 540, 960, 540, { stroke: 'var(--line2)', sw: 2 });
    // chân đáp
    b += K.path(`M${cx - 60 * s} ${yTop + 34}L${cx - 70 * s} 528M${cx + 60 * s} ${yTop + 34}L${cx + 70 * s} 528`, { stroke: '#333', sw: 6 });
    b += K.line(cx - 130 * s, 532, cx + 130 * s, 532, { stroke: '#d0303a', sw: 10, lc: 'round' });
    // tấm đế + cần + tấm trên
    b += K.rect(cx - 80 * s, yTop + 30, 160 * s, 4, { fill: '#c9a54a' });
    b += K.rect(cx - 190 * s, yTop + 8, 380 * s, 22, { rx: 6, fill: '#2f3437' });
    b += K.rect(cx - 70 * s, yTop + 4, 140 * s, 4, { fill: '#1d2421' });
    b += K.text(cx + 80 * s + 8, yTop + 44, 'tấm đế (PDB)', { s: 11, w: 700, c: 'var(--muted)' });
    // motor + cánh
    [[cx - 170 * s, true], [cx + 170 * s, false]].forEach(([x]) => {
      b += K.rect(x - 14 * s, yTop - 30, 28 * s, 34, { rx: 4, fill: '#222' });
      b += K.line(x, yTop - 30, x, yTop - 44, { stroke: '#888', sw: 4 });
      b += K.line(x - 127 * s * 0.55, yTop - 44, x + 127 * s * 0.55, yTop - 44, { stroke: '#555', sw: 3, dash: '10 5' });
    });
    // pin + dây đai
    b += K.rect(cx - 75 * s, yTop + 36, 150 * s, 38 * s, { rx: 8, fill: '#2d3a54' });
    b += K.text(cx, yTop + 36 + 19 * s + 5, 'PIN 4S (velcro + dây đai)', { a: 'middle', s: 12, w: 800, c: '#fff' });
    b += K.rect(cx + 50 * s, yTop + 30, 10, 38 * s + 12, { fill: '#7a6b4f' });
    // stack + bát chống rung
    b += K.rect(cx - 24 * s, yTop - 6, 48 * s, 4, { fill: '#555' });
    [-18, 18].forEach((dx) => { b += K.circle(cx + dx * s, yTop - 12, 5, { fill: '#111' }); });
    b += K.rect(cx - 22 * s, yTop - 28, 44 * s, 8, { fill: '#3a3528' });
    b += K.rect(cx - 20 * s, yTop - 42, 40 * s, 6, { fill: '#1b2320' });
    b += K.text(cx, yTop - 52, 'stack trên bát chống rung', { a: 'middle', s: 11.5, w: 800 });
    // GPS mast (đuôi = phải)
    b += K.line(cx + 60 * s, yTop + 2, cx + 60 * s, yTop - 100 * s, { stroke: '#222', sw: 5 });
    b += K.rect(cx + 44 * s, yTop - 100 * s - 18, 32 * s, 18, { rx: 9, fill: '#e8e8e8', stroke: '#555' });
    b += K.path(`M${cx + 85 * s} ${yTop}L${cx + 85 * s} ${yTop - 100 * s}`, { stroke: 'var(--ok)', sw: 1.5, arrow: 'ok', arrow2: 'ok' });
    b += K.text(cx + 89 * s, yTop - 50 * s, '≥ 8–10 cm\nxa dây nguồn', { s: 12, w: 800, c: 'var(--ok)' });
    b += K.text(cx + 60 * s, yTop - 100 * s - 26, 'GPS M10', { a: 'middle', s: 12, w: 800 });
    // TFmini + tia
    b += K.rect(cx - 82 * s, yTop - 22, 21 * s, 18, { rx: 3, fill: '#111', stroke: 'var(--accent)', sw: 2 });
    b += K.path(`M${cx - 82 * s} ${yTop - 13}L60 ${yTop - 40}`, { stroke: 'var(--accent)', sw: 1.5, dash: '6 4', arrow: 'accent' });
    b += K.text(150, yTop - 52, 'TFmini: ngẩng 2–3°, tia không quét vào drone', { s: 12, w: 800, c: 'var(--accent)' });
    // camera
    b += K.rect(cx - 88 * s, yTop + 36, 14 * s, 26, { rx: 3, fill: '#111', stroke: 'var(--pc)', sw: 2 });
    b += K.path(`M${cx - 92 * s} ${yTop + 52}L${cx - 160 * s} ${yTop + 52 + 70 * s * 0.58}`, { stroke: 'var(--pc)', sw: 1.5, dash: '6 4', arrow: 'pc' });
    b += K.text(cx - 165 * s, yTop + 52 + 70 * s * 0.58 + 22, 'camera chĩa xuống ~30°', { s: 12, w: 800, c: 'var(--pc)' });
    // ESP32 + UBEC
    b += K.rect(cx + 30 * s, yTop + 12, 26 * s, 12, { rx: 2, fill: 'none', stroke: 'var(--pc)', sw: 2 });
    b += K.text(cx + 110 * s, yTop + 92, 'ESP32 + UBEC: tầng dưới, phía sau', { s: 11.5, w: 700, c: 'var(--pc)' });
    b += K.path(`M${cx + 108 * s} ${yTop + 86}L${cx + 44 * s} ${yTop + 24}`, { stroke: 'var(--pc)', sw: 1.2 });
    b += K.text(Wd / 2, H - 14, 'Dây motor chạy dọc mặt dưới cần, 3 dây rút / cần. Dây tín hiệu đi trên tấm trên, tách xa dây motor.', { a: 'middle', s: 11.5, c: 'var(--muted)' });
    return K.svg(Wd, H, b, { title: 'Nhìn ngang' });
  };

  /* ================= STACK nổ tầng (nhìn ngang, mũi bên trái) ================= */
  LR.diag.stackSide = (a = {}) => {
    const Wd = 900;
    const H = a.mount ? 500 : 380;
    let b = '';
    b += K.text(Wd / 2, 28, a.mount ? 'STACK TRÊN BÁT CHỐNG RUNG — nổ tầng, nhìn ngang' : 'CHỒNG STACK — nổ tầng, nhìn ngang', { a: 'middle', s: 16, w: 800 });
    b += K.path('M120 60L80 60', { stroke: 'var(--accent)', sw: 3, arrow: 'accent' }) + K.text(126, 65, 'MŨI (mép có cổng 10 chân)', { s: 12, w: 800, c: 'var(--accent)' });
    const x0 = 300;
    const w = 300;
    let y = 110;
    const layer = (h, fill, label, sub, col) => {
      let s = K.rect(x0, y, w, h, { rx: 3, fill, stroke: '#000', sw: 1 });
      s += K.text(x0 + w + 28, y + h / 2 + 4, label, { s: 13, w: 800, c: col || 'var(--ink)' });
      if (sub) s += K.text(x0 + w + 28, y + h / 2 + 20, sub, { s: 11, c: 'var(--muted)' });
      return s;
    };
    const screwX = [x0 + 24, x0 + w - 24];
    b += layer(12, '#E9C21F', 'Ốc nylon M3 (trên cùng)', 'không dẫn điện');
    y += 48;
    b += layer(16, '#1b2320', 'FC F405 V5', 'vỏ silicone vàng trong 4 lỗ; mũi tên về MŨI');
    const fcY = y;
    y += 50;
    b += layer(10, '#111', 'Đệm silicone đen M3', 'giữ khe hở, chống chạm');
    y += 46;
    b += layer(26, '#22201a', 'ESC OX32', 'mặt "55A" LÊN; cổng 10 chân ở mặt dưới');
    const escY = y;
    y += 64;
    if (a.mount) {
      b += layer(8, '#555', 'Bát chống rung 30,5', '4 quả cao su — không ốc nào xuyên xuống khung');
      [x0 + 40, x0 + w - 40].forEach((x) => { b += K.circle(x, y + 22, 12, { fill: '#111' }); });
      y += 44;
      b += layer(8, '#555', 'Mặt dưới bát', 'bắt lỗ có sẵn / VHB kín mặt');
      y += 40;
      b += layer(6, '#1d2421', 'Tấm trên khung S500', '');
      y += 30;
    }
    screwX.forEach((x) => { b += K.line(x, 100, x, escY + 70, { stroke: '#9aa1a8', sw: 5 }); });
    b += K.text(x0 - 16, escY + 66, 'ốc M3 × 30\n(từ dưới lên)', { a: 'end', s: 11.5, w: 700, c: 'var(--muted)' });
    b += K.path(`M${x0} ${escY + 26}C${x0 - 70} ${escY + 40} ${x0 - 80} ${fcY + 10} ${x0} ${fcY + 16}`, { stroke: 'var(--w-gray)', sw: 5, fill: 'none' });
    b += K.text(x0 - 86, (escY + fcY) / 2 + 10, 'cáp 10 chân\n25 mm', { a: 'end', s: 12, w: 800, c: 'var(--accent)' });
    b += K.text(Wd / 2, H - 16, 'Thứ tự trên mỗi ốc (từ dưới lên): ESC → đệm đen → FC → ốc nylon. Kiểm lần cuối: không kim loại nào chạm giữa hai tầng.', { a: 'middle', s: 11.5, c: 'var(--muted)' });
    return K.svg(Wd, H, b, { title: 'Chồng stack' });
  };

  /* ================= MÁY TÍNH ↔ DRONE ================= */
  LR.diag.pcArch = (a = {}) => {
    const mode = a.mode || 'wifi';
    const Wd = 1000;
    const H = 380;
    let b = '';
    b += K.text(Wd / 2, 28, mode === 'usb' ? 'TRÊN BÀN: FC ↔ laptop qua cáp USB' : 'TỪ CHẶNG E: drone ↔ laptop qua Wi-Fi', { a: 'middle', s: 16, w: 800 });
    b += K.box(40, 80, 230, 230, '', '', { bg: 'var(--surface2)' });
    b += K.text(155, 104, 'DRONE', { a: 'middle', s: 14, w: 800 });
    b += K.box(60, 120, 190, 54, 'FC (ArduPilot)', mode === 'usb' ? 'cổng USB-C' : 'SERIAL2 → ESP32', { bg: 'var(--surface)' });
    if (mode !== 'usb') {
      b += K.box(60, 186, 190, 50, 'ESP32 DroneBridge', 'UART 115200', { bg: 'var(--surface)' });
      b += K.box(60, 248, 190, 50, 'Camera ESP32-S3', 'MJPEG :81', { bg: 'var(--surface)' });
      b += K.path('M155 174L155 186', { stroke: 'var(--ink)', sw: 2 });
    }
    b += K.box(720, 80, 240, 230, '', '', { bg: 'var(--pc-soft)', bd: 'var(--pc)' });
    b += K.text(840, 104, 'LAPTOP — Claude làm', { a: 'middle', s: 14, w: 800, c: 'var(--pc)' });
    if (mode === 'usb') {
      b += K.box(740, 120, 200, 54, 'COM6', 'kiem_fc / nap_param', { bg: 'var(--surface)' });
      b += K.box(740, 186, 200, 54, 'Mission Planner', 'hiệu chỉnh (cua-driver)', { bg: 'var(--surface)' });
      b += K.path('M250 147L740 147', { stroke: 'var(--w-gray)', sw: 5, dash: '10 6', arrow: 'ink' });
      b += K.text(495, 136, 'cáp USB-C có dữ liệu', { a: 'middle', s: 12.5, w: 700 });
      b += K.text(495, 250, 'Chưa cắm pin: FC lấy điện từ USB.\nĐường 4V5 nuôi receiver + GPS.', { a: 'middle', s: 12.5, c: 'var(--ink2)' });
    } else {
      b += K.box(400, 140, 200, 70, 'Hotspot laptop', 'IOTCV-HOTSPOT 2,4 GHz', { bg: 'var(--surface)', bd: 'var(--pc)' });
      b += K.path('M250 211L400 180', { stroke: 'var(--pc)', sw: 2.5, dash: '6 4', arrow: 'pc' }) + K.text(300, 186, 'MAVLink', { s: 11, w: 700, c: 'var(--pc)' });
      b += K.path('M250 273L400 200', { stroke: 'var(--pc)', sw: 2.5, dash: '6 4', arrow: 'pc' }) + K.text(300, 262, 'video', { s: 11, w: 700, c: 'var(--pc)' });
      b += K.box(740, 120, 200, 50, 'Backend :8000', 'udpin:0.0.0.0:14550', { bg: 'var(--surface)' });
      b += K.box(740, 180, 200, 50, 'Web :5173', 'bạn chỉ mở trang này', { bg: 'var(--surface)' });
      b += K.box(740, 240, 200, 50, 'Mission Planner', 'UDP 14550 — 1 cái 1 lúc', { bg: 'var(--surface)' });
      b += K.path('M600 170L738 145', { stroke: 'var(--pc)', sw: 2.5, arrow: 'pc' });
      b += K.text(500, 250, 'Rút cáp USB → nếu web vẫn sống\nthì đúng là đang đi qua Wi-Fi.', { a: 'middle', s: 12.5, c: 'var(--ink2)' });
    }
    b += K.text(Wd / 2, H - 20, 'Mọi bước trên laptop do Claude chạy. Bạn: cắm cáp, cầm drone, đọc số đo, tự bấm khi motor quay.', { a: 'middle', s: 12.5, w: 700, c: 'var(--pc)' });
    return K.svg(Wd, H, b, { title: 'Máy tính và drone' });
  };

  LR.diag.webModes = () => {
    const Wd = 1000;
    const H = 330;
    let b = '';
    const col = (x, title, colr, rows, warn) => {
      let s = K.box(x, 20, 460, 290, '', '', { bg: 'var(--surface2)', bd: colr });
      s += K.text(x + 230, 50, title, { a: 'middle', s: 16, w: 800, c: colr });
      rows.forEach((r, i) => { s += K.pill(x + 230, 92 + i * 46, r, { a: 'middle', s: 12, w: 400, bg: 'var(--surface)' }); if (i) s += K.path(`M${x + 230} ${92 + (i - 1) * 46 + 12}L${x + 230} ${92 + i * 46 - 12}`, { stroke: colr, sw: 2, arrow: colr === 'var(--danger)' ? 'danger' : 'ink' }); });
      s += K.text(x + 230, 296, warn, { a: 'middle', s: 12, w: 700, c: 'var(--danger)' });
      return s;
    };
    b += col(20, 'Drone ẢO — chay-tat-ca.bat', 'var(--you)', ['SITL trong WSL', 'backend tcp:127.0.0.1:5760', 'web http://localhost:5173', 'Mission Planner: cổng 5762'], 'Không chạy khi đang nối drone thật');
    b += col(520, 'Drone THẬT — Claude chạy', 'var(--pc)', ['FC → ESP32 → Wi-Fi hotspot', 'backend udpin:0.0.0.0:14550', 'camera thật (CAMERA_FAKE=0)', 'web http://localhost:5173'], 'MP và backend không nghe chung 14550');
    return K.svg(Wd, H, b, { title: 'Hai cách chạy web' });
  };

  /* ================= TIẾN ĐỘ PHASE ================= */
  LR.diag.timeline = () => {
    const ph = LR.data.phases;
    const Wd = 1220;
    const H = 252;
    const x0 = 96;
    const cw = (Wd - x0 - 16) / ph.length;
    /* Vị trí "Bạn đang ở đây" lấy từ status.here.phase: '14.1' (một phase) hoặc '19–20' (một khoảng). */
    const here = LR.data.status.here.phase;
    const [from, to = from] = String(here).split(/[–-]/).map((s) => parseInt(s, 10));
    const iFrom = ph.findIndex((p) => Number(p.n) === from);
    const iTo = ph.findIndex((p) => Number(p.n) === to);
    if (iFrom < 0 || iTo < iFrom) throw new Error(`timeline: status.here.phase "${here}" không khớp LR.data.phases`);
    let b = '';
    ph.forEach((p, i) => {
      const x = x0 + i * cw;
      const fill = p.st === 'done' ? 'var(--ok)' : p.st === 'part' ? 'var(--warn)' : 'var(--sunken)';
      b += K.rect(x + 2, 46, cw - 4, 34, { rx: 6, fill, stroke: i >= iFrom && i <= iTo ? 'var(--accent)' : 'none', sw: 3 });
      b += K.text(x + cw / 2, 69, p.n, { a: 'middle', s: 13, w: 800, c: p.st === 'todo' ? 'var(--ink2)' : '#fff' });
      b += K.text(x + cw / 2 + 4, 96, p.name, { a: 'end', s: 10.5, w: 600, c: 'var(--ink2)', rot: -45 });
      if (p.hw) b += K.text(x + cw / 2, 40, '🔧', { a: 'middle', s: 11 });
    });
    const xh = x0 + ((iFrom + iTo) / 2) * cw + cw / 2;
    b += K.path(`M${xh} 8L${xh} 40`, { stroke: 'var(--accent)', sw: 3, arrow: 'accent' });
    b += K.text(xh + 8, 18, `Bạn đang ở đây (${here})`, { s: 12.5, w: 800, c: 'var(--accent)' });
    const yl = H - 14;
    b += K.rect(20, yl - 10, 14, 12, { fill: 'var(--ok)', rx: 3 }) + K.text(40, yl, 'xong', { s: 11.5 });
    b += K.rect(90, yl - 10, 14, 12, { fill: 'var(--warn)', rx: 3 }) + K.text(110, yl, 'làm dở', { s: 11.5 });
    b += K.rect(170, yl - 10, 14, 12, { fill: 'var(--sunken)', rx: 3 }) + K.text(190, yl, 'chưa làm', { s: 11.5 });
    b += K.text(270, yl, '🔧 cần phần cứng', { s: 11.5 });
    return K.svg(Wd, H, b, { title: 'Tiến độ phase' });
  };

  LR.diag.deluxeMini = () => {
    const items = LR.data.deluxe;
    const cols = 6;
    const cw = 170;
    const ch = 70;
    const Wd = cols * cw + 20;
    const H = Math.ceil(items.length / cols) * ch + 20;
    const colr = { dung: 'var(--ok)', duphong: 'var(--muted)', tuychon: 'var(--warn)', khong: 'var(--muted)', cam: 'var(--danger)' };
    /* Tên tối đa 2 dòng ~24 ký tự. */
    const wrap = (s) => {
      const lines = K.wrap(s, 24);
      return lines.length > 2 ? [lines[0], lines.slice(1).join(' ').slice(0, 23) + '…'] : lines;
    };
    let b = '';
    items.forEach((it, i) => {
      const x = 10 + (i % cols) * cw;
      const y = 10 + Math.floor(i / cols) * ch;
      b += K.rect(x + 3, y + 3, cw - 6, ch - 6, { rx: 8, fill: 'var(--surface2)', stroke: colr[it.use], sw: 2 });
      b += K.text(x + 12, y + 22, wrap(it.name).join('\n'), { s: 11, w: 700 });
      b += K.text(x + 12, y + 56, LR.USE[it.use].label + (it.qty > 1 ? ` · ×${it.qty}` : ''), { s: 10, w: 800, c: colr[it.use] });
    });
    return K.svg(Wd, H, b, { title: 'Hộp Deluxe' });
  };

  LR.diag.massBudget = () => {
    const items = [['Khung + chân', 782, '#5b6670'], ['4 motor', 256, '#2d6fb5'], ['Stack + bát', 55, '#c9481b'], ['GPS + cột', 40, '#2e9e4f'], ['Receiver', 16, '#8b5bd6'], ['4 cánh', 52, '#9b6206'], ['Dây, tụ, XT60', 90, '#777'], ['Pin 4S', 423, '#1f3a6b'], ['Camera + ESP32 + UBEC + phụ', 110, '#0e7c86']];
    const total = items.reduce((a, i) => a + i[1], 0);
    const Wd = 1000;
    const H = 230;
    const sc = 900 / 2400;
    let b = '';
    b += K.text(50, 30, `Khối lượng ước tính (AUW) ≈ ${total} g — trần lực đẩy 4800 g → tỉ số ≈ ${(4800 / total).toFixed(2).replace('.', ',')} : 1`, { s: 15, w: 800 });
    let x = 50;
    items.forEach(([n, g2, c]) => {
      const w = g2 * sc;
      b += K.rect(x, 60, w, 46, { fill: c });
      if (w > 46) b += K.text(x + w / 2, 88, String(g2), { a: 'middle', s: 11.5, w: 800, c: '#fff' });
      x += w;
    });
    b += K.line(50 + 2400 * sc, 50, 50 + 2400 * sc, 116, { stroke: 'var(--danger)', sw: 3, dash: '6 4' });
    b += K.text(50 + 2400 * sc, 132, '2400 g = ngưỡng 2:1', { a: 'end', s: 12, w: 800, c: 'var(--danger)' });
    let lx = 50;
    items.forEach(([n, g2, c], i) => {
      const row = Math.floor(i / 5);
      if (i % 5 === 0) lx = 50;
      b += K.rect(lx, 152 + row * 26, 12, 12, { fill: c, rx: 2 }) + K.text(lx + 18, 162 + row * 26, `${n} ${g2} g`, { s: 11.5 });
      lx += 190;
    });
    return K.svg(Wd, H, b, { title: 'Ngân sách khối lượng' });
  };

  LR.diag.fence = () => {
    const Wd = 960;
    const H = 360;
    let b = '';
    b += K.circle(240, 190, 140, { fill: 'color-mix(in srgb,var(--ok) 8%,transparent)', stroke: 'var(--ok)', sw: 2.5, dash: '8 5' });
    b += K.circle(240, 190, 126, { stroke: 'var(--warn)', sw: 1.5, dash: '3 4' });
    b += K.icon('drone', 216, 166, 48, 'var(--ink)');
    b += K.line(240, 190, 380, 190, { stroke: 'var(--ok)', sw: 2, arrow: 'ok' }) + K.text(322, 166, 'FENCE_RADIUS\n≤ 50 m', { a: 'middle', s: 12, w: 800, c: 'var(--ok)' });
    b += K.text(240, 350, 'Nhìn từ trên: hàng rào tròn quanh điểm home', { a: 'middle', s: 12, c: 'var(--muted)' });
    b += K.line(520, 320, 860, 320, { stroke: 'var(--line2)', sw: 2 });
    b += K.rect(560, 70, 260, 250, { fill: 'color-mix(in srgb,var(--ok) 8%,transparent)', stroke: 'var(--ok)', sw: 2, dash: '8 5' });
    b += K.line(840, 320, 840, 70, { stroke: 'var(--ok)', sw: 2, arrow: 'ok' }) + K.text(846, 190, 'FENCE_ALT_MAX\n30 m', { s: 12, w: 800, c: 'var(--ok)' });
    b += K.text(690, 100, 'FENCE_MARGIN 2 m: bắt đầu phanh\ntrước hàng rào', { a: 'middle', s: 12, c: 'var(--ink2)' });
    b += K.text(690, 240, 'Chạm rào → RTL (FENCE_ACTION 1)', { a: 'middle', s: 12.5, w: 800 });
    b += K.text(690, 350, 'Nhìn ngang', { a: 'middle', s: 12, c: 'var(--muted)' });
    return K.svg(Wd, H, b, { title: 'Geofence' });
  };
})();
