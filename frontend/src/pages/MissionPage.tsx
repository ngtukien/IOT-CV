/**
 * Trang NHIỆM VỤ — soạn lộ trình bay.
 *
 *   ┌──────── bản đồ soạn (⇄ xem trước 3D) ────────┐┌── bảng mission ──┐
 *   │ bấm thêm · vẽ · kéo điểm · "+" chèn giữa chặng ││ độ cao từng điểm │
 *   │                                                ││ kiểm tra · NẠP   │
 *   ├── hồ sơ độ cao ──┬── thống kê ──┬── mẫu lộ trình ──┬── thư viện ──┤
 *
 * Mọi thao tác ở đây chỉ chạm BẢN NHÁP trong trình duyệt. Thứ duy nhất đi
 * xuống drone là nút NẠP MISSION — backend kiểm lại toàn bộ, nạp, rồi đọc ngược
 * để so khớp (Phase 07 §7.4). Bắt đầu bay mission (AUTO) là nút ở trang Bay,
 * có hộp xác nhận.
 */
import { Map as MapIcon, Mountain } from "lucide-react";
import { Suspense, lazy, useState } from "react";

import { IconTwin } from "@/components/icons";
import { PageHeader } from "@/components/kit";
import { MapView } from "@/components/MapView/MapView";
import { AltitudeProfile } from "@/components/MissionEditor/AltitudeProfile";
import { MissionEditor } from "@/components/MissionEditor/MissionEditor";
import { LibraryCard, RouteStatsCard, TemplatesCard } from "@/components/MissionEditor/RoutePlanner";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/ui/segmented";
import { useSettings } from "@/store/settings";

const TwinScene = lazy(() => import("@/components/twin/TwinScene").then((m) => ({ default: m.TwinScene })));

type PlanView = "map" | "3d";

export default function MissionPage() {
  const [view, setView] = useState<PlanView>("map");
  const quality = useSettings((s) => s.twinQuality);
  const ground = useSettings((s) => s.twinGround);

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="Vận hành · lập kế hoạch bay"
        title="Nhiệm vụ"
        description="Soạn lộ trình trên bản đồ, kiểm tra theo giới hạn của backend, xem trước 3D rồi nạp xuống flight controller. Không gì rời trình duyệt cho tới khi bấm NẠP MISSION."
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <Panel
          title={view === "map" ? "Bản đồ soạn lộ trình" : "Xem trước 3D"}
          subtitle={view === "map" ? "Bấm để thêm · kéo để dời · “+” để chèn giữa chặng" : "Cột dóng = độ cao từng điểm · trụ vàng = rào phần mềm"}
          icon={view === "map" ? MapIcon : IconTwin}
          variant="instrument"
          testId="plan-map-panel"
          className="h-[min(72dvh,760px)] min-h-[480px]"
          actions={
            <Segmented<PlanView>
              label="Khung soạn"
              value={view}
              onChange={setView}
              size="xs"
              options={[
                { value: "map", label: "Bản đồ", icon: MapIcon, testId: "plan-view-map" },
                { value: "3d", label: "Xem 3D", icon: IconTwin, testId: "plan-view-3d" },
              ]}
            />
          }
        >
          {view === "map" ? (
            <MapView mode="plan" className="absolute inset-0 min-h-0" />
          ) : (
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Đang dựng khung 3D…</div>}>
              <TwinScene camera="orbit" quality={quality} ground={ground} effects showBeam={false} className="absolute inset-0" />
            </Suspense>
          )}
        </Panel>

        <MissionEditor className="xl:max-h-[min(72dvh,760px)] xl:overflow-y-auto" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Hồ sơ độ cao" subtitle="Độ cao theo quãng đường bay · dải xanh = vùng cho phép" icon={Mountain} bodyClassName="p-3">
          <AltitudeProfile />
        </Panel>
        <RouteStatsCard />
        <TemplatesCard />
        <LibraryCard />
      </div>
    </div>
  );
}
