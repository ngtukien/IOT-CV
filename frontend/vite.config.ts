/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, searchForWorkspaceRoot } from "vite";

/** Hợp đồng WebSocket — `src/lib/protocol.ts` import thẳng file này của backend. */
const CONTRACT_SCHEMA = path.resolve(import.meta.dirname, "../backend/ws-contract.schema.json");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Asset luôn tính từ gốc, để trang chạy ở 8000 (FastAPI phục vụ dist/) y
  // như ở 5173.
  base: "/",
  build: { outDir: "dist", sourcemap: true },
  server: {
    port: 5173,
    // Dev server mặc định chặn mọi file ngoài thư mục frontend/. Mở đúng MỘT
    // file của backend — bản hợp đồng — chứ không mở cả thư mục cha.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), CONTRACT_SCHEMA] },
    // Lúc phát triển có hai cổng: Vite ở 5173, FastAPI ở 8000. Khối proxy này
    // cho trình duyệt gọi /api và /ws như thể chúng cùng cổng với trang web,
    // nên code chỉ dùng đường dẫn tương đối — không chỗ nào phải biết số cổng.
    // Thiếu `ws: true` thì proxy chỉ chuyển HTTP và /ws báo 404.
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:8000", ws: true },
    },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
