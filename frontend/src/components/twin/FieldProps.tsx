/**
 * Khu bay dã chiến quanh điểm home — dựng hoàn toàn bằng hình học three.js.
 *
 * Đây là "sân khấu" của một buổi bay theo đúng quy trình dự án (SAFETY.md):
 *   - trạm mặt đất: bàn gấp + laptop chạy GCS + cột ăng-ten Wi-Fi (hotspot /
 *     DroneBridge), đặt SAU người vận hành;
 *   - người vận hành CẦM RC (RC luôn có quyền cao nhất — mục 4);
 *   - lều che nắng, hộp pin;
 *   - cọc tiêu cam quanh bãi đáp và dọc vòng rào phần mềm;
 *   - ống gió để đọc hướng gió bằng mắt.
 *
 * Mọi thứ đặt TƯƠNG ĐỐI với home và ở ngoài vòng 3 m của bãi đáp. Chúng là cảnh
 * trí minh hoạ — không phải dữ liệu đo; vị trí thật của trạm không có trong
 * telemetry. Tắt được ở bảng điều khiển 3D ("Khu bay dã chiến").
 */
import { Cloud, Clouds } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { useLimits } from "@/hooks/useLimits";

import { SceneLabel } from "./labels";
import { cloudTextureUrl, laptopScreenTexture, stripeTexture } from "./textures";

// ---------------------------------------------------------------------------
// Vật liệu dùng chung
// ---------------------------------------------------------------------------

function usePropMaterials() {
  return useMemo(
    () => ({
      aluminium: new THREE.MeshStandardMaterial({ color: "#c9cfd6", metalness: 0.9, roughness: 0.35 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: "#2b2f36", metalness: 0.7, roughness: 0.45 }),
      tableTop: new THREE.MeshStandardMaterial({ color: "#e9e6df", roughness: 0.7 }),
      laptopShell: new THREE.MeshPhysicalMaterial({ color: "#3a3f47", metalness: 0.6, roughness: 0.35, clearcoat: 0.4 }),
      screen: new THREE.MeshBasicMaterial({ map: laptopScreenTexture(), toneMapped: false }),
      canopy: new THREE.MeshStandardMaterial({ color: "#1f5fa8", roughness: 0.85, side: THREE.DoubleSide }),
      coneOrange: new THREE.MeshStandardMaterial({ color: "#ff6a13", roughness: 0.55 }),
      coneWhite: new THREE.MeshStandardMaterial({ color: "#f4f4f2", roughness: 0.3, metalness: 0.1 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#1d1f24", roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: "#c8906a", roughness: 0.7 }),
      shirt: new THREE.MeshStandardMaterial({ color: "#2e6fd1", roughness: 0.8 }),
      pants: new THREE.MeshStandardMaterial({ color: "#2b2f3a", roughness: 0.85 }),
      vest: new THREE.MeshStandardMaterial({ color: "#c6f032", roughness: 0.6, emissive: "#3a4a00", emissiveIntensity: 0.25 }),
      rc: new THREE.MeshStandardMaterial({ color: "#1a1c21", roughness: 0.5, metalness: 0.2 }),
      sock: new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.8, side: THREE.DoubleSide }),
      caseMat: new THREE.MeshStandardMaterial({ color: "#d3462b", roughness: 0.6 }),
    }),
    [],
  );
}

type PropMats = ReturnType<typeof usePropMaterials>;

// ---------------------------------------------------------------------------
// Trạm mặt đất
// ---------------------------------------------------------------------------

function FoldingTable({ m }: { m: PropMats }) {
  const legs: [number, number][] = [
    [-0.55, -0.28],
    [0.55, -0.28],
    [-0.55, 0.28],
    [0.55, 0.28],
  ];
  return (
    <group>
      <mesh position={[0, 0.74, 0]} material={m.tableTop} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.03, 0.62]} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.37, z]} material={m.aluminium} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.74, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Laptop({ m }: { m: PropMats }) {
  return (
    <group position={[0.05, 0.755, 0.02]}>
      <mesh position={[0, 0.008, 0]} material={m.laptopShell} castShadow>
        <boxGeometry args={[0.36, 0.016, 0.25]} />
      </mesh>
      {/* bàn phím */}
      <mesh position={[0, 0.0165, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, 0.12]} />
        <meshStandardMaterial color="#15171b" roughness={0.9} />
      </mesh>
      {/* màn hình nghiêng 105° */}
      <group position={[0, 0.016, -0.12]} rotation={[-0.28, 0, 0]}>
        <mesh position={[0, 0.12, 0]} material={m.laptopShell} castShadow>
          <boxGeometry args={[0.36, 0.24, 0.01]} />
        </mesh>
        <mesh position={[0, 0.12, 0.0056]} material={m.screen}>
          <planeGeometry args={[0.33, 0.21]} />
        </mesh>
      </group>
    </group>
  );
}

