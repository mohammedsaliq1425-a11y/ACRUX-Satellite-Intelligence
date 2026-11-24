import pytest
from app.core.config import load_settings
from app.core.errors import InputError
from app.integrations import celestrak, usgs
import asyncio

S = load_settings(env={})
FEED = {"features": [
    {"id": "us1", "properties": {"mag": 5.1, "magType": "mww", "place": "10 km N of X", "time": 1760000000000,
                                  "updated": 1760000100000, "url": "https://e/1", "tsunami": 0, "sig": 400, "status": "reviewed"},
     "geometry": {"coordinates": [100.5, -3.2, 25.0]}},
    {"id": "us2", "properties": {"mag": None, "time": "bad"}, "geometry": {"coordinates": [1, 2]}},
    {"id": "bad", "properties": {}, "geometry": {"coordinates": []}}]}


def test_usgs_normalisation_and_missing_values():
    rows = usgs.normalize(FEED)
    assert len(rows) == 2                                       # coordinate-less feature dropped
    r = next(x for x in rows if x["id"] == "us1")
    assert r["longitude"] == 100.5 and r["latitude"] == -3.2 and r["depth_km"] == 25.0
    assert r["time_utc"] == "2025-10-09T08:53:20+00:00"
    bad = next(x for x in rows if x["id"] == "us2")
    assert bad["magnitude"] is None and bad["time_utc"] is None and bad["depth_km"] is None
    with pytest.raises(ValueError):
        usgs.normalize({"nope": 1})
    with pytest.raises(InputError):
        asyncio.run(usgs.earthquakes(S, "../../etc"))


def test_celestrak_derivation_matches_known_orbits():
    iss_like = celestrak.derive({"OBJECT_NAME": "X", "MEAN_MOTION": "15.5", "ECCENTRICITY": "0.0005", "INCLINATION": "51.6"})
    assert 380 < iss_like["perigee_alt_km"] < 450 and 5.0 * 1 < iss_like["period_min"] < 95
    geo = celestrak.derive({"MEAN_MOTION": "1.0027", "ECCENTRICITY": "0.0001"})
    assert geo["semi_major_axis_km"] == pytest.approx(42164, abs=12)
    assert 35_700 < geo["perigee_alt_km"] < 35_900
    missing = celestrak.derive({"OBJECT_NAME": "Y"})
    assert missing["semi_major_axis_km"] is None and missing["perigee_alt_km"] is None
    hyper = celestrak.derive({"MEAN_MOTION": "1", "ECCENTRICITY": "1.2"})
    assert hyper["apogee_alt_km"] is None                       # invalid eccentricity is not computed
    with pytest.raises(InputError):
        asyncio.run(celestrak.debris_group(S, "active"))
