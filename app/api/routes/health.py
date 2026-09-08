"""Health check router."""

from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health():
    """Health check endpoint confirming service readiness."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.version,
        "demo_mode": settings.demo_mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
