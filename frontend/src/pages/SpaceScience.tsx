import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Telescope } from "lucide-react";
import { Pill } from "../components/Badges";
import { Button } from "../components/Button";
import { BarsChart, COLORS, ScatterPlot } from "../components/Charts";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { NumberField, SelectField, Tabs, TextField } from "../components/Fields";
import { MetaFooter } from "../components/MetaFooter";
import { PageHeader } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";
import { useWorkspace } from "../hooks/useWorkspace";
import type { Apod, Envelope, Exoplanet, ExoplanetData, NasaImage, NeoRow } from "../types/api";
import { downloadText, toCsv } from "../utils/csv";
import { addDays, isoDate } from "../utils/format";
import { fmt } from "../utils/geo";

type Tab = "apod" | "neo" | "exo" | "images" | "missions";
const METHODS = ["", "Transit", "Radial Velocity", "Imaging", "Microlensing", "Transit Timing Variations", "Eclipse Timing Variations", "Orbital Brightness Modulation", "Pulsar Timing", "Astrometry"];

export default function SpaceScience() {
  const [tab, setTab] = useState<Tab>("apod");
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={Telescope} eyebrow="Module 06" title="Space Science & Astronomy" description="Astronomy imagery, near-Earth object close approaches, confirmed exoplanets and NASA imagery from public archives." />
      <Tabs label="Space science views" value={tab} onChange={setTab} tabs={[{ id: "apod", label: "Picture of the day" }, { id: "neo", label: "Near-Earth objects" }, { id: "exo", label: "Exoplanets" }, { id: "images", label: "NASA imagery" }, { id: "missions", label: "Missions" }]} />
      {tab === "apod" && <ApodView />}{tab === "neo" && <NeoView />}{tab === "exo" && <ExoView />}{tab === "images" && <ImagesView />}
      {tab === "missions" && <Card className="p-6"><SectionHeader title="NASA mission information" description="No documented mission-status data source is connected yet, so mission status, launch dates and discovery dates are deliberately not shown. Nothing here is invented." /></Card>}
    </div>
  );
}

