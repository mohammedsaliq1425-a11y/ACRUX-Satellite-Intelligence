import { useEffect, useMemo, useState } from "react";
import { Download, Flame } from "lucide-react";
import { BarsChart, COLORS } from "../components/Charts";
import { Button } from "../components/Button";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { NumberField, SelectField, Tabs } from "../components/Fields";
import { LocationPicker } from "../components/LocationPicker";
import { MapView } from "../components/MapView";
import { MetaFooter } from "../components/MetaFooter";
import { PageHeader } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";
import { useSelection } from "../hooks/useSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import type { Earthquake, Envelope, FireRecord, FiresData } from "../types/api";
import { downloadText, toCsv } from "../utils/csv";
import { addDays, isoDate } from "../utils/format";
import { bboxAreaKm2, bboxAround, fmt } from "../utils/geo";

const confTier = (c: string | null): "high" | "nominal" | "low" | "unknown" => {
  if (c === null) return "unknown";
  if (/^[0-9.]+$/.test(c)) { const n = Number(c); return n >= 80 ? "high" : n >= 30 ? "nominal" : "low"; }   // MODIS 0-100
  return c === "h" ? "high" : c === "n" ? "nominal" : c === "l" ? "low" : "unknown";                          // VIIRS l/n/h
};
const TIER_COLOR = { high: "#F87171", nominal: "#FB923C", low: "#FBBF24", unknown: "#94A3B8" };
const FIRE_COLS: Column<FireRecord>[] = [
  { key: "t", label: "Acquired (UTC)", value: (r) => r.acq_datetime_utc ?? r.acq_date },
  { key: "lat", label: "Lat", value: (r) => r.latitude, numeric: true }, { key: "lon", label: "Lon", value: (r) => r.longitude, numeric: true },
  { key: "sat", label: "Satellite", value: (r) => r.satellite }, { key: "ins", label: "Instrument", value: (r) => r.instrument },
  { key: "conf", label: "Confidence", value: (r) => r.confidence }, { key: "frp", label: "FRP (MW)", value: (r) => r.frp, numeric: true }, { key: "dn", label: "Day/Night", value: (r) => r.daynight },
];
const FEEDS = [{ value: "2.5_day", label: "M2.5+ past day" }, { value: "2.5_week", label: "M2.5+ past week" }, { value: "4.5_day", label: "M4.5+ past day" }, { value: "4.5_week", label: "M4.5+ past week" }, { value: "significant_week", label: "Significant, past week" }] as const;

