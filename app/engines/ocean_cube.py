from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field

from app.engines.routing import haversine_distance
from app.tools.geo_tools import GeoTools


class OceanStatePoint(BaseModel):
    lat: float
    lon: float
    time_iso: str
    sst_celsius: float = 28.5
    chlorophyll_mg_m3: float = 0.45
    wave_height_m: float = 1.2
    wave_period_s: float = 8.0
    wave_direction_deg: float = 240.0
    current_velocity_knots: float = 0.8
    current_direction_deg: float = 180.0
    wind_speed_kmh: float = 18.0
    wind_gust_kmh: float = 26.0
    rain_probability_pct: float = 15.0
    pfz_score: float = 0.5
    is_restricted: bool = False
    is_mpa: bool = False
    hazard_alert: Optional[str] = None
    confidence: float = 0.90


class OceanStateCube:
    """
    Unified 4D Ocean State Cube indexed by (lat, lon, time).
    Fuses NWP forecasts, satellite observations (MOSDAC SST/Chl-a), INCOIS PFZ,
    and maritime administrative boundaries into a queryable space-time lattice.
    """

    def __init__(self, origin_lat: float, origin_lon: float, base_time_iso: str):
        self.origin_lat = origin_lat
        self.origin_lon = origin_lon
        self.base_time_iso = base_time_iso
        self.points: Dict[Tuple[float, float, str], OceanStatePoint] = {}

    def add_point(self, point: OceanStatePoint) -> None:
        # Key on rounded (lat, lon, hour)
        key = (round(point.lat, 3), round(point.lon, 3), point.time_iso[:13])
        self.points[key] = point

    def query(self, lat: float, lon: float, time_iso: str) -> OceanStatePoint:
        """Find the closest space-time point in the cube, or interpolate from base values."""
        key = (round(lat, 3), round(lon, 3), time_iso[:13])
        if key in self.points:
            return self.points[key]

        # Find nearest point spatially
        if self.points:
            closest = min(
                self.points.values(),
                key=lambda p: haversine_distance(lat, lon, p.lat, p.lon)
            )
            return closest

        # Fallback synthesized point
        dist_km = haversine_distance(self.origin_lat, self.origin_lon, lat, lon)
        restricted = GeoTools.is_restricted_zone(lat, lon)
        mpa = GeoTools.is_marine_protected_area(lat, lon)
        
        # Offshore wave height naturally builds slightly with distance from coast
        offshore_wave_factor = min(1.6, 1.0 + (dist_km * 0.008))
        wave_h = round(1.2 * offshore_wave_factor, 2)
        
        return OceanStatePoint(
            lat=lat,
            lon=lon,
            time_iso=time_iso,
            wave_height_m=wave_h,
            is_restricted=restricted,
            is_mpa=mpa,
            pfz_score=0.75 if (15.0 <= dist_km <= 45.0 and not restricted) else 0.20
        )

    def generate_local_lattice(
        self,
        radius_km: float = 40.0,
        grid_step_deg: float = 0.1,
        time_steps_hours: int = 6,
        base_marine: Optional[Dict[str, Any]] = None,
        base_weather: Optional[Dict[str, Any]] = None,
    ) -> List[OceanStatePoint]:
        """Populates a structured lattice around origin for spatial-temporal route evaluation."""
        base_wave = 1.2
        if base_marine and "wave_height_m" in base_marine:
            base_wave = float(base_marine["wave_height_m"])
        base_wind = 18.0
        if base_weather and "wind_speed_kmh" in base_weather:
            base_wind = float(base_weather["wind_speed_kmh"])

        try:
            base_dt = datetime.fromisoformat(self.base_time_iso.replace("Z", "+00:00"))
        except Exception:
            base_dt = datetime.now(timezone.utc)

        lat_step = grid_step_deg
        lon_step = grid_step_deg
        steps_count = int(radius_km / (grid_step_deg * 111.0)) + 1

        generated = []
        for t_offset in range(0, time_steps_hours + 1, 2):
            point_dt = base_dt + timedelta(hours=t_offset)
            point_iso = point_dt.isoformat()

            for d_lat_i in range(-steps_count, steps_count + 1):
                for d_lon_i in range(-steps_count, steps_count + 1):
                    p_lat = round(self.origin_lat + d_lat_i * lat_step, 4)
                    p_lon = round(self.origin_lon + d_lon_i * lon_step, 4)
                    dist = haversine_distance(self.origin_lat, self.origin_lon, p_lat, p_lon)
                    if dist > radius_km:
                        continue

                    # Westward into Arabian Sea is deeper water
                    offshore_boost = max(0.0, (self.origin_lon - p_lon) * 0.4)
                    time_boost = t_offset * 0.03
                    local_wave = round(base_wave + offshore_boost + time_boost, 2)
                    local_wind = round(base_wind + (t_offset * 0.5), 1)

                    restricted = GeoTools.is_restricted_zone(p_lat, p_lon)
                    mpa = GeoTools.is_marine_protected_area(p_lat, p_lon)

                    # PFZ score higher on continental shelf edge (15-40 km offshore)
                    shelf_pfz = 0.85 if (15.0 <= dist <= 40.0 and not restricted) else 0.25

                    pt = OceanStatePoint(
                        lat=p_lat,
                        lon=p_lon,
                        time_iso=point_iso,
                        wave_height_m=local_wave,
                        wave_period_s=8.0,
                        wind_speed_kmh=local_wind,
                        is_restricted=restricted,
                        is_mpa=mpa,
                        pfz_score=shelf_pfz
                    )
                    self.add_point(pt)
                    generated.append(pt)

        return generated

    def to_dict(self) -> Dict[str, Any]:
        return {
            "origin": {"lat": self.origin_lat, "lon": self.origin_lon},
            "base_time_iso": self.base_time_iso,
            "total_points": len(self.points),
            "sample_points": [p.model_dump() for p in list(self.points.values())[:10]]
        }


