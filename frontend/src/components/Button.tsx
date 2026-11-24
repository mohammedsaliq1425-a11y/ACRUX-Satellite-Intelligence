import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-electric text-white hover:bg-electric/90",
  secondary: "border border-line bg-panel text-ink hover:border-signal/60",
  ghost: "text-mute hover:bg-panel hover:text-ink",
};

export function Button({ variant = "secondary", className = "", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

export function ButtonLink({ to, variant = "secondary", children, className = "" }: {
  to: string; variant?: Variant; children: ReactNode; className?: string;
}) {
  return <Link to={to} className={`${base} ${variants[variant]} ${className}`}>{children}</Link>;
}
