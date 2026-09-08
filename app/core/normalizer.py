from datetime import datetime, timezone

from app.schemas import DataSource, OceanData, WeatherData

WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_open_meteo_weather(payload: dict, source_url: str) -> WeatherData:
    current = payload.get("current", {})
    daily = payload.get("daily") or {}
    daily_precip = (daily.get("precipitation_sum") or [None])[0]
    return WeatherData(
        temperature_c=current.get("temperature_2m"),
        feels_like_c=current.get("apparent_temperature"),
        humidity_pct=current.get("relative_humidity_2m"),
        pressure_hpa=current.get("surface_pressure"),
        wind_speed_kmph=current.get("wind_speed_10m"),
        wind_gust_kmph=current.get("wind_gusts_10m"),
        wind_direction_deg=current.get("wind_direction_10m"),
        precipitation_mm_last_hour=current.get("precipitation"),
        precipitation_mm_24h=daily_precip,
        visibility_km=None,
        condition=WEATHER_CODES.get(current.get("weather_code"), "Unknown"),
        source=DataSource(
            provider="Open-Meteo (IMD fallback)",
            source_url=source_url,
            retrieved_at=now_utc(),
            data_status="fallback",
            note="Live meteorology via Open-Meteo while the IMD adapter is not configured.",
        ),
    )


def normalize_open_meteo_marine(payload: dict, source_url: str) -> OceanData:
    current = payload.get("current", {})
    velocity = current.get("ocean_current_velocity")  # m/s
    return OceanData(
        wave_height_m=current.get("wave_height"),
        wave_period_s=current.get("wave_period"),
        wave_direction_deg=current.get("wave_direction"),
        wind_wave_height_m=current.get("wind_wave_height"),
        swell_height_m=current.get("swell_wave_height"),
        swell_period_s=current.get("swell_wave_period"),
        swell_direction_deg=current.get("swell_wave_direction"),
        sea_surface_temperature_c=current.get("sea_surface_temperature"),
        ocean_current_speed_kmph=round(velocity * 3.6, 2) if velocity is not None else None,
        source=DataSource(
            provider="Open-Meteo Marine",
            source_url=source_url,
            retrieved_at=now_utc(),
            data_status="live",
        ),
    )