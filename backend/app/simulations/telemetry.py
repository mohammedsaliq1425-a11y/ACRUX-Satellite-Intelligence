"""Simulated LEO Earth-observation satellite telemetry.

EVERYTHING produced here is SIMULATED. It is a simple physics-inspired model
(power balance, first-order thermal model, periodic eclipses and ground passes)
intended for education and for exercising the anomaly detectors. It is not
calibrated against any real spacecraft.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import numpy as np

from ..analytics.orbital import eclipse_fraction, orbital_period_min

DISCLAIMER = "SIMULATED TELEMETRY — NOT LIVE SPACECRAFT DATA"

FAULT_KINDS = {
    "solar_degradation": "Fraction (0-1) of solar-array output lost",
    "excess_load": "Extra electrical load, watts",
    "thermal_excursion": "Extra heat dissipated in the bus, watts",
    "attitude_drift": "Pointing error growth, degrees per minute",
    "comm_dropout": "Downlink unavailable during ground passes (magnitude unused)",
}

UNITS = {
    "battery_soc_pct": "%", "solar_power_w": "W", "bus_load_w": "W",
    "bus_temp_c": "°C", "attitude_error_deg": "deg", "roll_deg": "deg",
    "pitch_deg": "deg", "yaw_deg": "deg", "comm_snr_db": "dB",
}


@dataclass
class Fault:
    kind: str
    start_min: float
    duration_min: float
    magnitude: float = 1.0

    def __post_init__(self):
        if self.kind not in FAULT_KINDS:
            raise ValueError(f"Unknown fault kind '{self.kind}'")
        if self.start_min < 0 or self.duration_min <= 0:
            raise ValueError("Fault start must be >= 0 and duration > 0")
        if self.kind == "solar_degradation" and not 0 < self.magnitude <= 1:
            raise ValueError("solar_degradation magnitude must be in (0, 1]")

    def active(self, t_min: float) -> bool:
        return self.start_min <= t_min < self.start_min + self.duration_min


@dataclass
class SimConfig:
    duration_min: float = 240.0
    step_s: float = 30.0
    seed: int = 42
    altitude_km: float = 550.0
    battery_capacity_wh: float = 120.0
    solar_peak_w: float = 160.0
    initial_soc_pct: float = 75.0
    base_load_w: float = 45.0
    payload_load_w: float = 30.0
    comm_load_w: float = 15.0
    pass_duration_min: float = 8.0
    pass_offset_frac: float = 0.15
    thermal_capacity_j_per_k: float = 40_000.0
    thermal_conductance_w_per_k: float = 4.0
    environment_temp_c: float = 0.0
    sun_absorption_w: float = 20.0
    initial_temp_c: float = 17.0
    faults: list[Fault] = field(default_factory=list)

    def validate(self):
        if not 5 <= self.duration_min <= 1440:
            raise ValueError("duration_min must be between 5 and 1440")
        if not 5 <= self.step_s <= 300:
            raise ValueError("step_s must be between 5 and 300")
        if self.duration_min * 60 / self.step_s > 20_000:
            raise ValueError("Too many samples requested; increase step_s or reduce duration")
        if not 300 <= self.altitude_km <= 2000:
            raise ValueError("altitude_km must be between 300 and 2000 (LEO model)")


ASSUMPTIONS = [
    "Circular LEO orbit, beta angle 0, cylindrical Earth shadow.",
    "Solar output = peak x cos(pointing error) x (1 - degradation) while sunlit.",
    "Battery: energy integrates (solar - load); 95% charge efficiency; clamps at 0-100%.",
    "Thermal: single-node, C*dT/dt = 0.8*load + sun_absorption + faults - G*(T - T_env).",
    "Payload runs while sunlit; downlink contact once per orbit for a fixed duration.",
    "Attitude errors are small sinusoids plus Gaussian noise unless a fault is injected.",
    "Not calibrated against any real spacecraft.",
]


def generate(cfg: SimConfig, start_time: datetime | None = None) -> dict:
    cfg.validate()
    rng = np.random.default_rng(cfg.seed)
    period = orbital_period_min(cfg.altitude_km)
    ecl_frac = eclipse_fraction(cfg.altitude_km)
    start = start_time or datetime.now(timezone.utc)
    n = int(cfg.duration_min * 60 / cfg.step_s)

    energy_wh = cfg.battery_capacity_wh * cfg.initial_soc_pct / 100.0
    temp = cfg.initial_temp_c
    drift_deg = 0.0
    samples = []

    for k in range(n):
        t_s = k * cfg.step_s
        t_min = t_s / 60.0
        active = [f for f in cfg.faults if f.active(t_min)]
        phase = (t_min / period) % 1.0
        sunlit = phase < (1.0 - ecl_frac)
        pass_start = cfg.pass_offset_frac
        pass_end = pass_start + cfg.pass_duration_min / period
        in_window = pass_start <= phase < pass_end

        # --- attitude
        roll = 0.12 * math.sin(2 * math.pi * t_min / period) + rng.normal(0, 0.04)
        pitch = 0.10 * math.sin(2 * math.pi * t_min / period + 1.0) + rng.normal(0, 0.04)
        yaw = 0.08 * math.sin(2 * math.pi * t_min / (period * 0.5)) + rng.normal(0, 0.04)
        if any(f.kind == "attitude_drift" for f in active):
            rate = sum(f.magnitude for f in active if f.kind == "attitude_drift")
            drift_deg += rate * cfg.step_s / 60.0
        elif drift_deg > 0:  # wheel recovers quickly once the fault clears
            drift_deg = max(0.0, drift_deg - 0.5 * cfg.step_s / 60.0)
        roll += drift_deg
        att_err = math.sqrt(roll ** 2 + pitch ** 2 + yaw ** 2)

        # --- power
        degr = 0.0
        for f in active:
            if f.kind == "solar_degradation":
                degr = max(degr, f.magnitude)
        point_eff = math.cos(math.radians(min(att_err, 80.0)))
        solar = cfg.solar_peak_w * point_eff * (1 - degr) if sunlit else 0.0
        solar = max(0.0, solar + (rng.normal(0, 0.8) if sunlit else 0.0))

        link_up = in_window and not any(f.kind == "comm_dropout" for f in active)
        payload_on = sunlit
        extra_load = sum(f.magnitude for f in active if f.kind == "excess_load")
        load = (cfg.base_load_w + (cfg.payload_load_w if payload_on else 0.0)
                + (cfg.comm_load_w if link_up else 0.0) + extra_load
                + rng.normal(0, 0.5))

        net_w = solar - load
        eff = 0.95 if net_w > 0 else 1.0
        energy_wh = min(cfg.battery_capacity_wh,
                        max(0.0, energy_wh + net_w * eff * cfg.step_s / 3600.0))
        soc = 100.0 * energy_wh / cfg.battery_capacity_wh

        # --- thermal
        extra_heat = sum(f.magnitude for f in active if f.kind == "thermal_excursion")
        q_in = 0.8 * load + (cfg.sun_absorption_w if sunlit else 0.0) + extra_heat
        dtemp = (q_in - cfg.thermal_conductance_w_per_k *
                 (temp - cfg.environment_temp_c)) / cfg.thermal_capacity_j_per_k
        temp += dtemp * cfg.step_s

        samples.append({
            "t_s": t_s,
            "timestamp": (start + timedelta(seconds=t_s)).isoformat(timespec="seconds"),
            "sunlit": sunlit,
            "in_ground_pass_window": in_window,
            "battery_soc_pct": round(soc, 3),
            "solar_power_w": round(solar, 3),
            "bus_load_w": round(load, 3),
            "bus_temp_c": round(temp + rng.normal(0, 0.05), 3),
            "roll_deg": round(roll, 4), "pitch_deg": round(pitch, 4), "yaw_deg": round(yaw, 4),
            "attitude_error_deg": round(att_err, 4),
            "comm_link_up": bool(link_up),
            "comm_snr_db": round(12.0 + rng.normal(0, 0.6), 2) if link_up else None,
            "payload_state": "active" if payload_on else "standby",
            "_true_fault_kinds": [f.kind for f in active],  # ground truth for evaluation only
        })

    return {
        "simulated": True,
        "disclaimer": DISCLAIMER,
        "config": {
            "duration_min": cfg.duration_min, "step_s": cfg.step_s, "seed": cfg.seed,
            "altitude_km": cfg.altitude_km, "orbital_period_min": period,
            "eclipse_fraction": ecl_frac, "solar_peak_w": cfg.solar_peak_w,
            "battery_capacity_wh": cfg.battery_capacity_wh,
            "injected_faults": [f.__dict__ for f in cfg.faults],
        },
        "units": UNITS,
        "assumptions": ASSUMPTIONS,
        "samples": samples,
    }
