import { useEffect, useMemo, useState } from "react";
import { CloudSun, RefreshCw } from "lucide-react";
import { BarsChart, COLORS, SeriesChart } from "../components/Charts";
import { Button } from "../components/Button";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { Tabs } from "../components/Fields";
import { LocationPicker } from "../components/LocationPicker";
import { MetaFooter } from "../components/MetaFooter";
import { PageHeader } from "../components/PageHeader";
import { Pill } from "../components/Badges";
import { useApi } from "../hooks/useApi";
import { usePreferences } from "../hooks/usePreferences";
import { useSelection } from "../hooks/useSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import type { Envelope, Forecast, History } from "../types/api";
import { addDays, compass, isoDate } from "../utils/format";
import { num } from "../utils/geo";
import { downloadText, toCsv } from "../utils/csv";

type Row = Record<string, number | string | null>;
const col = (o: Record<string, (number | string | null)[]>, k: string) => o[k] ?? [];
function rows(o: Record<string, (number | string | null)[]>, keys: string[], n?: number): Row[] {
  const t = col(o, "time"); const len = n ? Math.min(n, t.length) : t.length;
  return Array.from({ length: len }, (_, i) => Object.fromEntries([["time", String(t[i])], ...keys.map((k) => [k, col(o, k)[i] ?? null])]));
}

