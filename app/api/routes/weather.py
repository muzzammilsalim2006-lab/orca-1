"""Weather and coastal warnings inspection router."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.api.dependencies import get_weather_service, get_warning_service
from app.services.weather_service import WeatherService
from app.services.warning_service import WarningService

router = APIRouter(prefix="/api/weather", tags=["Weather"])


@router.get("")
async def get_weather_and_warnings(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    location_name: Optional[str] = Query(None),
    departure_time: Optional[str] = Query("05:00"),
    duration_hours: Optional[float] = Query(6.0),
    demo_profile: Optional[str] = Query(None),
    weather_service: WeatherService = Depends(get_weather_service),
    warning_service: WarningService = Depends(get_warning_service),
):
    """Direct lookup for weather forecast and active regional warnings."""
    weather = await weather_service.get_weather(
        latitude=latitude,
        longitude=longitude,
        date_str=date,
        departure_time=departure_time,
        duration_hours=duration_hours,
        demo_profile=demo_profile,
    )
    warnings = await warning_service.get_warnings(
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        date_str=date,
        demo_profile=demo_profile,
    )
    return {
        "weather": weather,
        "warnings": warnings,
    }
