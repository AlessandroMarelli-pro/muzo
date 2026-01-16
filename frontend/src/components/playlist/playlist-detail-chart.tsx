import { PlaylistChart } from './playlist-chart';

interface PlaylistDetailChartProps {
  tracks: Array<{
    position: number;
    track?: {
      tempo?: number | null;
      key?: string | null;
      artist?: string | null;
      title?: string | null;
      duration?: number | null;
    } | null;
  }>;
}

export function PlaylistDetailChart({ tracks }: PlaylistDetailChartProps) {
  return (
    <div className="flex-2">
      <PlaylistChart
        data={(tracks || []).map((track) => ({
          position: track.position,
          tempo: Math.round((track.track?.tempo || 0) * 100) / 100,
          key: track.track?.key || '',
          name: `${track.track?.artist} - ${track.track?.title}`,
          duration: track.track?.duration,
        }))}
      />
    </div>
  );
}
