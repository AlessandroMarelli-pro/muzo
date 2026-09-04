import { gql, graffleClient } from '@/services/graffle-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface AiServiceInstanceHealth {
  url: string;
  isHealthy: boolean;
  activeConnections: number;
  lastChecked: string;
}

export interface AiServiceHealth {
  overall: boolean;
  instances: AiServiceInstanceHealth[];
  timestamp: string;
}

export interface AiServiceSettings {
  mode: 'local' | 'remote';
  remoteUrl?: string;
  hasAuthToken: boolean;
  replicas: number;
  health: AiServiceHealth;
}

export interface AiServiceActionResult {
  success: boolean;
  message: string;
}

const AI_SERVICE_SETTINGS_QUERY_KEY = ['aiServiceSettings'];

const GET_AI_SERVICE_SETTINGS = gql`
  query AiServiceSettings {
    aiServiceSettings {
      mode
      remoteUrl
      hasAuthToken
      replicas
      health {
        overall
        timestamp
        instances {
          url
          isHealthy
          activeConnections
          lastChecked
        }
      }
    }
  }
`;

const TEST_AI_SERVICE_CONNECTION = gql`
  mutation TestAiServiceConnection($input: TestAiServiceConnectionGqlInput!) {
    testAiServiceConnection(input: $input) {
      success
      message
    }
  }
`;

const UPDATE_AI_SERVICE_SETTINGS = gql`
  mutation UpdateAiServiceSettings($input: UpdateAiServiceSettingsGqlInput!) {
    updateAiServiceSettings(input: $input) {
      success
      message
    }
  }
`;

const SET_AI_SERVICE_REPLICAS = gql`
  mutation SetAiServiceReplicas($replicas: Int!) {
    setAiServiceReplicas(replicas: $replicas) {
      success
      message
    }
  }
`;

const getAiServiceSettings = async (): Promise<AiServiceSettings> => {
  const data = await graffleClient.request<{ aiServiceSettings: AiServiceSettings }>(
    GET_AI_SERVICE_SETTINGS,
  );
  return data.aiServiceSettings;
};

export interface TestAiServiceConnectionInput {
  url: string;
  authToken?: string;
}

const testAiServiceConnection = async (
  input: TestAiServiceConnectionInput,
): Promise<AiServiceActionResult> => {
  const data = await graffleClient.request<{ testAiServiceConnection: AiServiceActionResult }>(
    TEST_AI_SERVICE_CONNECTION,
    { input },
  );
  return data.testAiServiceConnection;
};

export interface UpdateAiServiceSettingsInput {
  mode: 'local' | 'remote';
  remoteUrl?: string;
  /** Omit to leave the stored token unchanged; pass "" to clear it. */
  authToken?: string;
}

const updateAiServiceSettings = async (
  input: UpdateAiServiceSettingsInput,
): Promise<AiServiceActionResult> => {
  const data = await graffleClient.request<{ updateAiServiceSettings: AiServiceActionResult }>(
    UPDATE_AI_SERVICE_SETTINGS,
    { input },
  );
  return data.updateAiServiceSettings;
};

const setAiServiceReplicas = async (replicas: number): Promise<AiServiceActionResult> => {
  const data = await graffleClient.request<{ setAiServiceReplicas: AiServiceActionResult }>(
    SET_AI_SERVICE_REPLICAS,
    { replicas },
  );
  return data.setAiServiceReplicas;
};

export function useAiServiceSettings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: AI_SERVICE_SETTINGS_QUERY_KEY,
    queryFn: getAiServiceSettings,
  });

  return {
    settings: data,
    isLoading,
    error: error?.message,
    refetch,
  };
}

export function useTestAiServiceConnection() {
  const mutation = useMutation({
    mutationFn: testAiServiceConnection,
  });

  return {
    testConnection: mutation.mutateAsync,
    isTesting: mutation.isPending,
  };
}

export function useUpdateAiServiceSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateAiServiceSettings,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: AI_SERVICE_SETTINGS_QUERY_KEY });
      }
    },
  });

  return {
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}

export function useSetAiServiceReplicas() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: setAiServiceReplicas,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: AI_SERVICE_SETTINGS_QUERY_KEY });
      }
    },
  });

  return {
    setReplicas: mutation.mutateAsync,
    isScaling: mutation.isPending,
  };
}
