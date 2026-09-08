"""Normalizer Engine: Converts raw provider payloads into standard ORCA representations."""

from datetime import datetime
from typing import Any, Dict, Optional
from app.utils.units import ms_to_kmh, kmh_to_knots, ms_to_knots, degrees_to_compass

WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm: Slight or moderate",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


class NormalizerEngine:
    @staticmethod
    def normalize_marine(
        raw_slice: Dict[str, Any],
        source: str = "Open-Meteo Marine",
        mode: str = "live",
        timestamp_str: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Normalizes marine observation or forecast values."""
        current_ms = raw_slice.get("ocean_current_velocity")
        current_knots = ms_to_knots(current_ms) if current_ms is not None else None

        ts = None
        if timestamp_str:
            try:
                ts = datetime.fromisoformat(timestamp_str)
            except Exception:
                ts = datetime.utcnow()

        return {
            "wave_height_m": round(raw_slice.get("wave_height", 0.0), 2) if raw_slice.get("wave_height") is not None else None,
            "wave_period_s": round(raw_slice.get("wave_period", 0.0), 1) if raw_slice.get("wave_period") is not None else None,
            "swell_height_m": round(raw_slice.get("swell_wave_height", 0.0), 2) if raw_slice.get("swell_wave_height") is not None else None,
            "swell_period_s": round(raw_slice.get("swell_wave_period", 0.0), 1) if raw_slice.get("swell_wave_period") is not None else None,
            "sea_surface_temperature_c": round(raw_slice.get("sea_surface_temperature", 0.0), 1) if raw_slice.get("sea_surface_temperature") is not None else None,
            "ocean_current_velocity_ms": round(current_ms, 2) if current_ms is not None else None,
            "ocean_current_velocity_knots": current_knots,
            "ocean_current_direction_deg": round(raw_slice.get("ocean_current_direction", 0.0), 1) if raw_slice.get("ocean_current_direction") is not None else None,
            "timestamp": ts,
            "source": source,
            "mode": mode,
        }

    @staticmethod
    def normalize_weather(
        raw_slice: Dict[str, Any],
        source: str = "Open-Meteo Weather",
        mode: str = "live",
        timestamp_str: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Normalizes atmospheric weather values."""
        wind_kmh = raw_slice.get("wind_speed_10m")
        wind_deg = raw_slice.get("wind_direction_10m")
        code = raw_slice.get("weather_code")

        ts = None
        if timestamp_str:
            try:
                ts = datetime.fromisoformat(timestamp_str)
            except Exception:
                ts = datetime.utcnow()

        return {
            "wind_speed_kmh": round(wind_kmh, 1) if wind_kmh is not None else None,
            "wind_speed_knots": kmh_to_knots(wind_kmh),
            "wind_direction_deg": round(wind_deg, 1) if wind_deg is not None else None,
            "wind_compass": degrees_to_compass(wind_deg),
            "wind_gusts_kmh": round(raw_slice.get("wind_gusts_10m", 0.0), 1) if raw_slice.get("wind_gusts_10m") is not None else None,
            "precipitation_probability": raw_slice.get("precipitation_probability"),
            "precipitation_mm": round(raw_slice.get("precipitation", 0.0), 1) if raw_slice.get("precipitation") is not None else None,
            "weather_code": code,
            "weather_description": WMO_WEATHER_CODES.get(code, "Unknown weather condition") if code is not None else "Clear",
            "air_temperature_c": round(raw_slice.get("temperature_2m", 0.0), 1) if raw_slice.get("temperature_2m") is not None else None,
            "visibility_km": round(raw_slice.get("visibility", 10000) / 1000.0, 1) if raw_slice.get("visibility") is not None else 10.0,
            "timestamp": ts,
            "source": source,
            "mode": mode,
        }
