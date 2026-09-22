import httpx
from datetime import datetime, timezone
from typing import Optional, Any, Dict

from app.config import Settings
from app.schemas import DataSource, OceanData
from app.utils.cache import TTLCache
from app.utils.errors import UpstreamError
from app.utils.logging import get_logger, log_event

log = get_logger("orca.services.openmeteo")
openmeteo_ocean_cache = TTLCache()

MARINE_VARIABLES = (
    "wave_height,"
    "wave_period,"
    "wave_direction,"
    "wind_wave_height,"
    "swell_wave_height,"
    "swell_wave_period,"
    "swell_wave_direction,"
    "sea_surface_temperature,"
    "ocean_current_velocity,"
    "ocean_current_direction"
)


class OpenMeteoService:
    """Dedicated Open-Meteo Marine API Service for ORCA."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.open_meteo_marine_base_url

    async def fetch_marine_data(
        self,
        client: Optional[httpx.AsyncClient],
        latitude: float,
        longitude: float,
        forecast_time: Optional[datetime] = None,
    ) -> OceanData:
        """
        Fetches live marine data for given coordinates and optional forecast time.
        Parses into ORCA's internal normalized OceanData format.
        Preserves missing values as None (never converts missing data to 0).
        """
        req_time = datetime.now(timezone.utc)

        # 1. Coordinate Validation
        if not (-90.0 <= latitude <= 90.0) or not (-180.0 <= longitude <= 180.0):
            err_msg = f"Invalid coordinates: lat={latitude}, lon={longitude}"
            log.error(
                "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=FAILURE (%s)",
                req_time.isoformat(), latitude, longitude, (forecast_time or req_time).isoformat(), err_msg
            )
            raise UpstreamError(err_msg)

        # 2. Check Cache
        key = f"openmeteo_marine:{latitude:.2f}:{longitude:.2f}"
        cached_data = openmeteo_ocean_cache.get(key)
        if cached_data is not None:
            log.info(
                "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=SUCCESS (CACHED)",
                req_time.isoformat(), latitude, longitude, (forecast_time or req_time).isoformat()
            )
            return cached_data.model_copy(
                update={"source": cached_data.source.model_copy(update={"data_status": "cached"})}
            )

        # 3. HTTP Request
        should_close_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=self.settings.request_timeout_seconds)
            should_close_client = True

        try:
            params: Dict[str, Any] = {
                "latitude": latitude,
                "longitude": longitude,
                "current": MARINE_VARIABLES,
                "timezone": "UTC",
            }

            response = await client.get(self.base_url, params=params)
            
            if response.status_code != 200:
                reason = response.json().get("reason", f"HTTP {response.status_code}") if response.headers.get("content-type", "").startswith("application/json") else f"HTTP {response.status_code}"
                err_msg = f"Open-Meteo Marine API HTTP error: {reason}"
                log.error(
                    "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=FAILURE (%s)",
                    req_time.isoformat(), latitude, longitude, (forecast_time or req_time).isoformat(), err_msg
                )
                raise UpstreamError(err_msg)

            payload = response.json()
            if not isinstance(payload, dict):
                err_msg = "Malformed JSON response received from Open-Meteo Marine API"
                log.error(
                    "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=FAILURE (%s)",
                    req_time.isoformat(), latitude, longitude, (forecast_time or req_time).isoformat(), err_msg
                )
                raise UpstreamError(err_msg)

            ocean_data = self.normalize_marine_payload(payload, self.base_url, req_time, forecast_time)
            
            # Cache valid result
            openmeteo_ocean_cache.set(key, ocean_data, self.settings.cache_ttl_ocean_seconds)

            fc_time_str = ocean_data.source.forecast_time.isoformat() if ocean_data.source.forecast_time else req_time.isoformat()
            log.info(
                "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=SUCCESS",
                req_time.isoformat(), latitude, longitude, fc_time_str
            )
            log_event("OPENMETEO_MARINE_FETCH_SUCCESS", {
                "latitude": latitude,
                "longitude": longitude,
                "data_status": "LIVE",
                "wave_height_m": ocean_data.wave_height_m,
            })
            return ocean_data

        except httpx.TimeoutException as exc:
            err_msg = f"Timeout connecting to Open-Meteo Marine API: {exc}"
            log.error(
                "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=FAILURE (%s)",
                req_time.isoformat(), latitude, longitude, (forecast_time or req_time).isoformat(), err_msg
            )
            raise UpstreamError(err_msg) from exc
        except httpx.RequestError as exc:
            err_msg = f"Network error connecting to Open-Meteo Marine API: {exc}"
            log.error(
                "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=FAILURE (%s)",
                req_time.isoformat(), latitude, longitude, (forecast_time or req_time).isoformat(), err_msg
            )
            raise UpstreamError(err_msg) from exc
        except Exception as exc:
            if isinstance(exc, UpstreamError):
                raise exc
            err_msg = f"Unexpected error parsing Open-Meteo Marine response: {exc}"
            log.error(
                "SOURCE=Open-Meteo Marine | REQUEST TIME=%s | LOCATION=(%.4f, %.4f) | FORECAST TIME=%s | SUCCESS/FAILURE=FAILURE (%s)",
                req_time.isoformat(), latitude, longitude, (forecast_time or req_time).isoformat(), err_msg
            )
            raise UpstreamError(err_msg) from exc
        finally:
            if should_close_client:
                await client.aclose()

    @staticmethod
    def normalize_marine_payload(
        payload: dict,
        source_url: str,
        retrieved_at: datetime,
        requested_forecast_time: Optional[datetime] = None,
    ) -> OceanData:
        """
        Parses Open-Meteo Marine API JSON into normalized OceanData.
        Guarantees missing fields remain None (not converted to 0.0).
        """
        current = payload.get("current", {}) if isinstance(payload, dict) else {}
        
        # Forecast time handling
        raw_time_str = current.get("time")
        parsed_fc_time = requested_forecast_time
        if raw_time_str:
            try:
                parsed_fc_time = datetime.fromisoformat(raw_time_str.replace("Z", "+00:00"))
            except Exception:
                pass

        # Helper to safely extract float while maintaining None for missing values
        def _get_float(val: Any) -> Optional[float]:
            if val is None:
                return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return None

        velocity_ms = _get_float(current.get("ocean_current_velocity"))
        current_speed_kmph = round(velocity_ms * 3.6, 2) if velocity_ms is not None else None

        source = DataSource(
            provider="Open-Meteo Marine",
            source_url=source_url,
            retrieved_at=retrieved_at,
            forecast_time=parsed_fc_time,
            data_status="live",
            note="Live ocean forecast retrieved from Open-Meteo Marine API.",
        )

        return OceanData(
            wave_height_m=_get_float(current.get("wave_height")),
            wave_period_s=_get_float(current.get("wave_period")),
            wave_direction_deg=_get_float(current.get("wave_direction")),
            wind_wave_height_m=_get_float(current.get("wind_wave_height")),
            swell_height_m=_get_float(current.get("swell_wave_height")),
            swell_period_s=_get_float(current.get("swell_wave_period")),
            swell_direction_deg=_get_float(current.get("swell_wave_direction")),
            sea_surface_temperature_c=_get_float(current.get("sea_surface_temperature")),
            ocean_current_speed_kmph=current_speed_kmph,
            source=source,
        )


async def get_openmeteo_ocean(
    client: Optional[httpx.AsyncClient],
    latitude: float,
    longitude: float,
    settings: Settings,
    forecast_time: Optional[datetime] = None,
) -> OceanData:
    svc = OpenMeteoService(settings)
    return await svc.fetch_marine_data(client, latitude, longitude, forecast_time)
