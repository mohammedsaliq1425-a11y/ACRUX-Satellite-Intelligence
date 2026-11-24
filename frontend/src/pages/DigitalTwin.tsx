import { useEffect, useMemo, useState } from "react";
import { Satellite } from "lucide-react";
import { Pill } from "../components/Badges";
import { Button } from "../components/Button";
import { COLORS, SeriesChart } from "../components/Charts";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { NumberField, SelectField } from "../components/Fields";
import { PageHeader } from "../components/PageHeader";
import { SimulatedBanner } from "../components/SimulatedBanner";
import { PARTS, TwinModel } from "../features/twin/TwinModel";
import type { Health } from "../features/twin/TwinModel";
import { usePost } from "../hooks/usePost";
import { useApi } from "../hooks/useApi";
import { useWorkspace } from "../hooks/useWorkspace";
import type { Alert, StatusFlag, TelemetryResult } from "../types/api";
import { downloadText, toCsv } from "../utils/csv";

const FAULTS = [{ value: "solar_degradation", label: "Solar array degradation (fraction 0–1)" }, { value: "excess_load", label: "Excess electrical load (W)" }, { value: "thermal_excursion", label: "Thermal excursion (W of extra heat)" }, { value: "attitude_drift", label: "Attitude drift (deg/min)" }, { value: "comm_dropout", label: "Communication dropout (no magnitude)" }] as const;
type FaultKind = (typeof FAULTS)[number]["value"];
interface FaultIn { kind: FaultKind; start_min: number; duration_min: number; magnitude: number }
const DEFAULT_MAG: Record<FaultKind, number> = { solar_degradation: 0.5, excess_load: 60, thermal_excursion: 150, attitude_drift: 0.1, comm_dropout: 1 };
const sevCls = { critical: "text-bad", warning: "text-warn", info: "text-signal" } as const;
const m = (s: number) => Math.round((s / 60) * 100) / 100;

