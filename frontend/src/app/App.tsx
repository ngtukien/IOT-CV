/**
 * Khung một trang duy nhất của GCS. Không có router: GCS không có trang thứ hai.
 *
 * Vị trí các ô viết sẵn cho Phase 09/10 (xem `layout.css`), để các phase sau
 * chỉ thay NỘI DUNG ô, không phải sắp xếp lại lưới.
 *
 * Phase 08 chỉ NHÌN: chưa có nút nào gửi lệnh bay (SAFETY.md mục 1).
 * Phase 09 thêm bản đồ và trình soạn mission. Lệnh duy nhất nó gửi là NẠP
 * mission (`auto_start: false`) — nạp không làm drone bay.
 * Phase 10 thay ba ô chờ: chế độ bay + lái tay (ô `mode`), vật cản, video.
 * Mọi lệnh bay đều cần backend cho phép; lái tay còn cần operator TỰ bật
 * WEB CONTROL (SAFETY.md mục 4) — web không bao giờ tự giành quyền.
 */
import { ConnectionBar } from "@/components/ConnectionBar";
import { EventLog } from "@/components/EventLog";
import { Hud } from "@/components/Hud/Hud";
import { MapView } from "@/components/MapView/MapView";
import { ManualControl } from "@/components/ManualControl/ManualControl";
import { SafetyBanner } from "@/components/ManualControl/SafetyBanner";
import { MissionEditor } from "@/components/MissionEditor/MissionEditor";
import { ModePanel } from "@/components/ModePanel";
import { ObstaclePanel } from "@/components/ObstaclePanel";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VideoPanel } from "@/components/VideoPanel/VideoPanel";
import { useManualControl } from "@/hooks/useManualControl";
import { useMissionReadback } from "@/hooks/useMissionReadback";
import { useWebSocket } from "@/hooks/useWebSocket";

import "./layout.css";

export default function App() {
  useWebSocket();
  useMissionReadback();
  useManualControl();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh flex-col">
        {/* Dải cảnh báo quyền lái dính trên cùng, ngay trên thanh kết nối. */}
        <div className="sticky top-0 z-30">
          <SafetyBanner />
        </div>
        <ConnectionBar />
        <main className="gcs-grid mx-auto w-full max-w-[1920px] p-3">
          <Hud style={{ gridArea: "hud" }} />
          <MapView style={{ gridArea: "map" }} />
          <VideoPanel style={{ gridArea: "video" }} />
          <MissionEditor style={{ gridArea: "mission" }} />
          <div className="flex min-h-0 flex-col gap-3" style={{ gridArea: "mode" }}>
            <ModePanel />
            <ManualControl />
          </div>
          <ObstaclePanel style={{ gridArea: "obstacle" }} />
          <EventLog style={{ gridArea: "log" }} />
        </main>
      </div>
      <Toaster theme="dark" position="bottom-right" richColors />
    </TooltipProvider>
  );
}
