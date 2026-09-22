"""
Common Marine Data Model (CMDM) for ORCA Data Pipeline.
Source-agnostic unified model representing coastal weather, ocean dynamics, official warnings, and metadata.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

DataStatusType = Literal["LIVE", "CACHED", "DEMO", "PARTIAL", "UNAVAILABLE"]


class LocationData(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Decimal degrees North")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Decimal degrees East")
    region: Optional[str] = Field(None, description="Coastal district or sea region name")


class TimeData(BaseModel):
    observation_time: Optional[datetime] = Field(None, description="Actual observation timestamp")
    forecast_time: Optional[datetime] = Field(None, description="Target forecast point timestamp")
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Pipeline fetch timestamp")


class WeatherDataModel(BaseModel):
    wind_speed_kmph: Optional[float] = Field(None, description="Wind speed in km/h")
    wind_gust_kmph: Optional[float] = Field(None, description="Wind gust in km/h")
    wind_direction_deg: Optional[float] = Field(None, description="Wind direction in degrees")
    rainfall_mm_24h: Optional[float] = Field(None, description="24-hour rainfall total in mm")
    temperature_c: Optional[float] = Field(None, description="Air temperature in Celsius")
    pressure_hpa: Optional[float] = Field(None, description="Surface pressure in hPa")
    humidity_pct: Optional[float] = Field(None, description="Relative humidity percentage")
    condition: Optional[str] = Field(None, description="Weather condition description")


class OceanDataModel(BaseModel):
    wave_height_m: Optional[float] = Field(None, description="Significant wave height in meters")
    wave_period_s: Optional[float] = Field(None, description="Wave peak period in seconds")
    wave_direction_deg: Optional[float] = Field(None, description="Wave direction in degrees")
    swell_height_m: Optional[float] = Field(None, description="Swell height in meters")
    swell_period_s: Optional[float] = Field(None, description="Swell period in seconds")
    swell_direction_deg: Optional[float] = Field(None, description="Swell direction in degrees")
    current_speed_kmph: Optional[float] = Field(None, description="Ocean current speed in km/h")
    current_direction_deg: Optional[float] = Field(None, description="Ocean current direction in degrees")
    sea_surface_temperature_c: Optional[float] = Field(None, description="Sea surface temperature in Celsius")


class WarningItem(BaseModel):
    warning_type: str = Field(..., description="cyclone | marine | heavy_rainfall | thunderstorm | fishing | other")
    severity: str = Field(..., description="advisory | watch | warning | alert")
    headline: str = Field(..., description="Warning text summary")
    issued_by: str = Field("IMD", description="Issuing agency")
    valid_until: Optional[datetime] = Field(None, description="Expiry timestamp")
    source: str = Field("IMD Bulletin", description="Warning source provider")


class WarningDataModel(BaseModel):
    cyclone_warning: bool = Field(False, description="True if cyclone alert active")
    marine_warning: bool = Field(False, description="True if high wave/gale warning active")
    weather_warning: bool = Field(False, description="True if severe weather warning active")
    active_warnings: List[WarningItem] = Field(default_factory=list, description="List of structured warnings")
    warning_text: Optional[str] = Field(None, description="Aggregated warning headline text")
    warning_source: Optional[str] = Field(None, description="Primary warning provider source")


class SourceMetadata(BaseModel):
    source_name: str = Field(..., description="Provider identifier name (e.g. Open-Meteo Marine, IMD, INCOIS)")
    data_status: DataStatusType = Field(..., description="LIVE | CACHED | DEMO | UNAVAILABLE")
    timestamp: Optional[datetime] = Field(None, description="Observation or model timestamp")
    retrieval_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error: Optional[str] = Field(None, description="Error message if fetch or parsing failed")


class ValidationErrorItem(BaseModel):
    field: str = Field(..., description="Field identifier")
    value: Any = Field(None, description="Erroneous value")
    rule: str = Field(..., description="Validation rule triggered")
    reason: str = Field(..., description="Detailed failure description")


class ValidationReport(BaseModel):
    is_valid: bool = Field(True, description="True if no critical validation failures")
    errors: List[ValidationErrorItem] = Field(default_factory=list, description="Validation failure details")
    warnings: List[str] = Field(default_factory=list, description="Non-blocking validation warnings")


class PipelineMetadata(BaseModel):
    sources: List[SourceMetadata] = Field(default_factory=list, description="Metadata for each queried source")
    data_status: DataStatusType = Field("LIVE", description="Overall aggregated data status")
    freshness_seconds: Optional[float] = Field(None, description="Data age in seconds")
    confidence_score: int = Field(100, ge=0, le=100, description="Confidence percentage score (0-100)")
    errors: List[str] = Field(default_factory=list, description="Collected error messages across pipeline")


class CommonMarineDataModel(BaseModel):
    """Unified Common Marine Data Model (CMDM) returned by ORCA pipeline."""
    location: LocationData
    time: TimeData
    weather: WeatherDataModel
    ocean: OceanDataModel
    warnings: WarningDataModel
    metadata: PipelineMetadata
    validation: ValidationReport
