import { gql, graffleClient } from '@/services/graffle-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface IntegrationSettings {
  hasCosineApiKey: boolean;
  hasSpotifyClientId: boolean;
  hasSpotifyClientSecret: boolean;
  hasTidalClientId: boolean;
  hasTidalClientSecret: boolean;
  hasYoutubeClientId: boolean;
  hasYoutubeClientSecret: boolean;
}

export interface IntegrationSettingsActionResult {
  success: boolean;
  message: string;
}

/** Each field: omit to keep the stored value, "" to clear (falls back to env), a string to replace. */
export interface UpdateIntegrationSettingsInput {
  cosineApiKey?: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  tidalClientId?: string;
  tidalClientSecret?: string;
  youtubeClientId?: string;
  youtubeClientSecret?: string;
}

const QUERY_KEY = ['integrationSettings'];

const GET_INTEGRATION_SETTINGS = gql`
  query IntegrationSettings {
    integrationSettings {
      hasCosineApiKey
      hasSpotifyClientId
      hasSpotifyClientSecret
      hasTidalClientId
      hasTidalClientSecret
      hasYoutubeClientId
      hasYoutubeClientSecret
    }
  }
`;

const UPDATE_INTEGRATION_SETTINGS = gql`
  mutation UpdateIntegrationSettings($input: UpdateIntegrationSettingsGqlInput!) {
    updateIntegrationSettings(input: $input) {
      success
      message
    }
  }
`;

const getIntegrationSettings = async (): Promise<IntegrationSettings> => {
  const data = await graffleClient.request<{ integrationSettings: IntegrationSettings }>(
    GET_INTEGRATION_SETTINGS,
  );
  return data.integrationSettings;
};

const updateIntegrationSettings = async (
  input: UpdateIntegrationSettingsInput,
): Promise<IntegrationSettingsActionResult> => {
  const data = await graffleClient.request<{
    updateIntegrationSettings: IntegrationSettingsActionResult;
  }>(UPDATE_INTEGRATION_SETTINGS, { input });
  return data.updateIntegrationSettings;
};

export function useIntegrationSettings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getIntegrationSettings,
  });
  return { settings: data, isLoading, error: error?.message, refetch };
}

export function useUpdateIntegrationSettings() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: updateIntegrationSettings,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }
    },
  });
  return { updateSettings: mutation.mutateAsync, isUpdating: mutation.isPending };
}
