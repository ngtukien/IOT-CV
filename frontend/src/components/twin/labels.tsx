/**
 * Nhãn chữ gắn vào vật thể 3D — THAY cho `<Html>` của drei.
 *
 * Vì sao không dùng `<Html>`: mỗi nhãn của drei là một React root riêng; khi rời
 * trang 3D, các root đó bị gỡ ĐỒNG BỘ giữa lúc React đang render trang mới
 * ("Attempted to synchronously unmount a root while React was already
 * rendering") → lỗi `removeChild` và trang kế tiếp hiện chậm (bắt được khi chạy
 * E2E đi qua mọi tab, 25/09/2026).
 *
 * Cách ở đây: nhãn là thẻ DOM THƯỜNG trong lớp phủ NGOÀI canvas (`LabelOverlay`),
 * do React của trang quản lý. Trong canvas, `SceneLabel` chỉ ghi toạ độ thế giới;
 * `LabelProjector` chiếu ra màn hình mỗi khung hình và đặt `transform` thẳng lên
 * thẻ — không re-render React ở 60 fps.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import { create } from "zustand";

import { cn } from "@/lib/utils";

export type LabelTone = "info" | "amber" | "part";

interface LabelSpec {
  id: string;
  text: ReactNode;
  tone: LabelTone;
}

interface Anchor {
  world: THREE.Vector3;
  opacity: () => number;
}

const useLabels = create<{ labels: Record<string, LabelSpec>; put(s: LabelSpec): void; drop(id: string): void }>((set) => ({
  labels: {},
  put: (s) => set((st) => ({ labels: { ...st.labels, [s.id]: s } })),
  drop: (id) =>
    set((st) => {
      const { [id]: _gone, ...rest } = st.labels;
      return { labels: rest };
    }),
}));

const anchors = new Map<string, Anchor>();
const elements = new Map<string, HTMLDivElement>();
const ONE = () => 1;

/** Đặt trong cảnh: nhãn `text` bám theo vị trí của chính nhóm này (+ `offset`). */
export function SceneLabel({
  id,
  text,
  tone = "info",
  offset = [0, 0, 0],
  opacity = ONE,
}: {
  id: string;
  text: ReactNode;
  tone?: LabelTone;
  offset?: [number, number, number];
  opacity?: () => number;
}) {
  const group = useRef<THREE.Group>(null);
  const world = useRef(new THREE.Vector3());
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const put = useLabels((s) => s.put);
  const drop = useLabels((s) => s.drop);

  useEffect(() => {
    put({ id, text, tone });
    anchors.set(id, { world: world.current, opacity: () => opacityRef.current() });
    return () => {
      anchors.delete(id);
      drop(id);
    };
  }, [id, text, tone, put, drop]);

  useFrame(() => {
    group.current?.getWorldPosition(world.current);
  });

  return <group ref={group} position={offset} />;
}

const tmp = new THREE.Vector3();

/** Đặt MỘT lần trong canvas: chiếu mọi nhãn ra toạ độ màn hình mỗi khung hình. */
export function LabelProjector() {
  useFrame(({ camera, size }) => {
    for (const [id, a] of anchors) {
      const el = elements.get(id);
      if (!el) continue;
      tmp.copy(a.world).project(camera);
      const behind = tmp.z > 1 || tmp.z < -1;
      const op = behind ? 0 : a.opacity();
      if (op <= 0.01) {
        el.style.visibility = "hidden";
        continue;
      }
      const x = (tmp.x * 0.5 + 0.5) * size.width;
      const y = (-tmp.y * 0.5 + 0.5) * size.height;
      el.style.visibility = "visible";
      el.style.opacity = String(op);
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  });
  return null;
}

const TONE: Record<LabelTone, string> = {
  info: "border-white/10 bg-black/65 text-white",
  amber: "border-[#f2b53a]/60 bg-black/65 text-[#f2b53a]",
  part: "border-[#56e0f3]/55 bg-[#0b1220]/85 text-[#dff9ff] shadow-lg",
};

/** Đặt NGOÀI canvas, cùng khung cha (position: relative): nơi các thẻ nhãn thật sự sống. */
export function LabelOverlay() {
  const labels = useLabels((s) => s.labels);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Object.values(labels).map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            if (el) elements.set(l.id, el);
            else elements.delete(l.id);
          }}
          className={cn("absolute top-0 left-0 w-max rounded-md border px-2 py-0.5 text-[11px] leading-snug font-medium whitespace-nowrap", TONE[l.tone])}
          style={{ visibility: "hidden" }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}
