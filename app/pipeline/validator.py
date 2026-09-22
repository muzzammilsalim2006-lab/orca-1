"""
Pipeline Data Validator: Enforces domain integrity rules on normalized marine data.
Never silently deletes questionable values; records explicit validation errors and reasons.
"""

from typing import Optional
from app.models.marine_data import (
    LocationData,
    OceanDataModel,
    ValidationErrorItem,
    ValidationReport,
    WeatherDataModel,
)
from app.utils.logging import get_logger

log = get_logger("orca.pipeline.validator")


class DataValidator:
    """Validates geographical coordinates, meteorological bounds, and oceanographic thresholds."""

    @classmethod
    def validate(
        cls,
        location: LocationData,
        weather: WeatherDataModel,
        ocean: OceanDataModel,
    ) -> ValidationReport:
        errors: list[ValidationErrorItem] = []
        warnings: list[str] = []

        # 1. Location Coordinate Rules
        if not (-90.0 <= location.latitude <= 90.0):
            errors.append(ValidationErrorItem(
                field="location.latitude",
                value=location.latitude,
                rule="[-90.0 <= latitude <= 90.0]",
                reason=f"Latitude {location.latitude}° out of global physical range.",
            ))

        if not (-180.0 <= location.longitude <= 180.0):
            errors.append(ValidationErrorItem(
                field="location.longitude",
                value=location.longitude,
                rule="[-180.0 <= longitude <= 180.0]",
                reason=f"Longitude {location.longitude}° out of global physical range.",
            ))

        # 2. Ocean Bounds Rules (Impossible negative values)
        if ocean.wave_height_m is not None and ocean.wave_height_m < 0.0:
            errors.append(ValidationErrorItem(
                field="ocean.wave_height_m",
                value=ocean.wave_height_m,
                rule="[wave_height_m >= 0.0]",
                reason=f"Impossible negative wave height: {ocean.wave_height_m} m.",
            ))

        if ocean.wave_height_m is not None and ocean.wave_height_m > 30.0:
            warnings.append(f"Extreme wave height detected: {ocean.wave_height_m} m (exceeds typical coastal bounds).")

        if ocean.swell_height_m is not None and ocean.swell_height_m < 0.0:
            errors.append(ValidationErrorItem(
                field="ocean.swell_height_m",
                value=ocean.swell_height_m,
                rule="[swell_height_m >= 0.0]",
                reason=f"Impossible negative swell height: {ocean.swell_height_m} m.",
            ))

        if ocean.current_speed_kmph is not None and ocean.current_speed_kmph < 0.0:
            errors.append(ValidationErrorItem(
                field="ocean.current_speed_kmph",
                value=ocean.current_speed_kmph,
                rule="[current_speed_kmph >= 0.0]",
                reason=f"Impossible negative ocean current speed: {ocean.current_speed_kmph} km/h.",
            ))

        # 3. Weather Bounds Rules (Impossible negative rain/wind, extreme thresholds)
        if weather.rainfall_mm_24h is not None and weather.rainfall_mm_24h < 0.0:
            errors.append(ValidationErrorItem(
                field="weather.rainfall_mm_24h",
                value=weather.rainfall_mm_24h,
                rule="[rainfall_mm_24h >= 0.0]",
                reason=f"Impossible negative rainfall: {weather.rainfall_mm_24h} mm.",
            ))

        if weather.wind_speed_kmph is not None and weather.wind_speed_kmph < 0.0:
            errors.append(ValidationErrorItem(
                field="weather.wind_speed_kmph",
                value=weather.wind_speed_kmph,
                rule="[wind_speed_kmph >= 0.0]",
                reason=f"Impossible negative wind speed: {weather.wind_speed_kmph} km/h.",
            ))

        if weather.wind_speed_kmph is not None and weather.wind_speed_kmph > 350.0:
            errors.append(ValidationErrorItem(
                field="weather.wind_speed_kmph",
                value=weather.wind_speed_kmph,
                rule="[wind_speed_kmph <= 350.0]",
                reason=f"Unreasonable wind speed value: {weather.wind_speed_kmph} km/h.",
            ))

        if weather.temperature_c is not None and not (-30.0 <= weather.temperature_c <= 60.0):
            errors.append(ValidationErrorItem(
                field="weather.temperature_c",
                value=weather.temperature_c,
                rule="[-30.0 <= temperature_c <= 60.0]",
                reason=f"Unreasonable temperature value: {weather.temperature_c} °C.",
            ))

        if weather.pressure_hpa is not None and not (800.0 <= weather.pressure_hpa <= 1100.0):
            errors.append(ValidationErrorItem(
                field="weather.pressure_hpa",
                value=weather.pressure_hpa,
                rule="[800.0 <= pressure_hpa <= 1100.0]",
                reason=f"Unreasonable atmospheric pressure: {weather.pressure_hpa} hPa.",
            ))

        # 4. Critical Missing Fields Warnings
        all_weather_missing = all(v is None for v in [weather.wind_speed_kmph, weather.rainfall_mm_24h, weather.temperature_c])
        all_ocean_missing = all(v is None for v in [ocean.wave_height_m, ocean.swell_height_m, ocean.current_speed_kmph])

        if all_weather_missing:
            warnings.append("Weather data inputs completely missing for this location.")
        if all_ocean_missing:
            warnings.append("Ocean state data inputs completely missing for this location (inland or unmapped grid).")

        is_valid = len(errors) == 0
        if not is_valid:
            log.warning("Validation completed with %d errors and %d warnings", len(errors), len(warnings))

        return ValidationReport(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
        )
