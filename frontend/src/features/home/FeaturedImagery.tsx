import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { KindBadge } from "../../components/Badges";
import { SectionHeader } from "../../components/Card";
import { DataState } from "../../components/DataState";
import { useApi } from "../../hooks/useApi";
import type { Envelope, NasaImage } from "../../types/api";
import { formatTimestamp } from "../../utils/format";

const PATH = "/api/space/images?q=earth%20from%20space&page_size=8";

function Tile({ img }: { img: NasaImage }) {
  const [failed, setFailed] = useState(false);
  if (!img.preview_url || failed) return null;      // never show a broken image
  const credit = [img.photographer, img.secondary_creator, img.center].filter(Boolean).join(" · ");
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="aspect-[4/3] bg-panel">
        <img src={img.preview_url} alt={img.title ?? "NASA image"} loading="lazy" onError={() => setFailed(true)}
          className="h-full w-full object-cover" />
      </div>
      <figcaption className="p-3 text-xs">
        <p className="line-clamp-2 font-medium text-ink">{img.title ?? "Untitled"}</p>
        <p className="mt-1 text-mute">{credit || "NASA"}{img.date_created ? ` · ${formatTimestamp(img.date_created)}` : ""}</p>
        {img.nasa_id && (
          <a className="mt-1 inline-flex items-center gap-1 text-electric hover:text-signal" target="_blank" rel="noreferrer"
            href={`https://images.nasa.gov/details/${encodeURIComponent(img.nasa_id)}`}>
            Source <ExternalLink size={11} aria-hidden />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/** Real NASA catalogue imagery, fetched via the backend. Shows an honest state if unavailable. */
export function FeaturedImagery() {
  const { data, error, loading, reload } = useApi<Envelope<NasaImage[]>>(PATH);
  const images = (data?.data ?? []).filter((i) => i.preview_url).slice(0, 4);

  return (
    <section aria-labelledby="imagery-title" className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
      <SectionHeader id="imagery-title" eyebrow="Featured Earth observation imagery" title="Earth, as NASA publishes it"
        description="Results from the NASA Image and Video Library. These are catalogue images and illustrations, not a live view of any location." />
      <div className="mt-8">
        <DataState loading={loading} error={error} onRetry={reload} empty={!!data && images.length === 0}
          emptyMessage="The NASA image library returned no previewable images for this search." loadingLabel="Loading NASA imagery">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{images.map((i) => <Tile key={i.nasa_id ?? i.preview_url} img={i} />)}</div>
          {data && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mute">
              <KindBadge kind={data.meta.kind} />
              Source: {data.meta.source} · retrieved {formatTimestamp(data.meta.retrieved_at)}{data.meta.cached ? " (cached)" : ""}.
              Credit the creators shown; some items carry usage restrictions.
            </p>
          )}
        </DataState>
      </div>
    </section>
  );
}
