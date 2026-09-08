"""Weather conditions schema."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class WeatherConditions(BaseModel):
    wind_speed_kmh: Optional[float] = Field(None, description="Wind speed at 10m in km/h")
    wind_speed_knots: Optional[float] = Field(None, description="Wind speed at 10m in knots")
    wind_direction_deg: Optional[float] = Field(None, description="Wind direction in degrees")
    wind_compass: Optional[str] = Field(None, description="Compass direction (e.g. NW, SSE)")
    wind_gusts_kmh: Optional[float] = Field(None, description="Peak wind gusts in km/h")

    precipitation_probability: Optional[float] = Field(None, description="Precipitation probability in %")
    precipitation_mm: Optional[float] = Field(None, description="Precipitation amount in mm")
    weather_code: Optional[int] = Field(None, description="WMO weather interpretation code")
    weather_description: Optional[str] = Field(None, description="Human readable weather description")
    air_temperature_c: Optional[float] = Field(None, description="Air temperature in Celsius")
    visibility_km: Optional[float] = Field(None, description="Horizontal visibility in km")

    timestamp: Optional[datetime] = Field(None, description="Valid forecast timestamp")
    source: str = Field(default="Open-Meteo Weather", description="Weather source name")
    mode: str = Field(default="live", description="Source execution mode: live | cached | demo")
