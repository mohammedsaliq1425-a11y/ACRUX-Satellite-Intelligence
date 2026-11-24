import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Menu } from "lucide-react";
import { breadcrumbsFor } from "../app/navigation";
import { useBackendHealth } from "../hooks/useBackendHealth";
import type { BackendState } from "../hooks/useBackendHealth";

const BACKEND: Record<BackendState, { label: string; dot: string }> = {
  checking: { label: "Checking backend…", dot: "bg-mute" },
  online: { label: "Backend online", dot: "bg-ok" },
  offline: { label: "Backend offline", dot: "bg-bad" },
};

export function Topbar({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const { pathname } = useLocation();
  const crumbs = breadcrumbsFor(pathname);
  const backend = BACKEND[useBackendHealth()];

  return (
    <header className="print:hidden sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-midnight/85 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open navigation" aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        className="rounded-md p-2 text-mute hover:bg-panel hover:text-ink lg:hidden">
        <Menu size={20} aria-hidden />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm text-mute">
          {crumbs.map((c, i) => (
            <li key={`${c.label}-${i}`} className={`flex items-center gap-1.5 ${i < crumbs.length - 1 && crumbs.length > 2 && i > 0 ? "hidden sm:flex" : ""}`}>
              {i > 0 && <ChevronRight size={14} aria-hidden />}
              {c.to ? <Link to={c.to} className="hover:text-ink">{c.label}</Link>
                : <span className={i === crumbs.length - 1 ? "truncate font-medium text-ink" : ""} aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
            </li>
          ))}
        </ol>
      </nav>

      <span role="status" className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-mute">
        <span aria-hidden className={`h-2 w-2 rounded-full ${backend.dot}`} />
        <span className="hidden sm:inline">{backend.label}</span>
        <span className="sm:hidden sr-only">{backend.label}</span>
      </span>
    </header>
  );
}
