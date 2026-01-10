'use client';

import { SimpleMusicTrack } from '@/__generated__/types';
import { SelectPlaylistDialog } from '@/components/playlist/select-playlist-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Brain, Heart, MoreHorizontal, Pause, Play } from 'lucide-react';
import * as React from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableSortList } from '@/components/data-table/data-table-sort-list';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import {
  useAudioPlayerActions,
  useCurrentTrack,
} from '@/contexts/audio-player-context';
import { useDataTable } from '@/hooks/use-data-table';
import { AudioPlayerActions } from '@/hooks/useAudioPlayer';
import { StaticFilterOptionsData } from '@/hooks/useFilterOptions';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';

interface MusicTableProps {
  data: SimpleMusicTrack[];
  pageCount: number;
  onAddToQueue?: (tracks: SimpleMusicTrack[]) => void;
  setCurrentTrack: (track: SimpleMusicTrack) => void;
  actions: AudioPlayerActions;
  isLoading?: boolean;
  staticFilterOptions: StaticFilterOptionsData;
  initialPageSize?: number;
  playingTrackId?: string;
}
const danceabilityFeelingOptions = [
  { label: 'Highly Danceable', value: 'highly-danceable' },
  { label: 'Danceable', value: 'danceable' },
  { label: 'Moderately Danceable', value: 'moderately-danceable' },
  { label: 'Slightly Danceable', value: 'slightly-danceable' },
  { label: 'Minimally Danceable', value: 'minimally-danceable' },
  { label: 'Ambient', value: 'ambient' },
  { label: 'Experimental', value: 'experimental' },
];
const arousalMoodOptions = [
  { label: 'Very Calm', value: 'very calm' },
  { label: 'Calm', value: 'calm' },
  { label: 'Moderate Energy', value: 'moderate energy' },
  { label: 'Energetic', value: 'energetic' },
  { label: 'Very Energetic', value: 'very energetic' },
];
const valenceMoodOptions = [
  { label: 'Very Positive', value: 'very positive' },
  { label: 'Positive', value: 'positive' },
  { label: 'Neutral', value: 'neutral' },
  { label: 'Negative', value: 'negative' },
  { label: 'Very Negative', value: 'very negative' },
];

const CamelotKeyOptions = [
  // Major keys (inner circle)
  { label: 'C major', value: '8B', color: 'rgba(221, 160, 221,0.5)' }, // Plum/Lavender
  { label: 'G major', value: '9B', color: 'rgba(128, 0, 128,0.5)' }, // Purple
  { label: 'D major', value: '10B', color: 'rgba(0, 0, 139,0.5)' }, // Dark Blue
  { label: 'A major', value: '11B', color: 'rgba(0, 0, 255,0.5)' }, // Blue
  { label: 'E major', value: '12B', color: 'rgba(0, 128, 128,0.5)' }, // Teal
  { label: 'B major', value: '1B', color: 'rgba(0, 255, 255,0.5)' }, // Cyan
  { label: 'F# major', value: '2B', color: 'rgba(144, 238, 144,0.5)' }, // Light Green
  { label: 'C# major', value: '3B', color: 'rgba(0, 128, 0,0.5)' }, // Green
  { label: 'G# major', value: '4B', color: 'rgba(255, 215, 0,0.5)' }, // Gold
  { label: 'D# major', value: '5B', color: 'rgba(255, 165, 0,0.5)' }, // Orange
  { label: 'A# major', value: '6B', color: 'rgba(255, 69, 0,0.5)' }, // Orange Red
  { label: 'F major', value: '7B', color: 'rgba(255, 20, 147,0.5)' }, // Deep Pink
  // Minor keys (outer circle)
  { label: 'A minor', value: '8A', color: 'rgba(221, 160, 221,0.5)' }, // Plum/Lavender
  { label: 'E minor', value: '9A', color: 'rgba(128, 0, 128,0.5)' }, // Purple
  { label: 'B minor', value: '10A', color: 'rgba(0, 0, 139,0.5)' }, // Dark Blue
  { label: 'F# minor', value: '11A', color: 'rgba(0, 0, 255,0.5)' }, // Blue
  { label: 'C# minor', value: '12A', color: 'rgba(0, 128, 128,0.5)' }, // Teal
  { label: 'G# minor', value: '1A', color: 'rgba(0, 255, 255,0.5)' }, // Cyan
  { label: 'D# minor', value: '2A', color: 'rgba(144, 238, 144,0.5)' }, // Light Green
  { label: 'A# minor', value: '3A', color: 'rgba(0, 128, 0,0.5)' }, // Green
  { label: 'F minor', value: '4A', color: 'rgba(255, 215, 0,0.5)' }, // Gold
  { label: 'C minor', value: '5A', color: 'rgba(255, 165, 0,0.5)' }, // Orange
  { label: 'G minor', value: '6A', color: 'rgba(255, 69, 0,0.5)' }, // Orange Red
  { label: 'D minor', value: '7A', color: 'rgba(255, 20, 147,0.5)' }, // Deep Pink
];

