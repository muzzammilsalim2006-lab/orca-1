from fastapi import APIRouter

from app.config import settings
from app.core.risk_engine import FACTOR_THRESHOLDS, LEVEL_BANDS
from app.schemas import DemoLocation, MetaResponse
from app.services.demo_data import list_demo_locations

router = APIRouter(prefix="/api", tags=["meta"])

SOURCES = [
    {"name": "IMD (weather, marine & cyclone warnings)", "status": "adapter stub + Open-Meteo fallback", "owner": "M2"},
    {"name": "Open-Meteo", "url": "https://open-meteo.com/", "status": "live meteorology fallback"},
    {"name": "Open-Meteo Marine", "url": "https://open-meteo.com/", "status": "live waves/swell/SST/currents"},
    {"name": "INCOIS Ocean State Forecast / PFZ", "status": "planned future expansion", "owner": "M3"},
]

GUARDRAILS = [
    "Official warnings (severity warning/alert) always override the computed score to HIGH.",
    "The LLM layer is explanation-only; it cannot change score, level, or recommendations.",
    "Missing values are shown as null and never replaced with zero.",
    "Risk wording is advisory (Low/Moderate/High) and never claims guaranteed safety.",
]

LIMITATIONS = [
    "Prototype thresholds are assumptions unless tied to an official IMD/INCOIS source.",
    "Forecast uncertainty increases beyond 24 hours.",
    "Coastal conditions vary at beach level; this is a regional assessment.",
    "Follow official IMD/NDMA/Coast Guard advisories at all times.",
]


@router.get("/meta", response_model=MetaResponse,
            summary="Thresholds, sources, guardrails, and demo locations for the dashboard")
def meta():
    return MetaResponse(
        version=settings.version,
        demo_mode=settings.demo_mode,
        sources=SOURCES,
        factor_thresholds=FACTOR_THRESHOLDS,
        risk_levels=LEVEL_BANDS,
        guardrails=GUARDRAILS,
        limitations=LIMITATIONS,
        demo_locations=list_demo_locations(),
    )


@router.get("/demo/locations", response_model=list[DemoLocation], summary="Saved demo locations")
def demo_locations():
    return list_demo_locations()