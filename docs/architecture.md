# Architecture (final)

```
project-acrux/
  backend/app/
    main.py            FastAPI app, CORS (localhost only), error handlers
    api/routes.py      Thin handlers -> pure functions / integrations
    schemas/           Pydantic request models (input validation)
    core/              config, errors, http (single outbound choke-point), cache, ratelimit
    services/          source_registry (health states), ai_context (grounded prompts)
    integrations/      One module per external API; normalise + attribute + record health
    analytics/         orbital, link_budget, gnss, anomaly (rules), ml_anomaly (optional)
    simulations/       telemetry generator (all output labelled simulated)
  backend/tests/       pytest suite
  frontend/src/
    app/ (routes, navigation)  layouts/ (shell, sidebar, topbar)  components/ (ui kit)
    features/ (modules registry, home, sources)  pages/ (15 routes)  hooks/  services/api.ts  types/
  docs/
```

Principles
* **Scientific logic is pure** (no web framework imports) so it is unit-testable.
* **Only `core/http.py` talks to the network**; user input only reaches query params or
  allow-listed/regex-validated parts. No endpoint fetches arbitrary URLs or reads arbitrary files.
* **Every payload says what it is**: `observation | forecast | reanalysis | catalogue | derived |
  simulation`, with source, retrieval time and cache status.
* **Errors are a closed vocabulary** (`not_configured`, `auth_failed`, `rate_limited`,
  `unavailable`, `timeout`, `invalid_response`, `not_found`, `bad_request`) so the UI can respond
  consistently; messages are fixed, user-safe strings.

Planned: Phase 2 frontend shell (Vite/React/TS/Tailwind, 15 routes) → Phase 3 data modules →
Phase 4 engineering modules and 3D twin → Phase 5 multimodal, assistant UI, reports/export.

Optional persistence: `integrations/supabase.py` talks to Supabase PostgREST with the service key (backend-only).
Table names come from a fixed allow-list and row ids are validated UUIDs. Saved reports are scrubbed of known
secret values. The frontend never contacts Supabase and never holds any key; the browser only calls `/api`.

Frontend principles: one API client (`services/api.ts`) with a closed error vocabulary; `DataState` wraps every
external-data panel (loading / error+retry / empty); `KindBadge` and `SimulatedBanner` keep observations,
forecasts, derived values and simulations visibly distinct; status is never conveyed by colour alone.

Cross-page state: `SelectionProvider` (one shared location) and `WorkspaceProvider` (datasets each page actually
retrieved). Reports and the AI assistant read only from the workspace, so they can never contain data that was not
loaded. Pages publish a `WorkspaceDataset` (kind, source, timestamp, key values, table, methods, limitations).
Printing: the sidebar/topbar use `print:hidden`; the report is a white "paper" component, so the browser's
Save-as-PDF produces a clean document.
