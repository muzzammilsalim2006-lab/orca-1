"""INCOIS Potential Fishing Zones (PFZ) tools for agents."""

from typing import Any, Dict, List, Optional
from app.providers.marine.pfz_incois import INCOISPFZProvider


class PFZTools:
    def __init__(self, provider: Optional[INCOISPFZProvider] = None):
        self.provider = provider or INCOISPFZProvider()

    async def get_pfz_advisories(
        self,
        coastal_region: str,
        origin_lat: float,
        origin_lon: float,
    ) -> List[Dict[str, Any]]:
        """Tool to discover and retrieve active INCOIS PFZ sectors."""
        return await self.provider.fetch_advisories(
            coastal_region=coastal_region,
            origin_lat=origin_lat,
            origin_lon=origin_lon,
        )
