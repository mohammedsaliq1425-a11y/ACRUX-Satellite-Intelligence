import asyncio
import pytest
from app.core.config import clean_supabase_url, load_settings
from app.core.errors import InputError, SourceError
from app.integrations import supabase
from app.services import storage
from app.services.source_registry import SourceRegistry

KEY = "sbsecret_abcdef123456"


def run(c):
    return asyncio.run(c)


def test_supabase_url_validation():
    assert clean_supabase_url("https://abcd.supabase.co/") == "https://abcd.supabase.co"
    assert clean_supabase_url("http://127.0.0.1:54321") == "http://127.0.0.1:54321"
    for bad in ["ftp://x.co", "https://user:pw@x.co", "https://x.co/rest/v1", "https://x.co?a=1",
                "not a url", "", None, "your_supabase_url_here", "javascript:alert(1)"]:
        assert clean_supabase_url(bad) is None


def test_supabase_settings_and_secret_list():
    s = load_settings(env={"SUPABASE_URL": "https://abcd.supabase.co", "SUPABASE_SERVICE_KEY": KEY})
    assert s.supabase_url == "https://abcd.supabase.co" and s.supabase_service_key == KEY
    assert KEY in s.secret_values()
    empty = load_settings(env={"SUPABASE_URL": "your_supabase_url_here", "SUPABASE_SERVICE_KEY": "your_supabase_service_key_here"})
    assert empty.supabase_url is None and empty.supabase_service_key is None


def test_registry_reports_supabase_state_honestly():
    reg = SourceRegistry()
    snap = lambda **env: {x["id"]: x for x in reg.snapshot(load_settings(env=env))}["supabase"]
    assert snap()["status"] == "not_configured"
    half = snap(SUPABASE_URL="https://abcd.supabase.co")
    assert half["status"] == "not_configured" and "both" in half["note"]
    full = snap(SUPABASE_URL="https://abcd.supabase.co", SUPABASE_SERVICE_KEY=KEY)
    assert full["status"] == "configured_untested"        # a key alone proves nothing
    reg.record_failure("supabase", "auth_failed", f"bad {KEY}", [KEY])
    f = snap(SUPABASE_URL="https://abcd.supabase.co", SUPABASE_SERVICE_KEY=KEY)
    assert f["status"] == "auth_failed" and KEY not in str(f)


def test_not_configured_blocks_every_storage_call_with_clear_error():
    s = load_settings(env={})
    for coro in (supabase.list_rows(s, "saved_locations"), supabase.insert_row(s, "saved_locations", {}),
                 supabase.delete_row(s, "saved_locations", "x"), supabase.probe(s)):
        with pytest.raises(SourceError) as e:
            run(coro)
        assert e.value.kind == "not_configured" and "optional" in e.value.message.lower()


def test_headers_never_use_anon_semantics_and_handle_both_key_styles():
    jwt = load_settings(env={"SUPABASE_URL": "https://a.supabase.co", "SUPABASE_SERVICE_KEY": "eyJhbGciOi.payload.sig"})
    h = supabase._headers(jwt, write=True)
    assert h["apikey"].startswith("eyJ") and h["Authorization"].startswith("Bearer eyJ")
    assert h["Prefer"] == "return=representation"
    new = load_settings(env={"SUPABASE_URL": "https://a.supabase.co", "SUPABASE_SERVICE_KEY": KEY})
    h2 = supabase._headers(new)
    assert h2 == {"apikey": KEY}                           # non-JWT secret key: apikey header only


def test_table_allowlist_and_uuid_guard():
    s = load_settings(env={"SUPABASE_URL": "https://a.supabase.co", "SUPABASE_SERVICE_KEY": KEY})
    with pytest.raises(InputError):
        supabase._url(s, "auth.users")
    with pytest.raises(InputError):
        supabase._url(s, "saved_locations?select=*")
    assert supabase._url(s, "saved_reports") == "https://a.supabase.co/rest/v1/saved_reports"
    good = "123e4567-e89b-12d3-a456-426614174000"
    assert storage.validate_uuid(good) == good
    for bad in ["1", "123e4567-e89b-12d3-a456-42661417400", "x' or 1=1", "eq.1&id=neq.0", "", None]:
        with pytest.raises(InputError):
            storage.validate_uuid(bad)
    with pytest.raises(InputError):                         # delete never reaches the network with a bad id
        run(supabase.delete_row(s, "saved_locations", "1 or 1=1"))


def test_location_row_validation():
    r = storage.location_row("  Tiruchirappalli ", 10.79, 78.69, "  ")
    assert r == {"name": "Tiruchirappalli", "latitude": 10.79, "longitude": 78.69, "notes": None}
    for args in [("", 0, 0, None), ("x" * 81, 0, 0, None), ("a", 91, 0, None), ("a", 0, 181, None), ("a", 0, 0, "n" * 501)]:
        with pytest.raises(InputError):
            storage.location_row(*args)


def test_report_row_strips_secrets_and_enforces_limits():
    payload = {"summary": "ok", "debug": f"url had {KEY} in it", "nested": {"k": [KEY]}}
    r = storage.report_row("Weather report", "weather", payload, False, [KEY])
    assert KEY not in str(r) and r["payload"]["summary"] == "ok" and r["contains_simulated"] is False
    for args in [("", "weather", {}, False), ("t", "nonsense", {}, False), ("t", "weather", [], False)]:
        with pytest.raises(InputError):
            storage.report_row(*args, [])
    with pytest.raises(InputError, match="too large"):
        storage.report_row("t", "weather", {"x": "a" * 250_000}, False, [])
    r2 = storage.report_row("Twin run", "telemetry", {"a": 1}, True, [])
    assert r2["contains_simulated"] is True


def test_run_row_is_always_marked_simulated():
    r = storage.run_row(7, {"duration_min": 60}, [{"id": "ALR-0001"}], {"power": "warning"})
    assert r["simulated"] is True and r["seed"] == 7
