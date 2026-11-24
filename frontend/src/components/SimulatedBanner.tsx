import { FlaskConical } from "lucide-react";

export const SIMULATED_TELEMETRY_NOTICE = "SIMULATED TELEMETRY — NOT LIVE SPACECRAFT DATA";

/** Must be shown wherever simulated spacecraft telemetry appears. */
export function SimulatedBanner({ text = SIMULATED_TELEMETRY_NOTICE }: { text?: string }) {
  return (
    <div role="note" className="flex items-center gap-2 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-xs font-semibold tracking-wide text-warn">
      <FlaskConical size={14} aria-hidden /> {text}
    </div>
  );
}
