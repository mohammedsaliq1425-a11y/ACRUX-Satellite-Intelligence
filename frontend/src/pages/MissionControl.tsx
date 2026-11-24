import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import { StatusPill } from "../components/Badges";
import { BarsChart, COLORS, SeriesChart } from "../components/Charts";
import { Button } from "../components/Button";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { LocationPicker } from "../components/LocationPicker";
import { MapView } from "../components/MapView";
import { MetaFooter } from "../components/MetaFooter";
import { PageHeader } from "../components/PageHeader";
import { SimulatedBanner } from "../components/SimulatedBanner";
import { MODULES } from "../features/modules/modules";
import { useApi } from "../hooks/useApi";
import { usePreferences } from "../hooks/usePreferences";
import { useSelection } from "../hooks/useSelection";
import { useWorkspace, REPORT_LABELS } from "../hooks/useWorkspace";
import type { Envelope, Forecast, NeoRow, SourcesResponse, StatusFlag, StorageRow, TelemetryResult, Earthquake } from "../types/api";
import { addDays, compass, formatTimestamp, isoDate } from "../utils/format";
import { ApiError, request } from "../services/api";

export default function MissionControl() {
  const { location } = useSelection();
  const { prefs } = usePreferences();
  const { datasets } = useWorkspace();
  const [neoStart, setNeoStart] = useState(isoDate(new Date()));
  const end = isoDate(addDays(new Date(neoStart), 6));
  const u = `temperature_unit=${prefs.temperatureUnit}&wind_speed_unit=${prefs.windSpeedUnit}&precipitation_unit=${prefs.precipitationUnit}`;
  const wx = useApi<Envelope<Forecast>>(`/api/weather/forecast?lat=${location.lat}&lon=${location.lon}&${u}&days=2`);
  const neo = useApi<Envelope<NeoRow[]>>(`/api/space/neo-feed?start=${neoStart}&end=${end}`);
  const quakes = useApi<Envelope<Earthquake[]>>("/api/disasters/earthquakes?feed=4.5_week");
  const src = useApi<SourcesResponse>("/api/sources");
  const storage = useApi<StatusFlag>("/api/storage/status");
  const reports = useApi<Envelope<StorageRow[]>>(storage.data?.configured ? "/api/storage/reports?limit=5" : null);
  const [twin, setTwin] = useState<TelemetryResult | null>(null);
  const [twinErr, setTwinErr] = useState<ApiError | null>(null);
  const runTwin = () => { setTwinErr(null); request<TelemetryResult>("/api/telemetry/simulate", { method: "POST", body: JSON.stringify({ duration_min: 120, step_s: 60, seed: 11, faults: [{ kind: "excess_load", start_min: 60, duration_min: 30, magnitude: 60 }] }) }).then(setTwin).catch((e) => setTwinErr(e instanceof ApiError ? e : new ApiError("unknown", "Unexpected error", 0))); };
  useEffect(runTwin, []);
  const refresh = () => { wx.reload(); neo.reload(); quakes.reload(); src.reload(); runTwin(); };

  const f = wx.data?.data;
  const hourly = useMemo(() => (f ? (f.hourly.time ?? []).slice(0, 24).map((t, i) => ({ t: String(t).slice(11, 16), temp: (f.hourly.temperature_2m?.[i] ?? null) as number | null })) : []), [f]);
  const closest = useMemo(() => [...(neo.data?.data ?? [])].filter((r) => r.miss_distance_lunar !== null).sort((a, b) => (a.miss_distance_lunar ?? 0) - (b.miss_distance_lunar ?? 0)).slice(0, 6), [neo.data]);
  const failing = (src.data?.sources ?? []).filter((s) => ["auth_failed", "unavailable", "rate_limited"].includes(s.status));
  const sessionSets = Object.values(datasets);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={LayoutDashboard} eyebrow="Module 12" title="Mission Control Dashboard" description="One view across the platform. Every panel names its source and time; the satellite panel is simulated and labelled as such."
        actions={<Button onClick={refresh}><RefreshCw size={14} aria-hidden /> Refresh all</Button>} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4"><LocationPicker />
          <Card className="p-4"><label className="block text-sm font-medium">Near-Earth objects from<input type="date" value={neoStart} onChange={(e) => e.target.value && setNeoStart(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label><p className="mt-1 text-xs text-mute">7-day window.</p></Card></div>
        <div className="space-y-3"><MapView center={[location.lat, location.lon]} zoom={3} height="h-[24rem]" points={(quakes.data?.data ?? []).map((q) => ({ id: q.id ?? `${q.latitude}${q.longitude}`, lat: q.latitude, lon: q.longitude, color: "#8B5CF6", radius: Math.max(3, (q.magnitude ?? 1) * 1.4), popup: <span className="text-xs text-slate-900">M{q.magnitude} {q.place}</span> }))} legend={[{ color: "#8B5CF6", label: "USGS earthquakes M4.5+ past week (observations)" }]} />
          <MetaFooter meta={quakes.data?.meta} /></div></div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5"><SectionHeader title="Weather" /><DataState loading={wx.loading && !wx.data} error={wx.error} onRetry={wx.reload}>{f && (<>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{f.current.temperature_2m}<span className="ml-1 text-base font-normal text-mute">{f.current_units.temperature_2m}</span></p>
          <p className="text-xs text-mute">{location.name} · feels like {f.current.apparent_temperature}{f.current_units.apparent_temperature} · wind {f.current.wind_speed_10m} {f.current_units.wind_speed_10m} {typeof f.current.wind_direction_10m === "number" ? compass(f.current.wind_direction_10m) : ""}</p>
          <div className="mt-3"><SeriesChart title="Next 24 hours temperature forecast" data={hourly} xKey="t" series={[{ key: "temp", label: "Temperature (forecast)", color: COLORS.bad }]} height={150} /></div><MetaFooter meta={wx.data?.meta} /></>)}</DataState></Card>
        <Card className="p-5"><SectionHeader title="Near-Earth objects" /><DataState loading={neo.loading && !neo.data} error={neo.error} onRetry={neo.reload} empty={!!neo.data && closest.length === 0} emptyMessage="No close approaches in this window.">
          <p className="mt-2 text-xs text-mute">{neo.data?.data.length ?? 0} flyby record(s) {neoStart} → {end}. Flybys, not impact predictions.</p>
          <div className="mt-2"><BarsChart title="Closest approaches in lunar distances" data={closest.map((r) => ({ name: (r.name ?? "").replace(/[()]/g, ""), ld: r.miss_distance_lunar }))} xKey="name" series={[{ key: "ld", label: "Lunar distances", color: COLORS.signal }]} height={170} /></div><MetaFooter meta={neo.data?.meta} /></DataState></Card>
        <Card className="p-5"><SectionHeader title="Satellite digital twin" /><div className="mt-3"><SimulatedBanner /></div>
          <DataState loading={!twin && !twinErr} error={twinErr} onRetry={runTwin}>{twin && (<><ul className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(twin.component_status).map(([c, s]) => (<li key={c} className="flex items-center justify-between rounded-lg border border-line bg-panel px-2.5 py-1.5 capitalize"><span>{c}</span><span className={s === "ok" ? "text-ok" : s === "warning" ? "text-warn" : "text-bad"}>{s}</span></li>))}</ul>
            <p className="mt-3 text-xs text-mute">Demo run with an injected load fault: {twin.alerts.length} alert(s). <Link className="text-electric hover:text-signal" to="/digital-twin">Open the twin →</Link></p></>)}</DataState></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><SectionHeader title="Alerts" />
          <ul className="mt-3 space-y-2 text-sm">
            {failing.map((s) => <li key={s.id} className="flex items-start gap-2 text-bad"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />Data source “{s.name}” is {s.status.replace("_", " ")}{s.last_error ? ` — ${s.last_error}` : ""}</li>)}
            {twin?.alerts.map((a) => <li key={a.id} className="flex items-start gap-2 text-warn"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden /><span><span className="font-mono text-xs">[SIMULATED]</span> {a.title} — {a.reason}</span></li>)}
            {failing.length === 0 && !twin?.alerts.length && <li className="text-mute">No active alerts.</li>}</ul></Card>
        <Card className="p-5"><SectionHeader title="Data sources" /><DataState loading={src.loading && !src.data} error={src.error} onRetry={src.reload}><ul className="mt-3 space-y-2">{src.data?.sources.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{s.name}</span><StatusPill status={s.status} /></li>)}</ul><Link to="/settings" className="mt-3 inline-block text-sm text-electric hover:text-signal">Manage sources →</Link></DataState></Card>
      </div>

      <Card className="p-5"><SectionHeader title="Recent reports & datasets" />
        <ul className="mt-3 space-y-1.5 text-sm">
          {sessionSets.map((d) => d && <li key={d.key} className="flex flex-wrap justify-between gap-2"><span>{REPORT_LABELS[d.key]} <span className="text-mute">— {d.title}</span></span><span className="text-xs text-mute">retrieved {formatTimestamp(d.retrievedAt)} (this session)</span></li>)}
          {reports.data?.data.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2"><span>{String(r.title)}</span><span className="text-xs text-mute">saved {formatTimestamp(String(r.created_at))}</span></li>)}
          {sessionSets.length === 0 && !reports.data?.data.length && <li className="text-mute">Nothing yet. Load data in a module, then build a report.{storage.data && !storage.data.configured ? " (Saved reports need the optional Supabase database.)" : ""}</li>}</ul></Card>

      <section aria-labelledby="qn"><SectionHeader id="qn" title="Quick navigation" /><ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{MODULES.filter((m) => m.id !== "mission-control").map((m) => <li key={m.id}><Link to={m.path} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-signal/60"><m.icon size={16} className="text-signal" aria-hidden />{m.navLabel}</Link></li>)}</ul></section>
    </div>
  );
}
