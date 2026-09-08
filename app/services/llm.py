from datetime import datetime, timezone

from app.config import Settings
from app.schemas import AssessResponse, Explanation
from app.utils.logging import get_logger

log = get_logger("orca.services.llm")

SYSTEM_PROMPT = (
    "You are ORCA's explanation assistant for a coastal safety prototype. "
    "Explain the assessment below to a member of the public in simple English (max 120 words). "
    "STRICT GUARDRAILS: never change, question, or recompute the risk level, score, or recommendation; "
    "never claim conditions are safe when the level is HIGH or an official warning is active; "
    "always end by telling the user to follow official IMD/NDMA advisories. "
    "If data is missing, say the assessment is indicative only."
)


def _compact(response: AssessResponse) -> dict:
    weather, ocean, risk = response.weather, response.ocean, response.risk
    return {
        "location": response.location.model_dump(),
        "risk": {"score": risk.score, "level": risk.level,
                 "warning_override": risk.warning_override,
                 "recommendation": risk.recommendation,
                 "missing_inputs": risk.missing_inputs},
        "warnings": [w.headline for w in response.warnings],
        "conditions": {
            "wind_kmph": weather.wind_speed_kmph if weather else None,
            "rain_24h_mm": weather.precipitation_mm_24h if weather else None,
            "wave_height_m": ocean.wave_height_m if ocean else None,
            "swell_height_m": ocean.swell_height_m if ocean else None,
            "current_kmph": ocean.ocean_current_speed_kmph if ocean else None,
        },
    }


async def build_explanation(client, response: AssessResponse, settings: Settings) -> Explanation:
    generated_at = datetime.now(timezone.utc)
    if settings.llm_api_key:
        try:
            text = await _call_llm(client, _compact(response), settings)
            return Explanation(text=text, provider=f"llm:{settings.llm_model}", generated_at=generated_at)
        except Exception as exc:
            log.warning("LLM explanation failed (%s); using template", exc)
    return Explanation(text=_template(response), provider="template", generated_at=generated_at)


async def _call_llm(client, payload: dict, settings: Settings) -> str:
    http_response = await client.post(
        f"{settings.llm_base_url.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {settings.llm_api_key}"},
        json={"model": settings.llm_model, "temperature": 0.3, "max_tokens": 220,
              "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                           {"role": "user", "content": str(payload)}]},
    )
    http_response.raise_for_status()
    return http_response.json()["choices"][0]["message"]["content"].strip()


def _template(response: AssessResponse) -> str:
    risk, weather, ocean = response.risk, response.weather, response.ocean
    label = response.location.label or "this location"
    parts = [f"Current risk for {label} is {risk.level} (score {risk.score}/100)."]
    if weather and weather.wind_speed_kmph is not None:
        parts.append(f"Wind is about {round(weather.wind_speed_kmph)} km/h")
        if weather.precipitation_mm_24h is not None:
            parts.append(f"with roughly {round(weather.precipitation_mm_24h)} mm of rain expected in 24 hours.")
        else:
            parts.append(".")
    if ocean and ocean.wave_height_m is not None:
        parts.append(f"Wave height is around {ocean.wave_height_m} m.")
    for warning in response.warnings:
        parts.append(f"Official {warning.severity}: {warning.headline}")
    if risk.missing_inputs:
        parts.append("Some data was unavailable (" + ", ".join(risk.missing_inputs) +
                     "), so treat this as indicative only.")
    parts.append(risk.recommendation)
    parts.append("This is an automated advisory, not a guarantee of safety. "
                 "Always follow official IMD/NDMA advisories.")
    return " ".join(parts)