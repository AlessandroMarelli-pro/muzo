import { useMutation } from '@tanstack/react-query';
import { parse } from 'graphql';
import { graffleClient } from './graffle-client';

export const useStartLibraryScan = () => {
	return useMutation({
		mutationFn: async ({
			libraryId,
			incremental,
		}: {
			libraryId: string;
			incremental?: boolean;
		}) => {
			const response = await graffleClient.request<{
				startLibraryScan: string;
			}>(
				parse(
					`
						mutation StartLibraryScan($libraryId: Base64ID!, $incremental: Boolean) {
							startLibraryScan(libraryId: $libraryId, incremental: $incremental) 
						}
    			    `
				),
				{ libraryId, incremental }
			);
			return response.startLibraryScan;
		},
	});
};
