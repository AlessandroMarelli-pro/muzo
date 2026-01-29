import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// REST API client for non-GraphQL endpoints
class RestClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

export const restClient = new RestClient();

// Queue operations
export const useScanLibrary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (libraryId: string) => {
      const response = await restClient.post<{ message: string; sessionId: string }>(
        `/queue/scan-library/${libraryId}`,
      );
      return { ...response, libraryId };
    },
    onSuccess: (data) => {
      // Store sessionId for progress tracking
      if (data.sessionId) {
        queryClient.setQueryData(['scan-session', data.sessionId], {
          sessionId: data.sessionId,
          libraryId: data.libraryId,
          startedAt: new Date().toISOString(),
        });
      }
      // Invalidate library queries to refresh scan status
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
  });
};

export const useScanAllLibraries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await restClient.post<{ message: string }>(
        '/queue/scan-all-libraries',
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate library queries to refresh scan status
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
  });
};

export const useQueueStats = () => {
  return useQuery({
    queryKey: ['queue', 'stats'],
    queryFn: async () => {
      const response = await restClient.get<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
      }>('/queue/stats');
      return response;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

export const useClearQueue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await restClient.delete<{ message: string }>(
        '/queue/clear',
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
};

export const usePauseQueue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await restClient.post<{ message: string }>(
        '/queue/pause',
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
};

export const useResumeQueue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await restClient.post<{ message: string }>(
        '/queue/resume',
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
};

// Scan progress operations
export const useActiveScanSessions = () => {
  return useQuery({
    queryKey: ['scan-sessions', 'active'],
    queryFn: async () => {
      const response = await restClient.get<
        Array<{
          sessionId: string;
          status: string;
          totalBatches: number;
          completedBatches: number;
          totalTracks: number;
          completedTracks: number;
          failedTracks: number;
          startedAt: string;
          updatedAt: string;
          completedAt: string;
          overallProgress: number;
        }>
      >('/scan-progress/active');
      return response;
    },
    refetchInterval: 10000, // Refetch every 10 seconds to catch new sessions
  });
};

export const useCompletedScanSessions = () => {
  return useQuery({
    queryKey: ['scan-sessions', 'completed'],
    queryFn: async () => {
      const response = await restClient.get<
        Array<{
          sessionId: string;
          status: string;
          totalBatches: number;
          completedBatches: number;
          totalTracks: number;
          completedTracks: number;
          failedTracks: number;
          startedAt: string;
          updatedAt: string;
          completedAt: string;
          overallProgress: number;
        }>
      >('/scan-progress/completed');
      return response;
    },
  });
};