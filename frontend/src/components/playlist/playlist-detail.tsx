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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useDeletePlaylist,
  usePlaylist,
  useSpotifyAuth,
  useTidalAuth,
  useUpdatePlaylistSorting,
  useYouTubeAuth,
} from '@/services/playlist-hooks';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  AudioWaveform,
  ChevronDown,
  Clock,
  Disc3,
  HeartPlus,
  ListMusic,
  Music,
  Music2,
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
} from '@/contexts/audio-player-context';
import { formatDuration } from '@/lib/utils';
import {
  useAddTrackToQueue,
  useQueue,
  useRemoveTrackFromQueue,
} from '@/services/queue-hooks';
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
  const { data: currentQueue = [] } = useQueue();
  const addTrackToQueue = useAddTrackToQueue();
  const removeTrackFromQueue = useRemoveTrackFromQueue();
  const [activeTab, setActiveTab] = useState('tracks');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingAsQueue, setIsSettingAsQueue] = useState(false);
  const [isAddTrackDialogOpen, setIsAddTrackDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [isTidalAuthDialogOpen, setIsTidalAuthDialogOpen] = useState(false);
  // PKCE flow
  const [tidalAuthUrl, setTidalAuthUrl] = useState<string | null>(null);
  const [tidalCodeVerifier, setTidalCodeVerifier] = useState<string | null>(
    null,
  );
  const [tidalAuthCode, setTidalAuthCode] = useState('');
  const [isSpotifyAuthDialogOpen, setIsSpotifyAuthDialogOpen] = useState(false);
  // PKCE flow
  const [spotifyAuthUrl, setSpotifyAuthUrl] = useState<string | null>(null);
  const [spotifyCodeVerifier, setSpotifyCodeVerifier] = useState<string | null>(
    null,
  );
  const [spotifyAuthCode, setSpotifyAuthCode] = useState('');
  const {
    playlist,
    loading,
    error,
    refetch,
    syncToYouTube,
    isSyncingToYouTube,
    syncToTidal,
    isSyncingToTidal,
    syncToSpotify,
    isSyncingToSpotify,
  } = usePlaylist(id, 'default');
  const deletePlaylistMutation = useDeletePlaylist('default');
  const { getAuthUrl, authenticate, isGettingAuthUrl, isAuthenticating } =
    useYouTubeAuth('default');
  const {
    getAuthUrl: getTidalAuthUrl,
    authenticate: authenticateTidal,
    isGettingAuthUrl: isGettingTidalAuthUrl,
    isAuthenticating: isAuthenticatingTidal,
  } = useTidalAuth('default');
  const {
    getAuthUrl: getSpotifyAuthUrl,
    authenticate: authenticateSpotify,
    isGettingAuthUrl: isGettingSpotifyAuthUrl,
    isAuthenticating: isAuthenticatingSpotify,
  } = useSpotifyAuth('default');
  const updatePlaylistSortingMutation = useUpdatePlaylistSorting('default');

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
    if (!playlist?.tracks[0].track) return;
    setCurrentTrack(playlist?.tracks[0].track);
    actions.play(playlist?.tracks[0].track.id);
  };

  const handleSetAsQueue = async () => {
    if (!playlist) return;

    setIsSettingAsQueue(true);
    try {
      // Remove all current queue items (ignore errors for individual removals)
      const removePromises = currentQueue.map((item) =>
        removeTrackFromQueue.mutateAsync(item.trackId).catch((err) => {
          console.warn(
            `Failed to remove track ${item.trackId} from queue:`,
            err,
          );
        }),
      );
      await Promise.all(removePromises);

      // Add all playlist tracks to queue (ignore errors for duplicates)
      const addPromises = playlist.tracks
        .filter((pt) => pt.track?.id)
        .map((pt) =>
          addTrackToQueue.mutateAsync(pt.track!.id).catch((err) => {
            // Ignore "already in queue" errors
            if (
              err?.message?.includes('already in the queue') ||
              err?.response?.errors?.[0]?.message?.includes(
                'already in the queue',
              )
            ) {
              return;
            }
            console.warn(`Failed to add track ${pt.track!.id} to queue:`, err);
          }),
        );
      await Promise.all(addPromises);

      // Optionally start playing the first track
      if (playlist.tracks[0]?.track) {
        setCurrentTrack(playlist.tracks[0].track);
        actions.play(playlist.tracks[0].track.id);
      }
    } catch (error) {
      console.error('Failed to set playlist as queue:', error);
    } finally {
      setIsSettingAsQueue(false);
    }
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

  const handleSyncToTidal = async () => {
    try {
      const result = await syncToTidal();
      if (result.success) {
        alert(
          `Successfully synced playlist to TIDAL!\n\nSynced: ${result.syncedCount} tracks\nSkipped: ${result.skippedCount} tracks${
            result.playlistUrl ? `\n\nPlaylist URL: ${result.playlistUrl}` : ''
          }${
            result.errors.length > 0
              ? `\n\nErrors:\n${result.errors.join('\n')}`
              : ''
          }`,
        );
      } else {
        // Check if any error is an authentication error
        const errorMessages = result.errors.join(' ').toLowerCase();
        console.log('TIDAL sync errors:', result.errors);
        console.log('Checking for auth error in:', errorMessages);

        const isAuthError =
          errorMessages.includes('not authenticated') ||
          errorMessages.includes('unauthorized') ||
          errorMessages.includes('authorize') ||
          errorMessages.includes('authentication') ||
          errorMessages.includes('tidal not authenticated') ||
          errorMessages.includes('please authorize');

        console.log('Is auth error?', isAuthError);

        if (isAuthError) {
          // Trigger authentication flow
          console.log(
            'Authentication error detected, starting TIDAL auth flow...',
          );
          await handleStartTidalAuth();
        } else {
          alert(
            `Failed to sync playlist to TIDAL: ${result.errors.join(', ')}`,
          );
        }
      }
    } catch (error: any) {
      console.error('Failed to sync playlist to TIDAL:', error);

      // Check if it's an authentication error
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
        errorMessage.includes('TIDAL not authenticated');

      if (isAuthError) {
        // Trigger authentication flow
        console.log(
          'Authentication error detected, starting TIDAL auth flow...',
        );
        try {
          await handleStartTidalAuth();
        } catch (authError: any) {
          console.error('Failed to start TIDAL auth:', authError);
          // If auth flow fails, still show the error
          alert(
            `Failed to start authentication: ${authError?.message || 'Unknown error'}`,
          );
        }
      } else {
        alert(`Failed to sync playlist to TIDAL: ${errorMessage}`);
      }
    }
  };

  const handleStartTidalAuth = async () => {
    try {
      console.log('Getting TIDAL auth URL (PKCE flow)...');
      const { authUrl: url, codeVerifier } = await getTidalAuthUrl();
      console.log('TIDAL auth URL received:', url);

      if (!url || !codeVerifier) {
        throw new Error('No authorization URL or code verifier received');
      }

      setTidalAuthUrl(url);
      setTidalCodeVerifier(codeVerifier);
      setIsTidalAuthDialogOpen(true);
      console.log('TIDAL auth dialog opened (PKCE flow)');
    } catch (error: any) {
      console.error('Failed to get TIDAL authorization:', error);
      const errorMsg =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        'Unknown error';
      alert(
        `Failed to get authorization: ${errorMsg}. Please check your backend configuration.`,
      );
    }
  };

  const handleSyncToSpotify = async () => {
    try {
      const result = await syncToSpotify();
      if (result.success) {
        alert(
          `Successfully synced playlist to Spotify!\n\nSynced: ${result.syncedCount} tracks\nSkipped: ${result.skippedCount} tracks${
            result.playlistUrl ? `\n\nPlaylist URL: ${result.playlistUrl}` : ''
          }${
            result.errors.length > 0
              ? `\n\nErrors:\n${result.errors.join('\n')}`
              : ''
          }`,
        );
        if (result.playlistUrl) {
          window.open(result.playlistUrl, '_blank');
        }
      } else {
        // Check if any error is an authentication error
        const errorMessages = result.errors.join(' ').toLowerCase();
        console.log('Spotify sync errors:', result.errors);

        const isAuthError =
          errorMessages.includes('not authenticated') ||
          errorMessages.includes('unauthorized') ||
          errorMessages.includes('authorize') ||
          errorMessages.includes('authentication') ||
          errorMessages.includes('spotify not authenticated') ||
          errorMessages.includes('please authorize');

        if (isAuthError) {
          // Trigger authentication flow
          console.log(
            'Authentication error detected, starting Spotify auth flow...',
          );
          await handleStartSpotifyAuth();
        } else {
          alert(
            `Failed to sync playlist to Spotify: ${result.errors.join(', ')}`,
          );
        }
      }
    } catch (error: any) {
      console.error('Failed to sync playlist to Spotify:', error);

      // Check if it's an authentication error
      const errorMessage =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        error?.errors?.[0]?.message ||
        error?.toString() ||
        JSON.stringify(error);

      const isAuthError =
        errorMessage.includes('not authenticated') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('authorize') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('Spotify not authenticated');

      if (isAuthError) {
        // Trigger authentication flow
        console.log(
          'Authentication error detected, starting Spotify auth flow...',
        );
        try {
          await handleStartSpotifyAuth();
        } catch (authError: any) {
          console.error('Failed to start Spotify auth:', authError);
          alert(
            `Failed to start authentication: ${authError?.message || 'Unknown error'}`,
          );
        }
      } else {
        alert(`Failed to sync playlist to Spotify: ${errorMessage}`);
      }
    }
  };

  const handleStartSpotifyAuth = async () => {
    try {
      console.log('Getting Spotify auth URL (PKCE flow)...');
      const { authUrl: url, codeVerifier } = await getSpotifyAuthUrl();
      console.log('Spotify auth URL received:', url);

      if (!url || !codeVerifier) {
        throw new Error('No authorization URL or code verifier received');
      }

      setSpotifyAuthUrl(url);
      setSpotifyCodeVerifier(codeVerifier);
      setIsSpotifyAuthDialogOpen(true);
      console.log('Spotify auth dialog opened (PKCE flow)');
    } catch (error: any) {
      console.error('Failed to get Spotify authorization:', error);
      const errorMsg =
        error?.message ||
        error?.response?.errors?.[0]?.message ||
        'Unknown error';
      alert(
        `Failed to get authorization: ${errorMsg}. Please check your backend configuration.`,
      );
    }
  };

  const handleUpdateSorting = async (
    sortingKey: 'position' | 'addedAt',
    sortingDirection: 'asc' | 'desc',
  ) => {
    if (!playlist) return;
    try {
      await updatePlaylistSortingMutation.mutateAsync({
        playlistId: playlist.id,
        input: { sortingKey, sortingDirection },
      });
    } catch (error) {
      console.error('Failed to update playlist sorting:', error);
    }
  };

  const currentSortingKey =
    (playlist as any)?.sorting?.sortingKey === 'addedAt'
      ? 'addedAt'
      : 'position';
  const currentSortingDirection =
    (playlist as any)?.sorting?.sortingDirection === 'desc' ? 'desc' : 'asc';

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" disabled={!playlist}>
                <ChevronDown className="h-4 w-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setIsAddTrackDialogOpen(true)}
                disabled={!playlist}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Track
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSetAsQueue}
                disabled={isSettingAsQueue || !playlist}
              >
                <ListMusic className="h-4 w-4 mr-2" />
                {isSettingAsQueue ? 'Setting as Queue...' : 'Set as Queue'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePlay} disabled={!playlist}>
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Play
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting || !playlist}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Playlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={
                  isSyncingToYouTube ||
                  isSyncingToTidal ||
                  isSyncingToSpotify ||
                  !playlist
                }
              >
                <Music2 className="h-4 w-4 mr-2" />
                Sync
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleSyncToYouTube}
                disabled={isSyncingToYouTube || !playlist}
              >
                <Youtube className="h-4 w-4 mr-2" />
                {isSyncingToYouTube ? 'Syncing...' : 'Sync to YouTube'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSyncToTidal}
                disabled={isSyncingToTidal || !playlist}
              >
                <Music className="h-4 w-4 mr-2" />
                {isSyncingToTidal ? 'Syncing...' : 'Sync to TIDAL'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSyncToSpotify}
                disabled={isSyncingToSpotify || !playlist}
              >
                <Music2 className="h-4 w-4 mr-2" />
                {isSyncingToSpotify ? 'Syncing...' : 'Sync to Spotify'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={updatePlaylistSortingMutation.isPending || !playlist}
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-sm font-semibold">Sort by</div>
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('position', 'asc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Manual (Ascending)
                {currentSortingKey === 'position' &&
                  currentSortingDirection === 'asc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('position', 'desc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Manual (Descending)
                {currentSortingKey === 'position' &&
                  currentSortingDirection === 'desc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
              <div className="h-px bg-border my-1" />
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('addedAt', 'asc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Added Date (Ascending)
                {currentSortingKey === 'addedAt' &&
                  currentSortingDirection === 'asc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleUpdateSorting('addedAt', 'desc')}
                disabled={updatePlaylistSortingMutation.isPending}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Added Date (Descending)
                {currentSortingKey === 'addedAt' &&
                  currentSortingDirection === 'desc' && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Playlist Info */}
      <div className="flex-2 ">
        <PlaylistChart
          data={(playlist.tracks || []).map((track) => ({
            position: track.position,
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

      {/* TIDAL Authentication Dialog - PKCE Flow */}
      <Dialog
        open={isTidalAuthDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsTidalAuthDialogOpen(false);
            setTidalAuthUrl(null);
            setTidalCodeVerifier(null);
            setTidalAuthCode('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authenticate with TIDAL</DialogTitle>
            <DialogDescription>
              To sync playlists to TIDAL, you need to authenticate first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isGettingTidalAuthUrl ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Getting authorization URL...
                </p>
              </div>
            ) : tidalAuthUrl ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    1. Click the button below to open TIDAL authorization page
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Opening TIDAL auth URL:', tidalAuthUrl);
                      const newWindow = window.open(
                        tidalAuthUrl,
                        '_blank',
                        'noopener,noreferrer',
                      );
                      if (!newWindow || newWindow.closed) {
                        alert(
                          'Popup blocked. Please click the link below to open the authorization page.',
                        );
                      }
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    <Music className="h-4 w-4 mr-2" />
                    Open TIDAL Authorization
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Or{' '}
                    <a
                      href={tidalAuthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(
                          tidalAuthUrl,
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                    >
                      click here to open in a new tab
                    </a>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    2. After authorizing, TIDAL will redirect you to a page.
                    Look at the URL in your browser's address bar and copy the{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      code
                    </code>{' '}
                    parameter from the URL.
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    The redirect URL will look like:{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                      https://tidal-music.github.io/tidal-api-reference/oauth2-redirect.html?code=...
                    </code>{' '}
                    or{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      http://localhost:3000?code=...
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy everything after{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      code=
                    </code>{' '}
                    (until the next{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      &
                    </code>{' '}
                    or end of URL) and paste it below.
                  </p>
                  <Input
                    placeholder="Enter authorization code (from ?code= parameter in the redirect URL)"
                    value={tidalAuthCode}
                    onChange={(e) => setTidalAuthCode(e.target.value)}
                    disabled={isAuthenticatingTidal}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsTidalAuthDialogOpen(false);
                      setTidalAuthCode('');
                      setTidalAuthUrl(null);
                      setTidalCodeVerifier(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!tidalAuthCode.trim()) {
                        alert('Please enter the authorization code');
                        return;
                      }

                      if (!tidalCodeVerifier) {
                        alert(
                          'Missing code verifier. Please start the authentication process again.',
                        );
                        return;
                      }

                      try {
                        const result = await authenticateTidal({
                          code: tidalAuthCode,
                          codeVerifier: tidalCodeVerifier,
                        });
                        if (result.success) {
                          setIsTidalAuthDialogOpen(false);
                          setTidalAuthCode('');
                          setTidalAuthUrl(null);
                          setTidalCodeVerifier(null);
                          alert(
                            'Successfully authenticated with TIDAL! Retrying sync...',
                          );
                          // Retry the sync
                          setTimeout(() => {
                            handleSyncToTidal();
                          }, 500);
                        } else {
                          alert(
                            `Authentication failed: ${result.message || 'Unknown error'}`,
                          );
                        }
                      } catch (error: any) {
                        console.error('Failed to authenticate:', error);
                        alert(
                          `Failed to authenticate: ${error.message || 'Unknown error'}`,
                        );
                      }
                    }}
                    disabled={
                      !tidalAuthCode.trim() ||
                      isAuthenticatingTidal ||
                      !tidalCodeVerifier
                    }
                  >
                    {isAuthenticatingTidal
                      ? 'Authenticating...'
                      : 'Complete Authentication'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Failed to get authorization. Please try again.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Spotify Authentication Dialog - PKCE Flow */}
      <Dialog
        open={isSpotifyAuthDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSpotifyAuthDialogOpen(false);
            setSpotifyAuthUrl(null);
            setSpotifyCodeVerifier(null);
            setSpotifyAuthCode('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authenticate with Spotify</DialogTitle>
            <DialogDescription>
              To sync playlists to Spotify, you need to authenticate first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isGettingSpotifyAuthUrl ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Getting authorization URL...
                </p>
              </div>
            ) : spotifyAuthUrl ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    1. Click the button below to open Spotify authorization page
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Opening Spotify auth URL:', spotifyAuthUrl);
                      const newWindow = window.open(
                        spotifyAuthUrl,
                        '_blank',
                        'noopener,noreferrer',
                      );
                      if (!newWindow || newWindow.closed) {
                        alert(
                          'Popup blocked. Please click the link below to open the authorization page.',
                        );
                      }
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    <Music2 className="h-4 w-4 mr-2" />
                    Open Spotify Authorization
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Or{' '}
                    <a
                      href={spotifyAuthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(
                          spotifyAuthUrl,
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                    >
                      click here to open in a new tab
                    </a>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    2. After authorizing, Spotify will redirect you to a page.
                    Look at the URL in your browser's address bar and copy the{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      code
                    </code>{' '}
                    parameter from the URL.
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    The redirect URL will look like:{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                      http://localhost:3000?code=...
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy everything after{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      code=
                    </code>{' '}
                    (until the next{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      &
                    </code>{' '}
                    or end of URL) and paste it below.
                  </p>
                  <Input
                    placeholder="Enter authorization code (from ?code= parameter in the redirect URL)"
                    value={spotifyAuthCode}
                    onChange={(e) => setSpotifyAuthCode(e.target.value)}
                    disabled={isAuthenticatingSpotify}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSpotifyAuthDialogOpen(false);
                      setSpotifyAuthCode('');
                      setSpotifyAuthUrl(null);
                      setSpotifyCodeVerifier(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!spotifyAuthCode.trim()) {
                        alert('Please enter the authorization code');
                        return;
                      }

                      if (!spotifyCodeVerifier) {
                        alert(
                          'Missing code verifier. Please start the authentication process again.',
                        );
                        return;
                      }

                      try {
                        const result = await authenticateSpotify({
                          code: spotifyAuthCode,
                          codeVerifier: spotifyCodeVerifier,
                        });
                        if (result.success) {
                          setIsSpotifyAuthDialogOpen(false);
                          setSpotifyAuthCode('');
                          setSpotifyAuthUrl(null);
                          setSpotifyCodeVerifier(null);
                          alert(
                            'Successfully authenticated with Spotify! Retrying sync...',
                          );
                          // Retry the sync
                          setTimeout(() => {
                            handleSyncToSpotify();
                          }, 500);
                        } else {
                          alert(
                            `Authentication failed: ${result.message || 'Unknown error'}`,
                          );
                        }
                      } catch (error: any) {
                        console.error('Failed to authenticate:', error);
                        alert(
                          `Failed to authenticate: ${error.message || 'Unknown error'}`,
                        );
                      }
                    }}
                    disabled={
                      !spotifyAuthCode.trim() ||
                      isAuthenticatingSpotify ||
                      !spotifyCodeVerifier
                    }
                  >
                    {isAuthenticatingSpotify
                      ? 'Authenticating...'
                      : 'Complete Authentication'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Failed to get authorization. Please try again.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
