import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.mission.mission_builder import MissionBuilder
from app.mission.mission_graph import MissionActivity
from app.engines.ocean_cube import OceanStateCube, OceanStatePoint
from app.engines.spatiotemporal import SpatiotemporalEngine
from app.engines.conflict_resolver import ConflictResolver
from app.engines.routing import RoutingEngine
from app.evidence.graph import EvidenceGraph
from app.evidence.models import NodeType, EdgeType
from app.scenario.scenario_engine import ScenarioEngine
from app.disaster.command import DisasterCommandService, CycloneTrack, VesselStatus

client = TestClient(app)


def test_mission_builder_and_task_graph():
    builder = (
        MissionBuilder()
        .set_activity(MissionActivity.FISHING)
        .set_origin(9.9312, 76.2673, "Kochi Port")
        .set_schedule(departure_time="05:30", duration_hours=6.5)
        .set_vessel(vessel_id="IND-KL-07-M-99", length_m=9.5, engine_hp=45.0)
    )
    mission_def = builder.build()
    assert mission_def.activity == MissionActivity.FISHING
    assert mission_def.origin.port_name == "Kochi Port"
    assert mission_def.vessel.length_m == 9.5

    task_graph = builder.generate_dynamic_task_graph()
    assert len(task_graph.tasks) >= 6
    task_names = [t.task_name for t in task_graph.tasks]
    assert "Acquire Marine Telemetry" in task_names
    assert "Multi-Objective Decision Routing" in task_names


def test_ocean_state_cube():
    cube = OceanStateCube(origin_lat=9.9312, origin_lon=76.2673, base_time_iso="2026-09-08T05:00:00Z")
    points = cube.generate_local_lattice(radius_km=30.0, grid_step_deg=0.1, time_steps_hours=4)
    assert len(points) > 0

    queried = cube.query(lat=9.95, lon=76.10, time_iso="2026-09-08T05:00:00Z")
    assert isinstance(queried, OceanStatePoint)
    assert queried.wave_height_m > 0


def test_spatiotemporal_fusion():
    cube = SpatiotemporalEngine.fuse_ocean_state(
        origin_lat=9.9312,
        origin_lon=76.2673,
        departure_iso="2026-09-08T05:00:00Z",
        duration_hours=6.0,
        marine_data={"wave_height_m": 1.4, "wave_period_s": 8.5},
        weather_data={"wind_speed_kmh": 22.0},
        satellite_data={"timestamp": "2026-09-08T03:00:00Z", "features": {"sst_celsius": 29.1, "chlorophyll_mg_m3": 0.55}}
    )
    assert cube.origin_lat == 9.9312
    assert len(cube.points) > 0


def test_conflict_resolver():
    # Concordant wave height
    res_agree = ConflictResolver.resolve_wave_height(open_meteo_val=1.2, incois_val=1.4)
    assert res_agree["status"] == "CONCORDANT"
    assert res_agree["confidence_penalty"] == 0.0

    # Conflicting wave height (> 0.5m discrepancy)
    res_conflict = ConflictResolver.resolve_wave_height(open_meteo_val=1.1, incois_val=2.2)
    assert res_conflict["status"] == "CONFLICT_CONSERVATIVE_BOUND"
    assert res_conflict["resolved_value"] == 2.2  # Picks conservative upper bound
    assert res_conflict["confidence_penalty"] > 0.0


def test_pareto_routes_generation():
    pareto = RoutingEngine.generate_pareto_routes(
        origin_lat=9.9312,
        origin_lon=76.2673,
        port_name="Kochi",
        departure_time_str="05:00"
    )
    assert "routes" in pareto
    assert len(pareto["routes"]) == 3
    assert pareto["safest"]["strategy"] == "SAFEST"
    assert pareto["balanced"]["strategy"] == "BALANCED"
    assert pareto["max_opportunity"]["strategy"] == "MAX_OPPORTUNITY"
    assert pareto["safest"]["safety_score"] >= pareto["balanced"]["safety_score"]


def test_evidence_graph_and_rejections():
    eg = EvidenceGraph(mission_id="MSN-TEST-001")
    n1 = eg.add_node(NodeType.QUESTION, "Mission Intent", "Can small boat fish safely?")
    n2 = eg.add_node(NodeType.OBSERVATION, "Marine Observation", "Wave height 1.3m", data={"wave": 1.3})
    eg.add_edge(n1.node_id, n2.node_id, EdgeType.INPUT_TO)

    eg.record_rejection(
        candidate_id="ZONE-GAMMA",
        name="Far Pelagic Trench",
        failed_check_id="RANGE_LIMIT",
        rejection_reason="Exceeds 5m vessel safe operational radius (38 km > 25 km limit)",
        metric_observed=38.0,
        metric_threshold=25.0
    )

    why = eg.explain_why()
    assert why["total_nodes"] >= 3
    assert len(why["raw_observations"]) == 1

    why_not = eg.explain_why_not()
    assert len(why_not) == 1
    assert why_not[0]["candidate_id"] == "ZONE-GAMMA"


