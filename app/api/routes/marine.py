"""Marine conditions inspection router."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.api.dependencies import get_marine_service
from app.services.marine_service import MarineService

router = APIRouter(prefix="/api/marine", tags=["Marine"])


@router.get("")
async def get_marine_conditions(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    departure_time: Optional[str] = Query("05:00"),
    duration_hours: Optional[float] = Query(6.0),
    demo_profile: Optional[str] = Query(None),
    marine_service: MarineService = Depends(get_marine_service),
):
    """Direct lookup for marine conditions at specific coordinates and time window."""
    return await marine_service.get_conditions(
        latitude=latitude,
        longitude=longitude,
        date_str=date,
        departure_time=departure_time,
        duration_hours=duration_hours,
        demo_profile=demo_profile,
    )
