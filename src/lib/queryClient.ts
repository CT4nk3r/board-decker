import { QueryClient } from "@tanstack/react-query";
import { AdoError } from "@/lib/ado";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // adoRequest already retries throttling (429/503) with backoff, so an
      // AdoError that reaches here is either exhausted-transient or a
      // deterministic 4xx — don't stack another query-level retry on top.
      retry: (failureCount, error) => {
        if (error instanceof AdoError) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  },
});
