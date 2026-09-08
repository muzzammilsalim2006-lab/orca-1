"""Base Weather Provider interface."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseWeatherProvider(ABC):
    """Abstract interface for all coastal weather forecast providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def fetch(self, latitude: float, longitude: float, forecast_days: int = 3) -> Dict[str, Any]:
        """Fetch raw weather forecast data for coordinates."""
        pass
