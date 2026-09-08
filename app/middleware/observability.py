import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware

from app.utils.logging import get_logger

log = get_logger("orca.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Adds a request id, response timing headers, and one log line per request."""

    async def dispatch(self, request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.1f}"
        log.info("%s %s -> %s (%.1f ms) [%s]", request.method, request.url.path,
                 response.status_code, elapsed_ms, request_id)
        return response