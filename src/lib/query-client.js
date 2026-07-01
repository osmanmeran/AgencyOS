import { QueryClient, QueryCache } from '@tanstack/react-query';
import { showError } from './toast';

export const queryClientInstance = new QueryClient({
	queryCache: new QueryCache({
		onError: (error) => {
			showError('Failed to load data', error?.message);
		},
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});