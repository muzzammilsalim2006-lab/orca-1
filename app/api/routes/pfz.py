"""INCOIS Potential Fishing Zones (PFZ) Router: GET /api/pfz."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Query
from app.providers.marine.pfz_incois import INCOISPFZProvider
from app.services.location_service import INDIAN_COASTAL_PORTS, LocationService

router = APIRouter(prefix="/api/pfz", tags=["Fisheries Intelligence"])
_pfz_provider = INCOISPFZProvider()


@router.get("")
async def get_pfz_advisories(
    port_name: Optional[str] = Query("Kochi", description="Indian coastal port name"),
    coastal_region: Optional[str] = Query(None, description="Optional IMD coastal region"),
) -> Dict[str, Any]:
    """
    Returns active INCOIS Potential Fishing Zone (PFZ) advisories,
    including bearing, distance, target species, depth, and thermal front coordinates.
    """
    port_meta = INDIAN_COASTAL_PORTS.get(port_name, INDIAN_COASTAL_PORTS["Kochi"])
    lat = port_meta["latitude"]
    lon = port_meta["longitude"]
    region = coastal_region or port_meta.get("coastal_region", "Kerala Coast")

    advisories = await _pfz_provider.fetch_advisories(
        coastal_region=region,
        origin_lat=lat,
        origin_lon=lon,
    )

    return {
        "port": port_name,
        "region": region,
        "origin_coordinates": {"latitude": lat, "longitude": lon},
        "pfz_sectors_count": len(advisories),
        "advisories": advisories,
    }
