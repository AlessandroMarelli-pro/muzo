import { SimpleMusicTrack } from '@/__generated__/types';
import {
	useRegisterPlayedTrack,
	useToggleFavorite,
} from '@/services/music-player-hooks';
import { useQueue } from '@/services/queue-hooks';
import { useCallback, useMemo, useState } from 'react';

export interface AudioPlayerState {
	trackId: string | null;
	isPlaying: boolean;
	isFavorite: boolean;
}

export interface AudioPlayerActions {
	play: (trackId: string) => Promise<void>;
	pause: (trackId: string) => Promise<void>;
	next: () => Promise<void>;
	previous: () => Promise<void>;
	toggleFavorite: (trackId: string) => Promise<void>;
}

export interface UseAudioPlayerOptions {
	trackId?: string;
	currentTrack?: SimpleMusicTrack | null;
	setCurrentTrack?: (track: SimpleMusicTrack | null) => void;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
	const { currentTrack, setCurrentTrack } = options;
	let timeout: NodeJS.Timeout | null = null;
	// Get queue for next/previous functionality
	const { data: queueItems = [] } = useQueue();
	const registerPlayedTrackMutation = useRegisterPlayedTrack();
	// Local state - synced from server state
	const [localState, setLocalState] = useState<AudioPlayerState>({
		trackId: null,
		isPlaying: false,
		isFavorite: false,
	});

	// Mutations
	const toggleFavoriteMutation = useToggleFavorite();
	// Sync local state from server state, but don't overwrite recent manual updates

	// Play action - always calls playTrack mutation
	const play = useCallback(async (trackId: string) => {
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(async () => {
			await registerPlayedTrackMutation.mutateAsync(trackId);
		}, 10000);

		setLocalState((prev) => ({
			...prev,
			isPlaying: true,
			trackId,
		}));
	}, []);

	// Pause action
	const pause = useCallback(async () => {
		if (timeout) {
			clearTimeout(timeout);
		}
		setLocalState((prev) => ({
			...prev,
			isPlaying: false,
		}));
	}, []);

	// Next track - get next track from queue and play it
	const next = useCallback(async () => {
		if (!currentTrack || !setCurrentTrack || queueItems.length === 0) return;

		const currentIndex = queueItems.findIndex(
			(item) => item.track?.id === currentTrack.id
		);

		if (currentIndex === -1 || currentIndex === queueItems.length - 1) {
			// Already at the end or track not in queue
			return;
		}

		const nextItem = queueItems[currentIndex + 1];
		if (nextItem?.track) {
			setCurrentTrack(nextItem.track as any);
			await play(nextItem.track.id);
		}
	}, [currentTrack, queueItems, setCurrentTrack, play]);

	// Previous track - get previous track from queue and play it
	const previous = useCallback(async () => {
		if (!currentTrack || !setCurrentTrack || queueItems.length === 0) return;

		const currentIndex = queueItems.findIndex(
			(item) => item.track?.id === currentTrack.id
		);

		if (currentIndex <= 0) {
			// Already at the beginning or track not in queue
			return;
		}

		const previousItem = queueItems[currentIndex - 1];
		if (previousItem?.track) {
			setCurrentTrack(previousItem.track as any);
			await play(previousItem.track.id);
		}
	}, [currentTrack, queueItems, setCurrentTrack, play]);

	// Toggle favorite
	const toggleFavorite = useCallback(
		async (trackId: string) => {
			try {
				const result = await toggleFavoriteMutation.mutateAsync(trackId);
				// Update local state with new favorite status
				setLocalState((prev) => ({
					...prev,
					isFavorite: result.isFavorite,
				}));
			} catch (error) {
				console.error('Failed to toggle favorite:', error);
			}
		},
		[toggleFavoriteMutation]
	);

	const actions: AudioPlayerActions = useMemo(
		() => ({
			play,
			pause,
			next,
			previous,
			toggleFavorite,
		}),
		[play, pause, next, previous, toggleFavorite]
	);

	return useMemo(
		() => ({
			state: localState,
			actions,
		}),
		[localState, actions]
	);
}
