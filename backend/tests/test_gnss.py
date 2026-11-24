import math
import numpy as np
import pytest
from app.analytics import gnss

LAT, LON, H = 40.0, -100.0, 100.0
GOOD = [("G01", 0, 90), ("G02", 0, 15), ("G03", 120, 15), ("G04", 240, 15),
        ("G05", 60, 45), ("G06", 300, 50)]


def sats(spec):
    return [gnss.SimSat(p, az, el) for p, az, el in spec]


def positions(spec):
    return np.array([gnss.sat_from_az_el(LAT, LON, H, az, el) for _, az, el in spec])


def test_geodetic_ecef_known_points():
    eq = gnss.geodetic_to_ecef(0, 0, 0)
    assert abs(eq[0] - 6_378_137.0) < 1e-6 and abs(eq[1]) < 1e-6 and abs(eq[2]) < 1e-6
    pole = gnss.geodetic_to_ecef(90, 0, 0)
    assert abs(pole[2] - 6_356_752.314) < 0.01


def test_az_el_roundtrip_geometry():
    rx = gnss.geodetic_to_ecef(LAT, LON, H)
    r = gnss.enu_rotation(LAT, LON)
    s = gnss.sat_from_az_el(LAT, LON, H, 90.0, 30.0)
    enu = r @ (s - rx)
    el = math.degrees(math.asin(enu[2] / np.linalg.norm(enu)))
    az = math.degrees(math.atan2(enu[0], enu[1])) % 360
    assert el == pytest.approx(30.0, abs=1e-6) and az == pytest.approx(90.0, abs=1e-6)


def test_noise_free_solution_recovers_truth():
    sp = positions(GOOD)
    rx = gnss.geodetic_to_ecef(LAT, LON, H)
    pr = np.linalg.norm(sp - rx, axis=1) + 1234.5
    sol = gnss.solve_position(sp, pr)
    assert sol["converged"]
    assert np.linalg.norm(sol["position_ecef_m"] - rx) < 1e-3
    assert sol["clock_bias_m"] == pytest.approx(1234.5, abs=1e-3)


def test_dop_identities_and_geometry_quality():
    rx = gnss.geodetic_to_ecef(LAT, LON, H)
    good = gnss.compute_dop(positions(GOOD[:4]), rx, LAT, LON)
    assert good["gdop"] ** 2 == pytest.approx(good["pdop"] ** 2 + good["tdop"] ** 2, rel=1e-9)
    assert good["pdop"] ** 2 == pytest.approx(good["hdop"] ** 2 + good["vdop"] ** 2, rel=1e-9)
    clustered = [("C1", 10, 40), ("C2", 14, 42), ("C3", 12, 38), ("C4", 16, 44)]
    bad = gnss.compute_dop(positions(clustered), rx, LAT, LON)
    assert bad["pdop"] > 5 * good["pdop"]
    assert good["vdop"] > good["hdop"] * 0.5     # vertical is typically the weaker component


def test_more_satellites_do_not_worsen_dop():
    rx = gnss.geodetic_to_ecef(LAT, LON, H)
    d4 = gnss.compute_dop(positions(GOOD[:4]), rx, LAT, LON)["pdop"]
    d6 = gnss.compute_dop(positions(GOOD), rx, LAT, LON)["pdop"]
    assert d6 <= d4 + 1e-12


def test_error_statistics_match_hdop_times_sigma():
    sigma, n = 5.0, 400
    sq = []
    hd = None
    for seed in range(n):
        r = gnss.simulate_fix(LAT, LON, H, sats(GOOD), noise_sigma_m=sigma, seed=seed)
        sq.append(r["horizontal_error_m"] ** 2)
        hd = r["dop"]["hdop"]
    rms = math.sqrt(sum(sq) / n)
    assert rms == pytest.approx(hd * sigma, rel=0.2)      # E[e^2+n^2] = (HDOP*sigma)^2


def test_simulation_is_deterministic_and_labelled():
    a = gnss.simulate_fix(LAT, LON, H, sats(GOOD), seed=7)
    b = gnss.simulate_fix(LAT, LON, H, sats(GOOD), seed=7)
    c = gnss.simulate_fix(LAT, LON, H, sats(GOOD), seed=8)
    assert a == b and a != c
    assert a["simulated"] is True and any("SIMULATED" in n for n in a["notes"])


def test_elevation_mask_and_minimum_satellites():
    low = sats([("L1", 0, 2), ("L2", 90, 3)] + [(p, az, el) for p, az, el in GOOD[:3]])
    with pytest.raises(ValueError, match="elevation mask"):
        gnss.simulate_fix(LAT, LON, H, low, elevation_mask_deg=5)
    ok = sats([("L1", 0, 2)] + [(p, az, el) for p, az, el in GOOD[:4]])
    r = gnss.simulate_fix(LAT, LON, H, ok, elevation_mask_deg=5)
    assert r["satellites_excluded_below_mask"] == ["L1"]
    assert len(r["satellites_used"]) == 4


def test_degenerate_geometry_rejected():
    rx = gnss.geodetic_to_ecef(LAT, LON, H)
    same = np.array([gnss.sat_from_az_el(LAT, LON, H, 30, 40)] * 4)
    with pytest.raises(ValueError):
        gnss.compute_dop(same, rx, LAT, LON)


def test_invalid_inputs():
    with pytest.raises(ValueError):
        gnss.simulate_fix(95, 0, 0, sats(GOOD))
    with pytest.raises(ValueError):
        gnss.simulate_fix(LAT, LON, H, sats(GOOD), noise_sigma_m=-1)
    with pytest.raises(ValueError):
        gnss.solve_position(positions(GOOD[:3]), np.zeros(3))
