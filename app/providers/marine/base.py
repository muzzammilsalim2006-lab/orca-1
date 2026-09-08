"""Base Marine Provider interface."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseMarineProvider(ABC):
    """Abstract interface for all marine condition data providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def fetch(self, latitude: float, longitude: float, forecast_days: int = 3) -> Dict[str, Any]:
        """Fetch raw marine forecast data for coordinates."""
        pass
