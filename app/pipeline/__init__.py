"""
ORCA Live Marine Data Pipeline Package.
Data Sources → Collector → Normalizer → Validator → CommonMarineDataModel → Aggregator.
"""

import httpx
from datetime import datetime
from typing import Optional

from app.config import Settings
from app.models.marine_data import CommonMarineDataModel, LocationData
from app.pipeline.aggregator import DataAggregator
from app.pipeline.collector import DataCollector
from app.pipeline.normalizer import DataNormalizer
from app.pipeline.validator import DataValidator


async def run_marine_pipeline(
    client: Optional[httpx.AsyncClient],
    latitude: float,
    longitude: float,
    settings: Settings,
    forecast_time: Optional[datetime] = None,
    use_demo: bool = False,
    region_label: Optional[str] = None,
) -> CommonMarineDataModel:
    """
    Executes the full source-agnostic live marine data pipeline.
    1. Collector: Asynchronously queries registered data sources (Open-Meteo, IMD, INCOIS, MOSDAC).
    2. Normalizer: Standardizes raw outputs into unified models without replacing missing data with zero.
    3. Validator: Enforces geographical and physical domain rules without deleting invalid values.
    4. Aggregator: Synthesizes data, validation, confidence score, and provenance into CommonMarineDataModel.
    """
    collector = DataCollector(settings)
    raw_collected = await collector.collect_all(
        client=client,
        latitude=latitude,
        longitude=longitude,
        forecast_time=forecast_time,
        use_demo=use_demo,
    )

    weather_model = DataNormalizer.normalize_weather(raw_collected.get("raw_weather"))
    ocean_model = DataNormalizer.normalize_ocean(raw_collected.get("raw_ocean"))
    warning_model = DataNormalizer.normalize_warnings(raw_collected.get("raw_warnings"))

    location_obj = LocationData(latitude=latitude, longitude=longitude, region=region_label)
    validation_report = DataValidator.validate(
        location=location_obj,
        weather=weather_model,
        ocean=ocean_model,
    )

    cmdm = DataAggregator.aggregate(
        collected_raw=raw_collected,
        weather=weather_model,
        ocean=ocean_model,
        warnings=warning_model,
        validation=validation_report,
        region_label=region_label,
    )

    return cmdm
