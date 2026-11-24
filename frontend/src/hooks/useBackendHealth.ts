import { useEffect, useState } from "react";
import { api } from "../services/api";

export type BackendState = "checking" | "online" | "offline";

/** Polls /api/health so the top bar reflects whether the backend is really reachable. */
export function useBackendHealth(intervalMs = 30_000): BackendState {
  const [state, setState] = useState<BackendState>("checking");
  useEffect(() => {
    let alive = true;
    const check = () =>
      api.health()
        .then((h) => { if (alive) setState(h.status === "ok" ? "online" : "offline"); })
        .catch(() => { if (alive) setState("offline"); });
    check();
    const id = window.setInterval(check, intervalMs);
    return () => { alive = false; window.clearInterval(id); };
  }, [intervalMs]);
  return state;
}
