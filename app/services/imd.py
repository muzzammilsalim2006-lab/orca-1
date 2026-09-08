from app.config import Settings
from app.core.normalizer import normalize_open_meteo_weather, now_utc
from app.schemas import DataSource, WeatherData
from app.utils.cache import TTLCache
from app.utils.errors import UpstreamError
from app.utils.logging import get_logger

log = get_logger("orca.services.imd")
weather_cache = TTLCache()

WEATHER_CURRENT_FIELDS = (
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,"
    "weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure"
)


async def get_weather(client, latitude: float, longitude: float, settings: Settings) -> WeatherData:
    key = f"weather:{latitude:.2f}:{longitude:.2f}"
    cached = weather_cache.get(key)
    if cached is not None:
        return cached.model_copy(update={
            "source": cached.source.model_copy(update={"data_status": "cached"})})

    if settings.imd_api_base_url:
        try:
            data = await _fetch_imd_current(client, latitude, longitude, settings)
            weather_cache.set(key, data, settings.cache_ttl_weather_seconds)
            return data
        except Exception as exc:  # prototype: fall back gracefully
            log.warning("IMD fetch failed (%s); falling back to Open-Meteo", exc)

    data = await _fetch_open_meteo(client, latitude, longitude, settings)
    weather_cache.set(key, data, settings.cache_ttl_weather_seconds)
    return data


async def _fetch_open_meteo(client, latitude: float, longitude: float, settings: Settings) -> WeatherData:
    response = await client.get(
        settings.open_meteo_base_url,
        params={"latitude": latitude, "longitude": longitude,
                "current": WEATHER_CURRENT_FIELDS, "daily": "precipitation_sum",
                "forecast_days": 1, "timezone": "UTC"},
    )
    if response.status_code != 200:
        raise UpstreamError(f"Weather provider error: {_reason(response)}")
    return normalize_open_meteo_weather(response.json(), source_url=settings.open_meteo_base_url)


async def _fetch_imd_current(client, latitude: float, longitude: float, settings: Settings) -> WeatherData:
    """TODO(M2): map the real IMD response schema here once API access is finalised."""
    headers = {"x-api-key": settings.imd_api_key} if settings.imd_api_key else {}
    response = await client.get(
        f"{settings.imd_api_base_url.rstrip('/')}/current",
        params={"lat": latitude, "lon": longitude}, headers=headers,
    )
    if response.status_code != 200:
        raise UpstreamError(f"IMD provider error: {_reason(response)}")
    current = response.json().get("current", response.json())
    return WeatherData(
        temperature_c=current.get("temp_c"),
        feels_like_c=current.get("feels_like_c"),
        humidity_pct=current.get("humidity_pct"),
        pressure_hpa=current.get("pressure_hpa"),
        wind_speed_kmph=current.get("wind_kmph"),
        wind_gust_kmph=current.get("gust_kmph"),
        wind_direction_deg=current.get("wind_dir_deg"),
        precipitation_mm_last_hour=current.get("precip_mm"),
        precipitation_mm_24h=current.get("precip_24h_mm"),
        visibility_km=current.get("visibility_km"),
        condition=current.get("condition"),
        source=DataSource(provider="IMD", source_url=settings.imd_api_base_url,
                          retrieved_at=now_utc(), data_status="live"),
    )


def _reason(response) -> str:
    try:
        return str(response.json().get("reason", response.status_code))
    except Exception:
        return f"HTTP {response.status_code}"