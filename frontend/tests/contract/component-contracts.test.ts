import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Import components to test
import { LibraryCard } from '@/components/library/library-card';
import { LibraryList } from '@/components/library/library-list';
import { CreateLibraryDialog } from '@/components/library/create-library-dialog';
import { TrackCard } from '@/components/track/track-card';
import { TrackList } from '@/components/track/track-list';
import { TrackDetails } from '@/components/track/track-details';
import { LibraryStats } from '@/components/visualization/library-stats';
import { LibraryChart } from '@/components/visualization/library-chart';
import { LibraryInsights } from '@/components/visualization/library-insights';
import { LibraryDashboard } from '@/components/visualization/library-dashboard';

// Import types
import type { MusicLibrary, MusicTrack } from '@/__generated__/types';
import { AnalysisStatus, LibraryScanStatus } from '@/services/api-hooks';

/**
 * Contract Tests: React Components
 *
 * These tests validate that React components follow the defined contracts
 * and maintain expected behavior. Tests ensure components render correctly,
 * handle props properly, and respond to user interactions as expected.
 */

// Test wrapper with QueryClient
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// Mock data
const mockLibrary: MusicLibrary = {
  id: '1',
  name: 'Test Library',
  rootPath: '/test/path',
  totalTracks: 100,
  analyzedTracks: 80,
  pendingTracks: 15,
  failedTracks: 5,
  lastScanAt: '2024-01-01T00:00:00Z',
  lastIncrementalScanAt: '2024-01-01T00:00:00Z',
  scanStatus: 'IDLE',
  settings: {
    autoScan: true,
    scanInterval: 24,
    includeSubdirectories: true,
    supportedFormats: ['MP3', 'FLAC'],
    maxFileSize: 100000000,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockTrack: MusicTrack = {
  id: '1',
  filePath: '/test/path/track.mp3',
  fileName: 'track.mp3',
  fileSize: 5000000,
  duration: 180,
  format: 'MP3',
  bitrate: 320,
  sampleRate: 44100,
  originalTitle: 'Original Title',
  originalArtist: 'Original Artist',
  originalAlbum: 'Original Album',
  originalGenre: 'Rock',
  originalYear: 2020,
  aiTitle: 'AI Title',
  aiArtist: 'AI Artist',
  aiAlbum: 'AI Album',
  aiGenre: 'Alternative Rock',
  aiConfidence: 0.85,
  userTitle: 'User Title',
  userArtist: 'User Artist',
  userAlbum: 'User Album',
  userGenre: 'Indie Rock',
  userTags: ['favorite', 'chill'],
  listeningCount: 25,
  lastPlayedAt: '2024-01-01T00:00:00Z',
  analysisStatus: 'COMPLETED',
  analysisStartedAt: '2024-01-01T00:00:00Z',
  analysisCompletedAt: '2024-01-01T00:00:00Z',
  analysisError: null,
  library: mockLibrary,
  audioFingerprint: undefined,
  analysisResult: undefined,
  editorSession: undefined,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('Component Contract Tests', () => {
  describe('Library Components', () => {
    describe('LibraryCard', () => {
      it('should render library information correctly', () => {
        const mockOnScan = vi.fn();
        const mockOnView = vi.fn();
        const mockOnPlay = vi.fn();

        render(
          <LibraryCard
            library={mockLibrary}
            onScan={mockOnScan}
            onView={mockOnView}
            onPlay={mockOnPlay}
          />,
        );

        expect(screen.getByText('Test Library')).toBeInTheDocument();
        expect(screen.getByText('/test/path')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument(); // Total tracks
        expect(screen.getByText('80')).toBeInTheDocument(); // Analyzed tracks
      });

      it('should call onScan when scan button is clicked', async () => {
        const user = userEvent.setup();
        const mockOnScan = vi.fn();
        const mockOnView = vi.fn();
        const mockOnPlay = vi.fn();

        render(
          <LibraryCard
            library={mockLibrary}
            onScan={mockOnScan}
            onView={mockOnView}
            onPlay={mockOnPlay}
          />,
        );

        const scanButton = screen.getByText('Scan');
        await user.click(scanButton);

        expect(mockOnScan).toHaveBeenCalledWith('1');
      });

      it('should call onView when view button is clicked', async () => {
        const user = userEvent.setup();
        const mockOnScan = vi.fn();
        const mockOnView = vi.fn();
        const mockOnPlay = vi.fn();

        render(
          <LibraryCard
            library={mockLibrary}
            onScan={mockOnScan}
            onView={mockOnView}
            onPlay={mockOnPlay}
          />,
        );

        const viewButton = screen.getByText('View Library');
        await user.click(viewButton);

        expect(mockOnView).toHaveBeenCalledWith('1');
      });

      it('should display analysis progress correctly', () => {
        const mockOnScan = vi.fn();
        const mockOnView = vi.fn();
        const mockOnPlay = vi.fn();

        render(
          <LibraryCard
            library={mockLibrary}
            onScan={mockOnScan}
            onView={mockOnView}
            onPlay={mockOnPlay}
          />,
        );

        // Should show 80% progress (80 analyzed out of 100 total)
        expect(screen.getByText('80%')).toBeInTheDocument();
      });

      it('should disable scan button when library is scanning', () => {
        const scanningLibrary = {
          ...mockLibrary,
          scanStatus: 'SCANNING' as const,
        };
        const mockOnScan = vi.fn();
        const mockOnView = vi.fn();
        const mockOnPlay = vi.fn();

        render(
          <LibraryCard
            library={scanningLibrary}
            onScan={mockOnScan}
            onView={mockOnView}
            onPlay={mockOnPlay}
          />,
        );

        const scanButton = screen.getByText('Scan');
        expect(scanButton).toBeDisabled();
      });
    });

    describe('LibraryList', () => {
      it('should render libraries in grid layout', () => {
        const mockOnCreateLibrary = vi.fn();
        const mockOnScanLibrary = vi.fn();
        const mockOnViewLibrary = vi.fn();
        const mockOnPlayLibrary = vi.fn();
        const mockOnRefresh = vi.fn();

        render(
          <LibraryList
            libraries={[mockLibrary]}
            isLoading={false}
            onCreateLibrary={mockOnCreateLibrary}
            onScanLibrary={mockOnScanLibrary}
            onViewLibrary={mockOnViewLibrary}
            onPlayLibrary={mockOnPlayLibrary}
            onRefresh={mockOnRefresh}
          />,
        );

        expect(screen.getByText('Music Libraries')).toBeInTheDocument();
        expect(screen.getByText('1 library found')).toBeInTheDocument();
        expect(screen.getByText('Test Library')).toBeInTheDocument();
      });

      it('should show empty state when no libraries', () => {
        const mockOnCreateLibrary = vi.fn();
        const mockOnScanLibrary = vi.fn();
        const mockOnViewLibrary = vi.fn();
        const mockOnPlayLibrary = vi.fn();
        const mockOnRefresh = vi.fn();

        render(
          <LibraryList
            libraries={[]}
            isLoading={false}
            onCreateLibrary={mockOnCreateLibrary}
            onScanLibrary={mockOnScanLibrary}
            onViewLibrary={mockOnViewLibrary}
            onPlayLibrary={mockOnPlayLibrary}
            onRefresh={mockOnRefresh}
          />,
        );

        expect(
          screen.getByText('No Music Libraries Found'),
        ).toBeInTheDocument();
        expect(screen.getByText('Create Library')).toBeInTheDocument();
      });

      it('should show loading state', () => {
        const mockOnCreateLibrary = vi.fn();
        const mockOnScanLibrary = vi.fn();
        const mockOnViewLibrary = vi.fn();
        const mockOnPlayLibrary = vi.fn();
        const mockOnRefresh = vi.fn();

        render(
          <LibraryList
            libraries={[]}
            isLoading={true}
            onCreateLibrary={mockOnCreateLibrary}
            onScanLibrary={mockOnScanLibrary}
            onViewLibrary={mockOnViewLibrary}
            onPlayLibrary={mockOnPlayLibrary}
            onRefresh={mockOnRefresh}
          />,
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    describe('CreateLibraryDialog', () => {
      it('should render form fields correctly', () => {
        const mockOnClose = vi.fn();
        const mockOnSubmit = vi.fn();

        render(
          <CreateLibraryDialog
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isLoading={false}
          />,
        );

        expect(
          screen.getByText('Create New Music Library'),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Library Name *')).toBeInTheDocument();
        expect(screen.getByLabelText('Root Path *')).toBeInTheDocument();
        expect(screen.getByText('Auto-scan')).toBeInTheDocument();
        expect(screen.getByText('Include Subdirectories')).toBeInTheDocument();
      });

      it('should validate required fields', async () => {
        const user = userEvent.setup();
        const mockOnClose = vi.fn();
        const mockOnSubmit = vi.fn();

        render(
          <CreateLibraryDialog
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isLoading={false}
          />,
        );

        const submitButton = screen.getByText('Create Library');
        await user.click(submitButton);

        expect(
          screen.getByText('Library name is required'),
        ).toBeInTheDocument();
        expect(screen.getByText('Root path is required')).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });

      it('should call onSubmit with valid data', async () => {
        const user = userEvent.setup();
        const mockOnClose = vi.fn();
        const mockOnSubmit = vi.fn();

        render(
          <CreateLibraryDialog
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isLoading={false}
          />,
        );

        await user.type(screen.getByLabelText('Library Name *'), 'My Library');
        await user.type(screen.getByLabelText('Root Path *'), '/music/path');

        const submitButton = screen.getByText('Create Library');
        await user.click(submitButton);

        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'My Library',
          rootPath: '/music/path',
          autoScan: true,
          scanInterval: 24,
          includeSubdirectories: true,
          supportedFormats: ['MP3', 'FLAC', 'WAV', 'AAC', 'OGG'],
          maxFileSize: 104857600,
        });
      });
    });
  });

  describe('Track Components', () => {
    describe('TrackCard', () => {
      it('should render track information correctly', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();

        render(
          <TrackCard
            track={mockTrack}
            isPlaying={false}
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
          />,
        );

        expect(screen.getByText('User Title')).toBeInTheDocument();
        expect(screen.getByText('User Artist')).toBeInTheDocument();
        expect(screen.getByText('User Album')).toBeInTheDocument();
        expect(screen.getByText('3:00')).toBeInTheDocument(); // Duration
        expect(screen.getByText('MP3')).toBeInTheDocument();
      });

      it('should show play button when not playing', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();

        render(
          <TrackCard
            track={mockTrack}
            isPlaying={false}
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
          />,
        );

        expect(screen.getByText('Play')).toBeInTheDocument();
      });

      it('should show pause button when playing', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();

        render(
          <TrackCard
            track={mockTrack}
            isPlaying={true}
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
          />,
        );

        expect(screen.getByText('Pause')).toBeInTheDocument();
      });

      it('should display AI confidence when available', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();

        render(
          <TrackCard
            track={mockTrack}
            isPlaying={false}
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
          />,
        );

        expect(screen.getByText('85%')).toBeInTheDocument(); // AI confidence
      });

      it('should show analysis status badge', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();

        render(
          <TrackCard
            track={mockTrack}
            isPlaying={false}
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
          />,
        );

        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      });
    });

    describe('TrackList', () => {
      it('should render tracks in grid layout', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();
        const mockOnViewModeChange = vi.fn();
        const mockOnSortChange = vi.fn();
        const mockOnSortOrderChange = vi.fn();
        const mockOnFilterChange = vi.fn();
        const mockOnSearchChange = vi.fn();
        const mockOnRefresh = vi.fn();

        render(
          <TrackList
            tracks={[mockTrack]}
            isLoading={false}
            currentPlayingTrackId={undefined}
            isPlaying={false}
            viewMode="grid"
            sortBy="title"
            sortOrder="asc"
            filterStatus="all"
            searchQuery=""
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
            onViewModeChange={mockOnViewModeChange}
            onSortChange={mockOnSortChange}
            onSortOrderChange={mockOnSortOrderChange}
            onFilterChange={mockOnFilterChange}
            onSearchChange={mockOnSearchChange}
            onRefresh={mockOnRefresh}
          />,
        );

        expect(screen.getByText('Music Tracks')).toBeInTheDocument();
        expect(screen.getByText('1 track found')).toBeInTheDocument();
        expect(screen.getByText('User Title')).toBeInTheDocument();
      });

      it('should show empty state when no tracks', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();
        const mockOnViewModeChange = vi.fn();
        const mockOnSortChange = vi.fn();
        const mockOnSortOrderChange = vi.fn();
        const mockOnFilterChange = vi.fn();
        const mockOnSearchChange = vi.fn();
        const mockOnRefresh = vi.fn();

        render(
          <TrackList
            tracks={[]}
            isLoading={false}
            currentPlayingTrackId={undefined}
            isPlaying={false}
            viewMode="grid"
            sortBy="title"
            sortOrder="asc"
            filterStatus="all"
            searchQuery=""
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
            onViewModeChange={mockOnViewModeChange}
            onSortChange={mockOnSortChange}
            onSortOrderChange={mockOnSortOrderChange}
            onFilterChange={mockOnFilterChange}
            onSearchChange={mockOnSearchChange}
            onRefresh={mockOnRefresh}
          />,
        );

        expect(screen.getByText('No Tracks Found')).toBeInTheDocument();
      });

      it('should show loading state', () => {
        const mockOnPlay = vi.fn();
        const mockOnPause = vi.fn();
        const mockOnEdit = vi.fn();
        const mockOnMore = vi.fn();
        const mockOnViewModeChange = vi.fn();
        const mockOnSortChange = vi.fn();
        const mockOnSortOrderChange = vi.fn();
        const mockOnFilterChange = vi.fn();
        const mockOnSearchChange = vi.fn();
        const mockOnRefresh = vi.fn();

        render(
          <TrackList
            tracks={[]}
            isLoading={true}
            currentPlayingTrackId={undefined}
            isPlaying={false}
            viewMode="grid"
            sortBy="title"
            sortOrder="asc"
            filterStatus="all"
            searchQuery=""
            onPlay={mockOnPlay}
            onPause={mockOnPause}
            onEdit={mockOnEdit}
            onMore={mockOnMore}
            onViewModeChange={mockOnViewModeChange}
            onSortChange={mockOnSortChange}
            onSortOrderChange={mockOnSortOrderChange}
            onFilterChange={mockOnFilterChange}
            onSearchChange={mockOnSearchChange}
            onRefresh={mockOnRefresh}
          />,
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });
  });

  describe('Visualization Components', () => {
    describe('LibraryStats', () => {
      it('should render statistics correctly', () => {
        render(
          <LibraryStats
            library={mockLibrary}
            tracks={[mockTrack]}
            isLoading={false}
          />,
        );

        expect(screen.getByText('Library Statistics')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument(); // Total tracks
        expect(screen.getByText('3:00')).toBeInTheDocument(); // Total duration
        expect(screen.getByText('1')).toBeInTheDocument(); // Analyzed tracks
      });

      it('should show loading state', () => {
        render(
          <LibraryStats library={mockLibrary} tracks={[]} isLoading={true} />,
        );

        expect(screen.getByText('Library Statistics')).toBeInTheDocument();
        // Should show loading skeletons
        expect(document.querySelectorAll('.animate-pulse')).toHaveLength(8);
      });
    });

    describe('LibraryChart', () => {
      it('should render charts correctly', () => {
        render(<LibraryChart tracks={[mockTrack]} isLoading={false} />);

        expect(screen.getByText('Library Analytics')).toBeInTheDocument();
        expect(screen.getByText('1 tracks analyzed')).toBeInTheDocument();
      });

      it('should show empty state when no tracks', () => {
        render(<LibraryChart tracks={[]} isLoading={false} />);

        expect(screen.getByText('No Data Available')).toBeInTheDocument();
        expect(
          screen.getByText(
            'Add some tracks to see analytics and visualizations.',
          ),
        ).toBeInTheDocument();
      });

      it('should show loading state', () => {
        render(<LibraryChart tracks={[]} isLoading={true} />);

        expect(screen.getByText('Library Analytics')).toBeInTheDocument();
        // Should show loading skeletons
        expect(document.querySelectorAll('.animate-pulse')).toHaveLength(4);
      });
    });

    describe('LibraryInsights', () => {
      it('should render insights correctly', () => {
        render(
          <LibraryInsights
            library={mockLibrary}
            tracks={[mockTrack]}
            isLoading={false}
          />,
        );

        expect(screen.getByText('Library Insights')).toBeInTheDocument();
        expect(
          screen.getByText(
            'AI-powered recommendations and analysis for your music library',
          ),
        ).toBeInTheDocument();
      });

      it('should show empty state when no tracks', () => {
        render(
          <LibraryInsights
            library={mockLibrary}
            tracks={[]}
            isLoading={false}
          />,
        );

        expect(screen.getByText('No Insights Available')).toBeInTheDocument();
        expect(
          screen.getByText(
            'Add more tracks to your library to get personalized insights and recommendations.',
          ),
        ).toBeInTheDocument();
      });

      it('should show loading state', () => {
        render(
          <LibraryInsights
            library={mockLibrary}
            tracks={[]}
            isLoading={true}
          />,
        );

        expect(screen.getByText('Library Insights')).toBeInTheDocument();
        // Should show loading skeletons
        expect(document.querySelectorAll('.animate-pulse')).toHaveLength(4);
      });
    });

    describe('LibraryDashboard', () => {
      it('should render dashboard correctly', () => {
        render(
          <LibraryDashboard
            library={mockLibrary}
            tracks={[mockTrack]}
            isLoading={false}
          />,
        );

        expect(screen.getByText('Test Library Dashboard')).toBeInTheDocument();
        expect(
          screen.getByText('1 tracks • IDLE • Last updated'),
        ).toBeInTheDocument();
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Insights')).toBeInTheDocument();
      });

      it('should switch between views', async () => {
        const user = userEvent.setup();

        render(
          <LibraryDashboard
            library={mockLibrary}
            tracks={[mockTrack]}
            isLoading={false}
          />,
        );

        const analyticsButton = screen.getByText('Analytics');
        await user.click(analyticsButton);

        expect(screen.getByText('Library Analytics')).toBeInTheDocument();
      });

      it('should show loading state', () => {
        render(
          <LibraryDashboard
            library={mockLibrary}
            tracks={[]}
            isLoading={true}
          />,
        );

        expect(screen.getByText('Library Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Loading library data...')).toBeInTheDocument();
      });
    });
  });

  describe('Component Integration', () => {
    it('should handle component composition correctly', () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <LibraryDashboard
            library={mockLibrary}
            tracks={[mockTrack]}
            isLoading={false}
          />
        </TestWrapper>,
      );

      expect(screen.getByText('Test Library Dashboard')).toBeInTheDocument();
    });

    it('should handle error states gracefully', () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <LibraryStats library={mockLibrary} tracks={[]} isLoading={false} />
        </TestWrapper>,
      );

      expect(screen.getByText('Library Statistics')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Total tracks
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const mockOnScan = vi.fn();
      const mockOnView = vi.fn();
      const mockOnPlay = vi.fn();

      render(
        <LibraryCard
          library={mockLibrary}
          onScan={mockOnScan}
          onView={mockOnView}
          onPlay={mockOnPlay}
        />,
      );

      const scanButton = screen.getByText('Scan');
      expect(scanButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnCreateLibrary = vi.fn();
      const mockOnScanLibrary = vi.fn();
      const mockOnViewLibrary = vi.fn();
      const mockOnPlayLibrary = vi.fn();
      const mockOnRefresh = vi.fn();

      render(
        <LibraryList
          libraries={[mockLibrary]}
          isLoading={false}
          onCreateLibrary={mockOnCreateLibrary}
          onScanLibrary={mockOnScanLibrary}
          onViewLibrary={mockOnViewLibrary}
          onPlayLibrary={mockOnPlayLibrary}
          onRefresh={mockOnRefresh}
        />,
      );

      const createButton = screen.getByText('Create Library');
      await user.tab();
      expect(createButton).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should render components within acceptable time', () => {
      const startTime = performance.now();

      render(
        <LibraryCard
          library={mockLibrary}
          onScan={vi.fn()}
          onView={vi.fn()}
          onPlay={vi.fn()}
        />,
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle large datasets efficiently', () => {
      const largeTrackList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTrack,
        id: i.toString(),
        fileName: `track${i}.mp3`,
      }));

      const startTime = performance.now();

      render(
        <TrackList
          tracks={largeTrackList}
          isLoading={false}
          currentPlayingTrackId={undefined}
          isPlaying={false}
          viewMode="grid"
          sortBy="title"
          sortOrder="asc"
          filterStatus="all"
          searchQuery=""
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onEdit={vi.fn()}
          onMore={vi.fn()}
          onViewModeChange={vi.fn()}
          onSortChange={vi.fn()}
          onSortOrderChange={vi.fn()}
          onFilterChange={vi.fn()}
          onSearchChange={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 500ms even with large dataset
      expect(renderTime).toBeLessThan(500);
    });
  });
});
