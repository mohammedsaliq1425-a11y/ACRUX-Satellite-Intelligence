import { Link } from "react-router-dom";
import { StatusPill } from "../../components/Badges";
import { SectionHeader } from "../../components/Card";
import { DataState } from "../../components/DataState";
import { useApi } from "../../hooks/useApi";
import type { SourcesResponse } from "../../types/api";

export function DataSourceOverview() {
  const { data, error, loading, reload } = useApi<SourcesResponse>("/api/sources");
  return (
    <section aria-labelledby="sources-title" className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
      <SectionHeader id="sources-title" eyebrow="Data sources" title="Where the data comes from"
        description="Status below is reported by the backend from real requests. A configured key does not by itself mean a source is working." />
      <div className="mt-8">
        <DataState loading={loading} error={error} onRetry={reload} loadingLabel="Loading data-source status">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.sources.map((s) => (
              <li key={s.id} className="rounded-xl border border-line bg-surface p-4">
                <p className="font-medium">{s.name}</p>
                <p className="mt-1 text-xs text-mute">{s.purpose}</p>
                <div className="mt-3"><StatusPill status={s.status} /></div>
              </li>
            ))}
          </ul>
          <Link to="/settings" className="mt-5 inline-block text-sm font-medium text-electric hover:text-signal">Manage data sources →</Link>
        </DataState>
      </div>
    </section>
  );
}
