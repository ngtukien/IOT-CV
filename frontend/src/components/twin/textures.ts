/**
 * Texture TỰ SINH bằng canvas — không file ảnh nào, không tải gì từ mạng, nên
 * khung 3D vẫn đẹp khi ra thực địa không có Internet.
 *
 * Mỗi texture tạo MỘT lần (nhớ đệm theo khoá) và dùng chung cho mọi model: tạo
 * lại texture mỗi lần render là rò bộ nhớ GPU.
 */
import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không cấp được canvas 2D để dựng texture 3D");
  return [c, ctx];
}

function remember<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = cache.get(key) as T | undefined;
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/**
 * Sợi carbon đan chéo 2×2 (twill) — vật liệu tấm thân S500. Hai tông xám rất
 * gần nhau + dải bóng chéo; vật liệu clearcoat lo phần "lớp keo bóng".
 */
export function carbonTexture(): THREE.CanvasTexture {
  return remember("carbon", () => {
    const S = 256;
    const cell = 16;
    const [c, ctx] = canvas(S, S);
    for (let y = 0; y < S / cell; y += 1) {
      for (let x = 0; x < S / cell; x += 1) {
        const warp = (x + y) % 4 < 2; // đan chéo: cứ hai ô đổi hướng sợi
        const g = ctx.createLinearGradient(x * cell, y * cell, warp ? x * cell + cell : x * cell, warp ? y * cell : y * cell + cell);
        const base = warp ? 38 : 26;
        g.addColorStop(0, `rgb(${base - 8},${base - 6},${base - 2})`);
        g.addColorStop(0.5, `rgb(${base + 22},${base + 24},${base + 30})`);
        g.addColorStop(1, `rgb(${base - 8},${base - 6},${base - 2})`);
        ctx.fillStyle = g;
        ctx.fillRect(x * cell, y * cell, cell, cell);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/** Vân xước kim loại chải (brushed) — dùng làm roughnessMap cho vỏ motor. */
export function brushedTexture(): THREE.CanvasTexture {
  return remember("brushed", () => {
    const [c, ctx] = canvas(256, 64);
    ctx.fillStyle = "rgb(120,120,120)";
    ctx.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 900; i += 1) {
      const y = Math.random() * 64;
      const v = 90 + Math.random() * 90;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.5)`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Nhãn pin LiPo 4S dán trên khối pin. */
export function batteryLabelTexture(): THREE.CanvasTexture {
  return remember("battery", () => {
    const [c, ctx] = canvas(512, 192);
    const g = ctx.createLinearGradient(0, 0, 512, 192);
    g.addColorStop(0, "#14171d");
    g.addColorStop(1, "#262b35");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = "#f2b53a";
    ctx.fillRect(0, 0, 18, 192);
    ctx.fillStyle = "#f5f7fa";
    ctx.font = "700 58px 'Chakra Petch', sans-serif";
    ctx.fillText("LiPo 4S", 44, 78);
    ctx.font = "500 34px 'Geist Mono Variable', monospace";
    ctx.fillStyle = "#b8c2cf";
    ctx.fillText("14.8V · 5200mAh · 50C", 44, 132);
    ctx.fillStyle = "#e5484d";
    ctx.font = "600 22px 'Geist Variable', sans-serif";
    ctx.fillText("KIỂM ĐIỆN ÁP TỪNG CELL TRƯỚC KHI BAY", 44, 172);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/** Mặt trên cục GPS (Holybro M10): nền đen nhám + mũi tên chỉ hướng mũi. */
export function gpsTopTexture(): THREE.CanvasTexture {
  return remember("gps", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#1c1f25";
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#343944";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 112, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#e8ecf1";
    ctx.beginPath();
    ctx.moveTo(128, 46);
    ctx.lineTo(168, 120);
    ctx.lineTo(140, 112);
    ctx.lineTo(140, 196);
    ctx.lineTo(116, 196);
    ctx.lineTo(116, 112);
    ctx.lineTo(88, 120);
    ctx.closePath();
    ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Bãi đáp: vòng tròn + chữ H, nền bê tông có hạt. */
export function landingPadTexture(): THREE.CanvasTexture {
  return remember("pad", () => {
    const S = 512;
    const [c, ctx] = canvas(S, S);
    ctx.fillStyle = "#5b6068";
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = "#f2b53a";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f5f7fa";
    ctx.font = "700 300px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", S / 2, S / 2 + 12);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/** Đĩa mờ của cánh quạt đang quay: vòng sáng mờ dần ra mép. */
export function propBlurTexture(): THREE.CanvasTexture {
  return remember("prop-blur", () => {
    const S = 256;
    const [c, ctx] = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(40,44,52,0)");
    g.addColorStop(0.25, "rgba(40,44,52,0.55)");
    g.addColorStop(0.85, "rgba(60,64,72,0.35)");
    g.addColorStop(0.97, "rgba(235,240,245,0.55)");
    g.addColorStop(1, "rgba(235,240,245,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Mặt đất dự phòng khi không tải được ảnh bản đồ: cỏ tối có hạt, lặp. */
export function fallbackGroundTexture(): THREE.CanvasTexture {
  return remember("ground", () => {
    const S = 256;
    const [c, ctx] = canvas(S, S);
    ctx.fillStyle = "#34402f";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i += 1) {
      const v = Math.random();
      ctx.fillStyle = v > 0.5 ? `rgba(90,110,70,${0.25 * v})` : `rgba(20,26,18,${0.35 * (1 - v)})`;
      ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(160, 160);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}
