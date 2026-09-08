"""Decision Agent: Scores candidate zones and selects optimal route candidate for verification."""

from typing import Any, Dict, List, Optional
from app.engines.scoring import ScoringEngine
from app.state.mission_state import MarineState


class DecisionAgent:
    @staticmethod
    def execute(state: MarineState, exclude_zone_ids: Optional[List[str]] = None) -> MarineState:
        """
        Ranks candidate zones using composite scoring:
        - PFZ / Fishing Opportunity (40%)
        - Safety from Wave/Wind Hazards (35%)
        - Distance / Fuel Efficiency (15%)
        - Sensor / Forecast Confidence (10%)
        """
        exclude = set(exclude_zone_ids or [])
        candidates = state.geospatial.get("candidate_zones", [])
        vessel_limits = state.vessel.get("limits", {})
        max_range = vessel_limits.get("max_operational_range_km", 40.0)
        fuel_budget = vessel_limits.get("fuel_budget_l", 32.0)
        conf_score = state.confidence.get("score", 85)

        # Baseline safety score from overall risk
        overall_risk_score = state.risk.get("score", 30)
        base_safety_score = max(0.0, 1.0 - (overall_risk_score / 100.0))

        scored_candidates = []
        for cand in candidates:
            cand_id = cand["id"]
            if cand_id in exclude:
                cand["status"] = "EXCLUDED_BY_REPLAN"
                continue

            dist = cand["distance_km"]
            opp = cand.get("pfz_opportunity", 0.8)

            # Fuel / distance score: 1.0 at port, diminishing towards max range
            fuel_score = max(0.0, min(1.0, 1.0 - (dist / max(1.0, max_range))))

            # Composite mission score
            total_score = ScoringEngine.calculate_mission_score(
                fishing_opportunity=opp,
                safety_score=base_safety_score,
                fuel_score=fuel_score,
                confidence_score=conf_score,
            )

            cand_copy = cand.copy()
            cand_copy["composite_score"] = total_score
            cand_copy["base_safety_score"] = round(base_safety_score, 2)
            cand_copy["fuel_score"] = round(fuel_score, 2)
            cand_copy["status"] = "CANDIDATE"
            scored_candidates.append(cand_copy)

        # Sort descending by composite score
        scored_candidates.sort(key=lambda x: x["composite_score"], reverse=True)

        state.routes = scored_candidates
        state.selected_route = scored_candidates[0] if scored_candidates else None

        state.add_audit_event(
            "DECISION_AGENT_COMPLETED",
            f"Selected candidate: {state.selected_route['id'] if state.selected_route else 'None'} (Score: {state.selected_route['composite_score'] if state.selected_route else 0})",
            {"available_candidates": len(scored_candidates)},
        )

        return state
