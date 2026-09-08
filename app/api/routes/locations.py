"""Locations and Coastal Ports router."""

from fastapi import APIRouter
from app.services.location_service import LocationService

router = APIRouter(prefix="/api/locations", tags=["Locations"])


@router.get("")
async def get_supported_locations():
    """Lists supported Indian coastal ports, landing centers, and IMD coastal divisions."""
    locations = LocationService.get_all_locations()
    return {
        "count": len(locations),
        "locations": locations,
    }
