"""Weather Domain Service: Coordinates weather providers, temporal slicing, and normalization."""

import json
from pathlib import Path
from typing import Any, Dict, Optional

from app.config import settings
from app.engines.normalizer import NormalizerEngine
from app.providers.weather.open_meteo import OpenMeteoWeatherProvider
from app.utils.logging import log_event
from app.utils.time import find_time_index


class WeatherService:
    def __init__(self):
        self.primary_provider = OpenMeteoWeatherProvider()

    async def get_weather(
        self,
        latitude: float,
        longitude: float,
        date_str: str,
        departure_time: Optional[str] = "05:00",
        duration_hours: Optional[float] = 6.0,
        demo_profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetches atmospheric weather conditions matching the target departure hour."""
        if settings.demo_mode or demo_profile:
            return self._load_demo_profile(demo_profile or "normal")

        try:
            log_event("WEATHER_PROVIDER_CALLED", {"provider": self.primary_provider.provider_name, "lat": latitude, "lon": longitude})
            raw = await self.primary_provider.fetch(latitude, longitude)
            return self._normalize_from_time_window(raw, date_str, departure_time, duration_hours)
        except Exception as exc:
            log_event("WEATHER_PROVIDER_FALLBACK", {"error": str(exc), "action": "loading_cached_fallback"})
            profile = demo_profile or "moderate"
            fallback = self._load_demo_profile(profile)
            fallback["mode"] = "cached_fallback"
            return fallback

    def _normalize_from_time_window(
        self,
        raw: Dict[str, Any],
        date_str: str,
        departure_time: Optional[str],
        duration_hours: Optional[float],
    ) -> Dict[str, Any]:
        hourly = raw.get("hourly", {})
        times = hourly.get("time", [])

        target_idx = find_time_index(times, date_str, departure_time)
        timestamp_str = times[target_idx] if target_idx < len(times) else None

        slice_data = {
            "wind_speed_10m": self._safe_get(hourly.get("wind_speed_10m"), target_idx),
            "wind_direction_10m": self._safe_get(hourly.get("wind_direction_10m"), target_idx),
            "wind_gusts_10m": self._safe_get(hourly.get("wind_gusts_10m"), target_idx),
            "precipitation_probability": self._safe_get(hourly.get("precipitation_probability"), target_idx),
            "precipitation": self._safe_get(hourly.get("precipitation"), target_idx),
            "weather_code": self._safe_get(hourly.get("weather_code"), target_idx),
            "temperature_2m": self._safe_get(hourly.get("temperature_2m"), target_idx),
            "visibility": self._safe_get(hourly.get("visibility"), target_idx),
        }

        return NormalizerEngine.normalize_weather(
            raw_slice=slice_data,
            source="Open-Meteo Weather",
            mode="live",
            timestamp_str=timestamp_str,
        )

    @staticmethod
    def _safe_get(lst: Optional[list], idx: int) -> Optional[Any]:
        if lst and 0 <= idx < len(lst):
            return lst[idx]
        return None

    def _load_demo_profile(self, profile_name: str) -> Dict[str, Any]:
        demo_dir = Path(__file__).resolve().parent.parent.parent / "data" / "demo"
        profile_file = demo_dir / f"{profile_name.lower()}.json"
        if not profile_file.exists():
            profile_file = demo_dir / "normal.json"

        with open(profile_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data["weather"]
