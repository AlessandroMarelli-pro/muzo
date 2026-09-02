import type { Track } from '@/__generated__/types';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { AudioQualityBadge } from '@/components/track/audio-quality-badge';
import { GenresBadge } from '@/components/track/genres-badge';
import { TrackMoreMenu } from '@/components/track/track-more-menu';
import { formatKey } from '@/components/track/track-feature-options';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiUrl } from '@/lib/api-config';
import { formatTime } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Heart, Music, Pause, Play } from 'lucide-react';

/** A favorite is a playlist entry, so carry the join row's `addedAt` alongside. */
export type FavoriteTrack = Track & { addedAt?: string | null };

interface BuildColumnsOptions {
  onTogglePlay: (track: Track) => void;
  onRemove: (track: Track) => void;
  currentTrackId?: string;
  isPlaying: boolean;
  isRemoving: boolean;
}

export function buildFavoritesColumns({
  onTogglePlay,
  onRemove,
  currentTrackId,
  isPlaying,
  isRemoving,
}: BuildColumnsOptions): ColumnDef<FavoriteTrack>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <div className="flex h-full items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all rows"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex h-full items-center justify-center">
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
      cell: ({ row }) =>
        row.original.imagePath ? (
          <img
            src={apiUrl(`/api/images/serve?imagePath=${row.original.imagePath}`)}
            alt=""
            className="h-9 w-9 rounded object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
            <Music className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
        ),
      enableSorting: false,
      enableHiding: false,
      size: 52,
    },
    {
      id: 'title',
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => (
        <div className="flex max-w-[240px] items-center gap-2">
          <span className="truncate font-medium capitalize" title={row.original.title ?? ''}>
            {row.original.title}
          </span>
          <AudioQualityBadge format={row.original.format} hqAudioPath={row.original.hqAudioPath} />
        </div>
      ),
    },
    {
      id: 'artist',
      accessorKey: 'artist',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Artist" />,
      cell: ({ row }) => (
        <div className="max-w-[180px] truncate capitalize" title={row.original.artist ?? ''}>
          {row.original.artist}
        </div>
      ),
    },
    {
      id: 'genres',
      accessorKey: 'genres',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Genre" />,
      cell: ({ row }) => (
        <GenresBadge genres={(row.original.genres as string[]) ?? []} variant="secondary" />
      ),
      enableSorting: false,
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
      size: 80,
    },
    {
      id: 'mfKey',
      accessorKey: 'mfKey',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key" />,
      cell: ({ row }) => (
        <Badge variant="outline" size="xs" className="font-mono">
          {formatKey(row.original.mfKey) ?? 'N/A'}
        </Badge>
      ),
    },
    {
      id: 'duration',
      accessorKey: 'duration',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Length" />,
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">{formatTime(row.original.duration ?? 0)}</div>
      ),
      size: 88,
    },
    {
      id: 'listeningCount',
      accessorKey: 'listeningCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Plays" />,
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {(row.original.listeningCount ?? 0).toLocaleString()}
        </div>
      ),
      size: 80,
    },
    {
      id: 'lastPlayedAt',
      accessorKey: 'lastPlayedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last played" />,
      cell: ({ row }) => {
        const value = row.original.lastPlayedAt;
        return (
          <div className="whitespace-nowrap text-right text-muted-foreground text-sm">
            {value ? format(new Date(value), 'MMM d, yyyy') : 'Never'}
          </div>
        );
      },
      size: 120,
    },
    {
      id: 'addedAt',
      accessorKey: 'addedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
      cell: ({ row }) => {
        const value = row.original.addedAt;
        return (
          <div className="whitespace-nowrap text-right text-muted-foreground text-sm">
            {value ? format(new Date(value), 'MMM d, yyyy') : '—'}
          </div>
        );
      },
      size: 120,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      size: 140,
      cell: ({ row }) => {
        const track = row.original;
        const isThisPlaying = currentTrackId === track.id && isPlaying;

        return (
          <div className="flex items-center justify-end gap-0.5">
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
              className="h-8 w-8"
              onClick={() => onRemove(track)}
              disabled={isRemoving}
              aria-label={`Remove ${track.title} from favorites`}
            >
              <Heart className="h-4 w-4 fill-red-500 text-red-500" aria-hidden />
            </Button>
            <TrackMoreMenu
              trackId={track.id}
              artist={track.artist || ''}
              title={track.title || ''}
              format={track.format}
              hqAudioPath={track.hqAudioPath}
              imagePath={track.imagePath}
            />
          </div>
        );
      },
    },
  ];
}
