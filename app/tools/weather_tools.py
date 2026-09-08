"""Weather operational tools."""

from typing import Any, Dict, Optional
from app.services.weather_service import WeatherService
from app.services.warning_service import WarningService


class WeatherTools:
    def __init__(
        self,
        weather_service: Optional[WeatherService] = None,
        warning_service: Optional[WarningService] = None,
    ):
        self.weather_service = weather_service or WeatherService()
        self.warning_service = warning_service or WarningService()

    async def get_weather_forecast(
        self,
        latitude: float,
        longitude: float,
        date_str: str,
        departure_time: Optional[str] = "05:00",
        duration_hours: Optional[float] = 6.0,
        demo_profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Tool to retrieve wind speed, gusts, precipitation, and visibility."""
        return await self.weather_service.get_weather(
            latitude=latitude,
            longitude=longitude,
            date_str=date_str,
            departure_time=departure_time,
            duration_hours=duration_hours,
            demo_profile=demo_profile,
        )

    async def get_coastal_warnings(
        self,
        location_name: Optional[str],
        latitude: float,
        longitude: float,
        date_str: str,
        demo_profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Tool to retrieve official fishermen and coastal warnings."""
        return await self.warning_service.get_warnings(
            location_name=location_name,
            latitude=latitude,
            longitude=longitude,
            date_str=date_str,
            demo_profile=demo_profile,
        )
