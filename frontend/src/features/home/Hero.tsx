import { useMemo } from "react";
import { ChevronDown, Rocket } from "lucide-react";
import { Button, ButtonLink } from "../../components/Button";

/** Deterministic sparse star field (no random per-render flicker). */
function useStars(count: number) {
  return useMemo(() => {
    let seed = 20260612;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Array.from({ length: count }, () => ({ x: rnd() * 1200, y: rnd() * 640, r: 0.5 + rnd() * 1.1, o: 0.25 + rnd() * 0.6 }));
  }, [count]);
}

/** Stylised Earth limb with atmospheric glow. This is an illustration, not imagery. */
function EarthIllustration() {
  const stars = useStars(46);
  return (
    <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="ocean" cx="34%" cy="30%" r="80%">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="0.45" stopColor="#12306B" />
          <stop offset="1" stopColor="#050B1B" />
        </radialGradient>
        <linearGradient id="night" x1="0.2" y1="0" x2="1" y2="0.9">
          <stop offset="0.35" stopColor="#060B18" stopOpacity="0" />
          <stop offset="1" stopColor="#060B18" stopOpacity="0.88" />
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14" /></filter>
        <clipPath id="disc"><circle cx="940" cy="640" r="420" /></clipPath>
      </defs>
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#E8EEF8" opacity={s.o} />)}
      <circle cx="940" cy="640" r="436" fill="none" stroke="#22D3EE" strokeOpacity="0.55" strokeWidth="14" filter="url(#glow)" />
      <circle cx="940" cy="640" r="420" fill="url(#ocean)" />
      <g clipPath="url(#disc)"><rect x="500" y="200" width="900" height="500" fill="url(#night)" /></g>
      <circle cx="940" cy="640" r="421" fill="none" stroke="#7DD3FC" strokeOpacity="0.5" strokeWidth="1.5" />
      <ellipse cx="900" cy="300" rx="560" ry="130" fill="none" stroke="#22D3EE" strokeOpacity="0.35" strokeWidth="1.2" transform="rotate(-16 900 300)" />
      <g transform="translate(497 177) rotate(-16)">
        <rect x="-9" y="-4" width="18" height="8" rx="1.5" fill="#E8EEF8" />
        <rect x="-26" y="-3" width="14" height="6" fill="#3B82F6" />
        <rect x="12" y="-3" width="14" height="6" fill="#3B82F6" />
      </g>
    </svg>
  );
}

export function Hero({ onDiscover }: { onDiscover: () => void }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-line bg-midnight">
      <EarthIllustration />
      <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/70 to-transparent" aria-hidden />
      <div className="relative mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-center px-6 py-20 sm:px-10 lg:min-h-[38rem]">
        <p className="eyebrow">Integrated Satellite Intelligence Platform</p>
        <h1 id="hero-title" className="mt-4 text-5xl font-semibold tracking-[0.28em] sm:text-7xl">ACRUX</h1>
        <p className="mt-5 text-xl font-medium text-ink sm:text-2xl">Observe Earth. Understand Space. Predict the Future.</p>
        <p className="mt-5 max-w-xl leading-relaxed text-mute">
          One integrated platform for exploring Earth observation, environmental intelligence, satellite systems,
          and space science through geospatial data, scientific visualization, and AI-assisted analysis.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/mission-control" variant="primary"><Rocket size={16} aria-hidden /> Explore Mission Control</ButtonLink>
          <Button variant="secondary" onClick={onDiscover}><ChevronDown size={16} aria-hidden /> Discover Intelligence Modules</Button>
        </div>
        <p className="absolute bottom-4 left-6 text-[11px] text-mute sm:left-10">Stylised illustration — not satellite imagery.</p>
      </div>
    </section>
  );
}
