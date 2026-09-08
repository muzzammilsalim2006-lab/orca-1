"""MOSDAC Satellite Earth Observation tools for agents."""

from typing import Any, Dict, Optional
from app.providers.marine.mosdac import MOSDACSatelliteProvider


class SatelliteTools:
    def __init__(self, provider: Optional[MOSDACSatelliteProvider] = None):
        self.provider = provider or MOSDACSatelliteProvider()

    async def get_ocean_features(
        self,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        """Tool to query satellite chlorophyll, thermal gradients, and frontal detections."""
        return await self.provider.fetch_ocean_features(latitude, longitude)
