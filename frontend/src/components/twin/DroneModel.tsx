/**
 * Model 3D của drone dự án — quadcopter khung S500 — dựng HOÀN TOÀN bằng hình
 * học three.js (không file .glb nào), theo đúng cấu hình trong
 * `docs/archive/plan-nhap-92-giai-doan.md` và `firmware/ardupilot/params/`:
 *
 *   - khung S500: đường chéo motor 500 mm, hai tay TRƯỚC màu đỏ (nhận hướng
 *     bằng mắt, như khung thật), hai tay sau trắng;
 *   - motor chuông + cánh quạt 10" (Ø 254 mm), chiều quay đúng thứ tự motor
 *     Quad-X của ArduPilot: 1 trước-phải CCW · 2 sau-trái CCW · 3 trước-trái CW
 *     · 4 sau-phải CW;
 *   - cột GPS (Holybro M10), pin LiPo 4S dưới bụng, TFmini Plus ở mũi,
 *     ESP32-CAM dưới mũi, đèn điều hướng (xanh trước, đỏ sau, nháy trắng khi ARM).
 *
 * Hệ trục của model: mũi hướng −Z, phải là +X, lên là +Y, đơn vị MÉT, gốc ở
 * mặt dưới càng đáp (đặt model ở y = 0 là đứng trên đất).
 *
 * Cánh quạt quay khi `spinning` — đọc mỗi khung hình (không qua React state),
 * nên 60 fps không kéo theo 60 lượt render.
 */
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import * as THREE from "three";

import { SceneLabel } from "./labels";
import { batteryLabelTexture, brushedTexture, carbonTexture, gpsTopTexture, propBlurTexture } from "./textures";

/** Nửa đường chéo motor–motor của S500: 500 mm / 2. */
const ARM_REACH = 0.25;
const PROP_RADIUS = 0.127;
const GEAR_HEIGHT = 0.19;
const BODY_Y = GEAR_HEIGHT + 0.012;

/** Tốc độ quay HIỂN THỊ (rad/s) — thấp hơn thật để mắt còn thấy lá cánh; đĩa mờ lo phần "đang quay nhanh". */
const VISUAL_PROP_RAD_S = 38;

interface MotorDef {
  /** Vị trí trên mặt phẳng: x = phải, z = sau (−z = trước). */
  x: number;
  z: number;
  /** 1 = CCW nhìn từ trên, −1 = CW. */
  dir: 1 | -1;
  front: boolean;
}

const D = ARM_REACH * Math.SQRT1_2;
export const MOTORS: readonly MotorDef[] = [
  { x: D, z: -D, dir: 1, front: true }, // motor 1 trước-phải CCW
  { x: -D, z: D, dir: 1, front: false }, // motor 2 sau-trái CCW
  { x: -D, z: -D, dir: -1, front: true }, // motor 3 trước-trái CW
  { x: D, z: D, dir: -1, front: false }, // motor 4 sau-phải CW
];

