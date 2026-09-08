"""Mission specifications, vessel limits, and candidate waypoint models."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class VesselSpec(BaseModel):
    vessel_id: str = "demo-01"
    length_m: float = 5.0
    beam_m: float = 1.7
    cruising_speed_knots: float = 8.0
    fuel_capacity_l: float = 40.0
    max_operational_range_km: float = 40.0
    preferred_wave_height_m: float = 2.0
    preferred_wind_speed_kmh: float = 35.0
    fuel_budget_l: float = 32.0


class CandidateZone(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    distance_km: float
    bearing_deg: Optional[float] = None
    fishing_opportunity_score: float = 0.8
    wave_height_m: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    fuel_required_l: Optional[float] = None
    safety_score: float = 0.8
    fuel_score: float = 0.8
    total_mission_score: float = 0.8
    status: str = "PENDING"
    rejection_reasons: List[str] = Field(default_factory=list)


class MissionSpec(BaseModel):
    mission_type: str = "FISHING"
    origin: Dict[str, float]
    destination_candidate: Optional[CandidateZone] = None
    time_window: Dict[str, str]
    duration_hours: float = 6.0
    objectives: List[str] = Field(default_factory=lambda: ["safety", "fishing_opportunity"])
    constraints: List[str] = Field(default_factory=lambda: ["vessel_range", "restricted_zones"])
    vessel: VesselSpec = Field(default_factory=VesselSpec)
