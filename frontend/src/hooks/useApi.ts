import { useCallback, useEffect, useRef, useState } from "react";
import { apiStaleIfError } from "../lib/api";

// Revalidating hook: shows the previous data immediately on re-mount /
// deps change while a background re-fetch replaces it.  Falls back to a
// full blocking load only on the very first fetch of a key.
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    // On deps change, keep the previous data visible while we revalidate.
    // The only truly "loading" state is when we have no data at all yet.
    setLoading(data === null);
    setError(null);

    const run = async () => {
      // Sniff the key so we can prefer a cached copy when available.
      const fn = fetcherRef.current;
      // Wrap the fetcher so a cold fetch also feeds SWR.
      try {
        const result = await fn();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, reload };
}

// Convenience variant for the common "load from the API with SWR" case.
// Prefers the cached copy when one exists so revisits render instantly.
export function useApiSwr<T>(
  path: string,
  deps: readonly unknown[],
): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  return useApi(async () => (await apiStaleIfError<T>(path)) ?? (null as T), deps);
}
