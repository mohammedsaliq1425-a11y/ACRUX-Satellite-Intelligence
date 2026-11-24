"""Rule-based anomaly detection over (simulated) telemetry.

This is a TRANSPARENT THRESHOLD DETECTOR: each alert states the rule, the
measured value, the expected range, and a suggested diagnostic. It is not a
trained model. Thresholds are engineering-style placeholders for the simulated
spacecraft, not values from any real mission.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

SEVERITY_ORDER = {"info": 0, "warning": 1, "critical": 2}
COMPONENTS = ["power", "thermal", "attitude", "communications", "payload"]


@dataclass(frozen=True)
class Hit:
    severity: str
    measured: float | str | bool
    expected: str
    reason: str


@dataclass(frozen=True)
class Rule:
    id: str
    component: str
    channel: str
    title: str
    action: str
    check: Callable[[dict, "DetectorConfig"], Hit | None]


@dataclass
class DetectorConfig:
    solar_peak_w: float = 160.0
    soc_warn_pct: float = 25.0
    soc_crit_pct: float = 12.0
    temp_warn_high_c: float = 35.0
    temp_crit_high_c: float = 45.0
    temp_warn_low_c: float = -5.0
    temp_crit_low_c: float = -20.0
    load_warn_w: float = 110.0
    load_crit_w: float = 140.0
    att_warn_deg: float = 1.0
    att_crit_deg: float = 3.0
    solar_warn_frac: float = 0.75
    solar_crit_frac: float = 0.50
    merge_gap_samples: int = 2


def _battery(s, c):
    v = s["battery_soc_pct"]
    if v < c.soc_crit_pct:
        return Hit("critical", v, f"{c.soc_warn_pct:g}–100 %", f"State of charge {v:.1f}% is below the critical limit {c.soc_crit_pct:g}%.")
    if v < c.soc_warn_pct:
        return Hit("warning", v, f"{c.soc_warn_pct:g}–100 %", f"State of charge {v:.1f}% is below the warning limit {c.soc_warn_pct:g}%.")


def _temp_high(s, c):
    v = s["bus_temp_c"]
    rng = f"{c.temp_warn_low_c:g}–{c.temp_warn_high_c:g} °C"
    if v > c.temp_crit_high_c:
        return Hit("critical", v, rng, f"Bus temperature {v:.1f} °C exceeds the critical limit {c.temp_crit_high_c:g} °C.")
    if v > c.temp_warn_high_c:
        return Hit("warning", v, rng, f"Bus temperature {v:.1f} °C exceeds the warning limit {c.temp_warn_high_c:g} °C.")


def _temp_low(s, c):
    v = s["bus_temp_c"]
    rng = f"{c.temp_warn_low_c:g}–{c.temp_warn_high_c:g} °C"
    if v < c.temp_crit_low_c:
        return Hit("critical", v, rng, f"Bus temperature {v:.1f} °C is below the critical limit {c.temp_crit_low_c:g} °C.")
    if v < c.temp_warn_low_c:
        return Hit("warning", v, rng, f"Bus temperature {v:.1f} °C is below the warning limit {c.temp_warn_low_c:g} °C.")


def _load(s, c):
    v = s["bus_load_w"]
    rng = f"0–{c.load_warn_w:g} W"
    if v > c.load_crit_w:
        return Hit("critical", v, rng, f"Bus load {v:.0f} W exceeds the critical limit {c.load_crit_w:g} W.")
    if v > c.load_warn_w:
        return Hit("warning", v, rng, f"Bus load {v:.0f} W exceeds the warning limit {c.load_warn_w:g} W.")


def _solar(s, c):
    if not s["sunlit"]:
        return None
    v = s["solar_power_w"]
    rng = f"≥ {c.solar_warn_frac * c.solar_peak_w:.0f} W (sunlit)"
    frac = v / c.solar_peak_w
    if frac < c.solar_crit_frac:
        return Hit("critical", v, rng, f"Solar output {v:.0f} W is {frac:.0%} of the design peak while sunlit.")
    if frac < c.solar_warn_frac:
        return Hit("warning", v, rng, f"Solar output {v:.0f} W is {frac:.0%} of the design peak while sunlit.")


def _attitude(s, c):
    v = s["attitude_error_deg"]
    rng = f"0–{c.att_warn_deg:g} deg"
    if v > c.att_crit_deg:
        return Hit("critical", v, rng, f"Pointing error {v:.2f}° exceeds the critical limit {c.att_crit_deg:g}°.")
    if v > c.att_warn_deg:
        return Hit("warning", v, rng, f"Pointing error {v:.2f}° exceeds the warning limit {c.att_warn_deg:g}°.")


def _comm(s, c):
    if s["in_ground_pass_window"] and not s["comm_link_up"]:
        return Hit("warning", "link down", "link up during scheduled pass",
                   "Downlink was expected during the scheduled ground-pass window but is not established.")


RULES = [
    Rule("battery_low_soc", "power", "battery_soc_pct", "Battery state of charge low",
         "Check the power budget and recent load history; defer non-essential payload operations; review array output.", _battery),
    Rule("bus_temp_high", "thermal", "bus_temp_c", "Bus temperature high",
         "Review recent dissipation and heater state; reduce payload duty cycle; check thermal-sensor consistency.", _temp_high),
    Rule("bus_temp_low", "thermal", "bus_temp_c", "Bus temperature low",
         "Check heater commands and eclipse duration; verify thermal-sensor consistency.", _temp_low),
    Rule("bus_load_high", "power", "bus_load_w", "Bus electrical load high",
         "Identify which loads are drawing more than budgeted; compare against the commanded mode.", _load),
    Rule("solar_underperformance", "power", "solar_power_w", "Solar array output below expectation",
         "Compare array output with pointing error; check for array degradation, shadowing, or sensor faults.", _solar),
    Rule("attitude_error_high", "attitude", "attitude_error_deg", "Attitude pointing error high",
         "Inspect reaction-wheel speeds and star-tracker/gyro health; consider a safe-mode attitude recovery.", _attitude),
    Rule("comm_missed_pass", "communications", "comm_link_up", "Expected ground contact not established",
         "Check transmitter state and antenna pointing; confirm ground-station schedule and retry on the next pass.", _comm),
]
_SEV_MAX = lambda a, b: a if SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] else b


def detect(samples: list[dict], cfg: DetectorConfig | None = None) -> list[dict]:
    """Return alert *events* (runs of consecutive rule violations)."""
    cfg = cfg or DetectorConfig()
    events: list[dict] = []
    for rule in RULES:
        open_ev: dict | None = None
        last_hit_idx = -10**9
        for i, s in enumerate(samples):
            hit = rule.check(s, cfg)
            if hit is None:
                continue
            if open_ev is not None and i - last_hit_idx <= cfg.merge_gap_samples:
                open_ev["end_t_s"] = s["t_s"]
                open_ev["end_timestamp"] = s["timestamp"]
                open_ev["sample_count"] += 1
                open_ev["severity"] = _SEV_MAX(open_ev["severity"], hit.severity)
                if _worse(rule.channel, hit.measured, open_ev["peak_measured_value"]):
                    open_ev["peak_measured_value"] = hit.measured
            else:
                open_ev = {
                    "rule_id": rule.id, "title": rule.title, "component": rule.component,
                    "channel": rule.channel, "severity": hit.severity,
                    "detected_t_s": s["t_s"], "detected_timestamp": s["timestamp"],
                    "end_t_s": s["t_s"], "end_timestamp": s["timestamp"],
                    "measured_value": hit.measured, "peak_measured_value": hit.measured,
                    "expected_range": hit.expected, "reason": hit.reason,
                    "suggested_action": rule.action, "sample_count": 1,
                    "method": "rule-based threshold detector",
                }
                events.append(open_ev)
            last_hit_idx = i
    events.sort(key=lambda e: (e["detected_t_s"], -SEVERITY_ORDER[e["severity"]]))
    for n, e in enumerate(events, 1):
        e["id"] = f"ALR-{n:04d}"
    return events


_LOWER_IS_WORSE = {"battery_soc_pct", "solar_power_w"}


def _worse(channel: str, new, old) -> bool:
    if isinstance(new, (int, float)) and isinstance(old, (int, float)):
        return new < old if channel in _LOWER_IS_WORSE else new > old
    return False


def component_status(events: list[dict]) -> dict[str, str]:
    """Worst severity seen per component (ok / warning / critical)."""
    out = {c: "ok" for c in COMPONENTS}
    for e in events:
        if SEVERITY_ORDER[e["severity"]] > SEVERITY_ORDER.get(out[e["component"]], 0):
            out[e["component"]] = e["severity"]
    return out
