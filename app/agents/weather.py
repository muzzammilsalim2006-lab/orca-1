"""Weather Agent: Orchestrates atmospheric and coastal warning ingestion via WeatherTools."""

from typing import Any, Dict, Optional
from app.state.mission_state import MarineState
from app.tools.weather_tools import WeatherTools


class WeatherAgent:
    def __init__(self, tools: Optional[WeatherTools] = None):
        self.tools = tools or WeatherTools()

    async def execute(self, state: MarineState, demo_profile: Optional[str] = None) -> MarineState:
        lat = state.location.get("latitude", 9.9312)
        lon = state.location.get("longitude", 76.2673)
        loc_name = state.location.get("name")
        date_str = state.mission.get("date", "2026-09-09")
        departure_time = state.mission.get("departure_time", "05:00")
        duration = state.mission.get("duration_hours", 6.0)

        # Weather forecast
        weather_conditions = await self.tools.get_weather_forecast(
            latitude=lat,
            longitude=lon,
            date_str=date_str,
            departure_time=departure_time,
            duration_hours=duration,
            demo_profile=demo_profile,
        )
        state.weather = weather_conditions

        # Coastal Warnings
        warnings = await self.tools.get_coastal_warnings(
            location_name=loc_name,
            latitude=lat,
            longitude=lon,
            date_str=date_str,
            demo_profile=demo_profile,
        )
        state.warnings = warnings

        # Add evidence
        if weather_conditions.get("wind_speed_kmh") is not None:
            state.add_evidence(
                source=weather_conditions.get("source", "Weather Provider"),
                dataset="wind_speed_10m",
                value=weather_conditions["wind_speed_kmh"],
                location={"lat": lat, "lon": lon},
                unit="km/h",
            )

        if weather_conditions.get("precipitation_probability") is not None:
            state.add_evidence(
                source=weather_conditions.get("source", "Weather Provider"),
                dataset="precipitation_probability",
                value=weather_conditions["precipitation_probability"],
                location={"lat": lat, "lon": lon},
                unit="%",
            )

        state.add_evidence(
            source=warnings.get("source", "IMD"),
            dataset="coastal_warning_bulletin",
            value=warnings.get("severity", "NONE"),
            location={"lat": lat, "lon": lon},
            unit=warnings.get("region"),
        )

        state.add_audit_event(
            "WEATHER_AGENT_COMPLETED",
            f"Wind: {weather_conditions.get('wind_speed_kmh')} km/h ({weather_conditions.get('wind_compass')}), Advisory: {warnings.get('severity')}",
            {"weather_code": weather_conditions.get("weather_code"), "region": warnings.get("region")},
        )

        return state
