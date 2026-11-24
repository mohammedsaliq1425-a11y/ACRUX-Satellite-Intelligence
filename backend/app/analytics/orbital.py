"""Basic two-body orbit helpers (spherical Earth, circular orbits)."""
from __future__ import annotations

import math

MU_EARTH_KM3_S2 = 398_600.4418      # Earth gravitational parameter
EARTH_RADIUS_KM = 6371.0088          # IUGG mean radius (spherical-Earth approximation)
GEO_ALTITUDE_KM = 35_786.0           # equatorial GEO altitude above mean radius


def orbital_period_min(altitude_km: float) -> float:
    """Period of a circular orbit: T = 2*pi*sqrt(a^3/mu)."""
    if altitude_km <= 0:
        raise ValueError("altitude_km must be > 0")
    a = EARTH_RADIUS_KM + altitude_km
    return 2.0 * math.pi * math.sqrt(a ** 3 / MU_EARTH_KM3_S2) / 60.0


def eclipse_fraction(altitude_km: float) -> float:
    """Fraction of a circular orbit spent in Earth's shadow for beta angle = 0
    (cylindrical-shadow approximation; real orbits vary with beta angle/season)."""
    if altitude_km <= 0:
        raise ValueError("altitude_km must be > 0")
    return math.asin(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitude_km)) / math.pi


def slant_range_km(altitude_km: float, elevation_deg: float) -> float:
    """Distance from a ground point to a satellite at `altitude_km` seen at
    elevation `elevation_deg` (spherical Earth)."""
    if altitude_km <= 0:
        raise ValueError("altitude_km must be > 0")
    if not 0.0 <= elevation_deg <= 90.0:
        raise ValueError("elevation_deg must be between 0 and 90")
    re = EARTH_RADIUS_KM
    s = re * math.sin(math.radians(elevation_deg))
    return -s + math.sqrt(s * s + altitude_km ** 2 + 2.0 * re * altitude_km)


def coverage_radius_km(altitude_km: float, min_elevation_deg: float) -> float:
    """Ground radius (great-circle) of the footprint where the satellite is above
    `min_elevation_deg`: central angle = acos(Re*cos(el)/(Re+h)) - el."""
    if altitude_km <= 0:
        raise ValueError("altitude_km must be > 0")
    if not 0.0 <= min_elevation_deg < 90.0:
        raise ValueError("min_elevation_deg must be in [0, 90)")
    el = math.radians(min_elevation_deg)
    re = EARTH_RADIUS_KM
    lam = math.acos(re * math.cos(el) / (re + altitude_km)) - el
    return re * lam
