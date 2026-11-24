import { Home as HomeIcon, Info, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MODULE_BY_ID } from "../features/modules/modules";

export interface NavItem { path: string; label: string; icon: LucideIcon }
export interface NavGroup { label: string; items: NavItem[] }

const m = (id: string): NavItem => {
  const mod = MODULE_BY_ID[id];
  if (!mod) throw new Error(`Unknown module id: ${id}`);
  return { path: mod.path, label: mod.navLabel, icon: mod.icon };
};

/** The 15 application pages, grouped. Every path here has a matching route in App.tsx. */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ path: "/", label: "Home", icon: HomeIcon }, m("mission-control")] },
  { label: "Earth", items: [m("earth-observation"), m("wildfire"), m("weather")] },
  { label: "Satellite systems", items: [m("communication"), m("navigation"), m("digital-twin")] },
  { label: "Space", items: [m("space-science"), m("space-objects")] },
  { label: "Intelligence", items: [m("multimodal"), m("assistant"), m("reports")] },
  { label: "Platform", items: [
    { path: "/settings", label: "Settings & Data Sources", icon: Settings },
    { path: "/about", label: "About Project Acrux", icon: Info },
  ] },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Breadcrumb trail for a pathname: Home / Group / Page. */
export function breadcrumbsFor(pathname: string): { label: string; to?: string }[] {
  if (pathname === "/") return [{ label: "Home" }];
  for (const g of NAV_GROUPS) {
    const item = g.items.find((i) => i.path === pathname);
    if (item) return [{ label: "Home", to: "/" }, { label: g.label }, { label: item.label }];
  }
  return [{ label: "Home", to: "/" }, { label: "Not found" }];
}
