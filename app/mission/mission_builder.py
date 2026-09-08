from typing import Dict, Any, Optional
import uuid
from datetime import datetime, timezone, timedelta

from app.mission.mission_graph import (
    MissionDefinition,
    MissionActivity,
    MissionOrigin,
    VesselSpec,
    MissionObjectives,
    MissionConstraint,
    DynamicTaskGraph,
)


class MissionBuilder:
    """Declarative builder for structured ORCA Missions."""

    def __init__(self, mission_id: Optional[str] = None):
        self.mission_id = mission_id or f"M-{uuid.uuid4().hex[:8].upper()}"
        self.activity = MissionActivity.FISHING
        self.origin = MissionOrigin(lat=9.9312, lon=76.2673, port_name="Kochi")
        # Default departure: 2026-09-09T05:00:00+05:30 or tomorrow 5 AM
        self.departure = "2026-09-09T05:00:00+05:30"
        self.duration_hours = 6.0
        self.vessel = VesselSpec()
        self.objectives = MissionObjectives()
        self.constraints: list[MissionConstraint] = []
        self.metadata: Dict[str, Any] = {}

    def set_activity(self, activity: MissionActivity | str) -> "MissionBuilder":
        if isinstance(activity, str):
            activity = MissionActivity(activity.lower())
        self.activity = activity
        return self

    def set_origin(self, lat: float, lon: float, port_name: str = "Kochi") -> "MissionBuilder":
        self.origin = MissionOrigin(lat=lat, lon=lon, port_name=port_name)
        return self

    def set_departure(self, departure_iso: str) -> "MissionBuilder":
        self.departure = departure_iso
        return self

    def set_duration(self, hours: float) -> "MissionBuilder":
        self.duration_hours = float(hours)
        return self

    def set_schedule(self, departure_time: str = "05:00", duration_hours: float = 6.0) -> "MissionBuilder":
        self.departure = departure_time
        self.duration_hours = float(duration_hours)
        return self

    def set_vessel(
        self,
        length_m: float = 5.0,
        vessel_type: str = "motorized_traditional",
        vessel_id: Optional[str] = None,
        engine_hp: Optional[float] = None,
        **kwargs
    ) -> "MissionBuilder":
        spec_dict = {"length_m": length_m, "vessel_type": vessel_type}
        if vessel_id is not None:
            spec_dict["vessel_id"] = vessel_id
        if engine_hp is not None:
            spec_dict["engine_hp"] = engine_hp
        spec_dict.update(kwargs)
        self.vessel = VesselSpec(**spec_dict)
        return self

    def set_objectives(self, safety: float = 0.45, fishing: float = 0.35, fuel: float = 0.20) -> "MissionBuilder":
        total = safety + fishing + fuel
        if total > 0:
            self.objectives = MissionObjectives(
                safety=round(safety / total, 3),
                fishing_opportunity=round(fishing / total, 3),
                fuel=round(fuel / total, 3),
            )
        return self

    def add_constraint(self, constraint_id: str, description: str, constraint_type: str = "hard", parameters: Optional[Dict[str, Any]] = None) -> "MissionBuilder":
        self.constraints.append(
            MissionConstraint(
                constraint_id=constraint_id,
                description=description,
                constraint_type=constraint_type,
                parameters=parameters or {}
            )
        )
        return self

    def build(self) -> MissionDefinition:
        # Standard safety constraints automatically injected
        if not any(c.constraint_id == "RESTRICTED_ZONE_AVOIDANCE" for c in self.constraints):
            self.add_constraint("RESTRICTED_ZONE_AVOIDANCE", "Strict prohibition of transit in designated naval/firing polygons", "hard")
        if not any(c.constraint_id == "VESSEL_WAVE_LIMIT" for c in self.constraints):
            self.add_constraint(
                "VESSEL_WAVE_LIMIT", 
                f"Wave height must not exceed vessel tolerance ({self.vessel.max_wave_tolerance_m}m)", 
                "hard", 
                {"max_wave_m": self.vessel.max_wave_tolerance_m}
            )

        return MissionDefinition(
            mission_id=self.mission_id,
            activity=self.activity,
            origin=self.origin,
            departure=self.departure,
            duration_hours=self.duration_hours,
            vessel=self.vessel,
            objectives=self.objectives,
            constraints=self.constraints,
            metadata=self.metadata
        )

    def generate_dynamic_task_graph(self) -> DynamicTaskGraph:
        """Construct standard multi-agent execution pipeline DAG for this mission."""
        dtg = DynamicTaskGraph(mission_id=self.mission_id)
        # Level 0: Planning & Data Discovery
        dtg.add_task("task_plan", "planner", "decompose_mission", [], task_name="Mission Intent Decomposition")
        dtg.add_task("task_discovery", "data_discovery", "identify_required_datasets", ["task_plan"], task_name="Autonomous Dataset Discovery")

        # Level 1: Parallel Data Retrieval & Specialized Domain Inferences
        dtg.add_task("task_marine", "marine", "fetch_and_interpret_marine_state", ["task_discovery"], task_name="Acquire Marine Telemetry")
        dtg.add_task("task_weather", "weather", "fetch_and_assess_hazards", ["task_discovery"], task_name="Atmospheric Hazard Assessment")
        dtg.add_task("task_geo", "geospatial", "evaluate_spatial_restrictions", ["task_discovery"], task_name="Geospatial Boundary Verification")
        dtg.add_task("task_vessel", "vessel", "calculate_vessel_limits", ["task_discovery"], task_name="Vessel Envelope Modeling")

        # Level 2: Ocean State Fusion & Routing Optimization
        dtg.add_task("task_fusion", "fusion", "build_ocean_state_cube", ["task_marine", "task_weather", "task_geo"], task_name="Spatiotemporal Fusion Cube")
        dtg.add_task("task_routing", "routing", "compute_pareto_routes", ["task_fusion", "task_vessel"], task_name="Multi-Objective Decision Routing")

        # Level 3: Decision & Safety Verification
        dtg.add_task("task_decision", "decision", "rank_candidate_options", ["task_routing"], task_name="Candidate Zone Ranking")
        dtg.add_task("task_verifier", "verifier", "verify_safety_and_policy", ["task_decision"], task_name="Independent Safety & Policy Verification")

        # Level 4: Explanation & Evidence
        dtg.add_task("task_evidence", "evidence", "synthesize_evidence_graph", ["task_verifier"], task_name="Evidence Graph Synthesis")
        dtg.add_task("task_explanation", "explanation", "generate_natural_language_brief", ["task_evidence"], task_name="Multilingual Decision Briefing")

        return dtg

    def build_initial_task_graph(self) -> DynamicTaskGraph:
        return self.generate_dynamic_task_graph()
