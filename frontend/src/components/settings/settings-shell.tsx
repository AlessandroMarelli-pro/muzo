import { SectionAnalysis } from '@/components/settings/section-analysis';
import { SectionDiscovery } from '@/components/settings/section-discovery';
import { SectionStreaming } from '@/components/settings/section-streaming';
import { SettingsDirtyProvider, useSettingsDirty } from '@/components/settings/use-settings-dirty';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { useAiServiceSettings } from '@/services/ai-service-hooks';
import { useIntegrationSettings } from '@/services/integration-settings-hooks';
import { useConnectedProviders } from '@/services/playlist-hooks';
import { Check, Compass, Radio, Waves } from 'lucide-react';
import * as React from 'react';

export type SettingsSection = 'analysis' | 'streaming' | 'discovery';

const SECTIONS: {
  id: SettingsSection;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'analysis', label: 'Analysis', blurb: 'Engine & enrichment', icon: Waves },
  { id: 'streaming', label: 'Streaming', blurb: 'Provider accounts', icon: Radio },
  { id: 'discovery', label: 'Discovery', blurb: 'Similar tracks', icon: Compass },
];

export function SettingsShell({
  section,
  onSectionChange,
}: {
  section: SettingsSection;
  onSectionChange: (s: SettingsSection) => void;
}) {
  return (
    <SettingsDirtyProvider>
      <PageShell className="max-w-5xl">
        <PageHeader
          title="Settings"
          description="Wire up the services Muzo works with — the analysis engine, streaming providers, and discovery."
        />
        <FirstRunNotice onSectionChange={onSectionChange} />
        <div className="grid gap-8 md:grid-cols-[13.5rem_minmax(0,1fr)] md:items-start">
          <SectionNav section={section} onSectionChange={onSectionChange} />
          {/*
            All three stay mounted and inactive ones are hidden, so switching
            sections never discards a half-typed key. The nav guard then only has
            to catch a real departure from the route (or a tab close).
          */}
          <div className="min-w-0">
            <div hidden={section !== 'analysis'}>
              <SectionAnalysis />
            </div>
            <div hidden={section !== 'streaming'}>
              <SectionStreaming />
            </div>
            <div hidden={section !== 'discovery'}>
              <SectionDiscovery />
            </div>
          </div>
        </div>
      </PageShell>
    </SettingsDirtyProvider>
  );
}

function SectionNav({
  section,
  onSectionChange,
}: {
  section: SettingsSection;
  onSectionChange: (s: SettingsSection) => void;
}) {
  const { dirtySections } = useSettingsDirty();

  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto rounded-lg bg-sidebar p-1.5 md:sticky md:top-6 md:flex-col md:overflow-visible"
    >
      {SECTIONS.map(({ id, label, blurb, icon: Icon }) => {
        const active = id === section;
        const dirty = dirtySections.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-sidebar-active text-sidebar-active-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {label}
                {dirty ? (
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      active ? 'bg-sidebar-active-foreground' : 'bg-primary',
                    )}
                    aria-label="unsaved changes"
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  'hidden text-xs md:block',
                  active ? 'text-sidebar-active-foreground/75' : 'text-muted-foreground',
                )}
              >
                {blurb}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * A fresh self-hosted install lands here with nothing configured. Rather than a
 * wall of empty fields, sequence the one thing that matters: analysis runs with
 * zero keys, so "you're ready" is the honest first message — everything else is
 * optional polish.
 */
function FirstRunNotice({ onSectionChange }: { onSectionChange: (s: SettingsSection) => void }) {
  const { settings: ai } = useAiServiceSettings();
  const { settings: integration } = useIntegrationSettings();

  const { providers: connected } = useConnectedProviders();
  const dismissed = useDismissed('muzo.settings.firstRunDismissed');

  if (!ai || !integration || dismissed.value) return null;

  const engineReachable = ai.health?.overall ?? false;
  const anyConfig =
    ai.hasGeminiApiKey ||
    ai.hasHfToken ||
    ai.hasLastfmApiKey ||
    ai.hasDiscogsApiKeys ||
    ai.hasAuthToken ||
    ai.mode === 'remote' ||
    integration.hasCosineApiKey ||
    integration.hasSpotifyClientId ||
    integration.hasTidalClientId ||
    integration.hasYoutubeClientId ||
    connected.length > 0;

  // Only sequence a genuinely untouched install; once anything is wired up this is noise.
  if (anyConfig) return null;

  return (
    <div className="rounded-xl bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Getting started</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Muzo analyses your library with no keys at all. Add the rest when you want more.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissed.dismiss}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:no-underline"
        >
          Dismiss
        </button>
      </div>
      <ol className="mt-4 space-y-3">
        <FirstRunStep
          n={1}
          done={engineReachable}
          title="Confirm the analysis engine is running"
          action={{ label: 'Open Analysis', onClick: () => onSectionChange('analysis') }}
        >
          {engineReachable
            ? 'The engine is reachable — you can start scanning.'
            : 'Local mode runs it in a container; check it under Analysis.'}
        </FirstRunStep>
        <FirstRunStep
          n={2}
          done={false}
          title="Add enrichment keys (optional)"
          action={{ label: 'Open Analysis', onClick: () => onSectionChange('analysis') }}
        >
          Filename cleaning, genre data and album art each need one key.
        </FirstRunStep>
        <FirstRunStep
          n={3}
          done={false}
          title="Connect a streaming account (optional)"
          action={{ label: 'Open Streaming', onClick: () => onSectionChange('streaming') }}
        >
          Push finished playlists to Spotify, TIDAL or YouTube.
        </FirstRunStep>
      </ol>
    </div>
  );
}

function FirstRunStep({
  n,
  done,
  title,
  children,
  action,
}: {
  n: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
  action: { label: string; onClick: () => void };
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          done ? 'bg-success-surface text-success-foreground' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {done ? <Check className="size-3" /> : n}
      </span>
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium">{title}</span>
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs font-medium text-primary underline underline-offset-4 hover:no-underline"
          >
            {action.label}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function useDismissed(key: string) {
  const [value, setValue] = React.useState(false);
  React.useEffect(() => {
    try {
      setValue(window.localStorage.getItem(key) === '1');
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  const dismiss = React.useCallback(() => {
    setValue(true);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  return { value, dismiss };
}