function useMaterials() {
  return useMemo(() => {
    const carbon = new THREE.MeshPhysicalMaterial({
      map: carbonTexture(),
      color: "#cfd6e0",
      roughness: 0.42,
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    const armWhite = new THREE.MeshPhysicalMaterial({ color: "#e6e9ee", roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const armRed = new THREE.MeshPhysicalMaterial({ color: "#c2262f", roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.35 });
    const bell = new THREE.MeshStandardMaterial({ color: "#1d2027", metalness: 0.92, roughness: 0.32, roughnessMap: brushedTexture() });
    const anodized = new THREE.MeshStandardMaterial({ color: "#c79a3c", metalness: 0.85, roughness: 0.28 });
    const steel = new THREE.MeshStandardMaterial({ color: "#b9c0c9", metalness: 1, roughness: 0.22 });
    const prop = new THREE.MeshPhysicalMaterial({ color: "#16181d", roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide });
    const propTip = new THREE.MeshStandardMaterial({ color: "#f2b53a", roughness: 0.5 });
    const blur = new THREE.MeshBasicMaterial({ map: propBlurTexture(), transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
    const rubber = new THREE.MeshStandardMaterial({ color: "#20232a", roughness: 0.85 });
    const gear = new THREE.MeshPhysicalMaterial({ color: "#eef1f5", roughness: 0.55, clearcoat: 0.25 });
    const pcb = new THREE.MeshStandardMaterial({ color: "#10261c", roughness: 0.6, metalness: 0.2 });
    const battery = new THREE.MeshStandardMaterial({ map: batteryLabelTexture(), roughness: 0.55 });
    const batteryBody = new THREE.MeshStandardMaterial({ color: "#1a1d23", roughness: 0.6 });
    const gpsTop = new THREE.MeshStandardMaterial({ map: gpsTopTexture(), roughness: 0.7 });
    const plastic = new THREE.MeshStandardMaterial({ color: "#23262d", roughness: 0.55 });
    const lens = new THREE.MeshPhysicalMaterial({ color: "#0b1a2a", roughness: 0.05, metalness: 0.1, clearcoat: 1, transmission: 0 });
    // Đèn: màu vượt 1.0 + không tone-map → Bloom bắt được, phát sáng thật.
    const ledGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 5, 1.6), toneMapped: false });
    const ledRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2), toneMapped: false });
    const strobe = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 9), toneMapped: false, transparent: true, opacity: 0 });
    const heatShrink = new THREE.MeshStandardMaterial({ color: "#1f64c8", roughness: 0.45 });
    const wireRed = new THREE.MeshStandardMaterial({ color: "#d32f2f", roughness: 0.5 });
    const wireBlack = new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.5 });
    const wireYellow = new THREE.MeshStandardMaterial({ color: "#e7b416", roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: "#d9a93a", metalness: 1, roughness: 0.25 });
    return { heatShrink, wireRed, wireBlack, wireYellow, gold, carbon, armWhite, armRed, bell, anodized, steel, prop, propTip, blur, rubber, gear, pcb, battery, batteryBody, gpsTop, plastic, lens, ledGreen, ledRed, strobe };
  }, []);
}

type Mats = ReturnType<typeof useMaterials>;

/** Độ tách rời hiện tại (0 = lắp, 1 = tách hết) — hỏi mỗi khung hình. */
type ExplodeFn = () => number;
const NO_EXPLODE: ExplodeFn = () => 0;

/**
 * Nhóm tách rời: ở `explode = 0` nằm đúng chỗ lắp; tăng dần thì dời theo
 * `offset` (mét). Nhãn (khi bật) đi theo bộ phận.
 */
function Part({
  offset,
  explode,
  label,
  showLabel,
  labelAt = [0, 0, 0],
  children,
}: {
  offset: [number, number, number];
  explode: ExplodeFn;
  label?: string;
  showLabel?: boolean;
  labelAt?: [number, number, number];
  children: ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const e = explode();
    if (g.current) g.current.position.set(offset[0] * e, offset[1] * e, offset[2] * e);
  });
  return (
    <group ref={g}>
      {children}
      {showLabel && label ? (
        <SceneLabel id={`part-${label}`} tone="part" offset={labelAt} text={label} opacity={() => Math.max(0, Math.min(1, (explode() - 0.35) / 0.4))} />
      ) : null}
    </group>
  );
}

/** Một lá cánh: mặt bằng thuôn nhọn (Shape) đùn mỏng, gốc ở tâm quay. */
function useBladeGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    const r = PROP_RADIUS;
    s.moveTo(0.012, -0.007);
    s.bezierCurveTo(r * 0.35, -0.013, r * 0.75, -0.011, r * 0.97, -0.004);
    s.quadraticCurveTo(r * 1.01, 0, r * 0.97, 0.005);
    s.bezierCurveTo(r * 0.75, 0.012, r * 0.35, 0.016, 0.012, 0.008);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 12 });
    // Nằm ngang trên mặt XZ, lá chạy dọc +X.
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.0011, 0);
    return g;
  }, []);
}

