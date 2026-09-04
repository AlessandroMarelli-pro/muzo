import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { NoData } from '@/components/no-data';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useScanSessionContext } from '@/contexts/scan-session.context';
import { cn } from '@/lib/utils';
import { librariesQueryOptions, recentlyPlayedQueryOptions } from '@/services/api-hooks';
import { libraryMetricsQueryOptions } from '@/services/metrics-hooks';
import { playlistsQueryOptions } from '@/services/playlist-hooks';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, isAfter, subDays } from 'date-fns';
import { ArrowRight, CircleDashed, FolderPlus, Loader2, PlugZap } from 'lucide-react';
import * as React from 'react';
import { HorizontalMusicCardList } from '../track/music-card';

/* -------------------------------------------------------------------------- */
/*  Data derivation                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A playlist counts as "in progress" when it was touched recently and is still
 * short enough to be mid-build. Tunable in one place so the home page and any
 * later "resume" surface stay in sync.
 */
const IN_PROGRESS_MAX_AGE_DAYS = 14;
const IN_PROGRESS_MAX_TRACKS = 30;

/** How far back "added recently" looks, matching the metrics `recentActivity` window. */
const RECENT_WINDOW_DAYS = 7;

/** How many top genres to show as browsable chips. */
const MAX_GENRES_DISPLAYED = 12;

/* -------------------------------------------------------------------------- */
/*  Section primitives                                                         */
/* -------------------------------------------------------------------------- */

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8">
      <NoData
        Icon={PlugZap}
        title={`Couldn't load ${label}`}
        subtitle="The connection to Muzo's backend failed. Check that it's running, then try again."
        buttonLabel="Retry"
        buttonAction={onRetry}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Briefing block — "what changed, and what to do next"                       */
/* -------------------------------------------------------------------------- */

/** Aggregated live-scan progress, or null when no scan is running. */
function useActiveScan() {
  const { activeSessions } = useScanSessionContext();
  return React.useMemo(() => {
    const sessions = [...activeSessions.values()];
    if (sessions.length === 0) return null;
    const totalTracks = sessions.reduce((sum, s) => sum + (s.totalTracks || 0), 0);
    const completedTracks = sessions.reduce((sum, s) => sum + (s.completedTracks || 0), 0);
    // overallProgress is a 0-100 percentage from the backend boundary onward -- see
    // ScanStateEvent.overallProgress in ScanProgress.types.ts.
    const rawProgress =
      sessions.reduce((sum, s) => sum + (s.overallProgress || 0), 0) / sessions.length;
    const progress = totalTracks > 0 ? Math.round((completedTracks / totalTracks) * 100) : Math.round(rawProgress);
    const etaSeconds =
      sessions.length === 1 && sessions[0]?.confidence !== 'warming-up'
        ? (sessions[0]?.etaSeconds ?? null)
        : null;
    return {
      totalTracks,
      completedTracks,
      progress: Math.min(Math.max(progress, 0), 100),
      etaSeconds,
    };
  }, [activeSessions]);
}

function ScanningBriefing() {
  const active = useActiveScan();
  if (!active) return null;

  const etaLabel =
    active.etaSeconds === null
      ? null
      : active.etaSeconds < 60
        ? `~${active.etaSeconds}s remaining`
        : `~${Math.round(active.etaSeconds / 60)} min remaining`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          Analyzing your library
        </span>
        <span className="flex items-center gap-2 font-mono text-sm text-muted-foreground tabular-nums">
          <span>
            {active.totalTracks > 0
              ? `${active.completedTracks.toLocaleString()} / ${active.totalTracks.toLocaleString()}`
              : `${active.progress}%`}
          </span>
          {etaLabel && <span>{etaLabel}</span>}
        </span>
      </div>
      <Progress value={active.progress} className="h-1.5" aria-label="Analysis progress" />
    </div>
  );
}

interface Briefing {
  addedRecently: number;
  needsAnalysis: number;
  inProgressPlaylist: { id: string; name: string; count: number; updatedAt: string } | null;
}

