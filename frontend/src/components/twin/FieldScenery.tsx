/**
 * Cảnh trí xa và gần quanh khu bay — bổ sung cho `FieldProps` (trạm, người, cọc).
 *
 *   - rừng cây ngoài vòng rào: InstancedMesh (hàng trăm cây = vài draw call);
 *   - dải đồi xa làm đường chân trời;
 *   - xe bán tải chở đồ, máy phát điện, cột đèn pha;
 *   - đèn viền bãi đáp nhấp nháy (đẹp nhất ban đêm, có bloom).
 *
 * Vị trí sinh bằng RNG CÓ HẠT GIỐNG → mỗi lần mở trang cảnh y hệt, ảnh chụp
 * nghiệm thu so sánh được. Toàn bộ là minh hoạ, không phải dữ liệu đo.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useLimits } from "@/hooks/useLimits";

/** mulberry32 — RNG 32-bit có hạt giống, đủ đều cho việc rải cây. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

// ---------------------------------------------------------------------------
// Cây
// ---------------------------------------------------------------------------

interface TreeSpec {
  x: number;
  z: number;
  h: number;
  conifer: boolean;
  hue: number;
}

function useTreeSpecs(innerR: number): TreeSpec[] {
  return useMemo(() => {
    const r = rng(20260925);
    const out: TreeSpec[] = [];
    // Vài cụm rừng (không rải đều — trông giả), thêm cây lẻ.
    const clusters = Array.from({ length: 9 }, () => ({ a: r() * Math.PI * 2, d: innerR + 12 + r() * 50 }));
    for (const c of clusters) {
      const n = 10 + Math.floor(r() * 14);
      for (let i = 0; i < n; i++) {
        const a = c.a + (r() - 0.5) * 0.35;
        const d = c.d + (r() - 0.5) * 22;
        out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 4 + r() * 7, conifer: r() < 0.45, hue: r() });
      }
    }
    for (let i = 0; i < 60; i++) {
      const a = r() * Math.PI * 2;
      const d = innerR + 6 + r() * 90;
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 3 + r() * 6, conifer: r() < 0.3, hue: r() });
    }
    return out;
  }, [innerR]);
}

function Trees({ innerR }: { innerR: number }) {
  const specs = useTreeSpecs(innerR);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const pines = useRef<THREE.InstancedMesh>(null);
  const broad = useMemo(() => specs.filter((s) => !s.conifer), [specs]);
  const conif = useMemo(() => specs.filter((s) => s.conifer), [specs]);

  useLayoutEffect(() => {
    specs.forEach((s, i) => {
      tmpObj.position.set(s.x, s.h * 0.2, s.z);
      tmpObj.rotation.set(0, s.hue * 6.28, 0);
      tmpObj.scale.set(s.h * 0.035, s.h * 0.4, s.h * 0.035);
      tmpObj.updateMatrix();
      trunks.current?.setMatrixAt(i, tmpObj.matrix);
    });
    broad.forEach((s, i) => {
      tmpObj.position.set(s.x, s.h * 0.62, s.z);
      tmpObj.rotation.set(s.hue * 2, s.hue * 6.28, 0);
      tmpObj.scale.set(s.h * 0.34, s.h * 0.3, s.h * 0.34);
      tmpObj.updateMatrix();
      leaves.current?.setMatrixAt(i, tmpObj.matrix);
      leaves.current?.setColorAt(i, tmpColor.setHSL(0.22 + s.hue * 0.08, 0.45, 0.2 + s.hue * 0.1));
    });
    conif.forEach((s, i) => {
      tmpObj.position.set(s.x, s.h * 0.55, s.z);
      tmpObj.rotation.set(0, s.hue * 6.28, 0);
      tmpObj.scale.set(s.h * 0.22, s.h * 0.85, s.h * 0.22);
      tmpObj.updateMatrix();
      pines.current?.setMatrixAt(i, tmpObj.matrix);
      pines.current?.setColorAt(i, tmpColor.setHSL(0.36 + s.hue * 0.05, 0.4, 0.14 + s.hue * 0.07));
    });
    for (const m of [trunks.current, leaves.current, pines.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [specs, broad, conif]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, specs.length]} castShadow>
        <cylinderGeometry args={[0.7, 1, 1, 6]} />
        <meshStandardMaterial color="#4a3526" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, broad.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={pines} args={[undefined, undefined, conif.length]} castShadow>
        <coneGeometry args={[1, 1, 7, 3]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Đồi xa — cho cảnh có chiều sâu và đường chân trời thật
// ---------------------------------------------------------------------------

function Hills({ night }: { night: boolean }) {
  const geometry = useMemo(() => {
    // Một dải vòng quanh, đỉnh cao thấp theo tổng vài sóng sin + nhiễu có hạt giống.
    const r = rng(42);
    const phases = [r() * 6.28, r() * 6.28, r() * 6.28];
    const seg = 160;
    const inner = 330;
    const outer = 520;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const h =
        14 + 12 * Math.sin(a * 3 + phases[0]) + 7 * Math.sin(a * 7 + phases[1]) + 4 * Math.sin(a * 13 + phases[2]) + r() * 3;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      pos.push(c * inner, -1, sn * inner, c * (inner + outer) * 0.5, Math.max(h, 3), sn * (inner + outer) * 0.5, c * outer, h * 0.6, sn * outer);
      if (i < seg) {
        const k = i * 3;
        for (const [p, q] of [
          [0, 1],
          [1, 2],
        ]) {
          idx.push(k + p, k + q, k + 3 + p, k + q, k + 3 + q, k + 3 + p);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={night ? "#141c22" : "#4f6a4c"} flatShading roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Xe bán tải, máy phát, cột đèn
// ---------------------------------------------------------------------------

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.36, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.26, 20]} />
        <meshStandardMaterial color="#17191d" roughness={0.9} />
      </mesh>
      <mesh position={[0, z > 0 ? 0.135 : -0.135, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 12]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.3} />
      </mesh>
    </group>
  );
}

function PickupTruck({ night }: { night: boolean }) {
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#e8e9ea", metalness: 0.4, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 }), []);
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#1b2733", metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.85 }), []);
  return (
    <group>
      {/* thân dưới + thùng sau */}
      <mesh position={[0, 0.72, 0]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[5.2, 0.7, 1.9]} />
      </mesh>
      {/* cabin */}
      <mesh position={[0.75, 1.42, 0]} material={paint} castShadow>
        <boxGeometry args={[2.1, 0.75, 1.8]} />
      </mesh>
      <mesh position={[1.82, 1.42, 0]} rotation={[0, 0, -0.35]} material={glass}>
        <boxGeometry args={[0.06, 0.7, 1.7]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.75, 1.45, s * 0.905]} material={glass}>
          <boxGeometry args={[1.7, 0.5, 0.02]} />
        </mesh>
      ))}
      {/* thành thùng */}
      {[-1, 1].map((s) => (
        <mesh key={`w${s}`} position={[-1.55, 1.2, s * 0.9]} material={paint} castShadow>
          <boxGeometry args={[2.0, 0.28, 0.08]} />
        </mesh>
      ))}
      {/* thùng đồ nghề trong thùng xe */}
      <mesh position={[-1.8, 1.25, 0]} castShadow>
        <boxGeometry args={[0.9, 0.35, 1.3]} />
        <meshStandardMaterial color="#343a42" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* đèn pha + đèn hậu */}
      {[-0.65, 0.65].map((z) => (
        <group key={z}>
          <mesh position={[2.61, 0.85, z]}>
            <boxGeometry args={[0.03, 0.14, 0.34]} />
            <meshBasicMaterial color={night ? [6, 5.6, 4.8] : "#e9eef2"} toneMapped={false} />
          </mesh>
          <mesh position={[-2.61, 0.9, z * 1.2]}>
            <boxGeometry args={[0.03, 0.22, 0.12]} />
            <meshBasicMaterial color={night ? [4, 0.2, 0.15] : "#a8231c"} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Wheel x={1.6} z={0.88} />
      <Wheel x={1.6} z={-0.88} />
      <Wheel x={-1.6} z={0.88} />
      <Wheel x={-1.6} z={-0.88} />
    </group>
  );
}

function Generator() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.5, 0.5]} />
        <meshStandardMaterial color="#d8b227" roughness={0.55} metalness={0.2} />
      </mesh>
      {/* khung ống bảo vệ */}
      {[-0.36, 0.36].map((x) =>
        [-0.26, 0.26].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.32, z]}>
            <cylinderGeometry args={[0.018, 0.018, 0.64, 8]} />
            <meshStandardMaterial color="#1f2227" metalness={0.7} roughness={0.4} />
          </mesh>
        )),
      )}
      {/* lưới tản nhiệt */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0.352, 0.2 + i * 0.045, 0]}>
          <boxGeometry args={[0.01, 0.018, 0.34]} />
          <meshStandardMaterial color="#2a2c30" />
        </mesh>
      ))}
    </group>
  );
}

