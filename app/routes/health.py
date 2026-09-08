import time

from fastapi import APIRouter, Request

from app.config import settings
from app.schemas import HealthResponse
from app.services.imd import weather_cache
from app.services.ocean import ocean_cache
from app.services.warnings import warnings_cache

router = APIRouter(tags=["health"])


@router.get("/")
def root():
    return {"message": "ORCA Backend is running", "version": settings.version,
            "docs": "/docs", "health": "/health"}


@router.get("/health", response_model=HealthResponse)
def health(request: Request):
    started_at = getattr(request.app.state, "started_at", time.time())
    return HealthResponse(
        version=settings.version,
        uptime_seconds=round(time.time() - started_at, 1),
        demo_mode=settings.demo_mode,
        cache={"weather": weather_cache.stats(), "ocean": ocean_cache.stats(),
               "warnings": warnings_cache.stats()},
    )