const ActionCells = ({
  row,
  navigate,
  onAddToQueue,
  actions,
  currentTrack,
  setCurrentTrack,
  onOpenAddToPlaylistDialog,
}: any) => {
  const [isTrackPlaying, setIsTrackPlaying] = React.useState(false);

  const track = row.original;

  const playMusic = () => {
    setIsTrackPlaying((prev) => !prev);
    setCurrentTrack(track);
    /*    if (currentTrack?.id !== track.id) {
    }
    */
    actions.togglePlayPause(track.id);
  };
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={playMusic}>
        {isTrackPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <Button
        size="sm"
        onClick={() => navigate({ to: `/research/${track.id}` })}
        variant="ghost"
      >
        <Brain className="h-4 w-4 " />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-5 w-5 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              if (onAddToQueue) {
                onAddToQueue([track]);
              }
            }}
          >
            Add to Queue
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenAddToPlaylistDialog(track.id)}>
            Add to Playlist
          </DropdownMenuItem>
          <DropdownMenuItem>View Details</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
export function MusicTable({
  data,
  pageCount,
  onAddToQueue,
  isLoading,
  staticFilterOptions,
  initialPageSize = 10,
}: MusicTableProps) {
  const navigate = useNavigate();
  const actions = useAudioPlayerActions();
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const [isAddToPlaylistDialogOpen, setIsAddToPlaylistDialogOpen] =
    React.useState(false);
  const [selectedTrackId, setSelectedTrackId] = React.useState<string | null>(
    null,
  );

  const handleOpenAddToPlaylistDialog = React.useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
    setIsAddToPlaylistDialogOpen(true);
  }, []);

  const handleCloseAddToPlaylistDialog = React.useCallback(() => {
    setIsAddToPlaylistDialogOpen(false);
    setSelectedTrackId(null);
  }, []);

  const columns = React.useMemo<ColumnDef<SimpleMusicTrack>[]>(
    () => [
      {
        id: 'libraryId',
        accessorKey: 'libraryId',
        header: () => null,
        cell: ({ row }) => {
          const track = row.original;
          const imagePath = track.imagePath || 'Unknown Image';

          return (
            <div className="flex items-center justify-cente h-5 w-8">
              <img
                src={`http://localhost:3000/api/images/serve?imagePath=${imagePath}`}
                alt="Album Art"
                className="h-8 w-8 rounded object-cover"
              />
            </div>
          );
        },
        enableColumnFilter: true,
        meta: {
          label: 'Libray',
          variant: 'multiSelect',
          options: staticFilterOptions.libraries,
        },
      },
      {
        id: 'artist',
        accessorKey: 'artist',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Artist" />
        ),
        cell: ({ row }) => {
          const artist = row.getValue('artist') as string;

          return (
            <div
              className="max-w-[100px] truncate font-medium capitalize"
              title={artist}
            >
              {artist}
            </div>
          );
        },
        meta: {
          label: 'Artist',
          placeholder: 'Search artist...',
          variant: 'text',
        },
        enableColumnFilter: true,
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Title" />
        ),
        cell: ({ row }) => {
          const title = row.getValue('title') as string;

          return (
            <div className="max-w-[150px] truncate capitalize" title={title}>
              {title}
            </div>
          );
        },
        enableColumnFilter: true,
        width: 200,
      },
      {
        id: 'duration',
        accessorKey: 'duration',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Duration" />
        ),
        cell: ({ row }) => {
          const duration = row.getValue('duration') as number;
          const minutes = Math.floor(duration / 60);
          const seconds = Math.floor(duration % 60);
          return (
            <div className="max-w-[50px] text-right font-mono">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
          );
        },

        enableColumnFilter: true,
      },
      {
        id: 'listeningCount',
        accessorKey: 'listeningCount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Plays" />
        ),
        cell: ({ row }) => {
          const count = row.getValue('listeningCount') as number;
          return (
            <div className="max-w-[25px] text-right">
              {count.toLocaleString()}
            </div>
          );
        },
        enableColumnFilter: true,
      },

      {
        id: 'atmosphereKeywords',
        accessorKey: 'atmospheres',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Atmosphere" />
        ),
        cell: ({ row }) => {
          const atmosphereKeywords = (row.getValue('atmosphereKeywords') ||
            []) as string[];

          return (
            <div className="flex  gap-1">
              {atmosphereKeywords?.map((atmosphereKeyword) => (
                <Badge variant="secondary" className="capitalize" size="xs">
                  {atmosphereKeyword}
                </Badge>
              ))}
            </div>
          );
        },
        meta: {
          label: 'Atmosphere',
          variant: 'multiSelect',
          options: staticFilterOptions.atmospheres,
          hidden: true,
        },
        enableColumnFilter: true,
        hidden: true,
        enableHiding: true,
      },
      {
        id: 'genres',
        accessorKey: 'genres',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Genre" />
        ),
        cell: ({ row }) => {
          const genres = row.getValue('genres') as string[];

          return (
            <div className="flex  gap-1">
              {genres.map((genre) => (
                <Badge variant="secondary" className="capitalize" size="xs">
                  {genre}
                </Badge>
              ))}
            </div>
          );
        },
        meta: {
          label: 'Genre',
          variant: 'multiSelect',
          options: staticFilterOptions.genres,
        },
        enableColumnFilter: true,
      },
      {
        id: 'subgenres',
        accessorKey: 'subgenres',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Subgenre" />
        ),
        cell: ({ row }) => {
          const subgenres = row.getValue('subgenres') as string[];

          return (
            <div className="flex  gap-1">
              {subgenres.map((subgenre) => (
                <Badge variant="outline" className="capitalize" size="xs">
                  {subgenre}
                </Badge>
              ))}
            </div>
          );
        },
        meta: {
          label: 'Subgenre',
          variant: 'multiSelect',
          options: staticFilterOptions.subgenres,
        },
        enableColumnFilter: true,
      },
      {
        id: 'tempo',
        accessorKey: 'tempo',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tempo" />
        ),
        cell: ({ row }) => {
          const tempo = row.getValue('tempo') as number;

          return (
            <div className="max-w-[50px] text-right font-mono">
              {tempo >= 0 ? `${Math.round(tempo)} BPM` : 'N/A'}
            </div>
          );
        },
        meta: {
          label: 'Tempo',
          unit: 'BPM',
          variant: 'range',
          range: [0, 200],
        },
        enableColumnFilter: true,
      },
      {
        id: 'key',
        accessorKey: 'key',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Key" />
        ),
        cell: ({ row }) => {
          const key = row.getValue('key') as string;

          return (
            <Badge
              variant="outline"
              className={cn('max-w-[70px] text-center font-mono')}
              size="xs"
              style={{
                backgroundColor: CamelotKeyOptions.find(
                  (option) => option.label === key,
                )?.color,
              }}
            >
              {CamelotKeyOptions.find((option) => option.label === key)
                ?.label || 'N/A'}
            </Badge>
          );
        },
        meta: {
          label: 'Key',
          variant: 'multiSelect',
          options: staticFilterOptions.keys,
        },
        enableColumnFilter: true,
      },

      {
        id: 'danceabilityFeeling',
        accessorKey: 'danceabilityFeeling',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Danceability" />
        ),
        cell: ({ row }) => {
          const danceabilityFeeling = row.getValue(
            'danceabilityFeeling',
          ) as string;

          return (
            <Badge
              variant="outline"
              className={cn('text-center font-mono')}
              size="xs"
            >
              {danceabilityFeelingOptions.find(
                (option) => option.value === danceabilityFeeling,
              )?.label || 'N/A'}
            </Badge>
          );
        },
        meta: {
          label: 'Danceability',
          variant: 'multiSelect',
          options: danceabilityFeelingOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: 'arousalMood',
        accessorKey: 'arousalMood',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Arousal" />
        ),
        cell: ({ row }) => {
          const arousalMood = row.getValue('arousalMood') as string;

          return (
            <Badge
              variant="outline"
              className={cn('text-center font-mono')}
              size="xs"
            >
              {arousalMoodOptions.find((option) => option.value === arousalMood)
                ?.label || 'N/A'}
            </Badge>
          );
        },
        meta: {
          label: 'Mood',
          variant: 'multiSelect',
          options: arousalMoodOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: 'valenceMood',
        accessorKey: 'valenceMood',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Mood" />
        ),
        cell: ({ row }) => {
          const valenceMood = row.getValue('valenceMood') as string;

          return (
            <Badge
              variant="outline"
              className={cn('text-center font-mono')}
              size="xs"
            >
              {valenceMoodOptions.find((option) => option.value === valenceMood)
                ?.label || 'N/A'}
            </Badge>
          );
        },
        meta: {
          label: 'Valence',
          variant: 'multiSelect',
          options: valenceMoodOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: 'isFavorite',
        accessorKey: 'isFavorite',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Favorite" />
        ),
        cell: ({ row }) => {
          const isFavorite = row.getValue('isFavorite') as boolean;

          return (
            <div className="flex items-center justify-center">
              <Heart
                className={cn(
                  'h-4 w-4',
                  isFavorite
                    ? 'fill-red-500 text-red-500'
                    : 'text-muted-foreground',
                )}
              />
            </div>
          );
        },
        meta: {
          label: 'Favorite',
          variant: 'boolean',
        },
        enableColumnFilter: true,
      },
      {
        id: 'lastScannedAt',
        accessorKey: 'lastScannedAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last Scanned At" />
        ),
        cell: ({ row }) => {
          const lastScannedAt = row.getValue('lastScannedAt') as string;
          return (
            <div className="text-right">
              {format(lastScannedAt, 'MM/dd/yyyy HH:mm')}
            </div>
          );
        },
        enableColumnFilter: true,
      },
      {
        id: 'fileCreatedAt',
        accessorKey: 'fileCreatedAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => {
          const fileCreatedAt = row.getValue('fileCreatedAt') as string;
          return (
            <div className="text-right">
              {format(new Date(fileCreatedAt), 'MM/dd/yyyy HH:mm')}
            </div>
          );
        },
        enableColumnFilter: true,
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => (
          <ActionCells
            row={row}
            navigate={navigate}
            onAddToQueue={onAddToQueue}
            actions={actions}
            currentTrack={currentTrack}
            setCurrentTrack={setCurrentTrack}
            onOpenAddToPlaylistDialog={handleOpenAddToPlaylistDialog}
          />
        ),
      },
    ],
    [onAddToQueue, handleOpenAddToPlaylistDialog],
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount: pageCount,
    initialState: {
      sorting: [{ id: 'title', desc: false }],
      columnPinning: { right: ['actions'] },
      pagination: {
        pageIndex: 0,
        pageSize: initialPageSize,
      },
      columnVisibility: {
        atmosphereKeywords: false,
      },
    },

    getRowId: (row) => row.id,
    enableAdvancedFilter: false,
  });

  return (
    <div className="w-full space-y-4">
      <DataTable table={table} isLoading={isLoading}>
        <DataTableToolbar table={table}>
          <DataTableSortList table={table} />
        </DataTableToolbar>
      </DataTable>
      {selectedTrackId && (
        <SelectPlaylistDialog
          isOpen={isAddToPlaylistDialogOpen}
          onClose={handleCloseAddToPlaylistDialog}
          trackId={selectedTrackId}
        />
      )}
    </div>
  );
}