def test_scenario_engine():
    base_state = {
        "location": {"latitude": 9.9312, "longitude": 76.2673},
        "marine": {"wave_height_m": 1.2, "wave_period_s": 8.0},
        "weather": {"wind_speed_kmh": 18.0, "precipitation_prob": 10.0},
        "warnings": {"active_warnings": []},
        "risk": {"score": 25.0, "level": "LOW"},
        "mission": {"departure_time": "05:00"}
    }
    scenario = ScenarioEngine.evaluate_scenario(
        base_state_dict=base_state,
        wave_multiplier=1.8,
        wind_multiplier=1.5,
    )
    assert scenario["scenario"]["wave_height_m"] > scenario["baseline"]["wave_height_m"]
    assert scenario["scenario"]["risk_score"] > scenario["baseline"]["risk_score"]
    assert scenario["delta"]["risk_score_delta"] > 0


def test_disaster_command_fleet_evaluation():
    cyclone = CycloneTrack(
        cyclone_id="CYC-TEST",
        name="Cyclone TEST",
        eye_latitude=10.0,
        eye_longitude=75.5,
        radius_km=100.0,
    )
    vessels = [
        VesselStatus(vessel_id="V-1", name="In Eye Boat", latitude=10.1, longitude=75.6),
        VesselStatus(vessel_id="V-2", name="Distant Boat", latitude=8.0, longitude=77.0),
    ]
    res = DisasterCommandService.evaluate_fleet(cyclone, vessels)
    assert res["fleet_summary"]["total_vessels_tracked"] == 2
    assert res["fleet_summary"]["critical_vessels_count"] == 1
    # Check emergency shelter allocated
    v1_res = [v for v in res["vessel_risk_rankings"] if v["vessel_id"] == "V-1"][0]
    assert v1_res["risk_level"] == "CRITICAL"
    assert "emergency_shelter" in v1_res
    assert v1_res["emergency_shelter"]["port_name"] != ""


def test_api_mission_endpoints_full_lifecycle():
    # 1. POST /api/mission
    payload = {
        "title": "Kerala Shelf Tuna Scouting",
        "location_name": "Kochi",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "activity": "fishing",
        "departure_time": "05:00",
        "duration_hours": 6.0,
        "vessel_length_m": 8.0,
        "engine_hp": 40.0
    }
    resp = client.post("/api/mission", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "mission_id" in data
    assert "pareto_routes" in data
    assert len(data["pareto_routes"]["routes"]) == 3
    assert "ocean_state_cube" in data
    assert "task_graph" in data

    mission_id = data["mission_id"]

    # 2. GET /api/mission/{id}
    resp_get = client.get(f"/api/mission/{mission_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["mission_id"] == mission_id

    # 3. POST /api/mission/{id}/scenario
    resp_scen = client.post(f"/api/mission/{mission_id}/scenario", json={"wave_multiplier": 1.5})
    assert resp_scen.status_code == 200
    assert resp_scen.json()["scenario"]["wave_height_m"] > 0

    # 4. GET /api/mission/{id}/trace
    resp_trace = client.get(f"/api/mission/{mission_id}/trace")
    assert resp_trace.status_code == 200
    assert resp_trace.json()["total_agent_events"] >= 0

    # 5. GET /api/mission/{id}/replay
    resp_replay = client.get(f"/api/mission/{mission_id}/replay")
    assert resp_replay.status_code == 200
    assert resp_replay.json()["total_steps"] >= 2

    # 6. GET /api/mission/{id}/evidence
    resp_evid = client.get(f"/api/mission/{mission_id}/evidence")
    assert resp_evid.status_code == 200
    assert "nodes" in resp_evid.json()

    # 7. GET /api/mission/{id}/pareto
    resp_pareto = client.get(f"/api/mission/{mission_id}/pareto")
    assert resp_pareto.status_code == 200
    assert len(resp_pareto.json()["routes"]) == 3

    # 8. GET /api/decision/{id}/explain
    resp_explain = client.get(f"/api/decision/{mission_id}/explain")
    assert resp_explain.status_code == 200
    assert "why_selected" in resp_explain.json()


def test_api_disaster_endpoints():
    resp_shelters = client.get("/api/disaster/shelters")
    assert resp_shelters.status_code == 200
    assert resp_shelters.json()["total_shelters"] >= 6

    resp_assess = client.post("/api/disaster/assess", json={})
    assert resp_assess.status_code == 200
    data = resp_assess.json()
    assert "disaster_incident" in data
    assert "fleet_summary" in data
    assert len(data["vessel_risk_rankings"]) > 0
