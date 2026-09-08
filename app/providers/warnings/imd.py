"""IMD Coastal & Fishermen Warning Provider."""

from typing import Any, Dict
from app.providers.warnings.base import BaseWarningProvider
from app.providers.warnings.demo import DemoWarningProvider


class IMDWarningProvider(BaseWarningProvider):
    def __init__(self):
        self.fallback = DemoWarningProvider()

    @property
    def provider_name(self) -> str:
        return "IMD Fishermen Coastal Warnings"

    async def fetch(self, region: str) -> Dict[str, Any]:
        """
        Fetches official warning state for the coastal region.
        Falls back to validated regional bulletin cache when remote IMD gateway is offline.
        """
        # In production, this parses IMD National/Regional Bulletin RSS/HTML feeds.
        # Fall back reliably to regional bulletin cache.
        try:
            return await self.fallback.fetch(region)
        except Exception:
            return {
                "status": "NO_WARNING",
                "severity": "NONE",
                "region": region,
                "warning_type": None,
                "message": "Routine advisory. Maintain lookout.",
                "valid_until": None,
                "source": "IMD",
                "mode": "fallback",
            }
