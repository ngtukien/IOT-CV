/**
 * Trang CAMERA & AI — luồng hình, khung nhận diện, thống kê bộ nhận diện, và
 * đường đi của dữ liệu hình ảnh (môn Xử lý ảnh / IoT).
 *
 * Mọi con số ở đây đo TẠI TRÌNH DUYỆT từ các gói `detection` nhận được; bộ
 * nhận diện hiện là NGUỒN GIẢ của Phase 07 cho tới AI Phase 2 — trang ghi rõ
 * điều đó thay vì trình bày box giả như kết quả thật.
 *
 * Mất camera KHÔNG ảnh hưởng bay (SAFETY.md mục 9): trang này chỉ nhìn.
 */
import { BarChart3, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, KeyValue, KeyValueList, PageHeader, Tag } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { VideoPanel } from "@/components/VideoPanel/VideoPanel";
import { NO_VALUE } from "@/lib/format";
import type { DetectionPayload } from "@/lib/protocol";
import { useSessionStore } from "@/store/session";
import { useTelemetryStore } from "@/store/telemetry";

/** Giữ chừng này gói `detection` gần nhất để thống kê. */
const DETECTION_WINDOW = 120;

interface DetStats {
  frames: number;
  boxes: number;
  byLabel: [string, number][];
  meanConf: number | null;
  bins: number[];
  lastSize: string | null;
}

