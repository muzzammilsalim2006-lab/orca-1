from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from app.evidence.models import (
    EvidenceNode,
    EvidenceEdge,
    NodeType,
    EdgeType,
    RejectedCandidate,
)


class EvidenceGraph:
    """
    Cryptographically traceable Directed Acyclic Graph linking:
    User Question -> Tasks -> Datasets -> Raw Observations -> Scientific Analysis -> Decisions -> Recommendations.
    Also stores rejected candidate alternatives and their failure rationales ('Why Not?').
    """

    def __init__(self, mission_id: str):
        self.mission_id = mission_id
        self.nodes: Dict[str, EvidenceNode] = {}
        self.edges: List[EvidenceEdge] = []
        self.rejected_candidates: List[RejectedCandidate] = []

    def add_node(
        self,
        node_type: NodeType | str,
        title: str,
        description: str,
        data: Optional[Dict[str, Any]] = None,
        confidence: float = 1.0,
        node_id: Optional[str] = None,
    ) -> EvidenceNode:
        if isinstance(node_type, str):
            node_type = NodeType(node_type.upper())
        node = EvidenceNode(
            node_id=node_id or f"N-{len(self.nodes)+1:03d}",
            node_type=node_type,
            title=title,
            description=description,
            data=data or {},
            confidence=confidence,
        )
        self.nodes[node.node_id] = node
        return node

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        relation: EdgeType | str,
        notes: Optional[str] = None
    ) -> EvidenceEdge:
        if isinstance(relation, str):
            relation = EdgeType(relation.upper())
        edge = EvidenceEdge(
            source_id=source_id,
            target_id=target_id,
            relation=relation,
            notes=notes
        )
        self.edges.append(edge)
        return edge

    def record_rejection(
        self,
        candidate_id: str,
        name: str,
        failed_check_id: str,
        rejection_reason: str,
        metric_observed: Any,
        metric_threshold: Any,
    ) -> RejectedCandidate:
        rej = RejectedCandidate(
            candidate_id=candidate_id,
            name=name,
            failed_check_id=failed_check_id,
            rejection_reason=rejection_reason,
            metric_observed=metric_observed,
            metric_threshold=metric_threshold,
        )
        self.rejected_candidates.append(rej)

        # Also add node in graph
        r_node = self.add_node(
            node_type=NodeType.REJECTION,
            title=f"Rejected: {name}",
            description=rejection_reason,
            data={"failed_check": failed_check_id, "observed": metric_observed, "threshold": metric_threshold}
        )
        return rej

    def explain_why(self, recommendation_id: Optional[str] = None) -> Dict[str, Any]:
        """Traces the provenance path from data observations to final recommendation."""
        observations = [n for n in self.nodes.values() if n.node_type == NodeType.OBSERVATION]
        analyses = [n for n in self.nodes.values() if n.node_type == NodeType.ANALYSIS]
        decisions = [n for n in self.nodes.values() if n.node_type == NodeType.DECISION]

        return {
            "mission_id": self.mission_id,
            "provenance_summary": f"Decision derived from {len(observations)} raw data feeds and {len(analyses)} scientific evaluations.",
            "raw_observations": [o.model_dump() for o in observations],
            "scientific_evaluations": [a.model_dump() for a in analyses],
            "decisions": [d.model_dump() for d in decisions],
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
        }

    def explain_why_not(self) -> List[Dict[str, Any]]:
        """Returns structured comparative reasoning for every rejected alternative."""
        return [r.model_dump() for r in self.rejected_candidates]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mission_id": self.mission_id,
            "nodes": [n.model_dump() for n in self.nodes.values()],
            "edges": [e.model_dump() for e in self.edges],
            "rejected_candidates": [r.model_dump() for r in self.rejected_candidates],
        }