function BriefingBlock({ briefing }: { briefing: Briefing }) {
  const { addedRecently, needsAnalysis, inProgressPlaylist } = briefing;

  // Priority of what to say first: unfinished intake > pick up a playlist > all clear.
  let headline: React.ReactNode;
  let action: { to: string; label: string } | null = null;

  if (needsAnalysis > 0) {
    headline =
      addedRecently > 0 ? (
        <>
          <strong className="font-semibold text-foreground">
            {addedRecently.toLocaleString()}
          </strong>{' '}
          {addedRecently === 1 ? 'track' : 'tracks'} added this week ·{' '}
          <strong className="font-semibold text-foreground">
            {needsAnalysis.toLocaleString()}
          </strong>{' '}
          still {needsAnalysis === 1 ? 'needs' : 'need'} analysis
        </>
      ) : (
        <>
          <strong className="font-semibold text-foreground">
            {needsAnalysis.toLocaleString()}
          </strong>{' '}
          {needsAnalysis === 1 ? 'track needs' : 'tracks need'} analysis before you can dig
        </>
      );
    // `/pending` is the rating-triage queue (like/dislike/banger), not an
    // analysis-status view — `Library.pendingTracks`/`failedTracks` have no
    // corresponding track-level filter yet. `/libraries` is the one place
    // that actually shows per-library analysis progress and the "retry
    // incomplete" action, so send the user there until a dedicated filter
    // exists.
    action = { to: '/libraries', label: 'Review libraries' };
  } else if (inProgressPlaylist) {
    // Name the heuristic's own evidence (last-edited time) so surfacing this
    // playlist over another reads as informed, not arbitrary.
    const lastEdited = formatDistanceToNow(new Date(inProgressPlaylist.updatedAt), {
      addSuffix: true,
    });
    headline = (
      <>
        Pick up where you left off —{' '}
        <strong className="font-semibold text-foreground">{inProgressPlaylist.name}</strong> has{' '}
        {inProgressPlaylist.count} {inProgressPlaylist.count === 1 ? 'track' : 'tracks'}, edited{' '}
        {lastEdited}
      </>
    );
    action = { to: `/playlists/${inProgressPlaylist.id}`, label: 'Open playlist' };
  } else if (addedRecently > 0) {
    headline = (
      <>
        <strong className="font-semibold text-foreground">{addedRecently.toLocaleString()}</strong>{' '}
        {addedRecently === 1 ? 'track' : 'tracks'} added this week — all analyzed and ready
      </>
    );
    action = { to: '/music', label: 'Browse the library' };
  } else {
    headline = <>Your library&rsquo;s all caught up. Dig in whenever you&rsquo;re ready.</>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-base text-muted-foreground">{headline}</p>
      {action && (
        <Button
          asChild
          variant="default"
          size="sm"
          className="nudge-idle group shrink-0 gap-2 self-start sm:self-auto"
        >
          <Link to={action.to} preload="intent">
            {action.label}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </Button>
      )}
    </div>
  );
}

function BriefingSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm">
      <Skeleton className="h-5 w-2/3 max-w-sm" />
      <Skeleton className="h-8 w-28 shrink-0" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pipeline tiles — every tile is a link into the view that acts on it        */
/* -------------------------------------------------------------------------- */

interface PipelineTile {
  label: string;
  value: number;
  to: string;
  emphasis?: boolean;
  /** Reserved for a genuine problem state (failed analyses) — Rose, per DESIGN.md, error states only. */
  destructive?: boolean;
}

function PipelineTiles({ tiles }: { tiles: PipelineTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          to={tile.to}
          preload="intent"
          className={cn(
            'flex flex-col gap-1 rounded-xl border bg-card px-4 py-4 shadow-sm transition-shadow',
            'hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            tile.emphasis && 'ring-1 ring-primary/30',
          )}
        >
          <span
            className={cn(
              'font-mono text-2xl font-semibold tabular-nums',
              tile.destructive ? 'text-destructive' : 'text-foreground',
            )}
          >
            {tile.value.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">{tile.label}</span>
        </Link>
      ))}
    </div>
  );
}

function PipelineTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-4 shadow-sm">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top genres — browsable, one link per genre                                 */
/* -------------------------------------------------------------------------- */

