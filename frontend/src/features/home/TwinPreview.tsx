import { ButtonLink } from "../../components/Button";
import { Pill } from "../../components/Badges";
import { SectionHeader } from "../../components/Card";

/** Schematic of the digital-twin subject. The interactive 3D model is a later phase. */
function SatelliteSchematic() {
  const panel = (x: number) => (
    <g transform={`translate(${x} 110)`}>
      <rect width="150" height="80" fill="#12306B" stroke="#3B82F6" />
      {[30, 60, 90, 120].map((v) => <line key={v} x1={v} y1="0" x2={v} y2="80" stroke="#3B82F6" strokeOpacity="0.5" />)}
      <line x1="0" y1="40" x2="150" y2="40" stroke="#3B82F6" strokeOpacity="0.5" />
    </g>
  );
  return (
    <svg viewBox="0 0 520 300" role="img" aria-label="Schematic of an Earth-observation satellite with solar panels, antenna and sensor" className="h-full w-full">
      <line x1="150" y1="150" x2="190" y2="150" stroke="#94A3B8" strokeWidth="3" />
      <line x1="330" y1="150" x2="370" y2="150" stroke="#94A3B8" strokeWidth="3" />
      {panel(0)}{panel(370)}
      <rect x="190" y="95" width="140" height="110" rx="8" fill="#101A30" stroke="#22D3EE" strokeWidth="2" />
      <circle cx="260" cy="150" r="22" fill="#0B1224" stroke="#22D3EE" />
      <circle cx="260" cy="150" r="9" fill="#3B82F6" />
      <line x1="260" y1="95" x2="260" y2="55" stroke="#94A3B8" strokeWidth="3" />
      <path d="M232 55 Q260 30 288 55 Z" fill="#E8EEF8" fillOpacity="0.85" />
      <text x="260" y="238" textAnchor="middle" fill="#94A3B8" fontSize="12">bus · payload · antenna · solar arrays</text>
    </svg>
  );
}

export function TwinPreview() {
  return (
    <section aria-labelledby="twin-title" className="border-t border-line bg-surface/60">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:px-10 lg:grid-cols-2">
        <div>
          <SectionHeader id="twin-title" eyebrow="Satellite digital twin" title="Inspect a spacecraft and audit its alerts"
            description="The digital twin pairs a 3D model with a simulated telemetry stream and a rule-based anomaly detector, so every alert comes with a measured value, an expected range and a reason." />
          <div className="mt-5 flex flex-wrap gap-2"><Pill tone="warn">Simulated telemetry</Pill><Pill>Rule-based detection</Pill></div>
          <ButtonLink to="/digital-twin" className="mt-6">Open the digital twin</ButtonLink>
        </div>
        <div className="aspect-[26/15] rounded-xl border border-line bg-midnight p-4"><SatelliteSchematic /></div>
      </div>
    </section>
  );
}