function ApodView() {
  const [day, setDay] = useState("");
  const a = useApi<Envelope<Apod>>(`/api/space/apod${day ? `?day=${day}` : ""}`);
  const d = a.data?.data;
  return (<Card className="space-y-4 p-5">
    <label className="block max-w-xs text-sm font-medium">Date (optional)<input type="date" value={day} min="1995-06-16" max={isoDate(new Date())} onChange={(e) => setDay(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
    <DataState loading={a.loading} error={a.error} onRetry={a.reload} loadingLabel="Loading picture of the day">{d && (<div className="grid gap-6 lg:grid-cols-2">
      <div>{d.media_type === "image" ? <img src={d.url} alt={d.title} className="w-full rounded-lg border border-line" /> : <a className="inline-flex items-center gap-1 text-electric" href={d.url} target="_blank" rel="noreferrer">Open today’s media (not an image) <ExternalLink size={13} aria-hidden /></a>}</div>
      <div><h3 className="text-xl font-semibold">{d.title}</h3><p className="mt-1 text-xs text-mute">{d.date}{d.copyright ? ` · © ${d.copyright.trim()}` : " · NASA"}</p><p className="mt-4 text-sm leading-relaxed text-mute">{d.explanation}</p></div></div>)}
      <MetaFooter meta={a.data?.meta} /></DataState></Card>);
}

function NeoView() {
  const { publish } = useWorkspace();
  const [start, setStart] = useState(isoDate(new Date()));
  const [end, setEnd] = useState(isoDate(addDays(new Date(), 6)));
  const [sel, setSel] = useState<NeoRow | null>(null);
  const span = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  const ok = start <= end && span <= 7;
  const neo = useApi<Envelope<NeoRow[]>>(ok ? `/api/space/neo-feed?start=${start}&end=${end}` : null);
  const rows = neo.data?.data ?? [];
  const cols: Column<NeoRow>[] = [
    { key: "d", label: "Approach", value: (r) => r.approach_datetime ?? r.approach_date }, { key: "n", label: "Object", value: (r) => r.name },
    { key: "ld", label: "Miss distance (lunar)", value: (r) => r.miss_distance_lunar, numeric: true }, { key: "km", label: "Miss distance (km)", value: (r) => r.miss_distance_km, numeric: true },
    { key: "v", label: "Speed (km/s)", value: (r) => r.velocity_km_s, numeric: true }, { key: "dm", label: "Diameter max (m)", value: (r) => r.diameter_m_max, numeric: true },
    { key: "h", label: "PHA class.", value: (r) => (r.potentially_hazardous === null ? null : r.potentially_hazardous ? "Yes" : "No") }];
  const closest = useMemo(() => [...rows].filter((r) => r.miss_distance_lunar !== null).sort((a, b) => (a.miss_distance_lunar ?? 0) - (b.miss_distance_lunar ?? 0)).slice(0, 12).map((r) => ({ name: (r.name ?? "").replace(/[()]/g, ""), lunar: r.miss_distance_lunar })), [rows]);
  useEffect(() => { if (!neo.data) return; const m = neo.data.meta;
    publish({ key: "astronomy", title: `Near-Earth object close approaches ${start} → ${end}`, kind: "catalogue", source: m.source, sourceUrl: m.source_url, retrievedAt: m.retrieved_at, simulated: false, region: undefined,
      summary: `${rows.length} close-approach record(s) from NASA NeoWs. Close approaches are flybys, not impact predictions.`,
      keyValues: [{ label: "Records", value: String(rows.length) }, { label: "Closest approach", value: closest[0] ? `${closest[0].name}: ${fmt(closest[0].lunar, 2)} lunar distances` : "—" }, { label: "Classified potentially hazardous", value: String(rows.filter((r) => r.potentially_hazardous).length) }],
      table: { name: "Close approaches", columns: cols.map((c) => c.label), rows: rows.slice(0, 200).map((r) => cols.map((c) => c.value(r))) },
      methods: ["NASA NeoWs feed via the local backend", "Closest-approach ranking computed from miss-distance values"], limitations: ["Not an impact-risk assessment.", "‘Potentially hazardous’ is an orbit/brightness classification, not a prediction."], notes: m.notes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neo.data]);
  return (<div className="space-y-6">
    <div className="flex flex-wrap items-end gap-4"><label className="text-sm font-medium">Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1.5 block rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
      <label className="text-sm font-medium">End<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1.5 block rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label></div>
    {!ok && <p role="alert" className="text-sm text-bad">Start must not be after end, and the range is limited to 7 days.</p>}
    <div className="rounded-xl border border-electric/40 bg-electric/5 p-3 text-sm text-mute">A close approach is a <strong className="text-ink">flyby</strong> at the listed distance — not an impact prediction.</div>
    <DataState loading={neo.loading} error={neo.error} onRetry={neo.reload} empty={!!neo.data && rows.length === 0} emptyMessage="No close approaches in this range." loadingLabel="Loading near-Earth objects">
      <Card className="p-5"><SectionHeader title="Closest approaches" /><p className="mb-1 mt-3 text-sm text-mute">Miss distance in lunar distances (1 LD ≈ 384,400 km)</p><BarsChart title="Closest approaches in lunar distances" data={closest} xKey="name" series={[{ key: "lunar", label: "Lunar distances", color: COLORS.signal }]} height={240} /></Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]"><Card className="p-5"><DataTable rows={rows} columns={cols} rowKey={(r) => `${r.id}-${r.approach_datetime}`} caption="Near-Earth object close approaches" onSelect={setSel} selectedKey={sel ? `${sel.id}-${sel.approach_datetime}` : null} pageSize={10} />
        <Button className="mt-3" variant="ghost" onClick={() => downloadText("acrux_neo_close_approaches.csv", toCsv(cols.map((c) => c.label), rows.map((r) => cols.map((c) => c.value(r)))))}>Export CSV</Button></Card>
        <Card className="p-4 text-sm">{sel ? (<><p className="font-semibold">{sel.name}</p><dl className="mt-3 space-y-1 text-xs text-mute"><div>Approach: {sel.approach_datetime ?? sel.approach_date}</div><div>Miss distance: {fmt(sel.miss_distance_km, 0)} km ({fmt(sel.miss_distance_lunar, 2)} LD, {fmt(sel.miss_distance_au, 4)} au)</div><div>Relative speed: {fmt(sel.velocity_km_s, 2)} km/s</div><div>Diameter estimate: {fmt(sel.diameter_m_min, 0)}–{fmt(sel.diameter_m_max, 0)} m</div><div>Absolute magnitude H: {fmt(sel.absolute_magnitude_h, 2)}</div><div>Orbiting body: {sel.orbiting_body ?? "—"}</div></dl>
          <div className="mt-2 flex gap-1.5">{sel.potentially_hazardous && <Pill tone="warn">PHA classification</Pill>}{sel.sentry_object && <Pill tone="warn">Sentry-listed</Pill>}</div>{sel.jpl_url && <a href={sel.jpl_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-electric hover:text-signal">JPL record</a>}</>) : <p className="text-mute">Select a row for details. Diameters are estimates derived from brightness.</p>}</Card></div>
      <MetaFooter meta={neo.data?.meta} /></DataState></div>);
}

function ExoView() {
  const [name, setName] = useState(""); const [method, setMethod] = useState(""); const [y0, setY0] = useState<number | null>(null); const [y1, setY1] = useState<number | null>(null);
  const [q, setQ] = useState<string>("limit=200"); const [sel, setSel] = useState<Exoplanet | null>(null);
  const ex = useApi<Envelope<ExoplanetData>>(`/api/space/exoplanets?${q}`);
  const rows = ex.data?.data.planets ?? [];
  const apply = () => { const p = new URLSearchParams({ limit: "200" }); if (name.trim()) p.set("name", name.trim()); if (method) p.set("method", method); if (y0 !== null) p.set("year_min", String(Math.trunc(y0))); if (y1 !== null) p.set("year_max", String(Math.trunc(y1))); setQ(p.toString()); };
  const scat = rows.filter((r) => r.pl_orbper && r.pl_rade).map((r) => ({ x: r.pl_orbper!, y: r.pl_rade!, label: r.pl_name }));
  const byYear = useMemo(() => { const m = new Map<number, number>(); rows.forEach((r) => r.disc_year && m.set(r.disc_year, (m.get(r.disc_year) ?? 0) + 1)); return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, n]) => ({ year: String(year), planets: n })); }, [rows]);
  const cols: Column<Exoplanet>[] = [{ key: "n", label: "Planet", value: (r) => r.pl_name }, { key: "h", label: "Host star", value: (r) => r.hostname }, { key: "m", label: "Method", value: (r) => r.discoverymethod }, { key: "y", label: "Year", value: (r) => r.disc_year, numeric: true }, { key: "r", label: "Radius (R⊕)", value: (r) => r.pl_rade, numeric: true }, { key: "p", label: "Period (d)", value: (r) => r.pl_orbper, numeric: true }, { key: "d", label: "Distance (pc)", value: (r) => r.sy_dist, numeric: true }];
  return (<div className="space-y-6"><Card className="p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><TextField label="Planet name contains" value={name} onChange={setName} maxLength={40} />
    <SelectField label="Discovery method" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: m || "Any" }))} /><NumberField label="From year" value={y0} onChange={setY0} min={1989} max={2100} step={1} /><NumberField label="To year" value={y1} onChange={setY1} min={1989} max={2100} step={1} />
    <div className="flex items-end pb-5"><Button variant="primary" onClick={apply}>Search</Button></div></div></Card>
    <DataState loading={ex.loading} error={ex.error} onRetry={ex.reload} empty={!!ex.data && rows.length === 0} emptyMessage="No exoplanets match these filters." loadingLabel="Querying the NASA Exoplanet Archive">
      <div className="grid gap-6 md:grid-cols-2"><Card className="p-5"><p className="mb-2 text-sm font-medium">Radius vs orbital period (log–log; planets with both values)</p><ScatterPlot title="Exoplanet radius versus orbital period" points={scat} xLabel="Orbital period (days)" yLabel="Radius (Earth radii)" logX logY /></Card>
        <Card className="p-5"><p className="mb-2 text-sm font-medium">Planets per discovery year (in this result set)</p><BarsChart title="Planets per discovery year" data={byYear} xKey="year" series={[{ key: "planets", label: "Planets", color: COLORS.accent }]} /></Card></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]"><Card className="p-5"><DataTable rows={rows} columns={cols} rowKey={(r) => r.pl_name} caption="Exoplanets" onSelect={setSel} selectedKey={sel?.pl_name ?? null} pageSize={10} /></Card>
        <Card className="p-4 text-sm">{sel ? (<><p className="font-semibold">{sel.pl_name}</p><dl className="mt-3 space-y-1 text-xs text-mute"><div>Host: {sel.hostname ?? "—"} ({sel.sy_snum ?? "?"} star(s), {sel.sy_pnum ?? "?"} planet(s))</div><div>Method / year: {sel.discoverymethod ?? "—"} / {sel.disc_year ?? "—"}</div><div>Radius: {fmt(sel.pl_rade, 2)} R⊕</div><div>Mass (best estimate): {fmt(sel.pl_bmasse, 2)} M⊕</div><div>Period: {fmt(sel.pl_orbper, 3)} d</div><div>Equilibrium temp.: {fmt(sel.pl_eqt, 0)} K (modelled)</div><div>Distance: {fmt(sel.sy_dist, 1)} pc</div></dl></>) : <p className="text-mute">Select a planet. Blank values mean the archive has no value — not zero.</p>}</Card></div>
      <MetaFooter meta={ex.data?.meta} /></DataState></div>);
}

