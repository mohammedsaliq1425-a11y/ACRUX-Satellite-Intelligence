export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <ellipse cx="32" cy="32" rx="24" ry="9" fill="none" stroke="rgb(var(--c-signal))" strokeWidth="3" transform="rotate(-28 32 32)" />
      <circle cx="32" cy="32" r="10" fill="rgb(var(--c-electric))" />
      <circle cx="53" cy="22" r="3.5" fill="rgb(var(--c-ink))" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-3">
      <LogoMark />
      <span className="text-lg font-semibold tracking-[0.32em]">ACRUX</span>
    </span>
  );
}
