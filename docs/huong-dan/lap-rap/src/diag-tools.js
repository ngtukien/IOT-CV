/* Hình minh hoạ thao tác và dụng cụ. */
(function () {
  const K = LR.k;
  const W = K.W;

  LR.diag.deskLayout = () => {
    let b = '';
    b += K.rect(20, 40, 640, 300, { rx: 14, fill: 'var(--surface2)', stroke: 'var(--line2)', sw: 2 });
    b += K.text(340, 30, 'BÀN LẮP RÁP (nhìn từ trên)', { a: 'middle', s: 14, w: 800 });
    /* Ô khu vực: tên ở trên, mô tả ngay dưới, hình ở nửa dưới. */
    const zone = (x, w, t, sub, col) => K.rect(x, 60, w, 260, { rx: 10, fill: 'var(--surface)', stroke: col || 'var(--line2)', sw: 1.4 }) +
      K.text(x + w / 2, 92, t, { a: 'middle', s: 14, w: 800, c: col || 'var(--ink)' }) +
      K.text(x + w / 2, 114, sub, { a: 'middle', s: 11.5, c: 'var(--muted)' });
    b += zone(40, 190, 'Khu hàn', 'mỏ hàn trên giá · bọt biển\nflux · quạt hút / cửa sổ', 'var(--accent)');
    b += K.icon('iron', 110, 200, 50, 'var(--accent)');
    b += zone(250, 210, 'Khu lắp', 'giấy trắng / thảm silicone\n5 hộp ốc có nhãn');
    [0, 1, 2, 3, 4].forEach((i) => { b += K.rect(268 + i * 37, 230, 30, 30, { rx: 5, fill: 'var(--sunken)', stroke: 'var(--line2)' }); });
    b += zone(480, 160, 'Khu đo', 'đồng hồ vạn năng\nlaptop', 'var(--you)');
    b += K.icon('meter', 532, 200, 52, 'var(--you)');
    b += K.rect(700, 120, 220, 180, { rx: 14, fill: 'var(--danger-soft)', stroke: 'var(--danger)', sw: 2, dash: '8 5' });
    b += K.text(810, 110, 'BÀN KHÁC', { a: 'middle', s: 14, w: 800, c: 'var(--danger)' });
    b += K.icon('bag', 730, 160, 54, 'var(--danger)') + K.icon('fire', 830, 160, 54, 'var(--danger)');
    b += K.text(810, 260, 'pin trong túi chống cháy\n+ bình chữa cháy / cát', { a: 'middle', s: 12, w: 700 });
    return K.svg(940, 360, b, { title: 'Bố trí bàn' });
  };

  LR.diag.toolkit = () => K.iconGrid([
    ['iron', 'Mỏ hàn ≥ 60 W'], ['solder', 'Thiếc 0,8 mm'], ['flux', 'Flux'], ['third', 'Tay thứ ba'], ['strip', 'Kìm tuốt'],
    ['meter', 'Đồng hồ vạn năng'], ['wire', 'Dây 16AWG 3 màu'], ['shrink', 'Gen co 2–10 mm'], ['zip', 'Dây rút'], ['dupont', 'Dây Dupont'],
    ['hex', 'Lục giác'], ['tape', 'Băng keo xốp VHB'], ['dryer', 'Máy sấy (co gen)'], ['glasses', 'Kính bảo hộ'], ['scale', 'Cân điện tử'],
  ], 5, 170, 120);

  LR.diag.safetyRules = () => {
    const s = LR.data.safety;
    const cols = 4;
    const cw = 250;
    const ch = 150;
    let b = '';
    s.forEach((r, i) => {
      const x = (i % cols) * cw;
      const y = Math.floor(i / cols) * ch;
      b += K.rect(x + 6, y + 6, cw - 12, ch - 12, { rx: 12, fill: 'var(--danger-soft)', stroke: 'color-mix(in srgb,var(--danger) 35%,transparent)' });
      b += K.icon(r.ic, x + 18, y + 18, 40, 'var(--danger)');
      const tl = K.wrap(r.t, 20);
      b += K.text(x + 68, y + (tl.length > 1 ? 34 : 42), tl.slice(0, 2).join('\n'), { s: 13.5, w: 800 });
      b += K.text(x + 20, y + 84, K.wrap(r.d.replace(/`/g, ''), 32).slice(0, 3).join('\n'), { s: 11.5, c: 'var(--ink2)' });
    });
    return K.svg(cols * cw, Math.ceil(s.length / cols) * ch, b, { title: 'Luật an toàn' });
  };

  LR.diag.solderJoint = () => {
    let b = '';
    const panel = (x, ok) => {
      let s = K.rect(x, 50, 380, 230, { rx: 14, fill: ok ? 'var(--ok-soft)' : 'var(--danger-soft)', stroke: ok ? 'var(--ok)' : 'var(--danger)', sw: 2 });
      s += K.rect(x + 60, 200, 260, 18, { rx: 3, fill: 'var(--pad)' });
      s += K.rect(x + 30, 160, 140, 18, { rx: 8, fill: W.red });
      s += K.rect(x + 160, 166, 90, 8, { fill: '#c98a3a' });
      if (ok) s += K.path(`M${x + 140} 200C${x + 160} 160 ${x + 260} 160 ${x + 290} 200Z`, { fill: '#d9dde0', stroke: '#9aa', sw: 1.5 }) + K.path(`M${x + 170} 186L${x + 260} 186M${x + 172} 192L${x + 262} 192`, { stroke: '#b0703a', sw: 1 });
      else s += K.ellipse(x + 215, 182, 52, 30, { fill: '#8d9196', stroke: '#666', sw: 1.5 }) + K.circle(x + 196, 176, 5, { fill: '#777' }) + K.circle(x + 228, 190, 4, { fill: '#777' });
      s += K.text(x + 190, 86, ok ? '✓ MỐI ĐẠT' : '✗ MỐI NGUỘI', { a: 'middle', s: 18, w: 800, c: ok ? 'var(--ok)' : 'var(--danger)' });
      s += K.text(x + 190, 112, ok ? 'bóng, mượt, ôm sát · thấy hình sợi đồng' : 'xám, sần, vón như giọt nước · dễ nứt khi rung', { a: 'middle', s: 12, w: 600 });
      s += K.text(x + 190, 260, ok ? 'kéo tay không tuột' : '→ hút thiếc, làm lại (đừng hàn đè)', { a: 'middle', s: 12, w: 700, c: ok ? 'var(--ok)' : 'var(--danger)' });
      return s;
    };
    b += K.text(400, 30, 'Nhìn mối hàn: bóng = tốt, xám sần = nguội', { a: 'middle', s: 15, w: 800 });
    b += panel(10, true) + panel(410, false);
    return K.svg(800, 290, b, { title: 'Mối hàn' });
  };

  LR.diag.heatShrink = () => {
    let b = '';
    const step = (x, n, t, draw) => K.rect(x, 20, 230, 190, { rx: 12, fill: 'var(--surface2)', stroke: 'var(--line)' }) + K.circle(x + 22, 42, 14, { fill: 'var(--accent)' }) + K.text(x + 22, 47, String(n), { a: 'middle', s: 13, w: 800, c: '#fff' }) + K.text(x + 46, 47, t, { s: 12.5, w: 800 }) + draw;
    b += step(10, 1, 'Luồn gen TRƯỚC khi hàn', K.rect(30, 120, 190, 10, { rx: 5, fill: W.yellow }) + K.rect(50, 112, 50, 26, { rx: 6, fill: 'none', stroke: 'var(--ink)', sw: 2 }));
    b += step(250, 2, 'Hàn xong, đẩy gen trùm mối', K.rect(270, 120, 190, 10, { rx: 5, fill: W.yellow }) + K.circle(365, 125, 9, { fill: '#cfd3d6' }) + K.rect(330, 112, 70, 26, { rx: 6, fill: 'none', stroke: 'var(--ink)', sw: 2 }) + K.text(365, 170, '≥ 5 mm mỗi bên', { a: 'middle', s: 11.5 }));
    b += step(490, 3, 'Co bằng máy sấy, xoay đều', K.rect(510, 120, 190, 10, { rx: 5, fill: W.yellow }) + K.rect(570, 116, 70, 18, { rx: 6, fill: '#333' }) + K.icon('dryer', 620, 140, 44, 'var(--accent)') + K.text(605, 196, 'không dùng mỏ hàn', { a: 'middle', s: 11.5, w: 700, c: 'var(--danger)' }));
    return K.svg(730, 220, b, { title: 'Gen co nhiệt' });
  };

  LR.diag.capPolarity = () => {
    let b = '';
    b += K.rect(160, 40, 110, 150, { rx: 18, fill: '#c6ccd2', stroke: '#444', sw: 2 });
    b += K.rect(240, 40, 30, 150, { fill: '#4b4f55' });
    b += K.text(255, 120, '−', { a: 'middle', s: 30, w: 900, c: '#fff' });
    b += K.text(200, 110, '1000µF\n35V', { a: 'middle', s: 13, w: 800, c: '#222' });
    b += K.line(190, 190, 190, 320, { stroke: '#aaa', sw: 5 }) + K.line(245, 190, 245, 280, { stroke: '#aaa', sw: 5 });
    b += K.rect(178, 250, 24, 60, { rx: 4, fill: W.red, op: 0.85 }) + K.rect(233, 230, 24, 40, { rx: 4, fill: '#222', op: 0.9 });
    b += K.text(150, 335, 'chân DÀI = +\ngen ĐỎ', { a: 'end', s: 13, w: 800, c: 'var(--danger)' });
    b += K.text(285, 290, 'chân NGẮN = −\nvạch trên thân · gen ĐEN', { s: 13, w: 800 });
    b += K.text(220, 375, 'Hàn sát pad + / − của ESC. Ngược cực = nổ tụ.', { a: 'middle', s: 12.5, w: 700, c: 'var(--danger)' });
    return K.svg(460, 390, b, { title: 'Cực của tụ' });
  };

  const meterBody = (dial, disp) => {
    let s = K.rect(40, 30, 200, 330, { rx: 22, fill: '#f0b400', stroke: '#7a5b00', sw: 2 });
    s += K.rect(62, 52, 156, 70, { rx: 8, fill: '#bfd0b0', stroke: '#555' });
    s += K.text(140, 100, disp, { a: 'middle', s: 30, w: 800, c: '#222', mono: true });
    s += K.circle(140, 210, 52, { fill: '#2b2b2b' });
    const labels = [['V⎓', -150], ['V~', -110], ['Ω', -70], ['🔊', -30], ['A', 30]];
    labels.forEach(([t, a]) => {
      const r = 68;
      const x = 140 + r * Math.cos((a * Math.PI) / 180);
      const y = 210 + r * Math.sin((a * Math.PI) / 180);
      s += K.text(x, y + 5, t, { a: 'middle', s: 13, w: 800, c: t === dial ? 'var(--danger)' : '#333' });
    });
    const ang = { 'V⎓': -150, '🔊': -30, 'Ω': -70 }[dial];
    s += K.line(140, 210, 140 + 44 * Math.cos((ang * Math.PI) / 180), 210 + 44 * Math.sin((ang * Math.PI) / 180), { stroke: '#fff', sw: 6, lc: 'round' });
    s += K.circle(95, 320, 10, { fill: '#111' }) + K.circle(140, 320, 10, { fill: '#d33' }) + K.circle(185, 320, 10, { fill: '#555' });
    s += K.text(95, 346, 'COM', { a: 'middle', s: 10, w: 800 }) + K.text(140, 346, 'VΩ', { a: 'middle', s: 10, w: 800 }) + K.text(185, 346, 'A', { a: 'middle', s: 10, w: 800, c: 'var(--danger)' });
    return s;
  };

  LR.diag.meterContinuity = () => {
    let b = meterBody('🔊', '.000');
    b += K.text(500, 34, 'THÔNG MẠCH (biểu tượng loa) — KHÔNG có pin', { a: 'middle', s: 15, w: 800 });
    b += K.poly([[420, 120], [520, 120], [530, 132], [530, 200], [410, 200], [410, 132]], { fill: '#f3c623', stroke: '#7a5b00', sw: 2 });
    b += K.circle(445, 160, 14, { fill: '#c49a1f' }) + K.circle(495, 160, 14, { fill: '#c49a1f' });
    b += K.text(445, 112, '+', { a: 'middle', s: 18, w: 900, c: 'var(--danger)' }) + K.text(495, 112, '−', { a: 'middle', s: 20, w: 900 });
    b += K.path('M95 320C150 420 360 300 495 175', { stroke: '#111', sw: 4 }) + K.path('M140 320C200 400 380 260 445 175', { stroke: '#d33', sw: 4 });
    b += K.pill(640, 130, '✓ im lặng / bíp ngắn rồi tắt (tụ nạp)', { s: 12.5, c: 'var(--ok)', bd: 'var(--ok)' });
    b += K.pill(640, 180, '✗ kêu LIÊN TỤC = CHẬP → không cắm pin', { s: 12.5, c: 'var(--danger)', bd: 'var(--danger)' });
    b += K.text(560, 260, 'Đo thêm: pad motor ↔ −, pha motor ↔ vỏ / ốc khung.\nQue đen ở COM, que đỏ ở VΩ.', { s: 12.5, w: 600 });
    return K.svg(960, 380, b, { title: 'Đo thông mạch' });
  };

  LR.diag.meterVolt = () => {
    let b = meterBody('V⎓', '5.03');
    b += K.text(520, 34, 'ĐO ĐIỆN ÁP DC (thang 20 V) — CÓ pin', { a: 'middle', s: 15, w: 800 });
    b += K.board(420, 110, 260, 120, { rx: 10 });
    b += K.pad(470, 150, 34, 34, '5V', { on: true, ls: 12, lblY: 142 }) + K.pad(560, 150, 34, 34, 'G', { ls: 12, lblY: 142 });
    b += K.path('M95 320C200 400 500 330 577 185', { stroke: '#111', sw: 4 }) + K.path('M140 320C230 380 430 300 487 185', { stroke: '#d33', sw: 4 });
    b += K.table(706, 110, [140, 110], [['Điểm đo', 'Phải ra'], ['pad 5V của FC', '4,8–5,2 V'], ['pad 4V5 (GPS)', '≥ 4,7 V'], ['đầu ra UBEC', '4,8–5,2 V'], ['đầu XT60', 'ghi số (D8)']], { head: true, rh: 22, s: 12 });
    b += K.text(560, 400, 'Que đỏ ở lỗ VΩ — để ở lỗ A rồi đo pin là chập pin.', { a: 'middle', s: 12.5, w: 800, c: 'var(--danger)' });
    return K.svg(960, 420, b, { title: 'Đo điện áp' });
  };

  LR.diag.smoke = () => {
    let b = '';
    b += K.text(500, 28, 'SMOKE STOPPER (Short-Circuit Protection Tool) — lần cấp điện đầu', { a: 'middle', s: 15, w: 800 });
    b += K.rect(30, 110, 190, 90, { rx: 10, fill: '#2d3a54' }) + K.text(125, 160, 'PIN 4S', { a: 'middle', s: 15, w: 800, c: '#fff' });
    b += K.rect(330, 70, 300, 170, { rx: 16, fill: '#1b1b1b', stroke: '#000' });
    b += K.rect(300, 120, 34, 70, { rx: 5, fill: '#f3c623' }) + K.rect(626, 120, 34, 70, { rx: 5, fill: '#f3c623' });
    b += K.text(318, 258, 'BAT IN', { a: 'middle', s: 11, w: 800 }) + K.text(644, 258, 'BAT OUT', { a: 'middle', s: 11, w: 800 });
    b += K.rect(380, 90, 140, 50, { rx: 6, fill: '#300' }) + K.text(450, 126, '16.4', { a: 'middle', s: 30, w: 800, c: '#ff4d3d', mono: true });
    b += K.circle(410, 190, 16, { fill: '#555' }) + K.text(410, 230, 'ON/OFF', { a: 'middle', s: 11, w: 800, c: '#fff' });
    b += K.circle(500, 190, 16, { fill: '#555' }) + K.text(500, 230, '1A / 2A', { a: 'middle', s: 11, w: 800, c: '#fff' });
    b += K.circle(580, 110, 9, { fill: '#e33' }) + K.text(580, 96, 'đèn đỏ', { a: 'middle', s: 10.5, w: 700, c: '#fff' });
    b += K.rect(760, 100, 200, 110, { rx: 12, fill: 'var(--surface2)', stroke: 'var(--line2)' }) + K.icon('drone', 830, 120, 60);
    b += K.path('M220 155L300 155', { stroke: 'var(--danger)', sw: 5, arrow: 'danger' }) + K.path('M660 155L760 155', { stroke: 'var(--danger)', sw: 5, arrow: 'danger' });
    b += K.text(860, 232, 'XT60 drone', { a: 'middle', s: 12, w: 700 });
    b += K.table(40, 270, [300, 620], [['Thao tác', 'Ý nghĩa'], ['Đầu ra tắt → chọn 1A → bấm ON', 'cấp điện, giới hạn 1 A (đủ cho bo, không đủ cho motor)'], ['Màn: điện áp ~15–16,8 V, dòng nhỏ', 'bình thường'], ['Tự ngắt / ĐÈN ĐỎ NHÁY', 'CHẬP hoặc quá dòng → rút pin ngay, quay lại đo thông mạch'], ['Chạy motor', 'tháo smoke stopper ra, cắm pin thẳng']], { head: true, rh: 26, s: 12.5 });
    return K.svg(1000, 410, b, { title: 'Smoke stopper' });
  };

  LR.diag.charger = () => {
    let b = '';
    b += K.text(480, 28, 'SẠC iMAX B6AC V2 + PIN 4S', { a: 'middle', s: 15, w: 800 });
    b += K.rect(40, 60, 360, 250, { rx: 14, fill: '#1f1f1f' });
    b += K.rect(70, 90, 300, 70, { rx: 6, fill: '#26425a' }) + K.text(220, 120, 'LiPo BALANCE', { a: 'middle', s: 16, w: 800, c: '#9fe1ff', mono: true }) + K.text(220, 146, '3.0A  14.8V(4S)', { a: 'middle', s: 14, w: 700, c: '#9fe1ff', mono: true });
    ['BATT TYPE', 'DEC', 'INC', 'START'].forEach((t, i) => { b += K.rect(70 + i * 76, 190, 66, 34, { rx: 6, fill: '#444' }) + K.text(103 + i * 76, 212, t, { a: 'middle', s: 9.5, w: 800, c: '#fff' }); });
    b += K.rect(80, 250, 60, 40, { rx: 4, fill: '#f3c623' }) + K.text(110, 243, 'ra XT60', { a: 'middle', s: 10.5, w: 700, c: '#fff' });
    b += K.rect(250, 256, 120, 28, { rx: 3, fill: '#eee' }) + K.text(310, 249, 'cổng cân bằng 4S', { a: 'middle', s: 10.5, w: 700, c: '#fff' });
    b += K.rect(560, 120, 330, 110, { rx: 12, fill: '#2d3a54' }) + K.text(725, 176, 'PIN 4S 5300', { a: 'middle', s: 16, w: 800, c: '#fff' });
    b += K.path('M560 200C480 200 200 330 110 290', { stroke: W.red, sw: 5 }) + K.path('M560 215C500 260 400 300 310 284', { stroke: '#ddd', sw: 7 });
    b += K.text(470, 330, '1. XT60 trước  ·  2. dây cân bằng (5 chân) sau', { a: 'middle', s: 12.5, w: 800 });
    b += K.table(40, 350, [200, 640], [['Chế độ', 'Dùng khi'], ['BALANCE 4S, 3,0 A', 'sạc đầy 4,20 V/cell — ngay trước buổi bay'], ['STORAGE', 'cất pin vài ngày — 3,80–3,85 V/cell'], ['Battery Meter', 'đo từng cell (B8) — lệch < 0,05 V']], { head: true, rh: 26, s: 12.5 });
    return K.svg(960, 470, b, { title: 'Sạc pin' });
  };

  LR.diag.threadSort = () => {
    let b = '';
    b += K.text(460, 28, 'PHÂN LOẠI REN: thử MỘT cánh bất kỳ lên trục cả 4 motor', { a: 'middle', s: 15, w: 800 });
    const mot = (x, ok, grp) => {
      let s = K.rect(x - 34, 120, 68, 90, { rx: 8, fill: '#2b2b2b' });
      s += K.rect(x - 6, 80, 12, 40, { fill: '#bbb' });
      for (let i = 0; i < 6; i += 1) s += K.line(x - 6, 84 + i * 6, x + 6, 88 + i * 6, { stroke: '#777', sw: 1.2 });
      s += K.rect(x - 70, 66, 140, 10, { rx: 5, fill: '#333', op: ok ? 1 : 0.35 });
      s += ok ? K.check(x, 240, 18) : K.cross(x, 240, 16);
      s += K.text(x, 280, ok ? 'vào ngọt' : 'không vào', { a: 'middle', s: 12.5, w: 800, c: ok ? 'var(--ok)' : 'var(--danger)' });
      s += K.text(x, 300, grp, { a: 'middle', s: 12, w: 700, c: 'var(--muted)' });
      return s;
    };
    b += mot(140, true, 'nhóm A') + mot(340, true, 'nhóm A') + mot(580, false, 'nhóm B') + mot(780, false, 'nhóm B');
    b += K.rect(40, 330, 380, 80, { rx: 12, fill: 'var(--you-soft)', stroke: 'var(--you)' });
    b += K.text(230, 362, 'Ren PHẢI (vặn thuận chiều kim) →', { a: 'middle', s: 13, w: 800, c: 'var(--you)' }) + K.text(230, 388, 'vị trí CCW: M2 trước-phải, M3 sau-trái', { a: 'middle', s: 13, w: 700 });
    b += K.rect(480, 330, 400, 80, { rx: 12, fill: 'var(--ok-soft)', stroke: 'var(--ok)' });
    b += K.text(680, 362, 'Ren TRÁI (vặn ngược chiều kim) →', { a: 'middle', s: 13, w: 800, c: 'var(--ok)' }) + K.text(680, 388, 'vị trí CW: M1 sau-phải, M4 trước-trái', { a: 'middle', s: 13, w: 700 });
    b += K.text(460, 440, 'Phải dùng lực = sai cặp → dừng. Cả 4 vào được = shop giao nhầm → đổi hàng.', { a: 'middle', s: 12.5, w: 800, c: 'var(--danger)' });
    return K.svg(920, 460, b, { title: 'Phân loại ren motor' });
  };

  LR.diag.propId = () => {
    let b = '';
    b += K.text(470, 28, 'NHẬN CÁNH: cạnh DÀY đi trước theo chiều quay · mặt có chữ hướng lên trời', { a: 'middle', s: 15, w: 800 });
    const prop = (cx, cw) => {
      let s = K.circle(cx, 210, 150, { stroke: 'var(--line2)', sw: 1, dash: '4 4' });
      const blade = (sgn) => {
        const t = cw ? 1 : -1;
        return K.path(`M${cx} 210C${cx + sgn * 40} ${210 - t * sgn * 26} ${cx + sgn * 120} ${210 - t * sgn * 30} ${cx + sgn * 150} ${210 - t * sgn * 6}C${cx + sgn * 120} ${210 + t * sgn * 6} ${cx + sgn * 40} ${210 + t * sgn * 6} ${cx} 210Z`, { fill: '#333', stroke: '#111', sw: 1 });
      };
      s += blade(1) + blade(-1) + K.circle(cx, 210, 14, { fill: '#999' });
      s += K.spin(cx, 210, 175, cw, { sw: 3.5 });
      s += K.text(cx, 400, cw ? 'CÁNH CW (pusher, thường có chữ R)' : 'CÁNH CCW (thường)', { a: 'middle', s: 14, w: 800, c: cw ? 'var(--ok)' : 'var(--you)' });
      s += K.text(cx, 422, cw ? '→ M1 sau-phải, M4 trước-trái' : '→ M2 trước-phải, M3 sau-trái', { a: 'middle', s: 12.5, w: 700 });
      return s;
    };
    b += prop(240, true) + prop(700, false);
    b += K.text(470, 452, 'Kiểm cuối: vặn tay vào ngọt; xoay theo chiều motor quay → cánh SIẾT thêm. Nới ra = motor đặt sai chỗ.', { a: 'middle', s: 12.5, w: 800, c: 'var(--danger)' });
    return K.svg(940, 470, b, { title: 'Nhận dạng cánh' });
  };

  LR.diag.rotation = () => {
    let b = '';
    b += K.text(330, 26, 'CHIỀU QUAY (nhìn từ trên) — FRAME_TYPE 12', { a: 'middle', s: 15, w: 800 });
    b += K.nose(330, 34);
    const m = [[150, 150, 4, true, 'trước-trái'], [510, 150, 2, false, 'trước-phải'], [150, 470, 3, false, 'sau-trái'], [510, 470, 1, true, 'sau-phải']];
    m.forEach(([x, y]) => { b += K.line(330, 310, x, y, { stroke: '#2f3437', sw: 22, lc: 'round' }); });
    b += K.rect(296, 276, 68, 68, { rx: 8, fill: '#3a3528', stroke: '#E9C21F', sw: 2 });
    m.forEach(([x, y, n, cw, pos]) => {
      b += K.circle(x, y, 44, { fill: 'var(--surface2)', stroke: cw ? 'var(--ok)' : 'var(--you)', sw: 3 });
      b += K.spin(x, y, 60, cw, { sw: 4 });
      b += K.text(x, y + 7, 'M' + n, { a: 'middle', s: 20, w: 900 });
      b += K.text(x, y + (y < 300 ? -78 : 92), `${pos} · ${cw ? 'CW' : 'CCW'}`, { a: 'middle', s: 13.5, w: 800, c: cw ? 'var(--ok)' : 'var(--you)' });
    });
    b += K.text(330, 600, 'Hai motor chéo nhau quay cùng chiều. Sai một motor: đổi 2 trong 3 dây của nó.', { a: 'middle', s: 12.5, w: 700 });
    return K.svg(660, 620, b, { title: 'Chiều quay' });
  };

  LR.diag.motorTestMap = () => {
    let b = '';
    b += K.text(330, 26, 'MOTOR TEST: chữ A→D theo chiều kim đồng hồ từ trước-phải', { a: 'middle', s: 15, w: 800 });
    b += K.nose(330, 34);
    const m = [[510, 150, 'A', 2, 'trước-phải'], [510, 470, 'B', 1, 'sau-phải'], [150, 470, 'C', 3, 'sau-trái'], [150, 150, 'D', 4, 'trước-trái']];
    b += K.circle(330, 310, 230, { stroke: 'var(--accent)', sw: 2, dash: '6 5' });
    b += K.path('M546 231A230 230 0 0 1 546 389', { stroke: 'var(--accent)', sw: 3, arrow: 'accent' });
    m.forEach(([x, y]) => { b += K.line(330, 310, x, y, { stroke: '#2f3437', sw: 22, lc: 'round' }); });
    m.forEach(([x, y, L, n, pos]) => {
      b += K.circle(x, y, 46, { fill: 'var(--surface)', stroke: 'var(--ink)', sw: 2.5 });
      b += K.text(x, y + 2, L, { a: 'middle', s: 30, w: 900, c: 'var(--accent)' });
      b += K.text(x, y + 26, 'M' + n, { a: 'middle', s: 14, w: 800 });
      b += K.text(x, y + (y < 300 ? -62 : 76), pos, { a: 'middle', s: 13, w: 700 });
    });
    b += K.text(330, 600, 'Bạn bấm Test motor A, B, C, D (5–10 %, 2 s) và đọc motor nào quay.', { a: 'middle', s: 12.5, w: 700 });
    return K.svg(660, 620, b, { title: 'Motor test' });
  };

  LR.diag.benchMotors = () => {
    let b = '';
    b += K.rect(20, 40, 760, 440, { rx: 16, fill: 'var(--surface2)', stroke: 'var(--line2)' });
    b += K.text(400, 30, 'THỬ MOTOR TRÊN BÀN (không khung, không cánh)', { a: 'middle', s: 15, w: 800 });
    b += K.nose(400, 50, { label: 'MŨI (xa bạn)' });
    b += K.rect(360, 220, 80, 80, { rx: 8, fill: '#3a3528', stroke: '#E9C21F', sw: 2 }) + K.text(400, 266, 'stack', { a: 'middle', s: 12, w: 800, c: '#fff' });
    const m = [[150, 140, 4], [650, 140, 2], [150, 380, 3], [650, 380, 1]];
    m.forEach(([x, y, n]) => {
      b += K.line(x < 400 ? 360 : 440, y < 260 ? 220 : 300, x, y, { stroke: W.yellow, sw: 3, dash: '10 4' });
      b += K.rect(x - 40, y - 40, 80, 80, { rx: 10, fill: 'none', stroke: 'var(--muted)', sw: 2, dash: '4 3' });
      b += K.circle(x, y, 26, { fill: '#2b2b2b' }) + K.rect(x - 4, y - 26, 8, 14, { fill: 'var(--accent)' });
      b += K.text(x, y + 60, 'M' + n, { a: 'middle', s: 16, w: 900 });
    });
    b += K.text(250, 470, 'băng dính giữ motor · mẩu băng trên chuông để nhìn chiều', { a: 'middle', s: 11.5, w: 600 });
    b += K.text(400, 520, 'BẠN NGỒI Ở ĐÂY', { a: 'middle', s: 13, w: 800, c: 'var(--you)' });
    return K.svg(800, 540, b, { title: 'Thử motor trên bàn' });
  };

  LR.diag.armSticks = () => {
    let b = '';
    const gimbal = (cx, cy, px, py, lab) => K.rect(cx - 70, cy - 70, 140, 140, { rx: 16, fill: 'var(--surface2)', stroke: 'var(--line2)' }) + K.line(cx, cy - 60, cx, cy + 60, { stroke: 'var(--line2)' }) + K.line(cx - 60, cy, cx + 60, cy, { stroke: 'var(--line2)' }) + K.circle(cx + px, cy + py, 16, { fill: 'var(--accent)' }) + K.text(cx, cy + 96, lab, { a: 'middle', s: 12, w: 700 });
    b += K.text(250, 26, 'ARM: cần trái xuống-phải, giữ 3–5 s', { a: 'middle', s: 14, w: 800, c: 'var(--danger)' });
    b += gimbal(140, 130, 52, 52, 'cần trái (ga / yaw)') + gimbal(360, 130, 0, 0, 'cần phải (để giữa)');
    b += K.text(750, 26, 'DISARM: cần trái xuống-trái, giữ 3–5 s', { a: 'middle', s: 14, w: 800, c: 'var(--ok)' });
    b += gimbal(640, 130, -52, 52, 'cần trái (ga / yaw)') + gimbal(860, 130, 0, 0, 'cần phải (để giữa)');
    b += K.text(500, 270, 'Chỉ arm khi: không cánh (tới G9) hoặc đã qua checklist; Stabilize; ga thấp nhất. Motor quay = BẠN làm.', { a: 'middle', s: 12.5, w: 700 });
    return K.svg(1000, 290, b, { title: 'Arm và disarm' });
  };

  LR.diag.bindSeq = () => {
    let b = '';
    const st = (x, n, t, sub) => K.rect(x, 20, 225, 150, { rx: 12, fill: 'var(--surface2)', stroke: 'var(--line)' }) + K.circle(x + 24, 44, 15, { fill: 'var(--you)' }) + K.text(x + 24, 49, String(n), { a: 'middle', s: 13, w: 800, c: '#fff' }) + K.text(x + 112, 92, t, { a: 'middle', s: 13, w: 800 }) + K.text(x + 112, 120, sub, { a: 'middle', s: 11.5, c: 'var(--ink2)' });
    b += st(10, 1, 'Bind plug → B/VCC', 'jumper nhựa nhỏ');
    b += st(250, 2, 'Cấp điện iA6B', 'USB cho FC → 4V5\nđèn nháy NHANH');
    b += st(490, 3, 'Giữ BIND KEY + bật', 'FS-i6X hiện\n"RXBinding…"');
    b += st(730, 4, 'Đèn sáng LIÊN', 'tắt hết, RÚT bind plug,\nbật lại → sáng liên');
    [235, 475, 715].forEach((x) => { b += K.path(`M${x} 95L${x + 15} 95`, { stroke: 'var(--you)', sw: 3, arrow: 'you' }); });
    return K.svg(965, 180, b, { title: 'Bind' });
  };

  LR.diag.txSwitches = () => {
    let b = '';
    b += K.text(500, 26, 'FS-i6X — gán công tắc (chốt Phase 15, cập nhật 25/10/2026)', { a: 'middle', s: 15, w: 800 });
    b += K.rect(250, 70, 500, 300, { rx: 50, fill: '#2a2d30', stroke: '#111' });
    b += K.circle(380, 250, 64, { fill: '#1b1d1f', stroke: '#555', sw: 3 }) + K.circle(620, 250, 64, { fill: '#1b1d1f', stroke: '#555', sw: 3 });
    b += K.circle(380, 250, 14, { fill: '#c33' }) + K.circle(620, 250, 14, { fill: '#c33' });
    b += K.text(380, 340, 'ga / yaw', { a: 'middle', s: 12, w: 700, c: '#ddd' }) + K.text(620, 340, 'pitch / roll', { a: 'middle', s: 12, w: 700, c: '#ddd' });
    const sw = (x, lab, ch, fn, col, tx, ty, an) => K.rect(x - 9, 82, 18, 46, { rx: 4, fill: '#bbb' }) + K.text(x, 148, lab, { a: 'middle', s: 12, w: 900, c: '#fff' }) + K.path(`M${x} 82L${tx} ${ty + 10}`, { stroke: col, sw: 2 }) + K.text(tx, ty, `${ch}: ${fn}`, { a: an, s: 13.5, w: 800, c: col });
    b += sw(300, 'SwA', 'CH7', 'WEB CONTROL', 'var(--pc)', 230, 60, 'end');
    b += sw(350, 'SwB', 'CH8', 'ARM / DISARM — đang bay KHÔNG chạm', 'var(--danger)', 230, 400, 'end');
    b += K.circle(560, 100, 11, { fill: '#bbb' }) + K.text(560, 148, 'VrB', { a: 'middle', s: 12, w: 900, c: '#fff' }) + K.path('M560 111L500 382', { stroke: 'var(--pc)', sw: 2 }) + K.text(500, 398, 'CH9: Auto — để hết trái', { a: 'middle', s: 13.5, w: 800, c: 'var(--pc)' });
    b += sw(650, 'SwC', 'CH5', 'Stabilize / AltHold / Loiter', 'var(--you)', 770, 60, 'start');
    b += sw(700, 'SwD', 'CH6', 'RTL — công tắc cứu hộ', 'var(--danger)', 770, 400, 'start');
    b += K.text(500, 430, 'Vị trí theo nhãn in trên tay phát. Chỉ SwC có 3 nấc; VrA không dùng. Không gán "Motor Emergency Stop".', { a: 'middle', s: 12, w: 700 });
    return K.svg(1000, 450, b, { title: 'Công tắc tay phát' });
  };

  LR.diag.failsafe2 = () => {
    let b = '';
    const bx = (x, t, s2, col) => K.box(x, 60, 200, 90, t, s2, { bg: 'var(--surface)', bd: col, tc: col });
    b += K.text(500, 28, 'FAILSAFE RC — HAI LỚP, thiếu lớp nào cũng hỏng', { a: 'middle', s: 15, w: 800 });
    b += bx(20, 'Tắt tay phát', '(mô phỏng mất sóng)', 'var(--ink)');
    b += bx(290, 'Lớp 1: iA6B', 'xuất CH3 = THẤP NHẤT\n(đặt trên FS-i6X)', 'var(--you)');
    b += bx(560, 'Lớp 2: FC', 'ga < 975 → "Radio Failsafe"\nFS_THR_ENABLE 1', 'var(--pc)');
    b += bx(800, 'Đang bay', '→ RTL (hoặc LAND\nnếu chưa có GPS)', 'var(--danger)');
    [[220, 290], [490, 560], [760, 800]].forEach(([a, c]) => { b += K.path(`M${a} 105L${c - 2} 105`, { stroke: 'var(--ink)', sw: 3, arrow: 'ink' }); });
    b += K.text(500, 190, 'Thiếu lớp 1: bộ thu GIỮ giá trị cuối → FC không bao giờ biết mất sóng → bay tiếp tới hết pin.', { a: 'middle', s: 12.5, w: 800, c: 'var(--danger)' });
    return K.svg(1020, 210, b, { title: 'Failsafe hai lớp' });
  };

  LR.diag.battCal = () => {
    let b = '';
    const card = (x, w, t, v, col, o = {}) => K.rect(x, 40, w, 100, { rx: 10, fill: o.bg || 'var(--surface)', stroke: o.bd || 'var(--line2)', sw: 1.4 }) +
      K.text(x + w / 2, 72, t, { a: 'middle', s: 14, w: 700, c: o.tc || 'var(--ink)' }) +
      K.text(x + w / 2, 114, v, { a: 'middle', s: o.vs || 22, w: 800, c: col });
    b += card(30, 230, 'Đồng hồ ở XT60', '16,42 V', 'var(--ok)');
    b += card(300, 230, 'FC đang báo', '16,10 V', 'var(--danger)');
    b += card(570, 360, 'BATT_VOLT_MULT mới', '11,0 × 16,42 / 16,10 = 11,22', 'var(--ink)', { bg: 'var(--pc-soft)', bd: 'var(--pc)', tc: 'var(--pc)', vs: 16 });
    b += K.text(480, 180, 'Lặp: ghi → reboot → so lại, tới khi lệch ≤ 0,05 V. (Số trên hình chỉ là ví dụ.)', { a: 'middle', s: 12.5, w: 700 });
    return K.svg(960, 200, b, { title: 'Hiệu chỉnh điện áp' });
  };

  LR.diag.tfView = () => {
    let b = '';
    b += K.text(480, 26, 'TFmini nhìn ngang: chùm tia 3,6° — không được quét vào chân đáp', { a: 'middle', s: 15, w: 800 });
    b += K.line(20, 330, 940, 330, { stroke: 'var(--line2)', sw: 2 });
    b += K.rect(640, 150, 220, 18, { rx: 4, fill: '#2f3437' });
    b += K.path('M680 168L660 320M820 168L840 320', { stroke: '#333', sw: 6 }) + K.line(620, 322, 880, 322, { stroke: '#d0303a', sw: 9, lc: 'round' });
    b += K.rect(600, 128, 44, 22, { rx: 4, fill: '#111', stroke: 'var(--accent)', sw: 2 });
    b += K.poly([[600, 139], [60, 100], [60, 160]], { fill: 'color-mix(in srgb,var(--accent) 16%,transparent)', stroke: 'var(--accent)', sw: 1.2 });
    b += K.text(300, 92, 'tia ngẩng 2–3°, thoáng', { a: 'middle', s: 12.5, w: 800, c: 'var(--accent)' });
    b += K.text(740, 120, 'TFmini ở mép trước tấm trên', { a: 'middle', s: 12, w: 700 });
    b += K.text(480, 360, 'Ngồi ngang tầm ống kính nhìn dọc tia: thấy chân đáp / cánh / dây = đặt lại. Số đứng yên ở giá trị nhỏ = tia đang quét trúng drone.', { a: 'middle', s: 12, w: 700 });
    return K.svg(960, 380, b, { title: 'Tầm nhìn TFmini' });
  };

  LR.diag.antenna90 = () => {
    let b = '';
    b += K.text(400, 26, 'ANTEN iA6B: vuông góc 90°, đoạn đầu ~3 cm duỗi thẳng', { a: 'middle', s: 15, w: 800 });
    b += K.rect(330, 160, 90, 52, { rx: 6, fill: '#151515' }) + K.text(375, 192, 'iA6B', { a: 'middle', s: 13, w: 800, c: '#fff' });
    b += K.path('M330 175L150 175', { stroke: '#222', sw: 3 }) + K.line(150, 175, 90, 175, { stroke: '#ddd', sw: 4 }) + K.text(120, 160, '~3 cm', { a: 'middle', s: 11, w: 700 });
    b += K.path('M375 212L375 320', { stroke: '#222', sw: 3 }) + K.line(375, 320, 375, 380, { stroke: '#ddd', sw: 4 }) + K.text(392, 355, '~3 cm', { s: 11, w: 700 });
    b += K.path('M250 175A125 125 0 0 0 375 300', { stroke: 'var(--you)', sw: 1.8, dash: '4 3' }) + K.text(298, 250, '90°', { s: 14, w: 900, c: 'var(--you)' });
    b += K.line(560, 80, 560, 400, { stroke: W.red, sw: 6 }) + K.line(575, 80, 575, 400, { stroke: W.black, sw: 6 });
    b += K.path('M440 190L548 190', { stroke: 'var(--danger)', sw: 2, arrow: 'danger', arrow2: 'danger' }) + K.text(495, 182, '≥ 5 cm', { a: 'middle', s: 12.5, w: 800, c: 'var(--danger)' });
    b += K.text(620, 240, 'dây nguồn motor', { s: 12.5, w: 700 });
    b += K.text(400, 420, 'Luồn anten vào ống hút, dây rút vào chân đáp, chĩa chếch xuống. Không cuộn tròn, không sát carbon / kim loại.', { a: 'middle', s: 12, w: 700 });
    return K.svg(800, 440, b, { title: 'Anten receiver' });
  };

  LR.diag.cgCheck = () => {
    let b = '';
    b += K.text(450, 26, 'CÂN TRỌNG TÂM: đỡ hai điểm đối xứng qua tâm, nhấc 2–3 cm', { a: 'middle', s: 15, w: 800 });
    b += K.rect(160, 160, 580, 22, { rx: 6, fill: '#2f3437' });
    b += K.rect(380, 120, 140, 40, { rx: 6, fill: '#3a3528' });
    b += K.rect(330, 182, 240, 50, { rx: 8, fill: '#2d3a54' }) + K.text(450, 213, 'PIN', { a: 'middle', s: 14, w: 800, c: '#fff' });
    b += K.path('M240 182L240 250M660 182L660 250', { stroke: 'var(--you)', sw: 10, lc: 'round' });
    b += K.text(240, 275, 'ngón trỏ', { a: 'middle', s: 12, w: 700, c: 'var(--you)' }) + K.text(660, 275, 'ngón trỏ', { a: 'middle', s: 12, w: 700, c: 'var(--you)' });
    b += K.line(120, 171, 780, 171, { stroke: 'var(--ok)', sw: 1.5, dash: '6 4' }) + K.text(800, 175, 'ngang ± 5°', { s: 12.5, w: 800, c: 'var(--ok)' });
    b += K.path('M450 300L380 300M450 300L520 300', { stroke: 'var(--accent)', sw: 3, arrow: 'accent' });
    b += K.text(450, 330, 'lệch → dịch pin 5 mm mỗi lần, rồi đánh dấu vị trí', { a: 'middle', s: 12.5, w: 800, c: 'var(--accent)' });
    return K.svg(900, 350, b, { title: 'Cân trọng tâm' });
  };

  LR.diag.crossTighten = () => {
    let b = '';
    b += K.rect(120, 60, 240, 240, { rx: 16, fill: 'var(--surface2)', stroke: 'var(--line2)', sw: 2 });
    const p = [[150, 90, 1], [330, 270, 2], [330, 90, 3], [150, 270, 4]];
    p.forEach(([x, y, n]) => { b += K.circle(x, y, 16, { fill: 'var(--ink)' }) + K.text(x, y + 5, String(n), { a: 'middle', s: 14, w: 900, c: 'var(--surface)' }); });
    b += K.path('M164 104L316 256', { stroke: 'var(--accent)', sw: 2.5, arrow: 'accent' }) + K.path('M316 104L164 256', { stroke: 'var(--accent)', sw: 2.5, dash: '6 4', arrow: 'accent' });
    b += K.text(240, 30, 'Siết theo đường chéo: 1 → 2 → 3 → 4', { a: 'middle', s: 14, w: 800 });
    b += K.text(240, 330, 'Vòng 1 chớm chặt · vòng 2 siết đều', { a: 'middle', s: 12.5, w: 700 });
    return K.svg(480, 350, b, { title: 'Siết chéo' });
  };

  LR.diag.motorOhm = () => {
    let b = '';
    b += K.text(480, 26, 'BA PHÉP ĐO SAU MỖI MOTOR (không pin)', { a: 'middle', s: 15, w: 800 });
    const card = (x, t, how, ok, col) => K.rect(x, 50, 300, 190, { rx: 12, fill: 'var(--surface2)', stroke: 'var(--line2)' }) + K.text(x + 150, 82, t, { a: 'middle', s: 14, w: 800 }) + K.text(x + 150, 120, how, { a: 'middle', s: 12, c: 'var(--ink2)' }) + K.text(x + 150, 200, ok, { a: 'middle', s: 13, w: 800, c: col });
    b += card(10, '1 · Thông từng pha', 'đầu dây phía motor ↔\nđầu dây phía ESC (×3)', 'kêu, ~0 Ω', 'var(--ok)');
    b += card(330, '2 · Pha ↔ pha', 'thang Ω: 1-2, 2-3, 1-3\n(cuộn dây nối sao → có kêu)', '3 số BẰNG NHAU', 'var(--ok)');
    b += card(650, '3 · Pha ↔ vỏ / ốc cần', 'từng pha ↔ thân motor\nvà ↔ ốc bắt cần', 'KHÔNG kêu (OL)', 'var(--ok)');
    b += K.text(480, 270, 'Lệch điện trở = mối hàn xấu → cắt ra hàn lại. Pha chạm vỏ = ốc quá dài hoặc gen thủng.', { a: 'middle', s: 12.5, w: 700, c: 'var(--danger)' });
    return K.svg(960, 290, b, { title: 'Đo motor' });
  };

  LR.diag.accel6 = () => {
    let b = '';
    const pose = (i, name, sub, rot) => {
      const x = 20 + (i % 3) * 320;
      const y = 20 + Math.floor(i / 3) * 210;
      let s = K.rect(x, y, 300, 190, { rx: 12, fill: 'var(--surface2)', stroke: 'var(--line)' });
      s += K.circle(x + 26, y + 26, 15, { fill: 'var(--pc)' }) + K.text(x + 26, y + 31, String(i + 1), { a: 'middle', s: 13, w: 800, c: '#fff' });
      s += K.text(x + 150, y + 32, name, { a: 'middle', s: 14, w: 800 });
      s += K.line(x + 30, y + 160, x + 270, y + 160, { stroke: 'var(--line2)', sw: 3 });
      const sc = Math.abs(rot) === 90 ? 0.72 : 1;
      s += `<g transform="translate(${x + 150} ${y + 110}) rotate(${rot}) scale(${sc}) translate(${-x - 150} ${-y - 110})">${K.rect(x + 80, y + 104, 140, 14, { rx: 4, fill: '#2f3437' })}${K.rect(x + 128, y + 86, 44, 18, { rx: 3, fill: '#3a3528' })}${K.path(`M${x + 150} ${y + 96}L${x + 150} ${y + 72}`, { stroke: 'var(--accent)', sw: 2.5, arrow: 'accent' })}${K.path(`M${x + 95} ${y + 118}L${x + 90} ${y + 146}M${x + 205} ${y + 118}L${x + 210} ${y + 146}`, { stroke: '#333', sw: 4 })}</g>`;
      s += K.text(x + 150, y + 182, sub, { a: 'middle', s: 11.5, c: 'var(--ink2)' });
      return s;
    };
    b += pose(0, 'LEVEL — nằm ngang', 'đứng trên chân đáp', 0);
    b += pose(1, 'LEFT — nghiêng trái', 'cạnh trái chạm bàn', -90);
    b += pose(2, 'RIGHT — nghiêng phải', 'cạnh phải chạm bàn', 90);
    b += pose(3, 'NOSE DOWN — chúi mũi', 'mũi chạm bàn', -90);
    b += pose(4, 'NOSE UP — ngửa mũi', 'đuôi chạm bàn', 90);
    b += pose(5, 'BACK — lật ngửa', 'kê hộp cho phẳng', 180);
    b += K.text(490, 450, 'Mỗi tư thế: đặt xuống mặt chắc, BUÔNG TAY, rồi báo "xong". Ảnh nghiêng chỉ minh hoạ hướng xoay.', { a: 'middle', s: 12.5, w: 700 });
    return K.svg(980, 470, b, { title: '6 tư thế accel' });
  };

  LR.diag.compassCal = () => {
    let b = '';
    b += K.text(480, 26, 'LA BÀN NGOÀI TRỜI: xoay chậm đủ ba trục, mỗi trục 360°', { a: 'middle', s: 15, w: 800 });
    /* Drone nhìn ngang (mũi = mũi tên cam), xoay theo tư thế; vòng elip tím = quay quanh trục đứng. */
    const sil = (cx, cy, rot) => `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(0.8) translate(${-cx} ${-cy})">` +
      K.rect(cx - 70, cy - 7, 140, 14, { rx: 4, fill: '#2f3437' }) + K.rect(cx - 22, cy - 25, 44, 18, { rx: 3, fill: '#3a3528' }) +
      K.path(`M${cx - 55} ${cy + 7}L${cx - 60} ${cy + 35}M${cx + 55} ${cy + 7}L${cx + 60} ${cy + 35}`, { stroke: '#333', sw: 4 }) +
      K.path(`M${cx - 70} ${cy}L${cx - 98} ${cy}`, { stroke: 'var(--accent)', sw: 3, arrow: 'accent' }) + '</g>';
    const spin = (cx) => K.path(`M${cx - 89} ${193}A95 22 0 1 1 ${cx - 89} ${207}`, { stroke: 'var(--pc)', sw: 3.5, arrow: 'pc' });
    const cap = (cx, t) => K.text(cx, 290, t, { a: 'middle', s: 13, w: 800 });
    b += sil(160, 150, 0) + spin(160) + cap(160, 'cầm ngang, quay tròn');
    b += sil(480, 140, 90) + spin(480) + cap(480, 'dựng mũi lên, quay');
    b += K.icon('drone', 768, 112, 64) + spin(800) + cap(800, 'lật nghiêng (bụng quay ra), quay');
    b += K.rect(250, 320, 460, 22, { rx: 11, fill: 'var(--sunken)' }) + K.rect(250, 320, 380, 22, { rx: 11, fill: 'var(--pc)' }) + K.text(480, 336, 'tiến trình phải tăng đều tới 100 %', { a: 'middle', s: 11.5, w: 800, c: '#fff' });
    b += K.text(480, 372, 'Xa xe, cột điện, nắp cống, cốt thép ≥ 5 m. Laptop cách drone ≥ 3 m (nối qua Wi-Fi).', { a: 'middle', s: 12.5, w: 700 });
    return K.svg(960, 390, b, { title: 'Hiệu chỉnh la bàn' });
  };

  LR.diag.thrustTest = () => {
    let b = '';
    b += K.text(480, 26, 'ĐO LỰC ĐẨY: motor hướng XUỐNG, cả cụm trên cân', { a: 'middle', s: 15, w: 800 });
    b += K.rect(80, 300, 380, 30, { rx: 6, fill: 'var(--surface2)', stroke: 'var(--line2)' }) + K.text(270, 352, 'cân điện tử', { a: 'middle', s: 12.5, w: 700 });
    b += K.rect(160, 250, 220, 50, { rx: 6, fill: '#8a6b3d' }) + K.text(270, 280, 'bàn / khối kẹp', { a: 'middle', s: 11, w: 700, c: '#fff' });
    b += K.rect(120, 200, 380, 18, { rx: 5, fill: '#2f3437' });
    b += K.rect(470, 218, 30, 30, { rx: 4, fill: '#222' }) + K.line(400, 252, 570, 252, { stroke: '#555', sw: 4 });
    b += K.path('M485 260L485 296', { stroke: 'var(--accent)', sw: 3, arrow: 'accent' }) + K.text(500, 290, 'lực đẩy ép xuống cân', { s: 11.5, w: 700, c: 'var(--accent)' });
    b += K.rect(210, 160, 60, 60, { rx: 6, fill: 'none', stroke: 'var(--ink)', sw: 2 }) + K.text(240, 150, 'kẹp chữ C', { a: 'middle', s: 11.5, w: 700 });
    b += K.icon('glasses', 700, 120, 60, 'var(--danger)') + K.text(730, 200, 'kính bảo hộ', { a: 'middle', s: 12, w: 800, c: 'var(--danger)' });
    b += K.table(640, 230, [110, 150], [['Mức ga', 'Ghi số gam'], ['25 %', ''], ['50 %', ''], ['75 %', ''], ['100 % (≤ 3 s)', '~1332 theo hãng']], { head: true, rh: 24, s: 12 });
    b += K.text(480, 390, 'Đứng NGOÀI mặt phẳng quay của cánh, điều khiển từ laptop đặt xa, tay sẵn trên nút Stop.', { a: 'middle', s: 12.5, w: 800, c: 'var(--danger)' });
    return K.svg(960, 410, b, { title: 'Đo lực đẩy' });
  };

  /* Hình minh hoạ cho thẻ linh kiện chưa có ảnh thật (khung 400 × 300 = 4:3). */
  LR.diag.thumb = (a = {}) => {
    let b = '';
    if (a.k === 'usbttl') {
      b += K.rect(40, 128, 62, 44, { rx: 4, fill: '#c9cdd0', stroke: '#888' }) + K.rect(48, 138, 46, 24, { rx: 2, fill: '#eee' });
      b += K.rect(100, 100, 210, 100, { rx: 8, fill: '#1b4d8c', stroke: '#0d2a4d' });
      b += K.rect(170, 128, 44, 44, { rx: 3, fill: '#111' }) + K.text(192, 155, 'CP2102', { a: 'middle', s: 9, w: 800, c: '#ddd' });
      ['5V', 'GND', 'RXD', 'TXD', '3V3'].forEach((p, i) => {
        const y = 110 + i * 19;
        b += K.rect(300, y, 34, 7, { fill: '#d4af37' }) + K.text(294, y + 7, p, { a: 'end', s: 10, w: 800, c: '#fff', mono: true });
      });
      b += K.text(200, 240, 'USB → UART 3,3 V', { a: 'middle', s: 15, w: 800 });
    } else if (a.k === 'ubec') {
      b += K.path('M40 132L130 132', { stroke: W.red, sw: 6 }) + K.path('M40 160L130 160', { stroke: W.black, sw: 6 });
      b += K.rect(130, 110, 140, 72, { rx: 10, fill: '#253041' }) + K.text(200, 142, 'UBEC', { a: 'middle', s: 18, w: 800, c: '#fff' }) + K.text(200, 164, '5V · 3A', { a: 'middle', s: 13, w: 700, c: '#cfd8ea' });
      b += K.path('M270 136C300 136 310 140 330 140', { stroke: W.red, sw: 3.5 }) + K.path('M270 146C300 146 310 150 330 150', { stroke: W.black, sw: 3.5 });
      b += K.rect(330, 132, 30, 26, { rx: 3, fill: '#111' });
      b += K.text(84, 120, 'vào 2–6S', { a: 'middle', s: 12, w: 700 }) + K.text(345, 124, 'ra 5V', { a: 'middle', s: 12, w: 700 });
      b += K.text(200, 240, 'nguồn riêng cho ESP32 + camera', { a: 'middle', s: 14, w: 800 });
    } else if (a.k === 'bat') {
      b += K.rect(70, 80, 230, 130, { rx: 14, fill: '#2d3a54' });
      b += K.text(185, 130, 'Ovonic 4S', { a: 'middle', s: 20, w: 800, c: '#fff' }) + K.text(185, 156, '5300 mAh · 14,8 V · 110C', { a: 'middle', s: 12.5, w: 700, c: '#cfd8ea' });
      b += K.path('M300 120C330 120 330 110 350 110', { stroke: W.red, sw: 7 }) + K.path('M300 140C330 140 330 130 350 130', { stroke: W.black, sw: 7 });
      b += K.rect(350, 98, 34, 46, { rx: 5, fill: '#f3c623', stroke: '#7a5b00' }) + K.text(367, 166, 'XT60', { a: 'middle', s: 11, w: 800 });
      b += K.path('M300 190C330 190 330 230 300 250', { stroke: '#ddd', sw: 6 }) + K.rect(268, 244, 44, 16, { rx: 3, fill: '#eee', stroke: '#999' }) + K.text(210, 256, 'dây cân bằng 5 chân', { a: 'end', s: 11.5, w: 700 });
    } else if (a.k === 'charger') {
      b += K.rect(70, 60, 260, 190, { rx: 14, fill: '#1f1f1f' });
      b += K.rect(95, 82, 210, 56, { rx: 6, fill: '#26425a' }) + K.text(200, 106, 'LiPo BALANCE', { a: 'middle', s: 14, w: 800, c: '#9fe1ff', mono: true }) + K.text(200, 126, '3.0A 14.8V(4S)', { a: 'middle', s: 12, w: 700, c: '#9fe1ff', mono: true });
      ['TYPE', 'DEC', 'INC', 'START'].forEach((t, i) => { b += K.rect(95 + i * 54, 158, 46, 26, { rx: 5, fill: '#444' }) + K.text(118 + i * 54, 175, t, { a: 'middle', s: 9, w: 800, c: '#fff' }); });
      b += K.rect(100, 204, 44, 28, { rx: 4, fill: '#f3c623' }) + K.rect(220, 210, 86, 18, { rx: 3, fill: '#eee' });
      b += K.text(200, 282, 'iMAX B6AC V2 · 50 W', { a: 'middle', s: 14, w: 800 });
    } else {
      [['zip', 'dây rút'], ['shrink', 'gen co'], ['tape', 'VHB / velcro'], ['hex', 'lục giác'], ['dupont', 'Dupont'], ['solder', 'thiếc']].forEach(([ic, t], i) => {
        const x = 40 + (i % 3) * 120;
        const y = 50 + Math.floor(i / 3) * 120;
        b += K.icon(ic, x + 22, y, 56, 'var(--ink2)') + K.text(x + 50, y + 82, t, { a: 'middle', s: 12.5, w: 700 });
      });
    }
    return K.svg(400, 300, b, { title: 'Minh hoạ linh kiện' });
  };

  LR.diag.walkaround = () => K.iconGrid([
    ['noprop', '4 cánh: đúng chiều, không nứt'], ['drone', '4 motor quay trơn'], ['hex', 'Không ốc nào lỏng'], ['zip', 'Không dây lủng lẳng'],
    ['lipo', 'Pin: velcro + dây đai'], ['tape', 'XT60 chắc, xa cánh'], ['field', 'Cột GPS thẳng'], ['glasses', 'Ống kính TFmini sạch'],
    ['wifi', 'Anten 90°, không kẹp'], ['rc', 'Bật tay phát TRƯỚC khi cắm pin'],
  ], 5, 196, 120);
})();
