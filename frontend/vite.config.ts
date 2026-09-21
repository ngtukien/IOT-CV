import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: { outDir: "dist" },
  server: {
    // Lúc phát triển có hai cổng: Vite ở 5173, FastAPI ở 8000. Khối proxy này
    // cho trình duyệt gọi /api và /ws như thể chúng cùng cổng với trang web,
    // nên `pnpm dev` (hot reload) vẫn nói chuyện được với backend.
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/ws": { target: "ws://127.0.0.1:8000", ws: true },
    },
  },
});
