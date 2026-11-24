import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { KindBadge } from "../components/Badges";
import { Button } from "../components/Button";
import { BarsChart, COLORS } from "../components/Charts";
import { Card, SectionHeader } from "../components/Card";
import { DataState } from "../components/DataState";
import { NumberField } from "../components/Fields";
import { PageHeader } from "../components/PageHeader";
import { SimulatedBanner } from "../components/SimulatedBanner";
import { usePost } from "../hooks/usePost";
import type { GnssResult } from "../types/api";
import { fmt } from "../utils/geo";

interface Sat { prn: string; az: number; el: number }
const PRESETS: Record<string, Sat[]> = {
  "Good spread": [{ prn: "S01", az: 0, el: 88 }, { prn: "S02", az: 0, el: 15 }, { prn: "S03", az: 120, el: 15 }, { prn: "S04", az: 240, el: 15 }, { prn: "S05", az: 60, el: 45 }, { prn: "S06", az: 300, el: 50 }],
  "Clustered (poor)": [{ prn: "S01", az: 20, el: 40 }, { prn: "S02", az: 26, el: 44 }, { prn: "S03", az: 14, el: 36 }, { prn: "S04", az: 30, el: 40 }, { prn: "S05", az: 22, el: 48 }],
  "Low elevations": [{ prn: "S01", az: 0, el: 10 }, { prn: "S02", az: 90, el: 12 }, { prn: "S03", az: 180, el: 9 }, { prn: "S04", az: 270, el: 11 }, { prn: "S05", az: 45, el: 14 }],
};
const C = 150, R = 130;
const toXY = (s: Sat) => { const r = ((90 - s.el) / 90) * R, a = (s.az * Math.PI) / 180; return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }; };

function SkyPlot({ sats, setSats, mask }: { sats: Sat[]; setSats: (s: Sat[]) => void; mask: number }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const move = useCallback((e: { clientX: number; clientY: number }) => {
    if (drag === null || !svg.current) return;
    const b = svg.current.getBoundingClientRect(), k = 300 / b.width;
    const x = (e.clientX - b.left) * k - C, y = C - (e.clientY - b.top) * k;
    const r = Math.min(R, Math.hypot(x, y));
    setSats(sats.map((s, i) => (i === drag ? { ...s, el: Math.round(90 - (r / R) * 90), az: Math.round((((Math.atan2(x, y) * 180) / Math.PI) + 360) % 360) } : s)));
  }, [drag, sats, setSats]);
  return (
    <svg ref={svg} viewBox="0 0 300 300" role="img" aria-label="Sky plot of simulated satellites. Drag a satellite to change its azimuth and elevation." className="w-full max-w-md touch-none select-none"
      onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
      {[0, 30, 60].map((el) => <circle key={el} cx={C} cy={C} r={((90 - el) / 90) * R} fill="none" stroke="#1E2A45" />)}
      <circle cx={C} cy={C} r={((90 - mask) / 90) * R} fill="none" stroke="#FBBF24" strokeDasharray="4 3" />
      <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="#1E2A45" /><line x1={C - R} y1={C} x2={C + R} y2={C} stroke="#1E2A45" />
      {[["N", C, 12], ["E", 292, C + 4], ["S", C, 296], ["W", 8, C + 4]].map(([t, x, y]) => <text key={String(t)} x={Number(x)} y={Number(y)} textAnchor="middle" fill="#94A3B8" fontSize="11">{t}</text>)}
      <text x={C + 4} y={C - ((90 - 30) / 90) * R + 12} fill="#475569" fontSize="9">30°</text><text x={C + 4} y={C - ((90 - 60) / 90) * R + 12} fill="#475569" fontSize="9">60°</text>
      <circle cx={C} cy={C} r="3" fill="#E8EEF8" />
      {sats.map((s, i) => { const p = toXY(s); const below = s.el < mask; return (
        <g key={s.prn} transform={`translate(${p.x} ${p.y})`} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(i); }} style={{ cursor: "grab" }}>
          <circle r="11" fill={below ? "#475569" : "#3B82F6"} stroke="#22D3EE" strokeWidth={drag === i ? 3 : 1.5} /><text textAnchor="middle" y="3.5" fontSize="8.5" fill="#fff">{s.prn.slice(1)}</text></g>); })}
    </svg>);
}

