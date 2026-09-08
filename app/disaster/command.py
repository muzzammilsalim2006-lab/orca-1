from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.engines.routing import RoutingEngine


# Designated Indian coastal emergency shelter ports
SHELTERED_PORTS = [
    {"port_id": "PORT-COCHI", "name": "Cochin Major Port", "latitude": 9.9667, "longitude": 76.2667, "max_draft_m": 14.5, "shelter_rating": "EXCELLENT"},
    {"port_id": "PORT-BEYPORE", "name": "Beypore Port (Kozhikode)", "latitude": 11.1667, "longitude": 75.8000, "max_draft_m": 5.0, "shelter_rating": "GOOD"},
    {"port_id": "PORT-VIZHINJAM", "name": "Vizhinjam International Seaport", "latitude": 8.3667, "longitude": 76.9833, "max_draft_m": 18.0, "shelter_rating": "EXCELLENT"},
    {"port_id": "PORT-KOLLAM", "name": "Kollam (Neendakara) Port", "latitude": 8.9333, "longitude": 76.5333, "max_draft_m": 6.5, "shelter_rating": "GOOD"},
    {"port_id": "PORT-MANGALORE", "name": "New Mangalore Port", "latitude": 12.9167, "longitude": 74.8167, "max_draft_m": 14.0, "shelter_rating": "EXCELLENT"},
    {"port_id": "PORT-TUTICORIN", "name": "V.O.C. Port Tuticorin", "latitude": 8.7500, "longitude": 78.1833, "max_draft_m": 12.8, "shelter_rating": "EXCELLENT"},
]


class CycloneTrack(BaseModel):
    cyclone_id: str
    name: str
    eye_latitude: float
    eye_longitude: float
    radius_km: float = 120.0
    intensity_category: str = "Very Severe Cyclonic Storm"
    max_wind_kmh: float = 135.0
    forward_speed_kmh: float = 18.0
    heading_deg: float = 315.0  # North-West track typically in Arabian Sea / Bay of Bengal


class VesselStatus(BaseModel):
    vessel_id: str
    name: str
    latitude: float
    longitude: float
    length_m: float = 6.0
    cruising_speed_knots: float = 8.0
    souls_on_board: int = 4


class DisasterCommandService:
    """
    Maritime Disaster Command Mode.
    Intersect vessel positions with dynamic cyclone cones and generate
    instant safe-harbor emergency evacuation routing with priority on survival.
    """

    @classmethod
    def evaluate_fleet(
        cls,
        cyclone: CycloneTrack,
        vessels: List[VesselStatus]
    ) -> Dict[str, Any]:
        evaluated_vessels = []
        critical_count = 0
        high_count = 0

        for v in vessels:
            dist_to_eye = RoutingEngine.haversine_distance_km(v.latitude, v.longitude, cyclone.eye_latitude, cyclone.eye_longitude)
            bearing_to_eye = RoutingEngine.calculate_bearing_deg(v.latitude, v.longitude, cyclone.eye_latitude, cyclone.eye_longitude)

            # Risk classification
            if dist_to_eye <= cyclone.radius_km:
                risk_level = "CRITICAL"
                evac_priority = "IMMEDIATE"
                critical_count += 1
            elif dist_to_eye <= cyclone.radius_km * 2.0:
                risk_level = "HIGH"
                evac_priority = "HIGH"
                high_count += 1
            elif dist_to_eye <= cyclone.radius_km * 3.5:
                risk_level = "MODERATE"
                evac_priority = "ADVISORY"
            else:
                risk_level = "LOW"
                evac_priority = "MONITOR"

            # Emergency safe harbor allocation: find closest port
            shelters = []
            for p in SHELTERED_PORTS:
                p_dist = RoutingEngine.haversine_distance_km(v.latitude, v.longitude, p["latitude"], p["longitude"])
                shelters.append({**p, "distance_km": p_dist})
            shelters.sort(key=lambda s: s["distance_km"])
            nearest_shelter = shelters[0]

            # Generate evacuation corridor
            evac_speed_kmh = max(6.0, v.cruising_speed_knots * 1.852)
            evac_hours = round(nearest_shelter["distance_km"] / evac_speed_kmh, 1)
            evac_bearing = RoutingEngine.calculate_bearing_deg(v.latitude, v.longitude, nearest_shelter["latitude"], nearest_shelter["longitude"])

            evaluated_vessels.append({
                "vessel_id": v.vessel_id,
                "name": v.name,
                "position": {"latitude": v.latitude, "longitude": v.longitude},
                "distance_to_cyclone_eye_km": dist_to_eye,
                "bearing_to_eye_deg": bearing_to_eye,
                "risk_level": risk_level,
                "evacuation_priority": evac_priority,
                "emergency_shelter": {
                    "port_id": nearest_shelter["port_id"],
                    "port_name": nearest_shelter["name"],
                    "distance_km": nearest_shelter["distance_km"],
                    "evacuation_heading_deg": evac_bearing,
                    "estimated_hours_to_shelter": evac_hours,
                    "shelter_rating": nearest_shelter["shelter_rating"]
                }
            })

        # Sort fleet: CRITICAL first, then HIGH
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        evaluated_vessels.sort(key=lambda item: priority_order[item["risk_level"]])

        return {
            "disaster_incident": {
                "cyclone_id": cyclone.cyclone_id,
                "cyclone_name": cyclone.name,
                "intensity": cyclone.intensity_category,
                "eye_coordinates": {"latitude": cyclone.eye_latitude, "longitude": cyclone.eye_longitude},
                "hazard_radius_km": cyclone.radius_km,
                "max_wind_kmh": cyclone.max_wind_kmh
            },
            "fleet_summary": {
                "total_vessels_tracked": len(vessels),
                "critical_vessels_count": critical_count,
                "high_risk_vessels_count": high_count,
                "status": "DISASTER_EVACUATION_ACTIVE" if (critical_count + high_count) > 0 else "NOMINAL"
            },
            "vessel_risk_rankings": evaluated_vessels,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
