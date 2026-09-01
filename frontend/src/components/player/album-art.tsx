import { apiUrl } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import { Disc3 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AlbumArtProps {
  /** Raw image path from the track. May contain spaces, `&`, non-ASCII. */
  imagePath?: string | null;
  /** For the alt text / screen readers. */
  title?: string | null;
  artist?: string | null;
  className?: string;
  /** Decorative use (blurred backdrop) — hidden from assistive tech. */
  decorative?: boolean;
}

/**
 * The one place album art is loaded in the player. Encodes the path properly,
 * and falls back to a branded periwinkle disc when there is no art or the
 * request fails — never a broken-image glyph, because the art is the hero.
 */
export function AlbumArt({
  imagePath,
  title,
  artist,
  className,
  decorative = false,
}: AlbumArtProps) {
  const [failed, setFailed] = useState(false);

  // Reset the error state when the source changes.
  useEffect(() => setFailed(false), [imagePath]);

  const showPlaceholder = !imagePath || failed;

  if (showPlaceholder) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-primary/40',
          className,
        )}
        aria-hidden={decorative || undefined}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : 'No album art'}
      >
        <Disc3 className="h-1/2 w-1/2" strokeWidth={1.25} aria-hidden />
      </div>
    );
  }

  const alt = decorative
    ? ''
    : title
      ? `${title}${artist ? ` by ${artist}` : ''} — album art`
      : 'Album art';

  return (
    <img
      src={apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`)}
      alt={alt}
      aria-hidden={decorative || undefined}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
