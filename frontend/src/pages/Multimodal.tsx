import { useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { KindBadge, Pill } from "../components/Badges";
import { Button } from "../components/Button";
import { BarsChart, COLORS, SeriesChart } from "../components/Charts";
import { Card, SectionHeader } from "../components/Card";
import { SelectField } from "../components/Fields";
import { LocationPicker } from "../components/LocationPicker";
import { MapView } from "../components/MapView";
import { PageHeader } from "../components/PageHeader";
import { GIBS_LAYERS } from "./EarthObservation";
import { useSelection } from "../hooks/useSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { ApiError, request } from "../services/api";
import type { ChatReply, Earthquake, Envelope, FiresData, Forecast, NasaImage } from "../types/api";
import { addDays, isoDate } from "../utils/format";
import { bboxAreaKm2, bboxAround, fmt } from "../utils/geo";

type Status = { state: "idle" | "loading" | "ok" | "failed"; message?: string };
interface Result { bbox: [number, number, number, number]; area: number; wx?: Envelope<Forecast>; fires?: Envelope<FiresData>; quakes?: { events: Earthquake[]; meta: Envelope<Earthquake[]>["meta"] }; images?: Envelope<NasaImage[]>; at: string }
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Request failed.");
export const THRESHOLDS = { windKmh: 30, rainMm72h: 10, quakeMag: 4.5 };

export default function Multimodal() {
  const { location } = useSelection();
  const { publish, datasets } = useWorkspace();
  const [half, setHalf] = useState("2");
  const [use, setUse] = useState({ weather: true, fires: true, quakes: true, images: true });
  const [layerId, setLayerId] = useState(GIBS_LAYERS[0]!.id);
  const [date, setDate] = useState(isoDate(addDays(new Date(), -1)));
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [res, setRes] = useState<Result | null>(null);
  const [ai, setAi] = useState<{ text?: string; err?: string; loading: boolean }>({ loading: false });
  const bbox = bboxAround({ lat: location.lat, lon: location.lon }, Number(half));
  const layer = GIBS_LAYERS.find((l) => l.id === layerId)!;

  const run = async () => {
    setRes(null); setAi({ loading: false });
    const out: Result = { bbox, area: bboxAreaKm2(bbox), at: new Date().toISOString() };
    const st: Record<string, Status> = {};
    const set = (k: string, s: Status) => { st[k] = s; setStatus({ ...st }); };
    const jobs: Promise<void>[] = [];
    const job = (k: string, on: boolean, f: () => Promise<void>) => { if (!on) return; set(k, { state: "loading" }); jobs.push(f().then(() => set(k, { state: "ok" })).catch((e) => set(k, { state: "failed", message: errMsg(e) }))); };
    job("weather", use.weather, async () => { out.wx = await request<Envelope<Forecast>>(`/api/weather/forecast?lat=${location.lat}&lon=${location.lon}&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&days=3`); });
    job("fires", use.fires, async () => { out.fires = await request<Envelope<FiresData>>(`/api/fires?west=${bbox[0]}&south=${bbox[1]}&east=${bbox[2]}&north=${bbox[3]}&source=VIIRS_SNPP_NRT&day_range=2`); });
    job("quakes", use.quakes, async () => { const q = await request<Envelope<Earthquake[]>>("/api/disasters/earthquakes?feed=2.5_week"); out.quakes = { meta: q.meta, events: q.data.filter((e) => e.longitude >= bbox[0] && e.longitude <= bbox[2] && e.latitude >= bbox[1] && e.latitude <= bbox[3]) }; });
    job("images", use.images, async () => { const nm = location.name.split(",")[0]!.trim(); out.images = await request<Envelope<NasaImage[]>>(`/api/space/images?q=${encodeURIComponent(nm.length >= 2 ? nm : "earth")}&page_size=8`); });
    await Promise.all(jobs);
    setRes(out);
  };

  const ind = useMemo(() => {
    if (!res) return null;
    const h = res.wx?.data.hourly; const n = 72;
    const slice = (k: string) => ((h?.[k] ?? []).slice(0, n).filter((v) => typeof v === "number") as number[]);
    const wind = slice("wind_speed_10m"), rain = slice("precipitation"), temp = slice("temperature_2m");
    const nH = res.fires?.data.summary.count ?? null;
    const f = {
      hotspots: nH, density: nH === null ? null : (nH / res.area) * 1000, frpTotal: res.fires?.data.summary.frp_mw_total ?? null,
      maxWind: wind.length ? Math.max(...wind) : null, rain72: rain.length ? rain.reduce((a, b) => a + b, 0) : null, maxTemp: temp.length ? Math.max(...temp) : null,
      quakeN: res.quakes?.events.length ?? null, quakeMax: res.quakes?.events.length ? Math.max(...res.quakes.events.map((e) => e.magnitude ?? 0)) : null,
    };
    const flags: string[] = [];
    if (f.hotspots && f.maxWind !== null && f.maxWind >= THRESHOLDS.windKmh) flags.push(`Hotspot detections coincide with forecast winds up to ${fmt(f.maxWind)} km/h (≥ ${THRESHOLDS.windKmh}); wind can influence how fires spread. Context note, not a prediction.`);
    if (f.hotspots && f.rain72 !== null && f.rain72 >= THRESHOLDS.rainMm72h) flags.push(`Forecast rainfall of ${fmt(f.rain72)} mm over 72 h (≥ ${THRESHOLDS.rainMm72h}) may dampen fire activity. Context note, not a prediction.`);
    if (f.quakeMax !== null && f.quakeMax >= THRESHOLDS.quakeMag) flags.push(`An earthquake of magnitude ${fmt(f.quakeMax, 1)} was recorded in the box in the past week.`);
    if (f.hotspots === 0) flags.push("No hotspot detections in the period; this does not prove absence of fire (cloud cover and overpass timing).");
    return { ...f, flags };
  }, [res]);

  useEffect(() => {
    if (!res || !ind) return;
    publish({ key: "multimodal", title: `Multimodal analysis — ${location.name}`, kind: "derived", source: "Open-Meteo, NASA FIRMS, USGS, NASA Image Library (combined by Project Acrux)", retrievedAt: res.at,
      region: `${location.name}; box W${bbox[0]} S${bbox[1]} E${bbox[2]} N${bbox[3]} (~${fmt(res.area, 0)} km²)`, simulated: false,
      summary: `Combined view of hotspots, forecast weather and earthquakes for the selected box. ${ind.flags.length ? ind.flags.join(" ") : "No context flags were raised."}`,
      keyValues: [{ label: "Hotspot detections (2 days)", value: ind.hotspots === null ? "unavailable" : String(ind.hotspots) }, { label: "Hotspot density", value: ind.density === null ? "unavailable" : `${fmt(ind.density, 3)} per 1,000 km²` }, { label: "Max forecast wind (72 h)", value: ind.maxWind === null ? "unavailable" : `${fmt(ind.maxWind)} km/h` }, { label: "Forecast rain (72 h)", value: ind.rain72 === null ? "unavailable" : `${fmt(ind.rain72)} mm` }, { label: "Earthquakes in box (past week, M2.5+)", value: ind.quakeN === null ? "unavailable" : String(ind.quakeN) }],
      methods: ["Each source queried independently through the local backend", "Hotspot density = detections ÷ box area × 1,000", `Rule-based context flags with fixed thresholds (wind ≥ ${THRESHOLDS.windKmh} km/h, rain ≥ ${THRESHOLDS.rainMm72h} mm/72 h, quake ≥ M${THRESHOLDS.quakeMag})`],
      limitations: ["Sources differ in time and resolution; co-occurrence is not causation.", "No image classification, segmentation or change detection is performed.", "Context flags are simple rules, not fire-behaviour or hazard models."], notes: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  const askAi = async () => {
    if (!res || !ind) return;
    setAi({ loading: true });
    const ctx = [
      { label: "Hotspots", kind: "observed", source: "NASA FIRMS", timestamp: res.fires?.meta.retrieved_at ?? res.at, content: res.fires ? `${res.fires.data.summary.count} detections; total FRP ${res.fires.data.summary.frp_mw_total ?? "n/a"} MW` : "Unavailable" },
      { label: "Forecast weather (72 h)", kind: "forecast", source: "Open-Meteo", timestamp: res.wx?.meta.retrieved_at ?? res.at, content: res.wx ? `max wind ${ind.maxWind} km/h, rain ${ind.rain72} mm, max temp ${ind.maxTemp} °C` : "Unavailable" },
      { label: "Earthquakes", kind: "observed", source: "USGS", timestamp: res.quakes?.meta.retrieved_at ?? res.at, content: res.quakes ? `${ind.quakeN} events M2.5+ in box past week; max M${ind.quakeMax ?? "n/a"}` : "Unavailable" },
      { label: "Derived context flags", kind: "derived", source: "Project Acrux rules", timestamp: res.at, content: ind.flags.join(" ") || "None raised" },
    ];
    try { const r = await request<Envelope<ChatReply>>("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: `Interpret this combined data for ${location.name}. What stands out, and what can't be concluded?`, history: [], context: ctx }) }); setAi({ text: r.data.reply, loading: false }); }
    catch (e) { setAi({ err: errMsg(e), loading: false }); }
  };

  const hours = res?.wx ? (res.wx.data.hourly.time ?? []).slice(0, 72).map((t, i) => ({ t: String(t).slice(5, 13).replace("T", " "), temp: (res.wx!.data.hourly.temperature_2m?.[i] ?? null) as number | null })) : [];
  const fireDays = Object.entries(res?.fires?.data.summary.by_date ?? {}).map(([d, n]) => ({ date: d, detections: n }));
  const img = res?.images?.data.filter((i) => i.preview_url).slice(0, 4) ?? [];
  const toggle = (k: keyof typeof use) => setUse({ ...use, [k]: !use[k] });
  void datasets;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={Layers} eyebrow="Module 09" title="Multimodal Satellite Intelligence" description="Select a region, choose the data layers to combine, and review the result split into observed data, model forecasts, derived indicators and AI interpretation." />
      <ol className="grid gap-3 text-sm sm:grid-cols-4">{["1 · Select a region", "2 · Choose layers", "3 · Run analysis", "4 · Review & report"].map((s) => <li key={s} className="rounded-lg border border-line bg-surface px-3 py-2 text-mute">{s}</li>)}</ol>
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4"><LocationPicker /><Card className="space-y-3 p-4">
          <SelectField label="Region half-width" value={half} onChange={setHalf} options={[{ value: "1", label: "±1° (~220 km box)" }, { value: "2", label: "±2°" }, { value: "5", label: "±5°" }]} />
          <fieldset><legend className="text-sm font-medium">Data to combine</legend>{([["weather", "Forecast weather (Open-Meteo)"], ["fires", "Fire hotspots (FIRMS, needs key)"], ["quakes", "Earthquakes (USGS)"], ["images", "NASA image-library results"]] as const).map(([k, l]) => <label key={k} className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={use[k]} onChange={() => toggle(k)} />{l}</label>)}</fieldset>
          <SelectField label="Imagery preview layer" value={layerId} onChange={setLayerId} options={GIBS_LAYERS.map((l) => ({ value: l.id, label: l.label }))} />
          <label className="block text-sm font-medium">Imagery date<input type="date" value={date} max={isoDate(new Date())} onChange={(e) => setDate(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
          <Button variant="primary" onClick={() => void run()} disabled={!Object.values(use).some(Boolean)}>Run analysis</Button></Card></div>
        <div className="space-y-3"><MapView center={[location.lat, location.lon]} zoom={6} bbox={bbox} overlays={[{ id: `${layer.id}${date}`, url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${date}/${layer.matrix}/{z}/{y}/{x}.${layer.ext}`, attribution: "Imagery: NASA GIBS / EOSDIS", maxNativeZoom: layer.maxZoom }]}
          points={(res?.fires?.data.records ?? []).map((r, i) => ({ id: `f${i}`, lat: r.latitude, lon: r.longitude, color: "#F87171", radius: 3 }))} legend={[{ color: "#F87171", label: "FIRMS hotspot (observation)" }]} />
          <p className="text-xs text-mute">Map shows {layer.label} for {date} (satellite observation layer) over an OpenStreetMap base map. The dashed box is the analysis region (~{fmt(bboxAreaKm2(bbox), 0)} km²).</p></div></div>

      {Object.keys(status).length > 0 && <Card className="p-4"><p className="text-sm font-medium">Source status for this run</p><ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(status).map(([k, s]) => <li key={k} className="rounded-lg border border-line bg-panel p-2 text-xs"><span className="font-semibold capitalize">{k}</span>: <span className={s.state === "ok" ? "text-ok" : s.state === "failed" ? "text-bad" : "text-mute"}>{s.state}</span>{s.message && <p className="mt-1 text-mute">{s.message}</p>}</li>)}</ul></Card>}

      {res && ind && (<div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-5"><div className="flex items-center gap-2"><SectionHeader title="Directly observed source data" /><KindBadge kind="observation" /></div>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm"><dt className="text-mute">Hotspot detections (2 d, VIIRS SNPP)</dt><dd>{ind.hotspots ?? "unavailable"}</dd><dt className="text-mute">Total FRP</dt><dd>{ind.frpTotal === null ? "n/a" : `${fmt(ind.frpTotal)} MW`}</dd><dt className="text-mute">Earthquakes in box (M2.5+, 7 d)</dt><dd>{ind.quakeN ?? "unavailable"}</dd><dt className="text-mute">Strongest earthquake</dt><dd>{ind.quakeMax === null ? "—" : `M${fmt(ind.quakeMax, 1)}`}</dd></dl>
          <p className="mb-1 text-xs font-medium">Hotspots per date</p><BarsChart title="Hotspots per date" data={fireDays} xKey="date" series={[{ key: "detections", label: "Detections", color: COLORS.bad }]} height={150} emptyText="No hotspot data in this run." /></Card>
        <Card className="space-y-3 p-5"><div className="flex items-center gap-2"><SectionHeader title="Model forecast" /><KindBadge kind="forecast" /></div>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm"><dt className="text-mute">Max wind, next 72 h</dt><dd>{ind.maxWind === null ? "unavailable" : `${fmt(ind.maxWind)} km/h`}</dd><dt className="text-mute">Rain, next 72 h</dt><dd>{ind.rain72 === null ? "unavailable" : `${fmt(ind.rain72)} mm`}</dd><dt className="text-mute">Max temperature, next 72 h</dt><dd>{ind.maxTemp === null ? "unavailable" : `${fmt(ind.maxTemp)} °C`}</dd></dl>
          <p className="mb-1 text-xs font-medium">Temperature forecast (°C)</p><SeriesChart title="72-hour temperature forecast" data={hours} xKey="t" series={[{ key: "temp", label: "Temperature", color: COLORS.warn }]} height={150} emptyText="No weather data in this run." /></Card>
        <Card className="space-y-3 p-5"><div className="flex items-center gap-2"><SectionHeader title="Calculated / derived indicators" /><KindBadge kind="derived" /></div>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm"><dt className="text-mute">Region area</dt><dd>{fmt(res.area, 0)} km²</dd><dt className="text-mute">Hotspot density</dt><dd>{ind.density === null ? "unavailable" : `${fmt(ind.density, 3)} / 1,000 km²`}</dd></dl>
          <p className="text-xs font-medium">Rule-based context flags</p>{ind.flags.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-mute">{ind.flags.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="text-sm text-mute">No flags raised.</p>}
          <p className="text-xs text-mute">Method: density = detections ÷ area × 1,000. Flags use fixed thresholds (wind ≥ {THRESHOLDS.windKmh} km/h, rain ≥ {THRESHOLDS.rainMm72h} mm/72 h, quake ≥ M{THRESHOLDS.quakeMag}). They are context notes, not hazard models.</p></Card>
        <Card className="space-y-3 p-5"><div className="flex items-center gap-2"><SectionHeader title="AI-generated interpretation" /><Pill tone="warn">AI — not a measurement</Pill></div>
          <Button onClick={() => void askAi()} disabled={ai.loading}>{ai.loading ? "Asking the assistant…" : "Interpret with the AI assistant"}</Button>
          {ai.text && <p className="whitespace-pre-wrap text-sm leading-relaxed text-mute">{ai.text}</p>}{ai.err && <p role="alert" className="text-sm text-bad">{ai.err}</p>}
          <p className="text-xs text-mute">Only the values above are sent, each labelled by kind. Simulated results: none in this analysis.</p></Card>
        {img.length > 0 && <Card className="p-5 lg:col-span-2"><div className="flex items-center gap-2"><SectionHeader title="NASA image-library results" /><KindBadge kind="catalogue" /></div><ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{img.map((i) => <li key={i.nasa_id ?? i.preview_url} className="overflow-hidden rounded-lg border border-line"><img src={i.preview_url ?? ""} alt={i.title ?? "NASA image"} loading="lazy" className="aspect-[4/3] w-full object-cover" /><p className="p-2 text-xs">{i.title}<br /><span className="text-mute">{i.center ?? "NASA"}</span></p></li>)}</ul><p className="mt-2 text-xs text-mute">Catalogue images matched by place name; they may not depict this exact region or date.</p></Card>}
        <p className="text-sm text-mute lg:col-span-2">The combined result is now available on the Reports page as a “Multimodal geospatial intelligence” report.</p></div>)}
    </div>
  );
}
