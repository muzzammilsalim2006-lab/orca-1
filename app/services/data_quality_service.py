"""Data Quality Service: Evaluates completeness, validity, and operational status."""

from typing import Any, Dict, Tuple


class DataQualityService:
    @staticmethod
    def evaluate_quality(
        marine: Dict[str, Any],
        weather: Dict[str, Any],
        warnings: Dict[str, Any],
    ) -> Tuple[str, float]:
        """
        Returns (data_quality_status, missing_ratio)
        Status: NOMINAL | DEGRADED | CRITICAL_DATA_LOSS
        """
        marine_keys = ["wave_height_m", "wave_period_s", "sea_surface_temperature_c"]
        weather_keys = ["wind_speed_kmh", "wind_direction_deg", "precipitation_probability"]

        total_checked = len(marine_keys) + len(weather_keys)
        missing_count = 0

        for k in marine_keys:
            if marine.get(k) is None:
                missing_count += 1

        for k in weather_keys:
            if weather.get(k) is None:
                missing_count += 1

        missing_ratio = missing_count / float(total_checked)

        if missing_ratio == 0.0:
            status = "NOMINAL"
        elif missing_ratio <= 0.35:
            status = "DEGRADED"
        else:
            status = "CRITICAL_DATA_LOSS"

        return status, missing_ratio
