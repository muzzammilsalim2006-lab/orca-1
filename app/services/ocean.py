from app.config import Settings
from app.core.normalizer import normalize_open_meteo_marine
from app.schemas import OceanData
from app.utils.cache import TTLCache
from app.utils.errors import UpstreamError
from app.utils.logging import get_logger

log = get_logger("orca.services.ocean")
ocean_cache = TTLCache()

MARINE_CURRENT_FIELDS = (
    "wave_height,wave_period,wave_direction,wind_wave_height,"
    "swell_wave_height,swell_wave_period,swell_wave_direction,"
    "sea_surface_temperature,ocean_current_velocity"
)


async def get_ocean(client, latitude: float, longitude: float, settings: Settings) -> OceanData:
    """Raises UpstreamError when no marine grid data exists (inland); pipeline converts to null."""
    key = f"ocean:{latitude:.2f}:{longitude:.2f}"
    cached = ocean_cache.get(key)
    if cached is not None:
        return cached.model_copy(update={
            "source": cached.source.model_copy(update={"data_status": "cached"})})

    response = await client.get(
        settings.open_meteo_marine_base_url,
        params={"latitude": latitude, "longitude": longitude,
                "current": MARINE_CURRENT_FIELDS, "timezone": "UTC"},
    )
    if response.status_code != 200:
        raise UpstreamError(f"Marine provider error: {_reason(response)}")

    data = normalize_open_meteo_marine(response.json(), source_url=settings.open_meteo_marine_base_url)
    ocean_cache.set(key, data, settings.cache_ttl_ocean_seconds)
    return data


def _reason(response) -> str:
    try:
        return str(response.json().get("reason", response.status_code))
    except Exception:
        return f"HTTP {response.status_code}"