from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration is read from environment variables with the ORCA_ prefix."""

    model_config = SettingsConfigDict(env_prefix="ORCA_", env_file=".env", extra="ignore")

    app_name: str = "ORCA Backend API"
    version: str = "0.2.0"
    debug: bool = False
    log_level: str = "INFO"

    # Behaviour
    cors_origins: list[str] = ["*"]        # comma-separated in env
    demo_mode: bool = True                 # serve saved Chennai/Kochi samples by default
    demo_fallback: bool = True             # substitute demo ocean data when live fails
    restrict_to_india: bool = True         # reject locations outside India bbox
    rate_limit_per_minute: int = 60
    request_timeout_seconds: float = 8.0

    # Cache TTLs (in-process; swap for Redis in production)
    cache_ttl_weather_seconds: int = 600
    cache_ttl_ocean_seconds: int = 900
    cache_ttl_warnings_seconds: int = 1800

    # Upstream data providers
    open_meteo_base_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_marine_base_url: str = "https://marine-api.open-meteo.com/v1/marine"
    imd_api_base_url: str | None = None    # set when M2 finalises IMD access
    imd_api_key: str | None = None

    # Optional guardrailed LLM explanation layer
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()