"""Open-Meteo Marine Provider implementation."""

from typing import Any, Dict
import httpx

from app.config import settings
from app.providers.marine.base import BaseMarineProvider
from app.utils.http import ProviderTimeout, ProviderUnavailable, ProviderMalformedData


class OpenMeteoMarineProvider(BaseMarineProvider):
    BASE_URL = settings.open_meteo_marine_url

    @property
    def provider_name(self) -> str:
        return "Open-Meteo Marine"

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
                "wave_height",
                "wave_period",
                "swell_wave_height",
                "swell_wave_period",
                "sea_surface_temperature",
                "ocean_current_velocity",
                "ocean_current_direction",
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
