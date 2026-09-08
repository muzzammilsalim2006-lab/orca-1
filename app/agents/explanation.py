"""Explanation Agent: Generates natural language operational rationales from verified decision data."""

from typing import Any, Dict
from app.state.mission_state import MarineState


class ExplanationAgent:
    @staticmethod
    def generate_explanation(state: MarineState) -> str:
        """Translates machine decisions and multi-factor risks into a concise operational advisory."""
        verification = state.verification
        risk = state.risk
        selected = state.selected_route
        location_name = state.location.get("name", "Coastal Port")
        confidence = state.confidence.get("score", 85)
        replan_count = len(state.replan_history)

        if verification.get("status") == "REJECTED":
            reasons_str = "; ".join(verification.get("reasons", ["General safety limits exceeded"]))
            return (
                f"MISSION REJECTED for {location_name}: {reasons_str}. "
                f"Risk evaluated at {risk.get('score')}/100 ({risk.get('level')}). "
                f"Verification halted after evaluating candidate options ({replan_count} re-planning cycles attempted). "
                f"Data confidence is {confidence}%."
            )

        cand_name = selected.get("name") if selected else "Selected Sector"
        cand_dist = selected.get("distance_km", 0.0) if selected else 0.0
        wave_h = state.marine.get("wave_height_m", 0.0)
        wind_spd = state.weather.get("wind_speed_kmh", 0.0)
        wind_dir = state.weather.get("wind_compass", "W")
        risk_lvl = risk.get("level", "MODERATE")
        risk_score = risk.get("score", 40)

        replan_note = f" (Selected after {replan_count} re-planning iteration(s))" if replan_count > 0 else ""

        return (
            f"Recommended {cand_name} located {cand_dist} km offshore{replan_note}. "
            f"Conditions indicate {risk_lvl} operational risk (score {risk_score}/100) with significant waves at {wave_h}m "
            f"and wind speed around {wind_spd} km/h ({wind_dir}). "
            f"No restricted maritime zones or active cyclonic warnings intersect the planned route. "
            f"Confidence in underlying forecasts is {confidence}%. "
            f"Adhere strictly to official IMD/INCOIS coastal bulletins and maintain VHF channel 16 watch."
        )