export default function Wildfire() {
  const { location } = useSelection();
  const { publish } = useWorkspace();
  const [tab, setTab] = useState<"fire" | "quake" | "other">("fire");
  const [half, setHalf] = useState("2");
  const [source, setSource] = useState("VIIRS_SNPP_NRT");
  const [days, setDays] = useState<number | null>(2);
  const [start, setStart] = useState("");
  const [feed, setFeed] = useState<(typeof FEEDS)[number]["value"]>("2.5_day");
  const [query, setQuery] = useState<string | null>(null);
  const bbox = bboxAround({ lat: location.lat, lon: location.lon }, Number(half));
  const daysOk = days !== null && Number.isInteger(days) && days >= 1 && days <= 5;
  const startOk = start === "" || (start <= isoDate(new Date()) && start >= isoDate(addDays(new Date(), -400)));

  const fires = useApi<Envelope<FiresData>>(query);
  const quakes = useApi<Envelope<Earthquake[]>>(tab === "quake" ? `/api/disasters/earthquakes?feed=${feed}` : null);
  const load = () => setQuery(`/api/fires?west=${bbox[0]}&south=${bbox[1]}&east=${bbox[2]}&north=${bbox[3]}&source=${source}&day_range=${days}${start ? `&start_date=${start}` : ""}`);

  const recs = fires.data?.data.records ?? [];
  const sum = fires.data?.data.summary;
  const points = useMemo(() => recs.map((r, i) => ({ id: String(i), lat: r.latitude, lon: r.longitude, color: TIER_COLOR[confTier(r.confidence)], radius: 4,
    popup: <div className="text-xs text-slate-900"><b>{r.acq_datetime_utc ?? r.acq_date}</b><br />{r.instrument} · {r.satellite}<br />confidence {r.confidence ?? "n/a"} · FRP {r.frp ?? "n/a"} MW</div> })), [recs]);

  useEffect(() => {
    const d = fires.data; if (!d) return;
    publish({ key: "wildfire", title: `FIRMS hotspot detections — ${location.name}`, kind: "observation", source: d.meta.source, sourceUrl: d.meta.source_url, retrievedAt: d.meta.retrieved_at,
      region: `Box W${d.data.query.bbox[0]} S${d.data.query.bbox[1]} E${d.data.query.bbox[2]} N${d.data.query.bbox[3]} (~${fmt(bboxAreaKm2(d.data.query.bbox as [number, number, number, number]), 0)} km²)`, simulated: false,
      summary: `${d.data.summary.count} satellite hotspot detection(s) in the selected box over ${d.data.query.day_range} day(s). Detections are observations, not confirmed fires.`,
      keyValues: [{ label: "Detections", value: String(d.data.summary.count) }, { label: "Total FRP", value: d.data.summary.frp_mw_total === null ? "n/a" : `${fmt(d.data.summary.frp_mw_total)} MW (${d.data.summary.frp_records_with_value} records with FRP)` }, { label: "Max FRP", value: d.data.summary.frp_mw_max === null ? "n/a" : `${fmt(d.data.summary.frp_mw_max)} MW` }, { label: "Product", value: d.data.query.source }],
      table: { name: "Hotspot records (first 200)", columns: FIRE_COLS.map((c) => c.label), rows: d.data.records.slice(0, 200).map((r) => FIRE_COLS.map((c) => c.value(r))) },
      methods: ["NASA FIRMS area API (CSV) via the local backend", "Summary statistics computed only from the retrieved records"],
      limitations: ["Detections are thermal anomalies at sensor pixel resolution; they do not delineate a fire perimeter.", "Confidence scales differ between VIIRS (l/n/h) and MODIS (0–100).", "Absence of detections does not prove absence of fire (clouds, overpass timing)."], notes: d.meta.notes });
  }, [fires.data, location.name, publish]);

  const dateBars = Object.entries(sum?.by_date ?? {}).map(([d, n]) => ({ date: d, detections: n }));
  const confBars = Object.entries(sum?.by_confidence ?? {}).map(([c, n]) => ({ confidence: c, detections: n }));
  const qs = quakes.data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={Flame} eyebrow="Module 02" title="Wildfire & Disaster Monitoring" description="NASA FIRMS satellite hotspot detections and USGS earthquake events, with an explicit list of hazards that have no data integration." />
      <Tabs label="Hazard views" value={tab} onChange={setTab} tabs={[{ id: "fire", label: "Wildfire hotspots" }, { id: "quake", label: "Earthquakes" }, { id: "other", label: "Other hazards" }]} />
      {tab === "fire" && (<>
        <div className="rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm text-mute">Hotspots are satellite thermal-anomaly <strong className="text-ink">detections</strong>, not confirmed fires, and they do not show a fire’s exact boundary.</div>
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <div className="space-y-4"><LocationPicker />
            <Card className="space-y-3 p-4">
              <SelectField label="Search half-width" value={half} onChange={setHalf} options={[{ value: "1", label: "±1° (~220 km box)" }, { value: "2", label: "±2°" }, { value: "5", label: "±5°" }, { value: "10", label: "±10°" }]} />
              <SelectField label="FIRMS product" value={source} onChange={setSource} options={[{ value: "VIIRS_SNPP_NRT", label: "VIIRS Suomi NPP (NRT)" }, { value: "VIIRS_NOAA20_NRT", label: "VIIRS NOAA-20 (NRT)" }, { value: "VIIRS_NOAA21_NRT", label: "VIIRS NOAA-21 (NRT)" }, { value: "MODIS_NRT", label: "MODIS (NRT)" }]} />
              <NumberField label="Days of data" value={days} onChange={setDays} min={1} max={5} step={1} />
              <label className="block text-sm font-medium">Start date (optional)<input type="date" value={start} max={isoDate(new Date())} onChange={(e) => setStart(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
              {!startOk && <p role="alert" className="text-xs text-bad">Start date must not be in the future.</p>}
              <Button variant="primary" disabled={!daysOk || !startOk} onClick={load}>Load hotspots</Button>
            </Card></div>
          <div className="space-y-6">
            <MapView center={[location.lat, location.lon]} zoom={6} points={points} bbox={bbox} legend={(["high", "nominal", "low", "unknown"] as const).map((k) => ({ color: TIER_COLOR[k], label: `${k} confidence` }))} />
            {!query && <p className="text-sm text-mute">Choose a location and press “Load hotspots”. A FIRMS MAP_KEY is required (see Settings).</p>}
            {query && (
              <DataState loading={fires.loading} error={fires.error} onRetry={fires.reload} empty={!!fires.data && recs.length === 0} emptyMessage="No hotspot detections in this box and period. That does not prove no fire occurred." loadingLabel="Loading hotspots">
                {sum && (<>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[["Detections", String(sum.count)], ["Total FRP", sum.frp_mw_total === null ? "n/a" : `${fmt(sum.frp_mw_total)} MW`], ["Max FRP", sum.frp_mw_max === null ? "n/a" : `${fmt(sum.frp_mw_max)} MW`], ["Mean FRP", sum.frp_mw_mean === null ? "n/a" : `${fmt(sum.frp_mw_mean)} MW`]].map(([l, v]) => (
                      <div key={l} className="rounded-xl border border-line bg-panel p-4"><p className="text-xs uppercase tracking-wide text-mute">{l}</p><p className="mt-1 text-xl font-semibold">{v}</p></div>))}
                  </div>
                  {fires.data?.data.truncated && <p className="text-xs text-warn">Result truncated to the first 5,000 records; narrow the box or dates.</p>}
                  <div className="grid gap-6 md:grid-cols-2"><div><p className="mb-1 text-sm font-medium">Detections per acquisition date</p><BarsChart title="Detections per date" data={dateBars} xKey="date" series={[{ key: "detections", label: "Detections", color: COLORS.bad }]} /></div>
                    <div><p className="mb-1 text-sm font-medium">Detections by reported confidence</p><BarsChart title="Detections by confidence" data={confBars} xKey="confidence" series={[{ key: "detections", label: "Detections", color: COLORS.warn }]} /></div></div>
                  <Card className="p-5"><div className="mb-3 flex items-center justify-between"><SectionHeader title="Hotspot records" />
                    <Button onClick={() => downloadText("acrux_firms_hotspots.csv", toCsv(FIRE_COLS.map((c) => c.label), recs.map((r) => FIRE_COLS.map((c) => c.value(r)))))}><Download size={14} aria-hidden /> Export CSV</Button></div>
                    <DataTable rows={recs} columns={FIRE_COLS} rowKey={(r) => `${r.latitude},${r.longitude},${r.acq_datetime_utc}`} caption="FIRMS hotspot records" pageSize={10} /></Card>
                  <MetaFooter meta={fires.data?.meta} /></>)}
              </DataState>)}
          </div></div></>)}
      {tab === "quake" && (<div className="space-y-5">
        <div className="max-w-xs"><SelectField label="USGS feed" value={feed} onChange={setFeed} options={[...FEEDS]} /></div>
        <DataState loading={quakes.loading} error={quakes.error} onRetry={quakes.reload} empty={!!quakes.data && qs.length === 0} emptyMessage="No events in this feed." loadingLabel="Loading earthquakes">
          <MapView center={[location.lat, location.lon]} zoom={2} marker={false} points={qs.map((q) => ({ id: q.id ?? `${q.latitude},${q.longitude}`, lat: q.latitude, lon: q.longitude, color: "#8B5CF6", radius: Math.max(3, (q.magnitude ?? 1) * 1.6), popup: <div className="text-xs text-slate-900"><b>M{q.magnitude ?? "?"}</b> {q.place}<br />{q.time_utc}</div> }))} legend={[{ color: "#8B5CF6", label: "Earthquake (size ∝ magnitude)" }]} />
          <Card className="mt-5 p-5"><DataTable rows={qs} caption="Earthquake events" pageSize={10} rowKey={(r) => r.id ?? `${r.latitude}${r.longitude}${r.time_utc}`}
            columns={[{ key: "t", label: "Time (UTC)", value: (r) => r.time_utc }, { key: "m", label: "Mag.", value: (r) => r.magnitude, numeric: true }, { key: "p", label: "Place", value: (r) => r.place }, { key: "d", label: "Depth (km)", value: (r) => r.depth_km, numeric: true }, { key: "s", label: "Status", value: (r) => r.status }]} /></Card>
          <MetaFooter meta={quakes.data?.meta} /></DataState></div>)}
      {tab === "other" && (<Card className="p-6"><SectionHeader title="Hazards without a data integration" description="These are shown as unavailable rather than filled with invented events. No disaster predictions are made anywhere in Project Acrux." />
        <ul className="mt-4 space-y-2 text-sm text-mute">{["Floods", "Tropical cyclones", "Drought"].map((h) => <li key={h} className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full bg-mute" /><strong className="text-ink">{h}</strong> — no working data source connected.</li>)}</ul></Card>)}
    </div>
  );
}