function Propeller({ m, dir, spinning }: { m: Mats; dir: 1 | -1; spinning: () => boolean }) {
  const blade = useBladeGeometry();
  const rotor = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Mesh>(null);
  const speed = useRef(0);

  useFrame((_, dt) => {
    const target = spinning() ? VISUAL_PROP_RAD_S : 0;
    // Tăng/giảm tốc mềm như motor thật, không bật tắt tức thì.
    speed.current += (target - speed.current) * Math.min(1, dt * 2.5);
    if (rotor.current) rotor.current.rotation.y += dir * speed.current * dt;
    const mat = disc.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.opacity = Math.min(0.55, speed.current / VISUAL_PROP_RAD_S) * 0.55;
  });

  // Góc xoắn: lá nghiêng 9° quanh trục dọc của nó; lá đối diện nghiêng ngược (đối xứng tâm).
  const pitch = THREE.MathUtils.degToRad(9) * dir;
  return (
    <group>
      <group ref={rotor}>
        <mesh geometry={blade} material={m.prop} rotation={[pitch, 0, 0]} castShadow />
        <mesh geometry={blade} material={m.prop} rotation={[-pitch, Math.PI, 0]} castShadow />
        {/* Vạch vàng ở đầu lá — thấy được cánh đang quay, như sơn cảnh báo trên cánh thật. */}
        <mesh position={[PROP_RADIUS * 0.9, 0.0035, 0]} material={m.propTip}>
          <boxGeometry args={[0.012, 0.001, 0.02]} />
        </mesh>
        <mesh position={[-PROP_RADIUS * 0.9, 0.0035, 0]} material={m.propTip}>
          <boxGeometry args={[0.012, 0.001, 0.02]} />
        </mesh>
        <mesh material={m.steel} position={[0, 0.006, 0]}>
          <cylinderGeometry args={[0.009, 0.011, 0.014, 20]} />
        </mesh>
      </group>
      <mesh ref={disc} material={m.blur} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[PROP_RADIUS * 1.02, 48]} />
      </mesh>
    </group>
  );
}

function Motor({ m, def, spinning }: { m: Mats; def: MotorDef; spinning: () => boolean }) {
  return (
    <group position={[def.x, BODY_Y + 0.02, def.z]}>
      {/* đế motor */}
      <mesh material={m.carbon} castShadow receiveShadow>
        <cylinderGeometry args={[0.024, 0.024, 0.004, 28]} />
      </mesh>
      {/* stator lộ ra + chuông */}
      <mesh position={[0, 0.012, 0]} material={m.anodized} castShadow>
        <cylinderGeometry args={[0.019, 0.019, 0.02, 32]} />
      </mesh>
      <mesh position={[0, 0.026, 0]} material={m.bell} castShadow>
        <cylinderGeometry args={[0.0215, 0.0215, 0.018, 36, 1, true]} />
      </mesh>
      <mesh position={[0, 0.035, 0]} material={m.bell} castShadow>
        <cylinderGeometry args={[0.0215, 0.0215, 0.002, 36]} />
      </mesh>
      <group position={[0, 0.04, 0]}>
        <Propeller m={m} dir={def.dir} spinning={spinning} />
      </group>
    </group>
  );
}

function Arm({ m, def }: { m: Mats; def: MotorDef }) {
  const angle = Math.atan2(def.x, def.z);
  const len = ARM_REACH - 0.03;
  return (
    <group rotation={[0, angle, 0]} position={[0, BODY_Y + 0.008, 0]}>
      <RoundedBox args={[0.032, 0.022, len]} radius={0.006} smoothness={3} position={[0, 0, len / 2 + 0.02]} castShadow receiveShadow>
        <primitive object={def.front ? m.armRed : m.armWhite} attach="material" />
      </RoundedBox>
      {/* gân tăng cứng dưới tay */}
      <mesh position={[0, -0.013, len / 2 + 0.02]} material={def.front ? m.armRed : m.armWhite} castShadow>
        <boxGeometry args={[0.008, 0.006, len * 0.9]} />
      </mesh>
      {/* ESC dán trên tay (bọc co nhiệt xanh) + bó dây 3 pha chạy tới motor */}
      <mesh position={[0, 0.014, 0.075]} material={m.heatShrink} castShadow>
        <boxGeometry args={[0.022, 0.008, 0.045]} />
      </mesh>
      {[
        [-0.006, m.wireRed],
        [0, m.wireBlack],
        [0.006, m.wireYellow],
      ].map(([x, mat]) => (
        <mesh key={x as number} position={[x as number, 0.0135, 0.075 + len * 0.36]} rotation={[Math.PI / 2, 0, 0]} material={mat as THREE.Material}>
          <cylinderGeometry args={[0.0018, 0.0018, len * 0.62, 6]} />
        </mesh>
      ))}
      {/* đèn dưới đầu tay: trước xanh, sau đỏ */}
      <mesh position={[0, -0.014, len + 0.008]} material={def.front ? m.ledGreen : m.ledRed}>
        <sphereGeometry args={[0.0065, 16, 12]} />
      </mesh>
    </group>
  );
}

