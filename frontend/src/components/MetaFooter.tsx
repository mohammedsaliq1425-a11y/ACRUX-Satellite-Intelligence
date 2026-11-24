import { ExternalLink } from "lucide-react";
import type { Envelope } from "../types/api";
import { formatTimestamp } from "../utils/format";
import { KindBadge } from "./Badges";

/** Source, kind, retrieval time and cache status for any backend envelope. */
export function MetaFooter({ meta }: { meta: Envelope<unknown>["meta"] | undefined }) {
  if (!meta) return null;
  return (
    <div className="mt-4 space-y-1.5 text-xs text-mute">
      <p className="flex flex-wrap items-center gap-2">
        <KindBadge kind={meta.kind} />
        <a href={meta.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-electric hover:text-signal">{meta.source} <ExternalLink size={11} aria-hidden /></a>
        <span>retrieved {formatTimestamp(meta.retrieved_at)}</span>
        {meta.cached && <span className="rounded border border-warn/50 px-1.5 text-warn">cached, not current</span>}
      </p>
      {meta.notes.map((n) => <p key={n}>• {n}</p>)}
    </div>
  );
}
