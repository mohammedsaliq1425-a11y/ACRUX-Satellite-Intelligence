import { useMemo, useState } from "react";
import { Orbit } from "lucide-react";
import { KindBadge, Pill } from "../components/Badges";
import { BarsChart, COLORS, ScatterPlot } from "../components/Charts";
import { Button } from "../components/Button";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { NumberField, SelectField, Tabs } from "../components/Fields";
import { MetaFooter } from "../components/MetaFooter";
import { PageHeader } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";
import type { CadRow, DebrisData, DebrisObject, Envelope, SmallBody } from "../types/api";
import { downloadText, toCsv } from "../utils/csv";
import { addDays, isoDate } from "../utils/format";
import { fmt } from "../utils/geo";

type Tab = "asteroids" | "debris" | "edu";
const MU = 398600.4418, RE = 6371.0088;

export default function SpaceObjects() {
  const [tab, setTab] = useState<Tab>("asteroids");
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10">
      <PageHeader icon={Orbit} eyebrow="Module 08" title="Space Debris & Asteroid Tracking" description="Three clearly separate views: natural near-Earth asteroids, human-made orbital debris, and an educational orbit simulation." />
      <div role="note" className="rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm text-mute">This is an educational explorer, <strong className="text-ink">not</strong> a space-surveillance, conjunction-warning or impact-prediction system. No collision probabilities are computed or shown.</div>
      <Tabs label="Space-object views" value={tab} onChange={setTab} tabs={[{ id: "asteroids", label: "Near-Earth asteroids" }, { id: "debris", label: "Orbital debris (human-made)" }, { id: "edu", label: "Educational orbit simulation" }]} />
      {tab === "asteroids" && <Asteroids />}{tab === "debris" && <Debris />}{tab === "edu" && <Edu />}
    </div>
  );
}

function OrbitDiagram({ a, e }: { a: number; e: number }) {
  if (!(a > 0) || !(e >= 0 && e < 1)) return <p className="text-sm text-mute">An elliptical orbit diagram is not possible for these elements (e ≥ 1 or missing a).</p>;
  const b = a * Math.sqrt(1 - e * e), apo = a * (1 + e), s = 120 / Math.max(apo, 1.05);
  return (
    <svg viewBox="-150 -150 300 300" role="img" aria-label={`Orbit shape: semi-major axis ${a.toFixed(2)} au, eccentricity ${e.toFixed(3)}, with Earth's orbit at 1 au`} className="w-full max-w-sm">
      <circle r={1 * s} fill="none" stroke="#3B82F6" strokeDasharray="3 3" /><text x={1 * s + 3} y="-3" fill="#3B82F6" fontSize="9">Earth 1 au</text>
      <ellipse cx={-a * e * s} cy="0" rx={a * s} ry={b * s} fill="none" stroke="#22D3EE" strokeWidth="1.6" />
      <circle r="5" fill="#FBBF24" /><text x="8" y="14" fill="#FBBF24" fontSize="9">Sun</text>
      <circle cx={a * (1 - e) * s} cy="0" r="3" fill="#E8EEF8" /><text x={a * (1 - e) * s + 5} y="-5" fill="#E8EEF8" fontSize="9">perihelion</text>
      <text x="-146" y="144" fill="#94A3B8" fontSize="8.5">Shape in its own orbital plane; tilt and orientation not shown.</text>
    </svg>);
}

