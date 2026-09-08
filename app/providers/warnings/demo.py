"""Demo & cached warning provider for resilient operational demonstrations."""

from typing import Any, Dict
from app.providers.warnings.base import BaseWarningProvider


class DemoWarningProvider(BaseWarningProvider):
    @property
    def provider_name(self) -> str:
        return "IMD Regional Coastal Bulletins (Simulated/Cached)"

    async def fetch(self, region: str) -> Dict[str, Any]:
        return {
            "status": "NO_WARNING",
            "severity": "NONE",
            "region": region,
            "warning_type": None,
            "message": f"Normal sea conditions observed along {region}. No fishermen warning issued.",
            "valid_until": "2026-09-10T18:00:00Z",
            "source": "IMD",
            "mode": "cached_demo",
        }
