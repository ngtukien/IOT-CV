/* Mô hình 3D drone S500 — đơn vị mm, trục Y hướng lên, MŨI hướng −Z, bên PHẢI là +X.
   Kích thước lấy từ linh kiện thật: motor-motor 480 mm, FC 39×39, ESC 40,9×44,9, motor Ø27,7×31,
   TFmini 35×18,5×21, camera 57×28, iA6B 47×26×15, pin ~150×48×38, cánh 10 inch. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, HemisphereLight, DirectionalLight, GridHelper, Vector3, Vector2, Raycaster,
  CatmullRomCurve3, TubeGeometry, Shape, ExtrudeGeometry, CanvasTexture, SRGBColorSpace, DoubleSide, Color,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PARTS = {
  frame: { name: 'Khung S500 V2 — tấm đế + 4 cần', info: 'Tấm đế là bo chia nguồn có đồng chìm bên trong: **cấm khoan**. Motor–motor 480 mm.', step: 'F2' },
  gear: { name: 'Chân đáp', info: 'Thanh đáp chạy dọc trước–sau.', step: 'F3' },
  top: { name: 'Tấm trên', info: 'Siết chéo, 4 đầu cần phải cùng mặt phẳng.', step: 'F4' },
  m1: { name: 'M1 — sau-phải', info: 'Quay **CW**, motor **ren trái**, cánh CW (pusher). Test motor **B**.', step: 'F6' },
  m2: { name: 'M2 — trước-phải', info: 'Quay **CCW**, motor **ren phải**, cánh thường. Test motor **A**.', step: 'F6' },
  m3: { name: 'M3 — sau-trái', info: 'Quay **CCW**, motor **ren phải**, cánh thường. Test motor **C**.', step: 'F6' },
  m4: { name: 'M4 — trước-trái', info: 'Quay **CW**, motor **ren trái**, cánh CW (pusher). Test motor **D**.', step: 'F6' },
  props: { name: 'Cánh T1045', info: 'Xanh lá = CW (pusher) trên M1, M4. Xanh dương = CCW trên M2, M3. Gắn ở bước cuối.', step: 'G9' },
  mount: { name: 'Bát chống rung 30,5 × 30,5', info: '4 quả cao su cách rung. Không ốc nào xuyên thẳng xuống khung.', step: 'F7' },
  esc: { name: 'ESC OX32 55A 4-in-1', info: 'Mặt "55A" quay lên. Pad nguồn + − ở mép sau, 12 pad motor hai bên.', step: 'D2' },
  fc: { name: 'FC SpeedyBee F405 V5', info: 'Mũi tên chỉ về MŨI. Cổng USB-C ở bên phải. Đệm silicone đen giữa FC và ESC.', step: 'C1' },
  stack: { name: 'Ốc M3×30, đệm, cáp 10 chân', info: 'Thứ tự: ESC → đệm đen → FC → ốc nylon. Cáp 25 mm vòng qua mép trước.', step: 'D4' },
  xt60: { name: 'Dây XT60 + tụ 1000 µF', info: 'Hàn vào pad + / − ở mép sau ESC, tụ đúng cực.', step: 'D3' },
  buzzer: { name: 'Còi', info: 'Hàn vào B+ / B−.', step: 'C9' },
  wires: { name: 'Dây motor nối dài 16AWG', info: '12 mối nối chồng, so le, gen 2 lớp. Chạy dọc mặt dưới cần.', step: 'F8' },
  gps: { name: 'GPS M10 + la bàn trên cột', info: 'Phía đuôi, cao ≥ 8–10 cm, mũi tên cùng hướng FC.', step: 'F10' },
  rx: { name: 'Receiver FS-iA6B', info: 'i-BUS vào R6. Hai anten vuông góc, đầu nhạy duỗi thẳng, cách dây nguồn ≥ 5 cm.', step: 'F11' },
  tfmini: { name: 'TFmini Plus', info: 'Nhìn thẳng trước, chùm tia 3,6°. Không được thấy phần nào của drone.', step: 'F12' },
  cam: { name: 'Camera ESP32-S3 + OV3660', info: 'Mép trước, chĩa xuống ~30°. Nguồn từ UBEC.', step: 'F13' },
  esp32: { name: 'ESP32 DevKit (DroneBridge)', info: 'T2 → RX2, R2 → TX2, GND chung. Nguồn từ UBEC. Anten PCB ló ra ngoài.', step: 'F14' },
  ubec: { name: 'UBEC 5V 3A + bảng chia nguồn', info: 'Đầu vào từ pad pin ESC. Ra 5 V cho ESP32 + camera.', step: 'F14' },
  battery: { name: 'Pin Ovonic 4S 5300 mAh', info: 'Dưới bụng, velcro + dây đai. Trượt để cân trọng tâm.', step: 'F15' },
};

/* Các bước lắp dần (chặng F → G). */
const STAGES = [
  { step: 'F2', label: 'Tấm đế + 4 cần', show: ['frame'] },
  { step: 'F3', label: 'Chân đáp', show: ['gear'] },
  { step: 'F4', label: 'Tấm trên', show: ['top'] },
  { step: 'F6', label: 'Motor đúng nhóm ren', show: ['m1', 'm2', 'm3', 'm4'] },
  { step: 'F7', label: 'Bát chống rung + stack (đã có XT60, tụ, còi từ chặng C–D)', show: ['mount', 'esc', 'fc', 'stack', 'xt60', 'buzzer'] },
  { step: 'F8', label: 'Nối dài + đi dây motor', show: ['wires'] },
  { step: 'F10', label: 'Cột GPS', show: ['gps'] },
  { step: 'F11', label: 'Receiver + anten 90°', show: ['rx'] },
  { step: 'F12', label: 'TFmini nhìn thẳng trước', show: ['tfmini'] },
  { step: 'F13', label: 'Camera chĩa trước-xuống', show: ['cam'] },
  { step: 'F14', label: 'ESP32 + UBEC + bảng chia', show: ['esp32', 'ubec'] },
  { step: 'F15', label: 'Pin + dây đai — drone hoàn chỉnh, chưa cánh', show: ['battery'] },
  { step: 'G9', label: 'Gắn cánh (chỉ sau checklist 19.12)', show: ['props'] },
];
const STEP_STAGE = { F1: 0, F2: 0, F3: 1, F4: 2, F5: 2, F6: 3, F7: 4, F8: 5, F9: 5, F10: 6, F11: 7, F12: 8, F13: 9, F14: 10, F15: 11, F16: 11, F17: 11, F18: 11, G9: 12, G10: 12, G11: 12 };

