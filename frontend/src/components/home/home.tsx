import { formatDuration } from '@/lib/utils';
import { useRecentlyPlayed } from '@/services/api-hooks';
import { TopGenre, useLibraryMetrics } from '@/services/metrics-hooks';
import MusicCard, { MusicCardSkeleton } from '../track/music-card';
import { Badge } from '../ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

('use client');

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';

import { SimpleMusicTrack } from '@/__generated__/types';
import { CardContent } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '../ui/skeleton';

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
    <Card className="w-full shadow-xs">
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
const StatsCardSkeleton = () => {
  return (
    <Card className="flex flex-col gap-2 w-full  rounded-xl border-none bg-card text-card-foreground shadow-2xl @container/card">
      <CardHeader>
        <CardDescription>
          <Skeleton className="w-10 h-6" />
        </CardDescription>
        <CardTitle className="text-2xl @[250px]/card:text-3xl font-normal tracking-tight">
          <Skeleton className="w-full h-7" />
        </CardTitle>
      </CardHeader>
    </Card>
  );
};

const StatsCard = ({
  title,
  value,
  isLoading,
}: {
  title: string;
  value: string;
  isLoading: boolean;
}) => {
  if (isLoading) return <StatsCardSkeleton />;
  return (
    <Card className="flex flex-col gap-2 w-full  rounded-xl border-none bg-card text-card-foreground shadow-2xl @container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl @[250px]/card:text-3xl font-normal tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
};

const TopGenresSkeleton = () => {
  return (
    <div className="flex flex-row gap-6 items-center flex-wrap">
      {Array.from({ length: 10 }).map((_, index) => (
        <Badge
          key={index}
          variant="secondary"
          className=" h-6 shadow-xs capitalize "
        >
          <Skeleton key={index} className="w-15 h-6 bg-secondary" />
        </Badge>
      ))}
    </div>
  );
};
const TopGenres = ({
  genres,
  isLoading,
}: {
  genres: TopGenre[];
  isLoading: boolean;
}) => {
  if (isLoading) return <TopGenresSkeleton />;
  return (
    <div className="flex flex-row gap-6 items-center flex-wrap">
      {genres?.map((genre, index) => (
        <Badge
          key={`${genre.genre}-${index}`}
          variant="secondary"
          className=" h-6 shadow-xs capitalize "
          size="xs"
        >
          <strong>{genre.genre}:</strong> {genre.trackCount}
        </Badge>
      ))}
    </div>
  );
};

const RecentlyPlayedSkeleton = () => {
  return (
    <div className="flex-row  *:data-[slot=card]:shadow-   *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card  flex flex-nowrap gap-6 max-w-screen overflow-x-scroll scroll-mb-0 pb-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <MusicCardSkeleton key={index} />
      ))}
    </div>
  );
};
const RecentlyPlayed = ({
  recentlyPlayed,
  isLoading,
}: {
  recentlyPlayed: SimpleMusicTrack[];
  isLoading: boolean;
}) => {
  if (isLoading) return <RecentlyPlayedSkeleton />;
  return (
    <div className="flex-row  *:data-[slot=card]:shadow-   *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card  flex flex-nowrap gap-6 max-w-screen overflow-x-scroll scroll-mb-0 pb-3">
      {recentlyPlayed ? (
        recentlyPlayed?.map((track, index) => (
          <MusicCard
            key={`${track.id}-${index}`}
            track={track}
            setQueue={() => {}}
          />
        ))
      ) : (
        <div>No recently played tracks</div>
      )}
    </div>
  );
};

export function Home() {
  const { data: recentlyPlayed } = useRecentlyPlayed();

  const { data: metrics, isLoading, error } = useLibraryMetrics();

  if (error) return <div>Error loading metrics</div>;

  const listeningStats = metrics?.listeningStats;
  const totalTracks = metrics?.totalTracks;
  const totalArtists = metrics?.artistCount;

  const topGenres = metrics?.topGenres;
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg  text-foreground">Library Statistics</h2>
      <div className="flex flex-row gap-6 *:data-[slot=card]:shadow   *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card ">
        <StatsCard
          title="Total Tracks"
          value={totalTracks?.toString() || '0'}
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Plays"
          value={listeningStats?.totalPlays.toString() || '0'}
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Play Time"
          value={formatDuration(listeningStats?.totalPlayTime || 0).toString()}
          isLoading={isLoading}
        />
        <StatsCard
          title="Favorite Count"
          value={listeningStats?.favoriteCount.toString() || '0'}
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Artists"
          value={totalArtists?.toString() || '0'}
          isLoading={isLoading}
        />
      </div>
      <div className="flex flex-row gap-6 items-center flex-wrap">
        <h2 className="text-lg  text-foreground">Top Genres</h2>
        <TopGenres genres={topGenres || []} isLoading={isLoading} />
      </div>
      <div className="flex flex-col gap-6">
        <h2 className="text-lg  text-foreground">Recently Played</h2>
        <RecentlyPlayed
          recentlyPlayed={recentlyPlayed || []}
          isLoading={isLoading}
        />
      </div>
      {/*     <div className="flex flex-col gap-4 w-full">
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
      </div> */}
    </div>
  );
}
