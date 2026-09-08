"""Counterfactual What-If Reasoning Router: POST /api/mission/what-if."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_orchestrator
from app.agents.orchestrator import OrcaOrchestrator
from app.engines.counterfactual import CounterfactualEngine
from app.schemas.requests import AssessmentRequest, WhatIfRequest
from app.services.session_service import session_service

router = APIRouter(prefix="/api/mission/what-if", tags=["Counterfactual Simulation"])


@router.post("")
async def simulate_what_if(
    what_if_req: WhatIfRequest,
    orchestrator: OrcaOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Simulates counterfactual scenarios on planned missions:
    - 'What if waves increase by 1m?'
    - 'What if wind gusts rise by 15 km/h?'
    - 'What if departure time shifts by +3 hours?'
    - 'What if safety is prioritized over catch (weight re-allocation)?'
    """
    try:
        # Retrieve active or baseline state
        state = None
        if what_if_req.conversation_id:
            state = session_service.get_last_state(what_if_req.conversation_id)

        if not state:
            # Baseline Kochi mission
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

        simulation = CounterfactualEngine.simulate_scenario(
            base_state=state,
            wave_delta_m=what_if_req.wave_delta_m,
            wind_delta_kmh=what_if_req.wind_delta_kmh,
            departure_time_shift_hours=what_if_req.departure_time_shift_hours,
            priority_mode=what_if_req.priority_mode or "balanced",
        )

        return {
            "conversation_id": state.conversation_id,
            "mission_id": state.mission_id,
            "simulation": simulation,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"What-If simulation error: {str(exc)}",
        )