function LandingGear({ m }: { m: Mats }) {
  const legs = useMemo(() => {
    // Hai càng chữ U đặt dọc thân (S500 càng cao, chân cong).
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, BODY_Y - 0.004, 0),
      new THREE.Vector3(0.02, BODY_Y * 0.55, 0),
      new THREE.Vector3(0.075, 0.03, 0),
      new THREE.Vector3(0.09, 0.008, 0),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.0065, 10, false);
  }, []);
  return (
    <group>
      {[1, -1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          {[-0.07, 0.07].map((z) => (
            <mesh key={z} geometry={legs} material={m.gear} position={[0.03, 0, z]} castShadow />
          ))}
          {/* thanh ngang chạm đất */}
          <mesh position={[0.12, 0.008, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.gear} castShadow receiveShadow>
            <cylinderGeometry args={[0.0075, 0.0075, 0.24, 14]} />
          </mesh>
          {[-0.12, 0.12].map((z) => (
            <mesh key={z} position={[0.12, 0.008, z]} rotation={[Math.PI / 2, 0, 0]} material={m.rubber}>
              <cylinderGeometry args={[0.0095, 0.0095, 0.02, 14]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Body({ m, strobe, explode, labels }: { m: Mats; strobe: RefObject<THREE.Mesh | null>; explode: ExplodeFn; labels: boolean }) {
  return (
    <group>
      {/* tấm dưới + tấm trên + trụ đỡ */}
      <RoundedBox args={[0.18, 0.004, 0.2]} radius={0.002} position={[0, BODY_Y, 0]} castShadow receiveShadow material={m.carbon} />
      <Part offset={[0, 0.14, 0]} explode={explode} label="Tấm thân trên · sợi carbon" showLabel={labels} labelAt={[0.06, BODY_Y + 0.05, 0.06]}>
        <RoundedBox args={[0.14, 0.004, 0.16]} radius={0.002} position={[0, BODY_Y + 0.045, 0]} castShadow receiveShadow material={m.carbon} />
      </Part>
      {[
        [0.055, 0.065],
        [-0.055, 0.065],
        [0.055, -0.065],
        [-0.055, -0.065],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, BODY_Y + 0.023, z]} material={m.anodized} castShadow>
          <cylinderGeometry args={[0.0035, 0.0035, 0.043, 10]} />
        </mesh>
      ))}
      {/* bo chia nguồn + jack XT60 vàng */}
      <mesh position={[0, BODY_Y + 0.006, 0.03]} material={m.pcb}>
        <boxGeometry args={[0.05, 0.004, 0.05]} />
      </mesh>
      <mesh position={[0, BODY_Y - 0.004, 0.09]} material={m.gold}>
        <boxGeometry args={[0.016, 0.008, 0.012]} />
      </mesh>
      {/* chồng mạch FC (SpeedyBee F405 V5) giữa hai tấm */}
      <Part offset={[0, 0.07, 0]} explode={explode} label="FC SpeedyBee F405 V5 · ArduCopter" showLabel={labels} labelAt={[0, BODY_Y + 0.04, 0]}>
        <mesh position={[0, BODY_Y + 0.018, 0]} material={m.pcb} castShadow>
          <boxGeometry args={[0.042, 0.008, 0.042]} />
        </mesh>
        <mesh position={[0, BODY_Y + 0.03, 0]} material={m.pcb} castShadow>
          <boxGeometry args={[0.038, 0.006, 0.038]} />
        </mesh>
      </Part>
      <Part offset={[0, -0.16, 0]} explode={explode} label="Pin LiPo 4S 5200 mAh" showLabel={labels} labelAt={[0.05, BODY_Y - 0.03, 0]}>
      {/* pin LiPo dưới bụng, có quai dán */}
      <group position={[0, BODY_Y - 0.03, 0.005]}>
        <mesh material={[m.battery, m.battery, m.batteryBody, m.batteryBody, m.batteryBody, m.batteryBody]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.042, 0.15]} />
        </mesh>
        {[-0.04, 0.04].map((z) => (
          <mesh key={z} position={[0, 0, z]} material={m.rubber}>
            <boxGeometry args={[0.054, 0.046, 0.016]} />
          </mesh>
        ))}
      </group>
      </Part>
      <Part offset={[0, 0.2, 0.06]} explode={explode} label="GPS Holybro M10 + la bàn IST8310" showLabel={labels} labelAt={[0, BODY_Y + 0.17, 0.05]}>
      {/* cột GPS phía sau + cục GPS */}
      <group position={[0, BODY_Y + 0.047, 0.05]}>
        <mesh position={[0, 0.045, 0]} material={m.carbon} castShadow>
          <cylinderGeometry args={[0.004, 0.004, 0.09, 10]} />
        </mesh>
        <mesh position={[0, 0.094, 0]} material={m.plastic} castShadow>
          <cylinderGeometry args={[0.028, 0.03, 0.012, 36]} />
        </mesh>
        <mesh position={[0, 0.1005, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.gpsTop}>
          <circleGeometry args={[0.028, 36]} />
        </mesh>
      </group>
      </Part>
      <Part offset={[0, 0.02, -0.16]} explode={explode} label="TFmini Plus · đo vật cản" showLabel={labels} labelAt={[0, BODY_Y + 0.04, -0.108]}>
      {/* TFmini Plus ở mũi: hộp đen, hai thấu kính nhìn thẳng trước (−Z) */}
      <group position={[0, BODY_Y + 0.012, -0.108]}>
        <mesh material={m.plastic} castShadow>
          <boxGeometry args={[0.035, 0.021, 0.018]} />
        </mesh>
        {[-0.0085, 0.0085].map((x) => (
          <mesh key={x} position={[x, 0, -0.0095]} rotation={[Math.PI / 2, 0, 0]} material={m.lens}>
            <cylinderGeometry args={[0.0055, 0.0055, 0.002, 20]} />
          </mesh>
        ))}
      </group>
      </Part>
      <Part offset={[0, -0.08, -0.14]} explode={explode} label="ESP32-CAM · camera + AI" showLabel={labels} labelAt={[0, BODY_Y - 0.04, -0.095]}>
      {/* ESP32-CAM dưới mũi, nghiêng nhìn xuống 15° */}
      <group position={[0, BODY_Y - 0.012, -0.095]} rotation={[-0.26, 0, 0]}>
        <mesh material={m.pcb} castShadow>
          <boxGeometry args={[0.027, 0.04, 0.005]} />
        </mesh>
        <mesh position={[0, 0.006, -0.004]} rotation={[Math.PI / 2, 0, 0]} material={m.lens}>
          <cylinderGeometry args={[0.0045, 0.0045, 0.005, 16]} />
        </mesh>
      </group>
      </Part>
      {/* ăng-ten thu RC (FS-iA6B) chĩa chéo ra sau, lệch 90° nhau cho sóng ổn định */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.035, BODY_Y + 0.07, 0.085]} rotation={[0.9, 0, side * 0.9]} material={m.wireBlack}>
          <cylinderGeometry args={[0.0014, 0.0014, 0.08, 5]} />
        </mesh>
      ))}
      {/* đèn nháy trắng trên nóc — chỉ nháy khi ARMED */}
      <mesh ref={strobe} position={[0, BODY_Y + 0.052, -0.05]} material={m.strobe}>
        <sphereGeometry args={[0.006, 12, 10]} />
      </mesh>
    </group>
  );
}

export interface DroneModelProps {
  /** Hỏi mỗi khung hình: cánh có đang quay không (thường = ARMED). */
  spinning: () => boolean;
  /** Hỏi mỗi khung hình: độ tách rời 0..1 (chế độ Xưởng). Mặc định 0 — lắp nguyên. */
  explode?: ExplodeFn;
  /** Hiện nhãn linh kiện khi tách rời. */
  labels?: boolean;
}

export function DroneModel({ spinning, explode = NO_EXPLODE, labels = false }: DroneModelProps) {
  const m = useMaterials();
  const strobe = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mat = strobe.current?.material as THREE.MeshBasicMaterial | undefined;
    if (!mat) return;
    // Nháy kép mỗi giây, kiểu đèn anti-collision của máy bay thật.
    const t = clock.elapsedTime % 1;
    mat.opacity = spinning() && (t < 0.05 || (t > 0.14 && t < 0.19)) ? 1 : 0;
  });
  return (
    <group>
      <Body m={m} strobe={strobe} explode={explode} labels={labels} />
      {MOTORS.map((def, i) => (
        <Part
          key={i}
          offset={[def.x * 0.55, 0, def.z * 0.55]}
          explode={explode}
          label={i === 0 ? "Tay + ESC + motor + cánh 10\"" : undefined}
          showLabel={labels && i === 0}
          labelAt={[def.x, BODY_Y + 0.09, def.z]}
        >
          <Arm m={m} def={def} />
          <Motor m={m} def={def} spinning={spinning} />
        </Part>
      ))}
      <Part offset={[0, -0.12, 0]} explode={explode} label="Càng đáp S500" showLabel={labels} labelAt={[0.12, 0.05, 0]}>
        <LandingGear m={m} />
      </Part>
    </group>
  );
}
