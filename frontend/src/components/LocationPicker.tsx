import { useState } from "react";
import { MapPin, Save, Search } from "lucide-react";
import { Button } from "./Button";
import { DataState } from "./DataState";
import { NumberField } from "./Fields";
import { useApi } from "../hooks/useApi";
import { useSelection } from "../hooks/useSelection";
import { ApiError, request } from "../services/api";
import type { Envelope, Place, StatusFlag, StorageRow } from "../types/api";
import { validLat, validLon } from "../utils/geo";

/** Place search (Open-Meteo geocoding), manual coordinates, and optional saved locations (Supabase). */
export function LocationPicker() {
  const { location, setLocation } = useSelection();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(location.lat);
  const [lon, setLon] = useState<number | null>(location.lon);
  const [msg, setMsg] = useState<string | null>(null);
  const geo = useApi<Envelope<Place[]>>(query ? `/api/weather/geocode?q=${encodeURIComponent(query)}&count=6` : null);
  const storage = useApi<StatusFlag>("/api/storage/status");
  const saved = useApi<Envelope<StorageRow[]>>(storage.data?.configured ? "/api/storage/locations?limit=20" : null);

  const choose = (name: string, la: number, lo: number) => { setLocation({ name, lat: la, lon: lo }); setLat(la); setLon(lo); setMsg(null); };
  const applyManual = () => {
    if (lat === null || lon === null || !validLat(lat) || !validLon(lon)) { setMsg("Enter a latitude between −90 and 90 and a longitude between −180 and 180."); return; }
    choose(`${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon);
  };
  const save = async () => {
    try {
      await request("/api/storage/locations", { method: "POST", body: JSON.stringify({ name: location.name.slice(0, 80), latitude: location.lat, longitude: location.lon }) });
      setMsg("Location saved."); saved.reload();
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "Could not save the location."); }
  };

  return (
    <div className="card space-y-4 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-signal" aria-hidden /> {location.name}
        <span className="font-mono text-xs font-normal text-mute">{location.lat.toFixed(3)}°, {location.lon.toFixed(3)}°</span></p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) setQuery(q.trim()); }}>
        <label className="sr-only" htmlFor="loc-search">Search for a place</label>
        <input id="loc-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place…" maxLength={100}
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
        <Button type="submit" disabled={q.trim().length < 2}><Search size={14} aria-hidden /> Search</Button>
      </form>
      {query && (
        <DataState loading={geo.loading} error={geo.error} onRetry={geo.reload} empty={!!geo.data && geo.data.data.length === 0} emptyMessage={`No places found for “${query}”.`}>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {geo.data?.data.map((p) => (
              <li key={`${p.latitude},${p.longitude}`}>
                <button type="button" onClick={() => choose([p.name, p.admin1, p.country].filter(Boolean).join(", ").slice(0, 80), p.latitude, p.longitude)}
                  className="w-full rounded px-2 py-1 text-left hover:bg-panel">{[p.name, p.admin1, p.country].filter(Boolean).join(", ")}
                  <span className="ml-2 font-mono text-xs text-mute">{p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}</span></button>
              </li>))}
          </ul>
        </DataState>)}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Latitude" unit="°" value={lat} onChange={setLat} min={-90} max={90} />
        <NumberField label="Longitude" unit="°" value={lon} onChange={setLon} min={-180} max={180} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={applyManual}>Use coordinates</Button>
        {storage.data?.configured && <Button variant="ghost" onClick={save}><Save size={14} aria-hidden /> Save location</Button>}
      </div>
      {msg && <p role="status" className="text-xs text-mute">{msg}</p>}
      {saved.data && saved.data.data.length > 0 && (
        <div><p className="text-xs font-semibold uppercase tracking-wide text-mute">Saved locations</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">{saved.data.data.map((r) => (
            <li key={r.id}><button type="button" className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-signal"
              onClick={() => choose(String(r.name), Number(r.latitude), Number(r.longitude))}>{String(r.name)}</button></li>))}</ul></div>)}
    </div>
  );
}
