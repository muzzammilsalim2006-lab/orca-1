"""INCOIS Marine Forecast Provider adapter."""

from typing import Any, Dict
from app.providers.marine.base import BaseMarineProvider


class INCOISMarineProvider(BaseMarineProvider):
    """
    Adapter for INCOIS Ocean State Forecast (OSF) products.
    Prepares system to consume official Indian oceanographic feeds seamlessly.
    """

    @property
    def provider_name(self) -> str:
        return "INCOIS Marine OSF"

    async def fetch(
        self,
        latitude: float,
        longitude: float,
        forecast_days: int = 3,
    ) -> Dict[str, Any]:
        # INCOIS provides REST and WMS services for designated coastal grids.
        # Once production credentials / OGC catalog keys are registered, fetch live.
        raise NotImplementedError(
            "INCOIS direct endpoint adapter configured as secondary provider; awaiting catalog credentials."
        )
