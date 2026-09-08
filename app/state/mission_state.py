"""Unified MarineState dataclass shared across all agents and engines."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class MarineState:
    conversation_id: Optional[str] = None
    mission_id: Optional[str] = None
    query: Optional[str] = None
    language: str = "en"

    location: Dict[str, Any] = field(default_factory=dict)
    mission: Dict[str, Any] = field(default_factory=dict)

    # Environmental observations & forecasts
    weather: Dict[str, Any] = field(default_factory=dict)
    marine: Dict[str, Any] = field(default_factory=dict)
    warnings: Dict[str, Any] = field(default_factory=dict)

    # Indian Ocean domain sources (INCOIS PFZ & MOSDAC Satellite)
    pfz_advisories: List[Dict[str, Any]] = field(default_factory=list)
    satellite_data: Dict[str, Any] = field(default_factory=dict)

    # Domain models & spatiotemporal route
    geospatial: Dict[str, Any] = field(default_factory=dict)
    vessel: Dict[str, Any] = field(default_factory=dict)
    spatiotemporal_route: Dict[str, Any] = field(default_factory=dict)

    # Scientific engine outputs
    risk: Dict[str, Any] = field(default_factory=dict)
    confidence: Dict[str, Any] = field(default_factory=dict)
    routes: List[Dict[str, Any]] = field(default_factory=list)
    selected_route: Optional[Dict[str, Any]] = None

    # Counterfactual scenario tracking
    counterfactual: Optional[Dict[str, Any]] = None
    counterfactual_delta: Optional[Dict[str, Any]] = None

    # Proactive alerts
    proactive_alerts: List[Dict[str, Any]] = field(default_factory=list)

    # Traceability & Verification
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    verification: Dict[str, Any] = field(default_factory=dict)
    replan_history: List[Dict[str, Any]] = field(default_factory=list)
    explanation: str = ""
    localized_explanation: Optional[str] = None
    audit_trace: List[Dict[str, Any]] = field(default_factory=list)

    # Advanced ORCA Intelligence Layer fields
    agent_traces: List[Dict[str, Any]] = field(default_factory=list)
    ocean_state_cube: Dict[str, Any] = field(default_factory=dict)
    pareto_routes: Dict[str, Any] = field(default_factory=dict)
    rejected_candidates: List[Dict[str, Any]] = field(default_factory=list)
    why_not_reasons: List[Dict[str, Any]] = field(default_factory=list)
    dynamic_task_graph: Dict[str, Any] = field(default_factory=dict)

    def add_evidence(
        self,
        source: str,
        dataset: str,
        value: Any,
        location: Dict[str, float],
        unit: Optional[str] = None,
        quality_status: str = "VALID",
    ) -> None:
        """Appends a cryptographically traceable evidence record."""
        self.evidence.append({
            "source": source,
            "dataset": dataset,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "location": location,
            "value": value,
            "unit": unit,
            "quality_status": quality_status,
        })

    def add_audit_event(self, event_name: str, message: str, meta: Optional[Dict[str, Any]] = None) -> None:
        """Appends to the decision trace event log."""
        self.audit_trace.append({
            "event": event_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
            "metadata": meta or {},
        })

    def to_dict(self) -> Dict[str, Any]:
        """Convert state dataclass into dictionary."""
        return asdict(self)

    def model_dump(self, *args, **kwargs) -> Dict[str, Any]:
        """Pydantic v2 compatible serialization."""
        return asdict(self)

    def dict(self, *args, **kwargs) -> Dict[str, Any]:
        """Backward-compatible dict serialization."""
        return asdict(self)


# Type alias enabling both MarineState and MissionState nomenclature
MissionState = MarineState

__all__ = ["MarineState", "MissionState"]
