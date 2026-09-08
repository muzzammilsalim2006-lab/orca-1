"""Marine operational tools."""

from typing import Any, Dict, Optional
from app.services.marine_service import MarineService


class MarineTools:
    def __init__(self, marine_service: Optional[MarineService] = None):
        self.marine_service = marine_service or MarineService()

    async def get_marine_conditions(
        self,
        latitude: float,
        longitude: float,
        date_str: str,
        departure_time: Optional[str] = "05:00",
        duration_hours: Optional[float] = 6.0,
        demo_profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Tool to retrieve sea state, wave heights, currents, and SST."""
        return await self.marine_service.get_conditions(
            latitude=latitude,
            longitude=longitude,
            date_str=date_str,
            departure_time=departure_time,
            duration_hours=duration_hours,
            demo_profile=demo_profile,
        )
