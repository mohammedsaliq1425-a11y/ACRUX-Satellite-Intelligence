import { ExternalLink, FlaskConical, Loader2 } from "lucide-react";
import { StatusPill } from "../../components/Badges";
import { Button } from "../../components/Button";
import type { SourceInfo } from "../../types/api";
import { formatRelative, formatTimestamp } from "../../utils/format";

const AUTH: Record<SourceInfo["auth_requirement"], string> = {
  required: "API key required", optional: "API key optional", none: "No key needed",
};

export interface TestOutcome { ok: boolean; text: string }

export function SourceCard({ source, testing, outcome, onTest }: {
  source: SourceInfo; testing: boolean; outcome?: TestOutcome; onTest: (id: string) => void;
}) {
  const s = source;
  return (
    <li className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{s.name}</h3>
          <p className="mt-1 text-sm text-mute">{s.purpose}</p>
        </div>
        <a href={s.docs_url} target="_blank" rel="noreferrer" aria-label={`${s.name} documentation (opens in a new tab)`}
          className="shrink-0 rounded-md p-1.5 text-mute hover:bg-panel hover:text-signal"><ExternalLink size={16} aria-hidden /></a>
      </div>

      <div className="mt-4"><StatusPill status={s.status} /></div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-mute">Authentication</dt><dd>{AUTH[s.auth_requirement]}</dd>
        {s.key_env_var && (<><dt className="text-mute">Setting</dt>
          <dd><code className="font-mono">{s.key_env_var}</code> · {s.key_configured ? "set" : "not set"}</dd></>)}
        <dt className="text-mute">Last success</dt>
        <dd title={formatTimestamp(s.last_success_at)}>{s.last_success_at ? formatRelative(s.last_success_at) : "never"}</dd>
        <dt className="text-mute">Last checked</dt>
        <dd title={formatTimestamp(s.last_checked_at)}>{s.last_checked_at ? formatRelative(s.last_checked_at) : "never"}</dd>
      </dl>

      {s.note && <p className="mt-3 rounded-md border border-warn/40 bg-warn/5 p-2 text-xs text-warn">{s.note}</p>}
      {s.last_error && <p className="mt-3 rounded-md border border-bad/40 bg-bad/5 p-2 text-xs text-bad">Last error: {s.last_error}</p>}

      <div className="mt-auto pt-4">
        {s.test_available && (
          <Button onClick={() => onTest(s.id)} disabled={testing} aria-busy={testing}>
            {testing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FlaskConical size={14} aria-hidden />}
            {testing ? "Testing…" : "Test connection"}
          </Button>
        )}
        {outcome && (
          <p role="status" className={`mt-2 text-xs ${outcome.ok ? "text-ok" : "text-bad"}`}>{outcome.text}</p>
        )}
      </div>
    </li>
  );
}
