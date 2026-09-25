/**
 * Nhận diện render PHẦN MỀM (không có GPU thật): SwiftShader (Chrome không GPU),
 * llvmpipe (Linux), "Microsoft Basic Render Driver" (Windows thiếu driver).
 *
 * Ở chế độ đó, cảnh 3D chất lượng Cao chiếm hết luồng chính — cả trang đứng,
 * không bấm được tab khác (bắt được khi chạy E2E headless 25/09/2026). Khung 3D
 * tự hạ về "Thấp" và NÓI RÕ lý do, thay vì âm thầm chậm.
 *
 * Kiểm MỘT lần bằng một canvas tạm, nhớ kết quả.
 */
let cached: { software: boolean; renderer: string } | null = null;

const SOFTWARE = /swiftshader|llvmpipe|software|basic render|softpipe/i;

export function detectGpu(): { software: boolean; renderer: string } {
  if (cached) return cached;
  let renderer = "không rõ";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      cached = { software: true, renderer: "không có WebGL" };
      return cached;
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Không đọc được tên GPU thì coi như GPU thật — chỉ hạ chất lượng khi CHẮC là phần mềm.
  }
  cached = { software: SOFTWARE.test(renderer), renderer };
  return cached;
}