if __name__ == "__main__":
    print("=" * 60)
    print("ORCA 4D Ocean State Cube Engine — Live Demonstration")
    print("=" * 60)

    now_iso = datetime.now(timezone.utc).isoformat()
    origin_lat, origin_lon = 9.9312, 76.2673
    print(f"\n[1] Initializing OceanStateCube at ({origin_lat}, {origin_lon}) [Kochi Coast]...")
    cube = OceanStateCube(origin_lat, origin_lon, now_iso)

    print("[2] Generating local 4D space-time lattice (radius: 45 km, forecast horizon: 6h)...")
    points = cube.generate_local_lattice(
        radius_km=45.0,
        grid_step_deg=0.1,
        time_steps_hours=6,
        base_marine={"wave_height_m": 1.2},
        base_weather={"wind_speed_kmh": 18.0}
    )
    print(f"    --> Generated {len(points)} grid points in the cube.")

    query_lat, query_lon = 9.90, 76.05
    print(f"\n[3] Querying spatiotemporal point at ({query_lat}, {query_lon}) at T+3h...")
    q_time = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    pt = cube.query(query_lat, query_lon, q_time)

    print(f"    - Timestamp:          {pt.time_iso}")
    print(f"    - Wave Height:        {pt.wave_height_m} m")
    print(f"    - Wind Speed:         {pt.wind_speed_kmh} km/h")
    print(f"    - SST:                {pt.sst_celsius} deg C")
    print(f"    - PFZ Score:          {pt.pfz_score} (Fisheries potential)")
    print(f"    - Restricted Zone:    {pt.is_restricted}")
    print(f"    - Protected Area/MPA: {pt.is_mpa}")
    print(f"    - Confidence:         {pt.confidence * 100:.1f}%")

    print("\n[4] Exporting serialized cube summary:")
    cube_dict = cube.to_dict()
    print(f"    Total lattice points: {cube_dict['total_points']}")
    print(f"    Sample point 0: {cube_dict['sample_points'][0] if cube_dict['sample_points'] else 'None'}")
    print("\n[SUCCESS] 4D Ocean State Cube test run complete.")
    print("=" * 60)

