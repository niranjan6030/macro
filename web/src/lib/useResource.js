"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fetch something, and re-fetch it on demand.
 *
 * Two things this gets right that a bare `useEffect(() => { load() })` does
 * not. It never sets state synchronously inside the effect body, which is
 * what causes the cascading re-render React warns about. And it drops the
 * result of a request that has been superseded — paging back through days
 * quickly used to let a slow response for Tuesday land after Wednesday's and
 * overwrite it.
 */
export function useResource(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const result = await fetcher();
        if (live) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    // The request is not aborted, only ignored: it is usually already in
    // flight, and a cancelled fetch would lose a warm cache entry.
    return () => {
      live = false;
    };
  }, [fetcher, nonce]);

  /* Called from event handlers, never from an effect — so setting `loading`
     synchronously here is exactly where it belongs. */
  const reload = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  return { data, loading, error, reload, setData, setError };
}
