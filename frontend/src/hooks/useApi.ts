import { useCallback, useEffect, useState } from "react";
import { ApiError, request } from "../services/api";

interface State<T> { data: T | null; error: ApiError | null; loading: boolean }

/** GET a backend path. Pass null to stay idle. Keeps the previous data while reloading
 *  so panels do not flash empty; `reload()` re-requests. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: path !== null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    const ctl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    request<T>(path, { signal: ctl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const error = e instanceof ApiError ? e : new ApiError("unknown", "Unexpected error.", 0);
        setState({ data: null, error, loading: false });
      });
    return () => ctl.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
