import { TopGenre } from '@/services/metrics-hooks';
import { Link } from '@tanstack/react-router';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import CountUp from '../CountUp';
import { HorizontalMusicCardList } from '../track/music-card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

import { CardContent } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useCachedSessionStorage } from '@/hooks/use-cached-storage';
import { Route } from '@/routes/index';
import { BookHeadphones, ListMusic, Sparkles } from 'lucide-react';
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
  description: chartDescription,
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
        <CardDescription>{chartDescription}</CardDescription>
      </CardHeader>
      <CardContent className="pb-0 w-full">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px] w-full">
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

const StatsCardSkeleton = ({ featured = false }: { featured?: boolean }) => (
  <Card
    className={`flex flex-col gap-2 w-full rounded-xl border-none text-card-foreground @container/card bg-gradient-to-t from-primary/5 to-card dark:bg-card ${
      featured ? 'shadow-lg' : 'shadow-md'
    }`}
  >
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

const StatsCard = ({
  title,
  value,
  isLoading,
  isDuration = false,
  featured = false,
}: {
  title: string;
  value: number;
  isLoading: boolean;
  isDuration?: boolean;
  featured?: boolean;
}) => {
  const isLoaded = useCachedSessionStorage('isLoaded');

  if (isLoading) return <StatsCardSkeleton featured={featured} />;
  return (
    <Card
      className={`flex flex-col gap-2 w-full rounded-xl border-none text-card-foreground @container/card transition-shadow hover:shadow-lg bg-gradient-to-t from-primary/5 to-card  ${
        featured ? 'shadow-lg' : 'shadow-md'
      }`}
    >
      <CardHeader className="px-1">
        <CardTitle className="font-normal tracking-tight flex flex-col gap-2 items-center w-full text-center text-3xl @[250px]/card:text-3xl">
          <CountUp
            to={value}
            from={isLoaded === 'true' ? value : Math.floor(value * 0.7)}
            direction="up"
            delay={0}
            duration={1}
            className="font-normal tracking-tight text-foreground w-full max-w-sm tabular-nums"
            isDuration={isDuration}
          />
          <CardDescription className="text-lg @[250px]/card:text-lg text-normal w-full">
            {title}
          </CardDescription>
        </CardTitle>
      </CardHeader>
    </Card>
  );
};

const TopGenresSkeleton = () => (
  <div className="flex flex-row gap-3 items-center flex-wrap">
    {Array.from({ length: 10 }).map((_, index) => (
      <Badge key={index} variant="secondary" className="h-6 shadow-xs capitalize">
        <Skeleton className="w-15 h-6 bg-secondary" />
      </Badge>
    ))}
  </div>
);

const TopGenres = ({ genres, isLoading }: { genres: TopGenre[]; isLoading: boolean }) => {
  if (isLoading) return <TopGenresSkeleton />;
  const displayGenres = (genres ?? []).slice(0, 10);
  if (displayGenres.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Play some tracks to see your top genres here.</p>
    );
  }
  return (
    <div className="flex flex-row gap-3 justify-between flex-wrap">
      {displayGenres.map((genre, index) => (
        <Badge
          key={`${genre.genre}-${index}`}
          variant="secondary"
          className="h-6 shadow-xs capitalize p-3"
          size="sm"
        >
          <strong>{genre.genre}:</strong> {genre.trackCount}
        </Badge>
      ))}
    </div>
  );
};

export function Home() {
  const isLoading = false;
  const loaderData = Route.useLoaderData();
  const recentlyPlayed = loaderData.recentlyPlayed;
  const metrics = loaderData.metrics;

  const listeningStats = metrics?.listeningStats;
  const totalTracks = metrics?.totalTracks;
  const totalArtists = metrics?.artistCount;

  const topGenres = metrics?.topGenres;
  const hasRecentTracks = (recentlyPlayed?.length ?? 0) > 0;

  return (
    <main className="px-6 flex flex-col gap-4">
      {/* Hero */}
      <section aria-labelledby="home-heading" className="flex flex-col gap-4">
        <p className="text-muted-foreground max-w-xl text-pretty">
          Browse your library, discover with AI, and build playlists that match your taste.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="default" size="sm" className="gap-2">
            <Link to="/music" preload="intent">
              <ListMusic className="h-4 w-4" aria-hidden />
              Browse Music
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/swipe" preload="intent">
              <Sparkles className="h-4 w-4" aria-hidden />
              Swipe
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/playlists" preload="intent">
              <BookHeadphones className="h-4 w-4" aria-hidden />
              Playlists
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section aria-labelledby="stats-heading" className="flex flex-col gap-4">
        <h2 id="stats-heading" className="text-lg font-semibold tracking-tight text-foreground">
          Overview
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <StatsCard title="Tracks" value={totalTracks || 0} isLoading={isLoading} featured />
          </div>
          <StatsCard title="Plays" value={listeningStats?.totalPlays || 0} isLoading={isLoading} />
          <StatsCard
            title="Played Time"
            value={listeningStats?.totalPlayTime || 0}
            isLoading={isLoading}
            isDuration
          />
          <StatsCard
            title="Favorites"
            value={listeningStats?.favoriteCount || 0}
            isLoading={isLoading}
          />
          <StatsCard title="Artists" value={totalArtists || 0} isLoading={isLoading} />
        </div>
      </section>

      {/* Top genres */}
      <section aria-labelledby="genres-heading" className="flex flex-col gap-4">
        <h2 id="genres-heading" className="text-lg font-semibold tracking-tight text-foreground">
          Top Genres
        </h2>
        <TopGenres genres={topGenres || []} isLoading={isLoading} />
      </section>

      {/* Recently played */}
      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="recent-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Recently Played
          </h2>
          {hasRecentTracks && (
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/music" preload="intent">
                See all
              </Link>
            </Button>
          )}
        </div>
        <div className="relative">
          <HorizontalMusicCardList
            tracks={recentlyPlayed || []}
            isLoading={isLoading}
            emptyMessage="No recently played tracks"
            emptySubtext="Play something from Music or a playlist to see it here."
          />
        </div>
      </section>
    </main>
  );
}
