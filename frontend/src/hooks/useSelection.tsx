import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { validLat, validLon } from "../utils/geo";

export interface SelectedLocation { name: string; lat: number; lon: number }
const KEY = "acrux.location.v1";
const DEFAULT: SelectedLocation = { name: "Kennedy Space Center", lat: 28.57, lon: -80.65 };

export function sanitizeLocation(raw: unknown): SelectedLocation {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof r.lat === "number" && typeof r.lon === "number" && validLat(r.lat) && validLon(r.lon))
    return { name: typeof r.name === "string" && r.name.length <= 80 ? r.name : `${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}`, lat: r.lat, lon: r.lon };
  return DEFAULT;
}
function load(): SelectedLocation {
  try { const s = window.localStorage.getItem(KEY); return sanitizeLocation(s ? JSON.parse(s) : null); } catch { return DEFAULT; }
}

interface Ctx { location: SelectedLocation; setLocation: (l: SelectedLocation) => void }
const C = createContext<Ctx | null>(null);

/** The location shared by Weather, Wildfire, Earth Observation, Mission Control and Multimodal. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [location, set] = useState<SelectedLocation>(load);
  const setLocation = useCallback((l: SelectedLocation) => {
    const clean = sanitizeLocation(l); set(clean);
    try { window.localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* in-memory only */ }
  }, []);
  const value = useMemo(() => ({ location, setLocation }), [location, setLocation]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSelection(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("useSelection must be used inside <SelectionProvider>");
  return c;
}
