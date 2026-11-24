import { Link } from "react-router-dom";
import { Hero } from "../features/home/Hero";
import { ModuleGrid } from "../features/home/ModuleGrid";
import { Workflow } from "../features/home/Workflow";
import { FeaturedImagery } from "../features/home/FeaturedImagery";
import { Highlights } from "../features/home/Highlights";
import { TwinPreview } from "../features/home/TwinPreview";
import { DataSourceOverview } from "../features/home/DataSourceOverview";
import { ButtonLink } from "../components/Button";

export default function Home() {
  const scrollToModules = () => document.getElementById("modules")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <>
      <Hero onDiscover={scrollToModules} />
      <ModuleGrid />
      <Workflow />
      <FeaturedImagery />
      <Highlights />
      <TwinPreview />
      <DataSourceOverview />
      <section aria-labelledby="cta-title" className="border-t border-line bg-surface/60">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:px-10">
          <h2 id="cta-title" className="text-3xl font-semibold">Start with the big picture</h2>
          <p className="mt-4 text-mute">Open Mission Control for a single view of every module, or read how Project Acrux separates observations, derived results and simulations.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/mission-control" variant="primary">Explore Mission Control</ButtonLink>
            <ButtonLink to="/about">About Project Acrux</ButtonLink>
          </div>
          <p className="mt-6 text-xs text-mute">Running locally. <Link to="/settings" className="text-electric hover:text-signal">Check data-source status</Link>.</p>
        </div>
      </section>
    </>
  );
}
