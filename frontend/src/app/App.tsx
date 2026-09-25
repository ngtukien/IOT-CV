/**
 * Khung một trang duy nhất của GCS. Không có router: GCS không có trang thứ hai.
 *
 * Vị trí các ô viết sẵn cho Phase 09/10 (xem `layout.css`), để các phase sau
 * chỉ thay NỘI DUNG ô, không phải sắp xếp lại lưới.
 *
 * Phase 08 chỉ NHÌN: chưa có nút nào gửi lệnh bay (SAFETY.md mục 1).
 * Phase 09 thêm bản đồ và trình soạn mission. Lệnh duy nhất nó gửi là NẠP
 * mission (`auto_start: false`) — nạp không làm drone bay.
 */
import { Crosshair, Radar, Video } from "lucide-react";

import { ComingSoon } from "@/components/ComingSoon";
import { ConnectionBar } from "@/components/ConnectionBar";
import { EventLog } from "@/components/EventLog";
import { Hud } from "@/components/Hud/Hud";
import { MapView } from "@/components/MapView/MapView";
import { MissionEditor } from "@/components/MissionEditor/MissionEditor";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMissionReadback } from "@/hooks/useMissionReadback";
import { useWebSocket } from "@/hooks/useWebSocket";

import "./layout.css";

export default function App() {
  useWebSocket();
  useMissionReadback();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh flex-col">
        <ConnectionBar />
        <main className="gcs-grid mx-auto w-full max-w-[1920px] p-3">
          <Hud style={{ gridArea: "hud" }} />
          <MapView style={{ gridArea: "map" }} />
          <ComingSoon
            title="Video"
            icon={Video}
            phase="10"
            description="Hình từ camera trên drone, kèm khung nhận diện vật thể vẽ đè lên."
            style={{ gridArea: "video" }}
          />
          <MissionEditor style={{ gridArea: "mission" }} />
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
