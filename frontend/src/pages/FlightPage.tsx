/**
 * Trang BAY — buồng lái. Mọi thứ cần khi drone đang trên không nằm trên MỘT màn
 * hình, không phải cuộn tìm:
 *
 *   ┌ màn hình bay ┐┌──── khung chính: Bản đồ ⇄ 3D ────┐┌ chế độ bay ┐
 *   │ PFD + ô số   ││                                    ││ HOLD, mode │
 *   ├── nhật ký ───┤│                                    ││ ARM, TKOFF │
 *   │              │├────── video ──────┬── radar ───────┤├─ lái tay ──┤
 *   └──────────────┘└───────────────────┴────────────────┘└────────────┘
 *
 * Soạn mission ở trang Nhiệm vụ — ở đây bấm bản đồ KHÔNG thêm điểm (một cú bấm
 * nhầm lúc đang bay không được đổi bản nháp). Bản nháp và mission đã nạp vẫn
 * được vẽ để phi công thấy đường bay.
 *
 * Khung 3D nạp khi bật (three.js nặng): mở trang Bay không phải chờ nó.
 */
import { ArrowUpRight, Map as MapIcon } from "lucide-react";
import { Suspense, lazy } from "react";
import { Link } from "react-router";

import { EventLog } from "@/components/EventLog";
import { Hud } from "@/components/Hud/Hud";
import { IconTwin } from "@/components/icons";
import { ManualControl } from "@/components/ManualControl/ManualControl";
import { MapView } from "@/components/MapView/MapView";
import { ModePanel } from "@/components/ModePanel";
import { ObstaclePanel } from "@/components/ObstaclePanel";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/ui/segmented";
import { VideoPanel } from "@/components/VideoPanel/VideoPanel";
import { useSettings } from "@/store/settings";
import type { CockpitView } from "@/store/settings";

const TwinScene = lazy(() => import("@/components/twin/TwinScene").then((m) => ({ default: m.TwinScene })));

function Loading3D() {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground" aria-busy="true">
      Đang dựng khung 3D…
    </div>
  );
}

function MainView() {
  const view = useSettings((s) => s.cockpitView);
  const quality = useSettings((s) => s.twinQuality);
  const ground = useSettings((s) => s.twinGround);
  const effects = useSettings((s) => s.twinEffects);
  const set = useSettings((s) => s.set);

  return (
    <Panel
      title={view === "map" ? "Bản đồ" : "Không gian 3D"}
      subtitle={view === "map" ? "Drone, vệt bay, home, rào ảo, mission" : "Góc máy bám đuôi · kéo sang trang 3D để đổi góc"}
      icon={view === "map" ? MapIcon : IconTwin}
      variant="instrument"
      testId="map-panel"
      className="min-h-[420px] flex-1"
      actions={
        <>
          <Segmented<CockpitView>
            label="Khung chính"
            value={view}
            onChange={(v) => set("cockpitView", v)}
            size="xs"
            options={[
              { value: "map", label: "Bản đồ", icon: MapIcon, testId: "view-map" },
              { value: "3d", label: "3D", icon: IconTwin, testId: "view-3d" },
            ]}
          />
          <Link
            to={view === "map" ? "/mission" : "/3d"}
            className="hidden h-7 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground lg:flex"
          >
            {view === "map" ? "Soạn mission" : "Mở trang 3D"} <ArrowUpRight className="size-3" />
          </Link>
        </>
      }
    >
      {view === "map" ? (
        <MapView mode="flight" className="absolute inset-0 min-h-0" />
      ) : (
        <Suspense fallback={<Loading3D />}>
          <TwinScene camera="chase" quality={quality} ground={ground} effects={effects} className="absolute inset-0" />
        </Suspense>
      )}
    </Panel>
  );
}

export default function FlightPage() {
  return (
    <div className="grid gap-3 p-3 xl:h-[calc(100dvh-5.75rem)] xl:min-h-[760px] xl:grid-cols-[minmax(360px,400px)_minmax(0,1fr)_minmax(330px,370px)]">
      {/* Cột trái: màn hình bay + nhật ký (cuộn riêng khi màn thấp) */}
      <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto">
        <Hud className="shrink-0" />
        <EventLog className="min-h-[220px] flex-1" />
      </div>

      {/* Giữa: khung chính + hàng dưới (video, radar) */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex min-h-[420px] flex-1 flex-col">
          <MainView />
        </div>
        <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:h-[300px]">
          <VideoPanel className="min-h-[260px]" />
          <ObstaclePanel />
        </div>
      </div>

      {/* Cột phải: chế độ bay + lái tay */}
      <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto xl:pr-0.5">
        <ModePanel className="shrink-0" />
        <ManualControl className="shrink-0" />
      </div>
    </div>
  );
}
