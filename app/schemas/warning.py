"""Coastal and marine warning schema."""

from typing import Optional
from pydantic import BaseModel, Field


class CoastalWarning(BaseModel):
    status: str = Field(
        default="NO_WARNING",
        description="Warning status: NO_WARNING | ADVISORY | WARNING | SEVERE_ALERT",
    )
    severity: str = Field(
        default="NONE",
        description="Severity level: NONE | LOW | MODERATE | HIGH | SEVERE",
    )
    region: str = Field(
        ...,
        description="Official coastal or maritime region (e.g. Kerala Coast, North Maharashtra Coast)",
    )
    warning_type: Optional[str] = Field(
        default=None,
        description="Type of warning: Fishermen Warning, Port Warning, Squall Alert, High Wave Alert",
    )
    message: Optional[str] = Field(
        default=None,
        description="Official advisory text or fishermen directive",
    )
    valid_until: Optional[str] = Field(
        default=None,
        description="Expiration timestamp or validity period",
    )
    source: str = Field(
        default="IMD",
        description="Issuing authority (IMD / INCOIS)",
    )
    mode: str = Field(
        default="live",
        description="Execution mode: live | cached_demo | simulated",
    )
