/**
 * Các thành phần của khung 3D, dùng chung cho trang Không gian 3D, khung 3D ở
 * trang Bay và bản xem trước mission. Toạ độ: `lib/enu.ts` (x = đông, y = lên,
 * z = −bắc), gốc ở điểm home.
 *
 * Luật hiển thị giữ y như bản đồ 2D:
 *  - bản nháp = vàng nét đứt, đã nạp (FC đọc lại) = xanh lá nét liền;
 *  - rào ảo = giới hạn PHẦN MỀM, ghi rõ là lớp phụ (SAFETY.md mục 8);
 *  - không có số đo thì không vẽ như thể có (tia TFmini "không biết" là nét đứt xám).
 */
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useHome, useMissionDraft } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";
import { toScene } from "@/lib/enu";
import type { Origin } from "@/lib/enu";
import { mapBase, tileUrl } from "@/lib/mapLayers";
import type { MapBaseId } from "@/lib/mapLayers";
import { MAV_CMD } from "@/lib/missionRules";
import type { MissionWaypoint } from "@/lib/protocol";
import { tileToLonLat, tilesAround } from "@/lib/tiles";
import { telemetryHistory, useHistoryTick } from "@/store/history";
import { useMissionStore } from "@/store/mission";
import { useTelemetryStore } from "@/store/telemetry";

import { fallbackGroundTexture, landingPadTexture } from "./textures";

/**
 * Mức zoom của ảnh mặt đất: z19 ≈ 75 m mỗi ô, 0,3 m mỗi điểm ảnh ở vĩ độ TP.HCM.
 * z18 (0,6 m/px) trông nhoè hẳn khi camera bám đuôi ở độ cao vài mét — đã thử.
 */
export const GROUND_ZOOM = 19;

// ---------------------------------------------------------------------------
// Gốc toạ độ
// ---------------------------------------------------------------------------

/**
 * Gốc của cảnh: điểm home; chưa có home thì vị trí đầu tiên thấy được. Gốc
 * KHÔNG đổi theo từng gói telemetry — chỉ đổi khi home đổi (ARM ở chỗ mới).
 */
export function useSceneOrigin(): Origin | null {
  const home = useHome();
  const lat = useTelemetryStore((s) => s.telemetry?.lat ?? null);
  const lon = useTelemetryStore((s) => s.telemetry?.lon ?? null);
  const [first, setFirst] = useState<Origin | null>(null);
  if (!home && !first && lat !== null && lon !== null) setFirst({ lat, lon });
  return useMemo(() => (home ? { lat: home[0], lon: home[1] } : first), [home, first]);
}

// ---------------------------------------------------------------------------
// Mặt đất: ảnh bản đồ thật ghép ô, lưới dự phòng khi không có mạng
// ---------------------------------------------------------------------------

function GroundTile({ origin, x, y, z, layer, onFail }: { origin: Origin; x: number; y: number; z: number; layer: MapBaseId; onFail(): void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const nw = tileToLonLat(x, y, z);
  const se = tileToLonLat(x + 1, y + 1, z);
  const [x0, , z0] = toScene(origin, nw.lat, nw.lon);
  const [x1, , z1] = toScene(origin, se.lat, se.lon);

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const url = tileUrl(mapBase(layer).base, z, x, y);
    loader.load(
      url,
      (t) => {
        if (!alive) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        setTexture(t);
      },
      undefined,
      () => alive && onFail(),
    );
    return () => {
      alive = false;
    };
  }, [x, y, z, layer, onFail]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;
  return (
    <mesh position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      {/* Ảnh vệ tinh ĐÃ chứa ánh sáng thật của buổi chụp — chiếu sáng thêm nhiều là cháy màu. */}
      <meshStandardMaterial map={texture} roughness={1} metalness={0} envMapIntensity={0.25} />
    </mesh>
  );
}

