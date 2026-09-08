"""Marine conditions schema."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MarineConditions(BaseModel):
    wave_height_m: Optional[float] = Field(None, description="Significant wave height in meters")
    wave_period_s: Optional[float] = Field(None, description="Wave peak period in seconds")
    swell_height_m: Optional[float] = Field(None, description="Swell wave height in meters")
    swell_period_s: Optional[float] = Field(None, description="Swell wave period in seconds")
    sea_surface_temperature_c: Optional[float] = Field(None, description="Sea surface temperature in Celsius")
    ocean_current_velocity_ms: Optional[float] = Field(None, description="Ocean current velocity in m/s")
    ocean_current_velocity_knots: Optional[float] = Field(None, description="Ocean current velocity in knots")
    ocean_current_direction_deg: Optional[float] = Field(None, description="Ocean current direction in degrees")

    timestamp: Optional[datetime] = Field(None, description="Observation or model valid timestamp")
    source: str = Field(default="Open-Meteo Marine", description="Provider source name")
    mode: str = Field(default="live", description="Source execution mode: live | cached | demo")
