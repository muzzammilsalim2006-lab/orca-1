"""
Pipeline Data Collector: Queries multiple data sources concurrently.
Tolerates individual provider failures gracefully while tagging source data status.
"""

import asyncio
import httpx
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.config import Settings
from app.models.marine_data import SourceMetadata
from app.services import imd as imd_service, ocean as ocean_service, openmeteo_service
from app.services import warnings as warnings_service
from app.utils.logging import get_logger, log_event

log = get_logger("orca.pipeline.collector")


class DataCollector:
    """Collects raw data asynchronously from registered weather, ocean, and warning providers."""

    def __init__(self, settings: Settings):
        self.settings = settings

    async def collect_all(
        self,
        client: Optional[httpx.AsyncClient],
        latitude: float,
        longitude: float,
        forecast_time: Optional[datetime] = None,
        use_demo: bool = False,
    ) -> Dict[str, Any]:
        """
        Queries Open-Meteo, IMD, INCOIS, and MOSDAC concurrently.
        Tolerates single or multiple provider failures.
        Returns dictionary containing raw results and source metadata.
        """
        req_time = datetime.now(timezone.utc)
        results: Dict[str, Any] = {
            "latitude": latitude,
            "longitude": longitude,
            "forecast_time": forecast_time,
            "retrieved_at": req_time,
            "raw_weather": None,
            "raw_ocean": None,
            "raw_warnings": [],
            "raw_incois": None,
            "raw_mosdac": None,
            "sources": [],
            "errors": [],
        }

        if use_demo:
            log.info("Collector executing in DEMO mode for (%.4f, %.4f)", latitude, longitude)
            results["sources"].append(SourceMetadata(
                source_name="ORCA Demo Profiles",
                data_status="DEMO",
                timestamp=req_time,
                retrieval_time=req_time,
                error=None,
            ))
            return results

        # Launch concurrent provider tasks
        weather_task = asyncio.create_task(self._fetch_weather(client, latitude, longitude))
        ocean_task = asyncio.create_task(self._fetch_ocean(client, latitude, longitude, forecast_time))
        warnings_task = asyncio.create_task(self._fetch_warnings(client, latitude, longitude))
        incois_task = asyncio.create_task(self._fetch_incois(latitude, longitude))
        mosdac_task = asyncio.create_task(self._fetch_mosdac(latitude, longitude))

        weather_res, ocean_res, warnings_res, incois_res, mosdac_res = await asyncio.gather(
            weather_task, ocean_task, warnings_task, incois_task, mosdac_task, return_exceptions=True
        )

        # Process Weather Result (Open-Meteo / IMD)
        if isinstance(weather_res, Exception):
            err_msg = f"Weather fetch failed: {weather_res}"
            log.warning(err_msg)
            results["errors"].append(err_msg)
            results["sources"].append(SourceMetadata(
                source_name="Open-Meteo / IMD Weather",
                data_status="UNAVAILABLE",
                retrieval_time=req_time,
                error=str(weather_res),
            ))
        else:
            results["raw_weather"] = weather_res
            weather_status = getattr(getattr(weather_res, "source", None), "data_status", "LIVE")
            results["sources"].append(SourceMetadata(
                source_name=getattr(getattr(weather_res, "source", None), "provider", "Open-Meteo Weather"),
                data_status="LIVE" if weather_status in ["live", "LIVE"] else "DEMO",
                timestamp=getattr(getattr(weather_res, "source", None), "retrieved_at", req_time),
                retrieval_time=req_time,
            ))

        # Process Ocean Result (Open-Meteo Marine)
        if isinstance(ocean_res, Exception):
            err_msg = f"Ocean fetch failed: {ocean_res}"
            log.warning(err_msg)
            results["errors"].append(err_msg)
            results["sources"].append(SourceMetadata(
                source_name="Open-Meteo Marine",
                data_status="UNAVAILABLE",
                retrieval_time=req_time,
                error=str(ocean_res),
            ))
        elif ocean_res is not None:
            results["raw_ocean"] = ocean_res
            ocean_status = getattr(getattr(ocean_res, "source", None), "data_status", "LIVE")
            status_str = "LIVE" if ocean_status in ["live", "LIVE"] else ("CACHED" if ocean_status in ["cached", "CACHED"] else "DEMO")
            results["sources"].append(SourceMetadata(
                source_name=getattr(getattr(ocean_res, "source", None), "provider", "Open-Meteo Marine"),
                data_status=status_str,
                timestamp=getattr(getattr(ocean_res, "source", None), "retrieved_at", req_time),
                retrieval_time=req_time,
            ))
        else:
            results["sources"].append(SourceMetadata(
                source_name="Open-Meteo Marine",
                data_status="UNAVAILABLE",
                retrieval_time=req_time,
                error="No ocean grid data available (inland or unmapped location).",
            ))

        # Process Warnings Result
        if isinstance(warnings_res, Exception):
            err_msg = f"Warnings fetch failed: {warnings_res}"
            log.warning(err_msg)
            results["errors"].append(err_msg)
            results["sources"].append(SourceMetadata(
                source_name="IMD Warnings Bulletin",
                data_status="UNAVAILABLE",
                retrieval_time=req_time,
                error=str(warnings_res),
            ))
        else:
            results["raw_warnings"] = warnings_res or []
            results["sources"].append(SourceMetadata(
                source_name="IMD Warning Bulletins",
                data_status="LIVE" if any(w.source and w.source.data_status == "live" for w in warnings_res) else "DEMO",
                retrieval_time=req_time,
            ))

        # Process INCOIS OSF Result (Secondary provider)
        if isinstance(incois_res, Exception):
            results["sources"].append(SourceMetadata(
                source_name="INCOIS Ocean State Forecast",
                data_status="UNAVAILABLE",
                retrieval_time=req_time,
                error=str(incois_res),
            ))
        else:
            results["raw_incois"] = incois_res
            results["sources"].append(SourceMetadata(
                source_name="INCOIS Ocean State Forecast",
                data_status=incois_res.get("status", "UNAVAILABLE") if isinstance(incois_res, dict) else "UNAVAILABLE",
                retrieval_time=req_time,
                error=incois_res.get("note") if isinstance(incois_res, dict) else None,
            ))

        # Process MOSDAC Satellite Result (Secondary provider)
        if isinstance(mosdac_res, Exception):
            results["sources"].append(SourceMetadata(
                source_name="ISRO MOSDAC Satellite",
                data_status="UNAVAILABLE",
                retrieval_time=req_time,
                error=str(mosdac_res),
            ))
        else:
            results["raw_mosdac"] = mosdac_res
            results["sources"].append(SourceMetadata(
                source_name="ISRO MOSDAC Satellite",
                data_status="DEMO" if isinstance(mosdac_res, dict) else "UNAVAILABLE",
                retrieval_time=req_time,
            ))

        log_event("COLLECTOR_COMPLETED", {
            "latitude": latitude,
            "longitude": longitude,
            "sources_count": len(results["sources"]),
            "errors_count": len(results["errors"]),
        })

        return results

    async def _fetch_weather(self, client, lat: float, lon: float):
        return await imd_service.get_weather(client, lat, lon, self.settings)

    async def _fetch_ocean(self, client, lat: float, lon: float, forecast_time: Optional[datetime]):
        return await ocean_service.get_ocean(client, lat, lon, self.settings, forecast_time)

    async def _fetch_warnings(self, client, lat: float, lon: float):
        return await warnings_service.get_active_warnings(client, lat, lon, self.settings)

    async def _fetch_incois(self, lat: float, lon: float) -> Dict[str, Any]:
        """Adapter for INCOIS Ocean State Forecast."""
        # Unconfigured direct endpoint returns transparent status
        return {
            "provider": "INCOIS Ocean State Forecast",
            "status": "UNAVAILABLE",
            "note": "INCOIS direct endpoint adapter awaiting OGC catalog credentials; fallback to Open-Meteo Marine active.",
        }

    async def _fetch_mosdac(self, lat: float, lon: float) -> Dict[str, Any]:
        """Adapter for ISRO MOSDAC Satellite SST/Chlorophyll."""
        return {
            "provider": "ISRO MOSDAC Satellite Payload",
            "status": "DEMO",
            "resolution_km": 1.0,
            "chlorophyll_a_mg_m3": 1.45,
            "sst_gradient_c_km": 0.3,
            "mode": "satellite_derived_product",
        }
