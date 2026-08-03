import { useMutation } from '@tanstack/react-query';
import { parse } from 'graphql';
import { graffleClient } from './graffle-client';

export const useStartLibraryScan = () => {
  return useMutation({
    mutationFn: async ({
      libraryId,
      incremental,
      force,
      skipAiMetadata,
    }: {
      libraryId: string;
      incremental?: boolean;
      force?: boolean;
      skipAiMetadata?: boolean;
    }) => {
      const response = await graffleClient.request<{
        startLibraryScan: string;
      }>(
        parse(
          `
						mutation StartLibraryScan($libraryId: Base64ID!, $incremental: Boolean, $force: Boolean, $skipAiMetadata: Boolean) {
							startLibraryScan(libraryId: $libraryId, incremental: $incremental, force: $force, skipAiMetadata: $skipAiMetadata)
						}
    			    `,
        ),
        { libraryId, incremental, force, skipAiMetadata },
      );
      return response.startLibraryScan;
    },
  });
};

export const useStopLibraryScan = () => {
  return useMutation({
    mutationFn: async ({ libraryId, sessionId }: { libraryId: string; sessionId: string }) => {
      const response = await graffleClient.request<{
        stopLibraryScan: boolean;
      }>(
        parse(
          `
						mutation StopLibraryScan($libraryId: Base64ID!, $sessionId: Base64ID!) {
							stopLibraryScan(libraryId: $libraryId, sessionId: $sessionId)
						}
					` as any,
        ),
        { libraryId, sessionId },
      );
      return response.stopLibraryScan;
    },
  });
};
