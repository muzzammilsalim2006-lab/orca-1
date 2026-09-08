"""India Meteorological Department (IMD) Weather Provider adapter."""

from typing import Any, Dict
from app.providers.weather.base import BaseWeatherProvider


class IMDWeatherProvider(BaseWeatherProvider):
    """
    Adapter for IMD weather and coastal marine products.
    IMD delivers products via regional coastal forecast bulletins.
    """

    @property
    def provider_name(self) -> str:
        return "IMD Coastal Weather"

    async def fetch(
        self,
        latitude: float,
        longitude: float,
        forecast_days: int = 3,
    ) -> Dict[str, Any]:
        raise NotImplementedError(
            "IMD machine-readable JSON endpoint not publicly standardized; falling back to primary Open-Meteo."
        )
