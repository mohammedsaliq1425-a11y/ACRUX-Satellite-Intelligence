"""HTTP-level tests. Require fastapi + httpx (installed via requirements.txt); skipped otherwise.
NOTE: these could not be executed in the build sandbox (no network, packages unavailable)."""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def test_health_and_sources_never_expose_secrets():
    assert client.get("/api/health").json()["status"] == "ok"
    body = client.get("/api/sources").json()
    ids = {s["id"] for s in body["sources"]}
    assert {"open_meteo", "nasa_api", "firms", "jpl_ssd", "exoplanet_archive", "openrouter"} <= ids
    text = client.get("/api/sources").text.lower()
    assert "sk-or-" not in text and "map_key=" not in text


def test_link_budget_endpoint_and_validation():
    ok = client.post("/api/calc/link-budget", json={
        "freq_ghz": 12, "tx_power_w": 10, "tx_gain_dbi": 30, "rx_gain_dbi": 40,
        "system_noise_temp_k": 150, "bandwidth_hz": 36e6, "distance_km": 35786})
    assert ok.status_code == 200 and abs(ok.json()["fspl_db"] - 205.1) < 0.1
    bad = client.post("/api/calc/link-budget", json={"freq_ghz": -1})
    assert bad.status_code == 422


def test_telemetry_endpoint_labels_simulation_and_hides_ground_truth():
    r = client.post("/api/telemetry/simulate", json={
        "duration_min": 120, "faults": [{"kind": "excess_load", "start_min": 30, "duration_min": 40, "magnitude": 60}]})
    j = r.json()
    assert r.status_code == 200 and j["simulated"] is True and "SIMULATED" in j["disclaimer"]
    assert j["alerts"] and "_true_fault_kinds" not in j["samples"][0]


def test_missing_keys_give_clear_errors_not_crashes():
    r = client.get("/api/fires", params={"west": 0, "south": 0, "east": 1, "north": 1})
    if r.status_code == 503:   # only when FIRMS_MAP_KEY is not configured in the environment
        assert r.json()["error"]["kind"] == "not_configured"
    chat = client.post("/api/ai/chat", json={"message": "hi"})
    if chat.status_code == 503:
        assert chat.json()["error"]["kind"] == "not_configured"


def test_cors_only_allows_local_frontend():
    ok = client.options("/api/health", headers={"Origin": "http://localhost:5173",
                                                "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    evil = client.options("/api/health", headers={"Origin": "https://evil.example",
                                                  "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in evil.headers
