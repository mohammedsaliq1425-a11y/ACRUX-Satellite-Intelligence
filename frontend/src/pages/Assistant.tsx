import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, RefreshCw, Send } from "lucide-react";
import { Pill } from "../components/Badges";
import { Button } from "../components/Button";
import { Card, SectionHeader } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";
import { REPORT_LABELS, useWorkspace } from "../hooks/useWorkspace";
import { ApiError, errorTitle, request } from "../services/api";
import type { ChatReply, Envelope } from "../types/api";
import { datasetToContext } from "../utils/aiContext";
import { formatTimestamp } from "../utils/format";

interface Msg { role: "user" | "assistant"; content: string; model?: string; used?: { id: string; label: string; kind: string; source: string }[] }
type ChatEnvelope = Envelope<ChatReply> & { meta: Envelope<ChatReply>["meta"] & { context_items_used?: { id: string; label: string; kind: string; source: string }[] } };
const GENERAL = ["What is the difference between an observation and a model forecast?", "How does satellite geometry affect GNSS accuracy?", "Explain free-space path loss in simple terms.", "What does a near-Earth object close approach mean?"];
const PER_DATASET: Record<string, string> = { weather: "Explain this weather data and what it implies for the next few days.", wildfire: "Interpret these fire hotspot observations. What can and can't be concluded?", telemetry: "Explain the simulated alerts and what each diagnostic would check.", astronomy: "Summarise these close approaches. Is there any impact risk implied?", earth_observation: "What is the selected imagery layer showing, and what are its limits?", multimodal: "Summarise the multimodal analysis and its limitations." };

export default function Assistant() {
  const status = useApi<{ configured: boolean; has_key: boolean; has_model: boolean }>("/api/ai/status");
  const { datasets } = useWorkspace();
  const sets = Object.values(datasets).filter((d): d is NonNullable<typeof d> => !!d);
  const [use, setUse] = useState<Record<string, boolean>>({});
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  const active = useMemo(() => sets.filter((d) => use[d.key] !== false), [sets, use]);
  const configured = status.data?.configured ?? false;

  const send = async (text: string, history: Msg[]) => {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true); setErr(null); setLast(t);
    try {
      const r = await request<ChatEnvelope>("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: t, history: history.slice(-10).map((m) => ({ role: m.role, content: m.content })), context: active.map(datasetToContext) }) });
      setMsgs([...history, { role: "user", content: t }, { role: "assistant", content: r.data.reply, model: r.data.model, used: r.meta.context_items_used }]);
      setLast(null);
    } catch (e) { setErr(e instanceof ApiError ? e : new ApiError("unknown", "Unexpected error.", 0)); setMsgs([...history, { role: "user", content: t }]); }
    finally { setBusy(false); }
  };
  const submit = () => { const t = input; setInput(""); void send(t, msgs); };
  const retry = () => { if (last) void send(last, msgs.slice(0, msgs.length && msgs[msgs.length - 1]!.role === "user" && msgs[msgs.length - 1]!.content === last ? -1 : undefined)); };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10 sm:px-10">
      <PageHeader icon={Bot} eyebrow="Module 10" title="AI Intelligence Assistant" description="Ask about what you have loaded in Project Acrux. The assistant only sees the labelled data you choose to share, and its answers are interpretation, not measurement." />
      {status.data && !configured && <div role="alert" className="rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm text-mute"><strong className="text-warn">The assistant is not configured.</strong> {!status.data.has_key ? "Set OPENROUTER_API_KEY" : "Set OPENROUTER_MODEL"} in .env and restart the backend (see Settings). The rest of Project Acrux works without it.</div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="flex min-h-[28rem] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
            {msgs.length === 0 && <div><p className="text-sm text-mute">Try a question:</p><ul className="mt-3 flex flex-wrap gap-2">{[...sets.map((d) => PER_DATASET[d.key]!), ...GENERAL].map((q) => <li key={q}><button type="button" disabled={!configured || busy} onClick={() => void send(q, msgs)} className="rounded-full border border-line px-3 py-1.5 text-left text-xs hover:border-signal disabled:opacity-50">{q}</button></li>)}</ul></div>}
            {msgs.map((m, i) => (<div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-xl bg-electric/15 p-3 text-sm" : "max-w-[92%] rounded-xl border border-line bg-panel p-3 text-sm"}>
              {m.role === "assistant" && <p className="mb-2 flex items-center gap-2"><Pill tone="warn">AI interpretation</Pill>{m.model && <span className="text-xs text-mute">{m.model}</span>}</p>}
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.used && m.used.length > 0 && <p className="mt-2 text-xs text-mute">Context used: {m.used.map((u) => `[${u.id}] ${u.label} (${u.kind}, ${u.source})`).join("; ")}</p>}
              {m.role === "assistant" && m.used?.length === 0 && <p className="mt-2 text-xs text-mute">No application data was shared with this answer.</p>}</div>))}
            {busy && <p role="status" className="animate-pulse text-sm text-mute">Thinking…</p>}
            {err && <div role="alert" className="rounded-lg border border-bad/40 bg-bad/5 p-3 text-sm"><p className="font-semibold text-bad">{errorTitle(err.kind)}</p><p className="mt-1 text-mute">{err.message}</p><Button className="mt-2" onClick={retry}><RefreshCw size={14} aria-hidden /> Retry</Button></div>}
            <div ref={end} /></div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label className="sr-only" htmlFor="chat-in">Message</label><input id="chat-in" value={input} maxLength={4000} onChange={(e) => setInput(e.target.value)} placeholder={configured ? "Ask a question…" : "Assistant not configured"} disabled={!configured} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
            <Button type="submit" variant="primary" disabled={!configured || busy || !input.trim()}><Send size={14} aria-hidden /> Send</Button></form></Card>
        <Card className="p-4"><SectionHeader title="Data shared as context" />
          {sets.length === 0 ? <p className="mt-3 text-sm text-mute">Nothing loaded yet. Open a module (e.g. Weather or Digital Twin) and its data will appear here for you to share.</p> : <ul className="mt-3 space-y-2">{sets.map((d) => <li key={d.key}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={use[d.key] !== false} onChange={(e) => setUse({ ...use, [d.key]: e.target.checked })} /><span><span className="font-medium">{REPORT_LABELS[d.key]}</span><span className="block text-xs text-mute">{d.simulated ? "Simulated · " : ""}{d.source} · {formatTimestamp(d.retrievedAt)}</span></span></label></li>)}</ul>}
          <p className="mt-4 text-xs text-mute">The backend (not your browser) calls OpenRouter. Shared data is sent to the model provider; your API key never leaves the backend. The assistant is told to treat this data as information only and to say when something is missing.</p>
          {msgs.length > 0 && <Button className="mt-3" variant="ghost" onClick={() => { setMsgs([]); setErr(null); setLast(null); }}>Clear conversation</Button>}</Card></div>
    </div>
  );
}
