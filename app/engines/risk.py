"""Risk Engine: Deterministic, multi-factor maritime risk calculation."""

from typing import Any, Dict


class RiskEngine:
    @staticmethod
    def score_wave(height: float | None) -> int:
        if height is None:
            return 15
        if height < 1.5:
            return 5
        if height < 2.5:
            return 25
        if height < 3.5:
            return 45
        return 60

    @staticmethod
    def score_wind(speed_kmh: float | None) -> int:
        if speed_kmh is None:
            return 10
        if speed_kmh < 20.0:
            return 5
        if speed_kmh < 35.0:
            return 20
        if speed_kmh < 50.0:
            return 40
        return 60

    @staticmethod
    def score_swell(swell_height_m: float | None) -> int:
        if swell_height_m is None:
            return 0
        if swell_height_m >= 3.0:
            return 20
        if swell_height_m >= 2.0:
            return 10
        return 0

    @classmethod
    def calculate_risk(
        cls,
        marine: Dict[str, Any],
        weather: Dict[str, Any],
        warnings: Dict[str, Any],
    ) -> Dict[str, Any]:
        warning_severity = (warnings.get("severity") or "NONE").upper()

        if warning_severity == "SEVERE" or warnings.get("status") == "SEVERE_ALERT":
            return {
                "score": 95,
                "level": "SEVERE",
                "components": {
                    "wave_score": cls.score_wave(marine.get("wave_height_m")),
                    "wind_score": cls.score_wind(weather.get("wind_speed_kmh")),
                    "swell_score": cls.score_swell(marine.get("swell_height_m")),
                    "precipitation_penalty": 20,
                    "warning_penalty": 50,
                    "summary": "Critical safety hazard: Official severe marine alert/cyclonic gale in effect.",
                },
            }

        wave_pts = cls.score_wave(marine.get("wave_height_m"))
        wind_pts = cls.score_wind(weather.get("wind_speed_kmh"))
        swell_pts = cls.score_swell(marine.get("swell_height_m"))

        rain_penalty = 0
        rain_prob = weather.get("precipitation_probability")
        if rain_prob and rain_prob > 60:
            rain_penalty += 15

        weather_code = weather.get("weather_code")
        if weather_code in [95, 96, 99]:
            rain_penalty += 25

        warning_penalty = 0
        if warning_severity == "HIGH":
            warning_penalty = 30
        elif warning_severity == "MODERATE":
            warning_penalty = 15

        raw_score = wave_pts + wind_pts + swell_pts + rain_penalty + warning_penalty
        score = min(100, max(0, raw_score))

        # Enforce floors based on official advisories
        if warning_severity == "HIGH":
            score = max(score, 75)
        elif warning_severity == "MODERATE":
            score = max(score, 45)

        if score <= 30:
            level = "LOW"
            summary = "Calm to slight sea conditions; routine operations permitted."
        elif score <= 60:
            level = "MODERATE"
            summary = "Moderate wave/wind action; cautious navigation and constant VHF monitoring advised."
        elif score <= 80:
            level = "HIGH"
            summary = "Rough seas or squally winds; small craft operations strongly discouraged."
        else:
            level = "SEVERE"
            summary = "Dangerous maritime conditions; operations suspended."

        return {
            "score": score,
            "level": level,
            "components": {
                "wave_score": wave_pts,
                "wind_score": wind_pts,
                "swell_score": swell_pts,
                "precipitation_penalty": rain_penalty,
                "warning_penalty": warning_penalty,
                "summary": summary,
            },
        }
