/**
 * XƯỞNG 3D — drone S500 trong studio: sàn phản chiếu, đèn studio, xoay quanh,
 * và hoạt ảnh THÁO RỜI / LẮP LẠI từng linh kiện có nhãn (FC, GPS, TFmini,
 * ESP32-CAM, pin, tay + ESC + motor, càng đáp).
 *
 * Linh kiện và thông số lấy theo cấu hình đã chốt của dự án
 * (`docs/archive/plan-nhap-92-giai-doan.md`, `firmware/ardupilot/params/`).
 * Không nhận telemetry: đây là mô hình để HỌC và TRÌNH BÀY, cánh chỉ quay khi
 * người xem bật "Chạy motor (mô phỏng)".
 */
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { DroneModel } from "./DroneModel";
import { LabelOverlay, LabelProjector } from "./labels";
import { detectGpu } from "./gpu";

export interface HangarControls {
  /** Đích tách rời (0 = lắp, 1 = tách). Model trượt tới đích mượt. */
  explodeTarget: number;
  spin: boolean;
  autoRotate: boolean;
  labels: boolean;
}

function Stage({ controls }: { controls: HangarControls }) {
  const explode = useRef(0);
  const turntable = useRef<THREE.Group>(null);
  const ctl = useRef(controls);
  ctl.current = controls;

  useFrame((_, dt) => {
    // Hoạt ảnh tách rời: tiến về đích theo hàm mũ (mượt, độc lập fps).
    explode.current += (ctl.current.explodeTarget - explode.current) * (1 - Math.exp(-dt * 3.2));
    if (turntable.current && ctl.current.autoRotate) turntable.current.rotation.y += dt * 0.22;
  });

  return (
    <group ref={turntable}>
      {/* Phóng model ×3: drone thật 0,5 m, xem trong studio cần to rõ. */}
      <group scale={3}>
        <DroneModel spinning={() => ctl.current.spin} explode={() => explode.current} labels={ctl.current.labels} />
      </group>
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <circleGeometry args={[6, 96]} />
      <MeshReflectorMaterial
        blur={[400, 120]}
        resolution={1024}
        mixBlur={1}
        mixStrength={18}
        roughness={0.85}
        depthScale={1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.2}
        color="#0d121b"
        metalness={0.6}
        mirror={0.4}
      />
    </mesh>
  );
}

/** Vòng sáng trên sàn + lưới mảnh: chất "phòng lab". */
function StudioRings() {
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.2, 2.6), toneMapped: false }), []);
  return (
    <group position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={ringMat}>
        <ringGeometry args={[1.9, 1.92, 128]} />
      </mesh>
      <mesh>
        <ringGeometry args={[2.6, 2.61, 128]} />
        <meshBasicMaterial color="#1c3a52" />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.25, Math.sin(a) * 2.25, 0]} rotation={[0, 0, a]}>
            <planeGeometry args={[0.16, 0.012]} />
            <meshBasicMaterial color={i % 6 === 0 ? "#56e0f3" : "#27425a"} />
          </mesh>
        );
      })}
    </group>
  );
}

export function DroneHangar({ controls, className }: { controls: HangarControls; className?: string }) {
  const gpu = useMemo(() => detectGpu(), []);
  return (
    <div className={className ?? "relative h-full w-full"} data-testid="drone-hangar">
      <Canvas
        dpr={gpu.software ? 1 : [1, 2]}
        shadows={gpu.software ? false : "percentage"}
        camera={{ position: [2.3, 1.6, 2.8], fov: 35, near: 0.05, far: 60 }}
        gl={{ toneMapping: THREE.NoToneMapping, antialias: false, logarithmicDepthBuffer: true }}
        className="!absolute inset-0"
      >
        <color attach="background" args={["#070b12"]} />
        <fog attach="fog" args={["#070b12", 6, 16]} />
        <LabelProjector />
        <Suspense fallback={null}>
          <ambientLight intensity={0.15} />
          <spotLight position={[3, 5, 2]} angle={0.45} penumbra={0.9} intensity={80} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} />
          <spotLight position={[-4, 3, -3]} angle={0.5} penumbra={1} intensity={40} color="#7fd8ff" />
          <Environment resolution={512} frames={1}>
            <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} />
            <Lightformer form="rect" intensity={2.2} color="#9fe8ff" position={[-5, 1.5, 1]} rotation={[0, Math.PI / 2, 0]} scale={[6, 1.5, 1]} />
            <Lightformer form="rect" intensity={1.6} color="#ffd9b0" position={[5, 1.5, -1]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 1.5, 1]} />
            <Lightformer form="ring" intensity={2} color="#56e0f3" position={[0, 2, -5]} scale={2.5} />
          </Environment>
          <Stage controls={controls} />
          {gpu.software ? null : <Floor />}
          <StudioRings />
          <ContactShadows position={[0, 0.003, 0]} opacity={0.7} scale={5} blur={2.2} far={1.5} />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={1.4}
            maxDistance={7}
            minPolarAngle={Math.PI * 0.12}
            maxPolarAngle={Math.PI * 0.49}
            target={[0, 0.55, 0]}
          />
          {gpu.software ? null : (
            <EffectComposer multisampling={0}>
              <N8AO aoRadius={0.4} intensity={2.4} quality="medium" halfRes />
              <Bloom mipmapBlur luminanceThreshold={1.2} intensity={0.9} />
              <Vignette offset={0.3} darkness={0.6} />
              <ToneMapping mode={ToneMappingMode.NEUTRAL} />
              <SMAA />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>
      <LabelOverlay />
    </div>
  );
}
