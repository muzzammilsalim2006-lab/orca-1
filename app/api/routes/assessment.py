"""Primary Maritime Assessment Router: POST /api/assess."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_orchestrator
from app.agents.orchestrator import OrcaOrchestrator
from app.engines.scoring import ScoringEngine
from app.schemas.requests import AssessmentRequest
from app.schemas.responses import (
    AssessmentResponse,
    ConfidenceScore,
    EvidenceItem,
    ExecutionMode,
    LocationInfo,
    RiskAssessment,
    RiskComponents,
    VerificationCheck,
    VerificationResult,
)
from app.schemas.marine import MarineConditions
from app.schemas.weather import WeatherConditions
from app.schemas.warning import CoastalWarning
from app.utils.logging import log_event

router = APIRouter(prefix="/api/v1/assess", tags=["Assessment"])


@router.post("", response_model=AssessmentResponse)
async def assess_mission(
    request: AssessmentRequest,
    orchestrator: OrcaOrchestrator = Depends(get_orchestrator),
) -> AssessmentResponse:
    """
    Main ORCA operational assessment endpoint.
    Executes multi-agent intelligence gathering, deterministic risk and routing science,
    independent verification with automated re-planning, and evidence synthesis.
    """
    try:
        state = await orchestrator.run_assessment(request)

        # Build response schema
        loc_info = LocationInfo(
            name=state.location.get("name"),
            latitude=state.location["latitude"],
            longitude=state.location["longitude"],
            coastal_region=state.location.get("coastal_region"),
        )

        weather_obj = WeatherConditions(**state.weather)
        marine_obj = MarineConditions(**state.marine)
        warning_obj = CoastalWarning(**state.warnings)

        risk_comps = RiskComponents(**state.risk["components"])
        risk_obj = RiskAssessment(
            score=state.risk["score"],
            level=state.risk["level"],
            components=risk_comps,
        )

        recommendation = ScoringEngine.recommendation_for_risk(state.risk["level"])

        conf_obj = ConfidenceScore(
            score=state.confidence["score"],
            level=state.confidence["level"],
            factors=state.confidence.get("factors", {}),
        )

        evidence_items = [EvidenceItem(**item) for item in state.evidence]

        mode_obj = ExecutionMode(
            weather=state.weather.get("mode", "live"),
            marine=state.marine.get("mode", "live"),
            warnings=state.warnings.get("mode", "live"),
            data_quality="NOMINAL" if state.confidence["score"] >= 75 else "DEGRADED",
        )

        verif_data = state.verification
        v_checks = [VerificationCheck(**c) for c in verif_data.get("checks", [])]
        verif_obj = VerificationResult(
            status=verif_data.get("status", "APPROVED"),
            checks=v_checks,
            reasons=verif_data.get("reasons", []),
            replan_count=verif_data.get("replan_count", 0),
        )

        response = AssessmentResponse(
            conversation_id=state.conversation_id,
            mission_id=state.mission_id,
            language=state.language,
            request={
                "location_name": request.location_name,
                "latitude": request.latitude,
                "longitude": request.longitude,
                "date": request.date,
                "activity": request.activity,
                "departure_time": request.departure_time,
                "duration_hours": request.duration_hours,
                "vessel_length_m": request.vessel_length_m,
            },
            location=loc_info,
            weather=weather_obj,
            marine=marine_obj,
            warnings=warning_obj,
            pfz_advisories=state.pfz_advisories,
            satellite_data=state.satellite_data,
            risk=risk_obj,
            recommendation=recommendation,
            confidence=conf_obj,
            evidence=evidence_items,
            mode=mode_obj,
            verification=verif_obj,
            selected_candidate=state.selected_route,
            candidate_routes=state.routes,
            spatiotemporal_route=state.spatiotemporal_route,
            explanation=state.explanation,
            localized_explanation=state.localized_explanation,
            timestamp=datetime.now(timezone.utc),
        )

        log_event(
            "ASSESSMENT_COMPLETED",
            {
                "status": verif_obj.status,
                "risk_score": risk_obj.score,
                "confidence": conf_obj.score,
                "replan_count": verif_obj.replan_count,
            },
        )

        return response

    except Exception as exc:
        log_event("ASSESSMENT_FAILED", {"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ORCA assessment pipeline error: {str(exc)}",
        )
