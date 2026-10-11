/**
 * mulberry32 — RNG 32-bit có hạt giống. Dùng cho mọi thứ sinh ngẫu nhiên để
 * TRANG TRÍ (rải cây, vân texture): cùng hạt giống → cùng kết quả mỗi lần mở
 * trang, ảnh chụp nghiệm thu so sánh được. Không dùng cho bảo mật.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
