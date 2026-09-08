"""Proactive Mission Monitoring Router: POST /api/mission/monitor."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_orchestrator
from app.agents.alert_agent import AlertAgent
from app.agents.orchestrator import OrcaOrchestrator
from app.schemas.requests import AssessmentRequest, MonitorRequest
from app.services.session_service import session_service

router = APIRouter(prefix="/api/mission/monitor", tags=["Proactive Monitoring"])


@router.post("")
async def monitor_active_mission(
    monitor_req: MonitorRequest,
    orchestrator: OrcaOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Proactively audits active or scheduled maritime voyages.
    Detects environmental drift, squall surges, and new IMD bulletins, triggering automated alerts.
    """
    try:
        state = None
        if monitor_req.conversation_id:
            state = session_service.get_last_state(monitor_req.conversation_id)

        if not state:
            base_req = AssessmentRequest(
                location_name="Kochi",
                latitude=9.9312,
                longitude=76.2673,
                date="2026-09-09",
                activity="fishing",
                departure_time="05:00",
                duration_hours=6.0,
            )
            state = await orchestrator.run_assessment(base_req)

        warning_override = None
        if monitor_req.incoming_warning_severity:
            warning_override = {
                "status": "SEVERE_ALERT" if monitor_req.incoming_warning_severity == "SEVERE" else "WARNING",
                "severity": monitor_req.incoming_warning_severity,
                "region": state.location.get("coastal_region", "Kerala Coast"),
                "message": f"Updated IMD Bulletin: {monitor_req.incoming_warning_severity} Sea State Advisory.",
                "source": "IMD Realtime Telemetry",
            }

        audit = AlertAgent.audit_active_mission(
            active_state=state,
            latest_wave_m=monitor_req.current_wave_height_m,
            latest_wind_kmh=monitor_req.current_wind_speed_kmh,
            latest_warning=warning_override,
        )

        return audit

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Proactive monitoring audit error: {str(exc)}",
        )
