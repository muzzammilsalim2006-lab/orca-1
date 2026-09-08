"""API routes package."""

from app.api.routes.health import router as health_router
from app.api.routes.assessment import router as assessment_router
from app.api.routes.locations import router as locations_router
from app.api.routes.marine import router as marine_router
from app.api.routes.weather import router as weather_router
from app.api.routes.chat import router as chat_router
from app.api.routes.what_if import router as what_if_router
from app.api.routes.monitor import router as monitor_router
from app.api.routes.pfz import router as pfz_router

__all__ = [
    "health_router",
    "assessment_router",
    "locations_router",
    "marine_router",
    "weather_router",
    "chat_router",
    "what_if_router",
    "monitor_router",
    "pfz_router",
]
