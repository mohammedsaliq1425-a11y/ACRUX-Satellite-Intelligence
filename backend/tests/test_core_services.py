import pytest
from pathlib import Path
from app.core.cache import TTLCache
from app.core.config import load_settings, parse_env_file
from app.core.errors import SourceError, classify_http_status, scrub
from app.core.ratelimit import RateLimiter
from app.services.source_registry import SourceRegistry, SOURCES


def test_placeholders_are_treated_as_unset():
    s = load_settings(env={"NASA_API_KEY": "your_nasa_api_key_here", "FIRMS_MAP_KEY": "",
                           "OPENROUTER_API_KEY": "your_api_key_here",
                           "OPENROUTER_MODEL": "your_selected_model_here"})
    assert s.nasa_api_key is None and s.firms_map_key is None
    assert s.openrouter_api_key is None and s.openrouter_model is None
    assert s.effective_nasa_key == "DEMO_KEY" and s.secret_values() == []


def test_real_values_and_defaults():
    s = load_settings(env={"NASA_API_KEY": "abcd1234", "FIRMS_MAP_KEY": "firmskey99",
                           "OPENROUTER_API_KEY": "sk-or-xyz", "OPENROUTER_MODEL": "vendor/model",
                           "HTTP_TIMEOUT_SECONDS": "9999"})
    assert s.effective_nasa_key == "abcd1234"
    assert set(s.secret_values()) == {"abcd1234", "firmskey99", "sk-or-xyz"}
    assert s.http_timeout_s == 120.0                       # clamped
    assert s.frontend_origins == ("http://localhost:5173", "http://127.0.0.1:5173")
    assert s.openrouter_app_name == "Project Acrux"


def test_env_file_parsing(tmp_path=None):
    import tempfile
    d = Path(tempfile.mkdtemp())
    f = d / ".env"
    f.write_text('# comment\nA=1\nB="quoted value"\n\nC = spaced \nbadline\n', encoding="utf-8")
    assert parse_env_file(f) == {"A": "1", "B": "quoted value", "C": "spaced"}
    assert parse_env_file(d / "missing") == {}


def test_scrub_and_status_classification():
    assert scrub("url /api/area/csv/SECRETKEY/x failed", ["SECRETKEY"]) == "url /api/area/csv/***/x failed"
    assert scrub("abc", ["", "ab"]) == "abc"             # too-short secrets are ignored
    assert classify_http_status(200) is None
    assert classify_http_status(401) == classify_http_status(403) == "auth_failed"
    assert classify_http_status(429) == "rate_limited"
    assert classify_http_status(503) == "unavailable"
    assert classify_http_status(404) == "not_found"
    assert classify_http_status(400) == "bad_request"
    assert SourceError("rate_limited", "x").http_status == 429


def test_cache_ttl_and_eviction():
    t = [0.0]
    c = TTLCache(max_items=2, clock=lambda: t[0])
    c.set("a", 1)
    hit = c.get("a", ttl_s=10)
    assert hit.value == 1 and hit.retrieved_at
    t[0] = 11
    assert c.get("a", ttl_s=10) is None
    c.set("x", 1); t[0] = 12; c.set("y", 2); t[0] = 13; c.set("z", 3)
    assert c.get("x", 100) is None and c.get("z", 100).value == 3


def test_rate_limiter_window():
    t = [0.0]
    rl = RateLimiter(2, 10, clock=lambda: t[0])
    assert rl.check("k")[0] and rl.check("k")[0]
    ok, retry = rl.check("k")
    assert not ok and retry == pytest.approx(10)
    assert rl.check("other")[0]
    t[0] = 10.5
    assert rl.check("k")[0]


def snap(reg, **env):
    return {s["id"]: s for s in reg.snapshot(load_settings(env=env))}


def test_registry_initial_states():
    reg = SourceRegistry()
    s = snap(reg)
    assert s["firms"]["status"] == "not_configured"
    assert s["openrouter"]["status"] == "not_configured"
    assert s["open_meteo"]["status"] == "configured_untested"        # no key needed, never tested
    assert s["nasa_api"]["status"] == "configured_untested" and "DEMO_KEY" in s["nasa_api"]["note"]
    assert s["firms"]["key_configured"] is False and s["open_meteo"]["key_configured"] is None
    assert len(s) == len(SOURCES)


def test_key_presence_does_not_imply_working():
    reg = SourceRegistry()
    s = snap(reg, FIRMS_MAP_KEY="realkey123")
    assert s["firms"]["status"] == "configured_untested"
    assert s["openrouter"]["status"] == "not_configured"
    s = snap(reg, OPENROUTER_API_KEY="sk-or-123")                       # key but no model
    assert s["openrouter"]["status"] == "not_configured" and "OPENROUTER_MODEL" in s["openrouter"]["note"]


def test_registry_status_transitions_and_secret_scrubbing():
    reg = SourceRegistry()
    env = dict(FIRMS_MAP_KEY="realkey123")
    reg.record_failure("firms", "auth_failed", "bad realkey123", ["realkey123"])
    s = snap(reg, **env)["firms"]
    assert s["status"] == "auth_failed" and "realkey123" not in s["last_error"]
    reg.record_failure("firms", "rate_limited", "slow down")
    assert snap(reg, **env)["firms"]["status"] == "rate_limited"
    reg.record_failure("firms", "timeout", "slow")
    assert snap(reg, **env)["firms"]["status"] == "unavailable"
    reg.record_success("firms", usable=False)
    assert snap(reg, **env)["firms"]["status"] == "reachable"
    reg.record_success("firms")
    f = snap(reg, **env)["firms"]
    assert f["status"] == "returning_data" and f["last_success_at"] and f["last_error"] is None
    assert "realkey123" not in str(snap(reg, **env))