export function Ground({ origin, layer, radius }: { origin: Origin | null; layer: MapBaseId | "grid"; radius: number }) {
  const [failures, setFailures] = useState(0);
  const onFail = useMemo(() => () => setFailures((f) => f + 1), []);
  const tiles = useMemo(() => (origin && layer !== "grid" ? tilesAround(origin.lat, origin.lon, GROUND_ZOOM, radius) : []), [origin, layer, radius]);
  const fallback = useMemo(() => fallbackGroundTexture(), []);

  return (
    <group>
      {/* Nền rộng dưới cùng — hiện ra ở mép xa và khi mất mạng. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial map={fallback} roughness={1} color="#8a9a80" />
      </mesh>
      {origin && layer !== "grid"
        ? tiles.map((t) => <GroundTile key={`${layer}-${t.x}-${t.y}`} origin={origin} {...t} layer={layer} onFail={onFail} />)
        : null}
      {failures > 0 && failures >= tiles.length && tiles.length > 0 ? (
        <Html position={[0, 0.5, 0]} center zIndexRange={[5, 0]}>
          <span className="rounded-md bg-black/70 px-2 py-1 text-[11px] whitespace-nowrap text-white">Không tải được ảnh mặt đất — đang dùng nền dựng sẵn</span>
        </Html>
      ) : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bãi đáp ở home
// ---------------------------------------------------------------------------

export function HomePad() {
  const tex = useMemo(() => landingPadTexture(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[1.1, 64]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rào ảo phần mềm: trụ "trường năng lượng" (shader riêng)
// ---------------------------------------------------------------------------

const fenceVertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fenceFragment = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform vec3 uColor;
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float h = clamp(vPos.y / uHeight + 0.5, 0.0, 1.0);
    // Viền sáng theo góc nhìn (fresnel) — mép trụ đậm, giữa trong suốt.
    float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.2);
    // Vạch ngang chạy lên chậm: đọc được là "tường", không che drone.
    float lines = smoothstep(0.92, 1.0, fract(h * 12.0 - uTime * 0.15));
    float base = smoothstep(0.08, 0.0, h) * 0.6;
    float alpha = (0.05 + fres * 0.45 + lines * 0.18 + base) * (1.0 - smoothstep(0.85, 1.0, h) * 0.6);
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function GeofenceVolume() {
  const limits = useLimits();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fenceVertex,
        fragmentShader: fenceFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uHeight: { value: 10 }, uColor: { value: new THREE.Color("#f2b53a") } },
      }),
    [],
  );
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
  });
  useEffect(() => () => material.dispose(), [material]);
  const h = limits?.max_alt ?? 10;
  useEffect(() => {
    material.uniforms.uHeight.value = h;
  }, [material, h]);
  if (!limits) return null;
  const r = limits.max_distance_home;
  const ring = Array.from({ length: 97 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    return [Math.cos(a) * r, 0.05, Math.sin(a) * r] as [number, number, number];
  });
  return (
    <group>
      <mesh position={[0, h / 2, 0]} material={material}>
        <cylinderGeometry args={[r, r, h, 96, 1, true]} />
      </mesh>
      <Line points={ring} color="#f2b53a" lineWidth={2} dashed dashSize={2} gapSize={1.5} />
      <Html position={[0, h + 0.8, -r]} center zIndexRange={[5, 0]} distanceFactor={60}>
        <div className="w-max rounded-md border border-[#f2b53a]/60 bg-black/65 px-2 py-1 text-center text-[11px] leading-tight text-[#f2b53a]">
          Rào phần mềm {r} m · trần {h} m
          <br />
          <span className="text-white/75">lớp phụ — rào thật là FENCE_* trên FC</span>
        </div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mission 3D: cột độ cao + đường bay
// ---------------------------------------------------------------------------

function missionScenePoints(origin: Origin, items: readonly MissionWaypoint[], home: [number, number] | null) {
  const out: { label: string; pos: [number, number, number]; kind: "takeoff" | "wp" | "end" }[] = [];
  let lastAlt = 0;
  for (const it of items) {
    const cmd = it.command ?? MAV_CMD.NAV_WAYPOINT;
    if (cmd === MAV_CMD.NAV_TAKEOFF && home) {
      out.push({ label: `Cất cánh ${it.alt} m`, pos: toScene(origin, home[0], home[1], it.alt), kind: "takeoff" });
      lastAlt = it.alt;
    } else if (cmd === MAV_CMD.NAV_WAYPOINT && !(it.lat === 0 && it.lon === 0)) {
      const alt = Number.isFinite(it.alt) ? it.alt : 0;
      out.push({ label: `WP${it.seq} · ${alt} m`, pos: toScene(origin, it.lat, it.lon, alt), kind: "wp" });
      lastAlt = alt;
    } else if (cmd === MAV_CMD.NAV_RETURN_TO_LAUNCH && home) {
      out.push({ label: "Về nhà", pos: toScene(origin, home[0], home[1], lastAlt), kind: "end" });
    }
  }
  return out;
}

function MissionPath({ origin, items, kind }: { origin: Origin; items: readonly MissionWaypoint[]; kind: "draft" | "readback" }) {
  const home = useHome();
  const pts = useMemo(() => missionScenePoints(origin, items, home ? [home[0], home[1]] : null), [origin, items, home]);
  if (pts.length === 0) return null;
  const color = kind === "draft" ? "#f2b53a" : "#3ee6a0";
  const path: [number, number, number][] = [[0, 0.05, 0], ...pts.map((p) => p.pos)];
  return (
    <group>
      <Line points={path} color={color} lineWidth={kind === "draft" ? 2.5 : 4} dashed={kind === "draft"} dashSize={1.2} gapSize={0.8} />
      {pts
        .filter((p) => p.kind === "wp")
        .map((p) => (
          <group key={`${kind}-${p.label}`} position={[p.pos[0], 0, p.pos[2]]}>
            {/* cột dóng xuống đất: đọc được độ cao ngay bằng mắt */}
            <Line points={[[0, 0.05, 0], [0, p.pos[1], 0]]} color={color} lineWidth={1} transparent opacity={0.6} />
            <mesh position={[0, p.pos[1], 0]}>
              <octahedronGeometry args={[kind === "draft" ? 0.35 : 0.45, 0]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={kind === "draft" ? 0.6 : 1.1} roughness={0.35} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <ringGeometry args={[0.35, 0.5, 32]} />
              <meshBasicMaterial color={color} transparent opacity={0.7} />
            </mesh>
            {kind === "draft" ? (
              <Html position={[0, p.pos[1] + 0.9, 0]} center zIndexRange={[6, 0]} distanceFactor={45}>
                <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-[#f2b53a]">{p.label}</span>
              </Html>
            ) : null}
          </group>
        ))}
    </group>
  );
}

