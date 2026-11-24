import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Pill } from "../../components/Badges";
import { SectionHeader } from "../../components/Card";
import { MODULES } from "../modules/modules";

export function ModuleGrid() {
  return (
    <section id="modules" aria-labelledby="modules-title" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 sm:px-10">
      <SectionHeader id="modules-title" eyebrow="Twelve intelligence modules" title="One platform, twelve ways to look at Earth and space"
        description="Every module shares the same navigation, labelling rules and data-source monitoring. Modules marked simulated generate their own data and always say so." />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <li key={m.id}>
            <Link to={m.path} className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-signal/60">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-electric/10 text-signal ring-1 ring-inset ring-electric/30">
                  <m.icon size={20} aria-hidden />
                </span>
                <span className="font-mono text-xs text-mute">{String(m.number).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold">{m.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-mute">{m.summary}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="flex flex-wrap gap-1.5">
                  {m.simulated ? <Pill tone="warn">Simulated</Pill> : <Pill tone="signal">Live data</Pill>}
                </span>
                <span className="flex items-center gap-1 text-sm font-medium text-electric group-hover:text-signal">
                  Open <ArrowRight size={14} aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
