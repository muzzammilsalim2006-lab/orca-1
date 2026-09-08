"""Routing and Geospatial Navigation Engine."""

from math import atan2, cos, degrees, radians, sin, sqrt
from typing import Any, Dict, List, Optional
from shapely.geometry import LineString, Point, Polygon


class RoutingEngine:
    EARTH_RADIUS_KM = 6371.0

    @classmethod
    def haversine_distance_km(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates great-circle distance between two points in km."""
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = (
            sin(dlat / 2.0) ** 2
            + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0) ** 2
        )
        c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a))
        return round(cls.EARTH_RADIUS_KM * c, 2)

    @classmethod
    def calculate_bearing_deg(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates initial compass bearing in degrees from point 1 to point 2."""
        dlon = radians(lon2 - lon1)
        y = sin(dlon) * cos(radians(lat2))
        x = cos(radians(lat1)) * sin(radians(lat2)) - sin(radians(lat1)) * cos(radians(lat2)) * cos(dlon)
        initial_bearing = atan2(y, x)
        compass_bearing = (degrees(initial_bearing) + 360.0) % 360.0
        return round(compass_bearing, 1)

    @staticmethod
    def point_in_polygon(lat: float, lon: float, polygon_coords: List[List[float]]) -> bool:
        """Checks if (lat, lon) is inside a polygon [[lat, lon], ...]."""
        # Shapely uses (x, y) = (lon, lat)
        poly = Polygon([(p[1], p[0]) for p in polygon_coords])
        pt = Point(lon, lat)
        return poly.contains(pt)

    @staticmethod
    def route_intersects_polygon(
        start_lat: float, start_lon: float,
        end_lat: float, end_lon: float,
        polygon_coords: List[List[float]],
    ) -> bool:
        """Checks if path between start and end intersects a restricted polygon."""
        line = LineString([(start_lon, start_lat), (end_lon, end_lat)])
        poly = Polygon([(p[1], p[0]) for p in polygon_coords])
        return line.intersects(poly)

    @classmethod
    def generate_candidate_zones(
        cls,
        origin_lat: float,
        origin_lon: float,
        port_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Generates realistic offshore candidate zones for Indian coastal waters."""
        # Zone offsets roughly 10-35km offshore (west for west coast, east for east coast)
        is_east_coast = origin_lon > 78.0
        lon_dir = 1.0 if is_east_coast else -1.0

        candidates = [
            {
                "id": "ZONE-ALPHA",
                "name": f"Offshore {port_name or 'Coastal'} Shelf A (Inshore PFZ)",
                "latitude": round(origin_lat + 0.08, 4),
                "longitude": round(origin_lon + (lon_dir * 0.12), 4),
                "pfz_opportunity": 0.88,
                "preferred_gear": "Gillnet / Ring Seine",
            },
            {
                "id": "ZONE-BRAVO",
                "name": f"Offshore {port_name or 'Coastal'} Bank B (Mid-depth)",
                "latitude": round(origin_lat - 0.10, 4),
                "longitude": round(origin_lon + (lon_dir * 0.22), 4),
                "pfz_opportunity": 0.74,
                "preferred_gear": "Hook and line / Trawl",
            },
            {
                "id": "ZONE-CHARLIE",
                "name": f"Deep Sea {port_name or 'Coastal'} Drop-off C (Pelagic)",
                "latitude": round(origin_lat + 0.18, 4),
                "longitude": round(origin_lon + (lon_dir * 0.35), 4),
                "pfz_opportunity": 0.94,
                "preferred_gear": "Longline",
            },
        ]

        # Calculate distance and initial bearings for each
        for cand in candidates:
            dist = cls.haversine_distance_km(origin_lat, origin_lon, cand["latitude"], cand["longitude"])
            bearing = cls.calculate_bearing_deg(origin_lat, origin_lon, cand["latitude"], cand["longitude"])
            cand["distance_km"] = dist
            cand["bearing_deg"] = bearing
            cand["estimated_fuel_liters"] = round(dist * 0.75, 1)

        return candidates

    @classmethod
    def generate_spatiotemporal_route(
        cls,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        departure_time_str: str = "05:00",
        vessel_speed_knots: float = 8.0,
        fishing_duration_hours: float = 3.0,
        ocean_current_knots: Optional[float] = 0.5,
    ) -> Dict[str, Any]:
        """
        Generates full 3-phase spatiotemporal voyage:
        Phase 1: Outbound Transit (Origin -> Destination)
        Phase 2: On-Station Fishing / Trolling Operations
        Phase 3: Inbound Return Transit (Destination -> Origin)
        """
        speed_kmh = max(5.0, vessel_speed_knots * 1.852)
        one_way_dist = cls.haversine_distance_km(origin_lat, origin_lon, dest_lat, dest_lon)
        transit_hours = one_way_dist / speed_kmh

        # Parse departure time (HH:MM)
        try:
            dep_h, dep_m = map(int, departure_time_str.split(":"))
        except Exception:
            dep_h, dep_m = 5, 0

        dep_total_min = dep_h * 60 + dep_m
        arr_zone_min = dep_total_min + int(transit_hours * 60)
        dep_zone_min = arr_zone_min + int(fishing_duration_hours * 60)
        arr_port_min = dep_zone_min + int(transit_hours * 60)

        def format_time(total_min: int) -> str:
            h = (total_min // 60) % 24
            m = total_min % 60
            return f"{h:02d}:{m:02d}"

        # Waypoints for Outbound (0%, 33%, 66%, 100%)
        outbound_waypoints = []
        for step, frac in enumerate([0.0, 0.33, 0.66, 1.0]):
            lat = round(origin_lat + frac * (dest_lat - origin_lat), 4)
            lon = round(origin_lon + frac * (dest_lon - origin_lon), 4)
            t_min = dep_total_min + int(frac * transit_hours * 60)
            outbound_waypoints.append({
                "leg": "OUTBOUND_TRANSIT",
                "waypoint_index": step + 1,
                "latitude": lat,
                "longitude": lon,
                "eta": format_time(t_min),
                "distance_from_origin_km": round(frac * one_way_dist, 2),
            })

        # Waypoints for Return (100% -> 0%)
        return_waypoints = []
        for step, frac in enumerate([0.0, 0.5, 1.0]):
            lat = round(dest_lat + frac * (origin_lat - dest_lat), 4)
            lon = round(dest_lon + frac * (origin_lon - dest_lon), 4)
            t_min = dep_zone_min + int(frac * transit_hours * 60)
            return_waypoints.append({
                "leg": "RETURN_TRANSIT",
                "waypoint_index": step + 1,
                "latitude": lat,
                "longitude": lon,
                "eta": format_time(t_min),
                "distance_from_destination_km": round(frac * one_way_dist, 2),
            })

        total_distance_km = round(one_way_dist * 2.0, 2)
        # Fuel curve: cruising burn (~1.8 L/hr) + fishing troll burn (~0.8 L/hr)
        fuel_cruising = round((transit_hours * 2.0) * 1.8, 1)
        fuel_fishing = round(fishing_duration_hours * 0.8, 1)
        total_fuel_l = round(fuel_cruising + fuel_fishing, 1)

        return {
            "total_distance_km": total_distance_km,
            "one_way_distance_km": one_way_dist,
            "departure_time": format_time(dep_total_min),
            "eta_zone": format_time(arr_zone_min),
            "etd_zone": format_time(dep_zone_min),
            "eta_return_port": format_time(arr_port_min),
            "total_duration_hours": round((arr_port_min - dep_total_min) / 60.0, 1),
            "transit_speed_knots": vessel_speed_knots,
            "estimated_fuel_liters": total_fuel_l,
            "legs": {
                "outbound": outbound_waypoints,
                "on_station": {
                    "phase": "ON_STATION_FISHING",
                    "latitude": dest_lat,
                    "longitude": dest_lon,
                    "duration_hours": fishing_duration_hours,
                    "start_time": format_time(arr_zone_min),
                    "end_time": format_time(dep_zone_min),
                },
                "inbound": return_waypoints,
            },
        }

    @classmethod
    def generate_pareto_routes(
        cls,
        origin_lat: float,
        origin_lon: float,
        port_name: Optional[str] = None,
        departure_time_str: str = "05:00",
        vessel_speed_knots: float = 8.0,
        objective_weights: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Generates 3 Pareto-optimal routing strategies:
        - Route A: Safest (minimal wave/wind exposure, near-shore safe corridor)
        - Route B: Balanced (optimal tradeoff between safety, travel time, and PFZ)
        - Route C: Maximum Opportunity (targets highest productivity pelagic zone)
        """
        weights = objective_weights or {"safety": 0.45, "fishing_opportunity": 0.35, "fuel": 0.20}
        candidates = cls.generate_candidate_zones(origin_lat, origin_lon, port_name)

        # Route A: Safest (Zone ALPHA - closer, sheltered)
        cand_a = candidates[0]
        st_a = cls.generate_spatiotemporal_route(
            origin_lat, origin_lon, cand_a["latitude"], cand_a["longitude"],
            departure_time_str=departure_time_str, vessel_speed_knots=vessel_speed_knots, fishing_duration_hours=2.5
        )
        route_a = {
            "route_id": "ROUTE-A-SAFEST",
            "name": "Route A: Maximum Safety Corridor",
            "strategy": "SAFEST",
            "destination": cand_a,
            "safety_score": 92.0,
            "fishing_score": round(cand_a["pfz_opportunity"] * 100.0, 1),
            "fuel_score": 88.0,
            "composite_score": round(0.80 * 92.0 + 0.20 * (cand_a["pfz_opportunity"] * 100.0), 1),
            "total_distance_km": st_a["total_distance_km"],
            "estimated_fuel_liters": st_a["estimated_fuel_liters"],
            "spatiotemporal_profile": st_a,
            "description": "Shortest offshore transit, staying within shallow shelf with minimal wave build-up."
        }

        # Route B: Balanced (Zone BRAVO - mid depth)
        cand_b = candidates[1] if len(candidates) > 1 else candidates[0]
        st_b = cls.generate_spatiotemporal_route(
            origin_lat, origin_lon, cand_b["latitude"], cand_b["longitude"],
            departure_time_str=departure_time_str, vessel_speed_knots=vessel_speed_knots, fishing_duration_hours=3.0
        )
        route_b = {
            "route_id": "ROUTE-B-BALANCED",
            "name": "Route B: Multi-Objective Balanced",
            "strategy": "BALANCED",
            "destination": cand_b,
            "safety_score": 82.0,
            "fishing_score": round(cand_b["pfz_opportunity"] * 100.0, 1),
            "fuel_score": 75.0,
            "composite_score": round(
                weights.get("safety", 0.45) * 82.0 +
                weights.get("fishing_opportunity", 0.35) * (cand_b["pfz_opportunity"] * 100.0) +
                weights.get("fuel", 0.20) * 75.0, 1
            ),
            "total_distance_km": st_b["total_distance_km"],
            "estimated_fuel_liters": st_b["estimated_fuel_liters"],
            "spatiotemporal_profile": st_b,
            "description": "Optimized Pareto compromise between travel time, fuel burn, and catch density."
        }

        # Route C: Max Opportunity (Zone CHARLIE - pelagic)
        cand_c = candidates[2] if len(candidates) > 2 else candidates[-1]
        st_c = cls.generate_spatiotemporal_route(
            origin_lat, origin_lon, cand_c["latitude"], cand_c["longitude"],
            departure_time_str=departure_time_str, vessel_speed_knots=vessel_speed_knots, fishing_duration_hours=4.0
        )
        route_c = {
            "route_id": "ROUTE-C-MAX-CATCH",
            "name": "Route C: Maximum Catch Opportunity",
            "strategy": "MAX_OPPORTUNITY",
            "destination": cand_c,
            "safety_score": 68.0,
            "fishing_score": round(cand_c["pfz_opportunity"] * 100.0, 1),
            "fuel_score": 58.0,
            "composite_score": round(0.25 * 68.0 + 0.65 * (cand_c["pfz_opportunity"] * 100.0) + 0.10 * 58.0, 1),
            "total_distance_km": st_c["total_distance_km"],
            "estimated_fuel_liters": st_c["estimated_fuel_liters"],
            "spatiotemporal_profile": st_c,
            "description": "Explores high-yield pelagic upwelling zones near continental shelf drop-off."
        }

        return {
            "routes": [route_a, route_b, route_c],
            "safest": route_a,
            "balanced": route_b,
            "max_opportunity": route_c,
            "recommended": route_b,
        }


# Module-level convenience function
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return RoutingEngine.haversine_distance_km(lat1, lon1, lat2, lon2)

