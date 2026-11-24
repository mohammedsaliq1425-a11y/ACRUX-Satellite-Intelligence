import type { WorkspaceDataset } from "../hooks/useWorkspace";

export interface ContextItem { label: string; kind: "observed" | "forecast" | "derived" | "simulated" | "catalogue"; source: string; timestamp: string; content: string }

const KIND = { observation: "observed", forecast: "forecast", reanalysis: "forecast", catalogue: "catalogue", derived: "derived", calculation: "derived", simulation: "simulated" } as const;

/** Turn a dataset the app really retrieved into a labelled context item for the backend (≤ 3,800 chars). */
export function datasetToContext(d: WorkspaceDataset): ContextItem {
  const kv = d.keyValues.map((k) => `${k.label}: ${k.value}`).join("\n");
  const rows = d.table ? `${d.table.name} (first ${Math.min(10, d.table.rows.length)} of ${d.table.rows.length} rows)\n${d.table.columns.join(" | ")}\n${d.table.rows.slice(0, 10).map((r) => r.join(" | ")).join("\n")}` : "";
  const text = [d.summary, d.region ? `Region: ${d.region}` : "", kv, rows, `Limitations: ${d.limitations.join(" ")}`].filter(Boolean).join("\n\n");
  return { label: d.title.slice(0, 80), kind: d.simulated ? "simulated" : KIND[d.kind], source: d.source.slice(0, 120), timestamp: d.retrievedAt.slice(0, 40), content: text.slice(0, 3800) };
}