function Asteroids() {
  const [d0, setD0] = useState(isoDate(new Date())), [d1, setD1] = useState(isoDate(addDays(new Date(), 60))), [dist, setDist] = useState("0.05");
  const [sel, setSel] = useState<CadRow | null>(null);
  const okRange = d0 <= d1 && (Date.parse(d1) - Date.parse(d0)) / 86_400_000 <= 366;
  const cad = useApi<Envelope<CadRow[]>>(okRange ? `/api/space/close-approaches?date_min=${d0}&date_max=${d1}&dist_max_au=${dist}&limit=200` : null);
  const sb = useApi<Envelope<SmallBody>>(sel?.des ? `/api/space/small-body?q=${encodeURIComponent(sel.des)}` : null);
  const rows = cad.data?.data ?? [];
  const cols: Column<CadRow>[] = [{ key: "n", label: "Object", value: (r) => r.designation }, { key: "t", label: "Approach (TDB)", value: (r) => r.approach_time_tdb }, { key: "ld", label: "Distance (lunar)", value: (r) => r.distance_lunar, numeric: true }, { key: "km", label: "Distance (km)", value: (r) => r.distance_km, numeric: true }, { key: "v", label: "Rel. speed (km/s)", value: (r) => r.v_rel_km_s, numeric: true }, { key: "h", label: "H (mag)", value: (r) => r.absolute_magnitude_h, numeric: true }, { key: "d", label: "Diameter (km)", value: (r) => r.diameter_km, numeric: true }];
  const bars = useMemo(() => [...rows].filter((r) => r.distance_lunar !== null).sort((a, b) => a.distance_lunar! - b.distance_lunar!).slice(0, 12).map((r) => ({ name: r.des ?? "?", ld: Number(r.distance_lunar!.toFixed(2)) })), [rows]);
  const o = sb.data?.data.orbit, el = o?.elements ?? {};
  return (<div className="space-y-6">
    <div className="flex flex-wrap items-end gap-4"><label className="text-sm font-medium">From<input type="date" value={d0} onChange={(e) => setD0(e.target.value)} className="mt-1.5 block rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label><label className="text-sm font-medium">To<input type="date" value={d1} onChange={(e) => setD1(e.target.value)} className="mt-1.5 block rounded-lg border border-line bg-panel px-3 py-2 text-sm" /></label>
      <div className="w-56"><SelectField label="Within distance" value={dist} onChange={setDist} options={[{ value: "0.01", label: "0.01 au (~3.9 LD)" }, { value: "0.02", label: "0.02 au (~7.8 LD)" }, { value: "0.05", label: "0.05 au (~19.5 LD)" }, { value: "0.1", label: "0.1 au (~39 LD)" }]} /></div></div>
    {!okRange && <p role="alert" className="text-sm text-bad">The “From” date must not be after “To”, and the range is limited to 366 days.</p>}
    <DataState loading={cad.loading} error={cad.error} onRetry={cad.reload} empty={!!cad.data && rows.length === 0} emptyMessage="No close approaches match." loadingLabel="Loading JPL close-approach data">
      <Card className="p-5"><p className="mb-1 text-sm font-medium">Closest approaches (lunar distances)</p><BarsChart title="Closest approaches in lunar distances" data={bars} xKey="name" series={[{ key: "ld", label: "Lunar distances", color: COLORS.signal }]} /></Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]"><Card className="p-5"><DataTable rows={rows} columns={cols} rowKey={(r) => `${r.des}-${r.approach_time_tdb}`} caption="JPL close approaches" onSelect={setSel} selectedKey={sel ? `${sel.des}-${sel.approach_time_tdb}` : null} pageSize={10} />
        <Button className="mt-3" variant="ghost" onClick={() => downloadText("acrux_jpl_close_approaches.csv", toCsv(cols.map((c) => c.label), rows.map((r) => cols.map((c) => c.value(r)))))}>Export CSV</Button></Card>
        <Card className="p-4 text-sm">{!sel ? <p className="text-mute">Select an object to load its orbit and physical parameters from the JPL Small-Body Database.</p> : (<>
          <p className="font-semibold">{sel.designation}</p><p className="text-xs text-mute">Distance uncertainty: {fmt(sel.distance_min_au, 5)}–{fmt(sel.distance_max_au, 5)} au · time uncertainty {sel.time_uncertainty ?? "—"}</p>
          <div className="mt-3"><DataState loading={sb.loading} error={sb.error} onRetry={sb.reload} loadingLabel="Loading small-body record">{sb.data && (<>
            <div className="flex flex-wrap gap-1.5">{sb.data.data.orbit_class && <Pill>{sb.data.data.orbit_class}</Pill>}{sb.data.data.neo && <Pill tone="signal">NEO</Pill>}{sb.data.data.pha && <Pill tone="warn">PHA classification</Pill>}</div>
            <dl className="mt-3 space-y-1 text-xs text-mute"><div>a: {fmt(el.a?.value ?? null, 4)} au · e: {fmt(el.e?.value ?? null, 4)} · i: {fmt(el.i?.value ?? null, 3)}°</div><div>MOID: {fmt(o?.moid_au ?? null, 4)} au · epoch JD {fmt(o?.epoch_jd ?? null, 1)}</div><div>Observations: {o?.n_obs_used ?? "—"} ({o?.first_obs ?? "?"} → {o?.last_obs ?? "?"})</div>{sb.data.data.physical.diameter && <div>Diameter: {sb.data.data.physical.diameter.value} {sb.data.data.physical.diameter.units}</div>}</dl>
            <div className="mt-3"><OrbitDiagram a={el.a?.value ?? 0} e={el.e?.value ?? 0} /></div><MetaFooter meta={sb.data.meta} /></>)}</DataState></div></>)}</Card></div>
      <MetaFooter meta={cad.data?.meta} /></DataState></div>);
}

