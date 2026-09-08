"""Dedicated warning tools for agents."""

from typing import Any, Dict, Optional
from app.services.warning_service import WarningService


class WarningTools:
    def __init__(self, warning_service: Optional[WarningService] = None):
        self.warning_service = warning_service or WarningService()

    async def get_coastal_warnings(
        self,
        location_name: Optional[str],
        latitude: float,
        longitude: float,
        date_str: str,
        demo_profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Tool to retrieve official fishermen and coastal warnings."""
        return await self.warning_service.get_warnings(
            location_name=location_name,
            latitude=latitude,
            longitude=longitude,
            date_str=date_str,
            demo_profile=demo_profile,
        )