export function Mission3D({ origin }: { origin: Origin }) {
  const { items } = useMissionDraft();
  const readback = useMissionStore((s) => s.readback);
  const hasDraft = items.some((it) => it.command === MAV_CMD.NAV_WAYPOINT);
  return (
    <group>
      {readback ? <MissionPath origin={origin} items={readback.waypoints} kind="readback" /> : null}
      {hasDraft ? <MissionPath origin={origin} items={items} kind="draft" /> : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vệt bay 3D (có độ cao) — từ lịch sử telemetry
// ---------------------------------------------------------------------------

export function Trail3D({ origin }: { origin: Origin }) {
  const version = useHistoryTick(700);
  const points = useMemo(() => {
    const out: [number, number, number][] = [];
    let last: [number, number, number] | null = null;
    for (const s of telemetryHistory.samples()) {
      const d = s.d;
      if (!d.armed || d.lat == null || d.lon == null) continue;
      const p = toScene(origin, d.lat, d.lon, Math.max(0, d.relative_alt ?? 0));
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) < 0.4) continue;
      out.push(p);
      last = p;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, version]);
  const colors = useMemo(() => points.map((_, i) => new THREE.Color().setHSL(0.52, 0.85, 0.35 + 0.35 * (i / Math.max(1, points.length - 1)))), [points]);
  if (points.length < 2) return null;
  return <Line points={points} vertexColors={colors} lineWidth={3} />;
}

// ---------------------------------------------------------------------------
// Tia TFmini Plus (gắn vào khung của drone, mũi = −Z)
// ---------------------------------------------------------------------------

const BEAM_COLOR = { OFF: "#3ee6a0", NEAR: "#f2b53a", ACTIVE: "#ff5a52", UNKNOWN: "#8b95a5" } as const;

export function RangefinderBeam() {
  const limits = useLimits();
  const group = useRef<THREE.Group>(null);
  const cone = useRef<THREE.Mesh>(null);
  const hit = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#3ee6a0", transparent: true, opacity: 0.22, depthWrite: false }), []);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2), toneMapped: false }), []);
  const max = limits?.rangefinder_max_m ?? 6;

  useFrame(() => {
    const t = useTelemetryStore.getState().telemetry;
    const d = t?.obstacle_distance;
    const state = t?.avoid_state ?? "UNKNOWN";
    const known = typeof d === "number" && Number.isFinite(d);
    const len = known ? Math.min(d, max) : max;
    if (cone.current) {
      cone.current.scale.set(1, len, 1);
      cone.current.position.z = -len / 2;
    }
    mat.color.set(BEAM_COLOR[state]);
    mat.opacity = known ? 0.26 : 0.08;
    if (hit.current) {
      hit.current.visible = known && d <= max;
      hit.current.position.z = -len;
      hitMat.color.set(BEAM_COLOR[state]).multiplyScalar(4);
    }
  });

  // TFmini Plus: góc mở 3.6° → bán kính ở cuối tia = len · tan(1.8°). Hình nón đơn vị cao 1 theo trục Y.
  const radiusAtOne = Math.tan(THREE.MathUtils.degToRad(1.8));
  return (
    <group ref={group} position={[0, 0.21, -0.12]}>
      <mesh ref={cone} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
        <cylinderGeometry args={[radiusAtOne, 0.004, 1, 16, 1, true]} />
      </mesh>
      <mesh ref={hit} material={hitMat}>
        <sphereGeometry args={[0.05, 12, 10]} />
      </mesh>
    </group>
  );
}
