import type { ReactNode } from "react";
import type { DataKind, SourceStatusValue } from "../types/api";

/** Status is always conveyed by text + shape, never by colour alone. */
const STATUS: Record<SourceStatusValue, { label: string; dot: string; text: string }> = {
  not_configured: { label: "Not configured", dot: "bg-mute", text: "text-mute" },
  configured_untested: { label: "Configured, not yet tested", dot: "bg-electric", text: "text-electric" },
  reachable: { label: "Reachable", dot: "bg-signal", text: "text-signal" },
  returning_data: { label: "Returning usable data", dot: "bg-ok", text: "text-ok" },
  rate_limited: { label: "Rate limited", dot: "bg-warn", text: "text-warn" },
  unavailable: { label: "Temporarily unavailable", dot: "bg-bad", text: "text-bad" },
  auth_failed: { label: "Authentication failed", dot: "bg-bad", text: "text-bad" },
};

export function StatusPill({ status }: { status: SourceStatusValue }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium ${s.text}`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const KIND: Record<DataKind, { label: string; cls: string }> = {
  observation: { label: "Observation", cls: "border-signal/40 text-signal" },
  forecast: { label: "Model forecast", cls: "border-electric/50 text-electric" },
  reanalysis: { label: "Reanalysis (historical)", cls: "border-electric/50 text-electric" },
  catalogue: { label: "Catalogue data", cls: "border-line text-mute" },
  derived: { label: "Derived result", cls: "border-accent/50 text-accent" },
  calculation: { label: "Calculation", cls: "border-accent/50 text-accent" },
  simulation: { label: "Simulated", cls: "border-warn/60 text-warn" },
};

/** Distinguishes observation / forecast / derived / simulated data everywhere it is shown. */
export function KindBadge({ kind }: { kind: DataKind }) {
  const k = KIND[kind];
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${k.cls}`}>{k.label}</span>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "signal" | "warn" }) {
  const cls = { neutral: "border-line text-mute", signal: "border-signal/40 text-signal", warn: "border-warn/50 text-warn" }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