/** Cột ăng-ten Wi-Fi trên chân ba — đường truyền MAVLink/video qua ESP32. */
function AntennaMast({ m }: { m: PropMats }) {
  const led = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (led.current) led.current.color.setScalar(clock.elapsedTime % 1 < 0.1 ? 6 : 0.4).multiply(new THREE.Color(0.3, 1, 0.5));
  });
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.22, 0.45, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]} material={m.darkMetal} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 1.0, 6]} />
          </mesh>
        );
      })}
      <mesh position={[0, 1.35, 0]} material={m.aluminium} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 1.8, 8]} />
      </mesh>
      {/* hộp router + hai ăng-ten */}
      <mesh position={[0, 2.28, 0]} material={m.rc} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.11]} />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 2.4, -0.04]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]} material={m.rc} castShadow>
          <cylinderGeometry args={[0.008, 0.01, 0.22, 8]} />
        </mesh>
      ))}
      <mesh position={[0.05, 2.28, 0.056]}>
        <sphereGeometry args={[0.008, 8, 6]} />
        <meshBasicMaterial ref={led} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Canopy({ m }: { m: PropMats }) {
  const top = useMemo(() => {
    const g = new THREE.ConeGeometry(2.1, 0.7, 4, 1, true);
    g.rotateY(Math.PI / 4);
    return g;
  }, []);
  return (
    <group>
      {[
        [-1.45, -1.45],
        [1.45, -1.45],
        [-1.45, 1.45],
        [1.45, 1.45],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 1.05, z]} material={m.aluminium} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 2.1, 8]} />
        </mesh>
      ))}
      <mesh geometry={top} position={[0, 2.45, 0]} material={m.canopy} castShadow receiveShadow />
      {/* diềm vải bốn cạnh */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 1.48, 2.02, Math.cos((i * Math.PI) / 2) * 1.48]} rotation={[0, (i * Math.PI) / 2, 0]} material={m.canopy}>
          <planeGeometry args={[2.96, 0.16]} />
        </mesh>
      ))}
    </group>
  );
}

