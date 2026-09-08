"""Vessel Agent: Translates vessel parameters into maritime operational constraints."""

from typing import Any, Dict, Optional
from app.state.mission_state import MarineState
from app.tools.vessel_tools import VesselTools


class VesselAgent:
    def __init__(self, tools: Optional[VesselTools] = None):
        self.tools = tools or VesselTools()

    def execute(self, state: MarineState) -> MarineState:
        vessel_meta = state.mission.get("vessel", {})
        length_m = vessel_meta.get("length_m", 5.0)
        fuel_cap = vessel_meta.get("fuel_capacity_l", 40.0)
        speed = vessel_meta.get("cruising_speed_knots", 8.0)

        limits = self.tools.evaluate_vessel_limits(
            vessel_length_m=length_m,
            fuel_capacity_l=fuel_cap,
            cruising_speed_knots=speed,
        )

        state.vessel = {
            "vessel_id": vessel_meta.get("vessel_id", "demo-vessel-01"),
            "length_m": length_m,
            "limits": limits,
        }

        state.add_audit_event(
            "VESSEL_AGENT_COMPLETED",
            f"Vessel class '{limits['vessel_class']}': Max wave limit {limits['max_safe_wave_m']}m, Range {limits['max_operational_range_km']}km",
            {"vessel_id": state.vessel["vessel_id"]},
        )

        return state
