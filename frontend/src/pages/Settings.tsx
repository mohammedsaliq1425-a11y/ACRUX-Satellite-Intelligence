import { useState } from "react";
import { RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { Button } from "../components/Button";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { PageHeader } from "../components/PageHeader";
import { SourceCard } from "../features/sources/SourceCard";
import type { TestOutcome } from "../features/sources/SourceCard";
import { useApi } from "../hooks/useApi";
import { DEFAULT_PREFERENCES, usePreferences } from "../hooks/usePreferences";
import type { Preferences } from "../hooks/usePreferences";
import { ApiError, api } from "../services/api";
import type { SourcesResponse } from "../types/api";

function Select<K extends keyof Preferences>({ label, field, options, hint }: {
  label: string; field: K; options: { value: Preferences[K]; label: string }[]; hint?: string;
}) {
  const { prefs, update } = usePreferences();
  const id = `pref-${field}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <select id={id} value={prefs[field]} onChange={(e) => update({ [field]: e.target.value } as Partial<Preferences>)}
        className="mt-1.5 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

const KEY_STEPS = [
  "Open the .env file in the project root (create it with: Copy-Item .env.example .env).",
  "Paste each key after its variable name, with no quotes or spaces.",
  "Stop and restart the backend (uvicorn) — settings are read once at startup.",
  "Return here, press “Test connection” on that source, and confirm it reports usable data.",
];

export default function Settings() {
  const { data, error, loading, reload } = useApi<SourcesResponse>("/api/sources");
  const [testing, setTesting] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, TestOutcome>>({});
  const { reset } = usePreferences();

  const runTest = async (id: string) => {
    setTesting(id);
    let outcome: TestOutcome;
    try {
      const r = await api.testSource(id);
      outcome = r.ok
        ? { ok: true, text: "Test passed: the source returned usable data." }
        : { ok: false, text: "The source answered but did not return usable data. See its status and last error." };
    } catch (e) {
      outcome = { ok: false, text: e instanceof ApiError ? e.message : "The test could not be completed." };
    }
    setOutcomes((o) => ({ ...o, [id]: outcome }));
    setTesting(null);
    reload();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-10 sm:px-10">
      <PageHeader icon={SettingsIcon} eyebrow="Platform" title="Settings & Data Sources"
        description="See which data sources are configured and whether they are actually working. API keys live only in the backend’s .env file; they are never shown or sent to the browser."
        actions={<Button onClick={reload} disabled={loading}><RefreshCw size={14} aria-hidden /> Refresh status</Button>} />

      <section aria-labelledby="src-title">
        <SectionHeader id="src-title" title="Data sources"
          description="A key being present does not prove a service works. Use “Test connection” to make a real request; status is based on the outcome." />
        <div className="mt-6">
          <DataState loading={loading && !data} error={error} onRetry={reload} loadingLabel="Loading data-source status">
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data?.sources.map((s) => (
                <SourceCard key={s.id} source={s} testing={testing === s.id} outcome={outcomes[s.id]} onTest={runTest} />
              ))}
            </ul>
          </DataState>
        </div>
      </section>

      <section aria-labelledby="keys-title" className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader id="keys-title" title="Adding or changing API keys" />
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-mute">{KEY_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="mt-4 text-xs text-mute">
            Keys cannot be edited here on purpose: a browser form would send them across the network and
            risk leaving them in browser storage. Where to get each key is listed in the README.
          </p>
        </Card>
        <Card className="p-6">
          <SectionHeader title="Optional database (Supabase)" />
          <p className="mt-4 text-sm leading-relaxed text-mute">
            Supabase is optional and used only by the backend, for saved locations, saved reports and simulation-run summaries.
            Use the <strong className="text-ink">service/secret key</strong>, never the public anon key. A cloud project stores your
            data on Supabase’s servers; the Supabase CLI can run a local database instead (it needs Docker).
            Create the tables with <code className="font-mono text-xs">docs/supabase/schema.sql</code>.
          </p>
        </Card>
      </section>

      <section aria-labelledby="prefs-title">
        <SectionHeader id="prefs-title" title="Display preferences"
          description="Saved in this browser only and used as defaults by the weather module." />
        <Card className="mt-6 p-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Select label="Temperature" field="temperatureUnit" options={[{ value: "celsius", label: "Celsius (°C)" }, { value: "fahrenheit", label: "Fahrenheit (°F)" }]} />
            <Select label="Wind speed" field="windSpeedUnit" options={[
              { value: "kmh", label: "km/h" }, { value: "ms", label: "m/s" }, { value: "mph", label: "mph" }, { value: "kn", label: "knots" }]} />
            <Select label="Precipitation" field="precipitationUnit" options={[{ value: "mm", label: "Millimetres" }, { value: "inch", label: "Inches" }]} />
          </div>
          <Button className="mt-5" variant="ghost" onClick={reset}>Reset to defaults ({DEFAULT_PREFERENCES.temperatureUnit}, {DEFAULT_PREFERENCES.windSpeedUnit}, {DEFAULT_PREFERENCES.precipitationUnit})</Button>
        </Card>
      </section>

      <section aria-labelledby="sec-title">
        <SectionHeader id="sec-title" title="About local security"
          description="Project Acrux has no login because it is a single-user local tool. The backend only accepts browser requests from the local frontend, keeps keys server-side, validates input and avoids logging secrets. It has not been security-assessed and is not designed to be exposed to a network." />
      </section>
    </div>
  );
}
