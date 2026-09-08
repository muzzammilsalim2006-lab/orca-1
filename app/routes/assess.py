import uuid

from fastapi import APIRouter, Request

from app.config import settings
from app.core.pipeline import run_assessment
from app.schemas import AssessRequest, AssessResponse
from app.utils.geo import ensure_supported_location

router = APIRouter(prefix="/api", tags=["assessment"])


@router.post("/assess", response_model=AssessResponse,
             summary="Assess coastal risk for a location",
             description="Runs services -> normalizer -> risk engine -> optional guardrailed LLM explanation.")
async def assess(payload: AssessRequest, request: Request):
    ensure_supported_location(payload.latitude, payload.longitude, settings.restrict_to_india)
    request_id = getattr(request.state, "request_id", None) or uuid.uuid4().hex[:12]
    client = getattr(request.app.state, "http", None)
    return await run_assessment(client, payload, settings, request_id)