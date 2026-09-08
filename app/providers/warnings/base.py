"""Base Warning Provider interface."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseWarningProvider(ABC):
    """Abstract interface for all coastal maritime warning providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def fetch(self, region: str) -> Dict[str, Any]:
        """Fetch warning details for a regional coastal division."""
        pass
