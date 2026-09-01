import { Maybe, Track } from '@/__generated__/types';
import { memo, useMemo } from 'react';
import { PlaylistChart } from './playlist-chart';

interface PlaylistDetailChartProps {
  tracks: Array<{
    position: number;
    track?: Maybe<Track>;
  }>;
  isLoading: boolean;
}

function PlaylistDetailChartImpl({ tracks, isLoading }: PlaylistDetailChartProps) {
  // Build the chart series once per track-list change; without this the parent
  // hands PlaylistChart a fresh array on every render and defeats its memo.
  const data = useMemo(
    () =>
      (tracks || []).map((track) => ({
        position: track.position,
        tempo: Math.round((track.track?.mfTempo || 0) * 100) / 100,
        key: track.track?.mfKey || '',
        name: `${track.track?.artist} - ${track.track?.title}`,
        duration: track.track?.duration || 0,
      })),
    [tracks],
  );

  return (
    <div className="flex-2">
      <PlaylistChart data={data} isLoading={isLoading} />
    </div>
  );
}

export const PlaylistDetailChart = memo(PlaylistDetailChartImpl);
