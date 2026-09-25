/**
 * Khung một trang duy nhất của GCS. Không có router: GCS không có trang thứ hai.
 *
 * Vị trí các ô viết sẵn cho Phase 09/10 (xem `layout.css`), để các phase sau
 * chỉ thay NỘI DUNG ô, không phải sắp xếp lại lưới.
 *
 * Phase 08 chỉ NHÌN: chưa có nút nào gửi lệnh bay (SAFETY.md mục 1).
 */
import { Crosshair, Map, Radar, Route, Video } from "lucide-react";

import { ComingSoon } from "@/components/ComingSoon";
import { ConnectionBar } from "@/components/ConnectionBar";
import { EventLog } from "@/components/EventLog";
import { Hud } from "@/components/Hud/Hud";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWebSocket } from "@/hooks/useWebSocket";

import "./layout.css";

export default function App() {
  useWebSocket();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh flex-col">
        <ConnectionBar />
        <main className="gcs-grid mx-auto w-full max-w-[1920px] p-3">
          <Hud style={{ gridArea: "hud" }} />
          <ComingSoon
            title="Bản đồ"
            icon={Map}
            phase="09"
            description="Vị trí drone, điểm cất cánh và đường bay trên bản đồ vệ tinh. Bấm lên bản đồ để đặt waypoint."
            style={{ gridArea: "map" }}
          />
          <ComingSoon
            title="Video"
            icon={Video}
            phase="10"
            description="Hình từ camera trên drone, kèm khung nhận diện vật thể vẽ đè lên."
            style={{ gridArea: "video" }}
          />
          <ComingSoon
            title="Soạn mission"
            icon={Route}
            phase="09"
            description="Danh sách waypoint: độ cao từng điểm, kiểm tra giới hạn, nạp xuống drone."
            style={{ gridArea: "mission" }}
          />
          <ComingSoon
            title="Chế độ bay"
            icon={Crosshair}
            phase="10"
            description="Bật WEB CONTROL, đổi mode, cất cánh, hạ cánh, quay về điểm cất cánh (RTL)."
            style={{ gridArea: "mode" }}
          />
          <ComingSoon
            title="Vật cản"
            icon={Radar}
            phase="10"
            description="Radar 8 hướng từ cảm biến TFmini: khoảng cách và trạng thái tránh vật cản."
            style={{ gridArea: "obstacle" }}
          />
          <EventLog style={{ gridArea: "log" }} />
        </main>
      </div>
      <Toaster theme="dark" position="bottom-right" richColors />
    </TooltipProvider>
  );
}
