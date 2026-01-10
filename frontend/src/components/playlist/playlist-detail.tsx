import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useDeletePlaylist,
  usePlaylist,
  useYouTubeAuth,
} from '@/services/playlist-hooks';
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
  Youtube,
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
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const {
    playlist,
    loading,
    error,
    refetch,
    syncToYouTube,
    isSyncingToYouTube,
  } = usePlaylist(id, 'default');
  const { setQueue } = useQueue();
  const deletePlaylistMutation = useDeletePlaylist('default');
  const { getAuthUrl, authenticate, isGettingAuthUrl, isAuthenticating } =
    useYouTubeAuth('default');

  const getGenreCounts = () => {
    if (!playlist) return {};
    const genreCounts: Record<string, number> = {};
    playlist.tracks.forEach((playlistTrack) => {
      if (playlistTrack.track.genres && playlistTrack.track.genres.length > 0) {
        playlistTrack.track.genres.forEach((genre) => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      } else if (
        playlistTrack.track.subgenres &&
        playlistTrack.track.subgenres.length > 0
      ) {
        playlistTrack.track.subgenres.forEach((subgenre) => {
          genreCounts[subgenre] = (genreCounts[subgenre] || 0) + 1;
        });
      } else {
        genreCounts['Unknown'] = (genreCounts['Unknown'] || 0) + 1;
      }
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

  const handleSyncToYouTube = async () => {
    if (!playlist) return;
    try {
      const result = await syncToYouTube();
      if (result.success) {
        if (result.playlistUrl) {
          window.open(result.playlistUrl, '_blank');
        }
        alert(
          `Successfully synced ${result.syncedCount} tracks to YouTube!${
            result.skippedCount > 0
              ? ` ${result.skippedCount} tracks were skipped.`
              : ''
          }`,
        );
      } else {
        // Check if any error is an authentication error
        const errorMessages = result.errors.join(' ');
        const isAuthError =
          errorMessages.includes('not authenticated') ||
          errorMessages.includes('Unauthorized') ||
          errorMessages.includes('authorize') ||
          errorMessages.includes('authentication') ||
          errorMessages.includes('YouTube not authenticated');

        if (isAuthError) {
          // Trigger authentication flow
          console.log('Authentication error detected, starting auth flow...');
          await handleStartAuth();
        } else {
          alert(`Failed to sync playlist. Errors: ${result.errors.join(', ')}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to sync playlist to YouTube:', error);

      // Check if it's an authentication error
      // GraphQL errors can be in different formats
      const errorMessage =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        error?.errors?.[0]?.message ||
        error?.toString() ||
        JSON.stringify(error);

      console.log('Error message:', errorMessage);

      const isAuthError =
        errorMessage.includes('not authenticated') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('authorize') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('YouTube not authenticated');

      if (isAuthError) {
        // Trigger authentication flow
        console.log('Authentication error detected, starting auth flow...');
        await handleStartAuth();
      } else {
        alert(`Failed to sync playlist to YouTube: ${errorMessage}`);
      }
    }
  };

  const handleStartAuth = async () => {
    try {
      console.log('Getting YouTube auth URL...');
      const url = await getAuthUrl();
      console.log('YouTube auth URL received:', url);
      if (!url) {
        throw new Error('No authorization URL received');
      }
      setAuthUrl(url);
      setIsAuthDialogOpen(true);
      console.log('Auth dialog should be open now');
    } catch (error: any) {
      console.error('Failed to get auth URL:', error);
      const errorMsg =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        'Unknown error';
      alert(
        `Failed to get authentication URL: ${errorMsg}. Please check your backend configuration.`,
      );
    }
  };

  const handleCompleteAuth = async () => {
    if (!authCode.trim()) {
      alert('Please enter the authorization code');
      return;
    }

    try {
      const result = await authenticate(authCode);
      if (result.success) {
        setIsAuthDialogOpen(false);
        setAuthCode('');
        setAuthUrl(null);
        alert('Successfully authenticated with YouTube! Retrying sync...');
        // Retry the sync
        setTimeout(() => {
          handleSyncToYouTube();
        }, 500);
      } else {
        alert(`Authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to authenticate:', error);
      alert(`Failed to authenticate: ${error.message || 'Unknown error'}`);
    }
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
            onClick={handleSyncToYouTube}
            disabled={isSyncingToYouTube || !playlist}
            size="sm"
            variant="ghost"
          >
            <Youtube className="h-4 w-4 " />
            {isSyncingToYouTube ? 'Syncing...' : 'Sync to YouTube'}
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
            name: `${track.track?.artist} - ${track.track?.title}`,
            duration: track.track?.duration,
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

      {/* YouTube Authentication Dialog */}
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authenticate with YouTube</DialogTitle>
            <DialogDescription>
              To sync playlists to YouTube, you need to authenticate first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                1. Click the button below to open YouTube authorization page
              </p>
              {authUrl ? (
                <>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Opening auth URL:', authUrl);
                      const newWindow = window.open(
                        authUrl,
                        '_blank',
                        'noopener,noreferrer',
                      );
                      if (!newWindow || newWindow.closed) {
                        // Fallback if popup is blocked - redirect current window
                        alert(
                          'Popup blocked. Please click the link below to open the authorization page.',
                        );
                      }
                    }}
                    disabled={isGettingAuthUrl}
                    className="w-full"
                    variant="outline"
                  >
                    {isGettingAuthUrl
                      ? 'Loading...'
                      : 'Open YouTube Authorization'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Or{' '}
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(authUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      click here to open in a new tab
                    </a>
                  </p>
                </>
              ) : (
                <Button disabled className="w-full" variant="outline">
                  {isGettingAuthUrl
                    ? 'Loading authorization URL...'
                    : 'No URL available'}
                </Button>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                2. After authorizing, copy the authorization code from the URL
                and paste it below
              </p>
              <Input
                placeholder="Enter authorization code"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                disabled={isAuthenticating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAuthDialogOpen(false);
                setAuthCode('');
                setAuthUrl(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteAuth}
              disabled={!authCode.trim() || isAuthenticating}
            >
              {isAuthenticating
                ? 'Authenticating...'
                : 'Complete Authentication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
