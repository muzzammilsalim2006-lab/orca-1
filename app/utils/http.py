"""HTTP and resilient client utilities with domain-specific exceptions."""

from typing import Any, Dict, Optional
import httpx


class ProviderError(Exception):
    """Base exception for external marine/weather provider errors."""

    def __init__(self, message: str, provider_name: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.provider_name = provider_name
        self.details = details or {}


class ProviderUnavailable(ProviderError):
    """Raised when external provider is unreachable or returns 5xx."""
    pass


class ProviderTimeout(ProviderError):
    """Raised when external provider call times out."""
    pass


class ProviderMalformedData(ProviderError):
    """Raised when external provider returns unexpected payload structure."""
    pass
