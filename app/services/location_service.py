"""Location and Coastal Region mapping service for Indian maritime zones."""

from typing import Any, Dict, List, Optional
from app.engines.routing import RoutingEngine

INDIAN_COASTAL_PORTS: Dict[str, Dict[str, Any]] = {
    "Kochi": {
        "name": "Kochi",
        "state": "Kerala",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "coastal_region": "Kerala Coast",
        "landing_centers": ["Munambam", "Thoppumpady", "Kalamukku"],
    },
    "Mumbai": {
        "name": "Mumbai",
        "state": "Maharashtra",
        "latitude": 18.9220,
        "longitude": 72.8347,
        "coastal_region": "North Maharashtra Coast",
        "landing_centers": ["Sassoon Dock", "Bhaucha Dhakka", "Versova"],
    },
    "Chennai": {
        "name": "Chennai",
        "state": "Tamil Nadu",
        "latitude": 13.0827,
        "longitude": 80.2707,
        "coastal_region": "North Tamil Nadu Coast",
        "landing_centers": ["Kasimedu", "Royapuram", "Pattinapakkam"],
    },
    "Visakhapatnam": {
        "name": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "latitude": 17.6868,
        "longitude": 83.2185,
        "coastal_region": "North Andhra Coast",
        "landing_centers": ["Vizag Fishing Harbour", "Bheemunipatnam"],
    },
    "Puri": {
        "name": "Puri",
        "state": "Odisha",
        "latitude": 19.8135,
        "longitude": 85.8312,
        "coastal_region": "North Odisha Coast",
        "landing_centers": ["Puri Beach", "Astaranga", "Chandrabhaga"],
    },
    "Mangalore": {
        "name": "Mangalore",
        "state": "Karnataka",
        "latitude": 12.9141,
        "longitude": 74.8560,
        "coastal_region": "Karnataka Coast",
        "landing_centers": ["Old Port (Dakke)", "Kulai"],
    },
    "Veraval": {
        "name": "Veraval",
        "state": "Gujarat",
        "latitude": 20.9077,
        "longitude": 70.3678,
        "coastal_region": "South Gujarat Coast",
        "landing_centers": ["Veraval Harbour", "Mangrol"],
    },
    "Goa": {
        "name": "Panaji (Goa)",
        "state": "Goa",
        "latitude": 15.4909,
        "longitude": 73.8278,
        "coastal_region": "Goa Coast",
        "landing_centers": ["Malim Jetty", "Cutbona Jetty"],
    },
}


class LocationService:
    @classmethod
    def get_all_locations(cls) -> List[Dict[str, Any]]:
        return list(INDIAN_COASTAL_PORTS.values())

    @classmethod
    def resolve_region(
        cls,
        location_name: Optional[str],
        latitude: float,
        longitude: float,
    ) -> str:
        """Resolves IMD coastal region by port name or closest coastal coordinate."""
        if location_name:
            for name, port in INDIAN_COASTAL_PORTS.items():
                if name.lower() in location_name.lower() or location_name.lower() in name.lower():
                    return port["coastal_region"]

        # If not matched by name, find nearest registered port
        nearest_region = "Kerala Coast"
        min_dist = float("inf")

        for port in INDIAN_COASTAL_PORTS.values():
            dist = RoutingEngine.haversine_distance_km(
                latitude, longitude, port["latitude"], port["longitude"]
            )
            if dist < min_dist:
                min_dist = dist
                nearest_region = port["coastal_region"]

        return nearest_region

    @classmethod
    def resolve_location_name(
        cls,
        location_name: Optional[str],
        latitude: float,
        longitude: float,
    ) -> str:
        if location_name and location_name.strip():
            return location_name.strip()

        # Find nearest known coastal port name
        closest_name = "Coastal Station"
        min_dist = float("inf")
        for port in INDIAN_COASTAL_PORTS.values():
            dist = RoutingEngine.haversine_distance_km(
                latitude, longitude, port["latitude"], port["longitude"]
            )
            if dist < min_dist:
                min_dist = dist
                closest_name = port["name"]

        return f"Near {closest_name}" if min_dist > 5.0 else closest_name