const M = 169.7; // toạ độ motor theo X/Z (480 mm chéo)
const MOTORS = [
  { k: 'm1', x: M, z: M, cw: true },
  { k: 'm2', x: M, z: -M, cw: false },
  { k: 'm3', x: -M, z: M, cw: false },
  { k: 'm4', x: -M, z: -M, cw: true },
];
const Y_TOP = 24; // mặt dưới tấm trên
const Y_ARM = 23; // mặt trên đầu cần (chỗ bắt motor)

function mat(color, o = {}) {
  const p = { color, roughness: o.r ?? 0.6, metalness: o.m ?? 0.1, transparent: !!o.op, opacity: o.op ?? 1 };
  if (o.ds) p.side = DoubleSide;
  return new MeshStandardMaterial(p);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function tube(points, r, color, part) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  const m = new Mesh(new TubeGeometry(curve, 48, r, 8, false), mat(color, { r: 0.5 }));
  m.userData.part = part;
  return m;
}

function build() {
  const root = new Group();
  const groups = {};
  const G = (k) => {
    if (!groups[k]) {
      groups[k] = new Group();
      groups[k].userData.part = k;
      groups[k].userData.base = new Vector3();
      root.add(groups[k]);
    }
    return groups[k];
  };
  const add = (k, mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z);
    mesh.userData.part = k;
    G(k).add(mesh);
    return mesh;
  };

  /* ---- tấm đế PDB ---- */
  const pdbTex = canvasTex(256, 384, (g, w, h) => {
    g.fillStyle = '#18201c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a54a';
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#d8b15a';
    g.fillRect(70, h - 70, 46, 40);
    g.fillRect(140, h - 70, 46, 40);
    g.fillStyle = '#3a0';
    g.font = 'bold 34px sans-serif';
    g.fillStyle = '#7a0000';
    g.fillText('+', 82, h - 38);
    g.fillStyle = '#111';
    g.fillText('−', 152, h - 38);
    g.fillStyle = '#c9a54a';
    g.font = 'bold 28px sans-serif';
    g.fillText('S500', 92, 60);
    g.fillText('CẤM KHOAN', 44, 200);
  });
  const pdb = new Mesh(new BoxGeometry(124, 1.6, 184), [mat(0x18201c), mat(0x18201c), new MeshStandardMaterial({ map: pdbTex, roughness: 0.6 }), mat(0x18201c), mat(0x18201c), mat(0x18201c)]);
  add('frame', pdb, 0, 0, 0);

  /* ---- 4 cần ---- */
  MOTORS.forEach((m) => {
    const ang = Math.atan2(m.z, m.x);
    const len = 186;
    const arm = new Mesh(new BoxGeometry(len, 20, 26), mat(0x2b3033, { r: 0.7 }));
    const r0 = 60 + len / 2;
    arm.position.set(Math.cos(ang) * r0, 12, Math.sin(ang) * r0);
    arm.rotation.y = -ang;
    arm.userData.part = 'frame';
    G('frame').add(arm);
    const pad = new Mesh(new CylinderGeometry(22, 22, 4, 28), mat(0x2b3033));
    add('frame', pad, m.x, Y_ARM - 2, m.z);
  });

  /* ---- chân đáp ---- */
  [-1, 1].forEach((sx) => {
    const leg = new Mesh(new CylinderGeometry(6, 6, 200, 16), mat(0x222222, { r: 0.4, m: 0.3 }));
    leg.rotation.z = sx * 0.12;
    add('gear', leg, sx * 70, -100, 0);
    const skid = new Mesh(new CylinderGeometry(5, 5, 270, 16), mat(0x222222));
    skid.rotation.x = Math.PI / 2;
    add('gear', skid, sx * 82, -200, 0);
    [-80, 80].forEach((z) => {
      const foam = new Mesh(new CylinderGeometry(9, 9, 80, 16), mat(0xb02a30, { r: 0.9 }));
      foam.rotation.x = Math.PI / 2;
      add('gear', foam, sx * 82, -200, z);
    });
    const tee = new Mesh(new BoxGeometry(20, 20, 30), mat(0x111111));
    add('gear', tee, sx * 82, -195, 0);
  });

  /* ---- tấm trên (bát giác) ---- */
  const sh = new Shape();
  const a = 70;
  const c = 30;
  sh.moveTo(-a + c, -a);
  sh.lineTo(a - c, -a);
  sh.lineTo(a, -a + c);
  sh.lineTo(a, a - c);
  sh.lineTo(a - c, a);
  sh.lineTo(-a + c, a);
  sh.lineTo(-a, a - c);
  sh.lineTo(-a, -a + c);
  sh.closePath();
  const topGeo = new ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false });
  topGeo.rotateX(Math.PI / 2);
  const top = new Mesh(topGeo, mat(0x1d2421, { r: 0.7 }));
  add('top', top, 0, Y_TOP + 1.6, 0);

  /* ---- motor ---- */
  const motors = {};
  MOTORS.forEach((m) => {
    const g = G(m.k);
    const base = new Mesh(new CylinderGeometry(13.85, 13.85, 6, 32), mat(0x3a3a3a, { m: 0.5, r: 0.4 }));
    base.position.set(m.x, Y_ARM + 3, m.z);
    base.userData.part = m.k;
    g.add(base);
    const bell = new Group();
    bell.position.set(m.x, Y_ARM + 6, m.z);
    const can = new Mesh(new CylinderGeometry(13.85, 13.85, 25, 32), mat(0x161616, { m: 0.6, r: 0.35 }));
    can.position.y = 12.5;
    can.userData.part = m.k;
    bell.add(can);
    const ring = new Mesh(new CylinderGeometry(14.2, 14.2, 3, 32), mat(m.cw ? 0x2e9e4f : 0x2f6fd6));
    ring.position.y = 22;
    ring.userData.part = m.k;
    bell.add(ring);
    const mark = new Mesh(new BoxGeometry(4, 2, 14), mat(0xffffff));
    mark.position.set(0, 25.6, 6);
    mark.userData.part = m.k;
    bell.add(mark);
    const shaft = new Mesh(new CylinderGeometry(3, 3, 9.5, 16), mat(0xcccccc, { m: 0.9, r: 0.2 }));
    shaft.position.y = 29.5;
    shaft.userData.part = m.k;
    bell.add(shaft);
    bell.userData.part = m.k;
    g.add(bell);
    motors[m.k] = { bell, cw: m.cw };
  });

  /* ---- cánh ---- */
  const props = {};
  MOTORS.forEach((m) => {
    const p = new Group();
    p.position.set(m.x, Y_ARM + 40, m.z);
    const col = m.cw ? 0x2e9e4f : 0x2f6fd6;
    [0, Math.PI].forEach((rot) => {
      const blade = new Mesh(new BoxGeometry(125, 1.6, 18), mat(0x1b1b1b, { r: 0.5 }));
      blade.position.x = Math.cos(rot) * 64;
      blade.rotation.x = (m.cw ? 1 : -1) * 0.22;
      blade.userData.part = 'props';
      const holder = new Group();
      holder.rotation.y = rot;
      blade.position.set(64, 0, 0);
      holder.add(blade);
      const tip = new Mesh(new BoxGeometry(18, 1.8, 18.4), mat(col));
      tip.position.set(118, 0, 0);
      tip.rotation.x = blade.rotation.x;
      tip.userData.part = 'props';
      holder.add(tip);
      p.add(holder);
    });
    const hub = new Mesh(new CylinderGeometry(7, 7, 8, 20), mat(0x333333));
    hub.userData.part = 'props';
    p.add(hub);
    p.userData.part = 'props';
    G('props').add(p);
    props[m.k] = { p, cw: m.cw };
  });

  /* ---- bát chống rung ---- */
  const yM = Y_TOP + 1.6;
  add('mount', new Mesh(new BoxGeometry(46, 2, 46), mat(0x555555)), 0, yM + 1, 0);
  [[-15.25, -15.25], [15.25, -15.25], [-15.25, 15.25], [15.25, 15.25]].forEach(([x, z]) => add('mount', new Mesh(new SphereGeometry(5, 16, 12), mat(0x111111, { r: 0.95 })), x, yM + 7, z));
  add('mount', new Mesh(new BoxGeometry(46, 2, 46), mat(0x555555)), 0, yM + 13, 0);

  /* ---- ESC ---- */
  const yE = yM + 17;
  const escTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#222';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ddd';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#eee';
    g.font = 'bold 64px sans-serif';
    g.textAlign = 'center';
    g.fillText('55A', w / 2, h / 2 + 22);
    g.fillStyle = '#d8b15a';
    for (let i = 0; i < 8; i += 1) g.fillRect(40 + i * 23, 6, 14, 18);
  });
  add('esc', new Mesh(new BoxGeometry(41, 1.6, 45), mat(0x15130f)), 0, yE, 0);
  add('esc', new Mesh(new BoxGeometry(32, 4, 32), [mat(0x222222), mat(0x222222), new MeshStandardMaterial({ map: escTex }), mat(0x222222), mat(0x222222), mat(0x222222)]), 0, yE + 2.8, 0);
  [[-21, -8], [-21, 10], [21, -8], [21, 10]].forEach(([x, z]) => add('esc', new Mesh(new BoxGeometry(4, 1.8, 14), mat(0xd8b15a, { m: 0.6 })), x, yE, z));
  add('esc', new Mesh(new BoxGeometry(10, 1.8, 7), mat(0xd8b15a, { m: 0.6 })), -9, yE, 25);
  add('esc', new Mesh(new BoxGeometry(10, 1.8, 7), mat(0xd8b15a, { m: 0.6 })), 9, yE, 25);

  /* ---- FC ---- */
  const yF = yE + 13;
  const fcTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#121916';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8b15a';
    for (let i = 0; i < 11; i += 1) g.fillRect(40 + i * 16, 6, 10, 16);
    for (let i = 0; i < 10; i += 1) g.fillRect(44 + i * 17, 28, 10, 14);
    for (let i = 0; i < 10; i += 1) g.fillRect(44 + i * 17, h - 44, 10, 14);
    for (let i = 0; i < 10; i += 1) g.fillRect(44 + i * 17, h - 22, 10, 16);
    g.fillStyle = '#ff3b30';
    g.fillRect(44 + 3 * 17, h - 22, 10, 16);
    g.fillStyle = '#333';
    g.fillRect(84, 80, 90, 90);
    g.fillStyle = '#eee';
    g.fillRect(104, 100, 50, 50);
    g.fillStyle = '#E9C21F';
    g.beginPath();
    g.moveTo(w / 2, 180);
    g.lineTo(w / 2 - 16, 206);
    g.lineTo(w / 2 + 16, 206);
    g.closePath();
    g.fill();
  });
  add('fc', new Mesh(new BoxGeometry(39, 1.6, 39), [mat(0x121916), mat(0x121916), new MeshStandardMaterial({ map: fcTex, roughness: 0.55 }), mat(0x121916), mat(0x121916), mat(0x121916)]), 0, yF, 0);
  add('fc', new Mesh(new BoxGeometry(7, 3.4, 9), mat(0xb8bcbf, { m: 0.8, r: 0.3 })), 18.5, yF + 2, 0);
  const arrow = new Mesh(new ConeGeometry(4, 10, 16), mat(0xe9c21f));
  arrow.rotation.x = -Math.PI / 2;
  add('fc', arrow, 0, yF + 4, -24);

  /* ---- ốc, đệm, cáp 10P ---- */
  [[-15.25, -15.25], [15.25, -15.25], [-15.25, 15.25], [15.25, 15.25]].forEach(([x, z]) => {
    add('stack', new Mesh(new CylinderGeometry(1.5, 1.5, 34, 10), mat(0x9aa1a8, { m: 0.8 })), x, yE + 10, z);
    add('stack', new Mesh(new CylinderGeometry(3.6, 3.6, 4, 16), mat(0x111111)), x, yE + 6, z);
    add('stack', new Mesh(new CylinderGeometry(3.8, 3.8, 3, 6), mat(0xe9c21f)), x, yF + 3, z);
  });
  G('stack').add(tube([[6, yE - 1.5, -22], [6, yE - 3, -27], [6, yF - 4, -27], [6, yF - 1.5, -20]], 1.6, 0x9aa1a8, 'stack'));

  /* ---- XT60 + tụ ---- */
  G('xt60').add(tube([[-9, yE, 26], [-9, yE - 6, 40], [-12, 8, 70], [-8, -30, 84]], 2.4, 0xd33a32, 'xt60'));
  G('xt60').add(tube([[9, yE, 26], [9, yE - 6, 40], [10, 8, 70], [6, -30, 84]], 2.4, 0x222222, 'xt60'));
  add('xt60', new Mesh(new BoxGeometry(16, 8, 15), mat(0xf3c623)), -1, -34, 88);
  const cap = new Mesh(new CylinderGeometry(5, 5, 13, 16), mat(0xc6ccd2, { m: 0.6 }));
  cap.rotation.x = Math.PI / 2;
  add('xt60', cap, 0, yE + 1, 32);

  /* ---- còi ---- */
  add('buzzer', new Mesh(new CylinderGeometry(6, 6, 9, 20), mat(0x111111)), -34, yM + 4.5, -40);

  /* ---- dây motor ---- */
  MOTORS.forEach((m) => {
    const ang = Math.atan2(m.z, m.x);
    const ux = Math.cos(ang);
    const uz = Math.sin(ang);
    const px = -uz;
    const pz = ux;
    const sx = Math.sign(m.x);
    const sz = Math.sign(m.z);
    [[-3, 0xe3b505], [0, 0xd33a32], [3, 0x2b2b2b]].forEach(([o, col]) => {
      G('wires').add(tube([
        [m.x + px * o, Y_ARM - 2, m.z + pz * o],
        [ux * 190 + px * o, 1, uz * 190 + pz * o],
        [ux * 70 + px * o, 1, uz * 70 + pz * o],
        [sx * 30 + px * o * 0.3, 18, sz * 14 + o],
        [sx * 21.5, yE, sz * (sz < 0 ? 8 : 10) + o * 0.6],
      ], 1.3, col, 'wires'));
    });
  });

  /* ---- GPS ---- */
  add('gps', new Mesh(new BoxGeometry(16, 6, 16), mat(0x222222)), 0, yM + 3, 62);
  add('gps', new Mesh(new CylinderGeometry(4, 4, 110, 12), mat(0x1a1a1a, { r: 0.4 })), 0, yM + 58, 62);
  add('gps', new Mesh(new CylinderGeometry(25, 25, 13, 40), mat(0xe8e8e8, { r: 0.5 })), 0, yM + 119, 62);
  const garrow = new Mesh(new ConeGeometry(5, 12, 16), mat(0xd33a32));
  garrow.rotation.x = -Math.PI / 2;
  add('gps', garrow, 0, yM + 126.5, 50);
  G('gps').add(tube([[0, yM + 6, 62], [-14, yM + 4, 40], [-14, yF - 3, -10], [-8, yF - 1.5, -17]], 1.2, 0x2f6fd6, 'gps'));

  /* ---- receiver ---- */
  add('rx', new Mesh(new BoxGeometry(26, 15, 47), mat(0x111111)), -44, yM + 7.5, 42);
  G('rx').add(tube([[-57, yM + 10, 30], [-110, yM + 12, 30], [-150, yM + 12, 30]], 0.9, 0x222222, 'rx'));
  G('rx').add(tube([[-150, yM + 12, 30], [-180, yM + 12, 30]], 1.1, 0xdddddd, 'rx'));
  G('rx').add(tube([[-44, yM, 66], [-46, -20, 74], [-48, -70, 80]], 0.9, 0x222222, 'rx'));
  G('rx').add(tube([[-48, -70, 80], [-49, -100, 82]], 1.1, 0xdddddd, 'rx'));
  G('rx').add(tube([[-31, yM + 8, 50], [-10, yM + 10, 40], [12, yF - 2, 18]], 1.2, 0xf4f4f4, 'rx'));

  /* ---- TFmini ---- */
  add('tfmini', new Mesh(new BoxGeometry(35, 18.5, 21), mat(0x111111)), 20, yM + 9.5, -74);
  [-8, 8].forEach((dx) => {
    const lens = new Mesh(new CylinderGeometry(6, 6, 1, 20), mat(0x203040, { r: 0.1, m: 0.6 }));
    lens.rotation.x = Math.PI / 2;
    add('tfmini', lens, 20 + dx, yM + 9.5, -84.8);
  });
  G('tfmini').add(tube([[20, yM + 10, -63], [30, yM + 14, -30], [20, yF + 2, 10], [6, yF + 1, 17]], 1.0, 0x2e9e4f, 'tfmini'));

  /* ---- camera ---- */
  const camG = new Group();
  camG.position.set(-24, -10, -86);
  camG.rotation.x = 0.52;
  const board = new Mesh(new BoxGeometry(28, 1.6, 57), mat(0x111111));
  board.userData.part = 'cam';
  camG.add(board);
  const camMod = new Mesh(new BoxGeometry(9, 5, 9), mat(0xc98a2b));
  camMod.position.set(0, -3.3, -22);
  camMod.userData.part = 'cam';
  camG.add(camMod);
  const camLens = new Mesh(new CylinderGeometry(3.5, 3.5, 4, 16), mat(0x111111));
  camLens.position.set(0, -6.5, -22);
  camLens.userData.part = 'cam';
  camG.add(camLens);
  camG.userData.part = 'cam';
  G('cam').add(camG);

  /* ---- ESP32 + UBEC + bảng chia ---- */
  add('esp32', new Mesh(new BoxGeometry(28, 1.6, 51), mat(0x0f1a14)), 36, -5, 92);
  add('esp32', new Mesh(new BoxGeometry(18, 3.5, 25), mat(0xb8bcbf, { m: 0.7 })), 36, -7.5, 94);
  G('esp32').add(tube([[-6, yF + 1, -17], [-30, yF, -20], [-66, 20, -10], [-66, 4, 60], [30, -4, 80]], 0.9, 0xe3b505, 'esp32'));
  add('ubec', new Mesh(new BoxGeometry(30, 10, 18), mat(0x253041)), -40, -6, 78);
  add('ubec', new Mesh(new BoxGeometry(10, 2, 26), mat(0x111111)), -40, -3, 52);

  /* ---- pin ---- */
  const batTex = canvasTex(128, 384, (g, w, h) => {
    g.fillStyle = '#2d3a54';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.font = 'bold 26px sans-serif';
    g.textAlign = 'center';
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-Math.PI / 2);
    g.fillText('4S 5300 mAh', 0, 8);
    g.restore();
  });
  add('battery', new Mesh(new BoxGeometry(48, 38, 150), [mat(0x2d3a54), mat(0x2d3a54), mat(0x2d3a54), new MeshStandardMaterial({ map: batTex }), mat(0x2d3a54), mat(0x2d3a54)]), 0, -21, 0);
  add('battery', new Mesh(new BoxGeometry(52, 42, 20), mat(0x6b5d45, { r: 0.95 })), 0, -20, 30);

  /* ---- tia (TFmini + camera) ---- */
  const beams = new Group();
  const tfBeam = new Mesh(new ConeGeometry(Math.tan((1.8 * Math.PI) / 180) * 700, 700, 24, 1, true), new MeshBasicMaterial({ color: 0xff7c48, transparent: true, opacity: 0.18, depthWrite: false, side: DoubleSide }));
  tfBeam.rotation.x = Math.PI / 2;
  tfBeam.position.set(20, yM + 9.5, -85 - 350);
  beams.add(tfBeam);
  const camCone = new Mesh(new ConeGeometry(120, 220, 4, 1, true), new MeshBasicMaterial({ color: 0x8b5bd6, transparent: true, opacity: 0.08, depthWrite: false, side: DoubleSide }));
  camCone.position.set(0, 110, 0);
  camCone.rotation.x = Math.PI; // đỉnh nón ở ống kính, đáy loe ra xa
  const camHolder = new Group();
  camHolder.add(camCone);
  camHolder.position.set(-24, -16, -98);
  camHolder.rotation.x = Math.PI + 1.05;
  beams.add(camHolder);
  root.add(beams);

  /* ---- vector tách lớp ---- */
  const EX = {
    frame: [0, 0, 0], gear: [0, -90, 0], top: [0, 70, 0],
    m1: [55, 40, 55], m2: [55, 40, -55], m3: [-55, 40, 55], m4: [-55, 40, -55],
    props: [0, 160, 0], mount: [0, 90, 0], esc: [0, 120, 0], fc: [0, 170, 0], stack: [0, 145, 0], xt60: [0, 120, 40], buzzer: [-30, 110, -30],
    wires: [0, 0, 0], gps: [0, 150, 50], rx: [-50, 110, 30], tfmini: [0, 90, -70], cam: [0, -50, -80], esp32: [40, -60, 70], ubec: [-40, -60, 60], battery: [0, -140, 0],
  };
  Object.keys(groups).forEach((k) => { groups[k].userData.ex = new Vector3(...(EX[k] || [0, 0, 0])); });

  /* ---- neo nhãn ---- */
  const LABELS = [
    ['fc', 'FC', [0, yF + 6, 0]], ['esc', 'ESC', [-24, yE, -20]], ['gps', 'GPS M10', [0, yM + 132, 62]], ['tfmini', 'TFmini', [20, yM + 22, -74]],
    ['cam', 'Camera', [-24, -20, -96]], ['esp32', 'ESP32', [36, -10, 112]], ['ubec', 'UBEC', [-40, -12, 78]], ['rx', 'iA6B', [-44, yM + 18, 42]],
    ['battery', 'Pin 4S', [0, -42, -60]], ['m1', 'M1 · CW', [M, Y_ARM + 44, M]], ['m2', 'M2 · CCW', [M, Y_ARM + 44, -M]], ['m3', 'M3 · CCW', [-M, Y_ARM + 44, M]], ['m4', 'M4 · CW', [-M, Y_ARM + 44, -M]],
    ['buzzer', 'Còi', [-34, yM + 12, -40]], ['mount', 'Bát chống rung', [26, yM + 8, 26]],
  ];

  return { root, groups, motors, props, beams, labels: LABELS };
}

