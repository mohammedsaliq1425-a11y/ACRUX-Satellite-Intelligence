import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ReactNode } from "react";

export type Health = "ok" | "warning" | "critical";
export interface PartInfo { id: string; name: string; subsystem: "power" | "thermal" | "attitude" | "communications" | "payload" | "structure"; description: string }

/** Descriptive, generic Earth-observation satellite parts. Not a model of any real spacecraft. */
export const PARTS: PartInfo[] = [
  { id: "arrays", name: "Solar arrays", subsystem: "power", description: "Two deployable photovoltaic wings. Output depends on sun angle and degradation; the simulator ties it to pointing error and the eclipse cycle." },
  { id: "bus", name: "Spacecraft bus", subsystem: "structure", description: "Main structure housing the battery, power electronics, computer and reaction wheels. Bus temperature is simulated as a single thermal node." },
  { id: "radiator", name: "Thermal radiator", subsystem: "thermal", description: "Rejects heat to space. In the simulation, heat input rises with electrical load and sunlight; faults can push the bus out of its range." },
  { id: "antenna", name: "Downlink antenna", subsystem: "communications", description: "Parabolic dish for payload data downlink. Contact is simulated once per orbit; a missed pass raises a communications alert." },
  { id: "tracker", name: "Star tracker", subsystem: "attitude", description: "Optical sensor providing attitude knowledge. The simulation reports roll, pitch and yaw error; drift beyond limits raises an attitude alert." },
  { id: "imager", name: "Imaging payload", subsystem: "payload", description: "Earth-observation camera. In the simulation it operates while the spacecraft is sunlit and adds to electrical load." },
  { id: "boom", name: "Structural boom", subsystem: "structure", description: "Mechanical support carrying the antenna away from the bus. Purely structural; no telemetry is attached." },
];

const BASE: Record<string, string> = { arrays: "#1D4ED8", bus: "#CBD5E1", radiator: "#E2E8F0", antenna: "#F1F5F9", tracker: "#334155", imager: "#0F172A", boom: "#94A3B8" };
const GLOW: Record<Health, string> = { ok: "#000000", warning: "#FBBF24", critical: "#F87171" };

function Part({ id, selected, onSelect, health, position, rotation, children }: {
  id: string; selected: string | null; onSelect: (id: string) => void; health: Health; position?: [number, number, number]; rotation?: [number, number, number]; children: ReactNode;
}) {
  const isSel = selected === id;
  return (
    <group position={position} rotation={rotation} onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(id); }}>
      <mesh>
        {children}
        <meshStandardMaterial color={BASE[id]} metalness={0.5} roughness={0.45} emissive={isSel && health === "ok" ? "#22D3EE" : GLOW[health]} emissiveIntensity={isSel ? 0.55 : health === "ok" ? 0 : 0.45} />
      </mesh>
    </group>
  );
}

export function TwinModel({ selected, onSelect, health }: { selected: string | null; onSelect: (id: string | null) => void; health: Record<string, Health> }) {
  const h = (id: string): Health => {
    const sub = PARTS.find((p) => p.id === id)?.subsystem;
    return sub && sub !== "structure" ? health[sub] ?? "ok" : "ok";
  };
  return (
    <Canvas camera={{ position: [4.2, 2.6, 5], fov: 45 }} onPointerMissed={() => onSelect(null)} aria-label="Interactive 3D model of a generic Earth-observation satellite. Drag to rotate, scroll to zoom, click a part to inspect it.">
      <color attach="background" args={["#060B18"]} />
      <ambientLight intensity={0.55} /><directionalLight position={[5, 6, 4]} intensity={1.4} /><directionalLight position={[-4, -2, -3]} intensity={0.35} color="#3B82F6" />
      <Part id="bus" selected={selected} onSelect={onSelect} health="ok"><boxGeometry args={[1.5, 1.2, 1.2]} /></Part>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Part id="boom" selected={selected} onSelect={onSelect} health="ok" position={[side * 1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.9, 12]} /></Part>
          {[0, 1, 2].map((i) => (
            <Part key={i} id="arrays" selected={selected} onSelect={onSelect} health={h("arrays")} position={[side * (1.95 + i * 0.95), 0, 0]}><boxGeometry args={[0.88, 0.04, 1.5]} /></Part>))}
        </group>))}
      <Part id="radiator" selected={selected} onSelect={onSelect} health={h("radiator")} position={[0, 0, -0.63]}><boxGeometry args={[1.2, 0.9, 0.05]} /></Part>
      <Part id="boom" selected={selected} onSelect={onSelect} health="ok" position={[0, 0.95, 0]}><cylinderGeometry args={[0.04, 0.04, 0.7, 12]} /></Part>
      <Part id="antenna" selected={selected} onSelect={onSelect} health={h("antenna")} position={[0, 1.45, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.55, 0.28, 32, 1, true]} /></Part>
      <Part id="imager" selected={selected} onSelect={onSelect} health={h("imager")} position={[0, -0.1, 0.8]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.32, 0.32, 0.6, 24]} /></Part>
      <Part id="tracker" selected={selected} onSelect={onSelect} health={h("tracker")} position={[0.5, 0.45, 0.72]}><boxGeometry args={[0.26, 0.26, 0.3]} /></Part>
      <OrbitControls enablePan={false} minDistance={3} maxDistance={12} makeDefault />
    </Canvas>
  );
}