export default function Weather() {
  const { location } = useSelection();
  const { prefs } = usePreferences();
  const { publish } = useWorkspace();
  const [tab, setTab] = useState<"forecast" | "history">("forecast");
  const today = new Date();
  const [hs, setHs] = useState(isoDate(addDays(today, -32)));
  const [he, setHe] = useState(isoDate(addDays(today, -2)));
  const u = `temperature_unit=${prefs.temperatureUnit}&wind_speed_unit=${prefs.windSpeedUnit}&precipitation_unit=${prefs.precipitationUnit}`;
  const fc = useApi<Envelope<Forecast>>(`/api/weather/forecast?lat=${location.lat}&lon=${location.lon}&${u}&days=7`);
  const histOk = hs <= he && he <= isoDate(today);
  const hist = useApi<Envelope<History>>(tab === "history" && histOk ? `/api/weather/history?lat=${location.lat}&lon=${location.lon}&start=${hs}&end=${he}&${u}` : null);

  const f = fc.data?.data;
  const cu = f?.current_units ?? {};
  const hourly = useMemo(() => (f ? rows(f.hourly, ["temperature_2m", "precipitation", "wind_speed_10m", "relative_humidity_2m", "cloud_cover"], 48).map((r) => ({ ...r, time: String(r.time).slice(5, 16).replace("T", " ") })) : []), [f]);
  const daily = useMemo(() => (f ? rows(f.daily, ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "wind_speed_10m_max"]) : []), [f]);
  const dcols: Column<Row>[] = [
    { key: "time", label: "Date", value: (r) => String(r.time) },
    { key: "tmax", label: `Max (${f?.daily_units.temperature_2m_max ?? ""})`, value: (r) => num(r.temperature_2m_max), numeric: true },
    { key: "tmin", label: `Min (${f?.daily_units.temperature_2m_min ?? ""})`, value: (r) => num(r.temperature_2m_min), numeric: true },
    { key: "p", label: `Precip. (${f?.daily_units.precipitation_sum ?? ""})`, value: (r) => num(r.precipitation_sum), numeric: true },
    { key: "w", label: `Max wind (${f?.daily_units.wind_speed_10m_max ?? ""})`, value: (r) => num(r.wind_speed_10m_max), numeric: true },
  ];

  useEffect(() => {
    if (!fc.data) return;
    const d = fc.data.data, m = fc.data.meta, c = d.current, cu2 = d.current_units;
    const kv = (label: string, k: string) => ({ label, value: `${c[k] ?? "—"} ${cu2[k] ?? ""}`.trim() });
    publish({
      key: "weather", title: `Weather forecast — ${location.name}`, kind: "forecast", source: m.source, sourceUrl: m.source_url, retrievedAt: m.retrieved_at,
      region: `${location.name} (${d.latitude.toFixed(3)}°, ${d.longitude.toFixed(3)}°; ${d.timezone})`, simulated: false,
      summary: `Model-based conditions and a 7-day forecast for ${location.name}. Current values are the model's latest interval, not a station or satellite measurement.`,
      keyValues: [kv("Temperature", "temperature_2m"), kv("Apparent temperature", "apparent_temperature"), kv("Relative humidity", "relative_humidity_2m"), kv("Wind speed", "wind_speed_10m"), kv("Precipitation", "precipitation"), kv("Cloud cover", "cloud_cover"), { label: "Model time (local)", value: String(c.time ?? "—") }],
      table: { name: "Daily forecast", columns: ["Date", "Max temp", "Min temp", "Precipitation", "Max wind"], rows: rows(d.daily, ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "wind_speed_10m_max"]).map((r) => [String(r.time), num(r.temperature_2m_max), num(r.temperature_2m_min), num(r.precipitation_sum), num(r.wind_speed_10m_max)]) },
      methods: ["Open-Meteo forecast API queried by the local backend", "No post-processing beyond unit selection and tabulation"],
      limitations: ["Forecasts are model output and carry uncertainty that grows with lead time.", "Not a direct satellite measurement."], notes: m.notes,
    });
  }, [fc.data, location.name, publish]);

  const tile = (label: string, k: string, extra?: string) => (
    <div className="rounded-xl border border-line bg-panel p-4"><p className="text-xs uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{f?.current[k] ?? "—"}<span className="ml-1 text-sm font-normal text-mute">{cu[k]}</span></p>{extra && <p className="text-xs text-mute">{extra}</p>}</div>);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={CloudSun} eyebrow="Module 03" title="Weather & Climate Intelligence"
        description="Model-based current conditions, forecasts and historical reanalysis from Open-Meteo. Each block states what kind of data it is."
        actions={<Button onClick={fc.reload} disabled={fc.loading}><RefreshCw size={14} aria-hidden /> Refresh</Button>} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <LocationPicker />
        <div className="space-y-6">
          <Tabs label="Weather views" value={tab} onChange={setTab} tabs={[{ id: "forecast", label: "Current & forecast" }, { id: "history", label: "Historical" }]} />
          {tab === "forecast" && (
            <DataState loading={fc.loading && !fc.data} error={fc.error} onRetry={fc.reload} loadingLabel="Loading forecast">
              {f && (<>
                <div className="flex flex-wrap items-center gap-2 text-xs text-mute"><Pill tone="signal">Model-based current conditions</Pill>
                  <span>{String(f.current.time)} local · {f.timezone} ({f.timezone_abbreviation}, UTC{f.utc_offset_seconds >= 0 ? "+" : ""}{f.utc_offset_seconds / 3600}) · {f.latitude.toFixed(3)}°, {f.longitude.toFixed(3)}° · elev. {f.elevation ?? "—"} m</span></div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {tile("Temperature", "temperature_2m")}{tile("Feels like", "apparent_temperature")}{tile("Humidity", "relative_humidity_2m")}
                  {tile("Wind", "wind_speed_10m", typeof f.current.wind_direction_10m === "number" ? `from ${compass(f.current.wind_direction_10m)} (${f.current.wind_direction_10m}°)` : undefined)}
                  {tile("Precipitation", "precipitation")}{tile("Cloud cover", "cloud_cover")}
                </div>
                <Card className="p-5"><SectionHeader title="Next 48 hours (forecast)" />
                  <div className="mt-4 grid gap-6 lg:grid-cols-2">
                    <div><p className="mb-1 text-sm font-medium">Temperature ({f.hourly_units.temperature_2m})</p><SeriesChart title="Hourly temperature forecast" data={hourly} xKey="time" series={[{ key: "temperature_2m", label: "Temperature", color: COLORS.bad }]} /></div>
                    <div><p className="mb-1 text-sm font-medium">Precipitation ({f.hourly_units.precipitation})</p><BarsChart title="Hourly precipitation forecast" data={hourly} xKey="time" series={[{ key: "precipitation", label: "Precipitation", color: COLORS.electric }]} /></div>
                    <div><p className="mb-1 text-sm font-medium">Wind speed ({f.hourly_units.wind_speed_10m})</p><SeriesChart title="Hourly wind speed forecast" data={hourly} xKey="time" series={[{ key: "wind_speed_10m", label: "Wind", color: COLORS.signal }]} /></div>
                    <div><p className="mb-1 text-sm font-medium">Humidity ({f.hourly_units.relative_humidity_2m}) &amp; cloud cover ({f.hourly_units.cloud_cover})</p><SeriesChart title="Humidity and cloud cover forecast" data={hourly} xKey="time" series={[{ key: "relative_humidity_2m", label: "Humidity", color: COLORS.accent }, { key: "cloud_cover", label: "Cloud cover", color: COLORS.mute }]} /></div>
                  </div></Card>
                <Card className="p-5"><SectionHeader title="7-day forecast" />
                  <div className="mt-4"><DataTable rows={daily} columns={dcols} rowKey={(r) => String(r.time)} caption="Daily forecast" pageSize={8} />
                    <Button className="mt-3" variant="ghost" onClick={() => downloadText(`acrux_forecast_${location.lat}_${location.lon}.csv`, toCsv(dcols.map((c) => c.label), daily.map((r) => dcols.map((c) => c.value(r)))))}>Export forecast CSV</Button></div></Card>
                <MetaFooter meta={fc.data?.meta} />
              </>)}
            </DataState>)}
          {tab === "history" && (
            <Card className="space-y-4 p-5">
              <SectionHeader title="Historical daily weather (reanalysis)" description="Archive values from Open-Meteo, up to 366 days per request. The latest ~2 days may be missing." />
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm font-medium">Start<input type="date" value={hs} max={he} onChange={(e) => setHs(e.target.value)} className="mt-1.5 block rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
                <label className="text-sm font-medium">End<input type="date" value={he} min={hs} max={isoDate(today)} onChange={(e) => setHe(e.target.value)} className="mt-1.5 block rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
              </div>
              {!histOk && <p role="alert" className="text-sm text-bad">Start must not be after end, and the end date cannot be in the future.</p>}
              <DataState loading={hist.loading} error={hist.error} onRetry={hist.reload} empty={!!hist.data && col(hist.data.data.daily, "time").length === 0} loadingLabel="Loading history">
                {hist.data && (() => { const hd = hist.data.data; const r = rows(hd.daily, ["temperature_2m_max", "temperature_2m_min", "temperature_2m_mean", "precipitation_sum", "wind_speed_10m_max"]);
                  return (<>
                    <p className="mb-1 text-sm font-medium">Temperature ({hd.daily_units.temperature_2m_mean})</p>
                    <SeriesChart title="Historical daily temperature" data={r} xKey="time" series={[{ key: "temperature_2m_max", label: "Max", color: COLORS.bad }, { key: "temperature_2m_mean", label: "Mean", color: COLORS.warn }, { key: "temperature_2m_min", label: "Min", color: COLORS.electric }]} />
                    <p className="mb-1 mt-5 text-sm font-medium">Daily precipitation ({hd.daily_units.precipitation_sum})</p>
                    <BarsChart title="Historical daily precipitation" data={r} xKey="time" series={[{ key: "precipitation_sum", label: "Precipitation", color: COLORS.electric }]} />
                    <MetaFooter meta={hist.data.meta} /></>); })()}
              </DataState>
            </Card>)}
        </div>
      </div>
    </div>
  );
}
