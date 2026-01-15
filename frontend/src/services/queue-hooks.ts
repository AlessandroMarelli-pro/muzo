import { QueueItem, UpdateQueuePositionsInput } from '@/__generated__/types';
import { gql, graffleClient } from '@/services/graffle-client';
import { simpleMusicTrackFragment } from '@/services/playlist-hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// GraphQL Queries and Mutations
const GET_QUEUE = gql`
  ${simpleMusicTrackFragment}
  query GetQueue {
    queue {
      id
      trackId
      position
      createdAt
      updatedAt
      track {
        ...SimpleMusicTrackFragment
      }
    }
  }
`;

const ADD_TRACK_TO_QUEUE = gql`
  ${simpleMusicTrackFragment}
  mutation AddTrackToQueue($trackId: ID!) {
    addTrackToQueue(trackId: $trackId) {
      id
      trackId
      position
      createdAt
      updatedAt
      track {
        ...SimpleMusicTrackFragment
      }
    }
  }
`;

const REMOVE_TRACK_FROM_QUEUE = gql`
  mutation RemoveTrackFromQueue($trackId: ID!) {
    removeTrackFromQueue(trackId: $trackId)
  }
`;

const UPDATE_QUEUE_POSITIONS = gql`
  ${simpleMusicTrackFragment}
  mutation UpdateQueuePositions($input: UpdateQueuePositionsInput!) {
    updateQueuePositions(input: $input) {
      id
      trackId
      position
      createdAt
      updatedAt
      track {
        ...SimpleMusicTrackFragment
      }
    }
  }
`;

// Re-export QueueItem type for convenience
export type { QueueItem };

interface UpdateQueuePositionInput {
  trackId: string;
  position: number;
}

// Fetch functions
const fetchQueue = async (): Promise<QueueItem[]> => {
  const data = await graffleClient.request<{ queue: QueueItem[] }>(GET_QUEUE);
  return data.queue;
};

const addTrackToQueue = async (trackId: string): Promise<QueueItem> => {
  const data = await graffleClient.request<{ addTrackToQueue: QueueItem }>(
    ADD_TRACK_TO_QUEUE,
    { trackId },
  );
  return data.addTrackToQueue;
};

const removeTrackFromQueue = async (trackId: string): Promise<boolean> => {
  const data = await graffleClient.request<{
    removeTrackFromQueue: boolean;
  }>(REMOVE_TRACK_FROM_QUEUE, { trackId });
  return data.removeTrackFromQueue;
};

const updateQueuePositions = async (
  positions: UpdateQueuePositionInput[],
): Promise<QueueItem[]> => {
  const input: UpdateQueuePositionsInput = { positions };
  const data = await graffleClient.request<{
    updateQueuePositions: QueueItem[];
  }>(UPDATE_QUEUE_POSITIONS, {
    input,
  });
  return data.updateQueuePositions;
};

// Query keys
export const queueQueryKeys = {
  all: ['queue'] as const,
  queue: () => [...queueQueryKeys.all, 'items'] as const,
};

// Hooks
export function useQueue() {
  return useQuery<QueueItem[]>({
    queryKey: queueQueryKeys.queue(),
    queryFn: fetchQueue,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useAddTrackToQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addTrackToQueue,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
      toast.success(`Added "${data.track?.title || 'track'}" to queue`, {
        duration: 2000,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        'Failed to add track to queue';

      if (errorMessage.includes('already in the queue')) {
        toast.error('Track is already in the queue', {
          duration: 2000,
        });
      } else {
        toast.error(errorMessage, {
          duration: 3000,
        });
      }
    },
  });
}

export function useRemoveTrackFromQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeTrackFromQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
      toast.success('Removed track from queue', {
        duration: 2000,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        'Failed to remove track from queue';
      toast.error(errorMessage, {
        duration: 3000,
      });
    },
  });
}

export function useUpdateQueuePositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateQueuePositions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
      toast.success('Queue order updated', {
        duration: 2000,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        'Failed to update queue positions';
      toast.error(errorMessage, {
        duration: 3000,
      });
      // Refetch to get correct state
      queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
    },
  });
}
