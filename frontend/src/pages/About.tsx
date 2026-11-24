import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { KindBadge } from "../components/Badges";
import { Card, SectionHeader } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { MODULES } from "../features/modules/modules";
import type { DataKind } from "../types/api";

const LEGEND: { kind: DataKind; text: string }[] = [
  { kind: "observation", text: "Something a sensor or service reported, shown with its source and timestamp." },
  { kind: "forecast", text: "Model output about the future. Never described as a measurement." },
  { kind: "reanalysis", text: "Historical values produced by models that assimilate observations." },
  { kind: "catalogue", text: "Reference data from public archives (images, object catalogues)." },
  { kind: "derived", text: "A value calculated by Project Acrux from other data, with its method documented." },
  { kind: "simulation", text: "Generated locally for learning or testing. Always labelled, never presented as real." },
];

export default function About() {
  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-10 sm:px-10">
      <PageHeader icon={Info} eyebrow="About" title="About Project Acrux"
        description="Observe Earth. Understand Space. Predict the Future." />

      <section aria-labelledby="what" className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeader id="what" title="What it is" />
          <p className="mt-4 leading-relaxed text-mute">
            Project Acrux is an integrated satellite-intelligence platform that brings Earth observation, environmental
            monitoring, weather, satellite communication, navigation, space science and a satellite digital twin into one
            application, with an AI assistant and report generation on top.
          </p>
        </div>
        <div>
          <SectionHeader title="Mission and goals" />
          <p className="mt-4 leading-relaxed text-mute">
            To make satellite and space data understandable and traceable for students, researchers and curious users:
            show where each number comes from, explain how it was produced, and make the limits of every method visible.
            It is for scientific and educational exploration, not for operational or safety-critical decisions.
          </p>
        </div>
      </section>

      <section aria-labelledby="mods">
        <SectionHeader id="mods" title="The twelve intelligence modules" />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.id}>
              <Link to={m.path} className="flex h-full items-start gap-3 rounded-xl border border-line bg-surface p-4 hover:border-signal/60">
                <m.icon size={18} className="mt-0.5 shrink-0 text-signal" aria-hidden />
                <span className="text-sm"><span className="block font-semibold">{m.title}</span><span className="text-mute">{m.summary}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trust" className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeader id="trust" title="Source transparency" description="Every result is tagged with what kind of data it is. Observations, forecasts, derived results and simulations are never blended into one unlabelled number." />
        </div>
        <Card className="p-5">
          <ul className="space-y-3">
            {LEGEND.map((l) => (
              <li key={l.kind} className="flex items-start gap-3 text-sm">
                <span className="w-40 shrink-0"><KindBadge kind={l.kind} /></span>
                <span className="text-mute">{l.text}</span>
              </li>))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="ai" className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeader id="ai" title="AI-assisted analysis" />
          <p className="mt-4 leading-relaxed text-mute">
            The assistant runs through OpenRouter from the local backend. It only sees the context passed to it, is told to
            treat that context as data, and its answers are marked as interpretation. It cannot query data sources itself and
            must say so when information is missing.
          </p>
        </div>
        <div>
          <SectionHeader title="Local-first architecture" />
          <p className="mt-4 leading-relaxed text-mute">
            A React frontend and a Python FastAPI backend run on your own computer. API keys stay in the backend’s .env file.
            Persistence through Supabase is optional and backend-only. Nothing is deployed or published by the application.
          </p>
        </div>
      </section>

      <Card className="p-6">
        <SectionHeader title="Credits and affiliations" />
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Project Acrux has no institutional partnerships, certifications, customers or awards, and no affiliation with
          NASA, JPL, Open-Meteo, OpenRouter or Supabase. These organisations provide public data or services that Project
          Acrux uses under their published terms; their names identify sources only.
        </p>
      </Card>
    </div>
  );
}
