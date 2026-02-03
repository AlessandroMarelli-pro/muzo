import { ToggleFavoriteMutation } from '@/__generated__/types';
import { capitalizeEveryWord } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
	waveform: (trackId: string) => ['waveform', trackId] as const,
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
				{ trackId }
			);
			return response.getWaveformData;
		},
		enabled: !!trackId,
	});
};

export const useToggleFavorite = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (trackId: string) => {
			const response = await graffleClient.request<ToggleFavoriteMutation>(
				gql`
					mutation ToggleFavorite($trackId: String!) {
						toggleFavorite(trackId: $trackId) {
							id
							isFavorite
							updatedAt
							originalArtist
							originalTitle
						}
					}
				`,
				{ trackId }
			);
			return response.toggleFavorite;
		},
		onSuccess: (data, trackId) => {
			queryClient.invalidateQueries({ queryKey: ['playlistRecommendations'] });
			toast.success(
				`Track has been ${data.isFavorite ? 'added' : 'removed'} from your favorites`,
				{
					duration: 3000,
					description: capitalizeEveryWord(
						`${data.originalTitle} by ${data.originalArtist} `
					),
				}
			);
		},
	});
};
