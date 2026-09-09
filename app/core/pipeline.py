import asyncio
import httpx
import uuid
from datetime import datetime, timezone


from app.config import Settings
from app.core.risk_engine import evaluate_risk
from app.schemas import (AssessRequest, AssessResponse, Location, OceanData,
                         WeatherData, WeatherWarning)
from app.services import demo_data, imd as imd_service, llm, ocean as ocean_service
from app.services import warnings as warnings_service
from app.utils.geo import detect_regional_language
from app.utils.logging import get_logger

log = get_logger("orca.pipeline")


def _resolve_language(request: AssessRequest) -> str:
    req_lang = getattr(request, "language", "auto") or "auto"
    if req_lang in ["mr", "en"]:
        return req_lang
    # If auto, resolve regional language based on coordinates & location label
    return detect_regional_language(request.latitude, request.longitude, request.label)


async def run_assessment(client, request: AssessRequest, settings: Settings,
                         request_id: str | None = None) -> AssessResponse:
    request_id = request_id or uuid.uuid4().hex[:12]
    use_demo = settings.demo_mode if request.demo is None else request.demo

    if client is None:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as temp_client:
            return await run_assessment(temp_client, request, settings, request_id)

    if use_demo:
        return await _demo_response(client, request, settings, request_id)


    weather_task = asyncio.create_task(
        imd_service.get_weather(client, request.latitude, request.longitude, settings))
    ocean_task = asyncio.create_task(
        ocean_service.get_ocean(client, request.latitude, request.longitude, settings))
    warnings_task = asyncio.create_task(
        warnings_service.get_active_warnings(client, request.latitude, request.longitude, settings))

    weather_res, ocean_res, warnings_res = await asyncio.gather(
        weather_task, ocean_task, warnings_task, return_exceptions=True)

    weather = weather_res if isinstance(weather_res, WeatherData) else None
    if isinstance(weather_res, BaseException):
        log.warning("weather unavailable: %s", weather_res)
    ocean = ocean_res if isinstance(ocean_res, OceanData) else None
    if isinstance(ocean_res, BaseException):
        log.info("ocean unavailable: %s", ocean_res)
    warnings = warnings_res if isinstance(warnings_res, list) else []

    mode = "live" if (weather or ocean) else "demo-fallback"
    if ocean is None and settings.demo_fallback:
        ocean = demo_data.demo_ocean_fallback(request.latitude, request.longitude)
        if ocean is not None:
            mode = "demo-fallback"

    risk = evaluate_risk(weather, ocean, warnings)
    response = AssessResponse(
        request_id=request_id,
        assessed_at=datetime.now(timezone.utc),
        mode=mode,
        api_version=settings.version,
        location=Location(latitude=request.latitude, longitude=request.longitude, label=request.label),
        weather=weather,
        ocean=ocean,
        warnings=warnings,
        risk=risk,
        explanation=None,
    )
    if request.include_explanation:
        target_lang = _resolve_language(request)
        response.explanation = await llm.build_explanation(client, response, settings, language=target_lang)
    return response


async def _demo_response(client, request: AssessRequest, settings: Settings,
                         request_id: str) -> AssessResponse:
    key = demo_data.nearest_demo_key(request.latitude, request.longitude)
    sample = demo_data.load_demo(key)
    weather = WeatherData(**sample["weather"]) if sample.get("weather") else None
    ocean = OceanData(**sample["ocean"]) if sample.get("ocean") else None
    warnings = [WeatherWarning(**w) for w in sample.get("warnings", [])]
    label = request.label or f"{sample.get('label', key.title())} (demo sample)"

    risk = evaluate_risk(weather, ocean, warnings)
    response = AssessResponse(
        request_id=request_id,
        assessed_at=datetime.now(timezone.utc),
        mode="demo",
        api_version=settings.version,
        location=Location(latitude=request.latitude, longitude=request.longitude, label=label),
        weather=weather,
        ocean=ocean,
        warnings=warnings,
        risk=risk,
        explanation=None,
    )
    if request.include_explanation:
        target_lang = _resolve_language(request)
        response.explanation = await llm.build_explanation(client, response, settings, language=target_lang)
    return response