function mount(container, opt) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.prepend(renderer.domElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 1, 6000);
  camera.position.set(250, 470, 700);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 120;
  controls.maxDistance = 2200;
  scene.add(new HemisphereLight(0xffffff, 0x3a3f44, 1.25));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(300, 700, 240);
  scene.add(sun);
  const fill = new DirectionalLight(0xffffff, 0.5);
  fill.position.set(-400, 200, -300);
  scene.add(fill);
  const grid = new GridHelper(1400, 28, 0x7d8a86, 0x7d8a86); // xám trung tính: đọc được cả nền sáng lẫn tối
  grid.position.y = -206;
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  scene.add(grid);

  const W = build();
  scene.add(W.root);

  const st = { stage: STAGES.length - 2, explode: 0, props: false, spin: false, labels: true, beams: true, hl: null, t0: performance.now(), anim: null, running: false };

  /* nhãn HTML */
  const labelEls = W.labels.map(([k, text, pos]) => {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = text;
    opt.labels.appendChild(el);
    return { k, el, pos: new Vector3(...pos) };
  });

  const visibleSet = () => {
    const s = new Set();
    STAGES.slice(0, st.stage + 1).forEach((x) => x.show.forEach((k) => s.add(k)));
    if (!st.props) s.delete('props');
    else s.add('props');
    return s;
  };
  function applyVisibility() {
    const vis = visibleSet();
    Object.entries(W.groups).forEach(([k, g]) => { g.visible = vis.has(k); });
    W.beams.visible = st.beams && vis.has('tfmini');
    W.beams.children[1].visible = vis.has('cam');
    W.beams.children[0].visible = vis.has('tfmini');
  }
  function applyExplode() {
    Object.entries(W.groups).forEach(([k, g]) => {
      const e = g.userData.ex;
      g.position.set(e.x * st.explode, e.y * st.explode, e.z * st.explode);
    });
    W.groups.wires && (W.groups.wires.visible = W.groups.wires.visible && st.explode < 0.05);
    W.beams.position.copy(W.groups.tfmini ? W.groups.tfmini.position : new Vector3());
  }
  function setHighlight(k) {
    st.hl = k;
    W.root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const on = k && (o.userData.part === k || (k === 'motors' && /^m[1-4]$/.test(o.userData.part)) || (k === 'stack' && ['stack', 'esc', 'fc', 'mount'].includes(o.userData.part)));
      mats.forEach((m) => { if (m.emissive) m.emissive.setHex(on ? 0xff6a1a : 0x000000); });
      o.userData.hl = !!on;
    });
    labelEls.forEach((l) => l.el.classList.toggle('hl', !!k && (l.k === k || (k === 'motors' && /^m[1-4]$/.test(l.k)) || (k === 'stack' && ['esc', 'fc', 'mount'].includes(l.k)))));
  }

  /* chọn bằng chuột */
  const ray = new Raycaster();
  const mouse = new Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(W.root.children, true).filter((h) => {
      let o = h.object;
      while (o) {
        if (o.visible === false) return false;
        o = o.parent;
      }
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      return h.object.userData.part && m && m.depthWrite !== false;
    });
    const hit = hits.find((h) => PARTS[h.object.userData.part]);
    if (hit) {
      const k = hit.object.userData.part;
      setHighlight(k);
      opt.onPick?.({ key: k, ...PARTS[k] });
      if (opt.tip) {
        opt.tip.innerHTML = `<b>${PARTS[k].name}</b>`;
        opt.tip.classList.add('on');
      }
    } else {
      setHighlight(null);
      opt.onPick?.(null);
      opt.tip?.classList.remove('on');
    }
  });

  /* góc nhìn */
  const VIEWS = {
    iso: [[250, 470, 700], [0, 0, 0]], top: [[0, 900, 1], [0, 0, 0]], front: [[0, 60, -760], [0, 0, 0]], side: [[760, 60, 0], [0, 0, 0]], bottom: [[0, -820, 1], [0, -40, 0]],
  };
  function view(name) {
    const v = VIEWS[name] || VIEWS.iso;
    st.anim = { from: camera.position.clone(), to: new Vector3(...v[0]), tf: controls.target.clone(), tt: new Vector3(...v[1]), t: 0 };
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const tmp = new Vector3();
  const pulse = new Color();
  function frame(now) {
    const dt = Math.min(0.05, (now - (st.last || now)) / 1000);
    st.last = now;
    if (st.anim) {
      st.anim.t = Math.min(1, st.anim.t + dt / 0.6);
      const e = st.anim.t < 0.5 ? 2 * st.anim.t * st.anim.t : 1 - Math.pow(-2 * st.anim.t + 2, 2) / 2;
      camera.position.lerpVectors(st.anim.from, st.anim.to, e);
      controls.target.lerpVectors(st.anim.tf, st.anim.tt, e);
      if (st.anim.t >= 1) st.anim = null;
    }
    controls.update();
    if (st.spin) {
      const w = dt * Math.PI * 2 * 1.2;
      Object.values(W.motors).forEach((m) => { m.bell.rotation.y += m.cw ? -w : w; });
      Object.values(W.props).forEach((p) => { p.p.rotation.y += p.cw ? -w * 4 : w * 4; });
    }
    if (st.hl) {
      const k = 0.5 + 0.5 * Math.sin(now / 220);
      pulse.setRGB(1, 0.42 * k + 0.2, 0.1 * k);
      W.root.traverse((o) => {
        if (o.userData.hl && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.emissive?.copy(pulse).multiplyScalar(0.55 + 0.35 * k));
      });
    }
    renderer.render(scene, camera);
    const r = renderer.domElement;
    const vis = [];
    labelEls.forEach((l) => {
      const g = W.groups[l.k];
      if (!st.labels || !g?.visible) {
        l.el.style.display = 'none';
        return;
      }
      tmp.copy(l.pos).add(g.position).project(camera);
      if (tmp.z > 1) {
        l.el.style.display = 'none';
        return;
      }
      if (l.el.style.display === 'none') l.el.style.display = '';
      if (!l.w) {
        l.w = l.el.offsetWidth;
        l.h = l.el.offsetHeight;
      }
      vis.push({ l, x: ((tmp.x + 1) / 2) * r.clientWidth, y: ((1 - tmp.y) / 2) * r.clientHeight, z: tmp.z });
    });
    /* Nhãn gần camera đặt trước; nhãn sau bị đè thì thử dời lên/xuống từng nấc; hết chỗ thì làm mờ. */
    vis.sort((a, b) => a.z - b.z);
    const placed = [];
    vis.forEach((v) => {
      const hit = (xx, yy) => placed.some((p) => Math.abs(p.x - xx) < (p.w + v.l.w) / 2 + 2 && Math.abs(p.y - yy) < (p.h + v.l.h) / 2 + 1);
      const step = v.l.h + 2;
      const tries = [[0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0], [1, 0], [0, -3], [0, 3]];
      const ok = tries.find(([dx, dy]) => !hit(v.x + dx * (v.l.w / 2 + 4), v.y + dy * step));
      const [dx, dy] = ok || [0, 0];
      const x = v.x + dx * (v.l.w / 2 + 4);
      const y = v.y + dy * step;
      placed.push({ x, y, w: v.l.w, h: v.l.h });
      v.l.el.style.left = `${x}px`;
      v.l.el.style.top = `${y}px`;
      v.l.el.style.opacity = ok ? '' : '0.35';
    });
  }

  applyVisibility();
  applyExplode();

  const api = {
    stages: STAGES,
    setStage(i) {
      st.stage = Math.max(0, Math.min(STAGES.length - 1, i));
      st.props = STAGES[st.stage].step === 'G9';
      applyVisibility();
      applyExplode();
    },
    get(k) { return st[k]; },
    stageIndexFor(stepId) {
      if (stepId in STEP_STAGE) return STEP_STAGE[stepId];
      /* Bước chặng A–E và phần G còn lại: xem drone hoàn chỉnh, chưa cánh (F15). */
      if (stepId && /^[A-EG]/.test(stepId)) return STAGES.length - 2;
      return null;
    },
    setExplode(t) {
      st.explode = t;
      applyVisibility();
      applyExplode();
    },
    set(k, v) {
      st[k] = v;
      applyVisibility();
      applyExplode();
      if (k === 'labels') labelEls.forEach((l) => { l.el.style.display = v ? '' : 'none'; });
    },
    highlight(k) { setHighlight(k); },
    view,
    pause() { renderer.setAnimationLoop(null); st.running = false; },
    resume() { if (!st.running) { st.last = undefined; renderer.setAnimationLoop(frame); st.running = true; } resize(); },
  };
  api.resume();
  return api;
}

window.LR3D = { mount };
