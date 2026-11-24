import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { NAV_GROUPS } from "../app/navigation";
import { Wordmark } from "../components/Logo";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        id="primary-navigation"
        aria-label="Primary"
        className={`print:hidden fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 lg:w-64 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/" onClick={onClose} aria-label="ACRUX home"><Wordmark /></NavLink>
          <button type="button" onClick={onClose} aria-label="Close navigation"
            className="rounded-md p-1.5 text-mute hover:bg-panel hover:text-ink lg:hidden">
            <X size={18} aria-hidden />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-5 first:mt-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">{group.label}</p>
              <ul className="mt-2 space-y-0.5">
                {group.items.map(({ path, label, icon: Icon }) => (
                  <li key={path}>
                    <NavLink
                      to={path}
                      end={path === "/"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-electric/15 font-semibold text-ink ring-1 ring-inset ring-electric/40"
                            : "text-mute hover:bg-panel hover:text-ink"}`}
                    >
                      <Icon size={17} aria-hidden />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="border-t border-line px-5 py-3 text-[11px] leading-snug text-mute">
          Local development build. Not an operational system.
        </p>
      </aside>
    </>
  );
}
