import pytest
from app.engines.normalizer import NormalizerEngine
from app.engines.risk import RiskEngine
from app.engines.scoring import ScoringEngine
from app.engines.routing import RoutingEngine
from app.engines.uncertainty import UncertaintyEngine


def test_normalizer_units():
    raw_marine = {
        "wave_height": 1.456,
        "wave_period": 7.82,
        "ocean_current_velocity": 0.5144,  # ~1 knot
        "ocean_current_direction": 180.0,
    }
    norm_marine = NormalizerEngine.normalize_marine(raw_marine)
    assert norm_marine["wave_height_m"] == 1.46
    assert norm_marine["ocean_current_velocity_knots"] == 1.0

    raw_weather = {
        "wind_speed_10m": 18.52,  # ~10 knots
        "wind_direction_10m": 270.0,
        "weather_code": 1,
    }
    norm_weather = NormalizerEngine.normalize_weather(raw_weather)
    assert norm_weather["wind_speed_kmh"] == 18.5
    assert norm_weather["wind_compass"] == "W"
    assert norm_weather["weather_description"] == "Mainly clear"


def test_risk_engine_deterministic():
    # Low risk
    low_risk = RiskEngine.calculate_risk(
        marine={"wave_height_m": 0.8, "swell_height_m": 0.5},
        weather={"wind_speed_kmh": 15.0, "precipitation_probability": 10},
        warnings={"severity": "NONE"},
    )
    assert low_risk["level"] == "LOW"
    assert low_risk["score"] <= 30

    # Moderate risk
    mod_risk = RiskEngine.calculate_risk(
        marine={"wave_height_m": 2.2, "swell_height_m": 1.2},
        weather={"wind_speed_kmh": 32.0, "precipitation_probability": 40},
        warnings={"severity": "NONE"},
    )
    assert mod_risk["level"] == "MODERATE"
    assert 30 < mod_risk["score"] <= 60

    # Severe warning override
    severe_risk = RiskEngine.calculate_risk(
        marine={"wave_height_m": 1.0},
        weather={"wind_speed_kmh": 15.0},
        warnings={"severity": "SEVERE", "status": "SEVERE_ALERT"},
    )
    assert severe_risk["level"] == "SEVERE"
    assert severe_risk["score"] >= 95


def test_routing_engine_haversine():
    # Distance between Kochi (9.9312, 76.2673) and Mumbai (18.9220, 72.8347) is ~1060 km
    dist = RoutingEngine.haversine_distance_km(9.9312, 76.2673, 18.9220, 72.8347)
    assert 1000 < dist < 1150


def test_routing_engine_polygon():
    poly = [[10.0, 70.0], [10.0, 71.0], [11.0, 71.0], [11.0, 70.0], [10.0, 70.0]]
    # Inside
    assert RoutingEngine.point_in_polygon(10.5, 70.5, poly) is True
    # Outside
    assert RoutingEngine.point_in_polygon(12.0, 70.5, poly) is False
    # Intersects
    assert RoutingEngine.route_intersects_polygon(9.0, 70.5, 12.0, 70.5, poly) is True


def test_uncertainty_confidence():
    conf = UncertaintyEngine.calculate_confidence(
        source_count=2,
        missing_ratio=0.0,
        stale=False,
        disagreement=0.0,
        mode="live",
    )
    assert conf["score"] >= 95
    assert conf["level"] == "HIGH"
