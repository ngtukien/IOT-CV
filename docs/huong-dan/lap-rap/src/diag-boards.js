/* Bản vẽ bo mạch: FC mặt trên / mặt dưới, ESC, bo camera. Bố cục theo ảnh chính hãng v5_27, v5_28
   và ảnh thật picture/. Không đúng tỉ lệ từng pad — đúng THỨ TỰ và VỊ TRÍ nhóm pad. */
(function () {
  const K = LR.k;

  /* Một hàng nhóm pad. groups: [[{k,l}...], ...]. Trả svg + toạ độ tâm từng pad theo k. */
  function padRow(x0, y, groups, o) {
    const pw = o.pw || 20;
    const ph = o.ph || 24;
    const pitch = o.pitch || 26;
    const gap = o.gap || 14;
    let x = x0;
    let svg = '';
    const pos = {};
    groups.forEach((g, gi) => {
      g.forEach((p) => {
        const on = o.on && o.on.includes(p.k);
        const bad = p.bad;
        svg += K.pad(x, y, pw, ph, p.l, { on, bad, lblY: o.lblAbove ? y - 5 : y + ph + 12, ls: 9.5, cls: p.k ? `pd pd-${p.k}` : '' });
        pos[p.k] = [x + pw / 2, y + ph / 2];
        x += pitch;
      });
      if (gi < groups.length - 1) x += gap;
    });
    return { svg, pos, w: x - x0 - (pitch - pw) };
  }
  LR.k.padRow = padRow;

  const P = (k, l, extra) => Object.assign({ k, l: l || k }, extra || {});

  /* ---------- FC mặt trên ---------- */
  LR.diag.fcTop = (a = {}) => {
    const hl = a.hl || ['esp32', 'buzzer', 'tfmini', 'warn9v'];
    const on = [];
    if (hl.includes('esp32')) on.push('T2', 'R2', 'Gf');
    if (hl.includes('buzzer')) on.push('B+', 'B-');
    if (hl.includes('tfmini')) on.push('R3', 'L1-5V', 'L1-G');
    if (hl.includes('gps')) on.push('G4', 'T4', 'R4', 'DA', 'CL', '4V5g');
    if (hl.includes('rx')) on.push('R6', 'T6', 'G6', '4V5r');
    const W = 860;
    const H = 760;
    const bx = 196;
    const by = 140;
    const bw = 468;
    const bh = 468;
    let b = '';
    b += K.text(W / 2, 34, 'FC SpeedyBee F405 V5 — MẶT TRÊN (mặt có chip)', { a: 'middle', s: 17, w: 800 });
    b += K.text(W / 2, 56, 'Nhìn từ trên, mũi drone ở phía trên. Ô cam = pad dự án dùng; ô đỏ = pad nguy hiểm.', { a: 'middle', s: 12.5, c: 'var(--muted)' });
    b += K.nose(W / 2, 70);
    b += K.board(bx, by, bw, bh, { rx: 18 });
    [[bx + 46, by + 46], [bx + bw - 46, by + 46], [bx + 46, by + bh - 46], [bx + bw - 46, by + bh - 46]].forEach(([x, y]) => {
      b += K.circle(x, y, 26, { fill: '#E9C21F' });
      b += K.circle(x, y, 11, { fill: 'var(--pcb2)' });
    });
    // hàng ngoài, mép trước
    const f1 = padRow(bx + 90, by + 10, [
      [P('5Vc', '5V'), P('Gc', 'G'), P('CAM'), P('CC')],
      [P('B+'), P('B-', 'B−')],
      [P('P+'), P('P-', 'P−')],
      [P('Gl', 'G'), P('5Vl', '5V'), P('LED')],
    ], { on, pitch: 25, gap: 13, pw: 19, ph: 22 });
    b += f1.svg;
    const f2 = padRow(bx + 90, by + 56, [
      [P('T2'), P('R2'), P('4V5f', '4V5'), P('Gf', 'G')],
      [P('A', 'G'), P('B', '5V'), P('C', 'S5')],
      [P('D', 'G'), P('E', '5V'), P('F', 'S6')],
    ], { on, pitch: 25, gap: 18, pw: 19, ph: 22 });
    b += f2.svg;
    // cụm LED 4 góc
    const l4 = padRow(bx + 22, by + 104, [[P('L4-G', 'G'), P('L4-5V', '5V'), P('L4-D', 'D')]], { on, pitch: 22, pw: 17, ph: 17 });
    const l2 = padRow(bx + bw - 88, by + 104, [[P('L2-G', 'G'), P('L2-5V', '5V'), P('L2-D', 'D')]], { on, pitch: 22, pw: 17, ph: 17 });
    const l3 = padRow(bx + 22, by + bh - 128, [[P('L3-D', 'D'), P('L3-5V', '5V'), P('L3-G', 'G')]], { on, pitch: 22, pw: 17, ph: 17 });
    const l1 = padRow(bx + bw - 88, by + bh - 128, [[P('L1-D', 'D'), P('L1-5V', '5V'), P('L1-G', 'G')]], { on, pitch: 22, pw: 17, ph: 17 });
    b += l4.svg + l2.svg + l3.svg + l1.svg;
    // mép sau, hàng trong + hàng ngoài
    const r1 = padRow(bx + 96, by + bh - 86, [
      [P('G4', 'G'), P('T4'), P('R4')],
      [P('5Vj', '5V'), P('VTX'), P('Gl2', 'G'), P('SBUS')],
      [P('R6'), P('T6'), P('3V3')],
    ], { on, pitch: 25, gap: 18, pw: 19, ph: 22 });
    const r2 = padRow(bx + 96, by + bh - 40, [
      [P('DA'), P('CL'), P('4V5g', '4V5')],
      [P('9V', '9V', { bad: true }), P('G3', 'G'), P('T3'), P('R3')],
      [P('G6', 'G'), P('4V5r', '4V5'), P('RS')],
    ], { on, pitch: 25, gap: 18, pw: 19, ph: 22 });
    b += r1.svg + r2.svg;
    // linh kiện giữa
    b += K.rect(bx + 154, by + 160, 160, 160, { rx: 6, fill: '#2b2b2b', stroke: '#555' });
    b += K.rect(bx + 196, by + 202, 76, 76, { rx: 4, fill: '#eee' });
    b += K.text(bx + 234, by + 245, 'STM32\nF405', { a: 'middle', s: 12, w: 800, c: '#222' });
    b += K.rect(bx + bw - 64, by + 196, 64, 86, { rx: 10, fill: '#c9cdd0', stroke: '#888' });
    b += K.text(bx + bw - 32, by + 245, 'USB-C', { a: 'middle', s: 12, w: 800, c: '#222' });
    b += K.rect(bx + 30, by + 270, 40, 40, { rx: 4, fill: '#d0d0d0', stroke: '#888' });
    b += K.circle(bx + 50, by + 290, 9, { fill: '#555' });
    b += K.text(bx + 50, by + 328, 'BOOT', { a: 'middle', s: 10, w: 700, c: 'var(--silk)' });
    b += K.text(bx + bw / 2, by + 360, '▲ F405V5', { a: 'middle', s: 14, w: 800, c: 'var(--silk)' });
    b += K.text(bx + bw / 2, by + 377, '(mũi tên chỉ về MŨI)', { a: 'middle', s: 10, c: 'var(--silk)' });

    // chú thích
    const call = (x1, y1, x2, y2, lines, col, anchor) => K.path(`M${x1} ${y1}L${x2} ${y2}`, { stroke: col, sw: 1.6 }) + K.text(x2 + (anchor === 'end' ? -6 : 6), y2 + 4, lines, { a: anchor || 'start', s: 12.5, w: 700, c: col });
    if (hl.includes('esp32')) b += call(f2.pos.T2[0] - 11, f2.pos.T2[1], 176, 112, 'T2 · R2 · G → ESP32\nRX2 · TX2 · GND (E3)', 'var(--pc)', 'end');
    if (hl.includes('buzzer')) b += call(f1.pos['B+'][0], f1.pos['B+'][1] - 13, 520, 96, 'B+ / B− → còi (C9)', 'var(--accent)');
    if (hl.includes('tfmini')) {
      b += call(r2.pos.R3[0], r2.pos.R3[1] + 14, 520, 700, 'R3 ← TFmini dây xanh (E7)', 'var(--accent)');
      b += call(l1.pos['L1-5V'][0] + 10, l1.pos['L1-5V'][1], 700, 560, '5V + G cụm LED1\n← TFmini đỏ + đen (E7)', 'var(--accent)');
    }
    if (hl.includes('warn9v') || hl.includes('tfmini')) b += call(r2.pos['9V'][0], r2.pos['9V'][1] + 14, 300, 700, '9V — KHÔNG cho TFmini chạm', 'var(--danger)', 'end');
    if (hl.includes('gps')) b += call(r1.pos.T4[0], r1.pos.T4[1] - 14, 120, 470, 'GPS: dùng cổng 6 chân\nmặt dưới (C7)', 'var(--you)', 'end');
    if (hl.includes('rx')) b += call(r1.pos.R6[0], r1.pos.R6[1] - 14, 740, 470, 'Receiver: dùng cổng\n4 chân mặt dưới (C2)', 'var(--you)');
    b += K.text(W / 2, H - 14, 'Nguồn bố cục: ảnh chính hãng SpeedyBee (v5_24, v5_27) + ảnh thật của bo.', { a: 'middle', s: 11, c: 'var(--muted)' });
    return K.svg(W, H, b, { title: 'FC mặt trên' });
  };

  /* ---------- FC mặt dưới (lật trái-phải: USB sang trái) ---------- */
  LR.diag.fcBottom = (a = {}) => {
    const hl = a.hl || ['gps', 'rx', 'esc', 'hd'];
    const W = 860;
    const H = 700;
    const bx = 196;
    const by = 130;
    const bw = 468;
    const bh = 468;
    let b = '';
    b += K.text(W / 2, 34, 'FC — MẶT DƯỚI (lật bo sang trái): bốn cổng cắm', { a: 'middle', s: 17, w: 800 });
    b += K.text(W / 2, 56, 'Mũi drone vẫn ở phía trên. Cổng USB-C giờ nằm bên TRÁI.', { a: 'middle', s: 12.5, c: 'var(--muted)' });
    b += K.nose(W / 2, 66);
    b += K.board(bx, by, bw, bh, { rx: 18 });
    [[bx + 46, by + 46], [bx + bw - 46, by + 46], [bx + 46, by + bh - 46], [bx + bw - 46, by + bh - 46]].forEach(([x, y]) => {
      b += K.circle(x, y, 26, { fill: '#E9C21F' });
      b += K.circle(x, y, 11, { fill: 'var(--pcb2)' });
    });
    const conn = (x, y, n, label, pins, key, col) => {
      const w = n * 18 + 16;
      let s = `<g class="cx" data-cx="${key}">`;
      s += K.rect(x, y, w, 46, { rx: 5, fill: '#f3efe6', stroke: hl.includes(key) ? col : '#999', sw: hl.includes(key) ? 3 : 1 });
      for (let i = 0; i < n; i += 1) s += K.rect(x + 12 + i * 18, y + 10, 8, 26, { rx: 2, fill: '#c9b27a' });
      s += K.text(x + w / 2, y - 26, label, { a: 'middle', s: 13, w: 800, c: hl.includes(key) ? col : 'var(--ink)' });
      s += K.text(x + w / 2, y - 9, pins, { a: 'middle', s: 10.5, w: 700, c: 'var(--muted)', mono: true });
      return s + '</g>';
    };
    b += conn(bx + 74, by + 84, 10, 'Sang ESC — 10 chân', '4 3 2 1 T C G G V V', 'esc', 'var(--accent)');
    b += conn(bx + 282, by + 84, 6, 'GPS — 6 chân', 'CL DA T4 R4 G 4V5', 'gps', 'var(--you)');
    b += conn(bx + 74, by + bh - 112, 4, 'Receiver — 4 chân', '4V5 G R6 T6', 'rx', 'var(--you)');
    b += conn(bx + 220, by + bh - 112, 6, 'HD "Unit Plug" — 6 chân', '9V G T3 R3 G SBUS', 'hd', 'var(--danger)');
    b += K.rect(bx, by + 196, 64, 86, { rx: 10, fill: '#c9cdd0', stroke: '#888' });
    b += K.text(bx + 32, by + 245, 'USB-C', { a: 'middle', s: 12, w: 800, c: '#222' });
    b += K.text(bx + 84, by + 212, 'G  D−\nD+  IN', { s: 11, w: 700, c: 'var(--silk)', mono: true });
    b += K.text(bx + 76, by + 258, '← pad cho module\nUSB-C rời (tuỳ chọn)', { s: 10, c: 'var(--silk)' });
    b += K.rect(bx + 200, by + 180, 160, 120, { rx: 6, fill: '#26302c', stroke: '#444' });
    b += K.text(bx + 280, by + 236, 'BEC 5V · 9V · 4V5\n(mạch nguồn)', { a: 'middle', s: 12, w: 700, c: 'var(--silk)' });
    // chú thích
    const note = (x, y, t, col, an) => K.text(x, y, t, { a: an || 'start', s: 12.5, w: 700, c: col });
    b += note(bx - 12, by + 104, 'Cáp 25 mm\n(hộp Deluxe) — D4', 'var(--accent)', 'end');
    b += note(bx + bw + 12, by + 104, 'Cáp GPS 6P của hộp\n+ nối dây M10 — C7', 'var(--you)');
    b += note(bx - 12, by + bh - 86, 'Cáp receiver 4P\n→ iA6B i-BUS — C2', 'var(--you)', 'end');
    b += note(bx + bw + 12, by + bh - 86, 'KHÔNG DÙNG\nchân 1 = 9V', 'var(--danger)');
    b += K.text(W / 2, H - 16, 'Theo ảnh thật IMG_8458 và ảnh chính hãng v5_27.', { a: 'middle', s: 11, c: 'var(--muted)' });
    return K.svg(W, H, b, { title: 'FC mặt dưới' });
  };

  /* ---------- ESC mặt "55A" ---------- */
  LR.diag.escTop = () => {
    const W = 860;
    const H = 760;
    const bx = 220;
    const by = 150;
    const bw = 420;
    const bh = 420;
    let b = '';
    b += K.text(W / 2, 34, 'ESC OX32 55A — MẶT "55A" (quay LÊN khi lắp)', { a: 'middle', s: 17, w: 800 });
    b += K.text(W / 2, 56, 'Mép có 8 pad tín hiệu = phía MŨI. Pad nguồn + − ở mép sau.', { a: 'middle', s: 12.5, c: 'var(--muted)' });
    b += K.nose(W / 2, 70);
    b += K.board(bx, by, bw, bh, { rx: 16 });
    const sig = padRow(bx + 102, by + 12, [[P('V'), P('G'), P('C'), P('T'), P('1'), P('2'), P('3'), P('4')]], { pitch: 27, pw: 19, ph: 22, lblAbove: false });
    b += sig.svg;
    [[bx + 44, by + 44], [bx + bw - 44, by + 44], [bx + 44, by + bh - 44], [bx + bw - 44, by + bh - 44]].forEach(([x, y]) => {
      b += K.circle(x, y, 24, { fill: '#E9C21F' });
      b += K.circle(x, y, 10, { fill: 'var(--pcb2)' });
    });
    b += K.circle(bx + bw / 2, by + bh / 2, 70, { stroke: 'var(--silk)', sw: 3 });
    b += K.text(bx + bw / 2, by + bh / 2 + 14, '55A', { a: 'middle', s: 40, w: 900, c: 'var(--silk)' });
    const mpads = (x, y, n, left) => {
      let s = '';
      for (let i = 0; i < 3; i += 1) s += K.rect(x, y + i * 34, 30, 26, { rx: 3, fill: 'var(--pad)' });
      s += K.text(left ? x - 8 : x + 38, y + 92, `MOTOR ${n}`, { a: left ? 'end' : 'start', s: 11, w: 800, c: 'var(--warn)', mono: true });
      return s;
    };
    b += mpads(bx - 30, by + 90, 4, true) + mpads(bx - 30, by + 240, 3, true);
    b += mpads(bx + bw, by + 90, 2, false) + mpads(bx + bw, by + 240, 1, false);
    b += K.rect(bx + 90, by + bh, 90, 54, { rx: 6, fill: 'var(--pad)' });
    b += K.rect(bx + bw - 180, by + bh, 90, 54, { rx: 6, fill: 'var(--pad)' });
    b += K.text(bx + 135, by + bh + 36, '+', { a: 'middle', s: 30, w: 900, c: '#7a0000' });
    b += K.text(bx + bw - 135, by + bh + 38, '−', { a: 'middle', s: 34, w: 900, c: '#111' });
    // vị trí motor
    const lab = (x, y, t, sub, an) => K.text(x, y, t, { a: an, s: 15, w: 800 }) + K.text(x, y + 18, sub, { a: an, s: 12, c: 'var(--muted)' });
    b += lab(bx - 46, by + 120, 'M4 trước-trái', 'quay CW', 'end');
    b += lab(bx - 46, by + 272, 'M3 sau-trái', 'quay CCW', 'end');
    b += lab(bx + bw + 46, by + 120, 'M2 trước-phải', 'quay CCW', 'start');
    b += lab(bx + bw + 46, by + 272, 'M1 sau-phải', 'quay CW', 'start');
    b += K.text(bx + 135, by + bh + 82, 'pad + (dây đỏ XT60,\nchân dài tụ, đỏ UBEC)', { a: 'middle', s: 12, w: 700, c: 'var(--danger)' });
    b += K.text(bx + bw - 135, by + bh + 82, 'pad − (dây đen XT60,\nchân ngắn tụ, đen UBEC)', { a: 'middle', s: 12, w: 700 });
    b += K.text(bx + bw / 2, by + 88, 'V G C T 1 2 3 4 = tín hiệu sang FC (đi qua cáp 10 chân ở mặt dưới)', { a: 'middle', s: 11, c: 'var(--silk)' });
    return K.svg(W, H, b, { title: 'ESC mặt trên' });
  };

  /* ---------- Hàng chân bo camera ESP32-S3 ---------- */
  LR.diag.camPins = () => {
    const W = 860;
    const H = 360;
    let b = '';
    const bx = 120;
    const by = 90;
    const bw = 640;
    const bh = 180;
    b += K.text(W / 2, 30, 'Bo camera ESP32-S3 N16R8 — mặt trên (lỗ chân CHƯA hàn header)', { a: 'middle', s: 16, w: 800 });
    b += K.board(bx, by, bw, bh, { rx: 10 });
    const top = ['5V', '14', '13', '12', '11', '10', '9', '46', '3', '8', '18', '17', '16', '15', '7', '6', '5', '4', 'EN', '3V3'];
    const bot = ['GND', '19', '20', '21', '47', '48', '45', '0', '35', '36', '37', '38', '39', '40', '41', '42', '2', '1', 'RX', 'TX'];
    const pitch = 31;
    top.forEach((l, i) => {
      const x = bx + 22 + i * pitch;
      const on = l === '5V';
      const bad = l === '3V3';
      b += K.circle(x, by + 18, 8, { fill: on ? 'var(--hl)' : bad ? 'var(--danger)' : 'var(--pad)' });
      b += K.text(x, by + 44, l, { a: 'middle', s: 10, w: 700, c: 'var(--silk)', mono: true });
    });
    bot.forEach((l, i) => {
      const x = bx + 22 + i * pitch;
      const on = l === 'GND';
      b += K.circle(x, by + bh - 18, 8, { fill: on ? 'var(--hl)' : 'var(--pad)' });
      b += K.text(x, by + bh - 34, l, { a: 'middle', s: 10, w: 700, c: 'var(--silk)', mono: true });
    });
    b += K.rect(bx - 16, by + 52, 44, 30, { rx: 6, fill: '#c9cdd0', stroke: '#888' });
    b += K.rect(bx - 16, by + 98, 44, 30, { rx: 6, fill: '#c9cdd0', stroke: '#888' });
    b += K.text(bx + 36, by + 72, 'USB-UART (COM7)', { s: 11, w: 700, c: 'var(--silk)' });
    b += K.text(bx + 36, by + 118, 'USB-OTG', { s: 11, w: 700, c: 'var(--silk)' });
    b += K.rect(bx + 330, by + 56, 150, 70, { rx: 6, fill: '#bfc4c7', stroke: '#777' });
    b += K.text(bx + 405, by + 96, 'ESP32-S3-N16R8', { a: 'middle', s: 12, w: 800, c: '#222' });
    b += K.rect(bx + 236, by + 70, 60, 42, { rx: 4, fill: '#c98a2b' });
    b += K.circle(bx + 266, by + 91, 13, { fill: '#222' });
    b += K.text(bx + 266, by + 132, 'OV3660', { a: 'middle', s: 10, w: 700, c: 'var(--silk)' });
    b += K.path(`M${bx + 22} ${by + 8}L${bx + 22} ${by - 30}L${bx + 160} ${by - 30}`, { stroke: 'var(--accent)', sw: 2 });
    b += K.text(bx + 166, by - 26, '5V ← UBEC qua bảng chia (E9)', { s: 13, w: 800, c: 'var(--accent)' });
    b += K.path(`M${bx + 22} ${by + bh + 8}L${bx + 22} ${by + bh + 40}L${bx + 160} ${by + bh + 40}`, { stroke: 'var(--accent)', sw: 2 });
    b += K.text(bx + 166, by + bh + 44, 'GND ← UBEC qua bảng chia', { s: 13, w: 800, c: 'var(--accent)' });
    b += K.text(bx + bw - 22, by - 12, '3V3 — KHÔNG cấp vào đây', { a: 'end', s: 12.5, w: 800, c: 'var(--danger)' });
    return K.svg(W, H, b, { title: 'Chân bo camera' });
  };
})();
