from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DataStatus = Literal["live", "cached", "fallback", "demo", "unavailable"]
RiskLevel = Literal["LOW", "MODERATE", "HIGH"]


class DataSource(BaseModel):
    provider: str
    source_url: str | None = None
    retrieved_at: datetime
    data_status: DataStatus
    note: str | None = None


class Location(BaseModel):
    latitude: float
    longitude: float
    label: str | None = None


class WeatherWarning(BaseModel):
    id: str
    type: Literal["cyclone", "marine", "heavy_rainfall", "thunderstorm", "fishing", "other"]
    severity: Literal["advisory", "watch", "warning", "alert"]
    headline: str
    issued_by: str = "IMD"
    valid_until: datetime | None = None
    source: DataSource | None = None


class WeatherData(BaseModel):
    temperature_c: float | None = None
    feels_like_c: float | None = None
    humidity_pct: float | None = None
    pressure_hpa: float | None = None
    wind_speed_kmph: float | None = None
    wind_gust_kmph: float | None = None
    wind_direction_deg: float | None = None
    precipitation_mm_last_hour: float | None = None
    precipitation_mm_24h: float | None = None
    visibility_km: float | None = None
    condition: str | None = None
    source: DataSource


class OceanData(BaseModel):
    wave_height_m: float | None = None
    wave_period_s: float | None = None
    wave_direction_deg: float | None = None
    wind_wave_height_m: float | None = None
    swell_height_m: float | None = None
    swell_period_s: float | None = None
    swell_direction_deg: float | None = None
    sea_surface_temperature_c: float | None = None
    ocean_current_speed_kmph: float | None = None
    source: DataSource


class RiskFactor(BaseModel):
    name: str
    label: str
    value: float | None = None
    unit: str | None = None
    score: float | None = None
    weight: float
    status: Literal["ok", "missing"]
    note: str | None = None


class RiskAssessment(BaseModel):
    score: float
    level: RiskLevel
    factors: list[RiskFactor]
    missing_inputs: list[str]
    warning_override: bool
    advisories: list[str]
    recommendation: str


class Explanation(BaseModel):
    text: str
    provider: str
    generated_at: datetime
    guardrail: str = (
        "Advisory only. This text cannot change the risk score, level, recommendation, or official warnings."
    )


class AssessRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Decimal degrees north")
    longitude: float = Field(..., ge=-180, le=180, description="Decimal degrees east")
    label: str | None = None
    include_explanation: bool = True
    demo: bool | None = Field(
        default=None,
        description="true=force demo sample, false=force live, omit=server default",
    )


class AssessResponse(BaseModel):
    request_id: str
    assessed_at: datetime
    mode: Literal["live", "demo", "demo-fallback"]
    api_version: str
    location: Location
    weather: WeatherData | None = None
    ocean: OceanData | None = None
    warnings: list[WeatherWarning] = []
    risk: RiskAssessment
    explanation: Explanation | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    uptime_seconds: float
    demo_mode: bool
    cache: dict


class DemoLocation(BaseModel):
    label: str
    latitude: float
    longitude: float


class MetaResponse(BaseModel):
    version: str
    demo_mode: bool
    sources: list[dict]
    factor_thresholds: dict
    risk_levels: dict
    guardrails: list[str]
    limitations: list[str]
    demo_locations: list[DemoLocation]
