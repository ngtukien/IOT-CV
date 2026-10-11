/**
 * "Phòng trưng bày" 3D cho trang Tổng quan: drone S500 trên bệ xoay, ánh sáng
 * studio, bóng tiếp xúc. Model nghiêng theo roll/pitch THẬT khi có telemetry và
 * cánh quạt quay khi ARMED — thẻ trạng thái sống, không phải hình minh hoạ.
 * Kéo chuột để xoay xem.
 */
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { attitudeToEuler } from "@/lib/enu";
import { useTelemetryStore } from "@/store/telemetry";

import { DroneModel } from "./DroneModel";

function Turntable() {
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const spinning = () => useTelemetryStore.getState().telemetry?.armed === true;

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.25;
    const t = useTelemetryStore.getState().telemetry;
    euler.set(...attitudeToEuler(t?.roll ?? 0, t?.pitch ?? 0, 0));
    q.setFromEuler(euler);
    tilt.current?.quaternion.slerp(q, 1 - Math.exp(-dt * 6));
  });

  return (
    <group ref={spin}>
      <group ref={tilt} position={[0, 0.03, 0]}>
        <DroneModel spinning={spinning} />
      </group>
      {/* bệ tròn */}
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.44, 0.024, 72]} />
        <meshPhysicalMaterial color="#1a1f28" roughness={0.3} metalness={0.6} clearcoat={1} clearcoatRoughness={0.2} />
      </mesh>
      <mesh position={[0, 0.0245, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.39, 0.4, 96]} />
        <meshBasicMaterial color={new THREE.Color(0.4, 2.2, 2.6)} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function DroneShowcase({ className }: { className?: string }) {
  return (
    <div className={className ?? "relative h-full w-full"} data-testid="drone-showcase">
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0.72, 0.5, 0.92], fov: 34, near: 0.01, far: 50 }}
        gl={{ toneMapping: THREE.NoToneMapping, alpha: true }}
        className="!absolute inset-0"
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.25} />
          <spotLight position={[1.2, 2, 1]} angle={0.5} penumbra={0.8} intensity={30} castShadow shadow-mapSize={[1024, 1024]} />
          <Environment resolution={256} frames={1}>
            <Lightformer form="rect" intensity={3} position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 6, 1]} />
            <Lightformer form="rect" intensity={2} color="#9fe8ff" position={[-3, 1, 1]} rotation={[0, Math.PI / 2, 0]} scale={[4, 1.2, 1]} />
            <Lightformer form="rect" intensity={1.4} color="#ffd9b0" position={[3, 1, -1]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 1.2, 1]} />
          </Environment>
          <Turntable />
          <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={2.4} blur={2.4} far={0.8} />
          <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI * 0.2} maxPolarAngle={Math.PI * 0.48} target={[0, 0.16, 0]} />
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur luminanceThreshold={1} intensity={0.8} />
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