export default function DigitalTwin() {
  const { publish } = useWorkspace();
  const sim = usePost<TelemetryResult>("/api/telemetry/simulate");
  const storage = useApi<StatusFlag>("/api/storage/status");
  const [duration, setDuration] = useState<number | null>(240), [seed, setSeed] = useState<number | null>(42);
  const [faults, setFaults] = useState<FaultIn[]>([]);
  const [fk, setFk] = useState<FaultKind>("excess_load"), [fs, setFs] = useState<number | null>(60), [fd, setFd] = useState<number | null>(60), [fm, setFm] = useState<number | null>(60);
  const [ml, setMl] = useState(false), [save, setSave] = useState(false);
  const [part, setPart] = useState<string | null>(null), [alert, setAlert] = useState<Alert | null>(null);
  const inputsOk = duration !== null && duration >= 5 && duration <= 1440 && seed !== null && seed >= 0;
  const run = () => { if (inputsOk) void sim.run({ duration_min: duration, step_s: 30, seed: Math.trunc(seed!), faults, include_ml: ml, save_run: save }); };
  useEffect(run, []); // initial nominal run  // eslint-disable-line react-hooks/exhaustive-deps

  const r = sim.data;
  const data = useMemo(() => (r ? r.samples.map((s) => ({ min: m(s.t_s), soc: s.battery_soc_pct, solar: s.solar_power_w, load: s.bus_load_w, temp: s.bus_temp_c, att: s.attitude_error_deg, snr: s.comm_snr_db })) : []), [r]);
  const areas = useMemo(() => (r?.alerts ?? []).map((a) => ({ x1: m(a.detected_t_s), x2: m(a.end_t_s), color: a.severity === "critical" ? "#F87171" : "#FBBF24" })), [r]);
  const health = (r?.component_status ?? {}) as Record<string, Health>;
  const sel = PARTS.find((p) => p.id === part) ?? null;

  useEffect(() => { if (!r) return;
    publish({ key: "telemetry", title: "Simulated satellite telemetry run", kind: "simulation", source: "Project Acrux telemetry simulator (local)", retrievedAt: new Date().toISOString(), simulated: true,
      summary: `SIMULATED TELEMETRY — NOT LIVE SPACECRAFT DATA. ${r.samples.length} samples over ${String(r.config.duration_min)} min; ${r.alerts.length} rule-based alert(s).`,
      keyValues: [{ label: "Injected faults", value: faults.length ? faults.map((f) => f.kind).join(", ") : "none" }, { label: "Seed", value: String(r.config.seed) }, { label: "Component status", value: Object.entries(r.component_status).map(([k, v]) => `${k}: ${v}`).join("; ") }, { label: "Detector", value: r.detector.method }],
      table: { name: "Alerts", columns: ["ID", "Detected", "Severity", "Component", "Measured", "Expected range", "Reason"], rows: r.alerts.map((a) => [a.id, a.detected_timestamp, a.severity, a.component, String(a.measured_value), a.expected_range, a.reason]) },
      methods: ["Physics-inspired telemetry simulator (power, thermal, attitude, comms)", "Transparent threshold (rule-based) anomaly detection"], limitations: r.assumptions, notes: [r.disclaimer] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  const acols: Column<Alert>[] = [{ key: "id", label: "ID", value: (a) => a.id }, { key: "t", label: "Detected (min)", value: (a) => m(a.detected_t_s), numeric: true }, { key: "s", label: "Severity", value: (a) => a.severity, render: (a) => <span className={`font-semibold ${sevCls[a.severity]}`}>{a.severity}</span> }, { key: "c", label: "Component", value: (a) => a.component }, { key: "m", label: "Measured", value: (a) => String(a.measured_value) }, { key: "e", label: "Expected", value: (a) => a.expected_range }];
  const chart = (title: string, series: { key: string; label: string; color: string }[], unit: string) => (<Card className="p-4"><p className="mb-1 text-sm font-medium">{title} <span className="text-mute">({unit})</span> <Pill tone="warn">simulated</Pill></p><SeriesChart title={`${title} (simulated)`} data={data} xKey="min" xLabel="Minutes from start" series={series} areas={areas} height={190} /></Card>);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={Satellite} eyebrow="Module 07" title="Satellite Health & Digital Twin" description="A generic Earth-observation satellite with simulated telemetry. Inject faults and see how the transparent rule-based detector reacts." />
      <SimulatedBanner />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3"><div className="h-[26rem] overflow-hidden rounded-xl border border-line"><TwinModel selected={part} onSelect={setPart} health={health} /></div>
          <p className="text-xs text-mute">Drag to rotate · scroll to zoom · click a part. Amber/red glow = simulated alert on that subsystem. Generic model, not a real spacecraft.</p></div>
        <div className="space-y-4"><Card className="p-4 text-sm">{sel ? (<><p className="text-lg font-semibold">{sel.name}</p><p className="mt-1 text-xs uppercase tracking-wide text-signal">{sel.subsystem}</p><p className="mt-2 leading-relaxed text-mute">{sel.description}</p>{sel.subsystem !== "structure" && <p className="mt-3 text-xs">Simulated status: <strong className={health[sel.subsystem] === "critical" ? "text-bad" : health[sel.subsystem] === "warning" ? "text-warn" : "text-ok"}>{health[sel.subsystem] ?? "ok"}</strong></p>}</>) : <p className="text-mute">Select a component to read what it does and its simulated status.</p>}</Card>
          <Card className="p-4"><p className="text-sm font-medium">Subsystem status (simulated)</p><ul className="mt-2 grid grid-cols-2 gap-2 text-xs">{["power", "thermal", "attitude", "communications", "payload"].map((c) => <li key={c} className="flex justify-between rounded-lg border border-line bg-panel px-2.5 py-1.5 capitalize"><span>{c}</span><span className={health[c] === "critical" ? "text-bad" : health[c] === "warning" ? "text-warn" : "text-ok"}>{health[c] ?? "ok"}</span></li>)}</ul></Card></div></div>

      <Card className="p-5"><SectionHeader title="Run a simulation" /><div className="mt-3 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4"><NumberField label="Duration" unit="min" value={duration} onChange={setDuration} min={5} max={1440} step={1} /><NumberField label="Random seed" value={seed} onChange={setSeed} min={0} step={1} /></div>
        <div className="rounded-lg border border-line bg-panel p-3"><p className="text-sm font-medium">Inject a fault</p><div className="mt-2 grid items-end gap-x-3 sm:grid-cols-2 lg:grid-cols-5"><SelectField label="Type" value={fk} onChange={(v) => { setFk(v); setFm(DEFAULT_MAG[v]); }} options={[...FAULTS]} /><NumberField label="Start" unit="min" value={fs} onChange={setFs} min={0} /><NumberField label="Duration" unit="min" value={fd} onChange={setFd} min={1} /><NumberField label="Magnitude" value={fm} onChange={setFm} min={0} max={1000} />
          <div className="pb-5"><Button disabled={fs === null || fd === null || fm === null || fd <= 0 || faults.length >= 10} onClick={() => setFaults([...faults, { kind: fk, start_min: fs!, duration_min: fd!, magnitude: fm! }])}>Add fault</Button></div></div>
          {faults.length > 0 && <ul className="mt-1 flex flex-wrap gap-2">{faults.map((f, i) => <li key={i} className="flex items-center gap-2 rounded-full border border-warn/50 px-3 py-1 text-xs text-warn">{f.kind} @ {f.start_min} min for {f.duration_min} min (×{f.magnitude})<button type="button" aria-label={`Remove fault ${f.kind}`} onClick={() => setFaults(faults.filter((_, j) => j !== i))}>✕</button></li>)}</ul>}</div>
        <div className="mt-4 flex flex-wrap items-center gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ml} onChange={(e) => setMl(e.target.checked)} /> Also run the optional IsolationForest (secondary signal)</label>
          {storage.data?.configured && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save run summary to Supabase</label>}
          <Button variant="primary" onClick={run} disabled={!inputsOk || sim.loading}>{sim.loading ? "Simulating…" : "Run simulation"}</Button></div></Card>

      <DataState loading={sim.loading && !r} error={sim.error} onRetry={run}>{r && (<>
        {r.storage && <p role="status" className={`text-xs ${r.storage.saved ? "text-ok" : "text-warn"}`}>{r.storage.saved ? "Run summary saved." : `Not saved: ${r.storage.reason}`}</p>}
        <div className="grid gap-4 lg:grid-cols-2">{chart("Battery state of charge", [{ key: "soc", label: "SoC", color: COLORS.ok }], "%")}{chart("Power: solar output and bus load", [{ key: "solar", label: "Solar", color: COLORS.warn }, { key: "load", label: "Load", color: COLORS.accent }], "W")}{chart("Bus temperature", [{ key: "temp", label: "Temperature", color: COLORS.bad }], "°C")}{chart("Attitude pointing error", [{ key: "att", label: "Error", color: COLORS.signal }], "deg")}{chart("Downlink SNR (during passes)", [{ key: "snr", label: "SNR", color: COLORS.electric }], "dB")}</div>
        <p className="text-xs text-mute">Shaded bands mark alert intervals (amber = warning, red = critical).</p>
        <section aria-labelledby="al"><SectionHeader id="al" title="Alert history (rule-based detection)" description="Each alert is a run of consecutive threshold violations. Select one to see exactly why it fired." />
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_22rem]"><Card className="p-5"><DataState loading={false} error={null} empty={r.alerts.length === 0} emptyMessage="No alerts: every sample stayed inside its thresholds."><DataTable rows={r.alerts} columns={acols} rowKey={(a) => a.id} caption="Simulated alerts" onSelect={setAlert} selectedKey={alert?.id ?? null} pageSize={8} />
            <Button className="mt-3" variant="ghost" onClick={() => downloadText("acrux_simulated_alerts.csv", toCsv(["id", "detected_timestamp", "severity", "component", "measured", "expected_range", "reason", "suggested_action"], r.alerts.map((a) => [a.id, a.detected_timestamp, a.severity, a.component, String(a.measured_value), a.expected_range, a.reason, a.suggested_action])))}>Export alerts CSV (simulated)</Button></DataState></Card>
            <Card className="p-4 text-sm">{alert ? (<><p className={`font-semibold ${sevCls[alert.severity]}`}>{alert.title}</p><dl className="mt-3 space-y-2 text-xs text-mute"><div><dt className="font-semibold text-ink">Detected</dt><dd>{alert.detected_timestamp} (t = {m(alert.detected_t_s)} min), lasting {alert.sample_count} sample(s)</dd></div><div><dt className="font-semibold text-ink">Measured value</dt><dd>{String(alert.measured_value)} (worst: {String(alert.peak_measured_value)})</dd></div><div><dt className="font-semibold text-ink">Expected range</dt><dd>{alert.expected_range}</dd></div><div><dt className="font-semibold text-ink">Affected component</dt><dd className="capitalize">{alert.component} · channel {alert.channel}</dd></div><div><dt className="font-semibold text-ink">Why it fired</dt><dd>{alert.reason}</dd></div><div><dt className="font-semibold text-ink">Suggested diagnostic</dt><dd>{alert.suggested_action}</dd></div><div><dt className="font-semibold text-ink">Method</dt><dd>{alert.method}</dd></div></dl></>) : <p className="text-mute">Select an alert to inspect its evidence.</p>}</Card></div></section>
        {r.ml_outliers && r.ml_detector && <Card className="p-5 text-sm"><SectionHeader title="IsolationForest outliers (secondary, unsupervised)" /><p className="mt-2 text-mute">{r.ml_outliers.length} sample(s) flagged. {r.ml_detector.method}, trained on {r.ml_detector.trained_on}; not validated on real spacecraft data. It tends to miss slow drifts, so rely on the rule-based alerts above.</p></Card>}
        <Card className="p-5"><SectionHeader title="Simulation assumptions" /><ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-mute">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></Card></>)}</DataState>
    </div>
  );
}
