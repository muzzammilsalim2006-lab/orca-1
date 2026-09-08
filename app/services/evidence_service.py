"""Evidence Service: Assembles verifiable audit trails for decisions."""

from datetime import datetime, timezone
from typing import Any, Dict, List


class EvidenceService:
    @staticmethod
    def build_evidence(
        marine: Dict[str, Any],
        weather: Dict[str, Any],
        warnings: Dict[str, Any],
        latitude: float,
        longitude: float,
    ) -> List[Dict[str, Any]]:
        evidence = []
        loc = {"lat": latitude, "lon": longitude}
        now_ts = datetime.now(timezone.utc).isoformat()

        if marine.get("wave_height_m") is not None:
            evidence.append({
                "source": marine.get("source", "Marine Provider"),
                "dataset": "significant_wave_height",
                "timestamp": now_ts,
                "location": loc,
                "value": marine["wave_height_m"],
                "unit": "m",
                "quality_status": "VALID",
            })

        if marine.get("sea_surface_temperature_c") is not None:
            evidence.append({
                "source": marine.get("source", "Marine Provider"),
                "dataset": "sea_surface_temperature",
                "timestamp": now_ts,
                "location": loc,
                "value": marine["sea_surface_temperature_c"],
                "unit": "degC",
                "quality_status": "VALID",
            })

        if marine.get("ocean_current_velocity_ms") is not None:
            evidence.append({
                "source": marine.get("source", "Marine Provider"),
                "dataset": "ocean_surface_current",
                "timestamp": now_ts,
                "location": loc,
                "value": marine["ocean_current_velocity_ms"],
                "unit": "m/s",
                "quality_status": "VALID",
            })

        if weather.get("wind_speed_kmh") is not None:
            evidence.append({
                "source": weather.get("source", "Weather Provider"),
                "dataset": "wind_speed_10m",
                "timestamp": now_ts,
                "location": loc,
                "value": weather["wind_speed_kmh"],
                "unit": "km/h",
                "quality_status": "VALID",
            })

        if weather.get("precipitation_probability") is not None:
            evidence.append({
                "source": weather.get("source", "Weather Provider"),
                "dataset": "precipitation_probability",
                "timestamp": now_ts,
                "location": loc,
                "value": weather["precipitation_probability"],
                "unit": "%",
                "quality_status": "VALID",
            })

        evidence.append({
            "source": warnings.get("source", "IMD"),
            "dataset": "coastal_fishermen_advisory",
            "timestamp": now_ts,
            "location": loc,
            "value": warnings.get("severity", "NONE"),
            "unit": warnings.get("region"),
            "quality_status": "VERIFIED_BULLETIN",
        })

        return evidence
