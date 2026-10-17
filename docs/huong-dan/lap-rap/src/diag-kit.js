/* Bộ vẽ SVG dùng chung. Màu lấy từ biến CSS nên tự đổi theo sáng / tối. */
(function () {
  const K = (LR.k = {});
  const st = (o) => {
    const s = [];
    if (o.fill !== undefined) s.push(`fill:${o.fill}`);
    if (o.stroke !== undefined) s.push(`stroke:${o.stroke}`);
    if (o.sw !== undefined) s.push(`stroke-width:${o.sw}`);
    if (o.dash) s.push(`stroke-dasharray:${o.dash}`);
    if (o.op !== undefined) s.push(`opacity:${o.op}`);
    if (o.lc) s.push(`stroke-linecap:${o.lc}`);
    if (o.lj) s.push(`stroke-linejoin:${o.lj}`);
    if (o.style) s.push(o.style);
    return s.length ? ` style="${s.join(';')}"` : '';
  };
  const at = (o) => (o.attr ? ' ' + o.attr : '') + (o.cls ? ` class="${o.cls}"` : '');
  K.st = st;

  /* Mỗi SVG có bộ marker id riêng: trình duyệt lấy id trùng ĐẦU TIÊN trong trang, và marker nằm trong
     màn hình đang ẩn (display:none) thì không vẽ — mũi tên ở màn hình khác sẽ mất. */
  let svgN = 0;
  K.svg = (w, h, body, o = {}) => {
    svgN += 1;
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="dg${o.cls ? ' ' + o.cls : ''}"${o.title ? ` aria-label="${LR.esc(o.title)}" role="img"` : ''}>` +
      `<defs>${K.defs(svgN)}${o.defs || ''}</defs>${body.replace(/url\(#ar-/g, `url(#ar${svgN}-`)}</svg>`;
  };

  K.defs = (n) =>
    ['ink', 'danger', 'ok', 'pc', 'you', 'accent', 'muted', 'warn'].map((c) =>
      `<marker id="ar${n}-${c}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--${c})"/></marker>`
    ).join('');

  K.rect = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}"${st({ fill: 'none', ...o })}${at(o)}/>`;
  K.circle = (cx, cy, r, o = {}) => `<circle cx="${cx}" cy="${cy}" r="${r}"${st({ fill: 'none', ...o })}${at(o)}/>`;
  K.ellipse = (cx, cy, rx, ry, o = {}) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${st({ fill: 'none', ...o })}${at(o)}/>`;
  K.line = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${st({ stroke: 'var(--ink)', sw: 1.5, ...o })}${o.arrow ? ` marker-end="url(#ar-${o.arrow})"` : ''}${o.arrow2 ? ` marker-start="url(#ar-${o.arrow2})"` : ''}${at(o)}/>`;
  K.path = (d, o = {}) => `<path d="${d}"${st({ fill: 'none', stroke: 'var(--ink)', sw: 1.5, ...o })}${o.arrow ? ` marker-end="url(#ar-${o.arrow})"` : ''}${o.arrow2 ? ` marker-start="url(#ar-${o.arrow2})"` : ''}${at(o)}/>`;
  K.poly = (pts, o = {}) => `<polygon points="${pts.map((p) => p.join(',')).join(' ')}"${st({ fill: 'none', ...o })}${at(o)}/>`;

  /* Chữ: o.a = start|middle|end, o.s = cỡ, o.w = đậm, o.c = màu, o.it = nghiêng, o.rot = xoay. */
  K.text = (x, y, s, o = {}) => {
    const lines = String(s).split('\n');
    const size = o.s || 13;
    const tr = o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : '';
    const body = lines.map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * 1.22}">${LR.esc(ln)}</tspan>`).join('');
    return `<text x="${x}" y="${y}" text-anchor="${o.a || 'start'}" style="font-size:${size}px;font-weight:${o.w || 500};fill:${o.c || 'var(--ink)'}${o.it ? ';font-style:italic' : ''}${o.mono ? ';font-family:var(--mono)' : ''}"${tr}${at(o)}>${body}</text>`;
  };

  /* Ước lượng bề rộng chữ (px): chữ hoa và số rộng hơn chữ thường, dấu cách hẹp. */
  K.tw = (s, size) => [...String(s)].reduce((w, ch) => w + (/\s/.test(ch) ? 0.3 : /[.,:;·'!|()]/.test(ch) ? 0.32 : /[—→←↔]/.test(ch) ? 0.95 : ch !== ch.toLowerCase() || /\d/.test(ch) ? 0.68 : 0.56), 0) * size;

  /* Ngắt câu thành các dòng ≤ n ký tự (theo từ). */
  K.wrap = (s, n) => {
    const lines = [''];
    String(s).split(' ').forEach((w) => {
      const cur = lines[lines.length - 1];
      if (cur && (cur + ' ' + w).length > n) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
    });
    return lines;
  };

  /* Nhãn dạng viên thuốc. */
  K.pill = (x, y, s, o = {}) => {
    const size = o.s || 12.5;
    const w = o.w || Math.max(28, K.tw(s, size) + 18);
    const h = size + 10;
    const x0 = o.a === 'middle' ? x - w / 2 : o.a === 'end' ? x - w : x;
    return `<g${at(o)}>${K.rect(x0, y - h / 2, w, h, { rx: h / 2, fill: o.bg || 'var(--surface2)', stroke: o.bd || 'var(--line2)', sw: 1 })}${K.text(x0 + w / 2, y + size * 0.36, s, { a: 'middle', s: size, w: o.fw || 600, c: o.c || 'var(--ink)' })}</g>`;
  };

  /* Ô chú thích có tiêu đề + dòng phụ. */
  K.box = (x, y, w, h, title, sub, o = {}) =>
    `<g${at(o)}>${K.rect(x, y, w, h, { rx: o.rx || 10, fill: o.bg || 'var(--surface)', stroke: o.bd || 'var(--line2)', sw: o.bsw || 1.4, dash: o.dash })}` +
    (title ? K.text(x + w / 2, y + (sub ? h / 2 - 3 : h / 2 + 5), title, { a: 'middle', s: o.ts || 14, w: 700, c: o.tc || 'var(--ink)' }) : '') +
    (sub ? K.text(x + w / 2, y + h / 2 + 15, sub, { a: 'middle', s: o.ss || 11.5, w: 500, c: o.sc || 'var(--muted)' }) : '') + '</g>';

  /* Bo mạch tối. */
  K.board = (x, y, w, h, o = {}) => K.rect(x, y, w, h, { rx: o.rx || 8, fill: o.fill || 'var(--pcb)', stroke: o.stroke || '#000', sw: 1, ...o });

  /* Pad vàng có nhãn. o.on = tô sáng; o.bad = pad nguy hiểm. */
  K.pad = (x, y, w, h, label, o = {}) => {
    const fill = o.bad ? 'var(--danger)' : o.on ? 'var(--hl)' : 'var(--pad)';
    const lab = label ? K.text(x + w / 2, o.lblY != null ? o.lblY : y + h + 11, label, { a: 'middle', s: o.ls || 9.5, w: 700, c: o.lc || 'var(--silk)', mono: true }) : '';
    return `<g${at(o)}>${K.rect(x, y, w, h, { rx: 2, fill, stroke: o.on || o.bad ? '#fff' : 'none', sw: o.on || o.bad ? 1.2 : 0 })}${lab}</g>`;
  };

  /* Dây có quầng sáng khi tô (class halo). col = màu, d = path. */
  K.wire = (d, col, o = {}) =>
    `<path class="halo" d="${d}"${st({ fill: 'none', stroke: 'var(--hl)', sw: (o.sw || 3) + 7, lc: 'round', lj: 'round' })}/>` +
    (o.outline ? `<path d="${d}"${st({ fill: 'none', stroke: 'var(--ink)', sw: (o.sw || 3) + 1.6, lc: 'round', lj: 'round', op: 0.55 })}/>` : '') +
    `<path class="wire" d="${d}"${st({ fill: 'none', stroke: col, sw: o.sw || 3, lc: 'round', lj: 'round', dash: o.dash })}/>`;

  K.W = {
    red: 'var(--w-red)', black: 'var(--w-black)', yellow: 'var(--w-yellow)', green: 'var(--w-green)', blue: 'var(--w-blue)',
    white: 'var(--w-white)', orange: 'var(--w-orange)', gray: 'var(--w-gray)', purple: 'var(--w-purple)',
  };

  /* Mũi tên "MŨI" chỉ hướng trước. */
  K.nose = (x, y, o = {}) =>
    `<g>${K.path(`M${x} ${y + 26}L${x} ${y}`, { stroke: 'var(--accent)', sw: 3, arrow: 'accent' })}${K.text(x, y + 42, o.label || 'MŨI', { a: 'middle', s: 12, w: 800, c: 'var(--accent)' })}</g>`;

  /* Mũi tên quay CW / CCW quanh tâm (nhìn từ trên). */
  K.spin = (cx, cy, r, cw, o = {}) => {
    const col = cw ? 'var(--ok)' : 'var(--you)';
    const a0 = cw ? -150 : -30;
    const a1 = cw ? 60 : -240;
    const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sweep = cw ? 1 : 0;
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}"${st({ fill: 'none', stroke: col, sw: o.sw || 3 })} marker-end="url(#ar-${cw ? 'ok' : 'you'})"/>`;
  };

  /* Ký hiệu cấm (vòng tròn gạch chéo). */
  K.no = (cx, cy, r) => K.circle(cx, cy, r, { stroke: 'var(--danger)', sw: 3 }) + K.line(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7, { stroke: 'var(--danger)', sw: 3 });

  K.check = (x, y, s = 12, col = 'var(--ok)') => K.path(`M${x - s * 0.5} ${y}L${x - s * 0.1} ${y + s * 0.4}L${x + s * 0.6} ${y - s * 0.45}`, { stroke: col, sw: 3, lc: 'round', lj: 'round' });
  K.cross = (x, y, s = 10, col = 'var(--danger)') => K.path(`M${x - s / 2} ${y - s / 2}L${x + s / 2} ${y + s / 2}M${x + s / 2} ${y - s / 2}L${x - s / 2} ${y + s / 2}`, { stroke: col, sw: 3, lc: 'round' });

  /* Biểu tượng nét đơn, khung 48×48, đặt tại (x, y) cỡ s. */
  const IC = {
    iron: 'M6 42L20 28M20 28l8-8 6 6-8 8zM34 14l8-8M28 20l6 6M12 36l-4 4',
    meter: 'M12 4h24a4 4 0 014 4v32a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4zM14 10h20v10H14zM24 34a5 5 0 100-0.1M17 27l14 0',
    wire: 'M4 30c8 0 8-12 16-12s8 12 16 12 8-12 8-12',
    shrink: 'M6 18h36v12H6zM12 18v12M36 18v12M2 24h4M42 24h4',
    zip: 'M8 8c18 0 32 14 32 32M8 8l6 2-2 6M40 40l-4 0',
    hex: 'M10 10l16 16v16h6V26l6-6-8-8-6 6z',
    tape: 'M24 8a16 16 0 100 32 16 16 0 100-32zM24 18a6 6 0 100 12 6 6 0 100-12zM40 24h6',
    glasses: 'M4 20h40M8 20c0 8 4 12 10 12s8-6 8-12M22 20c0 8 4 12 10 12s8-6 8-12',
    dryer: 'M8 14h22a8 8 0 010 16H8zM14 30l-4 14h8l4-14M36 18h8M36 26h8',
    clamp: 'M10 6h20v8H18v20h12v8H10zM30 10h8v28h-8',
    scale: 'M6 36h36v6H6zM10 36l6-20h16l6 20M24 16v-8M18 8h12',
    bag: 'M10 16h28v26H10zM16 16v-6h16v6M18 28h12',
    fire: 'M18 44V22a6 6 0 0112 0v22zM24 16V8l8-2M30 26h6',
    fan: 'M24 24m-4 0a4 4 0 108 0 4 4 0 10-8 0M24 20c-2-10 8-14 10-6M28 24c10-2 14 8 6 10M24 28c2 10-8 14-10 6M20 24c-10 2-14-8-6-10',
    noprop: 'M6 24c6-6 14-6 18 0s12 6 18 0M24 24m-4 0a4 4 0 108 0 4 4 0 10-8 0',
    rc: 'M8 14h32a4 4 0 014 4v18a4 4 0 01-4 4H8a4 4 0 01-4-4V18a4 4 0 014-4zM16 27m-5 0a5 5 0 1010 0 5 5 0 10-10 0M32 27m-5 0a5 5 0 1010 0 5 5 0 10-10 0M12 14V6M36 14V6',
    prearm: 'M24 4l16 6v12c0 10-7 17-16 22C15 39 8 32 8 22V10zM17 24l5 5 9-10',
    lipo: 'M6 14h32v20H6zM38 20h4v8h-4M12 20v8M18 20v8M24 20v8M30 20v8',
    hand: 'M16 44V20a3 3 0 016 0v10V10a3 3 0 016 0v20V14a3 3 0 016 0v20c0 6-4 10-10 10h-4c-5 0-8-3-10-7l-4-8a3 3 0 015-3l1 2',
    wifi: 'M6 18c10-10 26-10 36 0M12 25c7-6 17-6 24 0M18 32c4-3 8-3 12 0M24 39m-2 0a2 2 0 104 0 2 2 0 10-4 0',
    field: 'M4 40h40M12 40V24l-6 0 6-10 6 10h-6M34 40V18l8 4-8 4',
    drone: 'M12 12m-6 0a6 6 0 1012 0 6 6 0 10-12 0M36 12m-6 0a6 6 0 1012 0 6 6 0 10-12 0M12 36m-6 0a6 6 0 1012 0 6 6 0 10-12 0M36 36m-6 0a6 6 0 1012 0 6 6 0 10-12 0M16 16l16 16M32 16L16 32M20 20h8v8h-8z',
    laptop: 'M8 10h32v22H8zM4 36h40l-2 4H6z',
    flux: 'M16 6h16v8H16zM12 14h24v28H12zM18 24h12',
    solder: 'M24 24m-14 0a14 14 0 1028 0 14 14 0 10-28 0M24 24m-5 0a5 5 0 1010 0 5 5 0 10-10 0M38 24h8',
    strip: 'M6 10l16 16M42 10L26 26M22 26l2 18M26 26l-2 18M18 6l6 6 6-6',
    third: 'M8 42h32M24 42V26M24 26L12 14M24 26l12-12M8 10l6 6M40 10l-6 6',
    dupont: 'M10 8h10v14H10zM14 22v18M30 8h10v14H30zM34 22v18M14 40h20',
  };
  K.icon = (name, x, y, s = 40, col = 'var(--ink)') =>
    `<g transform="translate(${x},${y}) scale(${s / 48})"><path d="${IC[name] || IC.drone}" style="fill:none;stroke:${col};stroke-width:${(2.6 * 48) / s};stroke-linecap:round;stroke-linejoin:round"/></g>`;

  /* Lưới biểu tượng + nhãn. items: [[icon, nhãn, màu?]] */
  K.iconGrid = (items, cols, cw, ch) => {
    const rows = Math.ceil(items.length / cols);
    let b = '';
    items.forEach(([ic, lab, col], i) => {
      const cx = (i % cols) * cw + cw / 2;
      const cy = Math.floor(i / cols) * ch;
      b += K.rect(cx - cw / 2 + 6, cy + 6, cw - 12, ch - 12, { rx: 12, fill: 'var(--surface2)', stroke: 'var(--line)' });
      b += K.icon(ic, cx - 22, cy + 16, 44, col || 'var(--ink)');
      b += K.text(cx, cy + ch - 28, lab, { a: 'middle', s: 12.5, w: 600 });
    });
    return K.svg(cols * cw, rows * ch, b);
  };

  /* Bảng nhỏ trong SVG. rows: [[a,b,...]] */
  K.table = (x, y, colW, rows, o = {}) => {
    const rh = o.rh || 24;
    let b = '';
    rows.forEach((r, i) => {
      if (i === 0 && o.head) b += K.rect(x, y, colW.reduce((a, c) => a + c, 0), rh, { fill: 'var(--sunken)' });
      let cx = x;
      r.forEach((cell, j) => {
        b += K.text(cx + 8, y + i * rh + rh * 0.66, cell, { s: o.s || 12, w: i === 0 && o.head ? 700 : 500, c: (o.colors && o.colors[i] && o.colors[i][j]) || 'var(--ink)' });
        cx += colW[j];
      });
      b += K.line(x, y + (i + 1) * rh, x + colW.reduce((a, c) => a + c, 0), y + (i + 1) * rh, { stroke: 'var(--line)', sw: 1 });
    });
    return b;
  };
})();
