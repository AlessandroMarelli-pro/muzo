import type { Playlist } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiUrl } from '@/lib/api-config';
import { capitalizeEveryWord, formatCoarseDuration } from '@/lib/utils';
import { Heart } from 'lucide-react';

function coverUrl(imagePath: string) {
  return apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`);
}

/**
 * The favorites art plate — a 2×2 mosaic when four covers exist, a single cover
 * when fewer, a spot-blue heart tile when none. Mirrors the crate-cover ladder
 * in the sidebar (`crate-strip.tsx`), scaled up to masthead size.
 */
function FavoritesPlate({ images }: { images: string[] }) {
  if (images.length >= 4) {
    return (
      <span className="grid size-16 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-md shadow-sm">
        {images.slice(0, 4).map((image, index) => (
          <img
            key={index}
            src={coverUrl(image)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ))}
      </span>
    );
  }

  if (images.length >= 1) {
    return (
      <img
        src={coverUrl(images[0])}
        alt=""
        loading="lazy"
        className="size-16 shrink-0 rounded-md object-cover shadow-sm"
      />
    );
  }

  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
      <Heart className="size-6" aria-hidden />
    </span>
  );
}

interface FavoritesMastheadProps {
  playlist: Playlist;
  /** Live filtered count, so the meta line tracks the search. */
  shownCount: number;
  totalCount: number;
}

/**
 * Cue-Sheet masthead for the loved shelf: art plate, title, a stamped mono meta
 * line off `playlist.stats`, and up to three top-genre chips, closed by a
 * hairline rule — the same shape as the playlist-detail set sheet.
 */
export function FavoritesMasthead({ playlist, shownCount, totalCount }: FavoritesMastheadProps) {
  const stats = playlist.stats;
  const images = stats?.images ?? [];
  const topGenres = (stats?.topGenres ?? []).filter(Boolean).slice(0, 3);

  const countLabel =
    shownCount === totalCount
      ? `${totalCount} loved`
      : `${shownCount} of ${totalCount} loved`;

  const meta = [
    countLabel,
    stats?.totalDuration ? formatCoarseDuration(stats.totalDuration) : null,
    stats?.bpmRange?.min != null && stats?.bpmRange?.max != null
      ? `${stats.bpmRange.min}–${stats.bpmRange.max} BPM`
      : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <div className="flex items-start gap-4 border-b pb-4">
      <FavoritesPlate images={images} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <h1 className="text-2xl font-bold leading-tight">Favorites</h1>
        <p className="font-mono text-muted-foreground text-xs uppercase [letter-spacing:0.04em]">
          {meta}
        </p>
        {topGenres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {topGenres.map((genre) => (
              <Badge key={genre} variant="secondary" size="xs" className="capitalize">
                {capitalizeEveryWord(genre)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FavoritesMastheadSkeleton() {
  return (
    <div className="flex items-start gap-4 border-b pb-4">
      <Skeleton className="size-16 shrink-0 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
