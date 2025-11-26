import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Import components
import { LibraryDashboard } from '@/components/visualization/library-dashboard';
import { LibraryList } from '@/components/library/library-list';
import { TrackList } from '@/components/track/track-list';

// Import types
import type { MusicLibrary, MusicTrack } from '@/__generated__/types';

/**
 * Integration Tests: Component Integration
 *
 * These tests validate the integration between components and ensure
 * that components work together correctly in real-world scenarios.
 */

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe('Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Library Dashboard Integration', () => {
    it('should integrate all visualization components', () => {
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

      // Should render dashboard header
      expect(screen.getByText('Test Library Dashboard')).toBeInTheDocument();
      expect(
        screen.getByText('1 tracks • IDLE • Last updated'),
      ).toBeInTheDocument();

      // Should render quick stats
      expect(screen.getByText('Total Tracks')).toBeInTheDocument();
      expect(screen.getByText('Analyzed')).toBeInTheDocument();
      expect(screen.getByText('Genres')).toBeInTheDocument();
      expect(screen.getByText('Formats')).toBeInTheDocument();

      // Should render view navigation
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Insights')).toBeInTheDocument();

      // Should render overview content by default
      expect(screen.getByText('Library Statistics')).toBeInTheDocument();
    });

    it('should switch between different views', async () => {
      const user = userEvent.setup();
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

      // Switch to Analytics view
      const analyticsButton = screen.getByText('Analytics');
      await user.click(analyticsButton);

      expect(screen.getByText('Library Analytics')).toBeInTheDocument();
      expect(screen.getByText('1 tracks analyzed')).toBeInTheDocument();

      // Switch to Insights view
      const insightsButton = screen.getByText('Insights');
      await user.click(insightsButton);

      expect(screen.getByText('Library Insights')).toBeInTheDocument();
      expect(
        screen.getByText(
          'AI-powered recommendations and analysis for your music library',
        ),
      ).toBeInTheDocument();

      // Switch back to Overview
      const overviewButton = screen.getByText('Overview');
      await user.click(overviewButton);

      expect(screen.getByText('Library Statistics')).toBeInTheDocument();
    });

    it('should handle refresh functionality', async () => {
      const user = userEvent.setup();
      const mockOnRefresh = vi.fn();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <LibraryDashboard
            library={mockLibrary}
            tracks={[mockTrack]}
            isLoading={false}
            onRefresh={mockOnRefresh}
          />
        </TestWrapper>,
      );

      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it('should handle export functionality', async () => {
      const user = userEvent.setup();
      const mockOnExportData = vi.fn();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <LibraryDashboard
            library={mockLibrary}
            tracks={[mockTrack]}
            isLoading={false}
            onExportData={mockOnExportData}
          />
        </TestWrapper>,
      );

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      expect(mockOnExportData).toHaveBeenCalled();
    });
  });

  describe('Library Management Integration', () => {
    it('should handle library creation workflow', async () => {
      const user = userEvent.setup();
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

      // Should show empty state
      expect(screen.getByText('No Music Libraries Found')).toBeInTheDocument();

      // Click create library button
      const createButton = screen.getByText('Create Library');
      await user.click(createButton);

      expect(mockOnCreateLibrary).toHaveBeenCalled();
    });

    it('should handle library scanning workflow', async () => {
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

      // Should show library
      expect(screen.getByText('Test Library')).toBeInTheDocument();

      // Click scan button
      const scanButton = screen.getByText('Scan');
      await user.click(scanButton);

      expect(mockOnScanLibrary).toHaveBeenCalledWith('1');
    });

    it('should handle library viewing workflow', async () => {
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

      // Click view library button
      const viewButton = screen.getByText('View Library');
      await user.click(viewButton);

      expect(mockOnViewLibrary).toHaveBeenCalledWith('1');
    });
  });

  describe('Track Management Integration', () => {
    it('should handle track playback workflow', async () => {
      const user = userEvent.setup();
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

      // Should show track
      expect(screen.getByText('User Title')).toBeInTheDocument();

      // Click play button
      const playButton = screen.getByText('Play');
      await user.click(playButton);

      expect(mockOnPlay).toHaveBeenCalledWith('1');
    });

    it('should handle track editing workflow', async () => {
      const user = userEvent.setup();
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

      // Click edit button
      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith('1');
    });

    it('should handle track filtering workflow', async () => {
      const user = userEvent.setup();
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

      // Should show filter options
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should handle track sorting workflow', async () => {
      const user = userEvent.setup();
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

      // Should show sort options
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Artist')).toBeInTheDocument();
      expect(screen.getByText('Album')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <LibraryDashboard
            library={mockLibrary}
            tracks={[]}
            isLoading={false}
          />
        </TestWrapper>,
      );

      // Should still render dashboard even with API errors
      expect(screen.getByText('Test Library Dashboard')).toBeInTheDocument();
    });

    it('should handle empty data gracefully', () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <LibraryDashboard
            library={mockLibrary}
            tracks={[]}
            isLoading={false}
          />
        </TestWrapper>,
      );

      // Should show empty states appropriately
      expect(screen.getByText('Test Library Dashboard')).toBeInTheDocument();
    });

    it('should handle loading states gracefully', () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <LibraryDashboard
            library={mockLibrary}
            tracks={[]}
            isLoading={true}
          />
        </TestWrapper>,
      );

      // Should show loading states
      expect(screen.getByText('Library Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Loading library data...')).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', () => {
      const largeTrackList = Array.from({ length: 100 }, (_, i) => ({
        ...mockTrack,
        id: i.toString(),
        fileName: `track${i}.mp3`,
        userTitle: `Track ${i}`,
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

    it('should handle rapid user interactions', async () => {
      const user = userEvent.setup();
      const mockOnViewModeChange = vi.fn();
      const mockOnSortChange = vi.fn();
      const mockOnFilterChange = vi.fn();

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
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onEdit={vi.fn()}
          onMore={vi.fn()}
          onViewModeChange={mockOnViewModeChange}
          onSortChange={mockOnSortChange}
          onSortOrderChange={vi.fn()}
          onFilterChange={mockOnFilterChange}
          onSearchChange={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );

      // Rapidly switch between different options
      const listViewButton = screen.getByText('List');
      const gridViewButton = screen.getByText('Grid');
      const artistSortButton = screen.getByText('Artist');
      const completedFilterButton = screen.getByText('Completed');

      await user.click(listViewButton);
      await user.click(gridViewButton);
      await user.click(artistSortButton);
      await user.click(completedFilterButton);

      // All interactions should be handled
      expect(mockOnViewModeChange).toHaveBeenCalledTimes(2);
      expect(mockOnSortChange).toHaveBeenCalledTimes(1);
      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
    });
  });
});
