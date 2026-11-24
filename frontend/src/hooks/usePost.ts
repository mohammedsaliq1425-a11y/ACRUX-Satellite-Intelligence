import { useCallback, useRef, useState } from "react";
import { ApiError, request } from "../services/api";

/** On-demand request (calculators, simulations, chat). A newer call supersedes an older one. */
export function usePost<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({ data: null, error: null, loading: false });
  const seq = useRef(0);
  const run = useCallback(async (body: unknown): Promise<T | null> => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await request<T>(path, { method: "POST", body: JSON.stringify(body) });
      if (mine === seq.current) setState({ data, error: null, loading: false });
      return data;
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: e instanceof ApiError ? e : new ApiError("unknown", "Unexpected error.", 0) }));
      return null;
    }
  }, [path]);
  return { ...state, run };
}
