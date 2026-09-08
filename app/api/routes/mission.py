from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.mission.mission_builder import MissionBuilder
from app.mission.mission_graph import MissionActivity
from app.agents.orchestrator import OrcaOrchestrator
from app.schemas.requests import AssessmentRequest
from app.services.mission_service import mission_service
from app.scenario.scenario_engine import ScenarioEngine
from app.engines.routing import RoutingEngine
from app.engines.spatiotemporal import SpatiotemporalEngine

router = APIRouter(tags=["Mission Graph & Observability"])
orchestrator = OrcaOrchestrator()


class CreateMissionRequest(BaseModel):
    title: Optional[str] = "Coastal Fishing & Monitoring Operation"
    location_name: Optional[str] = "Kochi"
    latitude: float = 9.9312
    longitude: float = 76.2673
    activity: str = "fishing"
    date: Optional[str] = None
    departure_time: Optional[str] = "05:00"
    duration_hours: float = 6.0
    vessel_id: Optional[str] = "IND-KL-07-MM-1204"
    vessel_length_m: float = 8.5
    engine_hp: float = 40.0
    preferred_language: Optional[str] = "en"
    raw_query: Optional[str] = None


class ScenarioParametersRequest(BaseModel):
    departure_time_shift: Optional[str] = None
    wave_multiplier: float = 1.0
    wind_multiplier: float = 1.0
    safety_weight: float = 0.45
    fishing_weight: float = 0.35
    fuel_weight: float = 0.20


@router.post("/mission", summary="Create and execute a dynamic Mission Graph")
async def create_mission(req: CreateMissionRequest):
    # 1. Build mission definition & task graph using MissionBuilder
    builder = (
        MissionBuilder()
        .set_activity(MissionActivity.FISHING if req.activity.lower() == "fishing" else MissionActivity.PATROL)
        .set_origin(req.latitude, req.longitude, req.location_name)
        .set_schedule(departure_time=req.departure_time or "05:00", duration_hours=req.duration_hours)
        .set_vessel(vessel_id=req.vessel_id or "IND-KL-07", length_m=req.vessel_length_m, engine_hp=req.engine_hp)
    )
    mission_def = builder.build()
    task_graph = builder.generate_dynamic_task_graph()

    # 2. Execute via orchestrator
    assess_req = AssessmentRequest(
        location_name=req.location_name or "Kochi",
        latitude=req.latitude,
        longitude=req.longitude,
        date=req.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        activity=req.activity,
        departure_time=req.departure_time,
        duration_hours=req.duration_hours,
        vessel_id=req.vessel_id,
        vessel_length_m=req.vessel_length_m,
    )
    state = await orchestrator.run_assessment(
        request=assess_req,
        raw_query=req.raw_query,
        preferred_lang=req.preferred_language,
    )

    # 3. Generate Pareto Routes (Safest, Balanced, Max Opportunity)
    pareto = RoutingEngine.generate_pareto_routes(
        origin_lat=req.latitude,
        origin_lon=req.longitude,
        port_name=req.location_name,
        departure_time_str=req.departure_time or "05:00",
        vessel_speed_knots=8.0
    )
    state.pareto_routes = pareto["routes"]

    # 4. Generate Ocean State Cube
    cube = SpatiotemporalEngine.fuse_ocean_state(
        origin_lat=req.latitude,
        origin_lon=req.longitude,
        departure_iso=f"{state.mission.get('date', '2026-09-08')}T{req.departure_time or '05:00'}:00Z",
        duration_hours=req.duration_hours,
        marine_data=state.marine,
        weather_data=state.weather,
    )
    state.ocean_state_cube = cube.to_dict()

    # 5. Persist in MissionService for observability
    mission_service.save_mission(state.mission_id, mission_def.model_dump(), state)

    return {
        "mission_id": state.mission_id,
        "conversation_id": state.conversation_id,
        "mission_definition": mission_def.model_dump(),
        "task_graph": task_graph.model_dump(),
        "ocean_state_cube": state.ocean_state_cube,
        "pareto_routes": pareto,
        "selected_route": state.selected_route,
        "risk": state.risk,
        "confidence": state.confidence,
        "explanation": state.explanation,
        "localized_explanation": state.localized_explanation,
        "replan_history": state.replan_history,
    }


@router.get("/mission/{mission_id}", summary="Retrieve full Mission State")
def get_mission(mission_id: str):
    state = mission_service.get_state(mission_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    mission_def = mission_service.get_mission(mission_id)
    return {
        "mission_id": mission_id,
        "definition": mission_def,
        "state": state.dict(),
    }


@router.post("/mission/{mission_id}/scenario", summary="Run What-If counterfactual scenario against mission")
def run_scenario(mission_id: str, params: ScenarioParametersRequest):
    state = mission_service.get_state(mission_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")

    result = ScenarioEngine.evaluate_scenario(
        base_state_dict=state.dict(),
        departure_time_shift=params.departure_time_shift,
        wave_multiplier=params.wave_multiplier,
        wind_multiplier=params.wind_multiplier,
        safety_weight=params.safety_weight,
        fishing_weight=params.fishing_weight,
        fuel_weight=params.fuel_weight,
    )
    return result


@router.get("/mission/{mission_id}/trace", summary="Agent execution timeline and performance trace")
def get_trace(mission_id: str):
    state = mission_service.get_state(mission_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    traces = mission_service.get_execution_trace(mission_id)
    return {
        "mission_id": mission_id,
        "total_agent_events": len(traces),
        "traces": traces,
    }


@router.get("/mission/{mission_id}/replay", summary="Step-by-step chronological decision replay")
def get_replay(mission_id: str):
    state = mission_service.get_state(mission_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    steps = mission_service.get_decision_replay(mission_id)
    return {
        "mission_id": mission_id,
        "total_steps": len(steps),
        "timeline": steps,
    }


@router.get("/mission/{mission_id}/evidence", summary="Cryptographic evidence DAG and provenance graph")
def get_evidence(mission_id: str):
    eg = mission_service.get_evidence_graph(mission_id)
    if not eg:
        raise HTTPException(status_code=404, detail=f"Evidence graph for {mission_id} not found")
    return eg.to_dict()


@router.get("/mission/{mission_id}/pareto", summary="Multi-objective Pareto-optimal route tradeoff frontiers")
def get_pareto(mission_id: str):
    state = mission_service.get_state(mission_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")

    origin = state.location
    pareto = RoutingEngine.generate_pareto_routes(
        origin_lat=origin.get("latitude", 9.9312),
        origin_lon=origin.get("longitude", 76.2673),
        port_name=origin.get("name", "Kochi"),
        departure_time_str=state.mission.get("departure_time", "05:00"),
    )
    return pareto


@router.get("/decision/{mission_id}/explain", summary="Detailed Why & Why-Not Explainability Breakdown")
def explain_decision(mission_id: str):
    explanation = mission_service.explain_decision(mission_id)
    if not explanation.get("why_selected"):
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    return explanation
