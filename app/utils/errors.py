class AppError(Exception):
    status_code: int = 500
    code: str = "internal_error"
    message: str = "Unexpected server error."

    def __init__(self, message: str | None = None, *, code: str | None = None,
                 status_code: int | None = None, details: dict | None = None):
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details
        super().__init__(self.message)


class UpstreamError(AppError):
    status_code = 502
    code = "upstream_unavailable"
    message = "An upstream data provider is unavailable."


class LocationOutOfScopeError(AppError):
    status_code = 422
    code = "location_out_of_scope"
    message = "Location is outside the supported region."