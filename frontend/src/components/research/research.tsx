import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { NoData } from '@/components/no-data';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { Route } from '@/routes/research.{-$trackId}';
import { fetchRandomTrack } from '@/services/api-hooks';
import { RECOMMENDATION_BOOSTS } from '@/services/recommendation-types';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Brain } from 'lucide-react';
import { useMemo } from 'react';
import { TrackRecommandationsComponent } from '../playlist/track-recommendations';
import { DetailedTrackCard } from '../track/detailed-track-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CosineRecommendations } from './cosine-recommendations';

export function Research() {
  const router = useRouter();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const { randomTrack: track, isLoading, trackRecommendations } = Route.useLoaderData();

  const refetch = async () => {
    const randomTrack = await fetchRandomTrack();
    navigate({
      to: '/research/{-$trackId}',
      params: { trackId: randomTrack.id },
    });
  };

  const selectedBoost = useMemo(() => {
    return search.boost ? search.boost.split(',').filter(Boolean) : [];
  }, [search.boost]);

  const toggleBoost = (key: string) => {
    const next = selectedBoost.includes(key)
      ? selectedBoost.filter((k) => k !== key)
      : [...selectedBoost, key];
    router.navigate({
      search: { boost: next.length > 0 ? next.join(',') : undefined },
      replace: true,
    });
  };

  if (!isLoading && !track) {
    return (
      <PageShell>
        <PageHeader title="Research" description="Find tracks similar to this one." />
        <NoData
          Icon={Brain}
          title="No track to research"
          subtitle="Pick a random track to start exploring similar music."
          buttonAction={refetch}
          buttonLabel="Pick a random track"
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Research" description="Find tracks similar to this one." />

      <DetailedTrackCard track={track} refetch={refetch} isLoading={isLoading} />

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Boost similarity by
        </p>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDATION_BOOSTS.map(({ key, label }) => {
            const active = selectedBoost.includes(key);
            return (
              <Toggle
                key={key}
                size="sm"
                pressed={active}
                onPressedChange={() => toggleBoost(key)}
                className={cn(
                  'h-8 rounded-full border px-3',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
                    : 'border-border bg-transparent',
                )}
              >
                {label}
              </Toggle>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="recommendations">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="cosine">Cosine</TabsTrigger>
        </TabsList>
        <TabsContent value="recommendations" className="pt-4">
          <TrackRecommandationsComponent
            recommendations={trackRecommendations || []}
            isLoading={isLoading}
          />
        </TabsContent>
        <TabsContent value="cosine" className="pt-4">
          <CosineRecommendations trackId={track?.id} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
