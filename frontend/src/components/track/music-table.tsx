'use client';

import { Track } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ColumnDef, Row } from '@tanstack/react-table';
import { Brain, Heart, Pause, Play } from 'lucide-react';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { useCurrentTrack, useIsPlaying } from '@/contexts/audio-player-context';
import { AudioPlayerActions } from '@/hooks/useAudioPlayer';
import { StaticFilterOptionsData } from '@/hooks/useFilterOptions';
import { apiUrl } from '@/lib/api-config';
import { Link } from '@tanstack/react-router';
import { format } from 'date-fns';
import type { Table as TanstackTable } from '@tanstack/react-table';
import { AudioQualityBadge } from './audio-quality-badge';
import { GenresBadge } from './genres-badge';
import {
  arousalMoodOptions,
  danceabilityFeelingOptions,
  findFeatureLabel,
  formatKey,
  valenceMoodOptions,
} from './track-feature-options';
import { TrackMoreMenu } from './track-more-menu';

interface MusicTableProps {
  table: TanstackTable<Track>;
  isLoading: boolean;
}

const ActionCells = ({
  row,
  actions,
  setCurrentTrack,
}: {
  row: Row<Track>;
  actions: AudioPlayerActions;
  setCurrentTrack: (track: Track) => void;
}) => {
  const { currentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();

  const track = row.original;
  const isCurrentTrack = currentTrack?.id === track.id;
  const isThisTrackPlaying = isCurrentTrack && isPlaying;

  const playMusic = () => {
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
      actions.play(track.id);
    } else if (isPlaying) {
      actions.pause(track.id);
    } else {
      actions.play(track.id);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={playMusic}
        aria-label={isThisTrackPlaying ? `Pause ${track.title ?? 'track'}` : `Play ${track.title ?? 'track'}`}
      >
        {isThisTrackPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button asChild size="sm" variant="ghost" aria-label="Open track research">
        <Link to="/research/{-$trackId}" params={{ trackId: track.id }} preload="intent">
          <Brain className="h-4 w-4" aria-hidden />
        </Link>
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
};

/**
 * Column set for the Music table view. A plain function — the caller memoizes.
 */
export function buildMusicColumns(
  staticFilterOptions: StaticFilterOptionsData,
  actions: AudioPlayerActions,
  setCurrentTrack: (track: Track) => void,
): ColumnDef<Track>[] {
  return [
    {
      id: 'library',
      accessorKey: 'libraryId',
      header: () => null,
      cell: ({ row }) => {
        const track = row.original;
        const imagePath = track.imagePath;
        return (
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-muted">
            {imagePath ? (
              <img
                src={apiUrl(`/api/images/serve?imagePath=${imagePath}`)}
                alt={`${track.title ?? 'Unknown title'} — ${track.artist ?? 'Unknown artist'}`}
                loading="lazy"
                className="h-8 w-8 rounded object-cover"
              />
            ) : null}
          </div>
        );
      },
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: 'Artwork',
        variant: 'multiSelect',
        options: staticFilterOptions.libraries,
      },
    },
    {
      id: 'artist',
      accessorKey: 'artist',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Artist" />,
      cell: ({ row }) => {
        const artist = row.getValue('artist') as string;
        return (
          <div className="max-w-[100px] truncate font-medium capitalize" title={artist}>
            {artist}
          </div>
        );
      },
      meta: { label: 'Artist', placeholder: 'Search artist...', variant: 'text' },
      enableColumnFilter: true,
    },
    {
      id: 'title',
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => {
        const title = row.getValue('title') as string;
        return (
          <div className="flex max-w-[180px] items-center gap-2">
            <div className="truncate capitalize" title={title}>
              {title}
            </div>
            <AudioQualityBadge
              format={row.original.format}
              hqAudioPath={row.original.hqAudioPath}
            />
          </div>
        );
      },
      enableColumnFilter: true,
      meta: { label: 'Title', placeholder: 'Search title...', variant: 'text' },
    },
    {
      id: 'duration',
      accessorKey: 'duration',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
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
      meta: { label: 'Duration' },
    },
    {
      id: 'listeningCount',
      accessorKey: 'listeningCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Plays" />,
      cell: ({ row }) => {
        const count = row.getValue('listeningCount') as number;
        return <div className="max-w-[25px] text-right">{count.toLocaleString()}</div>;
      },
      meta: { label: 'Plays' },
    },
    {
      id: 'genres',
      accessorKey: 'genres',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Genre" />,
      cell: ({ row }) => (
        <GenresBadge genres={(row.getValue('genres') as string[]) ?? []} variant="secondary" />
      ),
      meta: { label: 'Genre', variant: 'multiSelect', options: staticFilterOptions.genres },
      enableColumnFilter: true,
    },
    {
      id: 'subgenres',
      accessorKey: 'subgenres',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Subgenre" />,
      cell: ({ row }) => (
        <GenresBadge genres={(row.getValue('subgenres') as string[]) ?? []} variant="outline" />
      ),
      meta: { label: 'Subgenre', variant: 'multiSelect', options: staticFilterOptions.subgenres },
      enableColumnFilter: true,
    },
    {
      id: 'tempo',
      accessorKey: 'tempo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tempo" />,
      cell: ({ row }) => {
        const tempo = row.getValue('tempo') as number;
        return (
          <div className="max-w-[50px] text-right font-mono">
            {tempo >= 0 ? `${Math.round(tempo)} BPM` : 'N/A'}
          </div>
        );
      },
      meta: { label: 'Tempo', unit: 'BPM', variant: 'range', range: [0, 200] },
      enableColumnFilter: true,
    },
    {
      id: 'mfKey',
      accessorKey: 'mfKey',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key" />,
      cell: ({ row }) => {
        const key = formatKey(row.original.mfKey);
        return (
          <Badge variant="outline" className="text-center font-mono" size="xs">
            {key ?? 'N/A'}
          </Badge>
        );
      },
      meta: { label: 'Key', variant: 'multiSelect', options: staticFilterOptions.keys },
      enableColumnFilter: true,
    },
    {
      id: 'mfDanceabilityFeeling',
      accessorKey: 'mfDanceabilityFeeling',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Danceability" />,
      cell: ({ row }) => {
        const value = row.getValue('mfDanceabilityFeeling') as string;
        return (
          <Badge variant="outline" className="text-center font-mono" size="xs">
            {findFeatureLabel(danceabilityFeelingOptions, value) || 'N/A'}
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
      id: 'mfArousalMood',
      accessorKey: 'mfArousalMood',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Energy" />,
      cell: ({ row }) => {
        const value = row.getValue('mfArousalMood') as string;
        return (
          <Badge variant="outline" className="text-center font-mono" size="xs">
            {findFeatureLabel(arousalMoodOptions, value) || 'N/A'}
          </Badge>
        );
      },
      meta: { label: 'Energy', variant: 'multiSelect', options: arousalMoodOptions },
      enableColumnFilter: true,
    },
    {
      id: 'mfValenceMood',
      accessorKey: 'mfValenceMood',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mood" />,
      cell: ({ row }) => {
        const value = row.getValue('mfValenceMood') as string;
        return (
          <Badge variant="outline" className="text-center font-mono" size="xs">
            {findFeatureLabel(valenceMoodOptions, value) || 'N/A'}
          </Badge>
        );
      },
      meta: { label: 'Mood', variant: 'multiSelect', options: valenceMoodOptions },
      enableColumnFilter: true,
    },
    {
      id: 'isFavorite',
      accessorKey: 'isFavorite',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Favorite" />,
      cell: ({ row }) => {
        const isFavorite = row.getValue('isFavorite') as boolean;
        return (
          <div className="flex items-center justify-center">
            <Heart
              className={cn(
                'h-4 w-4',
                isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <span className="sr-only">{isFavorite ? 'Favorite' : 'Not a favorite'}</span>
          </div>
        );
      },
      meta: { label: 'Favorite', variant: 'boolean' },
      enableColumnFilter: true,
    },
    {
      id: 'lastScannedAt',
      accessorKey: 'lastScannedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Scanned At" />,
      cell: ({ row }) => {
        const lastScannedAt = row.getValue('lastScannedAt') as string;
        return (
          <div className="text-right">
            {lastScannedAt && format(new Date(lastScannedAt), 'MM/dd/yyyy HH:mm')}
          </div>
        );
      },
      meta: { label: 'Last scanned' },
    },
    {
      id: 'fileCreatedAt',
      accessorKey: 'fileCreatedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created At" />,
      cell: ({ row }) => {
        const fileCreatedAt = row.getValue('fileCreatedAt') as string;
        return (
          <div className="text-right">
            {fileCreatedAt && format(new Date(fileCreatedAt), 'MM/dd/yyyy HH:mm')}
          </div>
        );
      },
      meta: { label: 'Created' },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => (
        <ActionCells row={row} actions={actions} setCurrentTrack={setCurrentTrack} />
      ),
    },
  ];
}

/**
 * The Music table view body. The table instance is owned by `MusicView` so the
 * card and table views share one set of URL-bound pagination / sort state.
 *
 * Not memoized: the `table` object from `useReactTable` is a stable reference
 * that mutates in place, so `React.memo` here would skip re-renders when the
 * row data changes (e.g. after a filter refetch). `MusicView` is already
 * memoized upstream.
 */
export function MusicTable({ table, isLoading }: MusicTableProps) {
  return (
    <div className="w-full space-y-4">
      <DataTable table={table} isLoading={isLoading} />
    </div>
  );
}
