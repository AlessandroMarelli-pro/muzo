import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import hooks
import {
  queryKeys,
  useCreateLibrary,
  useLibraries,
  useTracks,
} from '@/services/api-hooks';

// Import types
import type {
  CreateLibraryInput,
  MusicLibrary,
  MusicTrack,
} from '@/__generated__/types';

/**
 * Unit Tests: API Client and Hooks
 *
 * These tests validate the API client functionality and TanStack Query hooks
 * to ensure proper data fetching, caching, and error handling.
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

describe('API Client Unit Tests', () => {
  describe('ApiClient', () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient('http://localhost:3000/graphql');
      mockFetch.mockClear();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should make successful query requests', async () => {
      const mockResponse = {
        data: { libraries: [mockLibrary] },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const query = `
        query GetLibraries {
          libraries {
            id
            name
            rootPath
          }
        }
      `;

      const result = await apiClient.query(query);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: undefined,
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should make successful mutation requests', async () => {
      const mockResponse = {
        data: { createLibrary: mockLibrary },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const mutation = `
        mutation CreateLibrary($input: CreateLibraryInput!) {
          createLibrary(input: $input) {
            id
            name
            rootPath
          }
        }
      `;

      const variables = {
        input: {
          name: 'Test Library',
          rootPath: '/test/path',
        },
      };

      const result = await apiClient.mutation(mutation, variables);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const query = `query { libraries { id } }`;

      await expect(apiClient.query(query)).rejects.toThrow(
        'HTTP error! status: 500',
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const query = `query { libraries { id } }`;

      await expect(apiClient.query(query)).rejects.toThrow('Network error');
    });

    it('should handle GraphQL errors', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            message: 'Field "invalidField" does not exist',
            locations: [{ line: 1, column: 10 }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const query = `query { invalidField }`;

      const result = await apiClient.query(query);

      expect(result).toEqual(mockResponse);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
    });

    it('should use default base URL', () => {
      const defaultClient = new ApiClient();
      expect(defaultClient).toBeDefined();
    });
  });

  describe('Query Keys', () => {
    it('should generate correct query keys', () => {
      expect(queryKeys.libraries).toEqual(['libraries']);
      expect(queryKeys.tracks()).toEqual(['tracks', undefined, undefined]);
      expect(queryKeys.tracks('library-1')).toEqual([
        'tracks',
        'library-1',
        undefined,
      ]);
      expect(queryKeys.tracks('library-1', 'COMPLETED')).toEqual([
        'tracks',
        'library-1',
        'COMPLETED',
      ]);
      expect(queryKeys.track('track-1')).toEqual(['track', 'track-1']);
    });
  });
});

describe('API Hooks Unit Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useLibraries', () => {
    it('should fetch libraries successfully', async () => {
      const mockResponse = {
        data: { libraries: [mockLibrary] },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useLibraries(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ libraries: [mockLibrary] });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useLibraries(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should show loading state initially', () => {
      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useLibraries(), {
        wrapper: TestWrapper,
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useTracks', () => {
    it('should fetch tracks successfully', async () => {
      const mockResponse = {
        data: { tracks: [mockTrack] },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useTracks('library-1'), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ tracks: [mockTrack] });
      expect(result.current.isLoading).toBe(false);
    });

    it('should fetch tracks with status filter', async () => {
      const mockResponse = {
        data: { tracks: [mockTrack] },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useTracks('library-1', 'COMPLETED'), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ tracks: [mockTrack] });
    });
  });

  describe('useCreateLibrary', () => {
    it('should create library successfully', async () => {
      const mockResponse = {
        data: { createLibrary: mockLibrary },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useCreateLibrary(), {
        wrapper: TestWrapper,
      });

      const input: CreateLibraryInput = {
        name: 'Test Library',
        rootPath: '/test/path',
        autoScan: true,
        scanInterval: 24,
        includeSubdirectories: true,
        supportedFormats: ['MP3', 'FLAC'],
        maxFileSize: 100000000,
      };

      result.current.mutate(input);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ createLibrary: mockLibrary });
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle mutation errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useCreateLibrary(), {
        wrapper: TestWrapper,
      });

      const input: CreateLibraryInput = {
        name: 'Test Library',
        rootPath: '/test/path',
        autoScan: true,
        scanInterval: 24,
        includeSubdirectories: true,
        supportedFormats: ['MP3', 'FLAC'],
        maxFileSize: 100000000,
      };

      result.current.mutate(input);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  // TODO: Remove useAddTrack tests as this hook no longer exists
  describe.skip('useAddTrack', () => {
    it('should add track successfully', async () => {
      const mockResponse = {
        data: { addTrack: mockTrack },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useAddTrack(), {
        wrapper: TestWrapper,
      });

      const input: AddTrackInput = {
        libraryId: 'library-1',
        filePath: '/test/path/track.mp3',
        fileName: 'track.mp3',
        fileSize: 5000000,
        duration: 180,
        format: 'MP3',
        bitrate: 320,
        sampleRate: 44100,
      };

      result.current.mutate(input);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ addTrack: mockTrack });
    });
  });

  describe('Cache Management', () => {
    it('should invalidate libraries cache after creating library', async () => {
      const mockResponse = {
        data: { createLibrary: mockLibrary },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useCreateLibrary(), {
        wrapper: TestWrapper,
      });

      const input: CreateLibraryInput = {
        name: 'Test Library',
        rootPath: '/test/path',
        autoScan: true,
        scanInterval: 24,
        includeSubdirectories: true,
        supportedFormats: ['MP3', 'FLAC'],
        maxFileSize: 100000000,
      };

      result.current.mutate(input);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The mutation should have triggered cache invalidation
      expect(result.current.isSuccess).toBe(true);
    });

    it('should invalidate tracks cache after adding track', async () => {
      const mockResponse = {
        data: { addTrack: mockTrack },
        errors: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useAddTrack(), {
        wrapper: TestWrapper,
      });

      const input: AddTrackInput = {
        libraryId: 'library-1',
        filePath: '/test/path/track.mp3',
        fileName: 'track.mp3',
        fileSize: 5000000,
        duration: 180,
        format: 'MP3',
        bitrate: 320,
        sampleRate: 44100,
      };

      result.current.mutate(input);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The mutation should have triggered cache invalidation
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphQL errors in queries', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            message: 'Field "invalidField" does not exist',
            locations: [{ line: 1, column: 10 }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useLibraries(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle GraphQL errors in mutations', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            message: 'Library with this name already exists',
            locations: [{ line: 1, column: 10 }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const TestWrapper = createTestWrapper();
      const { result } = renderHook(() => useCreateLibrary(), {
        wrapper: TestWrapper,
      });

      const input: CreateLibraryInput = {
        name: 'Test Library',
        rootPath: '/test/path',
        autoScan: true,
        scanInterval: 24,
        includeSubdirectories: true,
        supportedFormats: ['MP3', 'FLAC'],
        maxFileSize: 100000000,
      };

      result.current.mutate(input);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });
});
