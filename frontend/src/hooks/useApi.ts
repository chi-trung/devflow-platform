import { useCallback, useEffect, useRef, useState } from "react";
import { apiStaleIfError, peekSnapshot, stashSnapshot } from "../lib/api";

// Revalidating hook: shows the previous data immediately on re-mount /
// deps change while a background re-fetch replaces it.  Falls back to a
// full blocking load only on the very first fetch of a key.
//
// Passing `snapshotKey` additionally seeds first paint from the persisted
// copy of the last successful fetch (localStorage) so a reload paints
// instantly and revalidates in the background — stale-while-revalidate
// that survives F5.  `reload()` re-fetches and stashes a fresh snapshot
// but never re-seeds from the old one, so user-visible updates aren't
// overwritten by stale data.
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  options?: { snapshotKey?: string },
): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(() =>
    options?.snapshotKey ? (peekSnapshot<T>(options.snapshotKey) ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => data === null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  const snapshotKeyRef = useRef(options?.snapshotKey);
  fetcherRef.current = fetcher;
  snapshotKeyRef.current = options?.snapshotKey;

  useEffect(() => {
    let cancelled = false;
    // On deps change, keep the previous data visible while we revalidate.
    // The only truly "loading" state is when we have no data at all yet.
    setLoading(data === null);
    setError(null);

    const run = async () => {
      const fn = fetcherRef.current;
      try {
        const result = await fn();
        if (!cancelled) {
          setData(result);
          setLoading(false);
          // Stash only real payloads — gated fetchers resolve null while
          // their enable-flag is off, and null must never overwrite the
          // persisted copy.
          const key = snapshotKeyRef.current;
          if (key && result != null) stashSnapshot(key, result);
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
