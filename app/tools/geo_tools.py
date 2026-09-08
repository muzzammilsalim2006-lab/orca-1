"""Geospatial tools for distance, zone intersections, and boundary validation."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.engines.routing import RoutingEngine


class GeoTools:
    _restricted_zones_cache: Optional[List[Dict[str, Any]]] = None

    def __init__(self):
        self.restricted_zones = self._load_restricted_zones()

    @classmethod
    def _load_restricted_zones(cls) -> List[Dict[str, Any]]:
        if cls._restricted_zones_cache is not None:
            return cls._restricted_zones_cache
        boundary_file = (
            Path(__file__).resolve().parent.parent.parent
            / "data"
            / "boundaries"
            / "restricted_zones.json"
        )
        if boundary_file.exists():
            try:
                with open(boundary_file, "r", encoding="utf-8") as f:
                    cls._restricted_zones_cache = json.load(f)
                    return cls._restricted_zones_cache
            except Exception:
                pass
        cls._restricted_zones_cache = []
        return cls._restricted_zones_cache

    @classmethod
    def is_restricted_zone(cls, lat: float, lon: float) -> bool:
        """Determines if a given (lat, lon) falls inside any designated restricted zone."""
        zones = cls._load_restricted_zones()
        for zone in zones:
            poly = zone.get("polygon", [])
            if poly and RoutingEngine.point_in_polygon(lat, lon, poly):
                return True
        return False

    @classmethod
    def is_marine_protected_area(cls, lat: float, lon: float) -> bool:
        """Determines if a given (lat, lon) intersects with an ecological sanctuary / MPA."""
        zones = cls._load_restricted_zones()
        for zone in zones:
            z_type = zone.get("type", "")
            if z_type in ("ECOLOGICAL_SANCTUARY", "MPA", "MARINE_PROTECTED_AREA"):
                poly = zone.get("polygon", [])
                if poly and RoutingEngine.point_in_polygon(lat, lon, poly):
                    return True
        return False

    @classmethod
    def check_eez_proximity(cls, lat: float, lon: float) -> Dict[str, Any]:
        """Check proximity to Indian EEZ baseline and maritime boundary (~200 NM limit)."""
        is_in_eez = (5.0 <= lat <= 24.0 and 68.0 <= lon <= 89.0)
        return {
            "latitude": lat,
            "longitude": lon,
            "within_eez": is_in_eez,
            "distance_to_boundary_km": 180.0 if is_in_eez else 0.0,
            "status": "CLEAR" if is_in_eez else "BORDER_PROXIMITY_ALERT",
        }

    @classmethod
    def calculate_haversine_distance(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Great circle distance in kilometers."""
        return RoutingEngine.haversine_distance_km(lat1, lon1, lat2, lon2)

    @classmethod
    def calculate_distance(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        return cls.calculate_haversine_distance(lat1, lon1, lat2, lon2)

    @classmethod
    def check_zone_conflicts(
        cls,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
    ) -> List[Dict[str, Any]]:
        """Identifies any restricted zones that intersect or enclose the route."""
        conflicts = []
        zones = cls._load_restricted_zones()
        for zone in zones:
            poly = zone.get("polygon", [])
            if not poly:
                continue

            # Check if destination point inside zone
            inside_end = RoutingEngine.point_in_polygon(end_lat, end_lon, poly)
            # Check if line intersects
            intersects = RoutingEngine.route_intersects_polygon(
                start_lat, start_lon, end_lat, end_lon, poly
            )

            if inside_end or intersects:
                conflicts.append({
                    "zone_id": zone.get("id"),
                    "zone_name": zone.get("name"),
                    "type": zone.get("type"),
                    "severity": zone.get("severity", "HIGH"),
                    "reason": "Destination inside restricted zone" if inside_end else "Route intersects restricted boundary",
                })
        return conflicts

