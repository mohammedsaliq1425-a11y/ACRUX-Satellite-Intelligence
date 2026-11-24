import { useEffect, useState } from "react";
import { Download, Globe } from "lucide-react";
import { Pill } from "../components/Badges";
import { Button } from "../components/Button";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { SelectField } from "../components/Fields";
import { LocationPicker } from "../components/LocationPicker";
import { MapView } from "../components/MapView";
import type { TileOverlay } from "../components/MapView";
import { MetaFooter } from "../components/MetaFooter";
import { PageHeader } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";
import { useSelection } from "../hooks/useSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import type { Envelope, NasaImage } from "../types/api";
import { downloadText, toCsv } from "../utils/csv";
import { addDays, formatTimestamp, isoDate } from "../utils/format";

interface Layer { id: string; label: string; platform: string; matrix: string; ext: string; maxZoom: number; legend: string }
export const GIBS_LAYERS: Layer[] = [
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", label: "MODIS Terra — true colour", platform: "Terra / MODIS", matrix: "GoogleMapsCompatible_Level9", ext: "jpg", maxZoom: 9, legend: "Surface reflectance rendered as natural colour; clouds appear white." },
  { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", label: "VIIRS Suomi NPP — true colour", platform: "Suomi NPP / VIIRS", matrix: "GoogleMapsCompatible_Level9", ext: "jpg", maxZoom: 9, legend: "Surface reflectance rendered as natural colour; clouds appear white." },
  { id: "MODIS_Terra_Land_Surface_Temp_Day", label: "MODIS Terra — land surface temperature (day)", platform: "Terra / MODIS", matrix: "GoogleMapsCompatible_Level7", ext: "png", maxZoom: 7, legend: "Retrieved land-surface temperature (colour scale as published by GIBS); gaps where cloud blocks the view." },
];
const overlayFor = (l: Layer, date: string): TileOverlay => ({ id: `${l.id}-${date}`, url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.id}/default/${date}/${l.matrix}/{z}/{y}/{x}.${l.ext}`, attribution: "Imagery: NASA GIBS / EOSDIS", maxNativeZoom: l.maxZoom });

export default function EarthObservation() {
  const { location, setLocation } = useSelection();
  const { publish } = useWorkspace();
  const [layerId, setLayerId] = useState<string>(GIBS_LAYERS[0]!.id);
  const [none, setNone] = useState(false);
  const yesterday = isoDate(addDays(new Date(), -1));
  const [date, setDate] = useState(yesterday);
  const [compare, setCompare] = useState(false);
  const [dateB, setDateB] = useState(isoDate(addDays(new Date(), -31)));
  const [q, setQ] = useState("earth observation");
  const [query, setQuery] = useState("earth observation");
  const [sel, setSel] = useState<NasaImage | null>(null);
  const layer = GIBS_LAYERS.find((l) => l.id === layerId)!;
  const imgs = useApi<Envelope<NasaImage[]>>(`/api/space/images?q=${encodeURIComponent(query)}&page_size=12`);
  const list = (imgs.data?.data ?? []).filter((i) => i.preview_url);
  const dateOk = date <= isoDate(new Date()) && date >= "2000-02-24";

  useEffect(() => {
    if (!imgs.data) return;
    const m = imgs.data.meta;
    publish({ key: "earth_observation", title: `Earth observation — ${location.name}`, kind: "catalogue", source: `${m.source}; NASA GIBS (map layer)`, sourceUrl: m.source_url, retrievedAt: m.retrieved_at,
      region: `${location.name} (${location.lat.toFixed(3)}°, ${location.lon.toFixed(3)}°)`, simulated: false,
      summary: `Selected imagery layer: ${none ? "none (base map only)" : `${layer.label}, ${date}`}. ${list.length} catalogue image(s) returned for “${query}”.`,
      keyValues: [{ label: "Layer", value: none ? "None" : layer.label }, { label: "Layer date", value: none ? "—" : date }, { label: "Search", value: query }, { label: "Images listed", value: String(list.length) }],
      table: { name: "NASA image-library results", columns: ["NASA ID", "Title", "Date created", "Center", "Credit"], rows: list.map((i) => [i.nasa_id, i.title, i.date_created, i.center, [i.photographer, i.secondary_creator].filter(Boolean).join("; ") || null]) },
      methods: ["NASA GIBS WMTS tiles displayed in the browser (not analysed)", "NASA Image and Video Library search via the local backend"],
      limitations: ["Map tiles are displayed, not processed; no derived analysis is performed here.", "Library images are catalogue items and may not depict the selected location."], notes: m.notes });
  }, [imgs.data, location, layer, date, none, query, list.length, publish]);

  const overlays = none ? [] : [overlayFor(layer, date)];
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={Globe} eyebrow="Module 01" title="Earth Observation Intelligence" description="Explore NASA GIBS satellite layers on a map and browse NASA image-library results. Each layer is labelled by what it actually is." />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4"><LocationPicker />
          <Card className="space-y-3 p-4">
            <SelectField label="Satellite layer" value={none ? "none" : layerId} onChange={(v) => { if (v === "none") setNone(true); else { setNone(false); setLayerId(v); } }}
              options={[{ value: "none", label: "None (base map only)" }, ...GIBS_LAYERS.map((l) => ({ value: l.id, label: l.label }))]} />
            <label className="block text-sm font-medium">Observation date<input type="date" value={date} min="2000-02-24" max={isoDate(new Date())} onChange={(e) => setDate(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
            {!dateOk && <p role="alert" className="text-xs text-bad">Choose a date between 2000-02-24 and today.</p>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with a second date</label>
            {compare && <label className="block text-sm font-medium">Second date<input type="date" value={dateB} max={isoDate(new Date())} onChange={(e) => setDateB(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>}
          </Card></div>
        <div className="space-y-4">
          <div className={compare && !none ? "grid gap-4 md:grid-cols-2" : ""}>
            <div>{compare && !none && <p className="mb-1 text-xs text-mute">{date}</p>}<MapView center={[location.lat, location.lon]} zoom={5} overlays={dateOk ? overlays : []} onPick={(la, lo) => setLocation({ name: `${la.toFixed(3)}, ${lo.toFixed(3)}`, lat: la, lon: lo })} height={compare ? "h-80" : "h-[28rem]"} /></div>
            {compare && !none && <div><p className="mb-1 text-xs text-mute">{dateB}</p><MapView center={[location.lat, location.lon]} zoom={5} overlays={[overlayFor(layer, dateB)]} height="h-80" /></div>}
          </div>
          <p className="text-xs text-mute">Click the map to move the selected location. Tiles load straight from NASA GIBS; if a date has no coverage the layer appears blank.</p>
          <Card className="p-5"><SectionHeader title="What each layer on this map is" />
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[11rem_1fr]">
              <dt className="flex items-center gap-2"><Pill>Base map</Pill></dt><dd className="text-mute">OpenStreetMap streets — not satellite imagery.</dd>
              <dt><Pill tone="signal">Observation layer</Pill></dt><dd className="text-mute">{none ? "No satellite layer selected." : `${layer.label} (${layer.platform}), ${date}. ${layer.legend}`}</dd>
              <dt><Pill tone="warn">Derived / simulated</Pill></dt><dd className="text-mute">None on this page.</dd></dl>
            {!none && <p className="mt-3 text-xs text-mute">Layer id <code className="font-mono">{layer.id}</code> · tile matrix {layer.matrix} · source: NASA GIBS (EOSDIS). Max native zoom {layer.maxZoom}.</p>}</Card>
        </div></div>
      <section aria-labelledby="lib"><SectionHeader id="lib" title="NASA image-library results" description="Catalogue images and illustrations. They are not a live view of the selected location." />
        <form className="mt-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) setQuery(q.trim()); }}>
          <label className="sr-only" htmlFor="img-q">Search NASA images</label><input id="img-q" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" /><Button type="submit">Search</Button></form>
        <div className="mt-5"><DataState loading={imgs.loading} error={imgs.error} onRetry={imgs.reload} empty={!!imgs.data && list.length === 0} emptyMessage="No previewable images for this search.">
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]"><ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{list.map((i) => (
            <li key={i.nasa_id ?? i.preview_url}><button type="button" onClick={() => setSel(i)} className={`block w-full overflow-hidden rounded-lg border text-left ${sel?.nasa_id === i.nasa_id ? "border-signal" : "border-line"}`}>
              <img src={i.preview_url ?? ""} alt={i.title ?? "NASA image"} loading="lazy" className="aspect-[4/3] w-full object-cover" /><span className="block truncate p-2 text-xs">{i.title}</span></button></li>))}</ul>
            <Card className="p-4 text-sm">{sel ? (<><p className="font-semibold">{sel.title}</p><dl className="mt-3 space-y-1 text-xs text-mute"><div>NASA ID: {sel.nasa_id}</div><div>Created: {formatTimestamp(sel.date_created)}</div><div>Center: {sel.center ?? "—"}</div><div>Credit: {[sel.photographer, sel.secondary_creator].filter(Boolean).join("; ") || "NASA"}</div></dl>
              <p className="mt-3 line-clamp-6 text-xs text-mute">{sel.description}</p>{sel.nasa_id && <a className="mt-3 inline-block text-xs text-electric hover:text-signal" target="_blank" rel="noreferrer" href={`https://images.nasa.gov/details/${encodeURIComponent(sel.nasa_id)}`}>Open source page</a>}</>) : <p className="text-mute">Select an image to see its metadata and credit.</p>}</Card></div>
          <Button className="mt-4" variant="ghost" onClick={() => downloadText("acrux_nasa_image_results.csv", toCsv(["NASA ID", "Title", "Date created", "Center", "Photographer"], list.map((i) => [i.nasa_id, i.title, i.date_created, i.center, i.photographer])))}><Download size={14} aria-hidden /> Export results CSV</Button>
          <MetaFooter meta={imgs.data?.meta} /></DataState></div></section>
    </div>
  );
}
