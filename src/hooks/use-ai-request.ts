import { useCallback, useRef, useState } from "react";

/**
 * Guards an async AI call from:
 * - double-clicks (in-flight lock).
 * - identical repeated calls within `dedupeMs`.
 * - unresolved races (last-call-wins).
 *
 * Usage:
 *   const { run, loading, error } = useAiRequest(async (input) => callServerFn({ data: input }));
 *   await run({ text: "..." });
 */
export function useAiRequest<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  opts: { dedupeMs?: number } = {},
) {
  const dedupeMs = opts.dedupeMs ?? 1500;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inflight = useRef(false);
  const lastCallAt = useRef(0);
  const lastKey = useRef<string>("");

  const run = useCallback(async (...args: Args): Promise<R | null> => {
    const key = safeKey(args);
    const now = Date.now();
    if (inflight.current) return null;
    if (key === lastKey.current && now - lastCallAt.current < dedupeMs) return null;

    inflight.current = true;
    lastCallAt.current = now;
    lastKey.current = key;
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      return result;
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [fn, dedupeMs]);

  return { run, loading, error };
}

function safeKey(args: unknown[]): string {
  try { return JSON.stringify(args).slice(0, 500); } catch { return String(args); }
}
