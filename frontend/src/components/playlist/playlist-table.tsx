'use client';

import { PlaylistItem } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnDef } from '@tanstack/react-table';
import {
  Clock,
  Disc3,
  Download,
  Edit,
  HeartPlus,
  MoreHorizontal,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import * as React from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableSortList } from '@/components/data-table/data-table-sort-list';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import {
  useDeletePlaylist,
  useExportPlaylistToM3U,
} from '@/services/playlist-hooks';
import { format } from 'date-fns';

interface PlaylistTableProps {
  data: PlaylistItem[];
  onUpdate: () => void;
  onViewDetails: (playlistId: string) => void;
  isLoading?: boolean;
  initialPageSize?: number;
  onCreatePlaylist: () => void;
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const ActionCells = ({
  row,
  onUpdate,
  onViewDetails,
}: {
  row: any;
  onUpdate: () => void;
  onViewDetails: (playlistId: string) => void;
}) => {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const deletePlaylistMutation = useDeletePlaylist('default');
  const exportPlaylistMutation = useExportPlaylistToM3U('default');

  const playlist = row.original;

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePlaylistMutation.mutateAsync(playlist.id);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlay = () => {
    // TODO: Implement playlist playback
    console.log('Playing playlist:', playlist.id);
  };

  const handleEdit = () => {
    onViewDetails(playlist.id);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const m3uContent = await exportPlaylistMutation.mutateAsync(playlist.id);

      // Create a blob and download the file
      const blob = new Blob([m3uContent], { type: 'audio/mpegurl' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${playlist.name.replace(/[^a-z0-9]/gi, '_')}.m3u`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export playlist:', error);
      alert('Failed to export playlist. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePlay}>
          <Play className="mr-2 h-4 w-4" />
          Play
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export function PlaylistTable({
  data,
  onUpdate,
  onViewDetails,
  isLoading,
  initialPageSize = 10,
  onCreatePlaylist,
}: PlaylistTableProps) {
  const columns = React.useMemo<ColumnDef<PlaylistItem>[]>(
    () => [
      {
        id: 'image',
        accessorKey: 'images',
        header: () => null,
        cell: ({ row }) => {
          const playlist = row.original;
          const imagePath = playlist.images?.[0] || '';

          return (
            <div className="flex items-center justify-center h-8 w-8">
              <img
                src={`http://localhost:3000/api/images/serve?imagePath=${imagePath}`}
                alt="Album Art"
                className="h-8 w-8 rounded object-cover"
              />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const name = row.getValue('name') as string;

          return (
            <div
              className="max-w-[200px] truncate font-medium capitalize"
              title={name}
            >
              {name}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => {
          const description = row.getValue('description') as string;

          return (
            <div
              className="min-w-[400px] truncate text-muted-foreground"
              title={description}
            >
              {description}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'numberOfTracks',
        accessorKey: 'numberOfTracks',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tracks" />
        ),
        cell: ({ row }) => {
          const count = row.getValue('numberOfTracks') as number;

          return (
            <div className="flex items-center gap-1 ">
              <Disc3 className="h-4 w-4 text-muted-foreground" />
              <span>{count}</span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'totalDuration',
        accessorKey: 'totalDuration',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Duration" />
        ),
        cell: ({ row }) => {
          const duration = row.getValue('totalDuration') as number;

          return (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatDuration(duration)}</span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'bpmRange',
        accessorKey: 'bpmRange',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="BPM Range" />
        ),
        cell: ({ row }) => {
          const bpmRange = row.getValue('bpmRange') as {
            min: number;
            max: number;
          };

          return (
            <div className="flex items-center gap-1">
              <HeartPlus className="h-4 w-4 text-muted-foreground" />
              <span>
                {bpmRange.min} - {bpmRange.max}
              </span>
            </div>
          );
        },
        enableSorting: false,
      },

      {
        id: 'topGenres',
        accessorKey: 'topGenres',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Top Genres" />
        ),
        cell: ({ row }) => {
          const genres = row.getValue('topGenres') as string[];

          return (
            <div className="flex flex-row gap-1 ">
              {genres?.slice(0, 3).map((genre, index) => (
                <Badge
                  key={`genre-${index}-${genre}`}
                  variant="default"
                  className="capitalize text-xs"
                  size="xs"
                >
                  {genre}
                </Badge>
              ))}
              {genres && genres.length > 3 && (
                <Badge variant="accent" className="text-xs" size="xs">
                  +{genres.length - 3}
                </Badge>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => {
          const createdAt = row.getValue('createdAt') as string;
          return (
            <div className="text-right">
              {format(new Date(createdAt), 'MM/dd/yyyy HH:mm')}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <ActionCells
            row={row}
            onUpdate={onUpdate}
            onViewDetails={onViewDetails}
          />
        ),
      },
    ],
    [onUpdate, onViewDetails],
  );

  // Calculate pageCount based on data length for client-side pagination
  const calculatedPageCount = React.useMemo(() => {
    return Math.ceil(data.length / initialPageSize);
  }, [data.length, initialPageSize]);

  const { table } = useDataTable({
    data,
    columns,
    pageCount: calculatedPageCount > 0 ? calculatedPageCount : 1,
    initialState: {
      sorting: [{ id: 'name', desc: false }],
      columnPinning: { right: ['actions'] },
      pagination: {
        pageIndex: 0,
        pageSize: initialPageSize,
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
          <Button onClick={onCreatePlaylist} size="sm" variant="link">
            <Plus className="h-4 w-4" />
            Create Playlist
          </Button>
        </DataTableToolbar>
      </DataTable>
    </div>
  );
}
