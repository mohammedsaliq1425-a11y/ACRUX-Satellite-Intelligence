import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DataKind } from "../types/api";

export type ReportType = "earth_observation" | "wildfire" | "weather" | "telemetry" | "astronomy" | "multimodal";
export const REPORT_LABELS: Record<ReportType, string> = {
  earth_observation: "Earth observation", wildfire: "Wildfire & disaster monitoring", weather: "Weather & climate",
  telemetry: "Satellite digital twin telemetry", astronomy: "Astronomy & asteroids", multimodal: "Multimodal geospatial intelligence",
};

/** A dataset a page actually retrieved/produced. Reports and the AI assistant only ever use these. */
export interface WorkspaceDataset {
  key: ReportType; title: string; kind: DataKind; source: string; sourceUrl?: string; retrievedAt: string;
  region?: string; simulated: boolean; summary: string;
  keyValues: { label: string; value: string }[];
  table?: { name: string; columns: string[]; rows: (string | number | null)[][] };
  methods: string[]; limitations: string[]; notes: string[];
}
interface Ctx { datasets: Partial<Record<ReportType, WorkspaceDataset>>; publish: (d: WorkspaceDataset) => void; clear: (k: ReportType) => void }
const C = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [datasets, set] = useState<Partial<Record<ReportType, WorkspaceDataset>>>({});
  const publish = useCallback((d: WorkspaceDataset) => set((cur) => ({ ...cur, [d.key]: d })), []);
  const clear = useCallback((k: ReportType) => set((cur) => { const n = { ...cur }; delete n[k]; return n; }), []);
  const value = useMemo(() => ({ datasets, publish, clear }), [datasets, publish, clear]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useWorkspace(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return c;
}
