"""
Pipeline Data Aggregator: Synthesizes normalized provider data, validation reports,
confidence scores, and source provenance into the CommonMarineDataModel.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.models.marine_data import (
    CommonMarineDataModel,
    DataStatusType,
    LocationData,
    OceanDataModel,
    PipelineMetadata,
    SourceMetadata,
    TimeData,
    ValidationReport,
    WarningDataModel,
    WeatherDataModel,
)
from app.utils.geo import detect_regional_language
from app.utils.logging import get_logger, log_event

log = get_logger("orca.pipeline.aggregator")


class DataAggregator:
    """Assembles normalized components into a unified CommonMarineDataModel."""

    @classmethod
    def aggregate(
        cls,
        collected_raw: Dict[str, Any],
        weather: WeatherDataModel,
        ocean: OceanDataModel,
        warnings: WarningDataModel,
        validation: ValidationReport,
        region_label: Optional[str] = None,
    ) -> CommonMarineDataModel:
        lat = collected_raw["latitude"]
        lon = collected_raw["longitude"]
        req_time = collected_raw.get("retrieved_at") or datetime.now(timezone.utc)
        fc_time = collected_raw.get("forecast_time") or req_time
        sources: List[SourceMetadata] = collected_raw.get("sources", [])
        collected_errors: List[str] = collected_raw.get("errors", [])

        # 1. Location Data Assembly
        location = LocationData(
            latitude=lat,
            longitude=lon,
            region=region_label or f"Coastal Region ({lat:.2f}°N, {lon:.2f}°E)",
        )

        # 2. Time Data Assembly
        time_data = TimeData(
            observation_time=req_time,
            forecast_time=fc_time,
            retrieved_at=req_time,
        )

        # 3. Compute Data Status & Confidence Score
        data_status, confidence_score = cls._compute_status_and_confidence(sources, weather, ocean, validation)

        # Freshness in seconds
        freshness_seconds = round((datetime.now(timezone.utc) - req_time).total_seconds(), 2)

        pipeline_meta = PipelineMetadata(
            sources=sources,
            data_status=data_status,
            freshness_seconds=freshness_seconds,
            confidence_score=confidence_score,
            errors=collected_errors + [e.reason for e in validation.errors],
        )

        cmdm = CommonMarineDataModel(
            location=location,
            time=time_data,
            weather=weather,
            ocean=ocean,
            warnings=warnings,
            metadata=pipeline_meta,
            validation=validation,
        )

        log_event("PIPELINE_AGGREGATION_COMPLETED", {
            "latitude": lat,
            "longitude": lon,
            "data_status": data_status,
            "confidence_score": confidence_score,
            "is_valid": validation.is_valid,
        })

        return cmdm

    @classmethod
    def _compute_status_and_confidence(
        cls,
        sources: List[SourceMetadata],
        weather: WeatherDataModel,
        ocean: OceanDataModel,
        validation: ValidationReport,
    ) -> tuple[DataStatusType, int]:
        has_demo = any(s.data_status == "DEMO" for s in sources)
        live_count = sum(1 for s in sources if s.data_status == "LIVE")
        unavail_count = sum(1 for s in sources if s.data_status == "UNAVAILABLE")

        if has_demo:
            status: DataStatusType = "DEMO"
        elif live_count > 0 and unavail_count == 0:
            status = "LIVE"
        elif live_count > 0:
            status = "PARTIAL"
        else:
            status = "UNAVAILABLE"

        # Calculate Confidence Score (0 - 100)
        score = 100

        # Deduct for unavailable primary sources
        if unavail_count > 0:
            score -= (unavail_count * 15)

        # Deduct for missing weather or ocean parameters
        if all(v is None for v in [weather.wind_speed_kmph, weather.rainfall_mm_24h]):
            score -= 15
        if all(v is None for v in [ocean.wave_height_m, ocean.swell_height_m]):
            score -= 15

        # Deduct for validation errors
        if not validation.is_valid:
            score -= (len(validation.errors) * 20)

        confidence_score = max(0, min(100, score))
        return status, confidence_score