function Debris() {
  const [group, setGroup] = useState("iridium-33-debris"), [sel, setSel] = useState<DebrisObject | null>(null);
  const db = useApi<Envelope<DebrisData>>(`/api/space/debris?group=${group}`);
  const objs = (db.data?.data.objects ?? []).filter((o) => o.perigee_alt_km !== null);
  const cols: Column<DebrisObject>[] = [{ key: "n", label: "Name", value: (o) => o.name }, { key: "id", label: "NORAD ID", value: (o) => (o.norad_id === null ? null : String(o.norad_id)) }, { key: "i", label: "Incl. (°)", value: (o) => o.inclination_deg, numeric: true }, { key: "p", label: "Perigee alt. (km)", value: (o) => o.perigee_alt_km, numeric: true }, { key: "a", label: "Apogee alt. (km)", value: (o) => o.apogee_alt_km, numeric: true }, { key: "t", label: "Period (min)", value: (o) => o.period_min, numeric: true }, { key: "e", label: "Epoch", value: (o) => o.epoch }];
  return (<div className="space-y-6"><div className="flex flex-wrap items-end gap-4"><div className="w-72"><SelectField label="Debris group (named breakup event)" value={group} onChange={(v) => { setGroup(v); setSel(null); }} options={[{ value: "iridium-33-debris", label: "Iridium 33 collision debris" }, { value: "cosmos-2251-debris", label: "Cosmos 2251 collision debris" }, { value: "fengyun-1c-debris", label: "Fengyun-1C test debris" }]} /></div><KindBadge kind="catalogue" /></div>
    <p className="text-xs text-mute">Altitudes are derived from mean orbital elements with two-body formulas. Data is cached for 2 hours because CelesTrak asks clients not to poll often.</p>
    <DataState loading={db.loading} error={db.error} onRetry={db.reload} empty={!!db.data && objs.length === 0} emptyMessage="No tracked objects returned for this group." loadingLabel="Loading orbital elements">
      <div className="grid gap-6 md:grid-cols-2"><Card className="p-5"><p className="mb-2 text-sm font-medium">Mean perigee altitude vs inclination</p><ScatterPlot title="Debris perigee altitude versus inclination" points={objs.map((o) => ({ x: o.inclination_deg ?? 0, y: o.perigee_alt_km! }))} xLabel="Inclination (°)" yLabel="Perigee altitude (km)" color={COLORS.bad} /></Card>
        <Card className="p-5"><p className="mb-2 text-sm font-medium">Apogee vs perigee altitude</p><ScatterPlot title="Debris apogee versus perigee altitude" points={objs.filter((o) => o.apogee_alt_km !== null).map((o) => ({ x: o.perigee_alt_km!, y: o.apogee_alt_km! }))} xLabel="Perigee altitude (km)" yLabel="Apogee altitude (km)" color={COLORS.warn} /></Card></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]"><Card className="p-5"><DataTable rows={objs} columns={cols} rowKey={(o) => String(o.norad_id ?? o.name)} caption="Orbital debris objects" onSelect={setSel} selectedKey={sel ? String(sel.norad_id ?? sel.name) : null} pageSize={10} /></Card>
        <Card className="p-4 text-sm">{sel ? (<><p className="font-semibold">{sel.name}</p><dl className="mt-3 space-y-1 text-xs text-mute"><div>NORAD ID {String(sel.norad_id)} · {sel.intl_designator ?? "—"}</div><div>Epoch: {sel.epoch ?? "—"}</div><div>Semi-major axis: {fmt(sel.semi_major_axis_km, 1)} km</div><div>Eccentricity: {fmt(sel.eccentricity, 5)} · inclination {fmt(sel.inclination_deg, 3)}°</div><div>RAAN {fmt(sel.raan_deg, 2)}° · arg. perigee {fmt(sel.arg_perigee_deg, 2)}° · mean anomaly {fmt(sel.mean_anomaly_deg, 2)}°</div><div>Perigee / apogee altitude: {fmt(sel.perigee_alt_km, 1)} / {fmt(sel.apogee_alt_km, 1)} km</div></dl><p className="mt-3 text-xs text-mute">Mean elements (TEME frame) as published; no propagation or conjunction analysis is done here.</p></>) : <p className="text-mute">Select an object to see its elements.</p>}</Card></div>
      <MetaFooter meta={db.data?.meta} /></DataState></div>);
}

