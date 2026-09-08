from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    QUESTION = "QUESTION"
    TASK = "TASK"
    DATASET = "DATASET"
    OBSERVATION = "OBSERVATION"
    ANALYSIS = "ANALYSIS"
    DECISION = "DECISION"
    REJECTION = "REJECTION"
    RECOMMENDATION = "RECOMMENDATION"


class EdgeType(str, Enum):
    DERIVED_FROM = "DERIVED_FROM"
    SUPPORTED_BY = "SUPPORTED_BY"
    CONFLICTS_WITH = "CONFLICTS_WITH"
    REJECTED_BECAUSE = "REJECTED_BECAUSE"
    INPUT_TO = "INPUT_TO"


class EvidenceNode(BaseModel):
    node_id: str = Field(default_factory=lambda: f"NODE-{uuid.uuid4().hex[:8].upper()}")
    node_type: NodeType
    title: str
    description: str
    data: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 1.0
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EvidenceEdge(BaseModel):
    source_id: str
    target_id: str
    relation: EdgeType
    notes: Optional[str] = None


class RejectedCandidate(BaseModel):
    candidate_id: str
    name: str
    failed_check_id: str
    rejection_reason: str
    metric_observed: Any
    metric_threshold: Any
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
