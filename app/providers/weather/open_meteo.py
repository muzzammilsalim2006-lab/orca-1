"""Open-Meteo Weather Provider implementation."""

from typing import Any, Dict
import httpx

from app.config import settings
from app.providers.weather.base import BaseWeatherProvider
from app.utils.http import ProviderTimeout, ProviderUnavailable, ProviderMalformedData


class OpenMeteoWeatherProvider(BaseWeatherProvider):
    BASE_URL = settings.open_meteo_weather_url

    @property
    def provider_name(self) -> str:
        return "Open-Meteo Weather"

    async def fetch(
        self,
        latitude: float,
        longitude: float,
        forecast_days: int = 3,
    ) -> Dict[str, Any]:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join([
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m",
                "precipitation_probability",
                "precipitation",
                "weather_code",
                "temperature_2m",
                "visibility",
            ]),
            "timezone": "Asia/Kolkata",
            "forecast_days": max(1, min(7, forecast_days)),
        }

        try:
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
                if "hourly" not in data:
                    raise ProviderMalformedData("Missing 'hourly' key in Open-Meteo response", self.provider_name)
                return data
        except httpx.TimeoutException as exc:
            raise ProviderTimeout(f"Timeout connecting to {self.provider_name}: {exc}", self.provider_name)
        except httpx.HTTPStatusError as exc:
            raise ProviderUnavailable(f"HTTP status {exc.response.status_code} from {self.provider_name}", self.provider_name)
        except httpx.RequestError as exc:
            raise ProviderUnavailable(f"Network error connecting to {self.provider_name}: {exc}", self.provider_name)
