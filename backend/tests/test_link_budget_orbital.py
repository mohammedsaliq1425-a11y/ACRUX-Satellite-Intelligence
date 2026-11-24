import math
import pytest
from app.analytics import link_budget as lb
from app.analytics import orbital as ob


def test_fspl_reference_values():
    # 32.44 + 20log10(d_km) + 20log10(f_MHz): 1000 km @ 1 GHz = 152.44 dB
    assert lb.fspl_db(1000, 1.0) == pytest.approx(152.45, abs=0.05)
    # GEO nadir at 12 GHz is ~205.1 dB
    assert lb.fspl_db(35_786, 12.0) == pytest.approx(205.1, abs=0.1)


def test_fspl_doubles_distance_adds_6db():
    assert lb.fspl_db(2000, 5) - lb.fspl_db(1000, 5) == pytest.approx(6.0206, abs=1e-3)


def test_propagation_delay_geo():
    one_way_ms = lb.propagation_delay_s(35_786) * 1000
    assert one_way_ms == pytest.approx(119.37, abs=0.05)


def test_slant_range_limits():
    assert ob.slant_range_km(550, 90) == pytest.approx(550, abs=1e-6)
    assert 41_660 < ob.slant_range_km(35_786, 0) < 41_690          # GEO at the horizon
    assert ob.slant_range_km(550, 10) > ob.slant_range_km(550, 45) > 550


def test_slant_range_validation():
    with pytest.raises(ValueError):
        ob.slant_range_km(550, 95)
    with pytest.raises(ValueError):
        ob.slant_range_km(-1, 10)


def test_orbital_period_and_eclipse():
    assert 95.0 < ob.orbital_period_min(550) < 96.5
    assert 1434 < ob.orbital_period_min(35_786) < 1438          # ~ one sidereal day
    assert 0.36 < ob.eclipse_fraction(550) < 0.38


def test_coverage_radius_geo_horizon():
    assert ob.coverage_radius_km(35_786, 0) == pytest.approx(9041, abs=3)
    assert ob.coverage_radius_km(550, 10) < ob.coverage_radius_km(550, 0)


def test_full_link_budget_hand_calculation():
    r = lb.compute_link_budget(lb.LinkInputs(
        freq_ghz=12, tx_power_w=10, tx_gain_dbi=30, rx_gain_dbi=40,
        system_noise_temp_k=150, bandwidth_hz=36e6, distance_km=35_786,
        other_losses_db=2, required_cn_db=2.0))
    assert r["eirp_dbw"] == pytest.approx(40.0, abs=1e-9)
    assert r["rx_power_dbw"] == pytest.approx(-127.11, abs=0.02)
    assert r["noise_power_dbw"] == pytest.approx(-131.27, abs=0.02)
    assert r["cn_db"] == pytest.approx(4.17, abs=0.05)
    assert r["link_margin_db"] == pytest.approx(2.17, abs=0.05)
    assert r["link_closes"] is True
    assert r["round_trip_delay_ms"] == pytest.approx(2 * r["one_way_delay_ms"])
    assert r["kind"] == "calculation"


def test_link_budget_derives_distance_from_geometry():
    r = lb.compute_link_budget(lb.LinkInputs(
        freq_ghz=2.2, tx_power_w=5, tx_gain_dbi=3, rx_gain_dbi=30,
        system_noise_temp_k=200, bandwidth_hz=1e6, altitude_km=550, elevation_deg=90))
    assert r["distance_km"] == pytest.approx(550, abs=1e-6)
    assert "derived" in r["distance_source"]
    assert r["link_margin_db"] is None


def test_link_budget_negative_margin():
    r = lb.compute_link_budget(lb.LinkInputs(
        freq_ghz=30, tx_power_w=0.1, tx_gain_dbi=0, rx_gain_dbi=0,
        system_noise_temp_k=300, bandwidth_hz=50e6, distance_km=35_786, required_cn_db=10))
    assert r["link_closes"] is False and r["link_margin_db"] < 0


def test_link_budget_input_validation():
    base = dict(freq_ghz=12, tx_power_w=10, tx_gain_dbi=30, rx_gain_dbi=40,
                system_noise_temp_k=150, bandwidth_hz=36e6)
    with pytest.raises(ValueError):
        lb.compute_link_budget(lb.LinkInputs(**base))                       # no geometry
    with pytest.raises(ValueError):
        lb.compute_link_budget(lb.LinkInputs(**{**base, "freq_ghz": 0.01}, distance_km=100))
    with pytest.raises(ValueError):
        lb.compute_link_budget(lb.LinkInputs(**{**base, "tx_power_w": 0}, distance_km=100))
    with pytest.raises(ValueError):
        lb.compute_link_budget(lb.LinkInputs(**base, distance_km=100, other_losses_db=-1))


def test_orbit_comparison_ordering():
    rows = lb.orbit_comparison(12.0, 10.0)
    leo, meo, geo = rows
    assert leo["one_way_delay_zenith_ms"] < meo["one_way_delay_zenith_ms"] < geo["one_way_delay_zenith_ms"]
    assert leo["fspl_zenith_db"] < geo["fspl_zenith_db"]
    assert geo["coverage_radius_km"] > leo["coverage_radius_km"]
    assert geo["round_trip_delay_zenith_ms"] == pytest.approx(238.7, abs=0.2)
