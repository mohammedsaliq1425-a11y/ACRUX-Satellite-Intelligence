import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionHeader } from "../../components/Card";
import { MODULE_BY_ID } from "../modules/modules";

const COLUMNS = [
  { eyebrow: "Environmental intelligence", title: "Understand conditions on the ground",
    items: [
      { id: "wildfire", text: "Satellite hotspot detections for a region, with the caveats that come with them." },
      { id: "weather", text: "Forecasts and historical reanalysis, each labelled for what it is." },
      { id: "earth-observation", text: "Imagery, metadata and attribution kept together." },
    ] },
  { eyebrow: "Space science", title: "Explore what is beyond the atmosphere",
    items: [
      { id: "space-science", text: "Astronomy imagery, near-Earth objects and confirmed exoplanets from public archives." },
      { id: "space-objects", text: "Asteroid close approaches, separated from human-made debris and from simulations." },
      { id: "navigation", text: "See how satellite geometry shapes positioning accuracy." },
    ] },
];

export function Highlights() {
  return (
    <section aria-label="Highlights" className="mx-auto max-w-6xl px-6 pb-20 sm:px-10">
      <div className="grid gap-6 lg:grid-cols-2">
        {COLUMNS.map((c) => (
          <div key={c.title} className="card p-6">
            <SectionHeader eyebrow={c.eyebrow} title={c.title} />
            <ul className="mt-6 space-y-4">
              {c.items.map((it) => {
                const m = MODULE_BY_ID[it.id]!;
                return (
                  <li key={it.id}>
                    <Link to={m.path} className="group flex items-start gap-3 rounded-lg p-2 hover:bg-panel">
                      <m.icon size={18} className="mt-0.5 shrink-0 text-signal" aria-hidden />
                      <span className="text-sm">
                        <span className="flex items-center gap-1 font-semibold">{m.navLabel} <ArrowUpRight size={13} className="text-mute group-hover:text-signal" aria-hidden /></span>
                        <span className="text-mute">{it.text}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
