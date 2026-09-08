from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class MissionActivity(str, Enum):
    FISHING = "fishing"
    SAFETY = "safety"
    RESEARCH = "research"
    DISASTER = "disaster"
    MARITIME = "maritime"


class MissionOrigin(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude of departure origin")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude of departure origin")
    port_name: Optional[str] = Field(default="Kochi", description="Name of origin port")


class VesselSpec(BaseModel):
    vessel_id: Optional[str] = Field(default="V-DEFAULT", description="Vessel identification")
    vessel_type: str = Field(default="motorized_traditional", description="Vessel category")
    length_m: float = Field(default=5.0, ge=1.0, le=100.0, description="Overall length in metres")
    beam_m: Optional[float] = Field(default=1.8, description="Beam width in metres")
    engine_hp: Optional[float] = Field(default=25.0, description="Engine horsepower")
    cruising_speed_knots: float = Field(default=8.0, description="Average cruising speed")
    max_wave_tolerance_m: float = Field(default=1.8, description="Maximum wave limit before abort")
    max_wind_tolerance_kmh: float = Field(default=40.0, description="Maximum wind limit before abort")
    fuel_capacity_liters: float = Field(default=60.0, description="Total fuel capacity")
    fuel_consumption_lph: float = Field(default=4.5, description="Litres consumed per cruising hour")


class MissionObjectives(BaseModel):
    safety: float = Field(default=0.45, ge=0.0, le=1.0, description="Safety priority weight")
    fishing_opportunity: float = Field(default=0.35, ge=0.0, le=1.0, description="Catch opportunity weight")
    fuel: float = Field(default=0.20, ge=0.0, le=1.0, description="Fuel conservation weight")


class MissionConstraint(BaseModel):
    constraint_id: str
    description: str
    constraint_type: str = "hard"  # hard or soft
    parameters: Dict[str, Any] = Field(default_factory=dict)


class TaskNode(BaseModel):
    task_id: str
    agent_name: str
    action: str
    task_name: Optional[str] = None
    depends_on: List[str] = Field(default_factory=list)
    status: str = "PENDING"  # PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
    result: Optional[Dict[str, Any]] = None
    duration_ms: float = 0.0


class MissionDefinition(BaseModel):
    mission_id: str = Field(..., description="Unique mission identifier")
    activity: MissionActivity = Field(default=MissionActivity.FISHING, description="Mission activity category")
    origin: MissionOrigin = Field(..., description="Starting location")
    departure: str = Field(..., description="Planned departure ISO-8601 timestamp")
    duration_hours: float = Field(default=6.0, gt=0.0, le=72.0, description="Mission window in hours")
    vessel: VesselSpec = Field(default_factory=VesselSpec, description="Vessel physical parameters")
    objectives: MissionObjectives = Field(default_factory=MissionObjectives, description="Multi-objective weights")
    constraints: List[MissionConstraint] = Field(default_factory=list, description="Hard and soft mission rules")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DynamicTaskGraph(BaseModel):
    mission_id: str
    nodes: Dict[str, TaskNode] = Field(default_factory=dict)

    @property
    def tasks(self) -> List[TaskNode]:
        return list(self.nodes.values())

    def add_task(
        self,
        task_id: str,
        agent_name: str,
        action: str,
        depends_on: Optional[List[str]] = None,
        task_name: Optional[str] = None,
    ) -> TaskNode:
        node = TaskNode(
            task_id=task_id,
            agent_name=agent_name,
            action=action,
            task_name=task_name or action,
            depends_on=depends_on or []
        )
        self.nodes[task_id] = node
        return node

    def get_ready_tasks(self) -> List[TaskNode]:
        ready = []
        for node in self.nodes.values():
            if node.status == "PENDING":
                dependencies_met = all(
                    self.nodes[dep].status == "COMPLETED" 
                    for dep in node.depends_on if dep in self.nodes
                )
                if dependencies_met:
                    ready.append(node)
        return ready

    def mark_completed(self, task_id: str, result: Dict[str, Any], duration_ms: float = 0.0):
        if task_id in self.nodes:
            self.nodes[task_id].status = "COMPLETED"
            self.nodes[task_id].result = result
            self.nodes[task_id].duration_ms = duration_ms

    def mark_failed(self, task_id: str, error: str):
        if task_id in self.nodes:
            self.nodes[task_id].status = "FAILED"
            self.nodes[task_id].result = {"error": error}
