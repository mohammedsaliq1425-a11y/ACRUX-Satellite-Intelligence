import { useState } from "react";
import type { ReactNode } from "react";
import { Download, FileText, Printer, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { BarsChart, COLORS } from "../components/Charts";
import { Card, SectionHeader } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { LogoMark } from "../components/Logo";
import { useApi } from "../hooks/useApi";
import { REPORT_LABELS, useWorkspace } from "../hooks/useWorkspace";
import type { ReportType, WorkspaceDataset } from "../hooks/useWorkspace";
import { ApiError, request } from "../services/api";
import type { Envelope, StatusFlag, StorageRow } from "../types/api";
import { downloadText, toCsv } from "../utils/csv";
import { formatTimestamp } from "../utils/format";

const WHERE: Record<ReportType, { to: string; hint: string }> = {
  earth_observation: { to: "/earth-observation", hint: "open Earth Observation and let the image search load" },
  wildfire: { to: "/wildfire", hint: "load hotspots (needs a FIRMS key)" },
  weather: { to: "/weather", hint: "load a forecast for a location" },
  telemetry: { to: "/digital-twin", hint: "run a simulation" },
  astronomy: { to: "/space-science", hint: "open Near-Earth objects" },
  multimodal: { to: "/multimodal", hint: "run an analysis" },
};

function Paper({ d }: { d: WorkspaceDataset }) {
  const numCol = d.table ? d.table.columns.findIndex((_, i) => d.table!.rows.some((r) => typeof r[i] === "number") && i > 0) : -1;
  const chartRows = d.table && numCol > 0 ? d.table.rows.slice(0, 20).filter((r) => typeof r[numCol] === "number").map((r) => ({ label: String(r[0]).slice(0, 14), value: r[numCol] as number })) : [];
  return (
    <article id="report-paper" className="rounded-xl bg-white p-8 text-slate-900 shadow-card print:rounded-none print:p-0 print:shadow-none">
      <header className="flex items-center justify-between border-b border-slate-300 pb-4"><div className="flex items-center gap-3"><span className="rounded-lg bg-[#060B18] p-1.5"><LogoMark size={26} /></span><div><p className="text-lg font-semibold tracking-[0.3em]">ACRUX</p><p className="text-[11px] text-slate-500">Observe Earth. Understand Space. Predict the Future.</p></div></div><p className="text-right text-xs text-slate-500">Generated {formatTimestamp(new Date().toISOString())}<br />Project Acrux · local build</p></header>
      <h2 className="mt-6 text-2xl font-semibold">{d.title}</h2><p className="mt-1 text-sm text-slate-600">{REPORT_LABELS[d.key]}{d.region ? ` · ${d.region}` : ""}</p>
      {d.simulated && <p className="mt-4 rounded border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">SIMULATED TELEMETRY — NOT LIVE SPACECRAFT DATA. Everything in this report comes from a local simulation.</p>}
      <Sec t="Executive summary"><p>{d.summary}</p></Sec>
      <Sec t="Source data"><ul className="list-disc space-y-1 pl-5"><li>Source: {d.sourceUrl ? <a className="text-blue-700 underline" href={d.sourceUrl}>{d.source}</a> : d.source}</li><li>Data type: {d.kind}{d.simulated ? " (simulated)" : ""}</li><li>Retrieved / generated: {formatTimestamp(d.retrievedAt)}</li></ul></Sec>
      <Sec t="Key measurements"><table className="w-full text-sm"><tbody>{d.keyValues.map((k) => <tr key={k.label} className="border-b border-slate-200"><th className="w-1/2 py-1.5 pr-3 text-left font-medium">{k.label}</th><td className="py-1.5">{k.value}</td></tr>)}</tbody></table></Sec>
      {chartRows.length > 0 && d.table && <Sec t="Chart"><div className="rounded bg-[#0B1224] p-3"><BarsChart title={`${d.table.columns[numCol]} by ${d.table.columns[0]}`} data={chartRows} xKey="label" series={[{ key: "value", label: d.table.columns[numCol]!, color: COLORS.signal }]} height={200} /></div><p className="mt-1 text-xs text-slate-500">{d.table.columns[numCol]} by {d.table.columns[0]} (first {chartRows.length} rows).</p></Sec>}
      {d.table && <Sec t={d.table.name}><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{d.table.columns.map((c) => <th key={c} className="border-b border-slate-400 px-2 py-1 text-left">{c}</th>)}</tr></thead><tbody>{d.table.rows.slice(0, 40).map((r, i) => <tr key={i} className="border-b border-slate-200">{r.map((v, j) => <td key={j} className="px-2 py-1">{v === null ? "—" : String(v)}</td>)}</tr>)}</tbody></table></div>{d.table.rows.length > 40 && <p className="mt-1 text-xs text-slate-500">Showing 40 of {d.table.rows.length} rows; export the CSV for all rows.</p>}</Sec>}
      <Sec t="Analysis methods"><ul className="list-disc space-y-1 pl-5">{d.methods.map((m) => <li key={m}>{m}</li>)}</ul></Sec>
      <Sec t="Findings"><p>{d.summary}</p>{d.notes.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>}</Sec>
      <Sec t="Limitations"><ul className="list-disc space-y-1 pl-5">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Sec>
      <footer className="mt-8 border-t border-slate-300 pt-3 text-[11px] text-slate-500">This report contains only data retrieved or generated in this session. Values are not independently verified. {d.sourceUrl && <>Source link: {d.sourceUrl}</>}</footer>
    </article>);
}
const Sec = ({ t, children }: { t: string; children: ReactNode }) => (<section className="mt-6 break-inside-avoid text-sm leading-relaxed"><h3 className="mb-2 text-base font-semibold">{t}</h3>{children}</section>);

export default function Reports() {
  const { datasets } = useWorkspace();
  const [type, setType] = useState<ReportType | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const storage = useApi<StatusFlag>("/api/storage/status");
  const saved = useApi<Envelope<StorageRow[]>>(storage.data?.configured ? "/api/storage/reports?limit=10" : null);
  const d = type ? datasets[type] : undefined;

  const save = async () => {
    if (!d) return;
    try { await request("/api/storage/reports", { method: "POST", body: JSON.stringify({ title: d.title.slice(0, 120), report_type: d.key, payload: d, contains_simulated: d.simulated }) }); setMsg("Report saved to Supabase."); saved.reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Could not save the report."); }
  };
  const csv = () => { if (d?.table) downloadText(`acrux_${d.key}_report_table.csv`, toCsv(d.table.columns, d.table.rows)); };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10 sm:px-10 print:p-0">
      <div className="space-y-8 print:hidden">
        <PageHeader icon={FileText} eyebrow="Module 11" title="Reports & Analytics" description="Build a report from data you have actually loaded in this session. Reports never contain invented measurements, and simulated data is always flagged." />
        <section aria-labelledby="rt"><SectionHeader id="rt" title="Choose a report" />
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(REPORT_LABELS) as ReportType[]).map((k) => { const have = !!datasets[k]; return (
            <li key={k}><button type="button" onClick={() => { setType(k); setMsg(null); }} aria-pressed={type === k} className={`h-full w-full rounded-xl border p-4 text-left ${type === k ? "border-signal bg-electric/10" : "border-line bg-surface hover:border-signal/60"}`}>
              <span className="font-semibold">{REPORT_LABELS[k]}</span><span className={`mt-1 block text-xs ${have ? "text-ok" : "text-mute"}`}>{have ? `Data ready · ${formatTimestamp(datasets[k]!.retrievedAt)}` : "No data loaded yet"}</span></button></li>); })}</ul></section>
        {type && !d && <Card className="p-5" ><p role="status" className="text-sm text-mute"><strong className="text-ink">Not enough data for this report.</strong> To create it, <Link to={WHERE[type].to} className="text-electric hover:text-signal">{WHERE[type].hint}</Link>, then return here.</p></Card>}
        {d && <div className="flex flex-wrap items-center gap-3"><Button variant="primary" onClick={() => window.print()}><Printer size={14} aria-hidden /> Print / Save as PDF</Button>
          <Button onClick={csv} disabled={!d.table}><Download size={14} aria-hidden /> Download table (CSV)</Button>
          {storage.data?.configured && <Button onClick={() => void save()}><Save size={14} aria-hidden /> Save to Supabase</Button>}
          {msg && <span role="status" className="text-xs text-mute">{msg}</span>}</div>}
        {d && <p className="text-xs text-mute">PDF export uses your browser’s print dialog: choose “Save as PDF” as the printer. The navigation is hidden automatically.</p>}
      </div>
      {d && <Paper d={d} />}
      {saved.data && saved.data.data.length > 0 && <div className="print:hidden"><SectionHeader title="Saved reports (Supabase)" /><ul className="mt-3 space-y-1.5 text-sm">{saved.data.data.map((r) => <li key={r.id} className="flex justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"><span>{String(r.title)}{r.contains_simulated ? " · simulated" : ""}</span><span className="text-xs text-mute">{formatTimestamp(String(r.created_at))}</span></li>)}</ul></div>}
    </div>
  );
}
