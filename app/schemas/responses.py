"""Response schema contract for /api/assess."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.marine import MarineConditions
from app.schemas.weather import WeatherConditions
from app.schemas.warning import CoastalWarning


class LocationInfo(BaseModel):
    name: Optional[str] = None
    latitude: float
    longitude: float
    coastal_region: Optional[str] = None


class RiskComponents(BaseModel):
    wave_score: int
    wind_score: int
    swell_score: int
    precipitation_penalty: int
    warning_penalty: int
    summary: str


class RiskAssessment(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Overall risk score from 0 (safest) to 100 (extreme)")
    level: str = Field(..., description="LOW | MODERATE | HIGH | SEVERE")
    components: RiskComponents


class ConfidenceScore(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Data confidence score from 0 to 100")
    level: str = Field(..., description="LOW | MODERATE | HIGH")
    factors: Dict[str, Any] = Field(default_factory=dict)


class EvidenceItem(BaseModel):
    source: str
    dataset: str
    timestamp: str
    location: Dict[str, float]
    value: Any
    unit: Optional[str] = None
    quality_status: str = "VALID"


class VerificationCheck(BaseModel):
    check_name: str
    passed: bool
    details: str


class VerificationResult(BaseModel):
    status: str = Field(..., description="APPROVED | REJECTED")
    checks: List[VerificationCheck] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    replan_count: int = 0


class ExecutionMode(BaseModel):
    weather: str
    marine: str
    warnings: str
    data_quality: str = "NOMINAL"


class AssessmentResponse(BaseModel):
    conversation_id: Optional[str] = None
    mission_id: Optional[str] = None
    language: str = "en"
    request: Dict[str, Any]
    location: LocationInfo
    weather: WeatherConditions
    marine: MarineConditions
    warnings: CoastalWarning
    pfz_advisories: List[Dict[str, Any]] = Field(default_factory=list)
    satellite_data: Dict[str, Any] = Field(default_factory=dict)
    risk: RiskAssessment
    recommendation: str
    confidence: ConfidenceScore
    evidence: List[EvidenceItem] = Field(default_factory=list)
    mode: ExecutionMode
    verification: VerificationResult
    selected_candidate: Optional[Dict[str, Any]] = None
    candidate_routes: List[Dict[str, Any]] = Field(default_factory=list)
    spatiotemporal_route: Dict[str, Any] = Field(default_factory=dict)
    explanation: str
    localized_explanation: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
