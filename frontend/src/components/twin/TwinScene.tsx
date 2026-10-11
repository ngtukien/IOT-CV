/**
 * Khung 3D "bản sao số" của drone — một `<Canvas>` three.js (React Three Fiber).
 *
 * Luồng dữ liệu KHÔNG qua React state ở nhịp khung hình: mỗi khung `useFrame`
 * đọc thẳng `useTelemetryStore.getState()` rồi NỘI SUY mượt tới đó (telemetry
 * về 8 Hz, màn hình vẽ 60 Hz — không nội suy thì drone giật 8 lần mỗi giây).
 *
 * Mọi thứ nhìn thấy là DỮ LIỆU THẬT hoặc được ghi nhãn: chưa có telemetry thì
 * drone đứng trên bãi đáp và lớp phủ nói rõ "chưa có dữ liệu".
 *
 * Chất lượng (`quality`) quyết định độ phân giải, bóng đổ và hậu kỳ — máy yếu
 * chọn "Thấp" vẫn chạy mượt. `PerformanceMonitor` tự hạ độ phân giải khi rớt khung.
 */
import { Environment, Lightformer, OrbitControls, Sky, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { memo, Suspense, useMemo, useRef } from "react";
import type { ComponentRef, ReactNode } from "react";
import * as THREE from "three";

import { attitudeToEuler, toScene } from "@/lib/enu";
import type { Origin } from "@/lib/enu";
import type { TwinGround, TwinQuality } from "@/store/settings";
import { useTelemetryStore } from "@/store/telemetry";

import { DroneModel } from "./DroneModel";
import { LabelOverlay, LabelProjector } from "./labels";
import { detectGpu } from "./gpu";
import { FieldProps, SkyClouds } from "./FieldProps";
import { FieldScenery } from "./FieldScenery";
import { CameraFrustum, GeofenceVolume, Ground, HomePad, Mission3D, RangefinderBeam, ShadowCatcher, Trail3D, useSceneOrigin } from "./SceneParts";

export type CameraMode = "chase" | "orbit" | "top" | "fpv" | "cinematic";
export type TimeOfDay = "live" | "noon" | "golden" | "night";

export interface TwinSceneProps {
  camera?: CameraMode;
  quality?: TwinQuality;
  ground?: TwinGround;
  effects?: boolean;
  timeOfDay?: TimeOfDay;
  showMission?: boolean;
  showGeofence?: boolean;
  showTrail?: boolean;
  showBeam?: boolean;
  /** Khu bay dã chiến: trạm mặt đất, người vận hành, cọc tiêu, ống gió. */
  showField?: boolean;
  /** Nón nhìn của camera ESP32 trên drone. */
  showCamera?: boolean;
  showClouds?: boolean;
  className?: string;
  /** Lớp phủ HTML (HUD) vẽ trên khung. */
  children?: ReactNode;
}

const QUALITY = {
  // `tiles` = bán kính lưới ô ảnh mặt đất ở z19 (ô ≈ 75 m): 2 → 5×5 ≈ 375 m, 4 → 9×9 ≈ 675 m.
  low: { dpr: [1, 1] as [number, number], shadows: false, shadowMap: 512, tiles: 2, ao: false, post: false },
  medium: { dpr: [1, 1.5] as [number, number], shadows: true, shadowMap: 1024, tiles: 3, ao: false, post: true },
  high: { dpr: [1, 2] as [number, number], shadows: true, shadowMap: 2048, tiles: 4, ao: true, post: true },
  ultra: { dpr: [1.25, 2] as [number, number], shadows: true, shadowMap: 4096, tiles: 5, ao: true, post: true },
} satisfies Record<TwinQuality, unknown>;

/** Cạnh hộp chiếu bóng quanh drone, mét. */
const SHADOW_BOX_M = 24;

// ---------------------------------------------------------------------------
// Mặt trời
// ---------------------------------------------------------------------------

/** Vị trí mặt trời (hướng) theo giờ trong ngày — gần đúng, đủ cho ánh sáng và bóng. */
function sunDirection(mode: TimeOfDay, now = new Date()): THREE.Vector3 {
  const hour = mode === "noon" ? 12.3 : mode === "golden" ? 17.6 : mode === "night" ? 23 : now.getHours() + now.getMinutes() / 60;
  // Mặt trời mọc 6h ở đông (+x), lặn 18h ở tây (−x), cao nhất 12h (TP.HCM gần xích đạo: gần thiên đỉnh).
  const t = ((hour - 6) / 12) * Math.PI;
  const elevation = Math.sin(t);
  return new THREE.Vector3(Math.cos(t), Math.max(elevation, -0.3), 0.35).normalize();
}

function Lighting({ timeOfDay, shadowMap, shadows }: { timeOfDay: TimeOfDay; shadowMap: number; shadows: boolean }) {
  const sun = useMemo(() => sunDirection(timeOfDay), [timeOfDay]);
  const night = sun.y < 0.02;
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  // Bóng đổ bám theo drone (hộp chiếu nhỏ → bóng sắc), nhưng tâm hộp NHẢY THEO
  // LƯỚI 1 texel của shadow map: trôi mượt từng li là bóng "bơi" và lấp lánh mỗi
  // khung hình — một nguồn của lỗi nháy người dùng báo.
  const texel = SHADOW_BOX_M / shadowMap;
  useFrame(() => {
    if (!light.current) return;
    const d = droneState.position;
    target.position.set(Math.round(d.x / texel) * texel, 0, Math.round(d.z / texel) * texel);
    light.current.position.copy(target.position).addScaledVector(sun, 60);
    target.updateMatrixWorld();
  });

  return (
    <>
      {night ? null : <Sky sunPosition={sun.clone().multiplyScalar(100).toArray()} turbidity={6} rayleigh={1.4} mieCoefficient={0.006} mieDirectionalG={0.85} />}
      {night ? <Stars radius={260} depth={60} count={4000} factor={5} saturation={0} fade speed={0.4} /> : null}
      {night ? <color attach="background" args={["#060b16"]} /> : null}
      <fog attach="fog" args={[night ? "#070d1a" : "#b7c9dc", 180, 900]} />
      <hemisphereLight args={[night ? "#28324a" : "#dbe8ff", night ? "#10141c" : "#4a4232", night ? 0.55 : 0.45]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={night ? 0.55 : 2.1}
        color={timeOfDay === "golden" ? "#ffc98a" : night ? "#9fb4ff" : "#fff6e8"}
        castShadow={shadows}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-SHADOW_BOX_M / 2}
        shadow-camera-right={SHADOW_BOX_M / 2}
        shadow-camera-top={SHADOW_BOX_M / 2}
        shadow-camera-bottom={-SHADOW_BOX_M / 2}
      />
      {/* Môi trường phản chiếu dựng tại chỗ (không tải HDR từ mạng): vài tấm sáng như studio ngoài trời. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={[night ? "#0a1020" : "#8fb2d6"]} />
        <Lightformer form="rect" intensity={night ? 0.25 : 0.9} color="#ffffff" position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ffe2c2" position={[-12, 3, -6]} rotation={[0, Math.PI / 2.5, 0]} scale={[12, 4, 1]} />
        <Lightformer form="ring" intensity={0.9} color="#bfe7ff" position={[10, 5, 8]} scale={4} />
        <Lightformer form="rect" intensity={0.3} color="#4a5a3a" position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[40, 40, 1]} />
      </Environment>
    </>
  );
}

// ---------------------------------------------------------------------------
// Drone bám telemetry
// ---------------------------------------------------------------------------

/**
 * Trạng thái drone đã nội suy — dùng chung giữa rig drone, camera và đèn (một
 * nguồn, cùng khung hình). Module-level vì chỉ có một cảnh chính mỗi lúc; bản
 * xem trước nhỏ không dùng tới.
 */
const droneState = {
  position: new THREE.Vector3(0, 0, 0),
  quaternion: new THREE.Quaternion(),
  yaw: 0,
  scale: 1,
};

function DroneRig({ origin, showBeam, showCamera }: { origin: Origin | null; showBeam: boolean; showCamera: boolean }) {
  const group = useRef<THREE.Group>(null);
  const model = useRef<THREE.Group>(null);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const spinning = () => useTelemetryStore.getState().telemetry?.armed === true;

  useFrame(({ camera }, dt) => {
    const t = useTelemetryStore.getState().telemetry;
    if (t && origin && t.lat != null && t.lon != null) {
      const [x, , z] = toScene(origin, t.lat, t.lon);
      targetPos.set(x, Math.max(0, t.relative_alt ?? 0), z);
    } else {
      targetPos.set(0, 0, 0);
    }
    const yaw = t?.yaw ?? t?.heading ?? 0;
    euler.set(...attitudeToEuler(t?.roll ?? 0, t?.pitch ?? 0, yaw));
    targetQuat.setFromEuler(euler);

    // Nội suy theo hàm mũ: độc lập với fps, bám chặt nhưng không giật.
    const k = 1 - Math.exp(-dt * 9);
    // Nhảy xa (đổi gốc, nối lại) thì đặt thẳng, không "bay" qua cả bãi.
    if (droneState.position.distanceTo(targetPos) > 40) droneState.position.copy(targetPos);
    else droneState.position.lerp(targetPos, k);
    droneState.quaternion.slerp(targetQuat, k);
    droneState.yaw = THREE.MathUtils.degToRad(yaw);

    // Model thật 0.5 m — nhìn từ xa là một chấm. Phóng to theo khoảng cách
    // camera (1× khi gần, tối đa 6×) để luôn thấy được hướng và tư thế.
    const dist = camera.position.distanceTo(droneState.position);
    const scale = THREE.MathUtils.clamp(dist / 14, 1, 6);
    droneState.scale += (scale - droneState.scale) * k;

    if (group.current) group.current.position.copy(droneState.position);
    if (model.current) {
      model.current.quaternion.copy(droneState.quaternion);
      model.current.scale.setScalar(droneState.scale);
    }
  });

  return (
    <group ref={group}>
      <group ref={model}>
        <DroneModel spinning={spinning} />
        {showBeam ? <RangefinderBeam /> : null}
        {showCamera ? <CameraFrustum /> : null}
      </group>
      <AltitudeStem />
    </group>
  );
}

/** Vạch dóng từ drone xuống đất + vòng dưới đất: đọc được vị trí và độ cao ở mọi góc nhìn. */
function AltitudeStem() {
  const line = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const h = droneState.position.y;
    if (line.current) {
      line.current.visible = h > 0.4;
      line.current.scale.set(1, Math.max(0.001, h), 1);
      line.current.position.y = -h / 2;
    }
    if (ring.current) {
      ring.current.position.y = -h + 0.03;
      ring.current.scale.setScalar(0.6 + h * 0.08);
    }
  });
  return (
    <>
      <mesh ref={line}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        <meshBasicMaterial color="#5ee0f0" transparent opacity={0.55} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 0.9, 48]} />
        <meshBasicMaterial color="#5ee0f0" transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

function CameraRig({ mode }: { mode: CameraMode }) {
  const { camera } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const fpvOffset = useMemo(() => new THREE.Vector3(0, 0.18, -0.15), []);
  const persp = camera as THREE.PerspectiveCamera;

  useFrame(({ clock }, dt) => {
    const p = droneState.position;
    const k = 1 - Math.exp(-dt * 4);
    const fov = mode === "fpv" ? 88 : 45;
    if (Math.abs(persp.fov - fov) > 0.1) {
      persp.fov += (fov - persp.fov) * Math.min(1, dt * 6);
      persp.updateProjectionMatrix();
    }
    camera.up.set(0, 1, 0);

    switch (mode) {
      case "orbit": {
        // Người dùng tự xoay; tâm quay bám theo drone.
        const c = controls.current;
        if (c) {
          tmp.copy(p).sub(c.target);
          c.target.add(tmp.multiplyScalar(k));
          camera.position.add(tmp);
          c.update();
        }
        return;
      }
      case "chase": {
        const back = 3.2 + droneState.scale * 1.2;
        // Sau lưng drone = ngược hướng mũi. Mũi (yaw 0) hướng −Z → sau lưng là +Z.
        tmp.set(-Math.sin(droneState.yaw) * back, 1.1 + droneState.scale * 0.6, Math.cos(droneState.yaw) * back);
        camera.position.lerp(tmp.add(p), k);
        look.copy(p).setY(p.y + 0.3);
        camera.lookAt(look);
        return;
      }
      case "top": {
        tmp.set(p.x, p.y + 38, p.z + 0.01);
        camera.position.lerp(tmp, k);
        camera.up.set(0, 0, -1); // bắc ở trên màn hình, như bản đồ
        camera.lookAt(p);
        return;
      }
      case "fpv": {
        tmp.copy(fpvOffset).multiplyScalar(droneState.scale).applyQuaternion(droneState.quaternion).add(p);
        camera.position.copy(tmp);
        camera.quaternion.copy(droneState.quaternion);
        // Camera ESP32 nghiêng xuống 15°.
        camera.rotateX(-0.26);
        return;
      }
      case "cinematic": {
        const t = clock.elapsedTime * 0.12;
        const r = 7 + droneState.scale * 1.5;
        tmp.set(p.x + Math.cos(t) * r, p.y + 1.8 + Math.sin(t * 0.7) * 0.8, p.z + Math.sin(t) * r);
        camera.position.lerp(tmp, k * 0.6);
        camera.lookAt(p);
        return;
      }
    }
  });

  return mode === "orbit" ? (
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={1.2} maxDistance={400} maxPolarAngle={Math.PI * 0.495} />
  ) : null;
}

/**
 * Hậu kỳ — CỐ ĐỊNH, không phụ thuộc chế độ camera.
 *
 * Từng cho Vignette/DepthOfField đổi theo camera: mỗi lần bấm đổi góc nhìn,
 * EffectComposer dựng lại chuỗi pass và biên dịch lại shader → màn hình ĐEN
 * 1–2 giây (đo 25/09/2026: chase sau orbit đen ở 1,5 s, cinematic đen hẳn vì
 * DepthOfField đọc độ sâu tuyến tính, không hợp với logarithmicDepthBuffer).
 * Nên: bỏ DepthOfField, và giữ component này không re-render khi đổi camera.
 */
const Effects = memo(function Effects({ quality }: { quality: TwinQuality }) {
  const q = QUALITY[quality];
  if (!q.post) return null;
  return (
    <EffectComposer multisampling={0}>
      {q.ao ? <N8AO aoRadius={0.6} distanceFalloff={1} intensity={2.2} quality={quality === "ultra" ? "high" : "medium"} halfRes={quality !== "ultra"} /> : <></>}
      {/* Ngưỡng CAO: bầu trời Preetham có giá trị HDR > 1, ngưỡng thấp làm cả khung
          mờ sữa (gặp thật khi chụp nghiệm thu). Chỉ đèn (màu 3–8) mới vượt 2.2. */}
      <Bloom mipmapBlur luminanceThreshold={2.2} luminanceSmoothing={0.3} intensity={0.8} />
      <Vignette offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
});

// ---------------------------------------------------------------------------
// Khung chính
// ---------------------------------------------------------------------------

export function TwinScene({
  camera = "chase",
  quality = "high",
  ground = "satellite",
  effects = true,
  timeOfDay = "live",
  showMission = true,
  showGeofence = true,
  showTrail = true,
  showBeam = true,
  showField = true,
  showCamera = false,
  showClouds = true,
  className,
  children,
}: TwinSceneProps) {
  const origin = useSceneOrigin();
  const gpu = useMemo(() => detectGpu(), []);
  // Render phần mềm: ép "Thấp" + tắt hậu kỳ, kẻo cả trang đứng (xem gpu.ts).
  if (gpu.software) {
    quality = "low";
    effects = false;
    showField = false;
    showClouds = false;
  }
  // CPU vẽ cả khung 1600×1000 mất hàng trăm ms mỗi khung; 0,6× độ phân giải là
  // khác biệt giữa "chậm" và "đứng cả trang" (đo: rời trang 3D mất 9,9 s → xem gpu.ts).
  const q = gpu.software ? { ...QUALITY.low, dpr: [0.6, 0.6] as [number, number], tiles: 1 } : QUALITY[quality];

  return (
    <div className={className ?? "relative h-full w-full"} data-testid="twin-scene">
      <Canvas
        shadows={q.shadows ? "percentage" : false}
        // Độ phân giải CỐ ĐỊNH theo mức chất lượng. Từng dùng PerformanceMonitor để
        // tự tăng/giảm — nó bập bênh lên xuống, mỗi lần đổi là canvas vẽ lại cỡ mới:
        // người dùng thấy màn hình nháy và giật (báo lỗi 25/09/2026).
        dpr={q.dpr}
        // Vùng đệm độ sâu LOGARIT: cảnh trải từ 5 cm (cánh quạt) tới 3 km (chân
        // trời). Đệm tuyến tính ở tỉ lệ đó không phân biệt được hai mặt cách nhau
        // vài cm ở xa → mặt đất sọc ngang nhấp nháy (z-fighting) — đúng ảnh báo lỗi.
        gl={{
          antialias: !effects || !q.post,
          powerPreference: "high-performance",
          logarithmicDepthBuffer: true,
          toneMapping: effects && q.post ? THREE.NoToneMapping : THREE.NeutralToneMapping,
        }}
        camera={{ position: [4, 3, 6], fov: 45, near: 0.05, far: 3000 }}
        className="!absolute inset-0"
      >
        <LabelProjector />
        <Suspense fallback={null}>
          <Lighting timeOfDay={timeOfDay} shadowMap={q.shadowMap} shadows={q.shadows} />
          <Ground origin={origin} layer={ground} radius={q.tiles} />
          <HomePad />
          {origin && showMission ? <Mission3D origin={origin} /> : null}
          {origin && showTrail ? <Trail3D origin={origin} /> : null}
          {showGeofence ? <GeofenceVolume /> : null}
          <DroneRig origin={origin} showBeam={showBeam} showCamera={showCamera} />
          {q.shadows ? <ShadowCatcher follow={droneState.position} /> : null}
          {showField ? <FieldProps /> : null}
          {showField ? <FieldScenery night={sunDirection(timeOfDay).y < 0.02} /> : null}
          {showClouds && quality !== "low" ? <SkyClouds night={sunDirection(timeOfDay).y < 0.02} /> : null}
          <CameraRig mode={camera} />
          {effects ? <Effects quality={quality} /> : null}
        </Suspense>
      </Canvas>
      <LabelOverlay />
      {gpu.software ? (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-lg bg-black/70 px-3 py-2 text-[11.5px] leading-snug text-white" data-testid="twin-software-render">
          Máy đang vẽ 3D bằng CPU ({gpu.renderer}) — đã tự hạ chất lượng về Thấp để trang không bị đứng. Bật tăng tốc phần cứng
          trong trình duyệt để có hình đẹp.
        </div>
      ) : null}
      {children}
    </div>
  );
}
