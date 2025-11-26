import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeletePlaylist, usePlaylist } from '@/services/playlist-hooks';
import {
  ArrowLeft,
  AudioWaveform,
  Clock,
  Disc3,
  HeartPlus,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../ui/badge';
// Note: This app uses custom view state instead of routing
// The id should be passed as a prop from the parent component
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
  useQueue,
} from '@/contexts/audio-player-context';
import { formatDuration } from '@/lib/utils';
import { AddTrackDialog } from './add-track-dialog';
import { PlaylistChart } from './playlist-chart';
import { PlaylistTracksList } from './playlist-tracks-list';
import { TrackRecommendations } from './track-recommendations';

interface PlaylistDetailProps {
  id: string;
  onBack: () => void;
}

export function PlaylistDetail({ id, onBack }: PlaylistDetailProps) {
  const { setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();
  const [activeTab, setActiveTab] = useState('tracks');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddTrackDialogOpen, setIsAddTrackDialogOpen] = useState(false);
  const { playlist, loading, error, refetch } = usePlaylist(id, 'default');
  const { setQueue } = useQueue();
  const deletePlaylistMutation = useDeletePlaylist('default');

  const getGenreCounts = () => {
    if (!playlist) return {};
    const genreCounts: Record<string, number> = {};
    playlist.tracks.forEach((playlistTrack) => {
      const genre =
        playlistTrack.track.genre || playlistTrack.track.subgenre || 'Unknown';
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });
    return genreCounts;
  };

  const handleDelete = async () => {
    if (
      !playlist ||
      !confirm(`Are you sure you want to delete "${playlist.name}"?`)
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePlaylistMutation.mutateAsync(playlist.id);
      onBack();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlay = () => {
    // TODO: Implement play playlist functionality
    if (!playlist?.tracks[0].track) return;
    setCurrentTrack(playlist?.tracks[0].track);
    setQueue(playlist?.tracks.map((track) => track.track));
    actions.togglePlayPause(playlist?.tracks[0].track.id);
  };

  const handleShuffle = () => {
    // TODO: Implement shuffle playlist functionality
    console.log('Shuffle playlist:', playlist?.id);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error || 'Playlist not found'}</p>
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Playlists
        </Button>
      </div>
    );
  }

  const genreCounts = getGenreCounts();
  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="p-4 lg:p-6 space-y-8 flex flex-col z-0">
      {/* Header */}
      <div className="flex items-center gap-4 justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 " />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold flex flex-row gap-1 items-center">
            {playlist.name}:
            <span className="text-muted-foreground">
              {playlist.description}
            </span>
          </h1>
        </div>
        <div className="flex flex-row gap-1 items-center">
          <Badge variant="outline" className="text-xs ">
            <Disc3 className="h-4 w-4 " /> Tracks: {playlist.numberOfTracks}
          </Badge>
          <Badge variant="outline" className="text-xs ">
            <Clock className="h-4 w-4" />
            Duration: {formatDuration(playlist.totalDuration)}
          </Badge>{' '}
          <Badge variant="outline" className="text-xs ">
            <HeartPlus className="h-4 w-4 " /> BPM: {playlist.bpmRange.min} -{' '}
            {playlist.bpmRange.max}
          </Badge>
          <Badge variant="outline" className="text-xs ">
            <AudioWaveform className="h-4 w-4 " /> Energy:{' '}
            {playlist.energyRange.min} - {playlist.energyRange.max}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsAddTrackDialogOpen(true)}
            size="sm"
            variant="ghost"
          >
            <Plus className="h-4 w-4 " />
            Add Track
          </Button>
          <Button onClick={handlePlay} size="sm" variant="ghost">
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 " /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 " /> Play
              </>
            )}
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            size="sm"
            variant="ghost-destructive"
          >
            <Trash2 className="h-4 w-4 " />
            Delete Playlist
          </Button>
        </div>
      </div>

      {/* Playlist Info */}
      <div className="flex-2 ">
        <PlaylistChart
          data={(playlist.tracks || []).map((track, index) => ({
            position: index,
            tempo: Math.round((track.track?.tempo || 0) * 100) / 100,
            key: track.track?.key || '',
            name: `${track.track?.title || track.track?.artist}`,
          }))}
        />
      </div>
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="recommendations">
            <Sparkles className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="space-y-4">
          <PlaylistTracksList playlist={playlist} onUpdate={refetch} />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <TrackRecommendations
            playlistId={playlist.id}
            onTrackAdded={() => refetch()}
          />
        </TabsContent>
      </Tabs>

      <AddTrackDialog
        open={isAddTrackDialogOpen}
        onOpenChange={setIsAddTrackDialogOpen}
        onSuccess={refetch}
        playlistId={id}
      />
    </div>
  );
}
