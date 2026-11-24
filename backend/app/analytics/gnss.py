"""Simplified GNSS positioning simulation: pseudorange least squares and DOP.

Everything produced here is SIMULATED geometry. No real satellite ephemerides,
no real receiver data. Model: pseudorange_i = |s_i - x| + c*dt + noise_i.
Ionosphere, troposphere, multipath, ephemeris and satellite-clock errors are
represented only by the single Gaussian noise term the user chooses.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .orbital import slant_range_km

WGS84_A = 6_378_137.0
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = WGS84_F * (2.0 - WGS84_F)


def geodetic_to_ecef(lat_deg: float, lon_deg: float, h_m: float = 0.0) -> np.ndarray:
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * math.sin(lat) ** 2)
    return np.array([
        (n + h_m) * math.cos(lat) * math.cos(lon),
        (n + h_m) * math.cos(lat) * math.sin(lon),
        (n * (1.0 - WGS84_E2) + h_m) * math.sin(lat),
    ])


def enu_rotation(lat_deg: float, lon_deg: float) -> np.ndarray:
    """Rows are the East, North, Up unit vectors expressed in ECEF."""
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    sl, cl, sp, cp = math.sin(lon), math.cos(lon), math.sin(lat), math.cos(lat)
    return np.array([
        [-sl, cl, 0.0],
        [-sp * cl, -sp * sl, cp],
        [cp * cl, cp * sl, sp],
    ])


def sat_from_az_el(lat_deg: float, lon_deg: float, h_m: float,
                   az_deg: float, el_deg: float, altitude_km: float = 20_200.0) -> np.ndarray:
    """ECEF position of a simulated satellite at the given azimuth/elevation as
    seen from the receiver, at (approximately) the given orbital altitude."""
    rng_m = slant_range_km(altitude_km, max(0.0, min(90.0, el_deg))) * 1000.0
    az, el = math.radians(az_deg), math.radians(el_deg)
    enu = rng_m * np.array([math.cos(el) * math.sin(az),
                            math.cos(el) * math.cos(az),
                            math.sin(el)])
    rot = enu_rotation(lat_deg, lon_deg)
    return geodetic_to_ecef(lat_deg, lon_deg, h_m) + rot.T @ enu


def solve_position(sats: np.ndarray, pseudoranges: np.ndarray,
                   max_iter: int = 25, tol_m: float = 1e-4) -> dict:
    """Gauss-Newton least squares for [x, y, z, clock_bias_m]. Needs >= 4 satellites."""
    sats = np.asarray(sats, dtype=float)
    pr = np.asarray(pseudoranges, dtype=float)
    if sats.shape[0] < 4:
        raise ValueError("At least 4 satellites are required for a 3-D fix")
    x = np.zeros(4)  # start at Earth's centre, zero clock bias
    converged = False
    it = 0
    for it in range(1, max_iter + 1):
        diff = x[:3] - sats
        rho = np.linalg.norm(diff, axis=1)
        h = np.column_stack([diff / rho[:, None], np.ones(len(rho))])
        resid = pr - (rho + x[3])
        try:
            dx, *_ = np.linalg.lstsq(h, resid, rcond=None)
        except np.linalg.LinAlgError as exc:  # pragma: no cover
            raise ValueError("Positioning geometry is singular") from exc
        x = x + dx
        if np.linalg.norm(dx) < tol_m:
            converged = True
            break
    rho = np.linalg.norm(x[:3] - sats, axis=1)
    rms = float(np.sqrt(np.mean((pr - (rho + x[3])) ** 2)))
    return {"position_ecef_m": x[:3], "clock_bias_m": float(x[3]),
            "iterations": it, "converged": converged, "residual_rms_m": rms}


def compute_dop(sats: np.ndarray, receiver_ecef: np.ndarray,
                lat_deg: float, lon_deg: float) -> dict:
    """DOP from the geometry matrix G = [-unit LOS, 1]; Q = (G^T G)^-1."""
    sats = np.asarray(sats, dtype=float)
    if sats.shape[0] < 4:
        raise ValueError("At least 4 satellites are required to compute DOP")
    diff = sats - receiver_ecef
    los = diff / np.linalg.norm(diff, axis=1)[:, None]
    g = np.column_stack([-los, np.ones(len(los))])
    gtg = g.T @ g
    if np.linalg.cond(gtg) > 1e12:
        raise ValueError("Satellite geometry is degenerate (DOP is effectively infinite)")
    q = np.linalg.inv(gtg)
    r = enu_rotation(lat_deg, lon_deg)
    q_enu = r @ q[:3, :3] @ r.T
    return {
        "gdop": float(math.sqrt(np.trace(q))),
        "pdop": float(math.sqrt(np.trace(q[:3, :3]))),
        "hdop": float(math.sqrt(q_enu[0, 0] + q_enu[1, 1])),
        "vdop": float(math.sqrt(q_enu[2, 2])),
        "tdop": float(math.sqrt(q[3, 3])),
    }


@dataclass
class SimSat:
    prn: str
    az_deg: float
    el_deg: float


def simulate_fix(lat_deg: float, lon_deg: float, h_m: float, sats: list[SimSat],
                 noise_sigma_m: float = 5.0, clock_bias_m: float = 0.0,
                 elevation_mask_deg: float = 5.0, altitude_km: float = 20_200.0,
                 seed: int = 1) -> dict:
    if not -90 <= lat_deg <= 90 or not -180 <= lon_deg <= 180:
        raise ValueError("Invalid receiver latitude/longitude")
    if noise_sigma_m < 0:
        raise ValueError("noise_sigma_m must be >= 0")

    used = [s for s in sats if s.el_deg >= elevation_mask_deg]
    excluded = [s.prn for s in sats if s.el_deg < elevation_mask_deg]
    if len(used) < 4:
        raise ValueError(
            f"Only {len(used)} satellite(s) above the {elevation_mask_deg:g} deg "
            "elevation mask; 4 are needed for a 3-D position and clock solution")

    rx = geodetic_to_ecef(lat_deg, lon_deg, h_m)
    sat_pos = np.array([sat_from_az_el(lat_deg, lon_deg, h_m, s.az_deg, s.el_deg,
                                       altitude_km) for s in used])
    rng = np.random.default_rng(seed)
    true_rho = np.linalg.norm(sat_pos - rx, axis=1)
    pr = true_rho + clock_bias_m + rng.normal(0.0, noise_sigma_m, len(used))

    sol = solve_position(sat_pos, pr)
    dop = compute_dop(sat_pos, rx, lat_deg, lon_deg)
    err_enu = enu_rotation(lat_deg, lon_deg) @ (sol["position_ecef_m"] - rx)

    return {
        "simulated": True,
        "satellites_used": [s.prn for s in used],
        "satellites_excluded_below_mask": excluded,
        "dop": dop,
        "error_enu_m": {"east": float(err_enu[0]), "north": float(err_enu[1]),
                        "up": float(err_enu[2])},
        "horizontal_error_m": float(math.hypot(err_enu[0], err_enu[1])),
        "vertical_error_m": float(abs(err_enu[2])),
        "expected_1sigma_horizontal_m": dop["hdop"] * noise_sigma_m,
        "expected_1sigma_vertical_m": dop["vdop"] * noise_sigma_m,
        "estimated_clock_bias_m": sol["clock_bias_m"],
        "true_clock_bias_m": clock_bias_m,
        "iterations": sol["iterations"],
        "converged": sol["converged"],
        "residual_rms_m": sol["residual_rms_m"],
        "noise_sigma_m": noise_sigma_m,
        "notes": [
            "SIMULATED satellite geometry and pseudoranges; not live GNSS data.",
            "Expected 1-sigma error ~= DOP x pseudorange noise (a statistical "
            "expectation; a single random draw can differ).",
        ],
    }
