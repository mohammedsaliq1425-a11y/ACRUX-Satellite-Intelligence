export type Cell = string | number | boolean | null | undefined;

/** Spreadsheet apps execute cells that start with = + - @ — neutralise text cells (numbers are left alone). */
function safe(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v);
  const guarded = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(columns: string[], rows: Cell[][]): string {
  return [columns.map(safe).join(","), ...rows.map((r) => r.map(safe).join(","))].join("\n") + "\n";
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
