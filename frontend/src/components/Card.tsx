import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionHeader({ eyebrow, title, description, id }: {
  eyebrow?: string; title: string; description?: string; id?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id} className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 text-mute leading-relaxed">{description}</p>}
    </div>
  );
}