function ImagesView() {
  const [q, setQ] = useState("nebula"); const [query, setQuery] = useState("nebula");
  const im = useApi<Envelope<NasaImage[]>>(`/api/space/images?q=${encodeURIComponent(query)}&page_size=16`);
  const list = (im.data?.data ?? []).filter((i) => i.preview_url);
  return (<div className="space-y-5"><form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) setQuery(q.trim()); }}><label className="sr-only" htmlFor="ss-q">Search NASA images</label><input id="ss-q" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /><Button type="submit">Search</Button></form>
    <DataState loading={im.loading} error={im.error} onRetry={im.reload} empty={!!im.data && list.length === 0} emptyMessage="No previewable images found."><ul className="grid grid-cols-2 gap-4 md:grid-cols-4">{list.map((i) => (<li key={i.nasa_id ?? i.preview_url} className="overflow-hidden rounded-lg border border-line bg-surface"><img src={i.preview_url ?? ""} alt={i.title ?? "NASA image"} loading="lazy" className="aspect-[4/3] w-full object-cover" /><p className="p-2 text-xs"><span className="line-clamp-2 font-medium">{i.title}</span><span className="text-mute">{i.center ?? "NASA"}</span></p></li>))}</ul><MetaFooter meta={im.data?.meta} /></DataState></div>);
}