/** `aim`: vật đặt ở toạ độ THẾ GIỚI để đèn pha chiếu vào (bãi đáp). */
function LightTower({ night, aim }: { night: boolean; aim: THREE.Object3D }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.2, 0.5, 0.8]} />
        <meshStandardMaterial color="#f0f0ec" roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 5.6, 10]} />
        <meshStandardMaterial color="#b9c0c8" metalness={0.8} roughness={0.35} />
      </mesh>
      <group position={[0, 6.0, 0]} rotation={[0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.3, 0.08, 0.1]} />
          <meshStandardMaterial color="#2a2d33" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-0.45, -0.15, 0.15, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.1, 0.02]}>
            <boxGeometry args={[0.26, 0.2, 0.06]} />
            <meshBasicMaterial color={night ? [7, 6.8, 6] : "#c8ccd2"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {night ? (
        <spotLight position={[0, 6, 0]} target={aim} angle={0.55} penumbra={0.8} intensity={220} distance={45} decay={1.6} color="#fff3de" />
      ) : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Đèn viền bãi đáp
// ---------------------------------------------------------------------------

function PadLights({ night }: { night: boolean }) {
  const mats = useMemo(() => Array.from({ length: 8 }, () => new THREE.MeshBasicMaterial({ toneMapped: false })), []);
  const on = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    // Chạy vòng: từng đèn sáng lần lượt, như đèn dẫn hướng sân bay trực thăng.
    const t = clock.elapsedTime * 1.6;
    mats.forEach((m, i) => {
      const k = Math.max(0, Math.cos(t - (i / 8) * Math.PI * 2)) ** 6;
      const base = night ? 0.8 : 0.35;
      const peak = night ? 5 : 1.6;
      on.setRGB(0.25, 1, 0.55).multiplyScalar(base + k * peak);
      m.color.copy(on);
    });
  });
  return (
    <group>
      {mats.map((m, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 1.28, 0, Math.sin(a) * 1.28]}>
            <mesh position={[0, 0.03, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.055, 0.045, 14]} />
              <meshStandardMaterial color="#26292e" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.045, 0]} material={m}>
              <sphereGeometry args={[0.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------

export function FieldScenery({ night }: { night: boolean }) {
  const limits = useLimits();
  const fence = limits?.max_distance_home ?? 50;
  const aim = useMemo(() => new THREE.Object3D(), []);
  return (
    <group>
      <primitive object={aim} position={[0.5, 0, 1]} />
      <Trees innerR={Math.max(fence + 6, 30)} />
      <Hills night={night} />
      <PadLights night={night} />
      {/* Xe đỗ sau trạm mặt đất, mũi hướng ra đường (tây). */}
      <group position={[-12.5, 0, 9.5]} rotation={[0, Math.PI * 0.85, 0]}>
        <PickupTruck night={night} />
      </group>
      <group position={[-9.8, 0, 3.2]} rotation={[0, 0.4, 0]}>
        <Generator />
      </group>
      <group position={[-3.5, 0, 10.5]} rotation={[0, Math.PI * 0.8, 0]}>
        <LightTower night={night} aim={aim} />
      </group>
    </group>
  );
}
