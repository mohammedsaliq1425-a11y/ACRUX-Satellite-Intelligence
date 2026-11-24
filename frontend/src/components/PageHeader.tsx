import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, eyebrow, title, description, actions }: {
  icon?: LucideIcon; eyebrow?: string; title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
      <div className="flex items-start gap-4">
        {Icon && (
          <span className="mt-1 hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-panel text-signal sm:grid">
            <Icon size={22} aria-hidden />
          </span>
        )}
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 max-w-3xl text-mute leading-relaxed">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}
