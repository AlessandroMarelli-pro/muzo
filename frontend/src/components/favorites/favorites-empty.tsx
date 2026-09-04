import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Heart, SearchX } from 'lucide-react';

/**
 * First-run state: no favorites at all. Built with the app's own tokens — a
 * ghost heart on a muted tile, not the saturated `bg-primary` circle `NoData`
 * hardcodes.
 */
export function FavoritesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <Heart className="size-9 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-base">Nothing loved yet</h3>
        <p className="max-w-xs text-muted-foreground text-sm">
          Heart tracks while you dig — from Swipe or anywhere in your library — and they line up
          here.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/music">Browse the library</Link>
        </Button>
        <Button asChild variant="link">
          <Link to="/swipe">or triage in Swipe</Link>
        </Button>
      </div>
    </div>
  );
}

/** Search returned nothing. */
export function FavoritesNoMatches({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-9 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-base">No favorites match “{query}”</h3>
        <p className="max-w-xs text-muted-foreground text-sm">
          Try a different title, artist, or genre.
        </p>
      </div>
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}
