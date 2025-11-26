import { formatDuration } from '@/lib/utils';
import { useRecentlyPlayed } from '@/services/api-hooks';
import { useLibraryMetrics } from '@/services/metrics-hooks';
import MusicCard from '../track/music-card';
import { Badge } from '../ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

('use client');

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';

import { CardContent } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Loading } from '../loading';

export const description = 'A radar chart';

const chartConfig = {
  genre: {
    label: 'Genre',
    color: 'var(--chart-1)',
  },
  subgenre: {
    label: 'Subgenre',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function ChartRadar({
  data,
  title,
  description,
  angleKey,
  dataKey,
  color,
}: {
  data: any;
  title: string;
  description: string;
  angleKey: string;
  dataKey: string;
  color: string;
}) {
  return (
    <Card className="w-full">
      <CardHeader className="items-center pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-0 w-full">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px] w-full"
        >
          <RadarChart data={data}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey={angleKey} />
            <PolarGrid />
            <Radar dataKey={dataKey} fill={color} fillOpacity={0.6} />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const StatsCard = ({ title, value }: { title: string; value: string }) => {
  return (
    <Card className="flex flex-col gap-2 w-full">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
};

export function Home() {
  const { data: recentlyPlayed } = useRecentlyPlayed();

  const { data: metrics, isLoading, error } = useLibraryMetrics();

  if (isLoading) return <Loading />;
  if (error) return <div>Error loading metrics</div>;

  const listeningStats = metrics?.listeningStats;
  const totalTracks = metrics?.totalTracks;
  const totalArtists = metrics?.artistCount;

  const topGenres = metrics?.topGenres;
  const genreDistribution = metrics?.genreDistribution;
  const subgenreDistribution = metrics?.subgenreDistribution;
  return (
    <div className="p-6 min-h-screen space-y-4">
      <h2 className="text-lg font-semibold ">Library Statistics</h2>
      <div className="flex flex-col gap-4  md:gap-6">
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card flex flex-row gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs  ">
          <StatsCard
            title="Total Tracks"
            value={totalTracks?.toString() || '0'}
          />
          <StatsCard
            title="Total Plays"
            value={listeningStats?.totalPlays.toString() || '0'}
          />
          <StatsCard
            title="Total Play Time"
            value={formatDuration(
              listeningStats?.totalPlayTime || 0,
            ).toString()}
          />
          <StatsCard
            title="Favorite Count"
            value={listeningStats?.favoriteCount.toString() || '0'}
          />
          <StatsCard
            title="Total Artists"
            value={totalArtists?.toString() || '0'}
          />
        </div>
      </div>
      <div className="flex flex-row gap-4 items-center">
        <h2 className="text-lg font-semibold ">Top Genres</h2>
        {topGenres?.map((genre, index) => (
          <Badge
            key={`${genre.genre}-${index}`}
            variant="outline"
            className="text-xs h-6"
            size="sm"
          >
            <strong>{genre.genre}:</strong> {genre.trackCount}
          </Badge>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold ">Recently Played</h2>
        <div className="flex flex-nowrap gap-1 max-w-screen overflow-x-scroll scroll-mb-0 ">
          {recentlyPlayed ? (
            recentlyPlayed?.map((track, index) => (
              <div
                className="min-w-[10vw] w-[10vw] max-h-65 h-65"
                key={`${track.id}-${index}`}
              >
                <MusicCard track={track} setQueue={() => {}} />
              </div>
            ))
          ) : (
            <div>No recently played tracks</div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4 w-full">
        <h2 className="text-lg font-semibold">Distributions</h2>
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card flex flex-row gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs  ">
          <ChartRadar
            data={genreDistribution}
            title="Genre Distribution"
            description="Most popular genres in your library"
            angleKey="genre"
            dataKey="count"
            color={chartConfig.genre.color as string}
          />
          <ChartRadar
            data={subgenreDistribution}
            title="Subgenre Distribution"
            description="Most popular subgenres in your library"
            angleKey="subgenre"
            dataKey="count"
            color={chartConfig.subgenre.color as string}
          />
        </div>
      </div>
    </div>
  );
}
