import { RailLabel } from '@/components/layout/rail-label';
import { apiUrl } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import { playlistsQueryOptions } from '@/services/playlist-hooks';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

function coverUrl(imagePath: string) {
  return apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`);
}

/** One 40px crate cover: a 2×2 mosaic when four images exist, one image when
 *  fewer, a periwinkle monogram tile when none. */
function CrateCover({ name, images }: { name: string; images: string[] }) {
  const initial = name.trim().charAt(0).toUpperCase() || '♪';

  if (images.length >= 4) {
    return (
      <span className="grid size-10 grid-cols-2 grid-rows-2 overflow-hidden rounded-lg shadow-sm">
        {images.slice(0, 4).map((image, i) => (
          <img
            key={i}
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
        className="size-10 rounded-lg object-cover shadow-sm"
      />
    );
  }

  return (
    <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sm font-semibold text-sidebar-primary shadow-sm">
      {initial}
    </span>
  );
}

/**
 * The crate strip — the DJ's playlists filed as cover art directly below the
 * nav, scrolling to the bottom of the rail with a soft fade at each edge.
 * Clicking a cover opens that crate.
 */
export function CrateStrip() {
  const { data: playlists = [] } = useQuery({
    ...playlistsQueryOptions(),
    staleTime: 60_000,
  });

  if (playlists.length === 0) return null;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-3',
        'no-scrollbar',
        '[mask-image:linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]',
      )}
    >
      {playlists.map((playlist) => (
        <RailLabel key={playlist.id} label={playlist.name}>
          <Link
            to="/playlists/$playlistId"
            params={{ playlistId: playlist.id }}
            aria-label={playlist.name}
            className="shrink-0 rounded-lg outline-none ring-sidebar-ring ring-offset-2 ring-offset-sidebar transition-transform duration-150 hover:scale-105 focus-visible:ring-2"
          >
            <CrateCover name={playlist.name} images={playlist.stats?.images ?? []} />
          </Link>
        </RailLabel>
      ))}
    </div>
  );
}
