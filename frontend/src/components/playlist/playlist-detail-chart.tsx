import { Track } from '@/__generated__/types';
import { PlaylistChart } from './playlist-chart';

interface PlaylistDetailChartProps {
	tracks: Array<{
		position: number;
		track?: Track;
	}>;
	isLoading: boolean;
}

export function PlaylistDetailChart({
	tracks,
	isLoading,
}: PlaylistDetailChartProps) {
	return (
		<div className="flex-2">
			<PlaylistChart
				data={(tracks || []).map((track) => ({
					position: track.position,
					tempo: Math.round((track.track?.mfTempo || 0) * 100) / 100,
					key: track.track?.mfKey || '',
					name: `${track.track?.artist} - ${track.track?.title}`,
					duration: track.track?.duration || 0,
				}))}
				isLoading={isLoading}
			/>
		</div>
	);
}
