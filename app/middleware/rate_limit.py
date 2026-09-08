import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

EXEMPT_PATHS = {"/", "/health", "/docs", "/redoc", "/openapi.json", "/favicon.ico"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple per-IP sliding-window limiter for POST endpoints (no external deps)."""

    def __init__(self, app, limit: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request, call_next):
        if request.method != "POST" or request.url.path in EXEMPT_PATHS:
            return await call_next(request)
        ip = request.client.host if request.client else "anonymous"
        now = time.monotonic()
        bucket = self._hits[ip]
        while bucket and now - bucket[0] > self.window:
            bucket.popleft()
        if len(bucket) >= self.limit:
            retry_after = int(self.window - (now - bucket[0])) + 1
            return JSONResponse(
                status_code=429,
                content={"error": {"code": "rate_limited",
                                   "message": f"Too many requests. Max {self.limit}/minute."},
                         "retry_after_seconds": retry_after},
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)
        return await call_next(request)