import { useEffect } from "react";
import type { ReactNode } from "react";
import { CircleMarker, MapContainer, Popup, Rectangle, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { wrapLon } from "../utils/geo";

export interface MapPoint { id: string; lat: number; lon: number; color?: string; radius?: number; popup?: ReactNode }
export interface TileOverlay { id: string; url: string; attribution: string; maxNativeZoom?: number; opacity?: number }
export interface LegendItem { color: string; label: string }

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom ?? map.getZoom()); }, [map, center, zoom]);
  return null;
}
function Picker({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e: { latlng: { lat: number; lng: number } }) => onPick(e.latlng.lat, wrapLon(e.latlng.lng)) });
  return null;
}

/** Leaflet map. The OpenStreetMap layer is a BASE MAP only — never satellite imagery. */
export function MapView({ center, zoom = 5, points = [], bbox, overlays = [], onPick, legend, height = "h-[26rem]", marker = true }: {
  center: [number, number]; zoom?: number; points?: MapPoint[]; bbox?: [number, number, number, number] | null;
  overlays?: TileOverlay[]; onPick?: (lat: number, lon: number) => void; legend?: LegendItem[]; height?: string; marker?: boolean;
}) {
  return (
    <figure>
      <div className={`${height} overflow-hidden rounded-xl border border-line`}>
        <MapContainer center={center} zoom={zoom} scrollWheelZoom worldCopyJump className="h-full w-full bg-surface">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
          {overlays.map((o) => (
            <TileLayer key={o.id} url={o.url} attribution={o.attribution} maxNativeZoom={o.maxNativeZoom} maxZoom={12} opacity={o.opacity ?? 1} />
          ))}
          <Recenter center={center} />
          {onPick && <Picker onPick={onPick} />}
          {bbox && <Rectangle bounds={[[bbox[1], bbox[0]], [bbox[3], bbox[2]]]} pathOptions={{ color: "#22D3EE", weight: 1.5, fill: false, dashArray: "4 4" }} />}
          {marker && <CircleMarker center={center} radius={7} pathOptions={{ color: "#E8EEF8", weight: 2, fillColor: "#3B82F6", fillOpacity: 1 }}><Popup>Selected location</Popup></CircleMarker>}
          {points.map((p) => (
            <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={p.radius ?? 4}
              pathOptions={{ color: p.color ?? "#F87171", weight: 1, fillColor: p.color ?? "#F87171", fillOpacity: 0.7 }}>
              {p.popup && <Popup>{p.popup}</Popup>}
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
        <span>Base map: OpenStreetMap (a street map, not satellite imagery).</span>
        <span className="font-mono">{center[0].toFixed(3)}°, {center[1].toFixed(3)}°</span>
        {legend?.map((l) => (<span key={l.label} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.label}</span>))}
      </figcaption>
    </figure>
  );
}