/**
 * Genres arrive lowercased/inconsistent from the pipeline. Title-case each
 * word but keep short scene acronyms/tags (UK, D&B, 2-Step, EDM) upper —
 * split on whitespace AND hyphens/ampersands while keeping the original
 * separator, since "d&b" and "2-step" don't carry a space to split on.
 */
const GENRE_ACRONYMS = new Set([
  'uk',
  'us',
  'dnb',
  'd&b',
  '2-step',
  'edm',
  'idm',
  'nyc',
  'la',
  'r&b',
]);
function formatGenre(raw: string) {
  return raw
    .split(/(\s+)/)
    .map((word) => {
      if (/^\s+$/.test(word)) return word;
      return GENRE_ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

function TopGenres({ genres }: { genres: { genre: string; trackCount: number }[] }) {
  const display = (genres ?? []).slice(0, MAX_GENRES_DISPLAYED);
  if (display.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Analyze some tracks to see the genres in your collection.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {display.map(({ genre, trackCount }) => (
        <Link
          key={genre}
          to="/music"
          preload="intent"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1',
            'text-sm text-secondary-foreground transition-colors hover:bg-secondary/70',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          {formatGenre(genre)}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {trackCount.toLocaleString()}
          </span>
        </Link>
      ))}
    </div>
  );
}

function TopGenresSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-24 rounded-full" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function Home() {
  const navigate = useNavigate();
  const activeScan = useActiveScan();
  const librariesQuery = useQuery(librariesQueryOptions());
  const metricsQuery = useQuery(libraryMetricsQueryOptions());
  const recentlyPlayedQuery = useQuery(recentlyPlayedQueryOptions());
  const playlistsQuery = useQuery(playlistsQueryOptions());

  const libraries = librariesQuery.data ?? [];
  const metrics = metricsQuery.data;
  const recentlyPlayed = recentlyPlayedQuery.data ?? [];
  const playlists = playlistsQuery.data ?? [];

  /* --- Library pipeline totals --- */
  const pipeline = React.useMemo(() => {
    return libraries.reduce(
      (acc, lib) => ({
        total: acc.total + (lib.totalTracks || 0),
        analyzed: acc.analyzed + (lib.analyzedTracks || 0),
        pending: acc.pending + (lib.pendingTracks || 0),
        failed: acc.failed + (lib.failedTracks || 0),
      }),
      { total: 0, analyzed: 0, pending: 0, failed: 0 },
    );
  }, [libraries]);

  /* --- "Added this week" from metrics.recentActivity --- */
  const addedRecently = React.useMemo(() => {
    const cutoff = subDays(new Date(), RECENT_WINDOW_DAYS);
    return (metrics?.recentActivity ?? [])
      .filter((a) => {
        const d = new Date(a.date);
        return !Number.isNaN(d.getTime()) && isAfter(d, cutoff);
      })
      .reduce((sum, a) => sum + (a.tracksAdded || 0), 0);
  }, [metrics]);

  /* --- "In progress" playlists: recently touched and still short --- */
  const inProgress = React.useMemo(() => {
    const cutoff = subDays(new Date(), IN_PROGRESS_MAX_AGE_DAYS);
    const matches = playlists
      .filter((p) => {
        const count = p.stats?.numberOfTracks ?? 0;
        if (count < 1 || count > IN_PROGRESS_MAX_TRACKS) return false;
        const touched = p.updatedAt ? new Date(p.updatedAt) : null;
        return touched && !Number.isNaN(touched.getTime()) && isAfter(touched, cutoff);
      })
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      });
    const first = matches[0];
    return {
      count: matches.length,
      first:
        first && first.updatedAt
          ? {
              id: first.id,
              name: first.name,
              count: first.stats?.numberOfTracks ?? 0,
              updatedAt: first.updatedAt,
            }
          : null,
    };
  }, [playlists]);

  /* --- Loading / error / empty gates ---
   * The briefing reasons over libraries + metrics + playlists together, so a
   * failed playlists fetch must surface as an error too — otherwise it
   * silently reads as "0 playlists in progress" and the briefing confidently
   * says the wrong thing instead of showing a retry.
   */
  const coreLoading =
    librariesQuery.isPending || metricsQuery.isPending || playlistsQuery.isPending;
  const coreError = librariesQuery.isError || metricsQuery.isError || playlistsQuery.isError;
  const librariesReady = librariesQuery.isSuccess;
  const libraryEmpty = librariesReady && pipeline.total === 0;

  const briefing: Briefing = {
    addedRecently,
    needsAnalysis: pipeline.pending,
    inProgressPlaylist: inProgress.first,
  };

  const tiles: PipelineTile[] = [];
  if (!coreLoading) {
    // `/libraries` is where analysis progress and the "retry incomplete" action
    // actually live — `/pending` is the unrelated rating-triage queue.
    tiles.push({
      label: 'Need analysis',
      value: pipeline.pending,
      to: '/libraries',
      emphasis: pipeline.pending > 0,
    });
    // `/music` already defaults its sort to `fileCreatedAt desc` (newest first).
    tiles.push({ label: 'Added this week', value: addedRecently, to: '/music' });
    tiles.push({ label: 'Playlists in progress', value: inProgress.count, to: '/playlists' });
    if (pipeline.failed > 0) {
      tiles.push({
        label: 'Failed',
        value: pipeline.failed,
        to: '/libraries',
        destructive: true,
      });
    } else {
      tiles.push({ label: 'Analyzed', value: pipeline.analyzed, to: '/music' });
    }
  }

  /* --- First-run: no libraries or an empty library --- */
  if (librariesReady && (libraries.length === 0 || libraryEmpty)) {
    return (
      <PageShell>
        <PageHeader title="Home" />
        <div className="py-16">
          <NoData
            Icon={FolderPlus}
            title="Point Muzo at your music"
            subtitle="Add a music folder and run a scan. Muzo will analyze every track and start organizing your collection."
            buttonLabel="Add a library"
            buttonAction={() => void navigate({ to: '/libraries' })}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Home" description="Where your next crate-digging session starts." />

      {/* Briefing */}
      <section aria-labelledby="briefing-heading" className="flex flex-col gap-4">
        <h2 id="briefing-heading" className="sr-only">
          Session briefing
        </h2>
        {coreLoading ? (
          <BriefingSkeleton />
        ) : coreError ? (
          <SectionError
            label="your library status"
            onRetry={() => {
              void librariesQuery.refetch();
              void metricsQuery.refetch();
              void playlistsQuery.refetch();
            }}
          />
        ) : activeScan ? (
          // A scan is running — show live progress instead of a stale "start" CTA.
          <ScanningBriefing />
        ) : (
          <BriefingBlock briefing={briefing} />
        )}
      </section>

      {/* Pipeline */}
      {!coreError && (
        <section aria-labelledby="pipeline-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <SectionHeading id="pipeline-heading">Your library</SectionHeading>
            <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
              <Link to="/music/harmonic" preload="intent">
                <CircleDashed className="h-4 w-4" aria-hidden />
                Harmonic
              </Link>
            </Button>
          </div>
          {coreLoading ? <PipelineTilesSkeleton /> : <PipelineTiles tiles={tiles} />}
        </section>
      )}

      {/* Recently played — the crate leads here */}
      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <SectionHeading id="recent-heading">Recently played</SectionHeading>
          {recentlyPlayed.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/music" preload="intent">
                See all
              </Link>
            </Button>
          )}
        </div>
        {recentlyPlayedQuery.isError ? (
          <SectionError
            label="recently played"
            onRetry={() => void recentlyPlayedQuery.refetch()}
          />
        ) : (
          <HorizontalMusicCardList
            tracks={recentlyPlayed}
            isLoading={recentlyPlayedQuery.isPending}
            emptyMessage="Nothing played yet"
            emptySubtext="Play a track from Music or a playlist and it'll show up here."
          />
        )}
      </section>

      {/* Top genres */}
      <section aria-labelledby="genres-heading" className="flex flex-col gap-4">
        <SectionHeading id="genres-heading">Top genres</SectionHeading>
        {metricsQuery.isError ? (
          <SectionError label="top genres" onRetry={() => void metricsQuery.refetch()} />
        ) : metricsQuery.isPending ? (
          <TopGenresSkeleton />
        ) : (
          <TopGenres genres={metrics?.topGenres ?? []} />
        )}
      </section>
    </PageShell>
  );
}
