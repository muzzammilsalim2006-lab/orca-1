"""Spatiotemporal routing tools for agents."""

from typing import Any, Dict, List, Optional
from app.engines.routing import RoutingEngine


class RoutingTools:
    @staticmethod
    def generate_full_mission_route(
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        departure_time_str: str = "05:00",
        vessel_speed_knots: float = 8.0,
        fishing_duration_hours: float = 3.0,
        ocean_current_knots: Optional[float] = 0.5,
    ) -> Dict[str, Any]:
        """Generates a complete 3-leg spatiotemporal mission profile."""
        return RoutingEngine.generate_spatiotemporal_route(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            departure_time_str=departure_time_str,
            vessel_speed_knots=vessel_speed_knots,
            fishing_duration_hours=fishing_duration_hours,
            ocean_current_knots=ocean_current_knots,
        )