export default function Navigation() {
  const [sats, setSats] = useState<Sat[]>(PRESETS["Good spread"]!);
  const [lat, setLat] = useState<number | null>(40), [lon, setLon] = useState<number | null>(-100), [h, setH] = useState<number | null>(100);
  const [sigma, setSigma] = useState<number | null>(5), [bias, setBias] = useState<number | null>(0), [mask, setMask] = useState<number | null>(5), [seed, setSeed] = useState<number | null>(1);
  const g = usePost<GnssResult>("/api/calc/gnss");
  const ok = [lat, lon, h, sigma, bias, mask, seed].every((v) => v !== null) && lat! >= -90 && lat! <= 90 && lon! >= -180 && lon! <= 180 && sigma! >= 0 && sigma! <= 100 && mask! >= 0 && mask! <= 45 && sats.length >= 4;
  useEffect(() => {
    if (!ok) return;
    const id = window.setTimeout(() => { void g.run({ lat_deg: lat, lon_deg: lon, height_m: h, satellites: sats.map((s) => ({ prn: s.prn, az_deg: s.az, el_deg: s.el })), noise_sigma_m: sigma, clock_bias_m: bias, elevation_mask_deg: mask, seed: Math.trunc(seed!) }); }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, sats, lat, lon, h, sigma, bias, mask, seed]);
  const r = g.data;
  const addSat = () => sats.length < 12 && setSats([...sats, { prn: `S${String(sats.length + 1).padStart(2, "0")}`, az: (sats.length * 47) % 360, el: 30 }]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10 sm:px-10">
      <PageHeader icon={Compass} eyebrow="Module 05" title="Navigation & Positioning Intelligence" description="Drag simulated satellites across the sky and watch the dilution of precision and position error respond. Every satellite position and measurement here is generated, not live GNSS data." />
      <SimulatedBanner text="SIMULATED — satellite geometry and pseudoranges are generated; no live GNSS receiver is used" />
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="space-y-3 p-5"><SectionHeader title="Sky plot" description="Centre = zenith (90°), edge = horizon (0°). Dashed ring = elevation mask; greyed satellites are below it." />
          <SkyPlot sats={sats} setSats={setSats} mask={mask ?? 5} />
          <div className="flex flex-wrap gap-2">{Object.keys(PRESETS).map((k) => <Button key={k} variant="secondary" onClick={() => setSats(PRESETS[k]!)}>{k}</Button>)}<Button variant="ghost" onClick={addSat} disabled={sats.length >= 12}>Add satellite</Button><Button variant="ghost" onClick={() => setSats(sats.slice(0, -1))} disabled={sats.length <= 4}>Remove last</Button></div></Card>
        <Card className="p-5"><SectionHeader title="Receiver and error model" /><div className="mt-3 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          <NumberField label="Latitude" unit="°" value={lat} onChange={setLat} min={-90} max={90} /><NumberField label="Longitude" unit="°" value={lon} onChange={setLon} min={-180} max={180} /><NumberField label="Height" unit="m" value={h} onChange={setH} min={-500} max={10000} />
          <NumberField label="Pseudorange noise σ" unit="m" value={sigma} onChange={setSigma} min={0} max={100} hint="Stands in for all error sources" /><NumberField label="Receiver clock bias" unit="m" value={bias} onChange={setBias} min={-1e6} max={1e6} /><NumberField label="Elevation mask" unit="°" value={mask} onChange={setMask} min={0} max={45} />
          <NumberField label="Noise seed" value={seed} onChange={setSeed} min={0} max={2147483647} step={1} hint="Same seed = same draw" /></div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">{sats.map((s, i) => (<li key={s.prn} className="flex items-center gap-2 text-xs"><span className="w-8 font-mono">{s.prn}</span>
            <label className="flex items-center gap-1">Az<input aria-label={`${s.prn} azimuth`} type="number" min={0} max={360} value={s.az} onChange={(e) => setSats(sats.map((x, j) => (j === i ? { ...x, az: Math.min(360, Math.max(0, Number(e.target.value) || 0)) } : x)))} className="w-16 rounded border border-line bg-panel px-1.5 py-1" /></label>
            <label className="flex items-center gap-1">El<input aria-label={`${s.prn} elevation`} type="number" min={0} max={90} value={s.el} onChange={(e) => setSats(sats.map((x, j) => (j === i ? { ...x, el: Math.min(90, Math.max(0, Number(e.target.value) || 0)) } : x)))} className="w-16 rounded border border-line bg-panel px-1.5 py-1" /></label></li>))}</ul></Card></div>

      <Card className="p-5"><div className="flex items-center gap-2"><SectionHeader title="Solver output" /><KindBadge kind="simulation" /></div>
        {!ok && <p className="mt-3 text-sm text-warn" role="alert">Fix the inputs (4+ satellites, valid ranges) to compute a fix.</p>}
        {ok && <div className="mt-4"><DataState loading={g.loading && !r} error={g.error} onRetry={() => setSeed((v) => v)}>{r && (<div className="grid gap-6 lg:grid-cols-2">
          <div><p className="mb-1 text-sm font-medium">Dilution of precision (lower is better)</p><BarsChart title="DOP values" data={Object.entries(r.dop).map(([k, v]) => ({ name: k.toUpperCase(), value: Number(v.toFixed(2)) }))} xKey="name" series={[{ key: "value", label: "DOP", color: COLORS.signal }]} height={200} />
            <p className="mt-2 text-xs text-mute">Satellites used: {r.satellites_used.join(", ")}{r.satellites_excluded_below_mask.length ? ` · below mask: ${r.satellites_excluded_below_mask.join(", ")}` : ""}</p></div>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 self-start text-sm">
            {[["Horizontal error (this draw)", `${fmt(r.horizontal_error_m, 2)} m`], ["Vertical error (this draw)", `${fmt(r.vertical_error_m, 2)} m`], ["East / North / Up error", `${fmt(r.error_enu_m.east, 2)} / ${fmt(r.error_enu_m.north, 2)} / ${fmt(r.error_enu_m.up, 2)} m`], ["Expected 1σ horizontal (HDOP × σ)", `${fmt(r.expected_1sigma_horizontal_m, 2)} m`], ["Expected 1σ vertical (VDOP × σ)", `${fmt(r.expected_1sigma_vertical_m, 2)} m`], ["Clock bias: estimated vs true", `${fmt(r.estimated_clock_bias_m, 2)} vs ${fmt(r.true_clock_bias_m, 2)} m`], ["Solver", `${r.iterations} iterations, ${r.converged ? "converged" : "not converged"}`]].map(([k, v]) => (<Fragment key={k}><dt className="text-mute">{k}</dt><dd className="text-right tabular-nums">{v}</dd></Fragment>))}</dl></div>)}</DataState></div>}</Card>

      <section className="grid gap-6 md:grid-cols-2"><Card className="space-y-2 p-5 text-sm leading-relaxed text-mute"><SectionHeader title="How positioning works" />
        <p><strong className="text-ink">Trilateration.</strong> A receiver measures pseudoranges to at least four satellites and solves for its 3-D position plus its own clock error. GPS, Galileo, GLONASS and BeiDou all work this way; modern receivers combine several constellations.</p>
        <p><strong className="text-ink">Geometry matters.</strong> DOP scales measurement noise into position error. Satellites bunched together (see the “Clustered” preset) give large DOP; a wide spread gives small DOP. Vertical error is normally larger than horizontal.</p></Card>
        <Card className="space-y-2 p-5 text-sm leading-relaxed text-mute"><SectionHeader title="What this model leaves out" />
          <p>Ionosphere and troposphere delay, multipath, satellite clock/orbit errors, receiver noise and signal blockage are all folded into one Gaussian noise term. Real accuracy depends on all of them. The solver is real least squares; the satellites and measurements are simulated.</p></Card></section>
    </div>
  );
}
