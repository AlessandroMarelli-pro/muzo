import { TopGenre } from '@/services/metrics-hooks';
import CountUp from '../CountUp';
import { HorizontalMusicCardList } from '../track/music-card';
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
import { Route } from '@/routes';
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
  isDuration = false,
}: {
  title: string;
  value: number;
  isLoading: boolean;
  isDuration?: boolean;
}) => {
  const isLoaded = sessionStorage.getItem('isLoaded');

  if (isLoading) return <StatsCardSkeleton />;
  return (
    <Card className="flex flex-col gap-2 w-full  rounded-xl border-none bg-card text-card-foreground shadow-2xl @container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl @[250px]/card:text-3xl font-normal tracking-tight">
          <CountUp
            to={value}
            from={isLoaded === 'true' ? value : Math.floor(value * 0.7)}
            direction="up"
            delay={0}
            duration={1}
            className="text-2xl @[250px]/card:text-3xl font-normal tracking-tight"
            isDuration={isDuration}
          />
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


export function Home() {
  const isLoading = false
  const loaderData = Route.useLoaderData()
  const recentlyPlayed = loaderData.recentlyPlayed
  const metrics = loaderData.metrics

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
          value={totalTracks || 0}
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Plays"
          value={listeningStats?.totalPlays || 0}
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Play Time"
          value={listeningStats?.totalPlayTime || 0}
          isLoading={isLoading}
          isDuration={true}
        />
        <StatsCard
          title="Favorite Count"
          value={listeningStats?.favoriteCount || 0}
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Artists"
          value={totalArtists || 0}
          isLoading={isLoading}
        />
      </div>
      <div className="flex flex-row gap-6 items-center flex-wrap">
        <h2 className="text-lg  text-foreground">Top Genres</h2>
        <TopGenres genres={topGenres || []} isLoading={isLoading} />
      </div>
      <div className="flex flex-col gap-6">
        <h2 className="text-lg  text-foreground">Recently Played</h2>

        <HorizontalMusicCardList
          tracks={recentlyPlayed || []}
          isLoading={isLoading}
          emptyMessage="No recently played tracks"
        />
      </div>

    </div>
  );
}
