from typing import Any, Dict, List, Optional
from app.evidence.graph import EvidenceGraph
from app.evidence.models import NodeType, EdgeType


class EvidenceCollector:
    """Helper service for orchestrator and agents to build the evidence graph during execution."""

    @classmethod
    def populate_from_state(cls, graph: EvidenceGraph, state: Any) -> None:
        """Hydrates the evidence graph from a completed MarineState."""
        # 1. Question node
        q_node = graph.add_node(
            node_type=NodeType.QUESTION,
            title="Mission Intent",
            description=getattr(state, "query", "") or "Marine Assessment Request",
            data={"language": getattr(state, "language", "en"), "location": getattr(state, "location", {})}
        )

        # 2. Observation nodes
        marine = getattr(state, "marine", {})
        if marine:
            m_node = graph.add_node(
                node_type=NodeType.OBSERVATION,
                title="Marine Environmental State",
                description=f"Wave Height: {marine.get('wave_height_m', 'N/A')}m, Period: {marine.get('wave_period_s', 'N/A')}s",
                data=marine
            )
            graph.add_edge(q_node.node_id, m_node.node_id, EdgeType.INPUT_TO)

        weather = getattr(state, "weather", {})
        if weather:
            w_node = graph.add_node(
                node_type=NodeType.OBSERVATION,
                title="Atmospheric Weather State",
                description=f"Wind: {weather.get('wind_speed_kmh', 'N/A')} km/h, Rain Prob: {weather.get('precipitation_prob', 'N/A')}%",
                data=weather
            )
            graph.add_edge(q_node.node_id, w_node.node_id, EdgeType.INPUT_TO)

        # 3. Analysis node: Risk
        risk = getattr(state, "risk", {})
        if risk:
            r_node = graph.add_node(
                node_type=NodeType.ANALYSIS,
                title="Composite Risk Evaluation",
                description=f"Risk Score: {risk.get('score', 0)} ({risk.get('level', 'UNKNOWN')})",
                data=risk
            )

        # 4. Rejections ('Why Not?')
        replan_history = getattr(state, "replan_history", [])
        for replan in replan_history:
            graph.record_rejection(
                candidate_id=replan.get("rejected_candidate_id", "UNKNOWN"),
                name=f"Zone Candidate {replan.get('rejected_candidate_id', '')}",
                failed_check_id="SAFETY_POLICY_CHECK",
                rejection_reason="; ".join(replan.get("reasons", ["Safety limit exceeded"])),
                metric_observed=replan.get("reasons"),
                metric_threshold="Strict Safety Pass"
            )

        # 5. Recommendation
        selected = getattr(state, "selected_route", None)
        if selected:
            rec_node = graph.add_node(
                node_type=NodeType.RECOMMENDATION,
                title=f"Recommended: {selected.get('name', 'Route')}",
                description=f"Selected route passing all safety verification checks.",
                data=selected
            )
