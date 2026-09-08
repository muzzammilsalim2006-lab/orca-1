import pytest
from app.agents.planner import PlannerAgent
from app.agents.data_discovery import DataDiscoveryAgent
from app.agents.verifier import VerifierAgent
from app.agents.orchestrator import OrcaOrchestrator
from app.schemas.requests import AssessmentRequest
from app.state.mission_state import MarineState


def test_planner_and_data_discovery():
    req = AssessmentRequest(
        location_name="Kochi",
        latitude=9.9312,
        longitude=76.2673,
        date="2026-09-09",
        activity="fishing",
        departure_time="05:00",
        duration_hours=6.0,
    )
    mission = PlannerAgent.plan(req)
    assert mission.mission_type == "FISHING"
    assert mission.time_window["start"] == "05:00"
    assert mission.time_window["end"] == "11:00"

    manifest = DataDiscoveryAgent.discover_required_datasets(mission)
    assert "wave" in manifest["required_datasets"]
    assert "wind" in manifest["required_datasets"]
    assert "PFZ" in manifest["required_datasets"]


def test_verifier_safety_rejection():
    state = MarineState(
        marine={"wave_height_m": 3.8},  # Exceeds 2.0m limit for 5m craft
        weather={"wind_speed_kmh": 20.0},
        warnings={"severity": "NONE"},
        vessel={"limits": {"max_safe_wave_m": 2.0, "max_safe_wind_kmh": 35.0, "max_operational_range_km": 40.0, "fuel_budget_l": 32.0}},
    )
    candidate = {"id": "TEST-01", "distance_km": 15.0, "estimated_fuel_liters": 11.25, "zone_conflicts": []}

    result = VerifierAgent.verify(state, candidate)
    assert result["status"] == "REJECTED"
    assert any("exceeds vessel design limit" in r for r in result["reasons"])


@pytest.mark.asyncio
async def test_orchestrator_demo_mode():
    orchestrator = OrcaOrchestrator()
    req = AssessmentRequest(
        location_name="Kochi",
        latitude=9.9312,
        longitude=76.2673,
        date="2026-09-09",
        activity="fishing",
        demo_profile="normal",
    )
    state = await orchestrator.run_assessment(req)
    assert state.marine is not None
    assert state.weather is not None
    assert state.risk["level"] == "LOW"
    assert state.verification["status"] == "APPROVED"
    assert len(state.evidence) >= 5
    assert "Recommended" in state.explanation
