import { Track } from '@/__generated__/types';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { NoData } from '@/components/no-data';
import { TrackTile } from '@/components/track/track-tile';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getCamelotKey, getCompatibleKeys, normalizeCamelot } from '@/lib/camelot';
import { useTracksList } from '@/services/api-hooks';
import { useNavigate } from '@tanstack/react-router';
import { Disc3 } from 'lucide-react';
import * as React from 'react';
import { CamelotWheel } from './camelot-wheel';

// Until the API can filter by Camelot key we pull a wide page and match locally.
const SAMPLE_SIZE = 200;

interface HarmonicPageProps {
  selectedKey?: string;
}

export function HarmonicPage({ selectedKey }: HarmonicPageProps) {
  const navigate = useNavigate({ from: '/music/harmonic' });
  const normalized = normalizeCamelot(selectedKey);

  const { data, isLoading } = useTracksList({
    limit: SAMPLE_SIZE,
    offset: 0,
    orderBy: 'fileCreatedAt',
    orderDirection: 'desc',
  });

  const compatible = React.useMemo(
    () => new Set(getCompatibleKeys(normalized)),
    [normalized],
  );

  const matches = React.useMemo<Track[]>(() => {
    if (!normalized || !data?.items) return [];
    return data.items.filter((track) => {
      const code = normalizeCamelot(track.mfCamelotKey);
      return code != null && compatible.has(code);
    });
  }, [data?.items, compatible, normalized]);

  const selectKey = (code: string) => {
    void navigate({ search: () => ({ key: code }) });
  };

  return (
    <PageShell key="harmonic-page">
      <PageHeader
        title="Harmonic Mixing"
        description="Pick a key on the wheel to find tracks that mix with it."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-4">
          <CamelotWheel selected={normalized} onSelect={selectKey} />
          {normalized && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-muted-foreground text-sm">Mixes with</span>
              {getCompatibleKeys(normalized).map((code) => {
                const key = getCamelotKey(code);
                const shortName = key?.name
                  .replace(/\bminor\b/i, 'min')
                  .replace(/\bmajor\b/i, 'maj');
                return (
                  <Badge key={code} variant="outline" size="xs" className="font-mono">
                    {code}
                    {shortName ? ` · ${shortName}` : ''}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0">
          {!normalized ? (
            <div className="py-12">
              <NoData
                Icon={Disc3}
                title="No key selected"
                subtitle="Choose a key on the Camelot wheel to see what mixes harmonically."
              />
            </div>
          ) : isLoading ? (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="py-12">
              <NoData
                Icon={Disc3}
                title="Nothing compatible in view"
                subtitle={`No tracks in the latest ${SAMPLE_SIZE} match ${normalized} or its neighbours. Full-library key search is coming.`}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {matches.length} compatible {matches.length === 1 ? 'track' : 'tracks'} in the
                latest {SAMPLE_SIZE} scanned
              </p>
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                {matches.map((track) => (
                  <TrackTile key={track.id} track={track} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
