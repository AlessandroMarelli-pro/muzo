import { useQuery } from '@tanstack/react-query';

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

// Scan progress operations
export const useActiveScanSessions = () => {
  return useQuery({
    queryKey: ['scan-sessions', 'active'],
    queryFn: async () => {
      const response = await restClient.get<{
        data: Array<{
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
        }>;
      }>('/scan-progress/active');
      return response.data;
    },
    refetchInterval: 10000, // Refetch every 10 seconds to catch new sessions
  });
};

export const useCompletedScanSessions = () => {
  return useQuery({
    queryKey: ['scan-sessions', 'completed'],
    queryFn: async () => {
      const response = await restClient.get<{
        data: Array<{
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
        }>;
      }>('/scan-progress/completed');
      return response.data;
    },
  });
};
