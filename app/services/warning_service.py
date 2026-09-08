"""Warning Domain Service: Coordinates coastal warnings and bulletins."""

import json
from pathlib import Path
from typing import Any, Dict, Optional

from app.config import settings
from app.providers.warnings.imd import IMDWarningProvider
from app.services.location_service import LocationService
from app.utils.logging import log_event


class WarningService:
    def __init__(self):
        self.provider = IMDWarningProvider()

    async def get_warnings(
        self,
        location_name: Optional[str],
        latitude: float,
        longitude: float,
        date_str: str,
        demo_profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Resolves region and retrieves coastal advisory bulletins."""
        region = LocationService.resolve_region(location_name, latitude, longitude)

        if settings.demo_mode or demo_profile:
            return self._load_demo_warning(demo_profile or "normal", region)

        try:
            log_event("WARNING_PROVIDER_CALLED", {"region": region})
            warning = await self.provider.fetch(region)
            return warning
        except Exception as exc:
            log_event("WARNING_PROVIDER_FALLBACK", {"error": str(exc), "region": region})
            return self._load_demo_warning("normal", region)

    def _load_demo_warning(self, profile_name: str, region: str) -> Dict[str, Any]:
        demo_dir = Path(__file__).resolve().parent.parent.parent / "data" / "demo"
        profile_file = demo_dir / f"{profile_name.lower()}.json"
        if not profile_file.exists():
            profile_file = demo_dir / "normal.json"

        with open(profile_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            w = data["warning"].copy()
            w["region"] = region
            return w
