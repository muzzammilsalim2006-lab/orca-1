from datetime import datetime, timezone

from app.core.risk_engine import evaluate_risk
from app.schemas import DataSource, OceanData, WeatherData, WeatherWarning


def _source() -> DataSource:
    return DataSource(provider="test", retrieved_at=datetime.now(timezone.utc), data_status="live")


def _weather(**overrides) -> WeatherData:
    base = dict(wind_speed_kmph=8.0, wind_gust_kmph=12.0,
                precipitation_mm_last_hour=0.0, precipitation_mm_24h=0.0, source=_source())
    base.update(overrides)
    return WeatherData(**base)


def _ocean(**overrides) -> OceanData:
    base = dict(wave_height_m=0.5, swell_height_m=0.4, ocean_current_speed_kmph=1.0, source=_source())
    base.update(overrides)
    return OceanData(**base)


def test_calm_conditions_are_low_risk():
    risk = evaluate_risk(_weather(), _ocean(), [])
    assert risk.level == "LOW"
    assert risk.warning_override is False
    assert risk.missing_inputs == []


def test_storm_conditions_are_high_risk():
    risk = evaluate_risk(
        _weather(wind_speed_kmph=80.0, precipitation_mm_24h=220.0),
        _ocean(wave_height_m=4.0, swell_height_m=4.5, ocean_current_speed_kmph=6.0),
        [])
    assert risk.level == "HIGH"
    assert risk.score >= 60


def test_official_warning_overrides_computed_score():
    warning = WeatherWarning(id="w1", type="marine", severity="warning", headline="Test marine warning")
    risk = evaluate_risk(_weather(), _ocean(), [warning])
    assert risk.warning_override is True
    assert risk.level == "HIGH"
    assert risk.score >= 85


def test_missing_ocean_data_floors_to_moderate():
    risk = evaluate_risk(_weather(), None, [])
    assert "ocean" in risk.missing_inputs
    assert risk.level in ("MODERATE", "HIGH")
    assert risk.score >= 45


def test_null_fields_are_reported_missing_not_zero():
    risk = evaluate_risk(_weather(wind_speed_kmph=None, wind_gust_kmph=None), _ocean(), [])
    names = {f.name for f in risk.factors if f.status == "missing"}
    assert "wind" in names
    assert "wind" in risk.missing_inputs