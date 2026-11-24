import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface Preferences {
  temperatureUnit: "celsius" | "fahrenheit";
  windSpeedUnit: "kmh" | "ms" | "mph" | "kn";
  precipitationUnit: "mm" | "inch";
}

export const DEFAULT_PREFERENCES: Preferences = {
  temperatureUnit: "celsius",
  windSpeedUnit: "kmh",
  precipitationUnit: "mm",
};

const KEY = "acrux.prefs.v1";
const TEMP = ["celsius", "fahrenheit"], WIND = ["kmh", "ms", "mph", "kn"], PRECIP = ["mm", "inch"];

/** Validate whatever is in storage: unknown/old values fall back to defaults. */
export function sanitizePreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    temperatureUnit: TEMP.includes(r.temperatureUnit as string) ? (r.temperatureUnit as Preferences["temperatureUnit"]) : DEFAULT_PREFERENCES.temperatureUnit,
    windSpeedUnit: WIND.includes(r.windSpeedUnit as string) ? (r.windSpeedUnit as Preferences["windSpeedUnit"]) : DEFAULT_PREFERENCES.windSpeedUnit,
    precipitationUnit: PRECIP.includes(r.precipitationUnit as string) ? (r.precipitationUnit as Preferences["precipitationUnit"]) : DEFAULT_PREFERENCES.precipitationUnit,
  };
}

function load(): Preferences {
  try {
    const s = window.localStorage.getItem(KEY);
    return sanitizePreferences(s ? JSON.parse(s) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function persist(p: Preferences) {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: keep in memory */ }
}

interface Ctx { prefs: Preferences; update: (patch: Partial<Preferences>) => void; reset: () => void }
const PrefsContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(load);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((cur) => { const next = sanitizePreferences({ ...cur, ...patch }); persist(next); return next; });
  }, []);
  const reset = useCallback(() => { setPrefs(DEFAULT_PREFERENCES); persist(DEFAULT_PREFERENCES); }, []);

  const value = useMemo(() => ({ prefs, update, reset }), [prefs, update, reset]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePreferences(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return ctx;
}
