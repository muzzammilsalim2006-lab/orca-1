from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.disaster.command import (
    DisasterCommandService,
    CycloneTrack,
    VesselStatus,
    SHELTERED_PORTS,
)

router = APIRouter(tags=["Disaster Command Mode"])


class DisasterAssessmentRequest(BaseModel):
    cyclone: Optional[CycloneTrack] = None
    vessels: Optional[List[VesselStatus]] = None


@router.post("/disaster/assess", summary="Evaluate active fleet against cyclone track and generate safe harbor routes")
def assess_disaster(req: DisasterAssessmentRequest):
    # Default cyclone track: Severe Cyclone in Arabian Sea moving NW towards Gujarat/Oman
    cyclone = req.cyclone or CycloneTrack(
        cyclone_id="CYC-2026-ARABIAN-01",
        name="Very Severe Cyclonic Storm TEJ",
        eye_latitude=10.5,
        eye_longitude=75.2,
        radius_km=140.0,
        intensity_category="Extremely Severe Cyclonic Storm",
        max_wind_kmh=155.0,
        forward_speed_kmh=18.0,
        heading_deg=310.0,
    )

    # Default monitored fleet in South-West coastal waters
    vessels = req.vessels or [
        VesselStatus(vessel_id="IND-KL-07-001", name="Matsya Kanyaka I", latitude=10.4, longitude=75.3, length_m=9.2, cruising_speed_knots=8.0, souls_on_board=5),
        VesselStatus(vessel_id="IND-KL-07-002", name="Sea Falcon", latitude=10.8, longitude=74.9, length_m=11.5, cruising_speed_knots=9.5, souls_on_board=6),
        VesselStatus(vessel_id="IND-KL-04-003", name="St. Antony II", latitude=9.8, longitude=75.9, length_m=7.0, cruising_speed_knots=7.5, souls_on_board=4),
        VesselStatus(vessel_id="IND-KL-01-004", name="Sagara Mithra", latitude=8.5, longitude=76.6, length_m=6.5, cruising_speed_knots=7.0, souls_on_board=3),
    ]

    return DisasterCommandService.evaluate_fleet(cyclone, vessels)


@router.get("/disaster/shelters", summary="List registered Indian coastal emergency shelter ports")
def list_shelters():
    return {
        "total_shelters": len(SHELTERED_PORTS),
        "shelters": SHELTERED_PORTS,
    }
