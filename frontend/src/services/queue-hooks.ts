import {
  QueueItem,
  RemoveTrackFromQueueResponse,
  UpdateQueuePositionsInput,
} from "@/__generated__/types";
import { capitalizeEveryWord } from "@/lib/utils";
import { trackFragment } from "@/services/fragments";
import { gql, graffleClient } from "@/services/graffle-client";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// GraphQL Queries and Mutations
const GET_QUEUE = gql`
  ${trackFragment}
  query GetQueue {
    me {
      queue {
        id
        trackId
        position
        createdAt
        updatedAt
        track {
          ...TrackFragment
        }
      }
    }
  }
`;

const ADD_TRACK_TO_QUEUE = gql`
  ${trackFragment}
  mutation AddTrackToQueue($trackId: Base64ID!) {
    addTrackToQueue(trackId: $trackId) {
      id
      trackId
      position
      createdAt
      updatedAt
      track {
        ...TrackFragment
      }
    }
  }
`;
const ADD_TRACKS_TO_QUEUE = gql`
  ${trackFragment}
  mutation AddTracksToQueue($trackIds: [Base64ID!]!) {
    addTracksToQueue(trackIds: $trackIds) {
      id
      trackId
      position
      createdAt
      updatedAt
      track {
        ...TrackFragment
      }
    }
  }
`;

const REMOVE_TRACK_FROM_QUEUE = gql`
  mutation RemoveTrackFromQueue($trackId: Base64ID!) {
    removeTrackFromQueue(trackId: $trackId) {
      success
      trackId
      artist
      title
    }
  }
`;

const UPDATE_QUEUE_POSITIONS = gql`
  ${trackFragment}
  mutation UpdateQueuePositions($input: UpdateQueuePositionsInput!) {
    updateQueuePositions(input: $input) {
      id
      trackId
      position
      createdAt
      updatedAt
      track {
        ...TrackFragment
      }
    }
  }
`;

export const RESET_QUEUE = gql`
  mutation ResetQueue {
    resetQueue
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
  const data = await graffleClient.request<{ me: { queue: QueueItem[] } }>(GET_QUEUE);
  return data.me.queue;
};

const addTrackToQueue = async (trackId: string): Promise<QueueItem> => {
  const data = await graffleClient.request<{ addTrackToQueue: QueueItem }>(ADD_TRACK_TO_QUEUE, {
    trackId,
  });
  return data.addTrackToQueue;
};

const addTracksToQueue = async (trackIds: string[]): Promise<QueueItem[]> => {
  const data = await graffleClient.request<{ addTracksToQueue: QueueItem[] }>(ADD_TRACKS_TO_QUEUE, {
    trackIds,
  });
  return data.addTracksToQueue;
};
const removeTrackFromQueue = async (trackId: string): Promise<RemoveTrackFromQueueResponse> => {
  const data = await graffleClient.request<{
    removeTrackFromQueue: RemoveTrackFromQueueResponse;
  }>(REMOVE_TRACK_FROM_QUEUE, { trackId });
  return data.removeTrackFromQueue;
};

const resetQueue = async (): Promise<boolean> => {
  const data = await graffleClient.request<{ resetQueue: boolean }>(RESET_QUEUE);
  return data.resetQueue;
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
  all: ["queue"] as const,
  queue: () => [...queueQueryKeys.all, "items"] as const,
};

// Hooks
export function useQueue() {
  return useQuery<QueueItem[]>({
    queryKey: queueQueryKeys.queue(),
    queryFn: fetchQueue,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useResetQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetQueue,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
      toast.success("Queue reset", {
        duration: 2000,
      });
    },
    onError: () => {
      toast.error("Failed to reset queue", {
        duration: 3000,
      });
    },
  });
}

const addTrackToQueueSuccessToast = (data: QueueItem, queryClient: QueryClient) => {
  const trackName = `${data.track?.title || "track"} by ${data.track?.artist || "artist"}`;
  queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
  toast.success(`Added track to queue`, {
    description: capitalizeEveryWord(trackName || "track"),
    duration: 2000,
  });
};
export function useAddTrackToQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addTrackToQueue,
    onSuccess: (data) => {
      addTrackToQueueSuccessToast(data, queryClient);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message || error?.message || "Failed to add track to queue";

      if (errorMessage.includes("already in the queue")) {
        toast.error("Track is already in the queue", {
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

export function useAddTracksToQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTracksToQueue,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
      toast.success(`Added ${data.length} tracks to queue`, {
        duration: 2000,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message || error?.message || "Failed to add tracks to queue";
      toast.error(errorMessage, {
        duration: 3000,
      });
    },
  });
}

export function useRemoveTrackFromQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeTrackFromQueue,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
      toast.success(`Removed track from queue`, {
        duration: 2000,
        description: capitalizeEveryWord(`${data.title} by ${data.artist}`),
        action: {
          label: "Undo",
          onClick: () => {
            addTrackToQueue(data.trackId).then((data) => {
              addTrackToQueueSuccessToast(data, queryClient);
            });
          },
        },
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        "Failed to remove track from queue";
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
      toast.success("Queue order updated", {
        duration: 2000,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        "Failed to update queue positions";
      toast.error(errorMessage, {
        duration: 3000,
      });
      // Refetch to get correct state
      queryClient.invalidateQueries({ queryKey: queueQueryKeys.all });
    },
  });
}
