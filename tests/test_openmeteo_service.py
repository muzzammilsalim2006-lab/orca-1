import pytest
import httpx
import respx
from datetime import datetime, timezone

from app.config import settings
from app.services.openmeteo_service import OpenMeteoService, get_openmeteo_ocean, openmeteo_ocean_cache
from app.services.ocean import get_ocean
from app.utils.errors import UpstreamError


@pytest.fixture(autouse=True)
def clear_cache():
    openmeteo_ocean_cache.clear()
    yield
    openmeteo_ocean_cache.clear()


@pytest.mark.asyncio
async def test_openmeteo_service_successful_response():
    """Verify successful parsing of live Open-Meteo Marine API data."""
    mock_payload = {
        "current": {
            "time": "2026-09-22T12:00:00Z",
            "wave_height": 1.85,
            "wave_period": 7.2,
            "wave_direction": 240,
            "wind_wave_height": 0.6,
            "swell_wave_height": 1.4,
            "swell_wave_period": 9.1,
            "swell_wave_direction": 230,
            "sea_surface_temperature": 28.5,
            "ocean_current_velocity": 0.45,  # 0.45 m/s = 1.62 km/h
            "ocean_current_direction": 180,
        }
    }

    async with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get(settings.open_meteo_marine_base_url).respond(
            status_code=200, json=mock_payload
        )

        async with httpx.AsyncClient() as client:
            ocean_data = await get_openmeteo_ocean(client, 18.9438, 72.8360, settings)

        assert ocean_data is not None
        assert ocean_data.wave_height_m == 1.85
        assert ocean_data.wave_period_s == 7.2
        assert ocean_data.swell_height_m == 1.4
        assert ocean_data.sea_surface_temperature_c == 28.5
        assert ocean_data.ocean_current_speed_kmph == 1.62
        assert ocean_data.source.provider == "Open-Meteo Marine"
        assert ocean_data.source.data_status in ["LIVE", "live", "CACHED", "cached"]


@pytest.mark.asyncio
async def test_openmeteo_service_missing_data_remains_none():
    """Verify that missing values remain None and are NEVER converted to zero."""
    mock_payload = {
        "current": {
            "time": "2026-09-22T12:00:00Z",
            "wave_height": None,  # Inland or missing sensor
            "wave_period": None,
            "swell_wave_height": 1.2,
            "ocean_current_velocity": None,
        }
    }

    async with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get(settings.open_meteo_marine_base_url).respond(
            status_code=200, json=mock_payload
        )

        async with httpx.AsyncClient() as client:
            ocean_data = await get_openmeteo_ocean(client, 19.0, 73.0, settings)

        assert ocean_data.wave_height_m is None
        assert ocean_data.wave_period_s is None
        assert ocean_data.ocean_current_speed_kmph is None
        # Verify swell_height_m is populated without affecting missing values
        assert ocean_data.swell_height_m == 1.2


@pytest.mark.asyncio
async def test_openmeteo_service_timeout_handling():
    """Verify timeout exception handling when API is slow/unresponsive."""
    async with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get(settings.open_meteo_marine_base_url).side_effect = httpx.TimeoutException("Connection timed out")

        async with httpx.AsyncClient() as client:
            with pytest.raises(UpstreamError) as exc_info:
                svc = OpenMeteoService(settings)
                await svc.fetch_marine_data(client, 18.9438, 72.8360)
            assert "Timeout" in str(exc_info.value)


@pytest.mark.asyncio
async def test_openmeteo_service_malformed_response():
    """Verify exception handling when API returns non-dict or malformed JSON."""
    async with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get(settings.open_meteo_marine_base_url).respond(
            status_code=200, text="Not valid JSON content"
        )

        async with httpx.AsyncClient() as client:
            with pytest.raises(UpstreamError):
                svc = OpenMeteoService(settings)
                await svc.fetch_marine_data(client, 18.9438, 72.8360)


@pytest.mark.asyncio
async def test_ocean_service_demo_fallback_on_failure():
    """Verify that ocean service falls back to demo snapshot when live API fails."""
    async with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get(settings.open_meteo_marine_base_url).respond(
            status_code=500, json={"reason": "Internal Server Error"}
        )

        async with httpx.AsyncClient() as client:
            # Enable demo fallback in settings for this test
            settings_copy = settings.model_copy(update={"demo_fallback": True})
            ocean_data = await get_ocean(client, 18.9438, 72.8360, settings_copy)

        assert ocean_data is not None
        assert ocean_data.source.data_status in ["DEMO", "demo", "fallback"]
        assert ocean_data.wave_height_m is not None
