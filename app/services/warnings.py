import json
from datetime import datetime, timezone
from pathlib import Path

from app.config import Settings
from app.schemas import DataSource, WeatherWarning
from app.utils.cache import TTLCache
from app.utils.geo import haversine_km
from app.utils.logging import get_logger

log = get_logger("orca.services.warnings")
warnings_cache = TTLCache()

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"


async def get_active_warnings(client, latitude: float, longitude: float,
                              settings: Settings) -> list[WeatherWarning]:
    """TODO(M2): parse live IMD marine/cyclone bulletins when configured."""
    if settings.imd_api_base_url:
        try:
            return await _fetch_imd_bulletins(client, latitude, longitude, settings)
        except Exception as exc:
            log.warning("IMD bulletin fetch failed (%s); using demo/static warnings", exc)
    return _static_warnings(latitude, longitude, settings)


def _load_static(settings: Settings) -> list[dict]:
    cached = warnings_cache.get("static")
    if cached is not None:
        return cached
    path = DEMO_DIR / "warnings.json"
    items = json.loads(path.read_text(encoding="utf-8")).get("warnings", []) if path.exists() else []
    warnings_cache.set("static", items, settings.cache_ttl_warnings_seconds)
    return items


def _static_warnings(latitude: float, longitude: float, settings: Settings) -> list[WeatherWarning]:
    now = datetime.now(timezone.utc)
    active: list[WeatherWarning] = []
    for raw in _load_static(settings):
        valid_until = _parse(raw.get("valid_until"))
        if valid_until and now > valid_until:
            continue
        distance = haversine_km(latitude, longitude, raw["center_latitude"], raw["center_longitude"])
        if distance <= raw.get("radius_km", 0):
            active.append(WeatherWarning(
                id=raw.get("id", "warning"), type=raw.get("type", "other"),
                severity=raw.get("severity", "advisory"), headline=raw.get("headline", ""),
                issued_by=raw.get("issued_by", "IMD"), valid_until=valid_until,
                source=DataSource(provider="IMD bulletin (demo static)", retrieved_at=now,
                                  data_status="demo")))
    return active


async def _fetch_imd_bulletins(client, latitude, longitude, settings) -> list[WeatherWarning]:
    raise NotImplementedError("Live IMD bulletins not wired yet")


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))