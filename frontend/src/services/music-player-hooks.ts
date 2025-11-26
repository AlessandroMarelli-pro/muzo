import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
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
  playbackState: (trackId: string) => ['playback', 'state', trackId] as const,
  waveform: (trackId: string) => ['waveform', trackId] as const,
  audioAnalysis: (trackId: string) => ['audio-analysis', trackId] as const,
  beatData: (trackId: string) => ['beat-data', trackId] as const,
  energyData: (trackId: string) => ['energy-data', trackId] as const,
  realTimeAnalysis: (trackId: string, currentTime: number) =>
    ['real-time-analysis', trackId, currentTime] as const,
  audioInfo: (trackId: string) => ['audio-info', trackId] as const,
  audioStreamUrl: (trackId: string) => ['audio-stream-url', trackId] as const,
};

// Queries
export const usePlaybackState = (
  trackId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.playbackState(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getPlaybackState: PlaybackState | null;
      }>(
        gql`
          query GetPlaybackState($trackId: String!) {
            getPlaybackState(trackId: $trackId) {
              trackId
              isPlaying
              currentTime
              duration
              volume
              playbackRate
              isFavorite
            }
          }
        `,
        { trackId },
      );
      return response.getPlaybackState;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!trackId,
  });
};

export const useWaveformData = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.waveform(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getWaveformData: number[];
      }>(
        gql`
          query GetWaveformData($trackId: String!) {
            getWaveformData(trackId: $trackId)
          }
        `,
        { trackId },
      );
      return response.getWaveformData;
    },
    enabled: !!trackId,
  });
};

export const useDetailedWaveformData = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.waveform(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getDetailedWaveformData: WaveformData;
      }>(
        gql`
          query GetDetailedWaveformData($trackId: String!) {
            getDetailedWaveformData(trackId: $trackId) {
              peaks
              duration
              sampleRate
              channels
              bitDepth
            }
          }
        `,
        { trackId },
      );
      return response.getDetailedWaveformData;
    },
    enabled: !!trackId,
  });
};

export const useAudioAnalysis = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.audioAnalysis(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getAudioAnalysis: AudioAnalysisResult;
      }>(
        gql`
          query GetAudioAnalysis($trackId: String!) {
            getAudioAnalysis(trackId: $trackId) {
              beats {
                timestamp
                confidence
                strength
              }
              energy {
                timestamp
                energy
                frequency
              }
              tempo
              key
              mode
              danceability
              valence
              acousticness
              instrumentalness
              liveness
              speechiness
              duration
              analysisVersion
            }
          }
        `,
        { trackId },
      );
      return response.getAudioAnalysis;
    },
    enabled: !!trackId,
  });
};

export const useBeatData = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.beatData(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getBeatData: BeatData[];
      }>(
        gql`
          query GetBeatData($trackId: String!) {
            getBeatData(trackId: $trackId) {
              timestamp
              confidence
              strength
            }
          }
        `,
        { trackId },
      );
      return response.getBeatData;
    },
    enabled: !!trackId,
  });
};

export const useEnergyData = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.energyData(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getEnergyData: EnergyData[];
      }>(
        gql`
          query GetEnergyData($trackId: String!) {
            getEnergyData(trackId: $trackId) {
              timestamp
              energy
              frequency
            }
          }
        `,
        { trackId },
      );
      return response.getEnergyData;
    },
    enabled: !!trackId,
  });
};

export const useRealTimeAnalysis = (trackId: string, currentTime: number) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.realTimeAnalysis(trackId, currentTime),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getRealTimeAnalysis: RealTimeAnalysis;
      }>(
        gql`
          query GetRealTimeAnalysis($trackId: String!, $currentTime: Float!) {
            getRealTimeAnalysis(trackId: $trackId, currentTime: $currentTime) {
              currentBeat {
                timestamp
                confidence
                strength
              }
              currentEnergy
              beatConfidence
              nextBeatEstimate
              energyTrend
            }
          }
        `,
        { trackId, currentTime },
      );
      return response.getRealTimeAnalysis;
    },
    enabled: !!trackId && currentTime >= 0,
  });
};

export const useAudioInfo = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.audioInfo(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getAudioInfo: AudioInfo;
      }>(
        gql`
          query GetAudioInfo($trackId: String!) {
            getAudioInfo(trackId: $trackId) {
              trackId
              fileName
              fileSize
              duration
              format
              bitrate
              sampleRate
              contentType
            }
          }
        `,
        { trackId },
      );
      return response.getAudioInfo;
    },
    enabled: !!trackId,
  });
};

export const useAudioStreamUrl = (trackId: string) => {
  return useQuery({
    queryKey: musicPlayerQueryKeys.audioStreamUrl(trackId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getAudioStreamUrl: string;
      }>(
        gql`
          query GetAudioStreamUrl($trackId: String!) {
            getAudioStreamUrl(trackId: $trackId)
          }
        `,
        { trackId },
      );
      return response.getAudioStreamUrl;
    },
    enabled: !!trackId,
  });
};

