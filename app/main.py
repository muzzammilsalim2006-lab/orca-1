import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.responses import JSONResponse

from app.config import settings
from app.middleware.observability import RequestContextMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes import assess, health, meta
from app.utils.errors import AppError
from app.utils.logging import configure_logging, get_logger

log = get_logger("orca.main")

DESCRIPTION = """
Backend for **ORCA**, a coastal risk assessment prototype (Smart India Hackathon).

Pipeline: `data services (IMD/Open-Meteo) -> normalizer -> deterministic risk engine -> response
(+ optional guardrailed LLM explanation)`.

Key guardrails:
- Official IMD warnings override computed risk.
- Missing data stays `null` and is never treated as zero.
- The LLM layer can explain but never change risk results.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(
        timeout=settings.request_timeout_seconds,
        follow_redirects=True,
        transport=httpx.AsyncHTTPTransport(retries=2),
        headers={"User-Agent": "ORCA-Backend/prototype"},
    )
    app.state.started_at = time.time()
    log.info("ORCA backend v%s started (demo_mode=%s, restrict_to_india=%s)",
             settings.version, settings.demo_mode, settings.restrict_to_india)
    yield
    await app.state.http.aclose()
    log.info("ORCA backend stopped")


def _error_payload(request: Request, status_code: int, code: str, message: str, details=None):
    request_id = getattr(getattr(request, "state", None), "request_id", None)
    body = {"error": {"code": code, "message": message, "details": details}}
    if request_id:
        body["request_id"] = request_id
    return JSONResponse(status_code=status_code, content=body)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        return _error_payload(request, exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError):
        errors = [{"field": ".".join(str(p) for p in e.get("loc", [])[1:]),
                   "message": e.get("msg", "")} for e in exc.errors()]
        return _error_payload(request, 422, "validation_error", "Invalid request payload.", errors[:10])

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        log.exception("Unhandled error: %s", exc)
        return _error_payload(request, 500, "internal_error", "Unexpected server error.")


def create_app() -> FastAPI:
    configure_logging(settings.log_level)
    app = FastAPI(title=settings.app_name, description=DESCRIPTION,
                  version=settings.version, lifespan=lifespan)

    # NOTE: the last-added middleware is outermost.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(RateLimitMiddleware, limit=settings.rate_limit_per_minute)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(assess.router)
    app.include_router(meta.router)
    return app


app = create_app()