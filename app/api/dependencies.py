"""Dependency injection providers for FastAPI routers."""

from app.agents.orchestrator import OrcaOrchestrator
from app.services.location_service import LocationService
from app.services.marine_service import MarineService
from app.services.weather_service import WeatherService
from app.services.warning_service import WarningService

# Singleton service instances
_orchestrator = OrcaOrchestrator()
_marine_service = MarineService()
_weather_service = WeatherService()
_warning_service = WarningService()


def get_orchestrator() -> OrcaOrchestrator:
    return _orchestrator


def get_marine_service() -> MarineService:
    return _marine_service


def get_weather_service() -> WeatherService:
    return _weather_service


def get_warning_service() -> WarningService:
    return _warning_service