// Mutations
export const usePlayTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trackId,
      startTime = 0,
    }: {
      trackId: string;
      startTime?: number;
    }) => {
      const response = await graffleClient.request<{
        playTrack: PlaybackState;
      }>(
        gql`
          mutation PlayTrack($trackId: String!, $startTime: Float) {
            playTrack(trackId: $trackId, startTime: $startTime) {
              trackId
              isPlaying
              currentTime
              duration
              volume
              playbackRate
              isFavorite
            }
          }
        `,
        { trackId, startTime },
      );
      return response.playTrack;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        musicPlayerQueryKeys.playbackState(data.trackId),
        data,
      );
    },
  });
};

export const usePauseTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<{
        pauseTrack: PlaybackState;
      }>(
        gql`
          mutation PauseTrack($trackId: String!) {
            pauseTrack(trackId: $trackId) {
              trackId
              isPlaying
              currentTime
              duration
              volume
              playbackRate
              isFavorite
            }
          }
        `,
        { trackId },
      );
      return response.pauseTrack;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        musicPlayerQueryKeys.playbackState(data.trackId),
        data,
      );
    },
  });
};

export const useResumeTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<{
        resumeTrack: PlaybackState;
      }>(
        gql`
          mutation ResumeTrack($trackId: String!) {
            resumeTrack(trackId: $trackId) {
              trackId
              isPlaying
              currentTime
              duration
              volume
              playbackRate
              isFavorite
            }
          }
        `,
        { trackId },
      );
      return response.resumeTrack;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        musicPlayerQueryKeys.playbackState(data.trackId),
        data,
      );
    },
  });
};

export const useSeekTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trackId,
      timeInSeconds,
    }: {
      trackId: string;
      timeInSeconds: number;
    }) => {
      const response = await graffleClient.request<{
        seekTrack: PlaybackState;
      }>(
        gql`
          mutation SeekTrack($trackId: String!, $timeInSeconds: Float!) {
            seekTrack(trackId: $trackId, timeInSeconds: $timeInSeconds) {
              trackId
              isPlaying
              currentTime
              duration
              volume
              playbackRate
              isFavorite
            }
          }
        `,
        { trackId, timeInSeconds },
      );
      return response.seekTrack;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        musicPlayerQueryKeys.playbackState(data.trackId),
        data,
      );
    },
  });
};

export const useStopTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<{
        stopTrack: boolean;
      }>(
        gql`
          mutation StopTrack($trackId: String!) {
            stopTrack(trackId: $trackId)
          }
        `,
        { trackId },
      );
      return response.stopTrack;
    },
    onSuccess: (_, trackId) => {
      queryClient.removeQueries({
        queryKey: musicPlayerQueryKeys.playbackState(trackId),
      });
    },
  });
};

export const useSetVolume = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trackId,
      volume,
    }: {
      trackId: string;
      volume: number;
    }) => {
      const response = await graffleClient.request<{
        setVolume: PlaybackState;
      }>(
        gql`
          mutation SetVolume($trackId: String!, $volume: Float!) {
            setVolume(trackId: $trackId, volume: $volume) {
              trackId
              isPlaying
              currentTime
              duration
              volume
              playbackRate
              isFavorite
            }
          }
        `,
        { trackId, volume },
      );
      return response.setVolume;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        musicPlayerQueryKeys.playbackState(data.trackId),
        data,
      );
    },
  });
};

export const useSetPlaybackRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trackId,
      rate,
    }: {
      trackId: string;
      rate: number;
    }) => {
      const response = await graffleClient.request<{
        setPlaybackRate: PlaybackState;
      }>(
        gql`
          mutation SetPlaybackRate($trackId: String!, $rate: Float!) {
            setPlaybackRate(trackId: $trackId, rate: $rate) {
              trackId
              isPlaying
              currentTime
              duration
              volume
              playbackRate
              isFavorite
            }
          }
        `,
        { trackId, rate },
      );
      return response.setPlaybackRate;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        musicPlayerQueryKeys.playbackState(data.trackId),
        data,
      );
    },
  });
};

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<{
        toggleFavorite: { id: string; isFavorite: boolean; updatedAt: string };
      }>(
        gql`
          mutation ToggleFavorite($trackId: String!) {
            toggleFavorite(trackId: $trackId) {
              id
              isFavorite
              updatedAt
            }
          }
        `,
        { trackId },
      );
      return response.toggleFavorite;
    },
    onSuccess: (data, trackId) => {
      // Update the playback state cache with the new favorite status
      queryClient.setQueryData(
        musicPlayerQueryKeys.playbackState(trackId),
        (oldData: PlaybackState | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            isFavorite: data.isFavorite,
          };
        },
      );
    },
  });
};
