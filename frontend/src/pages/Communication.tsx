import { Fragment, useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { KindBadge, Pill } from "../components/Badges";
import { BarsChart, COLORS } from "../components/Charts";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { NumberField, SelectField } from "../components/Fields";
import { PageHeader } from "../components/PageHeader";
import { usePost } from "../hooks/usePost";
import type { LinkBudgetResult, OrbitRow } from "../types/api";
import { fmt } from "../utils/geo";

const ORBITS = { leo: { label: "LEO (550 km)", h: 550 }, meo: { label: "MEO (20,200 km)", h: 20200 }, geo: { label: "GEO (35,786 km)", h: 35786 } } as const;
const BANDS = [["L", "1–2", "Mobile satellite, GNSS", "Low rain fade; limited bandwidth"], ["S", "2–4", "Mobile satellite, some TT&C", "Low rain fade"], ["C", "4–8", "Fixed satellite service", "Large antennas; robust in rain"], ["X", "8–12", "Earth observation downlink, government", "Moderate rain fade"], ["Ku", "12–18", "Broadcast, broadband", "Noticeable rain fade"], ["Ka", "27–40", "High-throughput broadband", "Strong rain fade; high capacity"]];

function Diagram({ orbit }: { orbit: keyof typeof ORBITS }) {
  const satY = orbit === "leo" ? 150 : orbit === "meo" ? 90 : 40;
  return (
    <svg viewBox="0 0 520 300" role="img" aria-label={`Diagram of a ground station communicating with a satellite in ${ORBITS[orbit].label}`} className="w-full">
      <path d="M0 270 Q260 210 520 270 L520 300 L0 300Z" fill="#12306B" /><path d="M0 270 Q260 210 520 270" stroke="#22D3EE" strokeOpacity="0.6" fill="none" />
      <g transform="translate(120 238)"><path d="M-14 12 L0 -8 L14 12Z" fill="#101A30" stroke="#94A3B8" /><path d="M-10 -10 Q0 -26 10 -10" stroke="#E8EEF8" fill="none" strokeWidth="2" /></g>
      <text x="120" y="288" textAnchor="middle" fill="#94A3B8" fontSize="11">Ground station</text>
      <g transform={`translate(380 ${satY})`}><rect x="-12" y="-8" width="24" height="16" rx="2" fill="#101A30" stroke="#22D3EE" /><rect x="-40" y="-5" width="24" height="10" fill="#3B82F6" /><rect x="16" y="-5" width="24" height="10" fill="#3B82F6" /></g>
      <text x="380" y={satY + 28} textAnchor="middle" fill="#94A3B8" fontSize="11">Satellite · {ORBITS[orbit].label}</text>
      <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#22D3EE" /></marker><marker id="ar2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#8B5CF6" /></marker></defs>
      <line x1="136" y1="224" x2={366} y2={satY + 8} stroke="#22D3EE" strokeWidth="2" markerEnd="url(#ar)" strokeDasharray="6 4" />
      <line x1="372" y1={satY + 12} x2="142" y2="232" stroke="#8B5CF6" strokeWidth="2" markerEnd="url(#ar2)" />
      <text x="205" y={(satY + 224) / 2 - 14} fill="#22D3EE" fontSize="11">Uplink (e.g. Ku 14 GHz)</text><text x="240" y={(satY + 224) / 2 + 26} fill="#8B5CF6" fontSize="11">Downlink (e.g. Ku 12 GHz)</text>
      <text x="8" y="16" fill="#94A3B8" fontSize="10">Schematic, not to scale. Illustrative generic orbit — not a real operator’s link.</text>
    </svg>);
}

export default function Communication() {
  const [orbit, setOrbit] = useState<keyof typeof ORBITS>("leo");
  const [mode, setMode] = useState<"geometry" | "distance">("geometry");
  const [f, setF] = useState<number | null>(12), [pw, setPw] = useState<number | null>(10), [gt, setGt] = useState<number | null>(30), [gr, setGr] = useState<number | null>(40);
  const [tn, setTn] = useState<number | null>(150), [bw, setBw] = useState<number | null>(36), [alt, setAlt] = useState<number | null>(550), [el, setEl] = useState<number | null>(30);
  const [dist, setDist] = useState<number | null>(1000), [loss, setLoss] = useState<number | null>(2), [req, setReq] = useState<number | null>(6);
  const lb = usePost<LinkBudgetResult>("/api/calc/link-budget");
  const oc = usePost<{ rows: OrbitRow[]; note: string }>("/api/calc/orbit-comparison");
  const [cmpF, setCmpF] = useState<number | null>(12);

  useEffect(() => { setAlt(ORBITS[orbit].h); }, [orbit]);
  const valid = [f, pw, gt, gr, tn, bw, loss].every((v) => v !== null) && f! >= 0.1 && f! <= 300 && pw! > 0 && tn! > 0 && bw! > 0 && loss! >= 0 &&
    (mode === "distance" ? dist !== null && dist >= 1 && dist <= 1e6 : alt !== null && alt > 0 && el !== null && el >= 0 && el <= 90);
  useEffect(() => {
    if (!valid) return;
    const id = window.setTimeout(() => { void lb.run({ freq_ghz: f, tx_power_w: pw, tx_gain_dbi: gt, rx_gain_dbi: gr, system_noise_temp_k: tn, bandwidth_hz: bw! * 1e6, other_losses_db: loss, required_cn_db: req,
      ...(mode === "distance" ? { distance_km: dist } : { altitude_km: alt, elevation_deg: el }) }); }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, f, pw, gt, gr, tn, bw, alt, el, dist, loss, req, mode]);
  useEffect(() => { if (cmpF !== null && cmpF >= 0.1 && cmpF <= 300) void oc.run({ freq_ghz: cmpF, min_elevation_deg: 10 }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cmpF]);

  const r = lb.data;
  const cmp = useMemo(() => (oc.data?.rows ?? []).map((x) => ({ orbit: x.orbit.split(" ")[0], oneWay: Number(x.one_way_delay_zenith_ms.toFixed(2)), roundTrip: Number(x.round_trip_delay_zenith_ms.toFixed(2)) })), [oc.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10 sm:px-10">
      <PageHeader icon={Radio} eyebrow="Module 04" title="Satellite Communication Intelligence" description="How satellites link to ground stations, and a link-budget calculator with documented formulas. All figures are calculated from the inputs you enter; nothing here is a live signal or a real operator’s coverage." />
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><SectionHeader title="Link geometry" /><div className="mt-3 max-w-xs"><SelectField label="Orbit (illustrative)" value={orbit} onChange={setOrbit} options={Object.entries(ORBITS).map(([k, v]) => ({ value: k as keyof typeof ORBITS, label: v.label }))} /></div><Diagram orbit={orbit} /></Card>
        <Card className="space-y-3 p-5 text-sm leading-relaxed text-mute"><SectionHeader title="Key ideas" />
          <p><strong className="text-ink">Orbits.</strong> LEO (~500–2,000 km) gives short paths and low delay but fast passes; MEO (~20,000 km) is used by navigation constellations; GEO (35,786 km) appears fixed over one point but has the longest path and delay.</p>
          <p><strong className="text-ink">Free-space path loss</strong> grows with distance and frequency: doubling either adds about 6 dB.</p>
          <p><strong className="text-ink">Propagation delay ≠ latency.</strong> Delay here is only the light-travel time along the path. Real network latency adds processing, queuing, routing and ground segments.</p>
          <p><strong className="text-ink">Attenuation.</strong> Rain, gases and clouds absorb signals, worst at higher bands; include them in “other losses”.</p></Card></section>

      <section aria-labelledby="lb"><SectionHeader id="lb" title="Link-budget calculator" description="Results are calculated live by the backend from the formulas listed below." />
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="p-5"><div className="grid grid-cols-2 gap-x-4">
            <NumberField label="Frequency" unit="GHz" value={f} onChange={setF} min={0.1} max={300} /><NumberField label="Transmit power" unit="W" value={pw} onChange={setPw} min={0.001} max={1e6} />
            <NumberField label="Tx antenna gain" unit="dBi" value={gt} onChange={setGt} min={-20} max={90} /><NumberField label="Rx antenna gain" unit="dBi" value={gr} onChange={setGr} min={-20} max={90} />
            <NumberField label="System noise temp." unit="K" value={tn} onChange={setTn} min={1} max={10000} /><NumberField label="Bandwidth" unit="MHz" value={bw} onChange={setBw} min={0.001} max={100000} />
            <NumberField label="Other losses" unit="dB" value={loss} onChange={setLoss} min={0} max={100} hint="Rain, atmosphere, pointing, polarisation" /><NumberField label="Required C/N" unit="dB" value={req} onChange={setReq} min={-30} max={60} hint="From your modulation/coding" /></div>
            <div className="mt-1 max-w-xs"><SelectField label="Path length from" value={mode} onChange={setMode} options={[{ value: "geometry", label: "Altitude + elevation angle" }, { value: "distance", label: "Distance (km)" }]} /></div>
            <div className="mt-3 grid grid-cols-2 gap-x-4">{mode === "geometry" ? (<><NumberField label="Altitude" unit="km" value={alt} onChange={setAlt} min={1} max={400000} /><NumberField label="Elevation" unit="°" value={el} onChange={setEl} min={0} max={90} /></>) : <NumberField label="Distance" unit="km" value={dist} onChange={setDist} min={1} max={1000000} />}</div></Card>
          <Card className="p-5"><div className="mb-3 flex items-center gap-2"><KindBadge kind="calculation" /><Pill>Not a measurement</Pill></div>
            {!valid ? <p className="text-sm text-warn" role="alert">Fix the highlighted inputs to see results.</p> : (
              <DataState loading={lb.loading && !r} error={lb.error} onRetry={() => setF((v) => v)}>{r && (
                <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                  {[["Path length", `${fmt(r.distance_km, 1)} km (${r.distance_source})`], ["EIRP", `${fmt(r.eirp_dbw, 2)} dBW`], ["Free-space path loss", `${fmt(r.fspl_db, 2)} dB`], ["Received power", `${fmt(r.rx_power_dbw, 2)} dBW (${fmt(r.rx_power_dbm, 2)} dBm)`], ["Noise power", `${fmt(r.noise_power_dbw, 2)} dBW`], ["C/N", `${fmt(r.cn_db, 2)} dB`], ["C/N₀", `${fmt(r.cn0_dbhz, 2)} dB-Hz`], ["One-way propagation delay", `${fmt(r.one_way_delay_ms, 3)} ms`], ["Ground–sat–ground round trip (propagation only)", `${fmt(r.round_trip_delay_ms, 3)} ms`]].map(([k, v]) => (<Fragment key={k}><dt className="text-mute">{k}</dt><dd className="text-right tabular-nums">{v}</dd></Fragment>))}
                  <dt className="font-semibold">Link margin</dt><dd className={`text-right font-semibold tabular-nums ${r.link_closes ? "text-ok" : "text-bad"}`}>{r.link_margin_db === null ? "—" : `${fmt(r.link_margin_db, 2)} dB (${r.link_closes ? "link closes" : "link does NOT close"})`}</dd></dl>)}</DataState>)}</Card></div>
        {r && <details className="mt-5 rounded-xl border border-line bg-surface p-4 text-sm"><summary className="cursor-pointer font-medium">Formulas and assumptions</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 font-mono text-xs text-mute">{r.formulas.map((x) => <li key={x}>{x}</li>)}</ul><ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-mute">{r.assumptions.map((x) => <li key={x}>{x}</li>)}</ul></details>}</section>

      <section aria-labelledby="cmp"><SectionHeader id="cmp" title="LEO vs MEO vs GEO" description="Generic illustrative orbits, computed — not real constellations." />
        <div className="mt-4 max-w-xs"><NumberField label="Frequency" unit="GHz" value={cmpF} onChange={setCmpF} min={0.1} max={300} /></div>
        <DataState loading={oc.loading && !oc.data} error={oc.error} onRetry={() => setCmpF((v) => v)}>{oc.data && (<div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-x-auto p-4"><table className="w-full text-left text-xs"><thead className="text-mute"><tr><th className="py-1">Orbit</th><th>Period (min)</th><th>Zenith range (km)</th><th>FSPL zenith (dB)</th><th>Coverage radius @10° (km)</th></tr></thead>
            <tbody>{oc.data.rows.map((x) => <tr key={x.orbit} className="border-t border-line"><td className="py-1.5">{x.orbit}</td><td>{fmt(x.period_min, 1)}</td><td>{fmt(x.zenith_range_km, 0)}</td><td>{fmt(x.fspl_zenith_db, 1)}</td><td>{fmt(x.coverage_radius_km, 0)}</td></tr>)}</tbody></table></Card>
          <Card className="p-4"><p className="mb-1 text-sm font-medium">Propagation delay at zenith (ms)</p><BarsChart title="One-way and round-trip propagation delay by orbit" data={cmp} xKey="orbit" series={[{ key: "oneWay", label: "One-way", color: COLORS.signal }, { key: "roundTrip", label: "Round trip", color: COLORS.accent }]} /></Card></div>)}</DataState></section>

      <section aria-labelledby="bands"><SectionHeader id="bands" title="Frequency bands (typical uses)" />
        <Card className="mt-4 overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead className="text-xs text-mute"><tr><th className="py-1">Band</th><th>Approx. GHz</th><th>Typical use</th><th>Propagation note</th></tr></thead><tbody>{BANDS.map((b) => <tr key={b[0]} className="border-t border-line"><td className="py-2 font-semibold">{b[0]}</td><td>{b[1]}</td><td className="text-mute">{b[2]}</td><td className="text-mute">{b[3]}</td></tr>)}</tbody></table>
          <p className="mt-2 text-xs text-mute">Band edges follow common IEEE letter designations; exact allocations vary by region and service.</p></Card></section>
    </div>
  );
}
