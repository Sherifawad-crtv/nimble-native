import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { dataService, ServiceError, type DataService } from '../services';

/** The one way every screen reads from the service. */
export function useData<T>(key: QueryKey, load: (service: DataService) => Promise<T>, opts: { enabled?: boolean } = {}): UseQueryResult<T, ServiceError> {
  return useQuery<T, ServiceError>({ queryKey: key, queryFn: () => load(dataService), enabled: opts.enabled ?? true, placeholderData: keepPreviousData });
}

interface ActionOptions<A, R> {
  /** Query key prefixes to refresh after the action succeeds. */
  invalidate?: QueryKey[];
  onSuccess?: (result: R, arg: A) => void;
}

/** The one way every screen writes to the service. */
export function useAction<A, R>(run: (service: DataService, arg: A) => Promise<R>, opts: ActionOptions<A, R> = {}) {
  const client = useQueryClient();
  const m = useMutation<R, ServiceError, A>({
    mutationFn: (arg) => run(dataService, arg),
    onSuccess: async (result, arg) => {
      await Promise.all((opts.invalidate ?? []).map((queryKey) => client.invalidateQueries({ queryKey })));
      opts.onSuccess?.(result, arg);
    },
  });
  return { run: m.mutateAsync, isPending: m.isPending, error: m.error, reset: m.reset };
}

export const errorMessage = (e: unknown): string => (e instanceof ServiceError || e instanceof Error ? e.message : String(e));
