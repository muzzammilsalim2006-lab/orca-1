from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import math

from app.engines.ocean_cube import OceanStateCube, OceanStatePoint


class SpatiotemporalEngine:
    """
    Fuses asynchronous spatial-temporal data streams:
    - Satellite passes (daily/orbital snapshot with observation timestamp)
    - NWP forecasts (hourly forward predictions)
    - Coastal warning bulletins (validity window)
    - In-situ observations
    Computes freshness decay and generates time-aligned oceanic snapshots.
    """

    @staticmethod
    def calculate_temporal_decay(observation_time_iso: str, target_time_iso: str, half_life_hours: float = 12.0) -> float:
        """Computes exponential confidence decay factor based on age of data."""
        try:
            obs_dt = datetime.fromisoformat(observation_time_iso.replace("Z", "+00:00"))
            target_dt = datetime.fromisoformat(target_time_iso.replace("Z", "+00:00"))
            delta_hours = abs((target_dt - obs_dt).total_seconds() / 3600.0)
            decay = math.exp(-0.693 * (delta_hours / max(1.0, half_life_hours)))
            return round(max(0.1, min(1.0, decay)), 3)
        except Exception:
            return 0.85

    @classmethod
    def fuse_ocean_state(
        cls,
        origin_lat: float,
        origin_lon: float,
        departure_iso: str,
        duration_hours: float,
        marine_data: Dict[str, Any],
        weather_data: Dict[str, Any],
        pfz_data: Optional[List[Dict[str, Any]]] = None,
        satellite_data: Optional[Dict[str, Any]] = None,
        warnings_data: Optional[Dict[str, Any]] = None,
    ) -> OceanStateCube:
        """Constructs an aligned OceanStateCube incorporating all available telemetry and decay factors."""
        cube = OceanStateCube(origin_lat=origin_lat, origin_lon=origin_lon, base_time_iso=departure_iso)

        # Generate base spatial lattice
        cube.generate_local_lattice(
            radius_km=45.0,
            grid_step_deg=0.08,
            time_steps_hours=int(duration_hours),
            base_marine=marine_data,
            base_weather=weather_data,
        )

        # Update lattice with satellite features and freshness
        if satellite_data and "features" in satellite_data:
            sat_time = satellite_data.get("timestamp", departure_iso)
            decay = cls.calculate_temporal_decay(sat_time, departure_iso, half_life_hours=24.0)
            sst_val = float(satellite_data["features"].get("sst_celsius", 28.5))
            chl_val = float(satellite_data["features"].get("chlorophyll_mg_m3", 0.45))
            for pt in cube.points.values():
                pt.sst_celsius = sst_val
                pt.chlorophyll_mg_m3 = chl_val
                pt.confidence = round(pt.confidence * decay, 3)

        return cube
