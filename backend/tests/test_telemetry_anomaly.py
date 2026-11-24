import pytest
from app.analytics import anomaly
from app.analytics.ml_anomaly import MLDetector
from app.simulations.telemetry import DISCLAIMER, Fault, SimConfig, generate

FIXED_START = None


def run(**kw):
    faults = kw.pop("faults", [])
    return generate(SimConfig(faults=faults, **kw))


def rules(events):
    return {e["rule_id"] for e in events}


def test_disclaimer_and_labels():
    sim = run(duration_min=30)
    assert sim["simulated"] is True
    assert sim["disclaimer"] == "SIMULATED TELEMETRY — NOT LIVE SPACECRAFT DATA" == DISCLAIMER
    assert sim["assumptions"] and sim["units"]["bus_temp_c"] == "°C"


def test_sample_count_and_bounds():
    sim = run(duration_min=120, step_s=30)
    assert len(sim["samples"]) == 240
    for s in sim["samples"]:
        assert 0 <= s["battery_soc_pct"] <= 100
        assert s["solar_power_w"] >= 0
    assert any(s["sunlit"] for s in sim["samples"]) and any(not s["sunlit"] for s in sim["samples"])
    assert all(s["solar_power_w"] == 0 for s in sim["samples"] if not s["sunlit"])


def test_determinism_and_seed_sensitivity():
    a, b, c = run(seed=1, duration_min=60), run(seed=1, duration_min=60), run(seed=2, duration_min=60)
    strip = lambda sim: [{k: v for k, v in s.items() if k != "timestamp"} for s in sim["samples"]]
    assert strip(a) == strip(b) and strip(a) != strip(c)


def test_config_validation():
    with pytest.raises(ValueError):
        generate(SimConfig(duration_min=1))
    with pytest.raises(ValueError):
        generate(SimConfig(altitude_km=36000))
    with pytest.raises(ValueError):
        Fault("warp_core_breach", 0, 10)
    with pytest.raises(ValueError):
        Fault("solar_degradation", 0, 10, magnitude=1.5)
    with pytest.raises(ValueError):
        Fault("excess_load", 0, 0, 10)


def test_nominal_run_raises_no_alerts():
    for seed in (1, 42, 99):
        ev = anomaly.detect(run(seed=seed, duration_min=480)["samples"])
        assert ev == [], f"false alerts with seed {seed}: {[e['rule_id'] for e in ev]}"


def test_each_fault_is_detected_by_the_expected_rule_and_component():
    cases = [
        (Fault("solar_degradation", 60, 100, 0.6), "solar_underperformance", "power"),
        (Fault("excess_load", 60, 60, 60), "bus_load_high", "power"),
        (Fault("attitude_drift", 60, 40, 0.1), "attitude_error_high", "attitude"),
        (Fault("comm_dropout", 0, 240), "comm_missed_pass", "communications"),
    ]
    for fault, rule, comp in cases:
        ev = anomaly.detect(run(faults=[fault])["samples"])
        hits = [e for e in ev if e["rule_id"] == rule]
        assert hits, f"{fault.kind} not detected"
        assert hits[0]["component"] == comp
        assert anomaly.component_status(ev)[comp] != "ok"

    hot = run(duration_min=300, faults=[Fault("thermal_excursion", 30, 250, 150)])
    ev = anomaly.detect(hot["samples"])
    assert "bus_temp_high" in rules(ev)
    assert anomaly.component_status(ev)["thermal"] in ("warning", "critical")


def test_alerts_do_not_precede_the_fault_and_have_all_fields():
    ev = anomaly.detect(run(faults=[Fault("excess_load", 120, 60, 60)])["samples"])
    assert ev
    for e in ev:
        assert e["detected_t_s"] >= 120 * 60
        for k in ("id", "detected_timestamp", "measured_value", "expected_range", "severity",
                  "component", "reason", "suggested_action", "method"):
            assert e[k] not in (None, "")
        assert e["severity"] in ("warning", "critical")
        assert "rule-based" in e["method"]


def test_consecutive_violations_merge_into_single_event():
    ev = [e for e in anomaly.detect(run(faults=[Fault("excess_load", 60, 60, 60)])["samples"])
          if e["rule_id"] == "bus_load_high"]
    assert len(ev) == 1 and ev[0]["sample_count"] > 10
    assert ev[0]["end_t_s"] > ev[0]["detected_t_s"]


def test_comm_dropout_creates_one_event_per_missed_pass():
    ev = [e for e in anomaly.detect(run(faults=[Fault("comm_dropout", 0, 240)])["samples"])
          if e["rule_id"] == "comm_missed_pass"]
    assert 2 <= len(ev) <= 4


def test_component_status_defaults_ok():
    assert set(anomaly.component_status([]).values()) == {"ok"}


# ---- optional ML detector (secondary signal; limitations documented) ----
def test_ml_detector_low_false_positives_and_flags_load_fault():
    ml = MLDetector()
    d = ml.describe()
    assert d["validated_on_real_data"] is False and "SIMULATED" in d["trained_on"]
    nominal = run(seed=5, duration_min=480)["samples"]
    nom_rate = len(ml.score(nominal)) / len(nominal)
    assert nom_rate < 0.02
    faulted = run(seed=5, duration_min=480, faults=[Fault("excess_load", 120, 60, 60)])["samples"]
    window = [o for o in ml.score(faulted) if 120 * 60 <= o["t_s"] < 180 * 60]
    win_rate = len(window) / 120
    assert win_rate > 0.10 and win_rate > 5 * max(nom_rate, 0.001)
