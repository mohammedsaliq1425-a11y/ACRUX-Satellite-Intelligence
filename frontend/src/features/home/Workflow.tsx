import { Bot, Cpu, Database, FileText, Map } from "lucide-react";
import { SectionHeader } from "../../components/Card";

const STEPS = [
  { icon: Database, title: "Data sources", text: "Public services such as NASA, JPL and Open-Meteo, queried only by the local backend." },
  { icon: Cpu, title: "Data processing", text: "Responses are validated, normalised and tagged with units, timestamps and attribution." },
  { icon: Map, title: "Geospatial visualization", text: "Maps and charts keep observations, forecasts, derived values and simulations visibly apart." },
  { icon: Bot, title: "AI-assisted analysis", text: "An assistant explains what is on screen, using only the context it is given." },
  { icon: FileText, title: "Reports & insights", text: "Findings are exported with sources, methods and limitations attached." },
];

export function Workflow() {
  return (
    <section aria-labelledby="workflow-title" className="border-y border-line bg-surface/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <SectionHeader id="workflow-title" eyebrow="How it works" title="From raw data to a report you can trace"
          description="Each step is visible in the interface, so students and researchers can see how a source becomes a result." />
        <ol className="mt-10 grid gap-4 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-line bg-panel p-5">
              <span className="font-mono text-xs text-signal">STEP {i + 1}</span>
              <s.icon className="mt-3 text-electric" size={22} aria-hidden />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
