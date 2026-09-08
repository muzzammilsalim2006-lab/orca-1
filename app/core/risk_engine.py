from app.schemas import OceanData, RiskAssessment, RiskFactor, WeatherData, WeatherWarning

FACTOR_THRESHOLDS = {
    "wind":          {"label": "Wind (incl. 80% of gusts)", "unit": "km/h", "low": 25,  "high": 70,  "weight": 0.25},
    "rainfall":      {"label": "Rainfall (24 h)",           "unit": "mm",   "low": 35,  "high": 210, "weight": 0.15},
    "wave_height":   {"label": "Wave height",               "unit": "m",    "low": 1.0, "high": 3.5, "weight": 0.25},
    "swell":         {"label": "Swell height",              "unit": "m",    "low": 1.2, "high": 4.0, "weight": 0.15},
    "ocean_current": {"label": "Ocean current",             "unit": "km/h", "low": 1.5, "high": 5.5, "weight": 0.10},
}

LEVEL_BANDS = {
    "LOW": "score < 35",
    "MODERATE": "35 <= score < 60",
    "HIGH": "score >= 60 or official warning override",
}
WARNING_OVERRIDE_SCORE = 85.0
MISSING_PENALTY_PER_FACTOR = 4.0
MISSING_PENALTY_MAX = 12.0
CATEGORY_FLOOR = 45.0

RECOMMENDATIONS = {
    "LOW": "Conditions appear generally favourable. Stay alert to weather changes and official bulletins.",
    "MODERATE": "Exercise caution near the coast. Inexperienced swimmers should stay out of the water; conditions can change quickly.",
    "HIGH": "Avoid beach, fishing, and boating activity. Sea state and/or weather are dangerous.",
}
WARNING_RECOMMENDATION = ("An official warning is in effect. Cancel water activities and follow "
                          "IMD/NDMA instructions immediately.")


def _ramp(value: float | None, low: float, high: float) -> float | None:
    """Piecewise-linear score: 0 at/below `low`, 100 at/above `high`."""
    if value is None:
        return None
    if value <= low:
        return 0.0
    if value >= high:
        return 100.0
    return round((value - low) / (high - low) * 100, 1)


def _factor(name, label, value, unit, score, weight, missing: list[str], note=None) -> RiskFactor:
    if value is None or score is None:
        missing.append(name)
        return RiskFactor(name=name, label=label, value=None, unit=unit, score=None,
                          weight=weight, status="missing",
                          note=note or "Value unavailable (not assumed zero).")
    return RiskFactor(name=name, label=label, value=round(float(value), 2), unit=unit,
                      score=score, weight=weight, status="ok", note=note)


def evaluate_risk(weather: WeatherData | None, ocean: OceanData | None,
                  warnings: list[WeatherWarning]) -> RiskAssessment:
    missing: list[str] = []
    factors: list[RiskFactor] = []
    t = FACTOR_THRESHOLDS

    if weather is not None:
        wind_eff = weather.wind_speed_kmph
        if wind_eff is not None and weather.wind_gust_kmph is not None:
            wind_eff = max(wind_eff, 0.8 * weather.wind_gust_kmph)
        factors.append(_factor("wind", t["wind"]["label"], wind_eff, t["wind"]["unit"],
                               _ramp(wind_eff, t["wind"]["low"], t["wind"]["high"]),
                               t["wind"]["weight"], missing,
                               note="Includes 80% of gust speed." if weather.wind_gust_kmph is not None else None))
        rain_value = weather.precipitation_mm_24h
        rain_note = "24 h forecast total."
        if rain_value is None:
            rain_value = weather.precipitation_mm_last_hour
            rain_note = "Last-hour value used (24 h total unavailable)."
        factors.append(_factor("rainfall", t["rainfall"]["label"], rain_value, t["rainfall"]["unit"],
                               _ramp(rain_value, t["rainfall"]["low"], t["rainfall"]["high"]),
                               t["rainfall"]["weight"], missing, note=rain_note))
    else:
        for key in ("wind", "rainfall"):
            factors.append(_factor(key, t[key]["label"], None, t[key]["unit"], None, t[key]["weight"], missing))
        missing.append("weather")

    if ocean is not None:
        for key, value in (("wave_height", ocean.wave_height_m),
                           ("swell", ocean.swell_height_m),
                           ("ocean_current", ocean.ocean_current_speed_kmph)):
            factors.append(_factor(key, t[key]["label"], value, t[key]["unit"],
                                   _ramp(value, t[key]["low"], t[key]["high"]),
                                   t[key]["weight"], missing))
    else:
        for key in ("wave_height", "swell", "ocean_current"):
            factors.append(_factor(key, t[key]["label"], None, t[key]["unit"], None, t[key]["weight"], missing))
        missing.append("ocean")

    scored = [f for f in factors if f.status == "ok" and f.score is not None]
    if scored:
        weight_sum = sum(f.weight for f in scored)
        composite = sum((f.score or 0) * f.weight for f in scored) / weight_sum
    else:
        composite = 50.0

    missing_count = sum(1 for f in factors if f.status == "missing")
    score = composite + min(MISSING_PENALTY_MAX, MISSING_PENALTY_PER_FACTOR * missing_count)

    if weather is None or ocean is None:
        score = max(score, CATEGORY_FLOOR)

    advisories: list[str] = []
    warning_override = False
    active = [w for w in (warnings or []) if w.severity in ("warning", "alert")]
    watch = [w for w in (warnings or []) if w.severity in ("advisory", "watch")]
    if active:
        warning_override = True
        score = max(score, WARNING_OVERRIDE_SCORE)
        advisories.append("Official warning in effect: " + " | ".join(w.headline for w in active))
    elif watch:
        score = max(score, CATEGORY_FLOOR)
        advisories.append("Official advisory in effect: " + " | ".join(w.headline for w in watch))

    if ocean is None:
        advisories.append("Ocean conditions unavailable — treat sea state as unknown and avoid entering the water.")
    if weather is None:
        advisories.append("Weather data unavailable — assessment is based on limited information.")

    score = round(min(100.0, max(0.0, score)), 1)
    level = "LOW" if score < 35 else ("MODERATE" if score < 60 else "HIGH")
    recommendation = WARNING_RECOMMENDATION if warning_override else RECOMMENDATIONS[level]

    return RiskAssessment(score=score, level=level, factors=factors,
                          missing_inputs=sorted(set(missing)), warning_override=warning_override,
                          advisories=advisories, recommendation=recommendation)