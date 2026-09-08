"""Request models for ORCA assessment."""

from typing import Optional
from pydantic import BaseModel, Field


class AssessmentRequest(BaseModel):
    location_name: Optional[str] = Field(
        default=None,
        description="Name of coastal city, port or landing center (e.g. Kochi, Mumbai, Chennai)",
    )
    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Latitude of origin coordinates",
        examples=[9.9312],
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Longitude of origin coordinates",
        examples=[76.2673],
    )
    date: str = Field(
        ...,
        description="Target mission date in YYYY-MM-DD format",
        examples=["2026-09-09"],
    )
    activity: str = Field(
        default="fishing",
        description="Type of maritime activity: fishing, patrolling, transport, research",
        examples=["fishing"],
    )
    departure_time: Optional[str] = Field(
        default="05:00",
        description="Target departure time (HH:MM in 24h format)",
        examples=["05:00"],
    )
    duration_hours: Optional[float] = Field(
        default=6.0,
        ge=1.0,
        le=72.0,
        description="Planned duration of maritime mission in hours",
        examples=[6.0],
    )
    vessel_id: Optional[str] = Field(
        default="demo-vessel-01",
        description="Vessel identifier or registration",
    )
    vessel_length_m: Optional[float] = Field(
        default=5.0,
        description="Length of vessel in meters (OAL)",
    )
    demo_profile: Optional[str] = Field(
        default=None,
        description="Optional demo override: normal, moderate, cyclone, degraded",
    )


class ChatRequest(BaseModel):
    query: str = Field(
        ...,
        description="Natural language user query in English, Hindi, Malayalam, Tamil, or Marathi",
        examples=["I want to go fishing from Kochi tomorrow at 5 AM."],
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="Existing session identifier for multi-turn conversational memory",
    )
    target_date: Optional[str] = Field(
        default=None,
        description="Optional date in YYYY-MM-DD format (defaults to today/tomorrow)",
    )
    preferred_language: Optional[str] = Field(
        default=None,
        description="Optional language override (en, hi, ml, ta, mr)",
    )


class WhatIfRequest(BaseModel):
    conversation_id: Optional[str] = Field(
        default=None,
        description="Existing mission conversation ID, or if None, uses baseline Kochi mission",
    )
    wave_delta_m: Optional[float] = Field(
        default=None,
        description="Perturbation in significant wave height in meters (e.g. +1.0 or -0.5)",
        examples=[1.0],
    )
    wind_delta_kmh: Optional[float] = Field(
        default=None,
        description="Perturbation in wind speed in km/h (e.g. +15.0)",
        examples=[15.0],
    )
    departure_time_shift_hours: Optional[float] = Field(
        default=None,
        description="Departure time shift in hours (e.g. +3.0)",
        examples=[3.0],
    )
    priority_mode: Optional[str] = Field(
        default="balanced",
        description="Optimization tuning: 'safety_first' | 'balanced' | 'catch_maximizer'",
        examples=["safety_first"],
    )


class MonitorRequest(BaseModel):
    conversation_id: Optional[str] = Field(
        default=None,
        description="Active mission conversation ID to audit",
    )
    current_wave_height_m: Optional[float] = Field(
        default=None,
        description="Newly observed or telemetry wave height in meters",
    )
    current_wind_speed_kmh: Optional[float] = Field(
        default=None,
        description="Newly observed wind speed in km/h",
    )
    incoming_warning_severity: Optional[str] = Field(
        default=None,
        description="Updated IMD warning severity: NONE | MODERATE | HIGH | SEVERE",
    )

