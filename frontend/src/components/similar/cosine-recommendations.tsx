import { Badge } from "@/components/ui/badge";
import { capitalizeEveryWord, cn, formatSimilarity } from "@/lib/utils";
import {
  type CosineRecommendedTrack,
  useCosineRecommendationsForTrack,
} from "@/services/playlist-hooks";
import { ExternalLink, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NoData } from "../no-data";
import { Skeleton } from "../ui/skeleton";

const HOVER_PREVIEW_DELAY_MS = 100;

/** Mirrors REC_GRID in track-recommendations-card.tsx so the Cosine tab reads
 * as the same ledger, not a second layout language. */
const COSINE_GRID =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-l-transparent pl-3 pr-3";

function CosineRecommendationRow({ track }: { track: CosineRecommendedTrack }) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const startPreview = () => {
    if (!track.videoId) return;
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(
      () => setIsPreviewing(true),
      HOVER_PREVIEW_DELAY_MS,
    );
  };

  const stopPreview = () => {
    clearHoverTimeout();
    setIsPreviewing(false);
  };

  useEffect(() => clearHoverTimeout, []);

  const artist = capitalizeEveryWord(track.artist);
  const title = capitalizeEveryWord(track.title);
  const label = `${artist} — ${title}`;

  return (
    <div
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      tabIndex={track.videoId ? 0 : undefined}
      role={track.videoId ? "button" : undefined}
      aria-label={track.videoId ? `Preview ${label}` : undefined}
      className={cn(
        COSINE_GRID,
        "group border-b py-2 transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
      )}
    >
      <div
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted",
          !track.videoId && "opacity-60",
        )}
      >
        {isPreviewing && track.videoId ? (
          <iframe
            className="pointer-events-none h-full w-full"
            src={`https://www.youtube.com/embed/${track.videoId}?autoplay=1&controls=0`}
            title={label}
            allow="accelerometer; autoplay; encrypted-media; gyroscope"
          />
        ) : track.videoId ? (
          <>
            <img
              src={`https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40 group-focus-within:bg-black/40">
              <Play className="h-3.5 w-3.5 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
            </div>
          </>
        ) : (
          <span className="sr-only">No video match</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="truncate">{artist}</span>
          <span className="shrink-0 text-border">·</span>
          <span className="shrink-0 italic">{formatSimilarity(track.score)} match</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {formatSimilarity(track.score)}
        </Badge>
        {track.externalLink && (
          <a
            href={track.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`View source for ${label}`}
            title="View source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function CosineRecommendationRowSkeleton() {
  return (
    <div className={cn(COSINE_GRID, "py-2.5")}>
      <Skeleton className="h-9 w-9 rounded" />
      <div className="min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-12 justify-self-end" />
    </div>
  );
}

interface CosineRecommendationsProps {
  trackId?: string;
}

export function CosineRecommendations({ trackId }: CosineRecommendationsProps) {
  const { tracks, isLoading, error, refetch } =
    useCosineRecommendationsForTrack(trackId);

  if (error) {
    return (
      <NoData
        Icon={ExternalLink}
        title="Couldn't load recommendations"
        subtitle={error}
        buttonAction={refetch}
        buttonLabel="Try again"
      />
    );
  }

  if (isLoading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <CosineRecommendationRowSkeleton key={`cosine-recommendation-skeleton-${i}`} />
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No Cosine recommendations found for this track.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {tracks.map((track) => (
        <CosineRecommendationRow key={`${track.artist}::${track.title}`} track={track} />
      ))}
    </div>
  );
}
