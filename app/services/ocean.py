import httpx
from datetime import datetime, timezone
from typing import Optional

from app.config import Settings
from app.schemas import OceanData
from app.services import demo_data
from app.services.openmeteo_service import get_openmeteo_ocean, openmeteo_ocean_cache
from app.utils.errors import UpstreamError
from app.utils.logging import get_logger, log_event

log = get_logger("orca.services.ocean")
ocean_cache = openmeteo_ocean_cache


async def get_ocean(
    client: Optional[httpx.AsyncClient],
    latitude: float,
    longitude: float,
    settings: Settings,
    forecast_time: Optional[datetime] = None,
) -> Optional[OceanData]:
    """
    Primary Ocean Data service.
    Attempts live Open-Meteo Marine fetch.
    If live API fails or location is inland, falls back to saved demo snapshot if enabled.
    Missing values remain None and are never converted to zero.
    """
    try:
        data = await get_openmeteo_ocean(client, latitude, longitude, settings, forecast_time)
        return data
    except Exception as exc:
        log.warning("Live ocean fetch failed for (%.4f, %.4f): %s", latitude, longitude, exc)
        if settings.demo_fallback:
            fallback = demo_data.demo_ocean_fallback(latitude, longitude)
            if fallback is not None:
                log_event("OCEAN_DEMO_FALLBACK_USED", {
                    "latitude": latitude,
                    "longitude": longitude,
                    "reason": str(exc),
                })
                fallback.source.data_status = "demo"
                fallback.source.note = f"Demo snapshot fallback used (live API unavailable: {exc})"
                return fallback
        return None