/** Người vận hành cầm RC — mô hình tối giản, mặc áo phản quang. */
function Operator({ m }: { m: PropMats }) {
  const arms = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // Thở / chỉnh cần rất nhẹ: người đứng yên hoàn toàn trông như tượng.
    if (arms.current) arms.current.rotation.x = -0.65 + Math.sin(clock.elapsedTime * 1.3) * 0.03;
  });
  return (
    <group>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]} material={m.pants} castShadow>
          <capsuleGeometry args={[0.075, 0.72, 4, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, 0]} material={m.shirt} castShadow>
        <capsuleGeometry args={[0.2, 0.42, 6, 14]} />
      </mesh>
      <mesh position={[0, 1.22, 0]} material={m.vest} castShadow>
        <cylinderGeometry args={[0.215, 0.215, 0.44, 16, 1, true]} />
      </mesh>
      <mesh position={[0, 1.66, 0]} material={m.skin} castShadow>
        <sphereGeometry args={[0.12, 20, 16]} />
      </mesh>
      {/* mũ lưỡi trai */}
      <mesh position={[0, 1.74, 0]} material={m.caseMat} castShadow>
        <sphereGeometry args={[0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 1.73, -0.12]} rotation={[-0.2, 0, 0]} material={m.caseMat}>
        <boxGeometry args={[0.18, 0.012, 0.1]} />
      </mesh>
      {/* hai tay đưa ra trước, cầm RC ở ngang ngực (mặt trước = −Z) */}
      <group ref={arms} position={[0, 1.36, 0]}>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x * 0.9, -0.18, -0.08]} material={m.shirt} castShadow>
            <capsuleGeometry args={[0.05, 0.34, 4, 8]} />
          </mesh>
        ))}
        <group position={[0, -0.42, -0.16]}>
          <mesh material={m.rc} castShadow>
            <boxGeometry args={[0.2, 0.12, 0.05]} />
          </mesh>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.02, -0.03]} material={m.aluminium}>
              <cylinderGeometry args={[0.006, 0.006, 0.04, 6]} />
            </mesh>
          ))}
          <mesh position={[0.07, 0.1, 0.01]} rotation={[0.3, 0, 0]} material={m.rc}>
            <cylinderGeometry args={[0.007, 0.007, 0.14, 6]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function BatteryCase({ m }: { m: PropMats }) {
  return (
    <group>
      <mesh position={[0, 0.13, 0]} material={m.caseMat} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.26, 0.34]} />
      </mesh>
      <mesh position={[0, 0.27, 0]} material={m.rubber}>
        <boxGeometry args={[0.2, 0.02, 0.04]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cọc tiêu + ống gió
// ---------------------------------------------------------------------------

function TrafficCone({ m }: { m: PropMats }) {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} material={m.coneOrange} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.03, 0.36]} />
      </mesh>
      <mesh position={[0, 0.27, 0]} material={m.coneOrange} castShadow>
        <cylinderGeometry args={[0.03, 0.14, 0.5, 20]} />
      </mesh>
      {[0.22, 0.36].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.coneWhite}>
          <cylinderGeometry args={[0.14 - y * 0.2 - 0.004, 0.14 - (y - 0.05) * 0.2 - 0.004, 0.05, 20, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}

/** Hướng gió hiển thị (độ, 0 = gió thổi TỪ bắc). Minh hoạ — telemetry chưa có gió. */
const WIND_FROM_DEG = 110;

function Windsock({ m }: { m: PropMats }) {
  const sock = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.1, 0.22, 1.1, 20, 6, true);
    g.rotateZ(Math.PI / 2);
    g.translate(-0.55, 0, 0);
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!sock.current) return;
    sock.current.rotation.z = -0.25 + Math.sin(t * 1.7) * 0.08; // gió giật lên xuống
    sock.current.rotation.y = Math.sin(t * 0.9) * 0.12;
  });
  return (
    <group rotation={[0, THREE.MathUtils.degToRad(-WIND_FROM_DEG + 90), 0]}>
      <mesh position={[0, 1.6, 0]} material={m.aluminium} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 3.2, 10]} />
      </mesh>
      <group ref={sock} position={[0, 3.1, 0]}>
        <mesh geometry={geo} material={m.sock} castShadow />
        <mesh rotation={[0, 0, Math.PI / 2]} material={m.aluminium}>
          <torusGeometry args={[0.22, 0.012, 8, 24]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ghép lại
// ---------------------------------------------------------------------------

export function FieldProps({ labels = true }: { labels?: boolean }) {
  const m = usePropMaterials();
  const limits = useLimits();
  const fence = limits?.max_distance_home ?? null;
  const fenceCones = fence ? Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2) : [];

  return (
    <group>
      {/* Trạm mặt đất: tây-nam bãi đáp ~7 m, quay mặt về bãi đáp. */}
      <group position={[-7, 0, 6]} rotation={[0, -Math.PI / 4, 0]}>
        <Canopy m={m} />
        <FoldingTable m={m} />
        <Laptop m={m} />
        <group position={[1.1, 0, 0.9]}>
          <BatteryCase m={m} />
        </group>
        <group position={[-1.9, 0, -0.4]}>
          <AntennaMast m={m} />
        </group>
        {labels ? (
          <SceneLabel id="field-gcs" offset={[0, 3.2, 0]} text="Trạm mặt đất · GCS" />
        ) : null}
      </group>
      {/* Người vận hành đứng trước trạm, nhìn về bãi đáp, tay cầm RC. */}
      <group position={[-4.2, 0, 3.6]} rotation={[0, Math.atan2(4.2, -3.6) + Math.PI, 0]}>
        <Operator m={m} />
        {labels ? (
          <SceneLabel id="field-operator" offset={[0, 2.1, 0]} text="Người vận hành · cầm RC" />
        ) : null}
      </group>
      <group position={[6.5, 0, 5]}>
        <Windsock m={m} />
      </group>
      {/* Bốn cọc tiêu quanh bãi đáp */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={`pad-${i}`} position={[Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4]}>
            <TrafficCone m={m} />
          </group>
        );
      })}
      {/* Cọc tiêu dọc vòng rào phần mềm, mỗi 30° */}
      {fence
        ? fenceCones.map((a) => (
            <group key={`fence-${a}`} position={[Math.cos(a) * fence, 0, Math.sin(a) * fence]}>
              <TrafficCone m={m} />
            </group>
          ))
        : null}
    </group>
  );
}

/** Mây thể tích (drei Clouds) với texture tự sinh — không tải ảnh mây từ CDN. */
export function SkyClouds({ night }: { night: boolean }) {
  const texture = useMemo(() => cloudTextureUrl(), []);
  return (
    <Clouds texture={texture} limit={200} material={THREE.MeshLambertMaterial}>
      <Cloud seed={3} segments={30} bounds={[60, 6, 60]} volume={30} position={[-60, 55, -120]} color={night ? "#3b4458" : "#ffffff"} opacity={0.75} speed={0.05} />
      <Cloud seed={7} segments={24} bounds={[50, 5, 40]} volume={24} position={[90, 60, -60]} color={night ? "#343c4f" : "#f3f6fb"} opacity={0.7} speed={0.04} />
      <Cloud seed={11} segments={20} bounds={[40, 5, 40]} volume={20} position={[20, 70, 140]} color={night ? "#2e3546" : "#ffffff"} opacity={0.65} speed={0.03} />
    </Clouds>
  );
}
