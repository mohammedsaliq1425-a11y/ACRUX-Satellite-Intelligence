import { useEffect, useState } from "react";

const input = "mt-1.5 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm aria-[invalid=true]:border-bad";

/** Numeric input that lets the user type freely and reports null while the text is not a valid number. */
export function NumberField({ label, value, onChange, min, max, step = "any", unit, hint, error }: {
  label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number | "any"; unit?: string; hint?: string; error?: string | null;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => { setText((t) => (Number(t) === value ? t : value === null ? "" : String(value))); }, [value]);
  const id = `nf-${label.replace(/\W+/g, "-")}`;
  const bad = error ?? (value !== null && ((min !== undefined && value < min) || (max !== undefined && value > max)) ? `Must be between ${min ?? "−∞"} and ${max ?? "∞"}` : null);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}{unit && <span className="text-mute"> ({unit})</span>}</label>
      <input id={id} inputMode="decimal" type="number" min={min} max={max} step={step} value={text} aria-invalid={!!bad} aria-describedby={`${id}-m`}
        onChange={(e) => { setText(e.target.value); const n = e.target.value.trim() === "" ? null : Number(e.target.value); onChange(n !== null && Number.isFinite(n) ? n : null); }} className={input} />
      <p id={`${id}-m`} className={`mt-1 text-xs ${bad ? "text-bad" : "text-mute"}`}>{bad ?? hint ?? "\u00a0"}</p>
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = `sf-${label.replace(/\W+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={input}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, maxLength = 100, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; type?: string }) {
  const id = `tf-${label.replace(/\W+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input id={id} type={type} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={input} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === t.id ? "bg-electric text-white" : "text-mute hover:text-ink"}`}>{t.label}</button>))}
    </div>
  );
}
