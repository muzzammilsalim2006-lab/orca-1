"""Location and Coastal Region mapping service for Indian maritime zones."""

from typing import Any, Dict, List, Optional
from app.engines.routing import RoutingEngine

INDIAN_COASTAL_PORTS: Dict[str, Dict[str, Any]] = {
    "Mumbai": {
        "name": "Mumbai Harbor",
        "district": "Mumbai",
        "state": "Maharashtra",
        "latitude": 18.9220,
        "longitude": 72.8347,
        "coastal_region": "North Maharashtra Coast",
        "landing_centers": ["Sassoon Dock", "Bhaucha Dhakka", "Versova", "Worli Koliwada"],
    },
    "Palghar": {
        "name": "Satpati (Palghar)",
        "district": "Palghar",
        "state": "Maharashtra",
        "latitude": 19.6967,
        "longitude": 72.7011,
        "coastal_region": "North Maharashtra Coast",
        "landing_centers": ["Satpati Jetty", "Dahanu", "Vasai Koliwada"],
    },
    "Thane": {
        "name": "Uttan (Thane Coast)",
        "district": "Thane",
        "state": "Maharashtra",
        "latitude": 19.2812,
        "longitude": 72.7842,
        "coastal_region": "North Maharashtra Coast",
        "landing_centers": ["Uttan Bhati", "Pali Jetty", "Gorai"],
    },
    "Raigad": {
        "name": "Alibaug (Raigad)",
        "district": "Raigad",
        "state": "Maharashtra",
        "latitude": 18.6414,
        "longitude": 72.8722,
        "coastal_region": "South Maharashtra Coast",
        "landing_centers": ["Alibaug Jetty", "Murud Janjira", "Shrivardhan"],
    },
    "Ratnagiri": {
        "name": "Mirkarwada (Ratnagiri)",
        "district": "Ratnagiri",
        "state": "Maharashtra",
        "latitude": 16.9902,
        "longitude": 73.2878,
        "coastal_region": "South Maharashtra Coast",
        "landing_centers": ["Mirkarwada Fishing Harbour", "Dabhol", "Jaigad"],
    },
    "Sindhudurg": {
        "name": "Malvan (Sindhudurg)",
        "district": "Sindhudurg",
        "state": "Maharashtra",
        "latitude": 16.0617,
        "longitude": 73.4686,
        "coastal_region": "South Maharashtra Coast",
        "landing_centers": ["Malvan Jetty", "Vengurla Harbour", "Devgad Jetty"],
    },
    "Panaji": {
        "name": "Panaji (North Goa)",
        "district": "North Goa",
        "state": "Goa",
        "latitude": 15.4909,
        "longitude": 73.8278,
        "coastal_region": "Goa Coast",
        "landing_centers": ["Malim Jetty", "Mandovi River Mouth", "Chapora Jetty"],
    },
    "Mormugao": {
        "name": "Cutbona (South Goa)",
        "district": "South Goa",
        "state": "Goa",
        "latitude": 15.1633,
        "longitude": 73.9650,
        "coastal_region": "Goa Coast",
        "landing_centers": ["Cutbona Jetty", "Betul Jetty", "Vasco Harbour"],
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
        nearest_region = "North Maharashtra Coast"
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
