/** Single place the frontend talks to the backend. Requests go to the same origin
 *  (Vite proxies /api to FastAPI), so no backend URL or secret is in the bundle. */
import type { HealthResponse, SourcesResponse, SourceTestResponse } from "../types/api";

export class ApiError extends Error {
  kind: string;
  status: number;
  constructor(kind: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const BACKEND_DOWN =
  "Cannot reach the Project Acrux backend. Start it with `uvicorn app.main:app --reload --port 8000` (see the README), then retry.";

interface ErrorBody { error?: { kind?: string; message?: string }; detail?: unknown }

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("network", BACKEND_DOWN, 0);
  }

  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    const b = (body ?? {}) as ErrorBody;
    if (b.error?.message) throw new ApiError(b.error.kind ?? "http", b.error.message, res.status);
    if (b.detail !== undefined) throw new ApiError("bad_request", "The request parameters were not valid.", res.status);
    // Vite's proxy answers 5xx with an empty body when the backend is not running.
    if (res.status >= 500) throw new ApiError("network", BACKEND_DOWN, res.status);
    throw new ApiError("http", `Request failed (HTTP ${res.status}).`, res.status);
  }
  return body as T;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  sources: () => request<SourcesResponse>("/api/sources"),
  testSource: (id: string) =>
    request<SourceTestResponse>(`/api/sources/${encodeURIComponent(id)}/test`, { method: "POST" }),
};

/** Short, user-facing title for an error kind. */
export function errorTitle(kind: string): string {
  switch (kind) {
    case "not_configured": return "Not configured";
    case "auth_failed": return "Credentials rejected";
    case "rate_limited": return "Rate limit reached";
    case "unavailable": return "Data source unavailable";
    case "timeout": return "Request timed out";
    case "network": return "Backend not reachable";
    case "invalid_response": return "Unexpected response";
    case "bad_request": return "Invalid request";
    case "not_found": return "Not found";
    default: return "Something went wrong";
  }
}
