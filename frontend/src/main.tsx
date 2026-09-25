import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App";
// Thiếu dòng này thì bản đồ hiện ô xám lệch chồng nhau, không báo lỗi gì.
import "leaflet/dist/leaflet.css";
import "./index.css";

// StrictMode giữ nguyên, CỐ Ý: ở dev nó chạy effect hai lần để lộ lỗi quên dọn
// dẹp. Đó chính là bài kiểm tra "đúng một WebSocket" (plan Phase 08 §8.3.4).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
