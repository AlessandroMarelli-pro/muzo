import type { Track } from '@/__generated__/types';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { AudioQualityBadge } from '@/components/track/audio-quality-badge';
import { GenresBadge } from '@/components/track/genres-badge';
import { TrackMoreMenu } from '@/components/track/track-more-menu';
import {
  arousalMoodOptions,
  danceabilityFeelingOptions,
  findFeatureLabel,
  valenceMoodOptions,
} from '@/components/track/track-feature-options';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiUrl } from '@/lib/api-config';
import type { ColumnDef } from '@tanstack/react-table';
import { Flame, Music, Pause, Play, ThumbsDown, ThumbsUp } from 'lucide-react';

export type RatingKind = 'like' | 'dislike' | 'banger';

interface BuildColumnsOptions {
  onRate: (trackId: string, kind: RatingKind) => void;
  onTogglePlay: (track: Track) => void;
  currentTrackId?: string;
  isPlaying: boolean;
  isRating: boolean;
}

const TrackArtwork = ({ track }: { track: Track }) => {
  if (!track.imagePath) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
        <Music className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={apiUrl(`/api/images/serve?imagePath=${track.imagePath}`)}
      alt=""
      loading="lazy"
      className="aspect-square h-9 w-9 shrink-0 rounded object-cover"
    />
  );
};

/**
 * Columns for the pending triage queue. Deliberately narrower than the Music
 * table: only the fields you need to decide whether a track is worth keeping.
 */
export function buildPendingColumns({
  onRate,
  onTogglePlay,
  currentTrackId,
  isPlaying,
  isRating,
}: BuildColumnsOptions): ColumnDef<Track>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        // Stop propagation so ticking the box doesn't also move the preview focus.
        <div onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.title ?? 'track'}`}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
    },
    {
      id: 'cover',
      accessorKey: 'imagePath',
      header: () => null,
      cell: ({ row }) => <TrackArtwork track={row.original} />,
      enableSorting: false,
      enableHiding: false,
      size: 52,
    },
    {
      id: 'title',
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium capitalize" title={row.original.title ?? ''}>
            {row.original.title}
          </span>
          <AudioQualityBadge format={row.original.format} hqAudioPath={row.original.hqAudioPath} />
        </div>
      ),
      meta: { label: 'Title' },
      size: 320,
    },
    {
      id: 'artist',
      accessorKey: 'artist',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Artist" />,
      cell: ({ row }) => (
        <div className="min-w-0 truncate capitalize" title={row.original.artist ?? ''}>
          {row.original.artist}
        </div>
      ),
      meta: { label: 'Artist' },
      size: 230,
    },
    {
      id: 'genres',
      accessorKey: 'genres',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Genre" />,
      cell: ({ row }) => (
        <GenresBadge genres={(row.original.genres as string[]) ?? []} variant="secondary" />
      ),
      meta: { label: 'Genre' },
      size: 140,
    },
    {
      id: 'mfTempo',
      accessorKey: 'mfTempo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="BPM" />,
      cell: ({ row }) => {
        const tempo = row.original.mfTempo;
        return (
          <div className="text-right font-mono text-sm">
            {typeof tempo === 'number' && tempo > 0 ? Math.round(tempo) : '—'}
          </div>
        );
      },
      meta: { label: 'BPM' },
      size: 80,
    },
    {
      id: 'mfDanceabilityFeeling',
      accessorKey: 'mfDanceabilityFeeling',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Danceability" />,
      cell: ({ row }) => (
        <Badge variant="outline" size="xs" className="font-mono">
          {findFeatureLabel(danceabilityFeelingOptions, row.original.mfDanceabilityFeeling) ??
            'N/A'}
        </Badge>
      ),
      meta: { label: 'Danceability' },
    },
    {
      id: 'mfArousalMood',
      accessorKey: 'mfArousalMood',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Energy" />,
      cell: ({ row }) => (
        <Badge variant="outline" size="xs" className="font-mono">
          {findFeatureLabel(arousalMoodOptions, row.original.mfArousalMood) ?? 'N/A'}
        </Badge>
      ),
      meta: { label: 'Energy' },
    },
    {
      id: 'mfValenceMood',
      accessorKey: 'mfValenceMood',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mood" />,
      cell: ({ row }) => (
        <Badge variant="outline" size="xs" className="font-mono">
          {findFeatureLabel(valenceMoodOptions, row.original.mfValenceMood) ?? 'N/A'}
        </Badge>
      ),
      meta: { label: 'Mood' },
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      size: 190,
      cell: ({ row }) => {
        const track = row.original;
        const isThisPlaying = currentTrackId === track.id && isPlaying;

        return (
          // Actions handle their own intent; don't let clicks re-focus the row.
          <div
            className="flex items-center justify-end gap-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onTogglePlay(track)}
              aria-label={isThisPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
            >
              {isThisPlaying ? (
                <Pause className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onRate(track.id, 'dislike')}
              disabled={isRating}
              aria-label={`Dislike ${track.title}`}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-orange-500"
              onClick={() => onRate(track.id, 'banger')}
              disabled={isRating}
              aria-label={`Mark ${track.title} as banger`}
            >
              <Flame className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onRate(track.id, 'like')}
              disabled={isRating}
              aria-label={`Like ${track.title}`}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden />
            </Button>
            <TrackMoreMenu
              trackId={track.id}
              artist={track.artist || ''}
              title={track.title || ''}
              format={track.format}
              hqAudioPath={track.hqAudioPath}
            />
          </div>
        );
      },
    },
  ];
}
