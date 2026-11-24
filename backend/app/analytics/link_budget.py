"""Satellite link-budget calculations.

All functions are pure and documented. Conventions:
  * powers in dBW unless noted, gains in dBi, losses in dB (positive = loss)
  * distances in km at the API boundary, metres inside formulas
  * frequencies in GHz at the API boundary, Hz inside formulas

Propagation delay is the speed-of-light travel time only. It is NOT network
latency (which adds processing, queuing, routing and ground-segment delays).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .orbital import GEO_ALTITUDE_KM, slant_range_km, coverage_radius_km, orbital_period_min

C_M_S = 299_792_458.0            # speed of light in vacuum (exact)
K_BOLTZMANN = 1.380649e-23       # J/K (exact, SI 2019)


def db10(x: float) -> float:
    return 10.0 * math.log10(x)


def fspl_db(distance_km: float, freq_ghz: float) -> float:
    """Free-space path loss: FSPL = 20*log10(4*pi*d*f / c)."""
    if distance_km <= 0 or freq_ghz <= 0:
        raise ValueError("distance_km and freq_ghz must be > 0")
    d_m = distance_km * 1000.0
    f_hz = freq_ghz * 1e9
    return 20.0 * math.log10(4.0 * math.pi * d_m * f_hz / C_M_S)


def propagation_delay_s(distance_km: float) -> float:
    """One-way vacuum light-travel time over the given path length."""
    if distance_km <= 0:
        raise ValueError("distance_km must be > 0")
    return distance_km * 1000.0 / C_M_S


def noise_power_dbw(system_noise_temp_k: float, bandwidth_hz: float) -> float:
    """Thermal noise power N = k*T*B, in dBW."""
    if system_noise_temp_k <= 0 or bandwidth_hz <= 0:
        raise ValueError("noise temperature and bandwidth must be > 0")
    return db10(K_BOLTZMANN * system_noise_temp_k * bandwidth_hz)


@dataclass
class LinkInputs:
    freq_ghz: float
    tx_power_w: float
    tx_gain_dbi: float
    rx_gain_dbi: float
    system_noise_temp_k: float
    bandwidth_hz: float
    distance_km: float | None = None
    altitude_km: float | None = None
    elevation_deg: float | None = None
    other_losses_db: float = 0.0
    required_cn_db: float | None = None


FORMULAS = [
    "EIRP [dBW] = 10*log10(P_tx[W]) + G_tx[dBi]",
    "FSPL [dB] = 20*log10(4*pi*d*f / c)",
    "P_rx [dBW] = EIRP - FSPL - L_other + G_rx",
    "N [dBW] = 10*log10(k*T_sys*B), k = 1.380649e-23 J/K",
    "C/N [dB] = P_rx - N;   C/N0 [dB-Hz] = C/N + 10*log10(B)",
    "Margin [dB] = C/N - (C/N)_required",
    "One-way delay [s] = d / c;   ground-sat-ground round trip = 2*d / c",
    "Slant range d = -Re*sin(el) + sqrt((Re*sin(el))^2 + h^2 + 2*Re*h)",
]

ASSUMPTIONS = [
    "Free-space propagation; atmospheric, rain, scintillation, pointing and "
    "polarisation losses must be supplied via 'other losses'.",
    "System noise temperature is a single user-supplied figure (no sky/antenna/LNA breakdown).",
    "Spherical Earth of mean radius 6371.0088 km when deriving slant range from altitude/elevation.",
    "Delays are vacuum light-travel times along a straight path; not network latency.",
    "Round trip = 2 x one-way path (same slant range up and down). A bent-pipe "
    "user-to-user hop crosses two such paths one way.",
]


def compute_link_budget(i: LinkInputs) -> dict:
    if not 0.1 <= i.freq_ghz <= 300:
        raise ValueError("freq_ghz must be between 0.1 and 300")
    if i.tx_power_w <= 0:
        raise ValueError("tx_power_w must be > 0")
    if i.other_losses_db < 0:
        raise ValueError("other_losses_db must be >= 0")

    if i.distance_km is not None:
        distance = i.distance_km
        distance_source = "user-supplied"
    elif i.altitude_km is not None and i.elevation_deg is not None:
        distance = slant_range_km(i.altitude_km, i.elevation_deg)
        distance_source = "derived from altitude and elevation"
    else:
        raise ValueError("Provide distance_km, or both altitude_km and elevation_deg")
    if not 1.0 <= distance <= 1_000_000.0:
        raise ValueError("distance must be between 1 km and 1,000,000 km")

    eirp = db10(i.tx_power_w) + i.tx_gain_dbi
    path_loss = fspl_db(distance, i.freq_ghz)
    prx = eirp - path_loss - i.other_losses_db + i.rx_gain_dbi
    n = noise_power_dbw(i.system_noise_temp_k, i.bandwidth_hz)
    cn = prx - n
    cn0 = cn + db10(i.bandwidth_hz)
    margin = None if i.required_cn_db is None else cn - i.required_cn_db
    one_way = propagation_delay_s(distance)

    return {
        "distance_km": distance,
        "distance_source": distance_source,
        "eirp_dbw": eirp,
        "fspl_db": path_loss,
        "rx_power_dbw": prx,
        "rx_power_dbm": prx + 30.0,
        "noise_power_dbw": n,
        "cn_db": cn,
        "cn0_dbhz": cn0,
        "required_cn_db": i.required_cn_db,
        "link_margin_db": margin,
        "link_closes": None if margin is None else margin >= 0,
        "one_way_delay_ms": one_way * 1000.0,
        "round_trip_delay_ms": 2.0 * one_way * 1000.0,
        "formulas": FORMULAS,
        "assumptions": ASSUMPTIONS,
        "kind": "calculation",   # derived from user inputs; not a measurement
    }


# Generic, illustrative orbit classes. NOT real operator constellations.
ORBIT_CLASSES = [
    ("LEO (illustrative 550 km)", 550.0),
    ("MEO (illustrative 20,200 km)", 20_200.0),
    ("GEO (35,786 km)", GEO_ALTITUDE_KM),
]


def orbit_comparison(freq_ghz: float, min_elevation_deg: float = 10.0) -> list[dict]:
    rows = []
    for name, h in ORBIT_CLASSES:
        d_zenith = slant_range_km(h, 90.0)
        d_min_el = slant_range_km(h, min_elevation_deg)
        rows.append({
            "orbit": name,
            "altitude_km": h,
            "period_min": orbital_period_min(h),
            "zenith_range_km": d_zenith,
            "range_at_min_elevation_km": d_min_el,
            "min_elevation_deg": min_elevation_deg,
            "fspl_zenith_db": fspl_db(d_zenith, freq_ghz),
            "fspl_min_elevation_db": fspl_db(d_min_el, freq_ghz),
            "one_way_delay_zenith_ms": propagation_delay_s(d_zenith) * 1000,
            "round_trip_delay_zenith_ms": 2 * propagation_delay_s(d_zenith) * 1000,
            "coverage_radius_km": coverage_radius_km(h, min_elevation_deg),
        })
    return rows
