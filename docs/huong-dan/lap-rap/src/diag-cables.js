/* Sơ đồ làm cáp và nối dây cho từng mối nối. */
(function () {
  const K = LR.k;
  const W = K.W;

  /* Giắc nhỏ (SH/GH): hàng chân dọc. pins: [[nhãn, màuDây]]. side = 'l' dây ra bên trái, 'r' bên phải. */
  function plug(x, y, pins, o) {
    const ph = o.ph || 30;
    const h = pins.length * ph + 12;
    let s = K.rect(x, y, o.w || 44, h, { rx: 5, fill: o.fill || '#f2ece0', stroke: '#8a7f6a', sw: 1.4 });
    const pos = [];
    pins.forEach(([l], i) => {
      const py = y + 6 + i * ph + ph / 2;
      s += K.rect(x + 8, py - 5, (o.w || 44) - 16, 10, { rx: 2, fill: '#c9b27a' });
      pos.push([o.side === 'l' ? x : x + (o.w || 44), py]);
      if (l) s += K.text(o.side === 'l' ? x + (o.w || 44) + 8 : x - 8, py + 4, l, { a: o.side === 'l' ? 'start' : 'end', s: 12, w: 800, mono: true });
    });
    if (o.title) s += K.text(x + (o.w || 44) / 2, y - 12, o.title, { a: 'middle', s: 12.5, w: 800 });
    return { s, pos, h };
  }
  /* Mối nối có gen co. */
  const splice = (x, y) => K.rect(x - 14, y - 7, 28, 14, { rx: 5, fill: 'color-mix(in srgb,var(--ink) 70%,transparent)' });
  const capEnd = (x, y) => K.rect(x - 6, y - 6, 16, 12, { rx: 4, fill: 'var(--muted)' });

  /* ---------- GPS ---------- */
  LR.diag.cableGps = () => {
    const Wd = 1180;
    const H = 560;
    let b = '';
    b += K.text(Wd / 2, 28, 'CÁP GPS: M10 (JST-GH 1,25 · 10 chân) → nối 6 dây → cáp SH 1,0 · 6 chân của hộp Deluxe', { a: 'middle', s: 16, w: 800 });
    b += K.circle(90, 280, 62, { fill: '#e9e9e9', stroke: '#555', sw: 2 });
    b += K.text(90, 276, 'GPS M10', { a: 'middle', s: 13, w: 800, c: '#222' });
    b += K.text(90, 294, '+ la bàn', { a: 'middle', s: 11, c: '#444' });
    b += K.rect(150, 270, 22, 20, { rx: 3, fill: '#f2ece0', stroke: '#8a7f6a' });
    b += K.text(178, 362, 'đầu cắm phía\nmodule: GIỮ', { a: 'middle', s: 11.5, w: 800, c: 'var(--ok)' });
    b += K.path('M172 280C210 280 220 280 250 280', { stroke: '#333', sw: 9, lc: 'round' });
    const fn = [['1 VCC (đỏ)', W.red, 'v'], ['2 RX', W.green, 'rx'], ['3 TX', W.yellow, 'tx'], ['4 SCL', W.blue, 'scl'], ['5 SDA', W.white, 'sda'], ['6', W.gray, 'x'], ['7', W.gray, 'x'], ['8 (3V3 ở V1)', W.orange, 'x'], ['9', W.gray, 'x'], ['10 GND', W.black, 'g']];
    const ys = fn.map((_, i) => 100 + i * 40);
    let wires = '';
    fn.forEach(([lab, col, k], i) => {
      const y = ys[i];
      wires += K.wire(`M250 280C300 280 300 ${y} 360 ${y}`, col, { sw: 3, outline: col === W.white || col === W.black });
      wires += K.text(366, y - 6, lab, { s: 11.5, w: 700 });
      if (k === 'x') wires += K.wire(`M360 ${y}L470 ${y}`, col, { sw: 3 }) + capEnd(474, y) + K.text(500, y + 4, 'cắt, bọc riêng', { s: 11, w: 700, c: 'var(--muted)' });
    });
    b += wires;
    b += K.text(300, 520, '✂ cắt bỏ đầu 10 chân phía bo bay', { a: 'middle', s: 12, w: 800, c: 'var(--danger)' });
    // đích: cáp SH 6P
    const fcPins = [['CL', 'scl'], ['DA', 'sda'], ['T4', 'rx'], ['R4', 'tx'], ['G', 'g'], ['4V5', 'v']];
    const pl = plug(1040, 160, fcPins.map(([l]) => [l]), { side: 'l', ph: 40, w: 46, title: 'SH 1,0 · 6P → cổng GPS FC' });
    b += pl.s;
    const colOf = { scl: W.blue, sda: W.white, rx: W.green, tx: W.yellow, g: W.black, v: W.red };
    fcPins.forEach(([l, k], i) => {
      const src = fn.findIndex((f) => f[2] === k);
      const y0 = ys[src];
      const [px, py] = pl.pos[i];
      const cross = k === 'rx' || k === 'tx';
      b += `<g class="cx${cross ? ' hl' : ''}">` + K.wire(`M360 ${y0}L640 ${y0}`, colOf[k === 'rx' ? 'rx' : k === 'tx' ? 'tx' : k], { sw: 3, outline: k === 'sda' || k === 'g' }) + splice(660, y0) +
        K.wire(`M674 ${y0}C820 ${y0} 860 ${py} ${px} ${py}`, colOf[k], { sw: 3, outline: k === 'sda' || k === 'g' }) + '</g>';
    });
    b += K.text(660, 82, 'mối nối + gen co', { a: 'middle', s: 12, w: 800 });
    b += K.pill(860, 470, 'TX → R4 · RX → T4: BẮT CHÉO', { a: 'middle', s: 12.5, c: 'var(--danger)', bd: 'var(--danger)', bg: 'var(--danger-soft)' });
    b += K.text(860, 504, 'Nhận từng dây của cáp hộp Deluxe bằng đo thông mạch với pad FC (mép sau): 4V5 · G · T4 · R4 · CL · DA', { a: 'middle', s: 11.5, c: 'var(--ink2)' });
    b += K.text(860, 524, 'Màu dây trên hình chỉ minh hoạ — đọc theo VỊ TRÍ CHÂN và phép đo, không theo màu.', { a: 'middle', s: 11.5, w: 700, c: 'var(--warn)' });
    return K.svg(Wd, H, b, { title: 'Cáp GPS' });
  };

  /* ---------- Receiver ---------- */
  LR.diag.cableRx = () => {
    const Wd = 1100;
    const H = 420;
    let b = '';
    b += K.text(Wd / 2, 28, 'CÁP RECEIVER: cổng 4 chân FC → cáp hộp Deluxe → 3 đầu Dupont cái → cổng i-BUS của iA6B', { a: 'middle', s: 16, w: 800 });
    const pl = plug(70, 120, [['4V5'], ['G'], ['R6'], ['T6']], { side: 'r', ph: 42, w: 46, title: 'FC RX 4P (mặt dưới)' });
    b += pl.s;
    const cols = [W.red, W.black, W.yellow, W.white];
    const dest = [1, 2, 0, null];
    const iy = [150, 190, 230];
    pl.pos.forEach(([x, y], i) => {
      if (dest[i] === null) {
        b += K.wire(`M${x} ${y}L${x + 140} ${y}`, cols[i], { sw: 3, outline: true }) + capEnd(x + 146, y) + K.text(x + 170, y + 4, 'T6: cắt ngắn, bọc gen', { s: 12, w: 700, c: 'var(--muted)' });
        return;
      }
      const ty = iy[dest[i]];
      b += K.wire(`M${x} ${y}C${x + 160} ${y} ${x + 200} ${ty} 470 ${ty}`, cols[i], { sw: 3, outline: cols[i] === W.black });
      b += splice(490, ty) + K.wire(`M504 ${ty}L640 ${ty}`, cols[i], { sw: 3, outline: cols[i] === W.black });
      b += K.rect(640, ty - 9, 40, 18, { rx: 3, fill: '#222' });
    });
    b += K.text(490, 110, 'mối hàn + gen', { a: 'middle', s: 12, w: 700 });
    b += K.text(660, 110, 'đầu Dupont cái', { a: 'middle', s: 12, w: 700 });
    // iA6B
    b += K.rect(760, 100, 260, 220, { rx: 10, fill: '#151515', stroke: '#000' });
    b += K.text(890, 92, 'FS-iA6B', { a: 'middle', s: 14, w: 800 });
    ['S', '+', '−'].forEach((l, i) => {
      b += K.rect(700, iy[i] - 5, 60, 10, { fill: '#d4af37' });
      b += K.text(780, iy[i] + 5, l, { s: 14, w: 900, c: '#fff' });
    });
    b += K.text(890, 160, 'cổng SERVO (i-BUS)', { a: 'middle', s: 12.5, w: 800, c: '#ffd34d' });
    b += K.text(890, 186, 'chân GIỮA = +', { a: 'middle', s: 12, w: 700, c: '#fff' });
    b += K.text(890, 210, 'S / − : đọc ký hiệu vỏ', { a: 'middle', s: 11.5, c: '#ccc' });
    b += K.text(890, 270, 'B/VCC: bind plug khi bind', { a: 'middle', s: 11.5, c: '#ccc' });
    b += K.text(890, 292, 'không dùng PPM, không dùng SENS', { a: 'middle', s: 11.5, c: '#f99' });
    b += K.text(Wd / 2, 380, 'R6 → S (tín hiệu) · 4V5 → + · G → −. Nhận dây bằng đo thông mạch với pad R6 / T6 / 4V5 / G (mép sau, mặt trên FC).', { a: 'middle', s: 12.5, w: 700, c: 'var(--ink2)' });
    return K.svg(Wd, H, b, { title: 'Cáp receiver' });
  };

  /* ---------- TFmini → FC ---------- */
  LR.diag.cableTf = () => {
    const Wd = 1100;
    const H = 460;
    let b = '';
    b += K.text(Wd / 2, 28, 'TFmini Plus → FC: 3 dây hàn vào pad (dây trắng bỏ)', { a: 'middle', s: 16, w: 800 });
    b += K.rect(40, 150, 120, 70, { rx: 8, fill: '#111', stroke: '#000' });
    b += K.circle(75, 185, 18, { fill: '#2a2a2a', stroke: '#555' }) + K.circle(125, 185, 18, { fill: '#2a2a2a', stroke: '#555' });
    b += K.text(100, 140, 'TFmini Plus', { a: 'middle', s: 13, w: 800 });
    const wires = [['đỏ +5V', W.red, 'L1-5V'], ['trắng RXD', W.white, null], ['xanh TXD', W.green, 'R3'], ['đen GND', W.black, 'L1-G']];
    // pad FC
    b += K.board(560, 90, 480, 300, { rx: 12 });
    b += K.text(800, 82, 'FC mặt trên — phần mép sau', { a: 'middle', s: 12.5, w: 800 });
    const r2 = LR.k.padRow(600, 330, [[{ k: 'DA', l: 'DA' }, { k: 'CL', l: 'CL' }, { k: '4V5g', l: '4V5' }], [{ k: '9V', l: '9V', bad: true }, { k: 'G3', l: 'G' }, { k: 'T3', l: 'T3' }, { k: 'R3', l: 'R3' }], [{ k: 'G6', l: 'G' }, { k: '4V5r', l: '4V5' }, { k: 'RS', l: 'RS' }]], { on: ['R3'], pitch: 32, gap: 20, pw: 24, ph: 26 });
    b += r2.svg;
    const l1 = LR.k.padRow(910, 150, [[{ k: 'L1-D', l: 'D' }, { k: 'L1-5V', l: '5V' }, { k: 'L1-G', l: 'G' }]], { on: ['L1-5V', 'L1-G'], pitch: 32, pw: 24, ph: 24 });
    b += l1.svg + K.text(958, 206, 'cụm LED1 (góc sau-phải)', { a: 'middle', s: 11, w: 700, c: 'var(--silk)' });
    const tgt = { 'L1-5V': l1.pos['L1-5V'], R3: r2.pos.R3, 'L1-G': l1.pos['L1-G'] };
    wires.forEach(([, col, k], i) => {
      const y = 160 + i * 18;
      if (!k) {
        b += K.wire(`M160 ${y}L330 ${y + 60}`, col, { sw: 3, outline: true }) + capEnd(334, y + 60) + K.text(352, y + 64, 'trắng: cắt ngắn, bọc', { s: 11.5, w: 700, c: 'var(--muted)' });
        return;
      }
      const [tx, ty] = tgt[k];
      b += K.wire(ty < 200 ? `M160 ${y}C340 ${y} 420 ${ty - 30} ${tx} ${ty - 14}` : `M160 ${y}C440 ${y} 700 ${ty - 90} ${tx} ${ty - 14}`, col, { sw: 3, outline: col === W.black });
    });
    // chú giải màu dây thay cho nhãn đè lên dây
    [['đỏ → +5V (pad 5V cụm LED1)', W.red], ['đen → GND (pad G cụm LED1)', W.black], ['xanh (TXD) → pad R3', W.green]].forEach(([t, col], i) => {
      b += K.line(44, 262 + i * 24, 70, 262 + i * 24, { stroke: col, sw: 5, lc: 'round' }) + K.text(80, 266 + i * 24, t, { s: 12, w: 700 });
    });
    b += K.pill(r2.pos['9V'][0], 420, '9V — KHÔNG CHẠM', { a: 'middle', s: 12, c: 'var(--danger)', bd: 'var(--danger)', bg: 'var(--danger-soft)' });
    b += K.text(300, 440, 'Có pin: đo pad "5V" ra ~5 V trước khi hàn. Không dùng cáp DJI 6 chân.', { a: 'middle', s: 12, w: 700, c: 'var(--danger)' });
    return K.svg(Wd, H, b, { title: 'TFmini lên FC' });
  };

  /* ---------- TFmini → USB-TTL ---------- */
  LR.diag.cableTfBench = () => {
    const Wd = 1000;
    const H = 380;
    let b = '';
    b += K.text(Wd / 2, 28, 'THỬ TFmini TRÊN BÀN: TFmini → mạch USB-TTL CP2102 → laptop', { a: 'middle', s: 16, w: 800 });
    b += K.rect(40, 130, 120, 70, { rx: 8, fill: '#111' }) + K.text(100, 120, 'TFmini Plus', { a: 'middle', s: 13, w: 800 });
    b += K.rect(560, 90, 220, 230, { rx: 8, fill: '#1b4d8c', stroke: '#0d2a4d' });
    b += K.text(670, 80, 'USB-TTL CP2102', { a: 'middle', s: 13, w: 800 });
    const pins = ['5V', 'GND', 'RXD', 'TXD', '3V3'];
    pins.forEach((p, i) => {
      b += K.rect(540, 120 + i * 40, 22, 14, { fill: '#d4af37' });
      b += K.text(572, 132 + i * 40, p, { s: 13, w: 800, c: '#fff', mono: true });
    });
    b += K.rect(780, 180, 80, 50, { rx: 6, fill: '#c9cdd0' }) + K.text(820, 210, 'USB', { a: 'middle', s: 12, w: 800, c: '#222' });
    b += K.path('M860 205L940 205', { stroke: 'var(--ink)', sw: 4, arrow: 'ink' }) + K.text(950, 210, 'laptop', { s: 12, w: 700 });
    const map = [['đỏ +5V', W.red, 0], ['đen GND', W.black, 1], ['xanh TXD', W.green, 2], ['trắng RXD', W.white, 3]];
    map.forEach(([lab, col, pi], i) => {
      const y0 = 145 + i * 14;
      const y1 = 127 + pi * 40;
      b += `<g class="cx${pi === 2 || pi === 3 ? ' hl' : ''}">` + K.wire(`M160 ${y0}C340 ${y0} 380 ${y1} 540 ${y1}`, col, { sw: 3, outline: col !== W.red && col !== W.green }) + '</g>';
      b += K.line(44, 232 + i * 22, 70, 232 + i * 22, { stroke: 'var(--muted)', sw: 7, lc: 'round' }) + K.line(44, 232 + i * 22, 70, 232 + i * 22, { stroke: col, sw: 5, lc: 'round' }) + K.text(80, 236 + i * 22, `${lab} → ${pins[pi]}`, { s: 12, w: 700 });
    });
    b += K.pill(400, 330, 'TXD của cảm biến → RXD của mạch (bắt chéo)', { a: 'middle', s: 12, c: 'var(--danger)', bd: 'var(--danger)' });
    b += K.text(400, 364, 'Dây Dupont đực-cái. Cảm biến không có bảo vệ ngược cực: đo trước khi cắm USB.', { a: 'middle', s: 12, c: 'var(--ink2)' });
    return K.svg(Wd, H, b, { title: 'TFmini với USB-TTL' });
  };

  /* ---------- ESP32 ↔ FC SERIAL2 ---------- */
  LR.diag.cableEsp = () => {
    const Wd = 1100;
    const H = 470;
    let b = '';
    b += K.text(Wd / 2, 28, 'ESP32 DevKit ↔ FC SERIAL2 (bắt chéo) + nguồn riêng từ UBEC', { a: 'middle', s: 16, w: 800 });
    b += K.board(60, 80, 420, 110, { rx: 10 });
    b += K.text(270, 72, 'FC — mép trước, mặt trên', { a: 'middle', s: 12.5, w: 800 });
    const row = LR.k.padRow(100, 140, [[{ k: 'T2', l: 'T2' }, { k: 'R2', l: 'R2' }, { k: '4V5f', l: '4V5' }, { k: 'Gf', l: 'G' }], [{ k: 'A', l: 'G' }, { k: 'B', l: '5V' }, { k: 'C', l: 'S5' }]], { on: ['T2', 'R2', 'Gf'], pitch: 34, gap: 26, pw: 26, ph: 26, lblAbove: true });
    b += row.svg;
    b += K.text(150, 112, 'hàng trong (sau dãy 5V G CAM CC…)', { s: 11, c: 'var(--silk)' });
    // ESP32
    b += K.rect(700, 70, 260, 360, { rx: 10, fill: '#111a17', stroke: '#000' });
    b += K.rect(790, 62, 80, 30, { rx: 5, fill: '#c9cdd0' }) + K.text(830, 82, 'micro-USB', { a: 'middle', s: 10, w: 800, c: '#222' });
    b += K.text(830, 230, 'ESP32\nDevKit\n(30 chân)', { a: 'middle', s: 14, w: 800, c: '#cfd' });
    const left = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5'];
    const right = ['VIN', 'GND', 'D13', 'D12'];
    const lp = {};
    left.forEach((l, i) => { const y = 112 + i * 36; b += K.circle(716, y, 7, { fill: ['RX2', 'TX2', 'GND'].includes(l) ? 'var(--hl)' : 'var(--pad)' }); b += K.text(730, y + 4, l, { s: 11, w: 800, c: '#eee', mono: true }); lp[l] = [709, y]; });
    const rp = {};
    right.forEach((l, i) => { const y = 112 + i * 36; b += K.circle(944, y, 7, { fill: ['VIN', 'GND'].includes(l) ? 'var(--hl)' : 'var(--pad)' }); b += K.text(930, y + 4, l, { a: 'end', s: 11, w: 800, c: '#eee', mono: true }); rp[l] = [951, y]; });
    const T2 = row.pos.T2;
    const R2 = row.pos.R2;
    const G = row.pos.Gf;
    b += '<g class="cx hl">' + K.wire(`M${T2[0]} ${T2[1] + 14}C${T2[0]} 330 560 ${lp.RX2[1]} ${lp.RX2[0]} ${lp.RX2[1]}`, W.yellow, { sw: 3 }) + '</g>';
    b += '<g class="cx hl">' + K.wire(`M${R2[0]} ${R2[1] + 14}C${R2[0]} 360 580 ${lp.TX2[1]} ${lp.TX2[0]} ${lp.TX2[1]}`, W.green, { sw: 3 }) + '</g>';
    b += K.wire(`M${G[0]} ${G[1] + 14}C${G[0]} 250 520 ${lp.GND[1]} ${lp.GND[0]} ${lp.GND[1]}`, W.black, { sw: 3, outline: true });
    b += K.pill(400, 410, 'T2 → RX2 (GPIO16) · R2 → TX2 (GPIO17) · G → GND', { a: 'middle', s: 12, c: 'var(--pc)', bd: 'var(--pc)' });
    b += K.box(1000, 300, 90, 60, 'bảng chia', '5V UBEC', { bg: 'var(--surface)', ts: 12, ss: 10 });
    b += K.wire(`M1000 320C980 320 990 ${rp.VIN[1]} ${rp.VIN[0]} ${rp.VIN[1]}`, W.red, { sw: 3 }) + K.wire(`M1000 340C975 340 985 ${rp.GND[1]} ${rp.GND[0]} ${rp.GND[1]}`, W.black, { sw: 3, outline: true });
    b += K.text(1045, 390, 'không lấy 5V\ncủa FC', { a: 'middle', s: 11.5, w: 800, c: 'var(--danger)' });
    return K.svg(Wd, H, b, { title: 'ESP32 với FC' });
  };

  /* ---------- UBEC → bảng chia → ESP32 + camera ---------- */
  LR.diag.cablePwr = () => {
    const Wd = 1100;
    const H = 420;
    let b = '';
    b += K.text(Wd / 2, 28, 'NHÁNH NGUỒN RIÊNG: pad pin ESC → UBEC 5V 3A → bảng chia (hộp Deluxe) → ESP32 + camera', { a: 'middle', s: 15.5, w: 800 });
    b += K.rect(40, 150, 120, 80, { rx: 8, fill: 'var(--pad)' });
    b += K.text(100, 186, '+  −', { a: 'middle', s: 24, w: 900, c: '#3a2b00' });
    b += K.text(100, 214, 'pad pin ESC', { a: 'middle', s: 11, w: 700, c: '#3a2b00' });
    b += K.rect(260, 150, 160, 80, { rx: 10, fill: '#253041', stroke: '#111' });
    b += K.text(340, 186, 'UBEC', { a: 'middle', s: 16, w: 800, c: '#fff' });
    b += K.text(340, 206, 'vào 2–6S · ra 5V 3A', { a: 'middle', s: 11, c: '#cfd8ea' });
    b += K.wire('M160 175L260 175', W.red, { sw: 3.4 }) + K.wire('M160 205L260 205', W.black, { sw: 3.4, outline: true });
    b += K.text(210, 165, 'vào', { a: 'middle', s: 11, w: 700 });
    b += K.wire('M420 175L520 175', W.red, { sw: 3 }) + K.wire('M420 205L520 205', W.black, { sw: 3, outline: true });
    b += K.text(470, 160, '✂ cắt giắc servo', { a: 'middle', s: 11, w: 800, c: 'var(--danger)' });
    b += K.text(346, 258, 'đo ra 4,8–5,2 V rồi mới nối tải', { a: 'middle', s: 11.5, w: 800, c: 'var(--warn)' });
    // bảng chia
    b += K.rect(520, 130, 90, 230, { rx: 6, fill: '#111' });
    for (let i = 0; i < 5; i += 1) {
      b += K.rect(534, 150 + i * 42, 18, 18, { rx: 3, fill: 'var(--pad)' }) + K.rect(576, 150 + i * 42, 18, 18, { rx: 3, fill: 'var(--pad)' });
    }
    b += K.text(543, 144, 'GND', { a: 'middle', s: 9, w: 800, c: '#fff' }) + K.text(585, 144, 'V_IN', { a: 'middle', s: 9, w: 800, c: '#fff' });
    b += K.text(565, 384, 'bảng chia nguồn', { a: 'middle', s: 12, w: 800 });
    // ESP32
    b += K.box(780, 110, 210, 70, 'ESP32 DevKit', 'VIN + GND (Dupont cái)', { bg: 'var(--surface)' });
    b += K.wire('M594 201C690 201 690 135 780 135', W.red, { sw: 3 }) + K.wire('M552 201C660 230 700 158 780 158', W.black, { sw: 3, outline: true });
    // camera
    b += K.box(780, 250, 210, 70, 'Camera ESP32-S3', 'lỗ 5V + GND (hàn header)', { bg: 'var(--surface)' });
    b += K.wire('M594 243C690 243 690 272 780 272', W.red, { sw: 3 }) + K.wire('M552 243C650 300 700 296 780 296', W.black, { sw: 3, outline: true });
    b += K.rect(700, 330, 26, 40, { rx: 6, fill: '#9aa3ad', stroke: '#444' });
    b += K.text(740, 356, 'tuỳ chọn: tụ 470–1000 µF song song nếu camera tự reset', { s: 11.5, w: 700, c: 'var(--muted)' });
    b += K.text(Wd / 2, 404, 'GND của UBEC và GND của FC chung nhau qua pin — UART giữa FC và ESP32 cần điều này.', { a: 'middle', s: 12, w: 700, c: 'var(--ink2)' });
    return K.svg(Wd, H, b, { title: 'Nhánh nguồn UBEC' });
  };

  /* ---------- Còi ---------- */
  LR.diag.cableBuzzer = () => {
    const Wd = 900;
    const H = 320;
    let b = '';
    b += K.text(Wd / 2, 28, 'CÒI (hộp Deluxe) → pad B+ / B− (mặt trên FC, mép trước, hàng ngoài)', { a: 'middle', s: 15.5, w: 800 });
    b += K.board(60, 60, 520, 100, { rx: 10 });
    const row = LR.k.padRow(90, 90, [[{ k: '5V', l: '5V' }, { k: 'G', l: 'G' }, { k: 'CAM', l: 'CAM' }, { k: 'CC', l: 'CC' }], [{ k: 'B+', l: 'B+' }, { k: 'B-', l: 'B−' }], [{ k: 'P+', l: 'P+' }, { k: 'P-', l: 'P−' }], [{ k: 'Gl', l: 'G' }, { k: '5Vl', l: '5V' }, { k: 'LED', l: 'LED' }]], { on: ['B+', 'B-'], pitch: 32, gap: 18, pw: 24, ph: 26 });
    b += row.svg;
    b += K.circle(740, 220, 50, { fill: '#1a1a1a' }) + K.circle(740, 220, 12, { fill: '#555' });
    b += K.text(740, 296, 'còi active', { a: 'middle', s: 13, w: 800 });
    const [bpx, bpy] = row.pos['B+'];
    const [bmx, bmy] = row.pos['B-'];
    b += K.wire(`M${bpx} ${bpy + 14}C${bpx} 250 600 200 692 205`, W.red, { sw: 3 });
    b += K.wire(`M${bmx} ${bmy + 14}C${bmx} 270 610 232 692 232`, W.black, { sw: 3, outline: true });
    b += K.text(300, 290, 'đỏ → B+ · đen → B−', { a: 'middle', s: 13, w: 800, c: 'var(--accent)' });
    return K.svg(Wd, H, b, { title: 'Còi' });
  };

  /* ---------- Pad pin ESC: XT60 + tụ + UBEC ---------- */
  LR.diag.cableBat = () => {
    const Wd = 1000;
    const H = 470;
    let b = '';
    b += K.text(Wd / 2, 28, 'PAD NGUỒN ESC: dây XT60 + tụ 1000 µF + dây vào UBEC (nhìn mặt "55A", mép sau ở dưới)', { a: 'middle', s: 15.5, w: 800 });
    b += K.board(250, 60, 500, 150, { rx: 12 });
    b += K.text(500, 120, 'ESC OX32 (mép sau)', { a: 'middle', s: 14, w: 800, c: 'var(--silk)' });
    b += K.rect(320, 200, 120, 70, { rx: 6, fill: 'var(--pad)' }) + K.text(380, 246, '+', { a: 'middle', s: 34, w: 900, c: '#8a0000' });
    b += K.rect(560, 200, 120, 70, { rx: 6, fill: 'var(--pad)' }) + K.text(620, 248, '−', { a: 'middle', s: 38, w: 900, c: '#111' });
    // XT60
    b += K.wire('M345 270L345 390', W.red, { sw: 6 }) + K.wire('M655 270L655 390', W.black, { sw: 6, outline: true });
    b += K.rect(440, 380, 80, 50, { rx: 6, fill: '#f3c623', stroke: '#7a5b00' }) + K.text(480, 410, 'XT60', { a: 'middle', s: 13, w: 800, c: '#3a2b00' });
    b += K.path('M345 390C345 410 400 405 440 405M655 390C655 410 560 405 520 405', { stroke: 'var(--ink)', sw: 3 });
    b += K.text(480, 452, 'dây XT60 120 mm (hộp Deluxe) → pin', { a: 'middle', s: 12, w: 700 });
    // tụ nằm ngang giữa hai pad, vạch (chân −) quay về pad −
    b += K.path('M440 236L462 236', { stroke: 'var(--w-red)', sw: 3 }) + K.path('M538 236L560 236', { stroke: 'var(--ink)', sw: 3 });
    b += K.rect(462, 222, 76, 28, { rx: 9, fill: '#c6ccd2', stroke: '#444' }) + K.rect(520, 222, 18, 28, { rx: 4, fill: '#555' });
    b += K.text(495, 290, 'chân dài = +', { a: 'end', s: 12, w: 800, c: 'var(--danger)' });
    b += K.text(507, 290, 'vạch = −', { s: 12, w: 800 });
    b += K.text(500, 312, '1000 µF 35 V', { a: 'middle', s: 11, w: 800, c: 'var(--muted)' });
    // UBEC
    b += K.wire('M320 240C260 240 220 330 160 330', W.red, { sw: 3 }) + K.wire('M600 270L600 352L160 352', W.black, { sw: 3, outline: true });
    b += K.box(40, 306, 120, 70, 'UBEC', 'dây vào', { bg: 'var(--surface)' });
    // thứ tự
    b += K.pill(840, 230, '1. Mạ thiếc pad 4–6 s', { a: 'middle', s: 12 });
    b += K.pill(840, 270, '2. Hàn pad − trước', { a: 'middle', s: 12 });
    b += K.pill(840, 310, '3. Rồi pad +', { a: 'middle', s: 12 });
    b += K.pill(840, 350, '4. Đo + ↔ −: không kêu', { a: 'middle', s: 12, c: 'var(--ok)', bd: 'var(--ok)' });
    return K.svg(Wd, H, b, { title: 'Pad nguồn ESC' });
  };

  /* ---------- Nối dài dây motor ---------- */
  LR.diag.cableMotor = () => {
    const Wd = 1100;
    const H = 470;
    let b = '';
    b += K.text(Wd / 2, 28, 'NỐI DÀI DÂY MOTOR: pad ESC → silicone 16AWG ~30 cm → nối chồng so le → dây motor 150 mm', { a: 'middle', s: 15.5, w: 800 });
    b += K.board(40, 90, 70, 150, { rx: 8 });
    for (let i = 0; i < 3; i += 1) b += K.rect(98, 110 + i * 40, 26, 22, { rx: 3, fill: 'var(--pad)' });
    b += K.text(75, 82, 'ESC', { a: 'middle', s: 12, w: 800 });
    const extCol = [W.yellow, W.red, W.black];
    const motCol = [W.blue, W.black, W.red];
    const sx = [600, 640, 680];
    for (let i = 0; i < 3; i += 1) {
      const y = 121 + i * 40;
      b += K.wire(`M124 ${y}L${sx[i] - 16} ${y}`, extCol[i], { sw: 5, outline: extCol[i] === W.black });
      b += K.rect(sx[i] - 18, y - 9, 36, 18, { rx: 6, fill: 'color-mix(in srgb,var(--ink) 75%,transparent)' });
      b += K.wire(`M${sx[i] + 16} ${y}L900 ${y}`, motCol[i], { sw: 3.6, outline: motCol[i] === W.black });
    }
    b += K.rect(560, 98, 170, 126, { rx: 14, fill: 'none', stroke: 'var(--accent)', sw: 2, dash: '6 4' });
    b += K.text(775, 222, 'gen to bọc cả bó', { s: 12, w: 800, c: 'var(--accent)' });
    b += K.circle(960, 160, 46, { fill: '#2b2b2b' }) + K.text(960, 165, 'motor', { a: 'middle', s: 12, w: 800, c: '#fff' });
    b += K.text(330, 100, '16AWG silicone, 3 màu cố định cho cả 4 motor', { a: 'middle', s: 12, w: 700 });
    b += K.text(800, 100, 'dây gốc 150 mm', { a: 'middle', s: 12, w: 700 });
    b += K.text(640, 242, 'so le ~2 cm — không để 3 mối thẳng hàng', { a: 'middle', s: 12, w: 700, c: 'var(--muted)' });
    // chi tiết mối nối chồng
    const y0 = 340;
    b += K.text(Wd / 2, 296, 'Chi tiết một mối: mạ thiếc hai đầu → chồng song song 6–8 mm → nung 2–3 s → giữ yên 5 s → co gen', { a: 'middle', s: 12.5, w: 800 });
    b += K.rect(220, y0 - 12, 300, 24, { rx: 10, fill: W.yellow });
    b += K.rect(470, y0 - 9, 60, 18, { rx: 3, fill: '#d9d9d9' });
    b += K.rect(560, y0 - 11, 300, 22, { rx: 9, fill: W.blue });
    b += K.rect(500, y0 - 6, 70, 12, { rx: 3, fill: '#cfcfcf' });
    b += K.path(`M500 ${y0 + 22}L570 ${y0 + 22}`, { stroke: 'var(--ink)', sw: 1.5, arrow: 'ink', arrow2: 'ink' }) + K.text(535, y0 + 40, '6–8 mm', { a: 'middle', s: 12, w: 800 });
    b += K.rect(440, y0 - 20, 160, 40, { rx: 12, fill: 'none', stroke: 'var(--accent)', sw: 2, dash: '5 3' });
    b += K.text(520, y0 + 70, 'gen nhỏ trùm qua mối ≥ 5 mm mỗi bên (luồn vào TRƯỚC khi hàn)', { a: 'middle', s: 12, w: 700, c: 'var(--accent)' });
    return K.svg(Wd, H, b, { title: 'Nối dài dây motor' });
  };

  /* ---------- Các họ giắc ---------- */
  LR.diag.connectors = () => {
    const Wd = 1180;
    const H = 560;
    let b = '';
    const cell = (i, title, sub, draw) => {
      const x = (i % 4) * 295 + 10;
      const y = Math.floor(i / 4) * 270 + 10;
      return K.rect(x, y, 280, 255, { rx: 12, fill: 'var(--surface2)', stroke: 'var(--line)' }) + `<g transform="translate(${x},${y})">${draw}</g>` +
        K.text(x + 140, y + 205, title, { a: 'middle', s: 14, w: 800 }) + K.text(x + 140, y + 226, sub, { a: 'middle', s: 11, c: 'var(--muted)' });
    };
    const housing = (n, pitch, hgt, col, latch) => {
      const w = n * pitch + 16;
      let s = K.rect(140 - w / 2, 60, w, hgt, { rx: 4, fill: col, stroke: '#8a7f6a', sw: 1.4 });
      for (let i = 0; i < n; i += 1) s += K.rect(140 - w / 2 + 8 + i * pitch + pitch * 0.25, 70, pitch * 0.5, hgt - 20, { fill: '#c9b27a' });
      if (latch) s += K.rect(140 - 18, 52, 36, 10, { rx: 3, fill: '#d9cdb5', stroke: '#8a7f6a' });
      for (let i = 0; i < n; i += 1) s += K.line(140 - w / 2 + 8 + i * pitch + pitch / 2, 60 + hgt, 140 - w / 2 + 8 + i * pitch + pitch / 2, 60 + hgt + 50, { stroke: ['#d33', '#222', '#e3b505', '#2e9e4f', '#2f6fd6', '#eee'][i % 6], sw: 3 });
      return s;
    };
    b += cell(0, 'JST-SH 1,0 mm', 'cổng FC + cáp hộp Deluxe', housing(6, 14, 50, '#f2ece0'));
    b += cell(1, 'JST-GH 1,25 mm', 'GPS M10, TFmini — có lẫy', housing(6, 17.5, 56, '#f2ece0', true));
    b += cell(2, 'Dupont 2,54 mm', 'header ESP32, USB-TTL, iA6B', K.rect(70, 50, 140, 30, { rx: 3, fill: '#111' }) + [0, 1, 2, 3, 4].map((i) => K.rect(84 + i * 26, 30, 8, 22, { fill: '#d4af37' })).join('') + K.rect(100, 110, 26, 46, { rx: 3, fill: '#222' }) + K.text(113, 172, 'đầu cái', { a: 'middle', s: 11 }) + K.rect(160, 120, 10, 26, { fill: '#d4af37' }) + K.text(165, 172, 'đầu đực', { a: 'middle', s: 11 }));
    b += cell(3, 'Giắc servo 3 chân', 'UBEC ra, cổng iA6B: giữa = +', K.rect(95, 60, 90, 36, { rx: 4, fill: '#222' }) + K.line(110, 96, 110, 160, { stroke: '#7a4a1e', sw: 4 }) + K.line(140, 96, 140, 160, { stroke: '#d33', sw: 4 }) + K.line(170, 96, 170, 160, { stroke: '#f0b400', sw: 4 }) + K.text(110, 176, '−', { a: 'middle', s: 14, w: 900 }) + K.text(140, 176, '+', { a: 'middle', s: 14, w: 900 }) + K.text(170, 176, 'S', { a: 'middle', s: 13, w: 900 }));
    b += cell(4, 'XT60', 'pin ↔ drone / sạc / smoke stopper', K.poly([[100, 50], [180, 50], [190, 62], [190, 130], [90, 130], [90, 62]], { fill: '#f3c623', stroke: '#7a5b00', sw: 2 }) + K.circle(120, 90, 13, { fill: '#c49a1f' }) + K.circle(160, 90, 13, { fill: '#c49a1f' }) + K.text(140, 160, 'cạnh vát = chống ngược', { a: 'middle', s: 11.5, w: 700 }));
    b += cell(5, 'JST-XH (dây cân bằng)', 'pin 4S → cổng 4S của sạc', housing(5, 18, 44, '#f6f6f6'));
    b += cell(6, 'USB-C', 'FC, camera (USB-UART)', K.rect(80, 70, 120, 50, { rx: 25, fill: '#c9cdd0', stroke: '#777', sw: 2 }) + K.rect(100, 88, 80, 14, { rx: 7, fill: '#333' }) + K.text(140, 160, 'cáp phải có dữ liệu', { a: 'middle', s: 11.5, w: 700 }));
    b += cell(7, 'Pad hàn', 'mép FC, ESC', K.board(60, 50, 160, 110, { rx: 8 }) + [0, 1, 2, 3].map((i) => K.rect(78 + i * 36, 70, 24, 30, { rx: 2, fill: 'var(--pad)' })).join('') + K.text(140, 140, 'mạ trước, nung 2–4 s', { a: 'middle', s: 11.5, w: 700, c: 'var(--silk)' }));
    return K.svg(Wd, H, b, { title: 'Các họ giắc' });
  };

  /* ---------- Cỡ dây ---------- */
  LR.diag.gauges = () => {
    const rows = LR.data.gauges;
    const Wd = 1000;
    const H = 70 + rows.length * 62;
    let b = K.text(30, 32, 'CỠ DÂY — AWG càng NHỎ thì dây càng TO', { s: 16, w: 800 });
    rows.forEach((r, i) => {
      const y = 60 + i * 62;
      const th = [14, 10, 7, 4][i];
      b += K.line(40, y + 20, 260, y + 20, { stroke: r.col, sw: th, lc: 'round' });
      b += K.text(290, y + 16, r.awg, { s: 15, w: 800 }) + K.text(290, y + 36, r.a, { s: 12, c: 'var(--muted)' });
      b += K.text(440, y + 26, r.use.replace(/\*\*/g, ''), { s: 12.5, w: 500 });
    });
    return K.svg(Wd, H, b, { title: 'Cỡ dây' });
  };
})();