function useDetectionStats(): DetStats {
  const [stats, setStats] = useState<DetStats>({ frames: 0, boxes: 0, byLabel: [], meanConf: null, bins: Array(10).fill(0), lastSize: null });
  useEffect(() => {
    const buf: DetectionPayload[] = [];
    let last: DetectionPayload | null = null;
    const unsub = useTelemetryStore.subscribe((s) => {
      if (s.detection && s.detection !== last) {
        last = s.detection;
        buf.push(s.detection);
        if (buf.length > DETECTION_WINDOW) buf.shift();
      }
    });
    // Tính lại mỗi giây, không theo từng gói.
    const timer = setInterval(() => {
      const labels = new Map<string, number>();
      const bins = Array(10).fill(0) as number[];
      let n = 0;
      let sum = 0;
      for (const d of buf) {
        for (const b of d.boxes ?? []) {
          labels.set(b.label, (labels.get(b.label) ?? 0) + 1);
          bins[Math.min(9, Math.floor(b.confidence * 10))] += 1;
          sum += b.confidence;
          n += 1;
        }
      }
      setStats({
        frames: buf.length,
        boxes: n,
        byLabel: [...labels.entries()].sort((a, b) => b[1] - a[1]),
        meanConf: n ? sum / n : null,
        bins,
        lastSize: last ? `${last.width}×${last.height}` : null,
      });
    }, 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);
  return stats;
}

/** Biểu đồ cột độ tin cậy 0–100 % (một chuỗi, một trục). */
function ConfidenceBars({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins);
  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]" role="img" aria-label="Phân bố độ tin cậy của các box">
        {bins.map((v, i) => (
          <div key={i} className="group relative flex-1" title={`${i * 10}–${i * 10 + 10}%: ${v} box`}>
            <div className="rounded-t-[4px] bg-series-1 transition-[height] duration-500" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/** Sơ đồ đường đi của hình ảnh: hai luồng tách nhau (video ≠ box). */
function Pipeline() {
  const nodes = [
    { x: 20, y: 40, t: "ESP32-CAM", s: "MJPEG · QVGA/VGA" },
    { x: 230, y: 40, t: "Backend", s: "fan-out, không mã hoá lại" },
    { x: 440, y: 40, t: "Trình duyệt", s: "<img> + canvas" },
    { x: 230, y: 150, t: "Bộ nhận diện", s: "3–5 khung/giây" },
  ];
  return (
    <svg viewBox="0 0 620 230" className="w-full" role="img" aria-label="Đường đi của dữ liệu hình ảnh">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="currentColor" />
        </marker>
      </defs>
      <g className="text-muted-foreground" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)">
        <path d="M180 70 H228" />
        <path d="M390 70 H438" className="link-flow" strokeDasharray="6 5" />
        <path d="M310 100 V148" />
        <path d="M390 180 C 470 180 520 160 520 102" strokeDasharray="3 4" />
      </g>
      <text x="410" y="62" className="fill-muted-foreground text-[10px]" textAnchor="middle">video</text>
      <text x="498" y="198" className="fill-muted-foreground text-[10px]">box qua WebSocket</text>
      {nodes.map((n) => (
        <g key={n.t}>
          <rect x={n.x} y={n.y} width="160" height="60" rx="12" className="fill-foreground/[0.04] stroke-border" />
          <text x={n.x + 14} y={n.y + 26} className="fill-foreground font-display text-[14px] font-semibold">{n.t}</text>
          <text x={n.x + 14} y={n.y + 45} className="fill-muted-foreground text-[11px]">{n.s}</text>
        </g>
      ))}
    </svg>
  );
}

export default function VisionPage() {
  const stats = useDetectionStats();
  const rate = useSessionStore((s) => s.rates.detection ?? 0);
  const camera = useTelemetryStore((s) => s.status?.camera);
  const maxLabel = useMemo(() => Math.max(1, ...stats.byLabel.map(([, n]) => n)), [stats.byLabel]);

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        eyebrow="Vận hành · thị giác máy"
        title="Camera & AI"
        description="Luồng hình từ camera trên drone và khung nhận diện vẽ chồng lên. Hai luồng chạy riêng, nên mất camera hay bộ nhận diện chết đều không ảnh hưởng telemetry và điều khiển."
        actions={camera?.fake ? <Tag tone="warn" title="Phase 07: video mẫu lặp lại + box chạy vòng">Nguồn giả</Tag> : camera ? <Tag tone="ok">Camera thật</Tag> : null}
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <VideoPanel title="Camera trên drone" tools className="min-h-[420px] xl:h-[min(70dvh,720px)]" />
        <div className="flex flex-col gap-3">
          <Panel title="Bộ nhận diện" subtitle={`${DETECTION_WINDOW} gói gần nhất`} icon={BarChart3} bodyClassName="flex flex-col gap-4 p-3">
            <KeyValueList>
              <KeyValue label="Nhịp gói detection" value={`${rate} /s`} />
              <KeyValue label="Cỡ khung gốc" value={stats.lastSize ?? NO_VALUE} />
              <KeyValue label="Box trong cửa sổ" value={String(stats.boxes)} />
              <KeyValue label="Độ tin cậy trung bình" value={stats.meanConf === null ? NO_VALUE : `${(stats.meanConf * 100).toFixed(1)}%`} />
              <KeyValue label="Camera" value={camera ? (camera.available ? "có hình" : "mất hình") : NO_VALUE} tone={camera ? (camera.available ? "ok" : "warn") : undefined} />
            </KeyValueList>
            <div>
              <p className="eyebrow mb-2 text-[10px]">Phân bố độ tin cậy</p>
              <ConfidenceBars bins={stats.bins} />
            </div>
            <div>
              <p className="eyebrow mb-2 text-[10px]">Theo nhãn</p>
              {stats.byLabel.length === 0 ? (
                <EmptyState icon={BarChart3} title="Chưa có box nào" className="py-4">
                  Bộ nhận diện thật đến ở AI Phase 2.
                </EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {stats.byLabel.map(([label, n]) => (
                    <li key={label} className="grid grid-cols-[6rem_minmax(0,1fr)_3rem] items-center gap-2 text-[12.5px]">
                      <span className="truncate">{label}</span>
                      <span className="h-2 rounded-[3px] bg-series-1" style={{ width: `${(n / maxLabel) * 100}%` }} />
                      <span className="num text-right text-muted-foreground">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <Panel title="Đường đi của hình ảnh" subtitle="Vì sao video không bị kéo chậm theo tốc độ AI" icon={Workflow} bodyClassName="p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Pipeline />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Một kết nối tới camera.</span> ESP32-CAM chỉ phục vụ tốt một client, và backend đã
              chiếm chỗ đó để chạy AI — nên backend làm trạm chia (fan-out) cho mọi tab, chép byte, không giải mã lại.
            </p>
            <p>
              <span className="font-medium text-foreground">Box đi đường riêng.</span> Video chạy 10–44 khung/giây, bộ nhận diện 3–5 khung/giây. Vẽ box
              lên chính ảnh sẽ kéo video xuống tốc độ AI; gửi box qua WebSocket rồi vẽ lên canvas phủ trên thì không. Cái giá: box trễ vài chục ms.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
