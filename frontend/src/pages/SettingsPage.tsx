/**
 * Trang CÀI ĐẶT — chỉ đổi cách HIỂN THỊ trên máy này (lưu `localStorage`).
 * Không cài đặt nào ở đây đổi được giới hạn an toàn hay hành vi bay: những thứ
 * đó do backend quyết (xem trang Hệ thống).
 */
import { Box, Keyboard, Map as MapIcon, Palette, RotateCcw, Volume2 } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { beep, hasVietnameseVoice, speak, unlockAudio } from "@/lib/announcer";
import { MAP_BASES } from "@/lib/mapLayers";
import type { MapBaseId } from "@/lib/mapLayers";
import { useSettings } from "@/store/settings";
import type { MotionSetting, ThemeSetting, TwinGround, TwinQuality } from "@/store/settings";
import { useUiStore } from "@/store/ui";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
      <div className="min-w-0 max-w-md">
        <p className="text-[13.5px] font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const s = useSettings();
  const setShortcuts = useUiStore((u) => u.setShortcuts);

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="Hệ thống"
        title="Cài đặt"
        description="Tuỳ chỉnh hiển thị trên máy này. Giới hạn an toàn không nằm ở đây — chúng do backend quyết."
        actions={
          <Button variant="outline" size="sm" onClick={() => s.reset()}>
            <RotateCcw aria-hidden /> Về mặc định
          </Button>
        }
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Giao diện" icon={Palette} bodyClassName="divide-y divide-border px-4">
          <Row label="Theme" hint="Ngày: tương phản cao, đọc được ngoài nắng. Màn hình bay luôn nền tối.">
            <Segmented<ThemeSetting>
              label="Theme"
              value={s.theme}
              onChange={(v) => s.set("theme", v)}
              options={[
                { value: "night", label: "Đêm" },
                { value: "day", label: "Ngày" },
                { value: "system", label: "Theo máy" },
              ]}
            />
          </Row>
          <Row label="Chuyển động" hint="Tắt hết hiệu ứng chuyển trang, dòng chảy, nhấp nháy.">
            <Segmented<MotionSetting>
              label="Chuyển động"
              value={s.motion}
              onChange={(v) => s.set("motion", v)}
              options={[
                { value: "auto", label: "Theo máy" },
                { value: "off", label: "Tắt" },
              ]}
            />
          </Row>
          <Row label="Phím tắt" hint="Alt + số để đổi trang, H để HOLD, phím ? để xem bảng.">
            <Button variant="outline" size="sm" onClick={() => setShortcuts(true)}>
              <Keyboard aria-hidden /> Xem phím tắt
            </Button>
          </Row>
        </Panel>

        <Panel title="Bản đồ" icon={MapIcon} bodyClassName="divide-y divide-border px-4">
          <Row label="Bản đồ nền mặc định">
            <select
              value={s.mapBase}
              onChange={(e) => s.set("mapBase", e.target.value as MapBaseId)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
              aria-label="Bản đồ nền"
            >
              {MAP_BASES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Vệt đường bay" hint="Chỉ ghi khi ARMED, bỏ qua dịch chuyển dưới 2 m.">
            <Switch checked={s.showTrail} onCheckedChange={(v) => s.set("showTrail", v)} />
          </Row>
          <Row label="Vòng giới hạn phần mềm" hint="Nhãn 'chỉ là lớp phụ' vẫn luôn hiện trong chú giải.">
            <Switch checked={s.showGeofence} onCheckedChange={(v) => s.set("showGeofence", v)} />
          </Row>
        </Panel>

        <Panel title="Không gian 3D" icon={Box} bodyClassName="divide-y divide-border px-4">
          <Row label="Chất lượng render" hint="Máy yếu chọn Thấp. Khung 3D tự hạ độ phân giải khi rớt khung hình.">
            <Segmented<TwinQuality>
              label="Chất lượng 3D"
              value={s.twinQuality}
              onChange={(v) => s.set("twinQuality", v)}
              options={[
                { value: "low", label: "Thấp" },
                { value: "medium", label: "Vừa" },
                { value: "high", label: "Cao" },
                { value: "ultra", label: "Cực cao" },
              ]}
            />
          </Row>
          <Row label="Mặt đất" hint="Ảnh bản đồ cần Internet; Offline dùng nền dựng sẵn.">
            <Segmented<TwinGround>
              label="Mặt đất 3D"
              value={s.twinGround}
              onChange={(v) => s.set("twinGround", v)}
              options={[
                { value: "satellite", label: "Vệ tinh" },
                { value: "hybrid", label: "Vệ tinh + nhãn" },
                { value: "streets", label: "Đường phố" },
                { value: "grid", label: "Offline" },
              ]}
            />
          </Row>
          <Row label="Hậu kỳ" hint="Bloom cho đèn, bóng khuất (AO), xoá phông ở góc máy điện ảnh.">
            <Switch checked={s.twinEffects} onCheckedChange={(v) => s.set("twinEffects", v)} />
          </Row>
        </Panel>

        <Panel title="Âm thanh cảnh báo" icon={Volume2} bodyClassName="divide-y divide-border px-4">
          <Row label="Tiếng bíp" hint="Mất liên lạc, ARM, pin yếu, đang phanh trước vật cản…">
            <Switch checked={s.audioAlerts} onCheckedChange={(v) => s.set("audioAlerts", v)} />
          </Row>
          <Row
            label="Giọng đọc"
            hint={hasVietnameseVoice() ? "Máy có giọng tiếng Việt." : "Máy chưa có giọng tiếng Việt — trình duyệt dùng giọng mặc định."}
          >
            <Switch checked={s.voice} onCheckedChange={(v) => s.set("voice", v)} />
          </Row>
          <Row label="Âm lượng">
            <div className="flex items-center gap-3">
              <Slider className="w-40" min={0} max={1} step={0.05} value={[s.volume]} onValueChange={([v]) => s.set("volume", v)} aria-label="Âm lượng" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  unlockAudio();
                  setTimeout(() => {
                    beep("caution", s.volume);
                    if (s.voice) speak("Kiểm tra âm thanh", s.volume);
                  }, 60);
                }}
              >
                Thử
              </Button>
            </div>
          </Row>
        </Panel>
      </div>
    </div>
  );
}