function Edu() {
  const [alt, setAlt] = useState<number | null>(550), [ang, setAng] = useState(40);
  const ok = alt !== null && alt >= 160 && alt <= 40000;
  const r = RE + (alt ?? 0), v = Math.sqrt(MU / r), T = (2 * Math.PI * Math.sqrt(r ** 3 / MU)) / 60;
  const sc = 110 / (RE + 40000), pr = (RE + (alt ?? 0)) * sc, x = 150 + pr * Math.cos((ang * Math.PI) / 180), y = 150 - pr * Math.sin((ang * Math.PI) / 180);
  return (<Card className="grid gap-6 p-5 lg:grid-cols-2"><div><div className="mb-3 flex items-center gap-2"><SectionHeader title="Circular-orbit calculator" /><Pill tone="warn">Educational simulation</Pill></div>
    <div className="max-w-xs"><NumberField label="Altitude" unit="km" value={alt} onChange={setAlt} min={160} max={40000} hint="Circular orbit, spherical Earth" /></div>
    <label className="mt-2 block max-w-xs text-sm font-medium">Position along orbit: {ang}°<input type="range" min={0} max={360} value={ang} onChange={(e) => setAng(Number(e.target.value))} className="mt-2 w-full" /></label>
    {ok ? <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-sm"><dt className="text-mute">Orbital radius</dt><dd className="tabular-nums">{fmt(r, 1)} km</dd><dt className="text-mute">Orbital speed</dt><dd className="tabular-nums">{fmt(v, 3)} km/s</dd><dt className="text-mute">Period</dt><dd className="tabular-nums">{fmt(T, 2)} min</dd></dl> : <p className="mt-4 text-sm text-bad" role="alert">Enter an altitude between 160 and 40,000 km.</p>}
    <p className="mt-4 text-xs text-mute">v = √(μ/r) and T = 2π√(r³/μ) with μ = 398,600.4418 km³/s². These are idealised two-body results, not tracked objects.</p></div>
    <svg viewBox="0 0 300 300" role="img" aria-label="Educational diagram of a circular orbit around Earth" className="mx-auto w-full max-w-sm"><circle cx="150" cy="150" r={RE * sc} fill="#12306B" stroke="#22D3EE" /><circle cx="150" cy="150" r={ok ? pr : 0} fill="none" stroke="#8B5CF6" strokeDasharray="4 3" />{ok && <circle cx={x} cy={y} r="5" fill="#E8EEF8" />}<text x="150" y="154" textAnchor="middle" fill="#94A3B8" fontSize="10">Earth</text><text x="8" y="292" fill="#94A3B8" fontSize="9">Scale: Earth radius to 40,000 km altitude</text></svg></Card>);
}
