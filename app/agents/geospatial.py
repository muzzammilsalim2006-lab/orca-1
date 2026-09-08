"""Geospatial Agent: Evaluates spatial candidates, distances, and marine zone restrictions."""

from typing import Any, Dict, List, Optional
from app.engines.routing import RoutingEngine
from app.state.mission_state import MarineState
from app.tools.geo_tools import GeoTools


class GeospatialAgent:
    def __init__(self, tools: Optional[GeoTools] = None):
        self.tools = tools or GeoTools()

    def execute(self, state: MarineState) -> MarineState:
        lat = state.location.get("latitude", 9.9312)
        lon = state.location.get("longitude", 76.2673)
        port_name = state.location.get("name", "Origin")
        departure_time = state.mission.get("departure_time", "05:00")
        vessel_speed = state.vessel.get("limits", {}).get("cruising_speed_knots", 8.0)

        # 1. Base candidate bathymetric zones
        candidates = RoutingEngine.generate_candidate_zones(lat, lon, port_name)

        # 2. Integrate active INCOIS PFZ advisories as primary candidate zones
        for pfz in state.pfz_advisories:
            candidates.append({
                "id": pfz["id"],
                "name": f"{pfz['name']} (Official INCOIS PFZ)",
                "latitude": pfz["latitude"],
                "longitude": pfz["longitude"],
                "distance_km": pfz.get("distance_km", 20.0),
                "bearing_deg": pfz.get("bearing_deg", 240.0),
                "pfz_opportunity": pfz.get("opportunity_index", 0.92),
                "preferred_gear": f"Target: {', '.join(pfz.get('target_species', ['Pelagics']))}",
                "estimated_fuel_liters": round(pfz.get("distance_km", 20.0) * 0.75, 1),
                "source": "INCOIS PFZ Advisory",
            })

        # 3. Evaluate restricted boundary intersections & build route profiles
        for cand in candidates:
            conflicts = self.tools.check_zone_conflicts(
                start_lat=lat,
                start_lon=lon,
                end_lat=cand["latitude"],
                end_lon=cand["longitude"],
            )
            cand["zone_conflicts"] = conflicts
            cand["is_restricted"] = len(conflicts) > 0

            # Attach spatiotemporal route itinerary
            route_profile = RoutingEngine.generate_spatiotemporal_route(
                origin_lat=lat,
                origin_lon=lon,
                dest_lat=cand["latitude"],
                dest_lon=cand["longitude"],
                departure_time_str=departure_time,
                vessel_speed_knots=vessel_speed,
                fishing_duration_hours=3.0,
            )
            cand["spatiotemporal_profile"] = route_profile

        state.geospatial = {
            "origin": {"latitude": lat, "longitude": lon},
            "candidate_zones": candidates,
            "restricted_zones_evaluated": len(self.tools.restricted_zones),
        }

        # Set default spatiotemporal route to first candidate
        if candidates:
            state.spatiotemporal_route = candidates[0].get("spatiotemporal_profile", {})

        state.add_audit_event(
            "GEO_AGENT_COMPLETED",
            f"Evaluated {len(candidates)} total zones (including {len(state.pfz_advisories)} INCOIS PFZ sectors) with spatiotemporal itineraries.",
            {"evaluated_candidates": [c["id"] for c in candidates]},
        )

        return state
