from datetime import datetime, timezone

from app.config import Settings
from app.schemas import AssessResponse, Explanation
from app.utils.logging import get_logger

log = get_logger("orca.services.llm")

SYSTEM_PROMPT_TEMPLATE = (
    "You are ORCA, a marine safety explanation assistant. "
    "Generate a short, simple plain-language summary based only on the supplied assessment data. "
    "Selected language: {language}\n\n"
    "STRICT GUARDRAILS:\n"
    "1. If the selected language is 'mr', write the complete summary in Marathi using Devanagari script.\n"
    "2. Do not invent weather or ocean values.\n"
    "3. Do not change the risk level or risk score.\n"
    "4. Do not override official warnings.\n"
    "5. Do not say that conditions are guaranteed safe.\n"
    "6. Use simple language suitable for fishermen and coastal users.\n"
    "7. Clearly explain the main risk factors and the recommended action.\n"
    "8. Keep explanation under 100 words."
)


def _compact(response: AssessResponse) -> dict:
    weather, ocean, risk = response.weather, response.ocean, response.risk
    return {
        "location": response.location.model_dump(),
        "risk": {
            "score": risk.score,
            "level": risk.level,
            "warning_override": risk.warning_override,
            "recommendation": risk.recommendation,
            "missing_inputs": risk.missing_inputs,
        },
        "warnings": [w.headline for w in response.warnings],
        "conditions": {
            "wind_kmph": weather.wind_speed_kmph if weather else None,
            "rain_24h_mm": weather.precipitation_mm_24h if weather else None,
            "wave_height_m": ocean.wave_height_m if ocean else None,
            "swell_height_m": ocean.swell_height_m if ocean else None,
            "current_kmph": ocean.ocean_current_speed_kmph if ocean else None,
        },
    }


async def build_explanation(
    client,
    response: AssessResponse,
    settings: Settings,
    language: str = "en",
) -> Explanation:
    generated_at = datetime.now(timezone.utc)
    target_lang = "mr" if language == "mr" else "en"

    if settings.llm_api_key:
        try:
            text = await _call_llm(client, _compact(response), settings, target_lang)
            return Explanation(
                text=text,
                provider=f"llm:{settings.llm_model}",
                generated_at=generated_at,
                language=target_lang,
            )
        except Exception as exc:
            log.warning("LLM explanation failed (%s); using fallback template", exc)

    return Explanation(
        text=_template(response, target_lang),
        provider="template",
        generated_at=generated_at,
        language=target_lang,
    )


async def _call_llm(client, payload: dict, settings: Settings, language: str) -> str:
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(language=language)
    http_response = await client.post(
        f"{settings.llm_base_url.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {settings.llm_api_key}"},
        json={
            "model": settings.llm_model,
            "temperature": 0.3,
            "max_tokens": 220,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": str(payload)},
            ],
        },
    )
    http_response.raise_for_status()
    return http_response.json()["choices"][0]["message"]["content"].strip()


def _template(response: AssessResponse, language: str = "en") -> str:
    risk, weather, ocean = response.risk, response.weather, response.ocean
    label = response.location.label or "या क्षेत्रासाठी"

    if language == "mr":
        return _marathi_template(response)

    # Default English template
    parts = [f"Current risk for {response.location.label or 'this location'} is {risk.level} (score {risk.score}/100)."]
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
        parts.append("Some data was unavailable (" + ", ".join(risk.missing_inputs) + "), so treat this as indicative only.")
    parts.append(risk.recommendation)
    parts.append("This is an automated advisory, not a guarantee of safety. Always follow official IMD/NDMA advisories.")
    return " ".join(parts)


def _marathi_template(response: AssessResponse) -> str:
    risk = response.risk
    weather = response.weather
    ocean = response.ocean
    warnings = response.warnings

    has_cyclone = any(w.type == "cyclone" or "cyclone" in w.headline.lower() for w in warnings)
    has_marine_warning = any(w.type == "marine" or w.severity in ["warning", "alert"] for w in warnings)

    parts = []

    # 1. Active Cyclone Warning Fallback
    if has_cyclone:
        parts.append("समुद्रात जाणे टाळण्याचा सल्ला दिला जातो. अधिकृत चक्रीवादळाचा इशारा लागू आहे.")
        parts.append("स्थानिक प्रशासन आणि अधिकृत हवामान विभागाच्या सूचनांचे तंतोतंत पालन करा.")
    # 2. Active Marine Warning Fallback
    elif has_marine_warning:
        parts.append("खराब हवामान आणि तीव्र सागरी इशारा लागू आहे.")
        parts.append("समुद्रात जाणे टाळा आणि अधिकृत सागरी हवामान bulletins चे पालन करा.")
    # 3. High Risk Level
    elif risk.level == "HIGH":
        parts.append("समुद्रात जाणे टाळण्याचा सल्ला दिला जातो. समुद्रात तीव्र वारे आणि उंच लाटा असल्यामुळे धोका जास्त आहे.")
        parts.append("स्थानिक प्रशासन आणि अधिकृत हवामान विभागाच्या सूचनांचे पालन करा.")
    # 4. Moderate Risk Level
    elif risk.level == "MODERATE":
        parts.append("उद्यासाठी समुद्राची स्थिती मध्यम धोकादायक आहे. वाऱ्याचा वेग आणि लाटांची उंची वाढलेली आहे.")
        parts.append("समुद्रात जाण्यापूर्वी अधिकृत सागरी इशारे तपासा आणि सावधगिरी बाळगा.")
    # 5. Low Risk Level
    else:
        parts.append("समुद्राची स्थिती सध्या तुलनेने अनुकूल आहे.")
        parts.append("तरीही समुद्रात जाण्यापूर्वी ताजे हवामान आणि सागरी इशारे तपासा.")

    # Details addition if weather/ocean values present
    cond_details = []
    if weather and weather.wind_speed_kmph is not None:
        cond_details.append(f"वाऱ्याचा वेग सुमारे {round(weather.wind_speed_kmph)} km/h")
    if ocean and ocean.wave_height_m is not None:
        cond_details.append(f"लाटांची उंची {ocean.wave_height_m} m")

    if cond_details:
        parts.append(f"({', '.join(cond_details)} आहे.)")

    # Missing Data note
    if risk.missing_inputs:
        parts.append("टीप: काही सागरी माहिती उपलब्ध नसल्याने हे मूल्यांकन प्रातिनिधिक मानले जावे.")

    # Guardrail note
    parts.append("हा स्वयंचलित सल्ला आहे. हवामान खात्याच्या (IMD) अधिकृत सूचनांचे नेहमी पालन करा.")

    return " ".join(parts)