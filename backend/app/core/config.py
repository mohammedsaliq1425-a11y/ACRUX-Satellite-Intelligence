"""Settings loaded from the process environment and an optional project-root .env.

Deliberately dependency-free (no python-dotenv / pydantic-settings) so it is
trivial to test. Placeholder values from .env.example are treated as unset.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

PLACEHOLDERS = {
    "", "your_api_key_here", "your_nasa_api_key_here", "your_firms_map_key_here",
    "your_selected_model_here", "your_supabase_url_here", "your_supabase_service_key_here",
}


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        values[key.strip()] = val
    return values


def clean_supabase_url(v: str | None) -> str | None:
    """Accept only a bare http(s) origin (e.g. https://abcd.supabase.co or http://127.0.0.1:54321).
    Anything else (credentials, paths, odd schemes) is rejected so it cannot redirect requests."""
    from urllib.parse import urlparse
    v = _clean(v)
    if v is None:
        return None
    try:
        u = urlparse(v)
    except ValueError:
        return None
    if u.scheme not in ("http", "https") or not u.hostname or u.username or u.password:
        return None
    if u.path not in ("", "/") or u.query or u.fragment:
        return None
    return f"{u.scheme}://{u.netloc}"


def _clean(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return None if v in PLACEHOLDERS else v


@dataclass(frozen=True)
class Settings:
    nasa_api_key: str | None
    firms_map_key: str | None
    openrouter_api_key: str | None
    openrouter_model: str | None
    supabase_url: str | None
    supabase_service_key: str | None
    openrouter_site_url: str
    openrouter_app_name: str
    frontend_origins: tuple[str, ...]
    http_timeout_s: float

    @property
    def effective_nasa_key(self) -> str:
        return self.nasa_api_key or "DEMO_KEY"

    def secret_values(self) -> list[str]:
        return [v for v in (self.nasa_api_key, self.firms_map_key,
                            self.openrouter_api_key, self.supabase_service_key) if v]


def load_settings(env: dict[str, str] | None = None,
                  env_file: Path | None = None) -> Settings:
    """Build Settings. Passing `env` ignores os.environ and the .env file (tests)."""
    if env is not None:
        merged = dict(env)
    else:
        if env_file is None:
            env_file = Path(__file__).resolve().parents[3] / ".env"
        merged = dict(parse_env_file(env_file))
        merged.update(os.environ)  # real environment wins over the file

    origins = tuple(o.strip() for o in merged.get(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip())
    try:
        timeout = float(merged.get("HTTP_TIMEOUT_SECONDS", "20"))
    except ValueError:
        timeout = 20.0
    timeout = min(max(timeout, 2.0), 120.0)

    return Settings(
        nasa_api_key=_clean(merged.get("NASA_API_KEY")),
        firms_map_key=_clean(merged.get("FIRMS_MAP_KEY")),
        openrouter_api_key=_clean(merged.get("OPENROUTER_API_KEY")),
        openrouter_model=_clean(merged.get("OPENROUTER_MODEL")),
        supabase_url=clean_supabase_url(merged.get("SUPABASE_URL")),
        supabase_service_key=_clean(merged.get("SUPABASE_SERVICE_KEY")),
        openrouter_site_url=merged.get("OPENROUTER_SITE_URL", "http://localhost:5173"),
        openrouter_app_name=merged.get("OPENROUTER_APP_NAME", "Project Acrux"),
        frontend_origins=origins,
        http_timeout_s=timeout,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
