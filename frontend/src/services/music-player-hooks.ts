import { RegisterPlayedTrackMutation, ToggleFavoriteMutation } from '@/__generated__/types';
import { capitalizeEveryWord } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trackFragment } from './fragments';
import { gql, graffleClient } from './graffle-client';

// Music Player Types
export interface PlaybackState {
  trackId: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFavorite: boolean;
}

export interface BeatData {
  timestamp: number;
  confidence: number;
  strength: number;
}

export interface EnergyData {
  timestamp: number;
  energy: number;
  frequency: number;
}

export interface AudioAnalysisResult {
  beats: BeatData[];
  energy: EnergyData[];
  tempo: number;
  key: string;
  mode: 'major' | 'minor';
  danceability: number;
  valence: number;
  instrumentalness: number;
  voice: number;
  duration: number;
  analysisVersion: string;
}

export interface RealTimeAnalysis {
  currentBeat: BeatData;
  currentEnergy: number;
  beatConfidence: number;
  nextBeatEstimate: number;
  energyTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface AudioInfo {
  trackId: string;
  fileName: string;
  fileSize: number;
  duration: number;
  format: string;
  bitrate?: number;
  sampleRate?: number;
  contentType: string;
}

// Query Keys
export const musicPlayerQueryKeys = {
  waveform: (trackId: string) => ['waveform', trackId] as const,
};

export const useWaveformData = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.waveform(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        me: {
          musicPlayer: {
            currentWaveformData: number[];
          };
        };
      }>(
        gql`
          query GetWaveformData($trackId: Base64ID!) {
            me {
              musicPlayer {
                currentWaveformData(trackId: $trackId)
              }
            }
          }
        `,
        { trackId },
      );
      return response.me.musicPlayer.currentWaveformData;
    },
    enabled: !!trackId,
  });
};

export const useRegisterPlayedTrack = () => {
  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<RegisterPlayedTrackMutation>(
        gql`
          mutation RegisterPlayedTrack($trackId: Base64ID!) {
            registerPlayedTrack(trackId: $trackId)
          }
        `,
        { trackId },
      );
      return response.registerPlayedTrack;
    },
  });
};

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<ToggleFavoriteMutation>(
        gql`
          ${trackFragment}
          mutation ToggleFavorite($trackId: Base64ID!) {
            toggleFavorite(trackId: $trackId) {
              ...TrackFragment
            }
          }
        `,
        { trackId },
      );
      return response.toggleFavorite;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['playlistRecommendations'] });
      toast.success(
        `Track has been ${data.isFavorite ? 'added to' : 'removed from'} your favorites`,
        {
          duration: 3000,
          description: capitalizeEveryWord(`${data.title} by ${data.artist} `),
        },
      );
    },
  });
};
