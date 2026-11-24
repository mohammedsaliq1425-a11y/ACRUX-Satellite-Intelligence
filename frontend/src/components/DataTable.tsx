import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "./Button";

export interface Column<T> { key: string; label: string; value: (r: T) => string | number | null; render?: (r: T) => ReactNode; numeric?: boolean }

/** Sortable, filterable, paged table. Missing values sort last and render as an em dash. */
export function DataTable<T>({ rows, columns, rowKey, onSelect, selectedKey, pageSize = 12, caption, filterPlaceholder = "Filter rows…" }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onSelect?: (r: T) => void; selectedKey?: string | null;
  pageSize?: number; caption: string; filterPlaceholder?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let out = f ? rows.filter((r) => columns.some((c) => String(c.value(r) ?? "").toLowerCase().includes(f))) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) out = [...out].sort((a, b) => {
        const x = col.value(a), y = col.value(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
  }, [rows, columns, filter, sort]);

  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = view.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="sr-only" htmlFor={`f-${caption}`}>{filterPlaceholder}</label>
        <input id={`f-${caption}`} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} placeholder={filterPlaceholder}
          className="w-full max-w-xs rounded-lg border border-line bg-panel px-3 py-1.5 text-sm" />
        <p className="text-xs text-mute">{view.length} of {rows.length} rows</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-panel text-xs uppercase tracking-wide text-mute">
            <tr>{columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 ${c.numeric ? "text-right" : ""}`}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                  className="inline-flex items-center gap-1 uppercase hover:text-ink">
                  {c.label}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                </button>
              </th>))}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {slice.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-mute">No matching rows.</td></tr>}
            {slice.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} onClick={onSelect ? () => onSelect(r) : undefined}
                  className={`${onSelect ? "cursor-pointer hover:bg-panel/60" : ""} ${selectedKey === k ? "bg-electric/10" : ""}`}>
                  {columns.map((c) => {
                    const v = c.value(r);
                    return <td key={c.key} className={`px-3 py-2 ${c.numeric ? "text-right tabular-nums" : ""}`}>{c.render ? c.render(r) : v === null ? "—" : typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 3 }) : v}</td>;
                  })}
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-mute">
          <Button variant="ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Button>
          Page {cur + 1} / {pages}
          <Button variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
        </div>)}
    </div>
  );
}
