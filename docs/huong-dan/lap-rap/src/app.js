/* Giao diện: điều hướng, các trang, theo dõi bước, sơ đồ tương tác, phóng ảnh, tìm kiếm, in. */
(function () {
  const D = LR.data;
  const esc = LR.esc;
  const fmt = LR.fmt;
  const $ = LR.$;
  const $$ = LR.$$;

  const VIEWS = [
    { id: 'tongquan', label: 'Bắt đầu', ic: 'home', grp: 'Tổng quan' },
    { id: 'buoc', label: 'Từng bước', ic: 'check', grp: 'Làm' },
    { id: 'mohinh', label: 'Mô hình 3D', ic: 'cube', grp: 'Làm' },
    { id: 'daydien', label: 'Sơ đồ đấu dây', ic: 'wire', grp: 'Sơ đồ' },
    { id: 'nguon', label: 'Sơ đồ nguồn', ic: 'bolt', grp: 'Sơ đồ' },
    { id: 'khung', label: 'Bố trí khung', ic: 'frame', grp: 'Sơ đồ' },
    { id: 'bo', label: 'Chân FC / ESC / camera', ic: 'chip', grp: 'Sơ đồ' },
    { id: 'linhkien', label: 'Linh kiện', ic: 'box', grp: 'Đồ dùng' },
    { id: 'deluxe', label: 'Hộp Deluxe', ic: 'gift', grp: 'Đồ dùng' },
    { id: 'day', label: 'Dây & giắc', ic: 'plug', grp: 'Đồ dùng' },
    { id: 'dungcu', label: 'Dụng cụ', ic: 'tool', grp: 'Đồ dùng' },
    { id: 'maytinh', label: 'Máy tính (Claude làm)', ic: 'laptop', grp: 'Máy tính' },
    { id: 'antoan', label: 'An toàn', ic: 'shield', grp: 'Tra cứu' },
    { id: 'tracuu', label: 'Tra cứu nhanh', ic: 'list', grp: 'Tra cứu' },
  ];
  const IC = {
    home: 'M3 11l9-8 9 8v10H3zM9 21v-6h6v6', check: 'M4 12l5 5L20 6', cube: 'M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12v10M12 12L3 7',
    wire: 'M4 6h5c4 0 4 12 8 12h3M4 18h3', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', frame: 'M5 5m-2 0a2 2 0 104 0 2 2 0 10-4 0M19 5m-2 0a2 2 0 104 0 2 2 0 10-4 0M5 19m-2 0a2 2 0 104 0 2 2 0 10-4 0M19 19m-2 0a2 2 0 104 0 2 2 0 10-4 0M7 7l10 10M17 7L7 17',
    chip: 'M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4', box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    gift: 'M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9C9 9 7 4 10 4c2 0 2 5 2 5s0-5 2-5c3 0 1 5-2 5', plug: 'M9 2v6M15 2v6M7 8h10v4a5 5 0 01-10 0zM12 17v5',
    tool: 'M14 6a4 4 0 005 5l-9 9-3-3 9-9a4 4 0 01-2-2z', laptop: 'M4 5h16v11H4zM2 19h20', shield: 'M12 2l8 3v7c0 5-4 8-8 10-4-2-8-5-8-10V5z', list: 'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1',
  };
  const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${IC[n] || IC.list}"/></svg>`;

  /* ---------------- trạng thái ---------------- */
  const STEPS = D.steps;
  const byId = Object.fromEntries(STEPS.map((s) => [s.id, s]));
  const state = {
    done: new Set(LR.store.get('done', [])),
    cur: LR.store.get('cur', STEPS[0].id),
    filter: 'all',
    rendered: {},
    pick: null,
    phFilter: 'all',
  };
  if (!byId[state.cur]) state.cur = STEPS[0].id;
  const nextUndone = () => (STEPS.find((s) => !state.done.has(s.id)) || STEPS[STEPS.length - 1]).id;
  const legSteps = (leg) => STEPS.filter((s) => s.leg === leg);
  const legPct = (leg) => {
    const l = legSteps(leg);
    return l.length ? Math.round((100 * l.filter((s) => state.done.has(s.id)).length) / l.length) : 0;
  };

  function saveDone() {
    LR.store.set('done', [...state.done]);
    updateProgress();
  }
  function updateProgress() {
    const n = state.done.size;
    $('#progTxt').textContent = `${n}/${STEPS.length} bước`;
    $('#progBar').style.width = `${(100 * n) / STEPS.length}%`;
  }

  /* ---------------- tiện ích hiển thị ---------------- */
  const whoBadge = (w) => `<span class="badge ${LR.WHO[w].cls}">${LR.WHO[w].label}</span>`;
  const tagBadges = (tags) => (tags || []).map((t) => (LR.TAG[t] ? `<span class="badge ${LR.TAG[t].cls}">${LR.TAG[t].label}</span>` : '')).join(' ');
  const fig = (f) => (f.d ? LR.svgfig(f.d, f.cap, f.arg) : LR.pic(f.img, f.cap));
  const legName = (id) => (D.route.find((r) => r.id === id) || {}).name || id;
  const stepLink = (id) => `<a href="#buoc/${id}" class="steplink">${id}</a>`;

  /* ================= CÁC TRANG ================= */
  const R = {};

  R.tongquan = () => {
    const st = D.status;
    const nx = nextUndone();
    const nBan = STEPS.filter((s) => s.who === 'ban').length;
    const nPc = STEPS.filter((s) => s.who !== 'ban').length;
    const route = D.route.map((r) => {
      const cur = byId[nx] && byId[nx].leg === r.id;
      return `<div class="leg${cur ? ' cur' : ''}" data-go="#buoc/${legSteps(r.id)[0].id}">
        <div class="no">${r.id}</div><h4>${esc(r.name)}</h4><p>Phase ${r.ph} · ${r.time}</p><p>${esc(r.where)}</p>
        <p class="muted" style="margin-top:4px">${esc(r.sum)}</p><div class="lg-bar"><i style="width:${legPct(r.id)}%"></i></div></div>`;
    }).join('');
    return `
    <div class="vhead"><h2>Bắt đầu từ đâu</h2><p>Trạng thái tính đến <b>${st.asOf}</b>. Toàn bộ hướng dẫn đi theo plan của dự án (Phase 13 → 19) và danh sách linh kiện chính thức trong <code>docs/phan-cung-thuc-te.md</code>.</p></div>
    <div class="hero">
      <div class="card">
        <div class="where"><div class="pin">${st.here.phase}</div><div><b>${esc(st.here.title)}</b><div class="small">${esc(st.here.text)}</div></div></div>
        <div class="sp"></div>
        <div class="grid g3">
          <div class="stat"><b>${STEPS.length}</b><span>bước từ đây tới lúc sẵn sàng bay</span></div>
          <div class="stat"><b style="color:var(--you)">${nBan}</b><span>bước bạn làm tay</span></div>
          <div class="stat"><b style="color:var(--pc)">${nPc}</b><span>bước có phần Claude làm trên máy</span></div>
        </div>
        <div class="sp"></div>
        <div class="row"><a class="btn pri" href="#buoc/${nx}">Làm tiếp: bước ${nx} — ${esc(byId[nx].t)}</a><a class="btn" href="#mohinh">Mô hình 3D</a><a class="btn" href="#daydien">Sơ đồ đấu dây</a></div>
      </div>
      <div class="card">
        <h3>Đọc hướng dẫn này thế nào</h3>
        <ul class="tight">
          <li>Mục <b>Từng bước</b> là nơi làm việc chính: mỗi bước có hình, việc tay, việc Claude làm, tiêu chí đạt. Tick xong là lưu trên trình duyệt này.</li>
          <li>Màu nhãn: ${whoBadge('ban')} ${whoBadge('claude')} ${whoBadge('ca2')}</li>
          <li>Nhãn đỏ ${tagBadges(['pin', 'motor'])} = bước nguy hiểm — đọc ô cảnh báo trước.</li>
          <li>Mọi hình đều bấm vào để <b>phóng to, kéo, cuộn</b>.</li>
          <li>Cần chạy web? Xem <a href="#maytinh">Máy tính</a>: <code>chay-tat-ca.bat</code> chỉ dành cho drone ảo.</li>
        </ul>
      </div>
    </div>
    <div class="sp"></div>
    ${LR.svgfig('timeline', 'Tiến độ 25 phase luồng chính. Phase 15–24 cần phần cứng.')}
    <div class="sp"></div>
    <h3>Lộ trình lắp ráp — 7 chặng</h3>
    <div class="route">${route}</div>
    <div class="sp"></div>
    <div class="grid g2">
      <div class="card"><h3>Đã xong (đã kiểm trên máy / phần cứng)</h3>
        <table class="tbl"><tbody>${st.done.map((x) => `<tr><td class="nowrap"><b>${x.d}</b></td><td class="nowrap muted">P${x.p}</td><td>${fmt(x.t)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>Còn lại trước khi bay</h3>
        <table class="tbl"><tbody>${st.todo.map((x) => `<tr><td class="nowrap"><b>P${x.p}</b></td><td>${fmt(x.t)}</td></tr>`).join('')}</tbody></table>
        <div class="sp"></div>${st.risks.map((r) => `<div class="callout c-${r.lvl === 'danger' ? 'danger' : 'warn'}">${fmt(r.t)}</div>`).join('')}</div>
    </div>
    <div class="sp"></div>
    <div class="card"><h3>Những chỗ tài liệu cũ đã sai hoặc đã đổi — hướng dẫn này đi theo cột "Đúng hiện tại"</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Chủ đề</th><th>Cũ</th><th>Đúng hiện tại</th><th>Nguồn</th></tr></thead><tbody>
      ${st.changed.map((c) => `<tr><td><b>${esc(c[0])}</b></td><td class="muted">${fmt(c[1])}</td><td>${fmt(c[2])}</td><td class="small nowrap">${esc(c[3])}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  };

  /* ---------- Từng bước ---------- */
  const FILTERS = [
    ['all', 'Tất cả'], ['todo', 'Chưa xong'], ['ban', 'Bạn làm tay'], ['pcw', 'Claude làm trên máy'], ['han', 'Hàn'], ['do', 'Đo đồng hồ'], ['pin', 'Có pin'], ['motor', 'Motor quay'], ['web', 'Mở web'],
  ];
  const passFilter = (s) => {
    const f = state.filter;
    if (f === 'all') return true;
    if (f === 'todo') return !state.done.has(s.id);
    if (f === 'ban') return s.who === 'ban' || s.who === 'ca2';
    if (f === 'pcw') return s.who === 'claude' || s.who === 'ca2';
    return (s.tags || []).includes(f);
  };
  R.buoc = () => `
    <div class="vhead"><h2>Từng bước</h2><p>Làm theo thứ tự từ trên xuống. Bấm ô vuông để đánh dấu xong (lưu trên trình duyệt này).</p></div>
    <div class="row" id="sfilters">${FILTERS.map(([k, l]) => `<span class="chip${state.filter === k ? ' on' : ''}" data-f="${k}">${l}</span>`).join('')}</div>
    <div class="sp"></div>
    <div class="steps"><aside class="slist" id="slist"></aside><section class="sdetail" id="sdetail"></section></div>`;

  function renderStepList() {
    const box = $('#slist');
    if (!box) return;
    box.innerHTML = D.route.map((r) => {
      const items = legSteps(r.id).map((s) => `<div class="sitem${state.done.has(s.id) ? ' done' : ''}${s.id === state.cur ? ' on' : ''}${passFilter(s) ? '' : ' hide'}" data-step="${s.id}">
          <span class="ck" data-ck="${s.id}" title="Đánh dấu xong"></span><span class="id">${s.id}</span><span class="tx">${esc(s.t)}</span><span class="who" style="background:${LR.WHO[s.who].color}"></span></div>`).join('');
      return `<div class="sphase"><div class="sph" data-go="#buoc/${legSteps(r.id)[0].id}"><b>${r.id} · ${esc(r.name)}</b><span class="small muted">P${r.ph}</span><span class="mini"><i style="width:${legPct(r.id)}%"></i></span></div>${items}</div>`;
    }).join('') + `<div class="sphase"><div class="sph"><b>Sau lắp ráp — Phase 20–24</b></div>${D.after.map((a) => `<div class="sitem" data-after="1"><span class="id">P${a.ph}</span><span class="tx">${esc(a.name)}</span></div>`).join('')}</div>`;
    const on = $('.sitem.on', box);
    if (on) {
      const bt = box.getBoundingClientRect();
      const ot = on.getBoundingClientRect();
      if (ot.top < bt.top || ot.bottom > bt.bottom) box.scrollTop += ot.top - bt.top - bt.height / 3;
    }
  }

  function renderStepDetail(id) {
    const s = byId[id];
    const box = $('#sdetail');
    if (!s || !box) return;
    const i = STEPS.indexOf(s);
    const prev = STEPS[i - 1];
    const next = STEPS[i + 1];
    const links = D.links.filter((l) => l.step === s.id);
    const done = state.done.has(s.id);
    const list = (arr) => `<ol class="sdo">${arr.map((x) => `<li>${fmt(x)}</li>`).join('')}</ol>`;
    box.innerHTML = `
      <div class="shead"><span class="snum">${s.id}</span><h2>${esc(s.t)}</h2></div>
      <div class="row" style="margin-bottom:12px">${whoBadge(s.who)} ${tagBadges(s.tags)} <span class="badge b-gray">⏱ ${esc(s.time || '')}</span> <span class="badge b-gray">Chặng ${s.leg} · ${esc(legName(s.leg))}</span></div>
      ${s.warn ? `<div class="callout c-danger"><b>Cẩn thận:</b> ${fmt(s.warn)}</div>` : ''}
      <div class="sfigs">${(s.figs || []).map(fig).join('')}</div>
      <div class="scols">
        <div>
          ${s.do ? `<h3>Làm</h3>${list(s.do)}` : ''}
          ${s.you ? `<h3 style="color:var(--you)">Bạn làm</h3>${list(s.you)}` : ''}
          ${s.pc ? `<div class="pcbox"><h4>${ico('laptop')} Claude làm trên máy</h4><ul class="tight">${s.pc.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>${s.cmd ? `<pre>${s.cmd.map(esc).join('\n')}</pre>` : ''}</div>` : ''}
        </div>
        <div>
          <div class="callout c-ok"><b>Đạt khi:</b> ${fmt(s.ok || '')}</div>
          ${s.tools && s.tools.length ? `<div class="toolchips">${s.tools.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
          <div class="sp"></div>
          <div class="row">
            ${s.p3d ? `<a class="btn" href="#mohinh/${s.id}">${ico('cube')} Xem trong 3D</a>` : ''}
            ${links.map((l) => `<a class="btn" href="#daydien/${l.id}">${ico('wire')} Dây: ${esc(l.name)}</a>`).join('')}
          </div>
        </div>
      </div>
      <div class="snav">
        <button class="btn" ${prev ? `data-go="#buoc/${prev.id}"` : 'disabled'}>← ${prev ? prev.id : ''}</button>
        <button class="btn donebtn${done ? ' is-done' : ''}" data-ck="${s.id}">${done ? '✓ Đã xong' : 'Đánh dấu xong'}</button>
        <button class="btn pri" ${next ? `data-go="#buoc/${next.id}"` : 'disabled'}>${next ? next.id + ' →' : 'Hết'}</button>
      </div>`;
  }

  function selectStep(id) {
    if (!byId[id]) id = state.cur;
    state.cur = id;
    LR.store.set('cur', id);
    renderStepList();
    renderStepDetail(id);
  }

  /* ---------- 3D ---------- */
  R.mohinh = () => `
    <div class="vhead"><h2>Mô hình 3D</h2><p>Kéo để xoay · cuộn để phóng · chuột phải (hoặc hai ngón) để dời. Bấm một bộ phận để xem nó là gì, nằm ở bước nào. Kích thước theo mm của linh kiện thật.</p></div>
    <div class="v3d">
      <div class="v3d-stage" id="v3dStage">
        <div class="v3d-labels" id="v3dLabels"></div>
        <div class="v3d-views">${[['iso', 'Chéo'], ['top', 'Trên'], ['front', 'Trước'], ['side', 'Bên'], ['bottom', 'Dưới']].map(([k, l]) => `<button data-v3="${k}">${l}</button>`).join('')}</div>
        <div class="v3d-tip" id="v3dTip"></div>
        <div class="v3d-fallback" id="v3dFallback">Trình duyệt không bật được WebGL. Xem bản 2D ở mục <a href="#khung">Bố trí khung</a>.</div>
      </div>
      <div class="v3d-panel">
        <div class="card"><b>Lắp dần (chặng F → G)</b><input type="range" id="v3dRange" min="0" max="13" value="13"><div class="v3d-step" id="v3dStageTxt"></div></div>
        <div class="card"><b>Tách lớp</b><input type="range" id="v3dExplode" min="0" max="100" value="0"><div class="small muted">Kéo sang phải để tách các tầng ra xem bên trong.</div></div>
        <div class="card">
          <label><input type="checkbox" id="v3dProps"> Cánh quạt</label>
          <label><input type="checkbox" id="v3dSpin"> Cho motor quay (minh hoạ chiều)</label>
          <label><input type="checkbox" id="v3dLabelsOn" checked> Nhãn</label>
          <label><input type="checkbox" id="v3dBeams" checked> Tia TFmini + góc camera</label>
        </div>
        <div class="card"><b>Đang chọn</b><div id="v3dPick" class="small muted">Bấm vào một bộ phận.</div></div>
      </div>
    </div>`;

  let scene3d = null;
  function init3D(arg) {
    if (!scene3d) {
      const stage = $('#v3dStage');
      if (!window.LR3D) {
        $('#v3dFallback').style.display = 'grid';
        return;
      }
      try {
        scene3d = window.LR3D.mount(stage, {
          labels: $('#v3dLabels'),
          tip: $('#v3dTip'),
          onPick: (p) => {
            $('#v3dPick').innerHTML = p
              ? `<b>${esc(p.name)}</b><div>${fmt(p.info || '')}</div>${p.step ? `<div class="sp"></div><a class="btn" href="#buoc/${p.step}">Bước ${p.step}</a>` : ''}`
              : 'Bấm vào một bộ phận.';
          },
        });
      } catch (e) {
        $('#v3dFallback').style.display = 'grid';
        console.error(e);
        return;
      }
      const stages = scene3d.stages;
      const rng = $('#v3dRange');
      rng.max = String(stages.length - 1);
      rng.value = String(stages.length - 2);
      const showStage = () => {
        const i = Number(rng.value);
        scene3d.setStage(i);
        $('#v3dProps').checked = scene3d.get('props');
        const st = stages[i];
        $('#v3dStageTxt').innerHTML = `<b>${st.step}</b> — ${esc(st.label)} ${st.step !== '—' ? `<a href="#buoc/${st.step}">mở bước</a>` : ''}`;
      };
      rng.addEventListener('input', showStage);
      $('#v3dExplode').addEventListener('input', (e) => scene3d.setExplode(Number(e.target.value) / 100));
      $('#v3dProps').addEventListener('change', (e) => scene3d.set('props', e.target.checked));
      $('#v3dSpin').addEventListener('change', (e) => scene3d.set('spin', e.target.checked));
      $('#v3dLabelsOn').addEventListener('change', (e) => scene3d.set('labels', e.target.checked));
      $('#v3dBeams').addEventListener('change', (e) => scene3d.set('beams', e.target.checked));
      $$('[data-v3]').forEach((b) => b.addEventListener('click', () => scene3d.view(b.dataset.v3)));
      showStage();
      scene3d._showStage = showStage;
    }
    scene3d.resume();
    if (arg && byId[arg]) {
      const s = byId[arg];
      const idx = scene3d.stageIndexFor(arg);
      if (idx != null) {
        $('#v3dRange').value = String(idx);
        scene3d._showStage();
      }
      if (s.p3d) scene3d.highlight(s.p3d);
      if (s.id === 'G9' || s.id === 'G10') {
        $('#v3dProps').checked = true;
        scene3d.set('props', true);
      }
    }
  }

  /* ---------- Sơ đồ đấu dây ---------- */
  R.daydien = () => `
    <div class="vhead"><h2>Sơ đồ đấu dây</h2><p>Rê chuột vào một dây để làm nổi nó; bấm để xem cách làm sợi dây đó. Lọc theo phase để chỉ thấy dây của bước đang làm.</p></div>
    <div class="row" id="wfilters">${[['all', 'Tất cả'], ['15', 'Phase 15: RC + GPS + còi'], ['16', 'Phase 16: nguồn + motor'], ['17', 'Phase 17: ESP32 + TFmini + camera']].map(([k, l]) => `<span class="chip${state.phFilter === k ? ' on' : ''}" data-wf="${k}">${l}</span>`).join('')}</div>
    <div class="sp"></div>
    <div class="wv">
      <div class="pz" id="pzWiring" style="height:min(80vh,860px)"><div class="pz-ctl"><button data-pz="in">+</button><button data-pz="out">−</button><button data-pz="fit">⤢</button></div><div class="pz-inner">${LR.diag.wiring()}</div></div>
      <aside class="wpanel"><div class="card" id="wpanel"></div></aside>
    </div>
    <div class="sp"></div>
    ${LR.pic('sb_wiring', 'Sơ đồ chính hãng SpeedyBee (cho Betaflight / kính FPV) — dự án chỉ dùng một phần: không VTX, không camera FPV, receiver là i-BUS.')}`;

  function wpanelDefault() {
    return `<h3>Các mối nối</h3><p class="small muted">Bấm để xem chi tiết.</p>${D.links.filter((l) => l.diag && l.id !== 'smoke' && l.id !== 'balance').map((l) => `<div class="sitem" data-link="${l.id}"><span class="id">P${l.ph}</span><span class="tx">${esc(l.name)}</span></div>`).join('')}`;
  }
  function wpanelLink(id) {
    const l = D.links.find((x) => x.id === id);
    if (!l) return wpanelDefault();
    return `<div class="row"><button class="btn" data-link="">← Danh sách</button></div><div class="sp"></div>
      <h3>${esc(l.name)}</h3><div class="row"><span class="badge b-acc">Phase ${esc(l.ph)}</span> <a class="badge b-gray" href="#buoc/${l.step}">Bước ${l.step}</a></div>
      <dl class="kv" style="margin-top:10px"><dt>Từ</dt><dd>${fmt(l.from)}</dd><dt>Tới</dt><dd>${fmt(l.to)}</dd><dt>Dây</dt><dd>${fmt(l.wire)}</dd><dt>Giắc</dt><dd>${fmt(l.conn)}</dd><dt>Lấy từ</dt><dd>${fmt(l.src)}</dd></dl>
      <table class="tbl" style="margin-top:10px"><tbody>${l.sig.map(([a, b2]) => `<tr><td>${fmt(a)}</td><td>→</td><td>${fmt(b2)}</td></tr>`).join('')}</tbody></table>
      <div class="callout c-info small" style="margin-top:10px">${fmt(l.how)}</div>
      ${l.diag ? `<button class="btn" data-zoomdiag="${l.diag}">Mở sơ đồ làm dây</button>` : ''}`;
  }
  function setWireHL(id) {
    const svg = $('#pzWiring svg');
    if (!svg) return;
    $$('.cx', svg).forEach((g) => g.classList.toggle('hl', !!id && g.dataset.cx === id));
    svg.classList.toggle('dim', !!id);
  }
  function applyWireFilter() {
    const svg = $('#pzWiring svg');
    if (!svg) return;
    $$('.cx', svg).forEach((g) => {
      const ph = (g.dataset.ph || '').split(' ');
      g.classList.toggle('off', state.phFilter !== 'all' && !ph.includes(state.phFilter));
    });
  }
  function initWiring(arg) {
    const pz = $('#pzWiring');
    if (!pz.dataset.ready) {
      makePZ(pz);
      pz.dataset.ready = '1';
      const svg = $('svg', pz);
      svg.addEventListener('mouseover', (e) => {
        const g = e.target.closest('.cx');
        if (g && !state.pick) setWireHL(g.dataset.cx);
      });
      svg.addEventListener('mouseout', (e) => {
        if (!state.pick && !e.relatedTarget?.closest?.('.cx')) setWireHL(null);
      });
      svg.addEventListener('click', (e) => {
        const g = e.target.closest('.cx');
        if (!g) return;
        state.pick = g.dataset.cx;
        setWireHL(state.pick);
        $('#wpanel').innerHTML = wpanelLink(state.pick);
      });
    }
    applyWireFilter();
    if (arg) {
      state.pick = arg;
      setWireHL(arg);
      $('#wpanel').innerHTML = wpanelLink(arg);
    } else if (!state.pick) $('#wpanel').innerHTML = wpanelDefault();
  }

  /* ---------- các trang sơ đồ khác ---------- */
  R.nguon = () => `
    <div class="vhead"><h2>Sơ đồ nguồn</h2><p>Một viên pin nuôi tất cả, nhưng qua ba nhánh tách biệt. Đo các đường này ở bước ${stepLink('D7')}.</p></div>
    ${LR.svgfig('power', 'Bấm để phóng to.')}
    <div class="sp"></div>
    <div class="grid g2">
      ${LR.svgfig('cableBat', 'Pad nguồn ESC: XT60 + tụ + dây vào UBEC.')}
      ${LR.svgfig('cablePwr', 'Nhánh UBEC → bảng chia → ESP32 + camera.')}
    </div>
    <div class="sp"></div>
    <div class="card"><h3>Ngưỡng cần nhớ</h3><table class="tbl"><tbody>${D.thresholds.map(([a, b]) => `<tr><td>${fmt(a)}</td><td><b>${fmt(b)}</b></td></tr>`).join('')}</tbody></table></div>`;

  R.khung = () => `
    <div class="vhead"><h2>Bố trí trên khung</h2><p>Mỗi món một chỗ, có lý do. Đúng tỉ lệ theo kích thước thật (mm).</p></div>
    <div class="grid g2">${LR.svgfig('frameTop', 'Nhìn từ trên.')}${LR.svgfig('frameSide', 'Nhìn ngang.')}</div>
    <div class="sp"></div>
    <div class="grid g2">${LR.svgfig('stackSide', 'Stack trên bát chống rung.', { mount: true })}${LR.svgfig('rotation', 'Số motor và chiều quay.')}</div>
    <div class="sp"></div>
    <div class="card"><h3>Sáu quyết định vị trí (Phase 13.3)</h3><table class="tbl"><thead><tr><th>Món</th><th>Ở đâu</th><th>Vì sao</th></tr></thead><tbody>
      <tr><td>Stack FC + ESC</td><td>tâm khung, tấm trên, trên bát chống rung</td><td>gần tâm quay ít rung; cao su cách ly rung khỏi gyro</td></tr>
      <tr><td>Mũi tên FC</td><td>hướng về MŨI</td><td>buộc phải xoay thì khai báo <code>AHRS_ORIENTATION</code>, không "tự nhớ"</td></tr>
      <tr><td>GPS M10</td><td>cột phía ĐUÔI, cao ≥ 8–10 cm</td><td>xa từ trường dây nguồn; phía trước đã có TFmini + camera</td></tr>
      <tr><td>TFmini Plus</td><td>mép trước, nhìn thẳng ngang</td><td>tránh vật cản phía trước (<code>RNGFND1_ORIENT 0</code>); bị che = đọc khoảng cách của chính khung</td></tr>
      <tr><td>ESP32 + UBEC</td><td>tầng dưới, phía sau, anten thoáng</td><td>Wi-Fi 2,4 GHz xa GPS / receiver</td></tr>
      <tr><td>Pin 4S</td><td>dưới bụng, trượt được</td><td>dùng để cân trọng tâm; luôn có dây đai</td></tr>
    </tbody></table></div>
    <div class="sp"></div>
    <div class="grid g3">${LR.pic('s500_built', 'Khung S500 V2 lắp xong (ảnh Holybro).')}${LR.pic('s500_parts', 'Các chi tiết của bộ khung.')}${LR.pic('s500_side', 'Chân đáp cao.')}</div>`;

  R.bo = () => `
    <div class="vhead"><h2>Chân FC, ESC và bo camera</h2><p>Bản vẽ lại theo ảnh chính hãng và ảnh thật; ô cam là pad dự án dùng. Tra kèm bảng pad ở dưới.</p></div>
    <div class="grid g2">${LR.svgfig('fcTop', 'FC mặt trên.')}${LR.svgfig('fcBottom', 'FC mặt dưới.')}</div>
    <div class="sp"></div>
    <div class="grid g2">${LR.svgfig('escTop', 'ESC mặt "55A".')}${LR.svgfig('camPins', 'Bo camera ESP32-S3.')}</div>
    <div class="sp"></div>
    <div class="card"><h3>Pad và cổng dự án dùng</h3><table class="tbl"><thead><tr><th>Pad / cổng</th><th>Ở đâu</th><th>Nối với</th><th>Bước</th></tr></thead><tbody>
      ${D.pads.map((r) => `<tr><td><b>${fmt(r[0])}</b></td><td>${fmt(r[1])}</td><td>${fmt(r[2])}</td><td>${r[3] !== '—' ? stepLink(r[3]) : '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="sp"></div>
    <div class="grid g3">${LR.pic('sb_fclayout', 'Ảnh chính hãng: bố trí FC hai mặt.')}${LR.pic('sb_esclayout', 'Ảnh chính hãng: ESC hai mặt.')}${LR.pic('sb_dims', 'Kích thước: FC 39 × 39 mm, ESC 40,9 × 44,9 mm, lỗ 30,5.')}</div>
    <div class="sp"></div>
    <div class="grid g3">${LR.pic('real_fc_top', 'FC thật — mặt trên.')}${LR.pic('real_fc_bot', 'FC thật — mặt dưới (4 cổng cắm).')}${LR.pic('real_s3_bot', 'Camera thật — mặt dưới: nhãn USB-UART / USB-OTG, khe thẻ nhớ.')}</div>`;

  /* ---------- Linh kiện ---------- */
  const stBadge = (st, t) => `<span class="badge ${st === 'ok' ? 'b-ok' : st === 'part' ? 'b-warn' : 'b-gray'}">${esc(t)}</span>`;
  R.linhkien = () => `
    <div class="vhead"><h2>Linh kiện</h2><p>Đúng danh sách chính thức (<code>docs/phan-cung-thuc-te.md</code>, cập nhật 12–13/10/2026). Bấm "Chi tiết" để xem thông số, bẫy, ảnh và sơ đồ.</p></div>
    <div class="grid gauto">${D.parts.map((p) => {
      const ph = p.img ? `<div class="ph"><img src="${LR.img[p.img]}" alt="${esc(p.name)}" data-lb="${esc(p.name)}" loading="lazy"></div>` : `<div class="ph" style="cursor:default">${LR.diag.thumb({ k: p.id })}</div>`;
      return `<div class="card part">${ph}<div class="bd"><h3>${esc(p.name)}</h3><div class="role">${esc(p.sub)}</div>${stBadge(p.st, p.stText)}
        <details><summary class="small" style="cursor:pointer;font-weight:700">Chi tiết</summary>
          <dl class="kv" style="margin:8px 0">${p.specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${fmt(v)}</dd>`).join('')}</dl>
          ${p.traps.map((t) => `<div class="callout c-warn small">${fmt(t)}</div>`).join('')}
          ${p.more.length ? `<div class="thumbs">${p.more.map((id) => `<img src="${LR.img[id]}" data-lb="${esc(p.name)}" alt="">`).join('')}</div>` : ''}
          ${p.diag ? `<div class="sp"></div><button class="btn" data-zoomdiag="${p.diag}">Mở sơ đồ</button>` : ''}
        </details></div></div>`;
    }).join('')}</div>`;

  /* ---------- Hộp Deluxe ---------- */
  R.deluxe = () => `
    <div class="vhead"><h2>Hộp Deluxe — 24 món, món nào dùng vào đâu</h2><p>Stack SpeedyBee F405 V5 OX32 55A bản Deluxe. Lọc theo phán quyết.</p></div>
    <div class="row" id="dxfilters">${[['all', 'Tất cả'], ['dung', 'Dùng'], ['tuychon', 'Tuỳ chọn'], ['duphong', 'Dự phòng'], ['khong', 'Không dùng'], ['cam', 'Cấm dùng']].map(([k, l], i) => `<span class="chip${i === 0 ? ' on' : ''}" data-dx="${k}">${l}</span>`).join('')}</div>
    <div class="sp"></div>
    <div class="grid gauto" id="dxgrid">${D.deluxe.map((d) => `<div class="card part dx${d.use === 'khong' || d.use === 'duphong' ? ' nouse' : ''}" data-use="${d.use}">
      <div class="ph"><img src="${LR.img[d.img]}" alt="${esc(d.name)}" data-lb="${esc(d.name)}" loading="lazy"></div>
      <div class="bd"><h3>${esc(d.name)}${d.qty > 1 ? ` <span class="muted">×${d.qty}</span>` : ''}</h3><div><span class="badge ${LR.USE[d.use].cls}">${LR.USE[d.use].label}</span>${d.step ? ` <a class="badge b-gray" href="#buoc/${d.step}">bước ${d.step}</a>` : ''}</div>
      <div class="role">${fmt(d.how)}</div></div></div>`).join('')}</div>
    <div class="sp"></div>
    <div class="grid g2">${LR.pic('sb_deluxe', 'Ảnh chính hãng: nội dung hộp Deluxe.')}${LR.pic('sb_extras', 'Ảnh chính hãng: bảng tập hàn, bảng chia nguồn, module USB, smoke stopper.')}</div>`;

  /* ---------- Dây & giắc ---------- */
  R.day = () => `
    <div class="vhead"><h2>Dây và giắc — dùng loại nào cho mối nối nào</h2><p>Bảng dưới liệt kê mọi mối nối của drone: dây cỡ nào, giắc gì, lấy dây ở đâu (hộp Deluxe / kèm thiết bị / mua thêm), làm thế nào.</p></div>
    ${LR.svgfig('connectors', 'Các họ giắc trên drone này. SH 1,0 và GH 1,25 trông giống nhau nhưng KHÔNG cắm lẫn được.')}
    <div class="sp"></div>
    ${LR.svgfig('gauges', 'Cỡ dây theo dòng điện.')}
    <div class="sp"></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mối nối</th><th>Từ → tới</th><th>Dây / giắc</th><th>Lấy dây ở đâu</th><th>Làm thế nào</th><th>Bước</th></tr></thead><tbody>
    ${D.links.map((l) => `<tr class="click" data-zoomdiag="${l.diag}"><td><b>${esc(l.name)}</b><div class="small muted">Phase ${esc(l.ph)}</div></td><td>${fmt(l.from)}<br>→ ${fmt(l.to)}</td><td>${fmt(l.wire)}<div class="small muted">${fmt(l.conn)}</div></td><td>${fmt(l.src)}</td><td class="small">${fmt(l.how)}</td><td>${stepLink(l.step)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="sp"></div>
    <div class="card"><h3>Cáp tặng kèm trong hộp Deluxe: dùng được không?</h3><table class="tbl"><tbody>
    ${D.deluxe.filter((d) => /Cáp|Dây/.test(d.name)).map((d) => `<tr><td style="width:84px"><img src="${LR.img[d.img]}" style="width:80px;border-radius:6px;background:#fff" alt="" data-lb="${esc(d.name)}"></td><td><b>${esc(d.name)}</b></td><td><span class="badge ${LR.USE[d.use].cls}">${LR.USE[d.use].label}</span></td><td class="small">${fmt(d.how)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="sp"></div>
    <h3>Cách làm từng sợi</h3>
    <div class="grid g2">${['cableGps', 'cableRx', 'cableTf', 'cableTfBench', 'cableEsp', 'cablePwr', 'cableBuzzer', 'cableMotor'].map((n) => LR.svgfig(n, '')).join('')}</div>`;

  /* ---------- Dụng cụ ---------- */
  R.dungcu = () => `
    <div class="vhead"><h2>Dụng cụ và linh kiện ngoài</h2><p>Cách dùng từng món, rút gọn. Mỗi món ghi các bước dùng tới nó.</p></div>
    <div class="grid g2">${D.tools.map((t) => `<div class="card"><h3>${esc(t.name)}</h3>
      ${(t.diag || []).map((d) => LR.svgfig(d, '')).join('')}${t.img ? LR.pic(t.img, '') : ''}
      <ul class="tight" style="margin-top:10px">${t.use.map((u) => `<li>${fmt(u)}</li>`).join('')}</ul>
      ${t.warn ? `<div class="callout c-danger small">${fmt(t.warn)}</div>` : ''}
      <div class="small muted">Dùng ở: ${t.steps.map(stepLink).join(' · ')}</div></div>`).join('')}</div>`;

  /* ---------- Máy tính ---------- */
  R.maytinh = () => {
    const pc = D.pc;
    const rows = STEPS.filter((s) => s.who !== 'ban').map((s) => `<tr class="click" data-go="#buoc/${s.id}"><td>${stepLink(s.id)}</td><td><b>${esc(s.t)}</b><div class="small">${tagBadges(s.tags.filter((t) => t === 'web' || t === 'motor'))}</div></td>
      <td class="small">${(s.pc || []).map(fmt).join('<br>')}${s.cmd ? `<pre style="margin:6px 0 0;white-space:pre-wrap;font-size:.75rem">${s.cmd.map(esc).join('\n')}</pre>` : ''}</td><td class="small">${(s.you || []).map(fmt).join('<br>')}</td></tr>`).join('');
    return `
    <div class="vhead"><h2>Phần việc trên máy tính — Claude làm</h2><p>Ghi vào <code>AGENTS.md</code> và memory của dự án: mọi bước phần mềm do Claude chạy; bạn chỉ làm phần tay.</p></div>
    <div class="grid g2">
      <div class="card"><h3>Chia việc</h3><dl class="kv">${pc.rules.map((r) => `<dt><b>${esc(r.k)}</b></dt><dd>${fmt(r.v)}</dd>`).join('')}</dl></div>
      <div class="card"><h3>Không bao giờ</h3><ul class="tight">${pc.never.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul></div>
    </div>
    <div class="sp"></div>
    <h3>Hai cách chạy web</h3>
    ${LR.svgfig('webModes', '')}
    <div class="sp"></div>
    <div class="grid g2">${pc.modes.map((m) => `<div class="card"><h3>${esc(m.name)}</h3><p><b>Chạy:</b> <code>${esc(m.cmd)}</code> · <b>Tắt:</b> <code>${esc(m.stop)}</code></p><p>${fmt(m.what)}</p><b>Khi nào dùng</b><ul class="tight">${m.when.map((w) => `<li>${fmt(w)}</li>`).join('')}</ul><div class="callout c-warn small">${fmt(m.never)}</div></div>`).join('')}</div>
    <div class="sp"></div>
    <h3>Từng điểm chạm máy tính trong lộ trình</h3>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bước</th><th>Việc</th><th>Claude làm</th><th>Bạn làm</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="sp"></div>
    <div class="grid g2">
      <div class="card"><h3>Cổng COM và tên mạng</h3><table class="tbl"><tbody>${pc.ports.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${fmt(r[1])}</td><td class="small">${fmt(r[2])}</td><td class="small">${fmt(r[3])}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>File tham số theo thời gian</h3><table class="tbl"><tbody>${pc.params.map((r) => `<tr><td><code>${esc(r.f)}</code></td><td><span class="badge ${r.st === 'done' ? 'b-ok' : 'b-gray'}">${r.st === 'done' ? 'đã có' : 'sắp tới'}</span></td><td class="small">${fmt(r.when)}</td></tr>`).join('')}</tbody></table></div>
    </div>`;
  };

  R.antoan = () => `
    <div class="vhead"><h2>An toàn</h2><p>Rút gọn từ <code>SAFETY.md</code>. Vi phạm bất kỳ luật nào là lý do đủ để dừng buổi làm.</p></div>
    ${LR.svgfig('safetyRules', '')}
    <div class="sp"></div>
    <div class="grid g2">${D.safety.map((r) => `<div class="callout c-danger"><b>${esc(r.t)}.</b> ${fmt(r.d)}</div>`).join('')}</div>
    <div class="sp"></div>
    <div class="grid g2">${LR.svgfig('smoke', '')}${LR.svgfig('failsafe2', '')}</div>`;

  R.tracuu = () => `
    <div class="vhead"><h2>Tra cứu nhanh</h2><p>Những con số và bảng hay phải nhìn lại khi đang làm.</p><button class="btn" id="btnPrint2">${ico('list')} In checklist các bước</button></div>
    <div class="grid g2">
      <div class="card"><h3>Motor</h3><table class="tbl"><thead><tr><th>Số</th><th>Vị trí</th><th>Quay</th><th>Ren</th><th>Cánh</th><th>Test</th></tr></thead><tbody>${D.motors.map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<b>${c}</b>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>Cổng serial (đã nạp trong 01-base)</h3><table class="tbl"><tbody>
        <tr><td><b>SERIAL2</b> T2/R2</td><td>ESP32 DroneBridge</td><td>MAVLink2 115200</td></tr>
        <tr><td><b>SERIAL3</b> T3/R3</td><td>TFmini Plus</td><td>rangefinder (9) 115200</td></tr>
        <tr><td><b>SERIAL4</b> T4/R4</td><td>GPS M10</td><td>GPS (5) 230400</td></tr>
        <tr><td><b>SERIAL5</b></td><td>ESC telemetry</td><td>16, firmware ép 115200</td></tr>
        <tr><td><b>SERIAL6</b> R6</td><td>iA6B</td><td>RCIN (23), <code>RC_PROTOCOLS 4</code></td></tr>
        <tr><td><b>SERIAL1</b></td><td>Bluetooth trong bo</td><td>tắt (−1)</td></tr></tbody></table></div>
    </div>
    <div class="sp"></div>
    <div class="grid g2">
      <div class="card"><h3>Pad / cổng</h3><table class="tbl"><tbody>${D.pads.map((r) => `<tr><td><b>${fmt(r[0])}</b></td><td class="small">${fmt(r[1])}</td><td>${fmt(r[2])}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>Ngưỡng</h3><table class="tbl"><tbody>${D.thresholds.map(([a, b]) => `<tr><td>${fmt(a)}</td><td><b>${fmt(b)}</b></td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="sp"></div>
    <div class="card"><h3>Cổng COM, tên mạng</h3><table class="tbl"><tbody>${D.pc.ports.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${fmt(r[1])}</td><td class="small">${fmt(r[2])}</td><td class="small">${fmt(r[3])}</td></tr>`).join('')}</tbody></table></div>`;

  /* ================= ĐIỀU HƯỚNG ================= */
  function renderNav() {
    let html = '';
    let grp = '';
    VIEWS.forEach((v) => {
      if (v.grp !== grp) {
        grp = v.grp;
        html += `<div class="grp">${grp}</div>`;
      }
      html += `<a href="#${v.id}" data-view="${v.id}">${ico(v.ic)}<span>${v.label}</span></a>`;
    });
    $('#nav').innerHTML = html;
  }
  function ensureView(id) {
    if (state.rendered[id]) return $(`#v-${id}`);
    const sec = document.createElement('section');
    sec.className = 'view';
    sec.id = `v-${id}`;
    sec.innerHTML = R[id]();
    $('#main').appendChild(sec);
    state.rendered[id] = true;
    return sec;
  }
  function showView(id, arg) {
    if (!R[id]) id = 'tongquan';
    const sec = ensureView(id);
    $$('.view').forEach((v) => v.classList.toggle('on', v === sec));
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.view === id));
    if (id !== 'mohinh' && scene3d) scene3d.pause();
    if (id === 'buoc') selectStep(arg || state.cur);
    if (id === 'mohinh') requestAnimationFrame(() => init3D(arg));
    if (id === 'daydien') initWiring(arg);
    if (id === 'tongquan') {
      sec.innerHTML = R.tongquan();
    }
    if (!(id === 'buoc' && arg)) window.scrollTo({ top: 0 });
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'tongquan';
    const [v, arg] = h.split('/');
    showView(v, arg);
  }

  /* ================= PHÓNG TO / KÉO ================= */
  function makePZ(box, opt) {
    const inner = $('.pz-inner', box) || box.firstElementChild;
    const o = { s: 1, x: 0, y: 0 };
    const apply = () => { inner.style.transform = `translate(${o.x}px,${o.y}px) scale(${o.s})`; };
    const content = () => inner.firstElementChild;
    const fit = () => {
      const c = content();
      const bw = box.clientWidth;
      const bh = box.clientHeight;
      let w = c.naturalWidth || (c.viewBox && c.viewBox.baseVal && c.viewBox.baseVal.width) || c.clientWidth;
      let h = c.naturalHeight || (c.viewBox && c.viewBox.baseVal && c.viewBox.baseVal.height) || c.clientHeight;
      if (c.tagName.toLowerCase() === 'svg') {
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      o.s = Math.min(bw / w, bh / h) * 0.98;
      o.x = (bw - w * o.s) / 2;
      o.y = (bh - h * o.s) / 2;
      apply();
    };
    const zoomAt = (f, cx, cy) => {
      const ns = Math.min(12, Math.max(0.1, o.s * f));
      o.x = cx - ((cx - o.x) * ns) / o.s;
      o.y = cy - ((cy - o.y) * ns) / o.s;
      o.s = ns;
      apply();
    };
    box.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pz-ctl') || e.target.closest('button')) return;
      drag = { x: e.clientX, y: e.clientY, ox: o.x, oy: o.y, moved: false };
      inner.classList.add('drag');
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      o.x = drag.ox + dx;
      o.y = drag.oy + dy;
      apply();
    });
    window.addEventListener('pointerup', () => {
      if (drag && drag.moved) box.dataset.justDragged = '1';
      setTimeout(() => delete box.dataset.justDragged, 0);
      drag = null;
      inner.classList.remove('drag');
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pz]');
      if (!b) return;
      const r = box.getBoundingClientRect();
      if (b.dataset.pz === 'in') zoomAt(1.3, r.width / 2, r.height / 2);
      if (b.dataset.pz === 'out') zoomAt(1 / 1.3, r.width / 2, r.height / 2);
      if (b.dataset.pz === 'fit') fit();
    });
    const c = content();
    if (c.tagName.toLowerCase() === 'img' && !c.complete) c.addEventListener('load', fit, { once: true });
    else requestAnimationFrame(fit);
    window.addEventListener('resize', () => { if (box.offsetParent) fit(); });
    if (opt && opt.ret) return { fit };
    return null;
  }

  const lb = {
    el: null,
    open(node, title) {
      this.el = $('#lb');
      const inner = $('#lbInner');
      inner.innerHTML = '';
      inner.appendChild(node);
      inner.style.transform = '';
      $('#lbTitle').textContent = title || '';
      this.el.classList.add('on');
      document.body.style.overflow = 'hidden';
      if (!this.pz) {
        const stage = $('#lbStage');
        stage.classList.add('pz');
        inner.classList.add('pz-inner');
        this.pz = makePZ(stage, { ret: true });
      }
      if (node.tagName.toLowerCase() === 'img' && !node.complete) node.addEventListener('load', () => this.pz.fit(), { once: true });
      else requestAnimationFrame(() => this.pz.fit());
    },
    close() {
      $('#lb').classList.remove('on');
      document.body.style.overflow = '';
    },
  };
  function openDiag(name, arg) {
    const wrap = document.createElement('div');
    wrap.innerHTML = LR.diag[name](arg || {});
    const svg = wrap.firstElementChild;
    svg.style.background = 'var(--surface)';
    lb.open(svg, svg.getAttribute('aria-label') || '');
  }

  /* ================= TÌM KIẾM ================= */
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  let IDX = null;
  function buildIndex() {
    IDX = [];
    STEPS.forEach((s) => IDX.push({ t: `${s.id} · ${s.t}`, sub: `Bước — chặng ${legName(s.leg)}`, href: `#buoc/${s.id}`, txt: norm([s.id, s.t, ...(s.do || []), ...(s.you || []), ...(s.pc || []), s.ok, s.warn].join(' ')) }));
    D.parts.forEach((p) => IDX.push({ t: p.name, sub: 'Linh kiện', href: '#linhkien', txt: norm([p.name, p.sub, ...p.specs.flat(), ...p.traps].join(' ')) }));
    D.deluxe.forEach((d) => IDX.push({ t: d.name, sub: `Hộp Deluxe — ${LR.USE[d.use].label}`, href: '#deluxe', txt: norm([d.name, d.how].join(' ')) }));
    D.links.forEach((l) => IDX.push({ t: l.name, sub: 'Mối nối', href: `#daydien/${l.id}`, txt: norm([l.name, l.from, l.to, l.wire, l.conn, l.src, l.how, ...l.sig.flat()].join(' ')) }));
    D.tools.forEach((t) => IDX.push({ t: t.name, sub: 'Dụng cụ', href: '#dungcu', txt: norm([t.name, ...t.use, t.warn].join(' ')) }));
  }
  function doSearch(q) {
    const box = $('#qres');
    const n = norm(q).trim();
    if (n.length < 2) {
      box.classList.remove('on');
      return;
    }
    if (!IDX) buildIndex();
    const words = n.split(/\s+/);
    const hits = IDX.filter((e) => words.every((w) => e.txt.includes(w) || norm(e.t).includes(w))).slice(0, 14);
    box.innerHTML = hits.length ? hits.map((h) => `<a href="${h.href}">${esc(h.t)}<small>${esc(h.sub)}</small></a>`).join('') : '<a>Không thấy kết quả</a>';
    box.classList.add('on');
  }

  /* ================= IN ================= */
  function printChecklist() {
    let sec = $('#v-print');
    if (!sec) {
      sec = document.createElement('section');
      sec.id = 'v-print';
      sec.className = 'view printlist';
      $('#main').appendChild(sec);
    }
    sec.innerHTML = `<h2>Checklist lắp ráp drone S500 — KHÔNG CÁNH QUẠT TỚI BƯỚC G9</h2>` + D.route.map((r) => `<h3>${r.id} · ${esc(r.name)} (Phase ${r.ph})</h3>` +
      legSteps(r.id).map((s) => `<div class="pl"><i></i><div><b>${s.id} ${esc(s.t)}</b> — ${LR.WHO[s.who].label}<br>Đạt: ${esc((s.ok || '').replace(/\*\*|`/g, ''))}</div></div>`).join('')).join('');
    sec.classList.add('print-on');
    window.print();
    setTimeout(() => sec.classList.remove('print-on'), 500);
  }

  /* ================= SỰ KIỆN ================= */
  function bind() {
    window.addEventListener('hashchange', route);
    document.addEventListener('click', (e) => {
      const ck = e.target.closest('[data-ck]');
      if (ck) {
        e.preventDefault();
        e.stopPropagation();
        const id = ck.dataset.ck;
        if (state.done.has(id)) state.done.delete(id);
        else state.done.add(id);
        saveDone();
        renderStepList();
        if (state.cur === id) renderStepDetail(id);
        return;
      }
      const anchor = e.target.closest('a[href^="#"]');
      if (anchor) {
        $('#qres').classList.remove('on');
        return;
      }
      const go = e.target.closest('[data-go]');
      if (go) {
        location.hash = go.dataset.go.slice(1);
        return;
      }
      const si = e.target.closest('.sitem[data-step]');
      if (si) {
        location.hash = `buoc/${si.dataset.step}`;
        return;
      }
      const f = e.target.closest('#sfilters .chip');
      if (f) {
        state.filter = f.dataset.f;
        $$('#sfilters .chip').forEach((c) => c.classList.toggle('on', c === f));
        renderStepList();
        return;
      }
      const wf = e.target.closest('#wfilters .chip');
      if (wf) {
        state.phFilter = wf.dataset.wf;
        $$('#wfilters .chip').forEach((c) => c.classList.toggle('on', c === wf));
        applyWireFilter();
        return;
      }
      const dx = e.target.closest('#dxfilters .chip');
      if (dx) {
        $$('#dxfilters .chip').forEach((c) => c.classList.toggle('on', c === dx));
        $$('#dxgrid .dx').forEach((c) => { c.style.display = dx.dataset.dx === 'all' || c.dataset.use === dx.dataset.dx ? '' : 'none'; });
        return;
      }
      const lk = e.target.closest('[data-link]');
      if (lk) {
        const id = lk.dataset.link;
        state.pick = id || null;
        setWireHL(state.pick);
        $('#wpanel').innerHTML = id ? wpanelLink(id) : wpanelDefault();
        return;
      }
      const zd = e.target.closest('[data-zoomdiag]');
      if (zd && zd.dataset.zoomdiag && zd.dataset.zoomdiag !== 'undefined') {
        openDiag(zd.dataset.zoomdiag);
        return;
      }
      const img = e.target.closest('img[data-lb]');
      if (img) {
        const c = new Image();
        c.src = img.src;
        lb.open(c, img.dataset.lb);
        return;
      }
      const sb = e.target.closest('.svgbox');
      if (sb && !sb.closest('.pz')) {
        const svg = $('svg', sb).cloneNode(true);
        svg.style.background = 'var(--surface)';
        svg.style.maxWidth = 'none';
        lb.open(svg, svg.getAttribute('aria-label') || '');
        return;
      }
      const z = e.target.closest('#lb [data-z]');
      if (z) {
        const k = z.dataset.z;
        if (k === 'close') lb.close();
        else if (k === 'fit') lb.pz.fit();
        else {
          const st = $('#lbStage');
          st.dispatchEvent(new WheelEvent('wheel', { deltaY: k === 'in' ? -1 : 1, clientX: st.getBoundingClientRect().left + st.clientWidth / 2, clientY: st.getBoundingClientRect().top + st.clientHeight / 2, cancelable: true }));
        }
        return;
      }
      if (e.target.id === 'btnPrint2') printChecklist();
      if (!e.target.closest('.search')) $('#qres').classList.remove('on');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') lb.close();
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
      if (location.hash.startsWith('#buoc') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const i = STEPS.findIndex((s) => s.id === state.cur);
        const t = STEPS[i + (e.key === 'ArrowRight' ? 1 : -1)];
        if (t) location.hash = `buoc/${t.id}`;
      }
    });
    $('#q').addEventListener('input', (e) => doSearch(e.target.value));
    $('#q').addEventListener('focus', (e) => doSearch(e.target.value));
    $('#qres').addEventListener('click', () => { $('#qres').classList.remove('on'); $('#q').value = ''; });
    $('#btnPrint').addEventListener('click', printChecklist);
    $('#btnTheme').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const nx = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nx;
      LR.store.set('theme', nx);
    });
  }

  function init() {
    const th = LR.store.get('theme', null);
    if (th) document.documentElement.dataset.theme = th;
    $('#metaLine').textContent = `Trạng thái ${D.status.asOf} · dựng ${LR.meta.built || ''} · commit ${LR.meta.commit || ''}`;
    renderNav();
    updateProgress();
    bind();
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
