import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError, errorTitle } from "../services/api";
import { Button } from "./Button";

interface Props {
  loading: boolean;
  error: ApiError | null;
  /** True when the request succeeded but there is nothing to show. */
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  loadingLabel?: string;
  children: ReactNode;
}

/** Standard loading / error / empty / success wrapper for every external-data panel. */
export function DataState({ loading, error, empty, emptyMessage = "No results.", onRetry, loadingLabel = "Loading…", children }: Props) {
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-bad/40 bg-bad/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-bad">
          <AlertTriangle size={16} aria-hidden /> {errorTitle(error.kind)}
        </p>
        <p className="mt-1 text-sm text-mute">{error.message}</p>
        {onRetry && (
          <Button className="mt-3" onClick={onRetry}><RefreshCw size={14} aria-hidden /> Retry</Button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div role="status" aria-live="polite" className="animate-pulse space-y-3">
        <span className="sr-only">{loadingLabel}</span>
        <div className="h-4 w-1/3 rounded bg-panel" />
        <div className="h-24 rounded bg-panel" />
      </div>
    );
  }
  if (empty) return <p className="text-sm text-mute">{emptyMessage}</p>;
  return <>{children}</>;
}
