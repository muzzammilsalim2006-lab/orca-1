"""
Pipeline Data Normalizer: Standardizes raw provider outputs into unified units.
Guarantees missing fields remain None and are NEVER converted to zero.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models.marine_data import (
    OceanDataModel,
    WarningDataModel,
    WarningItem,
    WeatherDataModel,
)
from app.utils.logging import get_logger

log = get_logger("orca.pipeline.normalizer")


class DataNormalizer:
    """Normalizes heterogenous provider outputs into standard ORCA model formats."""

    @staticmethod
    def normalize_weather(raw_weather: Any) -> WeatherDataModel:
        """
        Extracts weather fields into WeatherDataModel.
        Preserves None values when parameters are missing.
        """
        if raw_weather is None:
            return WeatherDataModel()

        # Handle Pydantic model or Dict input
        if hasattr(raw_weather, "model_dump"):
            w_dict = raw_weather.model_dump()
        elif isinstance(raw_weather, dict):
            w_dict = raw_weather
        else:
            return WeatherDataModel()

        wind_speed = w_dict.get("wind_speed_kmph") or w_dict.get("wind_speed")
        wind_gust = w_dict.get("wind_gust_kmph") or w_dict.get("wind_gust")
        rain_24h = w_dict.get("precipitation_mm_24h") or w_dict.get("rainfall_mm_24h") or w_dict.get("precipitation_mm_last_hour")
        temp_c = w_dict.get("temperature_c") or w_dict.get("temperature")
        pressure = w_dict.get("pressure_hpa") or w_dict.get("pressure")
        humidity = w_dict.get("humidity_pct") or w_dict.get("humidity")
        condition = w_dict.get("condition")

        return WeatherDataModel(
            wind_speed_kmph=_safe_float(wind_speed),
            wind_gust_kmph=_safe_float(wind_gust),
            wind_direction_deg=_safe_float(w_dict.get("wind_direction_deg")),
            rainfall_mm_24h=_safe_float(rain_24h),
            temperature_c=_safe_float(temp_c),
            pressure_hpa=_safe_float(pressure),
            humidity_pct=_safe_float(humidity),
            condition=str(condition) if condition else None,
        )

    @staticmethod
    def normalize_ocean(raw_ocean: Any) -> OceanDataModel:
        """
        Extracts ocean fields into OceanDataModel.
        Preserves None values when parameters are missing.
        """
        if raw_ocean is None:
            return OceanDataModel()

        if hasattr(raw_ocean, "model_dump"):
            o_dict = raw_ocean.model_dump()
        elif isinstance(raw_ocean, dict):
            o_dict = raw_ocean
        else:
            return OceanDataModel()

        return OceanDataModel(
            wave_height_m=_safe_float(o_dict.get("wave_height_m")),
            wave_period_s=_safe_float(o_dict.get("wave_period_s")),
            wave_direction_deg=_safe_float(o_dict.get("wave_direction_deg")),
            swell_height_m=_safe_float(o_dict.get("swell_height_m")),
            swell_period_s=_safe_float(o_dict.get("swell_period_s")),
            swell_direction_deg=_safe_float(o_dict.get("swell_direction_deg")),
            current_speed_kmph=_safe_float(o_dict.get("ocean_current_speed_kmph") or o_dict.get("current_speed_kmph")),
            current_direction_deg=_safe_float(o_dict.get("ocean_current_direction_deg") or o_dict.get("current_direction_deg")),
            sea_surface_temperature_c=_safe_float(o_dict.get("sea_surface_temperature_c")),
        )

    @staticmethod
    def normalize_warnings(raw_warnings: Any) -> WarningDataModel:
        """Normalizes warning items into WarningDataModel."""
        if not raw_warnings or not isinstance(raw_warnings, list):
            return WarningDataModel()

        items: List[WarningItem] = []
        has_cyclone = False
        has_marine = False
        has_weather = False
        headlines: List[str] = []
        sources: List[str] = []

        for w in raw_warnings:
            if hasattr(w, "model_dump"):
                w_dict = w.model_dump()
            elif isinstance(w, dict):
                w_dict = w
            else:
                continue

            w_type = w_dict.get("type", "other")
            sev = w_dict.get("severity", "advisory")
            headline = w_dict.get("headline", "")
            issued_by = w_dict.get("issued_by", "IMD")

            if w_type == "cyclone" or "cyclone" in headline.lower():
                has_cyclone = True
            if w_type == "marine" or sev in ["warning", "alert"]:
                has_marine = True
            if w_type in ["heavy_rainfall", "thunderstorm"]:
                has_weather = True

            if headline:
                headlines.append(headline)
            sources.append(issued_by)

            items.append(WarningItem(
                warning_type=w_type,
                severity=sev,
                headline=headline,
                issued_by=issued_by,
                valid_until=w_dict.get("valid_until"),
                source=issued_by,
            ))

        return WarningDataModel(
            cyclone_warning=has_cyclone,
            marine_warning=has_marine,
            weather_warning=has_weather,
            active_warnings=items,
            warning_text=" | ".join(headlines) if headlines else None,
            warning_source=", ".join(sorted(set(sources))) if sources else None,
        )


def _safe_float(val: Any) -> Optional[float]:
    """Safely converts input to float without replacing None with zero."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
