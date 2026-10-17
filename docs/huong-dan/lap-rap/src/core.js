'use strict';
/* Không gian tên chung của trang. Dữ liệu ở LR.data, hàm vẽ ở LR.diag. */
window.LR = {
  data: {},
  diag: {},
  img: window.LR_IMG || {},
  meta: window.LR_META || {},
};

LR.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Định dạng chữ trong dữ liệu: **đậm**, `mã`, !!nguy hiểm!!, ~~mờ~~, {{step:15.2}} thành liên kết. */
LR.fmt = (s) => LR.esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/`(.+?)`/g, '<code>$1</code>')
  .replace(/!!(.+?)!!/g, '<b style="color:var(--danger)">$1</b>')
  .replace(/~~(.+?)~~/g, '<span class="muted">$1</span>')
  .replace(/\{\{step:([\w.]+)\}\}/g, '<a href="#buoc/$1" class="steplink">bước $1</a>');

LR.store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('lr-s500:' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      /* bộ nhớ trình duyệt bị chặn hoặc dữ liệu hỏng: dùng giá trị mặc định, trang vẫn chạy */
      console.warn('LR.store.get', key, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('lr-s500:' + key, JSON.stringify(value));
    } catch (e) {
      /* chế độ riêng tư hoặc bị chặn: trang vẫn chạy, chỉ không nhớ tiến độ */
    }
  },
};

LR.$ = (sel, root) => (root || document).querySelector(sel);
LR.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/* Ảnh nhúng: LR.pic('id', 'chú thích') trả <figure> bấm để phóng to. */
LR.pic = (id, cap, opt) => {
  const src = LR.img[id];
  if (!src) return `<div class="callout c-warn">Thiếu ảnh <code>${LR.esc(id)}</code></div>`;
  const o = opt || {};
  const style = o.style ? ' style="' + o.style + '"' : '';
  const caption = cap ? '<figcaption>' + LR.fmt(cap) + '</figcaption>' : '';
  return `<figure class="fig"${style}><img src="${src}" alt="${LR.esc(cap || id)}" data-lb="${LR.esc(cap || '')}" loading="lazy">${caption}</figure>`;
};

/* Sơ đồ SVG: LR.svgfig('ten', 'chú thích', thamSo) gọi LR.diag.ten(thamSo). */
LR.svgfig = (name, cap, arg) => {
  const fn = LR.diag[name];
  if (!fn) return `<div class="callout c-warn">Thiếu sơ đồ <code>${LR.esc(name)}</code></div>`;
  const svg = fn(arg || {});
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const wide = vb && Number(vb[1]) >= 1.45 * Number(vb[2]);
  /* Không phóng sơ đồ quá 1,2 lần cỡ vẽ — chữ to quá khó đọc lướt. */
  const sized = vb ? svg.replace('<svg ', `<svg style="max-width:${Math.round(Number(vb[1]) * 1.2)}px;margin:0 auto" `) : svg;
  const caption = cap ? '<div class="cap">' + LR.fmt(cap) + '</div>' : '';
  return `<div class="svgbox${wide ? ' wide' : ''}" data-svg="${name}">${sized}${caption}</div>`;
};

LR.WHO = {
  ban: { label: 'Bạn làm tay', cls: 'b-you', color: 'var(--you)' },
  claude: { label: 'Claude làm trên máy', cls: 'b-pc', color: 'var(--pc)' },
  ca2: { label: 'Bạn + Claude', cls: 'b-both', color: 'var(--both)' },
};

LR.TAG = {
  han: { label: 'Hàn', cls: 'b-acc' },
  do: { label: 'Đo đồng hồ', cls: 'b-warn' },
  pin: { label: 'Có pin 4S', cls: 'b-danger' },
  motor: { label: 'Motor quay — bạn bấm', cls: 'b-danger' },
  canh: { label: 'Có cánh', cls: 'b-danger' },
  pc: { label: 'Cần máy tính', cls: 'b-pc' },
  web: { label: 'Mở web GCS', cls: 'b-pc' },
  ngoai: { label: 'Ngoài trời', cls: 'b-ok' },
  tay: { label: 'Không cần máy', cls: 'b-gray' },
};
