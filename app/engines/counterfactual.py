"""Counterfactual Reasoning and What-If Simulation Engine."""

from typing import Any, Dict, List, Optional
from app.engines.risk import RiskEngine
from app.engines.scoring import ScoringEngine
from app.state.mission_state import MarineState


class CounterfactualEngine:
    @classmethod
    def simulate_scenario(
        cls,
        base_state: MarineState,
        wave_delta_m: Optional[float] = None,
        wind_delta_kmh: Optional[float] = None,
        departure_time_shift_hours: Optional[float] = None,
        priority_mode: Optional[str] = "balanced",
    ) -> Dict[str, Any]:
        """
        Simulates environmental perturbation or priority shift on an existing mission:
        - Evaluates risk delta
        - Recalculates candidate feasibility and ranking
        - Produces actionable counterfactual conclusion
        """
        orig_marine = base_state.marine.copy()
        orig_weather = base_state.weather.copy()
        orig_risk = base_state.risk
        orig_selected = base_state.selected_route

        # Apply perturbations
        sim_marine = orig_marine.copy()
        sim_weather = orig_weather.copy()

        if wave_delta_m is not None:
            base_wave = orig_marine.get("wave_height_m") or 1.0
            sim_marine["wave_height_m"] = round(max(0.2, base_wave + wave_delta_m), 2)

        if wind_delta_kmh is not None:
            base_wind = orig_weather.get("wind_speed_kmh") or 15.0
            sim_weather["wind_speed_kmh"] = round(max(0.0, base_wind + wind_delta_kmh), 1)

        # Recalculate Risk
        new_risk = RiskEngine.calculate_risk(
            marine=sim_marine,
            weather=sim_weather,
            warnings=base_state.warnings,
        )

        risk_score_delta = new_risk["score"] - orig_risk.get("score", 0)
        risk_level_changed = new_risk["level"] != orig_risk.get("level")

        # Adjust scoring weights based on priority mode
        if priority_mode == "safety_first":
            w_opp, w_safe, w_fuel = 0.20, 0.60, 0.10
        elif priority_mode == "catch_maximizer":
            w_opp, w_safe, w_fuel = 0.60, 0.20, 0.10
        else:  # balanced
            w_opp, w_safe, w_fuel = 0.40, 0.35, 0.15

        # Re-score candidate zones
        base_safety_score = max(0.0, 1.0 - (new_risk["score"] / 100.0))
        re_ranked = []
        vessel_max_wave = base_state.vessel.get("limits", {}).get("max_safe_wave_m", 2.5)

        for cand in base_state.geospatial.get("candidate_zones", []):
            cand_copy = cand.copy()
            opp = cand_copy.get("pfz_opportunity", 0.8)
            fuel = cand_copy.get("fuel_score", 0.8)
            new_composite = round(
                (opp * w_opp) + (base_safety_score * w_safe) + (fuel * w_fuel) + 0.08, 3
            )
            cand_copy["simulated_composite_score"] = new_composite

            # Check if this zone exceeds vessel wave limit under scenario
            current_sim_wave = sim_marine.get("wave_height_m", 0.0)
            if current_sim_wave > vessel_max_wave:
                cand_copy["simulated_status"] = "EXCEEDS_VESSEL_LIMIT"
            else:
                cand_copy["simulated_status"] = "VIABLE"

            re_ranked.append(cand_copy)

        re_ranked.sort(key=lambda x: x["simulated_composite_score"], reverse=True)
        new_selected = re_ranked[0] if re_ranked else None

        # Formulate counterfactual impact summary
        changes = []
        if wave_delta_m:
            sign = "+" if wave_delta_m > 0 else ""
            changes.append(f"waves {sign}{wave_delta_m}m (now {sim_marine.get('wave_height_m')}m)")
        if wind_delta_kmh:
            sign = "+" if wind_delta_kmh > 0 else ""
            changes.append(f"wind {sign}{wind_delta_kmh} km/h (now {sim_weather.get('wind_speed_kmh')} km/h)")
        if priority_mode != "balanced":
            changes.append(f"optimization re-weighted for '{priority_mode}'")

        change_desc = ", ".join(changes) if changes else "parameter shift"
        impact_summary = (
            f"Under counterfactual scenario [{change_desc}]: "
            f"Risk shifts by {risk_score_delta:+d} points from {orig_risk.get('score')} ({orig_risk.get('level')}) "
            f"to {new_risk['score']} ({new_risk['level']}). "
            f"Top recommended destination is {new_selected.get('name') if new_selected else 'None'} "
            f"(Status: {new_selected.get('simulated_status') if new_selected else 'N/A'})."
        )

        return {
            "scenario": {
                "wave_delta_m": wave_delta_m,
                "wind_delta_kmh": wind_delta_kmh,
                "departure_time_shift_hours": departure_time_shift_hours,
                "priority_mode": priority_mode,
            },
            "original_risk": orig_risk,
            "simulated_risk": new_risk,
            "risk_delta_score": risk_score_delta,
            "risk_level_changed": risk_level_changed,
            "simulated_marine": sim_marine,
            "simulated_weather": sim_weather,
            "re_ranked_candidates": re_ranked,
            "new_selected_candidate": new_selected,
            "impact_summary": impact_summary,
        }
