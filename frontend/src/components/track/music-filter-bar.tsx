import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Sparkles } from 'lucide-react';
import { TrackFilterBar } from './track-filter-bar';

interface MusicFilterBarProps {
  reviewMode: boolean;
  pendingCount: number;
  onReviewChange: (next: boolean) => void;
  /** Live count of tracks matching the current filters, shown next to the toolbar. */
  matchCount?: number;
}

/**
 * The filter toolbar for the Music view: every filterable facet plus a
 * "Needs review" toggle that swaps the list to tracks still awaiting
 * analysis. In review mode the facets are hidden — they don't apply to the
 * pending query.
 */
export function MusicFilterBar({
  reviewMode,
  pendingCount,
  onReviewChange,
  matchCount,
}: MusicFilterBarProps) {
  const reviewToggle = (pendingCount > 0 || reviewMode) && (
    <Toggle
      pressed={reviewMode}
      onPressedChange={onReviewChange}
      variant="outline"
      size="sm"
      className="gap-1.5"
      aria-label="Show only tracks that need review"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Needs review
      {pendingCount > 0 && (
        <Badge variant="secondary" size="xs" className="rounded-full px-1.5 font-normal">
          {pendingCount.toLocaleString()}
        </Badge>
      )}
    </Toggle>
  );

  if (reviewMode) {
    return <div className="flex flex-wrap items-center gap-2">{reviewToggle}</div>;
  }

  return <TrackFilterBar matchCount={matchCount} trailing={reviewToggle} />;
}
